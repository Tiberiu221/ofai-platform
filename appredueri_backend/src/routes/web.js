/**
 * Web Routes — Pagini publice OFAI.ro
 * Landing page, Oferte, Categorii, Orașe, Auth, Cont, Colecție, etc.
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const pool = require("../db");
const { optionalWebAuth, requireWebAuth } = require("../middleware/webAuth");
const { signToken, generateRefreshToken } = require("../helpers/jwt");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("../services/email");
const { triggerWebhook } = require("../services/n8n");
const pushService = require("../services/pushNotifications");
const offerService = require("../services/offerService");
const { sanitizeString, createImageFilter, validatePassword } = require("../helpers/validate");
const crypto = require("crypto");
const { requireBusinessOwner } = require("../middleware/businessWebAuth");
const { attachTier, requireFeature, requireLimit } = require('../middleware/tierAuth');
const { countActiveOffers, countGalleryImages, countLocations, getBusinessTier } = require('../helpers/tiers');
const { clickLimiter, searchLimiter, revealLimiter, mapsParseLimiter } = require("../middleware/rateLimiter");
const { parseMapsLink } = require("../helpers/mapsParser");
const { deleteUserAccount } = require("../services/accountDeletion");
const multer = require("multer");
const { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } = require("../services/cloudinary");
const { OAuth2Client } = require("google-auth-library");

const portalUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: createImageFilter(), // Whitelist: JPEG, PNG, WebP, GIF
});

const SALT_ROUNDS = 10;
const REFRESH_TOKEN_DAYS = 30;

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Helper: create and store a refresh token in DB
 */
async function createWebRefreshToken(userId) {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, refreshToken, expiresAt]
  );
  return refreshToken;
}

/** Cookie options for web auth */
const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000, // 24h
  path: "/",
};
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000, // 30d
  path: "/",
};

// Apply optional auth to ALL web routes
router.use(optionalWebAuth);

// ═══════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════
router.get("/", async (req, res) => {
  try {
    const [bizCount, offerCount, cityCount, recentOffers] = await Promise.all([
      pool.query("SELECT COUNT(*) as total FROM businesses"),
      pool.query("SELECT COUNT(*) as total FROM offers WHERE is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)"),
      pool.query("SELECT COUNT(*) as total FROM cities"),
      pool.query("SELECT COUNT(*) as total FROM offers WHERE is_active = true AND start_date > CURRENT_DATE - INTERVAL '7 days'"),
    ]);

    const categories = await pool.query(`
      SELECT c.id, c.name, COUNT(DISTINCT o.id) as offer_count
      FROM categories c
      LEFT JOIN businesses b ON b.category_id = c.id
      LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
      GROUP BY c.id, c.name
      ORDER BY offer_count DESC
    `);

    // Load user preferences for personalization
    let userPrefs = { city_ids: [], category_ids: [] };
    if (req.webUser) {
      const prefsRes = await pool.query(
        "SELECT preferred_city_ids, preferred_category_ids FROM users WHERE id = $1",
        [req.webUser.id]
      );
      if (prefsRes.rows[0]) {
        userPrefs.city_ids = prefsRes.rows[0].preferred_city_ids || [];
        userPrefs.category_ids = prefsRes.rows[0].preferred_category_ids || [];
      }
    }

    // Deal of the Day (fetched early so we can exclude from featured)
    let dealOfDay = null;
    try {
      let dodResult = await pool.query(`
        SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
               b.name as business_name, b.logo_url as business_logo,
               COALESCE(b.cover_image_url, o.logo_url) as image_url,
               ci2.name as city_name,
               (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count
        FROM offers o
        JOIN businesses b ON o.business_id = b.id
        LEFT JOIN cities ci2 ON b.city_id = ci2.id
        WHERE o.is_active = TRUE AND o.is_deal_of_day = TRUE AND o.deal_of_day_date = CURRENT_DATE
          AND (o.end_date IS NULL OR o.end_date > CURRENT_DATE)
        LIMIT 1
      `);
      if (dodResult.rows.length === 0) {
        dodResult = await pool.query(`
          SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
                 b.name as business_name, b.logo_url as business_logo,
                 COALESCE(b.cover_image_url, o.logo_url) as image_url,
                 ci2.name as city_name,
                 (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count
          FROM offers o
          JOIN businesses b ON o.business_id = b.id
          LEFT JOIN cities ci2 ON b.city_id = ci2.id
          WHERE o.is_active = TRUE AND (o.end_date IS NULL OR o.end_date > CURRENT_DATE)
          ORDER BY (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) +
                   (SELECT COUNT(*) FROM business_clicks bc WHERE bc.offer_id = o.id) DESC
          LIMIT 1
        `);
      }
      if (dodResult.rows.length > 0) dealOfDay = dodResult.rows[0];
    } catch (e) { /* silently fail — deal of day is optional */ }

    // Build dynamic WHERE clause based on preferences
    const featuredWhere = ["o.is_active = true", "(o.end_date IS NULL OR o.end_date >= CURRENT_DATE)"];
    const featuredParams = [];
    let paramIdx = 1;

    if (userPrefs.city_ids && userPrefs.city_ids.length > 0) {
      featuredWhere.push(`(b.city_id = ANY($${paramIdx++}) OR b.category_id = (SELECT id FROM categories WHERE name = 'Magazine Online'))`);
      featuredParams.push(userPrefs.city_ids);
    }
    if (userPrefs.category_ids.length > 0) {
      featuredWhere.push(`b.category_id = ANY($${paramIdx++})`);
      featuredParams.push(userPrefs.category_ids);
    }

    // Exclude deal-of-day from featured offers to avoid duplicates
    if (dealOfDay) {
      featuredWhere.push(`o.id != $${paramIdx++}`);
      featuredParams.push(dealOfDay.id);
    }

    const featuredOffers = await pool.query(`
      SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
             b.name as business_name, b.logo_url as business_logo,
             b.cover_image_url as business_cover,
             b.lat as business_lat, b.lng as business_lng,
             ci.name as city_name, cat.name as category_name,
             COALESCE(b.cover_image_url, o.logo_url) as image_url,
             COALESCE(AVG(r.rating), 0) as rating_avg,
             COUNT(DISTINCT r.id) as rating_count,
             (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as favorite_count,
             (CASE WHEN (SELECT COUNT(*) FROM favorite_offers fo2 WHERE fo2.offer_id = o.id AND fo2.created_at > NOW() - INTERVAL '14 days') >= 5 THEN true ELSE false END) as is_trending
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities ci ON b.city_id = ci.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      LEFT JOIN reviews r ON r.business_id = b.id
      LEFT JOIN business_subscriptions bsub
        ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
      LEFT JOIN subscription_plans splan
        ON splan.id = bsub.plan_id
      WHERE ${featuredWhere.join(" AND ")}
      GROUP BY o.id, o.title, o.discount_type, o.discount_value, o.end_date,
               b.name, b.logo_url, b.cover_image_url, b.lat, b.lng,
               ci.name, cat.name, o.logo_url, splan.slug
      ORDER BY (RANDOM() * 0.4 + LEAST(o.discount_value, 100) / 100.0 * 0.3 + CASE WHEN o.end_date <= CURRENT_DATE + INTERVAL '3 days' THEN 0.3 ELSE 0.1 END + CASE WHEN splan.slug = 'premium' THEN 0.4 WHEN splan.slug = 'standard' THEN 0.1 ELSE 0 END) DESC
      LIMIT 6
    `, featuredParams);

    const cities = await pool.query(`
      SELECT c.id, c.name, COUNT(b.id) as business_count
      FROM cities c
      LEFT JOIN businesses b ON b.city_id = c.id
      GROUP BY c.id, c.name
      ORDER BY business_count DESC
      LIMIT 15
    `);

    const featuredBusinesses = await pool.query(`
      SELECT id, name, logo_url
      FROM businesses
      WHERE logo_url IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 20
    `);

    const topBusinesses = await pool.query(`
      SELECT b.id, b.name, b.logo_url, b.cover_image_url,
             b.lat, b.lng, b.is_verified, b.subscription_badge_type,
             ci.name as city_name, cat.name as category_name,
             COALESCE(AVG(r.rating), 0) as rating_avg,
             COUNT(DISTINCT r.id) as rating_count,
             COUNT(DISTINCT o.id) as offer_count,
             COALESCE(splan.has_promoted_placement, FALSE) as is_promoted
      FROM businesses b
      LEFT JOIN cities ci ON b.city_id = ci.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      LEFT JOIN reviews r ON r.business_id = b.id
      LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
      LEFT JOIN business_subscriptions bsub
        ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
      LEFT JOIN subscription_plans splan
        ON splan.id = bsub.plan_id
      GROUP BY b.id, b.name, b.logo_url, b.cover_image_url, b.lat, b.lng, b.is_verified, b.subscription_badge_type, ci.name, cat.name, splan.slug, splan.has_promoted_placement
      HAVING COUNT(DISTINCT o.id) > 0
      ORDER BY (COUNT(DISTINCT o.id) + RANDOM() * 2 + CASE WHEN splan.slug = 'premium' THEN 3 WHEN splan.slug = 'standard' THEN 1 ELSE 0 END) DESC, COALESCE(AVG(r.rating), 0) DESC
      LIMIT 8
    `);

    // Promoted offers (dedicated section for Premium businesses)
    let promotedOffers = [];
    try {
      const promotedParams = [];
      let promotedExclude = '';
      if (dealOfDay) {
        promotedParams.push(parseInt(dealOfDay.id));
        promotedExclude = `AND o.id != $1`;
      }
      const promotedResult = await pool.query(`
        SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
               b.name as business_name, b.logo_url as business_logo,
               b.cover_image_url as business_cover,
               b.lat as business_lat, b.lng as business_lng,
               ci.name as city_name, cat.name as category_name,
               COALESCE(b.cover_image_url, o.logo_url) as image_url,
               COALESCE(AVG(r.rating), 0) as rating_avg,
               COUNT(DISTINCT r.id) as rating_count,
               (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as favorite_count
        FROM offers o
        JOIN businesses b ON o.business_id = b.id
        JOIN business_subscriptions bsub
          ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
        JOIN subscription_plans splan
          ON splan.id = bsub.plan_id AND splan.has_promoted_placement = TRUE
        LEFT JOIN cities ci ON b.city_id = ci.id
        LEFT JOIN categories cat ON b.category_id = cat.id
        LEFT JOIN reviews r ON r.business_id = b.id
        WHERE o.is_active = TRUE AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
          ${promotedExclude}
        GROUP BY o.id, o.title, o.discount_type, o.discount_value, o.end_date,
                 b.name, b.logo_url, b.cover_image_url, b.lat, b.lng,
                 ci.name, cat.name, o.logo_url
        ORDER BY RANDOM()
        LIMIT 3
      `, promotedParams);
      promotedOffers = promotedResult.rows;
    } catch (e) { /* promoted section is non-critical */ }

    const stats = {
      totalBusinesses: parseInt(bizCount.rows[0].total),
      totalOffers: parseInt(offerCount.rows[0].total),
      totalCities: parseInt(cityCount.rows[0].total),
      newOffers: parseInt(recentOffers.rows[0].total) || Math.floor(parseInt(offerCount.rows[0].total) * 0.1),
    };

    // New offers from followed businesses (for logged-in users)
    let followedOffers = [];
    if (req.webUser) {
      const followedRes = await pool.query(`
        SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
               b.name as business_name, b.logo_url as business_logo,
               COALESCE(b.cover_image_url, o.logo_url) as image_url
        FROM offers o
        JOIN businesses b ON o.business_id = b.id
        JOIN followed_businesses fb ON fb.business_id = b.id AND fb.user_id = $1
        WHERE o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
          AND o.start_date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY o.id DESC
        LIMIT 6
      `, [req.webUser.id]);
      followedOffers = followedRes.rows;
    }

    // Get preferred city name for banner
    let preferredCityName = null;
    if (userPrefs.city_id) {
      const cityName = cities.rows.find(c => c.id === userPrefs.city_id);
      preferredCityName = cityName ? cityName.name : null;
    }

    // Fetch user favorite/follow IDs for card heart buttons
    let userFavoriteIds = [];
    let userFollowedIds = [];
    if (req.webUser) {
      const [favRes, followRes] = await Promise.all([
        pool.query("SELECT offer_id FROM favorite_offers WHERE user_id = $1", [req.webUser.id]),
        pool.query("SELECT business_id FROM followed_businesses WHERE user_id = $1", [req.webUser.id]),
      ]);
      userFavoriteIds = favRes.rows.map(r => r.offer_id);
      userFollowedIds = followRes.rows.map(r => r.business_id);
    }

    res.render("public/home", {
      stats,
      categories: categories.rows,
      featuredOffers: featuredOffers.rows,
      promotedOffers,
      dealOfDay,
      cities: cities.rows,
      featuredBusinesses: featuredBusinesses.rows,
      topBusinesses: topBusinesses.rows,
      followedOffers,
      preferredCityName,
      hasPreferences: !!(userPrefs.city_id || userPrefs.category_ids.length > 0),
      userFavoriteIds,
      userFollowedIds,
      activePage: "home",
      webUser: req.webUser,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "OFAI",
        "url": "https://ofai.ro",
        "logo": "https://ofai.ro/images/og-default.svg",
        "description": "Descoperă cele mai bune reduceri și oferte de la business-urile din orașul tău.",
        "contactPoint": {
          "@type": "ContactPoint",
          "contactType": "customer service",
          "url": "https://ofai.ro/ajutor"
        }
      },
    });
  } catch (err) {
    console.error("[Web] Home page error:", err.message);
    res.status(500).send("A apărut o eroare. Vă rugăm încercați din nou.");
  }
});

