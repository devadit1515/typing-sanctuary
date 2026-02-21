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
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (req, res) => {
    // Set session variables in same format as username/password login
    req.session.userId = req.user._id.toString();
    req.session.username = req.user.username;
    req.session.lastLogin = new Date();
    res.redirect('/');
  }
);

module.exports = router;
