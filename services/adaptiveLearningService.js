/**
 * Adaptive Learning Service (V2)
 *
 * Manages biometric profile building and incremental updates using the
 * new multi-classifier ensemble pipeline.
 *
 * Key changes from V1:
 *   - Full recomputation from stored feature vectors (not EWMA)
 *   - Ledoit-Wolf covariance estimation
 *   - Leave-one-out calibration for all 6 classifiers
 *   - Drift detection via scaled Manhattan distance
 *   - Poisoning prevention: only verified samples enter profile
 */

const KeystrokeBiometrics = require('../models/KeystrokeBiometrics');
const { extractFeatureVector, selectSubset } = require('./featureEngineering');
const { selectFeatures } = require('./featureSelection');
const { computeProfileStats, computeBoundaryRadius, scaledManhattan } = require('./classifierEngine');
const { leaveOneOutCalibration } = require('./scoreFusion');
const { ledoitWolfShrinkage } = require('./linearAlgebra');

// ── Constants ──────────────────────────────────────────────────────

const DRIFT_THRESHOLD = 2.0;           // Scaled Manhattan distance for drift detection
const SUDDEN_CHANGE_THRESHOLD = 3.5;   // Block update if distance exceeds this
const PROFILE_VERSION_LIMIT = 10;      // Keep last 10 profile snapshots
const MAX_RAW_VECTORS = 50;            // Store up to 50 feature vectors
const MIN_SAMPLES_FOR_PROFILE = 10;    // Need 10 samples to build initial profile
const RECALIBRATION_INTERVAL = 5;      // Re-run LOO calibration every N samples
const MIN_CONFIDENCE_FOR_UPDATE = 60;  // Only add verified samples (confidence >= 60%)

// ── Profile Building (Initial Enrollment) ──────────────────────────

/**
 * Build or rebuild a v2 profile from stored raw keystroke samples.
 * Called when:
 *   - User reaches 10 samples for the first time
 *   - Migration from v1 to v2 profile
 *   - Manual profile rebuild
 *
 * @param {string} userId
 * @returns {object} Build result
 */
async function buildProfile(userId) {
  const biometric = await KeystrokeBiometrics.findOne({ userId });
  if (!biometric) throw new Error('User not found');

  const samples = biometric.samples;
  if (!samples || samples.length < MIN_SAMPLES_FOR_PROFILE) {
    return { built: false, reason: `Need ${MIN_SAMPLES_FOR_PROFILE} samples, have ${samples?.length || 0}` };
  }

  // 1. Extract feature vectors from all stored raw keystroke samples
  const featureVectors = [];
  const observedArrays = [];

  for (const sample of samples) {
    if (!sample.keystrokes || sample.keystrokes.length < 5) continue;
    const result = extractFeatureVector(sample.keystrokes);
    if (result) {
      featureVectors.push(result.vector);
      observedArrays.push(result.observed);
    }
  }

  if (featureVectors.length < MIN_SAMPLES_FOR_PROFILE) {
    return { built: false, reason: `Only ${featureVectors.length} valid feature vectors from ${samples.length} samples` };
  }

  // 2. Run feature selection (choose 50-80 best features)
  const { selectedIndices, qualityScores } = selectFeatures(featureVectors, observedArrays);

  // 3. Project vectors to selected feature subspace
  const rawVectors = featureVectors.map(v => selectedIndices.map(i => v[i]));

  // Keep only the most recent MAX_RAW_VECTORS
  const trimmedVectors = rawVectors.slice(-MAX_RAW_VECTORS);

  // 4. Compute profile statistics
  const stats = computeProfileStats(trimmedVectors);

  // 5. Compute Ledoit-Wolf shrunk covariance + inverse
  let covarianceMatrix = null;
  let covarianceInverse = null;
  let shrinkageAlpha = null;

  if (trimmedVectors.length >= 10) {
    const covResult = ledoitWolfShrinkage(trimmedVectors);
    covarianceMatrix = covResult.shrunkCov;
    covarianceInverse = covResult.inverse;
    shrinkageAlpha = covResult.alpha;
  }

  // 6. Compute one-class boundary radius
  const boundaryRadius = computeBoundaryRadius(trimmedVectors, stats);

  // 7. Run leave-one-out calibration for all 6 classifiers
  const calResult = leaveOneOutCalibration(trimmedVectors, selectedIndices);

  // 8. Build feature names
  const { buildFeatureNames } = require('./featureEngineering');
  const allNames = buildFeatureNames();
  const featureNames = selectedIndices.map(i => allNames[i]);

  // 9. Store v2 profile
  biometric.v2Profile = {
    selectedFeatures: selectedIndices,
    featureNames,
    featureQualityScores: qualityScores,
    means: stats.means,
    medians: stats.medians,
    stdDevs: stats.stdDevs,
    mads: stats.mads,
    madMedians: stats.madMedians,
    rawVectors: trimmedVectors,
    covarianceMatrix: covarianceMatrix || [],
    covarianceInverse: covarianceInverse || [],
    shrinkageAlpha: shrinkageAlpha || 0,
    boundaryRadius,
    calibration: calResult.calibration,
    fusionWeights: calResult.fusionWeights,
    fusionMethod: calResult.fusionMethod,
    threshold: calResult.threshold,
    thresholdConfidence: calResult.thresholdConfidence,
    samplesUsed: trimmedVectors.length,
    enrollmentComplete: true,
    lastUpdated: new Date(),
    lastCalibration: new Date(),
    samplesSinceLastCalibration: 0
  };

  biometric.profileVersion = 2;
  biometric.updatedAt = new Date();

  if (!biometric.metadata) biometric.metadata = {};
  biometric.metadata.profileUpdates = (biometric.metadata.profileUpdates || 0) + 1;
  biometric.metadata.lastProfileUpdate = new Date();

  await biometric.save();

  return {
    built: true,
    featuresSelected: selectedIndices.length,
    samplesUsed: trimmedVectors.length,
    threshold: calResult.threshold,
    thresholdConfidence: calResult.thresholdConfidence,
    fusionMethod: calResult.fusionMethod
  };
}

