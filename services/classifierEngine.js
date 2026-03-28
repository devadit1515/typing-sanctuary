/**
 * Classifier Engine
 *
 * Six classifiers for keystroke dynamics authentication, all implemented
 * in pure JavaScript. Based on Killourhy & Maxion (2009) benchmark results
 * and keystroke dynamics literature.
 *
 * Classifiers:
 *   A. Scaled Manhattan Distance   — #1 in CMU benchmark
 *   B. Scaled Euclidean Distance   — Penalizes large deviations
 *   C. Mahalanobis (regularized)   — Captures feature correlations
 *   D. Manhattan Filtered          — Outlier-robust variant
 *   E. K-Nearest Neighbor          — Non-linear, instance-based
 *   F. One-Class Boundary          — Geometric boundary model
 *
 * All classifiers return a raw distance score (lower = more genuine).
 */

const { mahalanobisDistance } = require('./linearAlgebra');

// ── Classifier A: Scaled Manhattan Distance ────────────────────────

/**
 * The top performer in Killourhy & Maxion's CMU benchmark.
 * Distance = (1/p) * Σ |x_i - mean_i| / mad_i
 *
 * MAD (Mean Absolute Deviation) scaling makes each feature contribute
 * equally regardless of scale.
 *
 * @param {number[]} testVector - Test feature vector (selected features)
 * @param {object} profile - { means, mads }
 * @returns {number} Scaled Manhattan distance
 */
function scaledManhattan(testVector, profile) {
  const { means, mads } = profile;
  const p = testVector.length;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < p; i++) {
    const mad = mads[i];
    if (mad < 1e-10) continue; // Skip zero-variance features
    sum += Math.abs(testVector[i] - means[i]) / mad;
    count++;
  }

  return count > 0 ? sum / count : 0;
}

// ── Classifier B: Scaled Euclidean Distance ────────────────────────

/**
 * Same as Scaled Manhattan but uses squared differences.
 * Penalizes large single-feature deviations more heavily.
 *
 * Distance = sqrt((1/p) * Σ ((x_i - mean_i) / mad_i)²)
 *
 * @param {number[]} testVector
 * @param {object} profile - { means, mads }
 * @returns {number}
 */
function scaledEuclidean(testVector, profile) {
  const { means, mads } = profile;
  const p = testVector.length;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < p; i++) {
    const mad = mads[i];
    if (mad < 1e-10) continue;
    const scaled = (testVector[i] - means[i]) / mad;
    sum += scaled * scaled;
    count++;
  }

  return count > 0 ? Math.sqrt(sum / count) : 0;
}

// ── Classifier C: Mahalanobis Distance (Regularized) ───────────────

/**
 * Multivariate distance using Ledoit-Wolf shrunk covariance matrix.
 * Captures feature correlations that Manhattan/Euclidean miss.
 *
 * D_M = sqrt((x - μ)^T Σ^{-1} (x - μ))
 *
 * Falls back to Scaled Euclidean if covariance data unavailable.
 *
 * @param {number[]} testVector
 * @param {object} profile - { means, covarianceInverse, stdDevs }
 * @returns {number}
 */
function mahalanobisClassifier(testVector, profile) {
  const { means, covarianceInverse, stdDevs } = profile;

  // If we have a valid covariance inverse, use Mahalanobis
  if (covarianceInverse && covarianceInverse.length > 0) {
    return mahalanobisDistance(testVector, means, covarianceInverse);
  }

  // Fallback: use per-feature stdDev scaling (diagonal Mahalanobis)
  const p = testVector.length;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < p; i++) {
    const sd = stdDevs[i];
    if (sd < 1e-10) continue;
    const z = (testVector[i] - means[i]) / sd;
    sum += z * z;
    count++;
  }
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

// ── Classifier D: Manhattan Filtered ───────────────────────────────

/**
 * Scaled Manhattan but drops features where |x_i - mean_i| / mad_i > τ.
 * This makes the classifier robust to occasional outlier features
 * (e.g., an unusual digraph timing due to a momentary distraction).
 *
 * Was the single best performer in some keystroke dynamics evaluations.
 *
 * @param {number[]} testVector
 * @param {object} profile - { means, mads }
 * @param {number} [tau=3.0] - Outlier threshold
 * @returns {number}
 */
function manhattanFiltered(testVector, profile, tau = 3.0) {
  const { means, mads } = profile;
  const p = testVector.length;
  let sum = 0;
  let count = 0;
  let totalValid = 0;

  for (let i = 0; i < p; i++) {
    const mad = mads[i];
    if (mad < 1e-10) continue;
    totalValid++;
    const scaled = Math.abs(testVector[i] - means[i]) / mad;
    if (scaled > tau) continue; // Drop outlier features
    sum += scaled;
    count++;
  }

  // If all features were filtered (extreme impostor), return max penalty
  if (count === 0 && totalValid > 0) return tau;

  return count > 0 ? sum / count : 0;
}

// ── Classifier E: K-Nearest Neighbor ───────────────────────────────

/**
 * Instance-based classifier using stored training vectors.
 * Score = mean scaled Manhattan distance to K nearest training vectors.
 *
 * Captures non-linear decision boundaries and multi-modal typing patterns
 * (e.g., user types differently at different times of day).
 *
 * @param {number[]} testVector
 * @param {object} profile - { rawVectors, mads }
 * @param {number} [k] - Number of neighbors (default: min(7, floor(sqrt(n))))
 * @returns {number}
 */
