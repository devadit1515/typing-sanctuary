/**
 * Adaptive Learning Service for Keystroke Biometrics
 *
 * Handles continuous model updates as user typing patterns evolve over time.
 * Detects concept drift (gradual changes) vs. sudden anomalies (potential attacks).
 *
 * Key Features:
 * - Exponential Weighted Moving Average (EWMA) for profile updates
 * - Concept drift detection (gradual changes over time)
 * - Sudden change detection (potential account takeover)
 * - Profile versioning and rollback capabilities
 * - Context-aware learning (different devices, time of day)
 */

const KeystrokeBiometrics = require('../models/KeystrokeBiometrics');

/**
 * Configuration constants
 */
const LEARNING_RATE = 0.1; // Weight given to new samples (0-1)
const DRIFT_THRESHOLD = 2.0; // Standard deviations before flagging drift
const SUDDEN_CHANGE_THRESHOLD = 3.0; // Standard deviations for sudden changes
const MINIMUM_SAMPLES_FOR_UPDATE = 3; // Minimum verified samples before updating
const PROFILE_VERSION_LIMIT = 10; // Keep last 10 profile versions

/**
 * Update user's biometric profile using adaptive learning
 *
 * @param {string} userId - User ID
 * @param {Object} newSample - New keystroke sample with features
 * @param {boolean} verified - Whether the sample was successfully authenticated
 * @returns {Object} Update result with drift detection info
 */
async function updateProfile(userId, newSample, verified) {
    try {
        const biometric = await KeystrokeBiometrics.findOne({ userId });

        if (!biometric || !biometric.isEnrolled()) {
            throw new Error('User not enrolled in biometric authentication');
        }

        // Only update with verified samples (prevent poisoning from impostors)
        if (!verified) {
            return {
                updated: false,
                reason: 'Sample not verified - skipping profile update',
                driftDetected: false
            };
        }

        const currentProfile = biometric.profile;
        const newFeatures = newSample.features;

        // Calculate distance from current profile
        const distance = calculateMahalanobisDistance(newFeatures, currentProfile);

        // Detect sudden changes (potential attack)
        if (distance > SUDDEN_CHANGE_THRESHOLD) {
            await logSuddenChange(userId, distance, newFeatures);
            return {
                updated: false,
                reason: 'Sudden change detected - profile update blocked',
                suddenChange: true,
                distance: distance,
                flagged: true
            };
        }

        // Detect gradual drift
        const driftDetected = distance > DRIFT_THRESHOLD;

        // Archive current profile version
        archiveProfileVersion(biometric);

        // Update profile using EWMA
        const updatedProfile = updateWithEWMA(currentProfile, newFeatures, LEARNING_RATE);

        // Update context-specific profiles if available
        if (newSample.deviceInfo) {
            updateContextProfile(biometric, newSample.deviceInfo, newFeatures);
        }

        // Save updated profile
        biometric.profile = updatedProfile;
        biometric.lastUpdated = new Date();

        // Track update in metadata
        if (!biometric.metadata) {
            biometric.metadata = {};
        }
        biometric.metadata.profileUpdates = (biometric.metadata.profileUpdates || 0) + 1;
        biometric.metadata.lastProfileUpdate = new Date();

        await biometric.save();

        return {
            updated: true,
            driftDetected,
            distance,
            learningRate: LEARNING_RATE,
            profileVersion: biometric.profileVersions ? biometric.profileVersions.length : 0
        };

    } catch (error) {
        console.error('Error in adaptive learning:', error);
        throw error;
    }
}

/**
 * Update profile features using Exponential Weighted Moving Average
 *
 * New_Mean = (1 - α) * Old_Mean + α * New_Value
 * where α is the learning rate
 *
 * @param {Object} currentProfile - Current biometric profile
 * @param {Object} newFeatures - New feature values
 * @param {number} alpha - Learning rate (0-1)
 * @returns {Object} Updated profile
 */
