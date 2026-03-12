const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const { optionalAuth } = require("../middleware/auth");
const { parsePagination, paginatedResponse } = require("../helpers/validate");
const { revealLimiter } = require("../middleware/rateLimiter");

// ==============================
// Helper: Construire URL absolut
// ==============================
function makeAbsoluteUrl(req, relativePath) {
  if (!relativePath) return null;
  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
    return relativePath;
  }

  const protocol = req.protocol;
  const host = req.get("host");
  const cleanPath = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${protocol}://${host}${cleanPath}`;
}

// ==============================
// GET / (Listare oferte)
// ==============================
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { city_id, category_id, business_id, q, sort } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    const filters = [];
    const values = [];
    let idx = 1;

    filters.push("o.is_active = TRUE");
    filters.push("(o.end_date IS NULL OR o.end_date >= CURRENT_DATE)"); // NULL = nu expiră

    if (city_id) { filters.push(`(b.city_id = $${idx++} OR b.category_id = (SELECT id FROM categories WHERE name = 'Magazine Online'))`); values.push(parseInt(city_id)); }
    if (category_id) { filters.push(`b.category_id = $${idx++}`); values.push(parseInt(category_id)); }
    if (business_id) { filters.push(`b.id = $${idx++}`); values.push(parseInt(business_id)); }

    // Apply user preferences if prefs=1 and user is authenticated and no manual city/category override
    if (req.query.prefs === '1' && req.user && !city_id && !category_id) {
      const prefsRes = await pool.query(
        "SELECT preferred_city_ids, preferred_category_ids FROM users WHERE id = $1",
        [req.user.id]
      );
      if (prefsRes.rows.length > 0) {
        const userPrefs = prefsRes.rows[0];
        if (userPrefs.preferred_city_ids && userPrefs.preferred_city_ids.length > 0) {
          filters.push(`(b.city_id = ANY($${idx}) OR b.category_id = (SELECT id FROM categories WHERE name = 'Magazine Online'))`);
          values.push(userPrefs.preferred_city_ids);
          idx++;
        }
        if (userPrefs.preferred_category_ids && userPrefs.preferred_category_ids.length > 0) {
          filters.push(`b.category_id = ANY($${idx})`);
          values.push(userPrefs.preferred_category_ids);
          idx++;
        }
      }
    }

    if (req.query.exclude) {
      filters.push(`o.id != $${idx++}`);
      values.push(parseInt(req.query.exclude));
    }

    if (q && q.trim()) {
      filters.push(`(o.title ILIKE $${idx} OR o.description ILIKE $${idx} OR b.name ILIKE $${idx})`);
      values.push(`%${q.trim()}%`);
      idx++;
    }

    // Filter to promoted offers only (for Premium businesses)
    if (req.query.promoted_only === '1') {
      filters.push(`splan.has_promoted_placement = TRUE`);
    }

    // Competitor blocking: if block_competitors_for is a business_id,
    // check if that business has competitor blocking enabled
    // and if so, filter to only that business's offers
    if (req.query.block_competitors_for) {
      const blockBizId = parseInt(req.query.block_competitors_for);
      if (!Number.isNaN(blockBizId)) {
        try {
          const tierCheck = await pool.query(`
            SELECT splan.has_competitor_blocking, bs.competitor_blocking_enabled
            FROM business_subscriptions bsub
            JOIN subscription_plans splan ON splan.id = bsub.plan_id
            JOIN businesses bs ON bs.id = bsub.business_id
            WHERE bsub.business_id = $1
              AND bsub.status IN ('active', 'trial')
            LIMIT 1
          `, [blockBizId]);

          if (tierCheck.rows.length > 0
              && tierCheck.rows[0].has_competitor_blocking
              && tierCheck.rows[0].competitor_blocking_enabled) {
            // Override: only show offers from this business
            filters.push(`b.id = $${idx}`);
            values.push(blockBizId);
            idx++;
          }
        } catch (e) { console.error('[Offers] Competitor blocking check error:', e.message); }
      }
    }

    const searchBoost = "CASE WHEN COALESCE(splan.has_search_priority, FALSE) THEN 0 ELSE 1 END, ";
    let orderBy = searchBoost + "o.id DESC";
    if (sort === "discount_desc") orderBy = searchBoost + "o.discount_value DESC";
    if (sort === "ending_soon") orderBy = searchBoost + "o.end_date ASC";
    // splan.slug is NULL when business has no active subscription (LEFT JOIN);
    // NULL comparisons fall through to ELSE 0 — free businesses get no boost.
    if (sort === "popular") orderBy = `(
      (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE business_id = b.id)
      + CASE WHEN splan.slug = 'premium' THEN 0.4 WHEN splan.slug = 'standard' THEN 0.1 ELSE 0 END
    ) DESC NULLS LAST, o.id DESC`;

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const query = `
      SELECT
        o.id, o.title, o.description, o.discount_type, o.discount_value,
        o.start_date, o.end_date, o.flash_expires_at,
        o.logo_url as offer_logo,
        EXISTS(SELECT 1 FROM promo_codes WHERE offer_id = o.id AND is_active = TRUE) as has_promo_code,

        b.id as business_id, b.name as business_name,
        b.lat, b.lng, b.logo_url as business_logo,
        b.cover_image_url as business_cover,
        b.is_verified as business_verified,
        b.subscription_badge_type as business_badge_type,

        c.name as city_name, cat.name as category_name,

        COALESCE(rev_agg.rating_avg, 0) as rating_avg,
        COALESCE(rev_agg.rating_count, 0) as rating_count,
        COALESCE(fav_agg.save_count, 0) as save_count,
        COALESCE(fav_agg.recent_favs, 0) >= 5 as is_trending,

        COALESCE(splan.has_promoted_placement, FALSE) as is_promoted,
        locs.locations as locations
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      LEFT JOIN (
        SELECT business_id, AVG(rating) AS rating_avg, COUNT(*) AS rating_count
        FROM reviews GROUP BY business_id
      ) rev_agg ON rev_agg.business_id = b.id
      LEFT JOIN (
        SELECT offer_id,
          COUNT(*) AS save_count,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '14 days') AS recent_favs
        FROM favorite_offers GROUP BY offer_id
      ) fav_agg ON fav_agg.offer_id = o.id
      LEFT JOIN business_subscriptions bsub
        ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
      LEFT JOIN subscription_plans splan
        ON splan.id = bsub.plan_id

      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'id', bl.id,
              'address', bl.address,
              'lat', bl.lat,
              'lng', bl.lng,
              'city_name', c2.name
            )
            ORDER BY bl.id
          ) FILTER (WHERE bl.id IS NOT NULL),
          '[]'::json
        ) AS locations
        FROM business_locations bl
        LEFT JOIN cities c2 ON c2.id = bl.city_id
        WHERE bl.business_id = b.id
          AND (
            NOT EXISTS (SELECT 1 FROM offer_locations ol WHERE ol.offer_id = o.id)
            OR bl.id IN (SELECT ol.location_id FROM offer_locations ol WHERE ol.offer_id = o.id)
          )
      ) locs ON true

      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limit, offset);

    // Count total (fara LIMIT/OFFSET)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      LEFT JOIN business_subscriptions bsub
        ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
      LEFT JOIN subscription_plans splan
        ON splan.id = bsub.plan_id
      ${whereClause}
    `;
    // values fara ultimele 2 (limit, offset)
    const countValues = values.slice(0, -2);

    const [result, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, countValues),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

    const offers = result.rows.map(row => {
      const avg = parseFloat(row.rating_avg || 0);
      const count = parseInt(row.rating_count || 0);

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        discount_type: row.discount_type,
        discount_value: row.discount_value,
        start_date: row.start_date,
        end_date: row.end_date,
        flash_expires_at: row.flash_expires_at || null,
        has_promo_code: !!row.has_promo_code,
        save_count: parseInt(row.save_count || 0),
        is_trending: row.is_trending === true,
        is_promoted: row.is_promoted || false,
        image_url: makeAbsoluteUrl(req, row.business_cover || row.offer_logo || row.business_logo),
        locations: Array.isArray(row.locations) ? row.locations : [],
        business: {
          id: row.business_id,
          name: row.business_name,
          logo_url: makeAbsoluteUrl(req, row.business_logo),
          cover_image_url: makeAbsoluteUrl(req, row.business_cover),
          city: row.city_name,
          category: row.category_name,
          lat: row.lat,
          lng: row.lng,
          rating: parseFloat(avg.toFixed(1)),
          rating_count: count,
          is_verified: row.business_verified || false,
          subscription_badge_type: row.business_badge_type || null,
          badge_type: row.business_badge_type || (row.business_verified ? 'verified' : null),
        }
      };
    });

    res.json(paginatedResponse(offers, total, page, limit));
  } catch (err) {
    console.error(err);
    res.status(500).send("Eroare server");
  }
});

