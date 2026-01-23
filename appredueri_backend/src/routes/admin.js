const express = require("express");
const router = express.Router();
const pool = require("../db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const adminAuth = require("../middleware/adminAuth");

// =====================================
//   CONFIG UPLOADS
// =====================================

const uploadsRoot = path.join(__dirname, "..", "uploads");
const businessImagesUploadDir = path.join(uploadsRoot, "businesses");
const offerImagesUploadDir = path.join(uploadsRoot, "offers");

if (!fs.existsSync(businessImagesUploadDir)) {
  fs.mkdirSync(businessImagesUploadDir, { recursive: true });
}
if (!fs.existsSync(offerImagesUploadDir)) {
  fs.mkdirSync(offerImagesUploadDir, { recursive: true });
}

// STORAGE Business (Logo + Galerie)
const businessStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, businessImagesUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const base = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "");
    cb(null, `${Date.now()}-${base}${ext.toLowerCase()}`);
  },
});

const uploadBusinessImage = multer({
  storage: businessStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(new Error("Fișierul trebuie să fie imagine"));
    }
    cb(null, true);
  },
});

// STORAGE Offers (Hero image)
const offerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, offerImagesUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const base = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "");
    cb(null, `${Date.now()}-${base}${ext.toLowerCase()}`);
  },
});

const uploadOfferImage = multer({ storage: offerStorage });

// =====================================
//   ROOT ADMIN
// =====================================
router.get("/", (req, res) => {
  res.redirect("/admin/offers");
});

// =====================================
//   BUSINESS-URI (CRUD + IMAGINI)
// =====================================

