# 16 -- Tier Gating (Restricting Existing Features)

> **Scop:** Aplica restrictii pe tier la functionalitati care in prezent sunt disponibile TUTUROR business-urilor. Aceasta este ultima piesa care leaga toate planurile anterioare.
> **Dependinte:** TOATE planurile anterioare (00-15). Implementeaza DUPA ce toate celelalte sunt complete.
> **Fisiere afectate:** `business-portal.js` (middleware pe rute), `web.js` (web portal routes), `manage.ejs` (~15 sectiuni), `offer-form.ejs` (booking fields), `dashboard.ejs` (business list badges), `main.css` (upgrade overlay), Flutter models + screens
> **Efort estimat:** Mare -- touches many files, requires careful backward compatibility

---

## 1. Feature Matrix (Reference)

From `subscription_plans` seed data (migration 033):

| Feature | Free | Standard | Premium | Gate Key |
|---|---|---|---|---|
| Active offers | 2 | 10 | Unlimited | `max_active_offers` |
| Gallery images | 3 | 8 | Unlimited | `max_gallery_images` |
| Locations | 1 | 3 | Unlimited | `max_locations` |
| Promo codes/offer | 0 | 3 | Unlimited | `max_promo_codes_per_offer` |
| Analytics period | 7 days | 30 days | 90 days | `analytics_days` |
| Logo upload | No | Yes | Yes | `can_upload_logo` |
| Cover upload | No | Yes | Yes | `can_upload_cover` |
| Review responses | No | Yes | Yes | `can_respond_reviews` |
| AI review summary | No | Yes | Yes | `has_ai_summary` |
| Analytics charts | No | Yes | Yes | `has_analytics_charts` |
| Push on new offer | No | Yes | Yes | `has_push_on_offer` |
| Custom push | No | No | Yes | `has_custom_push` |
| Booking fields | No | Yes | Yes | `has_booking` |
| Verified badge | No | Yes (orange) | Yes (purple) | `badge_type` |
| Priority support | No | No | Yes | `has_priority_support` |
| Analytics export | No | No | Yes | `has_analytics_export` |
| Competitive insights | No | No | Yes | `has_competitive_insights` |
| Promoted placement | No | No | Yes | `has_promoted_placement` |
| Search priority | No | No | Yes | `has_search_priority` |

---

## 2. Backend Gating Strategy

### 2a. Prerequisite: `attachTier` Middleware

From Plan 00, `attachTier(pool)` is applied to all business-portal routes:

```js
// business-portal.js - already added in Plan 00
const { attachTier } = require('../middleware/tierAuth');
router.use('/:businessId', attachTier(pool));
```

This sets `req.tier = { subscription, plan, tier, isTrial }` on every request.

### 2b. Import `requireFeature` and `requireLimit`

From Plan 00, `tierAuth.js` exports:

```js
const { requireFeature, requireLimit } = require('../middleware/tierAuth');
```

These are added to the imports at the top of `business-portal.js`.

---

## 3. Route-by-Route Gating

### 3a. Logo Upload -- `can_upload_logo`

**File:** `appredueri_backend/src/routes/business-portal.js`, line 201

```js
// BEFORE:
router.post("/:businessId/logo", businessAuth, upload.single("logo"), async (req, res) => {

// AFTER:
router.post("/:businessId/logo", businessAuth, requireFeature('can_upload_logo'), upload.single("logo"), async (req, res) => {
```

### 3b. Cover Upload -- `can_upload_cover`

**File:** `business-portal.js`, line 238

```js
// BEFORE:
router.post("/:businessId/cover", businessAuth, upload.single("cover"), async (req, res) => {

// AFTER:
router.post("/:businessId/cover", businessAuth, requireFeature('can_upload_cover'), upload.single("cover"), async (req, res) => {
```

### 3c. Gallery Image Upload -- `max_gallery_images`

**File:** `business-portal.js`, line 274

```js
// BEFORE:
router.post("/:businessId/images", businessAuth, upload.single("image"), async (req, res) => {

// AFTER:
router.post("/:businessId/images", businessAuth, requireLimit('max_gallery_images', countGalleryImages), upload.single("image"), async (req, res) => {
```

Add the counter function at the top of the file:

```js
// Count gallery images for a business
async function countGalleryImages(pool, businessId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*) as count FROM business_images WHERE business_id = $1',
    [businessId]
  );
  return parseInt(rows[0].count);
}
```