// ═══════════════════════════════════════════════════════
// OFFERS PAGE (with filtering, search, pagination)
// ═══════════════════════════════════════════════════════
router.get("/oferte", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 48;
    const offset = (page - 1) * limit;
    const query = req.query.q || "";
    const selectedCategory = req.query.category || null;
    const selectedCity = req.query.city || null;
    const sort = req.query.sort || "newest";

    const conditions = ["o.is_active = true", "o.end_date > CURRENT_DATE"];
    const params = [];
    let paramIdx = 1;

    if (query) {
      conditions.push(`(o.title ILIKE $${paramIdx} OR b.name ILIKE $${paramIdx})`);
      params.push(`%${query}%`);
      paramIdx++;
    }

    if (selectedCategory) {
      conditions.push(`b.category_id = $${paramIdx}`);
      params.push(parseInt(selectedCategory));
      paramIdx++;
    }

    if (selectedCity) {
      conditions.push(`(b.city_id = $${paramIdx} OR b.category_id = (SELECT id FROM categories WHERE name = 'Magazine Online'))`);
      params.push(parseInt(selectedCity));
      paramIdx++;
    }

    // Fetch and optionally apply user preferences
    let userHasPrefs = false;
    let prefsActive = false;
    let userPrefsCityNames = [];
    let userPrefsCategoryNames = [];

    if (req.webUser) {
      const prefsRes = await pool.query(
        "SELECT preferred_city_ids, preferred_category_ids FROM users WHERE id = $1",
        [req.webUser.id]
      );
      if (prefsRes.rows[0]) {
        const prefs = prefsRes.rows[0];
        const hasCities = prefs.preferred_city_ids && prefs.preferred_city_ids.length > 0;
        const hasCats = prefs.preferred_category_ids && prefs.preferred_category_ids.length > 0;
        userHasPrefs = hasCities || hasCats;

        if (hasCities) {
          const cityNames = await pool.query("SELECT name FROM cities WHERE id = ANY($1)", [prefs.preferred_city_ids]);
          userPrefsCityNames = cityNames.rows.map(r => r.name);
        }
        if (hasCats) {
          const catNames = await pool.query("SELECT name FROM categories WHERE id = ANY($1)", [prefs.preferred_category_ids]);
          userPrefsCategoryNames = catNames.rows.map(r => r.name);
        }

        // Apply preference filters only when prefs=1 and no manual city/category override
        if (req.query.prefs === '1' && !selectedCity && !selectedCategory) {
          prefsActive = true;
          if (hasCities) {
            conditions.push(`(b.city_id = ANY($${paramIdx}) OR b.category_id = (SELECT id FROM categories WHERE name = 'Magazine Online'))`);
            params.push(prefs.preferred_city_ids);
            paramIdx++;
          }
          if (hasCats) {
            conditions.push(`b.category_id = ANY($${paramIdx})`);
            params.push(prefs.preferred_category_ids);
            paramIdx++;
          }
        }
      }
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM offers o JOIN businesses b ON o.business_id = b.id WHERE ${whereClause}`,
      params
    );
    const totalOffers = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalOffers / limit);

    const sortOptions = {
      newest: "o.id DESC",
      popular: `(COALESCE(AVG(r.rating), 0) + CASE WHEN splan.slug = 'premium' THEN 0.4 WHEN splan.slug = 'standard' THEN 0.1 ELSE 0 END) DESC, COUNT(DISTINCT r.id) DESC`,
      discount: "CASE WHEN o.discount_type IN ('percent','percentage') THEN o.discount_value ELSE 0 END DESC, o.discount_value DESC",
      ending_soon: "o.end_date ASC NULLS LAST, o.id DESC",
    };
    const validSorts = ["newest", "popular", "discount", "ending_soon"];
    const sortKey = validSorts.includes(sort) ? sort : "newest";
    const orderBy = sortOptions[sortKey];

    const offersResult = await pool.query(
      `SELECT o.id, o.title, o.description, o.discount_type, o.discount_value, o.end_date,
              o.business_id,
              b.name as business_name, b.logo_url as business_logo,
              b.cover_image_url as business_cover,
              b.lat as business_lat, b.lng as business_lng,
              b.is_verified as business_verified,
              b.subscription_badge_type as business_badge_type,
              ci.name as city_name, cat.name as category_name,
              COALESCE(o.logo_url, b.cover_image_url) as image_url,
              COALESCE(AVG(r.rating), 0) as rating_avg,
              COUNT(DISTINCT r.id) as rating_count,
              (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as favorite_count,
              COALESCE(splan.has_promoted_placement, FALSE) as is_promoted
       FROM offers o
       JOIN businesses b ON o.business_id = b.id
       LEFT JOIN cities ci ON b.city_id = ci.id
       LEFT JOIN categories cat ON b.category_id = cat.id
       LEFT JOIN reviews r ON r.business_id = b.id
       LEFT JOIN business_subscriptions bsub
         ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
       LEFT JOIN subscription_plans splan
         ON splan.id = bsub.plan_id
       WHERE ${whereClause}
       GROUP BY o.id, o.title, o.description, o.discount_type, o.discount_value, o.end_date,
                o.business_id, b.name, b.logo_url, b.cover_image_url, b.lat, b.lng,
                b.is_verified, b.subscription_badge_type,
                ci.name, cat.name, o.logo_url, splan.slug, splan.has_promoted_placement
       ORDER BY ${orderBy}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    // Interleave offers so same business doesn't appear consecutively
    const rawOffers = offersResult.rows;
    const interleaved = [];
    const buckets = new Map();
    for (const offer of rawOffers) {
      const bid = offer.business_id;
      if (!buckets.has(bid)) buckets.set(bid, []);
      buckets.get(bid).push(offer);
    }
    const queues = [...buckets.values()].sort((a, b) => b.length - a.length);
    while (queues.some(q => q.length > 0)) {
      for (const q of queues) {
        if (q.length > 0) interleaved.push(q.shift());
      }
    }

    const categoriesResult = await pool.query("SELECT c.id, c.name FROM categories c ORDER BY c.name");

    const citiesResult = await pool.query(`
      SELECT c.id, c.name FROM cities c
      INNER JOIN businesses b ON b.city_id = c.id
      GROUP BY c.id, c.name
      ORDER BY COUNT(b.id) DESC
      LIMIT 15
    `);

    const totalCitiesResult = await pool.query(
      "SELECT COUNT(DISTINCT c.id) as total FROM cities c INNER JOIN businesses b ON b.city_id = c.id"
    );

    const selectedCityName = selectedCity ? (citiesResult.rows.find(c => c.id == selectedCity) || {}).name : null;

    // Fetch user favorite IDs for card heart buttons
    let userFavoriteIds = [];
    if (req.webUser) {
      const favRes = await pool.query("SELECT offer_id FROM favorite_offers WHERE user_id = $1", [req.webUser.id]);
      userFavoriteIds = favRes.rows.map(r => r.offer_id);
    }

    res.render("public/oferte", {
      offers: interleaved,
      categories: categoriesResult.rows,
      cities: citiesResult.rows,
      totalOffers,
      totalPages,
      currentPage: page,
      totalCities: parseInt(totalCitiesResult.rows[0].total),
      query,
      selectedCategory: prefsActive ? null : selectedCategory,
      selectedCity: prefsActive ? null : selectedCity,
      selectedCityName: prefsActive ? null : selectedCityName,
      selectedSort: sort,
      prefsActive,
      userHasPrefs,
      userPrefsCityNames,
      userPrefsCategoryNames,
      userFavoriteIds,
      activePage: "oferte",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Offers page error:", err);
    res.status(500).send("Eroare la încărcarea ofertelor");
  }
});

// ═══════════════════════════════════════════════════════
// BUSINESSES PAGE (with filtering, search, pagination)
// ═══════════════════════════════════════════════════════
router.get("/business-uri", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 24;
    const offset = (page - 1) * limit;
    const query = req.query.q || "";
    const selectedCategory = req.query.category || null;
    const selectedCity = req.query.city || null;
    const sort = req.query.sort || "popular";

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (query) {
      conditions.push(`b.name ILIKE $${paramIdx}`);
      params.push(`%${query}%`);
      paramIdx++;
    }

    if (selectedCategory) {
      conditions.push(`b.category_id = $${paramIdx}`);
      params.push(parseInt(selectedCategory));
      paramIdx++;
    }

    if (selectedCity) {
      conditions.push(`(b.city_id = $${paramIdx} OR b.category_id = (SELECT id FROM categories WHERE name = 'Magazine Online'))`);
      params.push(parseInt(selectedCity));
      paramIdx++;
    }

    // Fetch and optionally apply user preferences
    let userHasPrefs = false;
    let prefsActive = false;
    let userPrefsCityNames = [];
    let userPrefsCategoryNames = [];

    if (req.webUser) {
      const prefsRes = await pool.query(
        "SELECT preferred_city_ids, preferred_category_ids FROM users WHERE id = $1",
        [req.webUser.id]
      );
      if (prefsRes.rows[0]) {
        const prefs = prefsRes.rows[0];
        const hasCities = prefs.preferred_city_ids && prefs.preferred_city_ids.length > 0;
        const hasCats = prefs.preferred_category_ids && prefs.preferred_category_ids.length > 0;
        userHasPrefs = hasCities || hasCats;

        if (hasCities) {
          const cityNames = await pool.query("SELECT name FROM cities WHERE id = ANY($1)", [prefs.preferred_city_ids]);
          userPrefsCityNames = cityNames.rows.map(r => r.name);
        }
        if (hasCats) {
          const catNames = await pool.query("SELECT name FROM categories WHERE id = ANY($1)", [prefs.preferred_category_ids]);
          userPrefsCategoryNames = catNames.rows.map(r => r.name);
        }

        // Apply preference filters only when prefs=1 and no manual city/category override
        if (req.query.prefs === '1' && !selectedCity && !selectedCategory) {
          prefsActive = true;
          if (hasCities) {
            conditions.push(`(b.city_id = ANY($${paramIdx}) OR b.category_id = (SELECT id FROM categories WHERE name = 'Magazine Online'))`);
            params.push(prefs.preferred_city_ids);
            paramIdx++;
          }
          if (hasCats) {
            conditions.push(`b.category_id = ANY($${paramIdx})`);
            params.push(prefs.preferred_category_ids);
            paramIdx++;
          }
        }
      }
    }

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM businesses b ${whereClause}`,
      params
    );
    const totalBusinesses = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalBusinesses / limit);

    const sortOptions = {
      popular: `(COUNT(DISTINCT o.id) + RANDOM() * 2 + CASE WHEN splan.slug = 'premium' THEN 3 WHEN splan.slug = 'standard' THEN 1 ELSE 0 END) DESC, COALESCE(AVG(r.rating), 0) DESC`,
      rating: "COALESCE(AVG(r.rating), 0) DESC, COUNT(DISTINCT r.id) DESC",
      newest: "b.id DESC",
      offers: "COUNT(DISTINCT o.id) DESC, b.id DESC",
    };
    const orderBy = sortOptions[sort] || sortOptions.popular;

    const businessesResult = await pool.query(
      `SELECT b.id, b.name, b.logo_url, b.cover_image_url,
              b.lat, b.lng, b.is_verified, b.subscription_badge_type,
              ci.name as city_name, cat.name as category_name,
              COALESCE(AVG(r.rating), 0) as rating_avg,
              COUNT(DISTINCT r.id) as rating_count,
              COUNT(DISTINCT o.id) as offer_count,
              COALESCE(splan.has_promoted_placement, FALSE) as is_promoted
       FROM businesses b
       LEFT JOIN cities ci ON b.city_id = ci.id
       LEFT JOIN categories cat ON b.category_id = cat.id
       LEFT JOIN reviews r ON r.business_id = b.id
       LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
       LEFT JOIN business_subscriptions bsub
         ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
       LEFT JOIN subscription_plans splan
         ON splan.id = bsub.plan_id
       ${whereClause}
       GROUP BY b.id, b.name, b.logo_url, b.cover_image_url, b.lat, b.lng, b.is_verified, b.subscription_badge_type, ci.name, cat.name, splan.slug, splan.has_promoted_placement
       ORDER BY ${orderBy}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    const categoriesResult = await pool.query("SELECT c.id, c.name FROM categories c ORDER BY c.name");

    const citiesResult = await pool.query(`
      SELECT c.id, c.name FROM cities c
      INNER JOIN businesses b ON b.city_id = c.id
      GROUP BY c.id, c.name
      ORDER BY COUNT(b.id) DESC
      LIMIT 15
    `);

    const totalCitiesResult = await pool.query(
      "SELECT COUNT(DISTINCT c.id) as total FROM cities c INNER JOIN businesses b ON b.city_id = c.id"
    );

    // Fetch user followed IDs for card heart buttons
    let userFollowedIds = [];
    if (req.webUser) {
      const followRes = await pool.query("SELECT business_id FROM followed_businesses WHERE user_id = $1", [req.webUser.id]);
      userFollowedIds = followRes.rows.map(r => r.business_id);
    }

    res.render("public/business-uri", {
      businesses: businessesResult.rows,
      categories: categoriesResult.rows,
      cities: citiesResult.rows,
      totalBusinesses,
      totalPages,
      currentPage: page,
      totalCities: parseInt(totalCitiesResult.rows[0].total),
      query,
      selectedCategory: prefsActive ? null : selectedCategory,
      selectedCity: prefsActive ? null : selectedCity,
      selectedSort: sort,
      prefsActive,
      userHasPrefs,
      userPrefsCityNames,
      userPrefsCategoryNames,
      userFollowedIds,
      activePage: "business-uri",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Businesses page error:", err);
    res.status(500).send("Eroare la încărcarea business-urilor");
  }
});

// ═══════════════════════════════════════════════════════
// OFFER DETAIL PAGE
// ═══════════════════════════════════════════════════════
router.get("/oferta/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        o.id, o.business_id, o.title, o.description,
        o.discount_type, o.discount_value, o.conditions,
        o.start_date, o.end_date, o.is_active,
        o.logo_url as offer_logo,
        EXISTS(SELECT 1 FROM promo_codes WHERE offer_id = o.id AND is_active = TRUE) as has_promo_code,
        o.booking_type as offer_booking_type,
        o.booking_phone as offer_booking_phone,
        o.booking_whatsapp as offer_booking_whatsapp,
        o.booking_url as offer_booking_url,
        o.booking_instructions as offer_booking_instructions,
        b.name as business_name, b.address as business_address,
        b.phone as business_phone, b.website as business_website,
        b.lat as business_lat, b.lng as business_lng,
        b.logo_url as business_logo, b.cover_image_url as business_cover,
        b.booking_type as biz_booking_type,
        b.booking_phone as biz_booking_phone,
        b.booking_whatsapp as biz_booking_whatsapp,
        b.booking_url as biz_booking_url,
        b.booking_instructions as biz_booking_instructions,
        c.id as city_id, c.name as city_name,
        cat.id as cat_id, cat.name as cat_name,
        (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE business_id = b.id) as rating_avg,
        (SELECT COUNT(*) FROM reviews WHERE business_id = b.id) as rating_count,
        (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count,
        (CASE WHEN (SELECT COUNT(*) FROM favorite_offers fo2 WHERE fo2.offer_id = o.id AND fo2.created_at > NOW() - INTERVAL '14 days') >= 5 THEN true ELSE false END) as is_trending,
        o.max_reveals,
        (SELECT COUNT(*) FROM code_reveals cr WHERE cr.offer_id = o.id) as reveal_count
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      WHERE o.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });
    }

    const row = result.rows[0];

    // Fire-and-forget view tracking
    pool.query(
      "INSERT INTO offer_views (offer_id, business_id, viewer_ip, user_agent) VALUES ($1, $2, $3, $4)",
      [id, row.business_id, req.ip || null, (req.get("user-agent") || "").substring(0, 500)]
    ).catch(err => console.error('[Analytics] Tracking failed:', err.message));

    // Effective booking (inherit logic)
    let booking = { type: 'none', phone: null, whatsapp: null, url: null, instructions: null };
    const offerBookingType = row.offer_booking_type || 'inherit';
    if (offerBookingType === 'inherit') {
      booking = { type: row.biz_booking_type || 'none', phone: row.biz_booking_phone, whatsapp: row.biz_booking_whatsapp, url: row.biz_booking_url, instructions: row.biz_booking_instructions };
    } else {
      booking = { type: offerBookingType, phone: row.offer_booking_phone, whatsapp: row.offer_booking_whatsapp, url: row.offer_booking_url, instructions: row.offer_booking_instructions };
    }

    // Locations
    const linkRes = await pool.query("SELECT location_id FROM offer_locations WHERE offer_id = $1", [id]);
    const specificLocationIds = linkRes.rows.map(r => r.location_id);

    let locations = [];
    const baseLocQuery = `SELECT bl.id, bl.address, bl.lat, bl.lng, bl.phone,
      bl.booking_type, bl.booking_phone, bl.booking_whatsapp, bl.booking_url, bl.booking_instructions,
      c.name as city_name
      FROM business_locations bl LEFT JOIN cities c ON bl.city_id = c.id`;

    if (specificLocationIds.length > 0) {
      const locsRes = await pool.query(`${baseLocQuery} WHERE bl.id = ANY($1)`, [specificLocationIds]);
      locations = locsRes.rows;
    } else {
      const allLocsRes = await pool.query(`${baseLocQuery} WHERE bl.business_id = $1`, [row.business_id]);
      locations = allLocsRes.rows;
    }

    // Check favorite status
    let isFavorite = false;
    if (req.webUser) {
      const favRes = await pool.query(
        "SELECT 1 FROM favorite_offers WHERE user_id = $1 AND offer_id = $2",
        [req.webUser.id, id]
      );
      isFavorite = favRes.rowCount > 0;
    }

    const avg = parseFloat(row.rating_avg || 0);
    const count = parseInt(row.rating_count || 0);

    const offer = {
      id: row.id,
      title: row.title,
      description: row.description,
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      conditions: row.conditions,
      start_date: row.start_date,
      end_date: row.end_date,
      is_active: row.is_active,
      has_promo_code: !!row.has_promo_code,
      save_count: parseInt(row.save_count || 0),
      is_trending: row.is_trending === true,
      max_reveals: row.max_reveals || null,
      reveal_count: parseInt(row.reveal_count || 0),
      image_url: row.business_cover || row.offer_logo || row.business_logo,
      booking,
      business: {
        id: row.business_id,
        name: row.business_name,
        phone: row.business_phone,
        website: row.business_website,
        logo_url: row.business_logo,
        city: { id: row.city_id, name: row.city_name },
        category: { id: row.cat_id, name: row.cat_name },
        rating: parseFloat(avg.toFixed(1)),
        rating_count: count,
      },
      locations: locations.map(l => ({
        id: l.id, address: l.address, lat: l.lat, lng: l.lng, phone: l.phone, cityName: l.city_name,
        booking_type: l.booking_type || 'none',
        booking_phone: l.booking_phone, booking_whatsapp: l.booking_whatsapp,
        booking_url: l.booking_url, booking_instructions: l.booking_instructions,
      })),
    };

    // Similar offers (same category, respecting competitor blocking)
    let similarOffers = [];
    if (row.cat_id) {
      try {
        // Check if the current offer's business has competitor blocking enabled
        let blockCompetitors = false;
        try {
          const tierCheck = await pool.query(`
            SELECT splan.has_competitor_blocking, b.competitor_blocking_enabled
            FROM business_subscriptions bsub
            JOIN subscription_plans splan ON splan.id = bsub.plan_id
            JOIN businesses b ON b.id = bsub.business_id
            WHERE bsub.business_id = $1
              AND bsub.status IN ('active', 'trial')
            LIMIT 1
          `, [row.business_id]);
          if (tierCheck.rows.length > 0
              && tierCheck.rows[0].has_competitor_blocking
              && tierCheck.rows[0].competitor_blocking_enabled) {
            blockCompetitors = true;
          }
        } catch (e) { /* fail open — don't block on tier errors */ }

        let simQuery;
        let simParams;

        if (blockCompetitors) {
          // Show only offers from the SAME business (no competitors)
          simQuery = `
            SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
                   b.name as business_name, b.logo_url as business_logo,
                   COALESCE(o.logo_url, b.cover_image_url) as image_url,
                   c2.name as city_name
            FROM offers o
            JOIN businesses b ON o.business_id = b.id
            LEFT JOIN cities c2 ON b.city_id = c2.id
            WHERE o.id != $1 AND o.is_active = TRUE
              AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
              AND o.business_id = $2
            ORDER BY (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) DESC
            LIMIT 4
          `;
          simParams = [id, row.business_id];
        } else {
          // Default: show offers from any business in the same category
          simQuery = `
            SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
                   b.name as business_name, b.logo_url as business_logo,
                   COALESCE(o.logo_url, b.cover_image_url) as image_url,
                   c2.name as city_name
            FROM offers o
            JOIN businesses b ON o.business_id = b.id
            LEFT JOIN cities c2 ON b.city_id = c2.id
            WHERE o.id != $1 AND o.is_active = TRUE
              AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
              AND b.category_id = $2
            ORDER BY (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) DESC
            LIMIT 4
          `;
          simParams = [id, row.cat_id];
        }

        const simResult = await pool.query(simQuery, simParams);
        similarOffers = simResult.rows;
      } catch (e) { /* silently fail */ }
    }

    // Fetch user favorite IDs for similar offer heart buttons
    let userFavoriteIds = [];
    if (req.webUser) {
      const favRes = await pool.query("SELECT offer_id FROM favorite_offers WHERE user_id = $1", [req.webUser.id]);
      userFavoriteIds = favRes.rows.map(r => r.offer_id);
    }

    res.render("public/offer-detail", {
      offer,
      similarOffers,
      isFavorite,
      userFavoriteIds,
      activePage: null,
      webUser: req.webUser,
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "Offer",
          "name": offer.title,
          "description": (offer.description || '').substring(0, 300),
          "url": `https://ofai.ro/oferta/${offer.id}`,
          ...(offer.image_url ? { "image": offer.image_url } : {}),
          ...(offer.start_date ? { "validFrom": offer.start_date } : {}),
          ...(offer.end_date ? { "validThrough": offer.end_date } : {}),
          "offeredBy": {
            "@type": "LocalBusiness",
            "name": offer.business?.name || ''
          }
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Acasă", "item": "https://ofai.ro" },
            { "@type": "ListItem", "position": 2, "name": "Oferte", "item": "https://ofai.ro/oferte" },
            { "@type": "ListItem", "position": 3, "name": offer.title }
          ]
        }
      ],
    });
  } catch (err) {
    console.error("[Web] Offer detail error:", err);
    res.status(500).send("Eroare la încărcarea ofertei");
  }
});

