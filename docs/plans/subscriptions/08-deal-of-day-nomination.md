# 08 — Deal of the Day Self-Nomination

> **Scop:** Premium businesses can nominate their offers for Deal of the Day (max 1x per 7 rolling days).
> **Dependinte:** `00-subscription-foundation.md` (tables + tier helpers + middleware)
> **Fisiere afectate:**
> - `appredueri_backend/src/migrations/034_deal_nominations.sql` (NOU)
> - `appredueri_backend/src/routes/business-portal.js` (new endpoints)
> - `appredueri_backend/src/views/public/portal/manage.ejs` (UI button + indicator)
> - `appredueri_backend/src/services/cronJobs.js` (daily selection + expiry cron)
> - `appredueri_backend/src/routes/web.js` (deal-of-day selection logic, lines ~103-136)
> - `appredueri_backend/src/routes/offers.js` (mobile deal-of-day endpoint, lines ~315-370)

---

## 1. Migration: `034_deal_nominations.sql`

```sql
-- Deal of the Day nominations queue
CREATE TABLE IF NOT EXISTS deal_nominations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  nominated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  selected_for_date DATE,                 -- NULL until selected by cron
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending'  = waiting in queue
    -- 'selected' = chosen for a specific date
    -- 'expired'  = nomination aged out (14 days) without selection
    -- 'cancelled' = business cancelled or offer became inactive
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup: pending nominations ordered by age (for selection cron)
CREATE INDEX idx_deal_nominations_pending
  ON deal_nominations(nominated_at ASC)
  WHERE status = 'pending';

-- Fast lookup: selected nomination for a specific date
CREATE INDEX idx_deal_nominations_selected_date
  ON deal_nominations(selected_for_date)
  WHERE status = 'selected';

-- Fast lookup: recent nominations per business (for rate-limit check)
CREATE INDEX idx_deal_nominations_business_recent
  ON deal_nominations(business_id, nominated_at DESC);

-- Prevent double-nomination of the same offer while pending
CREATE UNIQUE INDEX idx_deal_nominations_unique_pending_offer
  ON deal_nominations(offer_id)
  WHERE status = 'pending';
```

---

## 2. Endpoint: `POST /portal/:businessId/nominations`

**File:** `appredueri_backend/src/routes/business-portal.js`

Add after existing offer-related endpoints (around line ~450):

