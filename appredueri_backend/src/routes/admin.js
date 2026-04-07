const express = require("express");
const router = express.Router();
const pool = require("../db");
const cache = require("../services/cache");
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
const { sendBusinessApprovedEmail, sendBusinessRejectedEmail, sendOfferApprovedEmail, sendOfferRejectedEmail } = require("../services/email");
const sanitizeHtml = require("sanitize-html");
const { parsePagination, createImageFilter } = require("../helpers/validate");
const { getBusinessTier, countLocations, syncBadgeType } = require("../helpers/tiers");
const pushService = require("../services/pushNotifications");

const BLOG_ALLOWED_TAGS = ['p','br','strong','em','ul','ol','li','h2','h3','h4','a','img','blockquote','code','pre','table','thead','tbody','tr','th','td','figure','figcaption','span','div','hr'];
const BLOG_SANITIZE_OPTS = {
  allowedTags: BLOG_ALLOWED_TAGS,
  allowedAttributes: { a: ['href','target','rel'], img: ['src','alt','loading','width','height'], span: ['class'], div: ['class'] },
  allowedSchemes: ['https','http'],
};

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// =====================================
//   SIDEBAR NOTIFICATION BADGES
// =====================================
// Pre-fetch pending counts for sidebar badges on every admin page load
router.use(async (req, res, next) => {
  try {
    const [offers, requests, reports] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM offers WHERE moderation_status = 'pending_review'"),
      pool.query("SELECT COUNT(*) FROM business_requests WHERE status = 'pending'"),
      pool.query("SELECT COUNT(*) FROM reports WHERE status = 'pending'"),
    ]);
    res.locals.adminBadges = {
      offerModeration: parseInt(offers.rows[0].count),
      businessRequests: parseInt(requests.rows[0].count),
      reports: parseInt(reports.rows[0].count),
    };
  } catch (e) {
    res.locals.adminBadges = { offerModeration: 0, businessRequests: 0, reports: 0 };
  }
  next();
});

