require("dotenv").config();
const express = require("express");
const compression = require("compression");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const { doubleCsrf } = require("csrf-csrf");
const path = require("path");

// Sentry - MUST be initialized before anything else
const { initSentry, sentryRequestHandler, sentryErrorHandler, sentryUserMiddleware } = require("./services/sentry");

// Middleware Auth
const adminAuth = require("./middleware/adminAuth");

// Firebase (for FCM push notifications)
const { initializeFirebase } = require("./config/firebase");
initializeFirebase();

// Cron jobs (scheduled cleanup tasks)
const { initCronJobs } = require("./services/cronJobs");

// Rate Limiting
const { generalLimiter, writeLimiter, authLimiter, passwordResetLimiter, verifyResetCodeLimiter, adminLimiter } = require("./middleware/rateLimiter");

// Database pool (for sitemap + tier middleware)
const pool = require("./db");

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
const billingRouter = require("./routes/billing");
const reviewsRoutes = require("./routes/reviews");
const pushTokensRouter = require("./routes/push-tokens");
const offerRequestsRouter = require("./routes/offer-requests");
const webRouter = require("./routes/web");
const reportsRouter = require("./routes/reports");
const businessRequestsRouter = require("./routes/businessRequests");
const savedSearchesRouter = require("./routes/saved-searches");
const collectionsRouter = require("./routes/collections");

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === "production";

// Make pool available to middleware via app.get('pool')
app.set('pool', pool);

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
// GZIP COMPRESSION (before static files & routes)
// ============================================
app.use(compression());

// ============================================
// CSP NONCE (generated per request, used by Helmet + EJS templates)
// ============================================
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// ============================================
// SECURITY HEADERS (Helmet) — nonce-based CSP
// ============================================
app.use((req, res, next) => {
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", `'nonce-${res.locals.cspNonce}'`, "https://accounts.google.com", "https://cdn.jsdelivr.net"],
        scriptSrcAttr: ["'unsafe-inline'"], // Phase 2: will remove after migrating 54+ inline handlers
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "https://accounts.google.com"],
        frameSrc: ["https://accounts.google.com"],
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }, // Required for Google Identity Services popup to postMessage back
    crossOriginEmbedderPolicy: false, // Allow loading external images (Cloudinary, DiceBear, etc.)
    crossOriginResourcePolicy: false, // Allow browsers to load images from external domains (Cloudinary, Picsum, DiceBear)
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })(req, res, next);
});

// Additional security headers not covered by Helmet
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  next();
});

// Prevent caching of authenticated API responses
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ============================================
// RATE LIMITING (Global)
// ============================================
app.use(generalLimiter);
app.use(writeLimiter);

// ============================================
// MIDDLEWARE-URI GLOBALE
// ============================================
app.use((req, res, next) => {
  // Stripe webhook needs raw body for signature verification
  if (req.originalUrl === '/billing/webhook') return next();
  express.json({ limit: "10mb" })(req, res, next);
});
app.use((req, res, next) => {
  if (req.originalUrl === '/billing/webhook') return next();
  express.urlencoded({ extended: true, limit: "10mb" })(req, res, next);
});
app.use(cookieParser());

// Anonymous CSRF session cookie — per-session nonce for unauthenticated users
app.use((req, res, next) => {
  if (!req.cookies?.ofai_token && !req.cookies?._csrf_session) {
    res.cookie('_csrf_session', crypto.randomUUID(), {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24h
    });
  }
  next();
});

