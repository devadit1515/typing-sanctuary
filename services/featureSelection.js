/**
 * Feature Selection Module
 *
 * Stability-weighted feature selection that chooses the 50-80 most
 * discriminative and reliable features from the 200-dimensional raw
 * feature space.
 *
 * Selection criteria per feature:
 *   1. Observation rate >= 0.5 (seen in at least half the samples)
 *   2. Quality score Q = obsRate * (1 / (1 + CV)) >= threshold
 *   3. Minimum 50, maximum 80 features selected
 */

const { FEATURE_COUNT } = require('./featureEngineering');

const MIN_FEATURES = 50;
const MAX_FEATURES = 80;
const DEFAULT_QUALITY_THRESHOLD = 0.3;
const MIN_OBSERVATION_RATE = 0.5;

/**
 * Select the best features from a set of training feature vectors.
 *
 * @param {number[][]} featureVectors - Array of 200D feature vectors (one per sample)
 * @param {boolean[][]} observedArrays - Array of 200D observed masks (one per sample)
 * @param {object} [options]
 * @param {number} [options.qualityThreshold=0.3] - Minimum quality score
 * @param {number} [options.minFeatures=50] - Minimum features to select
 * @param {number} [options.maxFeatures=80] - Maximum features to select
 * @returns {{ selectedIndices: number[], qualityScores: number[], featureNames: string[] }}
 */
function selectFeatures(featureVectors, observedArrays, options = {}) {
  const qualityThreshold = options.qualityThreshold || DEFAULT_QUALITY_THRESHOLD;
  const minFeatures = options.minFeatures || MIN_FEATURES;
  const maxFeatures = options.maxFeatures || MAX_FEATURES;

  const nSamples = featureVectors.length;
  const nFeatures = featureVectors[0]?.length || FEATURE_COUNT;

  if (nSamples < 3) {
    // Not enough samples for meaningful selection — use all non-zero features
    return fallbackSelection(featureVectors, observedArrays);
  }

  const qualityScores = new Array(nFeatures).fill(0);
  const observationRates = new Array(nFeatures).fill(0);

  for (let f = 0; f < nFeatures; f++) {
    // Observation rate: fraction of samples where this feature was observed
    let obsCount = 0;
    for (let s = 0; s < nSamples; s++) {
      if (observedArrays[s][f]) obsCount++;
    }
    observationRates[f] = obsCount / nSamples;

    // Collect observed values for this feature
    const values = [];
    for (let s = 0; s < nSamples; s++) {
      if (observedArrays[s][f]) values.push(featureVectors[s][f]);
    }

    if (values.length < 2) {
      qualityScores[f] = 0;
      continue;
    }

    // Coefficient of variation
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[i];
    const mu = sum / values.length;

    let varSum = 0;
    for (let i = 0; i < values.length; i++) {
      const d = values[i] - mu;
      varSum += d * d;
    }
    const sd = Math.sqrt(varSum / (values.length - 1));
    const cv = Math.abs(mu) > 1e-10 ? sd / Math.abs(mu) : (sd > 0 ? 10 : 0);

    // Quality score: observation rate * stability
    qualityScores[f] = observationRates[f] * (1 / (1 + cv));
  }

  // Build candidate list: features passing minimum criteria
  const candidates = [];
  for (let f = 0; f < nFeatures; f++) {
    if (observationRates[f] >= MIN_OBSERVATION_RATE && qualityScores[f] >= qualityThreshold) {
      candidates.push({ index: f, quality: qualityScores[f] });
    }
  }

  // Sort by quality (descending)
  candidates.sort((a, b) => b.quality - a.quality);

  // If not enough candidates pass the threshold, lower the bar
  if (candidates.length < minFeatures) {
    // Add features sorted by quality until we reach minimum
    const allCandidates = [];
    for (let f = 0; f < nFeatures; f++) {
      if (!candidates.find(c => c.index === f) && observationRates[f] >= 0.3) {
        allCandidates.push({ index: f, quality: qualityScores[f] });
      }
    }
    allCandidates.sort((a, b) => b.quality - a.quality);

    const needed = minFeatures - candidates.length;
    for (let i = 0; i < Math.min(needed, allCandidates.length); i++) {
      candidates.push(allCandidates[i]);
    }
  }

  // Cap at maxFeatures
  const selected = candidates.slice(0, maxFeatures);

  // Sort by index for consistent ordering
  selected.sort((a, b) => a.index - b.index);

  const selectedIndices = selected.map(c => c.index);
  const selectedQuality = selected.map(c => c.quality);

  return {
    selectedIndices,
    qualityScores: selectedQuality
  };
}

/**
 * Fallback selection when we have too few samples.
 * Selects all features that have non-zero values in at least one sample.
 */
function fallbackSelection(featureVectors, observedArrays) {
  const nFeatures = featureVectors[0]?.length || FEATURE_COUNT;
  const candidates = [];

  for (let f = 0; f < nFeatures; f++) {
    let anyObserved = false;
    for (let s = 0; s < featureVectors.length; s++) {
      if (observedArrays[s] && observedArrays[s][f]) {
        anyObserved = true;
        break;
      }
    }
    if (anyObserved) {
      candidates.push({ index: f, quality: 0.5 });
    }
  }

  // Cap at MAX_FEATURES, preferring lower indices (global stats first)
  const selected = candidates.slice(0, MAX_FEATURES);
  return {
    selectedIndices: selected.map(c => c.index),
    qualityScores: selected.map(c => c.quality)
  };
}

module.exports = {
  selectFeatures,
  MIN_FEATURES,
  MAX_FEATURES
};
