const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Passage Model
 *
 * Stores 100 training passages for keystroke biometric enrollment.
 * Passages are categorized by length and complexity to enable
 * progressive difficulty during training.
 */

const passageSchema = new Schema({
    text: {
        type: String,
        required: true,
        trim: true
    },

    length: {
        type: String,
        enum: ['short', 'medium'],
        required: true,
        index: true
    },

    // Character type analysis
    characterTypes: {
        hasLowercase: { type: Boolean, default: false },
        hasUppercase: { type: Boolean, default: false },
        hasNumbers: { type: Boolean, default: false },
        hasSpecialChars: { type: Boolean, default: false }
    },

    // Complexity: 1=easy (lowercase only) to 5=expert (all characters)
    complexity: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
        index: true
    },

    category: {
        type: String,
        enum: ['general', 'technical', 'mixed'],
        default: 'general'
    },

    // Usage tracking for balanced rotation
    usageCount: {
        type: Number,
        default: 0
    },

    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient querying during passage selection
passageSchema.index({ length: 1, complexity: 1, isActive: 1, usageCount: 1 });

// Method to analyze character types when creating passage
passageSchema.pre('save', function(next) {
    if (this.isNew || this.isModified('text')) {
        this.characterTypes.hasLowercase = /[a-z]/.test(this.text);
        this.characterTypes.hasUppercase = /[A-Z]/.test(this.text);
        this.characterTypes.hasNumbers = /[0-9]/.test(this.text);
        this.characterTypes.hasSpecialChars = /[^a-zA-Z0-9\s]/.test(this.text);
    }
    next();
});

module.exports = mongoose.model('Passage', passageSchema);