// =====================================
//   AUDIT LOG HELPER
// =====================================
async function adminLog(action, entityType, entityId, req, details = {}) {
  try {
    await pool.query(
      `INSERT INTO audit_log (action, entity_type, entity_id, user_id, ip_address, details)
       VALUES ($1, $2, $3, NULL, $4, $5)`,
      [action, entityType, entityId || null, req.ip, JSON.stringify(details)]
    );
  } catch (e) {
    console.error('[AuditLog] Failed to log:', action, entityType, entityId, e.message);
  }
}

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

      const baseDir = path.resolve(__dirname, "..");
      const resolved = path.resolve(__dirname, "..", imageUrl);
      if (!resolved.startsWith(baseDir + path.sep)) {
        console.error("[Admin] Path traversal attempt blocked:", imageUrl);
        return;
      }
      if (fs.existsSync(resolved)) {
        fs.unlink(resolved, () => { });
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
//   ANALYTICS (extracted to admin-analytics.js)
// =====================================
router.use(require("./admin-analytics"));

// =====================================
//   SUBSCRIPTIONS
// =====================================
router.get("/subscriptions", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25 });
    const { plan, status, q } = req.query;

    const filters = [];
    const values = [];
    let idx = 1;

    if (plan && ['free', 'standard', 'premium'].includes(plan)) {
      filters.push(`sp.slug = $${idx++}`);
      values.push(plan);
    }
    if (status && ['active', 'trial', 'past_due', 'cancelled', 'expired'].includes(status)) {
      filters.push(`bs.status = $${idx++}`);
      values.push(status);
    }
    if (q && q.trim()) {
      filters.push(`b.name ILIKE $${idx++}`);
      values.push(`%${q.trim()}%`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM business_subscriptions bs
       JOIN subscription_plans sp ON sp.id = bs.plan_id
       JOIN businesses b ON b.id = bs.business_id
       ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0].count);

    const result = await pool.query(`
      SELECT
        bs.id, bs.business_id, bs.status, bs.billing_cycle,
        bs.current_period_start, bs.current_period_end,
        bs.cancel_at_period_end, bs.trial_start, bs.trial_end,
        bs.stripe_subscription_id, bs.stripe_customer_id,
        bs.created_at,
        sp.slug AS plan_slug, sp.name AS plan_name, sp.badge_type,
        sp.price_monthly, sp.price_yearly,
        b.name AS business_name, b.logo_url
      FROM business_subscriptions bs
      JOIN subscription_plans sp ON sp.id = bs.plan_id
      JOIN businesses b ON b.id = bs.business_id
      ${whereClause}
      ORDER BY bs.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...values, limit, offset]);

    res.render("admin/subscriptions", {
      subscriptions: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: { plan: plan || "", status: status || "", q: q || "" },
      pageTitle: "Subscriptii",
      activePage: "subscriptions"
    });
  } catch (err) {
    console.error("[Admin] Subscriptions error:", err.message);
    res.status(500).send("Eroare server");
  }
});

// =====================================
//   DASHBOARD
// =====================================

router.get("/dashboard", async (req, res) => {
  try {
    // Stats (cached 1h) + recent items (always fresh)
    const [stats, recentRequests, recentReviews] = await Promise.all([
      cache.cached('admin:dashStats', 60 * 60 * 1000, async () => {
        const [businessCount, activeOfferCount, userCount, pendingRequestCount, recentReviewCount, newUsers7d] = await Promise.all([
          pool.query("SELECT COUNT(*) FROM businesses"),
          pool.query("SELECT COUNT(*) FROM offers WHERE is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)"),
          pool.query("SELECT COUNT(*) FROM users"),
          pool.query("SELECT COUNT(*) FROM business_requests WHERE status = 'pending'"),
          pool.query("SELECT COUNT(*) FROM reviews WHERE created_at >= NOW() - INTERVAL '30 days'"),
          pool.query("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"),
        ]);
        let views7d = 0, views30d = 0;
        try {
          const v7 = await pool.query("SELECT COUNT(*) FROM business_views WHERE viewed_at >= NOW() - INTERVAL '7 days'");
          const v30 = await pool.query("SELECT COUNT(*) FROM business_views WHERE viewed_at >= NOW() - INTERVAL '30 days'");
          views7d = parseInt(v7.rows[0].count);
          views30d = parseInt(v30.rows[0].count);
        } catch (e) { /* business_views table might not exist */ }
        return {
          businesses: parseInt(businessCount.rows[0].count),
          activeOffers: parseInt(activeOfferCount.rows[0].count),
          users: parseInt(userCount.rows[0].count),
          pendingRequests: parseInt(pendingRequestCount.rows[0].count),
          recentReviews: parseInt(recentReviewCount.rows[0].count),
          views7d,
          views30d,
          newUsers7d: parseInt(newUsers7d.rows[0].count),
        };
      }, { groups: ['admin'] }),
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

    res.render("admin/dashboard", {
      stats,
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
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
    const { rows } = await client.query(
      `INSERT INTO businesses (name, city_id, category_id, address, lat, lng, phone, website, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
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

    // Create free-tier subscription for the new business
    await client.query(`
      INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
      SELECT $1, sp.id, 'active', 'none'
      FROM subscription_plans sp WHERE sp.slug = 'free'
    `, [rows[0].id]);

    await syncBadgeType(client, rows[0].id, null);

    await client.query("COMMIT");
    cache.invalidateGroup('businesses'); cache.invalidateGroup('homepage'); cache.invalidateGroup('admin');
    adminLog('create_business', 'business', rows[0].id, req, { name: req.body.name });
    res.redirect("/admin/businesses");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Eroare:", err);
    res.status(500).send("Eroare la salvare");
  } finally {
    client.release();
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
      ownersResult,
      subscriptionResult,
      subHistoryResult,
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
          bl.id, bl.name, bl.address, bl.lat, bl.lng, bl.phone, bl.city_id, bl.booking_type, bl.booking_phone, bl.booking_whatsapp, bl.booking_url, bl.booking_instructions, c.name AS city_name
        FROM business_locations bl
        LEFT JOIN cities c ON c.id = bl.city_id
        WHERE bl.business_id = $1
        ORDER BY bl.id ASC`,
        [id]
      ),
      pool.query(
        `SELECT u.id, u.email, u.first_name, u.last_name
         FROM user_businesses ub
         JOIN users u ON u.id = ub.user_id
         WHERE ub.business_id = $1`,
        [id]
      ),
      // Subscription info
      pool.query(
        `SELECT bs.id AS sub_id, bs.status, bs.billing_cycle,
                bs.current_period_start, bs.current_period_end,
                bs.trial_start, bs.trial_end, bs.cancel_at_period_end,
                bs.stripe_subscription_id, bs.stripe_customer_id,
                bs.created_at AS sub_created_at,
                sp.slug AS plan_slug, sp.name AS plan_name, sp.badge_type,
                sp.price_monthly, sp.price_yearly
         FROM business_subscriptions bs
         JOIN subscription_plans sp ON sp.id = bs.plan_id
         WHERE bs.business_id = $1
         ORDER BY bs.created_at DESC LIMIT 1`,
        [id]
      ),
      // Subscription history (last 10)
      pool.query(
        `SELECT sh.action, sh.reason, sh.created_at,
                fp.name AS from_plan, tp.name AS to_plan
         FROM subscription_history sh
         LEFT JOIN subscription_plans fp ON fp.id = sh.from_plan_id
         JOIN subscription_plans tp ON tp.id = sh.to_plan_id
         WHERE sh.business_id = $1
         ORDER BY sh.created_at DESC LIMIT 10`,
        [id]
      ),
    ]);

    if (businessResult.rows.length === 0) {
      return res.status(404).send("Business-ul nu existe");
    }

    res.render("admin/businesses-edit", {
      business: businessResult.rows[0],
      cities: citiesResult.rows,
      categories: categoriesResult.rows,
      images: imagesResult.rows,
      locations: locationsResult.rows,
      owners: ownersResult.rows,
      subscription: subscriptionResult.rows[0] || null,
      subHistory: subHistoryResult.rows,
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

        const locName = (locData.name || "").trim() || null;
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
            name = $1,
            address = $2,
            phone = $3,
            booking_type = $4,
            booking_phone = $5,
            booking_whatsapp = $6,
            booking_url = $7,
            booking_instructions = $8
          WHERE id = $9 AND business_id = $10
          `,
          [
            locName,
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

        const locName = (locData.name || "").trim() || null;
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
            name = $1,
            address = $2,
            phone = $3,
            booking_type = $4,
            booking_phone = $5,
            booking_whatsapp = $6,
            booking_url = $7,
            booking_instructions = $8
          WHERE id = $9 AND business_id = $10
          `,
          [
            locName,
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

    cache.invalidateGroup('businesses'); cache.invalidateGroup('homepage'); cache.invalidateGroup('admin');
    adminLog('edit_business', 'business', id, req, { name: req.body.name });
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

    cache.invalidateGroup('businesses'); cache.invalidateGroup('offers'); cache.invalidateGroup('homepage'); cache.invalidateGroup('admin');
    adminLog('delete_business', 'business', id, req, { name: bInfo.rows[0]?.name });
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
    const { city_id, category_id, business_id, is_active, moderation_status, q } = req.query;
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
    if (moderation_status && ['auto_approved', 'pending_review', 'approved', 'rejected'].includes(moderation_status)) {
      filters.push(`o.moderation_status = $${idx++}`);
      values.push(moderation_status);
    }
    if (q && q.trim()) {
      filters.push(
        `(o.title ILIKE $${idx} OR o.description ILIKE $${idx} OR b.name ILIKE $${idx})`
      );
      values.push(`%${q.trim()}%`);
      idx++;
    }

    const joinClause = `FROM offers o
      JOIN businesses b ON b.id = o.business_id
      LEFT JOIN cities c ON c.id = b.city_id
      LEFT JOIN categories cat ON cat.id = b.category_id`;
    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    // Count total
    const countQuery = `SELECT COUNT(*) ${joinClause} ${whereClause}`;
    const countRes = await pool.query(countQuery, values);
    const total = parseInt(countRes.rows[0].count);

    // Fetch page
    const offersQuery = `
      SELECT o.id, o.title, o.is_active, o.discount_type, o.discount_value,
             o.moderation_status, o.ai_score, o.ai_flags,
             b.name AS business_name, c.name AS city_name, cat.name AS category_name
      ${joinClause}
      ${whereClause} ORDER BY o.id DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const [offersResult, citiesResult, categoriesResult, businessesResult] =
      await Promise.all([
        pool.query(offersQuery, [...values, limit, offset]),
        pool.query("SELECT id, name FROM cities ORDER BY name"),
        pool.query("SELECT id, name FROM categories ORDER BY name"),
        pool.query(
          `SELECT b.id, b.name, c.name AS city_name FROM businesses b LEFT JOIN cities c ON c.id = b.city_id ORDER BY c.name, b.name LIMIT 500`
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
        moderation_status: moderation_status || "",
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
      LEFT JOIN cities c ON c.id = b.city_id ORDER BY c.name, b.name LIMIT 500
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

      adminLog('create_offer', 'offer', insertResult.rows[0].id, req);
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
      "SELECT id, name, city_id FROM businesses ORDER BY name LIMIT 500"
    );
    const categoriesRes = await pool.query(
      "SELECT id, name FROM categories ORDER BY name"
    );

    // 3. Luăm locațiile business-ului curent
    const locationsRes = await pool.query(
      `
      SELECT bl.id, bl.name, bl.address, c.name as city_name
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

      adminLog('edit_offer', 'offer', offerId, req);
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
    cache.invalidateGroup('offers'); cache.invalidateGroup('homepage'); cache.invalidateGroup('admin');
    adminLog('delete_offer', 'offer', id, req);
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
  const { name, city_id, address, phone, lat, lng, maps_url } = req.body;

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
      SET name = $1,
          city_id = $2,
          address = $3,
          phone = $4,
          lat = $5,
          lng = $6,
          maps_url = $7
      WHERE id = $8 AND business_id = $9
      RETURNING id
      `,
      [
        (name || '').trim() || null,
        Number(city_id),
        address,
        phone || null,
        toNullableFloat(lat),
        toNullableFloat(lng),
        maps_url || null,
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
  const { name, city_id, address, phone, lat, lng, maps_url } = req.body;

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
      `INSERT INTO business_locations (business_id, city_id, name, address, phone, lat, lng, maps_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        Number(businessId),
        Number(city_id),
        (name || '').trim() || null,
        address,
        phone || null,
        toNullableFloat(lat),
        toNullableFloat(lng),
        maps_url || null,
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

    // Create free-tier subscription for the new business
    await client.query(`
      INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
      SELECT $1, sp.id, 'active', 'none'
      FROM subscription_plans sp WHERE sp.slug = 'free'
    `, [businessId]);

    await syncBadgeType(client, businessId, null);

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

    cache.invalidateGroup('businesses'); cache.invalidateGroup('homepage'); cache.invalidateGroup('admin');
    adminLog('approve_business_request', 'business_request', requestId, req);
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

    adminLog('reject_business_request', 'business_request', requestId, req, { reason });
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

    adminLog('edit_user', 'user', id, req, { first_name, last_name, role });
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
    adminLog('ban_user', 'user', id, req);
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
    adminLog('unban_user', 'user', id, req);
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
    cache.invalidateGroup('static'); cache.invalidateGroup('homepage');
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
    cache.invalidateGroup('static'); cache.invalidateGroup('homepage');
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
    cache.invalidateGroup('static'); cache.invalidateGroup('homepage');
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
    cache.invalidateGroup('static'); cache.invalidateGroup('homepage');
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
    cache.invalidateGroup('static'); cache.invalidateGroup('homepage');
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
    cache.invalidateGroup('static'); cache.invalidateGroup('homepage');
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
    adminLog('delete_review', 'review', id, req);
    res.redirect(`/admin/reviews?message=${encodeURIComponent("Recenzie ștearsă")}`);
  } catch (err) {
    console.error("[Admin] Delete review error:", err);
    res.redirect(`/admin/reviews?err=${encodeURIComponent("Eroare la ștergere")}`);
  }
});

// =====================================
//   REPORTS (User-submitted reports)
// =====================================

const REPORT_REASON_LABELS = {
  fake_offer: "Ofertă falsă",
  misleading_price: "Preț înșelător",
  closed_business: "Business închis",
  inappropriate_content: "Conținut inadecvat",
  spam: "Spam",
  other: "Altul",
};

router.get("/reports", async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const statusFilter = req.query.status || "";

  try {
    let whereClause = "";
    const values = [];
    if (statusFilter && ["pending", "reviewed", "dismissed"].includes(statusFilter)) {
      whereClause = "WHERE rp.status = $1";
      values.push(statusFilter);
    }

    const idx = values.length + 1;
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM reports rp ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0].count);

    const pendingRes = await pool.query(
      "SELECT COUNT(*) FROM reports WHERE status = 'pending'"
    );
    const pendingCount = parseInt(pendingRes.rows[0].count);

    const result = await pool.query(`
      SELECT rp.id, rp.target_type, rp.target_id, rp.reason, rp.details,
             rp.status, rp.admin_notes, rp.created_at, rp.reviewed_at,
             u.email AS reporter_email, u.first_name AS reporter_name,
             CASE
               WHEN rp.target_type = 'offer' THEN (SELECT title FROM offers WHERE id = rp.target_id)
               WHEN rp.target_type = 'business' THEN (SELECT name FROM businesses WHERE id = rp.target_id)
             END AS target_name,
             (SELECT COUNT(*) FROM reports r2
              WHERE r2.target_type = rp.target_type AND r2.target_id = rp.target_id
              AND r2.status = 'pending') AS total_reports_on_target
      FROM reports rp
      LEFT JOIN users u ON u.id = rp.reporter_id
      ${whereClause}
      ORDER BY
        CASE rp.status WHEN 'pending' THEN 0 ELSE 1 END,
        rp.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...values, limit, offset]);

    res.render("admin/reports", {
      reports: result.rows,
      reasonLabels: REPORT_REASON_LABELS,
      pendingCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      statusFilter,
      message: req.query.message || "",
      error: req.query.err || "",
    });
  } catch (err) {
    console.error("[Admin] Reports list error:", err);
    res.status(500).send("Eroare server");
  }
});

router.post("/reports/:id/review", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");

  const adminNotes = (req.body.admin_notes || "").trim().slice(0, 500);

  try {
    await pool.query(
      `UPDATE reports SET status = 'reviewed', admin_notes = $1, reviewed_at = NOW()
       WHERE id = $2 AND status = 'pending'`,
      [adminNotes || null, id]
    );
    adminLog('review_report', 'report', id, req);
    res.redirect(`/admin/reports?message=${encodeURIComponent("Raport marcat ca revizuit")}`);
  } catch (err) {
    console.error("[Admin] Review report error:", err);
    res.redirect(`/admin/reports?err=${encodeURIComponent("Eroare la procesare")}`);
  }
});

router.post("/reports/:id/dismiss", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");

  const adminNotes = (req.body.admin_notes || "").trim().slice(0, 500);

  try {
    await pool.query(
      `UPDATE reports SET status = 'dismissed', admin_notes = $1, reviewed_at = NOW()
       WHERE id = $2 AND status = 'pending'`,
      [adminNotes || null, id]
    );
    adminLog('dismiss_report', 'report', id, req);
    res.redirect(`/admin/reports?message=${encodeURIComponent("Raport respins")}`);
  } catch (err) {
    console.error("[Admin] Dismiss report error:", err);
    res.redirect(`/admin/reports?err=${encodeURIComponent("Eroare la procesare")}`);
  }
});

