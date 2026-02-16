/**
 * Offer Requests ("Pinch") Routes
 * Users can request offers from businesses that don't have active ones.
 * Rate limited: 1 request per user per business per 7 days.
 */

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { verifyToken } = require("../helpers/jwt");

/**
 * Optional auth middleware — attaches req.user if token present, doesn't block if missing
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return next();

  try {
    const decoded = verifyToken(authHeader.split(" ")[1]);
    req.user = { id: decoded.id };
  } catch (_) {
    // Token invalid — proceed without user
  }
  next();
}

/**
 * POST /offer-requests
 * Submit a request for an offer from a business
 * Rate limit: 1 per user per business per 7 days
 */
router.post("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { business_id } = req.body;

    if (!business_id) {
      return res.status(400).json({ message: "business_id este obligatoriu" });
    }

    // Check business exists
    const { rows: bizCheck } = await pool.query(
      "SELECT id FROM businesses WHERE id = $1",
      [business_id]
    );
    if (bizCheck.length === 0) {
      return res.status(404).json({ message: "Business-ul nu a fost găsit" });
    }

    // Check rate limit: last request from this user for this business
    const { rows: recent } = await pool.query(
      `SELECT created_at FROM offer_requests
       WHERE user_id = $1 AND business_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [userId, business_id]
    );

    if (recent.length > 0) {
      const lastRequest = new Date(recent[0].created_at);
      const cooldownEnd = new Date(lastRequest.getTime() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();

      if (now < cooldownEnd) {
        const daysLeft = Math.ceil((cooldownEnd - now) / (24 * 60 * 60 * 1000));
        return res.status(429).json({
          message: `Poți cere din nou peste ${daysLeft} ${daysLeft === 1 ? "zi" : "zile"}`,
          nextRequestAt: cooldownEnd.toISOString(),
          daysLeft,
        });
      }
    }

    // Insert request
    await pool.query(
      "INSERT INTO offer_requests (user_id, business_id) VALUES ($1, $2)",
      [userId, business_id]
    );

    // Get updated counts
    const { rows: stats } = await pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(DISTINCT user_id) as unique_users
       FROM offer_requests
       WHERE business_id = $1`,
      [business_id]
    );

    console.log(`[Pinch] User ${userId} requested offer from business ${business_id}`);

    res.json({
      success: true,
      message: "Cerere trimisă!",
      total: parseInt(stats[0].total),
      uniqueUsers: parseInt(stats[0].unique_users),
    });
  } catch (err) {
    console.error("[Pinch] Error creating request:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

/**
 * GET /offer-requests/:businessId/count
 * Get offer request stats for a business (public, optional auth for userRequested)
 */
router.get("/:businessId/count", optionalAuth, async (req, res) => {
  try {
    const { businessId } = req.params;

    const { rows: stats } = await pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(DISTINCT user_id) as unique_users
       FROM offer_requests
       WHERE business_id = $1`,
      [businessId]
    );

    let userRequested = false;
    let nextRequestAt = null;

    if (req.user) {
      const { rows: userReq } = await pool.query(
        `SELECT created_at FROM offer_requests
         WHERE user_id = $1 AND business_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [req.user.id, businessId]
      );

      if (userReq.length > 0) {
        const lastRequest = new Date(userReq[0].created_at);
        const cooldownEnd = new Date(lastRequest.getTime() + 7 * 24 * 60 * 60 * 1000);
        userRequested = new Date() < cooldownEnd;
        if (userRequested) {
          nextRequestAt = cooldownEnd.toISOString();
        }
      }
    }

    res.json({
      total: parseInt(stats[0].total),
      uniqueUsers: parseInt(stats[0].unique_users),
      userRequested,
      nextRequestAt,
    });
  } catch (err) {
    console.error("[Pinch] Error getting count:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

/**
 * DELETE /offer-requests/:businessId
 * Cancel most recent request from this user for this business
 */
router.delete("/:businessId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { businessId } = req.params;

    const { rowCount } = await pool.query(
      `DELETE FROM offer_requests
       WHERE id = (
         SELECT id FROM offer_requests
         WHERE user_id = $1 AND business_id = $2
         ORDER BY created_at DESC LIMIT 1
       )`,
      [userId, businessId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Nicio cerere de anulat" });
    }

    res.json({ success: true, message: "Cerere anulată" });
  } catch (err) {
    console.error("[Pinch] Error deleting request:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

module.exports = router;
