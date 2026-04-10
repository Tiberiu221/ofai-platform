const cron = require('node-cron');
const pool = require('../db');
const cache = require('./cache');

/**
 * Compute and upsert category rankings based on review scores + tier boost.
 * Shared between the scheduled cron job and the first-startup seed.
 * @returns {Promise<number>} Number of categories ranked
 */
async function computeCategoryRankings() {
  const result = await pool.query(`
    WITH category_scores AS (
      SELECT
        b.category_id,
        AVG(
          COALESCE(r.avg_rating, 0)
          + CASE
              WHEN sp.slug = 'premium' THEN 0.3
              WHEN sp.slug = 'standard' THEN 0.1
              ELSE 0
            END
        ) as score,
        COUNT(DISTINCT o.id) FILTER (
          WHERE o.is_active = TRUE
            AND o.moderation_status IN ('approved', 'auto_approved')
            AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
        ) as offer_count
      FROM businesses b
      LEFT JOIN (
        SELECT business_id, AVG(rating) as avg_rating
        FROM reviews GROUP BY business_id
      ) r ON r.business_id = b.id
      LEFT JOIN business_subscriptions bs ON bs.business_id = b.id AND bs.status IN ('active', 'trial')
      LEFT JOIN subscription_plans sp ON sp.id = bs.plan_id
      LEFT JOIN offers o ON o.business_id = b.id
      WHERE b.category_id IS NOT NULL
      GROUP BY b.category_id
      HAVING COUNT(DISTINCT o.id) FILTER (
        WHERE o.is_active = TRUE
          AND o.moderation_status IN ('approved', 'auto_approved')
          AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
      ) >= 6
    )
    INSERT INTO category_rankings (category_id, rank, score, offer_count, updated_at)
    SELECT
      category_id,
      ROW_NUMBER() OVER (ORDER BY score DESC),
      ROUND(score::numeric, 2),
      offer_count,
      NOW()
    FROM category_scores
    ON CONFLICT (category_id) DO UPDATE SET
      rank = EXCLUDED.rank,
      score = EXCLUDED.score,
      offer_count = EXCLUDED.offer_count,
      updated_at = NOW()
  `);

  // Remove categories that no longer qualify
  await pool.query(`
    DELETE FROM category_rankings
    WHERE category_id NOT IN (
      SELECT b.category_id
      FROM businesses b
      LEFT JOIN offers o ON o.business_id = b.id
      WHERE b.category_id IS NOT NULL
        AND o.is_active = TRUE
        AND o.moderation_status IN ('approved', 'auto_approved')
        AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
      GROUP BY b.category_id
      HAVING COUNT(DISTINCT o.id) >= 6
    )
  `);

  return result.rowCount;
}

/**
 * Post-redemption review prompt — sends push notification to users who
 * redeemed an offer 24-48h ago and haven't reviewed yet.
 * Extracted for admin test endpoint access.
 * @returns {Promise<{found: number, sent: number}>}
 */
