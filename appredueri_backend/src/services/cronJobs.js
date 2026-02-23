const cron = require('node-cron');
const pool = require('../db');

/**
 * Initializes all scheduled cleanup jobs.
 * Called once from index.js on server start.
 */
function initCronJobs() {
  console.log('[Cron] Initializing scheduled jobs...');

  // 1. Clean expired/revoked refresh tokens — Daily 03:00 UTC (60 day retention)
  cron.schedule('0 3 * * *', async () => {
    try {
      const result = await pool.query(
        `DELETE FROM refresh_tokens
         WHERE (expires_at < NOW() - INTERVAL '60 days')
            OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '60 days')`
      );
      if (result.rowCount > 0) console.log(`[Cron] Cleaned ${result.rowCount} expired refresh tokens`);
    } catch (err) {
      console.error('[Cron] refresh_tokens cleanup failed:', err.message);
    }
  });

  // 2. Clean old push notification logs — Daily 03:15 UTC (90 day retention)
  cron.schedule('15 3 * * *', async () => {
    try {
      const result = await pool.query(
        `DELETE FROM push_notifications_log WHERE created_at < NOW() - INTERVAL '90 days'`
      );
      if (result.rowCount > 0) console.log(`[Cron] Cleaned ${result.rowCount} old push notification logs`);
    } catch (err) {
      console.error('[Cron] push_notifications_log cleanup failed:', err.message);
    }
  });

  // 3. Clean used/expired password reset tokens — Daily 03:30 UTC (7 day retention)
  cron.schedule('30 3 * * *', async () => {
    try {
      const result = await pool.query(
        `DELETE FROM password_reset_tokens
         WHERE used_at IS NOT NULL
            OR expires_at < NOW() - INTERVAL '7 days'`
      );
      if (result.rowCount > 0) console.log(`[Cron] Cleaned ${result.rowCount} expired password reset tokens`);
    } catch (err) {
      console.error('[Cron] password_reset_tokens cleanup failed:', err.message);
    }
  });

  // 4. Clean old audit log entries — Weekly Sunday 04:00 UTC (1 year retention)
  cron.schedule('0 4 * * 0', async () => {
    try {
      const result = await pool.query(
        `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '365 days'`
      );
      if (result.rowCount > 0) console.log(`[Cron] Cleaned ${result.rowCount} old audit log entries`);
    } catch (err) {
      console.error('[Cron] audit_log cleanup failed:', err.message);
    }
  });

  // 5. Clean old business clicks — Monthly 1st 04:30 UTC (180 day retention)
  cron.schedule('30 4 1 * *', async () => {
    try {
      const result = await pool.query(
        `DELETE FROM business_clicks WHERE created_at < NOW() - INTERVAL '180 days'`
      );
      if (result.rowCount > 0) console.log(`[Cron] Cleaned ${result.rowCount} old business clicks`);
    } catch (err) {
      console.error('[Cron] business_clicks cleanup failed:', err.message);
    }
  });

  // 6. Deactivate expired offers — Daily 03:45 UTC
  cron.schedule('45 3 * * *', async () => {
    try {
      const result = await pool.query(
        `UPDATE offers SET is_active = FALSE
         WHERE is_active = TRUE AND end_date IS NOT NULL AND end_date < CURRENT_DATE`
      );
      if (result.rowCount > 0) console.log(`[Cron] Deactivated ${result.rowCount} expired offers`);
    } catch (err) {
      console.error('[Cron] offers deactivation failed:', err.message);
    }
  });

  console.log('[Cron] All 6 scheduled cleanup jobs registered.');
}

module.exports = { initCronJobs };
