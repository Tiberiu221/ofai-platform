/**
 * Subscription Service
 * W9: Shared subscription logic used by both web portal and business portal routes.
 * Eliminates copy-paste duplication between business-portal.js and web.js.
 */

/**
 * Cancel a business subscription (mark as cancel_at_period_end).
 * Does NOT immediately downgrade — benefits remain active until period end.
 * Cron job handles actual downgrade + badge sync at expiry.
 *
 * @param {Pool} pool - PostgreSQL connection pool
 * @param {number} businessId - Business ID
 * @param {string} [source='api'] - Source identifier for logging ('web' or 'mobile')
 * @returns {Promise<{success: boolean, message: string, activeUntil: Date|null}>}
 */
async function cancelSubscription(pool, businessId, source = 'api') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mark as cancel at period end (don't immediately cancel)
    const result = await client.query(`
      UPDATE business_subscriptions
      SET cancel_at_period_end = TRUE, updated_at = NOW()
      WHERE business_id = $1
        AND status IN ('active')
        AND billing_cycle != 'none'
      RETURNING id, current_period_end
    `, [businessId]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: 'Nu exista un abonament activ de anulat.',
        activeUntil: null,
      };
    }

    // Log to history
    const freePlan = await client.query(
      "SELECT id FROM subscription_plans WHERE slug = 'free'"
    );
    if (!freePlan.rows[0]) {
      await client.query('ROLLBACK');
      throw new Error('Free plan missing from subscription_plans');
    }

    await client.query(`
      INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
      SELECT bs.business_id, bs.plan_id, $2, 'cancelled', $3
      FROM business_subscriptions bs
      WHERE bs.id = $1
    `, [result.rows[0].id, freePlan.rows[0].id, `User requested cancellation (${source})`]);

    await client.query('COMMIT');

    const periodEnd = result.rows[0].current_period_end;
    console.log(`[SubscriptionService] Subscription cancelled for business ${businessId} (${source}), active until ${periodEnd}`);

    return {
      success: true,
      message: 'Abonamentul a fost anulat. Beneficiile raman active pana la ' +
        new Date(periodEnd).toLocaleDateString('ro-RO') + '.',
      activeUntil: periodEnd,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { cancelSubscription };