// ── Incremental Profile Update ─────────────────────────────────────

/**
 * Update user's biometric profile with a new sample.
 *
 * @param {string} userId
 * @param {object} newSample - { keystrokes, features (optional), deviceInfo }
 * @param {boolean} verified - Whether the sample was verified (confidence >= 60%)
 * @returns {object} Update result
 */
async function updateProfile(userId, newSample, verified) {
  const biometric = await KeystrokeBiometrics.findOne({ userId });
  if (!biometric) throw new Error('User not found');

  // Only update with verified samples (prevent poisoning)
  if (!verified) {
    return {
      updated: false,
      reason: 'Sample not verified — skipping profile update',
      driftDetected: false
    };
  }

  // If no v2 profile yet, try to build one
  if (biometric.profileVersion !== 2 || !biometric.v2Profile?.enrollmentComplete) {
    const sampleCount = biometric.samples?.length || 0;
    if (sampleCount >= MIN_SAMPLES_FOR_PROFILE) {
      const buildResult = await buildProfile(userId);
      return { updated: buildResult.built, ...buildResult, driftDetected: false };
    }
    return { updated: false, reason: 'Not enough samples for v2 profile yet', driftDetected: false };
  }

  const profile = biometric.v2Profile;

  // Extract feature vector from new sample
  const featureData = extractFeatureVector(newSample.keystrokes || newSample.features?.keystrokes);
  if (!featureData) {
    return { updated: false, reason: 'Could not extract features from sample', driftDetected: false };
  }

  // Project to selected feature subspace
  const newVector = selectSubset(featureData.vector, profile.selectedFeatures);

  // Check distance from current profile (drift/sudden change detection)
  const distance = scaledManhattan(newVector, {
    means: profile.means,
    mads: profile.mads
  });

  // Block sudden changes (potential attack)
  if (distance > SUDDEN_CHANGE_THRESHOLD) {
    console.warn(`[SECURITY] Sudden change blocked for user ${userId}, distance: ${distance.toFixed(2)}`);
    return {
      updated: false,
      reason: 'Sudden change detected — profile update blocked',
      suddenChange: true,
      distance,
      driftDetected: false
    };
  }

  const driftDetected = distance > DRIFT_THRESHOLD;
  if (driftDetected) {
    console.warn(`[DRIFT] Gradual drift detected for user ${userId}, distance: ${distance.toFixed(2)}`);
  }

  // Archive current profile version
  archiveProfileVersion(biometric);

  // Add new vector to rawVectors
  const rawVectors = [...(profile.rawVectors || []), newVector];
  const trimmedVectors = rawVectors.slice(-MAX_RAW_VECTORS);

  // Full recomputation from stored vectors
  const stats = computeProfileStats(trimmedVectors);

  // Recompute covariance if enough samples
  let covarianceMatrix = profile.covarianceMatrix;
  let covarianceInverse = profile.covarianceInverse;
  let shrinkageAlpha = profile.shrinkageAlpha;

  if (trimmedVectors.length >= 10) {
    const covResult = ledoitWolfShrinkage(trimmedVectors);
    covarianceMatrix = covResult.shrunkCov;
    covarianceInverse = covResult.inverse;
    shrinkageAlpha = covResult.alpha;
  }

  // Update boundary radius
  const boundaryRadius = computeBoundaryRadius(trimmedVectors, stats);

  // Recalibrate periodically
  const samplesSinceCal = (profile.samplesSinceLastCalibration || 0) + 1;
  let calibration = profile.calibration;
  let fusionWeights = profile.fusionWeights;
  let fusionMethod = profile.fusionMethod;
  let threshold = profile.threshold;
  let thresholdConfidence = profile.thresholdConfidence;
  let lastCalibration = profile.lastCalibration;

  if (samplesSinceCal >= RECALIBRATION_INTERVAL) {
    const calResult = leaveOneOutCalibration(trimmedVectors, profile.selectedFeatures);
    calibration = calResult.calibration;
    fusionWeights = calResult.fusionWeights;
    fusionMethod = calResult.fusionMethod;
    threshold = calResult.threshold;
    thresholdConfidence = calResult.thresholdConfidence;
    lastCalibration = new Date();
  }

  // Update v2 profile
  biometric.v2Profile = {
    ...profile,
    means: stats.means,
    medians: stats.medians,
    stdDevs: stats.stdDevs,
    mads: stats.mads,
    madMedians: stats.madMedians,
    rawVectors: trimmedVectors,
    covarianceMatrix: covarianceMatrix || [],
    covarianceInverse: covarianceInverse || [],
    shrinkageAlpha: shrinkageAlpha || 0,
    boundaryRadius,
    calibration,
    fusionWeights,
    fusionMethod,
    threshold,
    thresholdConfidence,
    samplesUsed: trimmedVectors.length,
    lastUpdated: new Date(),
    lastCalibration,
    samplesSinceLastCalibration: samplesSinceCal >= RECALIBRATION_INTERVAL ? 0 : samplesSinceCal
  };

  biometric.updatedAt = new Date();
  if (!biometric.metadata) biometric.metadata = {};
  biometric.metadata.profileUpdates = (biometric.metadata.profileUpdates || 0) + 1;
  biometric.metadata.lastProfileUpdate = new Date();

  await biometric.save();

  return {
    updated: true,
    driftDetected,
    distance,
    samplesUsed: trimmedVectors.length,
    recalibrated: samplesSinceCal >= RECALIBRATION_INTERVAL,
    profileVersion: biometric.profileVersions?.length || 0
  };
}