// ═══════════════════════════════════════════════════════
// CLICK TRACKING (anonymous, GDPR-friendly)
// ═══════════════════════════════════════════════════════
router.post("/api/web/clicks", clickLimiter, async (req, res) => {
  const { business_id, offer_id, action_type } = req.body || {};
  const validActions = ['phone','whatsapp','booking_url','website','navigate','share','follow','unfollow','favorite','unfavorite','gallery','copy_code'];
  if (!business_id || !action_type || !validActions.includes(action_type)) {
    return res.status(400).json({ message: "Invalid" });
  }
  pool.query(
    "INSERT INTO business_clicks (business_id, offer_id, action_type) VALUES ($1, $2, $3)",
    [parseInt(business_id), offer_id ? parseInt(offer_id) : null, action_type]
  ).catch(err => console.error('[Analytics] Tracking failed:', err.message));
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════
// OFFER PROMO CODE REVEAL (Web, auth required)
// ═══════════════════════════════════════════════════════
router.post("/api/web/offers/:id/reveal-code", revealLimiter, requireWebAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // First check if offer exists and is active
    const offerCheck = await pool.query("SELECT id FROM offers WHERE id = $1 AND is_active = TRUE", [id]);
    if (offerCheck.rows.length === 0) {
      return res.status(404).json({ message: "Oferta nu există" });
    }

    // Get a random active promo code for this offer
    const result = await pool.query(
      "SELECT id, code FROM promo_codes WHERE offer_id = $1 AND is_active = TRUE ORDER BY RANDOM() LIMIT 1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Această ofertă nu are cod promoțional activ" });
    }

    const promoRow = result.rows[0];

    // Log reveal with promo_code_id (fire-and-forget)
    pool.query(
      "INSERT INTO code_reveals (offer_id, user_id, viewer_ip, promo_code_id) VALUES ($1, $2, $3, $4)",
      [id, req.webUser.id, req.ip || null, promoRow.id]
    ).catch(err => console.error('[Analytics] Tracking failed:', err.message));

    // Fire-and-forget: award points + check badges
    const { awardPoints } = require("../services/gamification");
    const { checkAndAwardBadges } = require("../services/badgeService");
    awardPoints(req.webUser.id, "code_reveal").catch(() => {});
    checkAndAwardBadges(req.webUser.id, ["code_hunter"]).catch(() => {});

    res.json({ promo_code: promoRow.code });
  } catch (err) {
    console.error("[Web] Reveal code error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// ═══════════════════════════════════════════════════════
// BUSINESS DETAIL PAGE
// ═══════════════════════════════════════════════════════
router.get("/business/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const businessRes = await pool.query(`
      SELECT b.id, b.name, b.description, b.address, b.phone, b.website, b.lat, b.lng,
             b.logo_url, b.cover_image_url, b.is_verified, b.subscription_badge_type,
             b.booking_type, b.booking_phone, b.booking_whatsapp, b.booking_url, b.booking_instructions,
             c.id as city_id, c.name as city_name,
             cat.id as cat_id, cat.name as cat_name,
             COALESCE(AVG(r.rating), 0) as rating_avg,
             COUNT(r.id) as rating_count,
             (SELECT COUNT(*) FROM followed_businesses fb WHERE fb.business_id = b.id) as follower_count,
             (SELECT json_agg(json_build_object('rating', r_dist.rating, 'count', r_dist.cnt))
              FROM (SELECT rating, COUNT(*) as cnt FROM reviews WHERE business_id = b.id GROUP BY rating) r_dist
             ) as rating_distribution
      FROM businesses b
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      LEFT JOIN reviews r ON b.id = r.business_id
      WHERE b.id = $1
      GROUP BY b.id, c.id, c.name, cat.id, cat.name
    `, [id]);

    if (businessRes.rows.length === 0) {
      return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });
    }

    const b = businessRes.rows[0];

    // Fire-and-forget view tracking
    pool.query(
      "INSERT INTO business_views (business_id, viewer_ip, user_agent) VALUES ($1, $2, $3)",
      [id, req.ip || null, (req.get("user-agent") || "").substring(0, 500)]
    ).catch(err => console.error('[Analytics] Tracking failed:', err.message));

    // Images
    const imagesRes = await pool.query(
      "SELECT id, image_url, image_filename, sort_order FROM business_images WHERE business_id = $1 ORDER BY sort_order NULLS LAST, id ASC",
      [id]
    );
    const images = imagesRes.rows.map(img => ({
      id: img.id,
      url: img.image_url || (img.image_filename ? `/uploads/businesses/${img.image_filename}` : null),
      sort_order: img.sort_order,
    })).filter(img => img.url);

    // Locations
    const locationsRes = await pool.query(`
      SELECT bl.id, bl.address, bl.lat, bl.lng, bl.phone,
             bl.booking_type, bl.booking_phone, bl.booking_whatsapp, bl.booking_url, bl.booking_instructions,
             c.id as city_id, c.name as city_name
      FROM business_locations bl
      LEFT JOIN cities c ON bl.city_id = c.id
      WHERE business_id = $1
    `, [id]);

    let locations = [];
    if (locationsRes.rows.length > 0) {
      locations = locationsRes.rows.map(row => ({
        id: row.id, address: row.address, lat: row.lat, lng: row.lng, phone: row.phone,
        city: { id: row.city_id, name: row.city_name },
        booking_type: row.booking_type || 'none',
        booking_phone: row.booking_phone, booking_whatsapp: row.booking_whatsapp,
        booking_url: row.booking_url, booking_instructions: row.booking_instructions,
      }));
    } else if (b.address) {
      locations = [{ id: 'main', address: b.address, lat: b.lat, lng: b.lng, phone: b.phone,
        city: { id: b.city_id, name: b.city_name },
        booking_type: 'none', booking_phone: null, booking_whatsapp: null, booking_url: null, booking_instructions: null }];
    }

    // Active offers
    const offersRes = await pool.query(`
      SELECT o.id, o.title, o.discount_type, o.discount_value,
             o.start_date, o.end_date,
             COALESCE(b2.cover_image_url, o.logo_url) as image_url,
             b2.name as business_name, b2.logo_url as business_logo,
             (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as favorite_count
      FROM offers o
      JOIN businesses b2 ON o.business_id = b2.id
      WHERE o.business_id = $1 AND o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
      ORDER BY o.discount_value DESC
      LIMIT 50
    `, [id]);

    // Reviews
    const reviewsRes = await pool.query(`
      SELECT r.id, r.rating, r.comment, r.created_at,
             COALESCE(u.first_name, 'Utilizator') as first_name,
             COALESCE(u.last_name, '') as last_name,
             u.profile_picture_url,
             COALESCE(u.show_picture_in_reviews, TRUE) as show_picture_in_reviews,
             bd_display.color as display_badge_color,
             bd_display.name as display_badge_name,
             rr.response_text, rr.created_at as response_date
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN badge_definitions bd_display ON bd_display.id = u.display_badge_id
      LEFT JOIN review_responses rr ON rr.review_id = r.id
      WHERE r.business_id = $1
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [id]);

    // Check follow status + user review + offer request status
    let isFollowing = false;
    let userReview = null;
    let userRequested = false;
    if (req.webUser) {
      const [followRes, userRevRes, userReqRes] = await Promise.all([
        pool.query("SELECT 1 FROM followed_businesses WHERE user_id = $1 AND business_id = $2", [req.webUser.id, id]),
        pool.query("SELECT id, rating, comment FROM reviews WHERE user_id = $1 AND business_id = $2", [req.webUser.id, id]),
        pool.query(
          `SELECT created_at FROM offer_requests
           WHERE user_id = $1 AND business_id = $2
           ORDER BY created_at DESC LIMIT 1`,
          [req.webUser.id, id]
        ),
      ]);
      isFollowing = followRes.rowCount > 0;
      userReview = userRevRes.rows[0] || null;

      // Check if user has an active request (within last 7 days)
      if (userReqRes.rows.length > 0) {
        const lastRequest = new Date(userReqRes.rows[0].created_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        userRequested = lastRequest > sevenDaysAgo;
      }
    }

    // Offer request count (all users)
    const requestCountRes = await pool.query(
      `SELECT COUNT(*) as total
       FROM offer_requests
       WHERE business_id = $1`,
      [id]
    );
    const requestCount = parseInt(requestCountRes.rows[0].total || 0);

    // Determine showPinch flag
    let showPinch = false;
    const activeOffers = offersRes.rows;
    if (activeOffers.length === 0) {
      // No active offers
      showPinch = true;
    } else {
      // Check if newest offer is older than 30 days
      // offersRes is already ordered by discount_value DESC, so we need to find the max ID
      const newestOffer = activeOffers.reduce((max, offer) => offer.id > max.id ? offer : max, activeOffers[0]);
      const startDate = new Date(newestOffer.start_date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (startDate < thirtyDaysAgo) {
        showPinch = true;
      }
    }

    // Review summary
    let reviewSummary = null;
    try {
      const { getExistingSummary } = require("../services/llm/summarizationService");
      const existingSummary = await getExistingSummary(id);
      if (existingSummary) {
        reviewSummary = { text: existingSummary.summary_text, review_count: existingSummary.review_count };
      }
    } catch (e) {
      console.error("[Web] Review summary error for business", id, ":", e.message || e);
    }

    const coverImage = b.cover_image_url || (images.length > 0 ? images[0].url : b.logo_url);

    const business = {
      id: b.id,
      name: b.name,
      description: b.description,
      address: b.address,
      phone: b.phone,
      website: b.website,
      lat: b.lat,
      lng: b.lng,
      logo_url: b.logo_url,
      cover_image: coverImage,
      is_verified: !!b.is_verified,
      subscription_badge_type: b.subscription_badge_type || null,
      // Legacy fallback: businesses verified before subscription system keep 'verified' badge
      badge_type: b.subscription_badge_type || (b.is_verified ? 'verified' : null),
      city: { id: b.city_id, name: b.city_name },
      category: { id: b.cat_id, name: b.cat_name },
      rating: parseFloat(parseFloat(b.rating_avg).toFixed(1)),
      rating_count: parseInt(b.rating_count),
      follower_count: parseInt(b.follower_count || 0),
      rating_distribution: b.rating_distribution || [],
      images,
      locations,
      booking: {
        type: b.booking_type || 'none',
        phone: b.booking_phone, whatsapp: b.booking_whatsapp,
        url: b.booking_url, instructions: b.booking_instructions,
      },
    };

    // Fetch user favorite IDs for offer card heart buttons
    let userFavoriteIds = [];
    if (req.webUser) {
      const favRes = await pool.query("SELECT offer_id FROM favorite_offers WHERE user_id = $1", [req.webUser.id]);
      userFavoriteIds = favRes.rows.map(r => r.offer_id);
    }

    res.render("public/business-detail", {
      business,
      offers: offersRes.rows,
      reviews: reviewsRes.rows,
      userReview,
      isFollowing,
      reviewSummary,
      showPinch,
      requestCount,
      userRequested,
      userFavoriteIds,
      activePage: null,
      webUser: req.webUser,
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": business.name,
          "description": (business.description || '').substring(0, 300),
          "address": {
            "@type": "PostalAddress",
            "streetAddress": business.address || '',
            "addressLocality": business.city?.name || '',
            "addressCountry": "RO"
          },
          ...(business.lat && business.lng ? { "geo": { "@type": "GeoCoordinates", "latitude": business.lat, "longitude": business.lng } } : {}),
          ...(business.phone ? { "telephone": business.phone } : {}),
          ...(business.website ? { "url": business.website } : {}),
          ...(business.cover_image ? { "image": business.cover_image } : {}),
          ...(business.rating > 0 ? { "aggregateRating": { "@type": "AggregateRating", "ratingValue": business.rating, "reviewCount": business.rating_count || 0 } } : {})
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Acasă", "item": "https://ofai.ro" },
            { "@type": "ListItem", "position": 2, "name": "Business-uri", "item": "https://ofai.ro/business-uri" },
            { "@type": "ListItem", "position": 3, "name": business.name }
          ]
        }
      ],
    });
  } catch (err) {
    console.error("[Web] Business detail error:", err);
    res.status(500).send("Eroare la încărcarea business-ului");
  }
});

// ═══════════════════════════════════════════════════════
// AUTH PAGES
// ═══════════════════════════════════════════════════════
router.get("/login", (req, res) => {
  if (req.webUser) return res.redirect("/cont");
  res.render("public/login", { activePage: null, webUser: null, googleClientId: process.env.GOOGLE_CLIENT_ID || "" });
});

router.get("/register", (req, res) => {
  if (req.webUser) return res.redirect("/cont");
  res.render("public/register", { activePage: null, webUser: null, googleClientId: process.env.GOOGLE_CLIENT_ID || "" });
});

router.get("/forgot-password", (req, res) => {
  res.render("public/forgot-password", { activePage: null, webUser: null });
});

// POST /login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email și parolă sunt obligatorii" });
    }

    const result = await pool.query(
      "SELECT id, email, password_hash, role, first_name, last_name, banned_at FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Email sau parolă invalidă" });
    }

    const user = result.rows[0];

    // Google OAuth users have no password — must use Google Sign-In
    if (!user.password_hash) {
      return res.status(401).json({ message: "Acest cont folosește Google Sign-In. Te rugăm să te autentifici cu Google." });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Email sau parolă invalidă" });
    }

    if (user.banned_at) {
      return res.status(403).json({ message: "Contul tău a fost suspendat." });
    }

    await pool.query("UPDATE users SET last_active_at = NOW() WHERE id = $1", [user.id]);

    const token = signToken({ id: user.id }, "24h");
    const refreshToken = await createWebRefreshToken(user.id);

    res.cookie("ofai_token", token, ACCESS_COOKIE_OPTS);
    res.cookie("ofai_refresh_token", refreshToken, REFRESH_COOKIE_OPTS);

    const returnTo = req.body.returnTo || "/cont";
    const safeRedirect = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/cont";
    return res.json({ success: true, redirect: safeRedirect });
  } catch (err) {
    console.error("[Web] Login error:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /register
router.post("/register", async (req, res) => {
  try {
    const { email, password, first_name, last_name, accept_terms, accept_privacy } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email si parola sunt obligatorii" });
    }

    // Password strength validation
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({ message: pwdCheck.errors[0] });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ message: "Exista deja un cont cu acest email" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = new Date();
    const insertResult = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, privacy_accepted_at, terms_accepted_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [email.toLowerCase().trim(), passwordHash, first_name?.trim(), last_name?.trim(),
       accept_privacy ? now : null, accept_terms ? now : null]
    );
    const user = insertResult.rows[0];

    await pool.query("INSERT INTO user_points (user_id, total_points) VALUES ($1, 0) ON CONFLICT DO NOTHING", [user.id]);

    const token = signToken({ id: user.id });
    const refreshToken = await createWebRefreshToken(user.id);

    res.cookie("ofai_token", token, ACCESS_COOKIE_OPTS);
    res.cookie("ofai_refresh_token", refreshToken, REFRESH_COOKIE_OPTS);

    // Async email + webhook (GDPR: no PII in webhook)
    sendWelcomeEmail(user.email, user.first_name).catch(() => {});
    triggerWebhook("/webhook/new-user", {
      user_id: user.id, created_at: new Date().toISOString(),
    });

    const returnTo = req.body.returnTo || "/cont";
    const safeRedirect = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/cont";
    return res.status(201).json({ success: true, redirect: safeRedirect });
  } catch (err) {
    console.error("[Web] Register error:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /auth/google - Google OAuth Sign-In
router.post("/auth/google", async (req, res, next) => {
  // Skip web handler for mobile clients — let authRouter handle it
  if (req.headers['x-client'] === 'mobile') return next();
  try {
    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ message: "Token Google lipsește" });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(400).json({ message: "Token Google invalid" });
    }

    const email = payload.email.toLowerCase().trim();
    const firstName = payload.given_name?.trim() || "";
    const lastName = payload.family_name?.trim() || "";
    const profilePicture = payload.picture || null;
    const googleId = payload.sub;

    // Check if user exists
    const existingUser = await pool.query(
      "SELECT id, email, google_id, profile_picture_url FROM users WHERE email = $1",
      [email]
    );

    let user;
    let isNewUser = false;

    if (existingUser.rowCount > 0) {
      // Existing user - update google_id and profile_picture_url if not set
      user = existingUser.rows[0];
      await pool.query(
        `UPDATE users SET
          google_id = COALESCE(google_id, $1),
          profile_picture_url = $2,
          last_active_at = NOW()
         WHERE id = $3`,
        [googleId, profilePicture, user.id]
      );
    } else {
      // New user - create account
      const now = new Date();
      const insertResult = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, google_id, profile_picture_url, privacy_accepted_at, terms_accepted_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [email, firstName, lastName, googleId, profilePicture, now, now]
      );
      user = insertResult.rows[0];
      isNewUser = true;

      // Create user_points record
      await pool.query("INSERT INTO user_points (user_id, total_points) VALUES ($1, 0) ON CONFLICT DO NOTHING", [user.id]);

      // Async email + webhook
      sendWelcomeEmail(user.email, user.first_name).catch(() => {});
      triggerWebhook("/webhook/new-user", {
        user_id: user.id,
        created_at: new Date().toISOString(),
        source: "google_oauth"
      });
    }

    // Issue JWT tokens
    const token = signToken({ id: user.id }, "24h");
    const refreshToken = await createWebRefreshToken(user.id);

    res.cookie("ofai_token", token, ACCESS_COOKIE_OPTS);
    res.cookie("ofai_refresh_token", refreshToken, REFRESH_COOKIE_OPTS);

    // Redirect to onboarding for new users, account page for existing
    const redirect = isNewUser ? "/onboarding" : "/cont";
    return res.json({ success: true, redirect });
  } catch (err) {
    console.error("[Web] Google OAuth error:", err);
    return res.status(500).json({ message: "Eroare la autentificarea cu Google" });
  }
});

