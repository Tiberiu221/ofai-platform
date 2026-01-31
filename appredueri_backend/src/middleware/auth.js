const jwt = require("jsonwebtoken");
const pool = require("../db");

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
  const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Ia detaliile complete ale userului din DB
    const { rows } = await pool.query(
      "SELECT id, email, role FROM users WHERE id = $1",
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Utilizator negăsit" });
    }

    req.user = rows[0];
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

// Export both as named exports and default for backwards compatibility
module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
module.exports.requireAdmin = requireAdmin;
module.exports.requireBusinessOwner = requireBusinessOwner;
