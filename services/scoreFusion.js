/**
 * Score Fusion Module
 *
 * Combines scores from 6 classifiers into a single fused score using:
 *   1. Min-max normalization from leave-one-out training scores
 *   2. Simple mean (< 25 samples) or weighted mean (≥ 25 samples)
 *   3. Per-user adaptive thresholds via LOO cross-validation
 *   4. Sigmoid-based confidence mapping
 */

const { runAllClassifiers, computeProfileStats, computeBoundaryRadius } = require('./classifierEngine');
const { ledoitWolfShrinkage } = require('./linearAlgebra');
const { selectSubset } = require('./featureEngineering');

const CLASSIFIER_NAMES = [
  'scaledManhattan', 'scaledEuclidean', 'mahalanobis',
  'manhattanFiltered', 'knn', 'oneClass'
];

// ── Score Normalization ────────────────────────────────────────────

/**
 * Normalize raw classifier scores to [0, 1] using min-max from training.
 *
 * @param {object} rawScores - { scaledManhattan: number, ... }
 * @param {object} calibration - Per-classifier { min, max }
 * @returns {object} Normalized scores in [0, 1]
 */
function normalizeScores(rawScores, calibration) {
  const normalized = {};

  for (const name of CLASSIFIER_NAMES) {
    const raw = rawScores[name];
    const cal = calibration[name];

    if (!cal || cal.max <= cal.min) {
      // No calibration data — pass through raw score clamped to reasonable range
      normalized[name] = Math.min(Math.max(raw, 0), 5) / 5;
    } else {
      // Min-max normalization
      normalized[name] = Math.min(Math.max((raw - cal.min) / (cal.max - cal.min), 0), 1);
    }
  }

  return normalized;
}

/**
 * Fuse normalized scores into a single score.
 *
 * @param {object} normalizedScores
 * @param {number[]|null} weights - Fusion weights (null = simple mean)
 * @param {string} method - 'mean', 'median', or 'weighted'
 * @returns {number} Fused score in [0, 1]
 */
function fuseScores(normalizedScores, weights, method) {
  const values = CLASSIFIER_NAMES.map(name => normalizedScores[name]);

  if (method === 'weighted' && weights && weights.length === values.length) {
    let sum = 0;
    let wSum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i] * weights[i];
      wSum += weights[i];
    }
    return wSum > 0 ? sum / wSum : mean(values);
  }

  if (method === 'median') {
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // Default: simple mean
  return mean(values);
}

