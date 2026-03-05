const pool = require("../db");
const { verifyToken, signToken, generateRefreshToken } = require("../helpers/jwt");

const REFRESH_TOKEN_DAYS = 30;

const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000,
  path: "/",
};
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  path: "/",
};

/**
 * Middleware pentru Business Portal Web Pages
 * Combină cookie auth (webAuth) + verificare ownership (businessAuth)
 *
 * - Verifică ofai_token din cookie (with refresh token support)
 * - Verifică dacă userul deține business-ul din params
 * - Admin bypass automat
 * - Redirect la /login dacă nu e autentificat
 * - Redirect la /portal cu mesaj dacă nu e owner
 */
async function requireBusinessOwner(req, res, next) {
  function deny() {
    res.clearCookie("ofai_token", { path: "/" });
    res.clearCookie("ofai_refresh_token", { path: "/" });
    return res.redirect("/login");
  }

  try {
    const token = req.cookies?.ofai_token;
    let userId = null;

    if (token) {
      try {
        const decoded = verifyToken(token);
        userId = decoded.id;
      } catch (verifyErr) {
        // Try refresh on expired token
        if (verifyErr.name === "TokenExpiredError") {
          const refreshResult = await tryRefresh(req.cookies?.ofai_refresh_token);
          if (refreshResult) {
            res.cookie("ofai_token", refreshResult.token, ACCESS_COOKIE_OPTS);
            res.cookie("ofai_refresh_token", refreshResult.refreshToken, REFRESH_COOKIE_OPTS);
            userId = refreshResult.userId;
          }
        }
      }
    } else {
      // No access token — try refresh
      const refreshResult = await tryRefresh(req.cookies?.ofai_refresh_token);
      if (refreshResult) {
        res.cookie("ofai_token", refreshResult.token, ACCESS_COOKIE_OPTS);
        res.cookie("ofai_refresh_token", refreshResult.refreshToken, REFRESH_COOKIE_OPTS);
        userId = refreshResult.userId;
      }
    }

    if (!userId) return deny();

    const { rows } = await pool.query(
      "SELECT id, email, first_name, last_name, role, profile_picture_url FROM users WHERE id = $1",
      [userId]
    );

    if (rows.length === 0) return deny();

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
    } else {
      // C3: Default to denied when businessId is missing from route params
      return res.status(400).json({ error: "Missing business ID" });
    }

    next();
  } catch (err) {
    // W7: Distinguish DB errors from auth errors — don't clear cookies on DB failure
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' ||
        err.code === '57P01' /* admin_shutdown */ || err.code === '57P03' /* cannot_connect_now */ ||
        err.message?.includes('Connection terminated') || err.message?.includes('connection timeout')) {
      console.error('[BusinessWebAuth] DB connection error (not clearing cookies):', err.message);
      return res.status(503).render("public/404", {
        activePage: null,
        webUser: null,
      });
    }
    return deny();
  }
}

/**
 * Try to refresh tokens using a refresh token value.
 */
async function tryRefresh(refreshTokenValue) {
  if (!refreshTokenValue) return null;
  try {
    const tokenRes = await pool.query(
      `SELECT rt.id, rt.user_id, u.banned_at
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
      [refreshTokenValue]
    );
    if (tokenRes.rowCount === 0) return null;
    const row = tokenRes.rows[0];
    if (row.banned_at) {
      await pool.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [row.id]);
      return null;
    }
    await pool.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [row.id]);
    const newAccessToken = signToken({ id: row.user_id }, "24h");
    const newRefreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [row.user_id, newRefreshToken, expiresAt]
    );
    return { userId: row.user_id, token: newAccessToken, refreshToken: newRefreshToken };
  } catch (err) {
    console.error("[BusinessWebAuth] Refresh error:", err);
    return null;
  }
}

module.exports = { requireBusinessOwner };
