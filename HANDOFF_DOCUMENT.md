# OFAI - Handoff Document
## Data: 10 Februarie 2026 (Actualizat v9 — Mobile Performance Audit + UI Library Research)

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
- **Email:** Resend (welcome + password reset) — domeniu ofai.ro verificat
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
│   │   │   ├── admin.js            # Admin panel routes
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
│   │   │   ├── llm/                # AI review summarization
│   │   │   ├── cloudinary.js       # Upload/delete/transform imagini
│   │   │   ├── n8n.js              # Webhook fire-and-forget helper
│   │   │   ├── email.js            # Resend email (welcome + reset)
│   │   │   ├── pushNotifications.js
│   │   │   └── sentry.js
│   │   ├── views/
│   │   │   ├── admin/              # Admin panel (EJS)
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
│   │   │       ├── business-cta.ejs
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
│   │       ├── css/main.css       # Design system complet (~2850+ linii)
│   │       └── js/main.js         # Navbar, scroll reveal, counters, favorites, follow, geolocation+distance
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
│   └── migrations/                # SQL migrations (latest: 012_add_source_column)
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
- **Functii:** `optionalWebAuth` (seteaza `req.webUser` sau null), `requireWebAuth` (redirect la /login)
- **Mecanism:** Cookie `ofai_token` (httpOnly, Secure in prod, SameSite: lax, 30 zile)
- **Folosit de:** Toate rutele din `web.js` (pagini EJS + AJAX endpoints `/api/web/*`)

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

### Feature Parity cu Mobile App (Faza 3.5 — COMPLETA)
- [x] **Ratings pe offer cards:** Rating average + count pe fiecare card (home bento + oferte grid)
- [x] **Business logo pe cards:** Logo inline (40px, border-radius 10px) in content area, flex row layout
- [x] **Sort options:** Cele mai noi / Populare / Reducere mare pe /oferte
- [x] **Business description:** Sectiune "Despre" pe business-detail.ejs
- [x] **Booking info per locatie:** Telefon/WhatsApp/URL + instructiuni per business_locations
- [x] **Distance from user:** Geolocation API + Haversine formula, arata "X.X km" sau "XXX m" pe fiecare card
- [x] **Visual polish:** Sort bar cu border separator, filter bar spacing, collection tab badges

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

### ⚠️ PROBLEMA ACTIVA: Railway/ofai.ro down
**Status:** Railway returnează "Not Found" pe ofai.ro (observat 10 Feb 2026).
Posibil: service crash, deploy failure, sau custom domain issue.
**Acțiune:** Verifică Railway Dashboard pentru status serviciu.

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
/pentru-business     → business-cta.ejs
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

1. **⚠️ Railway fix** — verifică de ce ofai.ro e down (Railway Dashboard)
2. **📱 Mobile Performance (Faza 5A)** — FlashList + expo-image + Reanimated + React.memo (cel mai mare impact vizual)
3. **Rulează scraping pipeline** — `npm run scrape` + `npm run scrape:enrich` pt date reale
4. **📱 Unistyles 3.0 (Faza 5B, opțional)** — C++ style engine, zero-rerender themes
5. **Monetizare** — implementează Stripe + pricing tiers (49/99/199 RON)
6. **Galerie imagini** — upload/delete gallery images in portal
7. **Footer link-uri** — actualizeaza link-urile din footer.ejs
8. **n8n WF2-WF6** — workflow-uri suplimentare
9. **iOS Build** — necesita Mac sau cont Apple Developer ($99/an)
10. **Play Store** — publicare APK pe Google Play

---

## ISTORIC ACTUALIZARI

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
