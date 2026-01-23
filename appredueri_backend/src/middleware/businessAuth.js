const jwt = require("jsonwebtoken");
const pool = require("../db");

/**
 * Middleware pentru autorizare Business Portal
 * 
 * Verifică:
 * 1. User-ul e autentificat (JWT valid)
 * 2. User-ul are acces la business-ul specificat (owner sau admin)
 * 
 * Folosire în routes:
 *   router.get("/my-businesses/:businessId", businessAuth, handler)
 *   router.put("/my-businesses/:businessId", businessAuth, handler)
 */
async function businessAuth(req, res, next) {
  // 1. Verifică token JWT
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Lipsește token-ul de autentificare" });
  }

  const token = authHeader.split(" ")[1];
  const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.error("Eroare token:", err);
    return res.status(401).json({ message: "Token invalid sau expirat" });
  }

  const userId = decoded.id;

  // 2. Obține user-ul cu rol
  try {
    const userResult = await pool.query(
      "SELECT id, email, role FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Utilizator inexistent" });
    }

    const user = userResult.rows[0];
    req.user = user;

    // 3. Dacă e admin, are acces la orice
    if (user.role === "admin") {
      return next();
    }

    // 4. Verifică dacă are acces la business-ul specificat
    const businessId = req.params.businessId || req.params.id;

    if (businessId) {
      const accessResult = await pool.query(
        "SELECT id FROM user_businesses WHERE user_id = $1 AND business_id = $2",
        [userId, parseInt(businessId, 10)]
      );

      if (accessResult.rows.length === 0) {
        return res.status(403).json({ 
          message: "Nu ai permisiunea să accesezi acest business" 
        });
      }
    }

    // 5. Totul OK, continuă
    next();

  } catch (err) {
    console.error("Eroare businessAuth:", err);
    return res.status(500).json({ message: "Eroare server la verificare permisiuni" });
  }
}

/**
 * Middleware doar pentru autentificare (fără verificare business)
 * Util pentru endpoints ca /my-businesses (lista)
 */
async function businessUserAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Lipsește token-ul de autentificare" });
  }

  const token = authHeader.split(" ")[1];
  const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const userResult = await pool.query(
      "SELECT id, email, role FROM users WHERE id = $1",
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Utilizator inexistent" });
    }

    req.user = userResult.rows[0];
    next();

  } catch (err) {
    console.error("Eroare token:", err);
    return res.status(401).json({ message: "Token invalid sau expirat" });
  }
}

module.exports = { businessAuth, businessUserAuth };
