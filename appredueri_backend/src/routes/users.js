const express = require("express");
const router = express.Router();

const pool = require("../db");
const auth = require("../middleware/auth");

// GET /users/me - detalii user logat: profil + preferințe
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
        preferred_city_id,
        preferred_category_ids
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Userul nu a fost găsit" });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      first_name: user.first_name,
      last_name: user.last_name,
      preferred_city_id: user.preferred_city_id,
      preferred_category_ids: Array.isArray(user.preferred_category_ids)
        ? user.preferred_category_ids.map(Number).filter(Number.isInteger)
        : [],
    });
  } catch (err) {
    console.error("Eroare la GET /users/me:", err);
    res.status(500).json({
      message: "Eroare server la citirea userului curent",
      error: err.message,
    });
  }
});

// PUT /users/me - actualizează first_name / last_name
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
        preferred_city_id,
        preferred_category_ids
      `,
      [safeFirst, safeLast, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Userul nu a fost găsit" });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      first_name: user.first_name,
      last_name: user.last_name,
      preferred_city_id: user.preferred_city_id,
      preferred_category_ids: Array.isArray(user.preferred_category_ids)
        ? user.preferred_category_ids.map(Number).filter(Number.isInteger)
        : [],
    });
  } catch (err) {
    console.error("Eroare la PUT /users/me:", err);
    res.status(500).json({
      message: "Eroare server la actualizarea profilului",
      error: err.message,
    });
  }
});

// PUT /users/me/preferences - setează preferințele userului
router.put("/me/preferences", auth, async (req, res) => {
  const userId = req.user.id;
  let { preferred_city_id, preferred_category_ids } = req.body;

  try {
    const cityId =
      preferred_city_id === null || preferred_city_id === undefined
        ? null
        : Number(preferred_city_id);

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
        preferred_city_id = $1,
        preferred_category_ids = $2
      WHERE id = $3
      RETURNING 
        id,
        email,
        created_at,
        first_name,
        last_name,
        preferred_city_id,
        preferred_category_ids
      `,
      [cityId, categoryIds, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Userul nu a fost găsit" });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      first_name: user.first_name,
      last_name: user.last_name,
      preferred_city_id: user.preferred_city_id,
      preferred_category_ids: Array.isArray(user.preferred_category_ids)
        ? user.preferred_category_ids.map(Number).filter(Number.isInteger)
        : [],
    });
  } catch (err) {
    console.error("Eroare la PUT /users/me/preferences:", err);
    res.status(500).json({
      message: "Eroare server la actualizarea preferințelor",
      error: err.message,
    });
  }
});

// ============================================
// DELETE ACCOUNT (GDPR - dreptul la ștergere)
// ============================================

// DELETE /users/me - șterge complet contul utilizatorului
router.delete("/me", auth, async (req, res) => {
  const userId = req.user.id;
  const { password } = req.body || {};

  try {
    // Verificăm parola pentru confirmare
    if (!password) {
      return res.status(400).json({ message: "Parola este necesară pentru confirmare" });
    }

    const bcrypt = require("bcrypt");
    const userRes = await pool.query("SELECT password_hash, email FROM users WHERE id = $1", [userId]);
    
    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: "Utilizator negăsit" });
    }

    const isValid = await bcrypt.compare(password, userRes.rows[0].password_hash);
    
    if (!isValid) {
      return res.status(401).json({ message: "Parola este incorectă" });
    }

    const userEmail = userRes.rows[0].email;

    // Începem ștergerea în ordine (pentru a evita constraint errors)
    // Notă: Dacă ai ON DELETE CASCADE pe FK-uri, doar DELETE FROM users e suficient
    
    // 1. Șterge token-uri de resetare parolă
    await pool.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);
    
    // 2. Șterge punctele
    await pool.query("DELETE FROM user_points WHERE user_id = $1", [userId]);
    
    // 3. Șterge favorite (tabelul corect: favorite_offers)
    await pool.query("DELETE FROM favorite_offers WHERE user_id = $1", [userId]);
    
    // 4. Șterge subscriptions (tabelul corect: followed_businesses)
    await pool.query("DELETE FROM followed_businesses WHERE user_id = $1", [userId]);
    
    // 5. Anonimizează review-urile (păstrăm conținutul dar eliminăm legătura cu user-ul)
    // Alternativ: DELETE FROM reviews WHERE user_id = $1
    await pool.query(
      "UPDATE reviews SET user_id = NULL, user_name = 'Utilizator șters' WHERE user_id = $1",
      [userId]
    );
    
    // 6. În final, șterge utilizatorul
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    console.log(`🗑️ Account deleted: ${userEmail} (ID: ${userId})`);

    return res.json({ 
      message: "Contul a fost șters cu succes. Toate datele tale au fost eliminate.",
      deleted: true
    });

  } catch (err) {
    console.error("Eroare la DELETE /users/me:", err);
    return res.status(500).json({ 
      message: "Eroare la ștergerea contului", 
      error: err.message 
    });
  }
});

module.exports = router;
