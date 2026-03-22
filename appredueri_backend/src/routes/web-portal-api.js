// web-portal-api.js
// Extracted from web.js — contains all Business Portal AJAX API routes and the
// search autosuggest endpoint. Mounted by index.js (or web.js) alongside web.js.

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireWebAuth } = require("../middleware/webAuth");
const { requireBusinessOwner } = require("../middleware/businessWebAuth");
const { attachTier, requireFeature, requireLimit } = require('../middleware/tierAuth');
const { countActiveOffers, countGalleryImages, countLocations, getBusinessTier, getPlans } = require('../helpers/tiers');
const { searchLimiter, mapsParseLimiter } = require("../middleware/rateLimiter");
const { parseMapsLink } = require("../helpers/mapsParser");
const { sanitizeString } = require("../helpers/validate");
const offerService = require("../services/offerService");
const { validateOfferData } = require("../services/llm/offerValidation");
const pushService = require("../services/pushNotifications");
const { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } = require("../services/cloudinary");
const { portalUpload } = require("./web-shared");
const { cancelSubscription } = require("../services/subscriptionService");
const { generateReviewSuggestions } = require("../services/llm/reviewSuggestions");
const { formatError } = require("../services/llm/anthropicClient");

// Attach tier info to all portal routes (required by requireFeature/requireLimit)
router.use("/api/web/portal/:businessId", attachTier());

// Upload logo
router.post("/api/web/portal/:businessId/logo", requireBusinessOwner, requireFeature('can_upload_logo'), portalUpload.single("logo"), async (req, res) => {
  try {
    const businessId = req.businessId;
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
    const businessId = req.businessId;
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
    const businessId = req.businessId;
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
    const businessId = req.businessId;
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
  let client;
  let step = 'pool.connect';
  try {
    client = await pool.connect();
    const businessId = req.businessId;
    if (!req.file) return res.status(400).json({ message: "Niciun fișier" });

    step = 'BEGIN';
    await client.query("BEGIN");

    // Atomic count check with row lock to prevent race condition
    step = 'count_check';
    const countRes = await client.query(
      "SELECT COUNT(*) as cnt FROM business_images WHERE business_id = $1 FOR UPDATE",
      [businessId]
    );
    // Use tier limit (requireLimit middleware already checks, this is a race-condition backup)
    const galleryLimit = (req.tier && req.tier.plan && req.tier.plan.max_gallery_images !== null)
      ? req.tier.plan.max_gallery_images
      : 64; // Sane fallback matching premium tier
    if (parseInt(countRes.rows[0].cnt) >= galleryLimit) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `Maximum ${galleryLimit} imagini permise` });
    }

    step = 'cloudinary_upload';
    console.log(`[Gallery] Uploading for business ${businessId}, file size: ${req.file.size}, mime: ${req.file.mimetype}`);
    const result = await uploadToCloudinary(req.file.buffer, "gallery");
    const sortOrder = parseInt(countRes.rows[0].cnt) + 1;

    step = 'db_insert';
    const insertRes = await client.query(
      "INSERT INTO business_images (business_id, image_url, sort_order) VALUES ($1, $2, $3) RETURNING id",
      [businessId, result.url, sortOrder]
    );

    step = 'COMMIT';
    await client.query("COMMIT");
    res.json({ success: true, image: { id: insertRes.rows[0].id, url: result.url, sort_order: sortOrder } });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error(`[Web API] Portal gallery error at step="${step}":`, err.message || err);
    res.status(500).json({ message: "Eroare la upload" });
  } finally {
    if (client) client.release();
  }
});

