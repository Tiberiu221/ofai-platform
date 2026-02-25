# Offers UX Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify /oferte filters from 4 rows to 2 rows, and upgrade offer detail page from "cheap" to "premium" with card-based sections, dramatic hero, wider layout, and prominent CTA.

**Architecture:** Pure frontend changes — EJS templates + CSS. Zero backend/route modifications. Filter bar collapses cities row and sort row into 2 compact rows. Offer detail gets `.detail-card` namespace for card sections, hero overlay title, wider grid, doubled spacing.

**Tech Stack:** EJS templates, CSS (main.css), vanilla JS (existing). Flutter mirror changes for explore/detail screens.

---

## Part A: /oferte Filter Bar Simplification

### Task 1: Replace filter bar HTML in oferte.ejs

**Files:**
- Modify: `appredueri_backend/src/views/public/oferte.ejs:39-120`

**Step 1: Replace the FILTER BAR section (lines 39-120) with the new 2-row layout**

Replace everything from `<!-- FILTER BAR -->` comment (line 36) through the geo-banner closing div (line 120) with:

```ejs
<!-- ═══════════════════════════════════════════════════════
     FILTER BAR (2-row compact)
     ═══════════════════════════════════════════════════════ -->
<div class="container">
  <!-- Row 1: Preferences toggle + Category chips -->
  <div class="filter-bar-v2">
    <div class="scroll-container">
      <button class="scroll-arrow scroll-arrow-left" aria-label="Scroll stânga">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div class="filter-bar">
        <% if (typeof webUser !== 'undefined' && webUser) { %>
          <% if (typeof userHasPrefs !== 'undefined' && userHasPrefs) { %>
            <a href="/oferte<%= (typeof prefsActive !== 'undefined' && prefsActive) ? (typeof query !== 'undefined' && query ? '?q=' + encodeURIComponent(query) : '') : '?prefs=1' + (typeof query !== 'undefined' && query ? '&q=' + encodeURIComponent(query) : '') %>"
               class="filter-pill filter-pill-prefs<%= (typeof prefsActive !== 'undefined' && prefsActive) ? ' active' : '' %>"
               title="<%= (typeof userPrefsCityNames !== 'undefined' ? userPrefsCityNames : []).concat(typeof userPrefsCategoryNames !== 'undefined' ? userPrefsCategoryNames : []).join(', ') %>">
              🎯 Preferințe
            </a>
          <% } else { %>
            <a href="/preferinte?returnTo=<%= encodeURIComponent('/oferte' + (typeof query !== 'undefined' && query ? '?q=' + encodeURIComponent(query) : '')) %>"
               class="filter-pill filter-pill-prefs filter-pill-disabled"
               title="Setează preferințele din Cont">
              🎯 Preferințe
            </a>
          <% } %>
        <% } %>
        <a href="/oferte<%= query ? '?q=' + encodeURIComponent(query) : '' %>" class="filter-pill<%= !selectedCategory && !(typeof prefsActive !== 'undefined' && prefsActive) ? ' active' : '' %>">Toate</a>
        <% categories.forEach(cat => { %>
          <a href="/oferte?category=<%= cat.id %><%= selectedCity ? '&city=' + selectedCity : '' %><%= query ? '&q=' + encodeURIComponent(query) : '' %><%= selectedSort && selectedSort !== 'newest' ? '&sort=' + selectedSort : '' %>"
             class="filter-pill<%= selectedCategory == cat.id ? ' active' : '' %>">
            <%= cat.name %>
          </a>
        <% }); %>
      </div>
      <button class="scroll-arrow scroll-arrow-right" aria-label="Scroll dreapta">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  </div>

  <!-- Row 2: Sort chips + Reset + City escape hatch -->
  <div class="filter-bar-v2 filter-bar-v2-sort">
    <div class="sort-chips">
      <a href="/oferte?sort=newest<%= selectedCategory ? '&category=' + selectedCategory : '' %><%= selectedCity ? '&city=' + selectedCity : '' %><%= query ? '&q=' + encodeURIComponent(query) : '' %>"
         class="filter-pill filter-pill-sort<%= selectedSort === 'newest' ? ' active' : '' %>">
        🕐 Noi
      </a>
      <a href="/oferte?sort=popular<%= selectedCategory ? '&category=' + selectedCategory : '' %><%= selectedCity ? '&city=' + selectedCity : '' %><%= query ? '&q=' + encodeURIComponent(query) : '' %>"
         class="filter-pill filter-pill-sort<%= selectedSort === 'popular' ? ' active' : '' %>">
        🔥 Populare
      </a>
      <a href="/oferte?sort=discount<%= selectedCategory ? '&category=' + selectedCategory : '' %><%= selectedCity ? '&city=' + selectedCity : '' %><%= query ? '&q=' + encodeURIComponent(query) : '' %>"
         class="filter-pill filter-pill-sort<%= selectedSort === 'discount' ? ' active' : '' %>">
        ↓% Reducere
      </a>
      <a href="/oferte?sort=ending_soon<%= selectedCategory ? '&category=' + selectedCategory : '' %><%= selectedCity ? '&city=' + selectedCity : '' %><%= query ? '&q=' + encodeURIComponent(query) : '' %>"
         class="filter-pill filter-pill-sort<%= selectedSort === 'ending_soon' ? ' active' : '' %>">
        ⏰ Expiră
      </a>
      <button type="button" class="filter-pill filter-pill-sort" id="sort-distance-btn" onclick="sortByDistance()" style="opacity: 0.5;" title="Activează locația">
        📍 Distanță
      </button>
    </div>

    <% const hasActiveFilters = selectedCategory || selectedCity || (typeof prefsActive !== 'undefined' && prefsActive) || (selectedSort && selectedSort !== 'newest'); %>
    <% if (hasActiveFilters) { %>
      <a href="/oferte" class="filter-reset">✕ Resetează</a>
    <% } %>

    <div class="filter-city-escape">
      📍 <%= typeof selectedCityName !== 'undefined' && selectedCityName ? selectedCityName : 'Toate orașele' %>
      · <a href="/preferinte?returnTo=<%= encodeURIComponent('/oferte') %>">Schimbă</a>
    </div>
  </div>

  <!-- Geo Banner (existing) -->
  <div id="geo-banner" class="geo-banner" style="display:none;">
    <div class="geo-banner-content">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      <span id="geo-banner-text">Activează locația pentru a vedea distanța</span>
      <button class="btn btn-primary" id="geo-activate-btn">Activează locația</button>
    </div>
  </div>
```

