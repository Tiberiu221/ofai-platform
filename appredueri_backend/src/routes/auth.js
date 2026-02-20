const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pool = require("../db");
const authenticateToken = require("../middleware/auth");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("../services/email");
const { triggerWebhook } = require("../services/n8n");
const { isValidEmail, sanitizeString, validatePassword } = require("../helpers/validate");
const { signToken, generateRefreshToken } = require("../helpers/jwt");

const SALT_ROUNDS = 10;
const REFRESH_TOKEN_DAYS = 30;

// Helper pentru a standardiza obiectul User trimis către Frontend
function mapUserResponse(user, points = 0) {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    first_name: user.first_name,
    last_name: user.last_name,
    preferred_city_ids: user.preferred_city_ids || [],
    preferred_category_ids: user.preferred_category_ids || [],
    points: points || 0,
    role: user.role || 'user',
    profile_picture_url: user.profile_picture_url || null,
    has_password: !!user.password_hash,
  };
}

/**
 * Saves a refresh token to the database
 * @param {number} userId
 * @returns {string} the refresh token
 */
async function createRefreshToken(userId) {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, refreshToken, expiresAt]
  );

  return refreshToken;
}

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { email: rawEmail, password, first_name, last_name, accept_terms, accept_privacy } = req.body || {};

    if (!rawEmail || !password) {
      return res.status(400).json({ message: "Email și parola sunt obligatorii" });
    }

    // Normalize email to prevent duplicate accounts (e.g. "User@Gmail.COM" vs "user@gmail.com")
    const email = rawEmail.trim().toLowerCase();

    // Validare forță parolă
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({ message: pwdCheck.errors[0] });
    }

    // GDPR: consent obligatoriu (dacă trimis de client)
    if (accept_terms === false || accept_privacy === false) {
      return res.status(400).json({ message: "Trebuie să accepți Termenii și Politica de Confidențialitate" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ message: "Există deja un cont cu acest email" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Inserăm Userul cu consent timestamps
    const now = new Date();
    const insertResult = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, privacy_accepted_at, terms_accepted_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [email, passwordHash, first_name?.trim(), last_name?.trim(),
       accept_privacy ? now : null, accept_terms ? now : null]
    );

    const user = insertResult.rows[0];

    // Inițializăm punctele cu 0
    await pool.query(
      `INSERT INTO user_points (user_id, total_points) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
      [user.id]
    );

    // Badge check (fire-and-forget)
    try {
      const { checkAndAwardBadges } = require("../services/badgeService");
      await checkAndAwardBadges(user.id, ['early_adopter']);
    } catch (e) { /* badge check should never block */ }

    const token = signToken({ id: user.id });
    const refreshToken = await createRefreshToken(user.id);

    // Trimite email de bun venit (async, nu blochează răspunsul)
    sendWelcomeEmail(user.email, user.first_name).catch(err => {
      console.error("[Auth] Failed to send welcome email:", err);
    });

    // Trigger n8n Webhook — GDPR: doar user_id, fără PII
    triggerWebhook("/webhook/new-user", {
      user_id: user.id,
      created_at: new Date().toISOString(),
    });

    return res.status(201).json({
      user: mapUserResponse(user, 0),
      token,
      refreshToken,
    });
  } catch (err) {
    console.error("Eroare la /auth/register:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email și parolă sunt obligatorii" });
    }

    const result = await pool.query(
      `SELECT id, email, password_hash, role, first_name, last_name, banned_at, created_at, preferred_city_ids, preferred_category_ids, profile_picture_url
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Email sau parolă invalidă" });
    }

    const user = result.rows[0];

    // Check if user is banned
    if (user.banned_at) {
      return res.status(403).json({ message: "Contul tău a fost suspendat" });
    }

    // Google OAuth users have no password — must use Google Sign-In
    if (!user.password_hash) {
      return res.status(401).json({ message: "Acest cont folosește Google Sign-In. Te rugăm să te autentifici cu Google." });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Email sau parolă invalidă" });
    }

    // Update last_active_at
    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);

    // Luăm Punctele explicit la Login
    const pointsRes = await pool.query(
      `SELECT total_points FROM user_points WHERE user_id = $1`,
      [user.id]
    );
    const points = pointsRes.rows[0]?.total_points || 0;

    const token = signToken({ id: user.id });
    const refreshToken = await createRefreshToken(user.id);

    return res.json({
      user: mapUserResponse(user, points),
      token,
      refreshToken,
    });
  } catch (err) {
    console.error("Eroare la /auth/login:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /auth/refresh — Refresh token rotation
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token este obligatoriu" });
    }

    // Find the refresh token
    const tokenRes = await pool.query(
      `SELECT rt.*, u.id as uid, u.banned_at
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
      [refreshToken]
    );

    if (tokenRes.rowCount === 0) {
      return res.status(401).json({ message: "Refresh token invalid sau expirat" });
    }

    const tokenData = tokenRes.rows[0];

    // Check if user is banned
    if (tokenData.banned_at) {
      await pool.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [tokenData.id]);
      return res.status(403).json({ message: "Contul tău a fost suspendat" });
    }

    // Revoke old refresh token (rotation)
    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1",
      [tokenData.id]
    );

    // Issue new tokens
    const newAccessToken = signToken({ id: tokenData.user_id });
    const newRefreshToken = await createRefreshToken(tokenData.user_id);

    return res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("Eroare la /auth/refresh:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /auth/google — Google OAuth Sign-In (mobile)
router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ message: "Token Google lipsește" });
    }

    const { OAuth2Client } = require("google-auth-library");
    const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(400).json({ message: "Token Google invalid" });
    }

    const email = payload.email.toLowerCase().trim();
    const firstName = payload.given_name?.trim() || "";
    const lastName = payload.family_name?.trim() || "";
    const profilePicture = payload.picture || null;
    const googleId = payload.sub;

    const existingUser = await pool.query(
      "SELECT id, email, google_id, profile_picture_url, banned_at FROM users WHERE email = $1",
      [email]
    );

    let user;
    let isNewUser = false;

    if (existingUser.rowCount > 0) {
      user = existingUser.rows[0];

      if (user.banned_at) {
        return res.status(403).json({ message: "Contul tău a fost suspendat" });
      }

      await pool.query(
        `UPDATE users SET
          google_id = COALESCE(google_id, $1),
          profile_picture_url = $2,
          last_active_at = NOW()
         WHERE id = $3`,
        [googleId, profilePicture, user.id]
      );

      // Re-fetch for full user data
      const fullUser = await pool.query(
        `SELECT id, email, role, first_name, last_name, created_at, preferred_city_ids, preferred_category_ids, profile_picture_url, password_hash
         FROM users WHERE id = $1`,
        [user.id]
      );
      user = fullUser.rows[0];
    } else {
      const now = new Date();
      const insertResult = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, google_id, profile_picture_url, privacy_accepted_at, terms_accepted_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [email, firstName, lastName, googleId, profilePicture, now, now]
      );
      user = insertResult.rows[0];
      isNewUser = true;

      await pool.query("INSERT INTO user_points (user_id, total_points) VALUES ($1, 0) ON CONFLICT DO NOTHING", [user.id]);

      sendWelcomeEmail(user.email, user.first_name).catch(() => {});
      triggerWebhook("/webhook/new-user", {
        user_id: user.id,
        created_at: new Date().toISOString(),
        source: "google_oauth_mobile",
      });
    }

    const pointsRes = await pool.query(
      "SELECT total_points FROM user_points WHERE user_id = $1",
      [user.id]
    );
    const points = pointsRes.rows[0]?.total_points || 0;

    const token = signToken({ id: user.id });
    const refreshToken = await createRefreshToken(user.id);

    return res.json({
      user: mapUserResponse(user, points),
      token,
      refreshToken,
      isNewUser,
    });
  } catch (err) {
    console.error("Eroare la /auth/google:", err);
    return res.status(500).json({ message: "Eroare la autentificarea cu Google" });
  }
});

// POST /auth/logout — Revoke refresh token
router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body || {};

    if (refreshToken) {
      await pool.query(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1",
        [refreshToken]
      );
    }

    return res.json({ message: "Delogat cu succes" });
  } catch (err) {
    console.error("Eroare la /auth/logout:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// ============================================
// PASSWORD RESET FLOW
// ============================================

// Generează un cod de 6 cifre
function generateResetCode() {
  return crypto.randomInt(100000, 999999).toString();
}

// POST /auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: "Email-ul este obligatoriu" });
    }

    const userRes = await pool.query("SELECT id, email, first_name, google_id, password_hash FROM users WHERE email = $1", [email.toLowerCase().trim()]);

    if (userRes.rowCount === 0) {
      return res.json({
        message: "Dacă există un cont cu acest email, vei primi instrucțiuni de resetare."
      });
    }

    const user = userRes.rows[0];

    // Block password reset for Google-only accounts (no password set)
    if (user.google_id && !user.password_hash) {
      return res.json({
        message: "Dacă există un cont cu acest email, vei primi instrucțiuni de resetare."
      });
    }

    // Invalidăm toate token-urile vechi pentru acest user
    await pool.query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
      [user.id]
    );

    const resetCode = generateResetCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minute

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, resetCode, expiresAt]
    );

    const emailResult = await sendPasswordResetEmail(user.email, resetCode, user.first_name);

    if (process.env.NODE_ENV !== 'production') {
      console.log("\n========================================");
      console.log("PASSWORD RESET CODE (dev mode)");
      console.log("========================================");
      console.log(`Email: ${user.email}`);
      console.log(`Code: ${resetCode}`);
      console.log(`Expires: ${expiresAt.toLocaleString()}`);
      console.log(`Email sent: ${emailResult.success}`);
      console.log("========================================\n");
    }

    return res.json({
      message: "Dacă există un cont cu acest email, vei primi instrucțiuni de resetare."
    });

  } catch (err) {
    console.error("Eroare la /auth/forgot-password:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /auth/verify-reset-code
router.post("/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body || {};

    if (!email || !code) {
      return res.status(400).json({ message: "Email și cod sunt obligatorii" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const result = await pool.query(
      `SELECT prt.*, u.email
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1
         AND prt.used_at IS NULL
         AND prt.expires_at > NOW()
         AND prt.attempts < 5
       ORDER BY prt.created_at DESC
       LIMIT 1`,
      [normalizedEmail]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ message: "Cod invalid sau expirat" });
    }

    const token = result.rows[0];

    if (token.token !== code) {
      // Increment failed attempts
      await pool.query("UPDATE password_reset_tokens SET attempts = attempts + 1 WHERE id = $1", [token.id]);
      return res.status(400).json({ message: "Cod invalid sau expirat" });
    }

    return res.json({ valid: true });

  } catch (err) {
    console.error("Eroare la /auth/verify-reset-code:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "Toate câmpurile sunt obligatorii" });
    }

    // Validare forță parolă
    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) {
      return res.status(400).json({ message: pwdCheck.errors[0] });
    }

    const tokenRes = await pool.query(
      `SELECT prt.*, u.id as user_id
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1
         AND prt.token = $2
         AND prt.used_at IS NULL
         AND prt.expires_at > NOW()
       ORDER BY prt.created_at DESC
       LIMIT 1`,
      [email.toLowerCase().trim(), code]
    );

    if (tokenRes.rowCount === 0) {
      return res.status(400).json({ message: "Cod invalid sau expirat" });
    }

    const tokenData = tokenRes.rows[0];

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [passwordHash, tokenData.user_id]
    );

    await pool.query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1",
      [tokenData.id]
    );

    // Revoke all refresh tokens for this user (force re-login)
    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
      [tokenData.user_id]
    );

    console.log(`Password reset successful for user ID: ${tokenData.user_id}`);

    return res.json({ message: "Parola a fost schimbată cu succes!" });

  } catch (err) {
    console.error("Eroare la /auth/reset-password:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// ============================================
// CHANGE PASSWORD (autentificat)
// ============================================

router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Parola curentă și cea nouă sunt obligatorii" });
    }

    // Validare forță parolă
    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) {
      return res.status(400).json({ message: pwdCheck.errors[0] });
    }

    const userRes = await pool.query("SELECT password_hash, google_id FROM users WHERE id = $1", [req.user.id]);

    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: "Utilizator negăsit" });
    }

    // Google OAuth users have no password — cannot change it here
    if (userRes.rows[0].google_id && !userRes.rows[0].password_hash) {
      return res.status(400).json({ message: "Contul tău folosește Google Sign-In. Parola este gestionată de Google." });
    }

    const isValid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);

    if (!isValid) {
      return res.status(401).json({ message: "Parola curentă este incorectă" });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [passwordHash, req.user.id]
    );

    // Revoke all refresh tokens (force re-login on other devices)
    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
      [req.user.id]
    );

    console.log(`Password changed for user ID: ${req.user.id}`);

    return res.json({ message: "Parola a fost schimbată cu succes!" });

  } catch (err) {
    console.error("Eroare la /auth/change-password:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// GET /auth/me
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const userRes = await pool.query(
      `SELECT id, email, role, first_name, last_name, created_at, preferred_city_ids, preferred_category_ids, profile_picture_url, password_hash
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    const pointsRes = await pool.query(
      `SELECT total_points FROM user_points WHERE user_id = $1`,
      [req.user.id]
    );

    // Update last_active_at
    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [req.user.id]);

    const user = userRes.rows[0];
    const points = pointsRes.rows[0]?.total_points || 0;

    res.json(mapUserResponse(user, points));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Eroare server" });
  }
});

module.exports = router;
