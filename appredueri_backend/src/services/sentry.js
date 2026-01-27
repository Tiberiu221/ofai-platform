const Sentry = require("@sentry/node");

// ============================================
// SENTRY ERROR TRACKING
// ============================================

const isProduction = process.env.NODE_ENV === "production";

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
    tracesSampleRate: isProduction ? 0.1 : 1.0, // 10% în producție, 100% în dev
    
    // Profiling (opțional, pentru performance insights)
    profilesSampleRate: isProduction ? 0.1 : 1.0,
    
    // Filtrează informații sensibile
    beforeSend(event) {
      // Nu trimite în development dacă nu e necesar
      if (!isProduction && !process.env.SENTRY_DEBUG) {
        return null;
      }
      
      // Elimină date sensibile din request
      if (event.request) {
        // Elimină headers sensibile
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        
        // Elimină body-uri cu parole
        if (event.request.data) {
          const data = typeof event.request.data === 'string' 
            ? JSON.parse(event.request.data) 
            : event.request.data;
          
          if (data.password) data.password = "[REDACTED]";
          if (data.currentPassword) data.currentPassword = "[REDACTED]";
          if (data.newPassword) data.newPassword = "[REDACTED]";
          
          event.request.data = JSON.stringify(data);
        }
      }
      
      return event;
    },
    
    // Ignoră anumite erori comune
    ignoreErrors: [
      // Erori de rețea normale
      "ECONNRESET",
      "ETIMEDOUT",
      "ECONNREFUSED",
      // Erori de autentificare (nu sunt erori reale)
      "jwt expired",
      "invalid token",
      "jwt malformed",
    ],
  });

  console.log("[Sentry] Initialized successfully");
}

/**
 * Middleware pentru a seta contextul utilizatorului în Sentry
 */
function sentryUserMiddleware(req, res, next) {
  if (process.env.SENTRY_DSN && req.user) {
    Sentry.setUser({
      id: req.user.id,
      email: req.user.email,
    });
  }
  next();
}

/**
 * Error handler pentru Sentry
 * Trebuie adăugat DUPĂ toate rutele
 */
function sentryErrorHandler() {
  // Returnează no-op middleware dacă Sentry nu e configurat
  if (!process.env.SENTRY_DSN) {
    return (err, req, res, next) => next(err);
  }
  
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capturează doar erori 500+
      if (error.status && error.status < 500) {
        return false;
      }
      return true;
    },
  });
}

/**
 * Request handler pentru Sentry
 * Trebuie adăugat ÎNAINTEA tuturor rutelor
 */
function sentryRequestHandler() {
  // Returnează no-op middleware dacă Sentry nu e configurat
  if (!process.env.SENTRY_DSN) {
    return (req, res, next) => next();
  }
  
  return Sentry.Handlers.requestHandler({
    // Include informații despre request
    request: ["headers", "method", "url", "query_string"],
    // Nu include body-ul (poate conține date sensibile)
    include: {
      data: false,
      cookies: false,
      ip: true,
    },
  });
}

/**
 * Capturează o eroare manual
 */
function captureException(error, context = {}) {
  if (!process.env.SENTRY_DSN) {
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
  if (!process.env.SENTRY_DSN) {
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
