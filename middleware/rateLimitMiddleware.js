const rateLimit = require('express-rate-limit');

/**
 * Rate Limiting Middleware
 * Protects against brute force, spam, and DDoS attacks
 */

// General API rate limiter (100 requests per 15 minutes per IP)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for health check endpoint
  skip: (req) => req.path === '/health'
});

// Strict rate limiter for authentication endpoints (5 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many login/registration attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Only count failed authentication attempts
  skipSuccessfulRequests: true
});

// Game save rate limiter (10 games per minute)
const gameSaveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 game saves per minute
  message: {
    success: false,
    message: 'Too many game saves. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Friend request rate limiter (10 requests per hour)
const friendRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 friend requests per hour
  message: {
    success: false,
    message: 'Too many friend requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Password reset rate limiter (3 requests per hour)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again in 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Username check rate limiter (20 checks per minute)
const usernameCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 username checks per minute
  message: {
    success: false,
    message: 'Too many username checks. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  generalLimiter,
  authLimiter,
  gameSaveLimiter,
  friendRequestLimiter,
  passwordResetLimiter,
  usernameCheckLimiter
};
