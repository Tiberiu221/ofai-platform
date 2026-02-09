const pool = require("../db");
const { verifyToken } = require("../helpers/jwt");

/**
 * Middleware pentru Business Portal Web Pages
 * Combină cookie auth (webAuth) + verificare ownership (businessAuth)
 *
 * - Verifică ofai_token din cookie
 * - Verifică dacă userul deține business-ul din params
 * - Admin bypass automat
 * - Redirect la /login dacă nu e autentificat
 * - Redirect la /portal cu mesaj dacă nu e owner
 */
async function requireBusinessOwner(req, res, next) {
  try {
    const token = req.cookies?.ofai_token;
    if (!token) {
      return res.redirect("/login");
    }

    const decoded = verifyToken(token);
    const { rows } = await pool.query(
      "SELECT id, email, first_name, last_name, role FROM users WHERE id = $1",
      [decoded.id]
    );

    if (rows.length === 0) {
      res.clearCookie("ofai_token");
      return res.redirect("/login");
    }

    req.webUser = rows[0];

    // Admin bypass
    if (req.webUser.role === "admin") {
      return next();
    }

    // Check business ownership
    const businessId = req.params.businessId;
    if (businessId) {
      const accessResult = await pool.query(
        "SELECT id FROM user_businesses WHERE user_id = $1 AND business_id = $2",
        [req.webUser.id, parseInt(businessId, 10)]
      );

      if (accessResult.rows.length === 0) {
        return res.status(403).render("public/404", {
          activePage: null,
          webUser: req.webUser,
        });
      }
    }

    next();
  } catch (err) {
    res.clearCookie("ofai_token");
    return res.redirect("/login");
  }
}

module.exports = { requireBusinessOwner };
