# 13 -- Priority Support

> **Scop:** Business-urile Premium primesc indicator de suport prioritar + contact dedicat in portalul de business. Non-Premium vad un CTA de upgrade.
> **Dependinte:** `00-subscription-foundation.md` (tabele, `tiers.js`, `tierAuth.js`)
> **Fisiere afectate:** `manage.ejs` (sectiune noua), `business-portal.js` (minimal), `email.js` (template nou), `main.css` (styling nou)
> **Efort estimat:** Mic -- predominantly UI/UX, minimal backend

---

## 1. Overview

This is a high-perceived-value, low-effort feature. Premium businesses get:
1. A "Suport Prioritar" card in their manage.ejs portal dashboard
2. A dedicated support email: `premium@ofai.ro`
3. A priority support phone number (or WhatsApp)
4. A badge on their support requests (future: ticketing system integration)
5. An email template for Premium support confirmations

Non-Premium businesses see an upgrade CTA in place of the support card.

---

## 2. No Migration Needed

This feature does not require any database changes. The `subscription_plans` table already has `has_priority_support BOOLEAN` (defined in migration 033). The Premium plan has `has_priority_support = TRUE`, others have `FALSE`.

**Optional future column** (NOT needed now): If a ticketing system is added later, a `support_priority` column on a `support_tickets` table would flag Premium tickets for faster routing.

---

## 3. Backend: Business Portal Subscription Endpoint

The `GET /:businessId/subscription` endpoint (defined in Plan 00) already returns all plan features. No additional backend endpoint is needed.

However, we should ensure the subscription response explicitly includes `has_priority_support`:

**File:** `appredueri_backend/src/routes/business-portal.js`

In the `GET /:businessId/subscription` handler (from Plan 00, section 5), ensure the response includes:

```js
router.get('/:businessId/subscription', businessAuth, async (req, res) => {
  const { plan, tier, isTrial, subscription } = req.tier;
  res.json({
    tier,
    plan: {
      slug: plan.slug,
      name: plan.name,
      // ... all other fields ...
      hasPrioritySupport: plan.has_priority_support,  // ENSURE THIS IS INCLUDED
      badgeType: plan.badge_type,
    },
    isTrial,
    trialEnd: subscription?.trial_end || null,
    periodEnd: subscription?.current_period_end || null,
    cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
  });
});
```

---

## 4. manage.ejs: Support Section

**File:** `appredueri_backend/src/views/public/portal/manage.ejs`

### 4a. Add "Suport" Tab

In the tabs section (around the `.portal-tabs` div), add a new tab:

```html
<button class="portal-tab" data-tab="support" onclick="switchTab('support')">
  Suport
</button>
```

### 4b. Add Support Tab Panel

Add the following panel after the existing tab panels (before the closing `</div>` of the portal container):

```html
<!-- ═══ SUPPORT TAB ═══ -->
<div class="tab-panel" id="panel-support">
  <div id="support-content">
    <!-- Filled by JS based on subscription tier -->
    <div class="glass-card" style="text-align: center; padding: 40px;">
      <div class="spinner" style="margin: 0 auto;"></div>
    </div>
  </div>
</div>
```

### 4c. JavaScript: Render Support Section

In the `<script>` section of manage.ejs, inside the main IIFE, add the support rendering logic. This should be called after the subscription data is loaded:

```js
// ── SUPPORT SECTION ──
function renderSupportSection(subscription) {
  var container = document.getElementById('support-content');
  if (!container) return;

  var hasPriority = subscription && subscription.plan && subscription.plan.hasPrioritySupport;

  if (hasPriority) {
    container.innerHTML = `
      <div class="glass-card" style="border-color: rgba(167, 139, 250, 0.2);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(167, 139, 250, 0.12); display: flex; align-items: center; justify-content: center;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <h3 style="font-size: 1.125rem; font-weight: 600; color: var(--text-primary); margin: 0;">Suport Prioritar</h3>
            <p style="font-size: 0.8125rem; color: #a78bfa; margin: 2px 0 0;">Premium</p>
          </div>
        </div>

        <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; margin-bottom: 24px;">
          Ca business Premium, beneficiezi de suport prioritar. Echipa noastra iti raspunde in maxim 4 ore in zilele lucratoare.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
          <!-- Email Card -->
          <a href="mailto:premium@ofai.ro?subject=Suport Premium - ${encodeURIComponent(state.business.name)}" class="support-contact-card" style="text-decoration: none;">
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; transition: border-color 0.2s; cursor: pointer;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <span style="font-size: 0.8125rem; font-weight: 500; color: var(--text-primary);">Email</span>
              </div>
              <span style="font-size: 0.875rem; color: #a78bfa;">premium@ofai.ro</span>
            </div>
          </a>

          <!-- WhatsApp Card -->
          <a href="https://wa.me/40700000000?text=${encodeURIComponent('Salut, am nevoie de suport pentru business-ul ' + state.business.name + ' (Premium)')}" target="_blank" class="support-contact-card" style="text-decoration: none;">
            <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; transition: border-color 0.2s; cursor: pointer;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#22c55e"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.122 1.523 5.86L0 24l6.335-1.652A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 0 1-5.39-1.586l-.386-.23-3.767.983.999-3.648-.252-.4A9.935 9.935 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                <span style="font-size: 0.8125rem; font-weight: 500; color: var(--text-primary);">WhatsApp</span>
              </div>
              <span style="font-size: 0.875rem; color: #22c55e;">+40 700 000 000</span>
            </div>
          </a>
        </div>

        <div style="background: rgba(167, 139, 250, 0.06); border: 1px solid rgba(167, 139, 250, 0.12); border-radius: var(--radius-md); padding: 14px 16px;">
          <div style="display: flex; align-items: start; gap: 10px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <div style="font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.5;">
              <strong style="color: #a78bfa;">Timp mediu de raspuns:</strong> sub 4 ore in zilele lucratoare (Luni-Vineri, 09:00-18:00).
              <br>Mentiunea <strong>"Premium"</strong> este adaugata automat in subiectul emailului.
            </div>
          </div>
        </div>
      </div>

      <!-- Support History / FAQ -->
      <div class="glass-card" style="margin-top: 16px;">
        <h4 style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin: 0 0 16px;">Intrebari frecvente</h4>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px 16px;">
            <p style="font-weight: 500; color: var(--text-primary); margin: 0 0 6px; font-size: 0.875rem;">Cum imi schimb planul de abonament?</p>
            <p style="color: var(--text-secondary); margin: 0; font-size: 0.8125rem; line-height: 1.5;">Mergi la tab-ul "Abonament" din acest portal. De acolo poti face upgrade sau downgrade.</p>
          </div>
          <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px 16px;">
            <p style="font-weight: 500; color: var(--text-primary); margin: 0 0 6px; font-size: 0.875rem;">Cum adaug mai multe locatii?</p>
            <p style="color: var(--text-secondary); margin: 0; font-size: 0.8125rem; line-height: 1.5;">In tab-ul "Profil", sectiunea Locatii. Limita depinde de planul tau.</p>
          </div>
          <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 14px 16px;">
            <p style="font-weight: 500; color: var(--text-primary); margin: 0 0 6px; font-size: 0.875rem;">Pot anula abonamentul oricand?</p>
            <p style="color: var(--text-secondary); margin: 0; font-size: 0.8125rem; line-height: 1.5;">Da, poti anula oricand. Vei pastra beneficiile pana la sfarsitul perioadei platite.</p>
          </div>
        </div>
      </div>
    `;
  } else {
    // Non-Premium: show upgrade CTA
    var tierName = (subscription && subscription.plan) ? subscription.plan.name : 'Gratuit';
    container.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 48px 32px;">
        <div style="width: 64px; height: 64px; border-radius: 16px; background: rgba(167, 139, 250, 0.08); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#71717a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <h3 style="font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin: 0 0 8px;">Suport Prioritar</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0 0 6px;">Disponibil cu planul <strong style="color: #a78bfa;">Premium</strong></p>
        <p style="color: var(--text-tertiary); font-size: 0.8125rem; margin: 0 0 28px;">Raspuns in maxim 4 ore, contact dedicat prin email si WhatsApp.</p>
        <p style="color: var(--text-tertiary); font-size: 0.75rem; margin: 0 0 20px;">Planul tau actual: <strong style="color: var(--accent);">${tierName}</strong></p>
        <a href="/preturi" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; background: linear-gradient(135deg, #a78bfa, #8b5cf6); color: #fff; border-radius: var(--radius-full); font-size: 0.9rem; font-weight: 600; text-decoration: none; transition: opacity 0.2s;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          Upgrade la Premium
        </a>
      </div>
    `;
  }
}
```

### 4d. Call renderSupportSection

In the existing subscription loading code (or in the init function that loads business data), call `renderSupportSection(subscriptionData)` after the subscription data is fetched:

```js
// Inside the loadSubscription() or similar function:
async function loadSubscription() {
  try {
    var resp = await fetch('/my-businesses/' + state.businessId + '/subscription', {
      headers: { 'Authorization': 'Bearer ' + state.token }
    });
    var data = await resp.json();
    state.subscription = data;
    renderSupportSection(data);  // <-- ADD THIS
    // ... other subscription UI updates ...
  } catch (err) {
    console.error('Failed to load subscription:', err);
  }
}
```

---

## 5. CSS Additions for Support Card

**File:** `appredueri_backend/src/public/css/main.css`

These are minimal additions since most styling is inline in the template:

```css
/* --- Priority Support contact cards --- */
.support-contact-card > div:hover {
  border-color: var(--border-hover) !important;
}
```

Alternatively, add the hover styling in the manage.ejs `<style>` block to keep it scoped:

```css
/* In manage.ejs <style> block */
.support-contact-card > div:hover {
  border-color: var(--border-hover) !important;
}
```

---

## 6. Email Template: Premium Support Confirmation

**File:** `appredueri_backend/src/services/email.js`

Add a new function for when a business upgrades to Premium (called from the upgrade flow):

```js
/**
 * Send Premium support welcome email when a business upgrades to Premium
 */
