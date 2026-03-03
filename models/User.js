const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

/**
 * User Schema
 * Defines the structure of user documents in MongoDB
 */
const userSchema = new mongoose.Schema({
  // Basic Info
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters'],
    lowercase: true,
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    index: true
  },

  email: {
    type: String,
    required: false, // Email is optional
    unique: true,
    sparse: true, // Allows multiple null values for unique field
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    index: true
  },

  passwordHash: {
    type: String,
    required: false,
    default: null
  },

  // Google OAuth — set when user signs in via Google
  googleId: {
    type: String,
    sparse: true,
    default: null
  },

  // Profile Information
  profile: {
    displayName: {
      type: String,
      default: function() { return this.username; }
    },
    avatar: {
      type: String,
      default: 'default'
    },
    bio: {
      type: String,
      maxlength: [200, 'Bio cannot exceed 200 characters'],
      default: ''
    }
  },

  // Game Statistics
  stats: {
    gamesPlayed: {
      type: Number,
      default: 0
    },
    gamesWon: {
      type: Number,
      default: 0
    },
    totalWPM: {
      type: Number,
      default: 0
    },
    averageWPM: {
      type: Number,
      default: 0
    },
    bestWPM: {
      type: Number,
      default: 0
    },
    totalAccuracy: {
      type: Number,
      default: 0
    },
    averageAccuracy: {
      type: Number,
      default: 0
    },
    totalTimePlayed: {
      type: Number,
      default: 0
    },
    winRate: {
      type: Number,
      default: 0
    },
    // Perfect accuracy stats (100% accuracy only)
    perfectAccuracyGames: {
      type: Number,
      default: 0
    },
    bestWPMPerfect: {
      type: Number,
      default: 0
    },
    averageWPMPerfect: {
      type: Number,
      default: 0
    },
    totalWPMPerfect: {
      type: Number,
      default: 0
    }
  },

  // Online Status
  onlineStatus: {
    isOnline: {
      type: Boolean,
      default: false
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    socketId: {
      type: String,
      default: null
    }
  },

  // Set to true once the user has chosen their own username (Google OAuth users start with auto-generated one)
  usernameSet: {
    type: Boolean,
    default: false
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

/**
 * Pre-save middleware to hash password
 * This runs automatically before saving a user
 */
userSchema.pre('save', async function() {
  // Only hash the password if it has been modified and is not null (Google users have no password)
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    return;
  }

  // Generate salt and hash password
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

/**
 * Method to compare password for login
 * @param {String} candidatePassword - Password to check
 * @returns {Boolean} - True if password matches
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Method to update user statistics after a game
 * @param {Object} gameResult - Result of the game
 */
userSchema.methods.updateStats = function(gameResult) {
  this.stats.gamesPlayed += 1;

  if (gameResult.won) {
    this.stats.gamesWon += 1;
  }

  this.stats.totalWPM += gameResult.wpm;
  this.stats.averageWPM = Math.round(this.stats.totalWPM / this.stats.gamesPlayed);

  if (gameResult.wpm > this.stats.bestWPM) {
    this.stats.bestWPM = gameResult.wpm;
  }

  this.stats.totalAccuracy += gameResult.accuracy;
  this.stats.averageAccuracy = Math.round(this.stats.totalAccuracy / this.stats.gamesPlayed);

  this.stats.totalTimePlayed += gameResult.duration;
  this.stats.winRate = Math.round((this.stats.gamesWon / this.stats.gamesPlayed) * 100);

  // Track perfect accuracy (100%) stats
  if (gameResult.accuracy === 100) {
    this.stats.perfectAccuracyGames += 1;
    this.stats.totalWPMPerfect += gameResult.wpm;
    this.stats.averageWPMPerfect = Math.round(this.stats.totalWPMPerfect / this.stats.perfectAccuracyGames);

    if (gameResult.wpm > this.stats.bestWPMPerfect) {
      this.stats.bestWPMPerfect = gameResult.wpm;
    }
  }

  this.lastLogin = Date.now();
};

/**
 * Method to get safe user object (without password)
 * @returns {Object} - User object without sensitive data
 */
userSchema.methods.toSafeObject = function() {
  const userObject = this.toObject();
  delete userObject.passwordHash;
  delete userObject.__v;
  return userObject;
};

// Create additional indexes for leaderboard queries
userSchema.index({ 'stats.averageWPM': -1 });
userSchema.index({ 'stats.gamesWon': -1 });
userSchema.index({ 'stats.averageWPMPerfect': -1 });
userSchema.index({ 'stats.bestWPMPerfect': -1 });
userSchema.index({ 'stats.perfectAccuracyGames': -1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
