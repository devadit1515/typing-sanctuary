const mongoose = require('mongoose');

const keystrokeSampleSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameHistory'
  },
  passage: {
    type: String,
    required: true
  },
  passageLength: {
    type: Number,
    required: true
  },
  deviceInfo: {
    userAgent: String,
    platform: String,
    keyboardLayout: String
  },
  deviceFingerprint: {
    type: String,
    index: true // Index for fast device-based queries
  },
  deviceType: {
    type: String,
    enum: ['desktop', 'laptop', 'tablet', 'mobile', 'computer', 'unknown']
  },
  keyboardSignature: {
    meanDwellTime: Number,
    dwellVariance: Number,
    classification: {
      type: String,
      enum: ['mechanical', 'laptop', 'external', 'unknown']
    },
    confidence: Number,
    sampleSize: Number
  },
  keystrokes: [{
    char: String,
    keyCode: String,
    timestamp: Number,        // performance.now() timestamp
    dwellTime: Number,        // Key down to key up (ms)
    flightTime: Number,       // Previous key up to this key down (ms)
    position: Number,         // Position in text
    isCorrect: Boolean,       // Was character typed correctly?
    previousChar: String      // For digraph analysis
  }]
});

const biometricProfileSchema = new mongoose.Schema({
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  samplesUsed: {
    type: Number,
    default: 0
  },

  // Dwell Time Statistics
  dwellTime: {
    mean: Number,
    stdDev: Number,
    min: Number,
    max: Number,
    median: Number
  },

  // Flight Time Statistics
  flightTime: {
    mean: Number,
    stdDev: Number,
    min: Number,
    max: Number,
    median: Number
  },

  // Per-key dwell times (for common keys)
  perKeyDwell: {
    type: Map,
    of: {
      mean: Number,
      stdDev: Number,
      count: Number
    }
  },

  // Digraph timing (two-key combinations)
  digraphTimings: {
    type: Map,
    of: {
      mean: Number,
      stdDev: Number,
      count: Number
    }
  },

  // Trigraph timing (three-key combinations) - NEW for advanced ML
  trigraphTimings: {
    type: Map,
    of: {
      mean: Number,
      stdDev: Number,
      count: Number
    }
  },

  // Error patterns
  errorRate: {
    overall: Number,
    byPosition: [Number]  // Error rate by position in word
  },

  // Typing rhythm
  rhythm: {
    burstSpeed: Number,      // Average speed during typing bursts
    pauseFrequency: Number,  // How often user pauses (pauses per 100 chars)
    pauseDuration: Number,   // Average pause duration (ms)
    consistency: Number      // NEW: Rhythm consistency score (0-1)
  },

  // Temporal patterns - NEW for advanced ML
  temporalPatterns: {
    cadenceConsistency: Number,
    overallRhythm: Number,
    windowCount: Number
  },

  // Advanced metrics
  wpm: {
    mean: Number,
    stdDev: Number
  },
  accuracy: {
    mean: Number,
    stdDev: Number
  }
});

const keystrokeBiometricsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Enrollment status
  enrollmentStatus: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started'
  },
  enrollmentProgress: {
    samplesCollected: {
      type: Number,
      default: 0
    },
    samplesRequired: {
      type: Number,
      default: 5
    },
    startedAt: Date,
    completedAt: Date
  },

  // Privacy and consent
  consent: {
    given: {
      type: Boolean,
      default: false
    },
    givenAt: Date,
    version: {
      type: String,
      default: '1.0'
    },
    researchConsent: {
      type: Boolean,
      default: false
    }
  },

  optOut: {
    type: Boolean,
    default: false
  },
  optOutDate: Date,

  // Raw keystroke samples (for research and retraining)
  samples: [keystrokeSampleSchema],

  // Computed biometric profile
  profile: biometricProfileSchema,

  // Authentication history
  authenticationHistory: [{
    timestamp: Date,
    success: Boolean,
    anomalyScore: Number,
    method: {
      type: String,
      enum: ['statistical', 'ml_ensemble', 'random_forest', 'lstm', 'svm']
    },
    context: {
      device: String,
      timeOfDay: String,
      sessionId: String
    }
  }],

  // Security flags
  security: {
    suspiciousAttempts: {
      type: Number,
      default: 0
    },
    lastSuspiciousAttempt: Date,
    locked: {
      type: Boolean,
      default: false
    },
    lockedUntil: Date
  },

  // Profile versioning for adaptive learning
  profileVersions: [{
    version: Number,
    profile: biometricProfileSchema,
    timestamp: Date,
    samplesAtVersion: Number
  }],

  // Context-specific profiles (per device, time of day, etc.)
  contextProfiles: {
    type: Map,
    of: {
      deviceType: String,
      profile: biometricProfileSchema,
      sampleCount: Number,
      lastUpdated: Date
    }
  },

  // Adaptive learning metadata
  metadata: {
    profileUpdates: Number,
    lastProfileUpdate: Date,
    lastRollback: {
      timestamp: Date,
      toVersion: Number,
      reason: String
    }
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },

  // ===== KEYSTROKE AUTHENTICATION FIELDS =====

  // Enrollment tier (based on sample count)
  enrollmentTier: {
    type: String,
    enum: ['none', 'initial', 'good', 'high'],
    default: 'none'
  },

  // Custom adaptive threshold (calibrated per user)
  customThreshold: {
    type: Number,
    default: 1.5
  },

  // Enable/disable biometric auth requirement for login
  enabledForAuth: {
    type: Boolean,
    default: false
  },

  // Testing history (self-test and impostor challenges)
  testingHistory: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    mode: {
      type: String,
      enum: ['self-test', 'impostor-challenge']
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100
    },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH']
    },
    authenticated: Boolean,
    distance: Number,
    ensembleScore: Number
  }],

  // ===== V2 BIOMETRIC PROFILE (Multi-Classifier Ensemble) =====

  profileVersion: {
    type: Number,
    default: 1  // 1 = legacy, 2 = new multi-classifier ensemble
  },

  // V2: Selected feature configuration (50-80 features from 200-dimensional space)
  v2Profile: {
    selectedFeatures: [Number],       // Indices into the 200-feature space
    featureNames: [String],           // Human-readable names for selected features
    featureQualityScores: [Number],   // Quality score per selected feature

    // Per-feature statistics (flat arrays, length = selectedFeatures.length)
    means: [Number],
    medians: [Number],
    stdDevs: [Number],
    mads: [Number],                   // Mean Absolute Deviation from mean
    madMedians: [Number],             // MAD from median

    // Raw feature vectors for KNN and profile recomputation
    rawVectors: [[Number]],           // Up to 50 vectors, each of selectedFeatures.length

    // Covariance data for Mahalanobis classifier (Ledoit-Wolf shrunk)
    covarianceMatrix: [[Number]],     // p x p shrunk covariance
    covarianceInverse: [[Number]],    // Pre-computed inverse
    shrinkageAlpha: Number,           // Ledoit-Wolf shrinkage intensity

    // One-class boundary radius
    boundaryRadius: Number,

    // Per-classifier calibration from leave-one-out cross-validation
    calibration: {
      scaledManhattan: { trainScores: [Number], min: Number, max: Number },
      scaledEuclidean: { trainScores: [Number], min: Number, max: Number },
      mahalanobis: { trainScores: [Number], min: Number, max: Number },
      manhattanFiltered: { trainScores: [Number], min: Number, max: Number },
      knn: { trainScores: [Number], min: Number, max: Number },
      oneClass: { trainScores: [Number], min: Number, max: Number }
    },

    // Score fusion configuration
    fusionWeights: [Number],          // One weight per classifier (6 total)
    fusionMethod: {
      type: String,
      enum: ['mean', 'median', 'weighted'],
      default: 'mean'
    },

    // Adaptive threshold
    threshold: Number,
    thresholdConfidence: {
      type: String,
      enum: ['low', 'medium', 'high']
    },

    // Profile metadata
    samplesUsed: Number,
    enrollmentComplete: Boolean,
    lastUpdated: Date,
    lastCalibration: Date,
    samplesSinceLastCalibration: {
      type: Number,
      default: 0
    }
  },

  // Password-specific keystroke profile
  passwordProfile: {
    passwordHash: String,       // bcrypt hash of the phrase
    passwordLength: Number,     // character count (for validation)
    trainingComplete: {
      type: Boolean,
      default: false
    },
    trainingCount: {
      type: Number,
      default: 0
    },
    threshold: {
      type: Number,
      default: 70               // similarity % required to pass
    },
    samples: [{
      speed: {
        type: String,
        enum: ['slow', 'normal', 'fast']
      },
      dwellTimes: [Number],     // per-character hold duration (ms)
      flightTimes: [Number],    // inter-character gap (ms)
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    positions: [{               // computed per-position profile
      dwellMean: Number,
      dwellStdDev: Number,
      flightMean: Number,
      flightStdDev: Number
    }],
    lastVerification: {
      similarity: Number,
      verdict: String,
      timestamp: Date
    }
  }
});

// Indexes
keystrokeBiometricsSchema.index({ userId: 1 });
keystrokeBiometricsSchema.index({ enrollmentStatus: 1 });
keystrokeBiometricsSchema.index({ 'consent.given': 1 });
keystrokeBiometricsSchema.index({ optOut: 1 });

// Methods

