const mongoose = require('mongoose');

/**
 * Standalone storage for the DEEP keystroke-biometric slice (the CREST research
 * model served by the Python inference service). Deliberately separate from the
 * legacy v2 biometric stack (User.keystrokeProfile / verificationPipeline) so
 * the two systems never entangle — this one lives entirely in the learned 128-D
 * embedding space and is versioned with the model that produced it.
 *
 * One document per user. Holds:
 *  - consent: explicit opt-in before any capture (design spec §6.5 / CREST 4.2).
 *  - profile: the verify-ready Profile (centroid, covInverse, refs, threshold)
 *    that POST /verify consumes; versioned with `modelVersion`.
 *  - decisions: a capped audit log of verification outcomes (spec §6.4) — used
 *    for tuning and as CREST evidence; stores scores/versions, never raw timings.
 */
const decisionSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  source: { type: String, enum: ['login', 'guard', 'self-test'], default: 'login' },
  score: Number,
  confidence: Number,
  riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'INDETERMINATE'] },
  modelVersion: String,
}, { _id: false });

const mlKeystrokeProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  consentGiven: { type: Boolean, default: false },
  consentAt: { type: Date, default: null },

  // The verify-ready profile (null until enrollment completes).
  profile: {
    centroid: { type: [Number], default: undefined },
    covInverse: { type: [[Number]], default: undefined },
    refs: { type: [[Number]], default: undefined },
    threshold: { type: Number, default: undefined },
  },
  modelVersion: { type: String, default: null }, // version that built `profile`
  enrolledWindows: { type: Number, default: 0 },
  enrolledAt: { type: Date, default: null },

  decisions: { type: [decisionSchema], default: [] },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

mlKeystrokeProfileSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  // Cap the audit log so it can't grow unbounded (keep the most recent 100).
  if (this.decisions && this.decisions.length > 100) {
    this.decisions = this.decisions.slice(-100);
  }
  next();
});

mlKeystrokeProfileSchema.methods.isEnrolled = function () {
  return !!(this.profile && Array.isArray(this.profile.centroid)
    && this.profile.centroid.length > 0);
};

module.exports = mongoose.model('MlKeystrokeProfile', mlKeystrokeProfileSchema);
