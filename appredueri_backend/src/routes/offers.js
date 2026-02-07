const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const { parsePagination, paginatedResponse } = require("../helpers/validate");

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
router.get("/", async (req, res) => {
  try {
    const { city_id, category_id, business_id, q, sort } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    const filters = [];
    const values = [];
    let idx = 1;

    filters.push("o.is_active = TRUE");
    filters.push("o.end_date >= CURRENT_DATE"); // Nu afișa oferte expirate

    if (city_id) { filters.push(`b.city_id = $${idx++}`); values.push(parseInt(city_id)); }
    if (category_id) { filters.push(`b.category_id = $${idx++}`); values.push(parseInt(category_id)); }
    if (business_id) { filters.push(`b.id = $${idx++}`); values.push(parseInt(business_id)); }

    if (q && q.trim()) {
      filters.push(`(o.title ILIKE $${idx} OR o.description ILIKE $${idx} OR b.name ILIKE $${idx})`);
      values.push(`%${q.trim()}%`);
      idx++;
    }

    let orderBy = "o.id DESC";
    if (sort === "discount_desc") orderBy = "o.discount_value DESC";
    if (sort === "ending_soon") orderBy = "o.end_date ASC";
    if (sort === "popular") orderBy = "rating_avg DESC NULLS LAST, o.id DESC";

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const query = `
      SELECT 
        o.id, o.title, o.description, o.discount_type, o.discount_value, 
        o.start_date, o.end_date,
        o.logo_url as offer_logo,

        b.id as business_id, b.name as business_name,
        b.lat, b.lng, b.logo_url as business_logo,
        b.cover_image_url as business_cover,

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
          rating_count: count
        }
      };
    });

    res.json(paginatedResponse(offers, total, page, limit));
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
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
      "SELECT preferred_city_id, preferred_category_ids FROM users WHERE id = $1",
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const { preferred_city_id, preferred_category_ids } = userRes.rows[0];

    // 2. Construiește query-ul
    const filters = [];
    const values = [];
    let idx = 1;

    // A. Filtre de bază (Active & Valabile)
    filters.push("o.is_active = TRUE");
    filters.push("o.end_date >= CURRENT_DATE");

    // B. Filtru Oraș (Dacă userul are unul setat)
    if (preferred_city_id) {
      filters.push(`b.city_id = $${idx++}`);
      values.push(preferred_city_id);
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
        b.id as business_id, b.name as business_name,
        b.lat, b.lng, b.logo_url as business_logo,
        b.cover_image_url as business_cover,
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
        rating_count: parseInt(row.rating_count || 0)
      }
    }));

    res.json(offers);

  } catch (err) {
    console.error("[Feed Error]", err);
    res.status(500).send("Server Error");
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
        o.start_date, o.end_date, o.is_active,
        o.logo_url as offer_logo,
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
        (SELECT COUNT(*) FROM reviews WHERE business_id = b.id) as rating_count
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
    ).catch(() => {});

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

    // 4. Imagini Galerie
    const galleryRes = await pool.query(
      `SELECT image_filename FROM business_images WHERE business_id = $1 ORDER BY sort_order ASC LIMIT 5`,
      [row.business_id]
    );
    const gallery = galleryRes.rows.map(img => ({
      url: makeAbsoluteUrl(req, `/uploads/businesses/${img.image_filename}`)
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
      is_active: row.is_active,

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
        rating_count: count
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
    res.status(500).send("Server Error");
  }
});

module.exports = router;
