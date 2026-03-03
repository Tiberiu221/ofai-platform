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

  // 7. Check subscription expirations — Daily 04:00 UTC
  cron.schedule('0 4 * * *', async () => {
    const { syncBadgeType } = require('../helpers/tiers');

    try {
      // Get free plan (needed for downgrades)
      const freePlanResult = await pool.query(
        "SELECT id, badge_type FROM subscription_plans WHERE slug = 'free'"
      );
      if (!freePlanResult.rows[0]) {
        console.error('[Cron] CRITICAL: free plan not found in subscription_plans');
        return;
      }
      const freePlanId = freePlanResult.rows[0].id;
      const freeBadgeType = freePlanResult.rows[0].badge_type;

      // ── Expire trials that have ended ──
      const trialResult = await pool.query(`
        UPDATE business_subscriptions
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'trial'
          AND trial_end < NOW()
        RETURNING business_id, plan_id
      `);

      // Downgrade expired trials to free + sync badge (per-business transaction)
      for (const row of trialResult.rows) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(`
            INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
            VALUES ($1, $2, 'active', 'none')
            ON CONFLICT DO NOTHING
          `, [row.business_id, freePlanId]);
          await client.query(`
            INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
            VALUES ($1, $2, $3, 'trial_expired', 'Trial period ended')
          `, [row.business_id, row.plan_id, freePlanId]);
          await syncBadgeType(client, row.business_id, freeBadgeType);
          await client.query('COMMIT');
        } catch (txErr) {
          await client.query('ROLLBACK');
          console.error(`[Cron] Trial downgrade tx failed for business ${row.business_id}:`, txErr.message);
        } finally {
          client.release();
        }
      }

      // ── Expire paid subscriptions past period_end ──
      // (only those without Stripe — Stripe-managed subs are renewed via webhook)
      const paidResult = await pool.query(`
        UPDATE business_subscriptions
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'active'
          AND billing_cycle != 'none'
          AND current_period_end < NOW()
          AND stripe_subscription_id IS NULL
        RETURNING business_id, plan_id
      `);

      // Downgrade expired paid subs to free + sync badge + log history
      for (const row of paidResult.rows) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(`
            INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
            VALUES ($1, $2, 'active', 'none')
            ON CONFLICT DO NOTHING
          `, [row.business_id, freePlanId]);
          await client.query(`
            INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
            VALUES ($1, $2, $3, 'expired', 'Paid subscription period ended without renewal')
          `, [row.business_id, row.plan_id, freePlanId]);
          await syncBadgeType(client, row.business_id, freeBadgeType);
          await client.query('COMMIT');
        } catch (txErr) {
          await client.query('ROLLBACK');
          console.error(`[Cron] Paid downgrade tx failed for business ${row.business_id}:`, txErr.message);
        } finally {
          client.release();
        }
      }

      const total = trialResult.rows.length + paidResult.rows.length;
      if (total > 0) {
        console.log(`[Cron] Subscription check: ${trialResult.rows.length} trials + ${paidResult.rows.length} paid expired, downgraded to free`);
      }
    } catch (err) {
      console.error('[Cron] Subscription expiry check error:', err.message);
    }
  });

  // 8. Clean old business push logs — Monthly 1st 05:00 UTC (180 day retention)
  cron.schedule('0 5 1 * *', async () => {
    try {
      const result = await pool.query(
        `DELETE FROM business_push_log WHERE created_at < NOW() - INTERVAL '180 days'`
      );
      if (result.rowCount > 0) console.log(`[Cron] Cleaned ${result.rowCount} old business push log entries`);
    } catch (err) {
      console.error('[Cron] business_push_log cleanup failed:', err.message);
    }
  });

  // 9. Deal of the Day selection — Daily 00:05 UTC (pick tomorrow's deal from nominations)
  cron.schedule('5 0 * * *', async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Check if tomorrow already has a selected nomination
      const existing = await pool.query(`
        SELECT id FROM deal_nominations
        WHERE selected_for_date = $1 AND status = 'selected'
        LIMIT 1
      `, [tomorrowStr]);

      if (existing.rows.length > 0) {
        return;
      }

      // Check if admin manually set a deal for tomorrow
      const adminDeal = await pool.query(`
        SELECT id FROM offers
        WHERE is_deal_of_day = TRUE AND deal_of_day_date = $1
      `, [tomorrowStr]);
      if (adminDeal.rows.length > 0) {
        return;
      }

      // Pick oldest pending nomination whose offer is still active and business still has feature
      const candidate = await pool.query(`
        SELECT dn.id as nomination_id, dn.offer_id, dn.business_id
        FROM deal_nominations dn
        JOIN offers o ON o.id = dn.offer_id
        JOIN business_subscriptions bs ON bs.business_id = dn.business_id
          AND bs.status IN ('active', 'trial')
        JOIN subscription_plans sp ON sp.id = bs.plan_id
        WHERE dn.status = 'pending'
          AND o.is_active = TRUE
          AND (o.end_date IS NULL OR o.end_date > $1::date)
          AND sp.has_deal_nomination = TRUE
        ORDER BY dn.nominated_at ASC
        LIMIT 1
      `, [tomorrowStr]);

      if (candidate.rows.length === 0) {
        return;
      }

      const { nomination_id, offer_id } = candidate.rows[0];

      // Mark nomination as selected
      await pool.query(`
        UPDATE deal_nominations
        SET status = 'selected', selected_for_date = $1
        WHERE id = $2
      `, [tomorrowStr, nomination_id]);

      // Clear any existing deal_of_day flag for tomorrow, then set the new one
      await pool.query(`
        UPDATE offers SET is_deal_of_day = FALSE, deal_of_day_date = NULL
        WHERE deal_of_day_date = $1
      `, [tomorrowStr]);

      await pool.query(`
        UPDATE offers SET is_deal_of_day = TRUE, deal_of_day_date = $1
        WHERE id = $2
      `, [tomorrowStr, offer_id]);

      console.log(`[Cron] Selected offer ${offer_id} (nomination ${nomination_id}) as Deal of the Day for ${tomorrowStr}`);
    } catch (err) {
      console.error('[Cron] Deal of the Day selection error:', err.message);
    }
  });

  // 10. Expire stale deal nominations — Daily 00:15 UTC
  cron.schedule('15 0 * * *', async () => {
    try {
      // Expire nominations older than 14 days that are still pending
      const expiredAge = await pool.query(`
        UPDATE deal_nominations
        SET status = 'expired'
        WHERE status = 'pending'
          AND nominated_at < NOW() - INTERVAL '14 days'
        RETURNING id
      `);

      // Cancel nominations whose offer became inactive or expired
      const expiredOffer = await pool.query(`
        UPDATE deal_nominations dn
        SET status = 'cancelled'
        FROM offers o
        WHERE dn.offer_id = o.id
          AND dn.status = 'pending'
          AND (o.is_active = FALSE OR (o.end_date IS NOT NULL AND o.end_date < CURRENT_DATE + 1))
        RETURNING dn.id
      `);

      // Cancel nominations whose business lost Premium subscription
      const expiredTier = await pool.query(`
        UPDATE deal_nominations dn
        SET status = 'cancelled'
        WHERE dn.status = 'pending'
          AND NOT EXISTS (
            SELECT 1 FROM business_subscriptions bs
            JOIN subscription_plans sp ON sp.id = bs.plan_id
            WHERE bs.business_id = dn.business_id
              AND bs.status IN ('active', 'trial')
              AND sp.has_deal_nomination = TRUE
          )
        RETURNING dn.id
      `);

      const total = (expiredAge.rowCount || 0) + (expiredOffer.rowCount || 0) + (expiredTier.rowCount || 0);
      if (total > 0) {
        console.log(`[Cron] Nomination cleanup: ${expiredAge.rowCount} aged out, ${expiredOffer.rowCount} offer invalid, ${expiredTier.rowCount} tier lost`);
      }
    } catch (err) {
      console.error('[Cron] Nomination expiry error:', err.message);
    }
  });

  console.log('[Cron] All 10 scheduled jobs registered.');
}

module.exports = { initCronJobs };
