const express = require("express");
const router = express.Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
// Note: adminAuth is applied globally in index.js via app.use("/admin", adminLimiter, adminAuth, adminRouter)
const { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } = require("../services/cloudinary");
const { LLM_CONFIG } = require("../config/llm");
const { triggerWebhook } = require("../services/n8n");
const {
  generateSummary,
  invalidateSummary,
  getExistingSummary,
  getLatestValidReviewId
} = require("../services/llm/summarizationService");
const { sendBusinessApprovedEmail, sendBusinessRejectedEmail } = require("../services/email");
const { parsePagination, createImageFilter } = require("../helpers/validate");
const { getBusinessTier, countLocations } = require("../helpers/tiers");

// =====================================
//   CONFIG UPLOADS (Memory Storage → Cloudinary)
// =====================================

const uploadsRoot = path.join(__dirname, "..", "uploads");
// Păstrăm referințele pentru ștergerea fișierelor vechi locale
const businessImagesUploadDir = path.join(uploadsRoot, "businesses");
const offerImagesUploadDir = path.join(uploadsRoot, "offers");

// Configurare Multer Memory Storage (pentru Cloudinary)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: createImageFilter(), // Whitelist: JPEG, PNG, WebP, GIF
});

const uploadBusinessImage = upload; // Alias pentru claritate
const uploadOfferImage = upload;    // Alias

/**
 * Helper pentru a șterge o imagine (fie de pe Cloudinary, fie local)
 */
async function deleteImage(imageUrl) {
  if (!imageUrl) return;

  try {
    const publicId = getPublicIdFromUrl(imageUrl);
    if (publicId) {
      // Este imagine Cloudinary
      await deleteFromCloudinary(publicId);
    } else {
      // Este imagine locală (Legacy)
      // imageUrl e de forma "/uploads/businesses/..."
      // Eliminăm primul slash pentru a construi calea corectă relativă la root-ul aplicației sau combinăm corect
      // Codul existent folosea: path.join(businessImagesUploadDir, filename)
      // Aici reconstruim calea absolută

      const safePath = path.join(__dirname, "..", imageUrl); // ../uploads/...
      if (fs.existsSync(safePath)) {
        fs.unlink(safePath, () => { });
      }
    }
  } catch (err) {
    console.error("Eroare la ștergerea imaginii:", err);
  }
}

async function loadReviewSummaryAdminData() {
  const result = await pool.query(
    `
    SELECT
      b.id,
      b.name,
      c.name AS city_name,
      cat.name AS category_name,
      COUNT(r.id) AS review_count,
      rs.id AS summary_id,
      rs.summary_text,
      rs.review_count AS summary_review_count,
      rs.generated_at,
      rs.last_review_id
    FROM businesses b
    LEFT JOIN cities c ON c.id = b.city_id
    LEFT JOIN categories cat ON cat.id = b.category_id
    LEFT JOIN reviews r ON r.business_id = b.id
    LEFT JOIN review_summaries rs ON rs.business_id = b.id
    GROUP BY
      b.id, b.name, c.name, cat.name,
      rs.id, rs.summary_text, rs.review_count,
      rs.generated_at, rs.last_review_id
    ORDER BY COUNT(r.id) DESC, b.name ASC
    `
  );

  const minReviews = LLM_CONFIG.summarization.minReviewCount;
  const rows = result.rows.map(row => ({
    id: row.id,
    name: row.name,
    city_name: row.city_name || "-",
    category_name: row.category_name || "-",
    review_count: Number(row.review_count || 0),
    summary_id: row.summary_id,
    summary_review_count: row.summary_review_count ? Number(row.summary_review_count) : 0,
    summary_text: row.summary_text || "",
    summary_snippet: row.summary_text ? row.summary_text.slice(0, 160) : "",
    generated_at: row.generated_at,
    last_review_id: row.last_review_id
  }));

  await Promise.all(
    rows.map(async (row) => {
      if (row.review_count < minReviews) {
        row.latest_valid_review_id = null;
        row.status = "insufficient";
        return;
      }

      row.latest_valid_review_id = await getLatestValidReviewId(row.id);

      if (!row.summary_id) {
        row.status = "missing";
        return;
      }

      if (!row.latest_valid_review_id || row.last_review_id !== row.latest_valid_review_id) {
        row.status = "stale";
        return;
      }

      row.status = "fresh";
    })
  );

  return { rows, minReviews };
}

// =====================================
//   ROOT ADMIN
// =====================================
router.get("/", (req, res) => {
  res.redirect("/admin/dashboard");
});

// =====================================
//   DASHBOARD
// =====================================

router.get("/dashboard", async (req, res) => {
  try {
    // Core stats (these tables definitely exist)
    const [
      businessCount,
      activeOfferCount,
      userCount,
      pendingRequestCount,
      recentReviewCount,
      newUsers7d,
      recentRequests,
      recentReviews
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM businesses"),
      pool.query("SELECT COUNT(*) FROM offers WHERE is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)"),
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT COUNT(*) FROM business_requests WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) FROM reviews WHERE created_at >= NOW() - INTERVAL '30 days'"),
      pool.query("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"),
      pool.query(`
        SELECT br.id, br.name, br.status, br.created_at,
               u.email AS user_email
        FROM business_requests br
        LEFT JOIN users u ON u.id = br.user_id
        ORDER BY br.created_at DESC LIMIT 5
      `),
      pool.query(`
        SELECT r.id, r.rating, r.comment, r.created_at,
               u.email AS user_email,
               b.name AS business_name
        FROM reviews r
        JOIN users u ON u.id = r.user_id
        JOIN businesses b ON b.id = r.business_id
        ORDER BY r.created_at DESC LIMIT 5
      `),
    ]);

    // Views stats (table might not exist)
    let views7d = 0, views30d = 0;
    try {
      const v7 = await pool.query("SELECT COUNT(*) FROM business_views WHERE viewed_at >= NOW() - INTERVAL '7 days'");
      const v30 = await pool.query("SELECT COUNT(*) FROM business_views WHERE viewed_at >= NOW() - INTERVAL '30 days'");
      views7d = parseInt(v7.rows[0].count);
      views30d = parseInt(v30.rows[0].count);
    } catch (e) {
      // business_views table might not exist
    }

    res.render("admin/dashboard", {
      stats: {
        businesses: parseInt(businessCount.rows[0].count),
        activeOffers: parseInt(activeOfferCount.rows[0].count),
        users: parseInt(userCount.rows[0].count),
        pendingRequests: parseInt(pendingRequestCount.rows[0].count),
        recentReviews: parseInt(recentReviewCount.rows[0].count),
        views7d,
        views30d,
        newUsers7d: parseInt(newUsers7d.rows[0].count),
      },
      recentRequests: recentRequests.rows,
      recentReviews: recentReviews.rows,
    });
  } catch (err) {
    console.error("[Admin] Dashboard error:", err);
    res.status(500).send("Eroare server");
  }
});

// =====================================
//   REVIEW SUMMARIES ADMIN
// =====================================

router.get("/review-summaries", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25 });
    const { rows, minReviews } = await loadReviewSummaryAdminData();
    const total = rows.length;
    const paginatedRows = rows.slice(offset, offset + limit);

    res.render("admin/review-summaries", {
      businesses: paginatedRows,
      minReviews,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      message: req.query.msg || "",
      error: req.query.err || ""
    });
  } catch (err) {
    console.error("Eroare la GET /admin/review-summaries:", err);
    res.status(500).send("Eroare server");
  }
});

