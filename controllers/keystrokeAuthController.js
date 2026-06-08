/**
 * Keystroke Authentication Controller
 *
 * Handles all keystroke biometric authentication endpoints:
 * - Enrollment tracking and tier management
 * - Sample processing with advanced ML
 * - Identity verification
 * - Impostor challenge system
 */

const KeystrokeBiometrics = require('../models/KeystrokeBiometrics');
const Passage = require('../models/Passage');
const { extractFeatureVector, extractLegacyFeatures } = require('../services/featureEngineering');
const { verifyKeystrokeSample } = require('../services/verificationPipeline');
const adaptiveLearningService = require('../services/adaptiveLearningService');
const bcrypt = require('bcryptjs');

/**
 * GET /api/keystroke-auth/enrollment-status
 * Returns user's enrollment status, tier, and progress
 */
exports.getEnrollmentStatus = async (req, res) => {
    try {
        const userId = req.userId;

        // Get or create biometric record
        let biometric = await KeystrokeBiometrics.findOne({ userId });

        if (!biometric) {
            // Create initial biometric record
            biometric = await KeystrokeBiometrics.create({
                userId: userId,
                enrollmentStatus: 'in_progress',
                samples: [],
                consent: {
                    given: true,
                    givenDate: new Date()
                }
            });
        }

        const samplesCollected = biometric.samples ? biometric.samples.length : 0;

        // Determine tier and next threshold
        let enrollmentTier, nextTierAt, tierName, canTest, canEnableAuth;

        if (samplesCollected < 10) {
            enrollmentTier = 'none';
            nextTierAt = 10;
            tierName = 'Not Started';
            canTest = false;
            canEnableAuth = false;
        } else if (samplesCollected < 25) {
            enrollmentTier = 'initial';
            nextTierAt = 25;
            tierName = 'Initial Model (70-80% accuracy)';
            canTest = true;
            canEnableAuth = false;
        } else if (samplesCollected < 50) {
            enrollmentTier = 'good';
            nextTierAt = 50;
            tierName = 'Good Model (85-90% accuracy)';
            canTest = true;
            canEnableAuth = true;
        } else {
            enrollmentTier = 'high';
            nextTierAt = null;
            tierName = 'High Accuracy (95%+ accuracy)';
            canTest = true;
            canEnableAuth = true;
        }

        res.json({
            success: true,
            samplesCollected: samplesCollected,
            enrollmentTier: enrollmentTier,
            tierName: tierName,
            nextTierAt: nextTierAt,
            canTest: canTest,
            canEnableAuth: canEnableAuth,
            biometricAuthEnabled: biometric.enabledForAuth || false
        });

    } catch (error) {
        console.error('Error getting enrollment status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching enrollment status'
        });
    }
};

/**
 * POST /api/keystroke-auth/submit-sample
 * Processes and stores a keystroke sample, updates profile
 */
