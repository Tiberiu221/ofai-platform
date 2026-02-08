/**
 * Web Routes — Pagini publice OFAI.ro
 * Landing page, Oferte, Categorii, Orașe, Auth, Cont, Colecție, etc.
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const pool = require("../db");
const { optionalWebAuth, requireWebAuth } = require("../middleware/webAuth");
const { signToken } = require("../helpers/jwt");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("../services/email");
const { triggerWebhook } = require("../services/n8n");
const { sanitizeString } = require("../helpers/validate");

const SALT_ROUNDS = 10;

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
      pool.query("SELECT COUNT(DISTINCT c.id) as total FROM cities c INNER JOIN businesses b ON b.city_id = c.id"),
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

    const featuredOffers = await pool.query(`
      SELECT o.id, o.title, o.discount_type, o.discount_value,
             b.name as business_name, b.logo_url as business_logo,
             b.cover_image_url as business_cover,
             ci.name as city_name, cat.name as category_name,
             COALESCE(b.cover_image_url, o.logo_url, b.logo_url) as image_url
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities ci ON b.city_id = ci.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      WHERE o.is_active = true AND o.end_date >= CURRENT_DATE
      ORDER BY o.discount_value DESC
      LIMIT 5
    `);

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

    const stats = {
      totalBusinesses: parseInt(bizCount.rows[0].total),
      totalOffers: parseInt(offerCount.rows[0].total),
      totalCities: parseInt(cityCount.rows[0].total),
      newOffers: parseInt(recentOffers.rows[0].total) || Math.floor(parseInt(offerCount.rows[0].total) * 0.1),
    };

    res.render("public/home", {
      stats,
      categories: categories.rows,
      featuredOffers: featuredOffers.rows,
      cities: cities.rows,
      featuredBusinesses: featuredBusinesses.rows,
      activePage: "home",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Home page error:", err.message);
    res.status(500).send("Eroare: " + err.message);
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
      conditions.push(`b.city_id = $${paramIdx}`);
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

    const offersResult = await pool.query(
      `SELECT o.id, o.title, o.discount_type, o.discount_value,
              b.name as business_name, b.logo_url as business_logo,
              b.cover_image_url as business_cover,
              ci.name as city_name, cat.name as category_name,
              COALESCE(b.cover_image_url, o.logo_url, b.logo_url) as image_url
       FROM offers o
       JOIN businesses b ON o.business_id = b.id
       LEFT JOIN cities ci ON b.city_id = ci.id
       LEFT JOIN categories cat ON b.category_id = cat.id
       WHERE ${whereClause}
       ORDER BY o.discount_value DESC
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

    res.render("public/oferte", {
      offers: offersResult.rows,
      categories: categoriesResult.rows,
      cities: citiesResult.rows,
      totalOffers,
      totalPages,
      currentPage: page,
      totalCities: parseInt(totalCitiesResult.rows[0].total),
      query,
      selectedCategory,
      selectedCity,
      activePage: "oferte",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Offers page error:", err);
    res.status(500).send("Eroare la încărcarea ofertelor");
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
    ).catch(() => {});

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
    const baseLocQuery = `SELECT bl.id, bl.address, bl.lat, bl.lng, bl.phone, c.name as city_name
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
      })),
    };

    res.render("public/offer-detail", {
      offer,
      isFavorite,
      activePage: null,
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Offer detail error:", err);
    res.status(500).send("Eroare la încărcarea ofertei");
  }
});

// ═══════════════════════════════════════════════════════
// BUSINESS DETAIL PAGE
// ═══════════════════════════════════════════════════════
router.get("/business/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const businessRes = await pool.query(`
      SELECT b.id, b.name, b.address, b.phone, b.website, b.lat, b.lng,
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
    ).catch(() => {});

    // Images
    const imagesRes = await pool.query(
      "SELECT id, image_filename, sort_order FROM business_images WHERE business_id = $1 ORDER BY sort_order NULLS LAST, id ASC",
      [id]
    );
    const images = imagesRes.rows.map(img => ({
      id: img.id,
      url: `/uploads/businesses/${img.image_filename}`,
      sort_order: img.sort_order,
    }));

    // Locations
    const locationsRes = await pool.query(`
      SELECT bl.id, bl.address, bl.lat, bl.lng, bl.phone,
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
      }));
    } else if (b.address) {
      locations = [{ id: 'main', address: b.address, lat: b.lat, lng: b.lng, phone: b.phone,
        city: { id: b.city_id, name: b.city_name } }];
    }

    // Active offers
    const offersRes = await pool.query(`
      SELECT o.id, o.title, o.discount_type, o.discount_value,
             o.start_date, o.end_date,
             COALESCE(b2.cover_image_url, o.logo_url, b2.logo_url) as image_url,
             b2.name as business_name, b2.logo_url as business_logo
      FROM offers o
      JOIN businesses b2 ON o.business_id = b2.id
      WHERE o.business_id = $1 AND o.is_active = true AND o.end_date >= CURRENT_DATE
      ORDER BY o.discount_value DESC
    `, [id]);

    // Reviews
    const reviewsRes = await pool.query(`
      SELECT r.id, r.rating, r.comment, r.created_at,
             u.first_name, u.last_name,
             rr.response_text, rr.created_at as response_date
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN review_responses rr ON rr.review_id = r.id
      WHERE r.business_id = $1
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [id]);

    // Check follow status + user review
    let isFollowing = false;
    let userReview = null;
    if (req.webUser) {
      const [followRes, userRevRes] = await Promise.all([
        pool.query("SELECT 1 FROM followed_businesses WHERE user_id = $1 AND business_id = $2", [req.webUser.id, id]),
        pool.query("SELECT id, rating, comment FROM reviews WHERE user_id = $1 AND business_id = $2", [req.webUser.id, id]),
      ]);
      isFollowing = followRes.rowCount > 0;
      userReview = userRevRes.rows[0] || null;
    }

    // Review summary
    let reviewSummary = null;
    try {
      const { getExistingSummary } = require("../services/llm/summarizationService");
      const existingSummary = await getExistingSummary(id);
      if (existingSummary) {
        reviewSummary = { text: existingSummary.summary_text, review_count: existingSummary.review_count };
      }
    } catch (e) { /* summary not available */ }

    const coverImage = b.cover_image_url || (images.length > 0 ? images[0].url : b.logo_url);

    const business = {
      id: b.id,
      name: b.name,
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
      activePage: null,
      webUser: req.webUser,
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
  res.render("public/login", { activePage: null, webUser: null });
});

