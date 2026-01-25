const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const { businessAuth, businessUserAuth } = require("../middleware/businessAuth");
const { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } = require("../services/cloudinary");

// =====================================
//   CONFIG UPLOADS (Memory Storage pentru Cloudinary)
// =====================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    console.log("[Multer] File filter - mimetype:", file.mimetype);
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Doar imagini sunt permise"));
    }
    cb(null, true);
  }
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
    res.status(500).json({ message: `Eroare la încărcarea logo-ului: ${err.message}` });
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
      booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions
    } = req.body;

    console.log("[BusinessPortal] Creating offer:", title);

    let logoUrl = null;
    if (req.file) {
      // Upload pe Cloudinary cu rezoluție specifică pentru ofertă (800x600)
      const result = await uploadToCloudinary(req.file.buffer, "offer");
      logoUrl = result.url;
    }

    const result = await pool.query(`
      INSERT INTO offers (
        business_id, title, description, discount_type, discount_value, 
        conditions, start_date, end_date, is_active, logo_url,
        booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `, [
      businessId,
      title,
      description || null,
      discount_type || null,
      discount_value ? Number(discount_value) : null,
      conditions || null,
      start_date || null,
      end_date || null,
      is_active === 'true' || is_active === true,
      logoUrl,
      booking_type || 'inherit',
      booking_phone || null,
      booking_whatsapp || null,
      booking_url || null,
      booking_instructions || null
    ]);

    console.log("[BusinessPortal] Offer created with ID:", result.rows[0].id);
    res.json({ success: true, offer_id: result.rows[0].id });
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
      SELECT * FROM offers WHERE id = $1 AND business_id = $2
    `, [offerId, businessId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Oferta nu există" });
    }

    res.json(result.rows[0]);
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
      booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions
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
      updates.push(`logo_url = ${paramIndex++}`);
      values.push(uploadResult.url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "Nimic de actualizat" });
    }

    values.push(offerId);

    const query = `UPDATE offers SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
    await pool.query(query, values);

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

module.exports = router;
