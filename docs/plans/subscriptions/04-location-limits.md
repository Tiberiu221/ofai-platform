# 04 — Location Limits Per Business

> **Scop:** Enforce max locations per business based on subscription tier (Free=1, Standard=3, Premium=unlimited).
> **Dependinte:** `00-subscription-foundation.md` (tabele DB, tier helpers, middleware)
> **Fisiere afectate:**
> - `src/helpers/tiers.js` — new count function
> - `src/routes/admin.js` — location update route (line ~1375), location delete route (line ~1424), business edit route (line ~498)
> - `src/views/admin/business_locations.ejs` — show limit info, block "add" when at limit
> - Future: `src/routes/business-portal.js` — if location CRUD is added for business owners

---

## 1. Current State of Location Management

### Where locations are created

**There is NO location creation endpoint** in the codebase. Locations are ONLY created via:
1. `scripts/seed-businesses.js` — initial seeding
2. `scripts/scraping/02-enrich-and-insert.js` — scraping pipeline

### Where locations are managed

- `admin.js` line 1334: `GET /admin/businesses/:id/locations` — list locations
- `admin.js` line 1375: `POST /admin/businesses/:businessId/locations/:locationId` — update existing location (inline edit)
- `admin.js` line 1424: `POST /admin/businesses/:id/locations/:locId/delete` — delete location
- `admin.js` line 498: `POST /admin/businesses/:id/edit` — business edit page can update locations (array of existing locations)

### What does NOT exist yet
- No "Add new location" endpoint in admin.js or business-portal.js
- No location CRUD in business portal (business owners cannot manage locations)
- The `businesses` table itself has `city_id`, `address`, `lat`, `lng` (legacy single-location fields) plus the separate `business_locations` table

### Tier values (from migration 033):
| Tier | max_locations |
|------|--------------|
| Free | 1 |
| Standard | 3 |
| Premium | NULL (unlimited) |

---

## 2. Count Function

Add to `src/helpers/tiers.js`:

```js
/**
 * Count locations for a business.
 * Used by requireLimit('max_locations', countLocations).
 * @param {Pool} pool
 * @param {number} businessId
 * @returns {Promise<number>}
 */
async function countLocations(pool, businessId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM business_locations WHERE business_id = $1',
    [businessId]
  );
  return rows[0].cnt;
}
```

Update module.exports:
```js
module.exports = {
  TIERS, getPlans, getBusinessTier, hasFeature, checkLimit, invalidateCache,
  countActiveOffers, countPromoCodesForOffer, countLocations
};
```

---

## 3. Phase 1: Add "Create Location" Endpoint to admin.js

Since there is no location creation endpoint, we need to add one. Without it, there is nothing to enforce limits on (existing locations were seeded before tiers existed).

### 3a. Route: POST /admin/businesses/:businessId/locations/new

Add after the existing location routes (after line ~1437):

```js
// POST: Create new location for a business
router.post("/businesses/:businessId/locations/new", async (req, res) => {
  const { businessId } = req.params;
  const { city_id, address, phone, lat, lng } = req.body;

  const toNullableFloat = (v) => {
    if (v === "" || v == null) return null;
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  if (!city_id || !address) {
    return res.status(400).send("city_id și address sunt obligatorii");
  }

  try {
    // Check location limit
    const { getBusinessTier, countLocations } = require('../helpers/tiers');
    const currentCount = await countLocations(pool, parseInt(businessId));
    const { plan } = await getBusinessTier(pool, parseInt(businessId));
    const limit = plan.max_locations;

    if (limit !== null && currentCount >= limit) {
      // For admin UI: redirect with error param
      return res.redirect(
        `/admin/businesses/${businessId}/locations?err=` +
        encodeURIComponent(`Limită atinsă: ${currentCount}/${limit} locații pe planul ${plan.name}.`)
      );
    }

    await pool.query(
      `INSERT INTO business_locations (business_id, city_id, address, phone, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        Number(businessId),
        Number(city_id),
        address.trim(),
        phone || null,
        toNullableFloat(lat),
        toNullableFloat(lng),
      ]
    );

    res.redirect(`/admin/businesses/${businessId}/locations`);
  } catch (err) {
    console.error("Create location error:", err);
    res.status(500).send(`Eroare la creare locație: ${err.message}`);
  }
});
```

### 3b. Update business_locations.ejs to include "Add location" form

In `src/views/admin/business_locations.ejs`, add a form for creating new locations:

```html
<!-- After the existing locations list -->

