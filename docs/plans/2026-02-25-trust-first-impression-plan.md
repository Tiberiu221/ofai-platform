# Trust & First Impression — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refacem hero-ul si reordonam home page-ul pentru a comunica instant valoare si trust catre vizitatori noi (utilizatori + business owners).

**Architecture:** Editam doar frontend (EJS templates + CSS + Flutter widgets). Zero modificari backend/API/DB. Datele existente din web.js route handler sunt suficiente. Trust pillars sunt pur statice (HTML/CSS), fara logica server-side.

**Tech Stack:** EJS templates, CSS (dark theme cu `--accent: #fb923c`), Flutter/Dart (Riverpod, GoRouter)

**Design doc:** `docs/plans/2026-02-25-trust-first-impression-design.md`

---

## Ordinea Taskurilor

```
Task 1: CSS trust pillars styles     (izolat, zero risc)
Task 2: Hero h1 + subtitle           (2 string replacements in home.ejs)
Task 3: Hero CTA secundar            (1 string replacement)
Task 4: Trust pillars HTML           (insert bloc HTML nou in hero)
Task 5: "Cum functioneaza" text      (update text existent)
Task 6: "Cum functioneaza" CTA       (insert 1 linie HTML)
Task 7: Reordonare sectiuni          (move/cut-paste in home.ejs — cel mai riscant)
Task 8: CTA business imbunatatit     (update text + adauga beneficii)
Task 9: Verificare web completa      (start server, preview, check desktop + mobile)
Task 10: Flutter hero text           (update 2 strings)
Task 11: Flutter trust pillars       (insert widget nou)
Task 12: Flutter verificare          (analyze + test)
Task 13: Commit                      (git add + commit)
```

Logica: CSS-ul mai intai (e izolat, zero risc), apoi editam EJS de sus in jos (hero → how-it-works → reordonare → CTA), verificam, apoi Flutter, commit.

---

### Task 1: CSS — Trust Pillars Styles

**Files:**
- Modify: `appredueri_backend/src/public/css/main.css:569` (insert dupa `.hero-stat-label`, inainte de `/* CATEGORIES */`)

**Step 1: Insert CSS nou dupa linia 568**

Insereaza imediat dupa `.hero-stat-label { ... }` (linia 568) si inainte de `/* === CATEGORIES === */` (linia 570):

```css
/* ═══════════════════════════════════════════════════════════
   TRUST PILLARS
   ═══════════════════════════════════════════════════════════ */

.trust-pillars {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 40px;
  animation: fadeInUp 0.8s var(--ease-out) 0.5s both;
}

.trust-pill {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: border-color 0.2s ease, background 0.2s ease;
}

.trust-pill:hover {
  border-color: rgba(251, 146, 60, 0.2);
  background: rgba(255, 255, 255, 0.05);
}

.trust-pill-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--accent-muted);
}

.trust-pill-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.trust-pill-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.trust-pill-desc {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  line-height: 1.4;
}

/* ═══════════════════════════════════════════════════════════
   CTA BUSINESS BENEFITS (inside .cta-box)
   ═══════════════════════════════════════════════════════════ */

.cta-benefits {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin: 24px 0;
  flex-wrap: wrap;
}

.cta-benefit {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.cta-benefit-icon {
  font-size: 1.25rem;
}

.cta-guarantee {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  margin-bottom: 24px;
  letter-spacing: 0.02em;
}
```

**Step 2: Add responsive override**

Find the existing mobile breakpoint section near line 1719 (`@media (max-width: 768px)`). Insert inside that block, after the `.hero` rules:

```css
  .trust-pillars {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .trust-pill {
    padding: 12px 16px;
  }

  .cta-benefits {
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
```

**Step 3: Add small screen override**

Find `@media (max-width: 480px)` block (around line 4438). Insert inside:

```css
  .trust-pill-title {
    font-size: 0.75rem;
  }

  .trust-pill-desc {
    font-size: 0.625rem;
  }
```

**Step 4: Verify CSS syntax**

Run: `cd appredueri_backend && npm run dev`