router.post("/review-summaries/run-batch", async (req, res) => {
  try {
    const limit = Number(req.body.limit || 0);
    const { rows, minReviews } = await loadReviewSummaryAdminData();
    const candidates = limit > 0 ? rows.slice(0, limit) : rows;

    let regenerated = 0;
    let skipped = 0;
    let errors = 0;

    for (const business of candidates) {
      try {
        if (business.review_count < minReviews) {
          skipped += 1;
          continue;
        }

        const latestValidReviewId = business.latest_valid_review_id;
        if (!latestValidReviewId) {
          skipped += 1;
          continue;
        }

        const existing = await getExistingSummary(business.id);
        const needsRegeneration =
          !existing || existing.last_review_id !== latestValidReviewId;

        if (!needsRegeneration) {
          skipped += 1;
          continue;
        }

        await generateSummary(business.id, { force: true });
        regenerated += 1;
      } catch (err) {
        errors += 1;
      }
    }

    const msg = `Batch complet: regenerate=${regenerated}, skipped=${skipped}, errors=${errors}`;
    res.redirect(`/admin/review-summaries?msg=${encodeURIComponent(msg)}`);
  } catch (err) {
    console.error("Eroare la POST /admin/review-summaries/run-batch:", err);
    res.redirect("/admin/review-summaries?err=Batch failed");
  }
});

router.post("/review-summaries/:id/regenerate", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.redirect("/admin/review-summaries?err=ID invalid");

  try {
    await generateSummary(id, { force: true });
    res.redirect(`/admin/review-summaries?msg=${encodeURIComponent(`Regenerat pentru business ${id}`)}`);
  } catch (err) {
    console.error("Eroare la regenerare summary:", err);
    res.redirect(`/admin/review-summaries?err=${encodeURIComponent("Regenerare eșuată")}`);
  }
});

router.post("/review-summaries/:id/clear", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.redirect("/admin/review-summaries?err=ID invalid");

  try {
    await invalidateSummary(id);
    res.redirect(`/admin/review-summaries?msg=${encodeURIComponent(`Cache șters pentru business ${id}`)}`);
  } catch (err) {
    console.error("Eroare la ștergere summary:", err);
    res.redirect(`/admin/review-summaries?err=${encodeURIComponent("Ștergere eșuată")}`);
  }
});

// =====================================
//   BUSINESS-URI (CRUD + IMAGINI)
// =====================================

// GET /admin/businesses
router.get("/businesses", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25 });
    const { q, city_id, category_id } = req.query;

    const filters = [];
    const values = [];
    let idx = 1;

    if (q && q.trim()) {
      filters.push(`(b.name ILIKE $${idx} OR b.address ILIKE $${idx})`);
      values.push(`%${q.trim()}%`);
      idx++;
    }
    if (city_id) {
      filters.push(`c.id = $${idx++}`);
      values.push(parseInt(city_id));
    }
    if (category_id) {
      filters.push(`cat.id = $${idx++}`);
      values.push(parseInt(category_id));
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    // Count total
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM businesses b JOIN cities c ON c.id = b.city_id JOIN categories cat ON cat.id = b.category_id ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0].count);

    // Fetch page
    const result = await pool.query(`
      SELECT
        b.id, b.name, c.id AS city_id, c.name AS city_name,
        cat.id AS category_id, cat.name AS category_name,
        b.address, b.phone, b.website, b.lat, b.lng, b.is_verified
      FROM businesses b
      JOIN cities c ON c.id = b.city_id
      JOIN categories cat ON cat.id = b.category_id
      ${whereClause}
      ORDER BY b.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...values, limit, offset]);

    // Cities and categories for filters
    const [citiesRes, categoriesRes] = await Promise.all([
      pool.query("SELECT id, name FROM cities ORDER BY name"),
      pool.query("SELECT id, name FROM categories ORDER BY name"),
    ]);

    res.render("admin/businesses-list", {
      businesses: result.rows,
      cities: citiesRes.rows,
      categories: categoriesRes.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: { q: q || "", city_id: city_id || "", category_id: category_id || "" },
      error: req.query.err || "",
    });
  } catch (err) {
    console.error("Eroare la admin /businesses:", err);
    res.status(500).send("Eroare server");
  }
});

// GET /admin/businesses/new
router.get("/businesses/new", async (req, res) => {
  try {
    const [citiesResult, categoriesResult] = await Promise.all([
      pool.query("SELECT id, name FROM cities ORDER BY name"),
      pool.query("SELECT id, name FROM categories ORDER BY name"),
    ]);
    res.render("admin/businesses-new", {
      cities: citiesResult.rows,
      categories: categoriesResult.rows,
    });
  } catch (err) {
    console.error("Eroare:", err);
    res.status(500).send("Eroare server");
  }
});

// POST /admin/businesses/new
router.post("/businesses/new", async (req, res) => {
  try {
    const {
      name,
      city_id,
      category_id,
      address,
      lat,
      lng,
      phone,
      website,
      description,
    } = req.body;
    await pool.query(
      `INSERT INTO businesses (name, city_id, category_id, address, lat, lng, phone, website, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        name,
        city_id ? parseInt(city_id) : null,
        category_id ? parseInt(category_id) : null,
        address || null,
        lat ? parseFloat(lat) : null,
        lng ? parseFloat(lng) : null,
        phone || null,
        website || null,
        description || null,
      ]
    );
    res.redirect("/admin/businesses");
  } catch (err) {
    console.error("Eroare:", err);
    res.status(500).send("Eroare la salvare");
  }
});

// GET /admin/businesses/:id/edit
router.get("/businesses/:id/edit", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");

  try {
    const [
      businessResult,
      citiesResult,
      categoriesResult,
      imagesResult,
      locationsResult,
      ownersResult, // NEW
    ] = await Promise.all([
      pool.query("SELECT id, name, city_id, category_id, address, lat, lng, phone, website, description, logo_url, cover_image_url, is_verified, verified_at FROM businesses WHERE id = $1", [id]),
      pool.query("SELECT id, name FROM cities ORDER BY name"),
      pool.query("SELECT id, name FROM categories ORDER BY name"),
      pool.query(
        "SELECT id, image_filename, image_url, sort_order FROM business_images WHERE business_id = $1 ORDER BY sort_order NULLS LAST, id ASC",
        [id]
      ),
      pool.query(
        `SELECT
          bl.id, bl.address, bl.lat, bl.lng, bl.phone, bl.city_id, bl.booking_type, bl.booking_phone, bl.booking_whatsapp, bl.booking_url, bl.booking_instructions, c.name AS city_name
        FROM business_locations bl
        LEFT JOIN cities c ON c.id = bl.city_id
        WHERE bl.business_id = $1
        ORDER BY bl.id ASC`,
        [id]
      ),
      // Fetch owners
      pool.query(
        `SELECT u.id, u.email, u.first_name, u.last_name 
         FROM user_businesses ub 
         JOIN users u ON u.id = ub.user_id 
         WHERE ub.business_id = $1`,
        [id]
      ),
    ]);

    if (businessResult.rows.length === 0) {
      return res.status(404).send("Business-ul nu există");
    }

    res.render("admin/businesses-edit", {
      business: businessResult.rows[0],
      cities: citiesResult.rows,
      categories: categoriesResult.rows,
      images: imagesResult.rows,
      locations: locationsResult.rows,
      owners: ownersResult.rows, // SEND TO VIEW
      error: req.query.err || "",
    });
  } catch (err) {
    console.error("Eroare la GET /admin/businesses/:id/edit:", err);
    res.status(500).send("Eroare server");
  }
});