**Step 2: Verify the template renders**

Run: start backend server, navigate to `localhost:4000/oferte`
Expected: 2-row filter bar renders, categories scroll, sort chips visible

**Step 3: Commit**

```bash
git add appredueri_backend/src/views/public/oferte.ejs
git commit -m "feat(oferte): simplify filter bar from 4 rows to 2 rows"
```

---

### Task 2: Add CSS for the new filter bar v2

**Files:**
- Modify: `appredueri_backend/src/public/css/main.css` — add after existing `.filter-pill-disabled:hover` block (~line 1643)

**Step 1: Add new `.filter-bar-v2` styles**

Insert after line 1643 (after `.filter-pill-disabled:hover` block):

```css
/* ─── FILTER BAR V2 (2-row compact) ───────────────────── */
.filter-bar-v2 {
  margin-bottom: 4px;
}

.filter-bar-v2-sort {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 0 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 28px;
  flex-wrap: wrap;
}

.sort-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-pill-sort {
  padding: 6px 14px;
  font-size: 0.8125rem;
}

.filter-pill-sort.active {
  background: var(--accent);
  color: #09090b;
  border-color: var(--accent);
}

.filter-reset {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  white-space: nowrap;
  transition: color 0.2s ease;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
}

.filter-reset:hover {
  color: var(--danger);
  border-color: var(--danger);
}

.filter-city-escape {
  margin-left: auto;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.filter-city-escape a {
  color: var(--accent);
  font-weight: 500;
  transition: opacity 0.2s ease;
}

.filter-city-escape a:hover {
  opacity: 0.8;
}

@media (max-width: 768px) {
  .filter-bar-v2-sort {
    gap: 8px;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .filter-city-escape {
    width: 100%;
    margin-left: 0;
    padding-top: 4px;
  }
}
```