function kNearestNeighbor(testVector, profile, k) {
  const { rawVectors, mads } = profile;

  if (!rawVectors || rawVectors.length === 0) return 0;

  const n = rawVectors.length;
  if (!k) k = Math.min(7, Math.floor(Math.sqrt(n)));
  k = Math.min(k, n);

  // Compute scaled Manhattan distance from test to each stored vector
  const distances = new Array(n);
  for (let s = 0; s < n; s++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < testVector.length; i++) {
      const mad = mads[i];
      if (mad < 1e-10) continue;
      sum += Math.abs(testVector[i] - rawVectors[s][i]) / mad;
      count++;
    }
    distances[s] = count > 0 ? sum / count : 0;
  }

  // Find K smallest distances
  distances.sort((a, b) => a - b);
  let kSum = 0;
  for (let i = 0; i < k; i++) kSum += distances[i];

  return kSum / k;
}

// ── Classifier F: One-Class Boundary ───────────────────────────────

/**
 * Simplified one-class model:
 *   1. Centroid = mean of training vectors
 *   2. Boundary radius R = 95th percentile of training distances to centroid
 *   3. Score = dist(test, centroid) / R
 *
 * Score < 1.0 means inside the boundary (genuine).
 * Score > 1.0 means outside (impostor).
 *
 * @param {number[]} testVector
 * @param {object} profile - { means, mads, boundaryRadius }
 * @returns {number}
 */
function oneClassBoundary(testVector, profile) {
  const { means, mads, boundaryRadius } = profile;

  if (!boundaryRadius || boundaryRadius <= 0) {
    // Fallback to scaled Manhattan (boundary not calibrated yet)
    return scaledManhattan(testVector, profile);
  }

  // Distance from test to centroid using scaled Manhattan
  let sum = 0;
  let count = 0;
  for (let i = 0; i < testVector.length; i++) {
    const mad = mads[i];
    if (mad < 1e-10) continue;
    sum += Math.abs(testVector[i] - means[i]) / mad;
    count++;
  }
  const dist = count > 0 ? sum / count : 0;

  return dist / boundaryRadius;
}

// ── Run All Classifiers ────────────────────────────────────────────

/**
 * Run all 6 classifiers on a test vector and return raw scores.
 *
 * @param {number[]} testVector - Selected feature vector
 * @param {object} profile - Full profile object with:
 *   { means, medians, stdDevs, mads, madMedians, rawVectors,
 *     covarianceInverse, boundaryRadius }
 * @returns {object} Raw scores per classifier
 */
function runAllClassifiers(testVector, profile) {
  return {
    scaledManhattan: scaledManhattan(testVector, profile),
    scaledEuclidean: scaledEuclidean(testVector, profile),
    mahalanobis: mahalanobisClassifier(testVector, profile),
    manhattanFiltered: manhattanFiltered(testVector, profile),
    knn: kNearestNeighbor(testVector, profile),
    oneClass: oneClassBoundary(testVector, profile)
  };
}

/**
 * Compute profile statistics from raw feature vectors.
 * Used during profile building and updates.
 *
 * @param {number[][]} rawVectors - Array of feature vectors (each same length)
 * @returns {{ means, medians, stdDevs, mads, madMedians }}
 */
function computeProfileStats(rawVectors) {
  if (!rawVectors || rawVectors.length === 0) return null;

  const n = rawVectors.length;
  const p = rawVectors[0].length;

  const means = new Array(p).fill(0);
  const medians = new Array(p).fill(0);
  const stdDevs = new Array(p).fill(0);
  const mads = new Array(p).fill(0);       // MAD from mean
  const madMedians = new Array(p).fill(0);  // MAD from median

  for (let f = 0; f < p; f++) {
    // Collect values for this feature
    const values = new Array(n);
    for (let s = 0; s < n; s++) values[s] = rawVectors[s][f];

    // Mean
    let sum = 0;
    for (let s = 0; s < n; s++) sum += values[s];
    means[f] = sum / n;

    // Median
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(n / 2);
    medians[f] = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    // Standard deviation
    let varSum = 0;
    for (let s = 0; s < n; s++) {
      const d = values[s] - means[f];
      varSum += d * d;
    }
    stdDevs[f] = n > 1 ? Math.sqrt(varSum / (n - 1)) : 0;

    // MAD from mean
    let madSum = 0;
    for (let s = 0; s < n; s++) madSum += Math.abs(values[s] - means[f]);
    mads[f] = madSum / n;

    // MAD from median
    let madMedSum = 0;
    for (let s = 0; s < n; s++) madMedSum += Math.abs(values[s] - medians[f]);
    madMedians[f] = madMedSum / n;
  }

  return { means, medians, stdDevs, mads, madMedians };
}

/**
 * Compute the boundary radius for the one-class classifier.
 * R = 95th percentile of distances from each training vector to the centroid.
 *
 * @param {number[][]} rawVectors
 * @param {object} stats - { means, mads }
 * @returns {number}
 */
function computeBoundaryRadius(rawVectors, stats) {
  if (!rawVectors || rawVectors.length < 3) return 1.0;

  const distances = rawVectors.map(v => scaledManhattan(v, stats));
  distances.sort((a, b) => a - b);

  // 95th percentile
  const idx = Math.floor(distances.length * 0.95);
  const p95 = distances[Math.min(idx, distances.length - 1)];

  return Math.max(p95, 0.01); // Prevent zero boundary
}

module.exports = {
  // Individual classifiers
  scaledManhattan,
  scaledEuclidean,
  mahalanobisClassifier,
  manhattanFiltered,
  kNearestNeighbor,
  oneClassBoundary,
  // Aggregate
  runAllClassifiers,
  // Profile building utilities
  computeProfileStats,
  computeBoundaryRadius
};