```js
const { requireFeature } = require('../middleware/tierAuth');

// =====================================
//   DEAL OF THE DAY NOMINATION
// =====================================
router.post(
  '/:businessId/nominations',
  businessAuth,
  requireFeature('has_deal_nomination'),
  async (req, res) => {
    const { businessId } = req.params;
    const { offerId } = req.body;

    if (!offerId) {
      return res.status(400).json({ error: 'offerId este obligatoriu' });
    }

    try {
      // 1. Verify the offer belongs to this business AND is active + not expired
      const offerCheck = await pool.query(`
        SELECT id, title, is_active, end_date
        FROM offers
        WHERE id = $1 AND business_id = $2
      `, [offerId, businessId]);

      if (offerCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Oferta nu a fost gasita pentru acest business' });
      }

      const offer = offerCheck.rows[0];
      if (!offer.is_active) {
        return res.status(400).json({ error: 'Oferta trebuie sa fie activa pentru nominalizare' });
      }
      if (offer.end_date && new Date(offer.end_date) < new Date()) {
        return res.status(400).json({ error: 'Oferta a expirat' });
      }
      // Offer must have at least 2 days of validity remaining
      // (to allow time for selection before it expires)
      const twoDaysFromNow = new Date();
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
      if (offer.end_date && new Date(offer.end_date) < twoDaysFromNow) {
        return res.status(400).json({
          error: 'Oferta trebuie sa fie valabila cel putin 2 zile de la nominalizare'
        });
      }

      // 2. Rate limit: 1 nomination per 7 rolling days per business
      const recentNom = await pool.query(`
        SELECT id, nominated_at FROM deal_nominations
        WHERE business_id = $1
          AND nominated_at > NOW() - INTERVAL '7 days'
          AND status IN ('pending', 'selected')
        ORDER BY nominated_at DESC
        LIMIT 1
      `, [businessId]);

      if (recentNom.rows.length > 0) {
        const nextAllowed = new Date(recentNom.rows[0].nominated_at);
        nextAllowed.setDate(nextAllowed.getDate() + 7);
        return res.status(429).json({
          error: 'rate_limited',
          message: `Poti nominaliza din nou dupa ${nextAllowed.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`,
          nextAllowedAt: nextAllowed.toISOString(),
        });
      }

      // 3. Check the offer is not already pending nomination
      const alreadyPending = await pool.query(`
        SELECT id FROM deal_nominations
        WHERE offer_id = $1 AND status = 'pending'
      `, [offerId]);

      if (alreadyPending.rows.length > 0) {
        return res.status(409).json({ error: 'Aceasta oferta este deja nominalizata' });
      }

      // 4. Insert nomination
      const result = await pool.query(`
        INSERT INTO deal_nominations (business_id, offer_id, nominated_at, status)
        VALUES ($1, $2, NOW(), 'pending')
        RETURNING id, nominated_at, status
      `, [businessId, offerId]);

      console.log(`[Nominations] Business ${businessId} nominated offer ${offerId} for Deal of the Day`);

      res.status(201).json({
        nomination: result.rows[0],
        message: 'Oferta a fost nominalizata cu succes pentru Oferta Zilei!',
      });
    } catch (err) {
      // Handle unique constraint violation (concurrent request)
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Aceasta oferta este deja nominalizata' });
      }
      console.error('[Nominations] Error:', err);
      res.status(500).json({ error: 'Eroare server' });
    }
  }
);
```

---

## 3. Endpoint: `DELETE /portal/:businessId/nominations/:nominationId`

**File:** `appredueri_backend/src/routes/business-portal.js`

```js
// Cancel a pending nomination
router.delete(
  '/:businessId/nominations/:nominationId',
  businessAuth,
  async (req, res) => {
    const { businessId, nominationId } = req.params;

    try {
      const result = await pool.query(`
        UPDATE deal_nominations
        SET status = 'cancelled'
        WHERE id = $1 AND business_id = $2 AND status = 'pending'
        RETURNING id
      `, [nominationId, businessId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Nominalizare negasita sau nu poate fi anulata' });
      }

      res.json({ message: 'Nominalizare anulata' });
    } catch (err) {
      console.error('[Nominations] Cancel error:', err);
      res.status(500).json({ error: 'Eroare server' });
    }
  }
);
```

---

## 4. Endpoint: `GET /portal/:businessId/nominations`

**File:** `appredueri_backend/src/routes/business-portal.js`

```js
// Get nomination status for this business
router.get(
  '/:businessId/nominations',
  businessAuth,
  async (req, res) => {
    const { businessId } = req.params;

    try {
      // Current pending/selected nominations
      const nominations = await pool.query(`
        SELECT dn.id, dn.offer_id, dn.nominated_at, dn.selected_for_date, dn.status,
               o.title as offer_title
        FROM deal_nominations dn
        JOIN offers o ON o.id = dn.offer_id
        WHERE dn.business_id = $1
          AND dn.status IN ('pending', 'selected')
        ORDER BY dn.nominated_at DESC
      `, [businessId]);

      // Rate-limit info: when can they next nominate?
      const lastNom = await pool.query(`
        SELECT nominated_at FROM deal_nominations
        WHERE business_id = $1
          AND nominated_at > NOW() - INTERVAL '7 days'
          AND status IN ('pending', 'selected')
        ORDER BY nominated_at DESC
        LIMIT 1
      `, [businessId]);

      let canNominate = true;
      let nextAllowedAt = null;
      if (lastNom.rows.length > 0) {
        canNominate = false;
        const next = new Date(lastNom.rows[0].nominated_at);
        next.setDate(next.getDate() + 7);
        nextAllowedAt = next.toISOString();
      }

      res.json({
        nominations: nominations.rows,
        canNominate,
        nextAllowedAt,
      });
    } catch (err) {
      console.error('[Nominations] List error:', err);
      res.status(500).json({ error: 'Eroare server' });
    }
  }
);
```

---

## 5. Cron Job: Daily Deal Selection + Expiry

**File:** `appredueri_backend/src/services/cronJobs.js`

Add inside `initCronJobs()` function, after the existing cron job #6 (line ~87):

```js
  // 7. Deal of the Day selection — Daily 00:05 UTC (pick tomorrow's deal from nominations)
  cron.schedule('5 0 * * *', async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

      // Check if tomorrow already has a selected deal
      const existing = await pool.query(`
        SELECT id FROM deal_nominations
        WHERE selected_for_date = $1 AND status = 'selected'
        LIMIT 1
      `, [tomorrowStr]);

      if (existing.rows.length > 0) {
        console.log(`[Cron] Deal already selected for ${tomorrowStr}`);
        return;
      }

      // Pick oldest pending nomination whose offer is still active and not expired
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
        console.log(`[Cron] No pending nominations for ${tomorrowStr}, falling back to algorithm`);
        // No action needed — web.js and offers.js have their own fallback logic
        return;
      }

      const { nomination_id, offer_id } = candidate.rows[0];

      // Mark nomination as selected
      await pool.query(`
        UPDATE deal_nominations
        SET status = 'selected', selected_for_date = $1
        WHERE id = $2
      `, [tomorrowStr, nomination_id]);

      // Set the offer as deal of the day for tomorrow
      // First, clear any existing deal_of_day flag for tomorrow
      await pool.query(`
        UPDATE offers
        SET is_deal_of_day = FALSE, deal_of_day_date = NULL
        WHERE deal_of_day_date = $1
      `, [tomorrowStr]);

      // Then set the new deal
      await pool.query(`
        UPDATE offers
        SET is_deal_of_day = TRUE, deal_of_day_date = $1
        WHERE id = $2
      `, [tomorrowStr, offer_id]);

      console.log(`[Cron] Selected offer ${offer_id} (nomination ${nomination_id}) as Deal of the Day for ${tomorrowStr}`);
    } catch (err) {
      console.error('[Cron] Deal of the Day selection error:', err.message);
    }
  });

  // 8. Expire stale nominations — Daily 00:15 UTC
  cron.schedule('15 0 * * *', async () => {
    try {
      // Expire nominations older than 14 days that are still pending
      const expiredAge = await pool.query(`
        UPDATE deal_nominations
        SET status = 'expired'
        WHERE status = 'pending'
          AND nominated_at < NOW() - INTERVAL '14 days'
        RETURNING id, offer_id
      `);

      // Cancel nominations whose offer became inactive or expired
      const expiredOffer = await pool.query(`
        UPDATE deal_nominations dn
        SET status = 'cancelled'
        FROM offers o
        WHERE dn.offer_id = o.id
          AND dn.status = 'pending'
          AND (o.is_active = FALSE OR (o.end_date IS NOT NULL AND o.end_date < CURRENT_DATE + 1))
        RETURNING dn.id, dn.offer_id
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
```

Update the log line at the end of `initCronJobs()`:

```js
  console.log('[Cron] All 8 scheduled cleanup jobs registered.');
```

---

## 6. Deal Selection Logic Changes (web.js + offers.js)

**No changes needed.** The existing deal-of-day selection in both `web.js` (lines 106-136) and `offers.js` (lines 315-355) already:
1. First looks for `is_deal_of_day = TRUE AND deal_of_day_date = CURRENT_DATE`
2. Falls back to engagement-based algorithm if none found

The cron job in step 5 writes `is_deal_of_day = TRUE` and `deal_of_day_date` to the offers table, so the existing queries pick it up automatically. No query modifications required.

---

## 7. UI: manage.ejs — Nomination Button

**File:** `appredueri_backend/src/views/public/portal/manage.ejs`

### 7a. CSS (add after existing offer-card styles, around line ~225)

```css
  /* ── Nomination ── */
  .nominate-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 12px; border-radius: var(--radius-full);
    background: transparent; border: 1px solid var(--accent);
    color: var(--accent); font-size: 0.75rem; font-weight: 500;
    cursor: pointer; transition: all 0.2s; white-space: nowrap;
  }
  .nominate-btn:hover { background: var(--accent-glow); }
  .nominate-btn:disabled {
    opacity: 0.4; cursor: not-allowed;
    border-color: var(--text-tertiary); color: var(--text-tertiary);
  }
  .nominate-btn.nominated {
    background: var(--accent-glow); border-color: var(--accent);
    color: var(--accent); cursor: default;
  }
  .nomination-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: var(--radius-full);
    background: rgba(251, 146, 60, 0.12); color: var(--accent);
    font-size: 0.7rem; font-weight: 600;
  }
  .nomination-selected-badge {
    background: rgba(34, 197, 94, 0.12); color: var(--success);
  }