**Step 2: Verify styles look correct**

Run: preview screenshot at `localhost:4000/oferte`
Expected: Sort chips are compact, reset link visible, city escape hatch on the right, clean 2-row layout

**Step 3: Commit**

```bash
git add appredueri_backend/src/public/css/main.css
git commit -m "style(oferte): add filter-bar-v2 CSS for 2-row compact layout"
```

---

## Part B: Offer Detail — Breathe & Highlight

### Task 3: Hero overlay — title + business over image

**Files:**
- Modify: `appredueri_backend/src/views/public/offer-detail.ejs:50-67` (hero CSS) and `:829-865` (hero HTML)

**Step 1: Update hero CSS (inside the `<style>` block, lines 50-67)**

Replace the `.offer-detail-hero-inner` block:

```css
  .offer-detail-hero-inner {
    position: relative;
    width: 100%;
    min-height: 400px;
    border-radius: var(--radius-xl);
    overflow: hidden;
    border: 1px solid var(--border);
  }
```

Update `.offer-detail-hero-gradient`:

```css
  .offer-detail-hero-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(6, 6, 10, 0.95) 0%, rgba(6, 6, 10, 0.6) 35%, rgba(6, 6, 10, 0.15) 70%, transparent 100%);
    pointer-events: none;
  }
```

Add hero overlay text styles (after `.offer-detail-hero-gradient`):

```css
  .offer-detail-hero-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 32px;
    z-index: 2;
  }

  .offer-detail-hero-overlay h1 {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 400;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: #fff;
    text-shadow: 0 2px 12px rgba(0,0,0,0.5);
    margin-bottom: 8px;
  }

  .offer-detail-hero-overlay .hero-business-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--accent);
    text-shadow: 0 1px 8px rgba(0,0,0,0.4);
    transition: opacity 0.2s ease;
  }

  .offer-detail-hero-overlay .hero-business-link:hover {
    opacity: 0.8;
  }
```

Update `.offer-detail-hero .offer-badge` to be bigger:

```css
  .offer-detail-hero .offer-badge {
    position: relative;
    top: auto;
    right: auto;
    padding: 12px 24px;
    border-radius: var(--radius-sm);
    background: var(--accent);
    color: var(--bg-primary);
    font-weight: 700;
    font-size: 1.5rem;
    z-index: 2;
    box-shadow: 0 4px 16px rgba(251, 146, 60, 0.35);
  }
```

**Step 2: Update hero HTML (lines 829-865)**

Replace the hero section with title + business overlaid on the image:

```ejs
<section class="offer-detail-hero">
  <div class="offer-detail-hero-inner">
    <% if (offer.image_url) { %>
      <div class="offer-detail-hero-bg" style="background-image: url('<%= offer.image_url %>');"></div>
    <% } else { %>
      <div class="offer-detail-hero-bg" style="background: linear-gradient(135deg, rgba(251,146,60,0.15) 0%, var(--bg-surface) 100%);"></div>
    <% } %>
    <div class="offer-detail-hero-gradient"></div>

    <div class="offer-detail-hero-actions">
      <div class="offer-badge">
        <% if (offer.discount_type === 'percent' || offer.discount_type === 'percentage') { %>
          -<%= offer.discount_value %>%
        <% } else { %>
          -<%= offer.discount_value %> lei
        <% } %>
      </div>
      <button
        class="bookmark-btn<%= isFavorite ? ' is-favorited' : '' %>"
        data-offer-id="<%= offer.id %>"
        data-favorited="<%= isFavorite ? 'true' : 'false' %>"
        onclick="window.toggleFavorite(<%= offer.id %>)"
        aria-label="Adaugă la favorite"
      >
        <span class="heart-outline">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </span>
        <span class="heart-filled">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </span>
      </button>
      <button class="share-btn" onclick="trackClick(<%= offer.business.id %>,'share',<%= offer.id %>); window.shareOffer('<%= offer.title %>', '<%= offer.business.name %>')" aria-label="Distribuie oferta">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      </button>
    </div>

    <!-- Title + Business overlaid on hero -->
    <div class="offer-detail-hero-overlay">
      <h1><%= offer.title %></h1>
      <a href="/business/<%= offer.business.id %>" class="hero-business-link">
        <%= offer.business.name %>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
      </a>
    </div>
  </div>
</section>
```

**Step 3: Remove the duplicate h1 and business link from the main content area**

In the left column (line 873-879), remove:
- The `<h1><%= offer.title %></h1>` (now in hero overlay)
- The `<a href="/business/..." class="offer-detail-business-link">` block (now in hero overlay)

Keep everything from the badges section (`.offer-detail-badges`) onward.

**Step 4: Verify hero renders with title overlay**

Run: preview screenshot of an offer detail page
Expected: Title and business name overlaid on hero image with gradient, badge is 1.5rem

**Step 5: Commit**

```bash
git add appredueri_backend/src/views/public/offer-detail.ejs
git commit -m "feat(detail): hero overlay with title, business link, bigger badge"
```

---

### Task 4: Wider layout + doubled spacing

**Files:**
- Modify: `appredueri_backend/src/views/public/offer-detail.ejs` — CSS section

**Step 1: Update content layout CSS (lines 151-159)**

Replace `.offer-detail-content`:

```css
  .offer-detail-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 48px var(--container-px) 80px;
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 48px;
    align-items: start;
  }
```

**Step 2: Update responsive breakpoints**

Replace `@media (max-width: 1024px)` block:

```css
  @media (max-width: 1024px) {
    .offer-detail-content {
      grid-template-columns: 1fr 320px;
      gap: 36px;
    }
  }
```

Replace `@media (max-width: 768px)` block — add wider mobile padding:

```css
  @media (max-width: 768px) {
    .breadcrumb {
      padding-top: 88px;
    }

    .offer-detail-hero-inner {
      min-height: 280px;
      border-radius: var(--radius-lg);
    }

    .offer-detail-hero-overlay {
      padding: 20px;
    }

    .offer-detail-hero-overlay h1 {
      font-size: 1.5rem;
    }

    .offer-detail-content {
      grid-template-columns: 1fr;
      gap: 32px;
      padding-top: 28px;
      padding-bottom: 60px;
      padding-left: 20px;
      padding-right: 20px;
    }

    .business-sidebar-card {
      position: static;
    }

    .offer-detail-hero-actions {
      top: 12px;
      right: 12px;
      gap: 8px;
    }

    .offer-detail-hero .offer-badge {
      padding: 8px 16px;
      font-size: 1.125rem;
    }

    .bookmark-btn {
      width: 40px;
      height: 40px;
    }
  }
```

**Step 3: Increase description font & line-height**

Update `.offer-detail-description` (line ~232):

```css
  .offer-detail-description {
    font-size: 1rem;
    line-height: 1.8;
    color: var(--text-secondary);
    white-space: pre-wrap;
    margin-bottom: 48px;
  }
```

**Step 4: Verify layout is wider and more spacious**

Run: preview screenshot on desktop
Expected: Content area wider (1200px), gap 48px between columns, description more readable

**Step 5: Commit**

