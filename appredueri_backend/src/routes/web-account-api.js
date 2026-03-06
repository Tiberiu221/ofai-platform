/**
 * web-account-api.js
 *
 * Extracted from web.js — contains all user-account-related AJAX API routes
 * served under the web cookie-auth session (req.webUser). Covers:
 *   - Favorites (add / remove)
 *   - Subscriptions / follow-unfollow businesses
 *   - Offer requests ("Pinch")
 *   - Reviews
 *   - Change password
 *   - Delete account
 *   - Preferences
 *   - Profile (name, picture upload/delete)
 *   - Account settings (show_picture_in_reviews, display_badge_id)
 *   - Business Requests sub-router
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const pool = require("../db");
const { requireWebAuth } = require("../middleware/webAuth");
const { sanitizeString, validatePassword } = require("../helpers/validate");
const { deleteUserAccount } = require("../services/accountDeletion");
const { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } = require("../services/cloudinary");
const { portalUpload, SALT_ROUNDS } = require("./web-shared");

// Business Requests sub-router
const businessRequestsRouter = require("./businessRequests");
router.use("/api/business-requests", businessRequestsRouter);


// --- Favorites ---
router.post("/api/web/favorites", requireWebAuth, async (req, res) => {
  try {
    const { offer_id } = req.body;
    if (!offer_id) return res.status(400).json({ message: "offer_id lipsă" });

    await pool.query(
      "INSERT INTO favorite_offers (user_id, offer_id) VALUES ($1, $2) ON CONFLICT (user_id, offer_id) DO NOTHING",
      [req.webUser.id, parseInt(offer_id)]
    );

    // Fire-and-forget: award points + check badges
    const { awardPoints } = require("../services/gamification");
    const { checkAndAwardBadges } = require("../services/badgeService");
    awardPoints(req.webUser.id, "favorite").catch(() => {});
    checkAndAwardBadges(req.webUser.id, ["first_favorite"]).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Add favorite error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

router.delete("/api/web/favorites/:offerId", requireWebAuth, async (req, res) => {
  try {
    const offerId = parseInt(req.params.offerId, 10);
    if (isNaN(offerId)) return res.status(400).json({ message: "ID invalid" });

    await pool.query(
      "DELETE FROM favorite_offers WHERE user_id = $1 AND offer_id = $2",
      [req.webUser.id, offerId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Remove favorite error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// --- Subscriptions (follow/unfollow) ---
router.post("/api/web/subscriptions", requireWebAuth, async (req, res) => {
  try {
    const { business_id } = req.body;
    if (!business_id) return res.status(400).json({ message: "business_id lipsă" });

    await pool.query(
      "INSERT INTO followed_businesses (user_id, business_id) VALUES ($1, $2) ON CONFLICT (user_id, business_id) DO NOTHING",
      [req.webUser.id, parseInt(business_id)]
    );

    // Fire-and-forget: award points + check badges
    const { awardPoints } = require("../services/gamification");
    const { checkAndAwardBadges } = require("../services/badgeService");
    awardPoints(req.webUser.id, "follow").catch(() => {});
    checkAndAwardBadges(req.webUser.id, ["social_butterfly", "loyal_fan"]).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Follow error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

router.delete("/api/web/subscriptions/:businessId", requireWebAuth, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId, 10);
    if (isNaN(businessId)) return res.status(400).json({ message: "ID invalid" });

    await pool.query(
      "DELETE FROM followed_businesses WHERE user_id = $1 AND business_id = $2",
      [req.webUser.id, businessId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Unfollow error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// --- Offer Requests (Pinch) — web cookie auth ---
router.post("/api/web/offer-requests", requireWebAuth, async (req, res) => {
  try {
    const userId = req.webUser.id;
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
          daysLeft,
        });
      }
    }

    // Insert request
    await pool.query(
      "INSERT INTO offer_requests (user_id, business_id) VALUES ($1, $2)",
      [userId, business_id]
    );

    // Auto-follow: add to followed_businesses if not already following
    const { rowCount: followInserted } = await pool.query(
      "INSERT INTO followed_businesses (user_id, business_id) VALUES ($1, $2) ON CONFLICT (user_id, business_id) DO NOTHING",
      [userId, parseInt(business_id)]
    );

    // Get updated counts
    const { rows: stats } = await pool.query(
      `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
       FROM offer_requests WHERE business_id = $1`,
      [business_id]
    );

    console.log(`[Pinch/Web] User ${userId} requested offer from business ${business_id}`);

    res.json({
      success: true,
      message: "Cerere trimisă!",
      total: parseInt(stats[0].total),
      uniqueUsers: parseInt(stats[0].unique_users),
      autoFollowed: followInserted > 0,
    });
  } catch (err) {
    console.error("[Pinch/Web] Error creating request:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

router.get("/api/web/offer-requests/:businessId/count", async (req, res) => {
  try {
    const { businessId } = req.params;

    const { rows: stats } = await pool.query(
      `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
       FROM offer_requests WHERE business_id = $1`,
      [businessId]
    );

    let userRequested = false;
    if (req.webUser) {
      const { rows: userReq } = await pool.query(
        `SELECT created_at FROM offer_requests
         WHERE user_id = $1 AND business_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [req.webUser.id, businessId]
      );
      if (userReq.length > 0) {
        const lastRequest = new Date(userReq[0].created_at);
        const cooldownEnd = new Date(lastRequest.getTime() + 7 * 24 * 60 * 60 * 1000);
        userRequested = new Date() < cooldownEnd;
      }
    }

    res.json({
      total: parseInt(stats[0].total),
      uniqueUsers: parseInt(stats[0].unique_users),
      userRequested,
    });
  } catch (err) {
    console.error("[Pinch/Web] Error getting count:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

router.delete("/api/web/offer-requests/:businessId", requireWebAuth, async (req, res) => {
  try {
    const userId = req.webUser.id;
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
    console.error("[Pinch/Web] Error deleting request:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// --- Reviews ---
router.post("/api/web/reviews", requireWebAuth, async (req, res) => {
  try {
    const { business_id, rating, comment: rawComment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating invalid (1-5)" });
    }
    if (!business_id) {
      return res.status(400).json({ message: "business_id lipsă" });
    }

    const comment = sanitizeString(rawComment, 2000) || null;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingReview = await client.query(
        "SELECT id FROM reviews WHERE user_id = $1 AND business_id = $2",
        [req.webUser.id, business_id]
      );
      const isNewReview = existingReview.rows.length === 0;

      let reviewRes;
      if (isNewReview) {
        reviewRes = await client.query(
          "INSERT INTO reviews (user_id, business_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
          [req.webUser.id, business_id, rating, comment]
        );
      } else {
        reviewRes = await client.query(
          "UPDATE reviews SET rating = $3, comment = $4, created_at = NOW() WHERE user_id = $1 AND business_id = $2 RETURNING id, created_at",
          [req.webUser.id, business_id, rating, comment]
        );
      }

      let pointsEarned = 0;
      if (isNewReview) {
        const POINTS_REWARD = 10;
        await client.query(
          "INSERT INTO points_history (user_id, points_amount, action_type, metadata) VALUES ($1, $2, 'REVIEW_BONUS', $3)",
          [req.webUser.id, POINTS_REWARD, JSON.stringify({ business_id, review_id: reviewRes.rows[0].id })]
        );
        await client.query(
          "INSERT INTO user_points (user_id, total_points) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET total_points = user_points.total_points + EXCLUDED.total_points, updated_at = NOW()",
          [req.webUser.id, POINTS_REWARD]
        );
        pointsEarned = POINTS_REWARD;
      }

      await client.query("COMMIT");

      // Badge check (fire-and-forget, only for new reviews)
      if (isNewReview) {
        try {
          const { checkAndAwardBadges } = require("../services/badgeService");
          console.log("[badge] Web review: checking badges for user", req.webUser.id);
          const awarded = await checkAndAwardBadges(req.webUser.id, ['first_review', 'reviewer_bronze', 'reviewer_silver', 'reviewer_gold']);
          console.log("[badge] Web review: awarded", awarded);
        } catch (e) {
          console.error("[badge] Web review badge error:", e.message);
        }
      }

      res.json({ success: true, review: reviewRes.rows[0], points_earned: pointsEarned, is_update: !isNewReview });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Web API] Review error:", err);
    res.status(500).json({ message: "Eroare la salvarea recenziei" });
  }
});

// --- Change Password ---
router.post("/api/web/change-password", requireWebAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Ambele câmpuri sunt obligatorii" });
    }
    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) {
      return res.status(400).json({ message: pwdCheck.message });
    }

    const userRes = await pool.query("SELECT password_hash, google_id FROM users WHERE id = $1", [req.webUser.id]);
    if (userRes.rows[0].google_id && !userRes.rows[0].password_hash) {
      return res.status(400).json({ message: "Contul tău folosește Google Sign-In. Parola este gestionată de Google." });
    }
    const isValid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Parola curentă este incorectă" });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, req.webUser.id]);

    res.json({ success: true, message: "Parola a fost schimbată cu succes!" });
  } catch (err) {
    console.error("[Web API] Change password error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// --- Delete Account (full cascade, mirrors users.js /me) ---
router.delete("/api/web/delete-account", requireWebAuth, async (req, res) => {
  const userId = req.webUser.id;
  const { password, email_confirm } = req.body || {};

  const client = await pool.connect();

  try {
    const userRes = await client.query("SELECT password_hash, google_id, email FROM users WHERE id = $1", [userId]);
    if (userRes.rowCount === 0) {
      client.release();
      return res.status(404).json({ message: "Utilizator negăsit" });
    }

    const user = userRes.rows[0];

    // Google users: confirm via email match; regular users: confirm via password
    if (user.google_id && !user.password_hash) {
      if (!email_confirm || email_confirm.toLowerCase() !== user.email.toLowerCase()) {
        client.release();
        return res.status(401).json({ message: "Email-ul nu corespunde contului tău" });
      }
    } else {
      if (!password) {
        client.release();
        return res.status(400).json({ message: "Parola este obligatorie" });
      }
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        client.release();
        return res.status(401).json({ message: "Parola este incorectă" });
      }
    }

    await client.query("BEGIN");

    // Use shared deletion service (ensures parity between mobile & web)
    await deleteUserAccount(userId, client, req.ip, "web_request");

    await client.query("COMMIT");

    console.log(`[Web] Account deleted: user ID ${userId}`);

    res.clearCookie("ofai_token", { path: "/" });
    res.clearCookie("ofai_refresh_token", { path: "/" });
    res.json({ success: true, redirect: "/" });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Web API] Delete account error:", err);
    res.status(500).json({ message: "Eroare server" });
  } finally {
    client.release();
  }
});

// --- Update Preferences ---
router.put("/api/web/preferences", requireWebAuth, async (req, res) => {
  try {
    const { preferred_city_ids, preferred_category_ids } = req.body || {};

    let cityIds = [];
    if (Array.isArray(preferred_city_ids)) {
      cityIds = preferred_city_ids.map(v => Number(v)).filter(v => Number.isInteger(v) && v > 0);
    }
    let categoryIds = [];
    if (Array.isArray(preferred_category_ids)) {
      categoryIds = preferred_category_ids.map(v => Number(v)).filter(v => Number.isInteger(v) && v > 0);
    }

    await pool.query(
      "UPDATE users SET preferred_city_ids = $1, preferred_category_ids = $2 WHERE id = $3",
      [cityIds, categoryIds, req.webUser.id]
    );

    res.json({ success: true, message: "Preferințele au fost salvate!" });
  } catch (err) {
    console.error("[Web API] Preferences error:", err);
    res.status(500).json({ success: false, message: "Eroare la salvarea preferințelor" });
  }
});

// --- Update Profile ---
router.put("/api/web/profile", requireWebAuth, async (req, res) => {
  try {
    const { first_name, last_name } = req.body || {};

    // Check 30-day cooldown
    const user = await pool.query("SELECT last_profile_edit FROM users WHERE id = $1", [req.webUser.id]);
    const lastEdit = user.rows[0]?.last_profile_edit;
    if (lastEdit) {
      const daysSince = (Date.now() - new Date(lastEdit).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) {
        const daysLeft = Math.ceil(30 - daysSince);
        return res.status(429).json({ message: `Poți edita profilul din nou în ${daysLeft} zile.` });
      }
    }

    await pool.query(
      "UPDATE users SET first_name = $1, last_name = $2, last_profile_edit = NOW() WHERE id = $3",
      [first_name?.trim() || null, last_name?.trim() || null, req.webUser.id]
    );

    res.json({ success: true, message: "Profilul a fost actualizat!" });
  } catch (err) {
    console.error("[Web API] Profile update error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// --- Update Account Settings (show_picture_in_reviews, display_badge_id) ---
router.put("/api/web/account", requireWebAuth, async (req, res) => {
  try {
    const { show_picture_in_reviews, display_badge_id } = req.body || {};
    const { validateInt } = require("../helpers/validate");

    // Handle display_badge_id: null = clear, integer = set (with ownership check)
    if (display_badge_id !== undefined) {
      if (display_badge_id === null) {
        // Clear badge selection
        await pool.query("UPDATE users SET display_badge_id = NULL WHERE id = $1", [req.webUser.id]);
      } else {
        const badgeId = validateInt(display_badge_id, { min: 1 });
        if (!badgeId) return res.status(400).json({ message: "ID insignă invalid" });

        // Security: verify user owns this badge
        const owned = await pool.query(
          "SELECT 1 FROM user_badges ub JOIN badge_definitions bd ON bd.id = ub.badge_id WHERE ub.user_id = $1 AND bd.id = $2",
          [req.webUser.id, badgeId]
        );
        if (owned.rows.length === 0) {
          return res.status(403).json({ message: "Nu ai obținut această insignă" });
        }

        await pool.query("UPDATE users SET display_badge_id = $1 WHERE id = $2", [badgeId, req.webUser.id]);
      }
      return res.json({ success: true, message: "Insigna a fost actualizată!" });
    }

    await pool.query(
      "UPDATE users SET show_picture_in_reviews = $1 WHERE id = $2",
      [show_picture_in_reviews !== false, req.webUser.id]
    );

    res.json({ success: true, message: "Setările au fost salvate!" });
  } catch (err) {
    console.error("[Web API] Account settings update error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// --- Profile Picture Upload ---
router.post("/api/web/account/profile-picture", requireWebAuth, portalUpload.single("profile_picture"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Niciun fișier" });

    // Delete old Cloudinary picture if present
    const oldRes = await pool.query("SELECT profile_picture_url FROM users WHERE id = $1", [req.webUser.id]);
    const oldUrl = oldRes.rows[0]?.profile_picture_url;
    if (oldUrl && oldUrl.includes("cloudinary.com")) {
      const oldId = getPublicIdFromUrl(oldUrl);
      if (oldId) await deleteFromCloudinary(oldId).catch(() => {});
    }

    const result = await uploadToCloudinary(req.file.buffer, "profile");
    await pool.query("UPDATE users SET profile_picture_url = $1 WHERE id = $2", [result.url, req.webUser.id]);

    res.json({ success: true, profile_picture_url: result.url });
  } catch (err) {
    console.error("[Web API] Profile picture upload error:", err);
    res.status(500).json({ message: "Eroare la upload" });
  }
});

// --- Profile Picture Delete ---
router.delete("/api/web/account/profile-picture", requireWebAuth, async (req, res) => {
  try {
    const oldRes = await pool.query("SELECT profile_picture_url FROM users WHERE id = $1", [req.webUser.id]);
    const oldUrl = oldRes.rows[0]?.profile_picture_url;

    if (oldUrl && oldUrl.includes("cloudinary.com")) {
      const oldId = getPublicIdFromUrl(oldUrl);
      if (oldId) await deleteFromCloudinary(oldId).catch(() => {});
    }

    await pool.query("UPDATE users SET profile_picture_url = NULL WHERE id = $1", [req.webUser.id]);

    res.json({ success: true });
  } catch (err) {
    console.error("[Web API] Profile picture delete error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

module.exports = router;
