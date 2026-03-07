// web-portal-api.js
// Extracted from web.js — contains all Business Portal AJAX API routes and the
// search autosuggest endpoint. Mounted by index.js (or web.js) alongside web.js.

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireWebAuth } = require("../middleware/webAuth");
const { requireBusinessOwner } = require("../middleware/businessWebAuth");
const { attachTier, requireFeature, requireLimit } = require('../middleware/tierAuth');
const { countActiveOffers, countGalleryImages, countLocations, getBusinessTier } = require('../helpers/tiers');
const { searchLimiter, mapsParseLimiter } = require("../middleware/rateLimiter");
const { parseMapsLink } = require("../helpers/mapsParser");
const { sanitizeString } = require("../helpers/validate");
const offerService = require("../services/offerService");
const { validateOfferData } = require("../services/llm/offerValidation");
const pushService = require("../services/pushNotifications");
const { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } = require("../services/cloudinary");
const { portalUpload } = require("./web-shared");
const { cancelSubscription } = require("../services/subscriptionService");

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
  const client = await pool.connect();
  try {
    const businessId = req.businessId;
    if (!req.file) return res.status(400).json({ message: "Niciun fișier" });

    await client.query("BEGIN");

    // Atomic count check with row lock to prevent race condition
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

// Update business info
router.put("/api/web/portal/:businessId", requireBusinessOwner, async (req, res) => {
  try {
    const businessId = req.businessId;
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
    const businessId = req.businessId;
    const { title, description, discount_type, discount_value, conditions, start_date, end_date, is_active, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, promo_code, promo_codes, max_reveals } = req.body || {};

    if (!title) return res.status(400).json({ message: "Titlul este obligatoriu" });

    const VALID_DISCOUNT_TYPES = ['percentage', 'fixed', 'free', 'bogo', 'other'];
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
      for (const locId of locationIds) {
        await pool.query(
          'INSERT INTO offer_locations (offer_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [result.offerId, parseInt(locId)]
        );
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
    const { title, description, discount_type, discount_value, conditions, start_date, end_date, is_active, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, promo_code, promo_codes, max_reveals } = req.body || {};

    const VALID_DISCOUNT_TYPES = ['percentage', 'fixed', 'free', 'bogo', 'other'];
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
    await pool.query(`
      UPDATE offers SET
        title = COALESCE($1, title),
        description = $2,
        discount_type = COALESCE($3, discount_type),
        discount_value = COALESCE($4, discount_value),
        conditions = $5,
        start_date = COALESCE($6, start_date),
        end_date = COALESCE($7, end_date),
        is_active = false,
        booking_type = COALESCE($9, booking_type),
        booking_phone = $10, booking_whatsapp = $11, booking_url = $12, booking_instructions = $13,
        max_reveals = $16,
        moderation_status = 'pending_review',
        rejection_reason = NULL,
        ai_score = $17, ai_flags = $18, ai_reasoning = $19
      WHERE id = $14 AND business_id = $15
    `, [sanitizeString(title, 200), sanitizeString(description, 2000) || null,
        discount_type, discount_value || 0, sanitizeString(conditions, 2000) || null,
        start_date || null, end_date || null, null /* $8 unused */,
        booking_type || 'inherit', booking_phone || null, booking_whatsapp || null, booking_url || null, sanitizeString(booking_instructions, 500) || null,
        offerId, businessId, max_reveals ? parseInt(max_reveals) : null,
        aiScore, aiFlags, aiReasoning]);

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

    res.json({ success: true, moderation_status: 'pending_review' });
  } catch (err) {
    console.error("[Web API] Portal update offer error:", err);
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
    if (!isCurrentlyActive && process.env.TIER_GATING_ENABLED === 'true' && req.tier) {
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
    const businessId = req.businessId;
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
    const businessId = req.businessId;
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
    const businessId = req.businessId;
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
    const businessId = req.businessId;
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

module.exports = router;
