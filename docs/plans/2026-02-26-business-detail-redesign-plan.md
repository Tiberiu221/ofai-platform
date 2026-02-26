# Business Detail Page Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign business detail page from cramped 2-column layout to premium single-column "Editorial Magazine" with card sections, consistent with offer detail redesign.

**Architecture:** Reuse `.detail-card` CSS (extract from offer-detail to main.css), restructure business-detail.ejs to single column 900px, wrap all sections in cards, reorder sections, convert gallery to horizontal strip. Flutter mirror for business detail.

**Tech Stack:** EJS templates, CSS (main.css + inline), Flutter/Dart

---

### Task 1: Extract `.detail-card` CSS to main.css

**Files:**
- Modify: `appredueri_backend/src/public/css/main.css` (append after BD styles ~line 2900+)
- Modify: `appredueri_backend/src/views/public/offer-detail.ejs` (remove inline `.detail-card` CSS)

**What:** The `.detail-card` styles are currently inline in offer-detail.ejs. Extract them to main.css so both pages can share them.

**Step 1:** Copy the entire `.detail-card` block from offer-detail.ejs (lines 230-330 approx — `.detail-card`, `.detail-card-header`, `.detail-card-badge`, `.detail-card-badge-exclusive`, `.detail-period-bar`, `.detail-period-bar-fill`, `.detail-period-text`, `.detail-card-promo`, `.detail-scarcity-bar`, `.detail-scarcity-bar-fill`, `.detail-scarcity-text`) and append to end of main.css under a new comment `/* ─── DETAIL CARDS (shared) ─── */`.

**Step 2:** Remove the same block from offer-detail.ejs inline `<style>`.

**Step 3:** Verify offer detail page still renders correctly.

**Risk:** LOW — CSS moves from inline to external, same specificity.

---

### Task 2: Restructure layout — single column 900px

**File:** `appredueri_backend/src/public/css/main.css` (BD section)

**What:** Change `.bd-header-layout` from 2-column grid to single column, add max-width.

**CSS changes:**
- `.bd-header-layout`: Remove `grid-template-columns: 1fr 1fr; gap: 40px;`. Add `max-width: 900px; margin: 0 auto; display: flex; flex-direction: column;`
- Remove `.bd-header-right` padding-top
- Add new `.bd-content` class: `max-width: 900px; margin: 0 auto; padding: 0 var(--container-px);`
- `.bd-section-compact`: Change padding from 24px to `48px 0`, remove `margin-bottom: 40px`
- Add spacing: `.bd-section-compact + .bd-section-compact { margin-top: 0; }` (gap handled by padding)

**Responsive (768px):**
- `.bd-content`: `padding: 0 20px;`
- `.bd-section-compact`: `padding: 32px 0;`

**Risk:** MEDIUM — layout change affects all sections. Must verify nothing breaks.

---

### Task 3: Restructure profile — premium left-aligned

**File:** `appredueri_backend/src/views/public/business-detail.ejs` (lines 42-147)

