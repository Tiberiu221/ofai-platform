const pool = require("../db");
const { verifyToken } = require("../helpers/jwt");

/**
 * Middleware pentru autentificare JWT
 * Adaugă req.user cu id, email, role
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Lipsește token-ul de autentificare" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);

    // Ia detaliile complete ale userului din DB
    const { rows } = await pool.query(
      "SELECT id, email, role, banned_at, last_active_at FROM users WHERE id = $1",
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Utilizator negăsit" });
    }

    if (rows[0].banned_at) {
      return res.status(403).json({ message: "Contul tău a fost suspendat" });
    }

    req.user = rows[0];
    // Fire-and-forget: update login streak (also awards daily login point once per day)
    const { updateStreak } = require("../services/gamification");
    updateStreak(req.user.id).catch(() => {});
    // Throttled last_active_at update (max once per hour)
    const la = req.user.last_active_at;
    if (!la || (Date.now() - new Date(la).getTime()) > 3600000) {
      pool.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [req.user.id]).catch(() => {});
    }
    next();
  } catch (err) {
    console.error("Eroare token:", err);
    return res.status(401).json({ message: "Token invalid sau expirat" });
  }
}

/**
 * Middleware pentru verificarea rolului de admin
 * Trebuie folosit după authenticateToken
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Nu ești autentificat" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Acces interzis. Necesită rol de administrator." });
  }

  next();
}

/**
 * Middleware pentru verificarea rolului de business owner sau admin
 * Trebuie folosit după authenticateToken
 */
function requireBusinessOwner(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Nu ești autentificat" });
  }

  if (req.user.role !== "business_owner" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Acces interzis. Necesită rol de business owner." });
  }

  next();
}

/**
 * Optional JWT middleware — attaches req.user if a valid Bearer token is present,
 * sets req.user = null otherwise (does NOT reject the request).
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyToken(token);
    pool.query("SELECT id, email, role, banned_at, last_active_at FROM users WHERE id = $1", [decoded.id])
      .then(({ rows }) => {
        req.user = (rows.length > 0 && !rows[0].banned_at) ? rows[0] : null;
        if (req.user) {
          const { updateStreak } = require("../services/gamification");
          updateStreak(req.user.id).catch(() => {});
        }
        next();
      })
      .catch((e) => {
        if (e.code && (e.code === 'ECONNREFUSED' || e.code.startsWith('5'))) {
          console.error('[optionalAuth] DB error:', e.message);
        }
        req.user = null;
        next();
      });
  } catch {
    req.user = null;
    next();
  }
}

// Export both as named exports and default for backwards compatibility
module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
module.exports.requireAdmin = requireAdmin;
module.exports.requireBusinessOwner = requireBusinessOwner;
module.exports.optionalAuth = optionalAuth;
