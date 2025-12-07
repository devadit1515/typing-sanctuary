const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

/**
 * Game Routes
 * Base path: /api/game
 */

// Save game result (anyone can save)
router.post('/save', gameController.saveGameResult);

// Get game by ID
router.get('/:gameId', gameController.getGameById);

// Get recent games (public)
router.get('/recent', gameController.getRecentGames);

module.exports = router;
