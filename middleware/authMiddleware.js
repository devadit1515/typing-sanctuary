const jwt = require('jsonwebtoken');

const jwtSecret = () => process.env.SESSION_SECRET || 'your-secret-key-change-this';

function getUserIdFromToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), jwtSecret());
    return decoded.userId;
  } catch (_) {
    return null;
  }
}

/**
 * Check if user is authenticated.
 * Accepts JWT (Authorization: Bearer <token>) or session userId.
 */
exports.requireAuth = (req, res, next) => {
  const userId = getUserIdFromToken(req) || (req.session && req.session.userId) || (req.user && req.user._id);
  if (userId) {
    req.userId = userId; // Attach for use in route handlers
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Authentication required. Please log in.'
  });
};

exports.requireGuest = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.status(403).json({ success: false, message: 'You are already logged in' });
  }
  next();
};

exports.optionalAuth = (req, res, next) => {
  next();
};