exports.submitSample = async (req, res) => {
    try {
        const userId = req.userId;
        const { passage, passageLength, keystrokes, deviceInfo, gameId, source } = req.body;

        // Validation
        if (!keystrokes || !Array.isArray(keystrokes) || keystrokes.length < 20) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient keystroke data (minimum 20 keystrokes required)'
            });
        }

        if (!passage || !passageLength) {
            return res.status(400).json({
                success: false,
                message: 'Missing passage or passageLength'
            });
        }

        console.log(`[BIOMETRIC] Processing sample for user ${userId}: ${keystrokes.length} keystrokes from ${source || 'manual'}`);

        // Extract 200-dimensional feature vector (v2 pipeline)
        const featureData = extractFeatureVector(keystrokes);
        if (!featureData) {
            return res.status(400).json({
                success: false,
                message: 'Could not extract features from keystroke data'
            });
        }

        // Also extract legacy features for v1 profile backward compat
        const features = extractLegacyFeatures(keystrokes) || {};

        console.log(`[BIOMETRIC] V2 features extracted: ${featureData.metadata.keystrokeCount} keystrokes, ` +
            `${featureData.metadata.digraphsCovered} digraphs, ${featureData.metadata.trigraphsCovered} trigraphs`);

        // Get or create biometric record
        let biometric = await KeystrokeBiometrics.findOne({ userId });

        if (!biometric) {
            biometric = await KeystrokeBiometrics.create({
                userId: userId,
                enrollmentStatus: 'in_progress',
                samples: [],
                consent: {
                    given: true,
                    givenDate: new Date()
                }
            });
        }

        const previousCount = biometric.samples.length;

        // Store sample
        const sampleData = {
            timestamp: new Date(),
            passage: passage.substring(0, 200), // Store truncated for privacy
            passageLength: passageLength,
            keystrokes: keystrokes.map(k => ({
                char: k.char,
                keyCode: k.keyCode,
                timestamp: k.timestamp,  // Needed for DD interval computation in v2
                dwellTime: k.dwellTime,
                flightTime: k.flightTime,
                position: k.position,
                isCorrect: k.isCorrect
            })),
            features: features,
            deviceInfo: deviceInfo,
            gameId: gameId,
            source: source || 'manual'
        };

        biometric.samples.push(sampleData);

        // Keep only last 100 samples (FIFO storage optimization)
        if (biometric.samples.length > 100) {
            console.log(`[BIOMETRIC] Trimming samples from ${biometric.samples.length} to 100`);
            biometric.samples = biometric.samples.slice(-100);
        }

        // Update profile using v2 adaptive learning pipeline
        if (biometric.samples.length === 1) {
            // First sample — store v1 profile for backward compat
            console.log('[BIOMETRIC] First sample — initializing profile');
            biometric.profile = features;
        } else if (biometric.samples.length >= adaptiveLearningService.MIN_SAMPLES_FOR_PROFILE) {
            // Build or update v2 profile
            console.log('[BIOMETRIC] Updating v2 profile with adaptive learning');
            try {
                if (biometric.profileVersion !== 2) {
                    // First time building v2 profile
                    await adaptiveLearningService.buildProfile(userId);
                } else {
                    await adaptiveLearningService.updateProfile(userId, { keystrokes }, true);
                }
                // Reload biometric to get updated profile
                biometric = await KeystrokeBiometrics.findOne({ userId });
            } catch (learningError) {
                console.error('[BIOMETRIC] Adaptive learning error (non-fatal):', learningError.message);
            }
        }

        const currentCount = biometric.samples.length;

        // Check for tier unlock
        let tierUnlocked = false;
        let newTierName = '';

        if (previousCount < 10 && currentCount >= 10) {
            biometric.enrollmentTier = 'initial';
            tierUnlocked = true;
            newTierName = 'Initial Model';
            console.log('[BIOMETRIC] 🎉 Tier unlocked: Initial (10 samples)');
        } else if (previousCount < 25 && currentCount >= 25) {
            biometric.enrollmentTier = 'good';
            tierUnlocked = true;
            newTierName = 'Good Model';
            console.log('[BIOMETRIC] 🎉 Tier unlocked: Good (25 samples)');
        } else if (previousCount < 50 && currentCount >= 50) {
            biometric.enrollmentTier = 'high';
            biometric.enrollmentStatus = 'completed';
            tierUnlocked = true;
            newTierName = 'High Accuracy';
            console.log('[BIOMETRIC] 🎉 Tier unlocked: High (50 samples)');
        }

        await biometric.save();

        // V2 threshold is calibrated automatically during profile build/update
        if (biometric.v2Profile?.threshold) {
            console.log(`[BIOMETRIC] V2 threshold: ${biometric.v2Profile.threshold.toFixed(3)} (${biometric.v2Profile.thresholdConfidence})`);
        }

        // Determine next tier threshold
        let nextTierAt;
        if (currentCount < 10) nextTierAt = 10;
        else if (currentCount < 25) nextTierAt = 25;
        else if (currentCount < 50) nextTierAt = 50;
        else nextTierAt = null;

        res.json({
            success: true,
            message: 'Keystroke sample recorded successfully',
            enrollmentProgress: {
                current: currentCount,
                nextTierAt: nextTierAt,
                tierName: biometric.enrollmentTier
            },
            tierUnlocked: tierUnlocked,
            newTierName: newTierName
        });

    } catch (error) {
        console.error('Error submitting sample:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while processing sample'
        });
    }
};