Open http://localhost:4000 — page should load without CSS errors. Trust pillars won't be visible yet (HTML not added), but existing styles must not break.

Expected: Page loads normally, no visual regressions.

**Step 5: Commit**

```bash
git add appredueri_backend/src/public/css/main.css
git commit -m "style: add trust pillars and CTA benefits CSS"
```

---

### Task 2: Hero h1 + Subtitle

**Files:**
- Modify: `appredueri_backend/src/views/public/home.ejs:19-25`

**Step 1: Replace h1 text**

Find (line 19-21):
```html
    <h1 class="hero-title text-gradient">
      Reduceri de la business-uri <span class="accent">locale</span>
    </h1>
```

Replace with:
```html
    <h1 class="hero-title text-gradient">
      Cele mai bune oferte din <span class="accent">orașul tău</span>
    </h1>
```

**Step 2: Replace subtitle**

Find (line 23-25):
```html
    <p class="hero-subtitle">
      Descoperă cele mai bune oferte de la peste <%= stats.totalBusinesses.toLocaleString('ro-RO') %> business-uri din <%= stats.totalCities %> orașe. Restaurante, beauty, fitness și multe altele.
    </p>
```

Replace with:
```html
    <p class="hero-subtitle">
      Descoperă reduceri verificate la frizerii, restaurante, fitness și 12+ categorii. Gratuit. Fără reclame. Fără catch.
    </p>
```

**NOTA IMPORTANTA:** Am scos stats-urile din subtitle intentionat. Stats-urile raman vizibile in hero-stats section (linii 44-57). Subtitle-ul e acum orientat pe beneficiu + trust.

**Step 3: Verify in browser**

Refresh http://localhost:4000

Expected:
- h1 shows "Cele mai bune oferte din orașul tău" with "orașul tău" in accent orange
- Subtitle shows the new text without stats numbers
- Stats row below CTAs unchanged

**Step 4: Commit**

```bash
git add appredueri_backend/src/views/public/home.ejs
git commit -m "copy: update hero headline and subtitle for trust-first messaging"
```

---

### Task 3: Hero CTA Secundar

**Files:**
- Modify: `appredueri_backend/src/views/public/home.ejs:41`

**Step 1: Replace secondary CTA**

Find (line 41):
```html
      <a href="#how-it-works" class="btn btn-secondary btn-lg">Cum funcționează?</a>
```

Replace with:
```html
      <a href="/pentru-business" class="btn btn-secondary btn-lg">
        Pentru Business
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </a>
```

**Step 2: Verify**

Refresh browser. Secondary CTA should now say "Pentru Business" with a house icon, linking to /pentru-business.

**Step 3: Commit**

```bash
git add appredueri_backend/src/views/public/home.ejs
git commit -m "copy: change secondary CTA to 'Pentru Business' for dual-audience targeting"
```

---

### Task 4: Trust Pillars HTML

**Files:**
- Modify: `appredueri_backend/src/views/public/home.ejs:42-44` (insert between CTAs and stats)

**Step 1: Insert trust pillars block**

Find the closing `</div>` of hero-ctas (after the secondary CTA button, around line 42). Insert AFTER the `</div>` of `.hero-ctas` and BEFORE `<div class="hero-stats">`:

```html
    </div>

    <!-- Trust Pillars -->
    <div class="trust-pillars">
      <div class="trust-pill">
        <div class="trust-pill-icon">🔒</div>
        <div class="trust-pill-text">
          <div class="trust-pill-title">100% Gratuit</div>
          <div class="trust-pill-desc">Fără costuri ascunse, fără abonamente</div>
        </div>
      </div>
      <div class="trust-pill">
        <div class="trust-pill-icon">✅</div>
        <div class="trust-pill-text">
          <div class="trust-pill-title">Business-uri Verificate</div>
          <div class="trust-pill-desc">Echipa OFAI verifică fiecare partener</div>
        </div>
      </div>
      <div class="trust-pill">
        <div class="trust-pill-icon">🎯</div>
        <div class="trust-pill-text">
          <div class="trust-pill-title">Oferte Personalizate</div>
          <div class="trust-pill-desc">Bazate pe orașul și preferințele tale</div>
        </div>
      </div>
    </div>

    <div class="hero-stats">
```

