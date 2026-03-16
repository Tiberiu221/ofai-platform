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

      // Batch downgrade expired trials to free + sync badges (single transaction)
      if (trialResult.rows.length > 0) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const bizIds = trialResult.rows.map(r => r.business_id);
          const fromPlanIds = trialResult.rows.map(r => r.plan_id);
          const toPlanIds = trialResult.rows.map(() => freePlanId);
          // Batch insert free subscriptions
          await client.query(`
            INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
            SELECT unnest($1::int[]), unnest($2::int[]), 'active', 'none'
            ON CONFLICT (business_id) DO NOTHING
          `, [bizIds, toPlanIds]);
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
          // Batch insert free subscriptions
          await client.query(`
            INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
            SELECT unnest($1::int[]), unnest($2::int[]), 'active', 'none'
            ON CONFLICT (business_id) DO NOTHING
          `, [bizIds, toPlanIds]);
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
      if (result.rowCount > 0) console.log(`[Cron] Cleared ${result.rowCount} expired flash deals`);
    } catch (err) {
      console.error('[Cron] flash deals cleanup failed:', err.message);
    }
  });

  // 12. Post-redemption review prompt — Daily 10:00 UTC (12:00 Romania)
  cron.schedule('0 10 * * *', async () => {
    const { sendToUser } = require('./pushNotifications');

    try {
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
          console.error(`[Cron] Review prompt push failed for user ${row.user_id}:`, e.message);
        }
      }
      if (sent > 0) console.log(`[Cron] Sent ${sent} post-redemption review prompts`);
    } catch (err) {
      console.error('[Cron] Review prompt cron error:', err.message);
    }
  });

  // 13. Weekly digest — Sunday 17:00 UTC (19:00 Romania)
  cron.schedule('0 17 * * 0', async () => {
    const { sendToUser } = require('./pushNotifications');

    try {
      // Get users with active push tokens who haven't disabled weekly_digest
      const { rows: users } = await pool.query(`
        SELECT DISTINCT u.id AS user_id,
          (SELECT array_agg(pc.city_id) FROM user_preferred_cities pc WHERE pc.user_id = u.id) AS city_ids,
          (SELECT c.name FROM user_preferred_cities pc JOIN cities c ON c.id = pc.city_id WHERE pc.user_id = u.id LIMIT 1) AS city_name
        FROM users u
        JOIN push_tokens pt ON pt.user_id = u.id AND pt.is_active = TRUE
        WHERE NOT EXISTS (
          SELECT 1 FROM notification_preferences np
          WHERE np.user_id = u.id AND np.pref_key = 'weekly_digest' AND np.enabled = FALSE
        )
        LIMIT 500
      `);

      let sent = 0;
      for (const user of users) {
        try {
          const cityIds = user.city_ids || [];
          if (cityIds.length === 0) continue;

          const { rows: countRows } = await pool.query(`
            SELECT COUNT(*) AS cnt FROM offers
            WHERE is_active = TRUE
              AND moderation_status = 'approved'
              AND start_date >= CURRENT_DATE - 7
              AND city_id = ANY($1::int[])
          `, [cityIds]);

          const count = parseInt(countRows[0]?.cnt || '0', 10);
          if (count === 0) continue;

          const cityLabel = user.city_name || 'orașul tău';
          await sendToUser(pool, user.user_id, {
            title: `${count} oferte noi săptămâna asta`,
            body: `Descoperă cele mai noi reduceri în ${cityLabel}!`,
            data: { type: 'weekly_digest', deepLink: '/explore' },
          });
          sent++;
        } catch (e) {
          console.error(`[Cron] Weekly digest push failed for user ${user.user_id}:`, e.message);
        }
      }
      if (sent > 0) console.log(`[Cron] Sent ${sent} weekly digest notifications`);
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
            "o.moderation_status = 'approved'",
            `o.id > $1`,
          ];
          const params = [search.last_notified_offer_id];
          let paramIdx = 2;

          if (search.city_id) {
            conditions.push(`o.city_id = $${paramIdx++}`);
            params.push(search.city_id);
          }
          if (search.category_id) {
            conditions.push(`o.category_id = $${paramIdx++}`);
            params.push(search.category_id);
          }
          if (search.query) {
            conditions.push(`(o.title ILIKE $${paramIdx} OR o.description ILIKE $${paramIdx})`);
            params.push(`%${search.query}%`);
            paramIdx++;
          }

          const countResult = await pool.query(
            `SELECT COUNT(*) AS cnt, MAX(o.id) AS max_id FROM offers o WHERE ${conditions.join(' AND ')}`,
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

  // 15. Update category rankings for home feed — Every 2 days at 02:00 UTC
  cron.schedule('0 2 */2 * *', async () => {
    try {
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
            COUNT(DISTINCT o.id) FILTER (WHERE o.is_active = TRUE AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)) as offer_count
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
          HAVING COUNT(DISTINCT o.id) FILTER (WHERE o.is_active = TRUE AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)) >= 6
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
            AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
          GROUP BY b.category_id
          HAVING COUNT(DISTINCT o.id) >= 6
        )
      `);

      console.log(`[Cron] Category rankings updated: ${result.rowCount} categories ranked`);
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
        const seedResult = await pool.query(`
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
              COUNT(DISTINCT o.id) FILTER (WHERE o.is_active = TRUE AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)) as offer_count
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
            HAVING COUNT(DISTINCT o.id) FILTER (WHERE o.is_active = TRUE AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)) >= 6
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
        console.log(`[Cron] Category rankings seeded: ${seedResult.rowCount} categories`);
      }
    } catch (err) {
      console.error('[Cron] Category rankings seed check failed:', err.message);
    }
  })();

  console.log('[Cron] All 15 scheduled jobs registered.');
}

module.exports = { initCronJobs };
