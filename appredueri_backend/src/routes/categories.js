const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, COUNT(b.id)::int AS count
       FROM categories c
       LEFT JOIN businesses b ON b.category_id = c.id
       GROUP BY c.id
       ORDER BY c.name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Eroare la /categories:", err);
    res.status(500).json({ message: "Eroare server la categories" });
  }
});

module.exports = router;