router.post("/reports/:id/deactivate-target", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");

  try {
    const { rows } = await pool.query(
      "SELECT target_type, target_id FROM reports WHERE id = $1",
      [id]
    );
    if (rows.length === 0) return res.status(404).send("Raport negăsit");

    const { target_type, target_id } = rows[0];
    const adminNotes = (req.body.admin_notes || "").trim().slice(0, 500) || "Dezactivat de admin";

    if (target_type === "offer") {
      await pool.query("UPDATE offers SET is_active = false WHERE id = $1", [target_id]);
    }

    // Mark all pending reports on this target as reviewed
    await pool.query(
      `UPDATE reports SET status = 'reviewed', admin_notes = $1, reviewed_at = NOW()
       WHERE target_type = $2 AND target_id = $3 AND status = 'pending'`,
      [adminNotes, target_type, target_id]
    );

    const action = target_type === "offer" ? "Ofertă dezactivată" : "Rapoarte procesate";
    adminLog('deactivate_target', 'report', id, req);
    res.redirect(`/admin/reports?message=${encodeURIComponent(action)}`);
  } catch (err) {
    console.error("[Admin] Deactivate target error:", err);
    res.redirect(`/admin/reports?err=${encodeURIComponent("Eroare la procesare")}`);
  }
});

// =====================================
//   OFFER MODERATION (AI-flagged offers)
// =====================================