/**
 * POST /api/keystroke-auth/verify-test
 * Verifies identity using advanced ML algorithms
 */
exports.verifyTest = async (req, res) => {
    try {
        const userId = req.userId;
        const { passage, keystrokes, mode } = req.body;

        // Validation
        if (!keystrokes || keystrokes.length < 20) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient keystroke data for verification'
            });
        }

        // Get user's biometric profile
        const biometric = await KeystrokeBiometrics.findOne({ userId });

        if (!biometric || !biometric.samples || biometric.samples.length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient training data. Complete at least 10 samples first.'
            });
        }

        console.log(`[BIOMETRIC] Verifying identity for user ${userId} (mode: ${mode})`);

        // Auto-migrate to v2 if needed
        if (biometric.profileVersion !== 2 && biometric.samples.length >= 10) {
            try {
                await adaptiveLearningService.buildProfile(userId);
                // Reload after build
                const updated = await KeystrokeBiometrics.findOne({ userId });
                if (updated) Object.assign(biometric, updated.toObject());
            } catch (e) {
                console.error('[BIOMETRIC] V2 migration failed:', e.message);
            }
        }

        // Use v2 pipeline if available, otherwise fall back gracefully
        let result;
        if (biometric.profileVersion === 2 && biometric.v2Profile?.enrollmentComplete) {
            result = verifyKeystrokeSample(biometric.v2Profile, keystrokes);
        } else {
            // Fallback for profiles not yet migrated
            result = {
                authenticated: false,
                confidence: 0,
                riskLevel: 'HIGH',
                fusedScore: 0,
                threshold: 0,
                error: 'V2 profile not available — submit more training samples',
                method: 'multi_classifier_ensemble_v2'
            };
        }

        const { authenticated, confidence, riskLevel, fusedScore, threshold, perClassifierScores } = result;

        console.log(`[BIOMETRIC] V2 verification: ${confidence}% confidence (fused: ${fusedScore}, threshold: ${threshold})`);

        // Record test result
        if (!biometric.testingHistory) biometric.testingHistory = [];

        biometric.testingHistory.push({
            timestamp: new Date(),
            mode: mode || 'self-test',
            confidence,
            riskLevel,
            authenticated,
            distance: fusedScore,
            ensembleScore: fusedScore
        });

        if (biometric.testingHistory.length > 50) {
            biometric.testingHistory = biometric.testingHistory.slice(-50);
        }

        await biometric.save();

        res.json({
            success: true,
            confidence,
            riskLevel,
            authenticated,
            details: {
                fusedScore: fusedScore?.toFixed?.(4) || '0',
                threshold: threshold?.toFixed?.(4) || '0',
                perClassifierScores: perClassifierScores || {},
                samplesUsed: biometric.v2Profile?.samplesUsed || biometric.samples.length,
                method: 'multi_classifier_ensemble_v2'
            }
        });

    } catch (error) {
        console.error('Error verifying test:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during verification'
        });
    }
};

/**
 * POST /api/keystroke-auth/create-impostor-challenge
 * Creates a new impostor challenge with unique code
 */