// Delete gallery image
router.delete("/api/web/portal/:businessId/gallery/:imageId", requireBusinessOwner, async (req, res) => {
  try {
    const businessId = req.businessId;
    const imageId = parseInt(req.params.imageId, 10);
    if (isNaN(imageId)) return res.status(400).json({ message: "ID invalid" });
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
    const businessId = req.businessId;
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
    const businessId = req.businessId;
    const locId = parseInt(req.params.locId, 10);
    if (isNaN(locId)) return res.status(400).json({ message: "ID invalid" });
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
    const businessId = req.businessId;
    const locId = parseInt(req.params.locId, 10);
    if (isNaN(locId)) return res.status(400).json({ message: "ID invalid" });

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

// ═══════════════════════════════════════
// OPENING HOURS — per-location schedule
// ═══════════════════════════════════════

// GET hours for a location (returns defaults if none exist)
router.get("/api/web/portal/:businessId/locations/:locId/hours", requireBusinessOwner, async (req, res) => {
  try {
    const businessId = req.businessId;
    const locId = parseInt(req.params.locId, 10);
    if (isNaN(locId)) return res.status(400).json({ message: "ID locație invalid" });

    // Verify the location belongs to this business
    const locCheck = await pool.query(
      "SELECT id FROM business_locations WHERE id = $1 AND business_id = $2",
      [locId, businessId]
    );
    if (locCheck.rows.length === 0) return res.status(404).json({ message: "Locație negăsită" });

    const { rows } = await pool.query(
      `SELECT id, day_of_week,
              to_char(open_time, 'HH24:MI') AS open_time,
              to_char(close_time, 'HH24:MI') AS close_time,
              is_closed
       FROM business_hours WHERE location_id = $1 ORDER BY day_of_week`,
      [locId]
    );

    // If no hours exist yet, return defaults: Mon-Fri 09:00-18:00, Sat/Sun closed
    if (rows.length === 0) {
      const defaults = [];
      for (let d = 0; d < 7; d++) {
        defaults.push({
          day_of_week: d,
          open_time: d < 5 ? '09:00' : null,
          close_time: d < 5 ? '18:00' : null,
          is_closed: d >= 5,
        });
      }
      return res.json({ hours: defaults, isDefault: true });
    }
    res.json({ hours: rows, isDefault: false });
  } catch (err) {
    console.error("[Web API] Get hours error:", err);
    res.status(500).json({ message: "Eroare la încărcarea programului" });
  }
});

// PUT (upsert) hours for a location — expects exactly 7 days
router.put("/api/web/portal/:businessId/locations/:locId/hours", requireBusinessOwner, async (req, res) => {
  try {
    const businessId = req.businessId;
    const locId = parseInt(req.params.locId, 10);
    if (isNaN(locId)) return res.status(400).json({ message: "ID locație invalid" });
    const { hours } = req.body || {};

    // Verify ownership
    const locCheck = await pool.query(
      "SELECT id FROM business_locations WHERE id = $1 AND business_id = $2",
      [locId, businessId]
    );
    if (locCheck.rows.length === 0) return res.status(404).json({ message: "Locație negăsită" });

    if (!Array.isArray(hours) || hours.length !== 7) {
      return res.status(400).json({ message: "Trebuie să trimiți exact 7 zile" });
    }

    // Validate all 7 days (0-6) present
    const days = hours.map(h => h.day_of_week).sort((a, b) => a - b);
    if (JSON.stringify(days) !== JSON.stringify([0, 1, 2, 3, 4, 5, 6])) {
      return res.status(400).json({ message: "Zilele trebuie să fie 0-6 (Luni-Duminică)" });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const h of hours) {
        const openTime = h.is_closed ? null : (h.open_time || null);
        const closeTime = h.is_closed ? null : (h.close_time || null);
        await client.query(
          `INSERT INTO business_hours (location_id, day_of_week, open_time, close_time, is_closed, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (location_id, day_of_week)
           DO UPDATE SET open_time = $3, close_time = $4, is_closed = $5, updated_at = NOW()`,
          [locId, h.day_of_week, openTime, closeTime, !!h.is_closed]
        );
      }
      await client.query('COMMIT');
      res.json({ success: true, message: "Program salvat!" });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Web API] Save hours error:", err);
    res.status(500).json({ message: "Eroare la salvarea programului" });
  }
});

// POST copy hours from one location to all others
router.post("/api/web/portal/:businessId/locations/:locId/hours/copy-all", requireBusinessOwner, async (req, res) => {
  try {
    const businessId = req.businessId;
    const locId = parseInt(req.params.locId, 10);
    if (isNaN(locId)) return res.status(400).json({ message: "ID locație invalid" });

    // Verify source location
    const srcCheck = await pool.query(
      "SELECT id FROM business_locations WHERE id = $1 AND business_id = $2",
      [locId, businessId]
    );
    if (srcCheck.rows.length === 0) return res.status(404).json({ message: "Locație sursă negăsită" });

    // Get source hours
    const { rows: srcHours } = await pool.query(
      "SELECT day_of_week, open_time, close_time, is_closed FROM business_hours WHERE location_id = $1",
      [locId]
    );
    if (srcHours.length === 0) return res.status(400).json({ message: "Locația sursă nu are program configurat" });

    // Get all other locations of this business
    const { rows: otherLocs } = await pool.query(
      "SELECT id FROM business_locations WHERE business_id = $1 AND id != $2",
      [businessId, locId]
    );

    if (otherLocs.length === 0) return res.json({ success: true, message: "Nicio altă locație de actualizat" });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const loc of otherLocs) {
        for (const h of srcHours) {
          await client.query(
            `INSERT INTO business_hours (location_id, day_of_week, open_time, close_time, is_closed, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (location_id, day_of_week)
             DO UPDATE SET open_time = $3, close_time = $4, is_closed = $5, updated_at = NOW()`,
            [loc.id, h.day_of_week, h.open_time, h.close_time, h.is_closed]
          );
        }
      }
      await client.query('COMMIT');
      res.json({ success: true, message: `Program copiat la ${otherLocs.length} ${otherLocs.length === 1 ? 'locație' : 'locații'}!` });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Web API] Copy hours error:", err);
    res.status(500).json({ message: "Eroare la copierea programului" });
  }
});

// ═══════════════════════════════════════════════════════
//  CATALOG — Categories + Items CRUD + CSV Import
// ═══════════════════════════════════════════════════════

// CSV upload multer instance (text/csv, max 1MB)
const csvUpload = require("multer")({
  storage: require("multer").memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.csv')) cb(null, true);
    else cb(new Error('Doar fișiere CSV sunt acceptate'));
  },
});

const VALID_CATALOG_TYPES = ['service', 'product', 'menu_item'];

// GET catalog categories
router.get("/api/web/portal/:businessId/catalog/categories", requireBusinessOwner, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, sort_order FROM business_catalog_categories WHERE business_id = $1 ORDER BY sort_order, id",
      [req.businessId]
    );
    res.json({ success: true, categories: rows });
  } catch (err) {
    console.error("[Web API] List catalog categories error:", err);
    res.status(500).json({ message: "Eroare la încărcarea categoriilor" });
  }
});

// POST create catalog category
router.post("/api/web/portal/:businessId/catalog/categories", requireBusinessOwner, async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name || name.length > 200) return res.status(400).json({ message: "Numele categoriei este obligatoriu (max 200 caractere)" });

    // Get next sort order
    const { rows: maxRows } = await pool.query(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM business_catalog_categories WHERE business_id = $1",
      [req.businessId]
    );
    const sortOrder = maxRows[0].next_order;

    const { rows } = await pool.query(
      "INSERT INTO business_catalog_categories (business_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id, name, sort_order",
      [req.businessId, name, sortOrder]
    );
    res.json({ success: true, category: rows[0] });
  } catch (err) {
    console.error("[Web API] Create catalog category error:", err);
    res.status(500).json({ message: "Eroare la crearea categoriei" });
  }
});

