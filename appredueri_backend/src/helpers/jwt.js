const jwt = require("jsonwebtoken");

// JWT_SECRET — centralizat, cu protecție pentru producție
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET is not set in production!");
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

/**
 * Semnează un token JWT
 * @param {object} payload - datele de inclus (ex: { id: userId })
 * @param {string} expiresIn - durată expirare (ex: "7d", "30d")
 * @returns {string} token JWT
 */
function signToken(payload, expiresIn = "30d") {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verifică și decodifică un token JWT
 * @param {string} token - tokenul JWT
 * @returns {object} payload decodat
 * @throws {Error} dacă tokenul e invalid sau expirat
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { JWT_SECRET, signToken, verifyToken };
