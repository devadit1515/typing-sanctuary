const express = require('express');
const router = express.Router();
const biometricController = require('../controllers/biometricController');
const { requireAuth } = require('../middleware/authMiddleware');

// All biometric routes require authentication
router.use(requireAuth);

// Submit keystroke sample for enrollment or verification
router.post('/submit-sample', biometricController.submitSample);

// Consent management
router.post('/consent', biometricController.giveConsent);
router.post('/opt-out', biometricController.optOut);

// Profile management
router.get('/profile', biometricController.getProfile);
router.delete('/data', biometricController.deleteData);

// Verification
router.post('/verify', biometricController.verify);

// Authentication history
router.get('/auth-history', biometricController.getAuthHistory);

// Statistics (for admin dashboard - would need admin auth)
router.get('/stats', biometricController.getEnrollmentStats);

// Adaptive Learning endpoints
router.get('/adaptive-learning/stats', biometricController.getAdaptiveLearningStats);
router.post('/adaptive-learning/rollback', biometricController.rollbackProfile);

// Data Export endpoints (GDPR compliance)
router.get('/export/csv', biometricController.exportDataCSV);
router.get('/export/json', biometricController.exportDataJSON);
router.post('/export/research-dataset', biometricController.generateResearchDataset);

module.exports = router;