### 3d. Offer Creation -- `max_active_offers`

**File:** `business-portal.js`, line 382

```js
// BEFORE:
router.post("/:businessId/offers", businessAuth, upload.single("image"), async (req, res) => {

// AFTER:
router.post("/:businessId/offers", businessAuth, requireLimit('max_active_offers', countActiveOffers), upload.single("image"), async (req, res) => {
```

Add counter:

```js
async function countActiveOffers(pool, businessId) {
  const { rows } = await pool.query(
    "SELECT COUNT(*) as count FROM offers WHERE business_id = $1 AND is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)",
    [businessId]
  );
  return parseInt(rows[0].count);
}
```

### 3e. Review Response -- `can_respond_reviews`

**File:** `business-portal.js`, line 924

```js
// BEFORE:
router.post("/:businessId/reviews/:reviewId/respond", businessAuth, async (req, res) => {

// AFTER:
router.post("/:businessId/reviews/:reviewId/respond", businessAuth, requireFeature('can_respond_reviews'), async (req, res) => {
```

Also gate the PUT (edit response) at line 974:

```js
// BEFORE:
router.put("/:businessId/reviews/:reviewId/respond", businessAuth, async (req, res) => {

// AFTER:
router.put("/:businessId/reviews/:reviewId/respond", businessAuth, requireFeature('can_respond_reviews'), async (req, res) => {
```

Note: DELETE response (line 1003) does NOT need gating -- allow users to delete responses regardless of tier.

### 3f. Review Response (Web Portal Route)

**File:** `appredueri_backend/src/routes/web.js`, line ~2306

```js
// BEFORE:
router.post("/api/web/portal/:businessId/reviews/:reviewId/respond", requireBusinessOwner, async (req, res) => {

// AFTER:
router.post("/api/web/portal/:businessId/reviews/:reviewId/respond", requireBusinessOwner, requireFeature('can_respond_reviews'), async (req, res) => {
```

Note: This requires importing and applying `attachTier` in web.js for business portal web routes. Add the import and apply it:

```js
// At top of web.js, add import:
const { attachTier, requireFeature, requireLimit } = require('../middleware/tierAuth');

// Before the web portal API routes, apply tier middleware:
router.use('/api/web/portal/:businessId', attachTier(pool));
```

### 3g. Analytics Period -- `analytics_days`

**File:** `business-portal.js`, line 687 (GET /:businessId/analytics)

Inside the handler, after `req.tier` is available, enforce the analytics period:

```js
router.get("/:businessId/analytics", businessAuth, async (req, res) => {
  try {
    const businessId = parseInt(req.params.businessId);

    // ── Tier gating: enforce analytics period ──
    const maxDays = req.tier ? req.tier.plan.analytics_days : 7;
    const requestedDays = parseInt(req.query.days) || 30;
    const effectiveDays = Math.min(requestedDays, maxDays);

    // Use effectiveDays instead of req.query.days in the date range calculation
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - effectiveDays);

    // ... rest of the analytics query using startDate ...
```

Also add `maxDays` to the response so the frontend knows the limit:

```js
res.json({
  // ... existing data ...
  analytics_days_limit: maxDays,
  analytics_days_used: effectiveDays,
});
```

### 3h. Analytics Charts -- `has_analytics_charts`

The analytics views and subscribers endpoints should check `has_analytics_charts`:

**File:** `business-portal.js`, line 795 (GET /:businessId/analytics/views)

```js
// BEFORE:
router.get("/:businessId/analytics/views", businessAuth, async (req, res) => {

// AFTER:
router.get("/:businessId/analytics/views", businessAuth, requireFeature('has_analytics_charts'), async (req, res) => {
```

Line 836 (GET /:businessId/analytics/subscribers):

```js
// BEFORE:
router.get("/:businessId/analytics/subscribers", businessAuth, async (req, res) => {

// AFTER:
router.get("/:businessId/analytics/subscribers", businessAuth, requireFeature('has_analytics_charts'), async (req, res) => {
```

### 3i. Location Limit -- `max_locations`

If there is a location creation endpoint (locations are managed in admin.js or business-portal), gate it:

```js
// If in business-portal.js (add if it exists):
router.post("/:businessId/locations", businessAuth, requireLimit('max_locations', countLocations), async (req, res) => { ... });

async function countLocations(pool, businessId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*) as count FROM business_locations WHERE business_id = $1',
    [businessId]
  );
  return parseInt(rows[0].count);
}
```

