const validator = require('validator');

/**
 * Validation Middleware
 * Input sanitization and validation for API requests
 */

/**
 * Sanitize and trim string inputs
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return validator.trim(str);
};

/**
 * Validate registration input
 */
exports.validateRegistration = (req, res, next) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Sanitize inputs
    if (username) req.body.username = sanitizeString(username);
    if (email) req.body.email = sanitizeString(email);

    // Validate required fields
    if (!req.body.username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Validate username
    if (req.body.username.length < 3 || req.body.username.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Username must be between 3 and 20 characters'
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(req.body.username)) {
      return res.status(400).json({
        success: false,
        message: 'Username can only contain letters, numbers, and underscores'
      });
    }

    // Validate email if provided
    if (req.body.email && !validator.isEmail(req.body.email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid input data'
    });
  }
};

/**
 * Validate login input
 */
exports.validateLogin = (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Sanitize username
    if (username) req.body.username = sanitizeString(username);

    // Validate required fields
    if (!req.body.username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid input data'
    });
  }
};

/**
 * Validate profile update input
 */
exports.validateProfileUpdate = (req, res, next) => {
  try {
    const { displayName, bio, email } = req.body;

    // Sanitize inputs
    if (displayName) req.body.displayName = sanitizeString(displayName);
    if (bio) req.body.bio = sanitizeString(bio);
    if (email) req.body.email = sanitizeString(email);

    // Validate displayName
    if (req.body.displayName && req.body.displayName.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Display name cannot exceed 30 characters'
      });
    }

    // Validate bio
    if (req.body.bio && req.body.bio.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Bio cannot exceed 200 characters'
      });
    }

    // Validate email if provided
    if (req.body.email && !validator.isEmail(req.body.email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid input data'
    });
  }
};

/**
 * Validate username format for checking availability
 */
exports.validateUsername = (req, res, next) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    const sanitized = sanitizeString(username);

    if (sanitized.length < 3 || sanitized.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Username must be between 3 and 20 characters'
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(sanitized)) {
      return res.status(400).json({
        success: false,
        message: 'Username can only contain letters, numbers, and underscores'
      });
    }

    req.params.username = sanitized;
    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid username format'
    });
  }
};

/**
 * Rate limiting helper (for future use)
 * Can be combined with express-rate-limit package
 */
exports.preventBruteForce = (req, res, next) => {
  // This is a placeholder for future rate limiting implementation
  // For now, just pass through
  next();
};
