/**
 * Authentication Service
 * Implements statistical methods for keystroke dynamics authentication
 */

/**
 * Verify if keystroke sample matches user's biometric profile
 * Uses z-score based anomaly detection
 *
 * @param {Object} profile - User's biometric profile
 * @param {Object} sample - New keystroke sample features
 * @returns {Object} Authentication result with anomaly score
 */
function verifyKeystrokeSample(profile, sample) {
  if (!profile || !profile.dwellTime || !sample || !sample.dwellTime) {
    return {
      authenticated: false,
      anomalyScore: 1.0,
      confidence: 0,
      reason: 'Insufficient profile or sample data'
    };
  }

  const scores = [];
  const features = [];

  // 1. Compare dwell time statistics
  if (profile.dwellTime && sample.dwellTime) {
    const dwellScore = calculateZScore(
      sample.dwellTime.mean,
      profile.dwellTime.mean,
      profile.dwellTime.stdDev
    );
    scores.push(dwellScore);
    features.push({ name: 'dwellTime', score: dwellScore });
  }

  // 2. Compare flight time statistics
  if (profile.flightTime && sample.flightTime) {
    const flightScore = calculateZScore(
      sample.flightTime.mean,
      profile.flightTime.mean,
      profile.flightTime.stdDev
    );
    scores.push(flightScore);
    features.push({ name: 'flightTime', score: flightScore });
  }

  // 3. Compare typing rhythm
  if (profile.rhythm && sample.rhythm) {
    if (profile.rhythm.burstSpeed > 0) {
      const burstScore = calculateZScore(
        sample.rhythm.burstSpeed,
        profile.rhythm.burstSpeed,
        profile.rhythm.burstSpeed * 0.2 // Assume 20% std dev if not stored
      );
      scores.push(burstScore);
      features.push({ name: 'burstSpeed', score: burstScore });
    }

    if (profile.rhythm.pauseFrequency > 0) {
      const pauseFreqScore = calculateZScore(
        sample.rhythm.pauseFrequency,
        profile.rhythm.pauseFrequency,
        profile.rhythm.pauseFrequency * 0.3
      );
      scores.push(pauseFreqScore);
      features.push({ name: 'pauseFrequency', score: pauseFreqScore });
    }
  }

  // 4. Compare per-key dwell times (for common keys)
  const perKeyScore = comparePerKeyDwell(profile.perKeyDwell, sample.perKeyDwell);
  if (perKeyScore !== null) {
    scores.push(perKeyScore);
    features.push({ name: 'perKeyDwell', score: perKeyScore });
  }

  // 5. Compare digraph timings
  const digraphScore = compareDigraphs(profile.digraphTimings, sample.digraphTimings);
  if (digraphScore !== null) {
    scores.push(digraphScore);
    features.push({ name: 'digraphTimings', score: digraphScore });
  }

  // Calculate overall anomaly score (normalized to 0-1 range)
  const avgZScore = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 3.0;

  // Normalize z-score to anomaly score (0 = normal, 1 = highly anomalous)
  // Z-score of 0 = perfect match, 3+ = very different
  const anomalyScore = Math.min(1.0, Math.max(0, avgZScore / 3.0));

  // Thresholds for authentication
  const LOW_THRESHOLD = 0.3;      // < 0.3 = definitely authentic
  const MEDIUM_THRESHOLD = 0.7;   // 0.3-0.7 = suspicious
  const HIGH_THRESHOLD = 0.7;     // > 0.7 = likely imposter

  let authenticated = false;
  let riskLevel = 'high';
  let confidence = 0;

  if (anomalyScore < LOW_THRESHOLD) {
    authenticated = true;
    riskLevel = 'low';
    confidence = (1 - anomalyScore / LOW_THRESHOLD) * 100;
  } else if (anomalyScore < MEDIUM_THRESHOLD) {
    authenticated = true; // Allow but flag as suspicious
    riskLevel = 'medium';
    confidence = (1 - (anomalyScore - LOW_THRESHOLD) / (MEDIUM_THRESHOLD - LOW_THRESHOLD)) * 50;
  } else {
    authenticated = false;
    riskLevel = 'high';
    confidence = 0;
  }

  return {
    authenticated,
    anomalyScore: parseFloat(anomalyScore.toFixed(3)),
    confidence: parseFloat(confidence.toFixed(1)),
    riskLevel,
    featureScores: features,
    method: 'statistical_zscore',
    timestamp: new Date()
  };
}

/**
 * Calculate z-score for a single value against a distribution
 * Z-score = (value - mean) / stdDev
 */
function calculateZScore(value, mean, stdDev) {
  if (stdDev === 0 || stdDev === null || stdDev === undefined) {
    return Math.abs(value - mean);
  }
  return Math.abs((value - mean) / stdDev);
}

/**
 * Compare per-key dwell times
 */
function comparePerKeyDwell(profileKeys, sampleKeys) {
  if (!profileKeys || !sampleKeys) return null;

  const scores = [];

  // Find common keys
  const commonKeys = Object.keys(profileKeys).filter(key =>
    sampleKeys[key] !== undefined
  );

  if (commonKeys.length === 0) return null;

  commonKeys.forEach(key => {
    const profileKey = profileKeys[key];
    const sampleKey = sampleKeys[key];

    const zScore = calculateZScore(
      sampleKey.mean,
      profileKey.mean,
      profileKey.stdDev
    );

    scores.push(zScore);
  });

  return scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;
}