async function sendPremiumSupportWelcome(to, firstName, businessName) {
  if (!resend) {
    console.log(`[Email] Skipping premium support welcome (no API key): ${to}`);
    return { success: false, reason: 'no_api_key' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Suport Prioritar activat pentru "${businessName}" - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html lang="ro">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #06060a; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table role="presentation" width="100%" style="background-color: #06060a;">
            <tr>
              <td align="center" style="padding: 40px 16px;">
                <table role="presentation" width="600" style="max-width: 600px; width: 100%;">
                  <!-- Header -->
                  <tr>
                    <td style="background: radial-gradient(ellipse at center top, rgba(167, 139, 250, 0.12) 0%, rgba(6, 6, 10, 0) 70%); background-color: #0d0d12; border: 1px solid rgba(167, 139, 250, 0.15); border-bottom: none; border-radius: 16px 16px 0 0; padding: 40px 32px 24px; text-align: center;">
                      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #a78bfa;">PREMIUM</p>
                    </td>
                  </tr>
                  <!-- Content -->
                  <tr>
                    <td style="background-color: #0d0d12; border-left: 1px solid rgba(167, 139, 250, 0.15); border-right: 1px solid rgba(167, 139, 250, 0.15); padding: 0 32px 32px;">
                      <h1 style="font-family: 'DM Serif Display', Georgia, serif; font-size: 24px; font-weight: 400; color: #fafafa; text-align: center; margin: 32px 0 16px;">Suport Prioritar Activat</h1>
                      <p style="font-size: 15px; color: #a1a1aa; line-height: 1.6;">
                        Salut${firstName ? ` <strong style="color: #fafafa;">${firstName}</strong>` : ''},
                      </p>
                      <p style="font-size: 15px; color: #a1a1aa; line-height: 1.6;">
                        Business-ul <strong style="color: #a78bfa;">${businessName}</strong> beneficiaza acum de suport prioritar. Iata cum ne poti contacta:
                      </p>
                      <table role="presentation" width="100%" style="margin: 24px 0;">
                        <tr>
                          <td style="background: rgba(167, 139, 250, 0.06); border: 1px solid rgba(167, 139, 250, 0.12); border-radius: 12px; padding: 20px;">
                            <p style="margin: 0 0 12px; font-size: 14px; color: #a78bfa; font-weight: 600;">Contact Prioritar:</p>
                            <p style="margin: 0 0 8px; font-size: 14px; color: #fafafa;">
                              Email: <a href="mailto:premium@ofai.ro" style="color: #a78bfa; text-decoration: none;">premium@ofai.ro</a>
                            </p>
                            <p style="margin: 0; font-size: 14px; color: #fafafa;">
                              WhatsApp: <a href="https://wa.me/40700000000" style="color: #22c55e; text-decoration: none;">+40 700 000 000</a>
                            </p>
                            <p style="margin: 12px 0 0; font-size: 13px; color: #71717a;">
                              Timp mediu de raspuns: sub 4 ore (zilele lucratoare)
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #0d0d12; border: 1px solid rgba(167, 139, 250, 0.15); border-top: none; border-radius: 0 0 16px 16px; padding: 20px 32px 32px; text-align: center;">
                      <p style="font-size: 12px; color: #52525b;">&copy; ${new Date().getFullYear()} ${APP_NAME}. Toate drepturile rezervate.</p>
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
      console.error('[Email] Premium support welcome error:', error);
      return { success: false, error };
    }
    console.log(`[Email] Premium support welcome sent to ${to}`);
    return { success: true, data };
  } catch (err) {
    console.error('[Email] Premium support welcome exception:', err);
    return { success: false, error: err.message };
  }
}

