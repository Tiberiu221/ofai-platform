# 05 --- Analytics CSV Export

> **Scop:** Allow Premium tier businesses to export analytics data as CSV files from the manage portal.
> **Dependinte:** `00-subscription-foundation.md` (tier tables, `attachTier` middleware, `requireFeature`)
> **Fisiere afectate:**
> - `src/routes/web.js` (new endpoint)
> - `src/views/public/portal/manage.ejs` (export button UI)
> - `src/middleware/tierAuth.js` (used, not modified)

---

## 1. No New Dependencies

CSV generation will be done with manual string building (no new npm packages). The data volumes are small enough (max 90 rows per export) that streaming is unnecessary. This avoids adding a dependency for a trivial operation.

---

## 2. New Endpoint: `GET /api/web/portal/:businessId/analytics/export`

### Location

Add this endpoint in `src/routes/web.js`, immediately after the existing `analytics/clicks` endpoint (currently at line ~2536). The endpoint uses `requireBusinessOwner` (cookie-based web auth) exactly like the other analytics endpoints in `web.js`.

### Signature

```
GET /api/web/portal/:businessId/analytics/export
  ?type=views|subscribers|clicks|offer-views|code-reveals
  &days=7|30|90
  &offer_id=<int>       (required when type=offer-views)
  &action_type=<string>  (optional when type=clicks; one of phone|whatsapp|navigate|booking_url)
```

### Response Headers

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="analytics-views-2026-03-03.csv"
X-Content-Type-Options: nosniff
```

### Middleware Chain

```js
router.get(
  "/api/web/portal/:businessId/analytics/export",
  requireBusinessOwner,
  attachTier(pool),          // from tierAuth.js — sets req.tier
  requireFeature('has_analytics_export'),  // from tierAuth.js — 403 if not Premium
  async (req, res) => { ... }
);
```

**IMPORTANT:** The existing web.js analytics endpoints use `requireBusinessOwner` from `businessWebAuth.js` (cookie auth). This new endpoint does the same. The `attachTier` and `requireFeature` middleware from `tierAuth.js` (plan 00) must also be imported at the top of `web.js`:

```js
// Add to imports at top of web.js (around line 18):
const { attachTier, requireFeature } = require('../middleware/tierAuth');
```

### Full Endpoint Code

```js
// Analytics CSV Export (Premium only)
router.get("/api/web/portal/:businessId/analytics/export",
  requireBusinessOwner, attachTier(pool), requireFeature('has_analytics_export'),
  async (req, res) => {
  try {
    const { businessId } = req.params;
    const type = req.query.type || 'views';
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 90);

    const validTypes = ['views', 'subscribers', 'clicks', 'offer-views', 'code-reveals'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Tip invalid. Opțiuni: ' + validTypes.join(', ') });
    }

    let csvRows = [];  // Array of { date, value } objects
    let csvHeader = '';
    let filenameType = type;

    switch (type) {
      case 'views': {
        csvHeader = 'Data,Vizualizari';
        const result = await pool.query(
          `SELECT DATE(viewed_at) as date, COUNT(*) as cnt
           FROM business_views
           WHERE business_id = $1 AND viewed_at >= NOW() - INTERVAL '1 day' * $2
           GROUP BY DATE(viewed_at)
           ORDER BY date ASC`,
          [businessId, days]
        );
        csvRows = fillMissingDays(result.rows, days, 'cnt');
        break;
      }

      case 'subscribers': {
        csvHeader = 'Data,Abonati noi';
        const result = await pool.query(
          `SELECT DATE(created_at) as date, COUNT(*) as cnt
           FROM followed_businesses
           WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2
           GROUP BY DATE(created_at)
           ORDER BY date ASC`,
          [businessId, days]
        );
        csvRows = fillMissingDays(result.rows, days, 'cnt');
        break;
      }

      case 'clicks': {
        const validActionTypes = ['phone', 'whatsapp', 'navigate', 'booking_url'];
        const actionType = validActionTypes.includes(req.query.action_type)
          ? req.query.action_type : null;

        csvHeader = actionType
          ? 'Data,Click-uri (' + actionType + ')'
          : 'Data,Click-uri (toate)';
        filenameType = actionType ? 'clicks-' + actionType : 'clicks';

        const params = actionType
          ? [businessId, days, actionType]
          : [businessId, days];
        const actionFilter = actionType ? ' AND action_type = $3' : '';

        const result = await pool.query(
          `SELECT DATE(created_at) as date, COUNT(*) as cnt
           FROM business_clicks
           WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '1 day' * $2${actionFilter}
           GROUP BY DATE(created_at)
           ORDER BY date ASC`,
          params
        );
        csvRows = fillMissingDays(result.rows, days, 'cnt');
        break;
      }

      case 'offer-views': {
        const offerId = parseInt(req.query.offer_id);
        if (!offerId || isNaN(offerId)) {
          return res.status(400).json({ message: 'offer_id este obligatoriu pentru tip offer-views' });
        }
        // Verify offer belongs to this business
        const ownerCheck = await pool.query(
          'SELECT id, title FROM offers WHERE id = $1 AND business_id = $2',
          [offerId, businessId]
        );
        if (ownerCheck.rows.length === 0) {
          return res.status(404).json({ message: 'Oferta nu a fost gasita' });
        }

        csvHeader = 'Data,Vizualizari oferta';
        filenameType = 'offer-views-' + offerId;

        const result = await pool.query(
          `SELECT DATE(viewed_at) as date, COUNT(*) as cnt
           FROM offer_views
           WHERE offer_id = $1 AND viewed_at >= NOW() - INTERVAL '1 day' * $2
           GROUP BY DATE(viewed_at)
           ORDER BY date ASC`,
          [offerId, days]
        );
        csvRows = fillMissingDays(result.rows, days, 'cnt');
        break;
      }

      case 'code-reveals': {
        csvHeader = 'Data,Coduri dezvăluite';
        const result = await pool.query(
          `SELECT DATE(cr.revealed_at) as date, COUNT(*) as cnt
           FROM code_reveals cr
           JOIN offers o ON cr.offer_id = o.id
           WHERE o.business_id = $1 AND cr.revealed_at >= NOW() - INTERVAL '1 day' * $2
           GROUP BY DATE(cr.revealed_at)
           ORDER BY date ASC`,
          [businessId, days]
        );
        csvRows = fillMissingDays(result.rows, days, 'cnt');
        break;
      }
    }

    // Build CSV string
    const today = new Date().toISOString().split('T')[0];
    const filename = `analytics-${filenameType}-${today}.csv`;

    // BOM for Excel Romanian diacritics compatibility
    const BOM = '\uFEFF';
    let csv = BOM + csvHeader + '\r\n';
    for (const row of csvRows) {
      csv += row.date + ',' + row.value + '\r\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(csv);

  } catch (err) {
    console.error('[Web API] Analytics export error:', err);
    res.status(500).json({ message: 'Eroare la export' });
  }
});

