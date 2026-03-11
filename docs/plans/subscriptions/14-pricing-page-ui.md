# 14 -- Pricing Page & Upgrade UI

> **Scop:** Pagina publica de preturi (`/preturi`) + sectiune de management abonament in portalul de business (manage.ejs). Include upgrade/downgrade flow.
> **Dependinte:** `00-subscription-foundation.md`, `01-stripe-skeleton.md` (pentru checkout flow)
> **Fisiere afectate:** `pricing.ejs` (NOU), `web.js` (route noua), `manage.ejs` (sectiune abonament), `navbar.ejs` (link), `main.css` (styling), `business-portal.js` (minimal)
> **Nota:** Aceasta este o pagina WEB ONLY. Flutter nu are pricing page (per user requirement).

---

## 1. Route: GET `/preturi`

**File:** `appredueri_backend/src/routes/web.js`

Add the pricing page route. This is a public page (no auth required), but we use `optionalWebAuth` (already applied via `router.use(optionalWebAuth)` at the top of web.js):

```js
// ═══════════════════════════════════════════════════════
// PRICING PAGE
// ═══════════════════════════════════════════════════════
router.get('/preturi', async (req, res) => {
  try {
    // Fetch plans from DB
    const { rows: plans } = await pool.query(
      'SELECT * FROM subscription_plans ORDER BY sort_order ASC'
    );

    res.render('public/pricing', {
      pageTitle: 'Preturi - OFAI',
      activePage: 'preturi',
      plans,
      webUser: req.webUser || null,
    });
  } catch (err) {
    console.error('[Web] Pricing page error:', err);
    res.status(500).render('public/404', {
      pageTitle: 'Eroare',
      activePage: '',
      webUser: req.webUser || null,
    });
  }
});
```

---

## 2. EJS Template: `pricing.ejs`

**File:** `appredueri_backend/src/views/public/pricing.ejs` (NEW)