```bash
git add appredueri_backend/src/views/public/offer-detail.ejs
git commit -m "style(detail): wider layout 1200px, doubled spacing, bigger text"
```

---

### Task 5: Card-based sections — Period, Promo Code, Locations, Conditions, How-to

**Files:**
- Modify: `appredueri_backend/src/views/public/offer-detail.ejs` — CSS + HTML

**Step 1: Add `.detail-card` CSS namespace**

Add to the `<style>` block (after the `.offer-detail-description` styles):

```css
  /* ─── DETAIL CARDS ──────────────────────────────────── */
  .detail-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 24px;
    margin-bottom: 32px;
  }

  .detail-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 16px;
  }

  .detail-card-header svg {
    color: var(--accent);
    flex-shrink: 0;
  }

  .detail-card-header .detail-card-badge {
    margin-left: auto;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: var(--radius-full);
    background: rgba(34, 197, 94, 0.12);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.2);
  }

  .detail-card-header .detail-card-badge-exclusive {
    background: rgba(251, 146, 60, 0.12);
    color: var(--accent);
    border-color: rgba(251, 146, 60, 0.2);
  }

  /* Period card progress bar */
  .detail-period-bar {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.06);
    margin-top: 12px;
    overflow: hidden;
  }

  .detail-period-bar-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--accent);
    transition: width 0.6s ease;
  }

  .detail-period-text {
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    margin-top: 6px;
  }

  /* Promo card glow */
  .detail-card-promo {
    border-color: rgba(251, 146, 60, 0.25);
    background: linear-gradient(135deg, rgba(251,146,60,0.06) 0%, var(--bg-card) 100%);
    box-shadow: 0 0 40px rgba(251, 146, 60, 0.08);
  }

  .detail-card-promo .promo-reveal-btn {
    width: 100%;
    justify-content: center;
    padding: 14px 20px;
    font-size: 1rem;
  }

  .detail-card-promo .promo-code-placeholder {
    border: none;
    background: none;
    padding: 0;
  }

  .detail-scarcity-bar {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: rgba(255,255,255,0.06);
    margin-top: 12px;
  }

  .detail-scarcity-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: linear-gradient(90deg, var(--accent), #ef4444);
  }

  .detail-scarcity-text {
    text-align: center;
    font-size: 0.8125rem;
    color: var(--text-tertiary);
    margin-top: 8px;
  }
```

**Step 2: Wrap the period/date section in a detail-card**

Replace the `.offer-detail-info-row` section (lines ~919-934) with:

```ejs
    <% if (_validStart || _validEnd) { %>
    <div class="detail-card">
      <div class="detail-card-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Perioadă
        <% if (_validEnd) { %>
          <% var _daysLeft = Math.ceil((new Date(offer.end_date) - new Date()) / 86400000); %>
          <% if (_daysLeft > 0) { %>
            <span class="detail-card-badge">Activă</span>
          <% } else { %>
            <span class="detail-card-badge" style="background: rgba(239,68,68,0.12); color: #ef4444; border-color: rgba(239,68,68,0.2);">Expirată</span>
          <% } %>
        <% } %>
      </div>
      <div style="font-size: 0.9375rem; color: var(--text-secondary);">
        <% if (_validStart && _validEnd) { %>
          <strong style="color: var(--text-primary);"><%= _startD.toLocaleDateString('ro-RO', _dateOpts) %></strong>
          —
          <strong style="color: var(--text-primary);"><%= _endD.toLocaleDateString('ro-RO', _dateOpts) %></strong>
        <% } else if (_validEnd) { %>
          Până la <strong style="color: var(--text-primary);"><%= _endD.toLocaleDateString('ro-RO', _dateOpts) %></strong>
        <% } else { %>
          Din <strong style="color: var(--text-primary);"><%= _startD.toLocaleDateString('ro-RO', _dateOpts) %></strong>
        <% } %>
      </div>
      <% if (_validStart && _validEnd) { %>
        <% var _totalDays = Math.ceil((_endD - _startD) / 86400000); var _elapsed = Math.ceil((new Date() - _startD) / 86400000); var _pct = Math.min(100, Math.max(0, Math.round((_elapsed / _totalDays) * 100))); %>
        <div class="detail-period-bar"><div class="detail-period-bar-fill" style="width: <%= _pct %>%;"></div></div>
        <% var _dLeft = Math.ceil((_endD - new Date()) / 86400000); %>
        <% if (_dLeft > 0) { %>
          <div class="detail-period-text">Expiră în <%= _dLeft %> zile</div>
        <% } %>
      <% } %>
    </div>
    <% } %>
```

