# Platform Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make OFAI feel alive, complete, and professional — urgency, social proof, personalization, gamification across web (EJS) and mobile (Flutter).

**Architecture:** Backend-first approach: DB migration + query changes + new endpoints, then web EJS UI, then Flutter UI. Each priority tier (P1/P2/P3) is a self-contained sprint with its own commit(s).

**Tech Stack:** Node.js/Express, PostgreSQL, EJS templates, vanilla JS, Flutter/Dart, Riverpod

**Design doc:** `docs/plans/2026-02-22-platform-polish-design.md`

---

## SPRINT P1 — High Impact, Low Effort (Urgency + Social Proof Core)

---

### Task 1: DB Migration 030 — save_count support + deal_of_day + max_reveals

**Files:**
- Create: `appredueri_backend/src/migrations/030_platform_polish.sql`

**Step 1: Write the migration**

```sql
-- 030_platform_polish.sql
-- Platform Polish: deal of day, limited codes, gamification

-- Offers: deal of day + limited codes
ALTER TABLE offers ADD COLUMN IF NOT EXISTS is_deal_of_day BOOLEAN DEFAULT FALSE;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS deal_of_day_date DATE;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS max_reveals INTEGER;

-- Users: gamification
ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_visit_date DATE;

-- Point transactions
CREATE TABLE IF NOT EXISTS point_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  points INTEGER NOT NULL,
  reference_id INTEGER,
  reference_type VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_action ON point_transactions(user_id, action);

-- User badges
CREATE TABLE IF NOT EXISTS user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  badge_type VARCHAR(50) NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_type)
);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- Index for trending calculation (recent favorites)
CREATE INDEX IF NOT EXISTS idx_favorite_offers_created_at ON favorite_offers(created_at)
  WHERE created_at > NOW() - INTERVAL '7 days';

-- Index for deal of day queries
CREATE INDEX IF NOT EXISTS idx_offers_deal_of_day ON offers(is_deal_of_day, deal_of_day_date)
  WHERE is_deal_of_day = TRUE;
```

**Step 2: Run migration against local DB**

```bash
cd appredueri_backend
psql "$DATABASE_URL" -f src/migrations/030_platform_polish.sql
```

Expected: All ALTER/CREATE succeed (IF NOT EXISTS = safe to re-run).

**Step 3: Commit**

```bash
git add appredueri_backend/src/migrations/030_platform_polish.sql
git commit -m "feat: migration 030 — platform polish (deal of day, max reveals, gamification tables)"
```

---

### Task 2: Backend — Add save_count + is_trending to offer queries

**Context:** Web home query (web.js:116-137) already has `favorite_count` via subquery. Mobile API (offers.js:76-135) does NOT. Offer detail queries in both web.js and offers.js also lack it.

**Files:**
- Modify: `appredueri_backend/src/routes/offers.js` (mobile API — list + detail queries)
- Modify: `appredueri_backend/src/routes/web.js` (web offer detail query)

**Step 1: Add save_count + is_trending to offers.js list query**

In `offers.js`, find the SELECT block (around line 76-90). Add these two subqueries after the existing `rating_count` subquery:

```sql
(SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count,
(SELECT COUNT(*) FROM favorite_offers fo2 WHERE fo2.offer_id = o.id AND fo2.created_at > NOW() - INTERVAL '7 days') >= 5 as is_trending
```

**Step 2: Add save_count + is_trending to offers.js detail query**

In `offers.js`, find the detail SELECT block (around line 311-354). Add after the `rating_count` subquery:

```sql
(SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count,
(SELECT COUNT(*) FROM favorite_offers fo2 WHERE fo2.offer_id = o.id AND fo2.created_at > NOW() - INTERVAL '7 days') >= 5 as is_trending,
o.max_reveals,
(SELECT COUNT(*) FROM code_reveals cr WHERE cr.offer_id = o.id) as reveal_count
```

**Step 3: Add save_count + is_trending to web.js offer detail query**

In `web.js`, find the offer detail SELECT block (around line 576-606). Add after `rating_count` subquery:

```sql
(SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count,
(SELECT COUNT(*) FROM favorite_offers fo2 WHERE fo2.offer_id = o.id AND fo2.created_at > NOW() - INTERVAL '7 days') >= 5 as is_trending,
o.max_reveals,
(SELECT COUNT(*) FROM code_reveals cr WHERE cr.offer_id = o.id) as reveal_count
```

**Step 4: Add is_trending to web.js home featured offers query**

In `web.js`, find the featured offers SELECT (around line 116-137). It already has `favorite_count`. Add:

```sql
(SELECT COUNT(*) FROM favorite_offers fo2 WHERE fo2.offer_id = o.id AND fo2.created_at > NOW() - INTERVAL '7 days') >= 5 as is_trending
```

**Step 5: Verify backend starts without errors**

```bash
cd appredueri_backend && npm run dev
```

Expected: Server starts on port 4000 without SQL errors.

**Step 6: Commit**

```bash
git add appredueri_backend/src/routes/offers.js appredueri_backend/src/routes/web.js
git commit -m "feat: add save_count + is_trending to all offer queries (web + mobile API)"
```

---

### Task 3: Backend — Deal of the Day endpoint

**Files:**
- Modify: `appredueri_backend/src/routes/offers.js` (add GET /deal-of-day)
- Modify: `appredueri_backend/src/routes/web.js` (add deal_of_day to home query)

**Step 1: Add GET /offers/deal-of-day to offers.js**

Add this route BEFORE the `GET /offers/:id` route (important — otherwise `:id` catches "deal-of-day"):