// POST /admin/businesses/:id/edit (Update business + locații & booking)
router.post("/businesses/:id/edit", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");

  try {
    const {
      name,
      city_id,
      category_id,
      address,
      lat,
      lng,
      phone,
      website,
      description,
      locations,
    } = req.body;

    const isVerified = req.body.is_verified === 'on';

    // 1) Update business
    await pool.query(
      `
      UPDATE businesses
      SET
        name = $1,
        city_id = $2,
        category_id = $3,
        address = $4,
        lat = $5,
        lng = $6,
        phone = $7,
        website = $8,
        description = $9,
        is_verified = $10,
        verified_at = CASE WHEN $10::boolean = true AND (is_verified IS NULL OR is_verified = false) THEN NOW() ELSE verified_at END
      WHERE id = $11
      `,
      [
        name,
        city_id ? parseInt(city_id, 10) : null,
        category_id ? parseInt(category_id, 10) : null,
        address || null,
        lat ? parseFloat(lat) : null,
        lng ? parseFloat(lng) : null,
        phone || null,
        website || null,
        description || null,
        isVerified,
        id,
      ]
    );

    // 2) Update locații & booking

    // Cazul 1: locations este ARRAY (exact cum apare în logul tău)
    if (Array.isArray(locations)) {
      for (const locData of locations) {
        const locId = parseInt(locData.id, 10);
        if (Number.isNaN(locId)) continue;

        const locAddress = (locData.address || "").trim() || null;
        const locPhone = (locData.phone || "").trim() || null;
        const bookingType = (locData.booking_type || "NONE").trim();
        const bookingPhone = (locData.booking_phone || "").trim() || null;
        const bookingWhatsapp = (locData.booking_whatsapp || "").trim() || null;
        const bookingUrl = (locData.booking_url || "").trim() || null;
        const bookingInstructions =
          (locData.booking_instructions || "").trim() || null;

        await pool.query(
          `
          UPDATE business_locations
          SET
            address = $1,
            phone = $2,
            booking_type = $3,
            booking_phone = $4,
            booking_whatsapp = $5,
            booking_url = $6,
            booking_instructions = $7
          WHERE id = $8 AND business_id = $9
          `,
          [
            locAddress,
            locPhone,
            bookingType,
            bookingPhone,
            bookingWhatsapp,
            bookingUrl,
            bookingInstructions,
            locId,
            id,
          ]
        );
      }
    }
    // Cazul 2: locations este obiect (fallback, dacă parserul se schimbă)
    else if (locations && typeof locations === "object") {
      const entries = Object.entries(locations); // [ [locId, data], ... ]
      for (const [rawLocId, locData] of entries) {
        const locId = parseInt(rawLocId || locData.id, 10);
        if (Number.isNaN(locId)) continue;

        const locAddress = (locData.address || "").trim() || null;
        const locPhone = (locData.phone || "").trim() || null;
        const bookingType = (locData.booking_type || "NONE").trim();
        const bookingPhone = (locData.booking_phone || "").trim() || null;
        const bookingWhatsapp = (locData.booking_whatsapp || "").trim() || null;
        const bookingUrl = (locData.booking_url || "").trim() || null;
        const bookingInstructions =
          (locData.booking_instructions || "").trim() || null;

        await pool.query(
          `
          UPDATE business_locations
          SET
            address = $1,
            phone = $2,
            booking_type = $3,
            booking_phone = $4,
            booking_whatsapp = $5,
            booking_url = $6,
            booking_instructions = $7
          WHERE id = $8 AND business_id = $9
          `,
          [
            locAddress,
            locPhone,
            bookingType,
            bookingPhone,
            bookingWhatsapp,
            bookingUrl,
            bookingInstructions,
            locId,
            id,
          ]
        );
      }
    }

    res.redirect("/admin/businesses");
  } catch (err) {
    console.error("Eroare la POST /admin/businesses/:id/edit:", err);
    res.status(500).send("Eroare la update");
  }
});

// POST Upload Logo
router.post(
  "/businesses/:id/logo",
  uploadBusinessImage.single("logo"),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).send("ID invalid");

    try {
      if (!req.file) {
        return res.redirect(`/admin/businesses/${id}/edit?err=no_file`);
      }

      // 1. Obține vechiul logo pentru ștergere
      const oldRes = await pool.query("SELECT logo_url FROM businesses WHERE id = $1", [id]);
      if (oldRes.rows[0]?.logo_url) {
        await deleteImage(oldRes.rows[0].logo_url);
      }

      // 2. Upload pe Cloudinary (resize 400x400)
      const result = await uploadToCloudinary(req.file.buffer, "logo");

      // 3. Update DB
      await pool.query(`UPDATE businesses SET logo_url = $1 WHERE id = $2`, [
        result.url,
        id,
      ]);

      res.redirect(`/admin/businesses/${id}/edit`);
    } catch (err) {
      console.error("Error saving logo:", err);
      res.status(500).send("Eroare logo");
    }
  }
);

// POST Upload Cover Image
// POST Upload Cover Image
router.post(
  "/businesses/:id/cover",
  uploadBusinessImage.single("cover"),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).send("ID invalid");
    try {
      if (!req.file)
        return res.redirect(`/admin/businesses/${id}/edit?err=no_file`);

      // 1. Șterge vechiul cover
      const oldRes = await pool.query("SELECT cover_image_url FROM businesses WHERE id = $1", [id]);
      if (oldRes.rows[0]?.cover_image_url) {
        await deleteImage(oldRes.rows[0].cover_image_url);
      }

      // 2. Upload Cloudinary (resize 1200x600)
      const result = await uploadToCloudinary(req.file.buffer, "cover");

      // 3. Update DB
      await pool.query(`UPDATE businesses SET cover_image_url = $1 WHERE id = $2`, [
        result.url,
        id,
      ]);
      res.redirect(`/admin/businesses/${id}/edit`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Eroare cover image");
    }
  }
);

// POST Delete Business (full FK cascade in transaction)
router.post("/businesses/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");

  const client = await pool.connect();
  try {
    // Collect image URLs before deletion (for Cloudinary cleanup)
    const imgsRes = await client.query(
      "SELECT image_filename, image_url FROM business_images WHERE business_id = $1",
      [id]
    );
    const bInfo = await client.query("SELECT logo_url, cover_image_url FROM businesses WHERE id=$1", [id]);

    await client.query("BEGIN");

    // 1. Delete offer child tables first
    await client.query("DELETE FROM code_reveals WHERE offer_id IN (SELECT id FROM offers WHERE business_id = $1)", [id]);
    await client.query("DELETE FROM promo_codes WHERE offer_id IN (SELECT id FROM offers WHERE business_id = $1)", [id]);
    await client.query("DELETE FROM offer_views WHERE offer_id IN (SELECT id FROM offers WHERE business_id = $1)", [id]);
    await client.query("DELETE FROM offer_requests WHERE business_id = $1", [id]);
    await client.query("DELETE FROM offers WHERE business_id = $1", [id]);

    // 2. Delete review child tables
    await client.query("DELETE FROM review_responses WHERE review_id IN (SELECT id FROM reviews WHERE business_id = $1)", [id]);
    await client.query("DELETE FROM reviews WHERE business_id = $1", [id]);

    // 3. Delete analytics + relationships
    await client.query("DELETE FROM business_views WHERE business_id = $1", [id]);
    await client.query("DELETE FROM business_clicks WHERE business_id = $1", [id]);
    await client.query("DELETE FROM followed_businesses WHERE business_id = $1", [id]);
    await client.query("DELETE FROM user_businesses WHERE business_id = $1", [id]);

    // 4. Delete business data
    await client.query("DELETE FROM business_locations WHERE business_id = $1", [id]);
    await client.query("DELETE FROM business_images WHERE business_id = $1", [id]);
    await client.query("DELETE FROM business_requests WHERE business_id = $1", [id]);
    await client.query("DELETE FROM businesses WHERE id = $1", [id]);

    await client.query("COMMIT");

    // Cleanup Cloudinary images (fire-and-forget, outside transaction)
    if (bInfo.rows.length > 0) {
      await deleteImage(bInfo.rows[0].logo_url);
      await deleteImage(bInfo.rows[0].cover_image_url);
    }
    for (const img of imgsRes.rows) {
      const urlToDelete = img.image_url || (img.image_filename ? `/uploads/businesses/${img.image_filename}` : null);
      if (urlToDelete) await deleteImage(urlToDelete);
    }

    res.redirect("/admin/businesses");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Admin] Delete business error:", err);
    res.status(500).send("Eroare stergere");
  } finally {
    client.release();
  }
});