**What:** Keep the left-aligned avatar + info structure (it's already left-aligned!). Changes:
- Add border on avatar for hero cut-out effect
- Add verified badge glow
- Remove rating breakdown from profile (move to reviews in Task 7)
- Clean up inline styles

**CSS changes in main.css:**
- `.bd-avatar`: Add `border: 3px solid var(--bg-primary);` for cut-out effect, `margin-top: -40px` for hero overlap
- `.verified-badge`: Add `filter: drop-shadow(0 0 6px rgba(251, 146, 60, 0.4));`
- `.bd-business-name`: Change to `font-family: var(--font-display); font-size: 1.75rem;`

**HTML change:** Remove the rating breakdown block (lines 81-99) — will be re-added in Reviews section (Task 7).

**Risk:** LOW — profile structure stays the same, just visual polish + breakdown removal.

---

### Task 4: Reorder sections + wrap in detail-cards

**File:** `appredueri_backend/src/views/public/business-detail.ejs`

**What:** Move HTML sections to new order and wrap each in `.detail-card`:

**New order (after profile closes):**
1. Oferte Active (currently lines 252-377) — wrap inner content in `.detail-card`
2. Locatii (currently lines 417-476) — wrap in `.detail-card`, remove `background: var(--bg-secondary)`
3. Sumar AI (currently lines 382-398) — restyle as `.detail-card` with accent tint
4. Despre (currently lines 403-412) — wrap in `.detail-card`
5. Galerie (currently in header-right, lines 198-234) — move here, convert to strip
6. Recenzii (currently lines 481-578) — wrap in `.detail-card`, add breakdown

**For each section, use this pattern:**
```html
<div class="bd-content">
  <div class="detail-card">
    <div class="detail-card-header">
      <svg>...</svg>
      <span>Section Title</span>
      <span class="detail-card-badge">Count</span>
    </div>
    <!-- section content -->
  </div>
</div>
```

**Oferte card header:** Tag icon + "Oferte active" + count badge
**Locatii card header:** Pin icon + "Locatii" + count badge
**Sumar AI card:** Sparkle icon + "Ce spun clientii" + accent tint bg `rgba(251,146,60,0.04)`
**Despre card header:** Info icon + "Despre [Business Name]"
**Galerie card header:** Camera icon + "Galerie" + count badge
**Recenzii card header:** Star icon + "Recenzii" + count badge + "Scrie o recenzie" btn right

**Risk:** HIGH — large HTML restructure. Must preserve all JS IDs and onclick handlers.

**Critical to preserve:**
- `id="reviews-section"` on reviews section
- `id="review-form"`, `id="toggle-review-form"`, `id="submit-review"`, `id="review-comment"` for review form JS
- `id="gallery-modal"`, `id="gallery-main-img"`, `id="gallery-idx"` for lightbox JS
- All `onclick="trackClick(...)"` handlers
- All `onclick="requestOffer(...)"` handlers
- All `onclick="toggleFollow(...)"` handlers
- `data-business-id` attributes
- `.follow-btn` class for follow toggle JS

---

### Task 5: Convert gallery to horizontal scroll strip

**File:** `appredueri_backend/src/views/public/business-detail.ejs` + `main.css`

**What:** Replace 2x2 grid (`.bd-gallery-compact-grid`) with horizontal scroll strip.

**New HTML (inside the Galerie detail-card):**
```html
<div class="bd-gallery-strip">
  <% business.images.forEach((img, i) => { %>
    <button class="bd-gallery-strip-item" onclick="trackClick(<%= business.id %>,'gallery'); openGallery(<%= i %>)">
      <img src="<%= img.url %>" alt="..." width="200" height="150" loading="lazy">
    </button>
  <% }); %>
</div>
```

**New CSS:**
```css
.bd-gallery-strip {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}
.bd-gallery-strip::-webkit-scrollbar { height: 4px; }
.bd-gallery-strip::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
.bd-gallery-strip-item {
  flex-shrink: 0;
  width: 200px;
  height: 150px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: none;
  cursor: pointer;
  scroll-snap-align: start;
  transition: transform 0.2s ease;
}
.bd-gallery-strip-item:hover { transform: scale(1.03); }
.bd-gallery-strip-item img { width: 100%; height: 100%; object-fit: cover; }
```

**Keep:** The lightbox modal HTML stays exactly as-is (just moved to after the strip).

**Remove CSS:** `.bd-gallery-compact-grid`, `.bd-gallery-compact-item`, `.bd-gallery-more-overlay`, `.bd-gallery-compact-title`

**Risk:** MEDIUM — gallery JS (openGallery, closeGallery, galleryNext, galleryPrev) uses index from onclick. As long as we pass the same index, it works.

---

### Task 6: Remove orphaned CSS

**File:** `appredueri_backend/src/public/css/main.css`

**Remove these BD classes (no longer used after restructure):**
- `.bd-header-layout` grid properties (replaced by single column)
- `.bd-header-left`, `.bd-header-right` (no longer 2-col)
- `.bd-gallery-compact-grid`, `.bd-gallery-compact-item`, `.bd-gallery-compact-item:hover`, `.bd-gallery-compact-item img`
- `.bd-gallery-more-overlay`
- `.bd-gallery-compact-title`
- `.bd-booking-inline` (booking card now inline in profile, doesn't need wrapper)

**DO NOT remove (still used):**
- All `.bd-breadcrumb`, `.bd-hero`, `.bd-avatar`, `.bd-profile-*`, `.bd-business-name`, `.bd-rating-*`, `.bd-badges`, `.bd-badge`
- `.bd-section-compact`, `.bd-section-header`, `.bd-section-title`, `.bd-count-badge`
- `.bd-actions`, `.bd-action-btn`
- `.bd-profile-actions`, `.bd-share-btn`, `.bd-follow-btn`
- `.bd-locations-grid`, `.booking-card`, `.bc-*` (booking card children)
- `.bd-reviews-list`, `.review-card`, `.rc-*`, `.rf-*` (review form)
- `.bd-description`
- `.bd-empty-state`

**Risk:** MEDIUM — must verify each class is truly orphaned before removing.

---

### Task 7: Move rating breakdown to Reviews section

**File:** `appredueri_backend/src/views/public/business-detail.ejs`

**What:** The rating breakdown (5-star bars) was removed from profile in Task 3. Now add it inside the Reviews `.detail-card`, between the header and the review form.

**HTML (inside reviews card, after header):**
```html
<% if (parseInt(business.rating_count) >= 3 && business.rating_distribution && business.rating_distribution.length > 0) { %>
<div class="bd-rating-breakdown">
  <!-- same breakdown code as was in profile, but with proper CSS classes instead of inline styles -->
</div>
<% } %>
```

**New CSS (in main.css):**
```css
.bd-rating-breakdown {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}
.bd-rating-breakdown-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  line-height: 1.8;
}
.bd-rating-breakdown-label {
  width: 16px;
  text-align: right;
  color: var(--text-tertiary);
}
.bd-rating-breakdown-bar {
  flex: 1;
  height: 6px;
  background: rgba(255,255,255,0.06);
  border-radius: 3px;
  overflow: hidden;
}
.bd-rating-breakdown-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.6s ease;
}
.bd-rating-breakdown-pct {
  width: 32px;
  color: var(--text-tertiary);
  font-size: 0.6875rem;
}
```

**Risk:** LOW — pure HTML/CSS move, no JS involved.

---

### Task 8: Flutter business detail — spacing + cards + breakdown move

**File:** `ofai_flutter/lib/screens/business/business_detail_screen.dart`

**Changes:**
1. Increase inter-section `SizedBox` spacing from `AppSpacing.xxl` (24px) to `const SizedBox(height: 40)`
2. Wrap contact section in Container with border (like offer detail)
3. Wrap locations section in Container with border
4. Move `_RatingBreakdown` widget from profile area to reviews section
5. Add border to any section Container that only has `bgSecondary`

**Risk:** LOW — visual changes only.

---

### CHECKPOINT: Verify

1. Start backend via `preview_start`
2. Navigate to `/business/:id` with a business that has: offers, images, reviews, locations, description
3. **Desktop screenshot (1400px):** Verify single column, all detail-cards, profile, gallery strip
4. **Mobile screenshot (375px):** Verify stacking, no horizontal overflow
5. **Test interactions:** Follow button, share, review form toggle, gallery lightbox
6. **Console errors:** Must be zero
7. **Run:** `"C:/dev/flutter/bin/flutter.bat" analyze` — no new errors
8. Verify offer detail page still works (detail-card CSS moved to main.css)

---

## Execution Batches

```
Batch 1: Tasks 1-3 (CSS extract + layout + profile)
  → CHECKPOINT: preview offer detail still works + business layout changed

Batch 2: Tasks 4-5 (section reorder + gallery convert)
  → CHECKPOINT: preview all sections render in new order

Batch 3: Tasks 6-7 (orphaned CSS + breakdown move)
  → CHECKPOINT: preview nothing broke

Batch 4: Task 8 (Flutter)
  → CHECKPOINT: flutter analyze

Commit all as one feature commit.
```

## Files Summary

| File | Tasks |
|------|-------|
| `appredueri_backend/src/public/css/main.css` | 1, 2, 5, 6, 7 |
| `appredueri_backend/src/views/public/business-detail.ejs` | 3, 4, 5, 7 |
| `appredueri_backend/src/views/public/offer-detail.ejs` | 1 (remove inline CSS) |
| `ofai_flutter/lib/screens/business/business_detail_screen.dart` | 8 |

**Zero backend/route/database changes.**