// Add to module.exports:
module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmail,
  sendBusinessApprovedEmail,
  sendBusinessRejectedEmail,
  sendPremiumSupportWelcome,  // NEW
};
```

### When to Call `sendPremiumSupportWelcome`

This should be called in the upgrade flow (Plan 01 -- Stripe webhook or manual upgrade):

```js
// In the upgrade handler (stripe webhook or billing route):
if (newPlan.slug === 'premium') {
  const { rows: ownerRows } = await pool.query(
    `SELECT u.email, u.first_name, b.name as business_name
     FROM user_businesses ub
     JOIN users u ON u.id = ub.user_id
     JOIN businesses b ON b.id = ub.business_id
     WHERE ub.business_id = $1
     LIMIT 1`,
    [businessId]
  );
  if (ownerRows.length > 0) {
    sendPremiumSupportWelcome(ownerRows[0].email, ownerRows[0].first_name, ownerRows[0].business_name)
      .catch(err => console.error('[Billing] Premium support email failed:', err));
  }
}
```

---

## 7. Gotchas

1. **This is a mostly-UI feature.** There is no backend enforcement of "priority" -- it is a communication channel and a perceived value feature. The actual priority routing happens in the support team's workflow (Zendesk/email filtering rules on `premium@ofai.ro`).

2. **Phone number placeholder.** The `+40 700 000 000` WhatsApp number is a placeholder. Replace with the actual premium support number before deployment. This appears in TWO places: the manage.ejs template and the email template.

3. **Email address `premium@ofai.ro`.** This must be a real mailbox (or alias) before going live. Set up email forwarding from `premium@ofai.ro` to the support team.

4. **No backend state needed.** The support section visibility is determined entirely by the client-side subscription data (`has_priority_support`). No new API call required.

5. **manage.ejs IIFE variable ordering.** Per the Memory doc gotcha: state vars must be at the TOP of the IIFE before hash restore. The `renderSupportSection` function is defined inside the IIFE and called after data loads -- this is fine because function declarations are hoisted.

6. **Mobile app (Flutter).** Priority support is NOT shown in the Flutter app for now. The business portal is web-only. If needed later, add a "Suport" tab in the Flutter portal screen that shows similar content.

7. **Upgrade CTA link.** The non-Premium CTA links to `/preturi` which is the pricing page (Plan 14). If Plan 14 is not yet implemented, change the link to a modal or anchor that explains the upgrade options inline.

8. **SLA is aspirational.** "Under 4 hours" response time is a goal, not a contractual SLA. The copy says "in maxim 4 ore in zilele lucratoare" to set expectations without hard guarantees.

---

## 8. Verification Checklist

After implementation:
- [ ] Premium business portal shows "Suport Prioritar" card with email + WhatsApp
- [ ] Non-Premium business portal shows upgrade CTA for support
- [ ] Email link pre-fills subject with business name
- [ ] WhatsApp link pre-fills message with business name
- [ ] FAQ section renders correctly
- [ ] `sendPremiumSupportWelcome` email template renders correctly (test with Resend)
- [ ] Purple accent (#a78bfa) consistent with premium branding
- [ ] Contact card hover states work
- [ ] Support tab appears in the manage.ejs tab bar
- [ ] Tab switching works correctly (hash URL updates)