// POST Upload Image Gallery
router.post(
  "/businesses/:id/images",
  uploadBusinessImage.single("image"),
  async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).send("ID invalid");
    try {
      const countRes = await pool.query(
        "SELECT COUNT(*) AS cnt FROM business_images WHERE business_id = $1",
        [id]
      );
      if (Number(countRes.rows[0].cnt) >= 8) {
        return res.redirect(`/admin/businesses/${id}/edit?err=max_images`);
      }
      if (!req.file)
        return res.redirect(`/admin/businesses/${id}/edit?err=no_file`);

      // Upload Cloudinary (Gallery 1200x800)
      const result = await uploadToCloudinary(req.file.buffer, "gallery");

      // Salvăm URL-ul în image_url. 
      // NOTĂ: Tabela are 'image_filename' (legacy) și 'image_url' (pt Cloudinary). 
      // Ar trebui să folosim 'image_url' de acum.
      // Dacă tabela cere 'image_filename' not null, punem un placeholder sau numele fișierului, dar logica se mută pe image_url.

      // Verific dacă tabela are coloana image_url (din business-portal.js pare că are).
      // Voi încerca să inserez în image_url. Dacă business_images are constrângeri pe image_filename, s-ar putea să trebuiască să-l populăm și pe ăla.
      // Presupunem că image_url e coloana principală acum.

      await pool.query(
        `INSERT INTO business_images (business_id, image_url, sort_order, image_filename) VALUES ($1, $2, $3, '')`,
        [id, result.url, Number(countRes.rows[0].cnt) + 1]
      );

      res.redirect(`/admin/businesses/${id}/edit`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Eroare upload imagine");
    }
  }
);

// POST Delete Image
router.post("/business-images/:imageId/delete", async (req, res) => {
  const imageId = parseInt(req.params.imageId, 10);
  if (Number.isNaN(imageId)) return res.status(400).send("ID invalid");
  try {
    const imgRes = await pool.query(
      "SELECT business_id, image_filename, image_url FROM business_images WHERE id = $1",
      [imageId]
    );
    if (imgRes.rows.length === 0) return res.redirect("/admin/businesses");

    const { business_id, image_filename, image_url } = imgRes.rows[0];

    await pool.query("DELETE FROM business_images WHERE id = $1", [imageId]);

    // Delete Cloudinary sau Local
    const urlToDelete = image_url || (image_filename ? `/uploads/businesses/${image_filename}` : null);
    await deleteImage(urlToDelete);

    res.redirect(`/admin/businesses/${business_id}/edit`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Eroare stergere imagine");
  }
});

// =====================================
//   BUSINESS OWNERS (Administratori)
//   Permite admin-ului să atribuie utilizatori ca administratori ai unui business
//   Acești utilizatori vor avea acces la Business Portal pentru acel business
// =====================================

/**
 * POST /admin/businesses/:id/owners
 * Adaugă un utilizator ca administrator al business-ului
 * Body: { email: string }
 */
router.post("/businesses/:id/owners", async (req, res) => {
  const businessId = parseInt(req.params.id, 10);

  if (!businessId || isNaN(businessId)) {
    return res.redirect("/admin/businesses?err=invalid_id");
  }

  try {
    const email = ((req.body && req.body.email) || "").trim().toLowerCase();

    if (!email) {
      return res.redirect(`/admin/businesses/${businessId}/edit?err=invalid_data`);
    }

    // Pas 1: Găsește user-ul după email
    const userQuery = await pool.query(
      "SELECT id, role FROM users WHERE LOWER(email) = $1",
      [email]
    );

    if (userQuery.rows.length === 0) {
      return res.redirect(`/admin/businesses/${businessId}/edit?err=user_not_found`);
    }

    const user = userQuery.rows[0];

    // Pas 2: Verifică dacă relația există deja
    const checkQuery = await pool.query(
      "SELECT 1 FROM user_businesses WHERE user_id = $1 AND business_id = $2",
      [user.id, businessId]
    );

    if (checkQuery.rows.length > 0) {
      return res.redirect(`/admin/businesses/${businessId}/edit`);
    }

    // Pas 3: Inserează relația
    await pool.query(
      "INSERT INTO user_businesses (user_id, business_id) VALUES ($1, $2)",
      [user.id, businessId]
    );

    // Pas 4: Actualizează rolul user-ului dacă e necesar
    if (user.role === "user") {
      await pool.query(
        "UPDATE users SET role = 'business_owner' WHERE id = $1",
        [user.id]
      );
    }

    return res.redirect(`/admin/businesses/${businessId}/edit`);

  } catch (err) {
    console.error("[Owners] Add owner error:", err.message, err.stack);
    const safeMsg = (err.message || "Eroare internă").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    const detail = process.env.NODE_ENV === "production" ? "" : `<pre>${(err.stack || "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}</pre>`;
    return res.status(500).send(`<h1>Eroare la adăugare administrator</h1><p>${safeMsg}</p>${detail}<br><a href="/admin/businesses/${businessId}/edit">Înapoi</a>`);
  }
});

/**
 * POST /admin/businesses/:id/owners/:userId/delete
 * Revocă accesul unui utilizator la business
 */
router.post("/businesses/:id/owners/:userId/delete", async (req, res) => {
  const businessId = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);
  
  if (!businessId || !userId || isNaN(businessId) || isNaN(userId)) {
    return res.redirect("/admin/businesses?err=invalid_id");
  }

  try {
    // Pas 1: Șterge relația
    await pool.query(
      "DELETE FROM user_businesses WHERE user_id = $1 AND business_id = $2",
      [userId, businessId]
    );
    
    // Pas 2: Verifică dacă user-ul mai are alte business-uri
    const countQuery = await pool.query(
      "SELECT COUNT(*) as cnt FROM user_businesses WHERE user_id = $1",
      [userId]
    );
    
    // Pas 3: Dacă nu mai are, schimbă rolul înapoi la 'user'
    if (parseInt(countQuery.rows[0].cnt) === 0) {
      await pool.query(
        "UPDATE users SET role = 'user' WHERE id = $1 AND role = 'business_owner'",
        [userId]
      );
    }
    
    return res.redirect(`/admin/businesses/${businessId}/edit`);
    
  } catch (err) {
    console.error("[Owners] Delete error:", err);
    return res.redirect(`/admin/businesses/${businessId}/edit?err=server_error`);
  }
});

