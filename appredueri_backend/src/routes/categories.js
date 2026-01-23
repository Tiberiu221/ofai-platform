const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM categories ORDER BY name"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Eroare la /categories:", err);
    res.status(500).json({ message: "Eroare server la categories" });
  }
});

module.exports = router;