### 3j. Booking Fields -- `has_booking`

**File:** `business-portal.js`, line 155 (PUT /:businessId -- business update)

Inside the handler, check if booking fields are being modified:

```js
router.put("/:businessId", businessAuth, async (req, res) => {
  try {
    const { booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, ...otherFields } = req.body;

    // ── Tier gating: booking fields ──
    const hasBookingAccess = req.tier && req.tier.plan.has_booking;
    const isModifyingBooking = booking_type !== undefined || booking_phone !== undefined ||
                                booking_whatsapp !== undefined || booking_url !== undefined ||
                                booking_instructions !== undefined;

    if (isModifyingBooking && !hasBookingAccess) {
      return res.status(403).json({
        error: 'upgrade_required',
        message: 'Campurile de booking necesita un plan Standard sau superior.',
        currentTier: req.tier ? req.tier.tier : 'free',
        requiredFeature: 'has_booking',
      });
    }

    // ... rest of the update logic ...
```

### 3k. Push Notification on New Offer -- `has_push_on_offer`

**File:** `business-portal.js`, inside the offer creation handler (line 382)

After successfully creating an offer, check before sending push:

```js
// Inside POST /:businessId/offers handler, after offer is created:

// ── Push notification (gated by tier) ──
const canPush = req.tier && req.tier.plan.has_push_on_offer;
if (canPush) {
  try {
    await pushService.notifyNewOffer(businessId, offerId, title);
  } catch (pushErr) {
    console.error('[BusinessPortal] Push notification failed:', pushErr);
    // Don't fail the request
  }
}
```

---

## 4. manage.ejs: UI Gating

### 4a. Approach: Soft Gating with Upgrade Overlays

For manage.ejs, we use **soft gating**: sections that are tier-restricted show a blurred/grayed overlay with an upgrade CTA. This is better UX than hiding sections entirely because users can see what they are missing.

### 4b. Generic Upgrade Overlay Function

Add to the manage.ejs `<script>` IIFE:

```js
/**
 * Wraps a section in an upgrade overlay if the feature is not available
 * @param {string} sectionId - ID of the section element to wrap
 * @param {boolean} hasAccess - Whether the current tier has this feature
 * @param {string} featureName - Display name of the feature
 * @param {string} requiredTier - 'Standard' or 'Premium'
 */
function gateSection(sectionId, hasAccess, featureName, requiredTier) {
  var section = document.getElementById(sectionId);
  if (!section) return;

  if (hasAccess) {
    // Remove any existing overlay
    var existing = section.querySelector('.tier-gate-overlay');
    if (existing) existing.remove();
    section.style.position = '';
    section.style.overflow = '';
    return;
  }

  // Add overlay
  section.style.position = 'relative';
  section.style.overflow = 'hidden';

  var overlay = document.createElement('div');
  overlay.className = 'tier-gate-overlay';
  overlay.innerHTML = '<div class="tier-gate-content">' +
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="' + (requiredTier === 'Premium' ? '#a78bfa' : '#fb923c') + '" stroke-width="1.5"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
    '<p style="font-size: 0.9375rem; font-weight: 600; color: var(--text-primary); margin: 8px 0 4px;">' + featureName + '</p>' +
    '<p style="font-size: 0.8125rem; color: var(--text-tertiary); margin: 0 0 16px;">Disponibil cu planul ' + requiredTier + '+</p>' +
    '<a href="/preturi" style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 24px; background: ' + (requiredTier === 'Premium' ? 'linear-gradient(135deg, #a78bfa, #8b5cf6)' : 'linear-gradient(135deg, #f97316, #fb923c)') + '; color: ' + (requiredTier === 'Premium' ? '#fff' : '#06060a') + '; border-radius: var(--radius-full); font-size: 0.875rem; font-weight: 600; text-decoration: none;">Upgrade &rarr;</a>' +
  '</div>';

  section.appendChild(overlay);
}
```

### 4c. CSS: Tier Gate Overlay

Add to the manage.ejs `<style>` block:

```css
/* ── Tier Gate Overlay ── */
.tier-gate-overlay {
  position: absolute;
  inset: 0;
  background: rgba(6, 6, 10, 0.85);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  border-radius: inherit;
}
.tier-gate-content {
  text-align: center;
  padding: 20px;
}
```

