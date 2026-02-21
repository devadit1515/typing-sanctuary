/**
 * ImpostorChallenge Model
 *
 * Stores impostor challenge data for testing keystroke biometric models.
 * Allows users to challenge friends to fool their biometric authentication.
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const impostorChallengeSchema = new Schema({
    // Unique challenge code (e.g., "ABC-123-XYZ")
    code: {
        type: String,
        required: true,
        unique: true,
        index: true,
        uppercase: true,
        trim: true
    },

    // Owner of the challenge (whose biometric profile is being tested)
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Passage for the challenge
    passage: {
        type: String,
        required: true
    },

    // Array of impostor attempts
    attempts: [{
        playerName: {
            type: String,
            required: true,
            trim: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        confidence: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        fooledSystem: {
            type: Boolean,
            required: true
        },
        distance: {
            type: Number
        }
    }],

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    expiresAt: {
        type: Date,
        required: true,
        index: true
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
impostorChallengeSchema.index({ userId: 1, createdAt: -1 });
impostorChallengeSchema.index({ code: 1, expiresAt: 1 });

// TTL index - automatically delete expired challenges
impostorChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for attempt count
impostorChallengeSchema.virtual('attemptCount').get(function() {
    return this.attempts ? this.attempts.length : 0;
});

// Virtual for successful attempts (fooled system)
impostorChallengeSchema.virtual('successfulAttempts').get(function() {
    return this.attempts ? this.attempts.filter(a => a.fooledSystem).length : 0;
});

// Method to get top impostor (highest confidence)
impostorChallengeSchema.methods.getTopImpostor = function() {
    if (!this.attempts || this.attempts.length === 0) return null;

    return this.attempts.reduce((top, current) => {
        return current.confidence > top.confidence ? current : top;
    });
};

// Method to check if challenge is active
impostorChallengeSchema.methods.isActive = function() {
    return this.expiresAt > new Date();
};

// Static method to find active challenges for a user
impostorChallengeSchema.statics.findActiveChallenges = function(userId) {
    return this.find({
        userId: userId,
        expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
};

// Pre-save hook to ensure expiration date is set
impostorChallengeSchema.pre('save', function(next) {
    if (this.isNew && !this.expiresAt) {
        // Default to 7 days if not set
        this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    next();
});

module.exports = mongoose.model('ImpostorChallenge', impostorChallengeSchema);