```

### 7b. HTML modification — offer card actions

In the offer card loop (around line 801), add the nomination button BEFORE the toggle button.

Find this block (line ~801-808):
```ejs
            <div class="offer-actions">
              <button class="toggle-btn <%= offer.is_active ? 'on' : 'off' %>"
```

Replace with:
```ejs
            <div class="offer-actions">
              <% if (tier && tier.plan && tier.plan.has_deal_nomination && offer.is_active) { %>
                <button class="nominate-btn"
                        id="nom-btn-<%= offer.id %>"
                        onclick="nominateOffer(<%= offer.id %>, this)"
                        title="Nominalizare pentru Oferta Zilei">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Nominalizare
                </button>
              <% } %>
              <button class="toggle-btn <%= offer.is_active ? 'on' : 'off' %>"
```

### 7c. Pass `tier` and `nominations` to manage.ejs

**File:** `appredueri_backend/src/routes/business-portal.js`

In the `GET /:businessId/manage` route (the one that renders manage.ejs), add nominations data to the render call.

After the existing queries (offers, reviews, analytics), add:

```js
    // Fetch active nominations for this business
    let nominations = [];
    let canNominate = true;
    let nextNominationAt = null;
    try {
      const nomResult = await pool.query(`
        SELECT dn.id, dn.offer_id, dn.status, dn.selected_for_date, dn.nominated_at
        FROM deal_nominations dn
        WHERE dn.business_id = $1
          AND dn.status IN ('pending', 'selected')
        ORDER BY dn.nominated_at DESC
      `, [businessId]);
      nominations = nomResult.rows;

      // Rate limit check
      const lastNom = await pool.query(`
        SELECT nominated_at FROM deal_nominations
        WHERE business_id = $1
          AND nominated_at > NOW() - INTERVAL '7 days'
          AND status IN ('pending', 'selected')
        ORDER BY nominated_at DESC
        LIMIT 1
      `, [businessId]);
      if (lastNom.rows.length > 0) {
        canNominate = false;
        const next = new Date(lastNom.rows[0].nominated_at);
        next.setDate(next.getDate() + 7);
        nextNominationAt = next.toISOString();
      }
    } catch (e) { /* nominations are non-critical */ }
