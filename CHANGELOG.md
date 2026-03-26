# Changelog

## [v0.13.0] — 2026-03-26

### Adaugat
- Google Analytics 4 integration — `GA_MEASUREMENT_ID` env var, custom events on favorites/follows/promo reveals/booking actions (58be3da)
- SEO comprehensive: gzip compression, font preloading, canonical URLs on all 22 pages, pagination rel=next/prev, JSON-LD (ItemList, BreadcrumbList, Product) on oferte/business-uri/preturi, sitemap improvements with lastmod + moderation filter, duplicate content prevention (a335531)
- Tier badges on ALL web pages — offer detail hero + sidebar + similar offers, home page deal of day + featured + promoted + followed + top businesses (3bc12dc)
- OFAI wordmark logo — `ofai-wordmark-nobg.svg` variant for navbar and auth cards (e2845d3)
- `/seo` skill for SEO auditing

### Modificat
- CSP updated to allow Google Analytics domains (googletagmanager.com, google-analytics.com)
- Register button text color fixed to black for readability (c10cb5c)

## [v0.12.0] — 2026-03-25

### Securitate
- Audit #12: 19 security/bug fixes + CSP nonce migration (47fcf7b)
- CSRF re-enabled on click tracking — was accidentally skipped (e9a7b54)
- Refresh token race condition fixed with SELECT ... FOR UPDATE transaction (e9a7b54)
- Performance indexes added (migration 064)

### Reparat
- Search suggest badges — use site-wide SVG shield icons (533fda5)
- Promoted badge moved from top-left to bottom-left on offer cards (2f5a5d9)
- Bottom spacing between grid cards and footer (64a4a66)

## [v0.11.0] — 2026-03-20

### Securitate
- Audit #11: 25 fixes — attachTier on web-portal-api, stripe_customer_id preserved on cancel, past_due in tier filter (7a040ac)
- Stored XSS maps_url fix, HTML escape in emails, LLM prompt injection [USER_INPUT] fencing
- Checkout/payment idempotency, change-plan DB-first ordering
- Flutter autoDispose fix

### Adaugat
- OFAI wordmark logo + Play Store build config (b1427ab)
- Search bar overhaul — better results, highlights, keyboard nav, a11y (605207b)
- Lenis smooth scroll — CDN-loaded, graceful fallback (5364559)
- Referral system — full implementation backend + Flutter (1d9e073)
- Semantics labels + offline connectivity indicator (289b40d)
- "Gestioneaza pe Web" banner for business owners in Flutter (18f25db)

### Modificat
- Gamification UI hidden (backend active, UI disabled) (53f18eb)
- FAQ updated across 3 pages (4c01628)

## [v0.10.0] — 2026-03-09

### Securitate
- Sprint 3 fixes: parseInt guards, code review findings, QA portal bugfixes (e8c818c)
- Audit #10 schema fixes (migration 057)

### Adaugat
- Flash deals with countdown badge widget (migration 058)
- Notification preferences — granular per-category toggles (migration 059)
- Saved searches with alerts (migration 060)
- Collections — curated editorial lists (migration 061)
- Stripe price IDs (migration 062)
- Referral system schema (migration 063)
- Category feed — cron + API + Flutter home
- Social proof badges, recently viewed, search history
- Report auto-flag (>=3 reports email admin, >=10 auto-deactivate)
- Rich share with OG tags
- Pull-to-refresh on offer + business detail
- Weekly digest push (Sunday 19:00)
- Deep links (apple-app-site-association + assetlinks.json)

## [v0.9.0] — 2026-03-06

### Securitate
- Aplicat 60+ fix-uri audit #9: XSS escapeHtml, path traversal, URL sanitization, banned_at checks, SSRF guard, writeLimiter, Express ~5.1.0 (3ebb368) 🤖

### Adaugat
- Management locații în portalul business + parsare link-uri Google Maps (82b1be6) 🤖
- Tab-uri oferte per locație pe pagina de business (1a75511) 🤖
- Premium badge card + etichete tab-uri colecție în Flutter (d21aa2b) 🤖
- Câmp descriere business în formularul portalului (89b66ea) 🤖

### Reparat
- Fix edge cases în tab-urile oferte per locație (a74f974) 🤖
- Fix link-uri navigare și acuratețe parsare URL Maps (30a802e) 🤖
- Toast + redirect la #oferte după creare/editare/ștergere ofertă (c8f0233) 🤖
- Adaugat badges la toate endpoint-urile auth: login, register, me, google (2bc76e6) 🤖
- Badge check pe ruta web review + mutare toggle profil (893c1ad) 🤖

### Modificat
- Split 3 god files: main.css → 7 secțiuni, manage.ejs → 6 partials, web.js → 4 sub-routere (7125bba) 🤖
- Limită galerie premium crescută de la 32 la 64 imagini (30461f8) 🤖
- Eliminat UI puncte/niveluri gamificare, păstrat doar badges (cfd86e7) 🤖

### Șters
- Revert Quill rich text editor pentru descriere business (f09ba27)

### Documentație
- Raport complet audit #9 — 120 findings deduplicate (6f30443) 🤖
- 4 fișiere prompt audit fix pe severitate (80437fd) 🤖
- Design premium badge card (a09f4a6) 🤖
