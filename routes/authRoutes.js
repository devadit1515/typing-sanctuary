const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport');

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

// Google OAuth — initiate login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth — callback after Google consent screen
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      console.error('Google OAuth error:', err);
      return res.redirect('/login.html?error=oauth_error');
    }
    if (!user) {
      return res.redirect('/login.html?error=auth_failed');
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('Google OAuth logIn error:', loginErr);
        return res.redirect('/login.html?error=login_failed');
      }
      req.session.userId = user._id.toString();
      req.session.username = user.username;
      req.session.lastLogin = new Date();
      req.session.save((saveErr) => {
        if (saveErr) console.error('Session save error after Google OAuth:', saveErr);
        res.redirect('/');
      });
    });
  })(req, res, next);
});

module.exports = router;