function mean(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

// ── Leave-One-Out Calibration ──────────────────────────────────────

/**
 * Perform leave-one-out cross-validation on training data to produce
 * calibration scores for each classifier and fusion weights.
 *
 * For each training sample j:
 *   1. Build a mini-profile from all samples EXCEPT j
 *   2. Score sample j against that mini-profile with all 6 classifiers
 *   3. Store the scores
 *
 * @param {number[][]} rawVectors - All training feature vectors (selected features)
 * @param {number[]} selectedIndices - Selected feature indices (for covariance)
 * @returns {object} Calibration data
 */
function leaveOneOutCalibration(rawVectors, selectedIndices) {
  const n = rawVectors.length;
  if (n < 5) return defaultCalibration();

  // Per-classifier LOO scores
  const looScores = {};
  for (const name of CLASSIFIER_NAMES) {
    looScores[name] = [];
  }
  const fusedLOOScores = [];

  for (let j = 0; j < n; j++) {
    // Build mini-profile excluding sample j
    const subset = [];
    for (let i = 0; i < n; i++) {
      if (i !== j) subset.push(rawVectors[i]);
    }

    const miniStats = computeProfileStats(subset);
    if (!miniStats) continue;

    // Compute covariance for Mahalanobis
    let covInverse = null;
    if (subset.length >= 10) {
      const covResult = ledoitWolfShrinkage(subset);
      covInverse = covResult.inverse;
    }

    const miniProfile = {
      ...miniStats,
      rawVectors: subset,
      covarianceInverse: covInverse,
      boundaryRadius: computeBoundaryRadius(subset, miniStats)
    };

    // Score the held-out sample
    const scores = runAllClassifiers(rawVectors[j], miniProfile);

    for (const name of CLASSIFIER_NAMES) {
      looScores[name].push(scores[name]);
    }
  }

  // Build calibration: min/max per classifier
  const calibration = {};
  for (const name of CLASSIFIER_NAMES) {
    const scores = looScores[name];
    if (scores.length === 0) {
      calibration[name] = { trainScores: [], min: 0, max: 1 };
      continue;
    }
    const sorted = scores.slice().sort((a, b) => a - b);
    calibration[name] = {
      trainScores: scores,
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }

  // Compute fused LOO scores (simple mean normalization first)
  for (let j = 0; j < looScores[CLASSIFIER_NAMES[0]].length; j++) {
    const rawScoresJ = {};
    for (const name of CLASSIFIER_NAMES) {
      rawScoresJ[name] = looScores[name][j];
    }
    const normalizedJ = normalizeScores(rawScoresJ, calibration);
    fusedLOOScores.push(mean(CLASSIFIER_NAMES.map(name => normalizedJ[name])));
  }

  // Compute fusion weights (for ≥ 25 samples)
  let fusionWeights = null;
  let fusionMethod = 'mean';

  if (n >= 25) {
    fusionWeights = computeFusionWeights(looScores);
    fusionMethod = 'weighted';
  }

  // Compute threshold from fused LOO scores
  const sortedFused = fusedLOOScores.slice().sort((a, b) => a - b);
  const p95Idx = Math.min(Math.floor(sortedFused.length * 0.95), sortedFused.length - 1);
  const threshold = sortedFused[p95Idx] * 1.05; // 5% safety margin

  const thresholdConfidence = n >= 50 ? 'high' : n >= 25 ? 'medium' : 'low';

  return {
    calibration,
    fusionWeights,
    fusionMethod,
    threshold: Math.max(threshold, 0.1), // Minimum threshold
    thresholdConfidence,
    fusedTrainScores: fusedLOOScores
  };
}

/**
 * Compute fusion weights proportional to each classifier's discriminative power.
 * Weight = 1 / (meanGenuineScore + epsilon) — classifiers that produce lower
 * genuine scores are better discriminators.
 */
function computeFusionWeights(looScores) {
  const weights = new Array(CLASSIFIER_NAMES.length);
  const epsilon = 0.01;

  for (let i = 0; i < CLASSIFIER_NAMES.length; i++) {
    const scores = looScores[CLASSIFIER_NAMES[i]];
    if (scores.length === 0) {
      weights[i] = 1;
      continue;
    }
    const mu = mean(scores);
    weights[i] = 1 / (mu + epsilon);
  }

  // Normalize weights to sum to 1
  const wSum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) weights[i] /= wSum;

  return weights;
}

/**
 * Default calibration when insufficient data.
 */
function defaultCalibration() {
  const calibration = {};
  for (const name of CLASSIFIER_NAMES) {
    calibration[name] = { trainScores: [], min: 0, max: 1 };
  }
  return {
    calibration,
    fusionWeights: null,
    fusionMethod: 'mean',
    threshold: 0.5,
    thresholdConfidence: 'low',
    fusedTrainScores: []
  };
}

// ── Confidence Scoring ─────────────────────────────────────────────

/**
 * Map fused score and threshold to a confidence percentage (0-100).
 * Uses a sigmoid function with steepness k=5 centered at the threshold.
 *
 * confidence = 100 / (1 + exp(k * (fusedScore / threshold - 1)))
 *
 * - fusedScore = 0 → ~100% confidence
 * - fusedScore = threshold → ~50% confidence
 * - fusedScore = 2*threshold → ~0.7% confidence
 *
 * @param {number} fusedScore
 * @param {number} threshold
 * @returns {number} Confidence percentage 0-100
 */
function computeConfidence(fusedScore, threshold) {
  if (threshold <= 0) return fusedScore <= 0.1 ? 100 : 0;

  const k = 5; // Steepness
  const normalizedDist = fusedScore / threshold;
  const confidence = 100 / (1 + Math.exp(k * (normalizedDist - 1)));

  return Math.round(Math.min(100, Math.max(0, confidence)) * 100) / 100;
}

module.exports = {
  normalizeScores,
  fuseScores,
  leaveOneOutCalibration,
  computeConfidence,
  CLASSIFIER_NAMES
};