**Step 3: Wrap promo code in a detail-card**

Replace the entire `.promo-code-section` div (lines ~989-1038) with:

```ejs
    <% if (offer.has_promo_code) { %>
      <div class="detail-card detail-card-promo" id="promo-code-section">
        <div class="detail-card-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          Cod promoțional
          <span class="detail-card-badge detail-card-badge-exclusive">EXCLUSIV</span>
        </div>

        <% if (!webUser) { %>
          <div class="promo-code-placeholder">
            <span class="promo-code-blur">XXXXXXXX</span>
          </div>
          <div style="text-align: center; margin-top: 12px;">
            <div class="promo-login-hint">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <a href="/login?returnTo=/oferta/<%= offer.id %>">Conectează-te</a> sau <a href="/register?returnTo=/oferta/<%= offer.id %>">creează cont gratuit</a>
            </div>
          </div>
        <% } else { %>
          <% var codesExhausted = offer.max_reveals && (parseInt(offer.max_reveals) - parseInt(offer.reveal_count || 0)) <= 0; %>
          <div class="promo-code-placeholder" id="promo-code-container">
            <span class="promo-code-blur" id="promo-code-text">XXXXXXXX</span>
            <% if (codesExhausted) { %>
              <button class="promo-reveal-btn" disabled style="opacity: 0.5; cursor: not-allowed;">Coduri epuizate</button>
            <% } else { %>
              <button class="promo-reveal-btn" id="promo-reveal-btn" onclick="revealPromoCode(<%= offer.id %>)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Dezvăluie codul promo
              </button>
            <% } %>
          </div>
          <% if (offer.max_reveals) { %>
            <% var remaining = Math.max(0, parseInt(offer.max_reveals) - parseInt(offer.reveal_count || 0)); var pctUsed = Math.round((parseInt(offer.reveal_count || 0) / parseInt(offer.max_reveals)) * 100); %>
            <div class="detail-scarcity-bar"><div class="detail-scarcity-bar-fill" style="width: <%= pctUsed %>%;"></div></div>
            <div class="detail-scarcity-text">
              <% if (remaining === 0) { %>
                Codurile s-au epuizat
              <% } else { %>
                doar <%= remaining %> coduri rămase din <%= offer.max_reveals %>
              <% } %>
            </div>
          <% } %>
        <% } %>
      </div>
    <% } %>
```

**Step 4: Wrap conditions in a detail-card (replace the accordion)**

Replace the `<details class="offer-conditions-accordion">` block (lines ~1046-1056) with:

```ejs
    <% if (offer.conditions) { %>
      <div class="detail-card">
        <div class="detail-card-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Condiții
        </div>
        <p style="font-size: 0.9375rem; line-height: 1.7; color: var(--text-secondary); white-space: pre-wrap;"><%= offer.conditions %></p>
      </div>
    <% } %>
```

**Step 5: Wrap redemption info in a detail-card**

Replace `<div class="redemption-info reveal">` (line ~957) opening tag with:

```ejs
    <div class="detail-card">
```

And update the header inside from `.redemption-title` to `.detail-card-header`:

```ejs
      <div class="detail-card-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/></svg>
        Cum profiți de ofertă?
      </div>
```

