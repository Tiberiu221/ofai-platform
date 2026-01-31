/**
 * Push Notifications Service
 * Utilizează Expo Push API pentru trimiterea notificărilor
 * 
 * Documentație: https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Validează un Expo Push Token
 * Format valid: ExponentPushToken[xxx] sau ExpoPushToken[xxx]
 */
function isValidExpoPushToken(token) {
  return typeof token === 'string' && 
         (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
}

/**
 * Trimite notificări către mai multe tokens
 * @param {Array} messages - Array de obiecte { to, title, body, data }
 * @returns {Promise<Object>} - Rezultatul trimiterii
 */
async function sendPushNotifications(messages) {
  if (!messages || messages.length === 0) {
    return { success: true, sent: 0, results: [] };
  }

  // Filtrează doar tokens valide
  const validMessages = messages.filter(msg => isValidExpoPushToken(msg.to));
  
  if (validMessages.length === 0) {
    console.log('[Push] No valid tokens to send to');
    return { success: true, sent: 0, results: [] };
  }

  // Expo acceptă maxim 100 de notificări per request
  const chunks = chunkArray(validMessages, 100);
  const allResults = [];
  let totalSuccess = 0;
  let totalFailure = 0;

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
            console.error(`[Push] Failed for token ${chunk[index]?.to}:`, item.message);
          }
        });
        allResults.push(...result.data);
      }
    } catch (error) {
      console.error('[Push] Error sending chunk:', error);
      totalFailure += chunk.length;
    }
  }

  console.log(`[Push] Sent: ${totalSuccess} success, ${totalFailure} failed`);
  
  return {
    success: totalFailure === 0,
    sent: totalSuccess,
    failed: totalFailure,
    results: allResults,
  };
}

/**
 * Trimite o notificare către un singur user
 * @param {Object} db - Database pool
 * @param {number} userId - ID-ul userului
 * @param {Object} notification - { title, body, data }
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

  return sendPushNotifications(messages);
}

/**
 * Trimite notificare către toți subscriberii unui business
 * @param {Object} db - Database pool
 * @param {number} businessId - ID-ul business-ului
 * @param {Object} notification - { title, body, data }
 */
async function sendToBusinessSubscribers(db, businessId, notification) {
  // Ia toți userii abonați la acest business care au push tokens active
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
    data: { ...notification.data, businessId },
  }));

  return sendPushNotifications(messages);
}

/**
 * Trimite notificare către toți userii (broadcast)
 * @param {Object} db - Database pool
 * @param {Object} notification - { title, body, data }
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

  return sendPushNotifications(messages);
}

/**
 * Trimite notificare către userii dintr-un anumit oraș
 * @param {Object} db - Database pool
 * @param {number} cityId - ID-ul orașului
 * @param {Object} notification - { title, body, data }
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
    data: { ...notification.data, cityId },
  }));

  return sendPushNotifications(messages);
}

/**
 * Loghează notificarea în baza de date
 * @param {Object} db - Database pool
 * @param {Object} logData - Datele pentru log
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
 * Dezactivează tokens invalide (DeviceNotRegistered)
 * @param {Object} db - Database pool
 * @param {Array} tokens - Array de tokens de dezactivat
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
 * Helper: împarte array în chunks
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
  sendPushNotifications,
  sendToUser,
  sendToBusinessSubscribers,
  sendToAll,
  sendToCity,
  logNotification,
  deactivateInvalidTokens,
};
