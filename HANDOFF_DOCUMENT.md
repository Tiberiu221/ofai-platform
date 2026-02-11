# OFAI - Handoff Document
## Data: 11 Februarie 2026 (Actualizat v11 — Security + Visual Polish + Bugfixes + returnTo)

---

## INFORMATII PROIECT

**Nume:** OFAI
**Scop:** Platforma de oferte si reduceri pentru piata din Romania
**Domeniu:** https://ofai.ro

**Tech Stack:**
- **Frontend Web:** EJS (server-rendered) pe Express — site-ul public complet
- **Frontend Mobile:** React Native / Expo (cross-platform: web + mobile) — doar dev
- **Backend:** Node.js / Express
- **Database:** PostgreSQL
- **Hosting:** Railway (backend + EJS site + static assets, totul pe acelasi server)
- **DNS/CDN:** Cloudflare (free plan, CNAME flattening, proxy ON)
- **Imagini:** Cloudinary (upload/resize/delete)
- **Email:** Resend (welcome + password reset + business approved/rejected) — domeniu ofai.ro verificat
- **Error Tracking:** Sentry
- **AI/LLM:** Anthropic Claude Haiku (review summarization)
- **Workflow Automation:** n8n (pe Railway)
- **GitHub:** https://github.com/Tiberiu221/OFAI

---

## STRUCTURA PROIECT LOCAL

```
C:\Users\tiber\Desktop\AppReduceri\
├── appredueri_mobile/     # Frontend React Native/Expo (doar mobile dev)
│   ├── app/               # Expo Router pages
│   └── components/        # Componente reutilizabile
│
├── appredueri_backend/    # Backend Node.js + Public EJS Website (TOTUL)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── web.js              # ★ PRINCIPAL — toate rutele EJS + AJAX endpoints (~1300+ linii)
│   │   │   ├── business-portal.js  # REST API mobile pentru business owners (Bearer token)
│   │   │   ├── auth.js             # REST API auth (mobile)
│   │   │   ├── offers.js           # REST API oferte (mobile)
│   │   │   ├── businesses.js       # REST API business-uri (mobile)
│   │   │   ├── reviews.js          # REST API recenzii (mobile)
│   │   │   ├── favorites.js        # REST API favorite (mobile)
│   │   │   ├── subscriptions.js    # REST API urmariri (mobile)
│   │   │   ├── users.js            # REST API utilizatori (mobile)
│   │   │   ├── admin.js            # Admin panel routes (+ business request approve/reject)
│   │   │   ├── businessRequests.js # ★ NOU — Business request submit + track API (cookie auth)
│   │   │   └── push-tokens.js      # Push notification tokens
│   │   ├── middleware/
│   │   │   ├── webAuth.js          # Cookie JWT auth (optionalWebAuth / requireWebAuth)
│   │   │   ├── businessWebAuth.js  # ★ NOU — Cookie auth + business ownership check
│   │   │   ├── auth.js             # Bearer token auth (mobile API)
│   │   │   ├── businessAuth.js     # Bearer token + business ownership (mobile API)
│   │   │   ├── adminAuth.js        # Admin HTTP basic auth
│   │   │   └── rateLimiter.js      # Rate limiting (general, auth, admin, etc.)
│   │   ├── helpers/
│   │   │   └── validate.js         # Validare input + paginare helpers
│   │   ├── config/
│   │   │   └── llm.js              # Claude Haiku config
│   │   ├── services/
│   │   │   ├── llm/
│   │   │   │   ├── (review summarization)
│   │   │   │   └── businessValidation.js  # ★ NOU — AI validation pipeline (Haiku scoring)
│   │   │   ├── cloudinary.js       # Upload/delete/transform imagini
│   │   │   ├── n8n.js              # Webhook fire-and-forget helper
│   │   │   ├── email.js            # Resend email (welcome + reset + biz approved/rejected)
│   │   │   ├── pushNotifications.js
│   │   │   └── sentry.js
│   │   ├── views/
│   │   │   ├── admin/              # Admin panel (EJS)
│   │   │   │   ├── business-requests.ejs  # ★ NOU — Admin review business requests
│   │   │   │   └── businesses-list.ejs
│   │   │   └── public/             # ★ PUBLIC WEBSITE — toate paginile EJS
│   │   │       ├── home.ejs
│   │   │       ├── oferte.ejs
│   │   │       ├── offer-detail.ejs
│   │   │       ├── business-detail.ejs
│   │   │       ├── categorii.ejs
│   │   │       ├── categorie.ejs
│   │   │       ├── orase.ejs
│   │   │       ├── oras.ejs
│   │   │       ├── login.ejs
│   │   │       ├── register.ejs
│   │   │       ├── forgot-password.ejs
│   │   │       ├── reset-password.ejs
│   │   │       ├── account.ejs
│   │   │       ├── colectia-mea.ejs
│   │   │       ├── setari.ejs
│   │   │       ├── preferinte.ejs
│   │   │       ├── termeni.ejs
│   │   │       ├── confidentialitate.ejs
│   │   │       ├── ajutor.ejs
│   │   │       ├── pentru-business.ejs  # ★ RESCRIS — form + AI validation + request tracker + retry
│   │   │       ├── 404.ejs
│   │   │       ├── portal/
│   │   │       │   ├── dashboard.ejs    # ★ NOU — lista business-uri owner
│   │   │       │   ├── manage.ejs       # ★ NOU — manage business (4 tabs)
│   │   │       │   └── offer-form.ejs   # ★ NOU — creare/editare oferta
│   │   │       └── partials/
│   │   │           ├── head.ejs         # HTML head, meta, favicon, CSS
│   │   │           ├── navbar.ejs       # Glassmorphic navbar + Portal link
│   │   │           └── footer.ejs       # Footer 4 coloane
│   │   └── public/                # Static assets
│   │       ├── css/main.css       # Design system complet (~3370+ linii)
│   │       └── js/main.js         # Toast, favorites, follow, geolocation, search autosuggest, particles, scroll arrows, TiltFx, share, returnTo (~660 linii)
│   ├── scripts/                   # Batch jobs, monitoring
│   │   ├── seed-businesses.js     # Seed 450 business-uri fictive (DiceBear + Picsum)
│   │   ├── cleanup-seed.js        # Ștergere seed-uri vechi
│   │   ├── verify-seed.js         # Verificare distribuție seed
│   │   └── scraping/              # ★ NOU — Pipeline Playwright + OpenRouter
│   │       ├── config.js          # Configurare centralizată
│   │       ├── utils.js           # Utilități (retry, phone normalizer)
│   │       ├── state.js           # Resume state manager (crash recovery)
│   │       ├── 01-scrape.js       # Faza 1: Playwright → Google Maps → JSON local
│   │       ├── 02-enrich-and-insert.js  # Faza 2: OpenRouter LLM → PostgreSQL
│   │       ├── 03-verify.js       # Verificare calitate date scrapate
│   │       ├── 04-cleanup.js      # Ștergere date scrapate (source='scraped')
│   │       └── data/              # (gitignored) raw JSON + state + costs
│   └── migrations/                # SQL migrations (latest: 013_business_requests)
│
└── n8n-workflows/                 # Exportabile .json pentru n8n
    └── WF1_New_Review_Notify_Owner.json
```

---

## URLs & CONFIGURATII

### Productie
- **Website:** https://ofai.ro (servit de Railway, DNS prin Cloudflare)
- **API:** https://ofai-production.up.railway.app (acelasi server ca website-ul)
- **n8n:** https://n8n-production-d2f4.up.railway.app
- **Railway Dashboard:** Deployment automat pe push la GitHub
- **Cloudflare DNS:**
  - CNAME `@` → `vurfk849.up.railway.app` (proxy ON)
  - CNAME `www` → `vurfk849.up.railway.app` (proxy ON)
