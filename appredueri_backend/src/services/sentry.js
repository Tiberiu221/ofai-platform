const Sentry = require("@sentry/node");

// ============================================
// SENTRY ERROR TRACKING
// ============================================

const isProduction = process.env.NODE_ENV === "production";
let sentryInitialized = false;

/**
 * Inițializează Sentry pentru error tracking
 * Trebuie apelat ÎNAINTE de orice alt cod
 */
function initSentry(app) {
  // Skip dacă nu avem DSN configurat
  if (!process.env.SENTRY_DSN) {
    console.log("[Sentry] Skipping initialization (no DSN configured)");
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: isProduction ? "production" : "development",
    
    // Performance Monitoring
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    
    // Ignoră anumite erori comune
    ignoreErrors: [
      "ECONNRESET",
      "ETIMEDOUT",
      "ECONNREFUSED",
      "jwt expired",
      "invalid token",
      "jwt malformed",
    ],
  });

  sentryInitialized = true;
  console.log("[Sentry] Initialized successfully");
}

/**
 * Middleware pentru a seta contextul utilizatorului în Sentry
 */
function sentryUserMiddleware(req, res, next) {
  if (sentryInitialized && req.user) {
    // GDPR: Trimitem doar ID-ul, fără PII (email, nume)
    Sentry.setUser({
      id: req.user.id,
    });
  }
  next();
}

/**
 * Error handler pentru Sentry
 * Capturează erorile și le trimite la Sentry
 */
function sentryErrorHandler() {
  return (err, req, res, next) => {
    if (sentryInitialized && (!err.status || err.status >= 500)) {
      Sentry.captureException(err);
    }
    next(err);
  };
}

/**
 * Request handler pentru Sentry
 * No-op în versiunea nouă - Sentry captează automat
 */
function sentryRequestHandler() {
  return (req, res, next) => next();
}

/**
 * Capturează o eroare manual
 */
function captureException(error, context = {}) {
  if (!sentryInitialized) {
    console.error("[Sentry] Would capture:", error.message);
    return;
  }
  
  Sentry.withScope((scope) => {
    if (context.user) {
      scope.setUser(context.user);
    }
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * Capturează un mesaj manual
 */
function captureMessage(message, level = "info") {
  if (!sentryInitialized) {
    console.log(`[Sentry] Would capture message (${level}):`, message);
    return;
  }
  
  Sentry.captureMessage(message, level);
}

module.exports = {
  initSentry,
  sentryUserMiddleware,
  sentryErrorHandler,
  sentryRequestHandler,
  captureException,
  captureMessage,
  Sentry,
};