### 4d. Apply Gates After Subscription Loads

In the `loadSubscription()` callback (or wherever subscription data becomes available), apply gates:

```js
function applyTierGating(subscription) {
  var plan = subscription ? subscription.plan : {};
  var tier = subscription ? subscription.tier : 'free';

  // Logo section
  gateSection('logo-upload-section', plan.canUploadLogo, 'Upload Logo', 'Standard');

  // Cover section
  gateSection('cover-upload-section', plan.canUploadCover, 'Upload Cover', 'Standard');

  // Gallery section -- show limit indicator
  gateSection('gallery-section', true, '', ''); // Always allow viewing, limit enforced on upload
  var galleryLimit = document.getElementById('gallery-limit-text');
  if (galleryLimit) {
    var maxImages = plan.maxGalleryImages;
    galleryLimit.textContent = maxImages === null ? 'Nelimitat' : maxImages + ' imagini maxim';
  }

  // Review responses
  gateSection('review-respond-section', plan.canRespondReviews, 'Raspunsuri la recenzii', 'Standard');

  // Analytics charts
  gateSection('analytics-charts-section', plan.hasAnalyticsCharts, 'Grafice statistici', 'Standard');

  // Analytics period display
  var analyticsPeriod = document.getElementById('analytics-period-text');
  if (analyticsPeriod) {
    analyticsPeriod.textContent = plan.analyticsDays + ' zile';
  }

  // Booking section
  gateSection('booking-section', plan.hasBooking, 'Rezervari', 'Standard');

  // AI Summary (read-only display)
  gateSection('ai-summary-section', plan.hasAiSummary, 'Rezumat AI recenzii', 'Standard');

  // Competitive insights (Premium)
  gateSection('competitive-insights-section', plan.hasCompetitiveInsights, 'Analize competitive', 'Premium');

  // Custom push (Premium)
  gateSection('custom-push-section', plan.hasCustomPush, 'Notificari push personalizate', 'Premium');
}
```

Call this after subscription loads:

```js
// In loadSubscription():
state.subscription = data;
renderTrialBanner(data);
renderSubscriptionSection(data);
renderSupportSection(data);
applyTierGating(data);  // <-- ADD THIS
```

### 4e. Section IDs in manage.ejs HTML

Each gatable section in manage.ejs needs an `id` attribute. Add these to the existing sections:

- Logo upload form wrapper: `id="logo-upload-section"`
- Cover upload form wrapper: `id="cover-upload-section"`
- Gallery section: `id="gallery-section"` with a `<span id="gallery-limit-text"></span>`
- Review respond buttons area: `id="review-respond-section"`
- Analytics charts container: `id="analytics-charts-section"` with `<span id="analytics-period-text"></span>`
- Booking fields form: `id="booking-section"`
- AI summary display: `id="ai-summary-section"`
- Competitive insights: `id="competitive-insights-section"` (if exists)
- Custom push: `id="custom-push-section"` (if exists)

---

## 5. Offer Form Gating

### 5a. manage.ejs: Offer Creation/Edit Form

In the offer form section of manage.ejs, the booking fields and promo code fields need conditional display:

```js
// In the function that renders the offer form:
function renderOfferForm(offer) {
  var plan = state.subscription ? state.subscription.plan : {};

  // Promo codes section
  var promoSection = document.getElementById('promo-codes-section');
  if (promoSection) {
    var maxPromos = plan.maxPromoCodesPerOffer;
    if (maxPromos === 0) {
      // Free tier: hide promo codes entirely and show upgrade prompt
      promoSection.innerHTML = '<div style="background: var(--bg-card); border: 1px dashed var(--border); border-radius: var(--radius-md); padding: 16px; text-align: center;">' +
        '<p style="color: var(--text-tertiary); font-size: 0.8125rem; margin: 0 0 8px;">Coduri promo disponibile cu Standard+</p>' +
        '<a href="/preturi" style="color: var(--accent); font-size: 0.8125rem; text-decoration: none;">Upgrade &rarr;</a>' +
      '</div>';
    } else if (maxPromos !== null) {
      // Standard: show limit
      var limitNote = promoSection.querySelector('.promo-limit-note');
      if (!limitNote) {
        limitNote = document.createElement('p');
        limitNote.className = 'promo-limit-note';
        limitNote.style.cssText = 'font-size: 0.75rem; color: var(--text-tertiary); margin: 4px 0 0;';
        promoSection.appendChild(limitNote);
      }
      limitNote.textContent = 'Maxim ' + maxPromos + ' coduri promo per oferta (plan ' + plan.name + ')';
    }
    // Premium: no limit shown (null = unlimited)
  }

  // Booking fields
  var bookingSection = document.getElementById('booking-fields-section');
  if (bookingSection) {
    if (!plan.hasBooking) {
      bookingSection.innerHTML = '<div style="background: var(--bg-card); border: 1px dashed var(--border); border-radius: var(--radius-md); padding: 16px; text-align: center;">' +
        '<p style="color: var(--text-tertiary); font-size: 0.8125rem; margin: 0 0 8px;">Campuri de booking disponibile cu Standard+</p>' +
        '<a href="/preturi" style="color: var(--accent); font-size: 0.8125rem; text-decoration: none;">Upgrade &rarr;</a>' +
      '</div>';
    }
  }
}
```