// PUT update catalog category (rename / reorder)
router.put("/api/web/portal/:businessId/catalog/categories/:catId", requireBusinessOwner, async (req, res) => {
  try {
    const catId = parseInt(req.params.catId, 10);
    if (isNaN(catId)) return res.status(400).json({ message: "ID categorie invalid" });

    const name = req.body.name !== undefined ? (req.body.name || '').trim() : undefined;
    const sortOrder = req.body.sort_order !== undefined ? parseInt(req.body.sort_order, 10) : undefined;

    if (name !== undefined && (!name || name.length > 200)) {
      return res.status(400).json({ message: "Numele categoriei este obligatoriu (max 200 caractere)" });
    }

    // Verify ownership
    const check = await pool.query(
      "SELECT id FROM business_catalog_categories WHERE id = $1 AND business_id = $2",
      [catId, req.businessId]
    );
    if (check.rows.length === 0) return res.status(404).json({ message: "Categorie negăsită" });

    const updates = [];
    const params = [];
    let idx = 1;
    if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name); }
    if (sortOrder !== undefined && !isNaN(sortOrder)) { updates.push(`sort_order = $${idx++}`); params.push(sortOrder); }

    if (updates.length === 0) return res.status(400).json({ message: "Nicio modificare" });

    params.push(catId);
    await pool.query(`UPDATE business_catalog_categories SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    res.json({ success: true, message: "Categorie actualizată" });
  } catch (err) {
    console.error("[Web API] Update catalog category error:", err);
    res.status(500).json({ message: "Eroare la actualizarea categoriei" });
  }
});

// DELETE catalog category (items → uncategorized via ON DELETE SET NULL)
router.delete("/api/web/portal/:businessId/catalog/categories/:catId", requireBusinessOwner, async (req, res) => {
  try {
    const catId = parseInt(req.params.catId, 10);
    if (isNaN(catId)) return res.status(400).json({ message: "ID categorie invalid" });

    const result = await pool.query(
      "DELETE FROM business_catalog_categories WHERE id = $1 AND business_id = $2",
      [catId, req.businessId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "Categorie negăsită" });
    res.json({ success: true, message: "Categorie ștearsă. Articolele rămân fără categorie." });
  } catch (err) {
    console.error("[Web API] Delete catalog category error:", err);
    res.status(500).json({ message: "Eroare la ștergerea categoriei" });
  }
});

// GET catalog items (all, optionally filtered by category)
router.get("/api/web/portal/:businessId/catalog/items", requireBusinessOwner, async (req, res) => {
  try {
    const catFilter = req.query.category_id ? parseInt(req.query.category_id, 10) : null;
    let query = `SELECT ci.*, cc.name AS category_name
      FROM business_catalog_items ci
      LEFT JOIN business_catalog_categories cc ON cc.id = ci.category_id
      WHERE ci.business_id = $1`;
    const params = [req.businessId];

    if (catFilter && !isNaN(catFilter)) {
      query += ` AND ci.category_id = $2`;
      params.push(catFilter);
    }
    query += ` ORDER BY ci.sort_order, ci.id`;

    const { rows } = await pool.query(query, params);
    // Convert price from bani to RON for display
    const items = rows.map(r => ({
      ...r,
      price_display: r.price != null ? (r.price / 100).toFixed(2) + ' RON' : (r.price_label || 'La cerere'),
    }));
    res.json({ success: true, items });
  } catch (err) {
    console.error("[Web API] List catalog items error:", err);
    res.status(500).json({ message: "Eroare la încărcarea articolelor" });
  }
});

// POST create catalog item
router.post("/api/web/portal/:businessId/catalog/items", requireBusinessOwner, async (req, res) => {
  try {
    const { name, type, category_id, description, price, price_label, duration_minutes } = req.body || {};

    const itemName = (name || '').trim();
    if (!itemName || itemName.length > 300) return res.status(400).json({ message: "Numele articolului este obligatoriu (max 300 caractere)" });

    const itemType = VALID_CATALOG_TYPES.includes(type) ? type : 'service';

    // Verify category ownership if provided
    let catId = category_id ? parseInt(category_id, 10) : null;
    if (catId) {
      const catCheck = await pool.query(
        "SELECT id FROM business_catalog_categories WHERE id = $1 AND business_id = $2",
        [catId, req.businessId]
      );
      if (catCheck.rows.length === 0) catId = null; // silently ignore invalid category
    }

    // Price: portal sends RON string → convert to bani (integer cents)
    let priceBani = null;
    if (price !== undefined && price !== null && price !== '') {
      const parsed = parseFloat(price);
      if (!isNaN(parsed)) priceBani = Math.round(parsed * 100);
    }

    const dur = duration_minutes ? parseInt(duration_minutes, 10) : null;

    // Get next sort order
    const { rows: maxRows } = await pool.query(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM business_catalog_items WHERE business_id = $1",
      [req.businessId]
    );

    const { rows } = await pool.query(
      `INSERT INTO business_catalog_items (business_id, category_id, type, name, description, price, price_label, duration_minutes, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.businessId, catId, itemType, itemName, (description || '').trim() || null, priceBani,
       (price_label || '').trim() || null, dur && !isNaN(dur) ? dur : null, maxRows[0].next_order]
    );
    const item = rows[0];
    item.price_display = item.price != null ? (item.price / 100).toFixed(2) + ' RON' : (item.price_label || 'La cerere');
    res.json({ success: true, item });
  } catch (err) {
    console.error("[Web API] Create catalog item error:", err);
    res.status(500).json({ message: "Eroare la crearea articolului" });
  }
});

