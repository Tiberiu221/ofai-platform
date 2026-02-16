/**
 * Push Notifications Service
 * Supports both Expo Push API and Firebase Cloud Messaging (FCM).
 *
 * Token routing is automatic: Expo tokens go to Expo API, FCM tokens go to Firebase.
 */

const { isAvailable: isFirebaseAvailable, getMessaging } = require("../config/firebase");

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Validate an Expo Push Token
 * Format: ExponentPushToken[xxx] or ExpoPushToken[xxx]
 */
function isValidExpoPushToken(token) {
  return typeof token === 'string' &&
    (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
}

/**
 * Validate an FCM token (long base64-ish string, typically 100-200+ chars)
 */
function isValidFcmToken(token) {
  return typeof token === 'string' && token.length >= 100 && !token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[');
}

/**
 * Detect token type. Returns 'expo', 'fcm', or null.
 */
function detectTokenType(token) {
  if (isValidExpoPushToken(token)) return 'expo';
  if (isValidFcmToken(token)) return 'fcm';
  return null;
}

/**
 * Send notifications via Expo Push API
 */
async function sendExpoNotifications(messages) {
  if (!messages || messages.length === 0) {
    return { success: true, sent: 0, failed: 0, invalidTokens: [] };
  }

  const chunks = chunkArray(messages, 100);
  let totalSuccess = 0;
  let totalFailure = 0;
  const invalidTokens = [];

  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();

      if (result.data) {
        result.data.forEach((item, index) => {
          if (item.status === 'ok') {
            totalSuccess++;
          } else {
            totalFailure++;
            if (item.details?.error === 'DeviceNotRegistered') {
              invalidTokens.push(chunk[index]?.to);
            }
            console.error(`[Push/Expo] Failed for token ${chunk[index]?.to}:`, item.message);
          }
        });
      }
    } catch (error) {
      console.error('[Push/Expo] Error sending chunk:', error);
      totalFailure += chunk.length;
    }
  }

  return { success: totalFailure === 0, sent: totalSuccess, failed: totalFailure, invalidTokens };
}

/**
 * Send notifications via Firebase Cloud Messaging
 */
async function sendFcmNotifications(messages) {
  if (!messages || messages.length === 0) {
    return { success: true, sent: 0, failed: 0, invalidTokens: [] };
  }

  const messaging = getMessaging();
  if (!messaging) {
    console.warn('[Push/FCM] Firebase not initialized — skipping FCM send');
    return { success: false, sent: 0, failed: messages.length, invalidTokens: [] };
  }

  let totalSuccess = 0;
  let totalFailure = 0;
  const invalidTokens = [];

  for (const msg of messages) {
    try {
      await messaging.send({
        token: msg.to,
        notification: {
          title: msg.title,
          body: msg.body,
        },
        data: msg.data ? Object.fromEntries(
          Object.entries(msg.data).map(([k, v]) => [k, String(v)])
        ) : {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
      });
      totalSuccess++;
    } catch (error) {
      totalFailure++;
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        invalidTokens.push(msg.to);
      }
      console.error(`[Push/FCM] Failed for token ${msg.to?.substring(0, 30)}...:`, error.code || error.message);
    }
  }

  return { success: totalFailure === 0, sent: totalSuccess, failed: totalFailure, invalidTokens };
}

/**
 * Send push notifications — automatically routes Expo vs FCM tokens
 * @param {Array} messages - Array of { to, title, body, data }
 */
async function sendPushNotifications(messages) {
  if (!messages || messages.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const expoMessages = [];
  const fcmMessages = [];

  for (const msg of messages) {
    const type = detectTokenType(msg.to);
    if (type === 'expo') {
      expoMessages.push(msg);
    } else if (type === 'fcm') {
      fcmMessages.push(msg);
    } else {
      console.warn('[Push] Unknown token format:', msg.to?.substring(0, 30));
    }
  }

  let totalSent = 0;
  let totalFailed = 0;
  const allInvalidTokens = [];

  if (expoMessages.length > 0) {
    const expoResult = await sendExpoNotifications(expoMessages);
    totalSent += expoResult.sent;
    totalFailed += expoResult.failed;
    allInvalidTokens.push(...expoResult.invalidTokens);
  }

  if (fcmMessages.length > 0) {
    const fcmResult = await sendFcmNotifications(fcmMessages);
    totalSent += fcmResult.sent;
    totalFailed += fcmResult.failed;
    allInvalidTokens.push(...fcmResult.invalidTokens);
  }

  console.log(`[Push] Sent: ${totalSent} success, ${totalFailed} failed (expo: ${expoMessages.length}, fcm: ${fcmMessages.length})`);

  return {
    success: totalFailed === 0,
    sent: totalSent,
    failed: totalFailed,
    invalidTokens: allInvalidTokens,
  };
}

/**
 * Send notification to a single user
 */
async function sendToUser(db, userId, notification) {
  const { rows: tokens } = await db.query(
    'SELECT token FROM push_tokens WHERE user_id = $1 AND is_active = TRUE',
    [userId]
  );

  if (tokens.length === 0) {
    console.log(`[Push] No active tokens for user ${userId}`);
    return { success: true, sent: 0 };
  }

  const messages = tokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
  }));

  const result = await sendPushNotifications(messages);

  if (result.invalidTokens.length > 0) {
    await deactivateInvalidTokens(db, result.invalidTokens);
  }

  return result;
}