router.get("/offer-moderation", async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  try {
    const countRes = await pool.query(
      "SELECT COUNT(*) FROM offers WHERE moderation_status = 'pending_review'"
    );
    const pendingCount = parseInt(countRes.rows[0].count);

    const result = await pool.query(`
      SELECT o.id, o.title, o.description, o.discount_type, o.discount_value,
             o.conditions, o.start_date, o.end_date, o.logo_url, o.image_url,
             o.moderation_status, o.ai_score, o.ai_flags, o.ai_reasoning,
             b.id AS business_id, b.name AS business_name,
             b.logo_url AS business_logo, b.cover_image_url AS business_cover,
             cat.name AS category_name,
             (SELECT ci.name FROM business_locations bl JOIN cities ci ON ci.id = bl.city_id WHERE bl.business_id = b.id LIMIT 1) AS city_name
      FROM offers o
      JOIN businesses b ON b.id = o.business_id
      LEFT JOIN categories cat ON cat.id = b.category_id
      WHERE o.moderation_status = 'pending_review'
      ORDER BY o.id DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.render("admin/offer-moderation", {
      offers: result.rows,
      pendingCount,
      pagination: { page, limit, total: pendingCount, totalPages: Math.ceil(pendingCount / limit) },
      message: req.query.message || "",
      error: req.query.err || "",
    });
  } catch (err) {
    console.error("[Admin] Offer moderation list error:", err);
    res.status(500).send("Eroare server");
  }
});

router.post("/offer-moderation/:id/approve", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");

  try {
    await pool.query(
      "UPDATE offers SET moderation_status = 'approved', is_active = true WHERE id = $1 AND moderation_status = 'pending_review'",
      [id]
    );

    // Email notification to business owner(s) — non-blocking
    const ownerRes = await pool.query(
      `SELECT o.title, b.name AS business_name, u.email, u.first_name
       FROM offers o
       JOIN businesses b ON b.id = o.business_id
       JOIN user_businesses ub ON ub.business_id = o.business_id
       JOIN users u ON u.id = ub.user_id
       WHERE o.id = $1`,
      [id]
    );
    for (const row of ownerRes.rows) {
      sendOfferApprovedEmail(row.email, row.first_name, row.title, row.business_name)
        .catch(err => console.error("[Admin] Failed to send offer approved email:", err));
    }

    cache.invalidateGroup('offers'); cache.invalidateGroup('homepage'); cache.invalidateGroup('admin');
    adminLog('approve_offer', 'offer', id, req);
    res.redirect(`/admin/offer-moderation?message=${encodeURIComponent("Ofertă aprobată și activată")}`);
  } catch (err) {
    console.error("[Admin] Approve offer error:", err);
    res.redirect(`/admin/offer-moderation?err=${encodeURIComponent("Eroare la aprobare")}`);
  }
});

router.post("/offer-moderation/:id/reject", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");

  const rejectionReason = (req.body.rejection_reason || "").trim();
  if (!rejectionReason) {
    return res.redirect(`/admin/offer-moderation?err=${encodeURIComponent("Trebuie să specifici un motiv de respingere")}`);
  }

  try {
    await pool.query(
      "UPDATE offers SET moderation_status = 'rejected', is_active = false, rejection_reason = $2 WHERE id = $1 AND moderation_status = 'pending_review'",
      [id, rejectionReason]
    );

    // Email notification to business owner(s) — non-blocking
    const ownerRes = await pool.query(
      `SELECT o.title, b.name AS business_name, u.email, u.first_name
       FROM offers o
       JOIN businesses b ON b.id = o.business_id
       JOIN user_businesses ub ON ub.business_id = o.business_id
       JOIN users u ON u.id = ub.user_id
       WHERE o.id = $1`,
      [id]
    );
    for (const row of ownerRes.rows) {
      sendOfferRejectedEmail(row.email, row.first_name, row.title, row.business_name, rejectionReason)
        .catch(err => console.error("[Admin] Failed to send offer rejected email:", err));
    }

    cache.invalidateGroup('offers'); cache.invalidateGroup('homepage'); cache.invalidateGroup('admin');
    adminLog('reject_offer', 'offer', id, req, { reason: rejectionReason });
    res.redirect(`/admin/offer-moderation?message=${encodeURIComponent("Ofertă respinsă")}`);
  } catch (err) {
    console.error("[Admin] Reject offer error:", err);
    res.redirect(`/admin/offer-moderation?err=${encodeURIComponent("Eroare la respingere")}`);
  }
});

// ═════════════════════════════════════════════
//   BULK OPERATIONS
// ═════════════════════════════════════════════

// POST /admin/offer-moderation/bulk/approve
router.post("/offer-moderation/bulk/approve", async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids required" });
  if (ids.length > 50) return res.status(400).json({ error: "Maximum 50 items per batch" });

  let approved = 0, skipped = 0, errors = 0;
  try {
    for (const rawId of ids) {
      const id = parseInt(rawId, 10);
      if (Number.isNaN(id)) { skipped++; continue; }
      try {
        const { rowCount } = await pool.query(
          "UPDATE offers SET moderation_status = 'approved', is_active = true WHERE id = $1 AND moderation_status = 'pending_review'",
          [id]
        );
        if (rowCount === 0) { skipped++; continue; }
        approved++;
        adminLog('approve_offer', 'offer', id, req, { bulk: true });

        // Email notification (fire-and-forget)
        pool.query(
          `SELECT o.title, b.name AS business_name, u.email, u.first_name
           FROM offers o JOIN businesses b ON b.id = o.business_id
           JOIN user_businesses ub ON ub.business_id = o.business_id
           JOIN users u ON u.id = ub.user_id WHERE o.id = $1`, [id]
        ).then(r => {
          for (const row of r.rows) {
            sendOfferApprovedEmail(row.email, row.first_name, row.title, row.business_name).catch(() => {});
          }
        }).catch(() => {});
      } catch (e) { errors++; console.error("[Bulk] Approve offer error:", id, e.message); }
    }
    cache.invalidateGroup('offers'); cache.invalidateGroup('homepage'); cache.invalidateGroup('admin');
    res.json({ approved, skipped, errors });
  } catch (err) {
    console.error("[Admin] Bulk approve error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /admin/offer-moderation/bulk/reject
router.post("/offer-moderation/bulk/reject", async (req, res) => {
  const { ids, reason } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids required" });
  if (ids.length > 50) return res.status(400).json({ error: "Maximum 50 items per batch" });
  const rejectionReason = (reason || "").trim();
  if (!rejectionReason) return res.status(400).json({ error: "reason required" });

  let rejected = 0, skipped = 0, errors = 0;
  try {
    for (const rawId of ids) {
      const id = parseInt(rawId, 10);
      if (Number.isNaN(id)) { skipped++; continue; }
      try {
        const { rowCount } = await pool.query(
          "UPDATE offers SET moderation_status = 'rejected', is_active = false, rejection_reason = $2 WHERE id = $1 AND moderation_status = 'pending_review'",
          [id, rejectionReason]
        );
        if (rowCount === 0) { skipped++; continue; }
        rejected++;
        adminLog('reject_offer', 'offer', id, req, { reason: rejectionReason, bulk: true });

        pool.query(
          `SELECT o.title, b.name AS business_name, u.email, u.first_name
           FROM offers o JOIN businesses b ON b.id = o.business_id
           JOIN user_businesses ub ON ub.business_id = o.business_id
           JOIN users u ON u.id = ub.user_id WHERE o.id = $1`, [id]
        ).then(r => {
          for (const row of r.rows) {
            sendOfferRejectedEmail(row.email, row.first_name, row.title, row.business_name, rejectionReason).catch(() => {});
          }
        }).catch(() => {});
      } catch (e) { errors++; console.error("[Bulk] Reject offer error:", id, e.message); }
    }
    cache.invalidateGroup('offers'); cache.invalidateGroup('homepage'); cache.invalidateGroup('admin');
    res.json({ rejected, skipped, errors });
  } catch (err) {
    console.error("[Admin] Bulk reject error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /admin/business-requests/bulk/approve
router.post("/business-requests/bulk/approve", async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids required" });
  if (ids.length > 20) return res.status(400).json({ error: "Maximum 20 items per batch" });

  let approved = 0, skipped = 0, errors = 0;
  try {
    for (const rawId of ids) {
      const id = parseInt(rawId, 10);
      if (Number.isNaN(id)) { skipped++; continue; }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query(
          "SELECT id, user_id, name, category_id, city_id, address, phone, website, description FROM business_requests WHERE id = $1 AND status = 'pending'",
          [id]
        );
        if (rows.length === 0) { await client.query("ROLLBACK"); skipped++; continue; }
        const request = rows[0];

        const { rows: bizRows } = await client.query(
          `INSERT INTO businesses (name, city_id, category_id, address, phone, website, description, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'user_submitted') RETURNING id`,
          [request.name, request.city_id, request.category_id, request.address || '', request.phone, request.website, request.description]
        );
        const businessId = bizRows[0].id;

        await client.query("INSERT INTO user_businesses (user_id, business_id) VALUES ($1, $2)", [request.user_id, businessId]);
        await client.query(`INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle) SELECT $1, sp.id, 'active', 'none' FROM subscription_plans sp WHERE sp.slug = 'free'`, [businessId]);
        await syncBadgeType(client, businessId, null);
        await client.query("UPDATE users SET role = 'business_owner' WHERE id = $1 AND role = 'user'", [request.user_id]);
        await client.query(`UPDATE business_requests SET status = 'approved', business_id = $1, reviewed_at = NOW(), updated_at = NOW() WHERE id = $2`, [businessId, id]);
        await client.query("COMMIT");
        approved++;
        adminLog('approve_business_request', 'business_request', id, req, { businessId, bulk: true });

        // Email (fire-and-forget)
        pool.query("SELECT email, first_name FROM users WHERE id = $1", [request.user_id])
          .then(r => { if (r.rows[0]) sendBusinessApprovedEmail(r.rows[0].email, r.rows[0].first_name, request.name).catch(() => {}); })
          .catch(() => {});
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        errors++;
        console.error("[Bulk] Approve business request error:", id, e.message);
      } finally {
        client.release();
      }
    }
    cache.invalidateGroup('businesses'); cache.invalidateGroup('homepage'); cache.invalidateGroup('admin');
    res.json({ approved, skipped, errors });
  } catch (err) {
    console.error("[Admin] Bulk approve requests error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /admin/business-requests/bulk/reject
router.post("/business-requests/bulk/reject", async (req, res) => {
  const { ids, reason } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids required" });
  if (ids.length > 50) return res.status(400).json({ error: "Maximum 50 items per batch" });
  const rejectReason = (reason || "").trim().slice(0, 500);

  let rejected = 0, skipped = 0, errors = 0;
  try {
    for (const rawId of ids) {
      const id = parseInt(rawId, 10);
      if (Number.isNaN(id)) { skipped++; continue; }
      try {
        const { rowCount } = await pool.query(
          `UPDATE business_requests SET status = 'rejected', admin_notes = $1, reviewed_at = NOW(), updated_at = NOW() WHERE id = $2 AND status = 'pending'`,
          [rejectReason || null, id]
        );
        if (rowCount === 0) { skipped++; continue; }
        rejected++;
        adminLog('reject_business_request', 'business_request', id, req, { reason: rejectReason, bulk: true });

        pool.query(`SELECT br.name, u.email, u.first_name FROM business_requests br JOIN users u ON u.id = br.user_id WHERE br.id = $1`, [id])
          .then(r => { if (r.rows[0]) sendBusinessRejectedEmail(r.rows[0].email, r.rows[0].first_name, r.rows[0].name, rejectReason).catch(() => {}); })
          .catch(() => {});
      } catch (e) { errors++; console.error("[Bulk] Reject request error:", id, e.message); }
    }
    cache.invalidateGroup('businesses'); cache.invalidateGroup('admin');
    res.json({ rejected, skipped, errors });
  } catch (err) {
    console.error("[Admin] Bulk reject requests error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ═════════════════════════════════════════════
//   AUDIT LOGS
// ═════════════════════════════════════════════
router.get("/audit-logs", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25 });
    const { action, entity_type } = req.query;

    const filters = [];
    const values = [];
    let idx = 1;

    if (action && action.trim()) {
      filters.push(`a.action = $${idx++}`);
      values.push(action.trim());
    }
    if (entity_type && entity_type.trim()) {
      filters.push(`a.entity_type = $${idx++}`);
      values.push(entity_type.trim());
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM audit_log a ${whereClause}`, values
    );
    const total = parseInt(countRes.rows[0].count);

    const result = await pool.query(`
      SELECT a.id, a.action, a.entity_type, a.entity_id, a.ip_address, a.details, a.created_at
      FROM audit_log a
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...values, limit, offset]);

    // Get distinct actions and entity types for filter dropdowns
    const [actionsRes, typesRes] = await Promise.all([
      pool.query("SELECT DISTINCT action FROM audit_log ORDER BY action"),
      pool.query("SELECT DISTINCT entity_type FROM audit_log WHERE entity_type IS NOT NULL ORDER BY entity_type")
    ]);

    res.render("admin/audit-logs", {
      logs: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: { action: action || "", entity_type: entity_type || "" },
      actionOptions: actionsRes.rows.map(r => r.action),
      entityTypeOptions: typesRes.rows.map(r => r.entity_type),
      pageTitle: "Audit Log",
      activePage: "audit-logs"
    });
  } catch (err) {
    console.error("[Admin] Audit logs error:", err.message);
    res.status(500).send("Eroare server");
  }
});

// ═════════════════════════════════════════════
//   CSV EXPORT
// ═════════════════════════════════════════════
router.get("/export/:type", async (req, res) => {
  const type = req.params.type;
  const allowed = ['businesses', 'users', 'offers', 'subscriptions', 'email-logs', 'audit-logs'];
  if (!allowed.includes(type)) return res.status(400).send("Tip export invalid");

  try {
    let rows, filename, headers;

    switch (type) {
      case 'businesses': {
        const r = await pool.query(`
          SELECT b.id, b.name, c.name AS city, cat.name AS category,
                 b.address, b.phone, b.website, b.is_verified,
                 COALESCE(sp.slug, 'free') AS plan,
                 bs.status AS sub_status, bs.billing_cycle
          FROM businesses b
          JOIN cities c ON c.id = b.city_id
          JOIN categories cat ON cat.id = b.category_id
          LEFT JOIN business_subscriptions bs ON bs.business_id = b.id AND bs.status IN ('active','trial')
          LEFT JOIN subscription_plans sp ON sp.id = bs.plan_id
          ORDER BY b.id
        `);
        rows = r.rows;
        filename = 'businesses';
        headers = ['id', 'name', 'city', 'category', 'address', 'phone', 'website', 'is_verified', 'plan', 'sub_status', 'billing_cycle'];
        break;
      }
      case 'users': {
        const r = await pool.query(`
          SELECT id, first_name, last_name, email, role, city_id,
                 created_at::date AS registered,
                 last_active_at::date AS last_active,
                 CASE WHEN banned_at IS NOT NULL THEN 'banned' ELSE 'active' END AS status
          FROM users ORDER BY id
        `);
        rows = r.rows;
        filename = 'users';
        headers = ['id', 'first_name', 'last_name', 'email', 'role', 'city_id', 'registered', 'last_active', 'status'];
        break;
      }
      case 'offers': {
        const r = await pool.query(`
          SELECT o.id, o.title, b.name AS business, o.discount_type, o.discount_value,
                 o.start_date::date, o.end_date::date, o.is_active, o.moderation_status,
                 o.views_count, o.clicks_count, o.saves_count
          FROM offers o
          JOIN businesses b ON b.id = o.business_id
          ORDER BY o.id DESC
        `);
        rows = r.rows;
        filename = 'offers';
        headers = ['id', 'title', 'business', 'discount_type', 'discount_value', 'start_date', 'end_date', 'is_active', 'moderation_status', 'views_count', 'clicks_count', 'saves_count'];
        break;
      }
      case 'subscriptions': {
        const r = await pool.query(`
          SELECT bs.id, b.name AS business, sp.slug AS plan, bs.status, bs.billing_cycle,
                 bs.current_period_end::date, bs.cancel_at_period_end,
                 bs.stripe_subscription_id, bs.stripe_customer_id,
                 bs.created_at::date AS created
          FROM business_subscriptions bs
          JOIN subscription_plans sp ON sp.id = bs.plan_id
          JOIN businesses b ON b.id = bs.business_id
          ORDER BY bs.created_at DESC
        `);
        rows = r.rows;
        filename = 'subscriptions';
        headers = ['id', 'business', 'plan', 'status', 'billing_cycle', 'current_period_end', 'cancel_at_period_end', 'stripe_subscription_id', 'stripe_customer_id', 'created'];
        break;
      }
      case 'email-logs': {
        const r = await pool.query(`
          SELECT id, email_type, email_to, status, created_at::date AS sent_date
          FROM email_logs ORDER BY created_at DESC LIMIT 10000
        `);
        rows = r.rows;
        filename = 'email-logs';
        headers = ['id', 'email_type', 'email_to', 'status', 'sent_date'];
        break;
      }
      case 'audit-logs': {
        const r = await pool.query(`
          SELECT id, action, entity_type, entity_id, ip_address, details, created_at
          FROM audit_log ORDER BY created_at DESC LIMIT 10000
        `);
        rows = r.rows;
        filename = 'audit-logs';
        headers = ['id', 'action', 'entity_type', 'entity_id', 'ip_address', 'details', 'created_at'];
        break;
      }
    }

    // Generate CSV
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const csvLines = [headers.join(',')];
    for (const row of rows) {
      csvLines.push(headers.map(h => escapeCsv(row[h])).join(','));
    }

    const now = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ofai-${filename}-${now}.csv"`);
    res.send('\ufeff' + csvLines.join('\n')); // BOM for Excel UTF-8
  } catch (err) {
    console.error("[Admin] Export error:", err.message);
    res.status(500).send("Eroare la export");
  }
});

