const express = require("express");
const router = express.Router();
const pool = require("../db");
const authenticateToken = require("../middleware/auth");
const { optionalAuth } = require("../middleware/auth");
const { triggerWebhook } = require("../services/n8n");
const { parsePagination, paginatedResponse, sanitizeString } = require("../helpers/validate");
const { reversePoints } = require("../services/gamification");

// ==========================================
// GET /reviews/business/:id - Vezi recenziile unui business
// ==========================================
router.get("/business/:id", optionalAuth, async (req, res) => {
    const { id } = req.params;
    const { page, limit, offset } = parsePagination(req.query);
    const currentUserId = req.user ? req.user.id : null;
    try {
        const [result, countResult] = await Promise.all([
          pool.query(
            `SELECT r.id, r.user_id, r.rating, r.comment, r.created_at,
              u.first_name, u.last_name,
              u.profile_picture_url, u.show_picture_in_reviews,
              rr.response_text, rr.created_at as response_date
             FROM reviews r
             LEFT JOIN users u ON r.user_id = u.id
             LEFT JOIN review_responses rr ON rr.review_id = r.id
             WHERE r.business_id = $1
             ORDER BY r.created_at DESC
             LIMIT $2 OFFSET $3`,
            [id, limit, offset]
          ),
          pool.query(
            "SELECT COUNT(*) as total FROM reviews WHERE business_id = $1",
            [id]
          ),
        ]);
        const total = parseInt(countResult.rows[0].total, 10);
        const reviews = result.rows.map(r => ({
          id: r.id,
          user_id: r.user_id,
          is_own: currentUserId ? r.user_id === currentUserId : false,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          first_name: r.first_name,
          last_name: r.last_name,
          reviewer_profile_picture_url: r.show_picture_in_reviews ? r.profile_picture_url : null,
          reviewer_show_picture: r.show_picture_in_reviews || false,
          response: r.response_text ? {
            text: r.response_text,
            date: r.response_date,
          } : null,
        }));
        res.json(paginatedResponse(reviews, total, page, limit));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Eroare server" });
    }
});

// ==========================================
// POST /reviews - Adaugă o recenzie (Necesită Autentificare)
// ==========================================
// src/routes/reviews.js

router.post("/", authenticateToken, async (req, res) => {
    const { business_id, rating, comment: rawComment } = req.body;
    const user_id = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating invalid (1-5)." });
    }

    if (!business_id) {
        return res.status(400).json({ error: "business_id este necesar." });
    }

    // Sanitize comment — max 2000 caractere
    const comment = sanitizeString(rawComment, 2000) || null;

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

        // Trigger n8n webhook for new review notification to business owner
        if (isNewReview) {
          const bizInfo = await pool.query(
            `SELECT b.name AS business_name, u.email AS owner_email, u.first_name AS owner_first_name
             FROM businesses b
             LEFT JOIN user_businesses ub ON ub.business_id = b.id
             LEFT JOIN users u ON u.id = ub.user_id
             WHERE b.id = $1`,
            [business_id]
          );
          const reviewerInfo = await pool.query(
            "SELECT first_name FROM users WHERE id = $1",
            [user_id]
          );
          const biz = bizInfo.rows[0];
          if (biz && biz.owner_email) {
            // GDPR: no PII (emails, names) in webhook payloads
            triggerWebhook("/webhook/new-review", {
              review_id: reviewId,
              business_id: business_id,
              business_name: biz.business_name,
              rating: rating,
              created_at: new Date().toISOString(),
            });
          }
        }

        // Badge check (fire-and-forget, only for new reviews)
        if (isNewReview) {
          try {
            const { checkAndAwardBadges } = require("../services/badgeService");
            await checkAndAwardBadges(user_id, ['first_review', 'reviewer_bronze', 'reviewer_silver', 'reviewer_gold']);
          } catch (e) { /* badge check should never block */ }
        }

        console.log("=== REVIEW POST END ===");
        console.log("Points earned:", pointsEarned);
        console.log("Is update:", !isNewReview);

        res.json({
            success: true,
            review: reviewRes.rows[0],
            points_earned: pointsEarned,
            is_update: !isNewReview
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("REVIEW ERROR:", err);
        res.status(500).json({ error: "Eroare server la salvarea recenziei." });
    } finally {
        client.release();
    }
});

// ==========================================
// DELETE /reviews/:id - Sterge propria recenzie (Necesita Autentificare)
// ==========================================
router.delete("/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;

    try {
        // Ownership check
        const review = await pool.query(
            "SELECT id, user_id, business_id FROM reviews WHERE id = $1",
            [id]
        );

        if (review.rows.length === 0) {
            return res.status(404).json({ error: "Recenzia nu exista." });
        }

        if (review.rows[0].user_id !== user_id) {
            return res.status(403).json({ error: "Nu poti sterge aceasta recenzie." });
        }

        // Delete review (CASCADE sterge si review_responses)
        await pool.query("DELETE FROM reviews WHERE id = $1", [id]);

        // Reverse gamification points (fire-and-forget)
        reversePoints(user_id, "review").catch(() => {});

        res.status(204).send();
    } catch (err) {
        console.error("REVIEW DELETE ERROR:", err);
        res.status(500).json({ error: "Eroare server la stergerea recenziei." });
    }
});

module.exports = router;