const express = require("express");
const router = express.Router();
const pool = require("../db");
const cache = require("../services/cache");

router.get("/", async (req, res) => {
  try {
    const categories = await cache.cached("static:categories", 2 * 60 * 60 * 1000, async () => {
      const result = await pool.query(
        `SELECT c.id, c.name, COUNT(b.id)::int AS count
         FROM categories c
         LEFT JOIN businesses b ON b.category_id = c.id
         GROUP BY c.id
         ORDER BY c.name`
      );
      return result.rows;
    }, { groups: ["static"] });
    res.json(categories);
  } catch (err) {
    console.error("Eroare la /categories:", err);
    res.status(500).json({ message: "Eroare server la categories" });
  }
});

module.exports = router;