**ATENTIE:** Trebuie sa inlocuim exact zona intre `</div>` (hero-ctas) si `<div class="hero-stats">`. Sa nu duplicam `</div>` sau `<div class="hero-stats">`.

**Step 2: Verify in browser**

Refresh http://localhost:4000

Expected:
- 3 trust pillars appear between CTAs and stats
- Glassmorphic cards with icons, titles, descriptions
- Responsive: 3 columns on desktop, 1 column on mobile
- Hover effect: border becomes slightly orange

**Step 3: Check mobile**

Open DevTools → Toggle device toolbar → iPhone 14 Pro (390px)

Expected: Trust pillars stack vertically, text readable, no overflow.

**Step 4: Commit**

```bash
git add appredueri_backend/src/views/public/home.ejs
git commit -m "feat: add trust pillars to hero section"
```

---

### Task 5: Update "Cum Functioneaza" Text

**Files:**
- Modify: `appredueri_backend/src/views/public/home.ejs:373-389`

**Step 1: Replace the 3 step cards content**

Find the entire `.steps-grid` div (lines 373-389) and replace the inner content:

Find:
```html
    <div class="steps-grid">
      <div class="step-card reveal reveal-delay-1">
        <div class="step-number">1</div>
        <h3 class="step-title">Descoperă</h3>
        <p class="step-desc">Caută oferte în orașul tău sau explorează pe categorii. Filtrează după ce te interesează.</p>
      </div>
      <div class="step-card reveal reveal-delay-2">
        <div class="step-number">2</div>
        <h3 class="step-title">Salvează</h3>
        <p class="step-desc">Adaugă ofertele preferate la favorite și urmărește business-urile care te interesează.</p>
      </div>
      <div class="step-card reveal reveal-delay-3">
        <div class="step-number">3</div>
        <h3 class="step-title">Profită</h3>
        <p class="step-desc">Mergi la business și prezintă oferta. Bucură-te de reducere!</p>
      </div>
    </div>
```

Replace with:
```html
    <div class="steps-grid">
      <div class="step-card reveal reveal-delay-1">
        <div class="step-number">1</div>
        <h3 class="step-title">Alege orașul și categoriile</h3>
        <p class="step-desc">Setează preferințele tale în 30 de secunde. Primești doar oferte relevante pentru tine.</p>
      </div>
      <div class="step-card reveal reveal-delay-2">
        <div class="step-number">2</div>
        <h3 class="step-title">Salvează și urmărește</h3>
        <p class="step-desc">Adaugă ofertele la favorite. Urmărește business-urile preferate și primește notificări când apar reduceri noi.</p>
      </div>
      <div class="step-card reveal reveal-delay-3">
        <div class="step-number">3</div>
        <h3 class="step-title">Folosește reducerea</h3>
        <p class="step-desc">Mergi la business, arată codul promo sau menționează oferta. Atât de simplu!</p>
      </div>
    </div>
```

**Step 2: Commit**

```bash
git add appredueri_backend/src/views/public/home.ejs
git commit -m "copy: update how-it-works steps with concrete details"
```

---

### Task 6: Add CTA Signup Under "Cum Functioneaza"

**Files:**
- Modify: `appredueri_backend/src/views/public/home.ejs` — inside the how-it-works section, after `.steps-grid` closing `</div>`

**Step 1: Insert CTA**

Find the closing `</div>` of `.steps-grid` (dupa ultimul step-card) si inainte de `</div>` al `.container` si `</section>` al how-it-works. Insert intre:

```html
    </div>

    <% if (!webUser) { %>
    <div style="text-align: center; margin-top: 40px;" class="reveal reveal-delay-4">
      <a href="/register" class="btn btn-secondary btn-lg">
        Creează cont gratuit
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
      </a>
    </div>
    <% } %>

  </div>
</section>
```

