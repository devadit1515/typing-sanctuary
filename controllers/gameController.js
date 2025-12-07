const User = require('../models/User');
const GameHistory = require('../models/GameHistory');

/**
 * Game Controller
 * Handles game result saving and history
 */

/**
 * Save game result
 * POST /api/game/save
 */
exports.saveGameResult = async (req, res) => {
  try {
    const {
      roomCode,
      gameMode,
      difficulty,
      passageLength,
      passage,
      startTime,
      endTime,
      duration,
      players,
      winner
    } = req.body;

    // Validate required fields
    if (!roomCode || !gameMode || !players || players.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required game data'
      });
    }

    // Process players and link to user accounts if authenticated
    const processedPlayers = await Promise.all(
      players.map(async (player) => {
        // Try to find user by username
        const user = await User.findOne({ username: player.username.toLowerCase() });

        return {
          userId: user ? user._id : null,
          username: player.username,
          finalWPM: player.wpm || 0,
          finalAccuracy: player.accuracy || 100,
          progress: player.progress || 0,
          finishTime: player.finishTime,
          placement: player.placement || 0,
          isBot: player.isBot || false
        };
      })
    );

    // Create game history record
    const gameHistory = new GameHistory({
      roomCode,
      gameMode,
      difficulty: difficulty || 'medium',
      passageLength: passageLength || 'medium',
      passage: passage || '',
      startTime: startTime ? new Date(startTime) : new Date(),
      endTime: endTime ? new Date(endTime) : new Date(),
      duration: duration || 0,
      players: processedPlayers,
      winner: winner ? {
        userId: winner.userId || null,
        username: winner.username,
        isBot: winner.isBot || false
      } : null
    });

    await gameHistory.save();

    // Update user statistics for authenticated players
    for (const player of processedPlayers) {
      if (player.userId && !player.isBot) {
        const user = await User.findById(player.userId);
        if (user) {
          // Determine if this player won
          const won = winner && winner.username.toLowerCase() === player.username.toLowerCase();

          // Update stats
          user.updateStats({
            won: won,
            wpm: player.finalWPM,
            accuracy: player.finalAccuracy,
            duration: duration || 0
          });

          await user.save();
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Game result saved successfully',
      gameId: gameHistory._id
    });

  } catch (error) {
    console.error('Save game result error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error saving game result'
    });
  }
};

/**
 * Get game details by ID
 * GET /api/game/:gameId
 */
exports.getGameById = async (req, res) => {
  try {
    const { gameId } = req.params;

    const game = await GameHistory.findById(gameId);

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Game not found'
      });
    }

    res.status(200).json({
      success: true,
      game: game
    });

  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get recent games (public)
 * GET /api/game/recent
 */
exports.getRecentGames = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const recentGames = await GameHistory.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('roomCode gameMode players winner createdAt duration');

    res.status(200).json({
      success: true,
      games: recentGames
    });

  } catch (error) {
    console.error('Get recent games error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
