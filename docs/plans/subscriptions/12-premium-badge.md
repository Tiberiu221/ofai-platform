# 12 -- Premium Badge

> **Scop:** Business-urile cu tier Premium primesc un badge distinctiv "Premium" (diferit de "Verificat" pentru Standard). Badge-ul trebuie vizibil pe toate cardurile si paginile de detaliu, atat pe web cat si pe Flutter.
> **Dependinte:** `00-subscription-foundation.md` (tabele `subscription_plans`, `business_subscriptions`, `src/helpers/tiers.js`)
> **Fisiere afectate:** migration noua, `businesses.js`, `offers.js`, `web.js`, `business-portal.js`, `main.css`, `business-detail.ejs`, `oferte.ejs`, `business-uri.ejs`, `offer-detail.ejs`, Flutter `business.dart`, `business_card.dart`, `offer_card.dart`, screens de detaliu

---

## 1. Current State

### Web
- `businesses` table has `is_verified BOOLEAN DEFAULT FALSE` (migration 026)
- `is_verified` is set manually by admin in `admin/businesses-edit.ejs`
- Display: business-detail.ejs shows an orange shield SVG with class `.verified-badge` when `is_verified === true`
- CSS in `main.css` line ~4691: `.verified-badge { display: inline-block; vertical-align: middle; margin-left: 6px; }`
- Offer list (`offers.js` route) returns `b.is_verified as business_verified`
- Business list (`businesses.js` route) returns `b.is_verified`

### Flutter
- `Business` model has `final bool isVerified` field, parsed from `json['is_verified']`
- `BusinessCard` widget (line 87-91): shows `Icons.verified` in accent color when `business.isVerified`
- `OfferCard._buildBusinessRow()` (line 293-296): shows `Icons.verified` when `biz.isVerified`

### Problem
- There is only ONE badge type (`is_verified` = checkmark). We need THREE states:
  - Free tier: no badge
  - Standard tier: "Verificat" badge (orange checkmark, same as current)
  - Premium tier: "Premium" badge (purple glow, distinct visual treatment)

---

## 2. Approach Decision: Cached Column (Approach B) -- RECOMMENDED

**Approach A (derived via JOIN):** Query `subscription_plans.badge_type` through `business_subscriptions` JOIN on every request. Accurate but adds a JOIN to EVERY query that shows businesses.

**Approach B (cached column):** Add `subscription_badge_type VARCHAR(20)` to `businesses` table. Updated whenever tier changes (upgrade, downgrade, trial start, trial end). Faster reads, no extra JOIN.

**Decision: Approach B.** Every offer listing query, business listing query, and detail page would need the JOIN otherwise. The column is updated in exactly 4 places: subscription create, upgrade, downgrade, trial expiry. Acceptable trade-off.

---

## 3. Migration: `034_subscription_badge_type.sql`

**File:** `appredueri_backend/src/migrations/034_subscription_badge_type.sql`

```sql
-- Migration 034: Add subscription_badge_type to businesses
-- Cached from subscription_plans.badge_type for fast reads
-- Values: NULL (free/no badge), 'verified' (standard), 'premium' (premium)

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS subscription_badge_type VARCHAR(20) DEFAULT NULL;

-- Index for filtering by badge type (e.g., promoted placement queries)
CREATE INDEX IF NOT EXISTS idx_businesses_badge_type
  ON businesses(subscription_badge_type)
  WHERE subscription_badge_type IS NOT NULL;

-- Backfill from existing subscriptions (after 033 has run)
-- This sets badge_type for any business that already has a non-free subscription
UPDATE businesses b
SET subscription_badge_type = sp.badge_type
FROM business_subscriptions bs
JOIN subscription_plans sp ON sp.id = bs.plan_id
WHERE bs.business_id = b.id
  AND bs.status IN ('active', 'trial')
  AND sp.badge_type IS NOT NULL;

-- IMPORTANT: Keep is_verified column for backward compatibility
-- is_verified = admin-set manual verification (independent of subscription)
-- subscription_badge_type = tier-derived badge (auto-managed)
-- Display logic: subscription_badge_type takes priority if set, else fall back to is_verified
```

---

## 4. Helper Function: Update Badge on Tier Change

