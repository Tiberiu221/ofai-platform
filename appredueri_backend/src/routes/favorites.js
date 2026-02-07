const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const { parsePagination, paginatedResponse } = require("../helpers/validate");

// toate rutele de aici necesita autentificare
router.use(auth);

// GET /favorites - lista ofertele favorite ale userului curent
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, offset } = parsePagination(req.query);

    const sql = `
      SELECT
        o.id AS offer_id,
        o.title,
        o.description,
        o.discount_type,
        o.discount_value,
        o.conditions,
        o.start_date,
        o.end_date,
        o.is_active,

        b.id AS business_id,
        b.name AS business_name,
        b.address,
        b.phone,
        b.website,
        b.lat,
        b.lng,

        c.id AS city_id,
        c.name AS city_name,

        cat.id AS category_id,
        cat.name AS category_name
      FROM favorite_offers f
      JOIN offers o ON o.id = f.offer_id
      JOIN businesses b ON b.id = o.business_id
      JOIN cities c ON c.id = b.city_id
      JOIN categories cat ON cat.id = b.category_id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const [result, countResult] = await Promise.all([
      pool.query(sql, [userId, limit, offset]),
      pool.query("SELECT COUNT(*) as total FROM favorite_offers WHERE user_id = $1", [userId]),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

    const favorites = result.rows.map((row) => ({
      id: row.offer_id,
      title: row.title,
      description: row.description,
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      conditions: row.conditions,
      start_date: row.start_date,
      end_date: row.end_date,
      is_active: row.is_active,
      business: {
        id: row.business_id,
        name: row.business_name,
        address: row.address,
        phone: row.phone,
        website: row.website,
        lat: row.lat,
        lng: row.lng
      },
      city: row.city_id
        ? { id: row.city_id, name: row.city_name }
        : null,
      category: row.category_id
        ? { id: row.category_id, name: row.category_name }
        : null
    }));

    res.json(paginatedResponse(favorites, total, page, limit));
  } catch (err) {
    console.error("Eroare la GET /favorites:", err);
    res.status(500).json({ message: "Eroare server la favorite" });
  }
});

// POST /favorites - adauga o oferta la favorite
router.post("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const { offer_id } = req.body;

    if (!offer_id) {
      return res.status(400).json({ message: "offer_id este necesar" });
    }

    await pool.query(
      `
      INSERT INTO favorite_offers (user_id, offer_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, offer_id) DO NOTHING;
    `,
      [userId, parseInt(offer_id, 10)]
    );

    res.status(201).json({ message: "Oferta a fost adaugata la favorite" });
  } catch (err) {
    console.error("Eroare la POST /favorites:", err);
    res.status(500).json({ message: "Eroare server la adaugarea la favorite" });
  }
});

// DELETE /favorites/:offerId - scoate o oferta din favorite
router.delete("/:offerId", async (req, res) => {
  try {
    const userId = req.user.id;
    const offerId = parseInt(req.params.offerId, 10);

    await pool.query(
      "DELETE FROM favorite_offers WHERE user_id = $1 AND offer_id = $2",
      [userId, offerId]
    );

    res.json({ message: "Oferta a fost stearsa din favorite" });
  } catch (err) {
    console.error("Eroare la DELETE /favorites/:offerId:", err);
    res.status(500).json({ message: "Eroare server la stergere favorita" });
  }
});

module.exports = router;