// PUT update catalog item
router.put("/api/web/portal/:businessId/catalog/items/:itemId", requireBusinessOwner, async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(itemId)) return res.status(400).json({ message: "ID articol invalid" });

    // Verify ownership
    const check = await pool.query(
      "SELECT id FROM business_catalog_items WHERE id = $1 AND business_id = $2",
      [itemId, req.businessId]
    );
    if (check.rows.length === 0) return res.status(404).json({ message: "Articol negăsit" });

    const { name, type, category_id, description, price, price_label, duration_minutes, is_active, sort_order } = req.body || {};

    const updates = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) {
      const n = (name || '').trim();
      if (!n || n.length > 300) return res.status(400).json({ message: "Numele este obligatoriu (max 300)" });
      updates.push(`name = $${idx++}`); params.push(n);
    }
    if (type !== undefined && VALID_CATALOG_TYPES.includes(type)) {
      updates.push(`type = $${idx++}`); params.push(type);
    }
    if (category_id !== undefined) {
      const cid = category_id ? parseInt(category_id, 10) : null;
      if (cid) {
        const catCheck = await pool.query("SELECT id FROM business_catalog_categories WHERE id = $1 AND business_id = $2", [cid, req.businessId]);
        if (catCheck.rows.length === 0) return res.status(400).json({ message: "Categorie invalidă" });
      }
      updates.push(`category_id = $${idx++}`); params.push(cid);
    }
    if (description !== undefined) { updates.push(`description = $${idx++}`); params.push((description || '').trim() || null); }
    if (price !== undefined) {
      let pb = null;
      if (price !== null && price !== '') { const p = parseFloat(price); if (!isNaN(p)) pb = Math.round(p * 100); }
      updates.push(`price = $${idx++}`); params.push(pb);
    }
    if (price_label !== undefined) { updates.push(`price_label = $${idx++}`); params.push((price_label || '').trim() || null); }
    if (duration_minutes !== undefined) {
      const d = duration_minutes ? parseInt(duration_minutes, 10) : null;
      updates.push(`duration_minutes = $${idx++}`); params.push(d && !isNaN(d) ? d : null);
    }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); params.push(!!is_active); }
    if (sort_order !== undefined) { const so = parseInt(sort_order, 10); if (!isNaN(so)) { updates.push(`sort_order = $${idx++}`); params.push(so); } }

    if (updates.length === 0) return res.status(400).json({ message: "Nicio modificare" });

    updates.push(`updated_at = NOW()`);
    params.push(itemId);
    await pool.query(`UPDATE business_catalog_items SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    res.json({ success: true, message: "Articol actualizat" });
  } catch (err) {
    console.error("[Web API] Update catalog item error:", err);
    res.status(500).json({ message: "Eroare la actualizarea articolului" });
  }
});

// DELETE catalog item
router.delete("/api/web/portal/:businessId/catalog/items/:itemId", requireBusinessOwner, async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(itemId)) return res.status(400).json({ message: "ID articol invalid" });

    const result = await pool.query(
      "DELETE FROM business_catalog_items WHERE id = $1 AND business_id = $2",
      [itemId, req.businessId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: "Articol negăsit" });
    res.json({ success: true, message: "Articol șters" });
  } catch (err) {
    console.error("[Web API] Delete catalog item error:", err);
    res.status(500).json({ message: "Eroare la ștergerea articolului" });
  }
});

// GET CSV template download
router.get("/api/web/portal/:businessId/catalog/template", requireBusinessOwner, (req, res) => {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel
  const header = 'nume,tip,categorie,pret_ron,eticheta_pret,descriere,durata_minute';
  const example = 'Tuns barbati,service,Tuns & Barbierit,35.00,,Tuns clasic cu masina si foarfeca,30';
  const csv = BOM + header + '\n' + example + '\n';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="catalog-template.csv"');
  res.send(csv);
});

// POST CSV upload → parse + preview (no insert yet)
router.post("/api/web/portal/:businessId/catalog/import-csv", requireBusinessOwner, csvUpload.single('csv'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Niciun fișier CSV" });

    let content = req.file.buffer.toString('utf-8');
    // Strip BOM
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return res.status(400).json({ message: "Fișierul CSV trebuie să aibă cel puțin un rând de date (linia 1 = header)" });

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIdx = header.indexOf('nume');
    if (nameIdx === -1) return res.status(400).json({ message: "Header-ul CSV trebuie să conțină coloana 'nume'" });

    const typeIdx = header.indexOf('tip');
    const catIdx = header.indexOf('categorie');
    const priceIdx = header.indexOf('pret_ron');
    const labelIdx = header.indexOf('eticheta_pret');
    const descIdx = header.indexOf('descriere');
    const durIdx = header.indexOf('durata_minute');

    const dataLines = lines.slice(1);
    if (dataLines.length > 500) return res.status(400).json({ message: "Maximum 500 de rânduri per import" });

    const preview = [];
    const errors = [];

    dataLines.forEach((line, i) => {
      // Simple CSV parse (handles commas in quotes)
      const cols = [];
      let current = '';
      let inQuotes = false;
      for (let c = 0; c < line.length; c++) {
        if (line[c] === '"') { inQuotes = !inQuotes; continue; }
        if (line[c] === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue; }
        current += line[c];
      }
      cols.push(current.trim());

      const name = cols[nameIdx] || '';
      if (!name) { errors.push(`Rândul ${i + 2}: Numele lipsește`); return; }

      const rawType = (cols[typeIdx] || 'service').toLowerCase();
      const typeMap = { 'service': 'service', 'serviciu': 'service', 'produs': 'product', 'product': 'product', 'meniu': 'menu_item', 'menu_item': 'menu_item', 'menu': 'menu_item' };
      const type = typeMap[rawType] || 'service';

      const category = cols[catIdx] || '';
      const priceStr = cols[priceIdx] || '';
      let price = null;
      if (priceStr) { const p = parseFloat(priceStr.replace(',', '.')); if (!isNaN(p)) price = Math.round(p * 100); }

      preview.push({
        row: i + 2,
        name,
        type,
        category: category || null,
        price,
        price_label: cols[labelIdx] || null,
        description: cols[descIdx] || null,
        duration_minutes: cols[durIdx] ? parseInt(cols[durIdx], 10) || null : null,
      });
    });

    res.json({ success: true, preview, errors, total: preview.length });
  } catch (err) {
    console.error("[Web API] CSV parse error:", err);
    res.status(500).json({ message: "Eroare la procesarea fișierului CSV" });
  }
});

// POST confirm CSV import (bulk insert with transaction)
router.post("/api/web/portal/:businessId/catalog/import-csv/confirm", requireBusinessOwner, async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: "Lista de articole este goală" });
    if (items.length > 500) return res.status(400).json({ message: "Maximum 500 articole per import" });

    // Re-validate each item to prevent tampered requests
    const VALID_TYPES = ['service', 'product', 'menu_item'];
    const errors = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
        errors.push(`Rândul ${i + 1}: Numele lipsește`);
      } else if (item.name.length > 200) {
        errors.push(`Rândul ${i + 1}: Numele depășește 200 caractere`);
      }
      if (item.type && !VALID_TYPES.includes(item.type)) {
        errors.push(`Rândul ${i + 1}: Tip invalid "${item.type}"`);
      }
      if (item.price !== null && item.price !== undefined) {
        if (typeof item.price !== 'number' || item.price < 0 || !Number.isFinite(item.price)) {
          errors.push(`Rândul ${i + 1}: Preț invalid`);
        }
      }
      if (item.description && (typeof item.description !== 'string' || item.description.length > 2000)) {
        errors.push(`Rândul ${i + 1}: Descriere invalidă sau prea lungă`);
      }
      if (item.duration_minutes !== null && item.duration_minutes !== undefined) {
        if (typeof item.duration_minutes !== 'number' || item.duration_minutes < 0 || !Number.isInteger(item.duration_minutes)) {
          errors.push(`Rândul ${i + 1}: Durată invalidă`);
        }
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ message: "Validare eșuată", errors: errors.slice(0, 20) });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Collect unique category names and create them
      const catNames = [...new Set(items.filter(i => i.category).map(i => i.category.trim()))];
      const catMap = {}; // name → id

      // Load existing categories for this business
      const { rows: existingCats } = await client.query(
        "SELECT id, name FROM business_catalog_categories WHERE business_id = $1",
        [req.businessId]
      );
      existingCats.forEach(c => { catMap[c.name.toLowerCase()] = c.id; });

      // Create missing categories
      let maxOrder = 0;
      if (existingCats.length > 0) {
        const { rows: [{ max_order }] } = await client.query(
          "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM business_catalog_categories WHERE business_id = $1",
          [req.businessId]
        );
        maxOrder = max_order + 1;
      }
      for (const catName of catNames) {
        if (!catMap[catName.toLowerCase()]) {
          const { rows } = await client.query(
            "INSERT INTO business_catalog_categories (business_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id",
            [req.businessId, catName, maxOrder++]
          );
          catMap[catName.toLowerCase()] = rows[0].id;
        }
      }

      // Get next item sort order
      const { rows: [{ next_order }] } = await client.query(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM business_catalog_items WHERE business_id = $1",
        [req.businessId]
      );
      let itemOrder = next_order;

      // Insert items
      let inserted = 0;
      for (const item of items) {
        const catId = item.category ? (catMap[item.category.trim().toLowerCase()] || null) : null;
        await client.query(
          `INSERT INTO business_catalog_items (business_id, category_id, type, name, description, price, price_label, duration_minutes, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [req.businessId, catId, item.type || 'service', item.name, item.description || null,
           item.price ?? null, item.price_label || null, item.duration_minutes ?? null, itemOrder++]
        );
        inserted++;
      }

      await client.query('COMMIT');
      res.json({ success: true, message: `${inserted} articole importate cu succes!`, inserted });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Web API] CSV confirm import error:", err);
    res.status(500).json({ message: "Eroare la importul articolelor" });
  }
});

