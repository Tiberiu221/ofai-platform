# R04 — Fix tiers.js SELECT Column Collision

> **Severitate:** CRITICAL
> **Fisier:** `appredueri_backend/src/helpers/tiers.js`, functia `getBusinessTier()` (linia 38)
> **Impact:** `SELECT bs.*, sp.*` cauzeaza coliziune de coloane (`id`, `created_at`). `rows[0].id` returneaza `sp.id` in loc de `bs.id`. Pot aparea bug-uri subtile in orice cod care acceseaza `subscription.id` sau `subscription.created_at`.

---

## Problema

```js
const { rows } = await pool.query(`
  SELECT bs.*, sp.*,
         bs.id AS subscription_id,
         sp.id AS plan_id
  FROM business_subscriptions bs
  JOIN subscription_plans sp ON sp.id = bs.plan_id
  WHERE bs.business_id = $1
    AND bs.status IN ('active', 'trial')
  LIMIT 1
`, [businessId]);

if (rows.length > 0) {
  return {
    subscription: rows[0],   // ← AMBELE sunt rows[0]
    plan: rows[0],           // ← AMBELE sunt rows[0]
    tier: rows[0].slug,
    isTrial: rows[0].status === 'trial',
  };
}
```

### Ce se intampla:
- `bs.*` si `sp.*` au ambele: `id`, `created_at`
- In node-postgres, cand exista coloane duplicate, **ultima valoare** castiga
- `rows[0].id` = `sp.id` (plan ID, NU subscription ID)
- `rows[0].created_at` = `sp.created_at` (data crearii planului, NU data subscriptiei)
- `subscription` si `plan` sunt **acelasi obiect** — nu poti accesa proprietatile subscriptiei separat de cele ale planului

### Nota:
`isTrial: rows[0].status === 'trial'` functioneaza *intamplator* corect deoarece `subscription_plans` NU are coloana `status`, deci `rows[0].status` vine din `bs`. Dar acest lucru este fragil si nedocumentat.

---

## Fix

Inlocuieste `SELECT bs.*, sp.*` cu coloane explicite si separa obiectele `subscription` si `plan`:

```js
async function getBusinessTier(pool, businessId) {
  const { rows } = await pool.query(`
    SELECT
      bs.id              AS sub_id,
      bs.business_id,
      bs.plan_id,
      bs.status          AS sub_status,
      bs.billing_cycle,
      bs.current_period_start,
      bs.current_period_end,
      bs.trial_start,
      bs.trial_end,
      bs.cancel_at_period_end,
      bs.stripe_subscription_id,
      bs.stripe_customer_id,
      bs.created_at      AS sub_created_at,
      bs.updated_at      AS sub_updated_at,
      sp.id              AS plan_id,
      sp.slug,
      sp.name            AS plan_name,
      sp.price_monthly,
      sp.price_yearly,
      sp.max_active_offers,
      sp.max_gallery_images,
      sp.max_locations,
      sp.max_promo_codes_per_offer,
      sp.analytics_days,
      sp.can_respond_reviews,
      sp.can_upload_logo,
      sp.can_upload_cover,
      sp.has_verified_badge,
      sp.has_ai_summary,
      sp.has_push_on_offer,
      sp.has_custom_push,
      sp.has_analytics_charts,
      sp.has_analytics_export,
      sp.has_competitive_insights,
      sp.has_promoted_placement,
      sp.has_search_priority,
      sp.has_competitor_blocking,
      sp.has_deal_nomination,
      sp.has_booking,
      sp.has_priority_support,
      sp.badge_type,
      sp.sort_order
    FROM business_subscriptions bs
    JOIN subscription_plans sp ON sp.id = bs.plan_id
    WHERE bs.business_id = $1
      AND bs.status IN ('active', 'trial')
    LIMIT 1
  `, [businessId]);

  if (rows.length > 0) {
    const row = rows[0];
    return {
      subscription: {
        id: row.sub_id,
        business_id: row.business_id,
        plan_id: row.plan_id,
        status: row.sub_status,
        billing_cycle: row.billing_cycle,
        current_period_start: row.current_period_start,
        current_period_end: row.current_period_end,
        trial_start: row.trial_start,
        trial_end: row.trial_end,
        cancel_at_period_end: row.cancel_at_period_end,
        stripe_subscription_id: row.stripe_subscription_id,
        stripe_customer_id: row.stripe_customer_id,
        created_at: row.sub_created_at,
        updated_at: row.sub_updated_at,
      },
      plan: row, // row contine toate coloanele sp.* cu nume unice
      tier: row.slug,
      isTrial: row.sub_status === 'trial',
    };
  }

  // Fallback: free tier
  const plans = await getPlans(pool);
  return {
    subscription: null,
    plan: plans.free,
    tier: TIERS.FREE,
    isTrial: false,
  };
}
```

### Important
Dupa acest fix, `req.tier.subscription` si `req.tier.plan` sunt obiecte **diferite**. Verifica toate locurile care acceseaza `req.tier.subscription` sa foloseasca proprietatile corecte (ex: `.id` este acum `sub_id` pe subscription object, dar codul care accesa `req.tier.subscription.id` inainte primea plan_id — deci orice cod care depindea de asta trebuie verificat).

---

## Locuri de verificat dupa fix

Cauta in codebase:
```bash
grep -rn "req.tier.subscription\." src/routes/ src/views/
grep -rn "\.subscription\." src/routes/business-portal.js
```

Toate accesarile `.subscription.status`, `.subscription.id`, `.subscription.created_at` trebuie sa foloseasca noile nume (`sub_status`, `sub_id`, `sub_created_at`) SAU obiectul restructurat de mai sus.

---

## Verificare

- [ ] `getBusinessTier()` returneaza obiecte separate pentru `subscription` si `plan`
- [ ] `isTrial` returneaza `true` cand `bs.status = 'trial'`
- [ ] `req.tier.plan.max_active_offers` functioneaza pe rute protejate
- [ ] `req.tier.subscription.id` returneaza subscription ID (nu plan ID)
- [ ] Endpoint GET `/:businessId/subscription` returneaza date corecte