// ═════════════════════════════════════════════
//   PUSH NOTIFICATIONS DASHBOARD
// ═════════════════════════════════════════════
router.get("/push-notifications", async (req, res) => {
  try {
    const [
      totalTokens, activeTokens, platformBreakdown, staleTokens,
      totalNotifs, recentNotifs, notifsByType, dailyNotifs
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) as cnt FROM push_tokens"),
      pool.query("SELECT COUNT(*) as cnt FROM push_tokens WHERE is_active = true"),
      pool.query("SELECT platform, COUNT(*) as cnt, SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_cnt FROM push_tokens GROUP BY platform ORDER BY cnt DESC"),
      pool.query("SELECT COUNT(*) as cnt FROM push_tokens WHERE is_active = true AND updated_at < NOW() - INTERVAL '90 days'"),
      pool.query("SELECT COUNT(*) as cnt FROM push_notifications_log"),
      pool.query("SELECT COUNT(*) as cnt FROM push_notifications_log WHERE created_at >= NOW() - INTERVAL '30 days'"),
      pool.query(`
        SELECT target_type, COUNT(*) as cnt,
               COALESCE(SUM(tokens_count), 0) as total_tokens,
               COALESCE(SUM(success_count), 0) as total_success,
               COALESCE(SUM(failure_count), 0) as total_failures
        FROM push_notifications_log
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY target_type ORDER BY cnt DESC
      `),
      pool.query(`
        SELECT DATE_TRUNC('day', created_at)::date as day, COUNT(*) as cnt,
               COALESCE(SUM(success_count), 0) as successes,
               COALESCE(SUM(failure_count), 0) as failures
        FROM push_notifications_log
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1 ORDER BY 1
      `),
    ]);

    const totalSuccess = notifsByType.rows.reduce((s, r) => s + parseInt(r.total_success), 0);
    const totalFailures = notifsByType.rows.reduce((s, r) => s + parseInt(r.total_failures), 0);

    res.render("admin/push-notifications", {
      stats: {
        totalTokens: parseInt(totalTokens.rows[0]?.cnt || 0),
        activeTokens: parseInt(activeTokens.rows[0]?.cnt || 0),
        staleTokens: parseInt(staleTokens.rows[0]?.cnt || 0),
        totalNotifs: parseInt(totalNotifs.rows[0]?.cnt || 0),
        recentNotifs: parseInt(recentNotifs.rows[0]?.cnt || 0),
        totalSuccess,
        totalFailures,
        deliveryRate: (totalSuccess + totalFailures) > 0
          ? ((totalSuccess / (totalSuccess + totalFailures)) * 100).toFixed(1) : '100.0'
      },
      platformBreakdown: platformBreakdown.rows,
      notifsByType: notifsByType.rows,
      dailyNotifs: dailyNotifs.rows,
      pageTitle: "Push Notifications",
      activePage: "push-notifications",
      loadChartJs: true
    });
  } catch (err) {
    console.error("[Admin] Push notifications error:", err.message);
    res.status(500).send("Eroare server");
  }
});

