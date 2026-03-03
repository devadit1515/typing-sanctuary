const User = require('../models/User');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const jwtSecret = () => process.env.SESSION_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRY = '7d';

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), username: user.username },
    jwtSecret(),
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Extract and verify JWT from the Authorization header.
 * Returns the userId string, or null if missing / invalid.
 */
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
 * Register a new user
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ success: false, message: 'Username, email, and password are required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ success: false, message: 'Username must be between 3 and 20 characters' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ success: false, message: 'Username can only contain letters, numbers, and underscores' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Username already taken' });
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const user = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash: password
    });
    await user.save();

    const token = signToken(user);

    // Also set session for backward compat
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.save(() => {});

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: user.toSafeObject()
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    user.lastLogin = Date.now();
    await user.save();

    const token = signToken(user);

    // Also set session for backward compat
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.save(() => {});

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: user.toSafeObject()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    req.session.destroy(() => {});
    res.clearCookie('connect.sid');
    res.status(200).json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Server error during logout' });
  }
};

/**
 * Get current user — accepts JWT (Authorization header) or session
 * GET /api/auth/me
 */
exports.getCurrentUser = async (req, res) => {
  try {
    // JWT first (primary), then session fallback
    const userId = getUserIdFromToken(req) || req.session.userId || (req.user && req.user._id);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, user: user.toSafeObject() });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Check if username is available
 * GET /api/auth/check-username/:username
 */
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username || username.length < 3) {
      return res.status(400).json({ success: false, available: false, message: 'Username must be at least 3 characters' });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase() });
    res.status(200).json({ success: true, available: !existingUser });

  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Set username (for new Google OAuth users)
 * POST /api/auth/set-username
 */
exports.setUsername = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ success: false, message: 'Username must be between 3 and 20 characters' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ success: false, message: 'Username can only contain letters, numbers, and underscores' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if taken by another user
    const existing = await User.findOne({ username: username.toLowerCase(), _id: { $ne: user._id } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Username already taken' });
    }

    user.username = username.toLowerCase();
    user.usernameSet = true;
    if (!user.profile) user.profile = {};
    if (!user.profile.displayName || user.profile.displayName === user.username) {
      user.profile.displayName = username.toLowerCase();
    }
    await user.save();

    // Issue a fresh JWT with the new username embedded
    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: 'Username set successfully',
      token,
      user: user.toSafeObject()
    });

  } catch (error) {
    console.error('Set username error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Export for use in authRoutes (Google OAuth callback)
exports.signToken = signToken;
