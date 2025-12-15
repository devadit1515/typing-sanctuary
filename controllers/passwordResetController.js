const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const { sendPasswordResetOTP, sendPasswordResetConfirmation } = require('../config/email');

/**
 * Request Password Reset - Send OTP to email
 * POST /api/password-reset/request
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if email exists or not (security)
      return res.json({
        message: 'If an account with this email exists, an OTP has been sent.'
      });
    }

    // Check if user has email
    if (!user.email) {
      return res.status(400).json({ message: 'This account has no email address registered' });
    }

    // Create password reset request with OTP
    const resetRequest = await PasswordReset.createReset(user._id, user.email);

    // Send OTP via email
    try {
      await sendPasswordResetOTP(user.email, resetRequest.otp, user.username);

      res.json({
        message: 'OTP has been sent to your email address',
        email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') // Partially hide email
      });
    } catch (emailError) {
      // Delete the reset request if email fails
      await PasswordReset.deleteOne({ _id: resetRequest._id });

      console.error('Email sending failed:', emailError);
      res.status(500).json({ message: 'Failed to send email. Please check email configuration.' });
    }

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Verify OTP
 * POST /api/password-reset/verify-otp
 */
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Verify OTP
    const resetRequest = await PasswordReset.verifyOTP(email, otp);

    if (!resetRequest) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    res.json({
      message: 'OTP verified successfully',
      verified: true
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Reset Password (after OTP verification)
 * POST /api/password-reset/reset
 */
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }

    // Validate password length
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if OTP is verified
    const isVerified = await PasswordReset.isVerified(email, otp);

    if (!isVerified) {
      return res.status(400).json({ message: 'OTP not verified or expired. Please request a new OTP.' });
    }

    // Find user and update password
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();

    // Delete all password reset requests for this user
    await PasswordReset.deleteByEmail(email);

    // Send confirmation email
    try {
      await sendPasswordResetConfirmation(user.email, user.username);
    } catch (emailError) {
      console.error('Confirmation email failed:', emailError);
      // Don't fail the request if confirmation email fails
    }

    res.json({ message: 'Password reset successful. You can now login with your new password.' });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Resend OTP
 * POST /api/password-reset/resend-otp
 */
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.json({
        message: 'If an account with this email exists, a new OTP has been sent.'
      });
    }

    // Create new password reset request
    const resetRequest = await PasswordReset.createReset(user._id, user.email);

    // Send new OTP
    try {
      await sendPasswordResetOTP(user.email, resetRequest.otp, user.username);

      res.json({
        message: 'A new OTP has been sent to your email address'
      });
    } catch (emailError) {
      await PasswordReset.deleteOne({ _id: resetRequest._id });

      console.error('Email sending failed:', emailError);
      res.status(500).json({ message: 'Failed to send email' });
    }

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  requestPasswordReset,
  verifyOTP,
  resetPassword,
  resendOTP
};