exports.createImpostorChallenge = async (req, res) => {
    try {
        const userId = req.userId;
        const { passageLength } = req.body;

        // Check user has sufficient training
        const biometric = await KeystrokeBiometrics.findOne({ userId });
        if (!biometric || biometric.samples.length < 10) {
            return res.status(400).json({
                success: false,
                message: 'You need at least 10 training samples before creating challenges'
            });
        }

        // Generate random 9-character challenge code (format: ABC-123-XYZ)
        const generateCode = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 9; i++) {
                if (i === 3 || i === 6) {
                    code += '-';
                } else {
                    code += chars.charAt(Math.floor(Math.random() * chars.length));
                }
            }
            return code;
        };

        let challengeCode = generateCode();

        // Ensure code is unique
        const ImpostorChallenge = require('../models/ImpostorChallenge');
        let existingChallenge = await ImpostorChallenge.findOne({ code: challengeCode });
        while (existingChallenge) {
            challengeCode = generateCode();
            existingChallenge = await ImpostorChallenge.findOne({ code: challengeCode });
        }

        // Get random passage for challenge
        const passage = await Passage.findOne({
            length: passageLength || 'medium',
            isActive: true
        }).sort({ usageCount: 1 });

        if (!passage) {
            return res.status(500).json({
                success: false,
                message: 'No passages available for challenge'
            });
        }

        passage.usageCount++;
        await passage.save();

        // Create challenge record
        const challenge = await ImpostorChallenge.create({
            code: challengeCode,
            userId: userId,
            passage: passage.text,
            attempts: [],
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });

        console.log(`[IMPOSTOR] Challenge created: ${challengeCode} by user ${userId}`);

        res.json({
            success: true,
            challengeCode: challengeCode,
            passage: passage.text,
            expiresAt: challenge.expiresAt
        });

    } catch (error) {
        console.error('Error creating impostor challenge:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating challenge'
        });
    }
};

/**
 * POST /api/keystroke-auth/submit-impostor-attempt
 * Submits an impostor attempt against a challenge
 */
exports.submitImpostorAttempt = async (req, res) => {
    try {
        const { challengeCode, playerName, keystrokes } = req.body;

        // Validation
        if (!challengeCode || !playerName || !keystrokes || keystrokes.length < 20) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields or insufficient keystrokes'
            });
        }

        // Find challenge
        const ImpostorChallenge = require('../models/ImpostorChallenge');
        const challenge = await ImpostorChallenge.findOne({ code: challengeCode });

        if (!challenge) {
            return res.status(404).json({
                success: false,
                message: 'Challenge not found. Check the code and try again.'
            });
        }

        if (challenge.expiresAt < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Challenge has expired'
            });
        }

        // Get owner's biometric profile
        const biometric = await KeystrokeBiometrics.findOne({ userId: challenge.userId });

        if (!biometric || !biometric.profile) {
            return res.status(500).json({
                success: false,
                message: 'Challenge owner profile not available'
            });
        }

        console.log(`[IMPOSTOR] Attempt by "${playerName}" on challenge ${challengeCode}`);

        // Use v2 pipeline if available
        let confidence, fooledSystem, fusedScore;

        if (biometric.profileVersion === 2 && biometric.v2Profile?.enrollmentComplete) {
            const result = verifyKeystrokeSample(biometric.v2Profile, keystrokes);
            confidence = result.confidence;
            fusedScore = result.fusedScore;
            fooledSystem = confidence >= 85;
        } else {
            // Fallback: cannot verify without v2 profile
            confidence = 0;
            fusedScore = 999;
            fooledSystem = false;
        }

        console.log(`[IMPOSTOR] Result: ${confidence}% confidence - ${fooledSystem ? 'FOOLED' : 'DETECTED'}`);

        // Record attempt
        challenge.attempts.push({
            playerName: playerName.substring(0, 50), // Limit name length
            timestamp: new Date(),
            confidence: confidence,
            fooledSystem: fooledSystem,
            distance: fusedScore
        });

        await challenge.save();

        // Calculate rank (sorted by confidence descending)
        const sortedAttempts = challenge.attempts
            .slice()
            .sort((a, b) => b.confidence - a.confidence);
        const rank = sortedAttempts.findIndex(a =>
            a.playerName === playerName &&
            Math.abs(a.confidence - confidence) < 0.1
        ) + 1;

        res.json({
            success: true,
            confidence: confidence,
            fooledSystem: fooledSystem,
            rank: rank,
            totalAttempts: challenge.attempts.length,
            message: fooledSystem
                ? `Amazing! You fooled the system with ${confidence}% match!`
                : `Detected as impostor (${confidence}% match). Keep trying!`
        });

    } catch (error) {
        console.error('Error submitting impostor attempt:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while processing attempt'
        });
    }
};

