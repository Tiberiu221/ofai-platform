const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");
const { triggerWebhook } = require("../services/n8n");
const { parsePagination, paginatedResponse } = require("../helpers/validate");

// toate rutele de aici necesită JWT
router.use(auth);

// GET /subscriptions – business-urile urmărite de userul curent
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, offset } = parsePagination(req.query);

   const sql = `
  SELECT
    b.id AS business_id,
    b.name,
    b.address,
    b.phone,
    b.website,
    b.lat,
    b.lng,
    c.id   AS city_id,
    c.name AS city_name,
    cat.id   AS category_id,
    cat.name AS category_name,
    COUNT(DISTINCT o.id) AS active_offers_count
  FROM followed_businesses f
  JOIN businesses b ON b.id = f.business_id
  JOIN cities c     ON c.id = b.city_id
  JOIN categories cat ON cat.id = b.category_id
  LEFT JOIN offers o
    ON o.business_id = b.id
   AND o.is_active = TRUE
   AND o.end_date >= CURRENT_DATE
  WHERE f.user_id = $1
  GROUP BY
    b.id,
    b.name,
    b.address,
    b.phone,
    b.website,
    b.lat,
    b.lng,
    c.id,
    c.name,
    cat.id,
    cat.name
  ORDER BY MAX(f.created_at) DESC
  LIMIT $2 OFFSET $3
`;

    const [result, countResult] = await Promise.all([
      pool.query(sql, [userId, limit, offset]),
      pool.query("SELECT COUNT(*) as total FROM followed_businesses WHERE user_id = $1", [userId]),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);

const response = result.rows.map(row => ({
  id: row.business_id,
  name: row.name,
  address: row.address,
  phone: row.phone,
  website: row.website,
  lat: row.lat,
  lng: row.lng,
  city: {
    id: row.city_id,
    name: row.city_name
  },
  category: {
    id: row.category_id,
    name: row.category_name
  },
  active_offers_count: Number(row.active_offers_count) || 0
}));

    res.json(paginatedResponse(response, total, page, limit));
  } catch (err) {
    console.error("Eroare la GET /subscriptions:", err);
    res.status(500).json({ message: "Eroare server la subscriptions" });
  }
});

// POST /subscriptions – urmează un business
router.post("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const { business_id } = req.body;

    if (!business_id) {
      return res.status(400).json({ message: "business_id este necesar" });
    }

    const result = await pool.query(
      `
        INSERT INTO followed_businesses (user_id, business_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, business_id) DO NOTHING
        RETURNING user_id;
      `,
      [userId, parseInt(business_id, 10)]
    );

    // Trigger n8n webhook only for new subscriptions (not duplicates)
    if (result.rowCount > 0) {
      const userInfo = await pool.query("SELECT first_name FROM users WHERE id = $1", [userId]);
      triggerWebhook("/webhook/new-subscriber", {
        user_id: userId,
        user_first_name: userInfo.rows[0]?.first_name || "Un utilizator",
        business_id: parseInt(business_id, 10),
        created_at: new Date().toISOString(),
      });
    }

    res.status(201).json({ message: "Business-ul a fost urmarit" });
  } catch (err) {
    console.error("Eroare la POST /subscriptions:", err);
    res.status(500).json({ message: "Eroare server la subscriptions" });
  }
});

// DELETE /subscriptions/:businessId – nu îl mai urmărește
router.delete("/:businessId", async (req, res) => {
  try {
    const userId = req.user.id;
    const businessId = parseInt(req.params.businessId, 10);

    await pool.query(
      "DELETE FROM followed_businesses WHERE user_id = $1 AND business_id = $2",
      [userId, businessId]
    );

    res.json({ message: "Business-ul nu mai este urmarit" });
  } catch (err) {
    console.error("Eroare la DELETE /subscriptions/:businessId:", err);
    res.status(500).json({ message: "Eroare server la subscriptions delete" });
  }
});

module.exports = router;