// Update business info
router.put("/api/web/portal/:businessId", requireBusinessOwner, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { name, description, address, phone, website, city_id, category_id, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions } = req.body || {};

    const sanitizedDesc = description !== undefined ? (description || '').substring(0, 2000) || null : undefined;
    const bookingGated = process.env.TIER_GATING_DISABLED !== 'true' && req.tier && !req.tier.plan.has_booking;

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
    const businessId = req.businessId;
    const { title, description, discount_type, discount_value, conditions, start_date, end_date, flash_expires_at, is_active, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, promo_code, promo_codes, max_reveals } = req.body || {};

    if (!title) return res.status(400).json({ message: "Titlul este obligatoriu" });

    const VALID_DISCOUNT_TYPES = ['percentage', 'fixed', 'special', 'free', 'bogo', 'other'];
    if (discount_type && !VALID_DISCOUNT_TYPES.includes(discount_type)) {
      return res.status(400).json({ message: "Tip de discount invalid" });
    }

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

    const result = await offerService.createOffer(pool, {
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
      // Validate that all location IDs belong to this business (prevent IDOR)
      const validLocs = await pool.query(
        'SELECT id FROM business_locations WHERE business_id = $1 AND id = ANY($2)',
        [businessId, locationIds.map(id => parseInt(id))]
      );
      const validIds = new Set(validLocs.rows.map(r => r.id));
      for (const locId of locationIds) {
        if (validIds.has(parseInt(locId))) {
          await pool.query(
            'INSERT INTO offer_locations (offer_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [result.offerId, parseInt(locId)]
          );
        }
      }
    }

    res.json({
      success: true,
      offer_id: result.offerId,
      moderation_status: result.moderationStatus,
    });
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
    const businessId = req.businessId;
    const offerId = parseInt(req.params.offerId, 10);
    if (isNaN(offerId)) return res.status(400).json({ message: "ID invalid" });
    const { title, description, discount_type, discount_value, conditions, start_date, end_date, flash_expires_at, is_active, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, promo_code, promo_codes, max_reveals } = req.body || {};

    const VALID_DISCOUNT_TYPES = ['percentage', 'fixed', 'special', 'free', 'bogo', 'other'];
    if (discount_type && !VALID_DISCOUNT_TYPES.includes(discount_type)) {
      return res.status(400).json({ message: "Tip de discount invalid" });
    }

    // Re-run AI validation (advisory) on the edited offer data
    let aiScore = null, aiFlags = null, aiReasoning = null;
    try {
      const bizRes = await pool.query(
        `SELECT b.name, c.name AS category_name FROM businesses b LEFT JOIN categories c ON c.id = b.category_id WHERE b.id = $1`,
        [businessId]
      );
      const bizInfo = bizRes.rows[0] || {};
      const moderation = await validateOfferData(
        { title, description, discountType: discount_type, discountValue: discount_value, conditions, startDate: start_date, endDate: end_date },
        { name: bizInfo.name, categoryName: bizInfo.category_name }
      );
      aiScore = moderation.score;
      aiFlags = moderation.flags ? JSON.stringify(moderation.flags) : null;
      aiReasoning = moderation.reasoning || null;
    } catch (validationErr) {
      console.error("[OfferValidation] Re-validation error (non-blocking):", validationErr.message);
    }

    // Update offer fields + reset to pending_review for admin re-review
    const parsedDiscountValue = discount_value != null && discount_value !== '' ? parseInt(discount_value, 10) : 0;
    const parsedMaxReveals = max_reveals ? parseInt(max_reveals, 10) : null;

    await pool.query(`
      UPDATE offers SET
        title = COALESCE($1, title),
        description = $2,
        discount_type = COALESCE($3, discount_type),
        discount_value = COALESCE($4, discount_value),
        conditions = $5,
        start_date = COALESCE($6, start_date),
        end_date = COALESCE($7, end_date),
        flash_expires_at = $8,
        is_active = false,
        booking_type = COALESCE($9, booking_type),
        booking_phone = $10, booking_whatsapp = $11, booking_url = $12, booking_instructions = $13,
        max_reveals = $14,
        moderation_status = 'pending_review',
        rejection_reason = NULL,
        ai_score = $15, ai_flags = $16::jsonb, ai_reasoning = $17
      WHERE id = $18 AND business_id = $19
    `, [
      sanitizeString(title, 200),
      sanitizeString(description, 2000) || null,
      discount_type || null,
      isNaN(parsedDiscountValue) ? 0 : parsedDiscountValue,
      sanitizeString(conditions, 2000) || null,
      start_date || null,
      end_date || null,
      flash_expires_at || null,
      booking_type || 'inherit',
      booking_phone || null,
      booking_whatsapp || null,
      booking_url || null,
      sanitizeString(booking_instructions, 500) || null,
      isNaN(parsedMaxReveals) ? null : parsedMaxReveals,
      aiScore,
      aiFlags,
      aiReasoning,
      offerId,
      businessId,
    ]);

    // Backward compat: if single promo_code string sent, convert to array
    let promoCodesArr = promo_codes;
    if (promoCodesArr === undefined && promo_code !== undefined) {
      promoCodesArr = promo_code ? [{ code: promo_code, is_active: true }] : [];
    }

    // Handle promo codes update if provided
    if (promoCodesArr !== undefined) {
      if (Array.isArray(promoCodesArr)) {
        const validCodes = promoCodesArr.filter(pc => pc.code && pc.code.trim());
        // Enforce promo code limit per tier BEFORE deleting existing codes
        // (prevents data loss if limit check fails)
        const promoLimit = req.tier && req.tier.plan ? req.tier.plan.max_promo_codes_per_offer : null;
        if (promoLimit !== null && validCodes.length > promoLimit) {
          return res.status(403).json({ error: 'limit_reached', message: `Maximum ${promoLimit} coduri promoționale per ofertă.` });
        }
        // Safe to delete now that limit check passed
        await pool.query("DELETE FROM promo_codes WHERE offer_id = $1", [offerId]);
        for (const pc of validCodes) {
          await pool.query(
            "INSERT INTO promo_codes (offer_id, code, is_active) VALUES ($1, $2, $3)",
            [offerId, sanitizeString(pc.code.trim(), 100), pc.is_active !== false]
          );
        }
      } else {
        // Non-array value (e.g. null) — clear all codes
        await pool.query("DELETE FROM promo_codes WHERE offer_id = $1", [offerId]);
      }
    }

    // Sync offer_locations if provided
    const { locationIds } = req.body || {};
    if (Array.isArray(locationIds)) {
      await pool.query('DELETE FROM offer_locations WHERE offer_id = $1', [offerId]);
      if (locationIds.length > 0) {
        // Validate that all location IDs belong to this business (prevent IDOR)
        const validLocs = await pool.query(
          'SELECT id FROM business_locations WHERE business_id = $1 AND id = ANY($2)',
          [businessId, locationIds.map(id => parseInt(id))]
        );
        const validIds = new Set(validLocs.rows.map(r => r.id));
        for (const locId of locationIds) {
          if (validIds.has(parseInt(locId))) {
            await pool.query(
              'INSERT INTO offer_locations (offer_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [offerId, parseInt(locId)]
            );
          }
        }
      }
    }

    res.json({ success: true, moderation_status: 'pending_review' });
  } catch (err) {
    console.error("[Web API] Portal update offer error:", err.message, err.stack);
    res.status(500).json({ message: "Eroare server" });
  }
});