// =====================================
//   OFERTE – LISTĂ, NEW, EDIT
// =====================================

// GET /admin/offers
router.get("/offers", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25 });
    const { city_id, category_id, business_id, is_active, q } = req.query;
    const filters = [];
    const values = [];
    let idx = 1;

    if (city_id) {
      filters.push(`c.id = $${idx++}`);
      values.push(parseInt(city_id));
    }
    if (category_id) {
      filters.push(`cat.id = $${idx++}`);
      values.push(parseInt(category_id));
    }
    if (business_id) {
      filters.push(`b.id = $${idx++}`);
      values.push(parseInt(business_id));
    }
    if (is_active === "1") filters.push("o.is_active = TRUE");
    if (is_active === "0") filters.push("o.is_active = FALSE");
    if (q && q.trim()) {
      filters.push(
        `(o.title ILIKE $${idx} OR o.description ILIKE $${idx} OR b.name ILIKE $${idx})`
      );
      values.push(`%${q.trim()}%`);
      idx++;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    // Count total
    const countQuery = `SELECT COUNT(*) FROM offers o JOIN businesses b ON b.id = o.business_id JOIN cities c ON c.id = b.city_id JOIN categories cat ON cat.id = b.category_id ${whereClause}`;
    const countRes = await pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].count);

    // Fetch page
    const offersQuery = `
      SELECT o.id, o.title, o.is_active, o.discount_type, o.discount_value,
             b.name AS business_name, c.name AS city_name, cat.name AS category_name
      FROM offers o
      JOIN businesses b ON b.id = o.business_id
      JOIN cities c ON c.id = b.city_id
      JOIN categories cat ON cat.id = b.category_id
      ${whereClause} ORDER BY o.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const [offersResult, citiesResult, categoriesResult, businessesResult] =
      await Promise.all([
        pool.query(offersQuery, [...values, limit, offset]),
        pool.query("SELECT id, name FROM cities ORDER BY name"),
        pool.query("SELECT id, name FROM categories ORDER BY name"),
        pool.query(
          `SELECT b.id, b.name, c.name AS city_name FROM businesses b LEFT JOIN cities c ON c.id = b.city_id ORDER BY c.name, b.name LIMIT 5000`
        ),
      ]);

    res.render("admin/offers-list", {
      offers: offersResult.rows,
      cities: citiesResult.rows,
      categories: categoriesResult.rows,
      businesses: businessesResult.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: {
        city_id: city_id || "",
        category_id: category_id || "",
        business_id: business_id || "",
        is_active: is_active || "",
        q: q || "",
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Eroare server");
  }
});

// GET /admin/offers/new
router.get("/offers/new", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.name, c.name AS city_name FROM businesses b
      LEFT JOIN cities c ON c.id = b.city_id ORDER BY c.name, b.name LIMIT 5000
    `);
    res.render("admin/offers-new", { businesses: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Eroare server");
  }
});

