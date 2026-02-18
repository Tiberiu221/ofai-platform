require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { doubleCsrf } = require("csrf-csrf");
const path = require("path");

// Sentry - MUST be initialized before anything else
const { initSentry, sentryRequestHandler, sentryErrorHandler, sentryUserMiddleware } = require("./services/sentry");

// Middleware Auth
const adminAuth = require("./middleware/adminAuth");

// Firebase (for FCM push notifications)
const { initializeFirebase } = require("./config/firebase");
initializeFirebase();

// Rate Limiting
const { generalLimiter, authLimiter, passwordResetLimiter, verifyResetCodeLimiter, adminLimiter } = require("./middleware/rateLimiter");

// Import Rute
const authRouter = require("./routes/auth");
const citiesRouter = require("./routes/cities");
const categoriesRouter = require("./routes/categories");
const offersRouter = require("./routes/offers");
const favoritesRouter = require("./routes/favorites");
const subscriptionsRouter = require("./routes/subscriptions");
const businessesRouter = require("./routes/businesses");
const usersRouter = require("./routes/users");
const adminRouter = require("./routes/admin");
const businessPortalRouter = require("./routes/business-portal");
const reviewsRoutes = require("./routes/reviews");
const pushTokensRouter = require("./routes/push-tokens");
const offerRequestsRouter = require("./routes/offer-requests");
const webRouter = require("./routes/web");

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === "production";

// Cache buster — changes on each server restart
app.locals.cacheBust = Date.now();

// Trust proxy — necesar pentru Railway/Cloudflare (corect req.secure, req.ip, cookies Secure)
if (isProduction) {
  app.set("trust proxy", 1);
}

// ============================================
// SENTRY INITIALIZATION (must be first!)
// ============================================
initSentry(app);

// Sentry request handler (must be first middleware)
app.use(sentryRequestHandler());

// ============================================
// CORS CONFIGURATION
// ============================================
const allowedOrigins = [
  // Production
  "https://ofai.ro",
  "https://www.ofai.ro",
  "https://api.ofai.ro",
  "https://ofai-eight.vercel.app",
  // Development
  "http://localhost:8081",
  "http://localhost:19006",
  "http://localhost:3000",
  "http://localhost:4000",
  // Expo development
  "http://192.168.0.30:8081",
  "http://192.168.0.30:19006",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permite requests fără origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Permite subdomeniile OFAI de pe Vercel și Railway
    if (origin.endsWith('.vercel.app') || origin.endsWith('.up.railway.app')) {
      return callback(null, true);
    }

    // Permite originile din lista explicită
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // În development, permite orice origine
    if (!isProduction) {
      return callback(null, true);
    }

    // În producție, BLOCHEAZĂ originile necunoscute
    console.warn(`[CORS] Blocked unknown origin: ${origin}`);
    callback(new Error("CORS policy: origin not allowed"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
};

app.use(cors(corsOptions));

// ============================================
// SECURITY HEADERS (Helmet)
// ============================================
app.use(helmet({
  contentSecurityPolicy: false, // EJS templates use inline scripts/styles
  crossOriginEmbedderPolicy: false, // Allow loading external images (Cloudinary, DiceBear, etc.)
  crossOriginResourcePolicy: false, // Allow browsers to load images from external domains (Cloudinary, Picsum, DiceBear)
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

// Additional security headers not covered by Helmet
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  next();
});

// ============================================
// RATE LIMITING (Global)
// ============================================
app.use(generalLimiter);

// ============================================
// MIDDLEWARE-URI GLOBALE
// ============================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ============================================
// CSRF PROTECTION (Web routes only)
// ============================================
const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.JWT_SECRET, // Reuse existing secret
  cookieName: "__csrf",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
  getTokenFromRequest: (req) => {
    // Check header first (AJAX), then body (forms)
    return req.headers["x-csrf-token"] || req.body?._csrf;
  },
});

// Make CSRF token available to all EJS templates (for GET requests only)
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.locals.csrfToken = generateCsrfToken(req, res);
  }
  next();
});

// Apply CSRF protection selectively (skip mobile API routes and anonymous endpoints)
function csrfMiddleware(req, res, next) {
  // Skip for mobile API routes (Bearer auth — already protected by token)
  if (req.path.startsWith('/auth/') || req.path.startsWith('/offers') ||
      req.path.startsWith('/businesses') || req.path.startsWith('/reviews') ||
      req.path.startsWith('/favorites') || req.path.startsWith('/subscriptions') ||
      req.path.startsWith('/users') || req.path.startsWith('/push-tokens') ||
      req.path.startsWith('/my-businesses') || req.path.startsWith('/cities') ||
      req.path.startsWith('/categories')) {
    return next();
  }
  // Skip for anonymous click tracking endpoint
  if (req.path === '/api/web/clicks' && req.method === 'POST') {
    return next();
  }
  // Skip for safe HTTP methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  // Apply CSRF protection for all other POST/PUT/DELETE requests
  return doubleCsrfProtection(req, res, next);
}