// POST: Send push notification from admin
router.post("/push-notifications/send", async (req, res) => {
  try {
    const { targetType, targetId, title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "Title și body sunt obligatorii" });
    }
    if (!["all", "user", "city"].includes(targetType)) {
      return res.status(400).json({ error: "targetType invalid" });
    }
    if (targetType !== "all" && !targetId) {
      return res.status(400).json({ error: "targetId e obligatoriu pentru acest tip" });
    }

    const notification = { title, body, data: { type: "admin_test" } };
    let result;
    let tokensCount = 0;

    switch (targetType) {
      case "all": {
        const { rows } = await pool.query("SELECT COUNT(*) FROM push_tokens WHERE is_active = TRUE");
        tokensCount = parseInt(rows[0].count);
        result = await pushService.sendToAll(pool, notification);
        break;
      }
      case "user": {
        const { rows } = await pool.query("SELECT COUNT(*) FROM push_tokens WHERE user_id = $1 AND is_active = TRUE", [targetId]);
        tokensCount = parseInt(rows[0].count);
        result = await pushService.sendToUser(pool, targetId, notification);
        break;
      }
      case "city": {
        const { rows } = await pool.query(`
          SELECT COUNT(DISTINCT pt.token) FROM push_tokens pt
          JOIN users u ON u.id = pt.user_id
          WHERE u.city_id = $1 AND pt.is_active = TRUE
        `, [targetId]);
        tokensCount = parseInt(rows[0].count);
        result = await pushService.sendToCity(pool, targetId, notification);
        break;
      }
    }

    await pushService.logNotification(pool, {
      title, body,
      data: { type: "admin_test" },
      sentBy: req.adminUser?.id || "admin",
      targetType, targetId,
      tokensCount,
      successCount: result.sent,
      failureCount: result.failed || 0,
    });

    res.json({ success: true, sent: result.sent, failed: result.failed, tokensCount });
  } catch (err) {
    console.error("[Admin] Send push error:", err.message);
    res.status(500).json({ error: "Eroare la trimitere: " + err.message });
  }
});

// ═════════════════════════════════════════════
//   REFERRALS DASHBOARD
// ═════════════════════════════════════════════
router.get("/referrals", async (req, res) => {
  try {
    const [totalRes, recentRes, leaderboardRes, monthlyRes] = await Promise.all([
      // Total referrals + total points
      pool.query(`SELECT COUNT(*) as total_referrals, COALESCE(SUM(points_awarded), 0) as total_points FROM referral_rewards`),
      // Last 30 days
      pool.query(`SELECT COUNT(*) as cnt FROM referral_rewards WHERE created_at >= NOW() - INTERVAL '30 days'`),
      // Top 15 referrers
      pool.query(`
        SELECT u.id, u.first_name, u.last_name, u.email, u.referral_code,
               COUNT(rr.id) as referral_count,
               COALESCE(SUM(rr.points_awarded), 0) as total_points
        FROM referral_rewards rr
        JOIN users u ON u.id = rr.referrer_id
        GROUP BY u.id, u.first_name, u.last_name, u.email, u.referral_code
        ORDER BY referral_count DESC
        LIMIT 15
      `),
      // Monthly trend (last 6 months)
      pool.query(`
        SELECT DATE_TRUNC('month', created_at)::date as month, COUNT(*) as cnt
        FROM referral_rewards
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY 1 ORDER BY 1
      `)
    ]);

    res.render("admin/referrals", {
      stats: {
        totalReferrals: parseInt(totalRes.rows[0]?.total_referrals || 0),
        totalPoints: parseInt(totalRes.rows[0]?.total_points || 0),
        last30d: parseInt(recentRes.rows[0]?.cnt || 0)
      },
      leaderboard: leaderboardRes.rows,
      monthly: monthlyRes.rows,
      pageTitle: "Referrals",
      activePage: "referrals"
    });
  } catch (err) {
    console.error("[Admin] Referrals error:", err.message);
    res.status(500).send("Eroare server");
  }
});

// ═════════════════════════════════════════════
//   CRON JOBS MONITOR
// ═════════════════════════════════════════════
router.get("/cron-jobs", async (req, res) => {
  // Static list of all cron jobs (from cronJobs.js)
  const jobs = [
    { name: 'Token cleanup', schedule: '0 3 * * *', description: 'Refresh tokens > 60 zile' },
    { name: 'Push log cleanup', schedule: '15 3 * * *', description: 'Push logs > 90 zile' },
    { name: 'Password reset cleanup', schedule: '30 3 * * *', description: 'Tokens reset > 7 zile' },
    { name: 'Audit log cleanup', schedule: '0 4 * * 0', description: 'Audit logs > 365 zile (duminica)' },
    { name: 'Business clicks cleanup', schedule: '30 4 1 * *', description: 'Clicks > 180 zile (1 luna)' },
    { name: 'Expire offers', schedule: '45 3 * * *', description: 'Dezactiveaza oferte expirate' },
    { name: 'Subscription expiry', schedule: '0 4 * * *', description: 'Check subscriptii expirate → downgrade free' },
    { name: 'Category rankings', schedule: '0 5 1 * *', description: 'Recalculeaza ranking categorii (1 luna)' },
    { name: 'Trial warning emails', schedule: '5 0 * * *', description: 'Email avertizare trial 3 zile' },
    { name: 'Re-engagement emails', schedule: '15 0 * * *', description: 'Email re-engagement useri inactivi 14-90 zile' },
    { name: 'Flash deal check', schedule: '*/5 * * * *', description: 'Verifica flash deals expirate (la 5 min)' },
    { name: 'Review prompt push', schedule: '0 10 * * *', description: 'Push notificare review dupa redemption' },
    { name: 'Weekly digest push', schedule: '0 17 * * 0', description: 'Digest saptamanal push + email (duminica 19:00 RO)' },
    { name: 'Saved search alerts', schedule: '0 11 * * *', description: 'Alerte saved searches cu oferte noi' },
    { name: 'Auto-redemption cleanup', schedule: '0 2 */2 * *', description: 'Cleanup auto-redemption (la 2 zile)' },
    { name: 'Orphan images cleanup', schedule: '0 9 * * *', description: 'Cleanup imagini orfane Cloudinary' },
    { name: 'Category rankings v2', schedule: '0 10 * * 2', description: 'Rebuild ranking categorii (marti)' },
    { name: 'Review summary batch', schedule: '0 5 * * 0', description: 'Batch generare review summaries AI (duminica)' },
  ];

  // Get some runtime stats
  try {
    const [tokenCount, pushLogCount, emailCount] = await Promise.all([
      pool.query("SELECT COUNT(*) as cnt FROM refresh_tokens WHERE expires_at < NOW()").catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query("SELECT COUNT(*) as cnt FROM push_notifications_log WHERE created_at < NOW() - INTERVAL '90 days'").catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query("SELECT COUNT(*) as cnt FROM email_logs WHERE created_at >= NOW() - INTERVAL '24 hours'").catch(() => ({ rows: [{ cnt: 0 }] })),
    ]);

    res.render("admin/cron-jobs", {
      jobs,
      runtimeStats: {
        expiredTokens: parseInt(tokenCount.rows[0]?.cnt || 0),
        oldPushLogs: parseInt(pushLogCount.rows[0]?.cnt || 0),
        emailsLast24h: parseInt(emailCount.rows[0]?.cnt || 0),
      },
      pageTitle: "Cron Jobs",
      activePage: "cron-jobs"
    });
  } catch (err) {
    console.error("[Admin] Cron jobs error:", err.message);
    res.status(500).send("Eroare server");
  }
});

// ═════════════════════════════════════════════
//   CONCIERGE ONBOARDING REQUESTS
// ═════════════════════════════════════════════