---

## 6. API Response: 403 Upgrade Required

All `requireFeature` and `requireLimit` middleware (from Plan 00) return a consistent 403 response:

```json
{
  "error": "upgrade_required",
  "message": "Aceasta functie necesita un plan superior.",
  "currentTier": "free",
  "requiredFeature": "can_upload_logo"
}
```

or for limits:

```json
{
  "error": "limit_reached",
  "message": "Ai atins limita de 2 pentru planul tau (Gratuit).",
  "currentTier": "free",
  "limit": 2,
  "current": 2
}
```

### 6a. manage.ejs: Handle 403 Responses

Update the generic fetch error handler in manage.ejs:

```js
// Generic error handler for fetch calls
function handleApiError(response) {
  if (response.status === 403) {
    return response.json().then(function(data) {
      if (data.error === 'upgrade_required' || data.error === 'limit_reached') {
        if (window.showToast) {
          showToast(data.message + ' Upgrade din tab-ul Abonament.', 'warning');
        }
        // Optionally switch to subscription tab
        // switchTab('subscription');
      } else {
        if (window.showToast) showToast(data.message || 'Acces interzis', 'error');
      }
      return Promise.reject(data);
    });
  }
  if (!response.ok) {
    return response.json().then(function(data) {
      if (window.showToast) showToast(data.message || 'Eroare', 'error');
      return Promise.reject(data);
    });
  }
  return response.json();
}
```

---

## 7. Existing Data Over Limits (Grandfather Rule)

**Critical:** When a business downgrades from Standard to Free, they may have:
- 8 gallery images (free limit: 3)
- 10 active offers (free limit: 2)
- 3 locations (free limit: 1)
- Review responses already posted

**Rule: NEVER delete existing data.** Only prevent new additions.

### Implementation:

1. **Gallery images:** Business keeps all 8 images. API returns all 8. But new uploads are blocked by `requireLimit`.
2. **Active offers:** Business keeps all 10 active offers. They continue to display publicly. But creating new offers is blocked. When offers expire naturally, they can only create up to the free limit.
3. **Locations:** Business keeps all 3 locations. But adding new ones is blocked.
4. **Review responses:** Existing responses stay visible. But posting new responses is blocked by `requireFeature`.
5. **Logo and cover:** Existing logo/cover stay displayed. But re-uploading (changing) is blocked. Do NOT remove the existing images.
6. **Booking fields:** Existing booking data stays in the database and continues to display. But modifying booking fields is blocked.

### Display Note in Portal:

When a business is over the limit, show an info message:

```js
function showOverLimitNote(sectionId, current, limit) {
  if (limit === null || current <= limit) return;

  var section = document.getElementById(sectionId);
  if (!section) return;

  var note = document.createElement('div');
  note.style.cssText = 'background: rgba(234, 179, 8, 0.06); border: 1px solid rgba(234, 179, 8, 0.15); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 12px; font-size: 0.8125rem; color: #eab308;';
  note.textContent = 'Ai ' + current + ' din ' + limit + ' permise. Nu poti adauga mai multe cu planul actual.';
  section.insertBefore(note, section.firstChild);
}
```

---

## 8. Flutter Gating (Mobile API)

### 8a. API Already Gates

The API middleware (`requireFeature`, `requireLimit`) applies to all clients -- web and mobile. So the Flutter app will automatically receive 403 responses when trying to use gated features.

