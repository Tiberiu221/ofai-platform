/**
 * Push Tokens Routes
 * Endpoints pentru gestionarea push tokens și trimiterea notificărilor
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const pushService = require('../services/pushNotifications');
const { isAvailable: isFirebaseAvailable } = require('../config/firebase');

// ============================================
// DIAGNOSTIC ENDPOINT
// ============================================

/**
 * GET /push-tokens/health
 * Quick diagnostic to check if Firebase is initialized on this server
 */
router.get('/health', (req, res) => {
  res.json({
    firebaseAvailable: isFirebaseAvailable(),
    envVarSet: !!process.env.FIREBASE_ADMINSDK_JSON,
    envVarLength: process.env.FIREBASE_ADMINSDK_JSON?.length || 0,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// USER ENDPOINTS
// ============================================

/**
 * POST /push-tokens
 * Salvează sau actualizează un push token pentru user
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, platform, deviceName } = req.body;

    // Validare
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Detect token type (Expo or FCM)
    const detectedType = pushService.detectTokenType(token);
    if (!detectedType) {
      return res.status(400).json({ error: 'Invalid push token format (expected Expo or FCM)' });
    }

    const validPlatforms = ['ios', 'android', 'web'];
    const normalizedPlatform = platform?.toLowerCase() || 'android';

    if (!validPlatforms.includes(normalizedPlatform)) {
      return res.status(400).json({ error: 'Invalid platform. Must be ios, android, or web' });
    }

    // Upsert: insert sau update dacă token există deja
    const result = await pool.query(`
      INSERT INTO push_tokens (user_id, token, token_type, platform, device_name, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
      ON CONFLICT (token)
      DO UPDATE SET
        user_id = $1,
        token_type = $3,
        platform = $4,
        device_name = $5,
        is_active = TRUE,
        updated_at = NOW()
      RETURNING id, token, token_type, platform, device_name, created_at
    `, [userId, token, detectedType, normalizedPlatform, deviceName || null]);

    console.log(`[Push] Token saved for user ${userId}: ${detectedType} on ${normalizedPlatform}`);

    res.json({
      success: true,
      message: 'Push token saved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Push] Error saving token:', error);
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

/**
 * DELETE /push-tokens
 * Dezactivează push token-ul curent (la logout)
 */
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    await pool.query(
      'UPDATE push_tokens SET is_active = FALSE, updated_at = NOW() WHERE user_id = $1 AND token = $2',
      [userId, token]
    );

    console.log(`[Push] Token deactivated for user ${userId}`);

    res.json({
      success: true,
      message: 'Push token deactivated',
    });
  } catch (error) {
    console.error('[Push] Error deactivating token:', error);
    res.status(500).json({ error: 'Failed to deactivate push token' });
  }
});

/**
 * GET /push-tokens/my-devices
 * Lista dispozitivelor curente ale userului
 */
router.get('/my-devices', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await pool.query(`
      SELECT id, platform, device_name, is_active, created_at, updated_at
      FROM push_tokens
      WHERE user_id = $1
      ORDER BY updated_at DESC
    `, [userId]);

    res.json({
      success: true,
      devices: rows,
    });
  } catch (error) {
    console.error('[Push] Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * POST /push-tokens/admin/send
 * Trimite notificare (doar admin)
 * Body: { targetType: 'all'|'user'|'subscribers'|'city', targetId?, title, body, data? }
 */
router.post('/admin/send', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { targetType, targetId, title, body, data } = req.body;

    // Validare
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    const validTargetTypes = ['all', 'user', 'subscribers', 'city'];
    if (!targetType || !validTargetTypes.includes(targetType)) {
      return res.status(400).json({ 
        error: 'Invalid targetType. Must be: all, user, subscribers, or city' 
      });
    }

    if (['user', 'subscribers', 'city'].includes(targetType) && !targetId) {
      return res.status(400).json({ error: 'targetId is required for this targetType' });
    }

    const notification = { title, body, data };
    let result;
    let tokensCount = 0;

    // Trimite în funcție de targetType
    switch (targetType) {
      case 'all':
        const { rows: allTokens } = await pool.query(
          'SELECT COUNT(*) FROM push_tokens WHERE is_active = TRUE'
        );
        tokensCount = parseInt(allTokens[0].count);
        result = await pushService.sendToAll(pool, notification);
        break;

      case 'user':
        const { rows: userTokens } = await pool.query(
          'SELECT COUNT(*) FROM push_tokens WHERE user_id = $1 AND is_active = TRUE',
          [targetId]
        );
        tokensCount = parseInt(userTokens[0].count);
        result = await pushService.sendToUser(pool, targetId, notification);
        break;

      case 'subscribers':
        const { rows: subTokens } = await pool.query(`
          SELECT COUNT(DISTINCT pt.token)
          FROM push_tokens pt
          JOIN followed_businesses s ON s.user_id = pt.user_id
          WHERE s.business_id = $1 AND pt.is_active = TRUE
        `, [targetId]);
        tokensCount = parseInt(subTokens[0].count);
        result = await pushService.sendToBusinessSubscribers(pool, targetId, notification);
        break;

      case 'city':
        const { rows: cityTokens } = await pool.query(`
          SELECT COUNT(DISTINCT pt.token) 
          FROM push_tokens pt
          JOIN users u ON u.id = pt.user_id
          WHERE u.city_id = $1 AND pt.is_active = TRUE
        `, [targetId]);
        tokensCount = parseInt(cityTokens[0].count);
        result = await pushService.sendToCity(pool, targetId, notification);
        break;
    }

    // Loghează notificarea
    await pushService.logNotification(pool, {
      title,
      body,
      data,
      sentBy: req.user.id,
      targetType,
      targetId,
      tokensCount,
      successCount: result.sent,
      failureCount: result.failed || 0,
    });

    res.json({
      success: true,
      message: `Notification sent to ${result.sent} devices`,
      details: {
        targetType,
        targetId,
        tokensCount,
        sent: result.sent,
        failed: result.failed || 0,
      },
    });
  } catch (error) {
    console.error('[Push] Admin send error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * GET /push-tokens/admin/stats
 * Statistici push tokens (doar admin)
 */
router.get('/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Total tokens
    const { rows: total } = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active,
        COUNT(*) FILTER (WHERE platform = 'ios') as ios,
        COUNT(*) FILTER (WHERE platform = 'android') as android,
        COUNT(*) FILTER (WHERE platform = 'web') as web
      FROM push_tokens
    `);

    // Useri cu push activ
    const { rows: users } = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as users_with_push
      FROM push_tokens
      WHERE is_active = TRUE
    `);

    // Ultimele 10 notificări trimise
    const { rows: recentNotifications } = await pool.query(`
      SELECT 
        pnl.id, pnl.title, pnl.target_type, pnl.tokens_count, 
        pnl.success_count, pnl.failure_count, pnl.created_at,
        u.email as sent_by_email
      FROM push_notifications_log pnl
      LEFT JOIN users u ON u.id = pnl.sent_by
      ORDER BY pnl.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      stats: {
        tokens: {
          total: parseInt(total[0].total),
          active: parseInt(total[0].active),
          byPlatform: {
            ios: parseInt(total[0].ios),
            android: parseInt(total[0].android),
            web: parseInt(total[0].web),
          },
        },
        usersWithPush: parseInt(users[0].users_with_push),
        recentNotifications,
      },
    });
  } catch (error) {
    console.error('[Push] Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /push-tokens/admin/log
 * Istoric notificări trimise (doar admin)
 */
router.get('/admin/log', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(`
      SELECT 
        pnl.*,
        u.email as sent_by_email
      FROM push_notifications_log pnl
      LEFT JOIN users u ON u.id = pnl.sent_by
      ORDER BY pnl.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const { rows: countResult } = await pool.query(
      'SELECT COUNT(*) FROM push_notifications_log'
    );

    res.json({
      success: true,
      notifications: rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult[0].count),
        totalPages: Math.ceil(parseInt(countResult[0].count) / limit),
      },
    });
  } catch (error) {
    console.error('[Push] Log error:', error);
    res.status(500).json({ error: 'Failed to fetch log' });
  }
});

module.exports = router;