```javascript
// GET /offers/deal-of-day — returns the featured deal of the day
router.get("/deal-of-day", async (req, res) => {
  try {
    // First try: manually selected deal of day (admin)
    let result = await pool.query(`
      SELECT o.id, o.title, o.description, o.discount_type, o.discount_value,
             o.start_date, o.end_date, o.logo_url as offer_logo,
             b.id as business_id, b.name as business_name,
             b.logo_url as business_logo, b.cover_image_url as business_cover,
             b.is_verified as business_verified,
             c.name as city_name, cat.name as category_name,
             (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count,
             (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE business_id = b.id) as rating_avg,
             (SELECT COUNT(*) FROM reviews WHERE business_id = b.id) as rating_count
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      WHERE o.is_deal_of_day = TRUE
        AND o.is_active = TRUE
        AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
      ORDER BY o.deal_of_day_date DESC NULLS LAST
      LIMIT 1
    `);

    // Fallback: highest engagement offer (most saves in last 7 days)
    if (result.rows.length === 0) {
      result = await pool.query(`
        SELECT o.id, o.title, o.description, o.discount_type, o.discount_value,
               o.start_date, o.end_date, o.logo_url as offer_logo,
               b.id as business_id, b.name as business_name,
               b.logo_url as business_logo, b.cover_image_url as business_cover,
               b.is_verified as business_verified,
               c.name as city_name, cat.name as category_name,
               (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count,
               (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE business_id = b.id) as rating_avg,
               (SELECT COUNT(*) FROM reviews WHERE business_id = b.id) as rating_count
        FROM offers o
        JOIN businesses b ON o.business_id = b.id
        LEFT JOIN cities c ON b.city_id = c.id
        LEFT JOIN categories cat ON b.category_id = cat.id
        WHERE o.is_active = TRUE
          AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
        ORDER BY (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id
                  AND fo.created_at > NOW() - INTERVAL '7 days') DESC,
                 o.discount_value DESC NULLS LAST
        LIMIT 1
      `);
    }

    if (result.rows.length === 0) {
      return res.json({ deal: null });
    }

    const row = result.rows[0];
    res.json({
      deal: {
        id: row.id,
        title: row.title,
        description: row.description,
        discount_type: row.discount_type,
        discount_value: row.discount_value,
        start_date: row.start_date,
        end_date: row.end_date,
        image_url: row.offer_logo || row.business_cover,
        save_count: parseInt(row.save_count) || 0,
        business: {
          id: row.business_id,
          name: row.business_name,
          logo_url: row.business_logo,
          is_verified: row.business_verified,
        },
        city_name: row.city_name,
        category_name: row.category_name,
        rating_avg: parseFloat(row.rating_avg) || 0,
        rating_count: parseInt(row.rating_count) || 0,
      }
    });
  } catch (err) {
    console.error("Deal of day error:", err.message);
    res.status(500).json({ message: "Eroare server" });
  }
});
```

**Step 2: Add deal_of_day to web.js home page query**

In `web.js` GET `/` handler, after the existing `featuredOffers` query, add a separate query:

```javascript
// Deal of the day
const dealResult = await pool.query(`
  SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
         b.name as business_name, b.logo_url as business_logo,
         COALESCE(b.cover_image_url, o.logo_url) as image_url,
         b.is_verified as business_verified,
         c.name as city_name, cat.name as category_name,
         (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count
  FROM offers o
  JOIN businesses b ON o.business_id = b.id
  LEFT JOIN cities c ON b.city_id = c.id
  LEFT JOIN categories cat ON b.category_id = cat.id
  WHERE o.is_active = TRUE
    AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
  ORDER BY
    CASE WHEN o.is_deal_of_day = TRUE THEN 0 ELSE 1 END,
    (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id AND fo.created_at > NOW() - INTERVAL '7 days') DESC,
    o.discount_value DESC NULLS LAST
  LIMIT 1
`);
const dealOfDay = dealResult.rows[0] || null;
```

Pass `dealOfDay` to the EJS render call alongside existing variables.

**Step 3: Commit**

```bash
git add appredueri_backend/src/routes/offers.js appredueri_backend/src/routes/web.js
git commit -m "feat: deal-of-day endpoint + home page query"
```

---

### Task 4: Web EJS — Countdown timer on offer cards

**Files:**
- Modify: `appredueri_backend/src/public/js/main.js` (add countdown function)
- Modify: `appredueri_backend/src/views/public/home.ejs` (add data-end-date to cards)
- Modify: `appredueri_backend/src/public/css/main.css` (countdown styles)

**Step 1: Add countdown CSS to main.css**

Add after the existing `.urgency-badge` styles (around line 3999):

```css
/* ═══════════════════════════════════════════════════════
   COUNTDOWN TIMER
   ═══════════════════════════════════════════════════════ */
.countdown-timer {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.countdown-timer.urgency-low {
  color: var(--success);
}

.countdown-timer.urgency-medium {
  color: var(--accent);
}

.countdown-timer.urgency-high {
  color: var(--danger);
}

.countdown-timer.urgency-critical {
  color: var(--danger);
  animation: urgency-pulse 1.5s ease-in-out infinite;
}
```

**Step 2: Replace urgency-badge with data-driven countdown in home.ejs**

In `home.ejs`, find the urgency badge section (around lines 208-210). Replace:

```html
<% if (offer.end_date) { %>
  <div class="urgency-badge countdown-timer" data-end-date="<%= new Date(offer.end_date).toISOString() %>"></div>
<% } %>
```

**Step 3: Add initCountdowns() to main.js**

Add this function and call it from the existing DOMContentLoaded:

```javascript
function initCountdowns() {
  function updateCountdowns() {
    document.querySelectorAll('.countdown-timer[data-end-date]').forEach(el => {
      const endDate = new Date(el.dataset.endDate);
      const now = new Date();
      const diff = endDate - now;

      if (diff <= 0) {
        el.textContent = 'Expirat\u0103';
        el.className = 'urgency-badge countdown-timer urgency-high';
        return;
      }

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);

      let text, urgencyClass;
      if (days > 7) {
        // Don't show countdown for > 7 days
        el.style.display = 'none';
        return;
      } else if (days >= 3) {
        text = days + 'z ' + hours + 'h';
        urgencyClass = 'urgency-medium';
      } else if (days >= 1) {
        text = days + 'z ' + hours + 'h';
        urgencyClass = 'urgency-high';
      } else {
        text = hours + 'h ' + mins + 'm';
        urgencyClass = 'urgency-critical';
      }

      el.textContent = text;
      el.className = 'urgency-badge countdown-timer ' + urgencyClass;
      el.style.display = '';
    });
  }

  updateCountdowns();
  setInterval(updateCountdowns, 60000); // Update every minute
}
```

Call `initCountdowns()` inside the existing `DOMContentLoaded` listener.

**Step 4: Also apply countdown to offer-detail.ejs**

In `offer-detail.ejs`, find the expiry display section (around lines 838-853). Add a large countdown block after the date range:

```html
<% if (offer.end_date) { %>
  <div class="offer-detail-countdown countdown-timer" data-end-date="<%= new Date(offer.end_date).toISOString() %>" style="font-size: 1.25rem; margin: 16px 0;"></div>
<% } %>
```

**Step 5: Commit**

```bash
git add appredueri_backend/src/public/css/main.css appredueri_backend/src/public/js/main.js appredueri_backend/src/views/public/home.ejs appredueri_backend/src/views/public/offer-detail.ejs
git commit -m "feat: countdown timers on offer cards + detail (web)"
```

---

### Task 5: Web EJS — Trending badge + save count on cards

**Files:**
- Modify: `appredueri_backend/src/views/public/home.ejs` (trending badge markup)
- Modify: `appredueri_backend/src/public/css/main.css` (trending badge CSS)

**Step 1: Add trending badge CSS to main.css**

Add after countdown styles:

```css
/* ═══════════════════════════════════════════════════════
   TRENDING BADGE
   ═══════════════════════════════════════════════════════ */
.trending-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  z-index: 2;
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  gap: 4px;
}
```

**Step 2: Update home.ejs offer cards — add trending badge**

In `home.ejs`, inside the `.offer-image-wrapper` div (around line 208, where urgency badge was), add trending badge before the countdown. The urgency-badge line was replaced by countdown in Task 4. Add trending:

```html
<% if (offer.is_trending) { %>
  <div class="trending-badge">Trending</div>
<% } %>
```

Position it so trending and countdown don't overlap — trending top-left, countdown bottom-left (urgency-badge position).

**Step 3: Update offer-detail.ejs — add save count and trending indicator**

In `offer-detail.ejs`, after the title section, add activity pills:

```html
<div class="offer-detail-activity" style="display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0;">
  <% if (parseInt(offer.save_count) >= 5) { %>
    <span class="offer-meta-item offer-social-proof" style="font-size: 0.8125rem;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
      <%= offer.save_count %> persoane au salvat-o
    </span>
  <% } %>
  <% if (offer.is_trending) { %>
    <span class="trending-badge" style="position: static;">Trending</span>
  <% } %>
</div>
```

**Step 4: Commit**

```bash
git add appredueri_backend/src/views/public/home.ejs appredueri_backend/src/views/public/offer-detail.ejs appredueri_backend/src/public/css/main.css
git commit -m "feat: trending badge + save count on offer cards and detail (web)"
```

---

### Task 6: Web EJS — Deal of the Day section on homepage

**Files:**
- Modify: `appredueri_backend/src/views/public/home.ejs` (new section)
- Modify: `appredueri_backend/src/public/css/main.css` (deal of day styles)

**Step 1: Add deal-of-day CSS**

```css
/* ═══════════════════════════════════════════════════════
   DEAL OF THE DAY
   ═══════════════════════════════════════════════════════ */
.deal-of-day {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid rgba(251, 146, 60, 0.25);
  background: linear-gradient(135deg, rgba(251, 146, 60, 0.06) 0%, rgba(251, 146, 60, 0.02) 100%);
}

.deal-of-day-label {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 3;
  background: linear-gradient(135deg, #f97316, #fb923c);
  color: #000;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 6px 14px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
```

**Step 2: Add deal-of-day section to home.ejs**

Insert this section BEFORE the "Oferte de top" section (before the `offers-bento` div). Wrap it in an `if (dealOfDay)` check:

```html
<% if (dealOfDay) { %>
<section class="section" style="padding-bottom: 24px;">
  <div class="container">
    <div class="section-header reveal">
      <div class="section-label">Oferta Zilei</div>
      <h2 class="section-title text-gradient">Nu rata aceasta oferta</h2>
    </div>
    <a href="/oferta/<%= dealOfDay.id %>" class="offer-card featured deal-of-day reveal">
      <div class="offer-image-wrapper">
        <% if (dealOfDay.image_url) { %>
          <img src="<%= dealOfDay.image_url %>" alt="<%= dealOfDay.title %>" class="offer-image" loading="lazy" width="800" height="400">
        <% } else { %>
          <div class="offer-image-placeholder">
            <span class="offer-placeholder-letter"><%= dealOfDay.business_name.charAt(0) %></span>
          </div>
        <% } %>
        <div class="deal-of-day-label">Oferta Zilei</div>
        <div class="offer-badge">
          <% if (dealOfDay.discount_type === 'percent' || dealOfDay.discount_type === 'percentage') { %>
            -<%= dealOfDay.discount_value %>%
          <% } else if (dealOfDay.discount_value) { %>
            -<%= dealOfDay.discount_value %> lei
          <% } %>
        </div>
        <% if (dealOfDay.end_date) { %>
          <div class="urgency-badge countdown-timer" data-end-date="<%= new Date(dealOfDay.end_date).toISOString() %>"></div>
        <% } %>
      </div>
      <div class="offer-content">
        <div class="offer-business"><%= dealOfDay.business_name %></div>
        <div class="offer-title"><%= dealOfDay.title %></div>
        <div class="offer-meta">
          <span class="offer-meta-item"><%= dealOfDay.city_name %></span>
          <% if (parseInt(dealOfDay.save_count) >= 5) { %>
            <span class="offer-meta-item offer-social-proof">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              <%= dealOfDay.save_count %> salvari
            </span>
          <% } %>
        </div>
      </div>
    </a>
  </div>
</section>
<% } %>
```

**Step 3: Commit**

```bash
git add appredueri_backend/src/views/public/home.ejs appredueri_backend/src/public/css/main.css
git commit -m "feat: deal of the day section on homepage (web)"
```

---

### Task 7: Flutter — Update Offer model with save_count + is_trending

**Files:**
- Modify: `ofai_flutter/lib/models/offer.dart`
- Modify: `ofai_flutter/test/models/offer_test.dart`

**Step 1: Add fields to Offer model**

In `offer.dart`, add to the class fields:

```dart
final int saveCount;
final bool isTrending;
final int? maxReveals;
final int? revealCount;
```

Update constructor to include these with defaults. Update `fromJson`:

```dart
saveCount: json['save_count'] as int? ?? 0,
isTrending: json['is_trending'] as bool? ?? false,
maxReveals: json['max_reveals'] as int?,
revealCount: json['reveal_count'] as int?,
```

**Step 2: Update tests**

In `offer_test.dart`, add the new fields to test JSON fixtures and assert they deserialize correctly.

**Step 3: Run tests**

```bash
cd ofai_flutter && flutter test test/models/offer_test.dart -v
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add ofai_flutter/lib/models/offer.dart ofai_flutter/test/models/offer_test.dart
git commit -m "feat: add save_count, is_trending, max_reveals to Offer model"
```

---

### Task 8: Flutter — Enhanced countdown timer on OfferCard

**Files:**
- Modify: `ofai_flutter/lib/widgets/offer_card.dart`

**Step 1: Enhance _buildCountdown() method**

Replace the existing `_buildCountdown()` (around line 411-442) with an enhanced version that shows `Xz Xh` format with color-coded urgency:

```dart
Widget _buildCountdown() {
  if (offer.endDate == null) return const SizedBox.shrink();
  final endDate = DateTime.tryParse(offer.endDate!);
  if (endDate == null) return const SizedBox.shrink();

  final now = DateTime.now();
  final diff = endDate.difference(now);
  if (diff.isNegative || diff.inDays > 7) return const SizedBox.shrink();

  final days = diff.inDays;
  final hours = diff.inHours % 24;

  String text;
  Color bgColor;
  if (days == 0 && hours == 0) {
    text = '< 1h';
    bgColor = AppColors.danger;
  } else if (days == 0) {
    text = '${hours}h';
    bgColor = AppColors.danger;
  } else if (days <= 2) {
    text = '${days}z ${hours}h';
    bgColor = AppColors.danger;
  } else {
    text = '${days}z ${hours}h';
    bgColor = AppColors.warning;
  }

  return Positioned(
    bottom: 8,
    left: 8,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.access_time, size: 12, color: Colors.white),
          const SizedBox(width: 4),
          Text(
            text,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    ),
  );
}
```

**Step 2: Add trending badge to OfferCard image stack**

In the image Stack children (around line 84-93), add:

```dart
if (offer.isTrending)
  Positioned(
    top: 8,
    left: 8,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFFF97316), Color(0xFFEF4444)]),
        borderRadius: BorderRadius.circular(6),
      ),
      child: const Text(
        'Trending',
        style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
      ),
    ),
  ),
```

**Step 3: Add save count to card meta section**

In the offer-meta area (around the rating/category section), add:

```dart
if (offer.saveCount >= 5) ...[
  const SizedBox(width: 8),
  Icon(Icons.bookmark, size: 12, color: AppColors.accent),
  const SizedBox(width: 2),
  Text(
    '${offer.saveCount}',
    style: TextStyle(fontSize: 11, color: AppColors.accent, fontWeight: FontWeight.w600),
  ),
],
```

**Step 4: Run widget tests**

```bash
cd ofai_flutter && flutter test test/widgets/offer_card_test.dart -v
```

**Step 5: Commit**

```bash
git add ofai_flutter/lib/widgets/offer_card.dart
git commit -m "feat: enhanced countdown timer, trending badge, save count on OfferCard (Flutter)"
```

---

### Task 9: Flutter — Deal of the Day on HomeScreen

**Files:**
- Create: `ofai_flutter/lib/widgets/featured_offer_card.dart`
- Modify: `ofai_flutter/lib/screens/home/home_screen.dart`
- Modify: `ofai_flutter/lib/providers/offers_provider.dart` (add dealOfDayProvider)
- Modify: `ofai_flutter/lib/core/network/api_endpoints.dart` (add endpoint)

**Step 1: Add API endpoint**

In `api_endpoints.dart`, add:

```dart
static const String dealOfDay = '/offers/deal-of-day';
```

**Step 2: Add provider**

In `offers_provider.dart`, add:

```dart
final dealOfDayProvider = FutureProvider.autoDispose<Offer?>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final response = await api.dio.get(ApiEndpoints.dealOfDay);
    final data = response.data['deal'];
    if (data == null) return null;
    return Offer.fromJson(data);
  } catch (_) {
    return null;
  }
});
```

**Step 3: Create FeaturedOfferCard widget**

```dart
// ofai_flutter/lib/widgets/featured_offer_card.dart
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/offer.dart';
import '../core/theme/app_colors.dart';

class FeaturedOfferCard extends StatelessWidget {
  final Offer offer;
  final VoidCallback? onTap;

  const FeaturedOfferCard({super.key, required this.offer, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 280,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.accent.withValues(alpha: 0.25)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Background image
            if (offer.imageUrl != null)
              CachedNetworkImage(
                imageUrl: offer.imageUrl!,
                fit: BoxFit.cover,
              ),
            // Gradient overlay
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.black.withValues(alpha: 0.85)],
                  stops: const [0.3, 1.0],
                ),
              ),
            ),
            // "Oferta Zilei" label
            Positioned(
              top: 12,
              left: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFFF97316), Color(0xFFFB923C)]),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'OFERTA ZILEI',
                  style: TextStyle(color: Colors.black, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1),
                ),
              ),
            ),
            // Discount badge
            if (offer.discountValue != null)
              Positioned(
                top: 12,
                right: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    offer.discountType == 'percentage' || offer.discountType == 'percent'
                        ? '-${offer.discountValue!.toInt()}%'
                        : '-${offer.discountValue!.toInt()} lei',
                    style: const TextStyle(color: Colors.black, fontSize: 14, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            // Content overlay
            Positioned(
              bottom: 16,
              left: 16,
              right: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (offer.business != null)
                    Text(
                      offer.business!.name,
                      style: TextStyle(color: AppColors.accent, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  const SizedBox(height: 4),
                  Text(
                    offer.title,
                    style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      if (offer.saveCount >= 5) ...[
                        Icon(Icons.bookmark, size: 14, color: AppColors.accent),
                        const SizedBox(width: 4),
                        Text('${offer.saveCount} salvari', style: TextStyle(color: AppColors.accent, fontSize: 12)),
                        const SizedBox(width: 12),
                      ],
                      Icon(Icons.location_on_outlined, size: 14, color: AppColors.textTertiary),
                      const SizedBox(width: 4),
                      Text(
                        offer.business?.city ?? '',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

**Step 4: Add to HomeScreen**

In `home_screen.dart`, import `FeaturedOfferCard` and `dealOfDayProvider`. Add a section BEFORE the existing offers section (around line 298):

```dart
// Deal of the Day
ref.watch(dealOfDayProvider).when(
  data: (deal) {
    if (deal == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 24),
          Text('Oferta Zilei', style: TextStyle(color: AppColors.accent, fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          FeaturedOfferCard(
            offer: deal,
            onTap: () => context.push('/offer/${deal.id}'),
          ),
        ],
      ),
    );
  },
  loading: () => const SizedBox.shrink(),
  error: (_, __) => const SizedBox.shrink(),
),
```

**Step 5: Run flutter analyze**

```bash
cd ofai_flutter && flutter analyze
```

Expected: 0 errors.

**Step 6: Commit**

```bash
git add ofai_flutter/lib/widgets/featured_offer_card.dart ofai_flutter/lib/screens/home/home_screen.dart ofai_flutter/lib/providers/offers_provider.dart ofai_flutter/lib/core/network/api_endpoints.dart
git commit -m "feat: deal of the day section on HomeScreen (Flutter)"
```

---

### Task 10: Flutter — Save count + activity pills on OfferDetailScreen

**Files:**
- Modify: `ofai_flutter/lib/screens/offer/offer_detail_screen.dart`

**Step 1: Add activity indicators after title**

In `offer_detail_screen.dart`, after the title text (around line 143), add:

```dart
// Activity indicators
if (offer.saveCount >= 5 || offer.isTrending)
  Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Wrap(
      spacing: 8,
      runSpacing: 4,
      children: [
        if (offer.isTrending)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFFF97316), Color(0xFFEF4444)]),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Text('Trending', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
          ),
        if (offer.saveCount >= 5)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.accentMuted,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.bookmark, size: 12, color: AppColors.accent),
                const SizedBox(width: 4),
                Text(
                  '${offer.saveCount} persoane au salvat-o',
                  style: TextStyle(color: AppColors.accent, fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
      ],
    ),
  ),
