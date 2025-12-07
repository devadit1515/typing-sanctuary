const User = require('../models/User');

/**
 * Leaderboard Controller
 * Handles leaderboard queries and rankings
 */

/**
 * Get top players by average WPM (100% accuracy only)
 * GET /api/leaderboard/wpm
 */
exports.getTopWPM = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    const topPlayers = await User.find({
      'stats.perfectAccuracyGames': { $gte: 5 } // Minimum 5 perfect accuracy games to qualify
    })
      .sort({ 'stats.averageWPMPerfect': -1 })
      .limit(limit)
      .skip(skip)
      .select('username profile.displayName profile.avatar stats');

    const total = await User.countDocuments({
      'stats.perfectAccuracyGames': { $gte: 5 }
    });

    res.status(200).json({
      success: true,
      leaderboard: topPlayers,
      total: total,
      limit: limit,
      skip: skip
    });

  } catch (error) {
    console.error('Get top WPM error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get top players by total wins
 * GET /api/leaderboard/wins
 */
exports.getTopWins = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    const topPlayers = await User.find({
      'stats.gamesWon': { $gt: 0 }
    })
      .sort({ 'stats.gamesWon': -1 })
      .limit(limit)
      .skip(skip)
      .select('username profile.displayName profile.avatar stats');

    const total = await User.countDocuments({
      'stats.gamesWon': { $gt: 0 }
    });

    res.status(200).json({
      success: true,
      leaderboard: topPlayers,
      total: total,
      limit: limit,
      skip: skip
    });

  } catch (error) {
    console.error('Get top wins error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get top players by best WPM (100% accuracy only)
 * GET /api/leaderboard/best
 */
exports.getTopBestWPM = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    const topPlayers = await User.find({
      'stats.bestWPMPerfect': { $gt: 0 }
    })
      .sort({ 'stats.bestWPMPerfect': -1 })
      .limit(limit)
      .skip(skip)
      .select('username profile.displayName profile.avatar stats');

    const total = await User.countDocuments({
      'stats.bestWPMPerfect': { $gt: 0 }
    });

    res.status(200).json({
      success: true,
      leaderboard: topPlayers,
      total: total,
      limit: limit,
      skip: skip
    });

  } catch (error) {
    console.error('Get top best WPM error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get user's rank in leaderboard
 * GET /api/leaderboard/rank/:username
 */
exports.getUserRank = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get rank by average WPM
    const wpmRank = await User.countDocuments({
      'stats.averageWPM': { $gt: user.stats.averageWPM },
      'stats.gamesPlayed': { $gte: 5 }
    }) + 1;

    // Get rank by total wins
    const winsRank = await User.countDocuments({
      'stats.gamesWon': { $gt: user.stats.gamesWon }
    }) + 1;

    // Get rank by best WPM
    const bestWPMRank = await User.countDocuments({
      'stats.bestWPM': { $gt: user.stats.bestWPM }
    }) + 1;

    res.status(200).json({
      success: true,
      ranks: {
        wpm: wpmRank,
        wins: winsRank,
        bestWPM: bestWPMRank
      },
      stats: user.stats
    });

  } catch (error) {
    console.error('Get user rank error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get overall leaderboard with multiple metrics (100% accuracy only)
 * GET /api/leaderboard/all
 */
exports.getAllLeaderboards = async (req, res) => {
  try {
    const limit = 10; // Top 10 for each category

    const [topWPM, topWins, topBest] = await Promise.all([
      User.find({ 'stats.perfectAccuracyGames': { $gte: 5 } })
        .sort({ 'stats.averageWPMPerfect': -1 })
        .limit(limit)
        .select('username profile.displayName profile.avatar stats'),

      User.find({ 'stats.gamesWon': { $gt: 0 } })
        .sort({ 'stats.gamesWon': -1 })
        .limit(limit)
        .select('username profile.displayName profile.avatar stats'),

      User.find({ 'stats.bestWPMPerfect': { $gt: 0 } })
        .sort({ 'stats.bestWPMPerfect': -1 })
        .limit(limit)
        .select('username profile.displayName profile.avatar stats')
    ]);

    res.status(200).json({
      success: true,
      leaderboards: {
        averageWPM: topWPM,
        totalWins: topWins,
        bestWPM: topBest
      }
    });

  } catch (error) {
    console.error('Get all leaderboards error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
