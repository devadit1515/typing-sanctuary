const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport');
const { requireAuth } = require('../middleware/authMiddleware');

/**
 * Authentication Routes
 * Base path: /api/auth
 */

// Register new user
router.post('/register', authController.register);

// Login user
router.post('/login', authController.login);

// Logout user
router.post('/logout', authController.logout);

// Get current logged-in user
router.get('/me', authController.getCurrentUser);

// Check if username is available
router.get('/check-username/:username', authController.checkUsername);

// Set username (for new Google OAuth users who got an auto-generated one)
router.post('/set-username', requireAuth, authController.setUsername);

// Google OAuth — initiate login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth — callback after Google consent screen
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user) => {
    if (err) {
      console.error('Google OAuth error:', err);
      return res.redirect('/login.html?error=oauth_error');
    }
    if (!user) {
      return res.redirect('/login.html?error=auth_failed');
    }

    // Sign a JWT — client will store it in localStorage
    const token = authController.signToken(user);

    // Also set session for backward compat
    if (!req.session.passport) req.session.passport = {};
    req.session.passport.user = user._id.toString();
    req.session.userId = user._id.toString();
    req.session.username = user.username;
    req.user = user;
    req.session.save(() => {});

    // New Google OAuth users must choose their username before playing
    if (user.isNewUser) {
      return res.redirect('/choose-username.html?token=' + encodeURIComponent(token));
    }

    // Pass token to client via URL — session-check.js picks it up and stores in localStorage
    res.redirect('/?token=' + encodeURIComponent(token));
  })(req, res, next);
});

module.exports = router;