// POST /forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: "Email-ul este obligatoriu" });
    }

    const userRes = await pool.query("SELECT id, email, first_name, google_id, password_hash FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (userRes.rowCount === 0) {
      return res.json({ message: "Dacă există un cont cu acest email, vei primi instrucțiuni de resetare." });
    }

    const user = userRes.rows[0];

    // Block password reset for Google-only accounts (no password set)
    if (user.google_id && !user.password_hash) {
      return res.json({ message: "Dacă există un cont cu acest email, vei primi instrucțiuni de resetare." });
    }

    await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [user.id]);

    const resetCode = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)", [user.id, resetCode, expiresAt]);

    await sendPasswordResetEmail(user.email, resetCode, user.first_name);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[Web] Reset code for ${user.email}: ${resetCode}`);
    }

    return res.json({ message: "Dacă există un cont cu acest email, vei primi instrucțiuni de resetare." });
  } catch (err) {
    console.error("[Web] Forgot password error:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "Toate câmpurile sunt obligatorii" });
    }
    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) {
      return res.status(400).json({ message: pwdCheck.message });
    }

    const tokenRes = await pool.query(
      `SELECT prt.*, u.id as user_id FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1 AND prt.token = $2 AND prt.used_at IS NULL AND prt.expires_at > NOW()
       ORDER BY prt.created_at DESC LIMIT 1`,
      [email.toLowerCase().trim(), code]
    );

    if (tokenRes.rowCount === 0) {
      return res.status(400).json({ message: "Cod invalid sau expirat" });
    }

    const tokenData = tokenRes.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, tokenData.user_id]);
    await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1", [tokenData.id]);

    return res.json({ message: "Parola a fost schimbată cu succes!" });
  } catch (err) {
    console.error("[Web] Reset password error:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// GET /logout
router.get("/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies?.ofai_refresh_token;
    if (refreshToken) {
      await pool.query(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1 AND revoked_at IS NULL",
        [refreshToken]
      );
    }
  } catch (err) {
    console.error("[Web] Logout revoke error:", err);
  }
  res.clearCookie("ofai_token", { path: "/" });
  res.clearCookie("ofai_refresh_token", { path: "/" });
  res.redirect("/");
});

// ═══════════════════════════════════════════════════════
// CATEGORIES PAGE
// ═══════════════════════════════════════════════════════
router.get("/categorii", async (req, res) => {
  try {
    const categories = await pool.query(`
      SELECT c.id, c.name, COUNT(DISTINCT o.id) as offer_count
      FROM categories c
      LEFT JOIN businesses b ON b.category_id = c.id
      LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
      GROUP BY c.id, c.name
      ORDER BY c.name
    `);

    res.render("public/categorii", {
      categories: categories.rows,
      activePage: "categorii",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Categories error:", err);
    res.status(500).send("Eroare la încărcarea categoriilor");
  }
});

// ═══════════════════════════════════════════════════════
// CITIES PAGE
// ═══════════════════════════════════════════════════════
router.get("/orase", async (req, res) => {
  try {
    const cities = await pool.query(`
      SELECT c.id, c.name, COUNT(b.id) as business_count
      FROM cities c
      LEFT JOIN businesses b ON b.city_id = c.id
      GROUP BY c.id, c.name
      ORDER BY business_count DESC, c.name
    `);

    res.render("public/orase", {
      cities: cities.rows,
      activePage: "orase",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Cities error:", err);
    res.status(500).send("Eroare la încărcarea orașelor");
  }
});

// ═══════════════════════════════════════════════════════
// ACCOUNT PAGES (require auth)
// ═══════════════════════════════════════════════════════
router.get("/cont", requireWebAuth, async (req, res) => {
  try {
    const { getUserBadges } = require("../services/badgeService");

    const [pointsRes, favCount, followCount, reviewCount, bizReqRes, userDetails, userBadges] = await Promise.all([
      pool.query("SELECT total_points FROM user_points WHERE user_id = $1", [req.webUser.id]),
      pool.query("SELECT COUNT(*) as total FROM favorite_offers WHERE user_id = $1", [req.webUser.id]),
      pool.query("SELECT COUNT(*) as total FROM followed_businesses WHERE user_id = $1", [req.webUser.id]),
      pool.query("SELECT COUNT(*) as total FROM reviews WHERE user_id = $1", [req.webUser.id]),
      pool.query("SELECT status, name FROM business_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [req.webUser.id]),
      pool.query("SELECT last_profile_edit FROM users WHERE id = $1", [req.webUser.id]),
      getUserBadges(req.webUser.id).catch(err => {
        console.error("[Web] Badges fetch error:", err.message);
        return [];
      }),
    ]);

    const userPoints = pointsRes.rows[0]?.total_points || 0;
    const bizRequest = bizReqRes.rows[0] || null;
    const lastProfileEdit = userDetails.rows[0]?.last_profile_edit || null;

    res.render("public/account", {
      activePage: "cont",
      webUser: req.webUser,
      userPoints,
      favCount: parseInt(favCount.rows[0].total),
      followCount: parseInt(followCount.rows[0].total),
      reviewCount: parseInt(reviewCount.rows[0].total),
      bizRequest,
      lastProfileEdit,
      userBadges,
    });
  } catch (err) {
    console.error("[Web] Account error:", err);
    res.status(500).send("Eroare la încărcarea contului");
  }
});

router.get("/colectia-mea", requireWebAuth, async (req, res) => {
  try {
    const sort = req.query.sort || "recent";
    const selectedCategory = req.query.category ? parseInt(req.query.category) : null;

    // Sort for favorites (offers)
    let favoritesOrderBy = "f.created_at DESC";
    if (sort === "rating") favoritesOrderBy = "rating_avg DESC";
    else if (sort === "discount") favoritesOrderBy = "o.discount_value DESC";
    else if (sort === "ending_soon") favoritesOrderBy = "o.end_date ASC";
    // distance handled client-side

    const favParams = [req.webUser.id];
    let favCategoryFilter = "";
    if (selectedCategory) {
      favParams.push(selectedCategory);
      favCategoryFilter = `AND b.category_id = $${favParams.length}`;
    }

    const favoritesRes = await pool.query(`
      SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
             b.name as business_name, b.logo_url as business_logo,
             b.cover_image_url as business_cover, b.lat, b.lng,
             COALESCE(b.cover_image_url, o.logo_url, b.logo_url) as image_url,
             ci.name as city_name, cat.name as category_name,
             COALESCE(AVG(r.rating), 0) as rating_avg
      FROM favorite_offers f
      JOIN offers o ON o.id = f.offer_id
      JOIN businesses b ON b.id = o.business_id
      LEFT JOIN cities ci ON ci.id = b.city_id
      LEFT JOIN categories cat ON cat.id = b.category_id
      LEFT JOIN reviews r ON r.business_id = b.id
      WHERE f.user_id = $1 ${favCategoryFilter}
      GROUP BY o.id, o.title, o.discount_type, o.discount_value, o.end_date,
               b.name, b.logo_url, b.cover_image_url, b.lat, b.lng,
               ci.name, cat.name, f.created_at
      ORDER BY ${favoritesOrderBy}
    `, favParams);

    // Sort for subscriptions (businesses)
    let subscriptionsOrderBy = "MAX(f.created_at) DESC";
    if (sort === "rating") subscriptionsOrderBy = "rating_avg DESC";
    else if (sort === "offers") subscriptionsOrderBy = "active_offers_count DESC";
    // distance handled client-side

    const subParams = [req.webUser.id];
    let subCategoryFilter = "";
    if (selectedCategory) {
      subParams.push(selectedCategory);
      subCategoryFilter = `AND b.category_id = $${subParams.length}`;
    }

    const subscriptionsRes = await pool.query(`
      SELECT b.id, b.name, b.logo_url, b.cover_image_url, b.lat, b.lng,
             c.name as city_name, cat.name as category_name,
             COUNT(DISTINCT o.id) as active_offers_count,
             COALESCE(AVG(rev.rating), 0) as rating_avg
      FROM followed_businesses f
      JOIN businesses b ON b.id = f.business_id
      LEFT JOIN cities c ON c.id = b.city_id
      LEFT JOIN categories cat ON cat.id = b.category_id
      LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
      LEFT JOIN reviews rev ON rev.business_id = b.id
      WHERE f.user_id = $1 ${subCategoryFilter}
      GROUP BY b.id, b.name, b.logo_url, b.cover_image_url, b.lat, b.lng, c.name, cat.name
      ORDER BY ${subscriptionsOrderBy}
    `, subParams);

    // Categories present in user's collection (for filter pills)
    const categoriesRes = await pool.query(`
      SELECT DISTINCT cat.id, cat.name FROM categories cat WHERE cat.id IN (
        SELECT b.category_id FROM followed_businesses fb
        JOIN businesses b ON b.id = fb.business_id WHERE fb.user_id = $1
        UNION
        SELECT b2.category_id FROM favorite_offers fo
        JOIN offers o ON o.id = fo.offer_id
        JOIN businesses b2 ON b2.id = o.business_id WHERE fo.user_id = $1
      ) ORDER BY cat.name
    `, [req.webUser.id]);

    // All items on collection page are favorited/followed by definition
    const userFavoriteIds = favoritesRes.rows.map(r => r.id);
    const userFollowedIds = subscriptionsRes.rows.map(r => r.id);

    res.render("public/colectia-mea", {
      favorites: favoritesRes.rows,
      subscriptions: subscriptionsRes.rows,
      categories: categoriesRes.rows,
      selectedCategory,
      sort,
      userFavoriteIds,
      userFollowedIds,
      activePage: "colectie",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Collection error:", err);
    res.status(500).send("Eroare la încărcarea colecției");
  }
});

router.get("/setari", requireWebAuth, async (req, res) => {
  try {
    const userRes = await pool.query(
      "SELECT show_picture_in_reviews, google_id FROM users WHERE id = $1",
      [req.webUser.id]
    );
    const userSettings = userRes.rows[0] || {};

    res.render("public/setari", {
      activePage: "setari",
      webUser: req.webUser,
      showPictureInReviews: userSettings.show_picture_in_reviews !== false,
      isGoogleUser: !!userSettings.google_id,
    });
  } catch (err) {
    console.error("[Web] Settings error:", err);
    res.status(500).send("Eroare la încărcarea setărilor");
  }
});

router.get("/preferinte", requireWebAuth, async (req, res) => {
  try {
    const userRes = await pool.query(
      "SELECT preferred_city_ids, preferred_category_ids FROM users WHERE id = $1",
      [req.webUser.id]
    );
    const cities = await pool.query("SELECT id, name FROM cities ORDER BY name");
    const categories = await pool.query("SELECT id, name FROM categories ORDER BY name");

    const prefs = userRes.rows[0] || {};

    res.render("public/preferinte", {
      activePage: "preferinte",
      webUser: req.webUser,
      cities: cities.rows,
      categories: categories.rows,
      preferredCityIds: prefs.preferred_city_ids || [],
      preferredCategoryIds: prefs.preferred_category_ids || [],
    });
  } catch (err) {
    console.error("[Web] Preferences error:", err);
    res.status(500).send("Eroare la încărcarea preferințelor");
  }
});

// GET /onboarding — Post-registration preference selection
router.get("/onboarding", requireWebAuth, async (req, res) => {
  try {
    const cities = await pool.query("SELECT id, name FROM cities ORDER BY name");
    const categories = await pool.query("SELECT id, name FROM categories ORDER BY name");

    res.render("public/onboarding", {
      activePage: null,
      webUser: req.webUser,
      cities: cities.rows,
      categories: categories.rows,
      loadOnboardingCss: true,
    });
  } catch (err) {
    console.error("[Web] Onboarding error:", err);
    res.redirect("/cont");
  }
});

// ═══════════════════════════════════════════════════════
// BUSINESS PORTAL WEB PAGES
// ═══════════════════════════════════════════════════════

// Attach tier info for all portal routes that carry a :businessId param
router.use('/api/web/portal/:businessId', attachTier());

// Portal Dashboard — lista de business-uri
router.get("/portal", requireWebAuth, async (req, res) => {
  try {
    if (req.webUser.role !== "admin" && req.webUser.role !== "business_owner") {
      return res.redirect("/cont");
    }

    let businesses;
    if (req.webUser.role === "admin") {
      businesses = await pool.query(`
        SELECT b.id, b.name, b.logo_url, b.cover_image_url,
               c.name as city_name, cat.name as category_name,
               (SELECT COUNT(*) FROM offers WHERE business_id = b.id AND is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)) as active_offers
        FROM businesses b
        LEFT JOIN cities c ON b.city_id = c.id
        LEFT JOIN categories cat ON b.category_id = cat.id
        ORDER BY b.name
      `);
    } else {
      businesses = await pool.query(`
        SELECT b.id, b.name, b.logo_url, b.cover_image_url,
               c.name as city_name, cat.name as category_name,
               (SELECT COUNT(*) FROM offers WHERE business_id = b.id AND is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)) as active_offers
        FROM businesses b
        JOIN user_businesses ub ON ub.business_id = b.id AND ub.user_id = $1
        LEFT JOIN cities c ON b.city_id = c.id
        LEFT JOIN categories cat ON b.category_id = cat.id
        ORDER BY b.name
      `, [req.webUser.id]);
    }

    res.render("public/portal/dashboard", {
      businesses: businesses.rows,
      activePage: "portal",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Portal dashboard error:", err);
    res.status(500).send("Eroare la încărcarea portalului");
  }
});

// Portal — manage business page (tabs: Info / Oferte / Recenzii / Statistici)
router.get("/portal/:businessId", requireBusinessOwner, attachTier(), async (req, res) => {
  try {
    const { businessId } = req.params;

    // Business details
    const bizRes = await pool.query(`
      SELECT b.id, b.name, b.description, b.address, b.phone, b.website, b.lat, b.lng,
             b.logo_url, b.cover_image_url,
             b.booking_type, b.booking_phone, b.booking_whatsapp, b.booking_url, b.booking_instructions,
             b.city_id, c.name as city_name, b.category_id, cat.name as category_name,
             b.competitor_blocking_enabled
      FROM businesses b
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      WHERE b.id = $1
    `, [businessId]);

    if (bizRes.rows.length === 0) {
      return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });
    }

    const business = bizRes.rows[0];

    // Gallery images
    const imagesRes = await pool.query(
      "SELECT id, image_url, sort_order FROM business_images WHERE business_id = $1 ORDER BY sort_order, id",
      [businessId]
    );
    business.images = imagesRes.rows.map(img => ({
      id: img.id,
      url: img.image_url,
      sort_order: img.sort_order
    }));

    // Offers
    const offersRes = await pool.query(`
      SELECT id, title, discount_type, discount_value, start_date, end_date, is_active, logo_url
      FROM offers WHERE business_id = $1 ORDER BY id DESC
    `, [businessId]);

    // Reviews (first 20 with responses)
    const reviewsRes = await pool.query(`
      SELECT r.id, r.rating, r.comment, r.created_at,
             u.first_name, u.last_name,
             rr.id as response_id, rr.response_text, rr.created_at as response_date
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN review_responses rr ON rr.review_id = r.id
      WHERE r.business_id = $1
      ORDER BY r.created_at DESC
      LIMIT 50
    `, [businessId]);

    const reviewCountRes = await pool.query("SELECT COUNT(*) as total FROM reviews WHERE business_id = $1", [businessId]);
    const reviewCount = parseInt(reviewCountRes.rows[0].total);

    // Analytics
    const [viewsRes, subscribersRes, reviewStatsRes, offerStatsRes, ratingRes, offerViewsRes, offerRequestsRes, codeRevealsRes, clicksRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total_views,
                  COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '7 days') as views_7d,
                  COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '30 days') as views_30d,
                  COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '14 days' AND viewed_at < NOW() - INTERVAL '7 days') as views_prev_7d
                  FROM business_views WHERE business_id = $1`, [businessId]),
      pool.query("SELECT COUNT(*) as total FROM followed_businesses WHERE business_id = $1", [businessId]),
      pool.query("SELECT COUNT(*) as total, COALESCE(AVG(rating), 0) as avg_rating FROM reviews WHERE business_id = $1", [businessId]),
      pool.query(`SELECT COUNT(*) as total,
                  COUNT(*) FILTER (WHERE is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)) as active
                  FROM offers WHERE business_id = $1`, [businessId]),
      pool.query("SELECT rating, COUNT(*) as count FROM reviews WHERE business_id = $1 GROUP BY rating ORDER BY rating DESC", [businessId]),
      pool.query(`SELECT COALESCE(COUNT(*), 0) as total FROM offer_views
                  WHERE business_id = $1 AND viewed_at >= NOW() - INTERVAL '30 days'`, [businessId]),
      pool.query(`SELECT COUNT(*) as total_requests,
                  COUNT(DISTINCT user_id) as unique_requesters,
                  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as requests_7d,
                  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as requests_30d
                  FROM offer_requests WHERE business_id = $1`, [businessId]),
      pool.query(`SELECT COUNT(*) as total,
                  COUNT(*) FILTER (WHERE revealed_at >= NOW() - INTERVAL '30 days') as last_30d
                  FROM code_reveals cr JOIN offers o ON cr.offer_id = o.id WHERE o.business_id = $1`, [businessId]),
      pool.query(`SELECT action_type, COUNT(*) as total,
                  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as last_30d
                  FROM business_clicks WHERE business_id = $1
                  GROUP BY action_type ORDER BY total DESC`, [businessId]),
    ]);

    const distribution = [5, 4, 3, 2, 1].map(star => {
      const found = ratingRes.rows.find(r => parseInt(r.rating) === star);
      return { rating: star, count: parseInt(found?.count || 0) };
    });

    const offerRequestStats = offerRequestsRes.rows[0];
    const codeRevealStats = codeRevealsRes.rows[0];

    const clicksBreakdown = clicksRes.rows.map(r => ({
      action: r.action_type,
      total: parseInt(r.total) || 0,
      last30d: parseInt(r.last_30d) || 0,
    }));
    const clicksTotal = clicksBreakdown.reduce((sum, c) => sum + c.total, 0);
    const clicksLast30d = clicksBreakdown.reduce((sum, c) => sum + c.last30d, 0);

    const analytics = {
      views: {
        total: parseInt(viewsRes.rows[0].total_views) || 0,
        last_7d: parseInt(viewsRes.rows[0].views_7d) || 0,
        last_30d: parseInt(viewsRes.rows[0].views_30d) || 0,
        prev_7d: parseInt(viewsRes.rows[0].views_prev_7d) || 0,
      },
      subscribers: parseInt(subscribersRes.rows[0].total) || 0,
      reviews: {
        total: parseInt(reviewStatsRes.rows[0].total) || 0,
        avg_rating: parseFloat(parseFloat(reviewStatsRes.rows[0].avg_rating).toFixed(1)),
        distribution,
      },
      offers: {
        total: parseInt(offerStatsRes.rows[0].total) || 0,
        active: parseInt(offerStatsRes.rows[0].active) || 0,
        total_views_30d: parseInt(offerViewsRes.rows[0].total) || 0,
      },
      offerRequests: {
        total: parseInt(offerRequestStats.total_requests) || 0,
        uniqueRequesters: parseInt(offerRequestStats.unique_requesters) || 0,
        last7d: parseInt(offerRequestStats.requests_7d) || 0,
        last30d: parseInt(offerRequestStats.requests_30d) || 0,
      },
      codeReveals: {
        total: parseInt(codeRevealStats.total) || 0,
        last30d: parseInt(codeRevealStats.last_30d) || 0,
      },
      clicks: {
        total: clicksTotal,
        last30d: clicksLast30d,
        breakdown: clicksBreakdown,
      },
    };

    // Performance Score
    const [scoreImgRes, scoreOffRes, scoreRevRes, scoreRespRes, scoreSubRes] = await Promise.all([
      pool.query("SELECT COUNT(*) as cnt FROM business_images WHERE business_id = $1", [businessId]),
      pool.query("SELECT COUNT(*) as cnt FROM offers WHERE business_id = $1 AND is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)", [businessId]),
      pool.query("SELECT COUNT(*) as total, COALESCE(AVG(rating), 0) as avg_rating FROM reviews WHERE business_id = $1", [businessId]),
      pool.query(`SELECT (SELECT COUNT(*) FROM reviews WHERE business_id = $1) as total_reviews,
                         (SELECT COUNT(*) FROM review_responses WHERE business_id = $1) as total_responses`, [businessId]),
      pool.query("SELECT COUNT(*) as cnt FROM followed_businesses WHERE business_id = $1", [businessId]),
    ]);

    const activeOffers = parseInt(scoreOffRes.rows[0].cnt);
    const totalReviews = parseInt(scoreRevRes.rows[0].total);
    const avgRating = parseFloat(scoreRevRes.rows[0].avg_rating);
    const totalResponses = parseInt(scoreRespRes.rows[0].total_responses);
    const totalReviewsForResp = parseInt(scoreRespRes.rows[0].total_reviews);
    const subscribers = parseInt(scoreSubRes.rows[0].cnt);
    const responseRate = totalReviewsForResp > 0 ? totalResponses / totalReviewsForResp : 0;

    const breakdown = [
      { criterion: "Logo", points: 10, earned: business.logo_url ? 10 : 0, completed: !!business.logo_url, tip: !business.logo_url ? "Adaugă un logo" : null },
      { criterion: "Cover", points: 15, earned: business.cover_image_url ? 15 : 0, completed: !!business.cover_image_url, tip: !business.cover_image_url ? "Adaugă o imagine de cover" : null },
      { criterion: "Telefon", points: 5, earned: business.phone ? 5 : 0, completed: !!business.phone, tip: !business.phone ? "Completează telefonul" : null },
      { criterion: "Website", points: 5, earned: business.website ? 5 : 0, completed: !!business.website, tip: !business.website ? "Adaugă un website" : null },
      { criterion: "Rezervări", points: 10, earned: (business.booking_type && business.booking_type !== "none") ? 10 : 0, completed: !!(business.booking_type && business.booking_type !== "none"), tip: (!business.booking_type || business.booking_type === "none") ? "Configurează rezervările" : null },
      { criterion: "Ofertă activă", points: 15, earned: activeOffers > 0 ? 15 : 0, completed: activeOffers > 0, tip: activeOffers === 0 ? "Creează o ofertă activă" : null },
      { criterion: "Rating ≥ 4.0", points: 10, earned: avgRating >= 4.0 ? 10 : 0, completed: avgRating >= 4.0, tip: avgRating < 4.0 ? "Îmbunătățește experiența clienților" : null },
      { criterion: "5+ recenzii", points: 10, earned: totalReviews >= 5 ? 10 : 0, completed: totalReviews >= 5, tip: totalReviews < 5 ? "Mai ai nevoie de " + (5 - totalReviews) + " recenzii" : null },
      { criterion: "80%+ răspunsuri", points: 10, earned: responseRate >= 0.8 ? 10 : 0, completed: responseRate >= 0.8, tip: responseRate < 0.8 ? "Răspunde la recenzii" : null },
      { criterion: "10+ abonați", points: 10, earned: subscribers >= 10 ? 10 : 0, completed: subscribers >= 10, tip: subscribers < 10 ? "Mai ai nevoie de " + (10 - subscribers) + " abonați" : null },
    ];
    const totalScore = breakdown.reduce((sum, item) => sum + item.earned, 0);
    const score = { score: totalScore, max_score: 100, breakdown };

    // Cities, categories & locations for edit form
    const [citiesRes, categoriesRes, locationsRes] = await Promise.all([
      pool.query("SELECT id, name FROM cities ORDER BY name"),
      pool.query("SELECT id, name FROM categories ORDER BY name"),
      pool.query(
        `SELECT bl.id, bl.address, bl.phone, bl.lat, bl.lng, bl.maps_url, bl.city_id,
                c.name AS city_name
         FROM business_locations bl
         LEFT JOIN cities c ON bl.city_id = c.id
         WHERE bl.business_id = $1
         ORDER BY bl.id`,
        [businessId]
      ),
    ]);

    // Fetch active nominations for this business (for Deal of the Day feature)
    let nominations = [];
    let canNominate = true;
    let nextNominationAt = null;
    try {
      const nomResult = await pool.query(`
        SELECT dn.id, dn.offer_id, dn.status, dn.selected_for_date, dn.nominated_at
        FROM deal_nominations dn
        WHERE dn.business_id = $1
          AND dn.status IN ('pending', 'selected')
        ORDER BY dn.nominated_at DESC
      `, [businessId]);
      nominations = nomResult.rows;

      const lastNom = await pool.query(`
        SELECT nominated_at FROM deal_nominations
        WHERE business_id = $1
          AND nominated_at > NOW() - INTERVAL '7 days'
          AND status IN ('pending', 'selected')
        ORDER BY nominated_at DESC
        LIMIT 1
      `, [businessId]);
      if (lastNom.rows.length > 0) {
        canNominate = false;
        const next = new Date(lastNom.rows[0].nominated_at);
        next.setDate(next.getDate() + 7);
        nextNominationAt = next.toISOString();
      }
    } catch (e) { /* nominations are non-critical */ }

    res.render("public/portal/manage", {
      business,
      offers: offersRes.rows,
      reviews: reviewsRes.rows,
      reviewCount,
      analytics,
      score,
      cities: citiesRes.rows,
      categories: categoriesRes.rows,
      locations: locationsRes.rows,
      activePage: "portal",
      webUser: req.webUser,
      loadChartJs: true,
      tier: req.tier || { tier: 'free', plan: {} },
      nominations,
      canNominate,
      nextNominationAt,
      competitorBlockingEnabled: business.competitor_blocking_enabled,
    });
  } catch (err) {
    console.error("[Web] Portal manage error:", err);
    res.status(500).send("Eroare la încărcarea paginii de management");
  }
});

