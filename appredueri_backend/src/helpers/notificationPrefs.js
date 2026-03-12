const pool = require('../db');

// All known notification preference keys
const PREF_KEYS = [
  'deal_of_day',
  'followed_business',
  'flash_deals',
  'weekly_digest',
  'review_prompt',
  'saved_search',
  'marketing',
];

/**
 * Check if a specific notification type is enabled for a user.
 * Missing row = enabled (opt-in default).
 */
async function isNotificationEnabled(userId, prefKey) {
  const result = await pool.query(
    'SELECT enabled FROM notification_preferences WHERE user_id = $1 AND pref_key = $2',
    [userId, prefKey]
  );
  if (result.rows.length === 0) return true; // default: enabled
  return result.rows[0].enabled;
}

/**
 * Get all user IDs with active push tokens that haven't opted out of a pref key.
 * Returns array of { user_id, token } objects.
 */
async function getUsersWithPrefEnabled(prefKey) {
  const result = await pool.query(`
    SELECT pt.user_id, pt.token
    FROM push_tokens pt
    WHERE pt.is_active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM notification_preferences np
        WHERE np.user_id = pt.user_id
          AND np.pref_key = $1
          AND np.enabled = FALSE
      )
  `, [prefKey]);
  return result.rows;
}

module.exports = { PREF_KEYS, isNotificationEnabled, getUsersWithPrefEnabled };