```

**Step 2: Add limited codes display in promo section**

In the `_PromoCodeCard` section (around line 648+), add a limited codes indicator before the reveal button if `maxReveals` is set:

```dart
if (offer.maxReveals != null) {
  final remaining = offer.maxReveals! - (offer.revealCount ?? 0);
  final percentage = remaining / offer.maxReveals!;
  // Show remaining codes indicator
  // Red if < 20%, orange if < 50%, green otherwise
}
```

**Step 3: Commit**

```bash
git add ofai_flutter/lib/screens/offer/offer_detail_screen.dart
git commit -m "feat: activity indicators + limited codes on offer detail (Flutter)"
```

---

## SPRINT P2 — Social Proof + Personalization

---

### Task 11: Backend — Rating breakdown + follower count queries

**Files:**
- Modify: `appredueri_backend/src/routes/web.js` (business detail query)
- Modify: `appredueri_backend/src/routes/businesses.js` (mobile API)

**Step 1: Add rating breakdown + follower_count to business detail queries**

Add these subqueries to both web.js and businesses.js business detail queries:

```sql
(SELECT COUNT(*) FROM followed_businesses fb WHERE fb.business_id = b.id) as follower_count,
(SELECT json_agg(json_build_object('rating', r_dist.rating, 'count', r_dist.cnt))
 FROM (SELECT rating, COUNT(*) as cnt FROM reviews WHERE business_id = b.id GROUP BY rating) r_dist
) as rating_distribution
```

**Step 2: Commit**

```bash
git add appredueri_backend/src/routes/web.js appredueri_backend/src/routes/businesses.js
git commit -m "feat: rating breakdown + follower count in business detail queries"
```

---

### Task 12: Web — Rating breakdown chart on business-detail.ejs

**Files:**
- Modify: `appredueri_backend/src/views/public/business-detail.ejs`
- Modify: `appredueri_backend/src/public/css/main.css`

**Step 1: Add rating breakdown CSS**

```css
.rating-breakdown { display: flex; flex-direction: column; gap: 4px; margin: 12px 0; }
.rating-bar-row { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; }
.rating-bar-label { width: 20px; text-align: right; color: var(--text-tertiary); }
.rating-bar-track { flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
.rating-bar-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width 0.6s ease; }
.rating-bar-pct { width: 32px; color: var(--text-tertiary); font-size: 0.6875rem; }
```

**Step 2: Add breakdown HTML after rating display**

In `business-detail.ejs`, after the rating row (around line 76), add the breakdown bars. Use the `rating_distribution` data from the query.

**Step 3: Add follower count next to follow button**

After the follow button (around line 112), add:

```html
<% if (parseInt(business.follower_count) >= 3) { %>
  <span class="bd-follower-count" style="font-size: 0.8125rem; color: var(--text-secondary);">
    <%= business.follower_count %> urmaritori
  </span>
<% } %>
```

**Step 4: Commit**

```bash
git add appredueri_backend/src/views/public/business-detail.ejs appredueri_backend/src/public/css/main.css
git commit -m "feat: rating breakdown chart + follower count on business detail (web)"
```

---

### Task 13: Flutter — Rating breakdown + follower count on BusinessDetailScreen

**Files:**
- Modify: `ofai_flutter/lib/models/business.dart` (add followerCount, ratingDistribution)
- Modify: `ofai_flutter/lib/screens/business/business_detail_screen.dart`

**Step 1: Update Business model**

Add `followerCount` and `ratingDistribution` (Map<int, int>) fields.

**Step 2: Add rating breakdown widget**

After the rating display (around line 185), add a Column with 5 rows (5 stars → 1 star), each with a label, a linear progress bar, and a percentage. Only show if business has >= 3 reviews.

**Step 3: Add follower count**

After the follow button area, show "X urmaritori" text if >= 3.

**Step 4: Commit**

```bash
git add ofai_flutter/lib/models/business.dart ofai_flutter/lib/screens/business/business_detail_screen.dart
git commit -m "feat: rating breakdown + follower count on business detail (Flutter)"
```

---

### Task 14: Web + Flutter — Similar offers on offer detail

**Files:**
- Modify: `appredueri_backend/src/views/public/offer-detail.ejs` (similar offers section)
- Modify: `appredueri_backend/src/routes/web.js` (query similar offers in detail route)
- Modify: `ofai_flutter/lib/screens/offer/offer_detail_screen.dart`

**Step 1: Backend — query similar offers in web.js offer detail route**

After the main offer detail query, add:

```javascript
const similarResult = await pool.query(`
  SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
         b.name as business_name, b.logo_url as business_logo,
         COALESCE(b.cover_image_url, o.logo_url) as image_url,
         c.name as city_name
  FROM offers o
  JOIN businesses b ON o.business_id = b.id
  LEFT JOIN cities c ON b.city_id = c.id
  WHERE o.id != $1
    AND o.is_active = TRUE
    AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
    AND b.category_id = $2
  ORDER BY (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) DESC
  LIMIT 4
`, [offerId, offer.cat_id]);
```

Pass `similarOffers` to the EJS render.

**Step 2: Web EJS — add similar offers section**

At the bottom of `offer-detail.ejs`, add a "Oferte similare" grid with 4 mini offer-cards.

**Step 3: Flutter — add similar offers to offer detail**

In `offer_detail_screen.dart`, after the gallery section, fetch and display a horizontal list of similar OfferCard widgets.

**Step 4: Commit**

```bash
git add appredueri_backend/src/routes/web.js appredueri_backend/src/views/public/offer-detail.ejs ofai_flutter/lib/screens/offer/offer_detail_screen.dart
git commit -m "feat: similar offers section on offer detail (web + Flutter)"
```

---

### Task 15: Web + Flutter — Limited codes display

**Files:**
- Modify: `appredueri_backend/src/views/public/offer-detail.ejs` (promo code section)
- Modify: `appredueri_backend/src/views/public/portal/offer-form.ejs` (add max_reveals field)
- Modify: `ofai_flutter/lib/screens/offer/offer_detail_screen.dart`

**Step 1: Portal — add max_reveals field to offer form**

In `offer-form.ejs`, in the promo codes section, add an input:

```html
<div class="of-group">
  <label class="of-label">Limita coduri (optional)</label>
  <input type="number" name="max_reveals" class="of-input" min="1"
         placeholder="Lasa gol pentru nelimitat"
         value="<%= offer ? offer.max_reveals || '' : '' %>">
  <small style="color: var(--text-tertiary);">Numarul maxim de utilizatori care pot dezvalui codul</small>