```ejs
<%- include('partials/head', { pageTitle: pageTitle, activePage: activePage }) %>
<%- include('partials/navbar', { activePage: activePage, webUser: webUser }) %>

<main class="pricing-page">
  <div class="pricing-container">

    <!-- Header -->
    <div class="pricing-header">
      <h1 class="pricing-title">Alege planul potrivit</h1>
      <p class="pricing-subtitle">Creste-ti vizibilitatea si atrage mai multi clienti cu instrumentele potrivite.</p>

      <!-- Billing Toggle -->
      <div class="billing-toggle">
        <span class="billing-label" id="billing-monthly-label">Lunar</span>
        <button class="billing-switch" id="billing-switch" onclick="toggleBilling()" aria-label="Comuta intre lunar si anual">
          <span class="billing-switch-thumb" id="billing-thumb"></span>
        </button>
        <span class="billing-label" id="billing-yearly-label">
          Anual
          <span class="billing-save-badge">-17%</span>
        </span>
      </div>
    </div>

    <!-- Plans Grid -->
    <div class="pricing-grid">
      <% plans.forEach(function(plan) { %>
        <div class="pricing-card<%= plan.slug === 'premium' ? ' pricing-card--premium' : '' %><%= plan.slug === 'standard' ? ' pricing-card--popular' : '' %>" data-plan="<%= plan.slug %>">

          <% if (plan.slug === 'standard') { %>
            <div class="pricing-popular-badge">Cel mai popular</div>
          <% } %>
          <% if (plan.slug === 'premium') { %>
            <div class="pricing-premium-badge">Premium</div>
          <% } %>

          <div class="pricing-card-header">
            <h2 class="pricing-plan-name"><%= plan.name %></h2>

            <!-- Price -->
            <div class="pricing-price">
              <span class="pricing-amount" data-monthly="<%= plan.price_monthly %>" data-yearly="<%= plan.price_yearly %>">
                <%= plan.price_monthly === 0 ? '0' : (plan.price_monthly / 100).toFixed(0) %>
              </span>
              <div class="pricing-price-meta">
                <span class="pricing-currency">RON</span>
                <span class="pricing-period">/luna</span>
              </div>
            </div>
            <% if (plan.price_monthly > 0) { %>
              <p class="pricing-yearly-note" id="yearly-note-<%= plan.slug %>" style="display: none;">
                Facturat <strong><%= (plan.price_yearly / 100).toFixed(0) %> RON</strong>/an
              </p>
            <% } %>
          </div>

          <div class="pricing-card-body">
            <!-- Features List -->
            <ul class="pricing-features">
              <!-- Offers -->
              <li class="pricing-feature">
                <svg class="pricing-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span><%= plan.max_active_offers === null ? 'Oferte nelimitate' : plan.max_active_offers + ' oferte active' %></span>
              </li>

              <!-- Gallery -->
              <li class="pricing-feature">
                <svg class="pricing-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span><%= plan.max_gallery_images === null ? 'Galerie nelimitata' : plan.max_gallery_images + ' imagini galerie' %></span>
              </li>

              <!-- Locations -->
              <li class="pricing-feature">
                <svg class="pricing-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span><%= plan.max_locations === null ? 'Locatii nelimitate' : plan.max_locations + (plan.max_locations === 1 ? ' locatie' : ' locatii') %></span>
              </li>

              <!-- Promo codes -->
              <li class="pricing-feature">
                <% if (plan.max_promo_codes_per_offer > 0 || plan.max_promo_codes_per_offer === null) { %>
                  <svg class="pricing-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span><%= plan.max_promo_codes_per_offer === null ? 'Coduri promo nelimitate' : plan.max_promo_codes_per_offer + ' coduri promo/oferta' %></span>
                <% } else { %>
                  <svg class="pricing-x" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <span class="pricing-feature--disabled">Coduri promo</span>
                <% } %>
              </li>

              <!-- Logo upload -->
              <li class="pricing-feature">
                <% if (plan.can_upload_logo) { %>
                  <svg class="pricing-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Upload logo</span>
                <% } else { %>
                  <svg class="pricing-x" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <span class="pricing-feature--disabled">Upload logo</span>
                <% } %>
              </li>

              <!-- Cover upload -->
              <li class="pricing-feature">
                <% if (plan.can_upload_cover) { %>
                  <svg class="pricing-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Upload cover</span>
                <% } else { %>
                  <svg class="pricing-x" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <span class="pricing-feature--disabled">Upload cover</span>
                <% } %>
              </li>

              <!-- Analytics -->
              <li class="pricing-feature">
                <svg class="pricing-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Statistici (<%= plan.analytics_days %> zile)</span>
              </li>

              <!-- Badge -->
              <li class="pricing-feature">
                <% if (plan.badge_type === 'premium') { %>
                  <svg class="pricing-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style="color: #a78bfa;">Badge Premium</span>
                <% } else if (plan.badge_type === 'verified') { %>
                  <svg class="pricing-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Badge Verificat</span>
                <% } else { %>
                  <svg class="pricing-x" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <span class="pricing-feature--disabled">Badge verificare</span>
                <% } %>
              </li>

              <!-- Review responses -->
              <li class="pricing-feature">
                <% if (plan.can_respond_reviews) { %>
                  <svg class="pricing-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Raspunsuri la recenzii</span>
                <% } else { %>
                  <svg class="pricing-x" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <span class="pricing-feature--disabled">Raspunsuri la recenzii</span>
                <% } %>
              </li>

              <!-- AI Summary -->
              <li class="pricing-feature">
                <% if (plan.has_ai_summary) { %>
                  <svg class="pricing-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Rezumat AI recenzii</span>
                <% } else { %>
                  <svg class="pricing-x" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <span class="pricing-feature--disabled">Rezumat AI recenzii</span>
                <% } %>
              </li>

              <!-- Priority Support (Premium only) -->
              <% if (plan.has_priority_support) { %>
                <li class="pricing-feature">
                  <svg class="pricing-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style="color: #a78bfa;">Suport prioritar</span>
                </li>
              <% } %>
            </ul>
          </div>

          <!-- CTA Button -->
          <div class="pricing-card-footer">
            <% if (plan.slug === 'free') { %>
              <a href="/pentru-business" class="pricing-cta pricing-cta--free">Incepe gratuit</a>
            <% } else if (plan.slug === 'standard') { %>
              <a href="<%= webUser ? '/cont#portal' : '/register?returnTo=/preturi' %>" class="pricing-cta pricing-cta--standard" data-plan-slug="standard">
                Incepe trial gratuit
              </a>
              <p class="pricing-trial-note">14 zile gratuit, fara card</p>
            <% } else { %>
              <a href="<%= webUser ? '/cont#portal' : '/register?returnTo=/preturi' %>" class="pricing-cta pricing-cta--premium" data-plan-slug="premium">
                Alege Premium
              </a>
            <% } %>
          </div>
        </div>
      <% }); %>
    </div>

    <!-- FAQ Section -->
    <div class="pricing-faq">
      <h2 class="pricing-faq-title">Intrebari frecvente</h2>
      <div class="pricing-faq-grid">
        <div class="pricing-faq-item">
          <h3>Pot schimba planul oricand?</h3>
          <p>Da, poti face upgrade sau downgrade oricand. La upgrade, platesti diferenta pro-rata. La downgrade, pastrezi beneficiile pana la sfarsitul perioadei platite.</p>
        </div>
        <div class="pricing-faq-item">
          <h3>Ce se intampla dupa trial?</h3>
          <p>Dupa cele 14 zile de trial Standard, business-ul revine automat la planul Gratuit. Nu iti cerem datele cardului pentru trial.</p>
        </div>
        <div class="pricing-faq-item">
          <h3>Cum functioneaza facturarea anuala?</h3>
          <p>Platesti o singura data pe an si economisesti ~17% fata de plata lunara. Factura se emite automat la inceputul perioadei.</p>
        </div>
        <div class="pricing-faq-item">
          <h3>Pot anula abonamentul?</h3>
          <p>Da, poti anula oricand din Business Portal. Beneficiile raman active pana la sfarsitul perioadei platite.</p>
        </div>
      </div>
    </div>

  </div>
</main>

<script>
(function() {
  var isYearly = false;

  window.toggleBilling = function() {
    isYearly = !isYearly;
    var thumb = document.getElementById('billing-thumb');
    var monthlyLabel = document.getElementById('billing-monthly-label');
    var yearlyLabel = document.getElementById('billing-yearly-label');

    thumb.style.transform = isYearly ? 'translateX(24px)' : 'translateX(0)';
    monthlyLabel.style.color = isYearly ? 'var(--text-tertiary)' : 'var(--text-primary)';
    yearlyLabel.style.color = isYearly ? 'var(--text-primary)' : 'var(--text-tertiary)';

    // Update prices
    document.querySelectorAll('.pricing-amount').forEach(function(el) {
      var monthly = parseInt(el.dataset.monthly);
      var yearly = parseInt(el.dataset.yearly);
      if (isYearly && yearly > 0) {
        el.textContent = Math.round(yearly / 12 / 100);
      } else {
        el.textContent = monthly === 0 ? '0' : Math.round(monthly / 100);
      }
    });

    // Toggle yearly notes
    document.querySelectorAll('[id^="yearly-note-"]').forEach(function(el) {
      el.style.display = isYearly ? 'block' : 'none';
    });
  };
})();
</script>

<%- include('partials/footer') %>
```