// Helper: fill missing days with 0 (reusable)
function fillMissingDays(rows, days, valueKey) {
  const filled = [];
  const now = new Date();
  const rowMap = {};
  for (const r of rows) {
    const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date);
    rowMap[dateStr] = parseInt(r[valueKey]) || 0;
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    filled.push({ date: dateStr, value: rowMap[dateStr] || 0 });
  }
  return filled;
}
```

---

## 3. UI Changes in `manage.ejs`

### 3.1 Pass tier info to the template

In `web.js`, the route that renders the manage page is at line ~1764:

```js
router.get("/portal/:businessId", requireBusinessOwner, async (req, res) => {
```

After plan 00 integration, this route should also attach tier info. Add `attachTier(pool)` to the middleware chain:

```js
router.get("/portal/:businessId", requireBusinessOwner, attachTier(pool), async (req, res) => {
```

Then pass tier info to the EJS template in the `res.render()` call. Find the existing `res.render("public/portal/manage", { ... })` call and add:

```js
tier: req.tier || { tier: 'free', plan: {} },
```

### 3.2 Export button in manage.ejs

Add the export button inside the Charts `glass-card`, next to the period selector buttons (line ~1076). The button should be visible only for Premium tier.

Find this block (around line 1076-1085):

```html
<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
  <h3 class="section-title" style="border: none; margin: 0; padding: 0;">Grafice</h3>
  <div class="period-selector">
    <button class="period-btn grouping-btn" id="grouping-toggle" onclick="toggleGrouping(this)">Saptamanal</button>
    <span class="period-separator"></span>
    <button class="period-btn" onclick="changePeriod(7, this)">7 zile</button>
    <button class="period-btn active" onclick="changePeriod(30, this)">30 zile</button>
    <button class="period-btn" onclick="changePeriod(90, this)">90 zile</button>
  </div>
</div>
```

Replace with:

```html
<div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
  <h3 class="section-title" style="border: none; margin: 0; padding: 0;">Grafice</h3>
  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
    <% if (tier && tier.plan && tier.plan.has_analytics_export) { %>
      <div class="csv-export-dropdown" style="position: relative;">
        <button class="period-btn" onclick="toggleExportDropdown(event)" title="Exporta CSV"
                style="display: flex; align-items: center; gap: 4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          CSV
        </button>
        <div id="export-dropdown" class="export-dropdown-menu" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 4px; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 4px 0; min-width: 200px; z-index: 50; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
          <a class="export-option" onclick="exportCSV('views')">Vizualizari pagina</a>
          <a class="export-option" onclick="exportCSV('subscribers')">Abonati noi</a>
          <a class="export-option" onclick="exportCSV('clicks')">Click-uri</a>
          <a class="export-option" onclick="exportCSV('code-reveals')">Coduri dezvaluite</a>
        </div>
      </div>
    <% } %>
    <div class="period-selector">
      <button class="period-btn grouping-btn" id="grouping-toggle" onclick="toggleGrouping(this)">Saptamanal</button>
      <span class="period-separator"></span>
      <button class="period-btn" onclick="changePeriod(7, this)">7 zile</button>
      <button class="period-btn active" onclick="changePeriod(30, this)">30 zile</button>
      <button class="period-btn" onclick="changePeriod(90, this)">90 zile</button>
    </div>
  </div>
</div>
```

### 3.3 CSS for export dropdown

Add this CSS inside the existing `<style>` block in manage.ejs (around the `.chart-container` styles, line ~379):

```css
.export-option {
  display: block;
  padding: 8px 16px;
  color: #e4e4e7;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
  text-decoration: none;
}
.export-option:hover {
  background: rgba(251, 146, 60, 0.15);
  color: #fb923c;
}
```

### 3.4 JavaScript for export

Add this inside the existing IIFE `(function() { ... })()` in the `<script>` block at the end of manage.ejs (e.g., after the `loadCharts` function, around line 1802):

```js
/* -- CSV Export -- */
window.toggleExportDropdown = function(e) {
  e.stopPropagation();
  var dd = document.getElementById('export-dropdown');
  var isVisible = dd.style.display !== 'none';
  dd.style.display = isVisible ? 'none' : 'block';

  // Close on outside click
  if (!isVisible) {
    function closeExport(ev) {
      if (!dd.contains(ev.target)) {
        dd.style.display = 'none';
        document.removeEventListener('click', closeExport);
      }
    }
    setTimeout(function() {
      document.addEventListener('click', closeExport);
    }, 0);
  }
};

window.exportCSV = function(type) {
  document.getElementById('export-dropdown').style.display = 'none';
  var url = '/api/web/portal/' + businessId + '/analytics/export?type=' + type + '&days=' + currentPeriod;

  // For clicks, include current action_type filter
  if (type === 'clicks' && currentClicksAction) {
    url += '&action_type=' + currentClicksAction;
  }

  // Trigger download via hidden link
  var a = document.createElement('a');
  a.href = url;
  a.download = '';  // browser will use Content-Disposition filename
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showToast('Export CSV descarcet!', 'success');
};
```

---

## 4. How `requireFeature` integrates with the web (cookie) auth flow

The existing web.js analytics endpoints use `requireBusinessOwner` (cookie-based auth from `businessWebAuth.js`). Plan 00's `attachTier` and `requireFeature` middleware from `tierAuth.js` expect `req.params.businessId` to be set, which `requireBusinessOwner` already provides.

**Key detail:** `requireFeature` returns JSON `{ error: 'upgrade_required' }` with status 403. Since this is an API endpoint (not a page render), JSON is correct. The frontend JS (`exportCSV`) triggers a download via an `<a>` link, so on 403 the browser will display/download the JSON error. To handle this gracefully, modify the `exportCSV` function to use `apiFetch` instead:

```js
window.exportCSV = function(type) {
  document.getElementById('export-dropdown').style.display = 'none';
  var url = '/api/web/portal/' + businessId + '/analytics/export?type=' + type + '&days=' + currentPeriod;

  if (type === 'clicks' && currentClicksAction) {
    url += '&action_type=' + currentClicksAction;
  }

  // Use apiFetch to handle 401/403, then trigger download via blob
  apiFetch(url)
    .then(function(res) {
      if (!res.ok) {
        return res.json().then(function(data) {
          if (data.error === 'upgrade_required') {
            showToast('Exportul CSV necesita planul Premium', 'error');
          } else {
            showToast('Eroare la export', 'error');
          }
          throw new Error('export_failed');
        });
      }
      return res.blob();
    })
    .then(function(blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      var today = new Date().toISOString().split('T')[0];
      a.download = 'analytics-' + type + '-' + today + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      showToast('Export CSV descarcat!', 'success');
    })
    .catch(function(err) {
      if (err.message !== 'export_failed') {
        console.error('[Export] Error:', err);
        showToast('Eroare la export', 'error');
      }
    });
};
```

---

## 5. Gotchas

1. **BOM for Excel:** The CSV starts with `\uFEFF` (UTF-8 BOM). Without this, Excel on Windows will mangle Romanian diacritics in the headers. This is critical for Romanian users.

2. **`fillMissingDays` helper:** This is a standalone function defined outside the route handler. Place it at the end of `web.js` (before `module.exports`) or extract to `src/helpers/analytics.js`. The existing analytics endpoints in `web.js` each have their own inline fill logic -- this helper replaces all of them. However, to minimize diff size, only the new export endpoint uses this helper; the existing endpoints stay unchanged.

3. **CSRF on GET requests:** The existing `apiFetch` in manage.ejs adds the `X-CSRF-Token` header. GET requests are typically exempt from CSRF checks, but verify that the `csrf-csrf` middleware in `index.js` does not block GET requests. It should not (CSRF protection is for state-changing methods only), but double-check.

4. **Date timezone:** The `DATE(viewed_at)` cast in PostgreSQL uses the server timezone. The existing analytics endpoints already do this same cast, so the export is consistent with the charts. However, dates in the CSV will be in server-local timezone (UTC on Railway). Document this if questioned.

5. **No streaming needed:** Max 90 data points per CSV (one row per day for 90 days). This is ~3-5KB of data. Streaming (`res.write` chunks) is unnecessary overhead.

6. **Max days capped at 90:** The `analytics_days` column in `subscription_plans` controls which period buttons are available in the UI. Premium gets 90 days. The endpoint independently caps at 90 (`Math.min(..., 90)`) for safety, but the UI should only show the period buttons allowed by the tier.

7. **The export button is client-side gated:** The `<% if (tier.plan.has_analytics_export) %>` EJS conditional hides the button for non-Premium tiers. The `requireFeature` middleware is the server-side gate. Both must be in place (defense in depth).

8. **`apiFetch` includes credentials:** The existing `apiFetch` function in manage.ejs uses `fetch(url, options)` which by default includes same-origin cookies. This is needed for `requireBusinessOwner` to read the `ofai_token` cookie. The blob download approach works because the browser sends cookies with the fetch request.

---

## 6. Verification Checklist

After implementation:
- [ ] `GET /api/web/portal/:businessId/analytics/export?type=views&days=30` returns CSV with correct headers
- [ ] CSV file opens correctly in Excel with Romanian diacritics
- [ ] Free tier business gets 403 `{ error: 'upgrade_required' }` response
- [ ] Premium tier business gets CSV download
- [ ] Export button is hidden in manage.ejs for Free/Standard tiers
- [ ] Export button is visible for Premium tier
- [ ] Dropdown opens/closes correctly
- [ ] All 5 export types (views, subscribers, clicks, offer-views, code-reveals) produce correct data
- [ ] `offer-views` export requires `offer_id` param and validates ownership
- [ ] Dates are filled with 0 for missing days (no gaps)
