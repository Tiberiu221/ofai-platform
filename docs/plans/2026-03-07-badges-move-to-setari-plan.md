# Badges Move to /setari — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move badge gallery from /cont to /setari, showing all badges (earned + locked) with display badge selection, and fix the rectangular glow to circle-only.

**Architecture:** Remove badges section from account.ejs, add it to setari.ejs with full badge catalogue from DB. Backend fetches both userBadges and allBadges for /setari. CSS fix removes rectangular background glow, adds .badge-locked class.

**Tech Stack:** EJS templates, Express routes, CSS, vanilla JS (no new dependencies)

**Design doc:** `docs/plans/2026-03-07-badges-move-to-setari-design.md`

---

### Task 1: Fix getAllBadgeDefinitions to include `id`

**Files:**
- Modify: `appredueri_backend/src/services/badgeService.js:193-206`

**Step 1: Add `id` to the SELECT in getAllBadgeDefinitions**

The current query selects `slug, name, description, icon, color, category, sort_order` but omits `id`. We need `id` for the badge selection click handler.

```javascript
async function getAllBadgeDefinitions() {
  const result = await pool.query(
    `SELECT id,
            slug,
            name,
            description,
            icon,
            color,
            category,
            sort_order
     FROM badge_definitions
     ORDER BY sort_order`
  );
  return result.rows;
}
```

**Step 2: Verify server starts**

Run: start backend, check no errors in console.

---

### Task 2: Update /setari route to fetch badge data

**Files:**
- Modify: `appredueri_backend/src/routes/web.js:1472-1490`

**Step 1: Add badge imports and queries to the /setari route**

Replace the entire route handler:

```javascript
router.get("/setari", requireWebAuth, async (req, res) => {
  try {
    const { getUserBadges, getAllBadgeDefinitions } = require("../services/badgeService");

    const [userRes, userBadges, allBadges] = await Promise.all([
      pool.query(
        "SELECT show_picture_in_reviews, google_id FROM users WHERE id = $1",
        [req.webUser.id]
      ),
      getUserBadges(req.webUser.id).catch(err => {
        console.error("[Web] Badges fetch error:", err.message);
        return [];
      }),
      getAllBadgeDefinitions().catch(err => {
        console.error("[Web] All badges fetch error:", err.message);
        return [];
      }),
    ]);

    const userSettings = userRes.rows[0] || {};

    res.render("public/setari", {
      activePage: "setari",
      webUser: req.webUser,
      showPictureInReviews: userSettings.show_picture_in_reviews !== false,
      isGoogleUser: !!userSettings.google_id,
      userBadges,
      allBadges,
    });
  } catch (err) {
    console.error("[Web] Settings error:", err);
    res.status(500).send("Eroare la încărcarea setărilor");
  }
});
```

**Step 2: Verify server starts and /setari loads without errors**

---

### Task 3: Remove badges from /cont route and account.ejs

**Files:**
- Modify: `appredueri_backend/src/routes/web.js:1333-1369` — remove getUserBadges
- Modify: `appredueri_backend/src/views/public/account.ejs:73-188` — remove badges block

**Step 1: Simplify the /cont route**

Remove the `getUserBadges` import and its entry from Promise.all. Remove `userBadges` from render data.

New route (replace lines 1333-1369):

```javascript
router.get("/cont", requireWebAuth, async (req, res) => {
  try {
    const [pointsRes, favCount, followCount, reviewCount, bizReqRes, userDetails] = await Promise.all([
      pool.query("SELECT total_points FROM user_points WHERE user_id = $1", [req.webUser.id]),
      pool.query("SELECT COUNT(*) as total FROM favorite_offers WHERE user_id = $1", [req.webUser.id]),
      pool.query("SELECT COUNT(*) as total FROM followed_businesses WHERE user_id = $1", [req.webUser.id]),
      pool.query("SELECT COUNT(*) as total FROM reviews WHERE user_id = $1", [req.webUser.id]),
      pool.query("SELECT status, name FROM business_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [req.webUser.id]),
      pool.query("SELECT last_profile_edit FROM users WHERE id = $1", [req.webUser.id]),
    ]);

    const userPoints = pointsRes.rows[0]?.total_points || 0;
    const bizRequest = bizReqRes.rows[0] || null;
    const lastProfileEdit = userDetails.rows[0]?.last_profile_edit || null;

    res.render("public/account", {
      activePage: "cont",
      webUser: req.webUser,
      userPoints,
      favCount: parseInt(favCount.rows[0].total),
      followCount: parseInt(followCount.rows[0].total),
      reviewCount: parseInt(reviewCount.rows[0].total),
      bizRequest,
      lastProfileEdit,
    });
  } catch (err) {
    console.error("[Web] Account error:", err);
    res.status(500).send("Eroare la încărcarea contului");
  }
});
```