---

## 3. CSS: Pricing Page Styles

**File:** `appredueri_backend/src/public/css/main.css`

Add at the end of the file (or in a logical section):

```css
/* ═══ PRICING PAGE ═══════════════════════════════════════ */
.pricing-page {
  padding: 120px 0 80px;
  min-height: 100vh;
}
.pricing-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Header */
.pricing-header {
  text-align: center;
  margin-bottom: 48px;
}
.pricing-title {
  font-family: 'DM Serif Display', serif;
  font-size: 2.5rem;
  color: var(--text-primary, #f4f4f5);
  margin: 0 0 12px;
}
.pricing-subtitle {
  font-size: 1.125rem;
  color: var(--text-muted, #a1a1aa);
  margin: 0 0 32px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

/* Billing Toggle */
.billing-toggle {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.billing-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-tertiary, #71717a);
  transition: color 0.2s;
  user-select: none;
}
.billing-label:first-child { color: var(--text-primary, #f4f4f5); }
.billing-save-badge {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 4px;
}
.billing-switch {
  position: relative;
  width: 48px;
  height: 24px;
  background: var(--bg-card, rgba(255,255,255,0.04));
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 9999px;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s;
}
.billing-switch:hover { border-color: var(--accent, #fb923c); }
.billing-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: var(--accent, #fb923c);
  border-radius: 50%;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Plans Grid */
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 64px;
}
@media (max-width: 768px) {
  .pricing-grid { grid-template-columns: 1fr; max-width: 400px; margin-left: auto; margin-right: auto; }
  .pricing-title { font-size: 2rem; }
}

/* Card */
.pricing-card {
  position: relative;
  background: var(--bg-card, rgba(255,255,255,0.04));
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 16px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.pricing-card:hover {
  border-color: rgba(255,255,255,0.14);
}
.pricing-card--popular {
  border-color: rgba(251, 146, 60, 0.3);
  box-shadow: 0 0 40px rgba(251, 146, 60, 0.06);
}
.pricing-card--popular:hover {
  border-color: rgba(251, 146, 60, 0.5);
  box-shadow: 0 0 60px rgba(251, 146, 60, 0.1);
}
.pricing-card--premium {
  border-color: rgba(167, 139, 250, 0.3);
  box-shadow: 0 0 40px rgba(167, 139, 250, 0.06);
}
.pricing-card--premium:hover {
  border-color: rgba(167, 139, 250, 0.5);
  box-shadow: 0 0 60px rgba(167, 139, 250, 0.1);
}

/* Badges */
.pricing-popular-badge,
.pricing-premium-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 16px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}
.pricing-popular-badge {
  background: var(--accent, #fb923c);
  color: #06060a;
}
.pricing-premium-badge {
  background: linear-gradient(135deg, #a78bfa, #8b5cf6);
  color: #fff;
}

/* Card Header */
.pricing-plan-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #f4f4f5);
  margin: 0 0 16px;
}
.pricing-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 4px;
}
.pricing-amount {
  font-size: 3rem;
  font-weight: 700;
  color: var(--text-primary, #f4f4f5);
  line-height: 1;
}
.pricing-price-meta {
  display: flex;
  flex-direction: column;
}
.pricing-currency {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary, #a1a1aa);
}
.pricing-period {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #71717a);
}
.pricing-yearly-note {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #71717a);
  margin: 8px 0 0;
}

/* Card Body */
.pricing-card-body {
  flex: 1;
  margin: 24px 0;
  border-top: 1px solid var(--border, rgba(255,255,255,0.08));
  padding-top: 24px;
}

/* Features List */
.pricing-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pricing-feature {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.875rem;
  color: var(--text-secondary, #a1a1aa);
}
.pricing-check { color: #22c55e; flex-shrink: 0; }
.pricing-x { color: var(--text-tertiary, #71717a); flex-shrink: 0; opacity: 0.5; }
.pricing-feature--disabled { color: var(--text-tertiary, #71717a); text-decoration: line-through; opacity: 0.6; }

/* Card Footer */
.pricing-card-footer {
  margin-top: auto;
  text-align: center;
}
.pricing-cta {
  display: block;
  padding: 14px 24px;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  text-align: center;
  transition: all 0.2s;
}
.pricing-cta--free {
  background: var(--bg-card, rgba(255,255,255,0.04));
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  color: var(--text-secondary, #a1a1aa);
}
.pricing-cta--free:hover { border-color: var(--accent, #fb923c); color: var(--accent, #fb923c); }
.pricing-cta--standard {
  background: linear-gradient(135deg, #f97316, #fb923c);
  color: #06060a;
}
.pricing-cta--standard:hover { opacity: 0.9; }
.pricing-cta--premium {
  background: linear-gradient(135deg, #a78bfa, #8b5cf6);
  color: #fff;
}
.pricing-cta--premium:hover { opacity: 0.9; }
.pricing-trial-note {
  font-size: 0.75rem;
  color: var(--text-tertiary, #71717a);
  margin: 8px 0 0;
}

/* FAQ */
.pricing-faq {
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 40px;
}
.pricing-faq-title {
  font-family: 'DM Serif Display', serif;
  font-size: 1.75rem;
  color: var(--text-primary, #f4f4f5);
  text-align: center;
  margin: 0 0 32px;
}
.pricing-faq-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 600px) { .pricing-faq-grid { grid-template-columns: 1fr; } }
.pricing-faq-item {
  background: var(--bg-card, rgba(255,255,255,0.04));
  border: 1px solid var(--border, rgba(255,255,255,0.08));
  border-radius: 12px;
  padding: 20px;
}
.pricing-faq-item h3 {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary, #f4f4f5);
  margin: 0 0 8px;
}
.pricing-faq-item p {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a1a1aa);
  line-height: 1.6;
  margin: 0;
}
```