async function runReviewPromptCron() {
  const { sendToUser } = require('./pushNotifications');

  const { rows } = await pool.query(`
    SELECT DISTINCT ON (cr.user_id, o.business_id)
      cr.user_id, o.business_id, b.name AS business_name, o.title AS offer_title
    FROM code_reveals cr
    JOIN offers o ON o.id = cr.offer_id
    JOIN businesses b ON b.id = o.business_id
    WHERE cr.revealed_at BETWEEN NOW() - INTERVAL '48 hours' AND NOW() - INTERVAL '24 hours'
      AND cr.user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM reviews r
        WHERE r.user_id = cr.user_id AND r.business_id = o.business_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM notification_preferences np
        WHERE np.user_id = cr.user_id AND np.pref_key = 'review_prompt' AND np.enabled = FALSE
      )
    LIMIT 50
  `);

  let sent = 0;
  for (const row of rows) {
    try {
      await sendToUser(pool, row.user_id, {
        title: `Cum a fost la ${row.business_name}?`,
        body: `Ai folosit "${row.offer_title}". Lasă un review!`,
        data: { type: 'review_prompt', deepLink: `/business/${row.business_id}` },
      });
      sent++;
    } catch (e) {
      console.error(`[Cron:ReviewPrompt] Push failed for user ${row.user_id}:`, e.message);
    }
  }
  if (sent > 0) console.log(`[Cron:ReviewPrompt] Sent ${sent}/${rows.length} review prompts`);
  return { found: rows.length, sent };
}

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
      if (result.rowCount > 0) {
        console.log(`[Cron] Deactivated ${result.rowCount} expired offers`);
        cache.invalidateGroup('offers');
        cache.invalidateGroup('homepage');
      }
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

      // Batch downgrade expired trials to free + sync badges (single transaction)
      if (trialResult.rows.length > 0) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const bizIds = trialResult.rows.map(r => r.business_id);
          const fromPlanIds = trialResult.rows.map(r => r.plan_id);
          const toPlanIds = trialResult.rows.map(() => freePlanId);
          // Update existing rows to free plan (UNIQUE on business_id — one row per business)
          await client.query(`
            UPDATE business_subscriptions
            SET plan_id = $2, status = 'active', billing_cycle = 'none',
                stripe_subscription_id = NULL,
                current_period_end = NULL, cancel_at_period_end = FALSE, updated_at = NOW()
            WHERE business_id = ANY($1::int[])
          `, [bizIds, freePlanId]);
          // Batch insert subscription history
          await client.query(`
            INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
            SELECT unnest($1::int[]), unnest($2::int[]), unnest($3::int[]), 'trial_expired', 'Trial period ended'
          `, [bizIds, fromPlanIds, toPlanIds]);
          // syncBadgeType must run per-business (updates different rows)
          for (const row of trialResult.rows) {
            await syncBadgeType(client, row.business_id, freeBadgeType);
          }
          await client.query('COMMIT');
        } catch (txErr) {
          await client.query('ROLLBACK');
          console.error(`[Cron] Trial batch downgrade tx failed:`, txErr.message);
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

      // Batch downgrade expired paid subs to free + sync badges (single transaction)
      if (paidResult.rows.length > 0) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const bizIds = paidResult.rows.map(r => r.business_id);
          const fromPlanIds = paidResult.rows.map(r => r.plan_id);
          const toPlanIds = paidResult.rows.map(() => freePlanId);
          // Update existing rows to free plan (UNIQUE on business_id — one row per business)
          await client.query(`
            UPDATE business_subscriptions
            SET plan_id = $2, status = 'active', billing_cycle = 'none',
                stripe_subscription_id = NULL,
                current_period_end = NULL, cancel_at_period_end = FALSE, updated_at = NOW()
            WHERE business_id = ANY($1::int[])
          `, [bizIds, freePlanId]);
          // Batch insert subscription history
          await client.query(`
            INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
            SELECT unnest($1::int[]), unnest($2::int[]), unnest($3::int[]), 'expired', 'Paid subscription period ended without renewal'
          `, [bizIds, fromPlanIds, toPlanIds]);
          // syncBadgeType must run per-business (updates different rows)
          for (const row of paidResult.rows) {
            await syncBadgeType(client, row.business_id, freeBadgeType);
          }
          await client.query('COMMIT');
        } catch (txErr) {
          await client.query('ROLLBACK');
          console.error(`[Cron] Paid batch downgrade tx failed:`, txErr.message);
        } finally {
          client.release();
        }
      }

      // ── Safety net: Stripe-managed subs past period_end with cancel_at_period_end ──
      // Catches missed customer.subscription.deleted webhooks
      const staleStripeResult = await pool.query(`
        UPDATE business_subscriptions
        SET plan_id = $1, status = 'active', billing_cycle = 'none',
            stripe_subscription_id = NULL, current_period_end = NULL,
            cancel_at_period_end = FALSE, updated_at = NOW()
        WHERE status = 'active'
          AND cancel_at_period_end = TRUE
          AND current_period_end < NOW() - INTERVAL '1 day'
          AND stripe_subscription_id IS NOT NULL
        RETURNING business_id, plan_id
      `, [freePlanId]);

      if (staleStripeResult.rows.length > 0) {
        for (const row of staleStripeResult.rows) {
          try {
            await syncBadgeType(pool, row.business_id, freeBadgeType);
          } catch (badgeErr) {
            console.error(`[Cron] Safety net badge sync failed for business ${row.business_id}:`, badgeErr.message);
          }
        }
        console.log(`[Cron] Safety net: ${staleStripeResult.rows.length} stale Stripe subs downgraded (missed webhooks)`);
      }

      const total = trialResult.rows.length + paidResult.rows.length + staleStripeResult.rows.length;
      if (total > 0) {
        cache.invalidateGroup('tiers');
        console.log(`[Cron] Subscription check: ${trialResult.rows.length} trials + ${paidResult.rows.length} paid + ${staleStripeResult.rows.length} stale Stripe expired, downgraded to free`);
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
        ORDER BY dn.nominated_at ASC, dn.id ASC
        LIMIT 1
      `, [tomorrowStr]);

      if (candidate.rows.length === 0) {
        console.log('[Cron] No deal-of-day candidates for ' + tomorrowStr);
        return;
      }

      const { nomination_id, offer_id } = candidate.rows[0];

      // Wrap in transaction to prevent partial updates
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(`
          UPDATE deal_nominations
          SET status = 'selected', selected_for_date = $1
          WHERE id = $2
        `, [tomorrowStr, nomination_id]);

        await client.query(`
          UPDATE offers SET is_deal_of_day = FALSE, deal_of_day_date = NULL
          WHERE deal_of_day_date = $1
        `, [tomorrowStr]);

        await client.query(`
          UPDATE offers SET is_deal_of_day = TRUE, deal_of_day_date = $1
          WHERE id = $2
        `, [tomorrowStr, offer_id]);

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      cache.del('home:dealOfDay');
      console.log(`[Cron] Selected offer ${offer_id} (nomination ${nomination_id}) as Deal of the Day for ${tomorrowStr}`);
    } catch (err) {
      console.error('[Cron] Deal of the Day selection error:', err.message);
    }
  });

  // 10. Expire stale deal nominations — Daily 00:15 UTC
  cron.schedule('15 0 * * *', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Expire nominations older than 14 days that are still pending
      const expiredAge = await client.query(`
        UPDATE deal_nominations
        SET status = 'expired'
        WHERE status = 'pending'
          AND nominated_at < NOW() - INTERVAL '14 days'
        RETURNING id
      `);

      // Cancel nominations whose offer became inactive or expired
      const expiredOffer = await client.query(`
        UPDATE deal_nominations dn
        SET status = 'cancelled'
        FROM offers o
        WHERE dn.offer_id = o.id
          AND dn.status = 'pending'
          AND (o.is_active = FALSE OR (o.end_date IS NOT NULL AND o.end_date < CURRENT_DATE + 1))
        RETURNING dn.id
      `);

      // Cancel nominations whose business lost Premium subscription
      const expiredTier = await client.query(`
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

      await client.query('COMMIT');

      const total = (expiredAge.rowCount || 0) + (expiredOffer.rowCount || 0) + (expiredTier.rowCount || 0);
      if (total > 0) {
        console.log(`[Cron] Nomination cleanup: ${expiredAge.rowCount} aged out, ${expiredOffer.rowCount} offer invalid, ${expiredTier.rowCount} tier lost`);
      }
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[Cron] Nomination expiry error:', err.message);
    } finally {
      client.release();
    }
  });

  // 11. Clear expired flash deals — Every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await pool.query(
        `UPDATE offers SET flash_expires_at = NULL
         WHERE flash_expires_at IS NOT NULL AND flash_expires_at < NOW()`
      );
      if (result.rowCount > 0) {
        console.log(`[Cron] Cleared ${result.rowCount} expired flash deals`);
        cache.invalidateGroup('offers');
        cache.invalidateGroup('homepage');
      }
    } catch (err) {
      console.error('[Cron] flash deals cleanup failed:', err.message);
    }
  });

  // 12. Post-redemption review prompt — Daily 10:00 UTC (12:00 Romania)
  cron.schedule('0 10 * * *', () => runReviewPromptCron());

  // 13. Weekly digest — Sunday 17:00 UTC (19:00 Romania) — push + email
  cron.schedule('0 17 * * 0', async () => {
    const { sendToUser } = require('./pushNotifications');
    const { sendWeeklyDigestEmail, sleep } = require('./email');

    try {
      // ── Push notifications (users with active tokens) ──
      const { rows: pushUsers } = await pool.query(`
        SELECT DISTINCT u.id AS user_id,
          u.preferred_city_ids AS city_ids,
          (SELECT c.name FROM cities c
           WHERE c.id = ANY(u.preferred_city_ids) LIMIT 1) AS city_name
        FROM users u
        JOIN push_tokens pt ON pt.user_id = u.id AND pt.is_active = TRUE
        WHERE u.preferred_city_ids IS NOT NULL
          AND array_length(u.preferred_city_ids, 1) > 0
          AND NOT EXISTS (
            SELECT 1 FROM notification_preferences np
            WHERE np.user_id = u.id AND np.pref_key = 'weekly_digest' AND np.enabled = FALSE
          )
        LIMIT 500
      `);

      let pushSent = 0;
      for (const user of pushUsers) {
        try {
          const cityIds = user.city_ids || [];
          if (cityIds.length === 0) continue;

          const { rows: countRows } = await pool.query(`
            SELECT COUNT(*) AS cnt FROM offers o
            JOIN businesses b ON b.id = o.business_id
            WHERE o.is_active = TRUE
              AND o.moderation_status IN ('approved', 'auto_approved')
              AND o.start_date >= CURRENT_DATE - 7
              AND b.city_id = ANY($1::int[])
          `, [cityIds]);

          const count = parseInt(countRows[0]?.cnt || '0', 10);
          if (count === 0) continue;

          const cityLabel = user.city_name || 'orașul tău';
          await sendToUser(pool, user.user_id, {
            title: `${count} oferte noi săptămâna asta`,
            body: `Descoperă cele mai noi reduceri în ${cityLabel}!`,
            data: { type: 'weekly_digest', deepLink: '/explore' },
          });
          pushSent++;
        } catch (e) {
          console.error(`[Cron] Weekly digest push failed for user ${user.user_id}:`, e.message);
        }
      }
      if (pushSent > 0) console.log(`[Cron] Sent ${pushSent} weekly digest push notifications`);

      // ── Email digest (all users with email, not just push token holders) ──
      if (process.env.ENABLE_WEEKLY_DIGEST === 'false') {
        console.log('[Cron] Weekly digest email disabled via env');
      } else {
        const { rows: emailUsers } = await pool.query(`
          SELECT DISTINCT u.id AS user_id, u.email, u.first_name,
            u.preferred_city_ids AS city_ids,
            (SELECT c.name FROM cities c WHERE c.id = ANY(u.preferred_city_ids) LIMIT 1) AS city_name
          FROM users u
          WHERE u.preferred_city_ids IS NOT NULL
            AND array_length(u.preferred_city_ids, 1) > 0
            AND u.email IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM notification_preferences np
              WHERE np.user_id = u.id AND np.pref_key = 'weekly_digest' AND np.enabled = FALSE
            )
          LIMIT 500
        `);

        let emailSent = 0;
        for (const user of emailUsers) {
          try {
            const cityIds = user.city_ids || [];
            if (cityIds.length === 0) continue;

            const { rows: countRows } = await pool.query(`
              SELECT COUNT(*) AS cnt FROM offers o
              JOIN businesses b ON b.id = o.business_id
              WHERE o.is_active = TRUE
                AND o.moderation_status IN ('approved', 'auto_approved')
                AND o.start_date >= CURRENT_DATE - 7
                AND b.city_id = ANY($1::int[])
            `, [cityIds]);

            const count = parseInt(countRows[0]?.cnt || '0', 10);
            if (count === 0) continue;

            const cityLabel = user.city_name || 'orașul tău';
            await sendWeeklyDigestEmail(user.email, user.first_name, count, cityLabel, user.user_id);
            await sleep(150); // Rate limit: ~6.6 emails/sec (Resend limit is 10/sec)
            emailSent++;
          } catch (e) {
            console.error(`[Cron] Weekly digest email failed for user ${user.user_id}:`, e.message);
          }
        }
        if (emailSent > 0) console.log(`[Cron] Sent ${emailSent} weekly digest emails`);
      }
    } catch (err) {
      console.error('[Cron] Weekly digest cron error:', err.message);
    }
  });

  // 14. Saved search alerts — Daily 11:00 UTC (13:00 Romania)
  cron.schedule('0 11 * * *', async () => {
    const { sendToUser } = require('./pushNotifications');

    try {
      const { rows: searches } = await pool.query(`
        SELECT ss.id, ss.user_id, ss.query, ss.city_id, ss.category_id, ss.last_notified_offer_id,
               c.name AS city_name, cat.name AS category_name
        FROM saved_searches ss
        LEFT JOIN cities c ON c.id = ss.city_id
        LEFT JOIN categories cat ON cat.id = ss.category_id
        JOIN push_tokens pt ON pt.user_id = ss.user_id AND pt.is_active = TRUE
        WHERE NOT EXISTS (
          SELECT 1 FROM notification_preferences np
          WHERE np.user_id = ss.user_id AND np.pref_key = 'saved_search' AND np.enabled = FALSE
        )
        LIMIT 200
      `);

      let sent = 0;
      for (const search of searches) {
        try {
          // Build dynamic WHERE clause with parameterized queries
          const conditions = [
            'o.is_active = TRUE',
            "o.moderation_status IN ('approved', 'auto_approved')",
            `o.id > $1`,
          ];
          const params = [search.last_notified_offer_id];
          let paramIdx = 2;
          let needsBusinessJoin = false;

          if (search.city_id) {
            conditions.push(`b.city_id = $${paramIdx++}`);
            params.push(search.city_id);
            needsBusinessJoin = true;
          }
          if (search.category_id) {
            conditions.push(`b.category_id = $${paramIdx++}`);
            params.push(search.category_id);
            needsBusinessJoin = true;
          }
          if (search.query) {
            conditions.push(`(o.title ILIKE $${paramIdx} OR o.description ILIKE $${paramIdx})`);
            params.push(`%${search.query}%`);
            paramIdx++;
          }

          const fromClause = needsBusinessJoin
            ? 'FROM offers o JOIN businesses b ON b.id = o.business_id'
            : 'FROM offers o';
          const countResult = await pool.query(
            `SELECT COUNT(*) AS cnt, MAX(o.id) AS max_id ${fromClause} WHERE ${conditions.join(' AND ')}`,
            params
          );

          const count = parseInt(countResult.rows[0]?.cnt || '0', 10);
          if (count === 0) continue;

          const maxId = countResult.rows[0].max_id;
          const label = search.city_name || search.category_name || search.query || 'căutarea ta';

          await sendToUser(pool, search.user_id, {
            title: `${count} oferte noi pentru "${label}"`,
            body: 'Verifică cele mai recente rezultate!',
            data: { type: 'saved_search', deepLink: '/explore' },
          });

          // Update last_notified_offer_id
          await pool.query(
            'UPDATE saved_searches SET last_notified_offer_id = $1 WHERE id = $2',
            [maxId, search.id]
          );
          sent++;
        } catch (e) {
          console.error(`[Cron] Saved search alert failed for search ${search.id}:`, e.message);
        }
      }
      if (sent > 0) console.log(`[Cron] Sent ${sent} saved search alerts`);
    } catch (err) {
      console.error('[Cron] Saved search alerts cron error:', err.message);
    }
  });

  // 15. Update category rankings for home feed — Daily at 02:00 UTC
  cron.schedule('0 2 * * *', async () => {
    try {
      const count = await computeCategoryRankings();
      console.log(`[Cron] Category rankings updated: ${count} categories ranked`);
    } catch (err) {
      console.error('[Cron] Category rankings update failed:', err.message);
    }
  });

  // Seed category rankings on first startup if table is empty (fire-and-forget)
  (async () => {
    try {
      const check = await pool.query('SELECT COUNT(*) as cnt FROM category_rankings');
      if (parseInt(check.rows[0].cnt) === 0) {
        console.log('[Cron] Category rankings table empty — seeding now...');
        const count = await computeCategoryRankings();
        console.log(`[Cron] Category rankings seeded: ${count} categories`);
      }
    } catch (err) {
      console.error('[Cron] Category rankings seed check failed:', err.message);
    }
  })();

  // 16. Trial expiration warning — Daily 09:00 UTC (11:00 Romania)
  cron.schedule('0 9 * * *', async () => {
    if (process.env.ENABLE_TRIAL_WARNING === 'false') {
      console.log('[Cron] Trial warning email disabled via env');
      return;
    }
    const { sendTrialExpirationEmail, sleep } = require('./email');

    try {
      const { rows } = await pool.query(`
        SELECT bs.id AS sub_id, bs.business_id, bs.trial_end,
               b.name AS business_name, sp.name AS plan_name,
               u.id AS user_id, u.email, u.first_name
        FROM business_subscriptions bs
        JOIN businesses b ON b.id = bs.business_id
        JOIN subscription_plans sp ON sp.id = bs.plan_id
        JOIN user_businesses ub ON ub.business_id = bs.business_id
        JOIN users u ON u.id = ub.user_id
        WHERE bs.status = 'trial'
          AND bs.trial_end BETWEEN NOW() AND NOW() + INTERVAL '3 days'
          AND bs.trial_warning_sent_at IS NULL
          AND u.email IS NOT NULL
      `);

      let sent = 0;
      for (const row of rows) {
        try {
          const daysLeft = Math.max(1, Math.ceil((new Date(row.trial_end) - Date.now()) / (1000 * 60 * 60 * 24)));
          await sendTrialExpirationEmail(row.email, row.first_name, row.business_name, daysLeft, row.plan_name, row.user_id);
          await pool.query('UPDATE business_subscriptions SET trial_warning_sent_at = NOW() WHERE id = $1', [row.sub_id]);
          await sleep(150);
          sent++;
        } catch (e) {
          console.error(`[Cron] Trial warning failed for sub ${row.sub_id}:`, e.message);
        }
      }
      if (sent > 0) console.log(`[Cron] Sent ${sent} trial expiration warning emails`);
    } catch (err) {
      console.error('[Cron] Trial warning cron error:', err.message);
    }
  });

  // 17. Re-engagement email — Tuesday 10:00 UTC (12:00 Romania)
  cron.schedule('0 10 * * 2', async () => {
    if (process.env.ENABLE_REENGAGEMENT === 'false') {
      console.log('[Cron] Re-engagement email disabled via env');
      return;
    }
    const { sendReengagementEmail, sleep } = require('./email');

    try {
      const { rows: users } = await pool.query(`
        SELECT u.id, u.email, u.first_name,
               u.preferred_city_ids AS city_ids,
               (SELECT c.name FROM cities c WHERE c.id = ANY(u.preferred_city_ids) LIMIT 1) AS city_name
        FROM users u
        WHERE u.last_active_at < NOW() - INTERVAL '14 days'
          AND u.last_active_at > NOW() - INTERVAL '90 days'
          AND u.email IS NOT NULL
          AND u.preferred_city_ids IS NOT NULL
          AND array_length(u.preferred_city_ids, 1) > 0
          AND (u.reengagement_sent_at IS NULL OR u.reengagement_sent_at < NOW() - INTERVAL '30 days')
          AND NOT EXISTS (
            SELECT 1 FROM notification_preferences np
            WHERE np.user_id = u.id AND np.pref_key = 'marketing' AND np.enabled = FALSE
          )
        LIMIT 200
      `);

      let sent = 0;
      for (const user of users) {
        try {
          const cityIds = user.city_ids || [];
          if (cityIds.length === 0) continue;

          const { rows: countRows } = await pool.query(`
            SELECT COUNT(*) AS cnt FROM offers o
            JOIN businesses b ON b.id = o.business_id
            WHERE o.is_active = TRUE
              AND o.moderation_status IN ('approved', 'auto_approved')
              AND o.start_date >= CURRENT_DATE - 14
              AND b.city_id = ANY($1::int[])
          `, [cityIds]);

          const count = parseInt(countRows[0]?.cnt || '0', 10);
          if (count === 0) continue;

          const cityLabel = user.city_name || 'orașul tău';
          await sendReengagementEmail(user.email, user.first_name, count, cityLabel, user.id);
          await pool.query('UPDATE users SET reengagement_sent_at = NOW() WHERE id = $1', [user.id]);
          await sleep(150);
          sent++;
        } catch (e) {
          console.error(`[Cron] Re-engagement failed for user ${user.id}:`, e.message);
        }
      }
      if (sent > 0) console.log(`[Cron] Sent ${sent} re-engagement emails`);
    } catch (err) {
      console.error('[Cron] Re-engagement cron error:', err.message);
    }
  });

  // ── 18. Cloudinary orphaned image cleanup (weekly, Sunday 05:00 UTC) ──
  cron.schedule('0 5 * * 0', async () => {
    console.log('[Cron] Starting Cloudinary orphaned image cleanup...');
    try {
      const { cleanupOrphanedImages } = require('./cloudinary');
      // Dry run by default — set CLOUDINARY_CLEANUP_DELETE=true to actually delete
      const dryRun = process.env.CLOUDINARY_CLEANUP_DELETE !== 'true';
      const result = await cleanupOrphanedImages(pool, dryRun);
      console.log(`[Cron] Cloudinary cleanup done: ${result.checked} checked, ${result.orphaned} orphaned, ${result.deleted} deleted${dryRun ? ' (DRY RUN)' : ''}`);
    } catch (err) {
      console.error('[Cron] Cloudinary cleanup error:', err.message);
    }
  });

  // 19. Review summarization batch — Daily 08:00 UTC (10:00 Romania)
  // Regenerates AI summaries for businesses with 3+ new reviews since last summary
  cron.schedule('0 8 * * *', async () => {
    try {
      const { generateSummary } = require('./llm/summarizationService');
      const { LLM_CONFIG } = require('../config/llm');
      if (!LLM_CONFIG.apiKey) {
        console.log('[Cron] Review summarization skipped — no ANTHROPIC_API_KEY');
        return;
      }

      // Find businesses with enough reviews that need (re)generation
      const { rows: candidates } = await pool.query(`
        SELECT b.id, b.name,
               COUNT(r.id) as review_count,
               rs.review_count as summary_review_count
        FROM businesses b
        JOIN reviews r ON r.business_id = b.id
        LEFT JOIN review_summaries rs ON rs.business_id = b.id
        GROUP BY b.id, b.name, rs.id, rs.review_count
        HAVING COUNT(r.id) >= $1
          AND (rs.id IS NULL OR COUNT(r.id) - COALESCE(rs.review_count, 0) >= $2)
        ORDER BY COUNT(r.id) DESC
        LIMIT 50
      `, [LLM_CONFIG.summarization.minReviewCount, LLM_CONFIG.summarization.regenerateAfterNewReviews]);

      let generated = 0;
      let failed = 0;
      for (const biz of candidates) {
        try {
          await generateSummary(biz.id, { force: true });
          generated++;
          // Rate limit: 500ms between API calls
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          failed++;
          console.error(`[Cron] Summary failed for business ${biz.id} (${biz.name}):`, e.message);
        }
      }
      if (generated > 0 || failed > 0) {
        console.log(`[Cron] Review summarization batch: ${generated} generated, ${failed} failed (${candidates.length} candidates)`);
      }
    } catch (err) {
      console.error('[Cron] Review summarization cron error:', err.message);
    }
  });

  // 20. Compute performance scores — Daily 02:30 UTC (after category rankings at 02:00)
  cron.schedule('30 2 * * *', async () => {
    try {
      const result = await computePerformanceScores();
      console.log(`[Cron] Performance scores updated: ${result.offers} offers, ${result.businesses} businesses`);
    } catch (err) {
      console.error('[Cron] Performance scores computation failed:', err.message);
    }
  });

  // Seed performance scores on first startup if all zeros (fire-and-forget)
  (async () => {
    try {
      const check = await pool.query(
        "SELECT COUNT(*) as cnt FROM offers WHERE performance_score > 0"
      );
      if (parseInt(check.rows[0].cnt) === 0) {
        console.log('[Cron] Performance scores empty — seeding now...');
        const result = await computePerformanceScores();
        console.log(`[Cron] Performance scores seeded: ${result.offers} offers, ${result.businesses} businesses`);
      }
    } catch (err) {
      // Column may not exist yet (migration not run) — ignore gracefully
      if (!err.message.includes('does not exist')) {
        console.error('[Cron] Performance score seed check failed:', err.message);
      }
    }
  })();

  console.log('[Cron] All 19 scheduled jobs registered.');
}