// ── Migration: V1 → V2 ────────────────────────────────────────────

/**
 * Migrate a v1 profile to v2 by re-extracting features from stored samples.
 *
 * @param {string} userId
 * @returns {object}
 */
async function migrateToV2(userId) {
  const biometric = await KeystrokeBiometrics.findOne({ userId });
  if (!biometric) throw new Error('User not found');

  if (biometric.profileVersion === 2) {
    return { migrated: false, reason: 'Already on v2' };
  }

  const sampleCount = biometric.samples?.length || 0;
  if (sampleCount < MIN_SAMPLES_FOR_PROFILE) {
    return { migrated: false, reason: `Need ${MIN_SAMPLES_FOR_PROFILE} samples, have ${sampleCount}` };
  }

  const result = await buildProfile(userId);
  return { migrated: result.built, ...result };
}

// ── Drift Detection ────────────────────────────────────────────────

/**
 * Detect concept drift by comparing oldest vs newest stored vectors.
 *
 * @param {string} userId
 * @returns {object}
 */
async function detectConceptDrift(userId) {
  const biometric = await KeystrokeBiometrics.findOne({ userId });
  if (!biometric || !biometric.v2Profile?.rawVectors || biometric.v2Profile.rawVectors.length < 20) {
    return { driftDetected: false, reason: 'Insufficient data for drift detection' };
  }

  const vectors = biometric.v2Profile.rawVectors;
  const n = vectors.length;
  const oldSlice = vectors.slice(0, 10);
  const newSlice = vectors.slice(n - 10);

  // Compute mean of each slice
  const p = vectors[0].length;
  const oldMean = new Array(p).fill(0);
  const newMean = new Array(p).fill(0);

  for (let i = 0; i < 10; i++) {
    for (let f = 0; f < p; f++) {
      oldMean[f] += oldSlice[i][f] / 10;
      newMean[f] += newSlice[i][f] / 10;
    }
  }

  // Compute MAD from the full profile
  const mads = biometric.v2Profile.mads;

  // Scaled Manhattan distance between old and new means
  let sum = 0;
  let count = 0;
  for (let f = 0; f < p; f++) {
    if (mads[f] < 1e-10) continue;
    sum += Math.abs(newMean[f] - oldMean[f]) / mads[f];
    count++;
  }
  const driftMagnitude = count > 0 ? sum / count : 0;

  return {
    driftDetected: driftMagnitude > DRIFT_THRESHOLD,
    driftMagnitude,
    threshold: DRIFT_THRESHOLD,
    vectorCount: n
  };
}