**Step 6: Wrap locations section in a detail-card**

Replace `.offer-locations-section` (line ~1059) opening `<div>` with:

```ejs
      <div class="detail-card">
```

Update the `<h2>` to use `.detail-card-header`:

```ejs
        <div class="detail-card-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Locații (<%= offer.locations.length %>)
        </div>
```

**Step 7: Verify all cards render**

Run: preview offer detail page
Expected: Period, Promo Code (with glow), Conditions, How-to, and Locations all render as distinct cards with proper spacing

**Step 8: Commit**

```bash
git add appredueri_backend/src/views/public/offer-detail.ejs
git commit -m "feat(detail): card-based sections with .detail-card namespace"
```

---

### Task 6: Business sidebar upgrade

**Files:**
- Modify: `appredueri_backend/src/views/public/offer-detail.ejs` — sidebar CSS + HTML

**Step 1: Update sidebar CSS**

Update `.business-sidebar-logo` (line ~504):

```css
  .business-sidebar-logo {
    width: 80px;
    height: 80px;
    border-radius: var(--radius-md);
    margin: 0 auto 16px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--bg-surface);
    display: flex;
    align-items: center;
    justify-content: center;
  }
```

Update `.business-sidebar-card` to add shadow on sticky:

```css
  .business-sidebar-card {
    position: sticky;
    top: 100px;
    padding: 32px 28px;
    border-radius: var(--radius-lg);
    background: var(--bg-card);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border);
    text-align: center;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }
```

Update `.business-sidebar-cta` to be more prominent:

```css
  .business-sidebar-cta {
    display: block;
    width: 100%;
    padding: 14px 20px;
    border-radius: var(--radius-sm);
    background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
    border: 1px solid var(--border-hover);
    color: var(--text-primary);
    font-weight: 600;
    font-size: 0.9375rem;
    text-align: center;
    transition: all 0.3s var(--ease-smooth);
  }

  .business-sidebar-cta:hover {
    background: linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.08));
    border-color: var(--accent);
    color: var(--accent);
    transform: translateY(-1px);
  }
```

**Step 2: Update sidebar logo img width/height to 80px**

In the HTML (line ~1118), change `width="72" height="72"` to `width="80" height="80"`.

**Step 3: Verify sidebar**

Run: preview offer detail — check sidebar is sticky with shadow, logo 80px, CTA more prominent
Expected: Card feels more substantial with shadow, logo larger

**Step 4: Commit**

```bash
git add appredueri_backend/src/views/public/offer-detail.ejs
git commit -m "style(detail): upgrade business sidebar — bigger logo, shadow, prominent CTA"
```

---

### Task 7: Remove old unused CSS (cleanup)

**Files:**
- Modify: `appredueri_backend/src/views/public/offer-detail.ejs` — `<style>` block

**Step 1: Remove old styles that are replaced by detail-card**

Remove these CSS blocks that are no longer used:
- `.offer-detail-info-row` + children (replaced by detail-card period)
- `.offer-conditions-accordion` + children (replaced by detail-card conditions)
- `.redemption-info` + children (replaced by detail-card)
- `.promo-code-section` + `::before` (replaced by detail-card-promo)
- `.promo-code-header` (replaced by detail-card-header)
- Old `.offer-detail-main h1` (now in hero overlay)
- `.offer-detail-business-link` (now in hero overlay)

Keep: `.promo-code-blur`, `.promo-reveal-btn`, `.promo-copy-btn`, `.promo-login-hint`, `.promo-code-revealed-row`, `.promo-code-placeholder` — these are still used inside the detail-card.

**Step 2: Verify nothing is visually broken**

Run: preview offer detail + verify no missing styles

**Step 3: Commit**

```bash
git add appredueri_backend/src/views/public/offer-detail.ejs
git commit -m "refactor(detail): remove replaced CSS blocks"
```

---

## Part C: Flutter Mirror (Optional / Lower Priority)