// Add a new keystroke sample
keystrokeBiometricsSchema.methods.addSample = async function(sampleData) {
  // Limit stored samples to most recent 100 (raw keystrokes for re-extraction)
  if (this.samples.length >= 100) {
    this.samples.shift(); // Remove oldest
  }

  this.samples.push(sampleData);
  this.enrollmentProgress.samplesCollected = this.samples.length;

  // Update enrollment status
  if (this.samples.length >= this.enrollmentProgress.samplesRequired) {
    this.enrollmentStatus = 'completed';
    if (!this.enrollmentProgress.completedAt) {
      this.enrollmentProgress.completedAt = new Date();
    }
  } else {
    this.enrollmentStatus = 'in_progress';
    if (!this.enrollmentProgress.startedAt) {
      this.enrollmentProgress.startedAt = new Date();
    }
  }

  this.updatedAt = new Date();
  await this.save();

  return this;
};

// Record authentication attempt
keystrokeBiometricsSchema.methods.recordAuthAttempt = async function(result) {
  this.authenticationHistory.push({
    timestamp: new Date(),
    success: result.success,
    anomalyScore: result.anomalyScore,
    method: result.method || 'statistical',
    context: result.context || {}
  });

  // Keep only last 100 attempts
  if (this.authenticationHistory.length > 100) {
    this.authenticationHistory = this.authenticationHistory.slice(-100);
  }

  // Update security flags
  if (!result.success && result.anomalyScore > 0.7) {
    this.security.suspiciousAttempts += 1;
    this.security.lastSuspiciousAttempt = new Date();

    // Lock account after 5 suspicious attempts in short time
    if (this.security.suspiciousAttempts >= 5) {
      this.security.locked = true;
      this.security.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
  } else if (result.success) {
    // Reset suspicious attempts on successful auth
    this.security.suspiciousAttempts = Math.max(0, this.security.suspiciousAttempts - 1);
  }

  this.updatedAt = new Date();
  await this.save();

  return this;
};

// Update biometric profile with new statistics
keystrokeBiometricsSchema.methods.updateProfile = async function(profileData) {
  this.profile = {
    ...this.profile,
    ...profileData,
    lastUpdated: new Date(),
    samplesUsed: this.samples.length
  };

  this.updatedAt = new Date();
  await this.save();

  return this;
};

// Check if user is enrolled and ready for authentication
keystrokeBiometricsSchema.methods.isEnrolled = function() {
  return this.enrollmentStatus === 'completed' &&
         this.consent.given &&
         !this.optOut &&
         !this.security.locked;
};

// Check if account is temporarily locked
keystrokeBiometricsSchema.methods.isLocked = function() {
  if (!this.security.locked) return false;

  // Check if lock has expired
  if (this.security.lockedUntil && new Date() > this.security.lockedUntil) {
    this.security.locked = false;
    this.security.lockedUntil = null;
    this.save();
    return false;
  }

  return true;
};

// Get safe object (remove sensitive data)
keystrokeBiometricsSchema.methods.toSafeObject = function() {
  return {
    userId: this.userId,
    enrollmentStatus: this.enrollmentStatus,
    enrollmentProgress: this.enrollmentProgress,
    consent: this.consent,
    profile: {
      dwellTime: this.profile.dwellTime,
      flightTime: this.profile.flightTime,
      rhythm: this.profile.rhythm,
      wpm: this.profile.wpm,
      accuracy: this.profile.accuracy,
      lastUpdated: this.profile.lastUpdated,
      samplesUsed: this.profile.samplesUsed
    },
    createdAt: this.createdAt,
    isEnrolled: this.isEnrolled()
  };
};

// Static Methods

// Get or create biometric record for user
keystrokeBiometricsSchema.statics.getOrCreate = async function(userId) {
  let biometric = await this.findOne({ userId });

  if (!biometric) {
    biometric = await this.create({
      userId,
      enrollmentStatus: 'not_started',
      samples: [],
      profile: {},
      authenticationHistory: []
    });
  }

  return biometric;
};

// Get enrollment statistics (for admin dashboard)
keystrokeBiometricsSchema.statics.getEnrollmentStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$enrollmentStatus',
        count: { $sum: 1 }
      }
    }
  ]);

  const consentStats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalConsented: {
          $sum: { $cond: ['$consent.given', 1, 0] }
        },
        totalResearchConsent: {
          $sum: { $cond: ['$consent.researchConsent', 1, 0] }
        },
        totalOptOut: {
          $sum: { $cond: ['$optOut', 1, 0] }
        }
      }
    }
  ]);

  return {
    enrollmentByStatus: stats,
    consent: consentStats[0] || {}
  };
};

// Pre-save middleware
keystrokeBiometricsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const KeystrokeBiometrics = mongoose.model('KeystrokeBiometrics', keystrokeBiometricsSchema);

module.exports = KeystrokeBiometrics;