### 8b. Handle 403 in Dio Interceptor

**File:** `ofai_flutter/lib/core/network/api_client.dart`

In the Dio error interceptor, add handling for 403 upgrade_required:

```dart
// In the DioError handler:
if (error.response?.statusCode == 403) {
  final data = error.response?.data;
  if (data is Map && (data['error'] == 'upgrade_required' || data['error'] == 'limit_reached')) {
    // Show upgrade prompt
    // This is tricky in an interceptor -- use a global event bus or callback
    debugPrint('[API] Upgrade required: ${data['message']}');
    // Option: throw a typed exception that the UI can catch
    throw UpgradeRequiredException(
      message: data['message'] as String? ?? 'Upgrade necesar',
      currentTier: data['currentTier'] as String? ?? 'free',
      requiredFeature: data['requiredFeature'] as String?,
    );
  }
}
```

Add the exception class:

```dart
class UpgradeRequiredException implements Exception {
  final String message;
  final String currentTier;
  final String? requiredFeature;

  UpgradeRequiredException({
    required this.message,
    required this.currentTier,
    this.requiredFeature,
  });

  @override
  String toString() => 'UpgradeRequiredException: $message (tier: $currentTier)';
}
```

### 8c. Flutter Subscription Provider

**File:** `ofai_flutter/lib/providers/business_subscription_provider.dart` (NEW -- create only if business portal exists in Flutter)

If the Flutter app has a business management section (not currently the case per the codebase), create a provider to fetch the subscription data and expose tier info.

**Note:** Currently the Flutter app is consumer-facing (not business portal). Business management is web-only via manage.ejs. So Flutter tier gating is minimal -- it mainly affects how badges display (Plan 12) and potentially review response UI if the business owner uses the mobile app.

---

## 9. Rollout Strategy: Feature Flags

To enable gating gradually (not all at once), use a simple feature flag approach.

### 9a. Environment Variable

```
# .env
TIER_GATING_ENABLED=false   # Set to 'true' to enable tier gating
```

### 9b. Modified requireFeature with Flag

**File:** `appredueri_backend/src/middleware/tierAuth.js`

```js
function requireFeature(featureKey) {
  return (req, res, next) => {
    // Feature flag: bypass gating if disabled
    if (process.env.TIER_GATING_ENABLED !== 'true') {
      return next();
    }

    if (!req.tier) return res.status(500).json({ error: 'Tier info missing' });
    if (!req.tier.plan[featureKey]) {
      return res.status(403).json({
        error: 'upgrade_required',
        message: `Aceasta functie necesita un plan superior.`,
        currentTier: req.tier.tier,
        requiredFeature: featureKey,
      });
    }
    next();
  };
}
```

Same for `requireLimit`:

```js
function requireLimit(limitKey, countFn) {
  return async (req, res, next) => {
    if (process.env.TIER_GATING_ENABLED !== 'true') {
      return next();
    }
    // ... rest of the logic ...
  };
}
```

### 9c. Rollout Steps

1. **Phase 1: Deploy with `TIER_GATING_ENABLED=false`**
   - All middleware is in place but does nothing
   - UI shows tier info and upgrade CTAs (cosmetic only)
   - Verify no regressions

2. **Phase 2: Enable soft gating `TIER_GATING_ENABLED=true`**
   - All gates active
   - Monitor for 403 errors, user complaints
   - Ensure existing businesses over limits are not broken

3. **Phase 3: Remove the feature flag**
   - Once stable, remove the env check for cleaner code

---

## 10. Summary: All Files Modified

| File | Changes |
|---|---|
| `src/middleware/tierAuth.js` | Add feature flag check to `requireFeature` and `requireLimit` |
| `src/routes/business-portal.js` | Add `requireFeature`/`requireLimit` to 10+ routes. Add counter functions. Import `tierAuth`. |
| `src/routes/web.js` | Add `attachTier` and `requireFeature` to web portal API routes (~line 2306) |
| `src/views/public/portal/manage.ejs` | Add `gateSection()` JS function, `.tier-gate-overlay` CSS, section IDs, `applyTierGating()` call, `handleApiError()` for 403s, over-limit notes |
| `src/public/css/main.css` | (Optional) `.tier-gate-overlay` if moved from manage.ejs inline |
| `.env` | Add `TIER_GATING_ENABLED=false` |
| Flutter `api_client.dart` | Add `UpgradeRequiredException` handling for 403 |
| Flutter `business_card.dart`, `offer_card.dart` | Already handled in Plan 12 (badge display) |

