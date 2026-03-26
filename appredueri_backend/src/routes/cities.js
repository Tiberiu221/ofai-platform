const express = require("express");
const router = express.Router();
const pool = require("../db");
const cache = require("../services/cache");

router.get("/", async (req, res) => {
  try {
    const cities = await cache.cached("static:cities", 24 * 60 * 60 * 1000, async () => {
      const result = await pool.query("SELECT id, name FROM cities ORDER BY name");
      return result.rows;
    }, { groups: ["static"] });
    res.json(cities);
  } catch (err) {
    console.error("Eroare la /cities:", err);
    res.status(500).json({ message: "Eroare server la cities" });
  }
});

module.exports = router;