// ── Profile Rollback ───────────────────────────────────────────────

/**
 * Rollback profile to a previous version.
 *
 * @param {string} userId
 * @param {number|null} version - Version number (null = latest archived)
 * @returns {object}
 */
async function rollbackProfile(userId, version = null) {
  const biometric = await KeystrokeBiometrics.findOne({ userId });
  if (!biometric || !biometric.profileVersions?.length) {
    throw new Error('No profile versions available for rollback');
  }

  let targetVersion;
  if (version === null) {
    targetVersion = biometric.profileVersions[biometric.profileVersions.length - 1];
  } else {
    targetVersion = biometric.profileVersions.find(v => v.version === version);
    if (!targetVersion) throw new Error(`Version ${version} not found`);
  }

  // Restore v1 profile (for backward compat)
  if (targetVersion.profile) {
    biometric.profile = targetVersion.profile;
  }

  // If the archived version has v2 data, restore that too
  if (targetVersion.v2Profile) {
    biometric.v2Profile = targetVersion.v2Profile;
  }

  biometric.updatedAt = new Date();
  if (!biometric.metadata) biometric.metadata = {};
  biometric.metadata.lastRollback = {
    timestamp: new Date(),
    toVersion: targetVersion.version,
    reason: 'Manual rollback'
  };

  await biometric.save();

  return {
    success: true,
    restoredVersion: targetVersion.version,
    timestamp: targetVersion.timestamp
  };
}

// ── Learning Stats ─────────────────────────────────────────────────

/**
 * Get adaptive learning statistics for a user.
 *
 * @param {string} userId
 * @returns {object}
 */
async function getLearningStats(userId) {
  const biometric = await KeystrokeBiometrics.findOne({ userId });
  if (!biometric) throw new Error('User not found');

  const driftAnalysis = await detectConceptDrift(userId);
  const isV2 = biometric.profileVersion === 2;

  return {
    enrolled: biometric.isEnrolled(),
    profileVersion: isV2 ? 2 : 1,
    totalSamples: biometric.enrollmentProgress?.samplesCollected || 0,
    profileUpdates: biometric.metadata?.profileUpdates || 0,
    lastUpdate: biometric.metadata?.lastProfileUpdate || biometric.updatedAt,
    profileVersions: biometric.profileVersions?.length || 0,
    driftDetected: driftAnalysis.driftDetected,
    driftMagnitude: driftAnalysis.driftMagnitude,
    lastRollback: biometric.metadata?.lastRollback || null,
    // V2-specific stats
    v2: isV2 ? {
      featuresSelected: biometric.v2Profile?.selectedFeatures?.length || 0,
      rawVectors: biometric.v2Profile?.rawVectors?.length || 0,
      threshold: biometric.v2Profile?.threshold,
      thresholdConfidence: biometric.v2Profile?.thresholdConfidence,
      fusionMethod: biometric.v2Profile?.fusionMethod,
      lastCalibration: biometric.v2Profile?.lastCalibration
    } : null
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function archiveProfileVersion(biometric) {
  if (!biometric.profileVersions) biometric.profileVersions = [];

  const archive = {
    version: biometric.profileVersions.length + 1,
    timestamp: new Date(),
    samplesAtVersion: biometric.enrollmentProgress?.samplesCollected || 0
  };

  // Archive v1 profile if it exists
  if (biometric.profile && biometric.profile.dwellTime) {
    archive.profile = JSON.parse(JSON.stringify(biometric.profile));
  }

  biometric.profileVersions.push(archive);

  // Trim to limit
  if (biometric.profileVersions.length > PROFILE_VERSION_LIMIT) {
    biometric.profileVersions = biometric.profileVersions.slice(-PROFILE_VERSION_LIMIT);
  }
}

module.exports = {
  buildProfile,
  updateProfile,
  migrateToV2,
  detectConceptDrift,
  rollbackProfile,
  getLearningStats,
  DRIFT_THRESHOLD,
  SUDDEN_CHANGE_THRESHOLD,
  MIN_SAMPLES_FOR_PROFILE,
  RECALIBRATION_INTERVAL
};