/**
 * GET /api/keystroke-auth/impostor-leaderboard/:challengeCode
 * Returns leaderboard for an impostor challenge
 */
exports.getImpostorLeaderboard = async (req, res) => {
    try {
        const { challengeCode } = req.params;

        const ImpostorChallenge = require('../models/ImpostorChallenge');
        const challenge = await ImpostorChallenge.findOne({ code: challengeCode });

        if (!challenge) {
            return res.status(404).json({
                success: false,
                message: 'Challenge not found'
            });
        }

        // Sort attempts by confidence (highest first)
        const leaderboard = challenge.attempts
            .map(a => ({
                playerName: a.playerName,
                confidence: a.confidence,
                fooledSystem: a.fooledSystem,
                timestamp: a.timestamp
            }))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 20); // Top 20

        res.json({
            success: true,
            challengeCode: challengeCode,
            leaderboard: leaderboard,
            totalAttempts: challenge.attempts.length,
            expiresAt: challenge.expiresAt
        });

    } catch (error) {
        console.error('Error getting impostor leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching leaderboard'
        });
    }
};

/**
 * POST /api/keystroke-auth/enable-biometric-auth
 * Enables biometric verification for login (requires 25+ samples)
 */
exports.enableBiometricAuth = async (req, res) => {
    try {
        const userId = req.userId;

        const biometric = await KeystrokeBiometrics.findOne({ userId });

        if (!biometric || biometric.samples.length < 25) {
            return res.status(400).json({
                success: false,
                message: 'Minimum 25 training samples required to enable biometric authentication'
            });
        }

        biometric.enabledForAuth = true;
        await biometric.save();

        console.log(`[BIOMETRIC] User ${userId} enabled biometric authentication`);

        res.json({
            success: true,
            message: 'Biometric authentication enabled. Your login will now require password + typing pattern verification.'
        });

    } catch (error) {
        console.error('Error enabling biometric auth:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while enabling biometric authentication'
        });
    }
};

/**
 * POST /api/keystroke-auth/disable-biometric-auth
 * Disables biometric verification for login
 */
exports.disableBiometricAuth = async (req, res) => {
    try {
        const userId = req.userId;

        const biometric = await KeystrokeBiometrics.findOne({ userId });

        if (biometric) {
            biometric.enabledForAuth = false;
            await biometric.save();
            console.log(`[BIOMETRIC] User ${userId} disabled biometric authentication`);
        }

        res.json({
            success: true,
            message: 'Biometric authentication disabled. Login will only require password.'
        });

    } catch (error) {
        console.error('Error disabling biometric auth:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while disabling biometric authentication'
        });
    }
};

// =====================================================================
// PASSWORD-SPECIFIC KEYSTROKE AUTHENTICATION
// =====================================================================

/**
 * GET /api/keystroke-auth/password-status
 * Returns status of user's password keystroke profile
 */
