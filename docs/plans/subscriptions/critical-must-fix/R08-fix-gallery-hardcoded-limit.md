# R08 — Fix Gallery Hardcoded Limit

> **Severitate:** CRITICAL
> **Fisier:** `appredueri_backend/src/routes/business-portal.js`, linia ~349
> **Impact:** Gallery upload este blocat la 8 imagini indiferent de plan. Premium (unlimited) si Standard (8) sunt tratate identic. Free (3 imagini) nu este aplicat — tot 8.

---

## Problema

```js
if (parseInt(countRes.rows[0].cnt) >= 8) {
  await client.query("ROLLBACK");
  return res.status(400).json({ message: "Maximum 8 imagini permise" });
}
```

Valoarea `8` este hardcodata. Tier limits din `subscription_plans.max_gallery_images`:
- Free: `3`
- Standard: `8`
- Premium: `NULL` (unlimited)

---

## Fix

Inlocuieste blocul de verificare (liniile ~344-352) cu:

```js
await client.query("BEGIN");

// Atomic count check with row lock to prevent race condition
const countRes = await client.query(
  "SELECT COUNT(*) as cnt FROM business_images WHERE business_id = $1 FOR UPDATE",
  [businessId]
);
const currentCount = parseInt(countRes.rows[0].cnt);

// Get tier-based gallery limit
const { getBusinessTier } = require('../helpers/tiers');
const { plan } = await getBusinessTier(pool, parseInt(businessId));
const galleryLimit = plan.max_gallery_images; // null = unlimited

if (galleryLimit !== null && currentCount >= galleryLimit) {
  await client.query("ROLLBACK");
  return res.status(400).json({
    message: `Ai atins limita de ${galleryLimit} imagini pentru planul ${plan.name}. Upgradeaza pentru mai multe.`,
    error: 'limit_reached',
    limit: galleryLimit,
    current: currentCount,
  });
}
```

### Nota importanta:
- `getBusinessTier` primeste `pool` (NU `client`). Cache-ul de planuri trebuie populat din pool, nu din transaction client.
- `galleryLimit === null` inseamna unlimited (Premium) — skip check.
- Eroarea include informatii structurate (`error`, `limit`, `current`) pentru ca frontend-ul sa poata afisa un upgrade prompt.

### Actualizare mesaj in EJS (manage.ejs)

Cauta si in manage.ejs gallery section mesajul hardcodat:
```html
Maximum 8 imagini.
```

Inlocuieste cu:
```html
Maximum <%= tier && tier.plan && tier.plan.max_gallery_images ? tier.plan.max_gallery_images : 8 %> imagini.
```

---

## Verificare

- [ ] Free tier: upload blocat dupa 3 imagini
- [ ] Standard tier: upload blocat dupa 8 imagini
- [ ] Premium tier: upload nelimitat (testezi cu 9+ imagini)
- [ ] Mesajul de eroare include numele planului
- [ ] Race condition: doua upload-uri simultane nu pot depasi limita (testezi cu `curl` parallel)