// GET /admin/onboarding — list pending + in_progress requests
router.get("/onboarding", async (req, res) => {
  try {
    const statusFilter = req.query.status || 'active'; // 'active' | 'all' | specific status
    let whereClause = '';
    const queryParams = [];
    if (statusFilter === 'active') {
      whereClause = `WHERE orq.status IN ('pending', 'in_progress')`;
    } else if (['pending', 'in_progress', 'completed', 'cancelled'].includes(statusFilter)) {
      whereClause = `WHERE orq.status = $1`;
      queryParams.push(statusFilter);
    }
    // 'all' → no WHERE clause

    const result = await pool.query(`
      SELECT orq.id, orq.business_id, orq.requested_by, orq.status, orq.request_type,
             orq.message, orq.attachments, orq.admin_notes, orq.created_at, orq.updated_at,
             b.name AS business_name, b.logo_url AS business_logo,
             u.first_name, u.last_name, u.email AS requester_email
      FROM onboarding_requests orq
      JOIN businesses b ON b.id = orq.business_id
      JOIN users u ON u.id = orq.requested_by
      ${whereClause}
      ORDER BY CASE orq.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, orq.created_at DESC
      LIMIT 100
    `, queryParams);

    // Render as JSON for simplicity (Tiberiu manages via direct DB or simple admin UI)
    if (req.query.format === 'json') {
      return res.json({ requests: result.rows });
    }

    // Simple HTML list for admin
    const requests = result.rows;
    const csrfToken = res.locals.csrfToken || '';
    const statusColors = { pending: '#f59e0b', in_progress: '#3b82f6', completed: '#22c55e', cancelled: '#71717a' };
    const typeLabels = { catalog: 'Catalog', hours: 'Program', full_setup: 'Setup complet' };

    let html = `<!DOCTYPE html><html><head><title>Cereri configurare asistată — Admin</title>
      <style>body{font-family:Inter,sans-serif;background:#09090b;color:#fafafa;padding:20px;max-width:900px;margin:0 auto}
      h1{font-size:1.5rem;margin-bottom:20px}a{color:#fb923c}
      .card{background:#18181b;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;margin-bottom:12px}
      .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:12px;font-weight:600}
      .meta{font-size:13px;color:#a1a1aa;margin-top:4px}
      .msg{background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;margin-top:8px;font-size:14px;white-space:pre-wrap}
      .actions{margin-top:12px;display:flex;gap:8px}
      .btn{padding:6px 14px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:600}
      .btn-blue{background:#3b82f6;color:#fff}.btn-green{background:#22c55e;color:#fff}.btn-gray{background:#3f3f46;color:#a1a1aa}
      .att{display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.06);padding:4px 10px;border-radius:6px;font-size:12px;margin:4px 4px 0 0}
      </style></head><body>
      <h1>Cereri configurare asistată</h1>
      <p style="margin-bottom:16px"><a href="/admin/onboarding?status=active">Active</a> · <a href="/admin/onboarding?status=all">Toate</a> · <a href="/admin">← Admin</a></p>`;

    if (requests.length === 0) {
      html += `<p style="color:#71717a;text-align:center;padding:40px">Nicio cerere ${statusFilter === 'active' ? 'activă' : ''} găsită.</p>`;
    }

    for (const r of requests) {
      const color = statusColors[r.status] || '#71717a';
      const attachments = typeof r.attachments === 'string' ? JSON.parse(r.attachments) : (r.attachments || []);
      html += `<div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div><strong>${escHtml(r.business_name)}</strong> (#${r.business_id})</div>
          <span class="badge" style="background:${color}20;color:${color}">${escHtml(r.status)}</span>
        </div>
        <div class="meta">${typeLabels[r.request_type] || escHtml(r.request_type)} · ${escHtml(r.first_name)} ${escHtml(r.last_name)} (${escHtml(r.requester_email)}) · ${new Date(r.created_at).toLocaleString('ro-RO')}</div>
        ${r.message ? `<div class="msg">${escHtml(r.message)}</div>` : ''}
        ${attachments.length > 0 ? '<div style="margin-top:8px">' + attachments.map(a => `<a class="att" href="${escHtml(a.url)}" target="_blank">${escHtml(a.name || 'fișier')}</a>`).join('') + '</div>' : ''}
        ${r.admin_notes ? `<div class="meta" style="margin-top:8px"><strong>Note admin:</strong> ${escHtml(r.admin_notes)}</div>` : ''}
        <div class="actions">
          ${r.status === 'pending' ? `<form method="POST" action="/admin/onboarding/${r.id}" style="display:inline"><input type="hidden" name="_csrf" value="${csrfToken}"><input type="hidden" name="status" value="in_progress"><button class="btn btn-blue" type="submit">Marchează în lucru</button></form>` : ''}
          ${r.status === 'in_progress' ? `<form method="POST" action="/admin/onboarding/${r.id}" style="display:inline"><input type="hidden" name="_csrf" value="${csrfToken}"><input type="hidden" name="status" value="completed"><button class="btn btn-green" type="submit">Finalizează</button></form>` : ''}
          ${['pending','in_progress'].includes(r.status) ? `<form method="POST" action="/admin/onboarding/${r.id}" style="display:inline"><input type="hidden" name="_csrf" value="${csrfToken}"><input type="hidden" name="status" value="cancelled"><button class="btn btn-gray" type="submit">Anulează</button></form>` : ''}
        </div>
      </div>`;
    }

    html += `</body></html>`;
    res.send(html);
  } catch (err) {
    console.error("[Admin] Get onboarding requests error:", err);
    res.status(500).send("Eroare server");
  }
});

// POST /admin/onboarding/:requestId — update status + notes
router.post("/onboarding/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, admin_notes } = req.body;

    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).send("Status invalid");
    }

    const sets = ['status = $2', 'updated_at = NOW()'];
    const params = [requestId, status];
    if (admin_notes !== undefined) {
      sets.push(`admin_notes = $${params.length + 1}`);
      params.push(admin_notes);
    }

    await pool.query(`UPDATE onboarding_requests SET ${sets.join(', ')} WHERE id = $1`, params);

    res.redirect('/admin/onboarding?status=active');
  } catch (err) {
    console.error("[Admin] Update onboarding request error:", err);
    res.redirect('/admin/onboarding?err=Eroare+la+actualizare');
  }
});

// ============================================
// COLLECTIONS (Curated editorial lists)
// ============================================