// POST /admin/offers/new
router.post(
  "/offers/new",
  uploadOfferImage.single("image"),
  async (req, res) => {
    try {
      const {
        business_id,
        title,
        description,
        discount_type,
        discount_value,
        conditions,
        start_date,
        end_date,
        is_active,
      } = req.body;
      let logoUrl = null;
      if (req.file) {
        // Upload Cloudinary (Offer 800x600)
        const result = await uploadToCloudinary(req.file.buffer, "offer");
        logoUrl = result.url;
      }

      const insertResult = await pool.query(
        `INSERT INTO offers (business_id, title, description, discount_type, discount_value, conditions, start_date, end_date, is_active, logo_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          business_id ? Number(business_id) : null,
          title,
          description || null,
          discount_type || null,
          discount_value ? Number(discount_value) : null,
          conditions || null,
          start_date || null,
          end_date || null,
          is_active === "on",
          logoUrl,
        ]
      );

      // Trigger n8n webhook for new offer
      if (business_id) {
        const bizNameRes = await pool.query("SELECT name FROM businesses WHERE id = $1", [Number(business_id)]);
        triggerWebhook("/webhook/new-offer", {
          offer_id: insertResult.rows[0].id,
          business_id: Number(business_id),
          business_name: bizNameRes.rows[0]?.name || "Business",
          title: title,
          discount_type: discount_type || null,
          discount_value: discount_value ? Number(discount_value) : null,
          start_date: start_date || null,
          end_date: end_date || null,
          created_at: new Date().toISOString(),
        });
      }

      res.redirect("/admin/offers");
    } catch (err) {
      console.error(err);
      res.status(500).send("Eroare server");
    }
  }
);

// --- v2.0: EDITARE OFERTĂ CU MULTI-LOCAȚII ---

// GET /admin/offers/:id/edit
router.get("/offers/:id/edit", async (req, res) => {
  try {
    const offerId = req.params.id;

    // 1. Luăm oferta
    const offerResult = await pool.query(
      "SELECT id, business_id, title, description, discount_type, discount_value, conditions, start_date, end_date, is_active, logo_url, to_char(start_date, 'YYYY-MM-DD') as start_date_value, to_char(end_date, 'YYYY-MM-DD') as end_date_value FROM offers WHERE id = $1",
      [offerId]
    );

    if (offerResult.rows.length === 0)
      return res.status(404).send("Oferta nu a fost găsită");
    const offer = offerResult.rows[0];

    // 2. Luăm listele necesare
    const businessesRes = await pool.query(
      "SELECT id, name, city_id FROM businesses ORDER BY name LIMIT 5000"
    );
    const categoriesRes = await pool.query(
      "SELECT id, name FROM categories ORDER BY name"
    );

    // 3. Luăm locațiile business-ului curent
    const locationsRes = await pool.query(
      `
      SELECT bl.id, bl.address, c.name as city_name 
      FROM business_locations bl
      LEFT JOIN cities c ON bl.city_id = c.id
      WHERE bl.business_id = $1 
      ORDER BY bl.created_at
      `,
      [offer.business_id]
    );

    // 4. Vedem ce locații sunt deja bifate pentru oferta asta
    const selectedLocsRes = await pool.query(
      "SELECT location_id FROM offer_locations WHERE offer_id = $1",
      [offerId]
    );
    const selectedLocationIds = selectedLocsRes.rows.map(
      (r) => r.location_id
    );

    // 5. Randăm view-ul cu TOATE variabilele necesare
    res.render("admin/offers-edit", {
      offer,
      businesses: businessesRes.rows,
      categories: categoriesRes.rows,
      locations: locationsRes.rows, // Trimitem locațiile disponibile
      selectedLocationIds: selectedLocationIds, // Trimitem ce e bifat deja
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// POST /offers/:id/toggle-active
// POST /admin/offers/:id/edit  (UPDATE OFFER + MULTI-LOCAȚII + IMAGINE)
router.post(
  "/offers/:id/edit",
  uploadOfferImage.single("image"),
  async (req, res) => {
    const offerId = parseInt(req.params.id, 10);
    if (Number.isNaN(offerId)) return res.status(400).send("ID invalid");

    const {
      business_id,
      title,
      description,
      discount_type,
      discount_value,
      conditions,
      start_date,
      end_date,
      is_active,
      locations, // checkbox name="locations" din EJS
    } = req.body;

    // normalizează locations: string | string[] | undefined -> number[]
    const normalizeLocations = (v) => {
      if (!v) return [];
      const arr = Array.isArray(v) ? v : [v];
      return arr
        .map((x) => parseInt(String(x), 10))
        .filter((n) => Number.isFinite(n));
    };

    const requestedLocationIds = normalizeLocations(locations);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1) oferta curentă (pentru logo_url vechi)
      const oldRes = await client.query(
        "SELECT logo_url FROM offers WHERE id = $1",
        [offerId]
      );
      if (oldRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).send("Oferta nu există");
      }

      const oldLogoUrl = oldRes.rows[0].logo_url || null;

      // 2) dacă user a încărcat imagine nouă
      let newLogoUrl = null;
      if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer, "offer");
        newLogoUrl = result.url;
      }

      // 3) update offer
      await client.query(
        `
        UPDATE offers
        SET business_id = $1,
            title = $2,
            description = $3,
            discount_type = $4,
            discount_value = $5,
            conditions = $6,
            start_date = $7,
            end_date = $8,
            is_active = $9,
            logo_url = COALESCE($10, logo_url)
        WHERE id = $11
        `,
        [
          business_id ? Number(business_id) : null,
          title,
          description || null,
          discount_type || null,
          discount_value ? Number(discount_value) : null,
          conditions || null,
          start_date || null,
          end_date || null,
          is_active === "on",
          newLogoUrl, // doar dacă există file; altfel păstrează
          offerId,
        ]
      );

      // 4) MULTI-LOCAȚII
      // Convenția ta din UI: dacă NU bifezi nimic => valabilă peste tot => tabelul offer_locations trebuie să fie gol
      await client.query("DELETE FROM offer_locations WHERE offer_id = $1", [offerId]);

      if (requestedLocationIds.length > 0) {
        // validăm că locațiile aparțin business-ului selectat (altfel se poate salva prost)
        const allowedRes = await client.query(
          "SELECT id FROM business_locations WHERE business_id = $1",
          [Number(business_id)]
        );
        const allowed = new Set(allowedRes.rows.map((r) => r.id));
        const validIds = requestedLocationIds.filter((id) => allowed.has(id));

        for (const locId of validIds) {
          await client.query(
            "INSERT INTO offer_locations (offer_id, location_id) VALUES ($1, $2)",
            [offerId, locId]
          );
        }
      }

      await client.query("COMMIT");

      // 5) dacă am pus imagine nouă, ștergem imaginea veche
      if (newLogoUrl && oldLogoUrl) {
        await deleteImage(oldLogoUrl);
      }

      return res.redirect("/admin/offers");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Eroare la POST /admin/offers/:id/edit:", err);
      return res.status(500).send(`Eroare la update ofertă: ${err.message}`);
    } finally {
      client.release();
    }
  }
);


// POST /offers/:id/delete
router.post("/offers/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");
  try {
    const logoRes = await pool.query(
      "SELECT logo_url FROM offers WHERE id = $1",
      [id]
    );
    if (logoRes.rows.length > 0 && logoRes.rows[0].logo_url) {
      await deleteImage(logoRes.rows[0].logo_url);
    }
    await pool.query("DELETE FROM offers WHERE id = $1", [id]);
    res.redirect("/admin/offers");
  } catch (err) {
    console.error(err);
    res.status(500).send("Eroare stergere");
  }
});

// =====================================
//   LOCAȚII BUSINESS (GESTIONARE LOCAȚII)
// =====================================

// GET: List locations for a business
router.get("/businesses/:id/locations", async (req, res) => {
  const businessId = req.params.id;
  try {
    // Get business details for context
    const businessResult = await pool.query(
      "SELECT id, name FROM businesses WHERE id = $1",
      [businessId]
    );
    if (businessResult.rows.length === 0)
      return res.status(404).send("Business not found");

    // Get cities for the dropdown
    const citiesResult = await pool.query(
      "SELECT id, name FROM cities ORDER BY name ASC"
    );

    // Get existing locations
    const locationsResult = await pool.query(
      `
      SELECT bl.*, c.name as city_name 
      FROM business_locations bl
      LEFT JOIN cities c ON bl.city_id = c.id
      WHERE bl.business_id = $1 
      ORDER BY bl.created_at DESC
      `,
      [businessId]
    );

    res.render("admin/business_locations", {
      business: businessResult.rows[0],
      locations: locationsResult.rows,
      cities: citiesResult.rows,
      user: req.user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// POST: Update existing location (inline edit from locations page)
router.post("/businesses/:businessId/locations/:locationId", async (req, res) => {
  const { businessId, locationId } = req.params;
  const { city_id, address, phone, lat, lng } = req.body;

  const toNullableFloat = (v) => {
    if (v === "" || v == null) return null;
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  if (!city_id || !address) {
    return res.status(400).send("city_id și address sunt obligatorii");
  }

  try {
    const result = await pool.query(
      `
      UPDATE business_locations
      SET city_id = $1,
          address = $2,
          phone = $3,
          lat = $4,
          lng = $5
      WHERE id = $6 AND business_id = $7
      RETURNING id
      `,
      [
        Number(city_id),
        address,
        phone || null,
        toNullableFloat(lat),
        toNullableFloat(lng),
        Number(locationId),
        Number(businessId),
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).send("Locația nu există sau nu aparține acestui business");
    }

    return res.redirect(`/admin/businesses/${businessId}/locations`);
  } catch (err) {
    console.error("Update location error:", err);
    return res.status(500).send(`Eroare la update location: ${err.message}`);
  }
});


// POST: Create new location for a business
router.post("/businesses/:id/locations", async (req, res) => {
  const businessId = req.params.id;
  const { city_id, address, phone, lat, lng } = req.body;

  const toNullableFloat = (v) => {
    if (v === "" || v == null) return null;
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  if (!city_id || !address) {
    return res.status(400).send("city_id si address sunt obligatorii");
  }

  try {
    // Tier check: warn if over limit but still allow admin to create (Option B)
    const { plan } = await getBusinessTier(pool, parseInt(businessId));
    const currentCount = await countLocations(pool, parseInt(businessId));
    const locationLimit = plan.max_locations;
    const overLimit = locationLimit !== null && currentCount >= locationLimit;

    await pool.query(
      `INSERT INTO business_locations (business_id, city_id, address, phone, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        Number(businessId),
        Number(city_id),
        address,
        phone || null,
        toNullableFloat(lat),
        toNullableFloat(lng),
      ]
    );

    const redirectUrl = `/admin/businesses/${businessId}/locations`;
    if (overLimit) {
      return res.redirect(`${redirectUrl}?warn=location_limit&plan=${encodeURIComponent(plan.name)}&limit=${locationLimit}`);
    }
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error("Create location error:", err);
    return res.status(500).send(`Eroare la creare locatie: ${err.message}`);
  }
});