// Portal — new offer form
router.get("/portal/:businessId/oferta-noua", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId } = req.params;
    const [bizRes, locsRes] = await Promise.all([
      pool.query("SELECT id, name FROM businesses WHERE id = $1", [businessId]),
      pool.query(
        `SELECT bl.id, bl.address, c.name AS city_name
         FROM business_locations bl LEFT JOIN cities c ON bl.city_id = c.id
         WHERE bl.business_id = $1 ORDER BY bl.id`,
        [businessId]
      ),
    ]);
    if (bizRes.rows.length === 0) return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });

    res.render("public/portal/offer-form", {
      business: bizRes.rows[0],
      offer: null,
      locations: locsRes.rows,
      selectedLocationIds: [],
      activePage: "portal",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Portal new offer error:", err);
    res.status(500).send("Eroare");
  }
});

// Portal — edit offer form
router.get("/portal/:businessId/oferta/:offerId", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId, offerId } = req.params;
    const bizRes = await pool.query("SELECT id, name FROM businesses WHERE id = $1", [businessId]);
    if (bizRes.rows.length === 0) return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });

    const [offerRes, promoCodesRes, locsRes, offerLocsRes] = await Promise.all([
      pool.query(
        "SELECT id, title, description, discount_type, discount_value, conditions, start_date, end_date, is_active, logo_url, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, promo_code FROM offers WHERE id = $1 AND business_id = $2",
        [offerId, businessId]
      ),
      pool.query(
        "SELECT id, code, is_active FROM promo_codes WHERE offer_id = $1 ORDER BY id",
        [offerId]
      ),
      pool.query(
        `SELECT bl.id, bl.address, c.name AS city_name
         FROM business_locations bl LEFT JOIN cities c ON bl.city_id = c.id
         WHERE bl.business_id = $1 ORDER BY bl.id`,
        [businessId]
      ),
      pool.query(
        "SELECT location_id FROM offer_locations WHERE offer_id = $1",
        [offerId]
      ),
    ]);

    if (offerRes.rows.length === 0) return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });

    res.render("public/portal/offer-form", {
      business: bizRes.rows[0],
      offer: offerRes.rows[0],
      promoCodes: promoCodesRes.rows,
      locations: locsRes.rows,
      selectedLocationIds: offerLocsRes.rows.map(r => r.location_id),
      activePage: "portal",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Portal edit offer error:", err);
    res.status(500).send("Eroare");
  }
});

// ═══════════════════════════════════════════════════════
// BUSINESS PORTAL AJAX ENDPOINTS
// ═══════════════════════════════════════════════════════

// Upload logo
router.post("/api/web/portal/:businessId/logo", requireBusinessOwner, requireFeature('can_upload_logo'), portalUpload.single("logo"), async (req, res) => {
  try {
    const { businessId } = req.params;
    if (!req.file) return res.status(400).json({ message: "Niciun fișier" });

    const oldRes = await pool.query("SELECT logo_url FROM businesses WHERE id = $1", [businessId]);
    if (oldRes.rows[0]?.logo_url) {
      const oldId = getPublicIdFromUrl(oldRes.rows[0].logo_url);
      if (oldId) await deleteFromCloudinary(oldId).catch(() => {});
    }

    const result = await uploadToCloudinary(req.file.buffer, "logo");
    await pool.query("UPDATE businesses SET logo_url = $1 WHERE id = $2", [result.url, businessId]);
    res.json({ success: true, url: result.url });
  } catch (err) {
    console.error("[Web API] Portal upload logo error:", err);
    res.status(500).json({ message: "Eroare la upload" });
  }
});

// Upload cover
router.post("/api/web/portal/:businessId/cover", requireBusinessOwner, requireFeature('can_upload_cover'), portalUpload.single("cover"), async (req, res) => {
  try {
    const { businessId } = req.params;
    if (!req.file) return res.status(400).json({ message: "Niciun fișier" });

    const oldRes = await pool.query("SELECT cover_image_url FROM businesses WHERE id = $1", [businessId]);
    if (oldRes.rows[0]?.cover_image_url) {
      const oldId = getPublicIdFromUrl(oldRes.rows[0].cover_image_url);
      if (oldId) await deleteFromCloudinary(oldId).catch(() => {});
    }

    const result = await uploadToCloudinary(req.file.buffer, "cover");
    await pool.query("UPDATE businesses SET cover_image_url = $1 WHERE id = $2", [result.url, businessId]);
    res.json({ success: true, url: result.url });
  } catch (err) {
    console.error("[Web API] Portal upload cover error:", err);
    res.status(500).json({ message: "Eroare la upload" });
  }
});

// Delete logo
router.delete("/api/web/portal/:businessId/logo", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId } = req.params;
    const oldRes = await pool.query("SELECT logo_url FROM businesses WHERE id = $1", [businessId]);
    if (oldRes.rows[0]?.logo_url) {
      const oldId = getPublicIdFromUrl(oldRes.rows[0].logo_url);
      if (oldId) await deleteFromCloudinary(oldId).catch(() => {});
    }
    await pool.query("UPDATE businesses SET logo_url = NULL WHERE id = $1", [businessId]);
    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Portal delete logo error:", err);
    res.status(500).json({ message: "Eroare" });
  }
});

// Delete cover
router.delete("/api/web/portal/:businessId/cover", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId } = req.params;
    const oldRes = await pool.query("SELECT cover_image_url FROM businesses WHERE id = $1", [businessId]);
    if (oldRes.rows[0]?.cover_image_url) {
      const oldId = getPublicIdFromUrl(oldRes.rows[0].cover_image_url);
      if (oldId) await deleteFromCloudinary(oldId).catch(() => {});
    }
    await pool.query("UPDATE businesses SET cover_image_url = NULL WHERE id = $1", [businessId]);
    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Portal delete cover error:", err);
    res.status(500).json({ message: "Eroare" });
  }
});

// Upload gallery image (atomic count check to prevent race condition)
router.post("/api/web/portal/:businessId/gallery", requireBusinessOwner, requireLimit('max_gallery_images', countGalleryImages), portalUpload.single("image"), async (req, res) => {
  const client = await pool.connect();
  try {
    const { businessId } = req.params;
    if (!req.file) return res.status(400).json({ message: "Niciun fișier" });

    await client.query("BEGIN");

    // Atomic count check with row lock to prevent race condition
    const countRes = await client.query(
      "SELECT COUNT(*) as cnt FROM business_images WHERE business_id = $1 FOR UPDATE",
      [businessId]
    );
    if (parseInt(countRes.rows[0].cnt) >= 8) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Maximum 8 imagini permise" });
    }

    const result = await uploadToCloudinary(req.file.buffer, "gallery");
    const sortOrder = parseInt(countRes.rows[0].cnt) + 1;
    const insertRes = await client.query(
      "INSERT INTO business_images (business_id, image_url, sort_order) VALUES ($1, $2, $3) RETURNING id",
      [businessId, result.url, sortOrder]
    );

    await client.query("COMMIT");
    res.json({ success: true, image: { id: insertRes.rows[0].id, url: result.url, sort_order: sortOrder } });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Web API] Portal upload gallery error:", err);
    res.status(500).json({ message: "Eroare la upload" });
  } finally {
    client.release();
  }
});

// Delete gallery image
router.delete("/api/web/portal/:businessId/gallery/:imageId", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId, imageId } = req.params;
    const imgRes = await pool.query(
      "SELECT image_url FROM business_images WHERE id = $1 AND business_id = $2",
      [imageId, businessId]
    );
    if (imgRes.rows.length === 0) return res.status(404).json({ message: "Imaginea nu a fost găsită" });

    const oldId = getPublicIdFromUrl(imgRes.rows[0].image_url);
    if (oldId) await deleteFromCloudinary(oldId).catch(() => {});

    await pool.query("DELETE FROM business_images WHERE id = $1 AND business_id = $2", [imageId, businessId]);
    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Portal delete gallery error:", err);
    res.status(500).json({ message: "Eroare la ștergere" });
  }
});

// =====================================
//   PARSE GOOGLE MAPS LINK
// =====================================
router.post("/api/web/parse-maps-link", requireWebAuth, mapsParseLimiter, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "URL lipsă" });

    const result = await parseMapsLink(url);
    if (result.error) {
      return res.status(422).json({ error: result.error });
    }
    res.json({ lat: result.lat, lng: result.lng, mapsUrl: result.mapsUrl });
  } catch (err) {
    console.error("[Web API] Parse maps link error:", err);
    res.status(500).json({ error: "Eroare la parsarea link-ului" });
  }
});

// =====================================
//   LOCATION CRUD (Business Portal)
// =====================================

