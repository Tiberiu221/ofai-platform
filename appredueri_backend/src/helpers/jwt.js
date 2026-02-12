const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// JWT_SECRET — centralizat, cu protecție pentru producție
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET is not set in production!");
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

/**
 * Semnează un access token JWT
 * @param {object} payload - datele de inclus (ex: { id: userId })
 * @param {string} expiresIn - durată expirare (default: 24h)
 * @returns {string} token JWT
 */
function signToken(payload, expiresIn = "24h") {
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

/**
 * Generează un refresh token (random hex string)
 * @returns {string} 64-char hex string
 */
function generateRefreshToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = { JWT_SECRET, signToken, verifyToken, generateRefreshToken };