function updateWithEWMA(currentProfile, newFeatures, alpha) {
    const updatedProfile = JSON.parse(JSON.stringify(currentProfile)); // Deep copy

    // Update dwell time statistics
    updatedProfile.dwellTime.mean = ewmaUpdate(
        currentProfile.dwellTime.mean,
        newFeatures.dwellTime.mean,
        alpha
    );
    updatedProfile.dwellTime.stdDev = ewmaUpdate(
        currentProfile.dwellTime.stdDev,
        newFeatures.dwellTime.stdDev,
        alpha
    );
    updatedProfile.dwellTime.median = ewmaUpdate(
        currentProfile.dwellTime.median,
        newFeatures.dwellTime.median,
        alpha
    );
    updatedProfile.dwellTime.min = Math.min(
        currentProfile.dwellTime.min,
        newFeatures.dwellTime.min
    );
    updatedProfile.dwellTime.max = Math.max(
        currentProfile.dwellTime.max,
        newFeatures.dwellTime.max
    );

    // Update flight time statistics
    updatedProfile.flightTime.mean = ewmaUpdate(
        currentProfile.flightTime.mean,
        newFeatures.flightTime.mean,
        alpha
    );
    updatedProfile.flightTime.stdDev = ewmaUpdate(
        currentProfile.flightTime.stdDev,
        newFeatures.flightTime.stdDev,
        alpha
    );
    updatedProfile.flightTime.median = ewmaUpdate(
        currentProfile.flightTime.median,
        newFeatures.flightTime.median,
        alpha
    );
    updatedProfile.flightTime.min = Math.min(
        currentProfile.flightTime.min,
        newFeatures.flightTime.min
    );
    updatedProfile.flightTime.max = Math.max(
        currentProfile.flightTime.max,
        newFeatures.flightTime.max
    );

    // Update rhythm features
    updatedProfile.rhythm.burstSpeed = ewmaUpdate(
        currentProfile.rhythm.burstSpeed,
        newFeatures.rhythm.burstSpeed,
        alpha
    );
    updatedProfile.rhythm.pauseFrequency = ewmaUpdate(
        currentProfile.rhythm.pauseFrequency,
        newFeatures.rhythm.pauseFrequency,
        alpha
    );
    updatedProfile.rhythm.pauseDuration = ewmaUpdate(
        currentProfile.rhythm.pauseDuration,
        newFeatures.rhythm.pauseDuration,
        alpha
    );
    updatedProfile.rhythm.consistency = ewmaUpdate(
        currentProfile.rhythm.consistency,
        newFeatures.rhythm.consistency,
        alpha
    );

    // Update error features
    updatedProfile.errors.errorRate = ewmaUpdate(
        currentProfile.errors.errorRate,
        newFeatures.errors.errorRate,
        alpha
    );
    updatedProfile.errors.avgTimingDiff = ewmaUpdate(
        currentProfile.errors.avgTimingDiff,
        newFeatures.errors.avgTimingDiff,
        alpha
    );

    // Update digraph timings (if available)
    if (currentProfile.digraphs && newFeatures.digraphs) {
        updatedProfile.digraphs = {};
        for (let digraph in currentProfile.digraphs) {
            if (newFeatures.digraphs[digraph] !== undefined) {
                updatedProfile.digraphs[digraph] = ewmaUpdate(
                    currentProfile.digraphs[digraph],
                    newFeatures.digraphs[digraph],
                    alpha
                );
            } else {
                updatedProfile.digraphs[digraph] = currentProfile.digraphs[digraph];
            }
        }
    }

    return updatedProfile;
}

/**
 * EWMA calculation helper
 *
 * @param {number} oldValue - Previous value
 * @param {number} newValue - New observation
 * @param {number} alpha - Learning rate (0-1)
 * @returns {number} Updated value
 */
function ewmaUpdate(oldValue, newValue, alpha) {
    return (1 - alpha) * oldValue + alpha * newValue;
}

/**
 * Calculate Mahalanobis distance between new sample and profile
 * (Simplified version using normalized Euclidean distance)
 *
 * @param {Object} newFeatures - New feature values
 * @param {Object} profile - Current profile
 * @returns {number} Distance metric
 */
function calculateMahalanobisDistance(newFeatures, profile) {
    let sumSquaredDeviations = 0;
    let featureCount = 0;

    // Dwell time features
    sumSquaredDeviations += Math.pow(
        (newFeatures.dwellTime.mean - profile.dwellTime.mean) / (profile.dwellTime.stdDev + 0.001),
        2
    );
    featureCount++;

    // Flight time features
    sumSquaredDeviations += Math.pow(
        (newFeatures.flightTime.mean - profile.flightTime.mean) / (profile.flightTime.stdDev + 0.001),
        2
    );
    featureCount++;

    // Rhythm features
    sumSquaredDeviations += Math.pow(
        (newFeatures.rhythm.burstSpeed - profile.rhythm.burstSpeed) / (profile.rhythm.burstSpeed * 0.3 + 0.001),
        2
    );
    sumSquaredDeviations += Math.pow(
        (newFeatures.rhythm.consistency - profile.rhythm.consistency) / 30,
        2
    );
    featureCount += 2;

    // Calculate normalized distance
    const distance = Math.sqrt(sumSquaredDeviations / featureCount);

    return distance;
}

/**
 * Archive current profile version for rollback capability
 *
 * @param {Object} biometric - KeystrokeBiometrics document
 */
function archiveProfileVersion(biometric) {
    if (!biometric.profileVersions) {
        biometric.profileVersions = [];
    }

    // Add current profile to version history
    biometric.profileVersions.push({
        version: biometric.profileVersions.length + 1,
        profile: JSON.parse(JSON.stringify(biometric.profile)),
        timestamp: new Date(),
        samplesAtVersion: biometric.enrollmentProgress.samplesCollected
    });

    // Keep only last N versions
    if (biometric.profileVersions.length > PROFILE_VERSION_LIMIT) {
        biometric.profileVersions = biometric.profileVersions.slice(-PROFILE_VERSION_LIMIT);
    }
}

/**
 * Update context-specific profiles (e.g., per device)
 *
 * @param {Object} biometric - KeystrokeBiometrics document
 * @param {Object} deviceInfo - Device context information
 * @param {Object} newFeatures - New feature values
 */
