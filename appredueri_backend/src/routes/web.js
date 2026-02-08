/**
 * Web Routes — Pagini publice OFAI.ro
 * Landing page, Oferte, Categorii, Orașe
 */

const express = require("express");
const router = express.Router();
const pool = require("../db");

// ═══════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════
router.get("/", async (req, res) => {
  try {
    // Stats
    const [bizCount, offerCount, cityCount, recentOffers] = await Promise.all([
      pool.query("SELECT COUNT(*) as total FROM businesses"),
      pool.query("SELECT COUNT(*) as total FROM offers WHERE is_active = true AND end_date >= CURRENT_DATE"),
      pool.query("SELECT COUNT(DISTINCT c.id) as total FROM cities c INNER JOIN businesses b ON b.city_id = c.id"),
      pool.query("SELECT COUNT(*) as total FROM offers WHERE is_active = true AND start_date > CURRENT_DATE - INTERVAL '7 days'"),
    ]);

    // Categories with offer count
    const categories = await pool.query(`
      SELECT c.id, c.name, COUNT(DISTINCT o.id) as offer_count
      FROM categories c
      LEFT JOIN businesses b ON b.category_id = c.id
      LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND o.end_date >= CURRENT_DATE
      GROUP BY c.id, c.name
      ORDER BY offer_count DESC
    `);

    // Featured offers (top 5 — most discount)
    const featuredOffers = await pool.query(`
      SELECT o.id, o.title, o.discount_type, o.discount_value,
             b.name as business_name, b.logo_url as business_logo,
             b.cover_image_url as business_cover,
             ci.name as city_name, cat.name as category_name,
             COALESCE(b.cover_image_url, o.logo_url, b.logo_url) as image_url
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities ci ON b.city_id = ci.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      WHERE o.is_active = true AND o.end_date >= CURRENT_DATE
      ORDER BY o.discount_value DESC
      LIMIT 5
    `);

    // Cities with business count
    const cities = await pool.query(`
      SELECT c.id, c.name, COUNT(b.id) as business_count
      FROM cities c
      LEFT JOIN businesses b ON b.city_id = c.id
      GROUP BY c.id, c.name
      ORDER BY business_count DESC
      LIMIT 15
    `);

    // Featured businesses for marquee (random 20)
    const featuredBusinesses = await pool.query(`
      SELECT id, name, logo_url
      FROM businesses
      WHERE logo_url IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 20
    `);

    const stats = {
      totalBusinesses: parseInt(bizCount.rows[0].total),
      totalOffers: parseInt(offerCount.rows[0].total),
      totalCities: parseInt(cityCount.rows[0].total),
      newOffers: parseInt(recentOffers.rows[0].total) || Math.floor(parseInt(offerCount.rows[0].total) * 0.1),
    };

    res.render("public/home", {
      stats,
      categories: categories.rows,
      featuredOffers: featuredOffers.rows,
      cities: cities.rows,
      featuredBusinesses: featuredBusinesses.rows,
      activePage: "home",
    });
  } catch (err) {
    console.error("[Web] Home page error:", err.message);
    console.error("[Web] Stack:", err.stack);
    res.status(500).send("Eroare: " + err.message);
  }
});

// ═══════════════════════════════════════════════════════
// OFFERS PAGE (with filtering, search, pagination)
// ═══════════════════════════════════════════════════════
router.get("/oferte", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 24;
    const offset = (page - 1) * limit;
    const query = req.query.q || "";
    const selectedCategory = req.query.category || null;
    const selectedCity = req.query.city || null;

    // Build WHERE clause
    const conditions = ["o.is_active = true", "o.end_date >= CURRENT_DATE"];
    const params = [];
    let paramIdx = 1;

    if (query) {
      conditions.push(`(o.title ILIKE $${paramIdx} OR b.name ILIKE $${paramIdx})`);
      params.push(`%${query}%`);
      paramIdx++;
    }

    if (selectedCategory) {
      conditions.push(`b.category_id = $${paramIdx}`);
      params.push(parseInt(selectedCategory));
      paramIdx++;
    }

    if (selectedCity) {
      conditions.push(`b.city_id = $${paramIdx}`);
      params.push(parseInt(selectedCity));
      paramIdx++;
    }

    const whereClause = conditions.join(" AND ");

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM offers o JOIN businesses b ON o.business_id = b.id WHERE ${whereClause}`,
      params
    );
    const totalOffers = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalOffers / limit);

    // Get offers
    const offersResult = await pool.query(
      `SELECT o.id, o.title, o.discount_type, o.discount_value,
              b.name as business_name, b.logo_url as business_logo,
              b.cover_image_url as business_cover,
              ci.name as city_name, cat.name as category_name,
              COALESCE(b.cover_image_url, o.logo_url, b.logo_url) as image_url
       FROM offers o
       JOIN businesses b ON o.business_id = b.id
       LEFT JOIN cities ci ON b.city_id = ci.id
       LEFT JOIN categories cat ON b.category_id = cat.id
       WHERE ${whereClause}
       ORDER BY o.discount_value DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    // Categories for filter
    const categories = await pool.query(`
      SELECT c.id, c.name FROM categories c ORDER BY c.name
    `);

    // Cities for filter
    const cities = await pool.query(`
      SELECT c.id, c.name FROM cities c
      INNER JOIN businesses b ON b.city_id = c.id
      GROUP BY c.id, c.name
      ORDER BY COUNT(b.id) DESC
      LIMIT 15
    `);

    // Total cities count for subtitle
    const totalCitiesResult = await pool.query(
      "SELECT COUNT(DISTINCT c.id) as total FROM cities c INNER JOIN businesses b ON b.city_id = c.id"
    );

    res.render("public/oferte", {
      offers: offersResult.rows,
      categories: categories.rows,
      cities: cities.rows,
      totalOffers,
      totalPages,
      currentPage: page,
      totalCities: parseInt(totalCitiesResult.rows[0].total),
      query,
      selectedCategory,
      selectedCity,
      activePage: "oferte",
    });
  } catch (err) {
    console.error("[Web] Offers page error:", err);
    res.status(500).send("Eroare la încărcarea ofertelor");
  }
});

module.exports = router;