// GET /admin/collections — list all collections
router.get("/collections", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, COUNT(co.offer_id) AS offer_count
      FROM collections c
      LEFT JOIN collection_offers co ON co.collection_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.created_at DESC
    `);
    res.json({ data: rows });
  } catch (err) {
    console.error("[Admin] Collections list error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// POST /admin/collections — create collection
router.post("/collections", async (req, res) => {
  try {
    const { title, description, image_url, sort_order } = req.body;
    if (!title) return res.status(400).json({ message: "Titlul este obligatoriu" });

    const { rows } = await pool.query(
      `INSERT INTO collections (title, description, image_url, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, description || null, image_url || null, sort_order || 0]
    );
    cache.invalidateGroup('collections');
    adminLog('create_collection', 'collection', rows[0].id, req, { title });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("[Admin] Create collection error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// PUT /admin/collections/:id — update collection
router.put("/collections/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, description, image_url, is_active, sort_order } = req.body;

    const { rows } = await pool.query(
      `UPDATE collections SET title = COALESCE($2, title), description = $3,
       image_url = $4, is_active = COALESCE($5, is_active), sort_order = COALESCE($6, sort_order)
       WHERE id = $1 RETURNING *`,
      [id, title, description ?? null, image_url ?? null, is_active, sort_order]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Colecție negăsită" });
    cache.invalidateGroup('collections');
    res.json(rows[0]);
  } catch (err) {
    console.error("[Admin] Update collection error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// DELETE /admin/collections/:id — delete collection
router.delete("/collections/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await pool.query("DELETE FROM collections WHERE id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: "Colecție negăsită" });
    cache.invalidateGroup('collections');
    res.json({ message: "Colecție ștearsă" });
  } catch (err) {
    console.error("[Admin] Delete collection error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// POST /admin/collections/:id/offers — add offer to collection
router.post("/collections/:id/offers", async (req, res) => {
  try {
    const collectionId = parseInt(req.params.id, 10);
    const { offer_id, sort_order } = req.body;
    if (!offer_id) return res.status(400).json({ message: "offer_id obligatoriu" });

    await pool.query(
      `INSERT INTO collection_offers (collection_id, offer_id, sort_order)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [collectionId, offer_id, sort_order || 0]
    );
    res.status(201).json({ message: "Ofertă adăugată" });
  } catch (err) {
    console.error("[Admin] Add offer to collection error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// DELETE /admin/collections/:id/offers/:offerId — remove offer from collection
router.delete("/collections/:id/offers/:offerId", async (req, res) => {
  try {
    const collectionId = parseInt(req.params.id, 10);
    const offerId = parseInt(req.params.offerId, 10);
    await pool.query(
      "DELETE FROM collection_offers WHERE collection_id = $1 AND offer_id = $2",
      [collectionId, offerId]
    );
    res.json({ message: "Ofertă eliminată din colecție" });
  } catch (err) {
    console.error("[Admin] Remove offer from collection error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// =====================================
//   EMAIL LOGS
// =====================================

// GET /admin/emails — list email logs with filters
router.get("/emails", async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 50 });
    const { type, status } = req.query;

    const filters = [];
    const values = [];
    let idx = 1;

    if (type && type.trim()) {
      filters.push(`el.email_type = $${idx++}`);
      values.push(type.trim());
    }
    if (status && status.trim()) {
      filters.push(`el.status = $${idx++}`);
      values.push(status.trim());
    }

    const whereClause = filters.length ? `AND ${filters.join(" AND ")}` : "";

    const statsRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS today_count,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS week_count,
        COUNT(*) FILTER (WHERE status = 'failed' AND created_at >= CURRENT_DATE - INTERVAL '7 days') AS failed_count
      FROM email_logs
    `);
    const emailStats = statsRes.rows[0];

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM email_logs el WHERE TRUE ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0].count);

    const result = await pool.query(`
      SELECT el.id, el.user_id, el.email_to, el.email_type, el.subject,
             el.status, el.resend_id, el.error_message, el.created_at,
             u.first_name, u.last_name, u.email AS user_email
      FROM email_logs el
      LEFT JOIN users u ON u.id = el.user_id
      WHERE TRUE ${whereClause}
      ORDER BY el.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...values, limit, offset]);

    res.render("admin/emails", {
      emails: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: { type: type || "", status: status || "" },
      emailStats,
      envFlags: {
        weeklyDigest: process.env.ENABLE_WEEKLY_DIGEST || "false",
        trialWarning: process.env.ENABLE_TRIAL_WARNING || "false",
        reengagement: process.env.ENABLE_REENGAGEMENT || "false",
      },
    });
  } catch (err) {
    console.error("[Admin] Email logs error:", err);
    res.status(500).send("Eroare la încărcarea email logs.");
  }
});

// ═══════════════════════════════════════════════════════
// BLOG
// ═══════════════════════════════════════════════════════

// Helper: generate slug from title
function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

// List all blog posts
router.get("/blog", async (req, res) => {
  try {
    const { rows: posts } = await pool.query(`
      SELECT bp.*, bc.name AS category_name
      FROM blog_posts bp
      LEFT JOIN blog_categories bc ON bc.id = bp.category_id
      ORDER BY bp.created_at DESC
    `);
    res.render("admin/blog", { posts });
  } catch (err) {
    console.error("[Admin] Blog list error:", err);
    res.status(500).send("Eroare la încărcarea articolelor.");
  }
});

// New blog post form
router.get("/blog/new", async (req, res) => {
  try {
    const { rows: categories } = await pool.query('SELECT id, name FROM blog_categories ORDER BY sort_order');
    res.render("admin/blog-edit", { post: null, categories, error: null });
  } catch (err) {
    console.error("[Admin] Blog new form error:", err);
    res.status(500).send("Eroare la încărcarea formularului.");
  }
});

// Create blog post
router.post("/blog/new", upload.single("image"), async (req, res) => {
  try {
    const { title, slug: customSlug, excerpt, content, category_id, author_name, meta_title, meta_description, is_published } = req.body;
    if (!title || !content) {
      const { rows: categories } = await pool.query('SELECT id, name FROM blog_categories ORDER BY sort_order');
      return res.render("admin/blog-edit", { post: req.body, categories, error: 'Titlul și conținutul sunt obligatorii.' });
    }

    let slug = customSlug ? slugify(customSlug) : slugify(title);
    // Dedup slug
    const { rows: existing } = await pool.query('SELECT id FROM blog_posts WHERE slug = $1', [slug]);
    if (existing.length > 0) slug = `${slug}-${Date.now()}`;

    let image_url = null;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, "blog");
      image_url = result.secure_url;
    }

    const published = is_published === 'on' || is_published === 'true';
    const safeContent = sanitizeHtml(content || '', BLOG_SANITIZE_OPTS);

    const { rows: newPost } = await pool.query(`
      INSERT INTO blog_posts (slug, title, excerpt, content, image_url, category_id, author_name, meta_title, meta_description, is_published, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [slug, title, excerpt || null, safeContent, image_url, category_id || null, author_name || 'Echipa OFAI',
        meta_title || null, meta_description || null, published, published ? new Date() : null]);

    cache.invalidateGroup('blog');
    cache.invalidateGroup('admin');
    adminLog('create_blog_post', 'blog_post', newPost[0].id, req, { title });
    res.redirect("/admin/blog");
  } catch (err) {
    console.error("[Admin] Blog create error:", err);
    res.status(500).send("Eroare la crearea articolului.");
  }
});

// Edit blog post form
router.get("/blog/:id/edit", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).send("Articol negăsit.");
    const { rows: categories } = await pool.query('SELECT id, name FROM blog_categories ORDER BY sort_order');
    res.render("admin/blog-edit", { post: rows[0], categories, error: null });
  } catch (err) {
    console.error("[Admin] Blog edit form error:", err);
    res.status(500).send("Eroare la încărcarea articolului.");
  }
});

// Update blog post
router.post("/blog/:id/edit", upload.single("image"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, slug: customSlug, excerpt, content, category_id, author_name, meta_title, meta_description, is_published } = req.body;
    if (!title || !content) {
      const { rows: categories } = await pool.query('SELECT id, name FROM blog_categories ORDER BY sort_order');
      return res.render("admin/blog-edit", { post: { ...req.body, id }, categories, error: 'Titlul și conținutul sunt obligatorii.' });
    }

    const { rows: currentRows } = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [id]);
    if (!currentRows[0]) return res.status(404).send("Articol negăsit.");
    const current = currentRows[0];

    let slug = customSlug ? slugify(customSlug) : current.slug;
    // Dedup slug (exclude current post)
    const { rows: existing } = await pool.query('SELECT id FROM blog_posts WHERE slug = $1 AND id != $2', [slug, id]);
    if (existing.length > 0) slug = `${slug}-${Date.now()}`;

    let image_url = current.image_url;
    if (req.file) {
      // Delete old image if exists
      if (current.image_url) {
        const publicId = getPublicIdFromUrl(current.image_url);
        if (publicId) await deleteFromCloudinary(publicId).catch(() => {});
      }
      const result = await uploadToCloudinary(req.file.buffer, "blog");
      image_url = result.secure_url;
    }

    const published = is_published === 'on' || is_published === 'true';
    const publishedAt = published && !current.published_at ? new Date() : current.published_at;
    const safeContent = sanitizeHtml(content || '', BLOG_SANITIZE_OPTS);

    await pool.query(`
      UPDATE blog_posts SET slug=$1, title=$2, excerpt=$3, content=$4, image_url=$5, category_id=$6,
        author_name=$7, meta_title=$8, meta_description=$9, is_published=$10, published_at=$11, updated_at=NOW()
      WHERE id=$12
    `, [slug, title, excerpt || null, safeContent, image_url, category_id || null, author_name || 'Echipa OFAI',
        meta_title || null, meta_description || null, published, publishedAt, id]);

    cache.invalidateGroup('blog');
    cache.invalidateGroup('admin');
    res.redirect("/admin/blog");
  } catch (err) {
    console.error("[Admin] Blog update error:", err);
    res.status(500).send("Eroare la actualizarea articolului.");
  }
});

// Toggle publish/draft
router.post("/blog/:id/toggle-publish", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query('SELECT is_published, published_at FROM blog_posts WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).send("Articol negăsit.");

    const newPublished = !rows[0].is_published;
    const publishedAt = newPublished && !rows[0].published_at ? new Date() : rows[0].published_at;

    await pool.query('UPDATE blog_posts SET is_published = $1, published_at = $2, updated_at = NOW() WHERE id = $3',
      [newPublished, publishedAt, id]);

    cache.invalidateGroup('blog');
    adminLog('toggle_blog_publish', 'blog_post', id, req);
    res.redirect("/admin/blog");
  } catch (err) {
    console.error("[Admin] Blog toggle error:", err);
    res.status(500).send("Eroare la schimbarea statusului.");
  }
});

// Delete blog post
router.post("/blog/:id/delete", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query('SELECT image_url FROM blog_posts WHERE id = $1', [id]);
    if (rows[0]?.image_url) {
      const publicId = getPublicIdFromUrl(rows[0].image_url);
      if (publicId) await deleteFromCloudinary(publicId).catch(() => {});
    }
    await pool.query('DELETE FROM blog_posts WHERE id = $1', [id]);
    cache.invalidateGroup('blog');
    cache.invalidateGroup('admin');
    adminLog('delete_blog_post', 'blog_post', id, req);
    res.redirect("/admin/blog");
  } catch (err) {
    console.error("[Admin] Blog delete error:", err);
    res.status(500).send("Eroare la ștergerea articolului.");
  }
});

// ============================================
// Cron Test Endpoints (admin-only)
// ============================================
const { runReviewPromptCron, computePerformanceScores } = require("../services/cronJobs");

router.post("/test-cron/review-prompt", async (req, res) => {
  try {
    const result = await runReviewPromptCron();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[Admin] Test cron review-prompt error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Manual recompute performance scores (for debugging/after data changes)
router.post("/performance-scores/recompute", async (req, res) => {
  try {
    const result = await computePerformanceScores();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[Admin] Performance score recompute error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