app.use(csrfMiddleware);

// Sentry user context (după ce avem acces la req.user)
app.use(sentryUserMiddleware);

// Configurare View Engine (EJS pentru Admin)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Configurare Folder Static (Uploads)
const uploadsPath = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath));

// Configurare Folder Static (Public — CSS, JS, Images)
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1d" }));

// Request logging (în development)
if (!isProduction) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// HEALTHCHECK & INFO
// ============================================
app.get("/api", (req, res) => {
  res.json({
    message: "API OFAI este activ!",
    version: "1.0.0",
    environment: isProduction ? "production" : "development"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================
// WEB PAGES (Public — Landing, Oferte, etc.)
// ============================================
app.use(webRouter);

// ============================================
// MONTARE RUTE
// ============================================
// Auth routes cu rate limiting specific
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth/forgot-password", passwordResetLimiter);
app.use("/auth/verify-reset-code", verifyResetCodeLimiter);
app.use("/auth/reset-password", verifyResetCodeLimiter);
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/favorites", favoritesRouter);
app.use("/subscriptions", subscriptionsRouter);
app.use("/cities", citiesRouter);
app.use("/categories", categoriesRouter);
app.use("/offers", offersRouter);
app.use("/businesses", businessesRouter);
app.use("/reviews", reviewsRoutes);
app.use("/push-tokens", pushTokensRouter);
app.use("/offer-requests", offerRequestsRouter);

// Rute Admin (Securizat cu Basic Auth + Rate Limiting)
app.use("/admin", adminLimiter, adminAuth, adminRouter);

// Rute Business Portal (pentru business owners)
app.use("/my-businesses", businessPortalRouter);

// ============================================
// ERROR HANDLING
// ============================================
// Sentry error handler (must be before other error handlers)
app.use(sentryErrorHandler());

// CSRF error handler
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('csrf')) {
    console.warn(`[CSRF] Invalid token for ${req.method} ${req.path} from ${req.ip}`);
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({ message: 'Token CSRF invalid. Reîncarcă pagina.' });
    }
    return res.status(403).render('public/404', {
      pageTitle: 'Eroare',
      activePage: null,
      webUser: req.webUser || null,
      error: 'Sesiunea a expirat. Reîncarcă pagina.'
    });
  }
  next(err);
});

app.use((err, req, res, next) => {
  console.error(`[Error] ${err.message}`);
  console.error(`[Error] Stack: ${err.stack}`);

  // Pentru rutele admin, afișăm eroarea (cu escape HTML)
  if (req.path.startsWith('/admin')) {
    const safeMsg = (err.message || "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    if (isProduction) {
      return res.status(err.status || 500).send(
        `<h1>Eroare Admin</h1><pre>${safeMsg}</pre><br><a href="/admin/dashboard">Înapoi</a>`
      );
    }
    const safeStack = (err.stack || "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    return res.status(err.status || 500).send(
      `<h1>Eroare Admin</h1><pre>${safeMsg}\n\n${safeStack}</pre><br><a href="/admin/dashboard">Înapoi</a>`
    );
  }

  res.status(err.status || 500).json({
    message: isProduction ? "Eroare internă server" : err.message,
    ...(isProduction ? {} : { stack: err.stack })
  });
});

// 404 Handler
app.use((req, res) => {
  // API endpoints return JSON
  if (req.path.startsWith('/auth') || req.path.startsWith('/users') || req.path.startsWith('/offers') ||
      req.path.startsWith('/businesses') || req.path.startsWith('/favorites') || req.path.startsWith('/subscriptions') ||
      req.path.startsWith('/reviews') || req.path.startsWith('/cities') || req.path.startsWith('/categories') ||
      req.path.startsWith('/push-tokens') || req.path.startsWith('/my-businesses') || req.path.startsWith('/api')) {
    return res.status(404).json({ message: "Endpoint negăsit" });
  }
  // Web pages render 404 EJS — try to pass webUser if cookie exists
  const { optionalWebAuth } = require("./middleware/webAuth");
  optionalWebAuth(req, res, () => {
    res.status(404).render("public/404", { activePage: null, webUser: req.webUser || null });
  });
});

// ============================================
// PORNIRE SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`\n🚀 Server OFAI pornit!`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${isProduction ? "PRODUCTION" : "DEVELOPMENT"}`);
  console.log(`   Uploads: ${uploadsPath}`);
  if (!isProduction) {
    console.log(`   Local: http://localhost:${PORT}`);
  }
  console.log("");
});
