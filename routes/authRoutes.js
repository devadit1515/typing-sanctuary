const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

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

module.exports = router;
