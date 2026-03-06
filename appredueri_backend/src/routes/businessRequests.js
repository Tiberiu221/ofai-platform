/**
 * Business Requests API Routes
 *
 * User-facing routes for submitting and tracking business requests.
 * Uses cookie-based web auth (same as other web routes).
 */

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireWebAuth } = require("../middleware/webAuth");
const { validateBusinessRequest, sanitizeString, sanitizeDescriptionHtml } = require("../helpers/validate");
const { validateBusinessData } = require("../services/llm/businessValidation");

/**
 * POST /api/business-requests
 * Submit a new business request (auth required)
 */
router.post("/", requireWebAuth, async (req, res) => {
  try {
    const userId = req.webUser.id;

    // Validate input
    const { valid, errors } = validateBusinessRequest(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, errors });
    }

    // Check: max 1 pending request per user
    const { rows: pending } = await pool.query(
      "SELECT id FROM business_requests WHERE user_id = $1 AND status = 'pending' LIMIT 1",
      [userId]
    );
    if (pending.length > 0) {
      return res.status(409).json({
        success: false,
        errors: ["Ai deja o cerere în așteptare. Așteaptă aprobarea înainte de a trimite alta."]
      });
    }

    // Sanitize inputs
    const name = sanitizeString(req.body.name, 200);
    const categoryId = req.body.category_id ? parseInt(req.body.category_id, 10) : null;
    const cityId = parseInt(req.body.city_id, 10);
    const address = sanitizeString(req.body.address, 500) || null;
    const phone = sanitizeString(req.body.phone, 50) || null;
    let website = sanitizeString(req.body.website, 500) || null;
    const description = sanitizeDescriptionHtml(req.body.description) || null;

    // Normalize website URL
    if (website && !website.startsWith("http")) {
      website = `https://${website}`;
    }

    // Get category and city names for AI context
    let categoryName = null;
    let cityName = null;

    if (categoryId) {
      const { rows } = await pool.query("SELECT name FROM categories WHERE id = $1", [categoryId]);
      if (rows.length > 0) categoryName = rows[0].name;
    }
    {
      const { rows } = await pool.query("SELECT name FROM cities WHERE id = $1", [cityId]);
      if (rows.length > 0) cityName = rows[0].name;
    }

    // Run AI validation pipeline
    const validation = await validateBusinessData({
      name, categoryName, cityName, address, phone, website, description,
      category_id: categoryId, city_id: cityId
    });

    // If this is a retry of a rejected request, delete the old one
    const replacesId = req.body.replaces_rejected_id ? parseInt(req.body.replaces_rejected_id, 10) : null;
    if (replacesId) {
      await pool.query(
        "DELETE FROM business_requests WHERE id = $1 AND user_id = $2 AND status = 'rejected'",
        [replacesId, userId]
      );
      console.log(`[BusinessRequests] Deleted old rejected request #${replacesId} (replaced by retry)`);
    }

    // Insert business request
    const { rows: inserted } = await pool.query(
      `INSERT INTO business_requests
        (user_id, name, category_id, city_id, address, phone, website, description,
         ai_score, ai_flags, ai_reasoning)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        userId, name, categoryId, cityId, address, phone, website, description,
        validation.score,
        JSON.stringify(validation.flags),
        validation.reasoning
      ]
    );

    console.log(`[BusinessRequests] New request #${inserted[0].id} from user ${userId}, AI score: ${validation.score}`);

    res.status(201).json({
      success: true,
      request_id: inserted[0].id,
      message: "Cererea ta a fost trimisă cu succes! Vei fi notificat când este procesată."
    });
  } catch (err) {
    console.error("[BusinessRequests] Submit error:", err);
    res.status(500).json({
      success: false,
      errors: ["Eroare la trimiterea cererii. Încearcă din nou."]
    });
  }
});

/**
 * GET /api/business-requests/mine
 * Get current user's business requests (auth required)
 */
router.get("/mine", requireWebAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT br.id, br.name, br.status, br.admin_notes, br.created_at, br.reviewed_at,
              br.category_id, br.city_id, br.address, br.phone, br.website, br.description,
              c.name as city_name, cat.name as category_name
       FROM business_requests br
       LEFT JOIN cities c ON c.id = br.city_id
       LEFT JOIN categories cat ON cat.id = br.category_id
       WHERE br.user_id = $1
       ORDER BY br.created_at DESC`,
      [req.webUser.id]
    );

    res.json({ success: true, requests: rows });
  } catch (err) {
    console.error("[BusinessRequests] Fetch mine error:", err);
    res.status(500).json({ success: false, errors: ["Eroare la încărcarea cererilor."] });
  }
});

/**
 * DELETE /api/business-requests/:id
 * Abandon/cancel a pending or rejected business request
 */
router.delete("/:id", requireWebAuth, async (req, res) => {
  try {
    const userId = req.webUser.id;
    const requestId = parseInt(req.params.id, 10);

    if (isNaN(requestId)) {
      return res.status(400).json({ success: false, errors: ["ID invalid."] });
    }

    // Only allow deleting pending or rejected requests owned by this user
    const result = await pool.query(
      "DELETE FROM business_requests WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'rejected') RETURNING id",
      [requestId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        errors: ["Cererea nu a fost gasita sau nu poate fi stearsa."]
      });
    }

    console.log(`[BusinessRequests] Request #${requestId} abandoned by user ${userId}`);
    res.json({ success: true, message: "Cererea a fost stearsa." });
  } catch (err) {
    console.error("[BusinessRequests] Delete error:", err);
    res.status(500).json({ success: false, errors: ["Eroare la stergerea cererii."] });
  }
});

module.exports = router;