/**
 * Compare digraph timings
 */
function compareDigraphs(profileDigraphs, sampleDigraphs) {
  if (!profileDigraphs || !sampleDigraphs) return null;

  const scores = [];

  // Find common digraphs
  const commonDigraphs = Object.keys(profileDigraphs).filter(digraph =>
    sampleDigraphs[digraph] !== undefined
  );

  if (commonDigraphs.length === 0) return null;

  commonDigraphs.forEach(digraph => {
    const profileDig = profileDigraphs[digraph];
    const sampleDig = sampleDigraphs[digraph];

    const zScore = calculateZScore(
      sampleDig.mean,
      profileDig.mean,
      profileDig.stdDev
    );

    scores.push(zScore);
  });

  return scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;
}

/**
 * Calculate Mahalanobis distance (more sophisticated than z-score)
 * Takes into account correlation between features
 *
 * This is a simplified version - full implementation would require
 * covariance matrix calculation and matrix inversion
 */
function calculateMahalanobisDistance(profile, sample) {
  // Extract feature vectors
  const profileVector = extractFeatureVector(profile);
  const sampleVector = extractFeatureVector(sample);

  if (profileVector.length !== sampleVector.length) {
    return null;
  }

  // Simplified Mahalanobis (assuming features are independent)
  // Full implementation would use covariance matrix
  let sumSquaredDiff = 0;

  for (let i = 0; i < profileVector.length; i++) {
    const diff = sampleVector[i].value - profileVector[i].value;
    const variance = Math.pow(profileVector[i].stdDev || 1, 2);
    sumSquaredDiff += Math.pow(diff, 2) / variance;
  }

  return Math.sqrt(sumSquaredDiff);
}

/**
 * Extract feature vector for distance calculations
 */
function extractFeatureVector(features) {
  const vector = [];

  if (features.dwellTime) {
    vector.push({
      name: 'dwellMean',
      value: features.dwellTime.mean,
      stdDev: features.dwellTime.stdDev
    });
  }

  if (features.flightTime) {
    vector.push({
      name: 'flightMean',
      value: features.flightTime.mean,
      stdDev: features.flightTime.stdDev
    });
  }

  if (features.rhythm) {
    if (features.rhythm.burstSpeed) {
      vector.push({
        name: 'burstSpeed',
        value: features.rhythm.burstSpeed,
        stdDev: features.rhythm.burstSpeed * 0.2
      });
    }
    if (features.rhythm.pauseFrequency) {
      vector.push({
        name: 'pauseFrequency',
        value: features.rhythm.pauseFrequency,
        stdDev: features.rhythm.pauseFrequency * 0.3
      });
    }
  }

  return vector;
}

/**
 * Continuous authentication: verify keystroke sample during active session
 * This would be called every N keystrokes (e.g., 50) during gameplay
 */
function continuousVerification(profile, recentKeystrokes, windowSize = 50) {
  if (!recentKeystrokes || recentKeystrokes.length < windowSize) {
    return {
      shouldContinue: true,
      reason: 'Insufficient keystrokes for verification'
    };
  }

  // Extract features from recent window
  const biometricService = require('./biometricService');
  const windowFeatures = biometricService.extractFeatures(
    recentKeystrokes.slice(-windowSize)
  );

  if (!windowFeatures) {
    return {
      shouldContinue: true,
      reason: 'Could not extract features from window'
    };
  }

  // Verify against profile
  const result = verifyKeystrokeSample(profile, windowFeatures);

  return {
    shouldContinue: result.authenticated,
    anomalyScore: result.anomalyScore,
    confidence: result.confidence,
    riskLevel: result.riskLevel,
    action: result.riskLevel === 'high' ? 'challenge' : 'continue'
  };
}

/**
 * Determine appropriate action based on anomaly score
 */
function determineAction(anomalyScore, riskLevel) {
  if (riskLevel === 'low') {
    return {
      action: 'allow',
      message: 'Authentication successful',
      requiresChallenge: false
    };
  }

  if (riskLevel === 'medium') {
    return {
      action: 'monitor',
      message: 'Unusual typing pattern detected - monitoring',
      requiresChallenge: false,
      increaseMonitoring: true
    };
  }

  // High risk
  return {
    action: 'challenge',
    message: 'Typing pattern does not match - additional verification required',
    requiresChallenge: true,
    suggestedChallenge: 'mfa' // Multi-factor authentication
  };
}

/**
 * Check if user's biometric profile needs updating
 * Returns true if profile is old or has few samples
 */
function needsProfileUpdate(profile, lastUpdated, sampleCount) {
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

  // Update if profile is older than 1 week
  if (lastUpdated && Date.now() - new Date(lastUpdated).getTime() > ONE_WEEK) {
    return true;
  }

  // Update if we have fewer than 10 samples
  if (sampleCount < 10) {
    return true;
  }

  return false;
}

module.exports = {
  verifyKeystrokeSample,
  calculateZScore,
  calculateMahalanobisDistance,
  continuousVerification,
  determineAction,
  needsProfileUpdate
};
