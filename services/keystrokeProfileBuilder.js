/**
 * Keystroke profile builder — the bridge from raw enrollment windows to the
 * `Profile` shape the inference service's POST /verify contract expects
 * (ml-service/app/contract.py `Profile`):
 *
 *     { centroid: number[128], covInverse: number[128][128] | null,
 *       refs: number[][], threshold: number }
 *
 * This is the missing seam identified in planning: the ML client can /embed and
 * /embed_batch and /verify, but NOTHING turned a batch of enrollment embeddings
 * into a verify-ready profile. This module does exactly that, reusing the
 * existing JS Ledoit-Wolf shrinkage (services/linearAlgebra.js) so the covariance
 * matches the research harness's NumPy port (the project's single ensemble).
 *
 * It is STANDALONE: it does not touch verificationPipeline / adaptiveLearning /
 * the 200-dim featureEngineering legacy stack. It operates purely in the learned
 * 128-D embedding space.
 */
const mlServiceClient = require('./mlServiceClient');
const { ledoitWolfShrinkage } = require('./linearAlgebra');

/**
 * Mean of an array of equal-length vectors -> the centroid ("average fingerprint").
 */
function centroidOf(embeddings) {
  const d = embeddings[0].length;
  const c = new Array(d).fill(0);
  for (const e of embeddings) for (let i = 0; i < d; i++) c[i] += e[i];
  for (let i = 0; i < d; i++) c[i] /= embeddings.length;
  return c;
}

/**
 * Per-dimension-averaged L1 distance — identical to ml-service verify.py
 * `_l1_to_centroid` (sum |a-b| / d), so calibration uses the same metric the
 * server scores with.
 */
function l1(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

/**
 * Calibrate the personal acceptance threshold from the genuine spread.
 *
 * DECISION (security vs UX trade-off, design spec §5.3): we set the threshold
 * from the user's OWN enrollment scatter rather than a fixed global value. Each
 * enrollment embedding is scored (L1) against the centroid of the *others*
 * (leave-one-out, so a window is never scored against itself), giving a
 * distribution of "how far a genuine window typically lands". The threshold is
 * the `percentile`-th of that distribution times a `margin` cushion.
 *
 * Interpretation: "accept a new window if it is at least as typical as
 * `percentile`% of your own enrolment typing." Consistent typists get a tight
 * threshold (high security); variable typists get a looser one (fewer false
 * rejects) — the calibration adapts per user instead of one-size-fits-all.
 *
 * @param {number[][]} embeddings enrollment embeddings (>=2)
 * @param {number} percentile 0..1 of the genuine LOO scores (default 0.9)
 * @param {number} margin multiplicative safety cushion (default 1.15)
 */
// A near-zero threshold is degenerate: a perfectly consistent typist on a short
// fixed password produces near-identical embeddings, so the LOO spread is ~0.
// That both makes verification brittle (accepts almost nothing) and, downstream,
// blew up the confidence sigmoid (score/threshold -> inf). Floor the threshold
// at a small positive value so every profile is usable and the server is safe.
const MIN_THRESHOLD = 1e-3;

function calibrateThreshold(embeddings, percentile = 0.9, margin = 1.15) {
  const n = embeddings.length;
  if (n < 2) {
    // Not enough data for leave-one-out; fall back to a small positive default
    // so the profile is still usable. A profile this thin should be re-enrolled.
    return 0.5;
  }
  const looScores = [];
  for (let i = 0; i < n; i++) {
    const others = embeddings.filter((_, j) => j !== i);
    looScores.push(l1(embeddings[i], centroidOf(others)));
  }
  looScores.sort((a, b) => a - b);
  const idx = Math.min(n - 1, Math.floor(percentile * n));
  return Math.max(MIN_THRESHOLD, looScores[idx] * margin);
}

/**
 * Build a verify-ready profile from already-computed enrollment embeddings.
 * Pure function (no I/O) so it is unit-testable without the ML service.
 *
 * @param {number[][]} embeddings  N enrollment embeddings (each length 128)
 * @param {object} [opts] { percentile, margin }
 * @returns {{centroid:number[], covInverse:number[][]|null, refs:number[][], threshold:number}}
 */
function buildProfileFromEmbeddings(embeddings, opts = {}) {
  if (!Array.isArray(embeddings) || embeddings.length === 0) {
    throw new Error('buildProfileFromEmbeddings: need >=1 enrollment embedding');
  }
  const centroid = centroidOf(embeddings);
  // Ledoit-Wolf needs >=2 samples for a meaningful covariance; with one window
  // we ship covInverse:null and /verify falls back to the Manhattan term
  // (verify.py: `maha = ... if cov_inv else manhattan`) — fail-safe, not a crash.
  let covInverse = null;
  if (embeddings.length >= 2) {
    const lw = ledoitWolfShrinkage(embeddings);
    covInverse = lw.inverse; // 128x128, or null if the matrix was singular
  }
  const threshold = calibrateThreshold(
    embeddings, opts.percentile, opts.margin);
  return { centroid, covInverse, refs: embeddings, threshold };
}

/**
 * Full enrollment path: take raw keystroke windows, embed them via the ML
 * service (/embed_batch), and build the profile. Throws if the ML service is
 * unreachable — callers MUST treat that as "enrollment failed", never as a
 * silently-empty profile (fail-safe).
 *
 * @param {Array<Array<object>>} windows raw keystroke windows
 * @param {string} modelVersion the model version to tag the embeddings with
 * @param {object} [opts] forwarded to buildProfileFromEmbeddings
 */
async function buildProfileFromWindows(windows, modelVersion, opts = {}) {
  const res = await mlServiceClient.embedBatch(windows, modelVersion);
  const embeddings = res.embeddings;
  if (!embeddings || embeddings.length === 0) {
    throw new Error('profile build failed: ML service returned no embeddings');
  }
  const profile = buildProfileFromEmbeddings(embeddings, opts);
  return { profile, modelVersion: res.modelVersion };
}

module.exports = {
  buildProfileFromEmbeddings,
  buildProfileFromWindows,
  calibrateThreshold,
  centroidOf,
};
