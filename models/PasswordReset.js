const mongoose = require('mongoose');

/**
 * Password Reset Schema
 * Stores OTP codes for password reset requests
 * OTPs expire after 10 minutes
 */
const passwordResetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  otp: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Document will be automatically deleted after 10 minutes (600 seconds)
  },
  verified: {
    type: Boolean,
    default: false
  }
});

// Index for faster queries
passwordResetSchema.index({ userId: 1, createdAt: -1 });
passwordResetSchema.index({ email: 1, createdAt: -1 });

/**
 * Generate a random 6-digit OTP
 * @returns {string} 6-digit OTP
 */
passwordResetSchema.statics.generateOTP = function() {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create a new password reset request
 * @param {ObjectId} userId - User ID
 * @param {string} email - User email
 * @returns {Object} Password reset document with OTP
 */
passwordResetSchema.statics.createReset = async function(userId, email) {
  // Delete any existing reset requests for this user
  await this.deleteMany({ userId });

  // Generate new OTP
  const otp = this.generateOTP();

  // Create new reset request
  const resetRequest = await this.create({
    userId,
    email,
    otp
  });

  return resetRequest;
};

/**
 * Verify OTP code
 * @param {string} email - User email
 * @param {string} otp - OTP code to verify
 * @returns {Object|null} Reset request if valid, null otherwise
 */
passwordResetSchema.statics.verifyOTP = async function(email, otp) {
  const resetRequest = await this.findOne({
    email: email.toLowerCase(),
    otp,
    verified: false
  }).sort({ createdAt: -1 });

  if (!resetRequest) {
    return null;
  }

  // Check if OTP is expired (older than 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  if (resetRequest.createdAt < tenMinutesAgo) {
    // Delete expired OTP
    await this.deleteOne({ _id: resetRequest._id });
    return null;
  }

  // Mark as verified
  resetRequest.verified = true;
  await resetRequest.save();

  return resetRequest;
};

/**
 * Check if OTP is verified and still valid
 * @param {string} email - User email
 * @param {string} otp - OTP code
 * @returns {boolean} True if verified and valid
 */
passwordResetSchema.statics.isVerified = async function(email, otp) {
  const resetRequest = await this.findOne({
    email: email.toLowerCase(),
    otp,
    verified: true
  }).sort({ createdAt: -1 });

  if (!resetRequest) {
    return false;
  }

  // Check if still within 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  if (resetRequest.createdAt < tenMinutesAgo) {
    await this.deleteOne({ _id: resetRequest._id });
    return false;
  }

  return true;
};

/**
 * Delete reset request after successful password reset
 * @param {string} email - User email
 */
passwordResetSchema.statics.deleteByEmail = async function(email) {
  await this.deleteMany({ email: email.toLowerCase() });
};

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
