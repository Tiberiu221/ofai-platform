# R07 — Fix Cancel History Plan ID

> **Severitate:** CRITICAL
> **Fisier:** `appredueri_backend/src/routes/business-portal.js`, linia ~1356-1361
> **Impact:** `subscription_history` logheaza `from_plan_id = to_plan_id` (acelasi plan) la anulare. Ar trebui sa fie `to_plan_id = free_plan_id`.

---

## Problema

```js
// Log to history
await pool.query(`
  INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
  SELECT bs.plan_id, bs.plan_id, bs.plan_id, 'cancelled', 'User requested cancellation'
  FROM business_subscriptions bs
  WHERE bs.id = $1
`, [result.rows[0].id]);
```

`SELECT bs.plan_id, bs.plan_id, bs.plan_id` — toate 3 valorile sunt identice:
- `business_id` = `bs.plan_id` ← **GRESIT** (ar trebui sa fie `bs.business_id`)
- `from_plan_id` = `bs.plan_id` ← corect
- `to_plan_id` = `bs.plan_id` ← **GRESIT** (ar trebui sa fie free plan ID)

Deci sunt **doua** erori:
1. `business_id` primeste `plan_id` in loc de `business_id`
2. `to_plan_id` primeste plan-ul curent in loc de free plan

---

## Fix

Inlocuieste blocul de INSERT cu:

```js
// Log to history
const freePlan = await pool.query(
  "SELECT id FROM subscription_plans WHERE slug = 'free'"
);
await pool.query(`
  INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
  SELECT bs.business_id, bs.plan_id, $2, 'cancelled', 'User requested cancellation'
  FROM business_subscriptions bs
  WHERE bs.id = $1
`, [result.rows[0].id, freePlan.rows[0].id]);
```

### Schimbari:
1. `bs.business_id` in loc de `bs.plan_id` pentru coloana `business_id`
2. `$2` (free plan ID) in loc de `bs.plan_id` pentru coloana `to_plan_id`
3. Se face un SELECT suplimentar pentru a obtine free plan ID

---

## Context

Cand user-ul anuleaza un abonament:
- `cancel_at_period_end = TRUE` — abonamentul ramane activ pana la sfarsitul perioadei
- La sfarsitul perioadei, cron job-ul (R05-R06 fix) il va expira si downgrada la free
- History entry-ul trebuie sa reflecte: `from = current plan`, `to = free` (planul la care se va reveni)

---

## Verificare

- [ ] Cancel subscription creeaza history entry cu `from_plan_id = plan curent`
- [ ] Cancel subscription creeaza history entry cu `to_plan_id = free plan ID`
- [ ] `business_id` in history entry este business ID (nu plan ID)
- [ ] Query: `SELECT * FROM subscription_history WHERE action = 'cancelled' ORDER BY id DESC LIMIT 5` — verifica manual