// ============================================
// CSRF PROTECTION (Web routes only)
// ============================================
if (!process.env.CSRF_SECRET) {
  console.warn('[SECURITY] CSRF_SECRET not set — falling back to JWT_SECRET. Set a unique CSRF_SECRET in production.');
}

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  getSessionIdentifier: (req) => {
    // Prefer auth cookie; for anonymous users, use per-session nonce cookie
    // NOTE: req.ip is unreliable behind Railway's reverse proxy (can change
    // between GET and POST), causing CSRF validation failures on register/login.
    return req.cookies?.ofai_token || req.cookies?._csrf_session || "anonymous";
  },
  cookieName: "__csrf",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
  getCsrfTokenFromRequest: (req) => {
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
  // Skip for mobile API routes using Bearer token auth (already protected by token)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }
  // Skip for mobile auth endpoints that don't use cookies (not CSRF-vulnerable)
  // Mobile app sends X-Client: mobile but has no Bearer token on auth routes
  if (req.headers['x-client'] === 'mobile' && req.method === 'POST' &&
      ['/auth/login', '/auth/register', '/auth/google', '/auth/refresh',
       '/auth/forgot-password', '/auth/verify-reset-code', '/auth/reset-password'].includes(req.path)) {
    return next();
  }
  // Skip for Stripe webhook (signed by Stripe, not a browser request)
  if (req.path === '/billing/webhook' && req.method === 'POST') {
    return next();
  }
  // Skip for Google OAuth (protected by Google ID token verification, stronger than CSRF)
  if (req.path === '/auth/google' && req.method === 'POST') {
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
// SEO: robots.txt + sitemap.xml
// ============================================
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /cont
Disallow: /colectia-mea
Disallow: /setari
Disallow: /preferinte
Disallow: /my-businesses
Disallow: /portal
Disallow: /onboarding
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify-code
Disallow: /api/

Sitemap: https://ofai.ro/sitemap.xml`);
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const BASE = 'https://ofai.ro';
    const today = new Date().toISOString().split('T')[0];

    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/oferte', priority: '0.9', changefreq: 'daily' },
      { loc: '/business-uri', priority: '0.8', changefreq: 'daily' },
      { loc: '/categorii', priority: '0.7', changefreq: 'weekly' },
      { loc: '/orase', priority: '0.7', changefreq: 'weekly' },
      { loc: '/preturi', priority: '0.6', changefreq: 'monthly' },
      { loc: '/pentru-business', priority: '0.6', changefreq: 'monthly' },
      { loc: '/ajutor', priority: '0.4', changefreq: 'monthly' },
      { loc: '/termeni', priority: '0.3', changefreq: 'yearly' },
      { loc: '/confidentialitate', priority: '0.3', changefreq: 'yearly' },
    ];

    const [offers, businesses] = await Promise.all([
      pool.query(
        "SELECT id, COALESCE(start_date, created_at)::date as lastmod FROM offers WHERE is_active = true AND moderation_status IN ('approved', 'auto_approved') AND (end_date IS NULL OR end_date >= CURRENT_DATE) ORDER BY id DESC LIMIT 5000"
      ),
      pool.query(
        "SELECT id, created_at::date as lastmod FROM businesses ORDER BY id DESC LIMIT 5000"
      ),
    ]);

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

    for (const page of staticPages) {
      xml += `\n  <url>\n    <loc>${BASE}${page.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`;
    }
    for (const row of offers.rows) {
      xml += `\n  <url>\n    <loc>${BASE}/oferta/${row.id}</loc>\n    <lastmod>${row.lastmod || today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    }
    for (const row of businesses.rows) {
      xml += `\n  <url>\n    <loc>${BASE}/business/${row.id}</loc>\n    <lastmod>${row.lastmod || today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
    }

    xml += '\n</urlset>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    console.error('[SEO] Sitemap error:', err.message);
    res.status(500).send('Error generating sitemap');
  }
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
app.use("/reports", reportsRouter);
app.use("/saved-searches", savedSearchesRouter);
app.use("/collections", collectionsRouter);
app.use("/api/business-requests", businessRequestsRouter);

// Rute Admin (Securizat cu Basic Auth + Rate Limiting)
app.use("/admin", adminLimiter, adminAuth, adminRouter);

// Rute Billing (Stripe skeleton)
app.use("/billing", billingRouter);

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
    if (req.path.startsWith('/admin')) {
      return res.status(403).send(
        '<h1>Eroare CSRF</h1><p>Sesiunea a expirat sau tokenul CSRF lipsește.</p>' +
        `<a href="${req.path}">Reîncarcă pagina</a>`
      );
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
      req.path.startsWith('/push-tokens') || req.path.startsWith('/my-businesses') || req.path.startsWith('/billing') || req.path.startsWith('/reports') || req.path.startsWith('/saved-searches') || req.path.startsWith('/collections') || req.path.startsWith('/api')) {
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

  // Initialize scheduled cleanup jobs
  initCronJobs();
});
