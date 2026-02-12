const crypto = require("crypto");

const adminUser = process.env.ADMIN_USER;
const adminPassword = process.env.ADMIN_PASSWORD;

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Pads both strings to the same length before comparing.
 */
function timingSafeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const maxLen = Math.max(a.length, b.length);
  const bufA = Buffer.alloc(maxLen, 0);
  const bufB = Buffer.alloc(maxLen, 0);
  bufA.write(a);
  bufB.write(b);
  return crypto.timingSafeEqual(bufA, bufB) && a.length === b.length;
}

function adminAuth(req, res, next) {
  // Headerul de basic auth arata asa: "Basic base64(user:parola)"
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin OFAI"');
    return res.status(401).send("Autentificare necesara pentru admin");
  }

  const base64Credentials = authHeader.slice("Basic ".length).trim();
  let decoded = "";
  try {
    decoded = Buffer.from(base64Credentials, "base64").toString("utf8");
  } catch (err) {
    return res.status(401).send("Credentiale invalide");
  }

  const [user, ...passwordParts] = decoded.split(":");
  const password = passwordParts.join(":"); // Handle passwords with colons

  if (!user || !password) {
    return res.status(401).send("Credentiale invalide");
  }

  if (timingSafeCompare(user, adminUser) && timingSafeCompare(password, adminPassword)) {
    return next();
  }

  return res.status(401).send("Credentiale gresite pentru admin");
}

module.exports = adminAuth;