// POST: Delete location
router.post(
  "/businesses/:id/locations/:locId/delete",
  async (req, res) => {
    const { id, locId } = req.params;
    try {
      await pool.query(
        "DELETE FROM business_locations WHERE id = $1 AND business_id = $2",
        [locId, id]
      );
      res.redirect(`/admin/businesses/${id}/locations`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Error deleting location");
    }
  }
);

// =====================================
//   BUSINESS REQUESTS (user-submitted)
// =====================================

// GET /admin/business-requests — list all requests
router.get("/business-requests", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25 });

    const countRes = await pool.query("SELECT COUNT(*) FROM business_requests");
    const total = parseInt(countRes.rows[0].count);

    const { rows: requests } = await pool.query(`
      SELECT br.*,
             u.email as user_email, u.first_name as user_first_name, u.last_name as user_last_name,
             c.name as city_name,
             cat.name as category_name,
             ru.email as reviewer_email
      FROM business_requests br
      LEFT JOIN users u ON u.id = br.user_id
      LEFT JOIN cities c ON c.id = br.city_id
      LEFT JOIN categories cat ON cat.id = br.category_id
      LEFT JOIN users ru ON ru.id = br.reviewed_by
      ORDER BY
        CASE br.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'rejected' THEN 2 END,
        br.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.render("admin/business-requests", {
      requests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[Admin] Business requests list error:", err);
    res.status(500).send("Eroare la încărcarea cererilor.");
  }
});

// POST /admin/business-requests/:id/approve
router.post("/business-requests/:id/approve", async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get the request
    const { rows } = await client.query(
      "SELECT id, user_id, name, category_id, city_id, address, phone, website, description, ai_score, ai_flags, ai_reasoning, status FROM business_requests WHERE id = $1 AND status = 'pending'",
      [requestId]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.redirect("/admin/business-requests?error=not_found");
    }

    const request = rows[0];

    // Create the business (address NOT NULL in schema, default to empty string)
    const { rows: bizRows } = await client.query(
      `INSERT INTO businesses (name, city_id, category_id, address, phone, website, description, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'user_submitted')
       RETURNING id`,
      [request.name, request.city_id, request.category_id, request.address || '', request.phone, request.website, request.description]
    );
    const businessId = bizRows[0].id;

    // Assign the user as business owner (user_businesses has no role column)
    await client.query(
      "INSERT INTO user_businesses (user_id, business_id) VALUES ($1, $2)",
      [request.user_id, businessId]
    );

    // Update user role to business_owner if currently just 'user'
    await client.query(
      "UPDATE users SET role = 'business_owner' WHERE id = $1 AND role = 'user'",
      [request.user_id]
    );

    // Update the request
    await client.query(
      `UPDATE business_requests
       SET status = 'approved', business_id = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [businessId, null, requestId]
    );

    await client.query("COMMIT");
    console.log(`[Admin] Business request #${requestId} approved → business #${businessId}`);

    // Send email notification (non-blocking, don't fail the request)
    const { rows: userRows } = await pool.query(
      "SELECT email, first_name FROM users WHERE id = $1",
      [request.user_id]
    );
    if (userRows.length > 0) {
      sendBusinessApprovedEmail(userRows[0].email, userRows[0].first_name, request.name)
        .catch(err => console.error("[Admin] Failed to send approved email:", err));
    }

    res.redirect("/admin/business-requests?success=approved");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Admin] Approve business request error:", err);
    res.status(500).send("Eroare la aprobarea cererii.");
  } finally {
    client.release();
  }
});

// POST /admin/business-requests/:id/reject
router.post("/business-requests/:id/reject", async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const reason = req.body.reason ? req.body.reason.trim().slice(0, 500) : null;

  try {
    const { rowCount } = await pool.query(
      `UPDATE business_requests
       SET status = 'rejected', admin_notes = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $3 AND status = 'pending'`,
      [reason, null, requestId]
    );

    if (rowCount === 0) {
      return res.redirect("/admin/business-requests?error=not_found");
    }

    console.log(`[Admin] Business request #${requestId} rejected`);

    // Send email notification (non-blocking)
    const { rows: reqRows } = await pool.query(
      `SELECT br.name, br.user_id, u.email, u.first_name
       FROM business_requests br
       JOIN users u ON u.id = br.user_id
       WHERE br.id = $1`,
      [requestId]
    );
    if (reqRows.length > 0) {
      sendBusinessRejectedEmail(reqRows[0].email, reqRows[0].first_name, reqRows[0].name, reason)
        .catch(err => console.error("[Admin] Failed to send rejected email:", err));
    }

    res.redirect("/admin/business-requests?success=rejected");
  } catch (err) {
    console.error("[Admin] Reject business request error:", err);
    res.status(500).send("Eroare la respingerea cererii.");
  }
});

// =====================================
//   USERS MANAGEMENT
// =====================================

// GET /admin/users — list with pagination, search, filter
router.get("/users", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25 });
    const { q, role } = req.query;

    const filters = [];
    const values = [];
    let idx = 1;

    if (q && q.trim()) {
      filters.push(`(u.email ILIKE $${idx} OR u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx})`);
      values.push(`%${q.trim()}%`);
      idx++;
    }
    if (role) {
      filters.push(`u.role = $${idx++}`);
      values.push(role);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0].count);

    const result = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at, u.banned_at,
             COUNT(ub.business_id) AS businesses_count
      FROM users u
      LEFT JOIN user_businesses ub ON ub.user_id = u.id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...values, limit, offset]);

    res.render("admin/users-list", {
      users: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: { q: q || "", role: role || "" },
    });
  } catch (err) {
    console.error("[Admin] Users list error:", err);
    res.status(500).send("Eroare server");
  }
});

// GET /admin/users/:id/edit
router.get("/users/:id/edit", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");

  try {
    const [userRes, businessesRes, reviewsRes] = await Promise.all([
      pool.query("SELECT id, email, first_name, last_name, role, created_at, banned_at FROM users WHERE id = $1", [id]),
      pool.query(`
        SELECT b.id, b.name, c.name AS city_name
        FROM user_businesses ub
        JOIN businesses b ON b.id = ub.business_id
        LEFT JOIN cities c ON c.id = b.city_id
        WHERE ub.user_id = $1
        ORDER BY b.name
      `, [id]),
      pool.query(`
        SELECT r.id, r.rating, r.comment, r.created_at, b.name AS business_name
        FROM reviews r
        JOIN businesses b ON b.id = r.business_id
        WHERE r.user_id = $1
        ORDER BY r.created_at DESC
        LIMIT 20
      `, [id]),
    ]);

    if (userRes.rows.length === 0) {
      return res.status(404).send("Utilizatorul nu există");
    }

    res.render("admin/users-edit", {
      user: userRes.rows[0],
      businesses: businessesRes.rows,
      reviews: reviewsRes.rows,
      error: req.query.err || "",
      message: req.query.message || "",
    });
  } catch (err) {
    console.error("[Admin] User edit error:", err);
    res.status(500).send("Eroare server");
  }
});

// POST /admin/users/:id/edit
router.post("/users/:id/edit", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");

  try {
    const { first_name, last_name, role } = req.body;
    const validRoles = ["user", "business_owner", "admin"];

    if (!validRoles.includes(role)) {
      return res.redirect(`/admin/users/${id}/edit?err=invalid_role`);
    }

    await pool.query(
      "UPDATE users SET first_name = $1, last_name = $2, role = $3 WHERE id = $4",
      [first_name || null, last_name || null, role, id]
    );

    res.redirect(`/admin/users/${id}/edit?message=${encodeURIComponent("Utilizator actualizat cu succes")}`);
  } catch (err) {
    console.error("[Admin] User update error:", err);
    res.redirect(`/admin/users/${id}/edit?err=server_error`);
  }
});

// POST /admin/users/:id/ban
router.post("/users/:id/ban", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");

  try {
    await pool.query("UPDATE users SET banned_at = NOW() WHERE id = $1", [id]);
    res.redirect(`/admin/users/${id}/edit?message=${encodeURIComponent("Utilizator banat")}`);
  } catch (err) {
    console.error("[Admin] Ban error:", err);
    res.redirect(`/admin/users/${id}/edit?err=server_error`);
  }
});

