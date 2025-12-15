const express = require('express');
const router = express.Router();
const {
  requestPasswordReset,
  verifyOTP,
  resetPassword,
  resendOTP
} = require('../controllers/passwordResetController');

/**
 * Password Reset Routes
 * Base path: /api/password-reset
 */

// Request password reset (send OTP to email)
router.post('/request', requestPasswordReset);

// Verify OTP code
router.post('/verify-otp', verifyOTP);

// Reset password (after OTP verification)
router.post('/reset', resetPassword);

// Resend OTP
router.post('/resend-otp', resendOTP);

module.exports = router;
