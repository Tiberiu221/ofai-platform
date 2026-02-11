const pool = require("../db");
const { verifyToken } = require("../helpers/jwt");

/**
 * Optional Web Auth — citește ofai_token din cookies, atașează req.webUser (sau null)
 * Folosit pe paginile publice care pot afișa conținut diferit pentru useri logați
 */
async function optionalWebAuth(req, res, next) {
  try {
    const token = req.cookies?.ofai_token;
    if (!token) {
      req.webUser = null;
      return next();
    }

    const decoded = verifyToken(token);
    const { rows } = await pool.query(
      "SELECT id, email, first_name, last_name, role FROM users WHERE id = $1",
      [decoded.id]
    );

    if (rows.length === 0) {
      req.webUser = null;
      return next();
    }

    req.webUser = rows[0];
    next();
  } catch (err) {
    // Token invalid/expirat — user nelogat
    req.webUser = null;
    next();
  }
}

/**
 * Required Web Auth — redirectează la /login dacă nu e logat
 * Folosit pe paginile protejate (cont, setări, colecție)
 */
async function requireWebAuth(req, res, next) {
  const isApi = req.path.startsWith("/api/");

  try {
    const token = req.cookies?.ofai_token;
    if (!token) {
      if (isApi) return res.status(401).json({ message: "Trebuie să fii conectat" });
      return res.redirect("/login");
    }

    const decoded = verifyToken(token);
    const { rows } = await pool.query(
      "SELECT id, email, first_name, last_name, role FROM users WHERE id = $1",
      [decoded.id]
    );

    if (rows.length === 0) {
      res.clearCookie("ofai_token");
      if (isApi) return res.status(401).json({ message: "Trebuie să fii conectat" });
      return res.redirect("/login");
    }

    req.webUser = rows[0];
    next();
  } catch (err) {
    res.clearCookie("ofai_token");
    if (isApi) return res.status(401).json({ message: "Trebuie să fii conectat" });
    return res.redirect("/login");
  }
}

module.exports = { optionalWebAuth, requireWebAuth };
