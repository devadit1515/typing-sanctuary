/**
 * Data Export Service for Biometric Research
 *
 * Provides data export functionality for GDPR compliance and research purposes.
 * Supports CSV and JSON formats with anonymization options.
 *
 * Key Features:
 * - CSV export of keystroke samples
 * - JSON export of full biometric profile
 * - Anonymization for research datasets
 * - GDPR-compliant data portability
 * - Privacy-preserving aggregation
 */

const KeystrokeBiometrics = require('../models/KeystrokeBiometrics');

/**
 * Export user's biometric data as CSV
 *
 * @param {string} userId - User ID
 * @param {Object} options - Export options
 * @returns {string} CSV formatted data
 */
async function exportAsCSV(userId, options = {}) {
    try {
        const biometric = await KeystrokeBiometrics.findOne({ userId });

        if (!biometric) {
            throw new Error('No biometric data found for user');
        }

        const includeRawKeystrokes = options.includeRawKeystrokes !== false;
        const anonymize = options.anonymize || false;

        let csv = '';

        // Header row
        if (includeRawKeystrokes) {
            csv = 'timestamp,sample_id,device_type,keyboard_type,char,key_code,dwell_time,flight_time,position,is_correct\n';

            // Export each keystroke from each sample
            biometric.samples.forEach((sample, sampleIdx) => {
                const sampleId = anonymize ? `sample_${sampleIdx + 1}` : sample._id;
                const timestamp = sample.timestamp.toISOString();
                const deviceType = sample.deviceType || 'unknown';
                const keyboardType = sample.keyboardSignature?.classification || 'unknown';

                sample.keystrokes.forEach(keystroke => {
                    const row = [
                        timestamp,
                        sampleId,
                        deviceType,
                        keyboardType,
                        escapeCSV(keystroke.char || ''),
                        keystroke.keyCode || '',
                        keystroke.dwellTime || 0,
                        keystroke.flightTime || 0,
                        keystroke.position || 0,
                        keystroke.isCorrect ? 'true' : 'false'
                    ].join(',');
                    csv += row + '\n';
                });
            });
        } else {
            // Export aggregated statistics only
            csv = 'timestamp,device_type,keyboard_type,dwell_mean,dwell_std,flight_mean,flight_std,wpm,accuracy,sample_size\n';

            biometric.samples.forEach(sample => {
                const timestamp = sample.timestamp.toISOString();
                const deviceType = sample.deviceType || 'unknown';
                const keyboardType = sample.keyboardSignature?.classification || 'unknown';

                // Calculate sample statistics
                const stats = calculateSampleStatistics(sample.keystrokes);

                const row = [
                    timestamp,
                    deviceType,
                    keyboardType,
                    stats.dwellMean.toFixed(2),
                    stats.dwellStd.toFixed(2),
                    stats.flightMean.toFixed(2),
                    stats.flightStd.toFixed(2),
                    stats.wpm.toFixed(0),
                    stats.accuracy.toFixed(2),
                    sample.keystrokes.length
                ].join(',');
                csv += row + '\n';
            });
        }

        return csv;

    } catch (error) {
        console.error('Error exporting CSV:', error);
        throw error;
    }
}

/**
 * Export user's biometric data as JSON
 *
 * @param {string} userId - User ID
 * @param {Object} options - Export options
 * @returns {Object} JSON formatted data
 */
