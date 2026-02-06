const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const authenticateToken = require("../middleware/auth");
const { sendWelcomeEmail, sendPasswordResetEmail } = require("../services/email");
const { triggerWebhook } = require("../services/n8n");

// ATENȚIE: în producție pune un JWT_SECRET real în env.
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SALT_ROUNDS = 10;

// Helper pentru a standardiza obiectul User trimis către Frontend
function mapUserResponse(user, points = 0) {
  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    first_name: user.first_name,
    last_name: user.last_name,
    preferred_city_id: user.preferred_city_id,
    preferred_category_ids: user.preferred_category_ids || [],
    points: points || 0,
    role: user.role || 'user', // user, business_owner, admin
  };
}

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email și parola sunt obligatorii" });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ message: "Există deja un cont cu acest email" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 1. Inserăm Userul
    const insertResult = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [email, passwordHash, first_name?.trim(), last_name?.trim()]
    );

    const user = insertResult.rows[0];

    // 2. Inițializăm punctele cu 0 (opțional, dar sănătos pentru consistență)
    // Dacă ai un trigger în DB care face asta, linia asta e redundantă dar nu strică.
    await pool.query(
      `INSERT INTO user_points (user_id, total_points) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
      [user.id]
    );

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });

    // Trimite email de bun venit (async, nu blochează răspunsul)
    sendWelcomeEmail(user.email, user.first_name).catch(err => {
      console.error("[Auth] Failed to send welcome email:", err);
    });

    // 4. Trigger n8n Webhook for Welcome Sequence
    triggerWebhook("/webhook/new-user", {
      user_id: user.id,
      email: user.email,
      first_name: user.first_name,
      created_at: new Date().toISOString(),
    });

    // La register, punctele sunt sigur 0
    return res.status(201).json({
      user: mapUserResponse(user, 0),
      token,
    });
  } catch (err) {
    console.error("Eroare la /auth/register:", err);
    return res.status(500).json({ message: "Eroare server", error: err.message });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email și parolă sunt obligatorii" });
    }

    // 1. Luăm Userul
    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Email sau parolă invalidă" });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Email sau parolă invalidă" });
    }

    // 2. Update last_active_at
    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [user.id]);

    // 3. (FIX) Luăm Punctele explicit la Login
    const pointsRes = await pool.query(
      `SELECT total_points FROM user_points WHERE user_id = $1`,
      [user.id]
    );
    const points = pointsRes.rows[0]?.total_points || 0;

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "30d" });

    return res.json({
      user: mapUserResponse(user, points),
      token,
    });
  } catch (err) {
    console.error("Eroare la /auth/login:", err);
    return res.status(500).json({ message: "Eroare server", error: err.message });
  }
});

// ============================================
// PASSWORD RESET FLOW
// ============================================

// Generează un cod de 6 cifre
function generateResetCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /auth/forgot-password
// Trimite un cod de resetare pe email (în dev, îl afișăm în consolă)
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: "Email-ul este obligatoriu" });
    }

    // Verificăm dacă utilizatorul există
    const userRes = await pool.query("SELECT id, email, first_name FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    
    if (userRes.rowCount === 0) {
      // Nu dezvăluim dacă email-ul există sau nu (securitate)
      return res.json({ 
        message: "Dacă există un cont cu acest email, vei primi instrucțiuni de resetare." 
      });
    }

    const user = userRes.rows[0];

    // Invalidăm toate token-urile vechi pentru acest user
    await pool.query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
      [user.id]
    );

    // Generăm un cod nou
    const resetCode = generateResetCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minute

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, resetCode, expiresAt]
    );

    // Trimite email cu codul de resetare
    const emailResult = await sendPasswordResetEmail(user.email, resetCode, user.first_name);
    
    // În development, afișăm codul și în consolă pentru testare
    if (process.env.NODE_ENV !== 'production') {
      console.log("\n========================================");
      console.log("🔐 PASSWORD RESET CODE (dev mode)");
      console.log("========================================");
      console.log(`Email: ${user.email}`);
      console.log(`Code: ${resetCode}`);
      console.log(`Expires: ${expiresAt.toLocaleString()}`);
      console.log(`Email sent: ${emailResult.success}`);
      console.log("========================================\n");
    }

    return res.json({ 
      message: "Dacă există un cont cu acest email, vei primi instrucțiuni de resetare.",
      // În development, returnăm și codul pentru testare ușoară
      ...(process.env.NODE_ENV !== 'production' && { _devCode: resetCode })
    });

  } catch (err) {
    console.error("Eroare la /auth/forgot-password:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /auth/verify-reset-code
// Verifică dacă codul este valid (fără a-l consuma)
router.post("/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body || {};

    if (!email || !code) {
      return res.status(400).json({ message: "Email și cod sunt obligatorii" });
    }

    const result = await pool.query(
      `SELECT prt.*, u.email 
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

    if (result.rowCount === 0) {
      return res.status(400).json({ message: "Cod invalid sau expirat" });
    }

    return res.json({ valid: true });

  } catch (err) {
    console.error("Eroare la /auth/verify-reset-code:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// POST /auth/reset-password
// Resetează parola folosind codul
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "Toate câmpurile sunt obligatorii" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Parola trebuie să aibă minim 6 caractere" });
    }

    // Verificăm token-ul
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

    // Hash-uim noua parolă
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Actualizăm parola
    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [passwordHash, tokenData.user_id]
    );

    // Marcăm token-ul ca folosit
    await pool.query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1",
      [tokenData.id]
    );

    console.log(`✅ Password reset successful for user ID: ${tokenData.user_id}`);

    return res.json({ message: "Parola a fost schimbată cu succes!" });

  } catch (err) {
    console.error("Eroare la /auth/reset-password:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// ============================================
// CHANGE PASSWORD (autentificat)
// ============================================

// POST /auth/change-password
router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Parola curentă și cea nouă sunt obligatorii" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Parola nouă trebuie să aibă minim 6 caractere" });
    }

    // Verificăm parola curentă
    const userRes = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
    
    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: "Utilizator negăsit" });
    }

    const isValid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    
    if (!isValid) {
      return res.status(401).json({ message: "Parola curentă este incorectă" });
    }

    // Hash-uim și salvăm noua parolă
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [passwordHash, req.user.id]
    );

    console.log(`✅ Password changed for user ID: ${req.user.id}`);

    return res.json({ message: "Parola a fost schimbată cu succes!" });

  } catch (err) {
    console.error("Eroare la /auth/change-password:", err);
    return res.status(500).json({ message: "Eroare server" });
  }
});

// GET /auth/me
router.get("/me", authenticateToken, async (req, res) => {
  try {
    console.log("--- DEBUG /me START ---");
    console.log("User ID din Token:", req.user.id);

    const userRes = await pool.query(
      `SELECT * FROM users WHERE id = $1`,
      [req.user.id]
    );

    const pointsRes = await pool.query(
      `SELECT total_points FROM user_points WHERE user_id = $1`,
      [req.user.id]
    );

    // Update last_active_at
    await pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [req.user.id]);

    const user = userRes.rows[0];
    // Logăm exact ce vine din baza de date pentru puncte
    console.log("Raw DB Points Result:", pointsRes.rows);

    const points = pointsRes.rows[0]?.total_points || 0;
    console.log("Points calculate:", points);

    const responseData = mapUserResponse(user, points);
    console.log("Ce trimitem la Frontend:", responseData);
    console.log("--- DEBUG /me END ---");

    res.json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;