---

## 4. Navbar Link

**File:** `appredueri_backend/src/views/public/partials/navbar.ejs`

Add a "Preturi" link in the navbar. Find the existing nav links and add:

```html
<a href="/preturi" class="nav-link<%= activePage === 'preturi' ? ' active' : '' %>">Preturi</a>
```

Place it after the "Pentru Business" link or at the end of the nav items, depending on the desired order.

---

## 5. manage.ejs: Subscription Management Section

**File:** `appredueri_backend/src/views/public/portal/manage.ejs`

### 5a. Add "Abonament" Tab

In the `.portal-tabs` section:

```html
<button class="portal-tab" data-tab="subscription" onclick="switchTab('subscription')">
  Abonament
</button>
```

### 5b. Add Subscription Panel

```html
<!-- ═══ SUBSCRIPTION TAB ═══ -->
<div class="tab-panel" id="panel-subscription">
  <div id="subscription-content">
    <div class="glass-card" style="text-align: center; padding: 40px;">
      <div class="spinner" style="margin: 0 auto;"></div>
    </div>
  </div>
</div>
```

### 5c. JavaScript: Render Subscription Management

Add to the manage.ejs script IIFE:

```js
// ── SUBSCRIPTION MANAGEMENT ──
function renderSubscriptionSection(subscription) {
  var container = document.getElementById('subscription-content');
  if (!container) return;

  var tier = subscription ? subscription.tier : 'free';
  var plan = subscription ? subscription.plan : { name: 'Gratuit', slug: 'free' };
  var isTrial = subscription ? subscription.isTrial : false;
  var trialEnd = subscription ? subscription.trialEnd : null;
  var periodEnd = subscription ? subscription.periodEnd : null;
  var cancelAtEnd = subscription ? subscription.cancelAtPeriodEnd : false;

  // Calculate trial days remaining
  var trialDaysLeft = 0;
  if (isTrial && trialEnd) {
    var diff = new Date(trialEnd) - new Date();
    trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  // Tier color
  var tierColor = tier === 'premium' ? '#a78bfa' : (tier === 'standard' ? '#fb923c' : '#71717a');

  var html = '';

  // Current Plan Card
  html += '<div class="glass-card" style="border-color: ' + tierColor + '20;">';

  // Trial banner
  if (isTrial && trialDaysLeft > 0) {
    html += '<div style="background: rgba(251, 146, 60, 0.08); border: 1px solid rgba(251, 146, 60, 0.2); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    html += '<span style="color: #fb923c; font-size: 0.875rem; font-weight: 500;">Trial Standard: ' + trialDaysLeft + ' zile ramase</span>';
    html += '</div>';
  }

  // Expired trial banner
  if (isTrial && trialDaysLeft <= 0) {
    html += '<div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    html += '<span style="color: #ef4444; font-size: 0.875rem; font-weight: 500;">Trial expirat &mdash; Upgrade acum pentru a pastra beneficiile</span>';
    html += '</div>';
  }

  // Plan header
  html += '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">';
  html += '<div>';
  html += '<h3 style="font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin: 0;">Planul tau: <span style="color: ' + tierColor + ';">' + plan.name + '</span></h3>';
  if (cancelAtEnd && periodEnd) {
    html += '<p style="color: #ef4444; font-size: 0.8125rem; margin: 4px 0 0;">Se anuleaza la ' + new Date(periodEnd).toLocaleDateString('ro-RO') + '</p>';
  }
  html += '</div>';
  html += '<a href="/preturi" style="color: var(--accent); font-size: 0.875rem; text-decoration: none; font-weight: 500;">Vezi toate planurile &rarr;</a>';
  html += '</div>';

  // Plan features summary (compact)
  html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px;">';
  var features = [
    { label: 'Oferte active', value: plan.maxActiveOffers === null ? 'Nelimitate' : plan.maxActiveOffers },
    { label: 'Imagini galerie', value: plan.maxGalleryImages === null ? 'Nelimitate' : plan.maxGalleryImages },
    { label: 'Locatii', value: plan.maxLocations === null ? 'Nelimitate' : plan.maxLocations },
    { label: 'Statistici', value: plan.analyticsDays + ' zile' },
  ];
  features.forEach(function(f) {
    html += '<div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px 14px;">';
    html += '<p style="font-size: 0.75rem; color: var(--text-tertiary); margin: 0 0 2px;">' + f.label + '</p>';
    html += '<p style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary); margin: 0;">' + f.value + '</p>';
    html += '</div>';
  });
  html += '</div>';

  // Action buttons
  html += '<div style="display: flex; gap: 12px; flex-wrap: wrap;">';

  if (tier === 'free') {
    html += '<a href="/preturi" style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 24px; background: linear-gradient(135deg, #f97316, #fb923c); color: #06060a; border-radius: var(--radius-full); font-size: 0.9rem; font-weight: 600; text-decoration: none;">Upgrade la Standard</a>';
    html += '<a href="/preturi" style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 24px; background: linear-gradient(135deg, #a78bfa, #8b5cf6); color: #fff; border-radius: var(--radius-full); font-size: 0.9rem; font-weight: 600; text-decoration: none;">Upgrade la Premium</a>';
  } else if (tier === 'standard') {
    html += '<a href="/preturi" style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 24px; background: linear-gradient(135deg, #a78bfa, #8b5cf6); color: #fff; border-radius: var(--radius-full); font-size: 0.9rem; font-weight: 600; text-decoration: none;">Upgrade la Premium</a>';
    if (!cancelAtEnd && !isTrial) {
      html += '<button onclick="handleCancelSubscription()" style="padding: 12px 24px; background: transparent; border: 1px solid var(--border); color: var(--text-tertiary); border-radius: var(--radius-full); font-size: 0.875rem; cursor: pointer; transition: all 0.2s;">Anuleaza abonament</button>';
    }
  } else if (tier === 'premium') {
    html += '<div style="background: rgba(167, 139, 250, 0.06); border: 1px solid rgba(167, 139, 250, 0.12); border-radius: var(--radius-md); padding: 14px 16px; flex: 1; text-align: center;">';
    html += '<p style="color: #a78bfa; font-size: 0.875rem; margin: 0;">Ai planul maxim! Bucura-te de toate beneficiile.</p>';
    html += '</div>';
    if (!cancelAtEnd) {
      html += '<button onclick="handleCancelSubscription()" style="padding: 12px 24px; background: transparent; border: 1px solid var(--border); color: var(--text-tertiary); border-radius: var(--radius-full); font-size: 0.875rem; cursor: pointer;">Anuleaza</button>';
    }
  }

  html += '</div>';
  html += '</div>';  // end glass-card

  container.innerHTML = html;
}

// Cancel subscription handler
window.handleCancelSubscription = function() {
  if (!confirm('Esti sigur ca vrei sa anulezi abonamentul? Vei pastra beneficiile pana la sfarsitul perioadei platite.')) return;

  fetch('/my-businesses/' + state.businessId + '/subscription/cancel', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + state.token,
      'Content-Type': 'application/json',
    },
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.success) {
      if (window.showToast) showToast('Abonamentul a fost anulat', 'success');
      loadSubscription();  // Refresh the section
    } else {
      if (window.showToast) showToast(data.message || 'Eroare', 'error');
    }
  })
  .catch(function(err) {
    console.error('Cancel error:', err);
    if (window.showToast) showToast('Eroare la anulare', 'error');
  });
};
```