async function exportAsJSON(userId, options = {}) {
    try {
        const biometric = await KeystrokeBiometrics.findOne({ userId })
            .select('-__v')
            .lean();

        if (!biometric) {
            throw new Error('No biometric data found for user');
        }

        const includeRawKeystrokes = options.includeRawKeystrokes !== false;
        const includeAuthHistory = options.includeAuthHistory !== false;
        const anonymize = options.anonymize || false;

        // Build export object
        const exportData = {
            exportMetadata: {
                exportDate: new Date().toISOString(),
                dataVersion: '1.0',
                anonymized: anonymize,
                includesRawKeystrokes: includeRawKeystrokes,
                includesAuthHistory: includeAuthHistory
            },
            enrollmentInfo: {
                status: biometric.enrollmentStatus,
                samplesCollected: biometric.enrollmentProgress?.samplesCollected || 0,
                enrollmentDate: biometric.createdAt,
                lastUpdated: biometric.lastUpdated
            },
            biometricProfile: {
                dwellTime: biometric.profile?.dwellTime || {},
                flightTime: biometric.profile?.flightTime || {},
                rhythm: biometric.profile?.rhythm || {},
                errors: biometric.profile?.errors || {},
                digraphs: biometric.profile?.digraphs || {}
            },
            samples: []
        };

        // Add samples
        if (biometric.samples && biometric.samples.length > 0) {
            exportData.samples = biometric.samples.map((sample, idx) => {
                const sampleData = {
                    sampleId: anonymize ? `sample_${idx + 1}` : sample._id?.toString(),
                    timestamp: sample.timestamp,
                    deviceType: sample.deviceType,
                    deviceFingerprint: anonymize ? 'anonymized' : sample.deviceFingerprint,
                    keyboardSignature: sample.keyboardSignature,
                    statistics: calculateSampleStatistics(sample.keystrokes)
                };

                if (includeRawKeystrokes) {
                    sampleData.keystrokes = sample.keystrokes.map(k => ({
                        char: anonymize ? '*' : k.char,
                        keyCode: k.keyCode,
                        dwellTime: k.dwellTime,
                        flightTime: k.flightTime,
                        position: k.position,
                        isCorrect: k.isCorrect
                    }));
                }

                return sampleData;
            });
        }

        // Add authentication history
        if (includeAuthHistory && biometric.authenticationHistory) {
            exportData.authenticationHistory = biometric.authenticationHistory.map(attempt => ({
                timestamp: attempt.timestamp,
                success: attempt.success,
                anomalyScore: attempt.anomalyScore,
                method: attempt.method,
                riskLevel: getRiskLevel(attempt.anomalyScore),
                context: anonymize ? { anonymized: true } : attempt.context
            }));
        }

        // Add adaptive learning info
        if (biometric.metadata) {
            exportData.adaptiveLearning = {
                profileUpdates: biometric.metadata.profileUpdates || 0,
                lastUpdate: biometric.metadata.lastProfileUpdate,
                profileVersionCount: biometric.profileVersions?.length || 0,
                driftDetected: biometric.metadata.driftDetected || false
            };
        }

        // Add device information
        if (biometric.contextProfiles && biometric.contextProfiles.size > 0) {
            exportData.devices = Array.from(biometric.contextProfiles.entries()).map(([fingerprint, profile]) => ({
                fingerprint: anonymize ? 'anonymized' : fingerprint,
                deviceType: profile.deviceType,
                sampleCount: profile.sampleCount,
                lastSeen: profile.lastUpdated
            }));
        }

        return exportData;

    } catch (error) {
        console.error('Error exporting JSON:', error);
        throw error;
    }
}

/**
 * Generate anonymized research dataset from multiple users
 *
 * @param {Array} userIds - Array of user IDs to include
 * @param {Object} options - Dataset options
 * @returns {Object} Anonymized research dataset
 */
async function generateResearchDataset(userIds = null, options = {}) {
    try {
        let query = { enrollmentStatus: 'completed' };

        // If specific users provided
        if (userIds && userIds.length > 0) {
            query.userId = { $in: userIds };
        }

        // Only include users who consented to research
        query['consent.researchConsent'] = true;

        const biometrics = await KeystrokeBiometrics.find(query)
            .select('-userId -__v')
            .lean();

        if (!biometrics || biometrics.length === 0) {
            throw new Error('No users with research consent found');
        }

        const dataset = {
            metadata: {
                generatedDate: new Date().toISOString(),
                userCount: biometrics.length,
                totalSamples: biometrics.reduce((sum, b) => sum + (b.samples?.length || 0), 0),
                dataVersion: '1.0',
                purpose: 'Academic Research',
                anonymized: true,
                ethicsApproval: options.ethicsApprovalNumber || 'Required'
            },
            aggregateStatistics: calculateAggregateStatistics(biometrics),
            users: []
        };

        // Anonymize and export each user
        biometrics.forEach((biometric, idx) => {
            const user = {
                userId: `user_${String(idx + 1).padStart(4, '0')}`,
                enrollmentDate: biometric.createdAt,
                sampleCount: biometric.samples?.length || 0,
                profile: biometric.profile,
                deviceTypes: extractDeviceTypes(biometric.samples),
                keyboardTypes: extractKeyboardTypes(biometric.samples),
                samples: []
            };

            // Include aggregated samples (no raw text)
            if (biometric.samples) {
                user.samples = biometric.samples.map((sample, sIdx) => ({
                    sampleId: `${user.userId}_sample_${sIdx + 1}`,
                    timestamp: sample.timestamp,
                    deviceType: sample.deviceType,
                    keyboardType: sample.keyboardSignature?.classification,
                    statistics: calculateSampleStatistics(sample.keystrokes),
                    keystrokeCount: sample.keystrokes?.length || 0
                }));
            }

            dataset.users.push(user);
        });

        return dataset;

    } catch (error) {
        console.error('Error generating research dataset:', error);
        throw error;
    }
}

/**
 * Calculate statistics for a sample
 *
 * @param {Array} keystrokes - Keystroke array
 * @returns {Object} Statistics
 */
