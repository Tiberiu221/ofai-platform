const express = require('express');
const router = express.Router();
const pool = require('../db');
const cache = require('../services/cache');

// GET /collections — public list of active collections with offer count
router.get('/', async (req, res) => {
  try {
    const rows = await cache.cached('collections:list', 2 * 60 * 60 * 1000, async () => {
      const result = await pool.query(`
        SELECT c.id, c.title, c.description, c.image_url,
               COUNT(co.offer_id) AS offer_count
        FROM collections c
        LEFT JOIN collection_offers co ON co.collection_id = c.id
        LEFT JOIN offers o ON o.id = co.offer_id AND o.is_active = TRUE
        WHERE c.is_active = TRUE
        GROUP BY c.id
        HAVING COUNT(co.offer_id) > 0
        ORDER BY c.sort_order ASC, c.created_at DESC
      `);
      return result.rows;
    }, { groups: ['collections', 'offers'] });

    res.json({ data: rows });
  } catch (err) {
    console.error('[Collections] GET list error:', err.message);
    res.status(500).json({ message: 'Eroare server' });
  }
});

// GET /collections/:id — public collection detail with offers
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'ID invalid' });

    const collResult = await pool.query(
      'SELECT id, title, description, image_url FROM collections WHERE id = $1 AND is_active = TRUE',
      [id]
    );
    if (collResult.rows.length === 0) {
      return res.status(404).json({ message: 'Colecție negăsită' });
    }

    const { rows: offers } = await pool.query(`
      SELECT o.id, o.title, o.description, o.discount_type, o.discount_value, o.discount_text,
             o.start_date, o.end_date, o.flash_expires_at,
             o.logo_url AS offer_logo,
             EXISTS(SELECT 1 FROM promo_codes WHERE offer_id = o.id AND is_active = TRUE) AS has_promo_code,
             b.id AS business_id, b.name AS business_name,
             b.logo_url AS business_logo, b.cover_image_url AS business_cover,
             b.is_verified AS business_verified,
             b.subscription_badge_type AS business_badge_type,
             c.name AS city_name, cat.name AS category_name,
             COALESCE(rev.rating_avg, 0) AS rating_avg,
             COALESCE(rev.rating_count, 0) AS rating_count
      FROM collection_offers co
      JOIN offers o ON o.id = co.offer_id AND o.is_active = TRUE
      JOIN businesses b ON b.id = o.business_id
      LEFT JOIN cities c ON c.id = b.city_id
      LEFT JOIN categories cat ON b.category_id = cat.id
      LEFT JOIN (
        SELECT business_id, AVG(rating) AS rating_avg, COUNT(*) AS rating_count
        FROM reviews GROUP BY business_id
      ) rev ON rev.business_id = b.id
      WHERE co.collection_id = $1
      ORDER BY co.sort_order ASC, o.id DESC
    `, [id]);

    const makeUrl = (p) => p && !p.startsWith('http') ? `${req.protocol}://${req.get('host')}${p}` : p;

    res.json({
      ...collResult.rows[0],
      offers: offers.map(o => ({
        id: o.id,
        title: o.title,
        description: o.description,
        discount_type: o.discount_type,
        discount_value: o.discount_value,
        image_url: makeUrl(o.business_cover || o.offer_logo || o.business_logo),
        start_date: o.start_date,
        end_date: o.end_date,
        flash_expires_at: o.flash_expires_at || null,
        has_promo_code: !!o.has_promo_code,
        business: {
          id: o.business_id,
          name: o.business_name,
          logo_url: makeUrl(o.business_logo),
          cover_image_url: makeUrl(o.business_cover),
          city: o.city_name,
          category: o.category_name,
          rating: parseFloat(parseFloat(o.rating_avg).toFixed(1)),
          rating_count: parseInt(o.rating_count) || 0,
          is_verified: o.business_verified || false,
          badge_type: o.business_badge_type || (o.business_verified ? 'verified' : null),
        },
      })),
    });
  } catch (err) {
    console.error('[Collections] GET detail error:', err.message);
    res.status(500).json({ message: 'Eroare server' });
  }
});

module.exports = router;
