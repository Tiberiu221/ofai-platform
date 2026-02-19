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
const { clickLimiter, searchLimiter, revealLimiter } = require("../middleware/rateLimiter");
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
      pool.query("SELECT COUNT(*) as total FROM offers WHERE is_active = true AND end_date >= CURRENT_DATE"),
      pool.query("SELECT COUNT(*) as total FROM cities"),
      pool.query("SELECT COUNT(*) as total FROM offers WHERE is_active = true AND start_date > CURRENT_DATE - INTERVAL '7 days'"),
    ]);

    const categories = await pool.query(`
      SELECT c.id, c.name, COUNT(DISTINCT o.id) as offer_count
      FROM categories c
      LEFT JOIN businesses b ON b.category_id = c.id
      LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND o.end_date >= CURRENT_DATE
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

    // Build dynamic WHERE clause based on preferences
    const featuredWhere = ["o.is_active = true", "o.end_date >= CURRENT_DATE"];
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

    const featuredOffers = await pool.query(`
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
      LEFT JOIN cities ci ON b.city_id = ci.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      LEFT JOIN reviews r ON r.business_id = b.id
      WHERE ${featuredWhere.join(" AND ")}
      GROUP BY o.id, o.title, o.discount_type, o.discount_value, o.end_date,
               b.name, b.logo_url, b.cover_image_url, b.lat, b.lng,
               ci.name, cat.name, o.logo_url
      ORDER BY (RANDOM() * 0.4 + LEAST(o.discount_value, 100) / 100.0 * 0.3 + CASE WHEN o.end_date <= CURRENT_DATE + INTERVAL '3 days' THEN 0.3 ELSE 0.1 END) DESC
      LIMIT 5
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
             b.lat, b.lng,
             ci.name as city_name, cat.name as category_name,
             COALESCE(AVG(r.rating), 0) as rating_avg,
             COUNT(DISTINCT r.id) as rating_count,
             COUNT(DISTINCT o.id) as offer_count
      FROM businesses b
      LEFT JOIN cities ci ON b.city_id = ci.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      LEFT JOIN reviews r ON r.business_id = b.id
      LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND o.end_date >= CURRENT_DATE
      GROUP BY b.id, b.name, b.logo_url, b.cover_image_url, b.lat, b.lng, ci.name, cat.name
      HAVING COUNT(DISTINCT o.id) > 0
      ORDER BY (COUNT(DISTINCT o.id) + RANDOM() * 2) DESC, COALESCE(AVG(r.rating), 0) DESC
      LIMIT 8
    `);

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
        WHERE o.is_active = true AND o.end_date >= CURRENT_DATE
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

    res.render("public/home", {
      stats,
      categories: categories.rows,
      featuredOffers: featuredOffers.rows,
      cities: cities.rows,
      featuredBusinesses: featuredBusinesses.rows,
      topBusinesses: topBusinesses.rows,
      followedOffers,
      preferredCityName,
      hasPreferences: !!(userPrefs.city_id || userPrefs.category_ids.length > 0),
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
    const limit = 24;
    const offset = (page - 1) * limit;
    const query = req.query.q || "";
    const selectedCategory = req.query.category || null;
    const selectedCity = req.query.city || null;
    const sort = req.query.sort || "newest";

    const conditions = ["o.is_active = true", "o.end_date >= CURRENT_DATE"];
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

    const whereClause = conditions.join(" AND ");

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM offers o JOIN businesses b ON o.business_id = b.id WHERE ${whereClause}`,
      params
    );
    const totalOffers = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalOffers / limit);

    const sortOptions = {
      newest: "o.id DESC",
      popular: "rating_avg DESC, rating_count DESC",
      discount: "CASE WHEN o.discount_type IN ('percent','percentage') THEN o.discount_value ELSE 0 END DESC, o.discount_value DESC",
    };
    const validSorts = ["newest", "popular", "discount"];
    const sortKey = validSorts.includes(sort) ? sort : "newest";
    const orderBy = sortOptions[sortKey];

    const offersResult = await pool.query(
      `SELECT o.id, o.title, o.description, o.discount_type, o.discount_value, o.end_date,
              o.business_id,
              b.name as business_name, b.logo_url as business_logo,
              b.cover_image_url as business_cover,
              b.lat as business_lat, b.lng as business_lng,
              ci.name as city_name, cat.name as category_name,
              COALESCE(o.logo_url, b.cover_image_url) as image_url,
              COALESCE(AVG(r.rating), 0) as rating_avg,
              COUNT(DISTINCT r.id) as rating_count,
              (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as favorite_count
       FROM offers o
       JOIN businesses b ON o.business_id = b.id
       LEFT JOIN cities ci ON b.city_id = ci.id
       LEFT JOIN categories cat ON b.category_id = cat.id
       LEFT JOIN reviews r ON r.business_id = b.id
       WHERE ${whereClause}
       GROUP BY o.id, o.title, o.description, o.discount_type, o.discount_value, o.end_date,
                o.business_id, b.name, b.logo_url, b.cover_image_url, b.lat, b.lng,
                ci.name, cat.name, o.logo_url
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

    res.render("public/oferte", {
      offers: interleaved,
      categories: categoriesResult.rows,
      cities: citiesResult.rows,
      totalOffers,
      totalPages,
      currentPage: page,
      totalCities: parseInt(totalCitiesResult.rows[0].total),
      query,
      selectedCategory,
      selectedCity,
      selectedCityName,
      selectedSort: sort,
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

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM businesses b ${whereClause}`,
      params
    );
    const totalBusinesses = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalBusinesses / limit);

    const sortOptions = {
      popular: "offer_count DESC, rating_avg DESC",
      rating: "rating_avg DESC, rating_count DESC",
      newest: "b.id DESC",
    };
    const orderBy = sortOptions[sort] || sortOptions.popular;

    const businessesResult = await pool.query(
      `SELECT b.id, b.name, b.logo_url, b.cover_image_url,
              b.lat, b.lng,
              ci.name as city_name, cat.name as category_name,
              COALESCE(AVG(r.rating), 0) as rating_avg,
              COUNT(DISTINCT r.id) as rating_count,
              COUNT(DISTINCT o.id) as offer_count
       FROM businesses b
       LEFT JOIN cities ci ON b.city_id = ci.id
       LEFT JOIN categories cat ON b.category_id = cat.id
       LEFT JOIN reviews r ON r.business_id = b.id
       LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND o.end_date >= CURRENT_DATE
       ${whereClause}
       GROUP BY b.id, b.name, b.logo_url, b.cover_image_url, b.lat, b.lng, ci.name, cat.name
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

    res.render("public/business-uri", {
      businesses: businessesResult.rows,
      categories: categoriesResult.rows,
      cities: citiesResult.rows,
      totalBusinesses,
      totalPages,
      currentPage: page,
      totalCities: parseInt(totalCitiesResult.rows[0].total),
      query,
      selectedCategory,
      selectedCity,
      selectedSort: sort,
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
        (SELECT COUNT(*) FROM reviews WHERE business_id = b.id) as rating_count
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

    res.render("public/offer-detail", {
      offer,
      isFavorite,
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
             b.logo_url, b.cover_image_url,
             b.booking_type, b.booking_phone, b.booking_whatsapp, b.booking_url, b.booking_instructions,
             c.id as city_id, c.name as city_name,
             cat.id as cat_id, cat.name as cat_name,
             COALESCE(AVG(r.rating), 0) as rating_avg,
             COUNT(r.id) as rating_count
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
      WHERE o.business_id = $1 AND o.is_active = true AND o.end_date >= CURRENT_DATE
      ORDER BY o.discount_value DESC
      LIMIT 50
    `, [id]);

    // Reviews
    const reviewsRes = await pool.query(`
      SELECT r.id, r.rating, r.comment, r.created_at,
             COALESCE(u.first_name, 'Utilizator') as first_name,
             COALESCE(u.last_name, '') as last_name,
             rr.response_text, rr.created_at as response_date
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
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
      city: { id: b.city_id, name: b.city_name },
      category: { id: b.cat_id, name: b.cat_name },
      rating: parseFloat(parseFloat(b.rating_avg).toFixed(1)),
      rating_count: parseInt(b.rating_count),
      images,
      locations,
      booking: {
        type: b.booking_type || 'none',
        phone: b.booking_phone, whatsapp: b.booking_whatsapp,
        url: b.booking_url, instructions: b.booking_instructions,
      },
    };

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
router.post("/auth/google", async (req, res) => {
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
      LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND o.end_date >= CURRENT_DATE
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
    const pointsRes = await pool.query("SELECT total_points FROM user_points WHERE user_id = $1", [req.webUser.id]);
    const userPoints = pointsRes.rows[0]?.total_points || 0;

    const favCount = await pool.query("SELECT COUNT(*) as total FROM favorite_offers WHERE user_id = $1", [req.webUser.id]);
    const followCount = await pool.query("SELECT COUNT(*) as total FROM followed_businesses WHERE user_id = $1", [req.webUser.id]);
    const reviewCount = await pool.query("SELECT COUNT(*) as total FROM reviews WHERE user_id = $1", [req.webUser.id]);

    // Business request status (most recent)
    const bizReqRes = await pool.query(
      "SELECT status, name FROM business_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [req.webUser.id]
    );
    const bizRequest = bizReqRes.rows[0] || null;

    // Get last_profile_edit
    const userDetails = await pool.query("SELECT last_profile_edit FROM users WHERE id = $1", [req.webUser.id]);
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
    });
  } catch (err) {
    console.error("[Web] Account error:", err);
    res.status(500).send("Eroare la încărcarea contului");
  }
});

router.get("/colectia-mea", requireWebAuth, async (req, res) => {
  try {
    const sort = req.query.sort || "recent";

    // Sort for favorites (offers)
    let favoritesOrderBy = "f.created_at DESC";
    if (sort === "rating") {
      favoritesOrderBy = "rating_avg DESC";
    }
    // distance will be handled client-side

    const favoritesRes = await pool.query(`
      SELECT o.id, o.title, o.discount_type, o.discount_value,
             b.name as business_name, b.logo_url as business_logo,
             b.cover_image_url as business_cover,
             COALESCE(b.cover_image_url, o.logo_url, b.logo_url) as image_url,
             ci.name as city_name,
             COALESCE(AVG(r.rating), 0) as rating_avg
      FROM favorite_offers f
      JOIN offers o ON o.id = f.offer_id
      JOIN businesses b ON b.id = o.business_id
      LEFT JOIN cities ci ON ci.id = b.city_id
      LEFT JOIN reviews r ON r.business_id = b.id
      WHERE f.user_id = $1
      GROUP BY o.id, o.title, o.discount_type, o.discount_value,
               b.name, b.logo_url, b.cover_image_url, ci.name, f.created_at
      ORDER BY ${favoritesOrderBy}
    `, [req.webUser.id]);

    // Sort for subscriptions (businesses)
    let subscriptionsOrderBy = "MAX(f.created_at) DESC";
    if (sort === "rating") {
      subscriptionsOrderBy = "rating_avg DESC";
    }
    // distance will be handled client-side

    const subscriptionsRes = await pool.query(`
      SELECT b.id, b.name, b.logo_url, b.cover_image_url,
             c.name as city_name, cat.name as category_name,
             COUNT(DISTINCT o.id) as active_offers_count,
             COALESCE(AVG(rev.rating), 0) as rating_avg
      FROM followed_businesses f
      JOIN businesses b ON b.id = f.business_id
      LEFT JOIN cities c ON c.id = b.city_id
      LEFT JOIN categories cat ON cat.id = b.category_id
      LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND o.end_date >= CURRENT_DATE
      LEFT JOIN reviews rev ON rev.business_id = b.id
      WHERE f.user_id = $1
      GROUP BY b.id, b.name, b.logo_url, b.cover_image_url, c.name, cat.name
      ORDER BY ${subscriptionsOrderBy}
    `, [req.webUser.id]);

    res.render("public/colectia-mea", {
      favorites: favoritesRes.rows,
      subscriptions: subscriptionsRes.rows,
      sort,
      activePage: "colectie",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Collection error:", err);
    res.status(500).send("Eroare la încărcarea colecției");
  }
});

router.get("/setari", requireWebAuth, (req, res) => {
  res.render("public/setari", { activePage: "setari", webUser: req.webUser });
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
               (SELECT COUNT(*) FROM offers WHERE business_id = b.id AND is_active = true AND end_date >= CURRENT_DATE) as active_offers
        FROM businesses b
        LEFT JOIN cities c ON b.city_id = c.id
        LEFT JOIN categories cat ON b.category_id = cat.id
        ORDER BY b.name
      `);
    } else {
      businesses = await pool.query(`
        SELECT b.id, b.name, b.logo_url, b.cover_image_url,
               c.name as city_name, cat.name as category_name,
               (SELECT COUNT(*) FROM offers WHERE business_id = b.id AND is_active = true AND end_date >= CURRENT_DATE) as active_offers
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
router.get("/portal/:businessId", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId } = req.params;

    // Business details
    const bizRes = await pool.query(`
      SELECT b.id, b.name, b.address, b.phone, b.website, b.lat, b.lng,
             b.logo_url, b.cover_image_url,
             b.booking_type, b.booking_phone, b.booking_whatsapp, b.booking_url, b.booking_instructions,
             b.city_id, c.name as city_name, b.category_id, cat.name as category_name
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
                  COUNT(*) FILTER (WHERE is_active = true AND end_date >= CURRENT_DATE) as active
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
      pool.query("SELECT COUNT(*) as cnt FROM offers WHERE business_id = $1 AND is_active = true AND end_date >= CURRENT_DATE", [businessId]),
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

    // Cities & categories for edit form
    const [citiesRes, categoriesRes] = await Promise.all([
      pool.query("SELECT id, name FROM cities ORDER BY name"),
      pool.query("SELECT id, name FROM categories ORDER BY name"),
    ]);

    res.render("public/portal/manage", {
      business,
      offers: offersRes.rows,
      reviews: reviewsRes.rows,
      reviewCount,
      analytics,
      score,
      cities: citiesRes.rows,
      categories: categoriesRes.rows,
      activePage: "portal",
      webUser: req.webUser,
      loadChartJs: true,
    });
  } catch (err) {
    console.error("[Web] Portal manage error:", err);
    res.status(500).send("Eroare la încărcarea paginii de management");
  }
});