</div>
```

**Step 2: Web — show remaining codes on offer-detail.ejs**

In the promo-code-section, add above the reveal button:

```html
<% if (offer.max_reveals) { %>
  <% const remaining = offer.max_reveals - (parseInt(offer.reveal_count) || 0); %>
  <% const pct = remaining / offer.max_reveals; %>
  <div class="promo-limit" style="margin-bottom: 12px; font-size: 0.8125rem;">
    <% if (remaining <= 0) { %>
      <span style="color: var(--text-tertiary);">Coduri epuizate</span>
    <% } else if (pct < 0.2) { %>
      <span style="color: var(--danger); font-weight: 600;">Ultimele <%= remaining %> coduri!</span>
    <% } else { %>
      <span style="color: var(--text-secondary);">Mai sunt <%= remaining %> din <%= offer.max_reveals %> coduri</span>
    <% } %>
  </div>
<% } %>
```

**Step 3: Backend — handle max_reveals in offer create/update routes**

Add `max_reveals` to INSERT/UPDATE queries in `web.js` portal offer routes and `business-portal.js`.

**Step 4: Commit**

```bash
git add appredueri_backend/src/views/public/offer-detail.ejs appredueri_backend/src/views/public/portal/offer-form.ejs appredueri_backend/src/routes/web.js ofai_flutter/lib/screens/offer/offer_detail_screen.dart
git commit -m "feat: limited codes display + portal max_reveals field"
```

---

### Task 16: Web + Flutter — Verified badge tooltip + activity indicators

**Files:**
- Modify: `appredueri_backend/src/views/public/business-detail.ejs`
- Modify: `ofai_flutter/lib/screens/business/business_detail_screen.dart`

**Step 1: Web — make verified badge clickable with tooltip**

Wrap the existing verified badge with a tooltip that explains what "Verificat" means.

**Step 2: Flutter — add verified badge bottom sheet**

On tapping the verified badge in business detail, show a `showModalBottomSheet` explaining the verification.

**Step 3: Commit**

```bash
git add appredueri_backend/src/views/public/business-detail.ejs ofai_flutter/lib/screens/business/business_detail_screen.dart
git commit -m "feat: verified badge explanation tooltip (web + Flutter)"
```

---

## SPRINT P3 — Gamification

---

### Task 17: Backend — Gamification service (points + badges + streak)

**Files:**
- Create: `appredueri_backend/src/services/gamification.js`
- Modify: `appredueri_backend/src/routes/users.js` (add GET /me/gamification)

**Step 1: Create gamification service**

```javascript
// src/services/gamification.js
const pool = require("../config/database"); // or however pool is imported

