const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const { businessAuth, businessUserAuth } = require("../middleware/businessAuth");
const { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } = require("../services/cloudinary");
const { triggerWebhook } = require("../services/n8n");
const pushService = require("../services/pushNotifications");
const offerService = require("../services/offerService");
const { parsePagination, paginatedResponse, sanitizeString, createImageFilter } = require("../helpers/validate");

// =====================================
//   CONFIG UPLOADS (Memory Storage pentru Cloudinary)
// =====================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: createImageFilter(), // Whitelist: JPEG, PNG, WebP, GIF
});

// =====================================
//   MY BUSINESSES - Lista
// =====================================
router.get("/", businessUserAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("[BusinessPortal] GET /my-businesses - User:", userId, "Role:", req.user.role);

    let query;
    let params = [];

    if (req.user.role === "admin") {
      query = `
        SELECT b.id, b.name, b.logo_url, b.cover_image_url,
               c.name as city_name, cat.name as category_name,
               (SELECT COUNT(*) FROM offers WHERE business_id = b.id AND is_active = true) as active_offers
        FROM businesses b
        LEFT JOIN cities c ON b.city_id = c.id
        LEFT JOIN categories cat ON b.category_id = cat.id
        ORDER BY b.name
      `;
    } else {
      query = `
        SELECT b.id, b.name, b.logo_url, b.cover_image_url,
               c.name as city_name, cat.name as category_name,
               (SELECT COUNT(*) FROM offers WHERE business_id = b.id AND is_active = true) as active_offers
        FROM businesses b
        JOIN user_businesses ub ON ub.business_id = b.id
        LEFT JOIN cities c ON b.city_id = c.id
        LEFT JOIN categories cat ON b.category_id = cat.id
        WHERE ub.user_id = $1
        ORDER BY b.name
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);
    console.log("[BusinessPortal] Found businesses:", result.rows.length);

    const businesses = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      logo_url: row.logo_url, // Acum e URL complet Cloudinary
      cover_image_url: row.cover_image_url,
      city_name: row.city_name,
      category_name: row.category_name,
      active_offers: parseInt(row.active_offers) || 0
    }));

    res.json(businesses);
  } catch (err) {
    console.error("[BusinessPortal] Eroare la GET /my-businesses:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// =====================================
//   MY BUSINESS - Detalii
// =====================================
router.get("/:businessId", businessAuth, async (req, res) => {
  try {
    const { businessId } = req.params;
    console.log("[BusinessPortal] GET /my-businesses/:id - ID:", businessId);

    const result = await pool.query(`
      SELECT b.*, c.name as city_name, cat.name as category_name
      FROM businesses b
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      WHERE b.id = $1
    `, [businessId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Business-ul nu există" });
    }

    const b = result.rows[0];

    const imagesResult = await pool.query(
      "SELECT id, image_url, sort_order FROM business_images WHERE business_id = $1 ORDER BY sort_order",
      [businessId]
    );

    const locationsResult = await pool.query(`
      SELECT bl.*, c.name as city_name
      FROM business_locations bl
      LEFT JOIN cities c ON bl.city_id = c.id
      WHERE bl.business_id = $1
      ORDER BY bl.id
    `, [businessId]);

    const [citiesRes, categoriesRes] = await Promise.all([
      pool.query("SELECT id, name FROM cities ORDER BY name"),
      pool.query("SELECT id, name FROM categories ORDER BY name")
    ]);

    res.json({
      id: b.id,
      name: b.name,
      address: b.address,
      phone: b.phone,
      website: b.website,
      lat: b.lat,
      lng: b.lng,
      city_id: b.city_id,
      city_name: b.city_name,
      category_id: b.category_id,
      category_name: b.category_name,
      logo_url: b.logo_url,
      cover_image_url: b.cover_image_url,
      booking_type: b.booking_type || 'none',
      booking_phone: b.booking_phone || '',
      booking_whatsapp: b.booking_whatsapp || '',
      booking_url: b.booking_url || '',
      booking_instructions: b.booking_instructions || '',
      images: imagesResult.rows.map(img => ({
        id: img.id,
        url: img.image_url, // Acum e URL complet Cloudinary
        sort_order: img.sort_order
      })),
      locations: locationsResult.rows,
      locations_count: locationsResult.rows.length,
      _cities: citiesRes.rows,
      _categories: categoriesRes.rows
    });
  } catch (err) {
    console.error("[BusinessPortal] Eroare la GET /my-businesses/:id:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// =====================================
//   UPDATE BUSINESS
// =====================================
router.put("/:businessId", businessAuth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const {
      name, address, phone, website, city_id, category_id, lat, lng,
      booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions
    } = req.body;

    console.log("[BusinessPortal] PUT /my-businesses/:id - ID:", businessId);

    await pool.query(`
      UPDATE businesses SET
        name = COALESCE($1, name),
        address = COALESCE($2, address),
        phone = COALESCE($3, phone),
        website = COALESCE($4, website),
        city_id = COALESCE($5, city_id),
        category_id = COALESCE($6, category_id),
        lat = COALESCE($7, lat),
        lng = COALESCE($8, lng),
        booking_type = COALESCE($9, booking_type),
        booking_phone = $10,
        booking_whatsapp = $11,
        booking_url = $12,
        booking_instructions = $13
      WHERE id = $14
    `, [
      name, address, phone, website, city_id, category_id, lat, lng,
      booking_type || 'none',
      booking_phone || null,
      booking_whatsapp || null,
      booking_url || null,
      booking_instructions || null,
      businessId
    ]);

    res.json({ success: true, message: "Business actualizat" });
  } catch (err) {
    console.error("[BusinessPortal] Eroare la PUT /my-businesses/:id:", err);
    res.status(500).json({ message: "Eroare la actualizare" });
  }
});

// =====================================
//   UPLOAD LOGO - Cloudinary
// =====================================
router.post("/:businessId/logo", businessAuth, upload.single("logo"), async (req, res) => {
  try {
    const { businessId } = req.params;
    console.log("[BusinessPortal] POST logo - Starting upload for business:", businessId);

    if (!req.file) {
      console.log("[BusinessPortal] No file in request");
      return res.status(400).json({ message: "Niciun fișier încărcat" });
    }

    // Șterge logo-ul vechi din Cloudinary (dacă există)
    const oldRes = await pool.query("SELECT logo_url FROM businesses WHERE id = $1", [businessId]);
    if (oldRes.rows[0]?.logo_url) {
      const oldPublicId = getPublicIdFromUrl(oldRes.rows[0].logo_url);
      if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId);
      }
    }

    // Upload pe Cloudinary cu rezoluție specifică pentru logo (400x400)
    const result = await uploadToCloudinary(req.file.buffer, "logo");

    // Salvează URL-ul în DB
    await pool.query("UPDATE businesses SET logo_url = $1 WHERE id = $2", [result.url, businessId]);

    console.log("[BusinessPortal] Logo saved:", result.url);
    res.json({ success: true, logo_url: result.url });
  } catch (err) {
    console.error("[BusinessPortal] Error uploading logo:", err);
    // Trimitem mesajul de eroare către client pentru debugging (ex: Missing Cloudinary config)
    res.status(500).json({ message: "Eroare internă" });
  }
});

// =====================================
//   UPLOAD COVER - Cloudinary
// =====================================
router.post("/:businessId/cover", businessAuth, upload.single("cover"), async (req, res) => {
  try {
    const { businessId } = req.params;
    console.log("[BusinessPortal] POST cover - Starting upload for business:", businessId);

    if (!req.file) {
      console.log("[BusinessPortal] No file in request");
      return res.status(400).json({ message: "Niciun fișier încărcat" });
    }

    // Șterge cover-ul vechi din Cloudinary (dacă există)
    const oldRes = await pool.query("SELECT cover_image_url FROM businesses WHERE id = $1", [businessId]);
    if (oldRes.rows[0]?.cover_image_url) {
      const oldPublicId = getPublicIdFromUrl(oldRes.rows[0].cover_image_url);
      if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId);
      }
    }

    // Upload pe Cloudinary cu rezoluție specifică pentru cover (1200x600)
    const result = await uploadToCloudinary(req.file.buffer, "cover");

    // Salvează URL-ul în DB
    await pool.query("UPDATE businesses SET cover_image_url = $1 WHERE id = $2", [result.url, businessId]);

    console.log("[BusinessPortal] Cover saved:", result.url);
    res.json({ success: true, cover_image_url: result.url });
  } catch (err) {
    console.error("[BusinessPortal] Error uploading cover:", err);
    res.status(500).json({ message: "Eroare la încărcarea cover-ului" });
  }
});

// =====================================
//   UPLOAD GALLERY IMAGE - Cloudinary
// =====================================
router.post("/:businessId/images", businessAuth, upload.single("image"), async (req, res) => {
  try {
    const { businessId } = req.params;
    console.log("[BusinessPortal] POST gallery image - Starting upload for business:", businessId);

    if (!req.file) {
      console.log("[BusinessPortal] No file in request");
      return res.status(400).json({ message: "Niciun fișier încărcat" });
    }

    // Verifică limita de imagini
    const countRes = await pool.query(
      "SELECT COUNT(*) as cnt FROM business_images WHERE business_id = $1",
      [businessId]
    );

    if (parseInt(countRes.rows[0].cnt) >= 8) {
      return res.status(400).json({ message: "Maximum 8 imagini permise" });
    }

    // Upload pe Cloudinary cu rezoluție specifică pentru galerie (1200x800)
    const result = await uploadToCloudinary(req.file.buffer, "gallery");

    // Salvează în DB
    const sortOrder = parseInt(countRes.rows[0].cnt) + 1;
    await pool.query(
      "INSERT INTO business_images (business_id, image_url, sort_order) VALUES ($1, $2, $3)",
      [businessId, result.url, sortOrder]
    );

    console.log("[BusinessPortal] Gallery image saved:", result.url);
    res.json({ success: true, image_url: result.url });
  } catch (err) {
    console.error("[BusinessPortal] Error uploading gallery image:", err);
    res.status(500).json({ message: "Eroare la încărcarea imaginii" });
  }
});

// =====================================
//   DELETE GALLERY IMAGE - Cloudinary
// =====================================
router.delete("/:businessId/images/:imageId", businessAuth, async (req, res) => {
  try {
    const { businessId, imageId } = req.params;
    console.log("[BusinessPortal] DELETE image - Business:", businessId, "Image:", imageId);

    // Găsește imaginea
    const imgRes = await pool.query(
      "SELECT image_url FROM business_images WHERE id = $1 AND business_id = $2",
      [imageId, businessId]
    );

    if (imgRes.rows.length === 0) {
      return res.status(404).json({ message: "Imaginea nu există" });
    }

    // Șterge din Cloudinary
    const publicId = getPublicIdFromUrl(imgRes.rows[0].image_url);
    if (publicId) {
      await deleteFromCloudinary(publicId);
    }

    // Șterge din DB
    await pool.query("DELETE FROM business_images WHERE id = $1", [imageId]);

    console.log("[BusinessPortal] Image deleted:", imageId);
    res.json({ success: true });
  } catch (err) {
    console.error("[BusinessPortal] Eroare ștergere imagine:", err);
    res.status(500).json({ message: "Eroare la ștergere" });
  }
});

// =====================================
//   OFFERS - Lista
// =====================================
router.get("/:businessId/offers", businessAuth, async (req, res) => {
  try {
    const { businessId } = req.params;
    console.log("[BusinessPortal] GET offers - Business ID:", businessId);

    const result = await pool.query(`
      SELECT id, title, description, discount_type, discount_value,
             start_date, end_date, is_active, logo_url,
             booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions
      FROM offers
      WHERE business_id = $1
      ORDER BY id DESC
    `, [businessId]);

    console.log("[BusinessPortal] Found offers:", result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error("[BusinessPortal] Eroare la GET offers:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// =====================================
//   CREATE OFFER - Cloudinary
// =====================================
router.post("/:businessId/offers", businessAuth, upload.single("image"), async (req, res) => {
  try {
    const { businessId } = req.params;
    const {
      title, description, discount_type, discount_value, conditions,
      start_date, end_date, is_active,
      booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, promo_code, promo_codes
    } = req.body;

    console.log("[BusinessPortal] Creating offer:", title);

    let logoUrl = null;
    if (req.file) {
      // Upload pe Cloudinary cu rezoluție specifică pentru ofertă (800x600)
      const uploadResult = await uploadToCloudinary(req.file.buffer, "offer");
      logoUrl = uploadResult.url;
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

    const offerId = await offerService.createOffer(pool, {
      businessId: parseInt(businessId),
      title: title,
      description: description,
      discountType: discount_type,
      discountValue: discount_value ? Number(discount_value) : null,
      conditions: conditions,
      startDate: start_date,
      endDate: end_date,
      isActive: is_active === 'true' || is_active === true,
      logoUrl: logoUrl,
      bookingType: booking_type,
      bookingPhone: booking_phone,
      bookingWhatsapp: booking_whatsapp,
      bookingUrl: booking_url,
      bookingInstructions: booking_instructions,
      promoCodes: sanitizedPromoCodes,
      sendWebhook: true, // Business portal triggers n8n webhook
    });

    console.log("[BusinessPortal] Offer created with ID:", offerId);

    res.json({ success: true, offer_id: offerId });
  } catch (err) {
    console.error("[BusinessPortal] Error creating offer:", err);
    res.status(500).json({ message: "Eroare la creare" });
  }
});

// =====================================
//   GET SINGLE OFFER
// =====================================
router.get("/:businessId/offers/:offerId", businessAuth, async (req, res) => {
  try {
    const { businessId, offerId } = req.params;
    console.log("[BusinessPortal] GET single offer - Business:", businessId, "Offer:", offerId);

    const result = await pool.query(`
      SELECT id, business_id, title, description, discount_type, discount_value, conditions, start_date, end_date, is_active, logo_url FROM offers WHERE id = $1 AND business_id = $2
    `, [offerId, businessId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Oferta nu există" });
    }

    // Fetch promo codes for this offer
    const promoCodesRes = await pool.query(
      "SELECT id, code, is_active FROM promo_codes WHERE offer_id = $1 ORDER BY id",
      [offerId]
    );

    res.json({
      ...result.rows[0],
      promo_codes: promoCodesRes.rows
    });
  } catch (err) {
    console.error("[BusinessPortal] Eroare la GET offer:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// =====================================
//   UPDATE OFFER - Cloudinary
// =====================================
router.put("/:businessId/offers/:offerId", businessAuth, upload.single("image"), async (req, res) => {
  try {
    const { businessId, offerId } = req.params;

    console.log("[BusinessPortal] PUT offer - Business:", businessId, "Offer:", offerId);

    const checkRes = await pool.query(
      "SELECT id, logo_url FROM offers WHERE id = $1 AND business_id = $2",
      [offerId, businessId]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: "Oferta nu există" });
    }

    const {
      title, description, discount_type, discount_value, conditions,
      start_date, end_date, is_active,
      booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, promo_code, promo_codes
    } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description || null);
    }
    if (discount_type !== undefined) {
      updates.push(`discount_type = $${paramIndex++}`);
      values.push(discount_type);
    }
    if (discount_value !== undefined) {
      updates.push(`discount_value = $${paramIndex++}`);
      values.push(discount_value ? Number(discount_value) : null);
    }
    if (conditions !== undefined) {
      updates.push(`conditions = $${paramIndex++}`);
      values.push(conditions || null);
    }
    if (start_date !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      values.push(start_date || null);
    }
    if (end_date !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(end_date || null);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active === 'true' || is_active === true);
    }

    if (booking_type !== undefined) {
      updates.push(`booking_type = $${paramIndex++}`);
      values.push(booking_type || 'inherit');
    }
    if (booking_phone !== undefined) {
      updates.push(`booking_phone = $${paramIndex++}`);
      values.push(booking_phone || null);
    }
    if (booking_whatsapp !== undefined) {
      updates.push(`booking_whatsapp = $${paramIndex++}`);
      values.push(booking_whatsapp || null);
    }
    if (booking_url !== undefined) {
      updates.push(`booking_url = $${paramIndex++}`);
      values.push(booking_url || null);
    }
    if (booking_instructions !== undefined) {
      updates.push(`booking_instructions = $${paramIndex++}`);
      values.push(booking_instructions || null);
    }
    // Handle image upload
    if (req.file) {
      // Șterge imaginea veche din Cloudinary
      const oldUrl = checkRes.rows[0].logo_url;
      if (oldUrl) {
        const oldPublicId = getPublicIdFromUrl(oldUrl);
        if (oldPublicId) {
          await deleteFromCloudinary(oldPublicId);
        }
      }

      // Upload noua imagine cu rezoluție specifică pentru ofertă (800x600)
      const uploadResult = await uploadToCloudinary(req.file.buffer, "offer");
      updates.push(`logo_url = $${paramIndex++}`);
      values.push(uploadResult.url);
    }

    // Use transaction for offer update + promo codes
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Update offer fields if there are any changes
      if (updates.length > 0) {
        values.push(offerId);
        const query = `UPDATE offers SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
        await client.query(query, values);
      }

      // Backward compat: if single promo_code string sent, convert to array
      let promoCodesArr = promo_codes;
      if (promoCodesArr === undefined && promo_code !== undefined) {
        promoCodesArr = promo_code ? [{ code: promo_code, is_active: true }] : [];
      }

      // Handle promo codes update if provided
      if (promoCodesArr !== undefined) {
        await client.query("DELETE FROM promo_codes WHERE offer_id = $1", [offerId]);

        if (Array.isArray(promoCodesArr)) {
          const validCodes = promoCodesArr.filter(pc => pc.code && pc.code.trim());
          for (const pc of validCodes) {
            await client.query(
              "INSERT INTO promo_codes (offer_id, code, is_active) VALUES ($1, $2, $3)",
              [offerId, sanitizeString(pc.code.trim(), 100), pc.is_active !== false]
            );
          }
        }
      }

      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    console.log("[BusinessPortal] Offer updated successfully");
    res.json({ success: true });
  } catch (err) {
    console.error("[BusinessPortal] Error updating offer:", err);
    res.status(500).json({ message: "Eroare la actualizare" });
  }
});