// Helper: parse lat/lng with European comma→dot conversion
function toNullableFloat(v) {
  if (v === "" || v == null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// CREATE location
router.post("/api/web/portal/:businessId/locations", requireBusinessOwner, requireLimit('max_locations', countLocations), async (req, res) => {
  try {
    const { businessId } = req.params;
    const { address, city_id, phone, lat, lng, maps_url } = req.body || {};

    if (!address || !city_id) {
      return res.status(400).json({ message: "Adresa și orașul sunt obligatorii" });
    }

    const result = await pool.query(
      `INSERT INTO business_locations (business_id, city_id, address, phone, lat, lng, maps_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [businessId, parseInt(city_id), address.trim(), phone || null, toNullableFloat(lat), toNullableFloat(lng), maps_url || null]
    );

    res.json({ success: true, locationId: result.rows[0].id, message: "Locație adăugată!" });
  } catch (err) {
    console.error("[Web API] Portal create location error:", err);
    res.status(500).json({ message: "Eroare la adăugarea locației" });
  }
});

// UPDATE location
router.put("/api/web/portal/:businessId/locations/:locId", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId, locId } = req.params;
    const { address, city_id, phone, lat, lng, maps_url } = req.body || {};

    if (!address || !city_id) {
      return res.status(400).json({ message: "Adresa și orașul sunt obligatorii" });
    }

    const result = await pool.query(
      `UPDATE business_locations SET
        address = $1, city_id = $2, phone = $3, lat = $4, lng = $5, maps_url = $6, updated_at = NOW()
       WHERE id = $7 AND business_id = $8
       RETURNING id`,
      [address.trim(), parseInt(city_id), phone || null, toNullableFloat(lat), toNullableFloat(lng), maps_url || null, locId, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Locația nu a fost găsită" });
    }

    res.json({ success: true, message: "Locație actualizată!" });
  } catch (err) {
    console.error("[Web API] Portal update location error:", err);
    res.status(500).json({ message: "Eroare la actualizarea locației" });
  }
});

// DELETE location
router.delete("/api/web/portal/:businessId/locations/:locId", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId, locId } = req.params;

    // Check how many offers reference this location
    const offerCheck = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM offer_locations WHERE location_id = $1`,
      [locId]
    );
    const affectedOffers = offerCheck.rows[0].cnt;

    // Delete the location (offer_locations rows cascade-delete automatically)
    const result = await pool.query(
      `DELETE FROM business_locations WHERE id = $1 AND business_id = $2 RETURNING id`,
      [locId, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Locația nu a fost găsită" });
    }

    const msg = affectedOffers > 0
      ? `Locație ștearsă. ${affectedOffers} ${affectedOffers === 1 ? 'ofertă a fost actualizată' : 'oferte au fost actualizate'}.`
      : "Locație ștearsă!";

    res.json({ success: true, message: msg, affectedOffers });
  } catch (err) {
    console.error("[Web API] Portal delete location error:", err);
    res.status(500).json({ message: "Eroare la ștergerea locației" });
  }
});

// Update business info
router.put("/api/web/portal/:businessId", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { name, description, address, phone, website, city_id, category_id, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions } = req.body || {};

    const sanitizedDesc = description !== undefined ? (description || '').substring(0, 2000) || null : undefined;
    const bookingGated = process.env.TIER_GATING_ENABLED === 'true' && req.tier && !req.tier.plan.has_booking;

    if (bookingGated) {
      await pool.query(`
        UPDATE businesses SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          address = COALESCE($3, address),
          phone = COALESCE($4, phone),
          website = COALESCE($5, website),
          city_id = COALESCE($6, city_id),
          category_id = COALESCE($7, category_id)
        WHERE id = $8
      `, [name, sanitizedDesc, address, phone, website, city_id ? parseInt(city_id) : null, category_id ? parseInt(category_id) : null, businessId]);
    } else {
      await pool.query(`
        UPDATE businesses SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          address = COALESCE($3, address),
          phone = COALESCE($4, phone),
          website = COALESCE($5, website),
          city_id = COALESCE($6, city_id),
          category_id = COALESCE($7, category_id),
          booking_type = COALESCE($8, booking_type),
          booking_phone = $9,
          booking_whatsapp = $10,
          booking_url = $11,
          booking_instructions = $12
        WHERE id = $13
      `, [name, sanitizedDesc, address, phone, website, city_id ? parseInt(city_id) : null, category_id ? parseInt(category_id) : null,
          booking_type, booking_phone || null, booking_whatsapp || null, booking_url || null, booking_instructions || null, businessId]);
    }

    res.json({ success: true, message: "Business actualizat!" });
  } catch (err) {
    console.error("[Web API] Portal update business error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// Create offer
router.post("/api/web/portal/:businessId/offers", requireBusinessOwner, requireLimit('max_active_offers', countActiveOffers), async (req, res) => {
  try {
    const { businessId } = req.params;
    const { title, description, discount_type, discount_value, conditions, start_date, end_date, is_active, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, promo_code, promo_codes, max_reveals } = req.body || {};

    if (!title) return res.status(400).json({ message: "Titlul este obligatoriu" });

    // Backward compat: if single promo_code string sent, convert to array
    let promoCodesArr = promo_codes;
    if (!promoCodesArr && promo_code) {
      promoCodesArr = [{ code: promo_code, is_active: true }];
    }

    // Sanitize promo codes
    const sanitizedPromoCodes = promoCodesArr && Array.isArray(promoCodesArr)
      ? promoCodesArr.map(pc => ({
          code: sanitizeString(pc.code?.trim(), 100),
          is_active: pc.is_active !== false,
        }))
      : null;

    const { locationIds } = req.body || {};

    const offerId = await offerService.createOffer(pool, {
      businessId: parseInt(businessId),
      title: sanitizeString(title, 200),
      description: sanitizeString(description, 2000),
      discountType: discount_type || 'percentage',
      discountValue: discount_value || 0,
      conditions: sanitizeString(conditions, 2000),
      startDate: start_date,
      endDate: end_date,
      isActive: is_active !== false,
      bookingType: booking_type,
      bookingPhone: booking_phone,
      bookingWhatsapp: booking_whatsapp,
      bookingUrl: booking_url,
      bookingInstructions: sanitizeString(booking_instructions, 500),
      promoCodes: sanitizedPromoCodes,
      maxReveals: max_reveals ? parseInt(max_reveals) : null,
      sendWebhook: false, // Web portal doesn't send webhook
      tier: req.tier || null, // W11: Pass pre-fetched tier to avoid redundant DB query
    });

    // Sync offer_locations (empty array = valid everywhere, non-empty = specific locations)
    if (Array.isArray(locationIds) && locationIds.length > 0) {
      for (const locId of locationIds) {
        await pool.query(
          'INSERT INTO offer_locations (offer_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [offerId, parseInt(locId)]
        );
      }
    }

    res.json({ success: true, offer_id: offerId });
  } catch (err) {
    console.error("[Web API] Portal create offer error:", err);
    if (err.message === 'promo_code_limit' && err.details) {
      return res.status(err.statusCode || 403).json(err.details);
    }
    res.status(500).json({ message: "Eroare server" });
  }
});

// Update offer
router.put("/api/web/portal/:businessId/offers/:offerId", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId, offerId } = req.params;
    const { title, description, discount_type, discount_value, conditions, start_date, end_date, is_active, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, promo_code, promo_codes, max_reveals } = req.body || {};

    await pool.query(`
      UPDATE offers SET
        title = COALESCE($1, title),
        description = $2,
        discount_type = COALESCE($3, discount_type),
        discount_value = COALESCE($4, discount_value),
        conditions = $5,
        start_date = COALESCE($6, start_date),
        end_date = COALESCE($7, end_date),
        is_active = COALESCE($8, is_active),
        booking_type = COALESCE($9, booking_type),
        booking_phone = $10, booking_whatsapp = $11, booking_url = $12, booking_instructions = $13,
        max_reveals = $16
      WHERE id = $14 AND business_id = $15
    `, [sanitizeString(title, 200), sanitizeString(description, 2000) || null,
        discount_type, discount_value || 0, sanitizeString(conditions, 2000) || null,
        start_date || null, end_date || null, is_active,
        booking_type || 'inherit', booking_phone || null, booking_whatsapp || null, booking_url || null, sanitizeString(booking_instructions, 500) || null,
        offerId, businessId, max_reveals ? parseInt(max_reveals) : null]);

    // Backward compat: if single promo_code string sent, convert to array
    let promoCodesArr = promo_codes;
    if (promoCodesArr === undefined && promo_code !== undefined) {
      promoCodesArr = promo_code ? [{ code: promo_code, is_active: true }] : [];
    }

    // Handle promo codes update if provided
    if (promoCodesArr !== undefined) {
      // Delete existing codes and re-insert
      await pool.query("DELETE FROM promo_codes WHERE offer_id = $1", [offerId]);

      if (Array.isArray(promoCodesArr)) {
        const validCodes = promoCodesArr.filter(pc => pc.code && pc.code.trim());
        for (const pc of validCodes) {
          await pool.query(
            "INSERT INTO promo_codes (offer_id, code, is_active) VALUES ($1, $2, $3)",
            [offerId, sanitizeString(pc.code.trim(), 100), pc.is_active !== false]
          );
        }
      }
    }

    // Sync offer_locations if provided
    const { locationIds } = req.body || {};
    if (Array.isArray(locationIds)) {
      await pool.query('DELETE FROM offer_locations WHERE offer_id = $1', [offerId]);
      if (locationIds.length > 0) {
        for (const locId of locationIds) {
          await pool.query(
            'INSERT INTO offer_locations (offer_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [offerId, parseInt(locId)]
          );
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Portal update offer error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// Delete offer
router.delete("/api/web/portal/:businessId/offers/:offerId", requireBusinessOwner, async (req, res) => {
  try {
    await pool.query("DELETE FROM offers WHERE id = $1 AND business_id = $2", [req.params.offerId, req.params.businessId]);
    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Portal delete offer error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// Toggle offer active (C7: wrapped in transaction with tier limit check)
router.patch("/api/web/portal/:businessId/offers/:offerId/toggle", requireBusinessOwner, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the offer row to prevent concurrent toggles
    const current = await client.query(
      "SELECT is_active FROM offers WHERE id = $1 AND business_id = $2 FOR UPDATE",
      [req.params.offerId, req.params.businessId]
    );
    if (current.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Ofertă negăsită" });
    }

    const isCurrentlyActive = current.rows[0].is_active;

    // If activating, check tier limit atomically
    if (!isCurrentlyActive && process.env.TIER_GATING_ENABLED === 'true' && req.tier) {
      const limit = req.tier.plan.max_active_offers;
      if (limit !== null) {
        const countRes = await client.query(
          "SELECT COUNT(*)::int AS cnt FROM offers WHERE business_id = $1 AND is_active = true",
          [req.params.businessId]
        );
        if (countRes.rows[0].cnt >= limit) {
          await client.query("ROLLBACK");
          return res.status(403).json({
            error: 'limit_reached',
            message: `Ai atins limita de ${limit} oferte active pentru planul ${req.tier.plan.name}.`,
          });
        }
      }
    }

    const result = await client.query(
      "UPDATE offers SET is_active = NOT is_active WHERE id = $1 AND business_id = $2 RETURNING is_active",
      [req.params.offerId, req.params.businessId]
    );

    await client.query("COMMIT");
    res.json({ success: true, is_active: result.rows[0].is_active });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Web API] Portal toggle offer error:", err);
    res.status(500).json({ message: "Eroare server" });
  } finally {
    client.release();
  }
});

// Respond to review
router.post("/api/web/portal/:businessId/reviews/:reviewId/respond", requireBusinessOwner, requireFeature('can_respond_reviews'), async (req, res) => {
  try {
    const { businessId, reviewId } = req.params;
    const responseText = sanitizeString(req.body.response_text, 500);
    if (!responseText) return res.status(400).json({ message: "Răspunsul nu poate fi gol" });

    const reviewCheck = await pool.query("SELECT id FROM reviews WHERE id = $1 AND business_id = $2", [reviewId, businessId]);
    if (reviewCheck.rows.length === 0) return res.status(404).json({ message: "Recenzia nu există" });

    const existing = await pool.query("SELECT id FROM review_responses WHERE review_id = $1", [reviewId]);
    if (existing.rows.length > 0) return res.status(409).json({ message: "Există deja un răspuns" });

    const result = await pool.query(
      "INSERT INTO review_responses (review_id, business_id, response_text, responded_by) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
      [reviewId, businessId, responseText, req.webUser.id]
    );

    res.status(201).json({ success: true, response: { id: result.rows[0].id, text: responseText, created_at: result.rows[0].created_at } });
  } catch (err) {
    console.error("[Web API] Portal respond review error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// Edit review response
router.put("/api/web/portal/:businessId/reviews/:reviewId/respond", requireBusinessOwner, requireFeature('can_respond_reviews'), async (req, res) => {
  try {
    const responseText = sanitizeString(req.body.response_text, 500);
    if (!responseText) return res.status(400).json({ message: "Răspunsul nu poate fi gol" });

    const result = await pool.query(
      "UPDATE review_responses SET response_text = $1, updated_at = NOW() WHERE review_id = $2 AND business_id = $3 RETURNING id",
      [responseText, req.params.reviewId, req.params.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Răspunsul nu există" });

    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Portal edit response error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// Delete review response
router.delete("/api/web/portal/:businessId/reviews/:reviewId/respond", requireBusinessOwner, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM review_responses WHERE review_id = $1 AND business_id = $2 RETURNING id",
      [req.params.reviewId, req.params.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Răspunsul nu există" });
    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Portal delete response error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// ==========================================
// DELETE /api/web/reviews/:id - Sterge propria recenzie (web auth)
// ==========================================
router.delete("/api/web/reviews/:id", requireWebAuth, async (req, res) => {
  const { id } = req.params;
  const user_id = req.webUser.id;

  try {
    const review = await pool.query(
      "SELECT id, user_id, business_id FROM reviews WHERE id = $1",
      [id]
    );

    if (review.rows.length === 0) {
      return res.status(404).json({ error: "Recenzia nu exista." });
    }

    if (review.rows[0].user_id !== user_id) {
      return res.status(403).json({ error: "Nu poti sterge aceasta recenzie." });
    }

    // Delete review (CASCADE sterge si review_responses)
    await pool.query("DELETE FROM reviews WHERE id = $1", [id]);

    res.status(204).send();
  } catch (err) {
    console.error("[Web API] Delete review error:", err);
    res.status(500).json({ error: "Eroare server la stergerea recenziei." });
  }
});

// Analytics views timeline (W4: added requireFeature gate to match mobile routes)
router.get("/api/web/portal/:businessId/analytics/views", requireBusinessOwner, requireFeature('has_analytics_charts'), async (req, res) => {
  try {
    const { businessId } = req.params;
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 90);

    const result = await pool.query(
      `SELECT DATE(viewed_at) as date, COUNT(*) as views
       FROM business_views WHERE business_id = $1 AND viewed_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY DATE(viewed_at) ORDER BY date ASC`,
      [businessId, days]
    );

    const filledData = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const found = result.rows.find(r => {
        const rDate = r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date);
        return rDate === dateStr;
      });
      filledData.push({ date: dateStr, views: parseInt(found?.views || 0) });
    }

    res.json({ days, data: filledData });
  } catch (err) {
    console.error("[Web API] Portal views error:", err);
    res.status(500).json({ message: "Eroare" });
  }
});

// Analytics offer-views timeline (W4: added requireFeature gate to match mobile routes)
router.get("/api/web/portal/:businessId/analytics/offer-views", requireBusinessOwner, requireFeature('has_analytics_charts'), async (req, res) => {
  try {
    const { businessId } = req.params;
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 90);
    const offerId = parseInt(req.query.offer_id);

    if (!offerId || isNaN(offerId)) {
      return res.status(400).json({ message: "offer_id este obligatoriu" });
    }

    const ownerCheck = await pool.query(
      "SELECT id FROM offers WHERE id = $1 AND business_id = $2",
      [offerId, businessId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ message: "Oferta nu a fost găsită" });
    }

    const result = await pool.query(
      `SELECT DATE(viewed_at) as date, COUNT(*) as views
       FROM offer_views WHERE offer_id = $1 AND viewed_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY DATE(viewed_at) ORDER BY date ASC`,
      [offerId, days]
    );

    const filledData = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const found = result.rows.find(r => {
        const rDate = r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date);
        return rDate === dateStr;
      });
      filledData.push({ date: dateStr, views: parseInt(found?.views || 0) });
    }

    res.json({ days, data: filledData });
  } catch (err) {
    console.error("[Web API] Portal offer-views error:", err);
    res.status(500).json({ message: "Eroare" });
  }
});

// Analytics subscribers timeline (W4: added requireFeature gate to match mobile routes)
router.get("/api/web/portal/:businessId/analytics/subscribers", requireBusinessOwner, requireFeature('has_analytics_charts'), async (req, res) => {
  try {
    const { businessId } = req.params;
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 90);

    const [trendRes, totalRes] = await Promise.all([
      pool.query(
        `SELECT DATE(created_at) as date, COUNT(*) as new_subscribers
         FROM followed_businesses WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2
         GROUP BY DATE(created_at) ORDER BY date ASC`,
        [businessId, days]
      ),
      pool.query("SELECT COUNT(*) as total FROM followed_businesses WHERE business_id = $1", [businessId]),
    ]);

    const data = trendRes.rows.map(r => ({
      date: r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date),
      new_subscribers: parseInt(r.new_subscribers),
    }));

    res.json({ days, total: parseInt(totalRes.rows[0].total) || 0, data });
  } catch (err) {
    console.error("[Web API] Portal subscribers error:", err);
    res.status(500).json({ message: "Eroare" });
  }
});

// Analytics clicks timeline (W4: added requireFeature gate to match mobile routes)
router.get("/api/web/portal/:businessId/analytics/clicks", requireBusinessOwner, requireFeature('has_analytics_charts'), async (req, res) => {
  try {
    const { businessId } = req.params;
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 90);

    const validActionTypes = ['phone', 'whatsapp', 'navigate', 'booking_url'];
    const actionType = validActionTypes.includes(req.query.action_type) ? req.query.action_type : null;

    const params = actionType ? [businessId, days, actionType] : [businessId, days];
    const actionFilter = actionType ? " AND action_type = $3" : "";

    const result = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as clicks
       FROM business_clicks WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2${actionFilter}
       GROUP BY DATE(created_at) ORDER BY date ASC`,
      params
    );

    const filledData = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const found = result.rows.find(r => {
        const rDate = r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date);
        return rDate === dateStr;
      });
      filledData.push({ date: dateStr, clicks: parseInt(found?.clicks || 0) });
    }

    res.json({ days, data: filledData });
  } catch (err) {
    console.error("[Web API] Portal clicks error:", err);
    res.status(500).json({ message: "Eroare" });
  }
});

// ═══════════════════════════════════════════════════════
// ANALYTICS CSV EXPORT (Premium only)
// ═══════════════════════════════════════════════════════

// Helper: fill missing days with 0
function fillMissingDays(rows, days, valueKey) {
  const filled = [];
  const now = new Date();
  const rowMap = {};
  for (const r of rows) {
    const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date);
    rowMap[dateStr] = parseInt(r[valueKey]) || 0;
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    filled.push({ date: dateStr, value: rowMap[dateStr] || 0 });
  }
  return filled;
}

router.get("/api/web/portal/:businessId/analytics/export",
  requireBusinessOwner, requireFeature('has_analytics_export'),
  async (req, res) => {
  try {
    const { businessId } = req.params;
    const type = req.query.type || 'views';
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 90);

    const validTypes = ['views', 'subscribers', 'clicks', 'offer-views', 'code-reveals'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Tip invalid. Optiuni: ' + validTypes.join(', ') });
    }

    let csvRows = [];
    let csvHeader = '';
    let filenameType = type;

    switch (type) {
      case 'views': {
        csvHeader = 'Data,Vizualizari';
        const result = await pool.query(
          `SELECT DATE(viewed_at) as date, COUNT(*) as cnt
           FROM business_views
           WHERE business_id = $1 AND viewed_at >= NOW() - INTERVAL '1 day' * $2
           GROUP BY DATE(viewed_at)
           ORDER BY date ASC`,
          [businessId, days]
        );
        csvRows = fillMissingDays(result.rows, days, 'cnt');
        break;
      }

      case 'subscribers': {
        csvHeader = 'Data,Abonati noi';
        const result = await pool.query(
          `SELECT DATE(created_at) as date, COUNT(*) as cnt
           FROM followed_businesses
           WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2
           GROUP BY DATE(created_at)
           ORDER BY date ASC`,
          [businessId, days]
        );
        csvRows = fillMissingDays(result.rows, days, 'cnt');
        break;
      }

      case 'clicks': {
        const validActionTypes = ['phone', 'whatsapp', 'navigate', 'booking_url'];
        const actionType = validActionTypes.includes(req.query.action_type)
          ? req.query.action_type : null;

        csvHeader = actionType
          ? 'Data,Click-uri (' + actionType + ')'
          : 'Data,Click-uri (toate)';
        filenameType = actionType ? 'clicks-' + actionType : 'clicks';

        const params = actionType
          ? [businessId, days, actionType]
          : [businessId, days];
        const actionFilter = actionType ? ' AND action_type = $3' : '';

        const result = await pool.query(
          `SELECT DATE(created_at) as date, COUNT(*) as cnt
           FROM business_clicks
           WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2${actionFilter}
           GROUP BY DATE(created_at)
           ORDER BY date ASC`,
          params
        );
        csvRows = fillMissingDays(result.rows, days, 'cnt');
        break;
      }

      case 'offer-views': {
        const offerId = parseInt(req.query.offer_id);
        if (!offerId || isNaN(offerId)) {
          return res.status(400).json({ message: 'offer_id este obligatoriu pentru tip offer-views' });
        }
        const ownerCheck = await pool.query(
          'SELECT id, title FROM offers WHERE id = $1 AND business_id = $2',
          [offerId, businessId]
        );
        if (ownerCheck.rows.length === 0) {
          return res.status(404).json({ message: 'Oferta nu a fost gasita' });
        }

        csvHeader = 'Data,Vizualizari oferta';
        filenameType = 'offer-views-' + offerId;

        const result = await pool.query(
          `SELECT DATE(viewed_at) as date, COUNT(*) as cnt
           FROM offer_views
           WHERE offer_id = $1 AND viewed_at >= NOW() - INTERVAL '1 day' * $2
           GROUP BY DATE(viewed_at)
           ORDER BY date ASC`,
          [offerId, days]
        );
        csvRows = fillMissingDays(result.rows, days, 'cnt');
        break;
      }

      case 'code-reveals': {
        csvHeader = 'Data,Coduri dezvaluite';
        const result = await pool.query(
          `SELECT DATE(cr.revealed_at) as date, COUNT(*) as cnt
           FROM code_reveals cr
           JOIN offers o ON cr.offer_id = o.id
           WHERE o.business_id = $1 AND cr.revealed_at >= NOW() - INTERVAL '1 day' * $2
           GROUP BY DATE(cr.revealed_at)
           ORDER BY date ASC`,
          [businessId, days]
        );
        csvRows = fillMissingDays(result.rows, days, 'cnt');
        break;
      }
    }

    // Build CSV string with BOM for Excel Romanian diacritics
    const today = new Date().toISOString().split('T')[0];
    const filename = `analytics-${filenameType}-${today}.csv`;
    const BOM = '\uFEFF';
    let csv = BOM + csvHeader + '\r\n';
    for (const row of csvRows) {
      csv += row.date + ',' + row.value + '\r\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(csv);

  } catch (err) {
    console.error('[Web API] Analytics export error:', err);
    res.status(500).json({ message: 'Eroare la export' });
  }
});

// ═══════════════════════════════════════════════════════
// COMPETITIVE INSIGHTS (Premium only)
// ═══════════════════════════════════════════════════════

// Competitive insights cache (24h TTL)
const competitiveCache = new Map();
const COMPETITIVE_CACHE_TTL = 24 * 60 * 60 * 1000;

router.get("/api/web/portal/:businessId/analytics/competitive",
  requireBusinessOwner, requireFeature('has_competitive_insights'),
  async (req, res) => {
  try {
    const { businessId } = req.params;

    // Check cache
    const cacheKey = `comp_${businessId}`;
    const cached = competitiveCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < COMPETITIVE_CACHE_TTL) {
      return res.json(cached.data);
    }

    // Get business city_id and category_id
    const bizRes = await pool.query(
      'SELECT city_id, category_id FROM businesses WHERE id = $1',
      [businessId]
    );
    if (bizRes.rows.length === 0) {
      return res.status(404).json({ message: 'Business negasit' });
    }
    const { city_id, category_id } = bizRes.rows[0];

    if (!city_id || !category_id) {
      return res.json({
        available: false,
        reason: 'Business-ul nu are oras sau categorie setata.',
      });
    }

    // Count peers in same city+category (excluding self)
    const peersCountRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM businesses
       WHERE city_id = $1 AND category_id = $2 AND id != $3`,
      [city_id, category_id, businessId]
    );
    const peersCount = parseInt(peersCountRes.rows[0].cnt) || 0;

    if (peersCount < 3) {
      return res.json({
        available: false,
        reason: 'Insuficiente date. Trebuie cel putin 3 business-uri similare in orasul tau pentru comparatie.',
        peersCount,
      });
    }

    // Get YOUR metrics
    const [myViewsRes, mySubsRes, myOffersRes, myReviewsRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as cnt FROM business_views
         WHERE business_id = $1 AND viewed_at >= NOW() - INTERVAL '30 days'`,
        [businessId]
      ),
      pool.query(
        'SELECT COUNT(*) as cnt FROM followed_businesses WHERE business_id = $1',
        [businessId]
      ),
      pool.query(
        `SELECT COUNT(*) as cnt FROM offers
         WHERE business_id = $1 AND is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)`,
        [businessId]
      ),
      pool.query(
        `SELECT COUNT(*) as review_count, COALESCE(AVG(rating), 0) as avg_rating
         FROM reviews WHERE business_id = $1`,
        [businessId]
      ),
    ]);

    const myMetrics = {
      views30d: parseInt(myViewsRes.rows[0].cnt) || 0,
      subscribers: parseInt(mySubsRes.rows[0].cnt) || 0,
      activeOffers: parseInt(myOffersRes.rows[0].cnt) || 0,
      avgRating: parseFloat(parseFloat(myReviewsRes.rows[0].avg_rating).toFixed(1)) || 0,
      reviewCount: parseInt(myReviewsRes.rows[0].review_count) || 0,
    };

    // Get PEER AVERAGES (same city + category, excluding self)
    const peerRes = await pool.query(`
      SELECT
        (SELECT COALESCE(AVG(v_cnt), 0) FROM (
          SELECT COUNT(*) as v_cnt
          FROM businesses b2
          LEFT JOIN business_views bv ON bv.business_id = b2.id
            AND bv.viewed_at >= NOW() - INTERVAL '30 days'
          WHERE b2.city_id = $1 AND b2.category_id = $2 AND b2.id != $3
          GROUP BY b2.id
        ) sub_views) as avg_views_30d,

        (SELECT COALESCE(AVG(s_cnt), 0) FROM (
          SELECT COUNT(*) as s_cnt
          FROM businesses b2
          LEFT JOIN followed_businesses fb ON fb.business_id = b2.id
          WHERE b2.city_id = $1 AND b2.category_id = $2 AND b2.id != $3
          GROUP BY b2.id
        ) sub_subs) as avg_subscribers,

        (SELECT COALESCE(AVG(o_cnt), 0) FROM (
          SELECT COUNT(*) as o_cnt
          FROM businesses b2
          LEFT JOIN offers o ON o.business_id = b2.id AND o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
          WHERE b2.city_id = $1 AND b2.category_id = $2 AND b2.id != $3
          GROUP BY b2.id
        ) sub_offers) as avg_active_offers,

        (SELECT COALESCE(AVG(b_avg), 0) FROM (
          SELECT AVG(r.rating) as b_avg
          FROM businesses b2
          JOIN reviews r ON r.business_id = b2.id
          WHERE b2.city_id = $1 AND b2.category_id = $2 AND b2.id != $3
          GROUP BY b2.id
          HAVING COUNT(r.id) >= 1
        ) sub_rating) as avg_rating,

        (SELECT COALESCE(AVG(r_cnt), 0) FROM (
          SELECT COUNT(*) as r_cnt
          FROM businesses b2
          LEFT JOIN reviews r ON r.business_id = b2.id
          WHERE b2.city_id = $1 AND b2.category_id = $2 AND b2.id != $3
          GROUP BY b2.id
        ) sub_review_count) as avg_review_count
    `, [city_id, category_id, businessId]);

    const peer = peerRes.rows[0];
    const peerAvg = {
      views30d: parseFloat(parseFloat(peer.avg_views_30d).toFixed(1)),
      subscribers: parseFloat(parseFloat(peer.avg_subscribers).toFixed(1)),
      activeOffers: parseFloat(parseFloat(peer.avg_active_offers).toFixed(1)),
      avgRating: parseFloat(parseFloat(peer.avg_rating).toFixed(1)),
      reviewCount: parseFloat(parseFloat(peer.avg_review_count).toFixed(1)),
    };

    // Calculate percentage differences
    function pctDiff(mine, avg) {
      if (avg === 0) return mine > 0 ? 100 : 0;
      return Math.round(((mine - avg) / avg) * 100);
    }

    const insights = [
      { metric: 'Vizualizari (30 zile)', yours: myMetrics.views30d, categoryAvg: peerAvg.views30d, diff: pctDiff(myMetrics.views30d, peerAvg.views30d) },
      { metric: 'Abonati', yours: myMetrics.subscribers, categoryAvg: peerAvg.subscribers, diff: pctDiff(myMetrics.subscribers, peerAvg.subscribers) },
      { metric: 'Oferte active', yours: myMetrics.activeOffers, categoryAvg: peerAvg.activeOffers, diff: pctDiff(myMetrics.activeOffers, peerAvg.activeOffers) },
      { metric: 'Rating', yours: myMetrics.avgRating, categoryAvg: peerAvg.avgRating, diff: pctDiff(myMetrics.avgRating, peerAvg.avgRating) },
      { metric: 'Recenzii', yours: myMetrics.reviewCount, categoryAvg: peerAvg.reviewCount, diff: pctDiff(myMetrics.reviewCount, peerAvg.reviewCount) },
    ];

    const responseData = { available: true, peersCount, insights };
    competitiveCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    res.json(responseData);

  } catch (err) {
    console.error('[Web API] Competitive insights error:', err);
    res.status(500).json({ message: 'Eroare la analiza competitiva' });
  }
});

// ═══════════════════════════════════════════════════════
// CUSTOM PUSH NOTIFICATIONS (Premium only)
// ═══════════════════════════════════════════════════════

router.post("/api/web/portal/:businessId/notifications/send",
  requireBusinessOwner, requireFeature('has_custom_push'),
  async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.webUser.id;

    // Validate input
    let { title, message } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ message: 'Titlul este obligatoriu' });
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Mesajul este obligatoriu' });
    }

    title = title.trim().substring(0, 100);
    message = message.trim().substring(0, 300);

    // Rate limit: max 2 custom pushes per week per business
    const rateLimitRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM business_push_log
       WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
      [businessId]
    );
    const pushesThisWeek = parseInt(rateLimitRes.rows[0].cnt) || 0;

    if (pushesThisWeek >= 2) {
      return res.status(429).json({
        message: 'Ai atins limita de 2 notificari pe saptamana. Incearca din nou saptamana viitoare.',
        limit: 2,
        used: pushesThisWeek,
      });
    }

    // Get business name for notification title
    const bizRes = await pool.query(
      'SELECT name FROM businesses WHERE id = $1',
      [businessId]
    );
    if (bizRes.rows.length === 0) {
      return res.status(404).json({ message: 'Business negasit' });
    }
    const businessName = bizRes.rows[0].name;

    // Push title = business name, body = owner's title + message
    const fullTitle = businessName;
    const fullBody = title + (message !== title ? '\n' + message : '');

    // Send push notification to all business followers
    const result = await pushService.sendToBusinessSubscribers(pool, parseInt(businessId), {
      title: fullTitle,
      body: fullBody,
      data: {
        type: 'business_custom_push',
        businessId: String(businessId),
        screen: 'business_detail',
      },
    });

    // Log the push
    await pool.query(
      `INSERT INTO business_push_log
        (business_id, sent_by, title, message, recipients_count, success_count, failure_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        businessId,
        userId,
        title,
        message,
        (result.sent || 0) + (result.failed || 0),
        result.sent || 0,
        result.failed || 0,
      ]
    );

    res.json({
      success: true,
      sent: result.sent || 0,
      failed: result.failed || 0,
      remaining: Math.max(0, 2 - pushesThisWeek - 1),
    });

  } catch (err) {
    console.error('[Web API] Custom push error:', err);
    res.status(500).json({ message: 'Eroare la trimiterea notificarii' });
  }
});

router.get("/api/web/portal/:businessId/notifications/history",
  requireBusinessOwner, requireFeature('has_custom_push'),
  async (req, res) => {
  try {
    const { businessId } = req.params;

    const historyRes = await pool.query(
      `SELECT id, title, message, recipients_count, success_count, failure_count, created_at
       FROM business_push_log
       WHERE business_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [businessId]
    );

    const rateLimitRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM business_push_log
       WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
      [businessId]
    );
    const pushesThisWeek = parseInt(rateLimitRes.rows[0].cnt) || 0;

    res.json({
      history: historyRes.rows.map(row => ({
        id: row.id,
        title: row.title,
        message: row.message,
        recipientsCount: row.recipients_count,
        successCount: row.success_count,
        failureCount: row.failure_count,
        createdAt: row.created_at,
      })),
      rateLimit: {
        limit: 2,
        used: pushesThisWeek,
        remaining: Math.max(0, 2 - pushesThisWeek),
      },
    });

  } catch (err) {
    console.error('[Web API] Push history error:', err);
    res.status(500).json({ message: 'Eroare la istoricul notificarilor' });
  }
});

// ═══════════════════════════════════════════════════════
// SUBSCRIPTION INFO + CANCEL (web portal)
// ═══════════════════════════════════════════════════════

// GET subscription info for web portal (manage.ejs subscription tab)
router.get("/api/web/portal/:businessId/subscription", requireBusinessOwner, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const tierInfo = await getBusinessTier(pool, businessId);
    const { plan, tier, isTrial, subscription } = tierInfo;

    res.json({
      tier,
      plan: {
        slug: plan.slug,
        name: plan.name,
        priceMonthly: plan.price_monthly,
        priceYearly: plan.price_yearly,
        maxActiveOffers: plan.max_active_offers,
        maxGalleryImages: plan.max_gallery_images,
        maxLocations: plan.max_locations,
        maxPromoCodesPerOffer: plan.max_promo_codes_per_offer,
        analyticsDays: plan.analytics_days,
        canRespondReviews: plan.can_respond_reviews,
        canUploadLogo: plan.can_upload_logo,
        canUploadCover: plan.can_upload_cover,
        hasVerifiedBadge: plan.has_verified_badge,
        hasAiSummary: plan.has_ai_summary,
        hasPushOnOffer: plan.has_push_on_offer,
        hasCustomPush: plan.has_custom_push,
        hasAnalyticsCharts: plan.has_analytics_charts,
        hasAnalyticsExport: plan.has_analytics_export,
        hasCompetitiveInsights: plan.has_competitive_insights,
        hasPromotedPlacement: plan.has_promoted_placement,
        hasSearchPriority: plan.has_search_priority,
        hasCompetitorBlocking: plan.has_competitor_blocking,
        hasDealNomination: plan.has_deal_nomination,
        hasBooking: plan.has_booking,
        hasPrioritySupport: plan.has_priority_support,
        badgeType: plan.badge_type,
      },
      isTrial,
      trialEnd: subscription?.trial_end || null,
      periodEnd: subscription?.current_period_end || null,
      cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
    });
  } catch (err) {
    console.error('[Web API] Subscription info error:', err);
    res.status(500).json({ error: 'Eroare server' });
  }
});

// POST cancel subscription for web portal (W9: uses shared subscriptionService)
router.post("/api/web/portal/:businessId/subscription/cancel", requireBusinessOwner, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);
    const { cancelSubscription } = require('../services/subscriptionService');
    const result = await cancelSubscription(pool, businessId, 'web');

    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('[Web API] Cancel subscription error:', err);
    res.status(500).json({ success: false, message: 'Eroare la anularea abonamentului.' });
  }
});

// ═══════════════════════════════════════════════════════
// SEARCH AUTOSUGGEST
// ═══════════════════════════════════════════════════════
router.get("/api/web/search/suggest", searchLimiter, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 2) return res.json({ offers: [], businesses: [] });

    const searchTerm = `%${q}%`;

    const [offersRes, businessesRes] = await Promise.all([
      pool.query(`
        SELECT o.id, o.title, o.discount_type, o.discount_value,
               b.name as business_name
        FROM offers o
        JOIN businesses b ON o.business_id = b.id
        WHERE o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
          AND (o.title ILIKE $1 OR b.name ILIKE $1)
        ORDER BY o.discount_value DESC
        LIMIT 5
      `, [searchTerm]),
      pool.query(`
        SELECT b.id, b.name, b.logo_url, cat.name as category_name
        FROM businesses b
        LEFT JOIN categories cat ON b.category_id = cat.id
        WHERE b.name ILIKE $1
        ORDER BY b.name
        LIMIT 3
      `, [searchTerm]),
    ]);

    res.json({ offers: offersRes.rows, businesses: businessesRes.rows });
  } catch (err) {
    console.error("[Web API] Search suggest error:", err);
    res.json({ offers: [], businesses: [] });
  }
});

// ═══════════════════════════════════════════════════════
// STATIC / LEGAL PAGES
// ═══════════════════════════════════════════════════════
router.get("/termeni", (req, res) => {
  res.render("public/termeni", { activePage: null, webUser: req.webUser });
});

router.get("/confidentialitate", (req, res) => {
  res.render("public/confidentialitate", { activePage: null, webUser: req.webUser });
});

router.get("/ajutor", (req, res) => {
  res.render("public/ajutor", { activePage: null, webUser: req.webUser });
});

router.get("/pentru-business", async (req, res) => {
  try {
    const [citiesResult, categoriesResult] = await Promise.all([
      pool.query("SELECT id, name FROM cities ORDER BY name"),
      pool.query("SELECT id, name FROM categories ORDER BY name"),
    ]);
    res.render("public/pentru-business", {
      activePage: null,
      webUser: req.webUser,
      cities: citiesResult.rows,
      categories: categoriesResult.rows,
    });
  } catch (err) {
    console.error("[Web] Pentru-business error:", err.message);
    res.render("public/pentru-business", {
      activePage: null,
      webUser: req.webUser,
      cities: [],
      categories: [],
    });
  }
});

// ═══════════════════════════════════════════════════════
// BUSINESS REQUESTS API (cookie auth)
// ═══════════════════════════════════════════════════════
const businessRequestsRouter = require("./businessRequests");
router.use("/api/business-requests", businessRequestsRouter);

// ═══════════════════════════════════════════════════════
// AJAX API PROXIES (cookie auth — for client-side JS)
// ═══════════════════════════════════════════════════════

// --- Favorites ---
router.post("/api/web/favorites", requireWebAuth, async (req, res) => {
  try {
    const { offer_id } = req.body;
    if (!offer_id) return res.status(400).json({ message: "offer_id lipsă" });

    await pool.query(
      "INSERT INTO favorite_offers (user_id, offer_id) VALUES ($1, $2) ON CONFLICT (user_id, offer_id) DO NOTHING",
      [req.webUser.id, parseInt(offer_id)]
    );

    // Fire-and-forget: award points + check badges
    const { awardPoints } = require("../services/gamification");
    const { checkAndAwardBadges } = require("../services/badgeService");
    awardPoints(req.webUser.id, "favorite").catch(() => {});
    checkAndAwardBadges(req.webUser.id, ["first_favorite"]).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Add favorite error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

router.delete("/api/web/favorites/:offerId", requireWebAuth, async (req, res) => {
  try {
    const offerId = parseInt(req.params.offerId, 10);
    if (isNaN(offerId)) return res.status(400).json({ message: "ID invalid" });

    await pool.query(
      "DELETE FROM favorite_offers WHERE user_id = $1 AND offer_id = $2",
      [req.webUser.id, offerId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Remove favorite error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// --- Subscriptions (follow/unfollow) ---
router.post("/api/web/subscriptions", requireWebAuth, async (req, res) => {
  try {
    const { business_id } = req.body;
    if (!business_id) return res.status(400).json({ message: "business_id lipsă" });

    await pool.query(
      "INSERT INTO followed_businesses (user_id, business_id) VALUES ($1, $2) ON CONFLICT (user_id, business_id) DO NOTHING",
      [req.webUser.id, parseInt(business_id)]
    );

    // Fire-and-forget: award points + check badges
    const { awardPoints } = require("../services/gamification");
    const { checkAndAwardBadges } = require("../services/badgeService");
    awardPoints(req.webUser.id, "follow").catch(() => {});
    checkAndAwardBadges(req.webUser.id, ["social_butterfly", "loyal_fan"]).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Follow error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

router.delete("/api/web/subscriptions/:businessId", requireWebAuth, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId, 10);
    if (isNaN(businessId)) return res.status(400).json({ message: "ID invalid" });

    await pool.query(
      "DELETE FROM followed_businesses WHERE user_id = $1 AND business_id = $2",
      [req.webUser.id, businessId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Unfollow error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// --- Offer Requests (Pinch) — web cookie auth ---
router.post("/api/web/offer-requests", requireWebAuth, async (req, res) => {
  try {
    const userId = req.webUser.id;
    const { business_id } = req.body;

    if (!business_id) {
      return res.status(400).json({ message: "business_id este obligatoriu" });
    }

    // Check business exists
    const { rows: bizCheck } = await pool.query(
      "SELECT id FROM businesses WHERE id = $1",
      [business_id]
    );
    if (bizCheck.length === 0) {
      return res.status(404).json({ message: "Business-ul nu a fost găsit" });
    }

    // Check rate limit: last request from this user for this business
    const { rows: recent } = await pool.query(
      `SELECT created_at FROM offer_requests
       WHERE user_id = $1 AND business_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [userId, business_id]
    );

    if (recent.length > 0) {
      const lastRequest = new Date(recent[0].created_at);
      const cooldownEnd = new Date(lastRequest.getTime() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();

      if (now < cooldownEnd) {
        const daysLeft = Math.ceil((cooldownEnd - now) / (24 * 60 * 60 * 1000));
        return res.status(429).json({
          message: `Poți cere din nou peste ${daysLeft} ${daysLeft === 1 ? "zi" : "zile"}`,
          daysLeft,
        });
      }
    }

    // Insert request
    await pool.query(
      "INSERT INTO offer_requests (user_id, business_id) VALUES ($1, $2)",
      [userId, business_id]
    );

    // Auto-follow: add to followed_businesses if not already following
    const { rowCount: followInserted } = await pool.query(
      "INSERT INTO followed_businesses (user_id, business_id) VALUES ($1, $2) ON CONFLICT (user_id, business_id) DO NOTHING",
      [userId, parseInt(business_id)]
    );

    // Get updated counts
    const { rows: stats } = await pool.query(
      `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
       FROM offer_requests WHERE business_id = $1`,
      [business_id]
    );

    console.log(`[Pinch/Web] User ${userId} requested offer from business ${business_id}`);

    res.json({
      success: true,
      message: "Cerere trimisă!",
      total: parseInt(stats[0].total),
      uniqueUsers: parseInt(stats[0].unique_users),
      autoFollowed: followInserted > 0,
    });
  } catch (err) {
    console.error("[Pinch/Web] Error creating request:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

router.get("/api/web/offer-requests/:businessId/count", async (req, res) => {
  try {
    const { businessId } = req.params;

    const { rows: stats } = await pool.query(
      `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
       FROM offer_requests WHERE business_id = $1`,
      [businessId]
    );

    let userRequested = false;
    if (req.webUser) {
      const { rows: userReq } = await pool.query(
        `SELECT created_at FROM offer_requests
         WHERE user_id = $1 AND business_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [req.webUser.id, businessId]
      );
      if (userReq.length > 0) {
        const lastRequest = new Date(userReq[0].created_at);
        const cooldownEnd = new Date(lastRequest.getTime() + 7 * 24 * 60 * 60 * 1000);
        userRequested = new Date() < cooldownEnd;
      }
    }

    res.json({
      total: parseInt(stats[0].total),
      uniqueUsers: parseInt(stats[0].unique_users),
      userRequested,
    });
  } catch (err) {
    console.error("[Pinch/Web] Error getting count:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

router.delete("/api/web/offer-requests/:businessId", requireWebAuth, async (req, res) => {
  try {
    const userId = req.webUser.id;
    const { businessId } = req.params;

    const { rowCount } = await pool.query(
      `DELETE FROM offer_requests
       WHERE id = (
         SELECT id FROM offer_requests
         WHERE user_id = $1 AND business_id = $2
         ORDER BY created_at DESC LIMIT 1
       )`,
      [userId, businessId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Nicio cerere de anulat" });
    }

    res.json({ success: true, message: "Cerere anulată" });
  } catch (err) {
    console.error("[Pinch/Web] Error deleting request:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// --- Reviews ---
router.post("/api/web/reviews", requireWebAuth, async (req, res) => {
  try {
    const { business_id, rating, comment: rawComment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating invalid (1-5)" });
    }
    if (!business_id) {
      return res.status(400).json({ message: "business_id lipsă" });
    }

    const comment = sanitizeString(rawComment, 2000) || null;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingReview = await client.query(
        "SELECT id FROM reviews WHERE user_id = $1 AND business_id = $2",
        [req.webUser.id, business_id]
      );
      const isNewReview = existingReview.rows.length === 0;

      let reviewRes;
      if (isNewReview) {
        reviewRes = await client.query(
          "INSERT INTO reviews (user_id, business_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
          [req.webUser.id, business_id, rating, comment]
        );
      } else {
        reviewRes = await client.query(
          "UPDATE reviews SET rating = $3, comment = $4, created_at = NOW() WHERE user_id = $1 AND business_id = $2 RETURNING id, created_at",
          [req.webUser.id, business_id, rating, comment]
        );
      }

      let pointsEarned = 0;
      if (isNewReview) {
        const POINTS_REWARD = 10;
        await client.query(
          "INSERT INTO points_history (user_id, points_amount, action_type, metadata) VALUES ($1, $2, 'REVIEW_BONUS', $3)",
          [req.webUser.id, POINTS_REWARD, JSON.stringify({ business_id, review_id: reviewRes.rows[0].id })]
        );
        await client.query(
          "INSERT INTO user_points (user_id, total_points) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET total_points = user_points.total_points + EXCLUDED.total_points, updated_at = NOW()",
          [req.webUser.id, POINTS_REWARD]
        );
        pointsEarned = POINTS_REWARD;
      }

      await client.query("COMMIT");

      // Badge check (fire-and-forget, only for new reviews)
      if (isNewReview) {
        try {
          const { checkAndAwardBadges } = require("../services/badgeService");
          console.log("[badge] Web review: checking badges for user", req.webUser.id);
          const awarded = await checkAndAwardBadges(req.webUser.id, ['first_review', 'reviewer_bronze', 'reviewer_silver', 'reviewer_gold']);
          console.log("[badge] Web review: awarded", awarded);
        } catch (e) {
          console.error("[badge] Web review badge error:", e.message);
        }
      }

      res.json({ success: true, review: reviewRes.rows[0], points_earned: pointsEarned, is_update: !isNewReview });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Web API] Review error:", err);
    res.status(500).json({ message: "Eroare la salvarea recenziei" });
  }
});

// --- Change Password ---
router.post("/api/web/change-password", requireWebAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Ambele câmpuri sunt obligatorii" });
    }
    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) {
      return res.status(400).json({ message: pwdCheck.message });
    }

    const userRes = await pool.query("SELECT password_hash, google_id FROM users WHERE id = $1", [req.webUser.id]);
    if (userRes.rows[0].google_id && !userRes.rows[0].password_hash) {
      return res.status(400).json({ message: "Contul tău folosește Google Sign-In. Parola este gestionată de Google." });
    }
    const isValid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Parola curentă este incorectă" });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, req.webUser.id]);

    res.json({ success: true, message: "Parola a fost schimbată cu succes!" });
  } catch (err) {
    console.error("[Web API] Change password error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// --- Delete Account (full cascade, mirrors users.js /me) ---
router.delete("/api/web/delete-account", requireWebAuth, async (req, res) => {
  const userId = req.webUser.id;
  const { password, email_confirm } = req.body || {};

  const client = await pool.connect();

  try {
    const userRes = await client.query("SELECT password_hash, google_id, email FROM users WHERE id = $1", [userId]);
    if (userRes.rowCount === 0) {
      client.release();
      return res.status(404).json({ message: "Utilizator negăsit" });
    }

    const user = userRes.rows[0];

    // Google users: confirm via email match; regular users: confirm via password
    if (user.google_id && !user.password_hash) {
      if (!email_confirm || email_confirm.toLowerCase() !== user.email.toLowerCase()) {
        client.release();
        return res.status(401).json({ message: "Email-ul nu corespunde contului tău" });
      }
    } else {
      if (!password) {
        client.release();
        return res.status(400).json({ message: "Parola este obligatorie" });
      }
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        client.release();
        return res.status(401).json({ message: "Parola este incorectă" });
      }
    }

    await client.query("BEGIN");

    // Use shared deletion service (ensures parity between mobile & web)
    await deleteUserAccount(userId, client, req.ip, "web_request");

    await client.query("COMMIT");

    console.log(`[Web] Account deleted: user ID ${userId}`);

    res.clearCookie("ofai_token", { path: "/" });
    res.clearCookie("ofai_refresh_token", { path: "/" });
    res.json({ success: true, redirect: "/" });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Web API] Delete account error:", err);
    res.status(500).json({ message: "Eroare server" });
  } finally {
    client.release();
  }
});

// --- Update Preferences ---
router.put("/api/web/preferences", requireWebAuth, async (req, res) => {
  try {
    const { preferred_city_ids, preferred_category_ids } = req.body || {};

    let cityIds = [];
    if (Array.isArray(preferred_city_ids)) {
      cityIds = preferred_city_ids.map(v => Number(v)).filter(v => Number.isInteger(v) && v > 0);
    }
    let categoryIds = [];
    if (Array.isArray(preferred_category_ids)) {
      categoryIds = preferred_category_ids.map(v => Number(v)).filter(v => Number.isInteger(v) && v > 0);
    }

    await pool.query(
      "UPDATE users SET preferred_city_ids = $1, preferred_category_ids = $2 WHERE id = $3",
      [cityIds, categoryIds, req.webUser.id]
    );

    res.json({ success: true, message: "Preferințele au fost salvate!" });
  } catch (err) {
    console.error("[Web API] Preferences error:", err);
    res.status(500).json({ success: false, message: "Eroare la salvarea preferințelor" });
  }
});

// --- Update Profile ---
router.put("/api/web/profile", requireWebAuth, async (req, res) => {
  try {
    const { first_name, last_name } = req.body || {};

    // Check 30-day cooldown
    const user = await pool.query("SELECT last_profile_edit FROM users WHERE id = $1", [req.webUser.id]);
    const lastEdit = user.rows[0]?.last_profile_edit;
    if (lastEdit) {
      const daysSince = (Date.now() - new Date(lastEdit).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        const daysLeft = Math.ceil(30 - daysSince);
        return res.status(429).json({ message: `Poți edita profilul din nou în ${daysLeft} zile.` });
      }
    }

    await pool.query(
      "UPDATE users SET first_name = $1, last_name = $2, last_profile_edit = NOW() WHERE id = $3",
      [first_name?.trim() || null, last_name?.trim() || null, req.webUser.id]
    );

    res.json({ success: true, message: "Profilul a fost actualizat!" });
  } catch (err) {
    console.error("[Web API] Profile update error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// --- Update Account Settings (show_picture_in_reviews, display_badge_id) ---
router.put("/api/web/account", requireWebAuth, async (req, res) => {
  try {
    const { show_picture_in_reviews, display_badge_id } = req.body || {};
    const { validateInt } = require("../helpers/validate");

    // Handle display_badge_id: null = clear, integer = set (with ownership check)
    if (display_badge_id !== undefined) {
      if (display_badge_id === null) {
        // Clear badge selection
        await pool.query("UPDATE users SET display_badge_id = NULL WHERE id = $1", [req.webUser.id]);
      } else {
        const badgeId = validateInt(display_badge_id, { min: 1 });
        if (!badgeId) return res.status(400).json({ message: "ID insignă invalid" });

        // Security: verify user owns this badge
        const owned = await pool.query(
          "SELECT 1 FROM user_badges ub JOIN badge_definitions bd ON bd.id = ub.badge_id WHERE ub.user_id = $1 AND bd.id = $2",
          [req.webUser.id, badgeId]
        );
        if (owned.rows.length === 0) {
          return res.status(403).json({ message: "Nu ai obținut această insignă" });
        }

        await pool.query("UPDATE users SET display_badge_id = $1 WHERE id = $2", [badgeId, req.webUser.id]);
      }
      return res.json({ success: true, message: "Insigna a fost actualizată!" });
    }

    await pool.query(
      "UPDATE users SET show_picture_in_reviews = $1 WHERE id = $2",
      [show_picture_in_reviews !== false, req.webUser.id]
    );

    res.json({ success: true, message: "Setările au fost salvate!" });
  } catch (err) {
    console.error("[Web API] Account settings update error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// --- Profile Picture Upload ---
router.post("/api/web/account/profile-picture", requireWebAuth, portalUpload.single("profile_picture"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Niciun fișier" });

    // Delete old Cloudinary picture if present
    const oldRes = await pool.query("SELECT profile_picture_url FROM users WHERE id = $1", [req.webUser.id]);
    const oldUrl = oldRes.rows[0]?.profile_picture_url;
    if (oldUrl && oldUrl.includes("cloudinary.com")) {
      const oldId = getPublicIdFromUrl(oldUrl);
      if (oldId) await deleteFromCloudinary(oldId).catch(() => {});
    }

    const result = await uploadToCloudinary(req.file.buffer, "profile");
    await pool.query("UPDATE users SET profile_picture_url = $1 WHERE id = $2", [result.url, req.webUser.id]);

    res.json({ success: true, profile_picture_url: result.url });
  } catch (err) {
    console.error("[Web API] Profile picture upload error:", err);
    res.status(500).json({ message: "Eroare la upload" });
  }
});

// --- Profile Picture Delete ---
router.delete("/api/web/account/profile-picture", requireWebAuth, async (req, res) => {
  try {
    const oldRes = await pool.query("SELECT profile_picture_url FROM users WHERE id = $1", [req.webUser.id]);
    const oldUrl = oldRes.rows[0]?.profile_picture_url;

    if (oldUrl && oldUrl.includes("cloudinary.com")) {
      const oldId = getPublicIdFromUrl(oldUrl);
      if (oldId) await deleteFromCloudinary(oldId).catch(() => {});
    }

    await pool.query("UPDATE users SET profile_picture_url = NULL WHERE id = $1", [req.webUser.id]);

    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Profile picture delete error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// ═══════════════════════════════════════════════════════
// PRICING PAGE
// ═══════════════════════════════════════════════════════
router.get('/preturi', async (req, res) => {
  try {
    const { rows: plans } = await pool.query(
      'SELECT * FROM subscription_plans ORDER BY sort_order ASC'
    );

    res.render('public/pricing', {
      pageTitle: 'Preturi - OFAI',
      activePage: 'preturi',
      plans,
      webUser: req.webUser || null,
    });
  } catch (err) {
    console.error('[Web] Pricing page error:', err);
    res.status(500).send('Eroare la incarcarea paginii de preturi.');
  }
});

module.exports = router;
