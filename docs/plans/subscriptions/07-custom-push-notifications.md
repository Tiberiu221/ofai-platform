# 07 --- Custom Push Notifications (Owner-Initiated)

> **Scop:** Allow Premium businesses to send custom push notifications to their followers (beyond the automatic push on new offer).
> **Dependinte:** `00-subscription-foundation.md` (tier tables, `attachTier`, `requireFeature`)
> **Fisiere afectate:**
> - `src/migrations/034_business_push_log.sql` (NEW migration)
> - `src/routes/web.js` (2 new endpoints: send + history)
> - `src/views/public/portal/manage.ejs` (new "Notificari" section or tab)
> - `src/services/pushNotifications.js` (used, not modified)
> - `src/middleware/tierAuth.js` (used, not modified)

---

## 1. Current Push Notification Flow

Currently, push notifications are sent in two ways:

1. **Auto-push on new offer:** In `src/services/offerService.js` (around line ~130), when a new offer is created, `sendToBusinessSubscribers(pool, businessId, payload)` is called automatically. This sends to all users who follow the business via the `followed_businesses` table. This is available to **Standard+ tiers** (controlled by `has_push_on_offer`).

2. **Admin broadcast:** `POST /push-tokens/admin/send` in `src/routes/push-tokens.js` allows admin users to send push notifications to all users, a specific city, or specific user. This is admin-only and stays unchanged.

**NEW:** Custom push allows the business **owner** to compose a title + message and send it to their followers. This is a **Premium-only** feature (`has_custom_push`).

---

## 2. New Migration: `034_business_push_log.sql`

### File: `src/migrations/034_business_push_log.sql`

```sql
-- Migration 034: Business custom push notifications log
-- Tracks push notifications sent by business owners (for rate limiting + history)

CREATE TABLE IF NOT EXISTS business_push_log (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sent_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(100) NOT NULL,
  message VARCHAR(300) NOT NULL,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_push_log_bid
  ON business_push_log(business_id, created_at DESC);

-- Index for rate limit check (business + recent window)
CREATE INDEX IF NOT EXISTS idx_business_push_log_rate
  ON business_push_log(business_id, created_at)
  WHERE created_at >= NOW() - INTERVAL '7 days';

COMMENT ON TABLE business_push_log IS 'Tracks custom push notifications sent by business owners. Used for rate limiting and history.';
```

**Why a separate table instead of `push_notifications_log`?**

The existing `push_notifications_log` table (migration 010) is designed for admin broadcasts and has a `target_type` enum restricted to `('all', 'user', 'subscribers', 'city')`. It also lacks a `business_id` column and has a `sent_by` that references the admin user. Creating a dedicated `business_push_log` table is cleaner and avoids altering the existing table's constraints. It also simplifies the rate limit query.

---

## 3. New Endpoints

### 3.1 Send Custom Push: `POST /api/web/portal/:businessId/notifications/send`

### Location

Add in `src/routes/web.js`, after the competitive insights endpoint (plan 06).

### Middleware Chain

```js
router.post(
  "/api/web/portal/:businessId/notifications/send",
  requireBusinessOwner,
  attachTier(pool),
  requireFeature('has_custom_push'),
  async (req, res) => { ... }
);
```

### Full Endpoint Code