**Step 2: Remove badges section from account.ejs**

Delete lines 73-188 (the comment `<!-- Gamification card removed — badges only -->` through `<% } %>`). That entire block includes the badges-card HTML and the inline `<script>` for scroll/select.

**Step 3: Verify /cont loads cleanly — no badges shown, no JS errors**

---

### Task 4: CSS — Fix glow + add .badge-locked

**Files:**
- Modify: `appredueri_backend/src/public/css/sections/enhancements.css:1018-1030`

**Step 1: Remove rectangular background from .badge-item.badge-selected**

Change line 1019 from:
```css
.badge-item.badge-selected {
  background: var(--accent-muted);
}
```
to:
```css
.badge-item.badge-selected {
  background: transparent;
}
```

**Step 2: Add .badge-locked styles after line 1030**

Add after `.badge-item.badge-selected .badge-name` block:

```css
.badge-locked {
  opacity: 0.35;
  filter: grayscale(1);
  cursor: default;
  pointer-events: none;
}
.badge-locked .badge-icon {
  border-style: dashed;
}
```

---

### Task 5: Add badges section to setari.ejs

**Files:**
- Modify: `appredueri_backend/src/views/public/setari.ejs:13-14` — insert new section before password section

**Step 1: Add badges section HTML + JS**

Insert the following block after line 13 (`<div class="container" style="max-width: 640px;">`) and before line 14 (`<!-- Change Password -->`):