---

## 11. Gotchas

1. **NEVER delete existing data over limits.** The grandfather rule is critical. If a Premium business with 20 gallery images downgrades to Free (limit 3), all 20 images remain. They just cannot add more. Same for offers, locations, review responses, logo, cover.

2. **`attachTier` in web.js.** The web portal routes in web.js (e.g., `/api/web/portal/:businessId/reviews/:reviewId/respond`) use `requireBusinessOwner` middleware which is cookie-based (not Bearer token). Ensure `attachTier` works with the `req.params.businessId` from these routes. The `attachTier` function looks for `req.params.businessId || req.params.bid` -- verify the parameter name matches.

3. **Duplicate routes.** Per the Memory doc gotcha, offer creation exists in BOTH `web.js` AND `business-portal.js`. Both must be gated. Search for all offer creation routes and apply `requireLimit`.

4. **`app.get('pool')` in requireLimit.** The `countFn` in `requireLimit` receives `req.app.get('pool')`. Ensure `pool` is set on the Express app: `app.set('pool', pool)`. Alternatively, import `pool` directly in `tierAuth.js`.

5. **Analytics days enforcement.** The `analytics_days` limit must be enforced in the query, not just in the UI. If the API accepts a `days` parameter, clamp it to `Math.min(requestedDays, plan.analytics_days)`.

6. **Feature flag in manage.ejs.** When `TIER_GATING_ENABLED=false`, the manage.ejs UI should still show tier info and upgrade CTAs (cosmetic), but the overlays should NOT block sections. Pass the flag to the EJS template and check it in `applyTierGating()`.

7. **CSRF on web portal routes.** The web portal routes in web.js require `X-CSRF-Token`. The `requireFeature` middleware runs AFTER CSRF validation, so no issue there.

8. **Order of middleware.** The middleware chain must be: `businessAuth` -> `attachTier` -> `requireFeature`/`requireLimit` -> handler. Since `attachTier` is applied via `router.use('/:businessId', ...)`, it runs before any specific route handler.

9. **Error responses must be JSON.** The 403 response from `requireFeature` is JSON. The manage.ejs fetch handlers must parse JSON error responses. If any existing error handlers assume non-JSON 403s, they must be updated.

10. **Promo codes per offer.** The `max_promo_codes_per_offer` limit is per-offer, not per-business. The count function should count promo codes for the specific offer being created/edited, not all promo codes across all offers.

---

## 12. Verification Checklist

### Backend:
- [ ] `requireFeature('can_upload_logo')` blocks free tier logo upload
- [ ] `requireFeature('can_upload_cover')` blocks free tier cover upload
- [ ] `requireLimit('max_gallery_images', ...)` blocks uploads over limit
- [ ] `requireLimit('max_active_offers', ...)` blocks offer creation over limit
- [ ] `requireFeature('can_respond_reviews')` blocks free tier review responses
- [ ] Analytics period clamped to `analytics_days`
- [ ] Analytics charts endpoints gated for free tier
- [ ] Booking field modification blocked for free tier
- [ ] Push notification on offer gated for free tier
- [ ] All 403 responses return consistent JSON format
- [ ] Feature flag (`TIER_GATING_ENABLED`) works correctly

### Frontend (manage.ejs):
- [ ] Logo section shows upgrade overlay for free tier
- [ ] Cover section shows upgrade overlay for free tier
- [ ] Gallery shows limit indicator
- [ ] Review respond buttons hidden/overlayed for free tier
- [ ] Analytics charts show upgrade overlay for free tier
- [ ] Booking fields show upgrade prompt for free tier
- [ ] Promo code section shows limit or upgrade prompt
- [ ] 403 API errors show toast with upgrade message
- [ ] Over-limit notes display for grandfathered data

### Data Safety:
- [ ] Downgrading does NOT delete gallery images
- [ ] Downgrading does NOT deactivate offers
- [ ] Downgrading does NOT remove review responses
- [ ] Downgrading does NOT remove logo/cover
- [ ] Downgrading does NOT remove booking data

### Rollout:
- [ ] Feature flag defaults to `false` (no gating)
- [ ] Enabling flag activates all gates
- [ ] No regressions with flag disabled
- [ ] No regressions with flag enabled for Standard/Premium businesses
