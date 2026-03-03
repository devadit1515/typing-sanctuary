const User = require('../models/User');
const GameHistory = require('../models/GameHistory');

/**
 * Profile Controller
 * Handles user profile viewing and updating
 */

/**
 * Get user profile by username
 * GET /api/profile/:username
 */
exports.getProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get recent games
    const recentGames = await GameHistory.getUserHistory(user._id, 10, 0);

    res.status(200).json({
      success: true,
      profile: user.toSafeObject(),
      recentGames: recentGames
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update current user's profile
 * PUT /api/profile/update
 */
exports.updateProfile = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const { displayName, bio, email, avatar } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields if provided
    if (displayName !== undefined) {
      user.profile.displayName = displayName;
    }

    if (bio !== undefined) {
      user.profile.bio = bio;
    }

    if (avatar !== undefined) {
      user.profile.avatar = avatar;
    }

    if (email !== undefined) {
      // Check if email is already taken by another user
      if (email) {
        const existingUser = await User.findOne({
          email: email.toLowerCase(),
          _id: { $ne: user._id }
        });

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'Email already in use'
          });
        }

        user.email = email.toLowerCase();
      } else {
        user.email = undefined;
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile: user.toSafeObject()
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get user's game history
 * GET /api/profile/games
 */
exports.getGameHistory = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;

    const games = await GameHistory.getUserHistory(req.userId, limit, skip);
    const totalGames = await GameHistory.countDocuments({
      'players.userId': req.userId
    });

    res.status(200).json({
      success: true,
      games: games,
      total: totalGames,
      limit: limit,
      skip: skip
    });

  } catch (error) {
    console.error('Get game history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get user statistics
 * GET /api/profile/stats
 */
exports.getStats = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get detailed stats from game history
    const detailedStats = await GameHistory.getUserStats(req.userId);

    res.status(200).json({
      success: true,
      stats: {
        basic: user.stats,
        detailed: detailedStats
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Reset user statistics
 * POST /api/profile/reset-stats
 */
exports.resetStats = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Reset user stats
    user.stats = {
      gamesPlayed: 0,
      gamesWon: 0,
      averageWPM: 0,
      bestWPM: 0,
      averageAccuracy: 0,
      totalTimePlayed: 0,
      winRate: 0
    };

    await user.save();

    // Delete all game history for this user
    await GameHistory.deleteMany({ 'players.userId': req.userId });

    res.status(200).json({
      success: true,
      message: 'Statistics reset successfully',
      stats: user.stats
    });

  } catch (error) {
    console.error('Reset stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update user bio
 * POST /api/profile/update-bio
 */
exports.updateBio = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const { bio } = req.body;

    if (bio && bio.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Bio cannot exceed 200 characters'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.profile.bio = bio || '';
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Bio updated successfully',
      bio: user.profile.bio
    });

  } catch (error) {
    console.error('Update bio error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
