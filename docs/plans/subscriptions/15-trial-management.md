# 15 -- Trial Management (14 Days)

> **Scop:** Auto-assign 14-day Standard trial la business-uri noi aprobate. Countdown in portal, notificari email, cron job de expirare.
> **Dependinte:** `00-subscription-foundation.md` (tabele, `tiers.js`), `12-premium-badge.md` (syncBadgeType)
> **Fisiere afectate:** `admin.js` (approve flow), `cronJobs.js` (expiry check), `manage.ejs` (trial countdown), `email.js` (trial emails), `business-portal.js` (trial status)
> **Efort estimat:** Mediu -- touches approval flow, cron, and email

---

## 1. Overview

When admin approves a business request, the system auto-creates a 14-day Standard trial subscription. During the trial, the business gets all Standard features (verified badge, logo upload, cover upload, review responses, AI summary, etc.). After 14 days, the trial expires and the business reverts to the Free tier.

**Key rules:**
- Trial is ONLY for NEW businesses (approved via admin)
- Each business gets ONE trial ever (prevent abuse)
- Existing businesses do NOT get a trial (they were assigned free tier in migration 033)
- Trial gives Standard tier features (not Premium)
- No credit card required for trial

---

## 2. No New Migration

The `business_subscriptions` table (migration 033) already has:
- `status VARCHAR(20)` -- supports 'trial'
- `trial_start TIMESTAMPTZ`
- `trial_end TIMESTAMPTZ`

These fields are sufficient. No new migration needed.

---

## 3. Admin Approval Flow: Auto-Create Trial

**File:** `appredueri_backend/src/routes/admin.js`

### 3a. Add Import

At the top of admin.js, add the tier helper import:

```js
const { getPlans, syncBadgeType } = require('../helpers/tiers');
```

### 3b. Modify the Approve Handler

Current code location: `POST /business-requests/:id/approve` (around line 1481).

After the existing code that creates the business and assigns the user, add trial creation INSIDE the same transaction:

```js
// POST /admin/business-requests/:id/approve
router.post("/business-requests/:id/approve", async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ... existing code: get request, create business, assign user, update request ...
    // (lines 1490-1529 remain UNCHANGED)

    // ── NEW: Auto-create 14-day Standard trial ──
    const plans = await getPlans(pool);
    const standardPlan = plans.standard;

    if (standardPlan) {
      const trialDays = 14;
      const now = new Date();
      const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

      // Check if business already has a subscription (shouldn't happen for new business, but safety check)
      const { rows: existingSub } = await client.query(
        `SELECT id FROM business_subscriptions WHERE business_id = $1 LIMIT 1`,
        [businessId]
      );

      if (existingSub.length === 0) {
        // Create trial subscription
        await client.query(
          `INSERT INTO business_subscriptions
            (business_id, plan_id, status, billing_cycle, current_period_start, current_period_end, trial_start, trial_end)
           VALUES ($1, $2, 'trial', 'none', $3, $4, $3, $4)`,
          [businessId, standardPlan.id, now, trialEnd]
        );

        // Log to subscription history
        await client.query(
          `INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
           VALUES ($1, NULL, $2, 'trial_started', 'Auto-trial on business approval')`,
          [businessId, standardPlan.id]
        );

        // Sync the badge to 'verified' (standard tier badge)
        await syncBadgeType(client, businessId, standardPlan.badge_type);

        console.log(`[Admin] Trial started for business #${businessId}: ${trialDays} days Standard`);
      } else {
        // Business already has a subscription (e.g., imported business) -- assign free tier
        console.log(`[Admin] Business #${businessId} already has a subscription, skipping trial`);
      }
    }

    await client.query("COMMIT");
    console.log(`[Admin] Business request #${requestId} approved → business #${businessId}`);

    // ... existing email notification code (lines 1534-1542 remain UNCHANGED) ...
    // But now we also send the trial welcome email:

    // Send trial welcome email (non-blocking)
    const { rows: userRows } = await pool.query(
      "SELECT email, first_name FROM users WHERE id = $1",
      [request.user_id]
    );
    if (userRows.length > 0) {
      // Existing approved email
      sendBusinessApprovedEmail(userRows[0].email, userRows[0].first_name, request.name)
        .catch(err => console.error("[Admin] Failed to send approved email:", err));

      // NEW: Trial welcome email
      sendTrialWelcomeEmail(userRows[0].email, userRows[0].first_name, request.name, 14)
        .catch(err => console.error("[Admin] Failed to send trial welcome email:", err));
    }

    res.redirect("/admin/business-requests?success=approved");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Admin] Approve business request error:", err);
    res.status(500).send("Eroare la aprobarea cererii.");
  } finally {
    client.release();
  }
});
```

### 3c. Import Email Function

At the top of admin.js, update the email import:

```js
// BEFORE:
const { sendBusinessApprovedEmail, sendBusinessRejectedEmail } = require("../services/email");