**NOTA:** Conditional `<% if (!webUser) { %>` — ascundem CTA daca userul e deja logat. Aceasta variabila e deja disponibila in template (pasata din web.js la linia 255).

**Step 2: Verify**

Refresh browser. When logged out: "Creează cont gratuit" button visible under steps. When logged in: button hidden.

**Step 3: Commit**

```bash
git add appredueri_backend/src/views/public/home.ejs
git commit -m "feat: add conditional signup CTA under how-it-works section"
```

---

### Task 7: Reordonare Sectiuni Home Page

**ATENȚIE — CEL MAI RISCANT TASK.** Mutam blocuri mari de HTML in home.ejs.

**Files:**
- Modify: `appredueri_backend/src/views/public/home.ejs`

**Ordinea actuala (linii aproximative):**
```
L1-59:    HERO
L60-75:   MARQUEE
L77-104:  CATEGORIES        ← muta jos
L106-147: PENTRU TINE       ← muta inainte de categorii
L149-301: DEAL + FEATURED   ← pastram
L303-360: TOP BUSINESSES    ← pastram
L362-391: HOW IT WORKS      ← muta sus (dupa marquee)
L393-441: CITIES            ← pastram
L443-460: CTA BUSINESS      ← pastram
```

**Ordinea noua:**
```
L1-59:    HERO
L60-75:   MARQUEE
---NEW:   HOW IT WORKS (mutat de la L362)
L149-301: DEAL + FEATURED (cu preferences banner + geo banner)
L303-360: TOP BUSINESSES
L77-104:  CATEGORIES (mutat de dupa marquee)
L106-147: PENTRU TINE (conditional, mutat dupa categorii)
L393-441: CITIES
L443-460: CTA BUSINESS
```

**Step 1: CUT sectiunea HOW IT WORKS (liniile 362-391)**

Taie complet blocul:
```html
<!-- ═══════════════════════════════════════════════════════
     HOW IT WORKS
     ═══════════════════════════════════════════════════════ -->
<section class="section" id="how-it-works">
  ...tot pana la...
</section>
```

(Inclusiv CTA-ul de signup adaugat la Task 6)

**Step 2: PASTE dupa MARQUEE (dupa linia 75)**

Insert sectiunea HOW IT WORKS imediat dupa `</section>` al marquee-ului.

**Step 3: CUT sectiunea CATEGORIES (liniile 77-104 originale)**

Taie complet blocul:
```html
<!-- ═══════════════════════════════════════════════════════
     CATEGORIES SECTION
     ═══════════════════════════════════════════════════════ -->
<section class="section" id="categories">
  ...
</section>
```

**Step 4: PASTE CATEGORIES dupa TOP BUSINESSES**

Insert sectiunea CATEGORIES imediat dupa sectiunea TOP BUSINESSES (`<% } %>`).

**Step 5: Verify — CRITICAL CHECK**

Refresh http://localhost:4000

Expected order on page:
1. Hero (cu trust pillars)
2. Marquee business-uri
3. "Cum funcționează?" (3 pasi) + CTA signup
4. Deal of the Day
5. Oferte featured (bento grid)
6. Top Business-uri
7. Categorii
8. "Pentru tine" (doar logati)
9. Orașe
10. CTA Business

**VERIFICARI CRITICE:**
- [ ] Pagina se incarca fara erori EJS
- [ ] Toate sectiunile sunt vizibile
- [ ] Deal of the Day apare (daca exista)
- [ ] Featured offers au imagini/badge-uri
- [ ] Categories grid e functional (linkuri corecte)
- [ ] "Pentru tine" apare DOAR cand esti logat
- [ ] Footer renders

**Step 6: Commit**

```bash
git add appredueri_backend/src/views/public/home.ejs
git commit -m "layout: reorder home sections — how-it-works up, categories after offers"
```

---

### Task 8: CTA Business Imbunatatit

**Files:**
- Modify: `appredueri_backend/src/views/public/home.ejs` — CTA section (fostele linii 443-460, acum pozitie noua dupa reordonare)

**Step 1: Replace CTA box content**