// =======================================
// GET /flash - Active flash deals
// =======================================
router.get("/flash", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        o.id, o.title, o.description, o.discount_type, o.discount_value,
        o.start_date, o.end_date, o.flash_expires_at,
        o.logo_url as offer_logo,
        EXISTS(SELECT 1 FROM promo_codes WHERE offer_id = o.id AND is_active = TRUE) as has_promo_code,
        b.id as business_id, b.name as business_name,
        b.lat, b.lng, b.logo_url as business_logo,
        b.cover_image_url as business_cover,
        b.is_verified as business_verified,
        b.subscription_badge_type as business_badge_type,
        c.name as city_name, cat.name as category_name,
        (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE business_id = b.id) as rating_avg,
        (SELECT COUNT(*) FROM reviews WHERE business_id = b.id) as rating_count,
        (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      WHERE o.is_active = TRUE
        AND o.flash_expires_at IS NOT NULL
        AND o.flash_expires_at > NOW()
        AND o.moderation_status = 'approved'
      ORDER BY o.flash_expires_at ASC
      LIMIT 10
    `);

    const offers = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      start_date: row.start_date,
      end_date: row.end_date,
      flash_expires_at: row.flash_expires_at,
      has_promo_code: !!row.has_promo_code,
      save_count: parseInt(row.save_count || 0),
      image_url: makeAbsoluteUrl(req, row.business_cover || row.offer_logo || row.business_logo),
      business: {
        id: row.business_id,
        name: row.business_name,
        logo_url: makeAbsoluteUrl(req, row.business_logo),
        cover_image_url: makeAbsoluteUrl(req, row.business_cover),
        city: row.city_name,
        category: row.category_name,
        lat: row.lat,
        lng: row.lng,
        rating: parseFloat(parseFloat(row.rating_avg || 0).toFixed(1)),
        rating_count: parseInt(row.rating_count || 0),
        is_verified: row.business_verified || false,
        subscription_badge_type: row.business_badge_type || null,
        badge_type: row.business_badge_type || (row.business_verified ? 'verified' : null),
      }
    }));

    res.json({ data: offers });
  } catch (err) {
    console.error("[Flash Deals Error]", err.message);
    res.json({ data: [] });
  }
});

// =======================================
// GET /feed - Feed personalizat (User Preferences)
// =======================================
router.get("/feed", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Obține preferințele userului
    const userRes = await pool.query(
      "SELECT preferred_city_ids, preferred_category_ids FROM users WHERE id = $1",
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "Utilizatorul nu a fost găsit" });
    }

    const { preferred_city_ids, preferred_category_ids } = userRes.rows[0];

    // 2. Construiește query-ul
    const filters = [];
    const values = [];
    let idx = 1;

    // A. Filtre de bază (Active & Valabile)
    filters.push("o.is_active = TRUE");
    filters.push("(o.end_date IS NULL OR o.end_date >= CURRENT_DATE)");

    // B. Filtru Oraș (Dacă userul are unul setat) — Magazine Online apare în toate orașele
    if (preferred_city_ids && Array.isArray(preferred_city_ids) && preferred_city_ids.length > 0) {
      filters.push(`(b.city_id = ANY($${idx++}) OR b.category_id = (SELECT id FROM categories WHERE name = 'Magazine Online'))`);
      values.push(preferred_city_ids);
    }

    // C. Filtru Categorii (Dacă userul are setate)
    // Dacă array-ul e gol sau null, arătăm toate categoriile (sau am putea arăta nimic, dar UX-ul standard e "show all if no filter")
    // Totuși, "Feed" implică relevanță. Dacă nu are categorii, arătăm populare.
    // Dacă are categorii, filtrăm DOAR acelea.
    if (preferred_category_ids && Array.isArray(preferred_category_ids) && preferred_category_ids.length > 0) {
      // Construim clauza IN ($2, $3, ...)
      const placeholders = preferred_category_ids.map(() => `$${idx++}`).join(", ");
      filters.push(`b.category_id IN (${placeholders})`);
      values.push(...preferred_category_ids);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    // Query similar cu cel principal, dar filtrat
    const query = `
      SELECT
        o.id, o.title, o.description, o.discount_type, o.discount_value,
        o.start_date, o.end_date,
        o.logo_url as offer_logo,
        EXISTS(SELECT 1 FROM promo_codes WHERE offer_id = o.id AND is_active = TRUE) as has_promo_code,
        b.id as business_id, b.name as business_name,
        b.lat, b.lng, b.logo_url as business_logo,
        b.cover_image_url as business_cover,
        b.is_verified as business_verified,
        b.subscription_badge_type as business_badge_type,
        c.name as city_name, cat.name as category_name,
        (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE business_id = b.id) as rating_avg,
        (SELECT COUNT(*) FROM reviews WHERE business_id = b.id) as rating_count,
        locs.locations as locations
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          json_agg(json_build_object('id', bl.id, 'address', bl.address, 'lat', bl.lat, 'lng', bl.lng, 'city_name', c2.name) ORDER BY bl.id)
          FILTER (WHERE bl.id IS NOT NULL), '[]'::json
        ) AS locations
        FROM business_locations bl
        LEFT JOIN cities c2 ON c2.id = bl.city_id
        WHERE bl.business_id = b.id
          AND (NOT EXISTS (SELECT 1 FROM offer_locations ol WHERE ol.offer_id = o.id) OR bl.id IN (SELECT ol.location_id FROM offer_locations ol WHERE ol.offer_id = o.id))
      ) locs ON true
      ${whereClause}
      ORDER BY o.id DESC
      LIMIT 50
    `;

    const result = await pool.query(query, values);

    // Formatare rezultate (la fel ca GET /)
    const offers = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      start_date: row.start_date,
      end_date: row.end_date,
      has_promo_code: !!row.has_promo_code,
      image_url: makeAbsoluteUrl(req, row.business_cover || row.offer_logo || row.business_logo),
      locations: Array.isArray(row.locations) ? row.locations : [],
      business: {
        id: row.business_id,
        name: row.business_name,
        logo_url: makeAbsoluteUrl(req, row.business_logo),
        cover_image_url: makeAbsoluteUrl(req, row.business_cover),
        city: row.city_name,
        category: row.category_name,
        lat: row.lat,
        lng: row.lng,
        rating: parseFloat(parseFloat(row.rating_avg || 0).toFixed(1)),
        rating_count: parseInt(row.rating_count || 0),
        is_verified: row.business_verified || false,
        subscription_badge_type: row.business_badge_type || null,
        badge_type: row.business_badge_type || (row.business_verified ? 'verified' : null),
      }
    }));

    res.json(paginatedResponse(offers, offers.length, 1, offers.length || 50));

  } catch (err) {
    console.error("[Feed Error]", err);
    res.status(500).send("Eroare server");
  }
});

// =======================================
// GET /offers/deal-of-day - Oferta zilei
// =======================================
router.get("/deal-of-day", async (req, res) => {
  try {
    // Primary: manual flag
    let result = await pool.query(`
      SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
             o.logo_url as offer_logo,
             b.id as business_id, b.name as business_name, b.logo_url as business_logo,
             b.cover_image_url as business_cover, b.is_verified as business_verified,
             b.subscription_badge_type as business_badge_type,
             c.name as city_name,
             (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities c ON b.city_id = c.id
      WHERE o.is_active = TRUE
        AND o.is_deal_of_day = TRUE
        AND o.deal_of_day_date = CURRENT_DATE
        AND (o.end_date IS NULL OR o.end_date > CURRENT_DATE)
      LIMIT 1
    `);

    // Fallback: most engagement
    if (result.rows.length === 0) {
      result = await pool.query(`
        SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
               o.logo_url as offer_logo,
               b.id as business_id, b.name as business_name, b.logo_url as business_logo,
               b.cover_image_url as business_cover, b.is_verified as business_verified,
               b.subscription_badge_type as business_badge_type,
               c.name as city_name,
               (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count
        FROM offers o
        JOIN businesses b ON o.business_id = b.id
        LEFT JOIN cities c ON b.city_id = c.id
        WHERE o.is_active = TRUE
          AND (o.end_date IS NULL OR o.end_date > CURRENT_DATE)
        ORDER BY (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) +
                 (SELECT COUNT(*) FROM business_clicks bc WHERE bc.offer_id = o.id) DESC
        LIMIT 1
      `);
    }

    if (result.rows.length === 0) return res.json(null);

    const row = result.rows[0];
    res.json({
      id: row.id,
      title: row.title,
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      end_date: row.end_date,
      save_count: parseInt(row.save_count || 0),
      image_url: makeAbsoluteUrl(req, row.business_cover || row.offer_logo || row.business_logo),
      business: {
        id: row.business_id,
        name: row.business_name,
        logo_url: makeAbsoluteUrl(req, row.business_logo),
        city: row.city_name,
        is_verified: row.business_verified || false,
        subscription_badge_type: row.business_badge_type || null,
        badge_type: row.business_badge_type || (row.business_verified ? 'verified' : null),
      }
    });
  } catch (err) {
    console.error("[Deal of Day Error]", err.message);
    res.json(null);
  }
});

// =======================================
// GET /offers/:id - Detalii ofertă cu booking
// =======================================
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Fetch Offer + Business info + BOOKING info de la ambele
    const result = await pool.query(
      `
      SELECT
        o.id, o.business_id, o.title, o.description,
        o.discount_type, o.discount_value, o.conditions,
        o.start_date, o.end_date, o.flash_expires_at, o.is_active,
        o.logo_url as offer_logo,
        EXISTS(SELECT 1 FROM promo_codes WHERE offer_id = o.id AND is_active = TRUE) as has_promo_code,
        -- Booking ofertă
        o.booking_type as offer_booking_type,
        o.booking_phone as offer_booking_phone,
        o.booking_whatsapp as offer_booking_whatsapp,
        o.booking_url as offer_booking_url,
        o.booking_instructions as offer_booking_instructions,
        -- Business
        b.name as business_name,
        b.address as business_address,
        b.phone as business_phone,
        b.website as business_website,
        b.lat as business_lat,
        b.lng as business_lng,
        b.logo_url as business_logo,
        b.cover_image_url as business_cover,
        b.is_verified as business_verified,
        b.subscription_badge_type as business_badge_type,
        -- Booking business
        b.booking_type as biz_booking_type,
        b.booking_phone as biz_booking_phone,
        b.booking_whatsapp as biz_booking_whatsapp,
        b.booking_url as biz_booking_url,
        b.booking_instructions as biz_booking_instructions,
        -- City & Category
        c.id as city_id, c.name as city_name,
        cat.id as cat_id, cat.name as cat_name,
        -- Rating
        (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE business_id = b.id) as rating_avg,
        (SELECT COUNT(*) FROM reviews WHERE business_id = b.id) as rating_count,
        -- Platform polish
        (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count,
        (CASE WHEN (SELECT COUNT(*) FROM favorite_offers fo2 WHERE fo2.offer_id = o.id AND fo2.created_at > NOW() - INTERVAL '14 days') >= 5 THEN true ELSE false END) as is_trending,
        o.max_reveals,
        (SELECT COUNT(*) FROM code_reveals cr WHERE cr.offer_id = o.id) as reveal_count
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      WHERE o.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Oferta nu există" });
    }

    const row = result.rows[0];

    // Fire-and-forget view tracking
    pool.query(
      "INSERT INTO offer_views (offer_id, business_id, viewer_ip, user_agent) VALUES ($1, $2, $3, $4)",
      [id, row.business_id, req.ip || null, (req.get("user-agent") || "").substring(0, 500)]
    ).catch(err => console.error('[Analytics] Tracking failed:', err.message));

    // 2. Determină Booking-ul efectiv (inherit logic)
    let effectiveBooking = {
      type: 'none',
      phone: null,
      whatsapp: null,
      url: null,
      instructions: null
    };

    const offerBookingType = row.offer_booking_type || 'inherit';

    if (offerBookingType === 'inherit') {
      // Folosește setările de la business
      effectiveBooking = {
        type: row.biz_booking_type || 'none',
        phone: row.biz_booking_phone,
        whatsapp: row.biz_booking_whatsapp,
        url: row.biz_booking_url,
        instructions: row.biz_booking_instructions
      };
    } else {
      // Folosește setările specifice ofertei
      effectiveBooking = {
        type: offerBookingType,
        phone: row.offer_booking_phone,
        whatsapp: row.offer_booking_whatsapp,
        url: row.offer_booking_url,
        instructions: row.offer_booking_instructions
      };
    }

    // 3. Locațiile Valabile
    const linkRes = await pool.query(
      `SELECT location_id FROM offer_locations WHERE offer_id = $1`,
      [id]
    );

    const specificLocationIds = linkRes.rows.map(r => r.location_id);
    let locations = [];

    const baseLocQuery = `
      SELECT
        bl.id, bl.address, bl.lat, bl.lng, bl.phone,
        bl.booking_type, bl.booking_phone, bl.booking_whatsapp, bl.booking_url, bl.booking_instructions,
        c.name as city_name
      FROM business_locations bl
      LEFT JOIN cities c ON bl.city_id = c.id
    `;

    if (specificLocationIds.length > 0) {
      const locsRes = await pool.query(
        `${baseLocQuery} WHERE bl.id = ANY($1)`,
        [specificLocationIds]
      );
      locations = locsRes.rows;
    } else {
      const allLocsRes = await pool.query(
        `${baseLocQuery} WHERE bl.business_id = $1`,
        [row.business_id]
      );
      locations = allLocsRes.rows;
    }

    // 4. Imagini Galerie (Cloudinary image_url takes precedence over legacy image_filename)
    const galleryRes = await pool.query(
      `SELECT image_filename, image_url FROM business_images WHERE business_id = $1 ORDER BY sort_order ASC LIMIT 5`,
      [row.business_id]
    );
    const gallery = galleryRes.rows.map(img => ({
      url: img.image_url || makeAbsoluteUrl(req, `/uploads/businesses/${img.image_filename}`)
    }));

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
      flash_expires_at: row.flash_expires_at || null,
      is_active: row.is_active,
      has_promo_code: !!row.has_promo_code,
      save_count: parseInt(row.save_count || 0),
      is_trending: row.is_trending === true,
      max_reveals: row.max_reveals || null,
      reveal_count: parseInt(row.reveal_count || 0),

      image_url: makeAbsoluteUrl(req, row.business_cover || row.offer_logo || row.business_logo),

      // Booking efectiv (dupa logica inherit)
      booking: {
        type: effectiveBooking.type,
        phone: effectiveBooking.phone,
        whatsapp: effectiveBooking.whatsapp,
        url: makeAbsoluteUrl(req, effectiveBooking.url),
        instructions: effectiveBooking.instructions
      },

      business: {
        id: row.business_id,
        name: row.business_name,
        phone: row.business_phone,
        website: row.business_website,
        logo_url: makeAbsoluteUrl(req, row.business_logo),
        city: { id: row.city_id, name: row.city_name },
        category: { id: row.cat_id, name: row.cat_name },
        rating: parseFloat(avg.toFixed(1)),
        rating_count: count,
        is_verified: row.business_verified || false,
        subscription_badge_type: row.business_badge_type || null,
        badge_type: row.business_badge_type || (row.business_verified ? 'verified' : null),
      },

      // Locațiile pot avea booking propriu (de pe business_locations)
      locations: locations.map(l => ({
        id: l.id,
        address: l.address,
        lat: l.lat,
        lng: l.lng,
        phone: l.phone,
        cityName: l.city_name,
        booking_type: l.booking_type || 'none',
        booking_phone: l.booking_phone,
        booking_whatsapp: l.booking_whatsapp,
        booking_url: makeAbsoluteUrl(req, l.booking_url),
        booking_instructions: l.booking_instructions
      })),

      gallery
    };

    res.json(offer);
  } catch (err) {
    console.error(err);
    res.status(500).send("Eroare server");
  }
});