// AFTER:
const { sendBusinessApprovedEmail, sendBusinessRejectedEmail, sendTrialWelcomeEmail } = require("../services/email");
```

---

## 4. Cron Job: Trial Expiration

**File:** `appredueri_backend/src/services/cronJobs.js`

### 4a. Add Import

```js
const { syncBadgeType } = require('../helpers/tiers');
const { sendTrialExpiryEmail, sendTrialExpiringWarningEmail } = require('./email');
```

### 4b. Add Trial Expiration Check (Daily at 04:00)

Note: Plan 00 already defines a subscription expiry cron at 04:00. We need to integrate the trial-specific logic (emails, badge sync) into that same job OR create a separate one. **Recommendation: create a separate cron at 04:15 to avoid conflicts with Plan 00's cron.**

```js
// 7. Trial expiration check — Daily 04:15 UTC
cron.schedule('15 4 * * *', async () => {
  const client = await pool.connect();
  try {
    // ── Step 1: Warn trials expiring in 3 days ──
    const { rows: warningRows } = await pool.query(`
      SELECT bs.business_id, bs.trial_end, b.name as business_name,
             u.email, u.first_name
      FROM business_subscriptions bs
      JOIN businesses b ON b.id = bs.business_id
      JOIN user_businesses ub ON ub.business_id = bs.business_id
      JOIN users u ON u.id = ub.user_id
      WHERE bs.status = 'trial'
        AND bs.trial_end BETWEEN NOW() + INTERVAL '2 days' AND NOW() + INTERVAL '4 days'
    `);

    for (const row of warningRows) {
      const daysLeft = Math.ceil((new Date(row.trial_end) - new Date()) / (1000 * 60 * 60 * 24));
      sendTrialExpiringWarningEmail(row.email, row.first_name, row.business_name, daysLeft)
        .catch(err => console.error(`[Cron] Trial warning email failed for business ${row.business_id}:`, err));
    }
    if (warningRows.length > 0) {
      console.log(`[Cron] Sent ${warningRows.length} trial expiring warnings`);
    }

    // ── Step 2: Expire trials past their trial_end ──
    await client.query('BEGIN');

    const { rows: expiredRows } = await client.query(`
      SELECT bs.id as subscription_id, bs.business_id, bs.plan_id,
             b.name as business_name,
             u.email, u.first_name
      FROM business_subscriptions bs
      JOIN businesses b ON b.id = bs.business_id
      JOIN user_businesses ub ON ub.business_id = bs.business_id
      JOIN users u ON u.id = ub.user_id
      WHERE bs.status = 'trial'
        AND bs.trial_end < NOW()
    `);

    if (expiredRows.length > 0) {
      // Get free plan ID
      const { rows: freePlanRows } = await client.query(
        "SELECT id FROM subscription_plans WHERE slug = 'free'"
      );
      const freePlanId = freePlanRows[0].id;

      for (const row of expiredRows) {
        // Mark trial as expired
        await client.query(
          `UPDATE business_subscriptions SET status = 'expired', updated_at = NOW()
           WHERE id = $1`,
          [row.subscription_id]
        );

        // Create new free-tier subscription
        await client.query(
          `INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
           VALUES ($1, $2, 'active', 'none')`,
          [row.business_id, freePlanId]
        );

        // Log to history
        await client.query(
          `INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
           VALUES ($1, $2, $3, 'trial_expired', 'Trial period ended')`,
          [row.business_id, row.plan_id, freePlanId]
        );

        // Sync badge to null (free tier has no badge)
        await syncBadgeType(client, row.business_id, null);

        // Send expiry email (non-blocking)
        sendTrialExpiryEmail(row.email, row.first_name, row.business_name)
          .catch(err => console.error(`[Cron] Trial expiry email failed for business ${row.business_id}:`, err));

        console.log(`[Cron] Trial expired for business #${row.business_id} (${row.business_name})`);
      }
    }

    await client.query('COMMIT');
    if (expiredRows.length > 0) {
      console.log(`[Cron] ${expiredRows.length} trials expired and downgraded to free`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Cron] Trial expiration check failed:', err.message);
  } finally {
    client.release();
  }
});
```

### 4c. Update Console Log

```js
// Update the final log line:
console.log('[Cron] All 7 scheduled cleanup jobs registered.');  // was 6
```

---

## 5. Email Templates

**File:** `appredueri_backend/src/services/email.js`

### 5a. Trial Welcome Email

```js
/**
 * Send trial welcome email when a business starts the 14-day Standard trial
 */
async function sendTrialWelcomeEmail(to, firstName, businessName, trialDays) {
  if (!resend) {
    console.log(`[Email] Skipping trial welcome (no API key): ${to}`);
    return { success: false, reason: 'no_api_key' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Trial Standard activat (${trialDays} zile) - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html lang="ro">
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; background-color: #06060a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
          <table role="presentation" width="100%" style="background-color: #06060a;">
            <tr>
              <td align="center" style="padding: 40px 16px;">
                <table role="presentation" width="600" style="max-width: 600px; width: 100%;">
                  <tr>
                    <td style="background-color: #0d0d12; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 40px 32px;">
                      <h1 style="font-family: 'DM Serif Display', Georgia, serif; font-size: 24px; font-weight: 400; color: #fafafa; text-align: center; margin: 0 0 8px;">
                        Trial Standard Activat
                      </h1>
                      <p style="text-align: center; color: #fb923c; font-size: 0.875rem; font-weight: 600; margin: 0 0 24px;">${trialDays} zile gratuit</p>

                      <p style="font-size: 15px; color: #a1a1aa; line-height: 1.6;">
                        Salut${firstName ? ` <strong style="color: #fafafa;">${firstName}</strong>` : ''},
                      </p>
                      <p style="font-size: 15px; color: #a1a1aa; line-height: 1.6;">
                        Business-ul <strong style="color: #fb923c;">${businessName}</strong> a primit un trial gratuit de ${trialDays} zile cu planul Standard. Iata ce poti face:
                      </p>

                      <table role="presentation" width="100%" style="margin: 20px 0;">
                        <tr>
                          <td style="background: rgba(251, 146, 60, 0.06); border: 1px solid rgba(251, 146, 60, 0.12); border-radius: 12px; padding: 20px;">
                            <ul style="list-style: none; padding: 0; margin: 0;">
                              <li style="padding: 6px 0; color: #a1a1aa; font-size: 14px;">&#10003; Upload logo si cover</li>
                              <li style="padding: 6px 0; color: #a1a1aa; font-size: 14px;">&#10003; Badge "Verificat"</li>
                              <li style="padding: 6px 0; color: #a1a1aa; font-size: 14px;">&#10003; 10 oferte active</li>
                              <li style="padding: 6px 0; color: #a1a1aa; font-size: 14px;">&#10003; Raspunsuri la recenzii</li>
                              <li style="padding: 6px 0; color: #a1a1aa; font-size: 14px;">&#10003; Rezumat AI al recenziilor</li>
                              <li style="padding: 6px 0; color: #a1a1aa; font-size: 14px;">&#10003; Statistici 30 de zile</li>
                            </ul>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%">
                        <tr>
                          <td align="center" style="padding: 12px 0;">
                            <a href="https://ofai.ro/cont" style="display: inline-block; background: linear-gradient(135deg, #f97316, #fb923c); color: #06060a; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 40px; border-radius: 8px;">
                              Gestioneaza business-ul
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="font-size: 13px; color: #71717a; text-align: center; margin: 16px 0 0;">
                        Trial-ul expira pe <strong>${new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString('ro-RO')}</strong>. Nu iti cerem datele cardului.
                      </p>

                      <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 24px 0;">
                      <p style="font-size: 12px; color: #52525b; text-align: center;">&copy; ${new Date().getFullYear()} ${APP_NAME}. Toate drepturile rezervate.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Trial welcome error:', error);
      return { success: false, error };
    }
    console.log(`[Email] Trial welcome sent to ${to}`);
    return { success: true, data };
  } catch (err) {
    console.error('[Email] Trial welcome exception:', err);
    return { success: false, error: err.message };
  }
}
```

### 5b. Trial Expiring Warning Email (3 days before)

```js
/**
 * Send warning email 3 days before trial expires
 */
async function sendTrialExpiringWarningEmail(to, firstName, businessName, daysLeft) {
  if (!resend) {
    console.log(`[Email] Skipping trial warning (no API key): ${to}`);
    return { success: false, reason: 'no_api_key' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Trial-ul tau expira in ${daysLeft} zile - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html lang="ro">
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; background-color: #06060a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
          <table role="presentation" width="100%" style="background-color: #06060a;">
            <tr>
              <td align="center" style="padding: 40px 16px;">
                <table role="presentation" width="600" style="max-width: 600px; width: 100%;">
                  <tr>
                    <td style="background-color: #0d0d12; border: 1px solid rgba(234, 179, 8, 0.2); border-radius: 16px; padding: 40px 32px;">
                      <div style="text-align: center; margin-bottom: 20px;">
                        <span style="font-size: 36px;">&#9200;</span>
                      </div>
                      <h1 style="font-family: 'DM Serif Display', Georgia, serif; font-size: 22px; font-weight: 400; color: #fafafa; text-align: center; margin: 0 0 24px;">
                        Trial-ul tau expira in ${daysLeft} zile
                      </h1>

                      <p style="font-size: 15px; color: #a1a1aa; line-height: 1.6;">
                        Salut${firstName ? ` ${firstName}` : ''},
                      </p>
                      <p style="font-size: 15px; color: #a1a1aa; line-height: 1.6;">
                        Trial-ul Standard pentru <strong style="color: #fb923c;">${businessName}</strong> expira in <strong style="color: #eab308;">${daysLeft} zile</strong>.
                        Dupa expirare, vei pierde acces la:
                      </p>

                      <ul style="list-style: none; padding: 0; margin: 16px 0 24px;">
                        <li style="padding: 6px 0; color: #ef4444; font-size: 14px;">&#10007; Badge "Verificat"</li>
                        <li style="padding: 6px 0; color: #ef4444; font-size: 14px;">&#10007; Logo si cover upload</li>
                        <li style="padding: 6px 0; color: #ef4444; font-size: 14px;">&#10007; Raspunsuri la recenzii</li>
                        <li style="padding: 6px 0; color: #ef4444; font-size: 14px;">&#10007; Rezumat AI</li>
                      </ul>

                      <table role="presentation" width="100%">
                        <tr>
                          <td align="center">
                            <a href="https://ofai.ro/preturi" style="display: inline-block; background: linear-gradient(135deg, #f97316, #fb923c); color: #06060a; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 40px; border-radius: 8px;">
                              Upgrade acum
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="font-size: 13px; color: #71717a; text-align: center; margin: 16px 0 0;">
                        Preturile incep de la 49 RON/luna.
                      </p>

                      <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 24px 0;">
                      <p style="font-size: 12px; color: #52525b; text-align: center;">&copy; ${new Date().getFullYear()} ${APP_NAME}.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Trial warning error:', error);
      return { success: false, error };
    }
    console.log(`[Email] Trial warning sent to ${to} (${daysLeft} days)`);
    return { success: true, data };
  } catch (err) {
    console.error('[Email] Trial warning exception:', err);
    return { success: false, error: err.message };
  }
}
```

### 5c. Trial Expired Email

```js
/**
 * Send email when trial has expired
 */
async function sendTrialExpiryEmail(to, firstName, businessName) {
  if (!resend) {
    console.log(`[Email] Skipping trial expiry (no API key): ${to}`);
    return { success: false, reason: 'no_api_key' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Trial-ul tau pentru "${businessName}" a expirat - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html lang="ro">
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; background-color: #06060a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;">
          <table role="presentation" width="100%" style="background-color: #06060a;">
            <tr>
              <td align="center" style="padding: 40px 16px;">
                <table role="presentation" width="600" style="max-width: 600px; width: 100%;">
                  <tr>
                    <td style="background-color: #0d0d12; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 16px; padding: 40px 32px;">
                      <h1 style="font-family: 'DM Serif Display', Georgia, serif; font-size: 22px; font-weight: 400; color: #fafafa; text-align: center; margin: 0 0 24px;">
                        Trial-ul a expirat
                      </h1>

                      <p style="font-size: 15px; color: #a1a1aa; line-height: 1.6;">
                        Salut${firstName ? ` ${firstName}` : ''},
                      </p>
                      <p style="font-size: 15px; color: #a1a1aa; line-height: 1.6;">
                        Trial-ul Standard pentru <strong style="color: #fb923c;">${businessName}</strong> a expirat.
                        Business-ul tau a revenit la planul <strong>Gratuit</strong>.
                      </p>
                      <p style="font-size: 15px; color: #a1a1aa; line-height: 1.6;">
                        Business-ul tau ramane vizibil pe platforma, dar cu functionalitati limitate.
                        Upgrade oricand pentru a debloca toate beneficiile.
                      </p>

                      <table role="presentation" width="100%" style="margin: 24px 0;">
                        <tr>
                          <td align="center">
                            <a href="https://ofai.ro/preturi" style="display: inline-block; background: linear-gradient(135deg, #f97316, #fb923c); color: #06060a; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 40px; border-radius: 8px;">
                              Vezi planuri
                            </a>
                          </td>
                        </tr>
                      </table>

                      <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 24px 0;">
                      <p style="font-size: 12px; color: #52525b; text-align: center;">&copy; ${new Date().getFullYear()} ${APP_NAME}.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Email] Trial expiry error:', error);
      return { success: false, error };
    }
    console.log(`[Email] Trial expiry sent to ${to}`);
    return { success: true, data };
  } catch (err) {
    console.error('[Email] Trial expiry exception:', err);
    return { success: false, error: err.message };
  }
}
```

### 5d. Update module.exports

```js
module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmail,
  sendBusinessApprovedEmail,
  sendBusinessRejectedEmail,
  sendPremiumSupportWelcome,       // from Plan 13
  sendTrialWelcomeEmail,           // NEW
  sendTrialExpiringWarningEmail,   // NEW
  sendTrialExpiryEmail,            // NEW
};
```

---

## 6. manage.ejs: Trial Countdown Display

**File:** `appredueri_backend/src/views/public/portal/manage.ejs`

The trial countdown is already handled in Plan 14's `renderSubscriptionSection()` function. However, we also want to show a persistent trial banner in the portal header (visible on ALL tabs, not just the subscription tab).

### 6a. Trial Header Banner

In the manage.ejs HTML, right after the `.portal-header` div, add a placeholder:

```html
<div id="trial-banner" style="display: none;"></div>
```

### 6b. JavaScript: Render Trial Banner

Add to the IIFE:

```js
function renderTrialBanner(subscription) {
  var banner = document.getElementById('trial-banner');
  if (!banner) return;

  if (!subscription || !subscription.isTrial) {
    banner.style.display = 'none';
    return;
  }

  var trialEnd = subscription.trialEnd;
  if (!trialEnd) { banner.style.display = 'none'; return; }

  var diff = new Date(trialEnd) - new Date();
  var daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));

  if (daysLeft <= 0) {
    // Trial expired
    banner.style.display = 'block';
    banner.innerHTML = '<div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-md); padding: 12px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">' +
      '<div style="display: flex; align-items: center; gap: 10px;">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
        '<span style="color: #ef4444; font-size: 0.875rem; font-weight: 500;">Trial expirat</span>' +
      '</div>' +
      '<a href="/preturi" style="color: #fb923c; font-size: 0.8125rem; font-weight: 500; text-decoration: none;">Upgrade acum &rarr;</a>' +
    '</div>';
    return;
  }

  // Active trial
  var isUrgent = daysLeft <= 3;
  var borderColor = isUrgent ? 'rgba(239, 68, 68, 0.2)' : 'rgba(251, 146, 60, 0.15)';
  var bgColor = isUrgent ? 'rgba(239, 68, 68, 0.06)' : 'rgba(251, 146, 60, 0.06)';
  var textColor = isUrgent ? '#ef4444' : '#fb923c';

  banner.style.display = 'block';
  banner.innerHTML = '<div style="background: ' + bgColor + '; border: 1px solid ' + borderColor + '; border-radius: var(--radius-md); padding: 12px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">' +
    '<div style="display: flex; align-items: center; gap: 10px;">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + textColor + '" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
      '<span style="color: ' + textColor + '; font-size: 0.875rem; font-weight: 500;">Trial Standard: ' + daysLeft + ' zile ramase</span>' +
    '</div>' +
    '<a href="/preturi" style="color: var(--accent); font-size: 0.8125rem; font-weight: 500; text-decoration: none;">Upgrade &rarr;</a>' +
  '</div>';
}
```

### 6c. Call renderTrialBanner

In the `loadSubscription()` function (or wherever subscription data is loaded and used):

```js
async function loadSubscription() {
  try {
    var resp = await fetch('/my-businesses/' + state.businessId + '/subscription', {
      headers: { 'Authorization': 'Bearer ' + state.token }
    });
    var data = await resp.json();
    state.subscription = data;
    renderTrialBanner(data);          // <-- ADD THIS
    renderSubscriptionSection(data);  // from Plan 14
    renderSupportSection(data);       // from Plan 13
  } catch (err) {
    console.error('Failed to load subscription:', err);
  }
}
```

---

## 7. Anti-Abuse: One Trial Per Business

The trial creation logic in section 3b already checks `existingSub.length === 0` before creating a trial. This means:

- New businesses (just created in the approval flow) have no existing subscription, so they get a trial.
- If someone re-registers the same business name, it would be a NEW business_id, so it gets a new trial. This is acceptable because admin manually approves each request and can deny duplicates.
- If admin wants to re-grant a trial to an existing business, they would need to manually insert a subscription record.

### Additional Safety: Check Trial History

For extra protection, add a history check:

```js
// In the approval handler, before creating the trial:
const { rows: pastTrials } = await client.query(
  `SELECT id FROM subscription_history
   WHERE business_id = $1 AND action = 'trial_started'
   LIMIT 1`,
  [businessId]
);