// Portal — new offer form
router.get("/portal/:businessId/oferta-noua", requireBusinessOwner, async (req, res) => {
  try {
    const bizRes = await pool.query("SELECT id, name FROM businesses WHERE id = $1", [req.params.businessId]);
    if (bizRes.rows.length === 0) return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });

    res.render("public/portal/offer-form", {
      business: bizRes.rows[0],
      offer: null,
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

    const offerRes = await pool.query(
      "SELECT id, title, description, discount_type, discount_value, conditions, start_date, end_date, is_active, logo_url, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, promo_code FROM offers WHERE id = $1 AND business_id = $2",
      [offerId, businessId]
    );
    if (offerRes.rows.length === 0) return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });

    // Fetch promo codes for this offer
    const promoCodesRes = await pool.query(
      "SELECT id, code, is_active FROM promo_codes WHERE offer_id = $1 ORDER BY id",
      [offerId]
    );

    res.render("public/portal/offer-form", {
      business: bizRes.rows[0],
      offer: offerRes.rows[0],
      promoCodes: promoCodesRes.rows,
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
router.post("/api/web/portal/:businessId/logo", requireBusinessOwner, portalUpload.single("logo"), async (req, res) => {
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
router.post("/api/web/portal/:businessId/cover", requireBusinessOwner, portalUpload.single("cover"), async (req, res) => {
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

// Upload gallery image
router.post("/api/web/portal/:businessId/gallery", requireBusinessOwner, portalUpload.single("image"), async (req, res) => {
  try {
    const { businessId } = req.params;
    if (!req.file) return res.status(400).json({ message: "Niciun fișier" });

    // Check max 8 images
    const countRes = await pool.query("SELECT COUNT(*) as cnt FROM business_images WHERE business_id = $1", [businessId]);
    if (parseInt(countRes.rows[0].cnt) >= 8) {
      return res.status(400).json({ message: "Maximum 8 imagini permise" });
    }

    const result = await uploadToCloudinary(req.file.buffer, "gallery");
    const sortOrder = parseInt(countRes.rows[0].cnt) + 1;
    const insertRes = await pool.query(
      "INSERT INTO business_images (business_id, image_url, sort_order) VALUES ($1, $2, $3) RETURNING id",
      [businessId, result.url, sortOrder]
    );
    res.json({ success: true, image: { id: insertRes.rows[0].id, url: result.url, sort_order: sortOrder } });
  } catch (err) {
    console.error("[Web API] Portal upload gallery error:", err);
    res.status(500).json({ message: "Eroare la upload" });
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

// Update business info
router.put("/api/web/portal/:businessId", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { name, address, phone, website, city_id, category_id, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions } = req.body || {};

    await pool.query(`
      UPDATE businesses SET
        name = COALESCE($1, name),
        address = COALESCE($2, address),
        phone = COALESCE($3, phone),
        website = COALESCE($4, website),
        city_id = COALESCE($5, city_id),
        category_id = COALESCE($6, category_id),
        booking_type = COALESCE($7, booking_type),
        booking_phone = $8,
        booking_whatsapp = $9,
        booking_url = $10,
        booking_instructions = $11
      WHERE id = $12
    `, [name, address, phone, website, city_id ? parseInt(city_id) : null, category_id ? parseInt(category_id) : null,
        booking_type, booking_phone || null, booking_whatsapp || null, booking_url || null, booking_instructions || null, businessId]);

    res.json({ success: true, message: "Business actualizat!" });
  } catch (err) {
    console.error("[Web API] Portal update business error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// Create offer
router.post("/api/web/portal/:businessId/offers", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { title, description, discount_type, discount_value, conditions, start_date, end_date, is_active, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, promo_code, promo_codes } = req.body || {};

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
      sendWebhook: false, // Web portal doesn't send webhook
    });

    res.json({ success: true, offer_id: offerId });
  } catch (err) {
    console.error("[Web API] Portal create offer error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// Update offer
router.put("/api/web/portal/:businessId/offers/:offerId", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId, offerId } = req.params;
    const { title, description, discount_type, discount_value, conditions, start_date, end_date, is_active, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, promo_code, promo_codes } = req.body || {};

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
        booking_phone = $10, booking_whatsapp = $11, booking_url = $12, booking_instructions = $13
      WHERE id = $14 AND business_id = $15
    `, [sanitizeString(title, 200), sanitizeString(description, 2000) || null,
        discount_type, discount_value || 0, sanitizeString(conditions, 2000) || null,
        start_date || null, end_date || null, is_active,
        booking_type || 'inherit', booking_phone || null, booking_whatsapp || null, booking_url || null, sanitizeString(booking_instructions, 500) || null,
        offerId, businessId]);

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

// Toggle offer active
router.patch("/api/web/portal/:businessId/offers/:offerId/toggle", requireBusinessOwner, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE offers SET is_active = NOT is_active WHERE id = $1 AND business_id = $2 RETURNING is_active",
      [req.params.offerId, req.params.businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Ofertă negăsită" });
    res.json({ success: true, is_active: result.rows[0].is_active });
  } catch (err) {
    console.error("[Web API] Portal toggle offer error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// Respond to review
router.post("/api/web/portal/:businessId/reviews/:reviewId/respond", requireBusinessOwner, async (req, res) => {
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
router.put("/api/web/portal/:businessId/reviews/:reviewId/respond", requireBusinessOwner, async (req, res) => {
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

// Analytics views timeline
router.get("/api/web/portal/:businessId/analytics/views", requireBusinessOwner, async (req, res) => {
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

// Analytics subscribers timeline
router.get("/api/web/portal/:businessId/analytics/subscribers", requireBusinessOwner, async (req, res) => {
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

// Analytics clicks timeline
router.get("/api/web/portal/:businessId/analytics/clicks", requireBusinessOwner, async (req, res) => {
  try {
    const { businessId } = req.params;
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 90);

    const result = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as clicks
       FROM business_clicks WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY DATE(created_at) ORDER BY date ASC`,
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
      filledData.push({ date: dateStr, clicks: parseInt(found?.clicks || 0) });
    }

    res.json({ days, data: filledData });
  } catch (err) {
    console.error("[Web API] Portal clicks error:", err);
    res.status(500).json({ message: "Eroare" });
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
        WHERE o.is_active = true AND o.end_date >= CURRENT_DATE
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

    const userRes = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.webUser.id]);
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
  const { password } = req.body || {};

  if (!password) {
    return res.status(400).json({ message: "Parola este obligatorie" });
  }

  const client = await pool.connect();

  try {
    const userRes = await client.query("SELECT password_hash FROM users WHERE id = $1", [userId]);
    if (userRes.rowCount === 0) {
      client.release();
      return res.status(404).json({ message: "Utilizator negăsit" });
    }

    const isValid = await bcrypt.compare(password, userRes.rows[0].password_hash);
    if (!isValid) {
      client.release();
      return res.status(401).json({ message: "Parola este incorectă" });
    }

    await client.query("BEGIN");

    // 1. Revoke all refresh tokens
    await client.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);
    // 2. Delete password reset tokens
    await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);
    // 3. Delete push tokens
    await client.query("DELETE FROM push_tokens WHERE user_id = $1", [userId]);
    // 4. Delete points
    await client.query("DELETE FROM user_points WHERE user_id = $1", [userId]);
    // 5. Delete favorites
    await client.query("DELETE FROM favorite_offers WHERE user_id = $1", [userId]);
    // 6. Delete followed businesses
    await client.query("DELETE FROM followed_businesses WHERE user_id = $1", [userId]);
    // 7. Anonymize review responses
    await client.query(
      `UPDATE review_responses SET review_id = NULL
       WHERE review_id IN (SELECT id FROM reviews WHERE user_id = $1)`,
      [userId]
    );
    // 8. Anonymize reviews
    await client.query(
      "UPDATE reviews SET user_id = NULL, user_name = 'Utilizator sters' WHERE user_id = $1",
      [userId]
    );
    // 9. Anonymize business requests
    await client.query("UPDATE business_requests SET user_id = NULL WHERE user_id = $1", [userId]);
    // 10. Remove user-business ownership links
    await client.query("DELETE FROM user_businesses WHERE user_id = $1", [userId]);
    // 11. Delete points history
    await client.query("DELETE FROM points_history WHERE user_id = $1", [userId]);
    // 12. Delete code reveals
    await client.query("DELETE FROM code_reveals WHERE user_id = $1", [userId]);
    // 13. Log deletion in audit log
    try {
      await client.query(
        `INSERT INTO audit_log (action, entity_type, entity_id, user_id, ip_address, details)
         VALUES ('account_delete', 'user', $1, $1, $2, '{"source":"web_request"}')`,
        [userId, req.ip]
      );
    } catch (auditErr) {
      console.error("[Audit] Failed to log account deletion:", auditErr.message);
    }
    // 14. Finally, delete the user
    await client.query("DELETE FROM users WHERE id = $1", [userId]);

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

    await pool.query(
      "UPDATE users SET preferred_city_ids = $1, preferred_category_ids = $2 WHERE id = $3",
      [preferred_city_ids || [], preferred_category_ids || [], req.webUser.id]
    );

    res.json({ success: true, message: "Preferințele au fost salvate!" });
  } catch (err) {
    console.error("[Web API] Preferences error:", err);
    res.status(500).json({ message: "Eroare server" });
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

module.exports = router;