**File:** `appredueri_backend/src/helpers/tiers.js` -- add new function

```js
/**
 * Sync the cached badge_type column on the businesses table
 * Call this EVERY time a subscription changes (upgrade, downgrade, create, expire, trial end)
 *
 * @param {PoolClient|Pool} db - database client (use same transaction client if in a tx)
 * @param {number} businessId
 * @param {string|null} badgeType - from subscription_plans.badge_type: null, 'verified', 'premium'
 */
async function syncBadgeType(db, businessId, badgeType) {
  await db.query(
    'UPDATE businesses SET subscription_badge_type = $1 WHERE id = $2',
    [badgeType, businessId]
  );
  console.log(`[Tiers] Badge synced for business ${businessId}: ${badgeType || 'none'}`);
}

// Add to module.exports:
module.exports = { TIERS, getPlans, getBusinessTier, hasFeature, checkLimit, invalidateCache, syncBadgeType };
```

### Call Sites for `syncBadgeType`

These are ALL places where the badge must be updated:

1. **Trial creation** (Plan 15 -- businessRequests approval flow): `syncBadgeType(client, businessId, 'verified')` -- standard trial gives verified badge
2. **Upgrade** (Plan 01 -- Stripe webhook `checkout.session.completed`): `syncBadgeType(client, businessId, newPlan.badge_type)`
3. **Downgrade** (Plan 01 -- Stripe webhook `customer.subscription.deleted`): `syncBadgeType(client, businessId, null)` or to the new plan's badge_type
4. **Trial expiry** (cron job in `cronJobs.js`): `syncBadgeType(pool, businessId, null)` -- reverts to no badge
5. **Admin override** (admin.js -- manual tier change if added later): `syncBadgeType(client, businessId, newPlan.badge_type)`

---

## 5. Backend API Changes

### 5a. `businesses.js` -- GET /businesses (list)

**File:** `appredueri_backend/src/routes/businesses.js`

Current (line 98): `b.is_verified,`

Change the SELECT to also include `subscription_badge_type`:

```sql
-- In the main SELECT clause, ADD:
b.subscription_badge_type,
```

In the response mapping (line 172), change:

```js
// BEFORE:
is_verified: row.is_verified || false,

// AFTER:
is_verified: row.is_verified || false,
subscription_badge_type: row.subscription_badge_type || null,
// Effective badge: subscription badge takes priority, then admin verified
badge_type: row.subscription_badge_type || (row.is_verified ? 'verified' : null),
```

### 5b. `businesses.js` -- GET /businesses/:id (detail)

**File:** `appredueri_backend/src/routes/businesses.js`

In the main query (line ~194), add `b.subscription_badge_type` to SELECT.

In the response (line ~413), add:

```js
is_verified: b.is_verified || false,
subscription_badge_type: b.subscription_badge_type || null,
badge_type: b.subscription_badge_type || (b.is_verified ? 'verified' : null),
```

### 5c. `offers.js` -- GET /offers (list)

**File:** `appredueri_backend/src/routes/offers.js`

In the main query (line ~91), add to SELECT:

```sql
b.subscription_badge_type as business_badge_type,
```

In the response mapping (line ~182), change:

```js
// BEFORE:
is_verified: row.business_verified || false

// AFTER:
is_verified: row.business_verified || false,
subscription_badge_type: row.business_badge_type || null,
badge_type: row.business_badge_type || (row.business_verified ? 'verified' : null),
```

### 5d. `offers.js` -- GET /offers/:id (detail)

Same pattern. Add `b.subscription_badge_type as business_badge_type` to the query (line ~411 area).

In the response `business` object (line ~562):

```js
is_verified: row.business_verified || false,
subscription_badge_type: row.business_badge_type || null,
badge_type: row.business_badge_type || (row.business_verified ? 'verified' : null),
```

### 5e. `offers.js` -- GET /offers/feed

Same pattern in the feed query (line ~251). Add `b.subscription_badge_type as business_badge_type` and include it in the response business object.

### 5f. `offers.js` -- GET /offers/deal-of-day

Same pattern. Add to both primary and fallback queries.

### 5g. `business-portal.js` -- GET /:businessId (detail)

**File:** `appredueri_backend/src/routes/business-portal.js`

In the response JSON (line ~117), add:

```js
subscription_badge_type: b.subscription_badge_type || null,
```

This lets the manage.ejs portal show which badge is active.

---

## 6. CSS Changes

**File:** `appredueri_backend/src/public/css/main.css`

### 6a. Existing `.verified-badge` -- KEEP AS-IS (orange)

The current `.verified-badge` stays exactly the same -- it is the Standard tier badge.

### 6b. New `.premium-badge` class

Add near the existing `.verified-badge` block (around line 4691):

```css
/* --- PREMIUM BADGE --- */
.premium-badge {
  display: inline-block;
  vertical-align: middle;
  margin-left: 6px;
  filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.5));
  transition: filter 0.3s ease;
}
.premium-badge:hover {
  filter: drop-shadow(0 0 12px rgba(167, 139, 250, 0.7));
}

/* Premium badge tooltip */
.premium-tooltip {
  display: none;
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-surface, #131318);
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.75rem;
  color: #a78bfa;
  white-space: nowrap;
  z-index: 10;
  box-shadow: 0 4px 16px rgba(167, 139, 250, 0.15);
  font-weight: 500;
}

/* On badge-wrap hover, show tooltip (reuse existing pattern from verified) */
.premium-badge-wrap:hover .premium-tooltip { display: block; }
.verified-badge-wrap:hover .verified-tooltip { display: block; }

/* --- BADGE ON CARDS (small) --- */
.card-badge-verified {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  color: #fb923c;
  font-weight: 500;
}
.card-badge-premium {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  color: #a78bfa;
  font-weight: 600;
  text-shadow: 0 0 8px rgba(167, 139, 250, 0.4);
}
```

---

## 7. EJS Template Changes

### 7a. `business-detail.ejs` -- Badge Display

**File:** `appredueri_backend/src/views/public/business-detail.ejs`

Replace the existing verified badge block (lines 53-58):

```ejs
<% if (business.badge_type === 'premium') { %>
  <span class="premium-badge-wrap" style="position: relative; display: inline-flex; cursor: help;">
    <svg class="premium-badge" width="22" height="22" viewBox="0 0 24 24" fill="#a78bfa">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
    </svg>
    <span class="premium-tooltip">Business Premium OFAI</span>
  </span>
<% } else if (business.badge_type === 'verified' || business.is_verified) { %>
  <span class="verified-badge-wrap" style="position: relative; display: inline-flex; cursor: help;">
    <svg class="verified-badge" width="22" height="22" viewBox="0 0 24 24" fill="#fb923c">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
    </svg>
    <span class="verified-tooltip" style="display: none; position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap; z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-weight: 400;">Business verificat de echipa OFAI</span>
  </span>
<% } %>
```

### 7b. `web.js` -- Render Route Data

**File:** `appredueri_backend/src/routes/web.js`

In the business-detail render route, ensure the `business` object passed to EJS includes `badge_type`. The render route fetches business data from the API internally or does its own query. Find the section that queries business data and add `subscription_badge_type` to the SELECT, then compute `badge_type`:

```js
// Wherever the business object is constructed for EJS rendering:
badge_type: row.subscription_badge_type || (row.is_verified ? 'verified' : null),
```

### 7c. Offer Cards on `/oferte` page (client-side rendered)

The `/oferte` page (`oferte.ejs`) fetches offers via fetch() and renders cards client-side. The card rendering JS needs to check `offer.business.badge_type`:

```js
// In the card template function (inside oferte.ejs script):
const badgeHtml = (() => {
  const bt = offer.business?.badge_type;
  if (bt === 'premium') {
    return '<svg class="premium-badge" width="16" height="16" viewBox="0 0 24 24" fill="#a78bfa"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>';
  }
  if (bt === 'verified' || offer.business?.is_verified) {
    return '<svg class="verified-badge" width="16" height="16" viewBox="0 0 24 24" fill="#fb923c"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>';
  }
  return '';
})();
```

---

## 8. Flutter Changes

### 8a. `Business` model

**File:** `ofai_flutter/lib/models/business.dart`

Add new field:

```dart
class Business {
  // ... existing fields ...
  final bool isVerified;
  final String? subscriptionBadgeType;  // NEW: null, 'verified', 'premium'
  final String? badgeType;              // NEW: computed effective badge

  Business({
    // ... existing params ...
    this.isVerified = false,
    this.subscriptionBadgeType,         // NEW
    this.badgeType,                     // NEW
    // ...
  });

  factory Business.fromJson(Map<String, dynamic> json) {
    final isVerified = json['is_verified'] as bool? ?? false;
    final subBadge = json['subscription_badge_type'] as String?;
    // Effective badge: subscription badge takes priority
    final effectiveBadge = json['badge_type'] as String?
        ?? subBadge
        ?? (isVerified ? 'verified' : null);

    return Business(
      // ... existing fields ...
      isVerified: isVerified,
      subscriptionBadgeType: subBadge,
      badgeType: effectiveBadge,
    );
  }

  /// Whether this business has any badge
  bool get hasBadge => badgeType != null;

  /// Whether this is a premium badge
  bool get isPremium => badgeType == 'premium';

  /// Whether this is a verified (standard) badge
  bool get isStandardVerified => badgeType == 'verified';
}
```

### 8b. `OfferBusiness` model (inside `offer.dart`)

**File:** `ofai_flutter/lib/models/offer.dart`

The `OfferBusiness` class also needs `badgeType`:

```dart
class OfferBusiness {
  // ... existing fields ...
  final bool isVerified;
  final String? badgeType;  // NEW

  OfferBusiness({
    // ... existing params ...
    this.isVerified = false,
    this.badgeType,           // NEW
  });

  factory OfferBusiness.fromJson(Map<String, dynamic> json) {
    final isVerified = json['is_verified'] as bool? ?? false;
    return OfferBusiness(
      // ... existing ...
      isVerified: isVerified,
      badgeType: json['badge_type'] as String?
          ?? json['subscription_badge_type'] as String?
          ?? (isVerified ? 'verified' : null),
    );
  }
}
```

### 8c. Shared Badge Widget

**File:** `ofai_flutter/lib/widgets/subscription_badge.dart` (NEW)

```dart
import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';

/// Colors for the Premium badge
class BadgeColors {
  static const purple = Color(0xFFa78bfa);
  static const purpleGlow = Color(0x40a78bfa);
}

/// Renders the correct badge icon based on badge_type
/// Usage: SubscriptionBadge(badgeType: business.badgeType, size: 16)
class SubscriptionBadge extends StatelessWidget {
  final String? badgeType;
  final double size;

  const SubscriptionBadge({super.key, required this.badgeType, this.size = 16});

  @override
  Widget build(BuildContext context) {
    if (badgeType == null) return const SizedBox.shrink();

    if (badgeType == 'premium') {
      return Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: BadgeColors.purpleGlow,
              blurRadius: 8,
              spreadRadius: 1,
            ),
          ],
        ),
        child: Icon(
          Icons.verified,
          color: BadgeColors.purple,
          size: size,
        ),
      );
    }

    // 'verified' (standard tier or admin-set)
    return Icon(
      Icons.verified,
      color: AppColors.accent,
      size: size,
    );
  }
}
```

### 8d. Update `BusinessCard` widget

**File:** `ofai_flutter/lib/widgets/business_card.dart`

Replace the existing verified check (lines 87-91):

```dart
// BEFORE:
if (business.isVerified)
  Padding(
    padding: const EdgeInsets.only(left: 4),
    child: Icon(Icons.verified, color: AppColors.accent, size: 16),
  ),

// AFTER:
if (business.hasBadge)
  Padding(
    padding: const EdgeInsets.only(left: 4),
    child: SubscriptionBadge(badgeType: business.badgeType, size: 16),
  ),
```

Add import at top: `import 'subscription_badge.dart';`

### 8e. Update `OfferCard._buildBusinessRow()`

**File:** `ofai_flutter/lib/widgets/offer_card.dart`

Replace lines 293-296:

```dart
// BEFORE:
if (biz.isVerified) ...[
  Icon(Icons.verified, color: AppColors.accent, size: 14),
  const SizedBox(width: 4),
],

// AFTER:
if (biz.badgeType != null) ...[
  SubscriptionBadge(badgeType: biz.badgeType, size: 14),
  const SizedBox(width: 4),
],
```

Add import: `import 'subscription_badge.dart';`