router.get("/register", (req, res) => {
  if (req.webUser) return res.redirect("/cont");
  res.render("public/register", { activePage: null, webUser: null });
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

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Email sau parolă invalidă" });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Email sau parolă invalidă" });
    }

    await pool.query("UPDATE users SET last_active_at = NOW() WHERE id = $1", [user.id]);

    const token = signToken({ id: user.id }, "30d");

    res.cookie("ofai_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({ success: true, redirect: "/cont" });
  } catch (err) {
    console.error("[Web] Login error:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /register
router.post("/register", async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email și parola sunt obligatorii" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Parola trebuie să aibă minim 6 caractere" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ message: "Există deja un cont cu acest email" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const insertResult = await pool.query(
      "INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING *",
      [email.toLowerCase().trim(), passwordHash, first_name?.trim(), last_name?.trim()]
    );
    const user = insertResult.rows[0];

    await pool.query("INSERT INTO user_points (user_id, total_points) VALUES ($1, 0) ON CONFLICT DO NOTHING", [user.id]);

    const token = signToken({ id: user.id }, "30d");

    res.cookie("ofai_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    // Async email + webhook
    sendWelcomeEmail(user.email, user.first_name).catch(() => {});
    triggerWebhook("/webhook/new-user", {
      user_id: user.id, email: user.email,
      first_name: user.first_name, created_at: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, redirect: "/cont" });
  } catch (err) {
    console.error("[Web] Register error:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: "Email-ul este obligatoriu" });
    }

    const userRes = await pool.query("SELECT id, email, first_name FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (userRes.rowCount === 0) {
      return res.json({ message: "Dacă există un cont cu acest email, vei primi instrucțiuni de resetare." });
    }

    const user = userRes.rows[0];
    await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [user.id]);

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
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
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Parola trebuie să aibă minim 6 caractere" });
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
router.get("/logout", (req, res) => {
  res.clearCookie("ofai_token");
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

    res.render("public/account", {
      activePage: "cont",
      webUser: req.webUser,
      userPoints,
      favCount: parseInt(favCount.rows[0].total),
      followCount: parseInt(followCount.rows[0].total),
      reviewCount: parseInt(reviewCount.rows[0].total),
    });
  } catch (err) {
    console.error("[Web] Account error:", err);
    res.status(500).send("Eroare la încărcarea contului");
  }
});

router.get("/colectia-mea", requireWebAuth, async (req, res) => {
  try {
    const favoritesRes = await pool.query(`
      SELECT o.id, o.title, o.discount_type, o.discount_value,
             b.name as business_name, b.logo_url as business_logo,
             b.cover_image_url as business_cover,
             COALESCE(b.cover_image_url, o.logo_url, b.logo_url) as image_url,
             ci.name as city_name
      FROM favorite_offers f
      JOIN offers o ON o.id = f.offer_id
      JOIN businesses b ON b.id = o.business_id
      LEFT JOIN cities ci ON ci.id = b.city_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
    `, [req.webUser.id]);

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
      ORDER BY MAX(f.created_at) DESC
    `, [req.webUser.id]);

    res.render("public/colectia-mea", {
      favorites: favoritesRes.rows,
      subscriptions: subscriptionsRes.rows,
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
      "SELECT preferred_city_id, preferred_category_ids FROM users WHERE id = $1",
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
      preferredCityId: prefs.preferred_city_id || null,
      preferredCategoryIds: prefs.preferred_category_ids || [],
    });
  } catch (err) {
    console.error("[Web] Preferences error:", err);
    res.status(500).send("Eroare la încărcarea preferințelor");
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

router.get("/pentru-business", (req, res) => {
  res.render("public/pentru-business", { activePage: null, webUser: req.webUser });
});

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
    await pool.query(
      "DELETE FROM favorite_offers WHERE user_id = $1 AND offer_id = $2",
      [req.webUser.id, parseInt(req.params.offerId)]
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
    await pool.query(
      "DELETE FROM followed_businesses WHERE user_id = $1 AND business_id = $2",
      [req.webUser.id, parseInt(req.params.businessId)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Unfollow error:", err);
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
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Parola nouă trebuie să aibă minim 6 caractere" });
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

// --- Delete Account ---
router.delete("/api/web/delete-account", requireWebAuth, async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ message: "Parola este obligatorie" });
    }

    const userRes = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.webUser.id]);
    const isValid = await bcrypt.compare(password, userRes.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Parola este incorectă" });
    }

    await pool.query("DELETE FROM favorite_offers WHERE user_id = $1", [req.webUser.id]);
    await pool.query("DELETE FROM followed_businesses WHERE user_id = $1", [req.webUser.id]);
    await pool.query("DELETE FROM points_history WHERE user_id = $1", [req.webUser.id]);
    await pool.query("DELETE FROM user_points WHERE user_id = $1", [req.webUser.id]);
    await pool.query("DELETE FROM users WHERE id = $1", [req.webUser.id]);

    res.clearCookie("ofai_token");
    res.json({ success: true, redirect: "/" });
  } catch (err) {
    console.error("[Web API] Delete account error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// --- Update Preferences ---
router.put("/api/web/preferences", requireWebAuth, async (req, res) => {
  try {
    const { preferred_city_id, preferred_category_ids } = req.body || {};

    await pool.query(
      "UPDATE users SET preferred_city_id = $1, preferred_category_ids = $2 WHERE id = $3",
      [preferred_city_id || null, preferred_category_ids || [], req.webUser.id]
    );

    res.json({ success: true, message: "Preferințele au fost salvate!" });
  } catch (err) {
    console.error("[Web API] Preferences error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

module.exports = router;