// POST /admin/users/:id/unban
router.post("/users/:id/unban", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");

  try {
    await pool.query("UPDATE users SET banned_at = NULL WHERE id = $1", [id]);
    res.redirect(`/admin/users/${id}/edit?message=${encodeURIComponent("Ban ridicat")}`);
  } catch (err) {
    console.error("[Admin] Unban error:", err);
    res.redirect(`/admin/users/${id}/edit?err=server_error`);
  }
});

// =====================================
//   CITIES MANAGEMENT
// =====================================

router.get("/cities", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, COUNT(b.id) AS businesses_count
      FROM cities c
      LEFT JOIN businesses b ON b.city_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.render("admin/cities", {
      cities: result.rows,
      error: req.query.err || "",
      message: req.query.message || "",
    });
  } catch (err) {
    console.error("[Admin] Cities error:", err);
    res.status(500).send("Eroare server");
  }
});

router.post("/cities", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) {
      return res.redirect("/admin/cities?err=Numele este obligatoriu");
    }
    await pool.query("INSERT INTO cities (name) VALUES ($1)", [name]);
    res.redirect(`/admin/cities?message=${encodeURIComponent("Oraș adăugat: " + name)}`);
  } catch (err) {
    console.error("[Admin] Add city error:", err);
    res.redirect(`/admin/cities?err=${encodeURIComponent("Eroare la adăugare")}`);
  }
});

router.post("/cities/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.redirect("/admin/cities?err=ID invalid");

  try {
    const name = (req.body.name || "").trim();
    if (!name) {
      return res.redirect("/admin/cities?err=Numele este obligatoriu");
    }
    await pool.query("UPDATE cities SET name = $1 WHERE id = $2", [name, id]);
    res.redirect(`/admin/cities?message=${encodeURIComponent("Oraș actualizat")}`);
  } catch (err) {
    console.error("[Admin] Update city error:", err);
    res.redirect(`/admin/cities?err=${encodeURIComponent("Eroare la actualizare")}`);
  }
});

router.post("/cities/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.redirect("/admin/cities?err=ID invalid");

  try {
    // Check if city has businesses
    const countRes = await pool.query(
      "SELECT COUNT(*) AS cnt FROM businesses WHERE city_id = $1",
      [id]
    );
    if (parseInt(countRes.rows[0].cnt) > 0) {
      return res.redirect(`/admin/cities?err=${encodeURIComponent("Nu poți șterge acest oraș — are " + countRes.rows[0].cnt + " business-uri asociate")}`);
    }
    await pool.query("DELETE FROM cities WHERE id = $1", [id]);
    res.redirect(`/admin/cities?message=${encodeURIComponent("Oraș șters")}`);
  } catch (err) {
    console.error("[Admin] Delete city error:", err);
    res.redirect(`/admin/cities?err=${encodeURIComponent("Eroare la ștergere")}`);
  }
});

// =====================================
//   CATEGORIES MANAGEMENT
// =====================================

router.get("/categories", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, COUNT(b.id) AS businesses_count
      FROM categories c
      LEFT JOIN businesses b ON b.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.render("admin/categories", {
      categories: result.rows,
      error: req.query.err || "",
      message: req.query.message || "",
    });
  } catch (err) {
    console.error("[Admin] Categories error:", err);
    res.status(500).send("Eroare server");
  }
});

router.post("/categories", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) {
      return res.redirect("/admin/categories?err=Numele este obligatoriu");
    }
    await pool.query("INSERT INTO categories (name) VALUES ($1)", [name]);
    res.redirect(`/admin/categories?message=${encodeURIComponent("Categorie adăugată: " + name)}`);
  } catch (err) {
    console.error("[Admin] Add category error:", err);
    res.redirect(`/admin/categories?err=${encodeURIComponent("Eroare la adăugare")}`);
  }
});

router.post("/categories/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.redirect("/admin/categories?err=ID invalid");

  try {
    const name = (req.body.name || "").trim();
    if (!name) {
      return res.redirect("/admin/categories?err=Numele este obligatoriu");
    }
    await pool.query("UPDATE categories SET name = $1 WHERE id = $2", [name, id]);
    res.redirect(`/admin/categories?message=${encodeURIComponent("Categorie actualizată")}`);
  } catch (err) {
    console.error("[Admin] Update category error:", err);
    res.redirect(`/admin/categories?err=${encodeURIComponent("Eroare la actualizare")}`);
  }
});

router.post("/categories/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.redirect("/admin/categories?err=ID invalid");

  try {
    const countRes = await pool.query(
      "SELECT COUNT(*) AS cnt FROM businesses WHERE category_id = $1",
      [id]
    );
    if (parseInt(countRes.rows[0].cnt) > 0) {
      return res.redirect(`/admin/categories?err=${encodeURIComponent("Nu poți șterge această categorie — are " + countRes.rows[0].cnt + " business-uri asociate")}`);
    }
    await pool.query("DELETE FROM categories WHERE id = $1", [id]);
    res.redirect(`/admin/categories?message=${encodeURIComponent("Categorie ștearsă")}`);
  } catch (err) {
    console.error("[Admin] Delete category error:", err);
    res.redirect(`/admin/categories?err=${encodeURIComponent("Eroare la ștergere")}`);
  }
});

// =====================================
//   REVIEWS MODERATION
// =====================================

router.get("/reviews", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25 });
    const { q, rating, business_id } = req.query;

    const filters = [];
    const values = [];
    let idx = 1;

    if (q && q.trim()) {
      filters.push(`(r.comment ILIKE $${idx} OR u.email ILIKE $${idx} OR b.name ILIKE $${idx})`);
      values.push(`%${q.trim()}%`);
      idx++;
    }
    if (rating) {
      filters.push(`r.rating = $${idx++}`);
      values.push(parseInt(rating));
    }
    if (business_id) {
      filters.push(`r.business_id = $${idx++}`);
      values.push(parseInt(business_id));
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM reviews r LEFT JOIN users u ON u.id = r.user_id LEFT JOIN businesses b ON b.id = r.business_id ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0].count);

    const result = await pool.query(`
      SELECT r.id, r.rating, r.comment, r.created_at,
             u.id AS user_id, COALESCE(u.email, 'Utilizator șters') AS email, u.first_name, u.last_name,
             b.id AS business_id, COALESCE(b.name, 'Business șters') AS business_name,
             (SELECT COUNT(*) FROM review_responses rr WHERE rr.review_id = r.id) > 0 AS has_response
      FROM reviews r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN businesses b ON b.id = r.business_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...values, limit, offset]);

    res.render("admin/reviews-list", {
      reviews: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: { q: q || "", rating: rating || "", business_id: business_id || "" },
      message: req.query.message || "",
      error: req.query.err || "",
    });
  } catch (err) {
    console.error("[Admin] Reviews list error:", err);
    res.status(500).send("Eroare server");
  }
});

router.post("/reviews/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");

  try {
    // Delete associated review responses first
    await pool.query("DELETE FROM review_responses WHERE review_id = $1", [id]);
    await pool.query("DELETE FROM reviews WHERE id = $1", [id]);
    res.redirect(`/admin/reviews?message=${encodeURIComponent("Recenzie ștearsă")}`);
  } catch (err) {
    console.error("[Admin] Delete review error:", err);
    res.redirect(`/admin/reviews?err=${encodeURIComponent("Eroare la ștergere")}`);
  }
});

module.exports = router;
