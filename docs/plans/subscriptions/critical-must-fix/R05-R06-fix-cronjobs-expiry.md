# R05 + R06 — Fix cronJobs.js Subscription Expiry

> **Severitate:** CRITICAL
> **Fisier:** `appredueri_backend/src/services/cronJobs.js`, cron #7 (linia ~88-133)
> **Impact:** R5: Badge-ul ramane "verified"/"premium" dupa expirarea trial-ului. R6: Business-urile cu subscriptie platita expirata raman blocate in status "expired" fara free plan.

---

## R5: Trial expiry nu apeleaza `syncBadgeType`

### Problema (linia ~101-114)

```js
if (trialResult.rows.length > 0) {
  const freePlan = await pool.query(
    "SELECT id FROM subscription_plans WHERE slug = 'free'"
  );
  for (const row of trialResult.rows) {
    await pool.query(`
      INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
      VALUES ($1, $2, 'active', 'none')
    `, [row.business_id, freePlan.rows[0].id]);
    await pool.query(`
      INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
      VALUES ($1, NULL, $2, 'trial_expired', 'Trial period ended')
    `, [row.business_id, freePlan.rows[0].id]);
    // ← LIPSA: syncBadgeType(pool, row.business_id, null)
  }
}
```

Dupa expirarea trial-ului, badge-ul de pe `businesses.subscription_badge_type` ramane setat pe `'verified'` sau `'premium'` — business-ul apare in continuare cu badge desi nu mai are subscriptie.

---

## R6: Paid subscription expiry — fara badge clear si fara free plan

### Problema (linia ~117-125)

```js
// Expire paid subscriptions past period_end
await pool.query(`
  UPDATE business_subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND billing_cycle != 'none'
    AND current_period_end < NOW()
    AND stripe_subscription_id IS NULL
`);
```

Aceasta operatie:
1. Marcheaza subscriptia ca 'expired' ✓
2. **NU** insereaza o subscriptie free noua ✗
3. **NU** curata badge-ul ✗
4. **NU** logheaza in subscription_history ✗

Rezultat: business-ul ramane cu status "expired" si **nicio subscriptie activa** — orice `getBusinessTier()` va cadea pe fallback-ul free dar fara sa aiba row in DB.

---

## Fix

Inlocuieste sectiunea cron #7 (de la `// 7. Check subscription expirations` pana la `});` de inchidere) cu:

```js
// 7. Check subscription expirations — Daily 04:00 UTC
cron.schedule('0 4 * * *', async () => {
  const { syncBadgeType } = require('../helpers/tiers');

  try {
    // Get free plan ID (needed for downgrades)
    const freePlanResult = await pool.query(
      "SELECT id FROM subscription_plans WHERE slug = 'free'"
    );
    const freePlanId = freePlanResult.rows[0].id;

    // ── Expire trials that have ended ──
    const trialResult = await pool.query(`
      UPDATE business_subscriptions
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'trial'
        AND trial_end < NOW()
      RETURNING business_id, plan_id
    `);

    // Downgrade expired trials to free + clear badge
    for (const row of trialResult.rows) {
      await pool.query(`
        INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
        VALUES ($1, $2, 'active', 'none')
      `, [row.business_id, freePlanId]);

      await pool.query(`
        INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
        VALUES ($1, $2, $3, 'trial_expired', 'Trial period ended')
      `, [row.business_id, row.plan_id, freePlanId]);

      // R5 FIX: Clear badge
      await syncBadgeType(pool, row.business_id, null);
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

    // R6 FIX: Downgrade expired paid subs to free + clear badge + log history
    for (const row of paidResult.rows) {
      await pool.query(`
        INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
        VALUES ($1, $2, 'active', 'none')
      `, [row.business_id, freePlanId]);

      await pool.query(`
        INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
        VALUES ($1, $2, $3, 'expired', 'Paid subscription period ended without renewal')
      `, [row.business_id, row.plan_id, freePlanId]);

      // Clear badge
      await syncBadgeType(pool, row.business_id, null);
    }

    const total = trialResult.rows.length + paidResult.rows.length;
    if (total > 0) {
      console.log(`[Cron] Subscription check: ${trialResult.rows.length} trials + ${paidResult.rows.length} paid expired, downgraded to free`);
    }
  } catch (err) {
    console.error('[Cron] Subscription expiry check error:', err.message);
  }
});
```

### Schimbari cheie:
1. `RETURNING business_id, plan_id` — recupereaza plan_id-ul vechi pentru history
2. `syncBadgeType(pool, row.business_id, null)` — curata badge-ul
3. Paid expiry face aceleasi operatii ca trial expiry (insert free + history + badge clear)
4. `from_plan_id` in history este corect (plan-ul vechi, nu NULL)

---

## Verificare

- [ ] Trial expirat → badge-ul devine NULL pe businesses
- [ ] Paid expirat → badge-ul devine NULL pe businesses
- [ ] Paid expirat → exista un row 'active' cu plan='free' in business_subscriptions
- [ ] subscription_history are entry corect cu from_plan_id = plan vechi, to_plan_id = free
- [ ] `getBusinessTier()` returneaza 'free' dupa expirare