/**
 * Compute performance scores for all active offers and businesses.
 * Uses Bayesian rating, engagement, conversion, recency, views, tier, and completeness.
 * Called by cron (every 2h) and admin recompute endpoint.
 * @returns {Promise<{offers: number, businesses: number}>}
 */
async function computePerformanceScores() {
  const client = await pool.connect();
  try {
    // Extend timeout for bulk computation (default 10s is too short)
    await client.query("SET statement_timeout = '60000'");
    await client.query('BEGIN');

    // ═══ OFFER SCORES ═══
    const offerResult = await client.query(`
      WITH global AS (
        SELECT COALESCE(AVG(rating), 3.0) AS avg_rating FROM reviews
      ),
      offer_stats AS (
        SELECT
          o.id,
          -- Bayesian rating: (C*M + sum) / (C + count) / 5
          (5.0 * g.avg_rating + COALESCE(r_agg.sum_rating, 0)) / (5.0 + COALESCE(r_agg.cnt, 0)) / 5.0 AS bayesian,
          -- Engagement 14d: favorites(2x) + clicks
          LEAST(1.0, (COALESCE(f_agg.fav14, 0) * 2 + COALESCE(bc_agg.clicks7, 0)) / 30.0) AS engagement,
          -- Conversion rate 30d: reveals / views
          LEAST(1.0, COALESCE(cr_agg.reveals30, 0)::float / GREATEST(COALESCE(ov_agg.views30, 0), 1) * 5.0) AS conversion,
          -- Recency: 1.0 at day 0, decays to 0 at 60 days
          GREATEST(0, 1.0 - LEAST(1.0, EXTRACT(EPOCH FROM (NOW() - o.start_date)) / 86400.0 / 60.0)) AS recency,
          -- View velocity 14d
          LEAST(1.0, COALESCE(ov_agg.views14, 0) / 50.0) AS velocity,
          -- Tier boost: premium=1.0, standard=0.4, free=0
          CASE WHEN sp.slug = 'premium' THEN 1.0
               WHEN sp.slug = 'standard' THEN 0.4
               ELSE 0 END AS tier,
          -- Completeness: image + description + promo
          (CASE WHEN o.image_url IS NOT NULL OR b.cover_image_url IS NOT NULL THEN 0.4 ELSE 0 END
           + CASE WHEN LENGTH(COALESCE(o.description, '')) > 50 THEN 0.3 ELSE 0 END
           + CASE WHEN pc_agg.has_promo THEN 0.3 ELSE 0 END
          ) AS completeness
        FROM offers o
        JOIN businesses b ON b.id = o.business_id
        CROSS JOIN global g
        LEFT JOIN (
          SELECT business_id, SUM(rating) AS sum_rating, COUNT(*) AS cnt
          FROM reviews GROUP BY business_id
        ) r_agg ON r_agg.business_id = o.business_id
        LEFT JOIN (
          SELECT offer_id,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '14 days') AS fav14
          FROM favorite_offers GROUP BY offer_id
        ) f_agg ON f_agg.offer_id = o.id
        LEFT JOIN (
          SELECT COALESCE(offer_id, business_id) AS ref_id,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS clicks7
          FROM business_clicks WHERE offer_id IS NOT NULL GROUP BY COALESCE(offer_id, business_id)
        ) bc_agg ON bc_agg.ref_id = o.id
        LEFT JOIN (
          SELECT offer_id,
            COUNT(*) FILTER (WHERE revealed_at > NOW() - INTERVAL '30 days') AS reveals30
          FROM code_reveals GROUP BY offer_id
        ) cr_agg ON cr_agg.offer_id = o.id
        LEFT JOIN (
          SELECT offer_id,
            COUNT(*) FILTER (WHERE viewed_at > NOW() - INTERVAL '30 days') AS views30,
            COUNT(*) FILTER (WHERE viewed_at > NOW() - INTERVAL '14 days') AS views14
          FROM offer_views GROUP BY offer_id
        ) ov_agg ON ov_agg.offer_id = o.id
        LEFT JOIN business_subscriptions bs ON bs.business_id = b.id AND bs.status IN ('active', 'trial')
        LEFT JOIN subscription_plans sp ON sp.id = bs.plan_id
        LEFT JOIN (
          SELECT pc.offer_id, TRUE AS has_promo
          FROM promo_codes pc WHERE pc.is_active = TRUE
          GROUP BY pc.offer_id
        ) pc_agg ON pc_agg.offer_id = o.id
        WHERE o.is_active = TRUE
          AND o.moderation_status IN ('approved', 'auto_approved')
      )
      UPDATE offers SET
        performance_score = ROUND((
          os.bayesian * 0.25
          + os.engagement * 0.20
          + os.conversion * 0.15
          + os.recency * 0.15
          + os.velocity * 0.10
          + os.tier * 0.10
          + os.completeness * 0.05
        )::numeric, 4),
        score_components = jsonb_build_object(
          'bayesian_rating', ROUND(os.bayesian::numeric, 4),
          'engagement', ROUND(os.engagement::numeric, 4),
          'conversion', ROUND(os.conversion::numeric, 4),
          'recency', ROUND(os.recency::numeric, 4),
          'view_velocity', ROUND(os.velocity::numeric, 4),
          'tier_boost', os.tier,
          'completeness', ROUND(os.completeness::numeric, 4)
        ),
        score_updated_at = NOW()
      FROM offer_stats os
      WHERE offers.id = os.id
    `);

    // Reset inactive offers to 0
    await client.query(`
      UPDATE offers SET performance_score = 0, score_updated_at = NOW()
      WHERE is_active = FALSE AND performance_score > 0
    `);

    // ═══ BUSINESS SCORES ═══
    const bizResult = await client.query(`
      WITH global AS (
        SELECT COALESCE(AVG(rating), 3.0) AS avg_rating FROM reviews
      ),
      biz_stats AS (
        SELECT
          b.id,
          -- Bayesian rating
          (5.0 * g.avg_rating + COALESCE(r_agg.sum_rating, 0)) / (5.0 + COALESCE(r_agg.cnt, 0)) / 5.0 AS bayesian,
          -- Completeness (8 factors, each weighted)
          (CASE WHEN b.logo_url IS NOT NULL THEN 0.20 ELSE 0 END
           + CASE WHEN b.cover_image_url IS NOT NULL THEN 0.10 ELSE 0 END
           + CASE WHEN LENGTH(COALESCE(b.description, '')) > 50 THEN 0.15 ELSE 0 END
           + CASE WHEN b.phone IS NOT NULL THEN 0.10 ELSE 0 END
           + CASE WHEN COALESCE(img_agg.img_count, 0) > 0 THEN 0.10 ELSE 0 END
           + CASE WHEN COALESCE(hrs_agg.has_hours, FALSE) THEN 0.15 ELSE 0 END
           + CASE WHEN COALESCE(cat_agg.has_catalog, FALSE) THEN 0.10 ELSE 0 END
           + CASE WHEN b.denumire_legala IS NOT NULL OR b.cui IS NOT NULL THEN 0.10 ELSE 0 END
          ) AS completeness,
          -- Offer activity
          LEAST(1.0, COALESCE(o_agg.active_offers, 0) / 5.0) AS offer_activity,
          -- Engagement 30d: views + clicks
          LEAST(1.0, (COALESCE(bv_agg.views30, 0) + COALESCE(bc_agg.clicks30, 0)) / 100.0) AS engagement,
          -- Tier boost
          CASE WHEN sp.slug = 'premium' THEN 1.0
               WHEN sp.slug = 'standard' THEN 0.4
               ELSE 0 END AS tier,
          -- Review volume
          LEAST(1.0, COALESCE(r_agg.cnt, 0) / 20.0) AS review_volume,
          -- Followers
          LEAST(1.0, COALESCE(fb_agg.follower_count, 0) / 50.0) AS followers
        FROM businesses b
        CROSS JOIN global g
        LEFT JOIN (
          SELECT business_id, SUM(rating) AS sum_rating, COUNT(*) AS cnt
          FROM reviews GROUP BY business_id
        ) r_agg ON r_agg.business_id = b.id
        LEFT JOIN (
          SELECT business_id, COUNT(*) AS img_count
          FROM business_images GROUP BY business_id
        ) img_agg ON img_agg.business_id = b.id
        LEFT JOIN (
          SELECT bl.business_id, TRUE AS has_hours
          FROM business_locations bl
          JOIN business_hours bh ON bh.location_id = bl.id
          GROUP BY bl.business_id
        ) hrs_agg ON hrs_agg.business_id = b.id
        LEFT JOIN (
          SELECT business_id, TRUE AS has_catalog
          FROM business_catalog_items WHERE is_active = TRUE
          GROUP BY business_id
        ) cat_agg ON cat_agg.business_id = b.id
        LEFT JOIN (
          SELECT business_id,
            COUNT(*) FILTER (WHERE is_active = TRUE
              AND moderation_status IN ('approved', 'auto_approved')
              AND (end_date IS NULL OR end_date >= CURRENT_DATE)) AS active_offers
          FROM offers GROUP BY business_id
        ) o_agg ON o_agg.business_id = b.id
        LEFT JOIN (
          SELECT business_id,
            COUNT(*) FILTER (WHERE viewed_at > NOW() - INTERVAL '30 days') AS views30
          FROM business_views GROUP BY business_id
        ) bv_agg ON bv_agg.business_id = b.id
        LEFT JOIN (
          SELECT business_id,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS clicks30
          FROM business_clicks GROUP BY business_id
        ) bc_agg ON bc_agg.business_id = b.id
        LEFT JOIN (
          SELECT business_id, COUNT(*) AS follower_count
          FROM followed_businesses GROUP BY business_id
        ) fb_agg ON fb_agg.business_id = b.id
        LEFT JOIN business_subscriptions bs ON bs.business_id = b.id AND bs.status IN ('active', 'trial')
        LEFT JOIN subscription_plans sp ON sp.id = bs.plan_id
      )
      UPDATE businesses SET
        performance_score = ROUND((
          bs.bayesian * 0.25
          + bs.completeness * 0.20
          + bs.offer_activity * 0.15
          + bs.engagement * 0.15
          + bs.tier * 0.10
          + bs.review_volume * 0.10
          + bs.followers * 0.05
        )::numeric, 4),
        completeness_score = ROUND(bs.completeness::numeric, 2),
        score_components = jsonb_build_object(
          'bayesian_rating', ROUND(bs.bayesian::numeric, 4),
          'completeness', ROUND(bs.completeness::numeric, 4),
          'offer_activity', ROUND(bs.offer_activity::numeric, 4),
          'engagement', ROUND(bs.engagement::numeric, 4),
          'tier_boost', bs.tier,
          'review_volume', ROUND(bs.review_volume::numeric, 4),
          'followers', ROUND(bs.followers::numeric, 4)
        ),
        score_updated_at = NOW()
      FROM biz_stats bs
      WHERE businesses.id = bs.id
    `);

    await client.query('COMMIT');

    cache.invalidateGroup('offers');
    cache.invalidateGroup('businesses');
    cache.invalidateGroup('homepage');

    return { offers: offerResult.rowCount, businesses: bizResult.rowCount };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { initCronJobs, computeCategoryRankings, runReviewPromptCron, computePerformanceScores };