---

## 6. Backend: Cancel Subscription Endpoint

**File:** `appredueri_backend/src/routes/business-portal.js`

```js
// ── CANCEL SUBSCRIPTION ──
router.post('/:businessId/subscription/cancel', businessAuth, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);

    // Mark as cancel at period end (don't immediately cancel)
    const result = await pool.query(`
      UPDATE business_subscriptions
      SET cancel_at_period_end = TRUE, updated_at = NOW()
      WHERE business_id = $1
        AND status IN ('active')
        AND billing_cycle != 'none'
      RETURNING id, current_period_end
    `, [businessId]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nu exista un abonament activ de anulat.',
      });
    }

    // Log to history
    await pool.query(`
      INSERT INTO subscription_history (business_id, from_plan_id, to_plan_id, action, reason)
      SELECT bs.plan_id, bs.plan_id, bs.plan_id, 'cancelled', 'User requested cancellation'
      FROM business_subscriptions bs
      WHERE bs.id = $1
    `, [result.rows[0].id]);

    console.log(`[BusinessPortal] Subscription cancelled for business ${businessId}, active until ${result.rows[0].current_period_end}`);

    res.json({
      success: true,
      message: 'Abonamentul a fost anulat. Beneficiile raman active pana la ' +
        new Date(result.rows[0].current_period_end).toLocaleDateString('ro-RO') + '.',
      activeUntil: result.rows[0].current_period_end,
    });
  } catch (err) {
    console.error('[BusinessPortal] Cancel subscription error:', err);
    res.status(500).json({ success: false, message: 'Eroare la anularea abonamentului.' });
  }
});
```

