/**
 * Verification Pipeline
 *
 * End-to-end orchestrator for keystroke biometric verification.
 * Replaces authenticationService.js with a clean pipeline:
 *
 *   Keystrokes → Feature Extraction → Feature Selection → 6 Classifiers
 *   → Score Normalization → Score Fusion → Threshold Comparison → Result
 */

const { extractFeatureVector, selectSubset } = require('./featureEngineering');
const { runAllClassifiers } = require('./classifierEngine');
const { normalizeScores, fuseScores, computeConfidence, CLASSIFIER_NAMES } = require('./scoreFusion');

// ── Single-Shot Verification ───────────────────────────────────────

/**
 * Verify a keystroke sample against a user's biometric profile.
 *
 * @param {object} profile - The user's v2 biometric profile:
 *   { selectedFeatures, means, medians, stdDevs, mads, madMedians,
 *     rawVectors, covarianceInverse, boundaryRadius,
 *     calibration, fusionWeights, fusionMethod, threshold }
 * @param {Array} keystrokes - Raw keystroke array from frontend
 * @param {object} [options]
 * @param {boolean} [options.returnDetails=true] - Include per-classifier details
 * @returns {object} Verification result
 */
function verifyKeystrokeSample(profile, keystrokes, options = {}) {
  const returnDetails = options.returnDetails !== false;

  // 1. Extract full 200D feature vector
  const featureData = extractFeatureVector(keystrokes);
  if (!featureData) {
    return {
      authenticated: false,
      confidence: 0,
      riskLevel: 'HIGH',
      error: 'Insufficient keystroke data for feature extraction',
      method: 'multi_classifier_ensemble_v2'
    };
  }

  // 2. Check profile has required data
  if (!profile || !profile.selectedFeatures || !profile.means || profile.means.length === 0) {
    return {
      authenticated: false,
      confidence: 0,
      riskLevel: 'HIGH',
      error: 'Profile not built yet — need more training samples',
      method: 'multi_classifier_ensemble_v2'
    };
  }

  // 3. Select features matching profile's selected indices
  const testVector = selectSubset(featureData.vector, profile.selectedFeatures);

  // 4. Run all 6 classifiers
  const rawScores = runAllClassifiers(testVector, profile);

  // 5. Normalize scores using calibration data
  const calibration = profile.calibration || {};
  const normalized = normalizeScores(rawScores, calibration);

  // 6. Fuse scores
  const fused = fuseScores(
    normalized,
    profile.fusionWeights || null,
    profile.fusionMethod || 'mean'
  );

  // 7. Compare against threshold
  const threshold = profile.threshold || 0.5;
  const authenticated = fused <= threshold;

  // 8. Compute confidence
  const confidence = computeConfidence(fused, threshold);

  // 9. Determine risk level
  const riskLevel = confidence >= 85 ? 'LOW' : confidence >= 50 ? 'MEDIUM' : 'HIGH';

  // 10. Build result
  const result = {
    authenticated,
    confidence,
    riskLevel,
    fusedScore: Math.round(fused * 10000) / 10000,
    threshold: Math.round(threshold * 10000) / 10000,
    method: 'multi_classifier_ensemble_v2'
  };

  if (returnDetails) {
    result.perClassifierScores = {};
    for (const name of CLASSIFIER_NAMES) {
      result.perClassifierScores[name] = {
        raw: Math.round(rawScores[name] * 10000) / 10000,
        normalized: Math.round(normalized[name] * 10000) / 10000
      };
    }
    result.featuresCovered = {
      digraphs: featureData.metadata.digraphsCovered,
      trigraphs: featureData.metadata.trigraphsCovered,
      totalKeystrokes: featureData.metadata.keystrokeCount
    };
  }

  return result;
}

// ── Continuous Verification ────────────────────────────────────────

/**
 * Continuous verification on a sliding window of keystrokes.
 * Called periodically during an active session.
 *
 * @param {object} profile - User's v2 biometric profile
 * @param {Array} recentKeystrokes - Last N keystrokes
 * @param {number} [windowSize=50] - Minimum keystrokes for verification
 * @returns {object}
 */
function continuousVerification(profile, recentKeystrokes, windowSize = 50) {
  if (!recentKeystrokes || recentKeystrokes.length < windowSize) {
    return {
      shouldContinue: true,
      reason: 'Insufficient keystrokes for continuous verification',
      confidence: null,
      riskLevel: null
    };
  }

  // Use the most recent windowSize keystrokes
  const window = recentKeystrokes.slice(-windowSize);
  const result = verifyKeystrokeSample(profile, window, { returnDetails: false });

  return {
    shouldContinue: result.riskLevel !== 'HIGH',
    anomalyScore: result.fusedScore,
    confidence: result.confidence,
    riskLevel: result.riskLevel,
    action: determineAction(result.confidence, result.riskLevel)
  };
}

// ── Action Determination ───────────────────────────────────────────

/**
 * Determine what action to take based on verification result.
 *
 * @param {number} confidence
 * @param {string} riskLevel
 * @returns {object}
 */
function determineAction(confidence, riskLevel) {
  if (riskLevel === 'LOW') {
    return {
      action: 'allow',
      requiresChallenge: false,
      description: 'Typing pattern matches user profile'
    };
  }

  if (riskLevel === 'MEDIUM') {
    return {
      action: 'monitor',
      requiresChallenge: false,
      increaseMonitoring: true,
      description: 'Typing pattern partially matches — monitoring'
    };
  }

  // HIGH risk
  return {
    action: 'challenge',
    requiresChallenge: true,
    suggestedChallenge: 'mfa',
    description: 'Typing pattern does not match — additional verification required'
  };
}

/**
 * Check if a profile needs updating based on age and sample count.
 *
 * @param {object} profile
 * @param {Date} lastUpdated
 * @param {number} sampleCount
 * @returns {boolean}
 */
function needsProfileUpdate(profile, lastUpdated, sampleCount) {
  if (!profile || !profile.means || profile.means.length === 0) return true;
  if (sampleCount < 10) return true;

  // Update if older than 1 week
  if (lastUpdated) {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(lastUpdated).getTime() > weekMs) return true;
  }

  return false;
}

module.exports = {
  verifyKeystrokeSample,
  continuousVerification,
  determineAction,
  needsProfileUpdate
};
