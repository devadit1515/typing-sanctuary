/**
 * Authentication Middleware
 * Protects routes that require user authentication
 */

/**
 * Check if user is authenticated
 * Verifies that a valid session exists
 */
exports.requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.'
    });
  }

  next();
};

/**
 * Check if user is NOT authenticated
 * Useful for login/register pages
 */
exports.requireGuest = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.status(403).json({
      success: false,
      message: 'You are already logged in'
    });
  }

  next();
};

/**
 * Optional authentication
 * Allows both authenticated and guest users
 * Adds user info to request if authenticated
 */
exports.optionalAuth = (req, res, next) => {
  // Just pass through - user info is in session if it exists
  next();
};