if (existingSub.length === 0 && pastTrials.length === 0) {
  // Create trial (code from section 3b)
  // ...
} else {
  console.log(`[Admin] Business #${businessId} skipped trial (already has subscription or past trial)`);
  // Assign free tier if no subscription exists
  if (existingSub.length === 0) {
    const freePlan = plans.free;
    await client.query(
      `INSERT INTO business_subscriptions (business_id, plan_id, status, billing_cycle)
       VALUES ($1, $2, 'active', 'none')`,
      [businessId, freePlan.id]
    );
  }
}
```

Note: For a brand new business just created in this transaction, `pastTrials` will always be empty because no history exists yet. This check is a safety net for edge cases (e.g., if the approval flow is ever modified to handle re-approvals).

---

## 8. Gotchas

1. **Existing businesses do NOT get trial.** Migration 033 assigns all existing businesses to the free tier. Only NEW businesses created through the approval flow get the 14-day trial. Do not run a backfill.

2. **Trial creates a `status = 'trial'` subscription, not `status = 'active'`.** The unique index `idx_business_subscriptions_active` covers both `'active'` and `'trial'` statuses, so there can only be one active/trial subscription per business.

3. **Cron timing: 04:15 UTC.** The trial expiration cron runs at 04:15, which is 15 minutes after the general subscription cron (04:00 from Plan 00). This avoids race conditions if both try to modify the same subscriptions. **If Plan 00's cron already handles trial expiry, integrate the email logic into that cron instead of creating a duplicate.**

4. **Email deduplication.** The 3-day warning email uses a range: `BETWEEN NOW() + INTERVAL '2 days' AND NOW() + INTERVAL '4 days'`. This means the warning is sent on exactly the day when trial_end is 3 days away. But if the cron runs at 04:15 and trial_end is at 04:00 (exactly 3 days away), the range might miss it. **Use a wider window** `BETWEEN NOW() + INTERVAL '2 days 20 hours' AND NOW() + INTERVAL '3 days 4 hours'` to be safe, or use a `trial_warning_sent` flag on the subscription to prevent duplicates.

5. **Badge sync in transaction.** The `syncBadgeType(client, businessId, ...)` call MUST use the `client` (transaction connection), not `pool`. This ensures the badge update is rolled back if the transaction fails.

6. **`getPlans(pool)` uses `pool`, not `client`.** This is intentional -- the plans cache reads from the shared pool and is safe to use outside the transaction. The plan data is static reference data.

7. **Multiple owners per business.** The `user_businesses` join may return multiple users if a business has multiple owners. The email queries use `LIMIT 1` to send to just one owner. If you want all owners to receive the email, remove the LIMIT and loop over the results.

8. **Trial overlap with Stripe.** If a user starts a trial and then immediately upgrades via Stripe (Plan 01), the trial subscription should be marked as `cancelled` (not `expired`). The Stripe webhook handler should check for and cancel any existing trial before creating the paid subscription.

---

## 9. Verification Checklist

- [ ] New business approval creates a 14-day Standard trial subscription
- [ ] `business_subscriptions` record has `status = 'trial'`, correct `trial_start` and `trial_end`
- [ ] `subscription_history` logs `trial_started` action
- [ ] Business badge synced to 'verified' on trial start
- [ ] Trial welcome email sent on approval
- [ ] manage.ejs trial banner shows days remaining
- [ ] Trial banner color changes to red when <= 3 days
- [ ] Cron sends warning email 3 days before expiry
- [ ] Cron expires trial and creates free subscription
- [ ] Badge reverts to null on trial expiry
- [ ] Trial expiry email sent
- [ ] Existing businesses NOT affected (no trial for them)
- [ ] Second trial prevented for same business
- [ ] manage.ejs "Abonament" tab shows trial status correctly
