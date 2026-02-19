const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const pool = require("../db");
const auth = require("../middleware/auth");

// GET /users/me - detalii user logat: profil + preferinte
router.get("/me", auth, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        email,
        created_at,
        first_name,
        last_name,
        preferred_city_ids,
        preferred_category_ids,
        role,
        profile_picture_url,
        password_hash
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Userul nu a fost gasit" });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      first_name: user.first_name,
      last_name: user.last_name,
      preferred_city_ids: user.preferred_city_ids || [],
      preferred_category_ids: Array.isArray(user.preferred_category_ids)
        ? user.preferred_category_ids.map(Number).filter(Number.isInteger)
        : [],
      role: user.role || 'user',
      profile_picture_url: user.profile_picture_url || null,
      has_password: !!user.password_hash,
    });
  } catch (err) {
    console.error("Eroare la GET /users/me:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// PUT /users/me - actualizeaza first_name / last_name
router.put("/me", auth, async (req, res) => {
  const userId = req.user.id;
  const { first_name, last_name } = req.body || {};

  try {
    const safeFirst =
      typeof first_name === "string" ? first_name.trim().slice(0, 100) : null;
    const safeLast =
      typeof last_name === "string" ? last_name.trim().slice(0, 100) : null;

    const result = await pool.query(
      `
      UPDATE users
      SET
        first_name = $1,
        last_name = $2
      WHERE id = $3
      RETURNING
        id,
        email,
        created_at,
        first_name,
        last_name,
        preferred_city_ids,
        preferred_category_ids
      `,
      [safeFirst, safeLast, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Userul nu a fost gasit" });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      first_name: user.first_name,
      last_name: user.last_name,
      preferred_city_ids: user.preferred_city_ids || [],
      preferred_category_ids: Array.isArray(user.preferred_category_ids)
        ? user.preferred_category_ids.map(Number).filter(Number.isInteger)
        : [],
    });
  } catch (err) {
    console.error("Eroare la PUT /users/me:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// PUT /users/me/preferences - seteaza preferintele userului
router.put("/me/preferences", auth, async (req, res) => {
  const userId = req.user.id;
  let { preferred_city_ids, preferred_category_ids } = req.body;

  try {
    let cityIds = [];
    if (Array.isArray(preferred_city_ids)) {
      cityIds = preferred_city_ids
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v));
    }

    let categoryIds = [];
    if (Array.isArray(preferred_category_ids)) {
      categoryIds = preferred_category_ids
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v));
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        preferred_city_ids = $1,
        preferred_category_ids = $2
      WHERE id = $3
      RETURNING
        id,
        email,
        created_at,
        first_name,
        last_name,
        preferred_city_ids,
        preferred_category_ids
      `,
      [cityIds, categoryIds, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Userul nu a fost gasit" });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      first_name: user.first_name,
      last_name: user.last_name,
      preferred_city_ids: user.preferred_city_ids || [],
      preferred_category_ids: Array.isArray(user.preferred_category_ids)
        ? user.preferred_category_ids.map(Number).filter(Number.isInteger)
        : [],
    });
  } catch (err) {
    console.error("Eroare la PUT /users/me/preferences:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// ============================================
// DATA EXPORT (GDPR Article 20 - Right to Portability)
// ============================================

// GET /users/me/export - export toate datele utilizatorului
router.get("/me/export", auth, async (req, res) => {
  const userId = req.user.id;

  try {
    // Profile
    const profileRes = await pool.query(
      `SELECT id, email, first_name, last_name, created_at, preferred_city_ids, preferred_category_ids,
              privacy_accepted_at, terms_accepted_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (profileRes.rows.length === 0) {
      return res.status(404).json({ message: "Utilizator negasit" });
    }

    const profile = profileRes.rows[0];

    // Reviews
    const reviewsRes = await pool.query(
      `SELECT r.id, r.business_id, b.name as business_name, r.rating, r.comment, r.created_at
       FROM reviews r
       LEFT JOIN businesses b ON b.id = r.business_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    // Favorites
    const favoritesRes = await pool.query(
      `SELECT fo.offer_id, o.title as offer_title, fo.created_at
       FROM favorite_offers fo
       LEFT JOIN offers o ON o.id = fo.offer_id
       WHERE fo.user_id = $1`,
      [userId]
    );

    // Followed businesses
    const followedRes = await pool.query(
      `SELECT fb.business_id, b.name as business_name, fb.created_at
       FROM followed_businesses fb
       LEFT JOIN businesses b ON b.id = fb.business_id
       WHERE fb.user_id = $1`,
      [userId]
    );

    // Points
    const pointsRes = await pool.query(
      `SELECT total_points FROM user_points WHERE user_id = $1`,
      [userId]
    );

    // Business requests
    const requestsRes = await pool.query(
      `SELECT id, business_name, city_id, category_id, status, created_at
       FROM business_requests WHERE user_id = $1`,
      [userId]
    );

    const exportData = {
      exported_at: new Date().toISOString(),
      profile: {
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        created_at: profile.created_at,
        preferred_city_ids: profile.preferred_city_ids || [],
        preferred_category_ids: profile.preferred_category_ids,
        privacy_accepted_at: profile.privacy_accepted_at,
        terms_accepted_at: profile.terms_accepted_at,
      },
      points: {
        total: pointsRes.rows[0]?.total_points || 0,
      },
      reviews: reviewsRes.rows,
      favorites: favoritesRes.rows,
      followed_businesses: followedRes.rows,
      business_requests: requestsRes.rows,
    };

    // Log audit action
    try {
      await pool.query(
        `INSERT INTO audit_log (action, entity_type, entity_id, user_id, ip_address)
         VALUES ('data_export', 'user', $1, $1, $2)`,
        [userId, req.ip]
      );
    } catch (auditErr) {
      // Don't fail the export if audit logging fails (table might not exist yet)
      console.error("[Audit] Failed to log data export:", auditErr.message);
    }

    res.json(exportData);
  } catch (err) {
    console.error("Eroare la GET /users/me/export:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// ============================================
// DELETE ACCOUNT (GDPR - dreptul la stergere)
// ============================================

// DELETE /users/me - sterge complet contul utilizatorului
router.delete("/me", auth, async (req, res) => {
  const userId = req.user.id;
  const { password } = req.body || {};

  // Use a DB client for transaction
  const client = await pool.connect();

  try {
    // Verificam parola pentru confirmare
    if (!password) {
      client.release();
      return res.status(400).json({ message: "Parola este necesara pentru confirmare" });
    }

    const userRes = await client.query("SELECT password_hash FROM users WHERE id = $1", [userId]);

    if (userRes.rowCount === 0) {
      client.release();
      return res.status(404).json({ message: "Utilizator negasit" });
    }

    const isValid = await bcrypt.compare(password, userRes.rows[0].password_hash);

    if (!isValid) {
      client.release();
      return res.status(401).json({ message: "Parola este incorecta" });
    }

    // BEGIN TRANSACTION
    await client.query("BEGIN");

    // 1. Revoke all refresh tokens
    await client.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);

    // 2. Delete password reset tokens
    await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);

    // 3. Delete push tokens
    await client.query("DELETE FROM push_tokens WHERE user_id = $1", [userId]);

    // 4. Delete points
    await client.query("DELETE FROM user_points WHERE user_id = $1", [userId]);

    // 5. Delete favorites
    await client.query("DELETE FROM favorite_offers WHERE user_id = $1", [userId]);

    // 6. Delete followed businesses
    await client.query("DELETE FROM followed_businesses WHERE user_id = $1", [userId]);

    // 7. Anonymize review responses (where user's reviews have responses)
    await client.query(
      `UPDATE review_responses SET review_id = NULL
       WHERE review_id IN (SELECT id FROM reviews WHERE user_id = $1)`,
      [userId]
    );

    // 8. Anonymize reviews (keep content, remove user link)
    await client.query(
      "UPDATE reviews SET user_id = NULL, user_name = 'Utilizator sters' WHERE user_id = $1",
      [userId]
    );

    // 9. Anonymize business requests
    await client.query(
      "UPDATE business_requests SET user_id = NULL WHERE user_id = $1",
      [userId]
    );

    // 10. Remove user-business ownership links
    await client.query("DELETE FROM user_businesses WHERE user_id = $1", [userId]);

    // 11. Log deletion in audit log (before deleting user)
    try {
      await client.query(
        `INSERT INTO audit_log (action, entity_type, entity_id, user_id, ip_address, details)
         VALUES ('account_delete', 'user', $1, $1, $2, '{"source":"user_request"}')`,
        [userId, req.ip]
      );
    } catch (auditErr) {
      // Don't fail deletion if audit logging fails
      console.error("[Audit] Failed to log account deletion:", auditErr.message);
    }

    // 12. Finally, delete the user
    await client.query("DELETE FROM users WHERE id = $1", [userId]);

    // COMMIT
    await client.query("COMMIT");

    // Log without PII
    console.log(`Account deleted: user ID ${userId}`);

    return res.json({
      message: "Contul a fost sters cu succes. Toate datele tale au fost eliminate.",
      deleted: true
    });

  } catch (err) {
    // ROLLBACK on error
    await client.query("ROLLBACK").catch(() => {});
    console.error("Eroare la DELETE /users/me:", err);
    return res.status(500).json({ message: "Eroare la stergerea contului" });
  } finally {
    client.release();
  }
});

module.exports = router;