```js
// Custom push notification (Premium only)
router.post("/api/web/portal/:businessId/notifications/send",
  requireBusinessOwner, attachTier(pool), requireFeature('has_custom_push'),
  async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.webUser.id;

    // 1. Validate input
    let { title, message } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ message: 'Titlul este obligatoriu' });
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Mesajul este obligatoriu' });
    }

    title = title.trim().substring(0, 100);
    message = message.trim().substring(0, 300);

    // 2. Rate limit: max 2 custom pushes per week per business
    const rateLimitRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM business_push_log
       WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
      [businessId]
    );
    const pushesThisWeek = parseInt(rateLimitRes.rows[0].cnt) || 0;

    if (pushesThisWeek >= 2) {
      return res.status(429).json({
        message: 'Ai atins limita de 2 notificari pe saptamana. Incearca din nou saptamana viitoare.',
        limit: 2,
        used: pushesThisWeek,
        nextAvailable: null,  // Could calculate, but simpler to just say "next week"
      });
    }

    // 3. Get business name for notification prefix
    const bizRes = await pool.query(
      'SELECT name FROM businesses WHERE id = $1',
      [businessId]
    );
    if (bizRes.rows.length === 0) {
      return res.status(404).json({ message: 'Business negasit' });
    }
    const businessName = bizRes.rows[0].name;

    // 4. Prefix title with business name (so user knows who sent it)
    const fullTitle = businessName;
    // The message body includes the custom title inline:
    // e.g. "Oferta noua de weekend! Vino sa descoperi..."
    // The push title = business name, body = owner's title + message combined
    const fullBody = title + (message !== title ? '\n' + message : '');

    // 5. Send push notification to all business followers
    const result = await pushService.sendToBusinessSubscribers(pool, parseInt(businessId), {
      title: fullTitle,
      body: fullBody,
      data: {
        type: 'business_custom_push',
        businessId: String(businessId),
        screen: 'business_detail',  // Deep link target for Flutter
      },
    });

    // 6. Log the push
    await pool.query(
      `INSERT INTO business_push_log
        (business_id, sent_by, title, message, recipients_count, success_count, failure_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        businessId,
        userId,
        title,
        message,
        (result.sent || 0) + (result.failed || 0),
        result.sent || 0,
        result.failed || 0,
      ]
    );

    res.json({
      success: true,
      sent: result.sent || 0,
      failed: result.failed || 0,
      remaining: Math.max(0, 2 - pushesThisWeek - 1),
    });

  } catch (err) {
    console.error('[Web API] Custom push error:', err);
    res.status(500).json({ message: 'Eroare la trimiterea notificarii' });
  }
});
```

### 3.2 Push History: `GET /api/web/portal/:businessId/notifications/history`

```js
// Custom push history (Premium only)
router.get("/api/web/portal/:businessId/notifications/history",
  requireBusinessOwner, attachTier(pool), requireFeature('has_custom_push'),
  async (req, res) => {
  try {
    const { businessId } = req.params;

    // Get push history for this business (last 20)
    const historyRes = await pool.query(
      `SELECT id, title, message, recipients_count, success_count, failure_count, created_at
       FROM business_push_log
       WHERE business_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [businessId]
    );

    // Get rate limit info
    const rateLimitRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM business_push_log
       WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
      [businessId]
    );
    const pushesThisWeek = parseInt(rateLimitRes.rows[0].cnt) || 0;

    res.json({
      history: historyRes.rows.map(row => ({
        id: row.id,
        title: row.title,
        message: row.message,
        recipientsCount: row.recipients_count,
        successCount: row.success_count,
        failureCount: row.failure_count,
        createdAt: row.created_at,
      })),
      rateLimit: {
        limit: 2,
        used: pushesThisWeek,
        remaining: Math.max(0, 2 - pushesThisWeek),
      },
    });

  } catch (err) {
    console.error('[Web API] Push history error:', err);
    res.status(500).json({ message: 'Eroare la istoricul notificarilor' });
  }
});
```

---

## 4. UI Changes in `manage.ejs`

### 4.1 Option A: New section in Statistici tab (simpler)

Add a new `glass-card` after the Charts section (before `</div><!-- /tab-statistici -->`), visible only for Premium:

```html
<!-- Custom Push Notifications (Premium only) -->
<% if (tier && tier.plan && tier.plan.has_custom_push) { %>
  <div class="glass-card" style="margin-top: 16px;">
    <h3 class="section-title">Notificari catre abonati</h3>
    <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">
      Trimite notificari push personalizate catre abonatii business-ului tau.
      Limita: 2 notificari pe saptamana.
    </p>

    <!-- Send Form -->
    <form id="push-form" onsubmit="return sendCustomPush(event)">
      <div class="form-group">
        <label class="form-label">Titlu <span style="color: var(--text-tertiary); font-weight: 400;">(max 100 caractere)</span></label>
        <input type="text" id="push-title" class="form-input" maxlength="100" required
               placeholder="ex: Oferta speciala de weekend!">
      </div>
      <div class="form-group">
        <label class="form-label">Mesaj <span style="color: var(--text-tertiary); font-weight: 400;">(max 300 caractere)</span></label>
        <textarea id="push-message" class="form-input" maxlength="300" rows="3" required
                  placeholder="ex: Vino sa profiti de 30% reducere la toate produsele, doar in acest weekend."></textarea>
        <div style="text-align: right; font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">
          <span id="push-char-count">0</span>/300
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <button type="submit" class="btn-primary" id="push-send-btn" style="min-width: 160px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Trimite notificarea
        </button>
        <span id="push-remaining" style="font-size: 12px; color: var(--text-tertiary);"></span>
      </div>
    </form>

    <!-- Push History -->
    <div style="margin-top: 24px;">
      <h4 style="font-size: 14px; font-weight: 500; color: var(--text-secondary); margin-bottom: 12px;">
        Istoric notificari
      </h4>
      <div id="push-history">
        <div style="text-align: center; padding: 16px; color: var(--text-tertiary); font-size: 13px;">
          Se incarca...
        </div>
      </div>
    </div>
  </div>
<% } %>
```

### 4.2 Option B: New tab "Notificari" (alternative, more prominent)

If preferred, add a 5th tab instead:

```html
<!-- In the portal-tabs section (line ~478): -->
<% if (tier && tier.plan && tier.plan.has_custom_push) { %>
  <button class="portal-tab" onclick="switchTab('notificari')">Notificari</button>
<% } %>
```

And create a new `<div class="tab-panel" id="tab-notificari">` containing the form + history. The approach above (Option A) is simpler because it avoids adding a new tab and keeps the UI compact.

**Recommended: Option A** (section in Statistici tab).

### 4.3 CSS for push history entries

Add to the `<style>` block:

```css
.push-history-item {
  padding: 12px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.push-history-item:last-child { border-bottom: none; }
.push-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.push-history-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}
.push-history-date {
  font-size: 11px;
  color: var(--text-tertiary);
}
.push-history-message {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  white-space: pre-line;
}
.push-history-stats {
  font-size: 11px;
  color: var(--text-tertiary);
}
.push-history-stats .success { color: #22c55e; }
.push-history-stats .failure { color: #ef4444; }
```

### 4.4 JavaScript

Add inside the existing IIFE:

```js
/* -- Custom Push Notifications -- */
var pushHistoryLoaded = false;

// Character counter
(function() {
  var textarea = document.getElementById('push-message');
  var counter = document.getElementById('push-char-count');
  if (textarea && counter) {
    textarea.addEventListener('input', function() {
      counter.textContent = textarea.value.length;
    });
  }
})();

window.sendCustomPush = function(e) {
  e.preventDefault();
  var titleEl = document.getElementById('push-title');
  var messageEl = document.getElementById('push-message');
  var btn = document.getElementById('push-send-btn');

  var title = titleEl.value.trim();
  var message = messageEl.value.trim();

  if (!title || !message) {
    showToast('Completeaza titlul si mesajul', 'error');
    return false;
  }

  // Confirm before sending
  if (!confirm('Esti sigur ca vrei sa trimiti aceasta notificare catre toti abonatii?')) {
    return false;
  }

  btn.disabled = true;
  btn.textContent = 'Se trimite...';

  apiFetch('/api/web/portal/' + businessId + '/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title, message: message }),
  })
    .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, status: res.status, data: data }; }); })
    .then(function(result) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Trimite notificarea';

      if (!result.ok) {
        if (result.status === 429) {
          showToast(result.data.message || 'Limita de notificari atinsa', 'error');
        } else if (result.status === 403) {
          showToast('Aceasta functie necesita planul Premium', 'error');
        } else {
          showToast(result.data.message || 'Eroare la trimitere', 'error');
        }
        return;
      }

      showToast('Notificare trimisa! (' + result.data.sent + ' destinatari)', 'success');
      titleEl.value = '';
      messageEl.value = '';
      document.getElementById('push-char-count').textContent = '0';

      // Update remaining count
      var remainingEl = document.getElementById('push-remaining');
      if (remainingEl) {
        remainingEl.textContent = result.data.remaining + ' notificari ramase saptamana aceasta';
      }

      // Reload history
      pushHistoryLoaded = false;
      loadPushHistory();
    })
    .catch(function(err) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Trimite notificarea';
      if (err.message !== 'Unauthorized') {
        showToast('Eroare la trimitere', 'error');
      }
    });

  return false;
};

function loadPushHistory() {
  if (pushHistoryLoaded) return;
  pushHistoryLoaded = true;

  var container = document.getElementById('push-history');
  if (!container) return;

  apiFetch('/api/web/portal/' + businessId + '/notifications/history')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      // Update remaining count
      var remainingEl = document.getElementById('push-remaining');
      if (remainingEl && data.rateLimit) {
        remainingEl.textContent = data.rateLimit.remaining + ' notificari ramase saptamana aceasta';
      }

      if (!data.history || data.history.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 16px; color: var(--text-tertiary); font-size: 13px;">Nicio notificare trimisa inca.</div>';
        return;
      }

      var html = '';
      data.history.forEach(function(item) {
        var d = new Date(item.createdAt);
        var dateStr = d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
        var timeStr = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

        html += '<div class="push-history-item">' +
          '<div class="push-history-header">' +
            '<div class="push-history-title">' + escapeHtml(item.title) + '</div>' +
            '<div class="push-history-date">' + dateStr + ' ' + timeStr + '</div>' +
          '</div>' +
          '<div class="push-history-message">' + escapeHtml(item.message) + '</div>' +
          '<div class="push-history-stats">' +
            '<span class="success">' + item.successCount + ' trimise</span>' +
            (item.failureCount > 0 ? ' &middot; <span class="failure">' + item.failureCount + ' esuate</span>' : '') +
            ' &middot; ' + item.recipientsCount + ' destinatari' +
          '</div>' +
        '</div>';
      });

      container.innerHTML = html;
    })
    .catch(function(err) {
      console.error('[Push] History error:', err);
      container.innerHTML = '<div style="text-align: center; padding: 16px; color: var(--text-tertiary);">Eroare la incarcarea istoricului.</div>';
    });
}

// Helper: escape HTML to prevent XSS in push title/message display
function escapeHtml(text) {
  var el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}
```

### 4.5 Trigger load when Statistici tab opens

Add to the existing `switchTab` trigger (same location as plan 06):

```js
if (tabName === 'statistici') {
  if (typeof loadCompetitiveInsights === 'function') loadCompetitiveInsights();
  if (typeof loadPushHistory === 'function') loadPushHistory();
}
```

---

## 5. Push Notification Content Structure

### What the subscriber receives

| Field | Value | Notes |
|---|---|---|
| `title` | Business name (e.g., "Salon Elite") | Always the business name so users know the source |
| `body` | Owner's custom title + message | Combined: "Oferta speciala!\nVino sa profiti..." |
| `data.type` | `"business_custom_push"` | Used by Flutter to route the notification |
| `data.businessId` | `"42"` | String (all FCM data values must be strings) |
| `data.screen` | `"business_detail"` | Flutter deep link target |

### Flutter handling (informational, not part of this plan)

In the Flutter app's `NotificationHandler`, the `type: 'business_custom_push'` and `screen: 'business_detail'` data fields should navigate to the business detail screen when tapped. This follows the existing pattern used by the auto-push on new offer. The Flutter side may need a small update to handle this new `type` value, but the routing logic for `business_detail` screen already exists.

---

## 6. Rate Limiting Details

### Rules

- **2 custom push notifications per rolling 7-day window per business**
- Checked via `COUNT(*) FROM business_push_log WHERE business_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`
- Rate limit applies to the business (not the user), so multiple owners of the same business share the limit
- Rate limit is checked BEFORE sending (fail fast)
- Auto-push on new offer (from `offerService.js`) does NOT count toward this limit (different flow, different table)

### Why 2 per week?

- Prevents spam that would cause users to unfollow or disable notifications
- Enough for a weekly promotion + one special announcement
- Can be adjusted later by changing the constant (consider making it a `subscription_plans` column like `max_custom_pushes_per_week` for per-tier flexibility)

### Future enhancement (not in this plan)

Add a `max_custom_pushes_per_week` column to `subscription_plans`:
```sql
ALTER TABLE subscription_plans ADD COLUMN max_custom_pushes_per_week INTEGER NOT NULL DEFAULT 0;
UPDATE subscription_plans SET max_custom_pushes_per_week = 2 WHERE slug = 'premium';
```
Then the rate limit check reads from `req.tier.plan.max_custom_pushes_per_week` instead of hardcoding `2`.

---

## 7. CSRF Considerations

The `POST /api/web/portal/:businessId/notifications/send` endpoint is a state-changing request that arrives from the manage.ejs page. The existing `apiFetch` function in manage.ejs already adds the `X-CSRF-Token` header from the `<meta name="csrf-token">` tag. This endpoint goes through the global CSRF middleware in `index.js`, so no special handling is needed.

Verify that the CSRF middleware does not skip `/api/web/portal/*` routes. Looking at the existing POST endpoints in web.js (logo upload, cover upload, gallery upload), they all successfully pass CSRF validation, so this new endpoint will too.

---

## 8. Data Cleanup

Add a cron job to clean old push log entries (optional, for hygiene). In `src/services/cronJobs.js`:

```js
// Monthly: clean old business push logs (keep 6 months)
cron.schedule('0 5 1 * *', async () => {
  try {
    const result = await pool.query(
      `DELETE FROM business_push_log WHERE created_at < NOW() - INTERVAL '180 days'`
    );
    console.log(`[Cron] Cleaned ${result.rowCount} old business push log entries`);
  } catch (err) {
    console.error('[Cron] Business push log cleanup failed:', err.message);
  }
});
```

This follows the same pattern as the existing `push_notifications_log` cleanup (90 days) in `cronJobs.js` line ~26.

---

## 9. Gotchas

1. **Business name prefix in push title:** The notification title is always the business name (not the owner's custom title). This is intentional: subscribers need to immediately see WHO sent the notification. The owner's custom title goes into the body. If the owner writes title="Reducere 50%" and message="La toate produsele", the push shows:
   - **Title:** "Salon Elite"
   - **Body:** "Reducere 50%\nLa toate produsele"

2. **Rate limit is per business, not per user:** If a business has 2 co-owners, they share the 2-per-week limit. The `business_push_log` tracks by `business_id`, not `sent_by`.

3. **Zero followers edge case:** If the business has 0 followers with active push tokens, `sendToBusinessSubscribers` returns `{ sent: 0 }`. The endpoint still logs this in `business_push_log` (it counts toward the rate limit). The UI should show "0 destinatari" which signals to the owner they need more followers. This is by design -- the rate limit prevents testing/spamming even with 0 recipients.

4. **`confirm()` dialog before sending:** The JavaScript uses `confirm('Esti sigur...')` before the API call. This is a deliberate friction point to prevent accidental sends. Unlike form saves, push notifications cannot be unsent.

5. **`escapeHtml` for XSS prevention:** The push title and message are user-generated content. When displaying them in the history list, they MUST be escaped to prevent stored XSS. The `escapeHtml` helper uses `textContent`/`innerHTML` trick for safe escaping.

6. **Content-Type: application/json:** The send endpoint expects JSON body (not FormData). The `apiFetch` call includes `'Content-Type': 'application/json'` header and `JSON.stringify` body. This differs from the file upload endpoints which use FormData.

7. **CSRF with JSON body:** The existing `apiFetch` function handles CSRF tokens for both FormData and JSON bodies. For JSON, it sets `X-CSRF-Token` in the headers object directly. For FormData, it uses `new Headers()`. The send endpoint uses JSON, so the standard path works.

8. **Deep link data:** The `data.screen` and `data.businessId` fields follow the existing push notification data structure used by auto-push on offer creation. The Flutter notification handler routes based on `screen` value. Ensure the Flutter handler also handles `type: 'business_custom_push'` (or ignores the `type` field and routes based on `screen` only).

9. **Migration number:** The migration is numbered `034`. Verify that `033_business_subscriptions.sql` (from plan 00) has been created first. If plan 00 has not been run yet, adjust the migration number accordingly.

10. **The `sent_by` column uses `ON DELETE SET NULL`:** If the user who sent the notification is deleted, the log entry remains but `sent_by` becomes NULL. This preserves the audit trail even after user deletion (GDPR-friendly -- the log itself does not contain PII, only IDs and the message content which is business-authored).

---

## 10. Verification Checklist

After implementation:
- [ ] Migration `034_business_push_log.sql` runs cleanly
- [ ] `POST /api/web/portal/:businessId/notifications/send` sends push to all followers
- [ ] Push notification title = business name, body = custom title + message
- [ ] Rate limit: 3rd push in 7 days returns 429
- [ ] Rate limit counter resets after 7 days (rolling window)
- [ ] `GET /api/web/portal/:businessId/notifications/history` returns last 20 entries
- [ ] History response includes `rateLimit.remaining` count
- [ ] Free/Standard tier gets 403 `upgrade_required` on both endpoints
- [ ] Notification form visible only for Premium tier in manage.ejs
- [ ] Character counter works on message textarea
- [ ] `confirm()` dialog appears before sending
- [ ] Success toast shows number of recipients
- [ ] History reloads after successful send
- [ ] XSS-safe display of title/message in history
- [ ] Zero-follower case: sends 0, logs entry, shows "0 destinatari"
- [ ] CSRF validation passes on the POST request
