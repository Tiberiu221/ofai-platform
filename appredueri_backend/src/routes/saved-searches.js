const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /saved-searches — list user's saved searches
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ss.id, ss.label, ss.query, ss.city_id, ss.category_id, ss.created_at,
             c.name AS city_name, cat.name AS category_name
      FROM saved_searches ss
      LEFT JOIN cities c ON c.id = ss.city_id
      LEFT JOIN categories cat ON cat.id = ss.category_id
      WHERE ss.user_id = $1
      ORDER BY ss.created_at DESC
    `, [req.user.id]);

    res.json({ data: rows });
  } catch (err) {
    console.error('[SavedSearches] GET error:', err.message);
    res.status(500).json({ message: 'Eroare server' });
  }
});

// POST /saved-searches — create a new saved search
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { label, query, city_id, category_id } = req.body;

    // Must have at least one filter
    if (!query && !city_id && !category_id) {
      return res.status(400).json({ message: 'Trebuie cel puțin un filtru (text, oraș sau categorie)' });
    }

    // Max 10 per user
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*) AS cnt FROM saved_searches WHERE user_id = $1',
      [req.user.id]
    );
    if (parseInt(countRows[0].cnt, 10) >= 10) {
      return res.status(400).json({ message: 'Maxim 10 căutări salvate' });
    }

    // Get the latest offer ID as baseline for notifications
    const { rows: latestRows } = await pool.query(
      'SELECT COALESCE(MAX(id), 0) AS max_id FROM offers WHERE is_active = TRUE'
    );
    const lastOfferId = latestRows[0].max_id;

    const { rows } = await pool.query(`
      INSERT INTO saved_searches (user_id, label, query, city_id, category_id, last_notified_offer_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, label, query, city_id, category_id, created_at
    `, [req.user.id, label || null, query || null, city_id || null, category_id || null, lastOfferId]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[SavedSearches] POST error:', err.message);
    res.status(500).json({ message: 'Eroare server' });
  }
});

// DELETE /saved-searches/:id — delete a saved search
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'ID invalid' });

    const result = await pool.query(
      'DELETE FROM saved_searches WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Căutare negăsită' });
    }

    res.json({ message: 'Căutare ștearsă' });
  } catch (err) {
    console.error('[SavedSearches] DELETE error:', err.message);
    res.status(500).json({ message: 'Eroare server' });
  }
});

module.exports = router;
