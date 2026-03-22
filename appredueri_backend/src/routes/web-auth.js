/**
 * Web Auth Routes — Login, Register, Google OAuth, Password Reset, Logout
 * Extracted from web.js for maintainability.
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pool = require("../db");
const { signToken, generateRefreshToken } = require("../helpers/jwt");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("../services/email");
const { triggerWebhook } = require("../services/n8n");
const { validatePassword } = require("../helpers/validate");
const { OAuth2Client } = require("google-auth-library");
const { SALT_ROUNDS } = require("./web-shared");

// Auth-specific state (not shared with other sub-routers)
const REFRESH_TOKEN_DAYS = 30;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Helper: create and store a refresh token in DB
 */
async function createWebRefreshToken(userId) {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, refreshToken, expiresAt]
  );
  return refreshToken;
}

/** Cookie options for web auth */
const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000, // 24h
  path: "/",
};
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000, // 30d
  path: "/",
};

// ═══════════════════════════════════════════════════════
// AUTH PAGES
// ═══════════════════════════════════════════════════════
router.get("/login", (req, res) => {
  if (req.webUser) return res.redirect("/cont");
  res.render("public/login", { activePage: null, webUser: null, googleClientId: process.env.GOOGLE_CLIENT_ID || "" });
});

router.get("/register", (req, res) => {
  if (req.webUser) return res.redirect("/cont");
  res.render("public/register", { activePage: null, webUser: null, googleClientId: process.env.GOOGLE_CLIENT_ID || "" });
});

router.get("/forgot-password", (req, res) => {
  res.render("public/forgot-password", { activePage: null, webUser: null });
});

// POST /login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email și parolă sunt obligatorii" });
    }

    const result = await pool.query(
      "SELECT id, email, password_hash, role, first_name, last_name, banned_at FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Email sau parolă invalidă" });
    }

    const user = result.rows[0];

    // Check banned BEFORE password (so banned users get the right message)
    if (user.banned_at) {
      return res.status(403).json({ message: "Contul tău a fost suspendat." });
    }

    // Google OAuth users have no password — must use Google Sign-In
    if (!user.password_hash) {
      return res.status(401).json({ message: "Acest cont folosește Google Sign-In. Te rugăm să te autentifici cu Google." });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Email sau parolă invalidă" });
    }

    await pool.query("UPDATE users SET last_active_at = NOW() WHERE id = $1", [user.id]);

    // Revoke existing refresh tokens to prevent session fixation
    await pool.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
      [user.id]
    );

    const token = signToken({ id: user.id }, "24h");
    const refreshToken = await createWebRefreshToken(user.id);

    res.cookie("ofai_token", token, ACCESS_COOKIE_OPTS);
    res.cookie("ofai_refresh_token", refreshToken, REFRESH_COOKIE_OPTS);

    const returnTo = req.body.returnTo || "/cont";
    const safeRedirect = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/cont";
    return res.json({ success: true, redirect: safeRedirect });
  } catch (err) {
    console.error("[Web] Login error:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /register
router.post("/register", async (req, res) => {
  try {
    const { email, password, first_name, last_name, accept_terms, accept_privacy } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email si parola sunt obligatorii" });
    }

    // Password strength validation
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({ message: pwdCheck.errors[0] });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ message: "Exista deja un cont cu acest email" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = new Date();
    const insertResult = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, privacy_accepted_at, terms_accepted_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [email.toLowerCase().trim(), passwordHash, first_name?.trim(), last_name?.trim(),
       accept_privacy ? now : null, accept_terms ? now : null]
    );
    const user = insertResult.rows[0];

    await pool.query("INSERT INTO user_points (user_id, total_points) VALUES ($1, 0) ON CONFLICT DO NOTHING", [user.id]);

    const token = signToken({ id: user.id });
    const refreshToken = await createWebRefreshToken(user.id);

    res.cookie("ofai_token", token, ACCESS_COOKIE_OPTS);
    res.cookie("ofai_refresh_token", refreshToken, REFRESH_COOKIE_OPTS);

    // Async email + webhook (GDPR: no PII in webhook)
    sendWelcomeEmail(user.email, user.first_name).catch(() => {});
    triggerWebhook("/webhook/new-user", {
      user_id: user.id, created_at: new Date().toISOString(),
    });

    const returnTo = req.body.returnTo || "/cont";
    const safeRedirect = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/cont";
    return res.status(201).json({ success: true, redirect: safeRedirect });
  } catch (err) {
    console.error("[Web] Register error:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /auth/google - Google OAuth Sign-In
router.post("/auth/google", async (req, res, next) => {
  // Skip web handler for mobile clients — let authRouter handle it
  if (req.headers['x-client'] === 'mobile') return next();
  try {
    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ message: "Token Google lipsește" });
    }

    // Verify the Google ID token
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

    // Check if user exists
    const existingUser = await pool.query(
      "SELECT id, email, google_id, profile_picture_url, banned_at FROM users WHERE email = $1",
      [email]
    );

    let user;
    let isNewUser = false;

    if (existingUser.rowCount > 0) {
      // Check if user is banned (matches mobile auth.js pattern)
      if (existingUser.rows[0].banned_at) {
        return res.status(403).json({ message: "Contul tău a fost suspendat." });
      }
      // Existing user - update google_id and profile_picture_url if not set
      user = existingUser.rows[0];
      await pool.query(
        `UPDATE users SET
          google_id = COALESCE(google_id, $1),
          profile_picture_url = $2,
          last_active_at = NOW()
         WHERE id = $3`,
        [googleId, profilePicture, user.id]
      );
    } else {
      // New user - create account
      const now = new Date();
      const insertResult = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, google_id, profile_picture_url, privacy_accepted_at, terms_accepted_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [email, firstName, lastName, googleId, profilePicture, now, now]
      );
      user = insertResult.rows[0];
      isNewUser = true;

      // Create user_points record
      await pool.query("INSERT INTO user_points (user_id, total_points) VALUES ($1, 0) ON CONFLICT DO NOTHING", [user.id]);

      // Async email + webhook
      sendWelcomeEmail(user.email, user.first_name).catch(() => {});
      triggerWebhook("/webhook/new-user", {
        user_id: user.id,
        created_at: new Date().toISOString(),
        source: "google_oauth"
      });
    }

    // Issue JWT tokens
    const token = signToken({ id: user.id }, "24h");
    const refreshToken = await createWebRefreshToken(user.id);

    res.cookie("ofai_token", token, ACCESS_COOKIE_OPTS);
    res.cookie("ofai_refresh_token", refreshToken, REFRESH_COOKIE_OPTS);

    // Redirect to onboarding for new users, account page for existing
    const redirect = isNewUser ? "/onboarding" : "/cont";
    return res.json({ success: true, redirect });
  } catch (err) {
    console.error("[Web] Google OAuth error:", err);
    return res.status(500).json({ message: "Eroare la autentificarea cu Google" });
  }
});

