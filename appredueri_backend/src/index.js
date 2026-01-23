require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

// Middleware Auth
const adminAuth = require("./middleware/adminAuth");

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

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === "production";

// ============================================
// CORS CONFIGURATION
// ============================================
const allowedOrigins = [
  // Production
  "https://ofai.ro",
  "https://www.ofai.ro",
  "https://api.ofai.ro",
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
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (!isProduction) {
      // În development, permite orice origine dar loghează
      console.log(`[CORS] Allowing unlisted origin in dev: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// ============================================
// MIDDLEWARE-URI GLOBALE
// ============================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Configurare View Engine (EJS pentru Admin)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Configurare Folder Static (Uploads)
const uploadsPath = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath));

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
app.get("/", (req, res) => {
  res.json({ 
    message: "API AppReduceri este activ!",
    version: "1.0.0",
    environment: isProduction ? "production" : "development"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================
// MONTARE RUTE
// ============================================
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/favorites", favoritesRouter);
app.use("/subscriptions", subscriptionsRouter);
app.use("/cities", citiesRouter);
app.use("/categories", categoriesRouter);
app.use("/offers", offersRouter);
app.use("/businesses", businessesRouter);
app.use("/reviews", reviewsRoutes);

// Rute Admin (Securizat cu Basic Auth)
app.use("/admin", adminAuth, adminRouter);

// Rute Business Portal (pentru business owners)
app.use("/my-businesses", businessPortalRouter);

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error(`[Error] ${err.message}`);
  if (!isProduction) {
    console.error(err.stack);
  }
  
  res.status(err.status || 500).json({
    message: isProduction ? "Eroare internă server" : err.message,
    ...(isProduction ? {} : { stack: err.stack })
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint negăsit" });
});

// ============================================
// PORNIRE SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`\n🚀 Server AppReduceri pornit!`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${isProduction ? "PRODUCTION" : "DEVELOPMENT"}`);
  console.log(`   Uploads: ${uploadsPath}`);
  if (!isProduction) {
    console.log(`   Local: http://localhost:${PORT}`);
  }
  console.log("");
});