function calculateSampleStatistics(keystrokes) {
    if (!keystrokes || keystrokes.length === 0) {
        return {
            dwellMean: 0,
            dwellStd: 0,
            flightMean: 0,
            flightStd: 0,
            wpm: 0,
            accuracy: 0
        };
    }

    const dwellTimes = keystrokes.map(k => k.dwellTime || 0).filter(d => d > 0);
    const flightTimes = keystrokes.map(k => k.flightTime || 0).filter(f => f > 0);
    const correctCount = keystrokes.filter(k => k.isCorrect).length;

    const dwellMean = mean(dwellTimes);
    const dwellStd = standardDeviation(dwellTimes);
    const flightMean = mean(flightTimes);
    const flightStd = standardDeviation(flightTimes);

    // Estimate WPM (rough calculation)
    const avgInterval = dwellMean + flightMean;
    const wpm = avgInterval > 0 ? 60000 / (avgInterval * 5) : 0;

    const accuracy = keystrokes.length > 0 ? (correctCount / keystrokes.length) * 100 : 0;

    return {
        dwellMean,
        dwellStd,
        flightMean,
        flightStd,
        wpm,
        accuracy
    };
}

/**
 * Calculate aggregate statistics across all users
 *
 * @param {Array} biometrics - Array of biometric documents
 * @returns {Object} Aggregate statistics
 */
function calculateAggregateStatistics(biometrics) {
    const allDwellMeans = [];
    const allFlightMeans = [];
    const allWPMs = [];
    const deviceTypeCounts = {};
    const keyboardTypeCounts = {};

    biometrics.forEach(biometric => {
        if (biometric.profile?.dwellTime?.mean) {
            allDwellMeans.push(biometric.profile.dwellTime.mean);
        }
        if (biometric.profile?.flightTime?.mean) {
            allFlightMeans.push(biometric.profile.flightTime.mean);
        }

        // Calculate WPM for each user
        if (biometric.profile?.dwellTime?.mean && biometric.profile?.flightTime?.mean) {
            const avgInterval = biometric.profile.dwellTime.mean + biometric.profile.flightTime.mean;
            const wpm = 60000 / (avgInterval * 5);
            allWPMs.push(wpm);
        }

        // Count device types
        if (biometric.samples) {
            biometric.samples.forEach(sample => {
                const deviceType = sample.deviceType || 'unknown';
                deviceTypeCounts[deviceType] = (deviceTypeCounts[deviceType] || 0) + 1;

                const keyboardType = sample.keyboardSignature?.classification || 'unknown';
                keyboardTypeCounts[keyboardType] = (keyboardTypeCounts[keyboardType] || 0) + 1;
            });
        }
    });

    return {
        dwellTime: {
            populationMean: mean(allDwellMeans),
            populationStd: standardDeviation(allDwellMeans),
            min: Math.min(...allDwellMeans),
            max: Math.max(...allDwellMeans)
        },
        flightTime: {
            populationMean: mean(allFlightMeans),
            populationStd: standardDeviation(allFlightMeans),
            min: Math.min(...allFlightMeans),
            max: Math.max(...allFlightMeans)
        },
        wpm: {
            populationMean: mean(allWPMs),
            populationStd: standardDeviation(allWPMs),
            min: Math.min(...allWPMs),
            max: Math.max(...allWPMs)
        },
        deviceTypes: deviceTypeCounts,
        keyboardTypes: keyboardTypeCounts
    };
}

/**
 * Extract unique device types from samples
 *
 * @param {Array} samples - Sample array
 * @returns {Array} Unique device types
 */
function extractDeviceTypes(samples) {
    if (!samples) return [];
    const types = samples.map(s => s.deviceType).filter(Boolean);
    return [...new Set(types)];
}

/**
 * Extract unique keyboard types from samples
 *
 * @param {Array} samples - Sample array
 * @returns {Array} Unique keyboard types
 */
function extractKeyboardTypes(samples) {
    if (!samples) return [];
    const types = samples
        .map(s => s.keyboardSignature?.classification)
        .filter(Boolean);
    return [...new Set(types)];
}

/**
 * Get risk level from anomaly score
 *
 * @param {number} score - Anomaly score
 * @returns {string} Risk level
 */
function getRiskLevel(score) {
    if (score < 0.3) return 'low';
    if (score < 0.7) return 'medium';
    return 'high';
}

/**
 * Escape CSV special characters
 *
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeCSV(str) {
    if (typeof str !== 'string') return str;
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Calculate mean of array
 *
 * @param {Array} arr - Number array
 * @returns {number} Mean
 */
function mean(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Calculate standard deviation
 *
 * @param {Array} arr - Number array
 * @returns {number} Standard deviation
 */
function standardDeviation(arr) {
    if (!arr || arr.length === 0) return 0;
    const avg = mean(arr);
    const squareDiffs = arr.map(val => Math.pow(val - avg, 2));
    const avgSquareDiff = mean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
}

module.exports = {
    exportAsCSV,
    exportAsJSON,
    generateResearchDataset,
    calculateSampleStatistics,
    calculateAggregateStatistics
};