### Task 8: Flutter explore screen — simplify filter chips

**Files:**
- Modify: `ofai_flutter/lib/screens/explore/explore_screen.dart`

**Step 1: Identify the filter section in the build method**

The filter chips in explore_screen.dart use separate rows for categories, cities, and sort. Simplify to match web: merge into 2 rows (categories + sort).

**Step 2: Update sort chips to show emoji icons**

In the sort section of the explore screen, update chip labels:
- "Cele mai noi" → "🕐 Noi"
- "Populare" → "🔥 Populare"
- "Reducere mare" → "↓% Reducere"
- "Expiră curând" → "⏰ Expiră"

**Step 3: Run flutter analyze**

Run: `"C:/dev/flutter/bin/flutter.bat" analyze`
Expected: No new errors (only pre-existing infos)

**Step 4: Commit**

```bash
git add ofai_flutter/lib/screens/explore/explore_screen.dart
git commit -m "feat(flutter): compact sort chips with icons in explore screen"
```

---

### Task 9: Flutter offer detail — increase spacing

**Files:**
- Modify: `ofai_flutter/lib/screens/offer/offer_detail_screen.dart`

**Step 1: Increase SizedBox heights between sections**

Find `SizedBox(height: 16)` or `SizedBox(height: 24)` between major sections and increase to `SizedBox(height: 32)` or `SizedBox(height: 40)`.

**Step 2: Wrap key sections in Card widgets**

Wrap the period info, promo code, conditions, and locations in `Card` widgets with:
- `color: AppColors.bgSecondary`
- `shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: AppColors.border))`
- `child: Padding(padding: EdgeInsets.all(20), child: ...)`

**Step 3: Run flutter analyze**

Run: `"C:/dev/flutter/bin/flutter.bat" analyze`
Expected: No new errors

**Step 4: Commit**

```bash
git add ofai_flutter/lib/screens/offer/offer_detail_screen.dart
git commit -m "style(flutter): card sections + doubled spacing on offer detail"
```

---

## Part D: Final Verification

### Task 10: Full verification + single feature commit

**Step 1: Start backend and verify all pages**

Run: start server, check:
- `/oferte` — 2-row filters, sort chips with icons, reset link, city escape hatch
- `/oferta/:id` — hero with title overlay, wider layout, card sections, prominent CTA, sidebar with shadow
- Mobile responsive — filters wrap, cards stack, CTA full-width

**Step 2: Run flutter analyze**

Run: `"C:/dev/flutter/bin/flutter.bat" analyze`
Expected: No new errors

**Step 3: Squash into single feature commit (if using multiple commits)**

OR keep individual commits — user preference.

---

## Risk Mitigation Summary

| Risk | Mitigation | Verification |
|------|-----------|-------------|
| EJS syntax error breaks page | Edit section-by-section, preview after each | Preview screenshot after each task |
| CSS specificity conflicts | `.detail-card` + `.filter-bar-v2` namespaces | Visual check desktop + mobile |
| Hero text unreadable on light images | Strong gradient (95% bottom) + text-shadow | Test with various offer images |
| Sort chip emojis rendering | Using standard Unicode emojis, supported everywhere | Cross-browser check |
| Mobile layout breaks | Explicit responsive rules for each new class | Mobile preview at 375px width |

## Files Changed Summary

| File | Tasks | Risk |
|------|-------|------|
| `src/views/public/oferte.ejs` | 1 | MEDIUM |
| `src/public/css/main.css` | 2 | MEDIUM |
| `src/views/public/offer-detail.ejs` | 3, 4, 5, 6, 7 | HIGH — edit carefully |
| `ofai_flutter/lib/screens/explore/explore_screen.dart` | 8 | LOW |
| `ofai_flutter/lib/screens/offer/offer_detail_screen.dart` | 9 | LOW |
| Backend routes (web.js) | NONE | ZERO |
| Database | NONE | ZERO |