### 8f. Business Detail Screen

Find the business detail screen (likely `business_detail_screen.dart`). Wherever `business.isVerified` is checked to show a badge, replace with `SubscriptionBadge(badgeType: business.badgeType)`.

### 8g. Offer Detail Screen

Same pattern in `offer_detail_screen.dart` -- replace `isVerified` checks with `badgeType` checks.

---

## 9. Backward Compatibility

### Key Rules:

1. **`is_verified` column stays.** It remains as admin-controlled manual verification. Do NOT remove or rename it.
2. **`subscription_badge_type` is the tier-derived badge.** It is NULL for free tier, 'verified' for standard, 'premium' for premium.
3. **`badge_type` in API response is the EFFECTIVE badge.** Computed as: `subscription_badge_type || (is_verified ? 'verified' : null)`. Subscription badge always takes priority.
4. **Flutter `isVerified` stays on the model.** But display logic uses `badgeType` (the effective value). The `isVerified` field is kept for any code that specifically needs the admin-set flag.

### Migration Safety:

- Column addition is `IF NOT EXISTS` and has `DEFAULT NULL` -- safe for existing rows
- Backfill only updates businesses that already have a non-free subscription -- no-op if Plan 00 has not been run yet
- Old mobile app versions that don't parse `badge_type` will still see `is_verified` and show the orange checkmark (graceful degradation)

---

## 10. Gotchas

1. **Badge must update IMMEDIATELY on tier change.** The `syncBadgeType()` function must be called in the SAME transaction as the subscription change. If it is called outside the transaction and the transaction rolls back, the badge will be out of sync.

2. **Existing `is_verified` businesses.** If a business was manually verified by admin (`is_verified = true`) but is on the free tier, it will show the "verified" badge via the fallback logic. This is intentional -- admin verification is independent of tier.

3. **If admin un-verifies a Standard+ business.** The `subscription_badge_type` still shows the tier badge. `is_verified` being false does NOT hide the subscription badge. The subscription badge is controlled entirely by tier, not by admin.

4. **Purple color: `#a78bfa`** -- this is Tailwind violet-400. Ensure it has sufficient contrast against the dark background (#06060a). Ratio is ~8.2:1 which passes WCAG AAA.

5. **Drop-shadow on SVG vs box-shadow on container.** The CSS uses `filter: drop-shadow()` on the SVG element itself. In Flutter, we use `BoxShadow` on a wrapping Container. The visual effect is similar but not identical.

6. **Don't use `fontWeight` with DM Serif Display.** The badge label (if any text is shown) should use Inter, not DM Serif Display.

7. **`Clip.hardEdge`** on card containers -- ensure the glow shadow on the premium badge is NOT clipped by the card's `clipBehavior`. If it is, the glow will be cut off. Solution: the badge sits inside the content area (not on the edge), so clipping should not be an issue. If it is, apply the glow to the text/icon only, not a container.

8. **Offer cards on `/oferte` are client-side rendered.** The badge SVG must be included in the JavaScript template string. Ensure no XSS -- `badge_type` comes from the API which sanitizes it to only 'verified' or 'premium'.

---

## 11. Verification Checklist

After implementation:
- [ ] Migration 034 runs successfully
- [ ] Existing businesses with free tier have `subscription_badge_type = NULL`
- [ ] `syncBadgeType` is called in all tier-change code paths
- [ ] `GET /businesses` returns `badge_type` field
- [ ] `GET /businesses/:id` returns `badge_type` field
- [ ] `GET /offers` returns `badge_type` in business object
- [ ] `GET /offers/:id` returns `badge_type` in business object
- [ ] business-detail.ejs shows purple badge for premium, orange for verified
- [ ] oferte.ejs card template shows correct badge
- [ ] CSS `.premium-badge` has purple glow (#a78bfa)
- [ ] Flutter `Business.fromJson` parses `badge_type`
- [ ] Flutter `SubscriptionBadge` widget renders both types correctly
- [ ] Flutter `BusinessCard` uses `SubscriptionBadge`
- [ ] Flutter `OfferCard` uses `SubscriptionBadge`
- [ ] Old mobile app versions still show orange checkmark (graceful degradation)
- [ ] Premium badge glow not clipped by card containers