// Delete offer
router.delete("/api/web/portal/:businessId/offers/:offerId", requireBusinessOwner, async (req, res) => {
  try {
    const businessId = req.businessId;
    const offerId = parseInt(req.params.offerId, 10);
    if (isNaN(offerId)) return res.status(400).json({ message: "ID invalid" });
    await pool.query("DELETE FROM offers WHERE id = $1 AND business_id = $2", [offerId, businessId]);
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
    const businessId = req.businessId;
    const offerId = parseInt(req.params.offerId, 10);
    if (isNaN(offerId)) return res.status(400).json({ message: "ID invalid" });

    await client.query("BEGIN");

    // Lock the offer row to prevent concurrent toggles
    const current = await client.query(
      "SELECT is_active, moderation_status FROM offers WHERE id = $1 AND business_id = $2 FOR UPDATE",
      [offerId, businessId]
    );
    if (current.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Ofertă negăsită" });
    }

    const isCurrentlyActive = current.rows[0].is_active;
    const moderationStatus = current.rows[0].moderation_status;

    // Block activation for offers under moderation or rejected
    if (!isCurrentlyActive && (moderationStatus === 'pending_review' || moderationStatus === 'rejected')) {
      await client.query("ROLLBACK");
      const msg = moderationStatus === 'pending_review'
        ? 'Această ofertă este în curs de verificare. Nu poate fi activată până la aprobarea unui admin.'
        : 'Această ofertă a fost respinsă de moderare. Nu poate fi activată.';
      return res.status(403).json({
        error: 'moderation_blocked',
        moderation_status: moderationStatus,
        message: msg,
      });
    }

    // If activating, check tier limit atomically
    if (!isCurrentlyActive && process.env.TIER_GATING_DISABLED !== 'true' && req.tier) {
      const limit = req.tier.plan.max_active_offers;
      if (limit !== null) {
        const countRes = await client.query(
          "SELECT COUNT(*)::int AS cnt FROM offers WHERE business_id = $1 AND is_active = true",
          [businessId]
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
      [offerId, businessId]
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
    const businessId = req.businessId;
    const reviewId = parseInt(req.params.reviewId, 10);
    if (isNaN(reviewId)) return res.status(400).json({ message: "ID invalid" });
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
    const businessId = req.businessId;
    const reviewId = parseInt(req.params.reviewId, 10);
    if (isNaN(reviewId)) return res.status(400).json({ message: "ID invalid" });
    const responseText = sanitizeString(req.body.response_text, 500);
    if (!responseText) return res.status(400).json({ message: "Răspunsul nu poate fi gol" });

    const result = await pool.query(
      "UPDATE review_responses SET response_text = $1, updated_at = NOW() WHERE review_id = $2 AND business_id = $3 RETURNING id",
      [responseText, reviewId, businessId]
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
    const businessId = req.businessId;
    const reviewId = parseInt(req.params.reviewId, 10);
    if (isNaN(reviewId)) return res.status(400).json({ message: "ID invalid" });
    const result = await pool.query(
      "DELETE FROM review_responses WHERE review_id = $1 AND business_id = $2 RETURNING id",
      [reviewId, businessId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Răspunsul nu există" });
    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Portal delete response error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// AI-suggested review responses (Premium only)
router.post("/api/web/portal/:businessId/reviews/:reviewId/suggestions", requireBusinessOwner, requireFeature('has_ai_suggested_responses'), async (req, res) => {
  try {
    const businessId = req.businessId;
    const reviewId = parseInt(req.params.reviewId, 10);
    if (isNaN(reviewId)) return res.status(400).json({ message: "ID invalid" });

    // Fetch review + business info
    const { rows } = await pool.query(`
      SELECT r.rating, r.comment,
             b.name AS business_name, c.name AS category_name,
             u.first_name AS customer_name
      FROM reviews r
      JOIN businesses b ON b.id = r.business_id
      LEFT JOIN categories c ON c.id = b.category_id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.id = $1 AND r.business_id = $2
    `, [reviewId, businessId]);

    if (rows.length === 0) return res.status(404).json({ message: "Recenzia nu există" });
    const review = rows[0];
    if (!review.comment || !review.comment.trim()) {
      return res.status(400).json({ message: "Recenzia nu are comentariu" });
    }

    const result = await generateReviewSuggestions({
      rating: review.rating,
      comment: review.comment,
      businessName: review.business_name,
      businessCategory: review.category_name,
      customerName: review.customer_name,
    });

    res.json({ suggestions: result.suggestions });
  } catch (err) {
    console.error("[Web API] AI review suggestions error:", err);
    const formatted = formatError(err);
    res.status(500).json({ message: formatted.userMessage });
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
    const businessId = req.businessId;
    const tierMaxDays = req.tier ? req.tier.plan.analytics_days : 7;
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), tierMaxDays);

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
    const businessId = req.businessId;
    const tierMaxDays = req.tier ? req.tier.plan.analytics_days : 7;
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), tierMaxDays);
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
    const businessId = req.businessId;
    const tierMaxDays = req.tier ? req.tier.plan.analytics_days : 7;
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), tierMaxDays);

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
    const businessId = req.businessId;
    const tierMaxDays = req.tier ? req.tier.plan.analytics_days : 7;
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), tierMaxDays);

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
    const businessId = req.businessId;
    const type = req.query.type || 'views';
    const tierMaxDays = req.tier ? req.tier.plan.analytics_days : 7;
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), tierMaxDays);

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
    const businessId = req.businessId;

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
    const businessId = req.businessId;
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
    const businessId = req.businessId;

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
    const businessId = req.businessId;
    const tierInfo = await getBusinessTier(pool, businessId);
    const { plan, tier, isTrial, subscription } = tierInfo;

    // Helper to serialise a plan row for the client
    function serialisePlan(p) {
      return {
        slug: p.slug,
        name: p.name,
        priceMonthly: p.price_monthly,
        priceYearly: p.price_yearly,
        maxActiveOffers: p.max_active_offers,
        maxGalleryImages: p.max_gallery_images,
        maxLocations: p.max_locations,
        maxPromoCodesPerOffer: p.max_promo_codes_per_offer,
        analyticsDays: p.analytics_days,
        canRespondReviews: p.can_respond_reviews,
        canUploadLogo: p.can_upload_logo,
        canUploadCover: p.can_upload_cover,
        hasVerifiedBadge: p.has_verified_badge,
        hasAiSummary: p.has_ai_summary,
        hasAiSuggestedResponses: p.has_ai_suggested_responses,
        hasPushOnOffer: p.has_push_on_offer,
        hasCustomPush: p.has_custom_push,
        hasAnalyticsCharts: p.has_analytics_charts,
        hasAnalyticsExport: p.has_analytics_export,
        hasCompetitiveInsights: p.has_competitive_insights,
        hasPromotedPlacement: p.has_promoted_placement,
        hasSearchPriority: p.has_search_priority,
        hasCompetitorBlocking: p.has_competitor_blocking,
        hasDealNomination: p.has_deal_nomination,
        hasBooking: p.has_booking,
        hasPrioritySupport: p.has_priority_support,
        hasConcierge: p.has_concierge,
        badgeType: p.badge_type,
      };
    }

    // Fetch all plans for comparison table
    const allPlansRaw = await getPlans(pool);
    const allPlans = ['free', 'standard', 'premium']
      .filter(slug => allPlansRaw[slug])
      .map(slug => serialisePlan(allPlansRaw[slug]));

    res.json({
      tier,
      plan: serialisePlan(plan),
      allPlans,
      isTrial,
      trialEnd: subscription?.trial_end || null,
      periodEnd: subscription?.current_period_end || null,
      cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
      billingCycle: subscription?.billing_cycle || 'none',
    });
  } catch (err) {
    console.error('[Web API] Subscription info error:', err);
    res.status(500).json({ error: 'Eroare server' });
  }
});

