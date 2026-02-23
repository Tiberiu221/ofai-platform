/**
 * Shared account deletion logic (GDPR-compliant)
 * Used by both mobile (users.js) and web (web.js) deletion routes
 *
 * @param {number} userId - The user ID to delete
 * @param {object} client - PostgreSQL client (within an active transaction)
 * @param {string} ip - Request IP address for audit logging
 * @param {string} source - 'user_request' | 'web_request' for audit log
 */
async function deleteUserAccount(userId, client, ip, source) {
  // 1. Revoke all refresh tokens
  await client.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);
  // 2. Delete password reset tokens
  await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);
  // 3. Delete push tokens
  await client.query("DELETE FROM push_tokens WHERE user_id = $1", [userId]);
  // 4. Delete points
  await client.query("DELETE FROM user_points WHERE user_id = $1", [userId]);
  // 5. Delete favorites
  await client.query("DELETE FROM favorite_offers WHERE user_id = $1", [userId]);
  // 6. Delete followed businesses
  await client.query("DELETE FROM followed_businesses WHERE user_id = $1", [userId]);
  // 7. Anonymize review responses
  await client.query(
    `UPDATE review_responses SET review_id = NULL
     WHERE review_id IN (SELECT id FROM reviews WHERE user_id = $1)`,
    [userId]
  );
  // 8. Anonymize reviews (remove user link, keep content for business ratings)
  await client.query(
    "UPDATE reviews SET user_id = NULL WHERE user_id = $1",
    [userId]
  );
  // 9. Anonymize business requests
  await client.query("UPDATE business_requests SET user_id = NULL WHERE user_id = $1", [userId]);
  // 10. Remove user-business ownership links
  await client.query("DELETE FROM user_businesses WHERE user_id = $1", [userId]);
  // 11. Delete points history
  await client.query("DELETE FROM points_history WHERE user_id = $1", [userId]);
  // 12. Delete code reveals
  await client.query("DELETE FROM code_reveals WHERE user_id = $1", [userId]);
  // 13. Log deletion in audit log
  try {
    await client.query(
      `INSERT INTO audit_log (action, entity_type, entity_id, user_id, ip_address, details)
       VALUES ('account_delete', 'user', $1, $1, $2, $3)`,
      [userId, ip, JSON.stringify({ source })]
    );
  } catch (auditErr) {
    console.error("[Audit] Failed to log account deletion:", auditErr.message);
  }
  // 14. Finally, delete the user (cascades: user_streaks, user_badges)
  await client.query("DELETE FROM users WHERE id = $1", [userId]);
}

module.exports = { deleteUserAccount };
