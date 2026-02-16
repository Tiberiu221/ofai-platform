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
 * Attempt to refresh an expired access token using a refresh token cookie.
 * Rotates the refresh token (old revoked, new issued).
 * Returns { userId, token, refreshToken } on success, null on failure.
 */
async function tryRefreshTokens(refreshTokenValue) {
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

    // Revoke old token (rotation)
    await pool.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [row.id]);

    // Issue new tokens
    const newAccessToken = signToken({ id: row.user_id }, "24h");
    const newRefreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [row.user_id, newRefreshToken, expiresAt]
    );

    return { userId: row.user_id, token: newAccessToken, refreshToken: newRefreshToken };
  } catch (err) {
    console.error("[WebAuth] Refresh error:", err);
    return null;
  }
}

/**
 * Fetch user row by id.
 */
async function fetchUser(userId) {
  const { rows } = await pool.query(
    "SELECT id, email, first_name, last_name, role FROM users WHERE id = $1",
    [userId]
  );
  return rows[0] || null;
}

/**
 * Optional Web Auth — reads ofai_token from cookies, attaches req.webUser (or null).
 * Transparently refreshes expired access tokens using the refresh cookie.
 */
async function optionalWebAuth(req, res, next) {
  try {
    let token = req.cookies?.ofai_token;
    // Fallback: Accept Bearer token from mobile clients
    if (!token) {
      const authHeader = req.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }
    if (!token) {
      // No access token — try refresh
      const refreshResult = await tryRefreshTokens(req.cookies?.ofai_refresh_token);
      if (refreshResult) {
        res.cookie("ofai_token", refreshResult.token, ACCESS_COOKIE_OPTS);
        res.cookie("ofai_refresh_token", refreshResult.refreshToken, REFRESH_COOKIE_OPTS);
        req.webUser = await fetchUser(refreshResult.userId);
      } else {
        req.webUser = null;
      }
      return next();
    }

    try {
      const decoded = verifyToken(token);
      req.webUser = await fetchUser(decoded.id);
      return next();
    } catch (verifyErr) {
      // Token expired or invalid — try refresh
      if (verifyErr.name === "TokenExpiredError") {
        const refreshResult = await tryRefreshTokens(req.cookies?.ofai_refresh_token);
        if (refreshResult) {
          res.cookie("ofai_token", refreshResult.token, ACCESS_COOKIE_OPTS);
          res.cookie("ofai_refresh_token", refreshResult.refreshToken, REFRESH_COOKIE_OPTS);
          req.webUser = await fetchUser(refreshResult.userId);
          return next();
        }
      }
      req.webUser = null;
      return next();
    }
  } catch (err) {
    console.error("[WebAuth] optionalWebAuth error:", err);
    req.webUser = null;
    next();
  }
}

/**
 * Required Web Auth — redirects to /login if not authenticated.
 * Transparently refreshes expired access tokens using the refresh cookie.
 */
async function requireWebAuth(req, res, next) {
  const isApi = req.path.startsWith("/api/");

  function deny() {
    res.clearCookie("ofai_token", { path: "/" });
    res.clearCookie("ofai_refresh_token", { path: "/" });
    if (isApi) return res.status(401).json({ message: "Trebuie să fii conectat" });
    return res.redirect("/login");
  }

  try {
    let token = req.cookies?.ofai_token;
    // Fallback: Accept Bearer token from mobile clients
    if (!token) {
      const authHeader = req.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      // No access token — try refresh
      const refreshResult = await tryRefreshTokens(req.cookies?.ofai_refresh_token);
      if (refreshResult) {
        res.cookie("ofai_token", refreshResult.token, ACCESS_COOKIE_OPTS);
        res.cookie("ofai_refresh_token", refreshResult.refreshToken, REFRESH_COOKIE_OPTS);
        const user = await fetchUser(refreshResult.userId);
        if (!user) return deny();
        req.webUser = user;
        return next();
      }
      if (isApi) return res.status(401).json({ message: "Trebuie să fii conectat" });
      return res.redirect("/login");
    }

    try {
      const decoded = verifyToken(token);
      const user = await fetchUser(decoded.id);
      if (!user) return deny();
      req.webUser = user;
      return next();
    } catch (verifyErr) {
      // Token expired — try refresh
      if (verifyErr.name === "TokenExpiredError") {
        const refreshResult = await tryRefreshTokens(req.cookies?.ofai_refresh_token);
        if (refreshResult) {
          res.cookie("ofai_token", refreshResult.token, ACCESS_COOKIE_OPTS);
          res.cookie("ofai_refresh_token", refreshResult.refreshToken, REFRESH_COOKIE_OPTS);
          const user = await fetchUser(refreshResult.userId);
          if (!user) return deny();
          req.webUser = user;
          return next();
        }
      }
      return deny();
    }
  } catch (err) {
    console.error("[WebAuth] requireWebAuth error:", err);
    return deny();
  }
}

module.exports = { optionalWebAuth, requireWebAuth };