const POINT_VALUES = {
  favorite: 5,
  reveal_code: 10,
  write_review: 20,
  share: 5,
  first_favorite: 50, // bonus
  streak_daily: 10,
  streak_7: 50,
  streak_30: 200,
};

const LEVELS = [
  { name: "Explorator", min: 0, icon: "explore" },
  { name: "Econom", min: 100, icon: "account_balance_wallet" },
  { name: "Expert Reduceri", min: 500, icon: "star" },
  { name: "VIP OFAI", min: 1500, icon: "workspace_premium" },
];

const BADGES = {
  first_save: { label: "Prima salvare", description: "Salveaza prima oferta", icon: "bookmark" },
  reviewer: { label: "Recenzent", description: "Scrie prima recenzie", icon: "rate_review" },
  social: { label: "Social Butterfly", description: "Share 5 oferte", icon: "share" },
  loyal: { label: "Fidel", description: "Streak 7 zile", icon: "local_fire_department" },
  collector: { label: "Colectionar", description: "20 oferte salvate", icon: "collections_bookmark" },
  explorer: { label: "Explorator de orase", description: "Oferte din 3 orase", icon: "map" },
  fan: { label: "Fan #1", description: "Urmareste 10 business-uri", icon: "favorite" },
};

async function awardPoints(userId, action, referenceId = null, referenceType = null) {
  const points = POINT_VALUES[action];
  if (!points) return;

  await pool.query(
    `INSERT INTO point_transactions (user_id, action, points, reference_id, reference_type)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, points, referenceId, referenceType]
  );
  await pool.query(
    `UPDATE users SET points = points + $1 WHERE id = $2`,
    [points, userId]
  );
}

async function updateStreak(userId) {
  const result = await pool.query(
    `SELECT last_visit_date, current_streak FROM users WHERE id = $1`,
    [userId]
  );
  if (result.rows.length === 0) return;

  const { last_visit_date, current_streak } = result.rows[0];
  const today = new Date().toISOString().split("T")[0];

  if (last_visit_date === today) return; // Already visited today

  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  let newStreak;

  if (last_visit_date === yesterday) {
    newStreak = (current_streak || 0) + 1;
  } else {
    newStreak = 1;
  }

  await pool.query(
    `UPDATE users SET last_visit_date = $1, current_streak = $2 WHERE id = $3`,
    [today, newStreak, userId]
  );

  // Award streak points
  await awardPoints(userId, "streak_daily");

  // Milestone bonuses
  if (newStreak === 7) await awardPoints(userId, "streak_7");
  if (newStreak === 30) await awardPoints(userId, "streak_30");
}

async function checkBadges(userId) {
  // Returns array of newly unlocked badges
  const unlocked = [];

  // Check each badge condition
  const favCount = await pool.query(`SELECT COUNT(*) FROM favorite_offers WHERE user_id = $1`, [userId]);
  const reviewCount = await pool.query(`SELECT COUNT(*) FROM reviews WHERE user_id = $1`, [userId]);
  const subCount = await pool.query(`SELECT COUNT(*) FROM followed_businesses WHERE user_id = $1`, [userId]);
  const streak = await pool.query(`SELECT current_streak FROM users WHERE id = $1`, [userId]);

  const checks = {
    first_save: parseInt(favCount.rows[0].count) >= 1,
    reviewer: parseInt(reviewCount.rows[0].count) >= 1,
    collector: parseInt(favCount.rows[0].count) >= 20,
    fan: parseInt(subCount.rows[0].count) >= 10,
    loyal: (streak.rows[0]?.current_streak || 0) >= 7,
  };

  for (const [badge, earned] of Object.entries(checks)) {
    if (earned) {
      try {
        const result = await pool.query(
          `INSERT INTO user_badges (user_id, badge_type)
           VALUES ($1, $2)
           ON CONFLICT (user_id, badge_type) DO NOTHING
           RETURNING *`,
          [userId, badge]
        );
        if (result.rows.length > 0) unlocked.push(badge);
      } catch (_) { /* ignore */ }
    }
  }

  return unlocked;
}

function getLevel(points) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (points >= l.min) level = l;
  }
  return level;
}

function getNextLevel(points) {
  for (const l of LEVELS) {
    if (points < l.min) return l;
  }
  return null; // max level
}

module.exports = { awardPoints, updateStreak, checkBadges, getLevel, getNextLevel, BADGES, LEVELS, POINT_VALUES };
```

**Step 2: Add GET /users/me/gamification endpoint**

In `users.js`, add:

```javascript
const { getLevel, getNextLevel, BADGES } = require("../services/gamification");

router.get("/me/gamification", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const userResult = await pool.query(
      `SELECT points, current_streak, last_visit_date FROM users WHERE id = $1`,
      [userId]
    );
    const badgesResult = await pool.query(
      `SELECT badge_type, unlocked_at FROM user_badges WHERE user_id = $1 ORDER BY unlocked_at`,
      [userId]
    );

    const points = userResult.rows[0]?.points || 0;
    const level = getLevel(points);
    const nextLevel = getNextLevel(points);

    res.json({
      points,
      level: level.name,
      level_icon: level.icon,
      next_level: nextLevel ? { name: nextLevel.name, min_points: nextLevel.min } : null,
      current_streak: userResult.rows[0]?.current_streak || 0,
      badges: badgesResult.rows.map(b => ({
        type: b.badge_type,
        ...BADGES[b.badge_type],
        unlocked_at: b.unlocked_at,
      })),
      all_badges: Object.entries(BADGES).map(([type, info]) => ({
        type,
        ...info,
        unlocked: badgesResult.rows.some(b => b.badge_type === type),
      })),
    });
  } catch (err) {
    console.error("Gamification error:", err.message);
    res.status(500).json({ message: "Eroare server" });
  }
});
```

**Step 3: Commit**

```bash
git add appredueri_backend/src/services/gamification.js appredueri_backend/src/routes/users.js
git commit -m "feat: gamification service (points, badges, streak, levels) + API endpoint"
```

---

### Task 18: Backend — Wire gamification into existing actions

**Files:**
- Modify: `appredueri_backend/src/routes/favorites.js` (awardPoints on favorite)
- Modify: `appredueri_backend/src/routes/reviews.js` (awardPoints on review)
- Modify: `appredueri_backend/src/routes/web.js` (awardPoints on web actions)
- Modify: `appredueri_backend/src/middleware/auth.js` (updateStreak on API calls)

**Step 1: Import gamification in relevant route files**

```javascript
const { awardPoints, updateStreak, checkBadges } = require("../services/gamification");
```

**Step 2: Add awardPoints calls**

- In `favorites.js` POST (add favorite): `awardPoints(req.user.id, "favorite", offerId, "offer").catch(() => {});`
- In `reviews.js` POST (create review): `awardPoints(req.user.id, "write_review", businessId, "business").catch(() => {});`
- In `web.js` promo code reveal route: `awardPoints(req.webUser.id, "reveal_code", offerId, "offer").catch(() => {});`

All calls should be fire-and-forget (`.catch(() => {})`) to not block the main response.

**Step 3: Add streak update in auth middleware**

In `auth.js`, after successful token verification, add:

```javascript
updateStreak(req.user.id).catch(() => {});
```

This runs on every authenticated API call, but `updateStreak` short-circuits if already updated today.

**Step 4: Commit**

```bash
git add appredueri_backend/src/routes/favorites.js appredueri_backend/src/routes/reviews.js appredueri_backend/src/routes/web.js appredueri_backend/src/middleware/auth.js
git commit -m "feat: wire gamification points + streak into existing actions"
```

---

### Task 19: Flutter — Gamification UI on AccountScreen

**Files:**
- Modify: `ofai_flutter/lib/screens/account/account_screen.dart`
- Modify: `ofai_flutter/lib/providers/auth_provider.dart` (or create gamification_provider.dart)
- Modify: `ofai_flutter/lib/core/network/api_endpoints.dart`

**Step 1: Add gamification endpoint and provider**

In `api_endpoints.dart`:
```dart
static const String gamification = '/users/me/gamification';
```

Create a provider that fetches gamification data.

**Step 2: Enhance AccountScreen**

The account screen (line 171-211) already has `_StatCard` for points and `_BadgeChip` for badges. Enhance with:

- Level name + icon next to points
- Progress bar to next level
- Streak counter with fire icon
- Badge grid (unlocked = colored, locked = grey with lock icon)

**Step 3: Add streak widget to HomeScreen**

Small pill at the top of HomeScreen: "Zi 5 pe OFAI" with fire icon if streak >= 2.

**Step 4: Run flutter analyze + tests**

```bash
cd ofai_flutter && flutter analyze && flutter test
```

**Step 5: Commit**

```bash
git add ofai_flutter/lib/screens/account/account_screen.dart ofai_flutter/lib/providers/ ofai_flutter/lib/core/network/api_endpoints.dart ofai_flutter/lib/screens/home/home_screen.dart
git commit -m "feat: gamification UI — points, level, streak, badges (Flutter)"
```

---

### Task 20: Web — Gamification display on account page

**Files:**
- Modify: `appredueri_backend/src/views/public/account.ejs`
- Modify: `appredueri_backend/src/routes/web.js` (pass gamification data to account)

**Step 1: Backend — fetch gamification in account route**

In web.js GET `/cont` (account page), query points, streak, badges and pass to EJS.

**Step 2: EJS — add points/level/badges section**

Add a card showing level, points, progress bar, streak, and badge grid before the existing menu items.

**Step 3: Commit**

```bash
git add appredueri_backend/src/views/public/account.ejs appredueri_backend/src/routes/web.js
git commit -m "feat: gamification display on account page (web)"
```

---

### Task 21: Flutter + Web — Personalization improvements

**Files:**
- Modify: `ofai_flutter/lib/screens/home/home_screen.dart` (improved "Pentru tine")
- Modify: `appredueri_backend/src/views/public/home.ejs` (preference-based subtitle)

**Step 1: Flutter — show preferences in "Pentru tine" subtitle**

If user has preferences, show: "Bazat pe: Restaurante, Beauty in Bucuresti". If no preferences, show a CTA card linking to preferences screen.

**Step 2: Web — same treatment**

In `home.ejs`, the "Pentru tine" section should show preference names.

**Step 3: Commit**

```bash
git add ofai_flutter/lib/screens/home/home_screen.dart appredueri_backend/src/views/public/home.ejs
git commit -m "feat: personalization improvements — preferences in feed subtitle"
```

---

### Task 22: Final verification + cleanup

**Step 1: Run full Flutter test suite**

```bash
cd ofai_flutter && flutter analyze && flutter test
```

Expected: 0 errors, all tests pass.

**Step 2: Run backend locally**

```bash
cd appredueri_backend && npm run dev
```

Navigate to localhost:4000 and verify:
- Home page: deal of day section, countdown timers, trending badges, save counts
- Offer detail: activity pills, countdown, limited codes, similar offers
- Business detail: rating breakdown, follower count, verified tooltip
- Account: gamification card (points, level, streak, badges)

**Step 3: Run Flutter on emulator**

```bash
cd ofai_flutter && flutter run
```

Verify same features on mobile.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: platform polish complete — urgency, social proof, personalization, gamification"
```

---

## Summary

| Sprint | Tasks | Features |
|--------|-------|----------|
| **P1** | 1-10 | Migration, save_count + trending queries, countdown timers, deal of day, Flutter model update, OfferCard enhancements, FeaturedOfferCard |
| **P2** | 11-16 | Rating breakdown, follower count, similar offers, limited codes, verified badge tooltip |
| **P3** | 17-21 | Gamification service, points/badges/streak, AccountScreen UI, personalization |
| **Final** | 22 | Verification + cleanup |