```ejs
    <!-- Badges Gallery -->
    <%
      const earnedBadges = (typeof userBadges !== 'undefined' && userBadges) ? userBadges : [];
      const allBadgesDef = (typeof allBadges !== 'undefined' && allBadges) ? allBadges : [];
      const earnedIds = new Set(earnedBadges.map(b => b.id));
    %>
    <div class="settings-section reveal">
      <div class="badges-header" style="margin-bottom: 4px;">
        <h2 class="settings-section-title" style="margin: 0;">Insignele mele</h2>
        <span class="badges-count"><%= earnedBadges.length %>/<%= allBadgesDef.length %></span>
        <div class="badges-nav">
          <button class="badges-nav-btn" id="badges-prev" aria-label="Anterior" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button class="badges-nav-btn" id="badges-next" aria-label="Următor">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
          </button>
        </div>
      </div>
      <p class="badges-subtitle">Selectează pentru recenzii</p>
      <div class="badges-strip-wrapper" id="badges-strip-wrapper">
        <div class="badges-strip" id="badges-strip">
          <!-- "Niciuna" option -->
          <div class="badge-item badge-none<%= !webUser.display_badge_id ? ' badge-selected' : '' %>" title="Fără insignă" onclick="selectDisplayBadge(null)">
            <div class="badge-icon" style="background: var(--bg-surface); border-color: var(--border); color: var(--text-muted);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <span class="badge-name">Niciuna</span>
          </div>
          <!-- All badges: earned = selectable, locked = greyed out -->
          <% allBadgesDef.forEach(function(badge) {
            const isEarned = earnedIds.has(badge.id);
          %>
            <% if (isEarned) { %>
              <div class="badge-item<%= webUser.display_badge_id === badge.id ? ' badge-selected' : '' %>" title="<%= badge.description %>" onclick="selectDisplayBadge(<%= badge.id %>)" data-badge-id="<%= badge.id %>" style="--badge-glow: <%= badge.color %>59;">
                <div class="badge-icon" style="background: <%= badge.color %>15; border-color: <%= badge.color %>40; color: <%= badge.color %>;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="<%= badge.color %>"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                <span class="badge-name"><%= badge.name %></span>
              </div>
            <% } else { %>
              <div class="badge-item badge-locked" title="<%= badge.description %>">
                <div class="badge-icon" style="background: var(--bg-surface); border-color: var(--border); color: var(--text-muted);">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--text-muted)"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </div>
                <span class="badge-name"><%= badge.name %></span>
              </div>
            <% } %>
          <% }); %>
        </div>
      </div>
    </div>
    <script>
    (function() {
      var strip = document.getElementById('badges-strip');
      var wrapper = document.getElementById('badges-strip-wrapper');
      var prevBtn = document.getElementById('badges-prev');
      var nextBtn = document.getElementById('badges-next');
      if (!strip || !wrapper) return;

      var SCROLL_STEP = 200;

      function updateFades() {
        var sl = strip.scrollLeft;
        var maxScroll = strip.scrollWidth - strip.clientWidth;
        var atStart = sl <= 8;
        var atEnd = sl >= maxScroll - 8;
        if (atStart) wrapper.classList.remove('scrolled-start');
        else wrapper.classList.add('scrolled-start');
        if (atEnd) wrapper.classList.add('scrolled-end');
        else wrapper.classList.remove('scrolled-end');
        if (prevBtn) prevBtn.disabled = atStart;
        if (nextBtn) nextBtn.disabled = atEnd;
      }
      strip.addEventListener('scroll', updateFades, { passive: true });

      if (prevBtn) prevBtn.addEventListener('click', function() {
        strip.scrollBy({ left: -SCROLL_STEP, behavior: 'smooth' });
      });
      if (nextBtn) nextBtn.addEventListener('click', function() {
        strip.scrollBy({ left: SCROLL_STEP, behavior: 'smooth' });
      });

      setTimeout(function() {
        var fits = strip.scrollWidth <= strip.clientWidth + 4;
        if (fits && prevBtn && nextBtn) {
          prevBtn.style.display = 'none';
          nextBtn.style.display = 'none';
        }
        updateFades();
      }, 100);

      var selected = strip.querySelector('.badge-selected');
      if (selected) {
        var offset = selected.offsetLeft - strip.clientWidth / 2 + selected.offsetWidth / 2;
        strip.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
      }
    })();

    function selectDisplayBadge(badgeId) {
      var items = document.querySelectorAll('.badge-item:not(.badge-locked)');
      items.forEach(function(el) { el.classList.remove('badge-selected'); });
      if (badgeId === null) {
        document.querySelector('.badge-none').classList.add('badge-selected');
      } else {
        var target = document.querySelector('[data-badge-id="' + badgeId + '"]');
        if (target) target.classList.add('badge-selected');
      }

      var strip = document.getElementById('badges-strip');
      var sel = strip.querySelector('.badge-selected');
      if (sel && strip) {
        var offset = sel.offsetLeft - strip.clientWidth / 2 + sel.offsetWidth / 2;
        strip.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
      }

      fetch('/api/web/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '' },
        credentials: 'same-origin',
        body: JSON.stringify({ display_badge_id: badgeId })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.success && window.showToast) showToast(data.message, 'success');
      }).catch(function() {
        if (window.showToast) showToast('Eroare la salvare', 'error');
      });
    }
    </script>
```

**Step 2: Verify /setari page renders with all badges (earned colored, locked greyed out)**

---

### Task 6: Visual verification with preview

**Step 1: Restart backend server**

**Step 2: Navigate to /cont — confirm badges section is gone**

**Step 3: Navigate to /setari — confirm:**
- All badges shown (earned + locked)
- Earned badges are colored and clickable
- Locked badges are greyed out with dashed border
- Selecting a badge shows glow only on circle, NOT on rectangle
- "Niciuna" option works
- Count shows earned/total (e.g., "2/7")
- Scroll arrows work if badges overflow

**Step 4: Take screenshots of both pages as proof**

---

### Task 7: Commit

```bash
git add appredueri_backend/src/services/badgeService.js \
       appredueri_backend/src/routes/web.js \
       appredueri_backend/src/views/public/account.ejs \
       appredueri_backend/src/views/public/setari.ejs \
       appredueri_backend/src/public/css/sections/enhancements.css
git commit -m "feat: move badges gallery from /cont to /setari with full catalogue

Show all badge definitions (earned + locked) in settings page.
Earned badges are selectable for display, locked ones are greyed out
as teasers. Fixed rectangular glow to circle-only on selected badge.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
