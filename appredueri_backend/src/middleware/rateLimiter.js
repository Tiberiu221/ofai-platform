const rateLimit = require("express-rate-limit");

// ============================================
// RATE LIMITERS
// ============================================

/**
 * Rate limiter general pentru toate rutele API
 * 100 requests per minut per IP
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minut
  max: 100, // max 100 requests per windowMs
  message: {
    message: "Prea multe cereri. Te rugăm să aștepți un minut.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Disable validation warning for default keyGenerator
  validate: { xForwardedForHeader: false },
});

/**
 * Rate limiter strict pentru autentificare
 * Previne brute force attacks
 * 10 încercări pe 15 minute per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute
  max: 10, // max 10 încercări
  message: {
    message: "Prea multe încercări de autentificare. Te rugăm să aștepți 15 minute.",
    retryAfter: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

/**
 * Rate limiter pentru password reset
 * 3 cereri pe oră per email
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 oră
  max: 3, // max 3 cereri
  message: {
    message: "Prea multe cereri de resetare parolă. Te rugăm să aștepți o oră.",
    retryAfter: 3600,
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

/**
 * Rate limiter pentru verificare cod resetare parolă
 * Previne brute force pe codul de 6 cifre
 * 5 încercări pe 15 minute per IP
 */
const verifyResetCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute
  max: 5, // max 5 încercări
  message: {
    message: "Prea multe încercări de verificare cod. Te rugăm să aștepți 15 minute.",
    retryAfter: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

/**
 * Rate limiter pentru admin routes
 * 200 requests per minut per IP
 */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minut
  max: 200,
  message: {
    message: "Prea multe cereri admin. Te rugăm să aștepți.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

/**
 * Rate limiter pentru creare conținut (reviews, etc.)
 * 20 creări pe oră per utilizator
 */
const createContentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 oră
  max: 20, // max 20 creări
  message: {
    message: "Ai creat prea mult conținut recent. Te rugăm să aștepți.",
    retryAfter: 3600,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  verifyResetCodeLimiter,
  adminLimiter,
  createContentLimiter,
};
