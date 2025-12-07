const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateProfileUpdate } = require('../middleware/validationMiddleware');

/**
 * Profile Routes
 * Base path: /api/profile
 */

// Get user profile by username (public)
router.get('/:username', profileController.getProfile);

// Update current user's profile (protected)
router.put('/update', requireAuth, validateProfileUpdate, profileController.updateProfile);

// Get current user's game history (protected)
router.get('/games', requireAuth, profileController.getGameHistory);

// Get current user's stats (protected)
router.get('/stats', requireAuth, profileController.getStats);

// Reset current user's stats (protected)
router.post('/reset-stats', requireAuth, profileController.resetStats);

module.exports = router;