// =====================================
//   DELETE OFFER - Cloudinary
// =====================================
router.delete("/:businessId/offers/:offerId", businessAuth, async (req, res) => {
  try {
    const { businessId, offerId } = req.params;
    console.log("[BusinessPortal] DELETE offer - Business:", businessId, "Offer:", offerId);

    const result = await pool.query(
      "DELETE FROM offers WHERE id = $1 AND business_id = $2 RETURNING logo_url",
      [offerId, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Oferta nu există" });
    }

    // Șterge imaginea din Cloudinary
    if (result.rows[0].logo_url) {
      const publicId = getPublicIdFromUrl(result.rows[0].logo_url);
      if (publicId) {
        await deleteFromCloudinary(publicId);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[BusinessPortal] Eroare ștergere ofertă:", err);
    res.status(500).json({ message: "Eroare la ștergere" });
  }
});

// =====================================
//   TOGGLE OFFER ACTIVE
// =====================================
router.patch("/:businessId/offers/:offerId/toggle", businessAuth, async (req, res) => {
  try {
    const { businessId, offerId } = req.params;

    const result = await pool.query(`
      UPDATE offers 
      SET is_active = NOT is_active 
      WHERE id = $1 AND business_id = $2
      RETURNING is_active
    `, [offerId, businessId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Oferta nu există" });
    }

    res.json({ success: true, is_active: result.rows[0].is_active });
  } catch (err) {
    console.error("[BusinessPortal] Eroare toggle ofertă:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// =====================================
//   ANALYTICS - Overview
// =====================================
router.get("/:businessId/analytics", businessAuth, async (req, res) => {
  try {
    const { businessId } = req.params;

    const [viewsRes, subscribersRes, reviewsRes, offersRes, ratingRes, offerRequestsRes, codeRevealsRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as total_views,
                COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '7 days') as views_7d,
                COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '30 days') as views_30d
         FROM business_views WHERE business_id = $1`,
        [businessId]
      ),
      pool.query(
        "SELECT COUNT(*) as total FROM followed_businesses WHERE business_id = $1",
        [businessId]
      ),
      pool.query(
        `SELECT COUNT(*) as total_reviews,
                COALESCE(AVG(rating), 0) as avg_rating
         FROM reviews WHERE business_id = $1`,
        [businessId]
      ),
      pool.query(
        `SELECT COUNT(*) as total_offers,
                COUNT(*) FILTER (WHERE is_active = true AND end_date >= CURRENT_DATE) as active_offers
         FROM offers WHERE business_id = $1`,
        [businessId]
      ),
      pool.query(
        `SELECT rating, COUNT(*) as count
         FROM reviews WHERE business_id = $1
         GROUP BY rating ORDER BY rating DESC`,
        [businessId]
      ),
      pool.query(
        `SELECT COUNT(*) as total_requests,
                COUNT(DISTINCT user_id) as unique_requesters,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as requests_7d,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as requests_30d
         FROM offer_requests WHERE business_id = $1`,
        [businessId]
      ),
      pool.query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE revealed_at >= NOW() - INTERVAL '30 days') as last_30d
         FROM code_reveals cr JOIN offers o ON cr.offer_id = o.id WHERE o.business_id = $1`,
        [businessId]
      ),
    ]);

    // Offer views (separate query to avoid complex join)
    const offerViewsRes = await pool.query(
      `SELECT COALESCE(SUM(cnt), 0) as total FROM (
         SELECT COUNT(*) as cnt FROM offer_views
         WHERE business_id = $1 AND viewed_at >= NOW() - INTERVAL '30 days'
       ) sub`,
      [businessId]
    );

    const views = viewsRes.rows[0];
    const subscribers = parseInt(subscribersRes.rows[0].total) || 0;
    const reviewStats = reviewsRes.rows[0];
    const offerStats = offersRes.rows[0];
    const offerRequestStats = offerRequestsRes.rows[0];
    const codeRevealStats = codeRevealsRes.rows[0];

    const ratingDistribution = [5, 4, 3, 2, 1].map(star => {
      const found = ratingRes.rows.find(r => parseInt(r.rating) === star);
      return { rating: star, count: parseInt(found?.count || 0) };
    });

    res.json({
      views: {
        total: parseInt(views.total_views) || 0,
        last_7d: parseInt(views.views_7d) || 0,
        last_30d: parseInt(views.views_30d) || 0,
      },
      subscribers,
      reviews: {
        total: parseInt(reviewStats.total_reviews) || 0,
        avg_rating: parseFloat(parseFloat(reviewStats.avg_rating).toFixed(1)),
        distribution: ratingDistribution,
      },
      offers: {
        total: parseInt(offerStats.total_offers) || 0,
        active: parseInt(offerStats.active_offers) || 0,
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
    });
  } catch (err) {
    console.error("[BusinessPortal] Analytics error:", err);
    res.status(500).json({ message: "Eroare la statistici" });
  }
});

// =====================================
//   ANALYTICS - Views Timeline
// =====================================
router.get("/:businessId/analytics/views", businessAuth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const period = req.query.period || "30d";

    const intervalMap = { "7d": 7, "30d": 30, "90d": 90 };
    const days = intervalMap[period] || 30;

    const result = await pool.query(
      `SELECT DATE(viewed_at) as date, COUNT(*) as views
       FROM business_views
       WHERE business_id = $1 AND viewed_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY DATE(viewed_at)
       ORDER BY date ASC`,
      [businessId, days]
    );

    // Fill missing days with 0
    const filledData = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const found = result.rows.find(r => {
        const rDate = r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date);
        return rDate === dateStr;
      });
      filledData.push({ date: dateStr, views: parseInt(found?.views || 0) });
    }

    res.json({ period, data: filledData });
  } catch (err) {
    console.error("[BusinessPortal] Views timeline error:", err);
    res.status(500).json({ message: "Eroare la vizualizari" });
  }
});

// =====================================
//   ANALYTICS - Subscriber Trend
// =====================================
router.get("/:businessId/analytics/subscribers", businessAuth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const period = req.query.period || "30d";

    const intervalMap = { "7d": 7, "30d": 30, "90d": 90 };
    const days = intervalMap[period] || 30;

    const [trendRes, totalRes] = await Promise.all([
      pool.query(
        `SELECT DATE(created_at) as date, COUNT(*) as new_subscribers
         FROM followed_businesses
         WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [businessId, days]
      ),
      pool.query(
        "SELECT COUNT(*) as total FROM followed_businesses WHERE business_id = $1",
        [businessId]
      ),
    ]);

    const data = trendRes.rows.map(r => ({
      date: r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date),
      new_subscribers: parseInt(r.new_subscribers),
    }));

    res.json({
      period,
      total: parseInt(totalRes.rows[0].total) || 0,
      data,
    });
  } catch (err) {
    console.error("[BusinessPortal] Subscriber trend error:", err);
    res.status(500).json({ message: "Eroare la abonati" });
  }
});

// =====================================
//   REVIEWS - Lista cu status răspuns
// =====================================
router.get("/:businessId/reviews", businessAuth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { page, limit, offset } = parsePagination(req.query);

    const [result, countResult] = await Promise.all([
      pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at,
                u.first_name, u.last_name,
                rr.id as response_id, rr.response_text, rr.created_at as response_date
         FROM reviews r
         JOIN users u ON r.user_id = u.id
         LEFT JOIN review_responses rr ON rr.review_id = r.id
         WHERE r.business_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [businessId, limit, offset]
      ),
      pool.query("SELECT COUNT(*) as total FROM reviews WHERE business_id = $1", [businessId]),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

    const reviews = result.rows.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      user: { first_name: r.first_name, last_name: r.last_name },
      response: r.response_id ? {
        id: r.response_id,
        text: r.response_text,
        created_at: r.response_date,
      } : null,
    }));

    res.json(paginatedResponse(reviews, total, page, limit));
  } catch (err) {
    console.error("[BusinessPortal] Reviews list error:", err);
    res.status(500).json({ message: "Eroare la recenzii" });
  }
});

// =====================================
//   REVIEWS - Răspunde la o recenzie
// =====================================
router.post("/:businessId/reviews/:reviewId/respond", businessAuth, async (req, res) => {
  try {
    const { businessId, reviewId } = req.params;
    const responseText = sanitizeString(req.body.response_text, 500);

    if (!responseText || responseText.length === 0) {
      return res.status(400).json({ message: "Răspunsul nu poate fi gol" });
    }

    // Verify review belongs to this business
    const reviewCheck = await pool.query(
      "SELECT id FROM reviews WHERE id = $1 AND business_id = $2",
      [reviewId, businessId]
    );
    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({ message: "Recenzia nu există" });
    }

    // Check no existing response
    const existingRes = await pool.query(
      "SELECT id FROM review_responses WHERE review_id = $1",
      [reviewId]
    );
    if (existingRes.rows.length > 0) {
      return res.status(409).json({ message: "Există deja un răspuns pentru această recenzie" });
    }

    const result = await pool.query(
      `INSERT INTO review_responses (review_id, business_id, response_text, responded_by)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [reviewId, businessId, responseText, req.user.id]
    );

    res.status(201).json({
      success: true,
      response: {
        id: result.rows[0].id,
        text: responseText,
        created_at: result.rows[0].created_at,
      },
    });
  } catch (err) {
    console.error("[BusinessPortal] Respond error:", err);
    res.status(500).json({ message: "Eroare la trimiterea răspunsului" });
  }
});

// =====================================
//   REVIEWS - Editează răspunsul
// =====================================
router.put("/:businessId/reviews/:reviewId/respond", businessAuth, async (req, res) => {
  try {
    const { businessId, reviewId } = req.params;
    const responseText = sanitizeString(req.body.response_text, 500);

    if (!responseText || responseText.length === 0) {
      return res.status(400).json({ message: "Răspunsul nu poate fi gol" });
    }

    const result = await pool.query(
      `UPDATE review_responses SET response_text = $1, updated_at = NOW()
       WHERE review_id = $2 AND business_id = $3 RETURNING id`,
      [responseText, reviewId, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Răspunsul nu există" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[BusinessPortal] Update response error:", err);
    res.status(500).json({ message: "Eroare la editare" });
  }
});

// =====================================
//   REVIEWS - Șterge răspunsul
// =====================================
router.delete("/:businessId/reviews/:reviewId/respond", businessAuth, async (req, res) => {
  try {
    const { businessId, reviewId } = req.params;

    const result = await pool.query(
      "DELETE FROM review_responses WHERE review_id = $1 AND business_id = $2 RETURNING id",
      [reviewId, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Răspunsul nu există" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[BusinessPortal] Delete response error:", err);
    res.status(500).json({ message: "Eroare la ștergere" });
  }
});

// =====================================
//   PERFORMANCE SCORE
// =====================================
router.get("/:businessId/score", businessAuth, async (req, res) => {
  try {
    const { businessId } = req.params;

    const [bizRes, imagesRes, offersRes, reviewsRes, responsesRes, subscribersRes] = await Promise.all([
      pool.query(
        "SELECT logo_url, cover_image_url, phone, website, booking_type FROM businesses WHERE id = $1",
        [businessId]
      ),
      pool.query(
        "SELECT COUNT(*) as cnt FROM business_images WHERE business_id = $1",
        [businessId]
      ),
      pool.query(
        "SELECT COUNT(*) as cnt FROM offers WHERE business_id = $1 AND is_active = true AND end_date >= CURRENT_DATE",
        [businessId]
      ),
      pool.query(
        "SELECT COUNT(*) as total, COALESCE(AVG(rating), 0) as avg_rating FROM reviews WHERE business_id = $1",
        [businessId]
      ),
      pool.query(
        `SELECT
          (SELECT COUNT(*) FROM reviews WHERE business_id = $1) as total_reviews,
          (SELECT COUNT(*) FROM review_responses WHERE business_id = $1) as total_responses`,
        [businessId]
      ),
      pool.query(
        "SELECT COUNT(*) as cnt FROM followed_businesses WHERE business_id = $1",
        [businessId]
      ),
    ]);

    const biz = bizRes.rows[0];
    if (!biz) return res.status(404).json({ message: "Business negăsit" });

    const imageCount = parseInt(imagesRes.rows[0].cnt);
    const activeOffers = parseInt(offersRes.rows[0].cnt);
    const totalReviews = parseInt(reviewsRes.rows[0].total);
    const avgRating = parseFloat(reviewsRes.rows[0].avg_rating);
    const totalResponses = parseInt(responsesRes.rows[0].total_responses);
    const totalReviewsForResponses = parseInt(responsesRes.rows[0].total_reviews);
    const subscribers = parseInt(subscribersRes.rows[0].cnt);

    const responseRate = totalReviewsForResponses > 0 ? totalResponses / totalReviewsForResponses : 0;

    const breakdown = [
      { criterion: "Logo", points: 10, earned: biz.logo_url ? 10 : 0, completed: !!biz.logo_url, tip: !biz.logo_url ? "Adaugă un logo pentru a crește vizibilitatea" : null },
      { criterion: "Cover", points: 15, earned: biz.cover_image_url ? 15 : 0, completed: !!biz.cover_image_url, tip: !biz.cover_image_url ? "Adaugă o imagine de cover pentru a crește vizibilitatea" : null },
      { criterion: "Telefon", points: 5, earned: biz.phone ? 5 : 0, completed: !!biz.phone, tip: !biz.phone ? "Completează numărul de telefon" : null },
      { criterion: "Website", points: 5, earned: biz.website ? 5 : 0, completed: !!biz.website, tip: !biz.website ? "Adaugă un website" : null },
      { criterion: "Rezervări", points: 10, earned: (biz.booking_type && biz.booking_type !== "none") ? 10 : 0, completed: !!(biz.booking_type && biz.booking_type !== "none"), tip: (!biz.booking_type || biz.booking_type === "none") ? "Configurează sistemul de rezervări" : null },
      { criterion: "Ofertă activă", points: 15, earned: activeOffers > 0 ? 15 : 0, completed: activeOffers > 0, tip: activeOffers === 0 ? "Creează cel puțin o ofertă activă" : null },
      { criterion: "Rating >= 4.0", points: 10, earned: avgRating >= 4.0 ? 10 : 0, completed: avgRating >= 4.0, tip: avgRating < 4.0 ? "Îmbunătățește experiența clienților pentru un rating mai bun" : null },
      { criterion: "5+ recenzii", points: 10, earned: totalReviews >= 5 ? 10 : 0, completed: totalReviews >= 5, tip: totalReviews < 5 ? `Mai ai nevoie de ${5 - totalReviews} recenzii` : null },
      { criterion: "80%+ răspunsuri", points: 10, earned: responseRate >= 0.8 ? 10 : 0, completed: responseRate >= 0.8, tip: responseRate < 0.8 ? "Răspunde la recenziile clienților" : null },
      { criterion: "10+ abonați", points: 10, earned: subscribers >= 10 ? 10 : 0, completed: subscribers >= 10, tip: subscribers < 10 ? `Mai ai nevoie de ${10 - subscribers} abonați` : null },
    ];

    const totalScore = breakdown.reduce((sum, item) => sum + item.earned, 0);

    res.json({
      score: totalScore,
      max_score: 100,
      breakdown,
    });
  } catch (err) {
    console.error("[BusinessPortal] Score error:", err);
    res.status(500).json({ message: "Eroare la calculul scorului" });
  }
});

module.exports = router;