// =======================================
// POST /:id/reveal-code - Reveal promo code (Mobile, auth required)
// =======================================
router.post("/:id/reveal-code", revealLimiter, auth, async (req, res) => {
  try {
    const { id } = req.params;

    // First check if offer exists and is active
    const offerCheck = await pool.query("SELECT id FROM offers WHERE id = $1 AND is_active = TRUE", [id]);
    if (offerCheck.rows.length === 0) {
      return res.status(404).json({ message: "Oferta nu există" });
    }

    // Check max_reveals limit
    const limitCheck = await pool.query(
      "SELECT o.max_reveals, (SELECT COUNT(*) FROM code_reveals cr WHERE cr.offer_id = o.id) as reveal_count FROM offers o WHERE o.id = $1",
      [id]
    );
    if (limitCheck.rows[0] && limitCheck.rows[0].max_reveals !== null) {
      if (parseInt(limitCheck.rows[0].reveal_count) >= parseInt(limitCheck.rows[0].max_reveals)) {
        return res.status(410).json({ message: "Codul promoțional a atins limita de utilizări" });
      }
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
      [id, req.user.id, req.ip || null, promoRow.id]
    ).catch(err => console.error('[Analytics] Tracking failed:', err.message));

    res.json({ promo_code: promoRow.code });
  } catch (err) {
    console.error("[Offers] Reveal code error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// Click tracking (anonymous, mobile)
router.post("/clicks", async (req, res) => {
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

module.exports = router;