// GET /admin/businesses
router.get("/businesses", async (req, res) => {
  const error = req.query.err || "";
  try {
    const result = await pool.query(`
      SELECT
        b.id, b.name, c.id AS city_id, c.name AS city_name,
        cat.id AS category_id, cat.name AS category_name,
        b.address, b.phone, b.website, b.lat, b.lng
      FROM businesses b
      JOIN cities c ON c.id = b.city_id
      JOIN categories cat ON cat.id = b.category_id
      ORDER BY c.name, cat.name, b.name;
    `);
    res.render("admin/businesses-list", { businesses: result.rows, error });
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
    } = req.body;
    await pool.query(
      `INSERT INTO businesses (name, city_id, category_id, address, lat, lng, phone, website)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        name,
        city_id ? parseInt(city_id) : null,
        category_id ? parseInt(category_id) : null,
        address || null,
        lat ? parseFloat(lat) : null,
        lng ? parseFloat(lng) : null,
        phone || null,
        website || null,
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
    ] = await Promise.all([
      pool.query("SELECT * FROM businesses WHERE id = $1", [id]),
      pool.query("SELECT id, name FROM cities ORDER BY name"),
      pool.query("SELECT id, name FROM categories ORDER BY name"),
      pool.query(
        "SELECT id, image_filename, sort_order FROM business_images WHERE business_id = $1 ORDER BY sort_order NULLS LAST, id ASC",
        [id]
      ),
      pool.query(
        `
        SELECT
          bl.id,
          bl.address,
          bl.lat,
          bl.lng,
          bl.phone,
          bl.city_id,
          bl.booking_type,
          bl.booking_phone,
          bl.booking_whatsapp,
          bl.booking_url,
          bl.booking_instructions,
          c.name AS city_name
        FROM business_locations bl
        LEFT JOIN cities c ON c.id = bl.city_id
        WHERE bl.business_id = $1
        ORDER BY bl.id ASC
        `,
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
      error: req.query.err || "",
    });
  } catch (err) {
    console.error("Eroare la GET /admin/businesses/:id/edit:", err);
    res.status(500).send("Eroare server");
  }
});

// UPDATE location (edit inline)
router.post("/businesses/:businessId/locations/:locationId", async (req, res) => {
  const { businessId, locationId } = req.params;
  const { city_id, address, phone, lat, lng } = req.body;

  if (!city_id || !address) {
    return res.status(400).send("city_id și address sunt obligatorii");
  }

  try {
    await pool.query(
      `
      UPDATE business_locations
      SET city_id = $1,
          address = $2,
          phone = $3,
          lat = $4,
          lng = $5
      WHERE id = $6 AND business_id = $7
      `,
      [
        Number(city_id),
        address,
        phone || null,
        lat === "" || lat == null ? null : Number(lat),
        lng === "" || lng == null ? null : Number(lng),
        Number(locationId),
        Number(businessId),
      ]
    );

    return res.redirect(`/admin/businesses/${businessId}/locations`);
  } catch (err) {
    console.error("Update location error:", err);
    return res.status(500).send(`Eroare la update location: ${err.message}`);
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
      locations,
    } = req.body;

    console.log("=== BODY LA EDIT BUSINESS ===");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("=== SFÂRȘIT BODY ===");

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
        website = $8
      WHERE id = $9
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
    console.log("=== UPLOAD LOGO ===");
    console.log("ID:", req.params.id);
    console.log("File:", req.file);
    console.log("Body:", req.body);
    
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).send("ID invalid");
    try {
      if (!req.file) {
        console.log("NO FILE RECEIVED!");
        return res.redirect(`/admin/businesses/${id}/edit?err=no_file`);
      }
      const logoUrl = `/uploads/businesses/${req.file.filename}`;
      console.log("Saving logo URL:", logoUrl);
      await pool.query(`UPDATE businesses SET logo_url = $1 WHERE id = $2`, [
        logoUrl,
        id,
      ]);
      console.log("Logo saved successfully!");
      res.redirect(`/admin/businesses/${id}/edit`);
    } catch (err) {
      console.error("Error saving logo:", err);
      res.status(500).send("Eroare logo");
    }
  }
);

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
      const coverUrl = `/uploads/businesses/${req.file.filename}`;
      await pool.query(`UPDATE businesses SET cover_image_url = $1 WHERE id = $2`, [
        coverUrl,
        id,
      ]);
      res.redirect(`/admin/businesses/${id}/edit`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Eroare cover image");
    }
  }
);

// POST Delete Business
router.post("/businesses/:id/delete", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).send("ID invalid");
  try {
    const offersRes = await pool.query(
      "SELECT COUNT(*) AS cnt FROM offers WHERE business_id = $1",
      [id]
    );
    if (Number(offersRes.rows[0]?.cnt || 0) > 0)
      return res.redirect("/admin/businesses?err=has_offers");

    const imgsRes = await pool.query(
      "SELECT image_filename FROM business_images WHERE business_id = $1",
      [id]
    );
    await pool.query("DELETE FROM business_images WHERE business_id = $1", [
      id,
    ]);
    await pool.query("DELETE FROM businesses WHERE id = $1", [id]);

    imgsRes.rows.forEach((img) => {
      fs.unlink(
        path.join(businessImagesUploadDir, img.image_filename),
        () => { }
      );
    });
    res.redirect("/admin/businesses");
  } catch (err) {
    console.error(err);
    res.status(500).send("Eroare stergere");
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
        if (req.file) fs.unlink(req.file.path, () => { });
        return res.redirect(`/admin/businesses/${id}/edit?err=max_images`);
      }
      if (!req.file)
        return res.redirect(`/admin/businesses/${id}/edit?err=no_file`);

      await pool.query(
        `INSERT INTO business_images (business_id, image_filename, sort_order) VALUES ($1, $2, $3)`,
        [id, req.file.filename, Number(countRes.rows[0].cnt) + 1]
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
      "SELECT business_id, image_filename FROM business_images WHERE id = $1",
      [imageId]
    );
    if (imgRes.rows.length === 0) return res.redirect("/admin/businesses");

    const { business_id, image_filename } = imgRes.rows[0];
    await pool.query("DELETE FROM business_images WHERE id = $1", [imageId]);
    fs.unlink(
      path.join(businessImagesUploadDir, image_filename),
      () => { }
    );
    res.redirect(`/admin/businesses/${business_id}/edit`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Eroare stergere imagine");
  }
});

// =====================================
//   OFERTE – LISTĂ, NEW, EDIT
// =====================================

// GET /admin/offers
router.get("/offers", async (req, res) => {
  try {
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
    const offersQuery = `
      SELECT o.id, o.title, o.is_active, o.discount_type, o.discount_value,
             b.name AS business_name, c.name AS city_name, cat.name AS category_name
      FROM offers o
      JOIN businesses b ON b.id = o.business_id
      JOIN cities c ON c.id = b.city_id
      JOIN categories cat ON cat.id = b.category_id
      ${whereClause} ORDER BY o.id DESC;
    `;

    const [offersResult, citiesResult, categoriesResult, businessesResult] =
      await Promise.all([
        pool.query(offersQuery, values),
        pool.query("SELECT id, name FROM cities ORDER BY name"),
        pool.query("SELECT id, name FROM categories ORDER BY name"),
        pool.query(
          `SELECT b.id, b.name, c.name AS city_name FROM businesses b LEFT JOIN cities c ON c.id = b.city_id ORDER BY c.name, b.name`
        ),
      ]);

    res.render("admin/offers-list", {
      offers: offersResult.rows,
      cities: citiesResult.rows,
      categories: categoriesResult.rows,
      businesses: businessesResult.rows,
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
      LEFT JOIN cities c ON c.id = b.city_id ORDER BY c.name, b.name
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
      let logoUrl = req.file
        ? `/uploads/offers/${req.file.filename}`
        : null;

      await pool.query(
        `INSERT INTO offers (business_id, title, description, discount_type, discount_value, conditions, start_date, end_date, is_active, logo_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
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
      "SELECT *, to_char(start_date, 'YYYY-MM-DD') as start_date_value, to_char(end_date, 'YYYY-MM-DD') as end_date_value FROM offers WHERE id = $1",
      [offerId]
    );

    if (offerResult.rows.length === 0)
      return res.status(404).send("Oferta nu a fost găsită");
    const offer = offerResult.rows[0];

    // 2. Luăm listele necesare
    const businessesRes = await pool.query(
      "SELECT id, name, city_id FROM businesses ORDER BY name"
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

      // 2) dacă user a încărcat imagine nouă, setăm logo_url nou
      const newLogoUrl = req.file ? `/uploads/offers/${req.file.filename}` : null;

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

      // 5) dacă am pus imagine nouă, ștergem fișierul vechi (best-effort)
      if (newLogoUrl && oldLogoUrl) {
        try {
          const filename = path.basename(oldLogoUrl);
          fs.unlink(path.join(offerImagesUploadDir, filename), () => { });
        } catch (_) { }
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
      const filename = path.basename(logoRes.rows[0].logo_url);
      fs.unlink(path.join(offerImagesUploadDir, filename), () => { });
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
router.get("/businesses/:id/locations", adminAuth, async (req, res) => {
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

// POST: Add new location
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


// POST: Delete location
router.post(
  "/businesses/:id/locations/:locId/delete",
  adminAuth,
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

module.exports = router;