<h3>Adaugă locație nouă</h3>

<% if (typeof err !== 'undefined' && err) { %>
  <div class="alert alert-danger"><%= err %></div>
<% } %>

<% if (locationLimitInfo && locationLimitInfo.isAtLimit) { %>
  <div class="alert alert-warning">
    Limita de <%= locationLimitInfo.limit %> locații a fost atinsă
    pe planul <%= locationLimitInfo.planName %>.
  </div>
<% } else { %>
  <form method="POST" action="/admin/businesses/<%= business.id %>/locations/new">
    <div class="form-row">
      <div class="form-group">
        <label>Oraș *</label>
        <select name="city_id" required>
          <option value="">-- Selectează --</option>
          <% cities.forEach(c => { %>
            <option value="<%= c.id %>"><%= c.name %></option>
          <% }); %>
        </select>
      </div>
      <div class="form-group">
        <label>Adresă *</label>
        <input type="text" name="address" required />
      </div>
      <div class="form-group">
        <label>Telefon</label>
        <input type="text" name="phone" />
      </div>
      <div class="form-group">
        <label>Lat</label>
        <input type="text" name="lat" placeholder="46.7712" />
      </div>
      <div class="form-group">
        <label>Lng</label>
        <input type="text" name="lng" placeholder="23.6236" />
      </div>
    </div>
    <button type="submit" class="btn btn-primary">Adaugă locație</button>
  </form>
<% } %>
```

### 3c. Pass limit info to the template

Update the `GET /admin/businesses/:id/locations` route (admin.js line ~1334) to include tier info:

```js
router.get("/businesses/:id/locations", async (req, res) => {
  const businessId = req.params.id;
  try {
    const businessResult = await pool.query(
      "SELECT id, name FROM businesses WHERE id = $1",
      [businessId]
    );
    if (businessResult.rows.length === 0)
      return res.status(404).send("Business not found");

    const citiesResult = await pool.query(
      "SELECT id, name FROM cities ORDER BY name ASC"
    );

    const locationsResult = await pool.query(
      `SELECT bl.*, c.name as city_name
       FROM business_locations bl
       LEFT JOIN cities c ON bl.city_id = c.id
       WHERE bl.business_id = $1
       ORDER BY bl.created_at DESC`,
      [businessId]
    );

    // --- NEW: Get tier info for location limit ---
    const { getBusinessTier } = require('../helpers/tiers');
    const tierInfo = await getBusinessTier(pool, parseInt(businessId));
    const locationCount = locationsResult.rows.length;
    const limit = tierInfo.plan.max_locations;

    res.render("admin/business_locations", {
      business: businessResult.rows[0],
      locations: locationsResult.rows,
      cities: citiesResult.rows,
      user: req.user,
      err: req.query.err || null,
      locationLimitInfo: {
        current: locationCount,
        limit: limit,
        planName: tierInfo.plan.name,
        tier: tierInfo.tier,
        isAtLimit: limit !== null && locationCount >= limit,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});
```

---

## 4. Phase 2: Guard Business Edit Route (admin.js line ~498)

The `POST /admin/businesses/:id/edit` route (line ~498) handles location UPDATES (not creation). It iterates over existing locations and updates their fields. Since this route only modifies existing locations (no INSERT), it does NOT need a location limit check.

However, verify this by reading the handler carefully. The relevant section (line ~553):

```js
if (Array.isArray(locations)) {
  for (const locData of locations) {
    const locId = parseInt(locData.id, 10);
    if (Number.isNaN(locId)) continue;
    // ... UPDATE business_locations WHERE id = locId ...
  }
}
```

This only updates existing rows by ID. No INSERT. **No limit check needed here.**

---

## 5. Phase 3: Future — Business Portal Location CRUD

When business owners get location management in the portal, add the same limit enforcement:

### 5a. Planned API endpoints

```
GET    /api/web/portal/:businessId/locations          — list locations
POST   /api/web/portal/:businessId/locations           — create location (with limit check)
PUT    /api/web/portal/:businessId/locations/:locId    — update location (no limit check)
DELETE /api/web/portal/:businessId/locations/:locId    — delete location
```

And for business-portal.js (mobile/Flutter):
```
GET    /:businessId/locations                          — list locations
POST   /:businessId/locations                          — create location (with limit check)
PUT    /:businessId/locations/:locId                   — update location (no limit check)
DELETE /:businessId/locations/:locId                   — delete location
```

### 5b. Planned middleware usage

```js
// business-portal.js
router.post("/:businessId/locations",
  businessAuth,
  requireLimit('max_locations', countLocations),
  async (req, res) => { ... }
);

// web.js
router.post("/api/web/portal/:businessId/locations",
  requireBusinessOwner,
  requireLimit('max_locations', countLocations),
  async (req, res) => { ... }
);
```

This follows the same pattern as `02-offer-limits.md`. The `requireLimit` middleware uses `attachTier` (already wired on `/:businessId` routes) and the `countLocations` function.

### 5c. Planned Flutter screen

A location management screen in the business portal section of the Flutter app would:
1. Fetch `GET /:businessId/subscription` to get `maxLocations`
2. Fetch `GET /:businessId/locations` to get current locations
3. Show "Add location" button only if `currentCount < maxLocations` (or `maxLocations === null`)
4. On 403 `limit_reached`, show upgrade dialog

**This is NOT in scope for this plan.** Create a separate plan when location management for business owners is prioritized.

---

## 6. Handling Existing Businesses

### 6a. Businesses with > 1 location on Free tier

Many businesses were seeded/scraped with multiple locations. When they are assigned to the Free tier (migration 033), they may have 2, 3, or more locations.

**Policy decision:** Grandfathered — existing locations remain. The limit only applies when creating NEW locations.

- `countLocations` returns the actual count (e.g., 3)
- Free tier limit is 1
- `requireLimit` will block new location creation (3 >= 1 = blocked)
- Existing locations continue to function
- Admin can still UPDATE existing locations (no limit check on update)
- Admin can DELETE locations (count decreases, potentially allowing new creation)

### 6b. Admin override

Admin operations should have an option to bypass tier limits. Two approaches:

**Option A (simple):** Admin location creation does NOT check tiers at all. Admins can always add locations regardless of tier. Remove the limit check from admin.js:

```js
// In admin.js create location route — add a skipTierCheck flag:
const ADMIN_BYPASS_TIER = true;

if (!ADMIN_BYPASS_TIER) {
  // tier check ...
}
```

**Option B (recommended):** Admin sees the limit info (banner showing "3/1 locations — over Free tier limit") but can still create. The form submits regardless. This provides awareness without blocking admin operations.

```html
<% if (locationLimitInfo.isAtLimit) { %>
  <div class="alert alert-warning">
    <strong>Atenție:</strong> Business-ul are <%= locationLimitInfo.current %>/<%= locationLimitInfo.limit %> locații
    (plan: <%= locationLimitInfo.planName %>). Adăugarea unei noi locații depășește limita.
    <br><small>Ca admin, poți adăuga oricum.</small>
  </div>
<% } %>
<!-- Form is NOT disabled for admin -->
```

**Recommended:** Option B. Admins should always be able to manage locations, but should see the tier context.

---

## 7. Race Condition Mitigation

Location creation is less prone to race conditions than offer creation because:
1. It is admin-only (single user typically)
2. When business portal location CRUD is added, use the same advisory lock pattern:

```sql
SELECT pg_advisory_xact_lock(hashtext('loc_limit_' || $1::text));
```

For the admin route, this is optional but harmless to include:

```js
// In the admin create location handler:
const client = await pool.connect();
try {
  await client.query("BEGIN");

  // Advisory lock per business
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('loc_limit_' || $1::text))",
    [String(businessId)]
  );

  // Count inside transaction
  const countRes = await client.query(
    "SELECT COUNT(*)::int AS cnt FROM business_locations WHERE business_id = $1",
    [businessId]
  );

  const { plan } = await getBusinessTier(client, parseInt(businessId));
  const limit = plan.max_locations;

  // Skip limit check for admin (Option B from section 6b)
  // but log a warning if over limit
  if (limit !== null && countRes.rows[0].cnt >= limit) {
    console.warn(`[Admin] Creating location for business ${businessId} over tier limit (${countRes.rows[0].cnt}/${limit})`);
  }

  await client.query(
    `INSERT INTO business_locations (business_id, city_id, address, phone, lat, lng)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [Number(businessId), Number(city_id), address.trim(), phone || null, toNullableFloat(lat), toNullableFloat(lng)]
  );

  await client.query("COMMIT");
  res.redirect(`/admin/businesses/${businessId}/locations`);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Create location error:", err);
  res.status(500).send(`Eroare la creare locație: ${err.message}`);
} finally {
  client.release();
}
```

---

## 8. API Response on Limit Hit (for future portal endpoints)

When the business portal location creation endpoint exists:

```json
{
  "error": "limit_reached",
  "message": "Ai atins limita de 1 locație pentru planul Gratuit.",
  "currentTier": "free",
  "limit": 1,
  "current": 1
}
```

HTTP status: **403 Forbidden**.

For admin routes, use a redirect with query param error message (since admin uses server-rendered EJS, not JSON API).

---

## 9. Gotchas

### 9a. No INSERT INTO business_locations exists anywhere in routes

This is the most important finding: the codebase has NO route that creates a new location. All existing locations came from seed/scraping scripts. This plan must create the admin endpoint first (Section 3) before any limit enforcement is meaningful.

### 9b. businesses table has legacy location fields

The `businesses` table itself has `city_id`, `address`, `lat`, `lng` columns — a legacy single-location model. The `business_locations` table is the multi-location model. Some businesses may have data in `businesses.address` but no row in `business_locations`. The `countLocations` function only counts `business_locations` rows, so these legacy entries would show count=0.

**Impact:** A Free tier business with 0 `business_locations` rows but a `businesses.address` could still create 1 location. This is acceptable because the `businesses` table address is being phased out in favor of `business_locations`.

### 9c. Deleting a location frees up a slot

If a business at the limit (e.g., Free tier with 1 location) deletes their location, the count drops to 0 and they can create a new one. This is correct behavior.

### 9d. Location count in manage.ejs portal

The business portal manage.ejs shows a "Locații" count. When tier enforcement is active, show the limit context:

```html
<!-- In manage.ejs, locations tab header: -->
Locații <span class="portal-tab-badge"><%= locations.length %><% if (tierInfo.maxLocations) { %>/<%= tierInfo.maxLocations %><% } %></span>
```

### 9e. Admin auth is HTTP Basic — no req.tier

Admin routes use HTTP Basic Auth, not the regular JWT auth. The `attachTier` middleware reads `req.params.businessId` (not from a user session). It should still work because `attachTier` looks up the business ID from the URL param, not from the authenticated user.

However, `attachTier` may not be wired on admin routes. For admin, call `getBusinessTier` directly instead of relying on middleware:

```js
const { getBusinessTier, countLocations } = require('../helpers/tiers');
// Use directly in the route handler, not as middleware
const tierInfo = await getBusinessTier(pool, parseInt(businessId));
```

### 9f. business_locations has booking columns

The `business_locations` table has `booking_type`, `booking_phone`, `booking_whatsapp`, `booking_url`, `booking_instructions` columns. The "Add location" form (Section 3b) does not include these. They can be set later via the inline edit form on the locations page. This keeps the creation form simple.

---

## 10. Migration: None Required

This plan does not require a new migration. The `max_locations` column already exists in `subscription_plans` (created in migration 033 from Plan 00), and the `business_locations` table already exists.

---

## 11. Files Changed Summary

| File | Change |
|------|--------|
| `src/helpers/tiers.js` | Add `countLocations` function |
| `src/routes/admin.js` | Add `POST /businesses/:businessId/locations/new` route, update `GET /businesses/:id/locations` to pass tier info |
| `src/views/admin/business_locations.ejs` | Add "create location" form, limit banner, error display |

---

## 12. Testing Checklist

### Admin location creation:
- [ ] Free tier business with 0 locations: create 1 -> succeeds
- [ ] Free tier business with 1 location: create another -> shows limit warning (admin can override per Option B)
- [ ] Standard tier business with 2 locations: create 1 -> succeeds (under limit of 3)
- [ ] Standard tier business with 3 locations: create 1 -> shows limit warning
- [ ] Premium tier business: create any number -> always succeeds (limit=NULL)

### Existing businesses:
- [ ] Business with 5 seeded locations on Free tier: all 5 locations display correctly
- [ ] Business with 5 locations on Free tier: cannot create 6th (but existing 5 remain)
- [ ] Deleting 4 locations, leaving 1: now under limit, can create again

### Admin UI:
- [ ] business_locations.ejs shows current/limit counts
- [ ] "Add location" form hidden or shows warning when at limit
- [ ] Error message displays on redirect after limit hit
- [ ] Admin can still override limit (Option B)

### Edge cases:
- [ ] Business with no subscription row (fallback to Free): limit=1 applied
- [ ] Business with expired subscription (downgraded to Free): limit=1 applied
- [ ] Legacy business with `businesses.address` but 0 `business_locations` rows: count=0, can create 1