// POST /forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: "Email-ul este obligatoriu" });
    }

    const userRes = await pool.query("SELECT id, email, first_name, google_id, password_hash FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (userRes.rowCount === 0) {
      return res.json({ message: "Dacă există un cont cu acest email, vei primi instrucțiuni de resetare." });
    }

    const user = userRes.rows[0];

    // Block password reset for Google-only accounts (no password set)
    if (user.google_id && !user.password_hash) {
      return res.json({ message: "Dacă există un cont cu acest email, vei primi instrucțiuni de resetare." });
    }

    await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [user.id]);

    const resetCode = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query("INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)", [user.id, resetCode, expiresAt]);

    await sendPasswordResetEmail(user.email, resetCode, user.first_name);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[Web] Reset code for ${user.email}: ${resetCode}`);
    }

    return res.json({ message: "Dacă există un cont cu acest email, vei primi instrucțiuni de resetare." });
  } catch (err) {
    console.error("[Web] Forgot password error:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "Toate câmpurile sunt obligatorii" });
    }
    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) {
      return res.status(400).json({ message: pwdCheck.message });
    }

    const tokenRes = await pool.query(
      `SELECT prt.*, u.id as user_id FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1 AND prt.token = $2 AND prt.used_at IS NULL AND prt.expires_at > NOW()
       ORDER BY prt.created_at DESC LIMIT 1`,
      [email.toLowerCase().trim(), code]
    );

    if (tokenRes.rowCount === 0) {
      return res.status(400).json({ message: "Cod invalid sau expirat" });
    }

    const tokenData = tokenRes.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, tokenData.user_id]);
    await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1", [tokenData.id]);

    return res.json({ message: "Parola a fost schimbată cu succes!" });
  } catch (err) {
    console.error("[Web] Reset password error:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// GET /logout
router.get("/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies?.ofai_refresh_token;
    if (refreshToken) {
      await pool.query(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1 AND revoked_at IS NULL",
        [refreshToken]
      );
    }
  } catch (err) {
    console.error("[Web] Logout revoke error:", err);
  }
  res.clearCookie("ofai_token", { path: "/" });
  res.clearCookie("ofai_refresh_token", { path: "/" });
  res.redirect("/");
});

module.exports = router;