- **IMPORTANT:** Vercel a fost eliminat complet — totul e pe Railway

### Development
- **Website (EJS):** http://localhost:4000 (`npm run dev` in backend)
- **Mobile (Expo):** http://localhost:8081 (`npx expo start --web`)
- **Backend API:** http://localhost:4000 (`npm run dev`)

### Railway Environment Variables (Backend)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
NODE_ENV=production
ADMIN_USER=...
ADMIN_PASSWORD=...
CLOUDINARY_CLOUD_NAME=dtlawgplb
CLOUDINARY_API_KEY=REDACTED
CLOUDINARY_API_SECRET=(din Cloudinary dashboard)
SENTRY_DSN=REDACTED
RESEND_API_KEY=re_xxxxxxxxx
FROM_EMAIL=OFAI <noreply@ofai.ro>
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxx
N8N_WEBHOOK_URL=https://n8n-production-d2f4.up.railway.app
OPENROUTER_KEY=sk-or-v1-xxxxxxxx   # Pentru scraping pipeline LLM enrichment
```

### Railway Cron Job
```
Command: npm run review-summaries:batch
Schedule: 0 3 */2 * *   (la 2 zile, 03:00 AM)
```

---

## SISTEME DE AUTENTIFICARE (IMPORTANT)

Exista **3 sisteme de auth** separate. Trebuie intelese bine:

### 1. Web Auth (cookie-based) — pentru site-ul public EJS
- **Middleware:** `src/middleware/webAuth.js`
- **Functii:** `optionalWebAuth` (seteaza `req.webUser` sau null), `requireWebAuth` (redirect la /login SAU 401 JSON)
- **Mecanism:** Cookie `ofai_token` (httpOnly, Secure in prod, SameSite: lax, 30 zile)
- **Folosit de:** Toate rutele din `web.js` (pagini EJS + AJAX endpoints `/api/web/*`)
- **IMPORTANT:** `requireWebAuth` detecteaza daca ruta e `/api/*` si returneaza 401 JSON (nu redirect HTML). Fara asta, `fetch()` urmareste 302 transparent → primeste HTML → `resp.json()` fail.

### 2. Business Portal Web Auth — cookie + ownership check
- **Middleware:** `src/middleware/businessWebAuth.js`
- **Functie:** `requireBusinessOwner`
- **Mecanism:** Cookie auth (ca webAuth) + verifica `user_businesses` table ca user-ul detine business-ul
- **Admin bypass:** Admins au acces la orice business
- **Folosit de:** Rutele `/portal/*` si `/api/web/portal/*` din `web.js`

### 3. Mobile API Auth (Bearer token) — pentru app-ul mobil
- **Middleware:** `src/middleware/auth.js` si `src/middleware/businessAuth.js`
- **Mecanism:** Header `Authorization: Bearer <jwt_token>`
- **Folosit de:** Toate rutele din `offers.js`, `businesses.js`, `reviews.js`, etc.

### Pattern AJAX Web
Paginile EJS care au interactiuni (favorite, follow, delete, etc.) folosesc:
```
Client JS → fetch('/api/web/...', { method, body }) → web.js route (cookie auth) → DB → JSON response
```
Cookie-ul se trimite automat cu fetch (same-origin). NU se trimite Bearer token.

---

## CE ESTE COMPLET

### Migrare Completa Site EJS (Faza 3 — COMPLETA)
- [x] **Auth web:** Login, Register, Forgot Password, Reset Password (cookie JWT)
- [x] **Pagini detaliu:** Offer detail, Business detail (cu reviews, follow, favorite, navigate)
- [x] **Navigatie:** Categorii, Categorie individuala, Orașe, Oraș individual, 404
- [x] **Cont:** Account page, Colecția mea (favorites + subscriptions), Setări, Preferințe
- [x] **Static:** Termeni, Confidențialitate, Ajutor & Suport, Business CTA
- [x] **Business Portal Web:** Dashboard, Manage (4 tabs: Info/Oferte/Recenzii/Statistici), Offer form
- [x] **Portal features:** Image upload/delete (logo + cover), CRUD oferte, review responses, analytics, performance score
- [x] **Navbar:** User menu dropdown, Portal link (business_owner/admin only), mobile menu
- [x] **main.js:** Toast system, toggleFavorite, toggleFollow, FAQ accordion, star rating, geolocation + distance
- [x] **Trust proxy:** Configurat pentru Railway/Cloudflare (cookie Secure, rate limiter IP)

### Security + Quick Wins + Mobile Features (Faza 3.7 — COMPLETA)
- [x] **Helmet.js** security headers (CSP disabled for EJS inline scripts, COEP disabled for external images)
- [x] **Urgency badges** pe offer cards (expiring soon indicator)
- [x] **Social proof** (favorite count) pe offer cards
- [x] **Share button** pe offer-detail (Web Share API + clipboard fallback)
- [x] **Search autosuggest** (debounced 300ms, skeleton loading, z-index layering)
- [x] **Followed offers section** pe home page
- [x] **Mobile:** deep linking, offline cache (cachedFetch + AsyncStorage TTL), haptics, share, offline banner

### Visual Polish + Bugfixes (Faza 3.8 — COMPLETA)
- [x] **Particle hero background** (canvas 2D, generic multi-instance, cursor attraction)
- [x] **Particles pe auth pages** (login, register, forgot-password)
- [x] **TiltFx 3D card hover** (offer cards perspective transform)
- [x] **Toast progress bar** animation
- [x] **Fade edge scrollers** pe filter bars
- [x] **Scroll arrows** pe filter bars (horizontal scroll guidance, non-overlapping)
- [x] **Removed:** TypeFx (incompatible cu text-gradient), testimonials section
- [x] **Fix:** hero title invisible (TypeFx + background-clip:text conflict)
- [x] **Fix:** requireWebAuth returns 401 JSON for `/api/` routes (nu HTML redirect)
- [x] **Fix:** business-detail cover image flash (class mismatch `.bd-hero`)
- [x] **Fix:** business follow button uses shared `toggleFollow()` with toast
- [x] **Fix:** search dropdown z-index overlap with CTA buttons
- [x] **Fix:** returnTo flow (login + register) — redirect back after auth
- [x] **Fix:** scroll arrows don't overlap filter pill text

### Feature Parity cu Mobile App (Faza 3.5 — COMPLETA)
- [x] **Ratings pe offer cards:** Rating average + count pe fiecare card (home bento + oferte grid)
- [x] **Business logo pe cards:** Logo inline (40px, border-radius 10px) in content area, flex row layout
- [x] **Sort options:** Cele mai noi / Populare / Reducere mare pe /oferte
- [x] **Business description:** Sectiune "Despre" pe business-detail.ejs
- [x] **Booking info per locatie:** Telefon/WhatsApp/URL + instructiuni per business_locations
- [x] **Distance from user:** Geolocation API + Haversine formula, arata "X.X km" sau "XXX m" pe fiecare card
- [x] **Visual polish:** Sort bar cu border separator, filter bar spacing, collection tab badges

### Add Business Feature (Faza 3.6 — COMPLETA)
- [x] **Form /pentru-business** cu AI validation (Claude Haiku scoring 0-100 + flags + reasoning)
- [x] **Admin panel** `/admin/business-requests` (list, approve→creates business+owner, reject with reason)
- [x] **Email notifications** business approved + rejected (Resend, non-blocking)
- [x] **Request tracker** "Cererile tale" pe /pentru-business — status cards (pending/approved/rejected)
- [x] **"Reia procesul"** button — prefills form cu datele din cererea respinsa
- [x] **Auto-cleanup** — cererea veche rejected se sterge automat la retry (via `replaces_rejected_id`)
- [x] **Status indicator pe /cont** — account menu item colorat dupa status
- [x] **DB migration 013** — `business_requests` table (AI fields, status flow, business_id FK)

### Infrastructura
- [x] Backend deployed pe Railway cu PostgreSQL
- [x] Domeniu custom ofai.ro configurat (Cloudflare DNS)
- [x] CORS configurat (restrictionat in productie)
- [x] SSL automat (Cloudflare Full mode)
- [x] **Trust proxy** — `app.set("trust proxy", 1)` in production
- [x] **Rate Limiting** — 100 req/min general, 10/15min auth, 5/15min verify-reset-code, 200/min admin
- [x] **Sentry** — error tracking in productie
- [x] **Database Indexes** — queries optimizate
- [x] **statement_timeout** — 10s max per query

### Business Portal (Web + Mobile API)
- [x] **Web Portal** (`/portal`, `/portal/:businessId`)
  - Dashboard cu lista business-uri owner
  - Manage page cu 4 tabs: Info | Oferte | Recenzii | Statistici
  - Image upload/delete (logo + cover) via Cloudinary
  - Edit business info (name, address, phone, website, city, category, booking)
  - Offer CRUD (create, edit, toggle active/inactive)
  - Review response management (create, edit, delete)
  - Analytics: views, subscribers, reviews, rating distribution, offer views
  - Performance score (10 criteria, 100 points total)
- [x] **Mobile API** (`business-portal.js`) — REST API cu Bearer token auth

### n8n Workflow Automation
- [x] WF1: New Review → Email Owner (via Resend)
- [x] Webhook triggers integrati in: auth.js, reviews.js, business-portal.js, admin.js, subscriptions.js

### AI Review Summarization (Claude Haiku)
- [x] Batch job scheduled la 2 zile (Railway Cron, 03:00 AM)
- [x] Admin panel: `/admin/review-summaries`
- [x] Frontend: card "Pe baza recenziilor" pe business detail page

---

## CE TREBUIE FACUT / CUNOSCUT

### ⚠️ VERIFICARI PENDINTE (Add Business Feature — v10)
Feature-ul "Add Business" a fost implementat recent si necesita verificari end-to-end:
- [ ] Verify "Reia procesul" button works (prefill + scroll + submit + old request deleted)
- [ ] Verify email notifications arrive correctly (approve + reject scenarios)
- [ ] Verify `/cont` status indicator shows correct state for each status
- [ ] Verify form disables when pending or approved request exists
- [ ] Verify scroll position after clicking "Reia procesul" (should target section header)
- [ ] Test edge cases: multiple requests history, retry after approve/reject
- [ ] Verify admin approve flow creates business + assigns ownership + upgrades role
- [ ] Verify admin panel `/admin/business-requests` sorts and filters correctly

### 1. Scraping Pipeline (NOU — gata de rulat)
Pipeline complet Playwright + OpenRouter pentru business-uri reale din Google Maps:
```bash
cd C:\Users\tiber\Desktop\AppReduceri\appredueri_backend
# Adaugă OPENROUTER_KEY în .env (de pe openrouter.ai/keys)
npm run scrape           # Faza 1: ~3-4 ore, resumable
npm run scrape:enrich    # Faza 2: ~10-20 min, cost ~$0.10
npm run scrape:verify    # Verificare calitate
npm run scrape:cleanup   # Ștergere dacă e nevoie
```
Business-urile scrapate au `source='scraped'` în DB. Seed-urile au `source='seed'`.

### 2. n8n Workflows de implementat
WF1 (New Review → Email Owner) este complet. Restul:
- **WF2:** New Offer → Push notification la followers
- **WF3:** Daily digest (oferte noi din ziua precedenta)
- **WF4-WF6:** Review reminder, Welcome series, Admin alerts

### 3. Footer link-uri
Link-urile din footer sunt pe `#` — trebuie actualizate la paginile EJS existente.

### 4. Galerie imagini business
`business_images` (galerie) NU este inca in portal manage page. Doar logo si cover au upload/delete.

### 5. Oferte Nu Apar
Ofertele trebuie sa aiba `is_active = TRUE` si `end_date >= CURRENT_DATE`:
```sql
UPDATE offers SET end_date = '2026-12-31' WHERE end_date < CURRENT_DATE;
```

### 6. Seed + Scraping Production Database
```bash
cd C:\Users\tiber\Desktop\AppReduceri\appredueri_backend
# Seed fictiv (450 business-uri DiceBear/Picsum):
DATABASE_URL="postgresql://postgres:REDACTED@REDACTED_DB_HOST/railway" NODE_ENV=production node scripts/seed-businesses.js
# Cleanup seed:
DATABASE_URL="..." NODE_ENV=production node scripts/cleanup-seed.js
# Scraping real (vezi pas 1 mai sus)
```

### 8. Mobile Performance Fix (auditat, neimplementat — Faza 5)
Audit complet făcut. Probleme principale pe Android:
- **FlatList** → înlocuiește cu `@shopify/flash-list` v2 (54% FPS boost)
- **Image din RN** → înlocuiește cu `expo-image` (cache nativ Glide pe Android)
- **Animated API** → înlocuiește cu `react-native-reanimated` v4 (deja instalat!)
- **React.memo** lipsește pe OfferCard, BusinessCard, CategoryChip
- Contrast slab: textMuted (#52525b) pe card bg (#0d0d12) — trebuie mai deschis
- Opțional: Unistyles 3.0 pentru C++ style computation (off JS thread)

### 9. Pricing Model (researched, neimplementat)
Recomandare: Freemium + 3 tiers subscripție:
- **Gratuit:** 0 RON — profil + 1 ofertă/lună
- **Start:** 49 RON/lună — 5 oferte, analytics, priority
- **Professional:** 99 RON/lună — nelimitat, featured, push
- **Premium:** 199 RON/lună — multi-locație, banner, account manager
- **Pay-per-offer:** 29 RON/ofertă individuală

---

## ARHITECTURA web.js (FISIERUL PRINCIPAL — ~1300+ linii)

`src/routes/web.js` contine TOTUL pentru site-ul public:

### Imports & Config
```
express, pool, bcrypt, jwt, webAuth, businessWebAuth, multer, cloudinary, email, n8n, validate
```

### Rute Pagini EJS (GET)
```
/                    → home.ejs
/oferte              → oferte.ejs
/oferta/:id          → offer-detail.ejs
/business/:id        → business-detail.ejs
/categorii           → categorii.ejs
/categorie/:slug     → categorie.ejs
/orase               → orase.ejs
/oras/:slug          → oras.ejs
/login               → login.ejs
/register            → register.ejs
/forgot-password     → forgot-password.ejs
/reset-password      → reset-password.ejs
/account             → account.ejs (requireWebAuth)
/colectia-mea        → colectia-mea.ejs (requireWebAuth)
/setari              → setari.ejs (requireWebAuth)
/preferinte          → preferinte.ejs (requireWebAuth)
/termeni             → termeni.ejs
/confidentialitate   → confidentialitate.ejs
/ajutor              → ajutor.ejs
/pentru-business     → pentru-business.ejs (form + AI validation + request tracker + retry)
/portal              → portal/dashboard.ejs (requireBusinessOwner)
/portal/:businessId  → portal/manage.ejs (requireBusinessOwner)
/portal/:bId/oferta-noua       → portal/offer-form.ejs
/portal/:bId/oferta/:offerId   → portal/offer-form.ejs (edit)
```

### Rute Auth (POST)
```
POST /login          → autentificare + set cookie
POST /register       → inregistrare + set cookie
POST /forgot-password → trimite cod reset pe email
POST /reset-password → reseteaza parola
POST /logout         → clear cookie
```

### Rute AJAX Web (cookie auth, JSON responses)
```
POST   /api/web/favorites          → adauga favorit
DELETE /api/web/favorites/:offerId → sterge favorit
POST   /api/web/subscriptions      → urmareste business
DELETE /api/web/subscriptions/:bId → nu mai urmareste
POST   /api/web/reviews            → adauga recenzie
PUT    /api/web/account            → update profil
PUT    /api/web/account/password   → schimba parola
DELETE /api/web/account            → sterge cont
PUT    /api/web/preferences        → update preferinte
GET    /api/web/search/suggest    → search autosuggest (offers + businesses, debounced)
```

### Rute Business Requests API (cookie auth, separate router)
```
POST   /api/business-requests       → submit new business request (AI validated, replaces_rejected_id)
GET    /api/business-requests/mine  → get user's requests (all fields for prefill on retry)
```

### Rute Portal AJAX (cookie auth + business ownership)
```
PUT    /api/web/portal/:bId              → update business info
POST   /api/web/portal/:bId/logo        → upload logo (multer + cloudinary)
POST   /api/web/portal/:bId/cover       → upload cover
DELETE /api/web/portal/:bId/logo        → delete logo
DELETE /api/web/portal/:bId/cover       → delete cover
POST   /api/web/portal/:bId/offers      → creare oferta
PUT    /api/web/portal/:bId/offers/:oId → editare oferta
PATCH  /api/web/portal/:bId/offers/:oId/toggle → toggle activ/inactiv
POST   /api/web/portal/:bId/reviews/:rId/response   → raspuns recenzie
PUT    /api/web/portal/:bId/reviews/:rId/response    → edit raspuns
DELETE /api/web/portal/:bId/reviews/:rId/response    → sterge raspuns
GET    /api/web/portal/:bId/analytics    → date analytics (views, subs)
```

---

## DESIGN SYSTEM

### CSS Custom Properties (main.css)
```css
--bg-primary: #06060a
--bg-secondary: #0c0c12
--bg-card: rgba(255,255,255,0.04)
--accent: #fb923c (orange)
--accent-hover: #f97316
--text-primary: #f4f4f5
--text-secondary: #a1a1aa
--text-tertiary: #71717a
--border: rgba(255,255,255,0.08)
```

### Pattern vizual
- **Dark theme** cu accent portocaliu
- **Glassmorphism** (backdrop-filter + -webkit-backdrop-filter + rgba bg)
- **Cards** cu border subtil + hover glow
- **Scroll reveal** via IntersectionObserver
- **Responsive** cu breakpoints la 768px si 500px
- **Fonturi:** Inter (body) + DM Serif Display (titluri) via Google Fonts CDN

### IMPORTANT Safari: Foloseste MEREU `-webkit-backdrop-filter` inainte de `backdrop-filter`

---

## FIXURI CUNOSCUTE & GOTCHAS

### 1. Unicode in EJS
EJS nu interpreteaza `\u0103` ca `ă`. Trebuie folosite caractere UTF-8 reale in fisierele .ejs.
Daca vezi caractere garbled (Urm\ăre\ști), inseamna ca sunt escape sequences in fisier.

### 2. Cookie auth pe web vs Bearer auth pe mobile
- Web: Cookie `ofai_token` trimis automat cu fetch (same-origin)
- Mobile: Header `Authorization: Bearer <token>`
- NU amesteca! web.js foloseste DOAR cookie, business-portal.js DOAR Bearer.

### 3. colectia-mea.ejs — server-side rendering
Pagina Colecția mea renderizeaza datele SERVER-SIDE (favorites si subscriptions arrays).
NU face fetch client-side. Variabilele vin din ruta GET /colectia-mea din web.js.

### 4. Trust proxy
`app.set("trust proxy", 1)` este NECESAR in production (Railway + Cloudflare).
Fara el: cookie Secure nu functioneaza, rate limiter vede un singur IP.

### 5. Cloudflare www redirect
Railway trebuie sa aiba `www.ofai.ro` adaugat ca custom domain.
Safari iOS adauga automat `www.` — fara record, site-ul nu se incarca pe iPhone.

### 6. requireWebAuth — dual behavior (API vs page)
`requireWebAuth` detecteaza `req.path.startsWith("/api/")`:
- **API routes** → `res.status(401).json({ message: "..." })` (pentru `fetch()` calls)
- **Page routes** → `res.redirect("/login")` (pentru navigare directa in browser)
Fara asta, `fetch()` urmareste 302 transparent → primeste 200 cu HTML → `resp.json()` da "Unexpected token '<'".

### 7. returnTo flow (login + register)
`main.js` adauga `?returnTo=<currentURL>` la redirect `/login` pe 401.
- `login.ejs` / `register.ejs` citesc `returnTo` din URLSearchParams, trimit in POST body
- Backend valideaza (only `/` prefix, no `//` → open-redirect protection)
- Link-urile "Inregistreaza-te" / "Ai deja cont?" propaga returnTo intre pagini
- Pattern: `const safeRedirect = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/cont";`

### 8. business-detail hero class = `.bd-hero`
CSS targeteaza `.bd-hero` cu `height: 280px; overflow: hidden`.
HTML-ul TREBUIE sa aiba `class="bd-hero"` (NU `.business-detail-hero`).
Mismatch = imaginea cover apare fullscreen pentru o fractiune de secunda.

---

## COMENZI UTILE

### Development
```bash
# Backend + Website EJS
cd C:\Users\tiber\Desktop\AppReduceri\appredueri_backend
npm run dev

# Mobile (Expo)
cd C:\Users\tiber\Desktop\AppReduceri\appredueri_mobile
npx expo start --web
```

### Git & Deploy
```bash
cd C:\Users\tiber\Desktop\AppReduceri
git add appredueri_backend/src/...
git commit -m "descriere"
git push
# Railway se actualizeaza automat
```

### Scraping Pipeline
```bash
cd C:\Users\tiber\Desktop\AppReduceri\appredueri_backend
npm run scrape              # Faza 1: Playwright → Google Maps (~3-4 ore, resumable)
npm run scrape:enrich       # Faza 2: OpenRouter LLM → DB (~10-20 min, ~$0.10)
npm run scrape:verify       # Verificare calitate
npm run scrape:cleanup      # Ștergere dacă e nevoie
# Debug (vezi browser): SCRAPE_HEADLESS=false npm run scrape
```

### Seed Management
```bash
cd C:\Users\tiber\Desktop\AppReduceri\appredueri_backend
# Seed 450 fictive:
DATABASE_URL="..." NODE_ENV=production node scripts/seed-businesses.js
# Cleanup seed:
DATABASE_URL="..." NODE_ENV=production node scripts/cleanup-seed.js
# Verify:
DATABASE_URL="..." NODE_ENV=production node scripts/verify-seed.js
```

### Database (Railway Production)
```bash
psql "postgresql://postgres:REDACTED@REDACTED_DB_HOST/railway"
```

### n8n
```
Dashboard: https://n8n-production-d2f4.up.railway.app
Webhook base: https://N8N_WEBHOOK_REDACTED
Workflows active: WF1 (new-review → email owner)
```

---

## SERVICII EXTERNE CONFIGURATE

### Cloudflare (DNS + CDN)
- **Dashboard:** https://dash.cloudflare.com
- **Domeniu:** ofai.ro
- **DNS:** CNAME `@` + `www` → vurfk849.up.railway.app (proxy ON)
- **SSL:** Full mode
- **Nameservers:** Configurate la registrar (rotld.ro)

### Sentry (Error Tracking)
- **Dashboard:** https://sentry.io → ofai-backend

### Resend (Email)
- **Dashboard:** https://resend.com
- **Domeniu:** ofai.ro (DKIM verificat)
- **Email sender:** `OFAI <noreply@ofai.ro>`
- **Email types:** welcome, password_reset, business_approved, business_rejected

### Anthropic / Claude (AI)
- **Model:** Claude 3 Haiku
- **Utilizare:** Review summarization batch job
- **Cost:** ~$0.07/luna

### n8n (Workflow Automation)
- **Dashboard:** https://n8n-production-d2f4.up.railway.app
- **Pattern:** Backend fire-and-forget POST → n8n webhook → Code node → HTTP Request (Resend)
- **Data access in Code node:** `$input.first().json.body` (nu `.json` direct!)

### pgAdmin 4
- Host: `REDACTED_DB_HOST`, Port: `11803`, DB: `railway`, User: `postgres`, SSL: Require

---

## FAZE IMPLEMENTARE

### Faza 1 - Fundatie (COMPLETA)
- [x] Rate limiting, Sentry, Resend email, DB indexes

### Faza 2 - Engagement (COMPLETA)
- [x] Push notifications, EAS Build, Mapbox, nearby offers

### Faza 2.5 - AI & Branding (COMPLETA)
- [x] Claude Haiku review summarization, rebrand OFAI

### Faza 2.7 - Production Hardening & n8n (COMPLETA - v3)
- [x] Security hardening, paginare, n8n WF1, Colectia mea tab

### Faza 2.9 - Design Overhaul + Domain Migration (COMPLETA - v4)
- [x] Mobile design overhaul, Vercel → Railway, Cloudflare DNS, EJS home + oferte

### Faza 3 - Migrare Completa Site EJS (COMPLETA - v5)
- [x] Auth web (cookie JWT, login/register/forgot/reset)
- [x] Offer detail + Business detail pages
- [x] Categorii + Orașe + 404
- [x] Cont utilizator + Colecția mea + Setări + Preferințe
- [x] Pagini legale + Ajutor + Business CTA
- [x] Business Portal Web (dashboard, manage, offer form)
- [x] Portal image upload/delete (logo + cover)
- [x] Trust proxy + Safari webkit fixes
- [x] Unicode fixes (Romanian diacritics in EJS)

### Faza 3.6 — Add Business + Business Requests (COMPLETA - v10)
- [x] /pentru-business form (name, category, city, address, phone, website, description)
- [x] AI validation pipeline (Claude Haiku): score 0-100, flags[], reasoning
- [x] business_requests DB table (migration 013) with status flow
- [x] Admin panel: /admin/business-requests (list + approve/reject)
- [x] Admin approve: creates business + user_businesses + upgrades role to business_owner
- [x] Email notifications: approved + rejected (Resend, non-blocking)
- [x] Request tracker UX: status cards on /pentru-business (pending/approved/rejected)
- [x] "Reia procesul" retry: prefill form + auto-delete old rejected (replaces_rejected_id)
- [x] /cont status indicator (account menu item, colored by status)

### Faza 3.7 — Security + Quick Wins + Mobile Features (COMPLETA - v11)
- [x] Helmet.js security headers (CSP disabled, COEP disabled)
- [x] Urgency badges, social proof, share button, search autosuggest
- [x] Followed offers section pe home page
- [x] Mobile: deep linking, offline cache, haptics, share, offline banner

### Faza 3.8 — Visual Polish + Bugfixes (COMPLETA - v11)
- [x] Particle canvas (hero + auth pages), TiltFx 3D cards, toast progress bar
- [x] Fade edge scrollers, scroll arrows pe filter bars
- [x] Removed TypeFx + testimonials
- [x] 8 bugfixes: hero title, webAuth 401, cover flash, follow toast, z-index, returnTo, scroll arrows position

### Faza 3.5 - Feature Parity & Visual Polish (COMPLETA - v6)
- [x] Ratings (avg + count) pe offer cards (home + oferte)
- [x] Business logo inline pe offer cards (40px, flex row layout)
- [x] Sort options pe /oferte (newest/popular/discount)
- [x] Business description pe business-detail
- [x] Booking info per locatie (phone/whatsapp/url + instructions)
- [x] Geolocation + Haversine distance pe offer cards
- [x] SQL fix: removed non-existent o.created_at column
- [x] Visual polish: sort bar, filter bar, collection tabs, offer card layout

### Faza 4 - Mobile UX Redesign (COMPLETA - v7)
- [x] Home screen: scroll redus de la 1047px la ~286px pana la prima oferta
- [x] CategoryChip (pill-shaped 34px) in loc de CategoryCard (140px)
- [x] Inline dismissible banners (48px) in loc de full-height cards (200px)
- [x] NeonSearchBar: animated border glow (pulse idle + focus glow)
- [x] OfferCard compactat: 280→200px featured, 16/9 aspect ratio
- [x] Removed: stats row, redundant SectionHeaders, floating CTA
- [x] Fix: useNativeDriver conflict (dual Animated.View wrapper)

### Faza 4.5 - Seed Rewrite + Scraping Pipeline (COMPLETA - v8)
- [x] Seed rewrite: 450 business-uri complete (15 orașe × 15 categorii × 2)
- [x] Toate câmpurile completate: description, booking_instructions, offer descriptions
- [x] Cleanup + verify scripts
- [x] DB migration: `source` column pe businesses (manual/seed/scraped)
- [x] Scraping pipeline Playwright + OpenRouter (7 fișiere)
  - Phase 1: Playwright headless → Google Maps → JSON local (resumable)
  - Phase 2: DeepSeek LLM enrichment → PostgreSQL insert
  - Phase 3: Verify + Cleanup scripts
- [x] Cost estimat scraping: ~$0.10 (doar OpenRouter tokens)

### Faza 5 - Mobile Performance & Visual Polish (TODO — v9, recomandat ca următoare)
**Audit complet făcut. Recomandare aprobată. Abordare în 2 faze:**

**Faza 5A — Quick Performance Wins (1-2 zile):**
- [ ] `FlatList` → `@shopify/flash-list` v2 (54% FPS improvement pe Android)
- [ ] `Image` din RN → `expo-image` peste tot (cache nativ, progressive loading)
- [ ] `Animated` API → `react-native-reanimated` v4 (animații pe UI thread, nu bridge)
- [ ] `React.memo` pe OfferCard, BusinessCard, CategoryChip (prevent re-renders)
- [ ] Fix contrast: textMuted mai deschis, opacity disabled 0.35→0.5
- [ ] Skeleton loaders pe ecranele de detaliu (business, offer)
- [ ] Consistență spacing/typography (totul din theme.ts, nu hardcoded)
- [ ] Consistență search bar styling între ecrane
- [ ] Image placeholders (expo-image placeholder prop)
- [ ] Fix: card/cardHover identice `rgba(255,255,255,0.03)` — diferențiere hover

**Faza 5B — Unistyles 3.0 (opțional, 2-3 zile):**
- [ ] Install `react-native-unistyles`
- [ ] Creare Unistyles theme din `theme.ts` tokens (mapare aproape 1:1)
- [ ] Migrare graduală `StyleSheet.create()` → `createStyleSheet()` per component
- [ ] Câștig: computare stiluri în C++ (off JS thread), zero re-renders la theme switch

**Librării evaluate și RESPINSE:**
- NativeWind v4/v5 — bug-uri cu Expo SDK 54 + React 19 + Reanimated v4
- Tamagui — rewrite complet UI, cost prea mare vs beneficiu
- Gluestack v3 — depinde de NativeWind (aceleași probleme)
- RN Paper (MD3) — impune Material Design, conflictă cu designul glassmorphic
- react-native-reusables (shadcn) — depinde de NativeWind

### Faza 6 - Monetizare (TODO)
- [ ] Pricing: Freemium + 3 tiers (49/99/199 RON/lună) + pay-per-offer (29 RON)
- [ ] Stripe integration
- [ ] Dashboard analytics avansate
- [ ] Featured/sponsored offers

### Faza 7 - Scalare (TODO)
- [ ] Self-service onboarding
- [ ] Referral system
- [ ] Deep links
- [ ] n8n WF2-WF6
- [ ] iOS Build (necesita Mac/Apple Developer $99/an)
- [ ] Play Store publicare

---

## PRIORITATI URMATOARE

1. **🔍 Verificari Add Business (v10)** — test end-to-end: retry button, emails, /cont indicator, admin flow (vezi lista completa mai sus)
2. **📱 Mobile Performance (Faza 5A)** — FlashList + expo-image + Reanimated + React.memo (cel mai mare impact vizual)
3. **Rulează scraping pipeline** — `npm run scrape` + `npm run scrape:enrich` pt date reale
4. **📱 Unistyles 3.0 (Faza 5B, opțional)** — C++ style engine, zero-rerender themes
5. **Monetizare** — implementează Stripe + pricing tiers (49/99/199 RON)
6. **Galerie imagini** — upload/delete gallery images in portal
7. **Footer link-uri** — actualizeaza link-urile din footer.ejs
8. **n8n WF2-WF6** — workflow-uri suplimentare
9. **iOS Build** — necesita Mac sau cont Apple Developer ($99/an)
10. **Play Store** — publicare APK pe Google Play
11. **Web polish** — verificare vizuala pe toate paginile, responsive testing, edge cases

---

## ISTORIC ACTUALIZARI

### 11 Februarie 2026 (v11 — Security + Visual Polish + Bugfixes + returnTo)

**Sesiune cu 3 runde: security + quick wins, visual polish Once UI, bugfix rounds.**

**Batch 1 — Security + Quick Wins:**
- Helmet.js security headers (`src/index.js`)
- Urgency badges, social proof (favorite count), share button pe offer cards
- Search autosuggest (debounced 300ms, skeleton loading, z-index layering)
- Followed offers section pe home page
- Mobile: offline cache (`cachedFetch` + AsyncStorage TTL), haptics, share, offline banner

**Batch 2 — Visual Polish (Once UI inspired):**
- Particle canvas (hero + auth pages) — canvas 2D, cursor attraction, IntersectionObserver pause
- TiltFx 3D card hover (offer cards perspective transform)
- Toast progress bar animation
- Fade edge scrollers pe filter bars
- Scroll arrows pe filter bars (horizontal scroll guidance)

**Batch 3 — Bugfixes:**
- Hero title invisible — TypeFx removed (incompatible cu `background-clip: text` gradient)
- Testimonials section removed (hardcoded fake data, visually poor)
- `requireWebAuth` returns 401 JSON for `/api/` routes (nu HTML redirect)
- Business-detail cover flash fix (HTML class mismatch `business-detail-hero` → `bd-hero`)
- Business follow button fix (uses shared `toggleFollow()` from main.js with toast)
- Search dropdown z-index fix (`.search-wrapper` z-index: 10 stacking context)
- returnTo flow (login + register) — redirect back to original page after auth
- Scroll arrows positioning fix (padding on container, arrows outside content area)

**Fișiere create:**
- `app/lib/cache.ts` — mobile offline cache (cachedFetch with AsyncStorage + TTL)

**Fișiere modificate:**
- `src/index.js` — Helmet.js middleware
- `src/middleware/webAuth.js` — 401 JSON for API routes (isApi check)
- `src/routes/web.js` — search autosuggest API, returnTo on login+register, followed offers query, 3 offer queries modified (end_date + favorite_count)
- `src/public/css/main.css` — particles, TiltFx, toast progress, scroll arrows, urgency, social proof, search autosuggest, z-index fixes (~3370 linii). Removed: TypeFx CSS, testimonials CSS
- `src/public/js/main.js` — particles (generic multi-instance), scroll arrows, search autosuggest, TiltFx, share, returnTo (~660 linii). Removed: TypeFx, testimonials
- `src/views/public/home.ejs` — particle canvas, followed offers, urgency badges, scroll arrows. Removed: testimonials section
- `src/views/public/oferte.ejs` — urgency badges, social proof, scroll arrows wrappers
- `src/views/public/offer-detail.ejs` — share button
- `src/views/public/business-detail.ejs` — class fix `bd-hero`, follow button uses `toggleFollow()`
- `src/views/public/login.ejs` — particle canvas, returnTo flow, register link preserves returnTo
- `src/views/public/register.ejs` — particle canvas, returnTo flow, login link preserves returnTo
- `src/views/public/forgot-password.ejs` — particle canvas
- Mobile: `app/_layout.tsx` (offline banner), `app/business/[id].tsx` (share+haptics), `app/offer/[id].tsx` (share+haptics), `components/StarRating.tsx` (haptics)

---

### 11 Februarie 2026 (v10 — Add Business Feature + Email Notifications + Retry UX)

**Feature complet "Add Business" — de la form la admin approve, cu email si retry UX:**

**Batch 1 (sesiune anterioara — feature core):**
- `bb2820c`: Add Business form pe /pentru-business + AI validation (Claude Haiku scoring 0-100) + admin panel /admin/business-requests + migration 013_business_requests
- `86f6ae8`: Quick fix approve flow (admin.js)

**Batch 2 (sesiune curenta — email + UX + bug fixes):**
- `bfd5b38`: Email notifications for business request approve/reject (Resend SDK, non-blocking)
- `f599aa8`: UX — request tracker "Cererile tale" cu status cards, retry cu prefill, fix email link (/business-portal→/cont)
- `bc3d76e`: Add business request status card to /cont page (account menu item)
- `e9051ba`: Fix /cont card styling — use standard account-menu-item class (era ugly custom card)
- `749e7bf`: Fix "Reia procesul" button — store data in global var instead of broken onclick JSON escaping
- `37f6c46`: Fix scroll position (#adauga-business section header) + auto-delete old rejected request on retry

**Fisiere create:**
- `src/routes/businessRequests.js` — POST submit + GET mine
- `src/services/llm/businessValidation.js` — AI validation pipeline
- `src/views/admin/business-requests.ejs` — Admin panel UI
- `src/migrations/013_business_requests.sql` — DB table

**Fisiere modificate:**
- `src/routes/admin.js` — approve/reject routes + email send
- `src/services/email.js` — +sendBusinessApprovedEmail, +sendBusinessRejectedEmail
- `src/routes/web.js` — /cont query for bizRequest status, /pentru-business page
- `src/views/public/account.ejs` — status menu item
- `src/views/public/pentru-business.ejs` — complet rescris (form + tracker + retry)
- `src/helpers/validate.js` — +validateBusinessRequest
- `src/public/css/main.css` — temporary custom styles (added then removed)

**Verificari pendinte pentru urmatoarea sesiune:**
- Test end-to-end: retry button, email notifications, /cont indicator, admin approve/reject flow
- Edge cases: multiple cereri, retry dupa approve, scroll position

---

### 10 Februarie 2026 (v9 — Mobile Performance Audit + UI Library Research)

**Audit complet al aplicației mobile + evaluare librării UI:**

1. **Visual/UX Audit complet** (toate ecranele + componente)
   - Probleme identificate: contrast slab (textMuted pe card bg), hardcoded spacing/colors
   - Animated API vechi (bridge) în loc de Reanimated v4 (UI thread) — impact Android
   - Image din react-native în loc de expo-image — lipsă cache nativ
   - FlatList standard în loc de FlashList — 54% FPS loss pe Android
   - Card/cardHover identice, shadow-uri iOS-only, search bars inconsistente între ecrane
   - Lipsă skeleton loaders, image placeholders, loading states pe butoane

2. **Evaluare 7 librării UI** pentru React Native / Expo SDK 54
   - **Unistyles 3.0** — RECOMANDAT (C++ engine, lowest migration, best Android perf)
   - **Custom Polish** — RECOMANDAT ca Faza 1 (FlashList + expo-image + Reanimated)
   - NativeWind v4/v5 — RESPINS (bug-uri SDK 54 + React 19)
   - Tamagui — RESPINS (rewrite complet, cost prea mare)
   - Gluestack v3 — RESPINS (NativeWind dependency)
   - RN Paper (MD3) — RESPINS (conflictă cu designul custom)
   - react-native-reusables — RESPINS (NativeWind dependency)

3. **Recomandare aprobată:** Abordare în 2 faze
   - Faza 5A: Quick wins (FlashList, expo-image, Reanimated, React.memo, contrast fixes)
   - Faza 5B: Unistyles 3.0 (opțional, C++ style computation)

**Niciun fișier creat/modificat** — doar research și documentare

---

### 10 Februarie 2026 (v8 — Scraping Pipeline + Cleanup)

**Sesiune scraping pipeline + documentație cleanup:**

1. **Seed Rewrite** (complet, rulat pe producție)
   - Șterse 1000 business-uri vechi, inserare 450 noi (15×15×2)
   - Toate câmpurile completate: descriptions, booking, offers cu condiții
   - cleanup-seed.js + verify-seed.js + verify-gaps.js create

2. **Scraping Pipeline Playwright + OpenRouter** (complet, gata de rulat)
   - 7 fișiere noi în `scripts/scraping/`
   - Phase 1: Playwright headless Google Maps scraper cu stealth plugin
   - Phase 2: DeepSeek LLM enrichment (descrieri RO, oferte, booking) → PostgreSQL
   - Resume capability (crash recovery via state.json)
   - Verify + cleanup scripts

3. **DB Migration 012: source column**
   - `businesses.source` = 'manual' / 'seed' / 'scraped'
   - Rulat pe producție, 450 seed-uri taggate

4. **Pricing Research** (neimplementat)
   - Freemium + 3 tiers: 49/99/199 RON/lună
   - Pay-per-offer: 29 RON/ofertă
   - Boost add-ons: 19-79 RON

5. **Documentație Cleanup**
   - Șterse 10 fișiere .md outdated (PROJECT_NOTES, CHANGELOG_LLM, SETUP_COMPLETE, etc.)
   - HANDOFF_DOCUMENT actualizat cu tot ce s-a implementat

**Fișiere create:**
- `scripts/scraping/{config,utils,state,01-scrape,02-enrich-and-insert,03-verify,04-cleanup}.js`
- `scripts/{cleanup-seed,verify-seed,verify-gaps}.js`
- `src/migrations/012_add_source_column.sql`

**Fișiere modificate:**
- `package.json` — adăugate playwright deps + npm scripts (scrape, scrape:enrich, etc.)
- `.gitignore` — adăugat `scripts/scraping/data/`
- `.env` — adăugat OPENROUTER_KEY

**Fișiere șterse (.md cleanup):**
- PROJECT_NOTES.md, CHANGELOG_LLM.md, LLM_INTEGRATION_GUIDE.md, REVIEWS_SUMMARIZATION_PLAN.md
- SETUP_COMPLETE.md, directives/*, execution/*, .tmp/README.md, .cursor/plans/*

---

### 10 Februarie 2026 (v7 — Mobile UX Redesign)

**Sesiune de redesign complet al home screen-ului mobil:**

1. **Home Screen UX** — scroll redus de la 1047px la ~286px
   - CategoryChip.tsx (NOU) — pill-shaped 34px în loc de CategoryCard 140px
   - Inline dismissible banners (48px) cu AsyncStorage persist
   - Compact header (greeting + search) în loc de hero section
   - Sort pills în ScrollView horizontal
   - Removed: stats row, floating CTA, redundant SectionHeaders

2. **NeonSearchBar Revamp** — animații noi
   - Idle: border pulses between border → borderAccent (2s sine cycle)
   - Focus: border accent + scale 1.02x
   - Dual Animated.View (native driver scale + JS driver borderColor)

3. **OfferCard compactat**
   - Featured height: 280→200px, Standard aspect: 16/9
   - Content padding: 16→14, margin bottom: 14→12

**Fișiere create:** `components/CategoryChip.tsx`
**Fișiere modificate:** `app/(tabs)/index.tsx` (1390→1237 linii), `components/OfferCard.tsx`, `components/SectionHeader.tsx`, `components/HomeSkeleton.tsx`

---

### 9 Februarie 2026 (v6 — Feature Parity & Visual Polish)

**Sesiune de feature parity cu mobile app + visual polish:**

1. **Feature Parity cu Mobile App**
   - Ratings (average + count) pe fiecare offer card (home bento grid + /oferte grid)
   - Business logo inline in card content (40px, flex row cu titlu/rating)
   - Sort options pe /oferte: Cele mai noi / Populare / Reducere mare
   - Business description sectiune pe business-detail
   - Booking info per locatie (telefon/whatsapp/url + instructiuni booking)
   - Geolocation + Haversine distance (portat din mobile `distance.ts`): arata "X.X km" sau "XXX m"

2. **Visual Polish**
   - Offer card layout restructurat: logo inline (nu floating overlay)
   - Sort bar cu border-bottom separator
   - Filter bar spacing optimizat
   - Collection tab badges (colectia-mea)
   - Booking actions row cu border-top separator
   - Booking instructions dashed border box

3. **Bug Fixes**
   - SQL fix: `o.created_at` column nu exista in offers table — inlocuit cu `o.id DESC`
   - Logo overlay rendering fix: era oversized din cauza `overflow: hidden` lipsa pe `.offer-card`
   - Featured card gradient scoped doar pe `.offer-card.featured`

**Fisiere modificate:**
- `src/routes/web.js` — SQL queries: added b.lat/b.lng, ratings JOIN, sort options, removed o.created_at
- `src/public/css/main.css` — offer card restructure, logo inline, sort bar, filter bar, collection tabs, booking styles
- `src/public/js/main.js` — initGeolocation(), haversineKm(), formatDistance(), updateDistances()
- `src/views/public/home.ejs` — offer card restructure (logo inline + distance placeholder)
- `src/views/public/oferte.ejs` — offer card restructure (logo inline + distance placeholder + sort bar)
- `src/views/public/offer-detail.ejs` — booking actions row styling
- `src/views/public/business-detail.ejs` — description section, booking per location, actions row

**Commits:** 89f8f74, fed51b2, cd75057, 4e2db96

---

### 9 Februarie 2026 (v5 — Migrare EJS Completa + Business Portal Web)

**Sesiuni multiple (3 sesiuni) — migrare completa a tuturor functionalitatilor din app-ul mobil pe site-ul EJS:**

1. **Migrare EJS Completa (Batch 1-5)**
   - Toate paginile create: auth, detaliu, navigatie, cont, static, portal
   - web.js extins de la ~100 linii la ~1300+ linii
   - 20+ template-uri EJS noi
   - Cookie-based JWT auth system (webAuth.js)
   - AJAX proxy pattern (/api/web/*) pentru interactiuni client-side

2. **Business Portal Web (NOU)**
   - businessWebAuth.js middleware (cookie auth + ownership)
   - Dashboard: lista business-uri owner
   - Manage: 4 tab-uri (Info/Oferte/Recenzii/Statistici)
   - Image upload/delete (logo + cover) via multer + Cloudinary
   - Offer CRUD, review responses, analytics, performance score
   - Offer form (create/edit) cu toate campurile

3. **Fixuri**
   - Unicode escape sequences in EJS (Romanian diacritics: ă, ș, ț, î, â)
   - colectia-mea.ejs rescris pentru server-side rendering
   - offer-detail.ejs location booking inlocuit cu Navigate button
   - business-detail.ejs: review data paths, API URLs, follow endpoint
   - preferinte.ejs: variable name mismatches
   - Trust proxy adaugat in index.js
   - Webkit backdrop-filter prefixes in main.css

4. **Problema activa: Safari/iOS**
   - DNS rezolva corect (Cloudflare)
   - Railway returneaza 404 pe www.ofai.ro
   - SOLUTIE: Adauga www.ofai.ro ca custom domain in Railway

**Fisiere create:**
- `src/middleware/businessWebAuth.js`
- `src/views/public/portal/dashboard.ejs`
- `src/views/public/portal/manage.ejs` (~1350 linii)
- `src/views/public/portal/offer-form.ejs` (~744 linii)
- `src/views/public/offer-detail.ejs`
- `src/views/public/business-detail.ejs`
- `src/views/public/login.ejs`, `register.ejs`, `forgot-password.ejs`, `reset-password.ejs`
- `src/views/public/account.ejs`, `colectia-mea.ejs`, `setari.ejs`, `preferinte.ejs`
- `src/views/public/categorii.ejs`, `categorie.ejs`, `orase.ejs`, `oras.ejs`
- `src/views/public/termeni.ejs`, `confidentialitate.ejs`, `ajutor.ejs`, `business-cta.ejs`, `404.ejs`

**Fisiere modificate:**
- `src/routes/web.js` — extins masiv (~1300+ linii)
- `src/index.js` — trust proxy
- `src/public/css/main.css` — webkit prefixes
- `src/public/js/main.js` — toggleFavorite, toggleFollow, toast, FAQ, star rating
- `src/views/public/partials/navbar.ejs` — user menu, portal link, mobile menu

---

### 9 Februarie 2026 (v4)
Design Overhaul (Option A) + Domain Migration + EJS Website Launch (home + oferte)

### 7 Februarie 2026 (v3)
n8n Integration + Production Hardening + Paginare + Colectia Mea tab

### 3 Februarie 2026 (v2)
AI Review Summarization + Rebranding OFAI

### 3 Februarie 2026
EAS Build + Mapbox + UI improvements

### 31 Ianuarie 2026
Push Notifications

### 27 Ianuarie 2026
Faza 1 - Rate limiting, Sentry, Resend email, DB indexes

### 24 Ianuarie 2026
Setup initial proiect

---

## NOTE IMPORTANTE

1. **Website = Backend = Acelasi server:** Site-ul public EJS si API-ul mobil ruleaza pe ACELASI server Express. Rutele web sunt in `web.js`, API-urile mobile in fisiere separate.

2. **Doua medii separate:** Localhost si Productie au baze de date diferite.

3. **Branding:** Peste tot in UI scrie "OFAI". Folderele locale raman `appredueri_*` pentru compatibilitate.

4. **Paginare (v3):** Endpoint-urile mobile returneaza `{ data: [...], pagination: { page, limit, total, totalPages } }`. Site-ul EJS face query-urile direct in web.js (nu prin API-urile mobile).

5. **n8n webhook data:** In Code node: `$input.first().json.body` (nu `.json` direct).

6. **Cloudinary:** Imaginile din productie pe Cloudinary. Upload folder: `ofai/`.

7. **EJS Design:** Toate paginile noi TREBUIE sa refoloseasca clasele existente din main.css si sa includa partials (head, navbar, footer).

8. **Offer Card Structure (v6):** Logo-ul e INLINE in `.offer-content` (flex row), NU floating overlay. Structura:
   ```
   .offer-card > .offer-image-wrapper > img + .offer-badge
                > .offer-content > .offer-content-row > .offer-logo + .offer-content-text
                                  > .offer-meta > city + distance + category
   ```
   Distance se calculeaza client-side via `navigator.geolocation` + Haversine. Elementele `.offer-distance` sunt hidden by default, devin vizibile cand JS populeaza textul. Backend-ul trimite `business_lat` si `business_lng` din queries.

9. **Offers table NU are `created_at`:** Sort "newest" foloseste `o.id DESC` (SERIAL auto-increment). NU folosi `o.created_at` in queries.

10. **Businesses table are coloana `source`** (adaugat migration 012):
    - `'manual'` — create manual sau de admin
    - `'seed'` — generate de seed-businesses.js (DiceBear + Picsum)
    - `'scraped'` — importate din Google Maps via scraping pipeline
    - Folosit pentru cleanup selectiv (`DELETE FROM businesses WHERE source = 'scraped'`)

11. **Mobile App Theme:** Dark mode only. Background `#06060a`, accent `#fb923c`. Font headings: DM Serif Display (fără fontWeight!). Toate culorile din `app/lib/theme.ts` tokens.

12. **Scraping Pipeline:** Playwright cu stealth plugin + OpenRouter DeepSeek. Fișierele sunt în `scripts/scraping/`. Data directory este gitignored. Pipeline-ul este resumable (state.json checkpoint).

13. **Mobile Performance (Audit v9):** Principalele bottlenecks Android: (1) `FlatList` → folosește `@shopify/flash-list` v2, (2) `Image` din react-native → folosește `expo-image`, (3) `Animated` API vechi → folosește `react-native-reanimated` v4 (deja instalat), (4) lipsa `React.memo` pe card components. Librării evaluate: Unistyles 3.0 = recomandat (C++ engine, low migration), NativeWind/Tamagui/Gluestack = respinse (compatibilitate SDK 54 sau cost migrare prea mare).

14. **business_requests table** (migration 013): Coloane: `user_id, name, category_id, city_id, address, phone, website, description, ai_score (SMALLINT), ai_flags (JSONB), ai_reasoning (TEXT), status (pending/approved/rejected), admin_notes, business_id (FK populated after approve), reviewed_by, reviewed_at, created_at, updated_at`. Indexes pe `status` si `user_id`.

15. **AI business validation**: `src/services/llm/businessValidation.js` — trimite datele la Claude Haiku, returneaza `{score, flags[], reasoning}`. Score 0-100, flags gen "suspicious_name", "missing_address". Ruleaza inainte de INSERT, rezultatele se stocheaza in cerere. Se ruleaza si la retry (noua cerere = nou AI check).

16. **Retry mechanism "Reia procesul"**: Frontend stocheaza `window._retryingRejectedId` cand user apasa butonul. La submit, trimite `replaces_rejected_id` in POST body. Backend-ul face `DELETE FROM business_requests WHERE id=$1 AND user_id=$2 AND status='rejected'` inainte de INSERT nou. Securizat: verifica si user_id si status.

17. **Email links**: Email-ul de aprobare trimite CTA catre `/cont` (NU `/business-portal` care e API-only pentru mobile). Rutele `/business-portal` sunt REST API cu Bearer token auth, nu exista pagina web acolo.

18. **Resend email types** (v10): welcome, password_reset, business_approved, business_rejected. Functii in `src/services/email.js`: `sendWelcomeEmail`, `sendPasswordResetEmail`, `sendBusinessApprovedEmail`, `sendBusinessRejectedEmail`. Toate non-blocking (`.catch()` wrapper).

19. **Particle canvas pattern** (v11): Uses generic `setupParticleCanvas(canvas, container)` via `document.querySelectorAll('canvas.particle-canvas')`. Add class `particle-canvas` to any `<canvas>` + wrap in positioned container. Variants: `.hero-particles` (opacity 0.6), `.auth-particles` (opacity 0.5). Uses `ctx.setTransform()` instead of `ctx.scale()` to avoid accumulation on resize.

20. **Scroll arrows pattern** (v11): Wrap scroll element in `.scroll-container` (position relative, padding 0 40px). Add `.scroll-arrow.scroll-arrow-left` and `.scroll-arrow.scroll-arrow-right` buttons inside. `initScrollArrows()` in main.js handles visibility toggle via scroll position. Padding creates space for arrows outside content area.

21. **Search autosuggest z-index** (v11): `.search-wrapper` needs `z-index: 10` for stacking context. `.search-suggest-dropdown` at `z-index: 200` + `backdrop-filter: blur(12px)`. API endpoint: `GET /api/web/search/suggest?q=...` (debounced 300ms).

22. **TypeFx INCOMPATIBIL cu text-gradient** (v11): `background-clip: text` + `-webkit-text-fill-color: transparent` pe parent NU se mostenesc de child `<span>`. TypeFx wrappea textul in spans → gradientul disparea → text invizibil. NU reintroduce TypeFx pe text cu gradient.