// POST cancel subscription for web portal (W9: uses shared subscriptionService)
router.post("/api/web/portal/:businessId/subscription/cancel", requireBusinessOwner, async (req, res) => {
  try {
    const businessId = req.businessId;
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

    // Escape LIKE special characters to prevent wildcard injection
    const escaped = q.replace(/[%_\\]/g, '\\$&');
    const searchTerm = `%${escaped}%`;

    const [offersRes, businessesRes] = await Promise.all([
      pool.query(`
        SELECT o.id, o.title, o.discount_type, o.discount_value,
               b.name as business_name, b.logo_url as business_logo,
               b.subscription_badge_type, b.is_verified as business_verified
        FROM offers o
        JOIN businesses b ON o.business_id = b.id
        WHERE o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
          AND o.moderation_status IN ('approved', 'auto_approved')
          AND (o.title ILIKE $1 OR o.description ILIKE $1 OR b.name ILIKE $1)
        ORDER BY CASE WHEN o.title ILIKE $1 THEN 0 ELSE 1 END, o.discount_value DESC
        LIMIT 5
      `, [searchTerm]),
      pool.query(`
        SELECT b.id, b.name, b.logo_url, b.subscription_badge_type, b.is_verified, cat.name as category_name
        FROM businesses b
        LEFT JOIN categories cat ON b.category_id = cat.id
        WHERE b.is_active = true
          AND (b.name ILIKE $1 OR cat.name ILIKE $1)
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
//  CONCIERGE ONBOARDING
// ═══════════════════════════════════════════════════════

// Multer for onboarding attachments (PDF + images, max 10MB each, max 5 files)
const onboardingUpload = require("multer")({
  storage: require("multer").memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// GET active onboarding request
router.get("/api/web/portal/:businessId/onboarding/request", requireBusinessOwner, requireFeature('has_concierge'), async (req, res) => {
  try {
    const { businessId } = req.params;
    const result = await pool.query(
      `SELECT id, status, request_type, message, attachments, admin_notes, created_at, updated_at
       FROM onboarding_requests
       WHERE business_id = $1 AND status IN ('pending', 'in_progress')
       ORDER BY created_at DESC LIMIT 1`,
      [businessId]
    );
    res.json({ request: result.rows[0] || null });
  } catch (err) {
    console.error("[Portal API] Get onboarding request error:", err);
    res.status(500).json({ error: "Eroare server" });
  }
});

// POST submit onboarding request (requires has_concierge feature)
router.post(
  "/api/web/portal/:businessId/onboarding/request",
  requireBusinessOwner,
  requireFeature('has_concierge'),
  onboardingUpload.array('attachments', 5),
  async (req, res) => {
    const { uploadToCloudinary, uploadRawToCloudinary } = require('../services/cloudinary');
    const { sendAdminOnboardingEmail } = require('../services/email');

    try {
      const { businessId } = req.params;
      const { request_type, message } = req.body;

      // Validate request_type
      const validTypes = ['catalog', 'hours', 'full_setup'];
      if (!request_type || !validTypes.includes(request_type)) {
        return res.status(400).json({ error: 'Tip cerere invalid' });
      }

      // Check no active request exists (app-level backup for UNIQUE partial index)
      const existingRes = await pool.query(
        `SELECT id FROM onboarding_requests WHERE business_id = $1 AND status IN ('pending', 'in_progress')`,
        [businessId]
      );
      if (existingRes.rows.length > 0) {
        return res.status(409).json({ error: 'Ai deja o cerere activă. Așteaptă finalizarea ei.' });
      }

      // Upload attachments
      const attachments = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            let uploaded;
            if (file.mimetype === 'application/pdf') {
              uploaded = await uploadRawToCloudinary(file.buffer, file.originalname);
            } else {
              uploaded = await uploadToCloudinary(file.buffer, 'gallery');
            }
            attachments.push({
              url: uploaded.url,
              name: file.originalname,
              type: file.mimetype,
              size: file.size,
            });
          } catch (uploadErr) {
            console.error('[Portal API] Attachment upload error:', uploadErr);
            // Continue with other files
          }
        }
      }

      // Insert request
      const userId = req.webUser.id;
      const insertRes = await pool.query(
        `INSERT INTO onboarding_requests (business_id, requested_by, request_type, message, attachments)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, status, request_type, message, attachments, created_at`,
        [businessId, userId, request_type, message || null, JSON.stringify(attachments)]
      );

      // Fire-and-forget: send admin notification email
      const businessRes = await pool.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
      const businessName = businessRes.rows[0]?.name || `Business #${businessId}`;
      sendAdminOnboardingEmail(businessId, businessName, request_type, message).catch(() => {});

      res.json({ success: true, request: insertRes.rows[0] });
    } catch (err) {
      console.error("[Portal API] Submit onboarding request error:", err);
      res.status(500).json({ error: "Eroare server" });
    }
  }
);

// =====================================
//   COMPETITOR BLOCKING — Toggle
// =====================================
router.put(
  "/api/web/portal/:businessId/competitor-blocking",
  requireBusinessOwner,
  requireFeature('has_competitor_blocking'),
  async (req, res) => {
    const { businessId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled trebuie sa fie boolean' });
    }

    try {
      await pool.query(
        'UPDATE businesses SET competitor_blocking_enabled = $1 WHERE id = $2',
        [enabled, parseInt(businessId, 10)]
      );

      res.json({ competitor_blocking_enabled: enabled });
    } catch (err) {
      console.error('[Portal API] Competitor blocking toggle error:', err);
      res.status(500).json({ error: 'Eroare server' });
    }
  }
);

module.exports = router;