exports.getPasswordStatus = async (req, res) => {
    try {
        const userId = req.userId;
        const biometric = await KeystrokeBiometrics.findOne({ userId });

        const pp = biometric && biometric.passwordProfile;

        if (!pp || !pp.passwordHash) {
            return res.json({
                success: true,
                hasPassword: false,
                trainingCount: 0,
                trainingComplete: false
            });
        }

        res.json({
            success: true,
            hasPassword: true,
            trainingCount: pp.trainingCount || 0,
            trainingComplete: pp.trainingComplete || false,
            passwordLength: pp.passwordLength
        });

    } catch (error) {
        console.error('[PASSWORD-KS] Error getting status:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * POST /api/keystroke-auth/set-password
 * Body: { password: String }
 * Hashes and stores the keystroke password phrase, resets training.
 */
exports.setKeystrokePassword = async (req, res) => {
    try {
        const userId = req.userId;
        const { password } = req.body;

        if (!password || password.length < 4) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 4 characters'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        let biometric = await KeystrokeBiometrics.findOne({ userId });
        if (!biometric) {
            biometric = await KeystrokeBiometrics.create({
                userId,
                enrollmentStatus: 'in_progress',
                samples: [],
                consent: { given: true, givenDate: new Date() }
            });
        }

        // Reset password profile completely
        biometric.passwordProfile = {
            passwordHash,
            passwordLength: password.length,
            trainingComplete: false,
            trainingCount: 0,
            threshold: 70,
            samples: [],
            positions: []
        };

        await biometric.save();

        console.log(`[PASSWORD-KS] Password set for user ${userId} (length: ${password.length})`);

        res.json({
            success: true,
            message: 'Keystroke password set. Begin training.',
            passwordLength: password.length
        });

    } catch (error) {
        console.error('[PASSWORD-KS] Error setting password:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * POST /api/keystroke-auth/train-password
 * Body: { dwellTimes: Number[], flightTimes: Number[], speed: 'slow'|'normal'|'fast' }
 * Stores one training sample and rebuilds position profile when complete.
 */
exports.trainPassword = async (req, res) => {
    try {
        const userId = req.userId;
        const { dwellTimes, flightTimes, speed } = req.body;

        if (!dwellTimes || !flightTimes || !speed) {
            return res.status(400).json({ success: false, message: 'Missing fields' });
        }

        if (!['slow', 'normal', 'fast'].includes(speed)) {
            return res.status(400).json({ success: false, message: 'Invalid speed value' });
        }

        const biometric = await KeystrokeBiometrics.findOne({ userId });
        if (!biometric || !biometric.passwordProfile || !biometric.passwordProfile.passwordHash) {
            return res.status(400).json({ success: false, message: 'Set a password first' });
        }

        const pp = biometric.passwordProfile;

        // Validate length matches stored password
        if (dwellTimes.length !== pp.passwordLength) {
            return res.status(400).json({
                success: false,
                message: `Expected ${pp.passwordLength} characters, got ${dwellTimes.length}`
            });
        }

        // Store sample
        pp.samples.push({ speed, dwellTimes, flightTimes, timestamp: new Date() });
        pp.trainingCount = pp.samples.length;

        const REQUIRED_SAMPLES = 15;

        // Rebuild position profile when we have enough samples
        if (pp.samples.length >= REQUIRED_SAMPLES) {
            pp.trainingComplete = true;
            const len = pp.passwordLength;
            const positions = [];

            for (let i = 0; i < len; i++) {
                const dwells = pp.samples.map(s => s.dwellTimes[i]).filter(v => v != null);
                const flights = pp.samples.map(s => s.flightTimes[i]).filter(v => v != null);

                const dwellMean = dwells.reduce((a, b) => a + b, 0) / dwells.length;
                const dwellStdDev = Math.sqrt(
                    dwells.reduce((sum, v) => sum + Math.pow(v - dwellMean, 2), 0) / dwells.length
                );

                const flightMean = flights.length > 0
                    ? flights.reduce((a, b) => a + b, 0) / flights.length : 0;
                const flightStdDev = flights.length > 1
                    ? Math.sqrt(flights.reduce((sum, v) => sum + Math.pow(v - flightMean, 2), 0) / flights.length)
                    : 10;

                positions.push({ dwellMean, dwellStdDev, flightMean, flightStdDev });
            }

            pp.positions = positions;
            console.log(`[PASSWORD-KS] Profile built for user ${userId} with ${pp.samples.length} samples`);
        }

        await biometric.save();

        // Determine next speed in the round-robin sequence (slow → normal → fast)
        const speedOrder = ['slow', 'normal', 'fast'];
        const nextSpeed = speedOrder[pp.trainingCount % 3];

        res.json({
            success: true,
            trainingCount: pp.trainingCount,
            trainingComplete: pp.trainingComplete,
            nextSpeed: pp.trainingComplete ? null : nextSpeed,
            samplesNeeded: Math.max(0, REQUIRED_SAMPLES - pp.trainingCount)
        });

    } catch (error) {
        console.error('[PASSWORD-KS] Error training:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * POST /api/keystroke-auth/verify-password
 * Body: { password: String, dwellTimes: Number[], flightTimes: Number[] }
 * Returns similarity % and verdict.
 */
exports.verifyPassword = async (req, res) => {
    try {
        const userId = req.userId;
        const { password, dwellTimes, flightTimes } = req.body;

        if (!password || !dwellTimes || !flightTimes) {
            return res.status(400).json({ success: false, message: 'Missing fields' });
        }

        const biometric = await KeystrokeBiometrics.findOne({ userId });
        if (!biometric || !biometric.passwordProfile || !biometric.passwordProfile.passwordHash) {
            return res.status(400).json({ success: false, message: 'No password profile found' });
        }

        const pp = biometric.passwordProfile;

        if (!pp.trainingComplete) {
            return res.status(400).json({
                success: false,
                message: `Training not complete. Need ${15 - pp.trainingCount} more samples.`
            });
        }

        // Step 1: Verify correct characters typed
        const passwordMatch = await bcrypt.compare(password, pp.passwordHash);
        if (!passwordMatch) {
            return res.json({
                success: true,
                similarity: 0,
                verdict: 'wrong_password',
                message: 'Incorrect password — wrong characters typed'
            });
        }

        // Step 2: Length check
        if (dwellTimes.length !== pp.passwordLength) {
            return res.json({
                success: true,
                similarity: 0,
                verdict: 'wrong_password',
                message: 'Password length mismatch'
            });
        }

        // Step 3: Per-position z-score comparison
        const zScores = [];
        for (let i = 0; i < pp.passwordLength; i++) {
            const pos = pp.positions[i];
            if (!pos) continue;

            const dwellZ = Math.abs(dwellTimes[i] - pos.dwellMean) / (pos.dwellStdDev + 10);
            const flightZ = i < flightTimes.length
                ? Math.abs(flightTimes[i] - pos.flightMean) / (pos.flightStdDev + 10)
                : 0;

            zScores.push((dwellZ + flightZ) / 2);
        }

        const avgZ = zScores.reduce((a, b) => a + b, 0) / zScores.length;
        const similarity = Math.max(0, Math.min(100, 100 - (avgZ / 3) * 100));
        const similarityRounded = Math.round(similarity * 10) / 10;

        const threshold = pp.threshold || 70;
        const verdict = similarityRounded >= threshold ? 'welcome' : 'rejected';

        console.log(`[PASSWORD-KS] Verify user ${userId}: ${similarityRounded}% similarity → ${verdict}`);

        // Store last verification
        pp.lastVerification = {
            similarity: similarityRounded,
            verdict,
            timestamp: new Date()
        };
        await biometric.save();

        res.json({
            success: true,
            similarity: similarityRounded,
            verdict,
            threshold,
            message: verdict === 'welcome'
                ? 'Typing pattern matches!'
                : 'Typing pattern does not match'
        });

    } catch (error) {
        console.error('[PASSWORD-KS] Error verifying:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
