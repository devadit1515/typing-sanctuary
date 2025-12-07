const mongoose = require('mongoose');

/**
 * GameHistory Schema
 * Stores complete record of each game played
 */
const gameHistorySchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    index: true
  },

  gameMode: {
    type: String,
    enum: ['solo', 'multiplayer'],
    required: true
  },

  difficulty: {
    type: String,
    enum: ['level1', 'level2', 'level3', 'level4', 'level5'],
    required: function() {
      return this.gameMode === 'solo';
    }
  },

  passageLength: {
    type: String,
    enum: ['short', 'medium', 'long'],
    required: true
  },

  passage: {
    type: String,
    required: true
  },

  startTime: {
    type: Date,
    required: true
  },

  endTime: {
    type: Date,
    required: true
  },

  duration: {
    type: Number, // in milliseconds
    required: true
  },

  // Array of players in this game
  players: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Reference to User model
      default: null // null for bots
    },
    username: {
      type: String,
      required: true
    },
    finalWPM: {
      type: Number,
      required: true
    },
    finalAccuracy: {
      type: Number,
      required: true
    },
    progress: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    finishTime: {
      type: Number, // in milliseconds
      required: true
    },
    placement: {
      type: Number, // 1st, 2nd, 3rd, etc.
      required: true
    },
    isBot: {
      type: Boolean,
      default: false
    }
  }],

  // Winner information
  winner: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    username: {
      type: String,
      required: true
    },
    isBot: {
      type: Boolean,
      default: false
    }
  }

}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Create indexes for faster queries
gameHistorySchema.index({ 'players.userId': 1 });
gameHistorySchema.index({ 'winner.userId': 1 });
gameHistorySchema.index({ gameMode: 1 });
gameHistorySchema.index({ createdAt: -1 }); // Most recent first

/**
 * Static method to get user's game history
 * @param {String} userId - User's MongoDB ID
 * @param {Number} limit - Number of games to return
 * @param {Number} skip - Number of games to skip (for pagination)
 * @returns {Array} - Array of game history documents
 */
gameHistorySchema.statics.getUserHistory = async function(userId, limit = 20, skip = 0) {
  return await this.find({ 'players.userId': userId })
    .sort({ createdAt: -1 }) // Most recent first
    .limit(limit)
    .skip(skip)
    .exec();
};

/**
 * Static method to get user's stats from history
 * @param {String} userId - User's MongoDB ID
 * @returns {Object} - Aggregated statistics
 */
gameHistorySchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    // Match games where user participated
    { $match: { 'players.userId': mongoose.Types.ObjectId(userId) } },

    // Unwind players array
    { $unwind: '$players' },

    // Match only the specific user's records
    { $match: { 'players.userId': mongoose.Types.ObjectId(userId) } },

    // Group and calculate stats
    { $group: {
      _id: null,
      totalGames: { $sum: 1 },
      totalWins: {
        $sum: {
          $cond: [{ $eq: ['$players.placement', 1] }, 1, 0]
        }
      },
      averageWPM: { $avg: '$players.finalWPM' },
      bestWPM: { $max: '$players.finalWPM' },
      averageAccuracy: { $avg: '$players.finalAccuracy' },
      totalTimePlayed: { $sum: '$duration' }
    }}
  ]);

  if (stats.length === 0) {
    return {
      totalGames: 0,
      totalWins: 0,
      averageWPM: 0,
      bestWPM: 0,
      averageAccuracy: 0,
      totalTimePlayed: 0,
      winRate: 0
    };
  }

  const result = stats[0];
  result.winRate = result.totalGames > 0
    ? Math.round((result.totalWins / result.totalGames) * 100)
    : 0;

  return result;
};

/**
 * Static method to get recent games (for activity feed)
 * @param {Number} limit - Number of games to return
 * @returns {Array} - Recent games
 */
gameHistorySchema.statics.getRecentGames = async function(limit = 10) {
  return await this.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('players.userId', 'username profile.displayName')
    .populate('winner.userId', 'username profile.displayName')
    .exec();
};

const GameHistory = mongoose.model('GameHistory', gameHistorySchema);

module.exports = GameHistory;
