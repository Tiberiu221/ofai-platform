const express = require("express");
const router = express.Router();
const pool = require("../db");
const authenticateToken = require("../middleware/auth"); // Asigură-te că calea e corectă
const { invalidateSummary } = require("../services/llm/summarizationService");

// ==========================================
// GET /reviews/business/:id - Vezi recenziile unui business
// ==========================================
router.get("/business/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT r.id, r.rating, r.comment, r.created_at, 
              u.first_name, u.last_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.business_id = $1
       ORDER BY r.created_at DESC`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// ==========================================
// POST /reviews - Adaugă o recenzie (Necesită Autentificare)
// ==========================================
// src/routes/reviews.js

router.post("/", authenticateToken, async (req, res) => {
    const { business_id, rating, comment } = req.body;
    const user_id = req.user.id;

    console.log("=== REVIEW POST START ===");
    console.log("User ID:", user_id);
    console.log("Business ID:", business_id);
    console.log("Rating:", rating);

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating invalid (1-5)." });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Verificăm dacă există deja o recenzie (pentru a ști dacă dăm puncte)
        const existingReview = await client.query(
            "SELECT id FROM reviews WHERE user_id = $1 AND business_id = $2",
            [user_id, business_id]
        );
        const isNewReview = existingReview.rows.length === 0;
        console.log("Is New Review:", isNewReview);
        console.log("Existing reviews found:", existingReview.rows.length);

        // 2. Insert sau Update recenzia
        let reviewRes;
        if (isNewReview) {
            // INSERT nou
            console.log("Inserting NEW review...");
            reviewRes = await client.query(
                `INSERT INTO reviews (user_id, business_id, rating, comment)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, created_at`,
                [user_id, business_id, rating, comment]
            );
        } else {
            // UPDATE existent
            console.log("Updating EXISTING review...");
            reviewRes = await client.query(
                `UPDATE reviews 
                 SET rating = $3, comment = $4, created_at = NOW()
                 WHERE user_id = $1 AND business_id = $2
                 RETURNING id, created_at`,
                [user_id, business_id, rating, comment]
            );
        }
        const reviewId = reviewRes.rows[0].id;
        console.log("Review ID:", reviewId);

        // 3. Dăm puncte DOAR pentru recenzii noi
        const POINTS_REWARD = 10;
        let pointsEarned = 0;

        if (isNewReview) {
            console.log("Giving points for NEW review...");
            
            // Adăugăm în Istoric
            await client.query(
                `INSERT INTO points_history (user_id, points_amount, action_type, metadata)
                 VALUES ($1, $2, 'REVIEW_BONUS', $3)`,
                [user_id, POINTS_REWARD, JSON.stringify({ business_id, review_id: reviewId })]
            );
            console.log("Points history inserted");

            // Actualizăm Totalul Userului
            await client.query(
                `INSERT INTO user_points (user_id, total_points)
                 VALUES ($1, $2)
                 ON CONFLICT (user_id)
                 DO UPDATE SET total_points = user_points.total_points + EXCLUDED.total_points, updated_at = NOW()`,
                [user_id, POINTS_REWARD]
            );
            console.log("User points updated");
            
            pointsEarned = POINTS_REWARD;
        } else {
            console.log("NO points - this is an UPDATE, not a new review");
        }

        await client.query("COMMIT");
        
        console.log("=== REVIEW POST END ===");
        console.log("Points earned:", pointsEarned);
        console.log("Is update:", !isNewReview);

        // Invalidate review summary cache (async, don't wait)
        // This will force regeneration of the summary next time it's requested
        invalidateSummary(business_id).catch(err => {
            console.error(`[Review] Failed to invalidate summary for business ${business_id}:`, err);
        });

        res.json({
            success: true,
            review: reviewRes.rows[0],
            points_earned: pointsEarned,
            is_update: !isNewReview
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("REVIEW ERROR:", err);
        res.status(500).json({ error: "Server Error la salvarea recenziei." });
    } finally {
        client.release();
    }
});

module.exports = router;