/**
 * Send notification to all subscribers of a business
 */
async function sendToBusinessSubscribers(db, businessId, notification) {
  const { rows: tokens } = await db.query(`
    SELECT DISTINCT pt.token
    FROM push_tokens pt
    JOIN subscriptions s ON s.user_id = pt.user_id
    WHERE s.business_id = $1
      AND pt.is_active = TRUE
  `, [businessId]);

  if (tokens.length === 0) {
    console.log(`[Push] No subscribers with tokens for business ${businessId}`);
    return { success: true, sent: 0 };
  }

  const messages = tokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: { ...notification.data, businessId: String(businessId) },
  }));

  const result = await sendPushNotifications(messages);

  if (result.invalidTokens.length > 0) {
    await deactivateInvalidTokens(db, result.invalidTokens);
  }

  return result;
}

/**
 * Send notification to all users (broadcast)
 */
async function sendToAll(db, notification) {
  const { rows: tokens } = await db.query(
    'SELECT token FROM push_tokens WHERE is_active = TRUE'
  );

  if (tokens.length === 0) {
    console.log('[Push] No active tokens for broadcast');
    return { success: true, sent: 0 };
  }

  const messages = tokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
  }));

  const result = await sendPushNotifications(messages);

  if (result.invalidTokens.length > 0) {
    await deactivateInvalidTokens(db, result.invalidTokens);
  }

  return result;
}

/**
 * Send notification to users in a specific city
 */
async function sendToCity(db, cityId, notification) {
  const { rows: tokens } = await db.query(`
    SELECT DISTINCT pt.token
    FROM push_tokens pt
    JOIN users u ON u.id = pt.user_id
    WHERE u.city_id = $1
      AND pt.is_active = TRUE
  `, [cityId]);

  if (tokens.length === 0) {
    console.log(`[Push] No active tokens for city ${cityId}`);
    return { success: true, sent: 0 };
  }

  const messages = tokens.map(t => ({
    to: t.token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: { ...notification.data, cityId: String(cityId) },
  }));

  const result = await sendPushNotifications(messages);

  if (result.invalidTokens.length > 0) {
    await deactivateInvalidTokens(db, result.invalidTokens);
  }

  return result;
}

/**
 * Log notification to database
 */
async function logNotification(db, logData) {
  try {
    await db.query(`
      INSERT INTO push_notifications_log
        (title, body, data, sent_by, target_type, target_id, tokens_count, success_count, failure_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      logData.title,
      logData.body,
      JSON.stringify(logData.data || {}),
      logData.sentBy,
      logData.targetType,
      logData.targetId || null,
      logData.tokensCount || 0,
      logData.successCount || 0,
      logData.failureCount || 0,
    ]);
  } catch (error) {
    console.error('[Push] Error logging notification:', error);
  }
}

/**
 * Deactivate invalid/expired push tokens
 */
async function deactivateInvalidTokens(db, tokens) {
  if (!tokens || tokens.length === 0) return;

  try {
    await db.query(
      'UPDATE push_tokens SET is_active = FALSE, updated_at = NOW() WHERE token = ANY($1)',
      [tokens]
    );
    console.log(`[Push] Deactivated ${tokens.length} invalid tokens`);
  } catch (error) {
    console.error('[Push] Error deactivating tokens:', error);
  }
}

/**
 * Helper: split array into chunks
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

module.exports = {
  isValidExpoPushToken,
  isValidFcmToken,
  detectTokenType,
  sendPushNotifications,
  sendToUser,
  sendToBusinessSubscribers,
  sendToAll,
  sendToCity,
  logNotification,
  deactivateInvalidTokens,
};