```

Then in the `res.render('public/portal/manage', { ... })` call, add:

```js
      nominations,
      canNominate,
      nextNominationAt,
      tier: req.tier,    // from attachTier middleware
```

### 7d. JavaScript (add at end of manage.ejs script section)

```js
  // ── Deal Nomination ──
  window.nominateOffer = async function(offerId, btn) {
    if (btn.classList.contains('nominated') || btn.disabled) return;

    btn.disabled = true;
    btn.textContent = 'Se trimite...';

    try {
      const res = await apiFetch('/api/web/portal/' + businessId + '/nominations', {
        method: 'POST',
        body: JSON.stringify({ offerId: offerId }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error === 'rate_limited') {
          showToast(data.message, 'warning');
        } else {
          showToast(data.error || data.message || 'Eroare la nominalizare', 'error');
        }
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Nominalizare';
        return;
      }

      btn.classList.add('nominated');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Nominalizat';
      showToast('Oferta a fost nominalizata pentru Oferta Zilei!', 'success');

      // Disable all other nominate buttons (rate limit)
      document.querySelectorAll('.nominate-btn:not(.nominated)').forEach(function(b) {
        b.disabled = true;
      });
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Nominalizare';
      showToast('Eroare de retea', 'error');
    }
  };

  // On page load: mark already-nominated offers and disable if rate-limited
  (function initNominations() {
    var nominations = <%- JSON.stringify(nominations || []) %>;
    var canNominate = <%= canNominate ? 'true' : 'false' %>;

    nominations.forEach(function(nom) {
      var btn = document.getElementById('nom-btn-' + nom.offer_id);
      if (btn) {
        if (nom.status === 'pending') {
          btn.classList.add('nominated');
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Nominalizat';
        } else if (nom.status === 'selected') {
          btn.classList.add('nominated');
          var dateStr = new Date(nom.selected_for_date).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Oferta Zilei ' + dateStr;
        }
      }
    });

    if (!canNominate) {
      document.querySelectorAll('.nominate-btn:not(.nominated)').forEach(function(b) {
        b.disabled = true;
      });
    }
  })();
```

---

## 8. Gotchas & Edge Cases

### 8a. Nominated offer expires before its deal day
The cron job (step 5) validates `o.is_active = TRUE AND o.end_date > tomorrow` at selection time, so expired offers are skipped. The expiry cron (step 5, job #8) also cancels pending nominations whose offers became inactive. If the selected offer expires on the actual day (very rare edge case: selected for tomorrow, but tomorrow the end_date equals tomorrow), the web.js/offers.js fallback algorithm picks a different offer automatically since the WHERE clause requires `end_date > CURRENT_DATE`.

### 8b. Premium subscription expires while nomination is pending
The expiry cron (job #8) runs the `NOT EXISTS(... sp.has_deal_nomination = TRUE)` check and cancels orphaned nominations. The selection cron (job #7) also joins `business_subscriptions + subscription_plans` to verify the feature is still active at selection time.

### 8c. Business nominates, then downgrades, then re-upgrades
The cancelled nominations cannot be resurrected. The business must create a new nomination after re-upgrading. The 7-day rate limit counts from the LAST nomination (regardless of status), so if they nominated 3 days ago and downgraded, the nomination gets cancelled, but they must still wait 4 more days after re-upgrading to nominate again.

### 8d. Multiple businesses nominate and queue fills up
The selection algorithm picks the oldest pending nomination first (FIFO). Each business can only have 1 pending nomination at a time (the 7-day rate limit + unique index ensures this). With 14-day expiry, a maximum of 14 deals can be queued. If more than 1 nomination exists for a given day, only the oldest is selected; others remain pending for subsequent days.

### 8e. Cron job timing
The cron runs at 00:05 UTC and selects TOMORROW's deal. This means the deal is always set at least ~24 hours in advance. The 00:15 UTC expiry job runs after selection, so a nomination that was just selected will not be expired.

### 8f. Admin override
Admin-set `is_deal_of_day` deals still work. The cron checks if tomorrow already has a selected nomination. But it does NOT check if admin manually set `is_deal_of_day` on an offer. To prevent conflict: the cron should also check the offers table for manual flags. Add this check at the beginning of the selection cron:

```js
      // Also check if admin manually set a deal for tomorrow
      const adminDeal = await pool.query(`
        SELECT id FROM offers
        WHERE is_deal_of_day = TRUE AND deal_of_day_date = $1
      `, [tomorrowStr]);
      if (adminDeal.rows.length > 0) {
        console.log(`[Cron] Admin deal already set for ${tomorrowStr}, skipping nomination selection`);
        return;
      }
```

### 8g. CSRF
All POST endpoints in the business portal already have CSRF protection from the global middleware. The `apiFetch` helper in manage.ejs already sends the CSRF token. No additional CSRF handling needed.

---

## 9. Verification Checklist

After implementation:
- [ ] Migration `034_deal_nominations.sql` runs successfully
- [ ] Premium business can nominate an active offer
- [ ] Free/Standard business gets 403 `upgrade_required`
- [ ] Rate limit enforced: second nomination within 7 days returns 429
- [ ] Nomination for inactive/expired offer returns 400
- [ ] Nomination for offer expiring within 2 days returns 400
- [ ] Cron selects oldest pending nomination for tomorrow
- [ ] Cron skips if admin already set a deal for tomorrow
- [ ] Cron skips if nomination already selected for tomorrow
- [ ] Expired nominations (14d) are cleaned up
- [ ] Nominations for deactivated offers are cancelled
- [ ] Nominations for downgraded businesses are cancelled
- [ ] manage.ejs shows "Nominalizare" button only for Premium
- [ ] Button state updates correctly after nomination
- [ ] Already-nominated offers show "Nominalizat" on page load
- [ ] Cancel endpoint works and re-enables nomination ability
- [ ] Web home page + mobile deal-of-day endpoint pick up nominated deals correctly