---

## 7. Gotchas

1. **Pricing page is PUBLIC.** No auth required. But the CTA buttons redirect to `/register?returnTo=/preturi` for non-authenticated users, so they create an account first.

2. **Trial CTA says "Incepe trial gratuit".** The actual trial logic is in Plan 15. The button here just links to the registration/portal flow.

3. **Annual pricing calculation.** The toggle shows monthly-equivalent of annual price: `Math.round(yearly / 12 / 100)`. This shows the per-month price when billed annually. The "Facturat X RON/an" note below clarifies the actual annual charge.

4. **Prices in bani.** Database stores prices in bani (cents): 4900 = 49.00 RON. The EJS template divides by 100 for display.

5. **DM Serif Display for headings.** The pricing title and FAQ title use DM Serif Display. Do NOT add `font-weight` to these elements (per Memory doc gotcha).

6. **manage.ejs IIFE variables.** The `renderSubscriptionSection` function is defined inside the IIFE. Ensure it is called AFTER `loadSubscription()` fetches the data.

7. **Downgrade flow.** The current implementation only supports "cancel at period end". Actual immediate downgrade (e.g., Standard to Free mid-period) would require Stripe integration (Plan 01). For now, cancel = downgrade to free at period end.

8. **Mobile NOT needed.** Per user requirement, pricing page is web-only. The Flutter app does not have a pricing/upgrade screen. If needed later, add it as a WebView or native screen.