Find:
```html
    <div class="cta-box reveal">
      <div class="cta-box-glow"></div>
      <h2 class="cta-title text-gradient">Ai un business? Adaugă-l pe OFAI</h2>
      <p class="cta-subtitle">
        Crește-ți vizibilitatea și atrage clienți noi cu oferte și reduceri atractive. Gratuit.
      </p>
      <a href="/pentru-business" class="btn btn-primary btn-lg">
        Înregistrează business-ul
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
    </div>
```

Replace with:
```html
    <div class="cta-box reveal">
      <div class="cta-box-glow"></div>
      <h2 class="cta-title text-gradient">Ai un business? Listează-te gratuit</h2>
      <p class="cta-subtitle">
        Crește-ți vizibilitatea și atrage clienți noi cu reduceri atractive.
      </p>
      <div class="cta-benefits">
        <div class="cta-benefit">
          <span class="cta-benefit-icon">📊</span>
          <span>Dashboard propriu</span>
        </div>
        <div class="cta-benefit">
          <span class="cta-benefit-icon">⭐</span>
          <span>Recenzii de la clienți</span>
        </div>
        <div class="cta-benefit">
          <span class="cta-benefit-icon">📈</span>
          <span>Statistici de audiență</span>
        </div>
      </div>
      <p class="cta-guarantee">Fără comisioane · Fără contracte · Anulează oricând</p>
      <a href="/pentru-business" class="btn btn-primary btn-lg">
        Înscrie-ți afacerea
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
    </div>
```

**Step 2: Verify**

Scroll to bottom. CTA should now show: title + subtitle + 3 benefits row + guarantee text + button.

**Step 3: Commit**

```bash
git add appredueri_backend/src/views/public/home.ejs
git commit -m "feat: enhance business CTA with benefits and guarantee messaging"
```

---

### Task 9: Verificare Web Completa

**NO CODE CHANGES — doar verificari.**

**Step 1: Desktop check (1440px)**

Open http://localhost:4000 — verificari:
- [ ] Hero: h1 "Cele mai bune oferte din orașul tău"
- [ ] Hero: subtitle cu "Gratuit. Fără reclame. Fără catch."
- [ ] Hero: CTA "Pentru Business" vizibil
- [ ] Trust pillars: 3 carduri glassmorphic vizibile fara scroll
- [ ] Marquee: business logos scrolling
- [ ] "Cum funcționează": apare imediat dupa marquee
- [ ] Deal of the Day: apare (daca exista)
- [ ] Oferte featured: imagini, badges, ratings
- [ ] CTA business: beneficii + garantie vizibile

**Step 2: Mobile check (390px)**

DevTools → mobile toggle → iPhone 14 Pro:
- [ ] Trust pillars stacked vertical (1 coloana)
- [ ] Text citibil, fara overflow
- [ ] CTA buttons full-width
- [ ] No horizontal scroll

**Step 3: Logged-in check**

Login cu un cont de test:
- [ ] "Creează cont gratuit" CTA ascuns in how-it-works
- [ ] "Pentru tine" section apare (daca are followed businesses)
- [ ] Streak pill apare (daca e streak > 0)

**Step 4: Page load speed**

DevTools → Network tab → Hard reload:
- [ ] No new HTTP requests (trust pillars sunt static HTML/CSS)
- [ ] No console errors

---

### Task 10: Flutter — Hero Text Update

**Files:**
- Modify: `ofai_flutter/lib/screens/home/home_screen.dart:106-118`

**Step 1: Update hero text**

Find (around lines 106-118):
```dart
                        Text(
                          'OFAI',
                          style: AppTypography.displayLarge.copyWith(
                            color: AppColors.accent,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          'Descopera cele mai bune oferte',
                          style: AppTypography.bodyLarge.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
```

Replace with:
```dart
                        Text(
                          'OFAI',
                          style: AppTypography.displayLarge.copyWith(
                            color: AppColors.accent,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          'Cele mai bune oferte din orașul tău',
                          style: AppTypography.bodyLarge.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Gratuit. Fără reclame. Fără catch.',
                          style: AppTypography.labelSmall.copyWith(
                            color: AppColors.textTertiary,
                          ),
                        ),
```