function updateContextProfile(biometric, deviceInfo, newFeatures) {
    if (!biometric.contextProfiles) {
        biometric.contextProfiles = {};
    }

    const deviceId = deviceInfo.deviceType || 'unknown';

    if (!biometric.contextProfiles[deviceId]) {
        // Create new context profile
        biometric.contextProfiles[deviceId] = {
            deviceType: deviceId,
            profile: newFeatures,
            sampleCount: 1,
            lastUpdated: new Date()
        };
    } else {
        // Update existing context profile
        const contextProfile = biometric.contextProfiles[deviceId];
        contextProfile.profile = updateWithEWMA(
            contextProfile.profile,
            newFeatures,
            LEARNING_RATE
        );
        contextProfile.sampleCount++;
        contextProfile.lastUpdated = new Date();
    }
}

/**
 * Log sudden change detection for security monitoring
 *
 * @param {string} userId - User ID
 * @param {number} distance - Distance metric
 * @param {Object} newFeatures - Features that triggered the alert
 */
async function logSuddenChange(userId, distance, newFeatures) {
    console.warn(`[SECURITY ALERT] Sudden change detected for user ${userId}`);
    console.warn(`  Distance from profile: ${distance.toFixed(2)} (threshold: ${SUDDEN_CHANGE_THRESHOLD})`);
    console.warn(`  New features:`, JSON.stringify(newFeatures, null, 2));

    // TODO: Send alert to security monitoring system
    // TODO: Notify user of unusual activity
    // TODO: Require additional verification
}

/**
 * Detect concept drift over multiple samples
 *
 * @param {string} userId - User ID
 * @returns {Object} Drift analysis
 */
async function detectConceptDrift(userId) {
    try {
        const biometric = await KeystrokeBiometrics.findOne({ userId });

        if (!biometric || !biometric.profileVersions || biometric.profileVersions.length < 2) {
            return {
                driftDetected: false,
                reason: 'Insufficient profile history'
            };
        }

        const versions = biometric.profileVersions;
        const firstVersion = versions[0].profile;
        const latestVersion = versions[versions.length - 1].profile;

        // Calculate drift between first and latest versions
        const drift = calculateMahalanobisDistance(latestVersion, firstVersion);

        return {
            driftDetected: drift > DRIFT_THRESHOLD,
            driftMagnitude: drift,
            threshold: DRIFT_THRESHOLD,
            versionCount: versions.length,
            timeSpan: new Date() - versions[0].timestamp
        };

    } catch (error) {
        console.error('Error detecting concept drift:', error);
        throw error;
    }
}

/**
 * Rollback profile to a previous version
 *
 * @param {string} userId - User ID
 * @param {number} version - Version number to rollback to (default: previous version)
 * @returns {Object} Rollback result
 */
async function rollbackProfile(userId, version = null) {
    try {
        const biometric = await KeystrokeBiometrics.findOne({ userId });

        if (!biometric || !biometric.profileVersions || biometric.profileVersions.length === 0) {
            throw new Error('No profile versions available for rollback');
        }

        let targetVersion;
        if (version === null) {
            // Rollback to previous version
            targetVersion = biometric.profileVersions[biometric.profileVersions.length - 1];
        } else {
            // Rollback to specific version
            targetVersion = biometric.profileVersions.find(v => v.version === version);
            if (!targetVersion) {
                throw new Error(`Version ${version} not found`);
            }
        }

        // Restore profile
        biometric.profile = targetVersion.profile;
        biometric.lastUpdated = new Date();

        // Log rollback
        if (!biometric.metadata) {
            biometric.metadata = {};
        }
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

    } catch (error) {
        console.error('Error rolling back profile:', error);
        throw error;
    }
}

/**
 * Get adaptive learning statistics for a user
 *
 * @param {string} userId - User ID
 * @returns {Object} Learning statistics
 */
async function getLearningStats(userId) {
    try {
        const biometric = await KeystrokeBiometrics.findOne({ userId });

        if (!biometric) {
            throw new Error('User not found');
        }

        const driftAnalysis = await detectConceptDrift(userId);

        return {
            enrolled: biometric.isEnrolled(),
            totalSamples: biometric.enrollmentProgress.samplesCollected,
            profileUpdates: biometric.metadata?.profileUpdates || 0,
            lastUpdate: biometric.metadata?.lastProfileUpdate || biometric.lastUpdated,
            profileVersions: biometric.profileVersions?.length || 0,
            learningRate: LEARNING_RATE,
            driftDetected: driftAnalysis.driftDetected,
            driftMagnitude: driftAnalysis.driftMagnitude,
            contextProfiles: Object.keys(biometric.contextProfiles || {}).length,
            lastRollback: biometric.metadata?.lastRollback || null
        };

    } catch (error) {
        console.error('Error getting learning stats:', error);
        throw error;
    }
}

module.exports = {
    updateProfile,
    updateWithEWMA,
    detectConceptDrift,
    rollbackProfile,
    getLearningStats,
    LEARNING_RATE,
    DRIFT_THRESHOLD,
    SUDDEN_CHANGE_THRESHOLD
};
