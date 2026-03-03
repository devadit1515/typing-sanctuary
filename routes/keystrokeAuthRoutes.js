/**
 * Keystroke Authentication Routes
 *
 * API endpoints for keystroke biometric authentication system:
 * - Enrollment status tracking
 * - Sample submission and processing
 * - Identity verification (self-test)
 * - Impostor challenge system
 * - Settings management
 */

const express = require('express');
const router = express.Router();
const keystrokeAuthController = require('../controllers/keystrokeAuthController');
const { requireAuth } = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(requireAuth);

// ===== ENROLLMENT ENDPOINTS =====

/**
 * GET /api/keystroke-auth/enrollment-status
 * Returns user's current enrollment status, tier, and progress
 */
router.get('/enrollment-status', keystrokeAuthController.getEnrollmentStatus);

/**
 * POST /api/keystroke-auth/submit-sample
 * Submits a new keystroke sample for training
 * Body: { passage, passageLength, keystrokes, deviceInfo, gameId, source }
 */
router.post('/submit-sample', keystrokeAuthController.submitSample);

// ===== TESTING ENDPOINTS =====

/**
 * POST /api/keystroke-auth/verify-test
 * Verifies identity using keystroke biometrics (self-test mode)
 * Body: { passage, keystrokes, mode }
 */
router.post('/verify-test', keystrokeAuthController.verifyTest);

/**
 * POST /api/keystroke-auth/create-impostor-challenge
 * Creates a new impostor challenge with unique code
 * Body: { passageLength }
 */
router.post('/create-impostor-challenge', keystrokeAuthController.createImpostorChallenge);

/**
 * POST /api/keystroke-auth/submit-impostor-attempt
 * Submits an impostor attempt against a challenge
 * Body: { challengeCode, playerName, keystrokes }
 */
router.post('/submit-impostor-attempt', keystrokeAuthController.submitImpostorAttempt);

/**
 * GET /api/keystroke-auth/impostor-leaderboard/:challengeCode
 * Returns leaderboard for an impostor challenge
 */
router.get('/impostor-leaderboard/:challengeCode', keystrokeAuthController.getImpostorLeaderboard);

// ===== SETTINGS ENDPOINTS =====

/**
 * POST /api/keystroke-auth/enable-biometric-auth
 * Enables biometric verification for login (requires 25+ samples)
 */
router.post('/enable-biometric-auth', keystrokeAuthController.enableBiometricAuth);

/**
 * POST /api/keystroke-auth/disable-biometric-auth
 * Disables biometric verification for login
 */
router.post('/disable-biometric-auth', keystrokeAuthController.disableBiometricAuth);

// ===== PASSWORD KEYSTROKE MODE =====

/**
 * GET /api/keystroke-auth/password-status
 * Returns user's password keystroke profile status
 */
router.get('/password-status', keystrokeAuthController.getPasswordStatus);

/**
 * POST /api/keystroke-auth/set-password
 * Sets the keystroke password phrase (hashed), resets training
 * Body: { password }
 */
router.post('/set-password', keystrokeAuthController.setKeystrokePassword);

/**
 * POST /api/keystroke-auth/train-password
 * Submits one training sample for the password phrase
 * Body: { dwellTimes, flightTimes, speed }
 */
router.post('/train-password', keystrokeAuthController.trainPassword);

/**
 * POST /api/keystroke-auth/verify-password
 * Verifies a password attempt against the trained profile
 * Body: { password, dwellTimes, flightTimes }
 */
router.post('/verify-password', keystrokeAuthController.verifyPassword);

module.exports = router;