**Step 2: Verify build compiles**

Run: `"C:/dev/flutter/bin/flutter.bat" analyze --no-pub`

Expected: No new errors (infos pre-existing are OK, grep for `^error` only).

**Step 3: Commit**

```bash
git add ofai_flutter/lib/screens/home/home_screen.dart
git commit -m "copy: update Flutter hero text to match web trust-first messaging"
```

---

### Task 11: Flutter — Trust Pillars Widget

**Files:**
- Modify: `ofai_flutter/lib/screens/home/home_screen.dart` — insert after stats row SliverToBoxAdapter (after line 177)

**Step 1: Insert trust pillars sliver**

Find (around line 179):
```dart
              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.lg)),
```

Insert BEFORE that line:

```dart
              // Trust Pillars
              SliverToBoxAdapter(
                child: FadeInItem(
                  index: 2,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.pagePadding, AppSpacing.md,
                      AppSpacing.pagePadding, 0,
                    ),
                    child: Column(
                      children: [
                        _TrustPill(
                          icon: '\u{1F512}',
                          title: '100% Gratuit',
                          desc: 'Fara costuri ascunse',
                        ),
                        const SizedBox(height: 8),
                        _TrustPill(
                          icon: '\u{2705}',
                          title: 'Verificate',
                          desc: 'Echipa OFAI verifica partenerii',
                        ),
                        const SizedBox(height: 8),
                        _TrustPill(
                          icon: '\u{1F3AF}',
                          title: 'Personalizate',
                          desc: 'Bazate pe preferintele tale',
                        ),
                      ],
                    ),
                  ),
                ),
              ),
```

**Step 2: Add _TrustPill widget class**

Find the `_AnimatedStatPill` class at the bottom of the file. Insert BEFORE it:

```dart
class _TrustPill extends StatelessWidget {
  final String icon;
  final String title;
  final String desc;

  const _TrustPill({
    required this.icon,
    required this.title,
    required this.desc,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: Text(icon, style: const TextStyle(fontSize: 18)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.labelMedium.copyWith(
                    color: AppColors.textPrimary,
                  ),
                ),
                Text(
                  desc,
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.textTertiary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

**Step 3: Verify build compiles**

Run: `"C:/dev/flutter/bin/flutter.bat" analyze --no-pub`

Expected: No new errors.

**Step 4: Commit**

```bash
git add ofai_flutter/lib/screens/home/home_screen.dart
git commit -m "feat: add trust pillars to Flutter home screen"
```

---

### Task 12: Flutter Verificare Finala

**NO CODE CHANGES — doar verificari.**

**Step 1: Run full analyze**

```bash
"C:/dev/flutter/bin/flutter.bat" analyze --no-pub 2>&1 | grep "^error"
```

Expected: No error lines.

**Step 2: Run tests**

```bash
"C:/dev/flutter/bin/flutter.bat" test --no-pub 2>&1 | tail -5
```

Expected: All tests pass (or same pass count as before changes).

---

### Task 13: Final Commit — Merge All Changes

**Daca ai facut commit-uri individuale per-task (recomandat), skip acest task.**

**Daca nu ai facut commit-uri individuale:**

```bash
git add appredueri_backend/src/public/css/main.css \
        appredueri_backend/src/views/public/home.ejs \
        ofai_flutter/lib/screens/home/home_screen.dart
git commit -m "feat: trust-first hero redesign — pillars, reorder, CTA benefits

- Replace hero h1/subtitle with benefit-oriented trust messaging
- Add 3 trust pillars (Gratuit, Verificat, Personalizat) in hero
- Change secondary CTA to 'Pentru Business' dual-audience targeting
- Reorder sections: how-it-works moved up, categories after offers
- Update how-it-works step copy with concrete details
- Add conditional signup CTA under how-it-works (hidden when logged in)
- Enhance business CTA with benefits row and guarantee text
- Mirror hero text + trust pillars on Flutter home screen
- Add _TrustPill widget to Flutter

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
