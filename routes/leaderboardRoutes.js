const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');

/**
 * Leaderboard Routes
 * Base path: /api/leaderboard
 */

// Get all leaderboards (top 10 each)
router.get('/all', leaderboardController.getAllLeaderboards);

// Get top players by average WPM
router.get('/wpm', leaderboardController.getTopWPM);

// Get top players by total wins
router.get('/wins', leaderboardController.getTopWins);

// Get top players by best WPM
router.get('/best', leaderboardController.getTopBestWPM);

// Get user's rank
router.get('/rank/:username', leaderboardController.getUserRank);

module.exports = router;