9. **Responsive layout.** The 3-column grid collapses to single column on mobile (max-width: 768px). The "Cel mai popular" badge is positioned absolutely -- ensure it doesn't clip on narrow screens.

10. **No Stripe checkout integration in this plan.** The CTA buttons currently link to `/preturi` or `/cont#portal`. The actual Stripe checkout flow is in Plan 01. Until Stripe is integrated, the upgrade buttons just direct users to the portal where they see tier info.

---

## 8. Verification Checklist

- [ ] `GET /preturi` renders the pricing page
- [ ] Three plan cards display correctly with all features
- [ ] Billing toggle switches between monthly and annual prices
- [ ] Annual price shows monthly equivalent
- [ ] "Cel mai popular" badge on Standard card
- [ ] "Premium" badge on Premium card
- [ ] CTA buttons redirect correctly (auth vs non-auth)
- [ ] Navbar has "Preturi" link
- [ ] manage.ejs "Abonament" tab shows current tier
- [ ] Trial countdown displays when on trial
- [ ] Expired trial banner shows upgrade prompt
- [ ] Cancel subscription flow works (sets `cancel_at_period_end`)
- [ ] Page is responsive on mobile
- [ ] Purple (#a78bfa) Premium branding consistent
- [ ] Orange (#fb923c) Standard branding consistent
- [ ] FAQ section renders correctly
