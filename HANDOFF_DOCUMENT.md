# OFAI - Handoff Document
## Data: 9 Februarie 2026 (Actualizat v4)

---

## INFORMATII PROIECT

**Nume:** OFAI
**Scop:** Platforma de oferte si reduceri pentru piata din Romania
**Domeniu:** https://ofai.ro

**Tech Stack:**
- **Frontend:** React Native / Expo (cross-platform: web + mobile)
- **Backend:** Node.js / Express
- **Database:** PostgreSQL
- **Hosting Backend:** Railway
- **Hosting Frontend:** Railway (EJS server-rendered) + Expo mobile app (dev only)
- **DNS:** Cloudflare (free plan, CNAME flattening)
- **Imagini:** Cloudinary
- **Email:** Resend (welcome + password reset) — domeniu ofai.ro verificat
- **Error Tracking:** Sentry
- **AI/LLM:** Anthropic Claude Haiku (review summarization)
- **Workflow Automation:** n8n (pe Railway)
- **GitHub:** https://github.com/Tiberiu221/OFAI

---

## STRUCTURA PROIECT LOCAL

```
C:\Users\tiber\Desktop\AppReduceri\
├── appredueri_mobile/     # Frontend React Native/Expo
│   ├── app/               # Expo Router pages
│   │   ├── (tabs)/        # Tab-urile principale (Home, Map, Colectia mea, Account)
│   │   ├── auth/          # Login, Register, Forgot Password
│   │   ├── business/      # Pagini detaliu business
│   │   ├── offer/         # Pagini detaliu oferta
│   │   ├── favorites/     # Pagina favorite standalone (fallback)
│   │   ├── onboarding.tsx # Preferinte la inregistrare
│   │   ├── business-portal/ # Portal pentru business owners
│   │   └── legal/         # Terms, Privacy
│   ├── components/        # Componente reutilizabile
│   └── web/               # Custom web assets (index.html)
│
├── appredueri_backend/    # Backend Node.js + Public EJS Website
│   ├── src/
│   │   ├── routes/        # API endpoints + web.js (EJS pages)
│   │   ├── middleware/    # Auth, rate limiting
│   │   ├── helpers/
│   │   │   └── validate.js    # Validare input + paginare helpers
│   │   ├── config/        # LLM config
│   │   ├── services/
│   │   │   ├── llm/       # Claude AI review summarization
│   │   │   ├── n8n.js     # n8n webhook helper (fire-and-forget)
│   │   │   ├── cloudinary.js
│   │   │   ├── email.js
│   │   │   ├── pushNotifications.js
│   │   │   └── sentry.js
│   │   ├── views/
│   │   │   ├── admin/     # Admin panel (EJS)
│   │   │   └── public/    # Public website EJS pages
│   │   │       ├── home.ejs
│   │   │       ├── oferte.ejs
│   │   │       └── partials/ (head, navbar, footer)
│   │   └── public/        # Static assets for website
│   │       ├── css/main.css   # Complete design system (1355 lines)
│   │       └── js/main.js     # Navbar, scroll reveal, counters
│   ├── scripts/           # Batch jobs, monitoring, A/B testing
│   └── migrations/        # SQL migrations
│
└── n8n-workflows/         # NOU - Exportabile .json pentru n8n
    └── WF1_New_Review_Notify_Owner.json
```

---

## URLs & CONFIGURATII

### Productie
- **Website:** https://ofai.ro (servit de Railway, DNS prin Cloudflare)
- **API:** https://ofai-production.up.railway.app (acelasi server ca website-ul)
- **n8n:** https://n8n-production-d2f4.up.railway.app
- **Railway Dashboard:** Deployment automat pe push la GitHub
- **Cloudflare DNS:** CNAME ofai.ro → vurfk849.up.railway.app (proxy ON)
- **IMPORTANT:** Vercel a fost eliminat complet — totul e pe Railway

### Development
- **Website (EJS):** http://localhost:3000 sau http://localhost:4000 (`npm run dev` in backend)
- **Mobile (Expo):** http://localhost:8081 (`npx expo start --web`)
- **Backend API:** http://localhost:4000 (`npm run dev`)
- **API Config:** `app/config.ts` - detecteaza automat environment

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
```

### Railway Cron Job
```
Command: npm run review-summaries:batch
Schedule: 0 3 */2 * *   (la 2 zile, 03:00 AM)
```

---

## CE ESTE COMPLET

### Infrastructura
- [x] Backend deployed pe Railway cu PostgreSQL
- [x] Frontend deployed pe Vercel
- [x] Domeniu custom ofai.ro configurat
- [x] CORS configurat (restrictionat in productie — doar domenii OFAI specifice)
- [x] SSL automat
- [x] **Rate Limiting** - protectie DDoS/spam (100 req/min general, 10/15min auth, 5/15min verify-reset-code, 200/min admin)
- [x] **Sentry** - error tracking in productie
- [x] **Database Indexes** - queries optimizate pentru performanta
- [x] **statement_timeout** - 10s max per query (previne blocarea pool-ului)

### Securitate (Production Hardening - v3)
- [x] **JWT_SECRET** throw fatal daca lipseste in production (auth.js + middleware/auth.js)
- [x] **Rate limiting verify-reset-code** - 5 incercari / 15 min (anti-brute-force pe codul de 6 cifre)
- [x] **Rate limiting admin** - 200 req/min (nu mai sare peste limiter)
- [x] **Input validation** - helper centralizat (`src/helpers/validate.js`): email, string sanitize, int, coordinates, pagination
- [x] **Review comment** - sanitizat la max 2000 caractere
- [x] **CORS restrictionat** - nu mai accepta orice `.vercel.app` / `.railway.app` wildcard in productie
- [x] **Admin error handler** - mesaj generic in productie, HTML escaped in dev (anti-XSS)

### Paginare (Production Hardening - v3)
- [x] **Toate endpoint-urile de lista** au acum LIMIT/OFFSET cu `?page=1&limit=20` (max 100)
- [x] **Format response:** `{ data: [...], pagination: { page, limit, total, totalPages } }`
- [x] Endpoint-uri paginate: `/offers`, `/businesses`, `/reviews/business/:id`, `/favorites`, `/subscriptions`
- [x] **Frontend compatibil** - pattern `Array.isArray(json) ? json : (json.data ?? json)` pe toate fetch-urile

### n8n Workflow Automation
- [x] n8n deployed pe Railway
- [x] **Backend helper** (`src/services/n8n.js`) - fire-and-forget webhook trigger
- [x] **WF1: New Review → Email Owner** - cand un user lasa recenzie, owner-ul primeste email via Resend API
- [x] Webhook triggers integrati in: auth.js, reviews.js, business-portal.js, admin.js, subscriptions.js
- [x] **Workflow exportabil** in `n8n-workflows/WF1_New_Review_Notify_Owner.json`
- [x] Pattern: Backend POST fire-and-forget → n8n webhook → Code node → HTTP Request (Resend)
- [x] **Important:** n8n wraps webhook data sub `.body` (access via `$input.first().json.body`)

### Autentificare
- [x] Login / Register / Logout
- [x] Password reset flow (cu cod pe email de pe noreply@ofai.ro)
- [x] JWT token-based auth
- [x] Role-based access (user, business_owner, admin)
- [x] GDPR-compliant account deletion
- [x] **Welcome email** - trimis automat la inregistrare (Resend, de pe ofai.ro)
- [x] **Password reset email** - cu cod de 6 cifre, design profesional
- [x] **Onboarding** - preferinte oras + categorii la prima inregistrare (cu optiune skip)

### AI Review Summarization (Claude Haiku)
- [x] Sumarizare automata recenzii business-uri (min 3 reviews)
- [x] Batch job scheduled la 2 zile (Railway Cron, 03:00 AM)
- [x] Filtrare review-uri spam/injuraturi/caractere random
- [x] Caching in DB (tabel `review_summaries`)
- [x] NU genereaza on-demand (anti-abuse, cost fix)
- [x] Admin page: `/admin/review-summaries` (batch manual, regenerare, stergere cache)
- [x] Frontend: card "Pe baza recenziilor" pe pagina business
- [x] Cost estimat: ~$0.07/luna pentru 100 business-uri

### Business Portal
- [x] Lista business-uri pentru owner
- [x] Editare informatii business
- [x] Upload imagini (logo, cover, galerie) - via Cloudinary
- [x] Sistem de rezervari (telefon, WhatsApp, link)
- [x] Gestionare oferte (creare, editare, activare/dezactivare)
- [x] Preview business

### Tab "Colectia mea" (v3 — merge Urmarite + Favorite)
- [x] **ModeToggle** mare cu 2 butoane: "Business-uri" si "Oferte"
- [x] Badge cu count pe fiecare buton
- [x] **Business-uri view** — search, sort (cu oferte/recent/A-Z), city chips, unfollow
- [x] **Oferte view** — lista oferte favorite cu buton remove
- [x] Pull-to-refresh pe ambele moduri
- [x] Guest state unificat
- [x] Header redenumit: "Colectia mea"
- [x] Pagina `/favorites` ramane functionala separat (acces din offer screen bookmark)

### Dock (Navigation Bar)
- [x] Dock animat pe web (framer-motion)
- [x] Dock nativ pe mobile (cu magnifying lens effect)
- [x] Apare pe toate paginile EXCEPTIE auth (login, register, forgot-password)
- [x] Fisiere: `components/Dock.tsx` (native), `components/Dock.web.tsx` (web)

### Auth Screens
- [x] Buton "Exploreaza reduceri fara cont" pe toate paginile auth
- [x] Permite accesul la app fara autentificare

### Branding
- [x] Rebrand complet AppReduceri → OFAI (toate ecranele, email-uri, legal, docs)
- [x] Email-uri trimise de pe `noreply@ofai.ro` (Resend, domeniu verificat DKIM)
- [x] Cloudinary upload folder: `ofai/`
- [x] Foldere interne raman `appredueri_*` (nu se schimba pentru compatibilitate)

### Design System Overhaul (v4 — Option A)
- [x] **Theme expandat:** `theme.ts` — fonts (DM Serif Display + Inter), spacing, radii, shadows exports
- [x] **Background:** Schimbat de la `#09090b` la `#06060a` peste tot (match web design)
- [x] **OfferCard redesign:** Cover image hero pattern (140px cover), logo overlap (-28px), discount badge solid accent, accent glow animation pentru highlights (≥40% discount)
- [x] **BusinessCard redesign:** Cover image hero pattern (120px cover), offers count badge pe cover, bottom row cu separator
- [x] **Dock.web.tsx responsive:** Desktop (≥768px) = floating glassmorphic navbar cu OFAI brand + nav links; Mobile (<768px) = magnification dock
- [x] **AuroraBackground subtilizat:** Opacitati reduse (12-8%), blob violet adaugat, miscare mai lenta (30px), grid dot pattern pe web
- [x] **HomeScreen:** DM Serif Display pe titluri, glassmorphic search bar, sort tabs updatate
- [x] **SkeletonCard + HomeSkeleton:** Match noul card pattern (cover + logo overlap)
- [x] **Google Fonts:** @expo-google-fonts/dm-serif-display + @expo-google-fonts/inter instalate si incarcate in _layout.tsx
- [x] **Config files:** app.config.js, +html.tsx, web/index.html — toate pe #06060a cu Google Fonts + custom scrollbar + ambient gradients

### Public Website EJS (v4)
- [x] **Home page:** Hero section cu stats animate, search, marquee businesses, categories grid, featured offers bento, how-it-works, cities scroll, CTA
- [x] **Offers page:** Grid cu filter (categorii + orase), search, paginare, discount badges
- [x] **Design system CSS:** 1355 linii — dark theme, glassmorphism, scroll reveal, responsive
- [x] **Navbar:** Floating glassmorphic cu logo OFAI, nav links, mobile hamburger
- [x] **Footer:** 4 coloane cu link-uri (inca pe # — trebuie actualizate)
- [x] **main.js:** Navbar scroll hide/show, IntersectionObserver reveal, animated counters, mobile menu

### Domain Migration (v4)
- [x] **Vercel eliminat** — proiect sters complet
- [x] **Cloudflare DNS** — nameservers actualizate la rotld.ro, CNAME flattening activ
- [x] **Railway custom domain** — ofai.ro adaugat cu SSL certificat activ
- [x] **SSL:** Cloudflare Full mode, certificat valid

---

## CE TREBUIE FACUT / CUNOSCUT

### ⚡ PRIORITATE #1: Migrare Completa Site EJS
**Planul complet este in:** `C:\Users\tiber\.claude\plans\replicated-scribbling-widget.md`

Site-ul public (ofai.ro) are momentan DOAR 2 pagini EJS (home + oferte). Trebuie migrate TOATE functionalitățile din app-ul mobil pe site-ul EJS. Planul are 5 batch-uri:

**Batch 1 (fundament):** Auth system (cookie-based JWT), offer detail page, business detail page, navbar user menu
**Batch 2 (navigatie):** Categorii page, orașe page, 404 page
**Batch 3 (cont):** Contul meu, colecția mea (favorites + subscriptions), setări, preferințe
**Batch 4 (static):** Termeni, confidențialitate, ajutor & suport, pagina business CTA
**Batch 5 (polish):** Toast system, geolocation, search autocomplete, SEO structured data

**Fișiere noi:** ~17 EJS templates + 1 middleware (webAuth.js)
**Fișiere modificate:** web.js, index.js, navbar.ejs, footer.ejs, head.ejs, main.css, main.js, home.ejs, oferte.ejs, package.json
**Dependință nouă:** cookie-parser

### 2. n8n Workflows de implementat
WF1 (New Review → Email Owner) este complet. Restul sunt pregatite pe backend (webhook triggers exista):
- **WF2:** New Offer → Push notification la followers
- **WF3:** Daily digest (oferte noi din ziua precedenta)
- **WF4:** Review reminder (dupa vizita/achizitie)
- **WF5:** Welcome series (drip emails dupa inregistrare)
- **WF6:** Admin alerts (business nou, review negativ)

### 3. Baza de Date Locala - Migratie Necesara
Daca primesti eroare `column "image_url" does not exist`:
```sql
ALTER TABLE business_images ADD COLUMN IF NOT EXISTS image_url TEXT;
```

### 4. Fisier de Sters
**IMPORTANT:** Sterge `components/Dock.native.tsx` - continutul a fost mutat in `Dock.tsx`:
```bash
del C:\Users\tiber\Desktop\AppReduceri\appredueri_mobile\components\Dock.native.tsx
```

### 5. Oferte Nu Apar
Problema: Ofertele trebuie sa aiba `is_active = TRUE` si `end_date >= CURRENT_DATE`
```sql
SELECT id, title, is_active, end_date FROM offers;
UPDATE offers SET end_date = '2026-12-31' WHERE end_date < CURRENT_DATE;
UPDATE offers SET is_active = TRUE WHERE is_active = FALSE;
```

### 6. Cloudinary - Railway
Variabilele de environment pentru Cloudinary trebuie adaugate manual in Railway:
- `CLOUDINARY_CLOUD_NAME` = `dtlawgplb`
- `CLOUDINARY_API_KEY` = `924953315261555`
- `CLOUDINARY_API_SECRET` = (din Cloudinary dashboard)

### 7. Seed Production Database
Scriptul de seed pentru 1000 business-uri NU a fost rulat inca pe productie:
```bash
cd C:\Users\tiber\Desktop\AppReduceri\appredueri_backend
DATABASE_URL="postgres://postgres:REDACTED@REDACTED_DB_HOST/railway" node scripts/seed-businesses.js
```

### 8. n8n Tips
- **Production URL:** `/webhook/new-review` (activ cand workflow e ON)
- **Test URL:** `/webhook-test/new-review` (doar in timpul "Listen for test event")
- **Data access in Code node:** `$input.first().json.body` (nu `.json` direct!)
- **Resend API:** POST la `https://api.resend.com/emails` cu header `Authorization: Bearer re_xxx`

### 9. Git Push Pending
Modificarile Option A (design overhaul mobil) NU au fost inca pushed pe GitHub. Trebuie commitat si pushed inainte de deploy.

---

## FISIERE CHEIE MODIFICATE RECENT

### v4 — 9 Februarie 2026

```
appredueri_backend/
├── src/
│   ├── routes/
│   │   └── web.js              # 2 EJS page routes (home, oferte) — trebuie extins cu ~15 rute
│   ├── views/public/
│   │   ├── home.ejs            # Landing page completa (hero, marquee, categories, featured, cities, CTA)
│   │   ├── oferte.ejs          # Offers listing cu search, filter, pagination
│   │   └── partials/
│   │       ├── head.ejs        # HTML head cu meta, favicon, CSS
│   │       ├── navbar.ejs      # Glassmorphic navbar (fara user menu inca)
│   │       └── footer.ejs      # Footer 4 coloane (link-uri pe # inca)
│   └── public/
│       ├── css/main.css        # Design system complet (1355 linii, dark theme, glassmorphism)
│       └── js/main.js          # Navbar, scroll reveal, counters, mobile menu

appredueri_mobile/
├── app/
│   ├── _layout.tsx             # + useFonts (DM Serif Display + Inter), web CSS injection actualizat
│   ├── +html.tsx               # Rescris — #06060a, Google Fonts preconnect, custom scrollbar, ambient gradients
│   ├── app.config.js           # Toate #09090b → #06060a (8 locuri)
│   ├── lib/theme.ts            # EXPANDAT — fonts, spacing, radii, shadows exports; background #06060a
│   ├── (tabs)/
│   │   └── index.tsx           # + DM Serif Display titluri, glassmorphic search, sort tabs updatate
│   └── web/
│       └── index.html          # + Google Fonts, custom scrollbar, ambient glow desktop
├── components/
│   ├── OfferCard.tsx           # RESCRIS — cover image hero (140px), logo overlap, discount badge, glow animation
│   ├── BusinessCard.tsx        # RESCRIS — cover image hero (120px), offers badge, bottom separator
│   ├── Dock.web.tsx            # RESCRIS — responsive desktop navbar + mobile dock
│   ├── AuroraBackground.tsx    # Subtilizat — opacitati reduse, blob violet, grid pattern web
│   ├── SkeletonCard.tsx        # Match noul card pattern (cover + logo overlap)
│   └── HomeSkeleton.tsx        # + sort bar skeleton, radii from theme
├── package.json                # + @expo-google-fonts/dm-serif-display, @expo-google-fonts/inter
```

### v3 — 7 Februarie 2026

```
appredueri_backend/
├── src/
│   ├── index.js                 # + verifyResetCodeLimiter, adminLimiter, CORS restrict, admin error handler fix
│   ├── db.js                    # + statement_timeout: 10000 (10s)
│   ├── helpers/
│   │   └── validate.js          # NOU - isValidEmail, sanitizeString, validateInt, parsePagination, paginatedResponse
│   ├── services/
│   │   └── n8n.js               # NOU - triggerWebhook(path, payload) fire-and-forget
│   ├── middleware/
│   │   ├── auth.js              # + JWT_SECRET production guard (throw fatal)
│   │   └── rateLimiter.js       # + verifyResetCodeLimiter (5/15min), adminLimiter (200/min), removed admin skip
│   └── routes/
│       ├── auth.js              # + triggerWebhook import, JWT_SECRET guard, validate import
│       ├── offers.js            # + paginare (LIMIT/OFFSET + COUNT)
│       ├── businesses.js        # + paginare
│       ├── reviews.js           # + paginare + comment sanitize (max 2000 chars) + triggerWebhook new-review
│       ├── favorites.js         # + paginare
│       ├── subscriptions.js     # + paginare + triggerWebhook new-subscriber
│       ├── business-portal.js   # + triggerWebhook new-offer
│       └── admin.js             # + triggerWebhook new-offer, INSERT RETURNING id

n8n-workflows/
└── WF1_New_Review_Notify_Owner.json  # NOU - Importabil in n8n

appredueri_mobile/
├── app/
│   ├── onboarding.tsx           # Fix: router.replace("/") → "/(tabs)" (skip button)
│   ├── (tabs)/
│   │   ├── index.tsx            # + paginare support (json.data pattern)
│   │   └── subscriptions.tsx    # RESCRIS — ModeToggle businesses/offers, favorites integration, header "Colectia mea"
│   ├── business/
│   │   └── [id].tsx             # + paginare support pe offers, reviews, subscriptions
│   ├── offer/
│   │   └── [id].tsx             # + paginare support pe favorites check
│   └── favorites/
│       └── index.tsx            # + paginare support (json.data pattern)
```

### v2 — 3 Februarie 2026

```
appredueri_backend/
├── src/
│   ├── index.js                 # + Rate limiting, Sentry, Push tokens, health check "OFAI"
│   ├── config/
│   │   └── llm.js               # NOU - Configurare Claude Haiku
│   ├── middleware/
│   │   ├── auth.js              # + requireAdmin, requireBusinessOwner
│   │   ├── adminAuth.js         # Realm schimbat la "Admin OFAI"
│   │   └── rateLimiter.js       # NOU - Rate limiting middleware
│   ├── services/
│   │   ├── llm/                 # NOU - AI Review Summarization
│   │   │   ├── anthropicClient.js
│   │   │   ├── prompts.js
│   │   │   ├── summarizationService.js
│   │   │   └── README.md
│   │   ├── email.js             # Resend email (FROM_EMAIL: noreply@ofai.ro)
│   │   ├── cloudinary.js        # Upload folder: ofai/
│   │   ├── sentry.js
│   │   └── pushNotifications.js
│   ├── routes/
│   │   ├── admin.js             # + Review summaries admin panel
│   │   ├── businesses.js        # + Review summary cache-only retrieval
│   │   ├── reviews.js
│   │   ├── subscriptions.js     # Fix active_offers_count
│   │   ├── auth.js              # + Welcome email, password reset email
│   │   └── push-tokens.js
│   └── views/admin/
│       └── review-summaries.ejs
├── scripts/
│   ├── review-summary-batch.js
│   ├── check-llm-budget.js
│   ├── monitor-llm-costs.sql
│   └── ab-test-prompts.js

appredueri_mobile/
├── app/
│   ├── _layout.tsx              # + usePushNotifications hook
│   ├── types.ts                 # + ReviewSummary interface
│   ├── (tabs)/
│   │   ├── index.tsx            # Rebrand "Contul tau OFAI"
│   │   └── account.tsx          # Versiune: "OFAI v1.0.4"
│   ├── business/
│   │   └── [id].tsx             # + ReviewSummary component
│   ├── settings.tsx             # Rebrand
│   ├── help.tsx                 # Rebrand
│   ├── legal/
│   │   ├── terms.tsx
│   │   └── privacy.tsx
│   ├── hooks/
│   │   └── usePushNotifications.ts
│   ├── auth/
│   │   ├── login.tsx            # + buton "Exploreaza fara cont"
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   └── config.ts
├── components/
│   ├── ReviewSummary.tsx
│   ├── Dock.tsx
│   ├── Dock.web.tsx
│   ├── BusinessMap.native.tsx
│   ├── AuroraBackground.tsx
│   └── Toast.tsx
```

---

## COMENZI UTILE

### Development
```bash
# Frontend
cd C:\Users\tiber\Desktop\AppReduceri\appredueri_mobile
npx expo start --web          # sau doar: npx expo start

# Backend
cd C:\Users\tiber\Desktop\AppReduceri\appredueri_backend
npm run dev
```

### Git & Deploy
```bash
cd C:\Users\tiber\Desktop\AppReduceri
git add .
git commit -m "descriere"
git push
# Vercel si Railway se actualizeaza automat
```

### Database (Railway Production)
```bash
psql "postgresql://postgres:REDACTED@REDACTED_DB_HOST/railway"
```

### EAS Build & Update
```bash
cd C:\Users\tiber\Desktop\AppReduceri\appredueri_mobile

# Build APK pentru testare
eas build --platform android --profile preview

# OTA Update (dupa ce ai build instalat)
eas update --branch preview --message "descriere modificari"

# Vezi builds
eas build:list

# Porneste emulator si app
npx expo start --android
```

### LLM Review Summaries
```bash
cd C:\Users\tiber\Desktop\AppReduceri\appredueri_backend

# Rulare batch manuala
npm run review-summaries:batch

# Monitorizare costuri LLM
node scripts/check-llm-budget.js
```

### n8n
```
Dashboard: https://n8n-production-d2f4.up.railway.app
Webhook base: https://N8N_WEBHOOK_REDACTED
Workflows active: WF1 (new-review → email owner)
Import: n8n-workflows/WF1_New_Review_Notify_Owner.json
```

---

## SERVICII EXTERNE CONFIGURATE

### Sentry (Error Tracking)
- **Dashboard:** https://sentry.io
- **Proiect:** ofai-backend
- **Functionare:** Captureaza automat erorile 500+ in productie

### Resend (Email)
- **Dashboard:** https://resend.com
- **Domeniu:** ofai.ro (DKIM verificat)
- **Email sender:** `OFAI <noreply@ofai.ro>`
- **Email-uri active:**
  - Welcome email (la inregistrare)
  - Password reset (cu cod 6 cifre)
  - New review notification (via n8n WF1)

### Anthropic / Claude (AI)
- **Dashboard:** https://console.anthropic.com
- **Model:** Claude 3 Haiku (`claude-3-haiku-20240307`)
- **Utilizare:** Sumarizare automata recenzii business-uri
- **Cost:** ~$0.07/luna pentru 100 business-uri
- **Env var:** `ANTHROPIC_API_KEY` (in Railway)

### n8n (Workflow Automation)
- **Dashboard:** https://n8n-production-d2f4.up.railway.app
- **Hosting:** Railway (serviciu separat)
- **Baza de date proprie:** PostgreSQL pe Railway (separata de OFAI DB)
- **Workflows active:** WF1 — New Review → Email Owner
- **Pattern:** Backend fire-and-forget POST → n8n webhook → Code node → HTTP Request
- **Env var backend:** `N8N_WEBHOOK_URL` (in Railway)

### Cloudflare (DNS + CDN)
- **Dashboard:** https://dash.cloudflare.com
- **Domeniu:** ofai.ro
- **DNS:** CNAME flattening (ofai.ro → vurfk849.up.railway.app)
- **SSL:** Full mode (Cloudflare ↔ Railway ambele cu SSL)
- **Proxy:** ON (orange cloud) — protectie DDoS + cache
- **Nameservers:** Configurate la registrar (rotld.ro)

### pgAdmin 4 (Database Management)
- **Conexiune Railway:**
  - Host: `REDACTED_DB_HOST`
  - Port: `11803`
  - Database: `railway`
  - Username: `postgres`
  - SSL Mode: `Require`

---

## FAZE IMPLEMENTARE

### Faza 1 - Fundatie (COMPLETA)
- [x] Rate limiting pe API
- [x] Sentry error tracking
- [x] Email transactional (Resend)
- [x] Indexuri DB pentru performanta

### Faza 2 - Engagement (COMPLETA)
- [x] Push notifications (Expo Push API)
- [x] EAS Build configurat (Android APK)
- [x] OTA Updates cu `eas update`
- [x] Mapbox harta integrata
- [x] Sistem de puncte (recenzii)
- [x] Nearby offers (sortare dupa distanta)

### Faza 2.5 - AI & Branding (COMPLETA)
- [x] AI Review Summarization cu Claude Haiku
- [x] Scheduled batch job (la 2 zile, Railway Cron)
- [x] Admin panel review summaries
- [x] Filtrare review-uri spam/profanity/gibberish
- [x] Rebrand complet AppReduceri → OFAI
- [x] Email sender: noreply@ofai.ro

### Faza 2.7 - Production Hardening & n8n (COMPLETA - v3)
- [x] JWT_SECRET production guard
- [x] Rate limiting pe verify-reset-code, admin routes
- [x] Input validation centralizata (validate.js)
- [x] CORS restrictionat in productie
- [x] Admin error handler XSS fix
- [x] Paginare pe toate endpoint-urile de lista
- [x] statement_timeout pe DB pool (10s)
- [x] n8n WF1: New Review → Email Owner
- [x] n8n webhook triggers pe toate rutele relevante
- [x] Bug fix onboarding skip
- [x] Tab "Colectia mea" (merge urmarite + favorite cu ModeToggle)

### Faza 2.9 - Design Overhaul + Domain Migration (COMPLETA - v4)
- [x] Option A: Aliniere design mobil cu web (cover cards, glassmorphism, DM Serif Display)
- [x] Eliminare Vercel → migrare completa pe Railway
- [x] Cloudflare DNS setup (CNAME flattening, SSL Full)
- [x] Site public EJS: home page + oferte page (cu design modern)

### Faza 3 - Migrare Completa Site EJS (IN CURS)
- [ ] Auth system web (cookie JWT, login/register/forgot/reset)
- [ ] Offer detail page + business detail page
- [ ] Categorii + Orașe + 404
- [ ] Cont utilizator + Colecția mea + Setări + Preferințe
- [ ] Pagini legale + Ajutor + Business CTA
- [ ] Toast, geolocation, search autocomplete, SEO

### Faza 4 - Monetizare (TODO)
- [ ] Stripe integration
- [ ] Planuri pentru business-uri
- [ ] Dashboard analytics
- [ ] Featured offers

### Faza 5 - Scalare (TODO)
- [ ] Self-service onboarding
- [ ] Referral system
- [ ] Deep links
- [ ] Expansion in orase noi
- [ ] n8n WF2-WF6 (push notifications, daily digest, welcome series, admin alerts)

---

## PRIORITATI URMATOARE

1. **⚡ Migrare Site EJS** — Planul complet este in `C:\Users\tiber\.claude\plans\replicated-scribbling-widget.md`. Incepe cu Batch 1 (auth + offer detail + business detail).
2. **Git push** — Commit si push modificarile Option A (design overhaul) pe GitHub pentru deploy Railway
3. **Seed production** — Ruleaza seed-businesses.js pe production DB
4. **n8n WF2-WF6** — workflow-uri suplimentare
5. **iOS Build** — necesita Mac sau cont Apple Developer ($99/an)
6. **Play Store** — publicare APK pe Google Play
7. **SecureStore** — migrare token din AsyncStorage la expo-secure-store

---

## NOTE IMPORTANTE

1. **Doua medii separate:** Localhost si Productie au baze de date diferite. Ce uploadezi local NU apare pe ofai.ro si invers.

2. **Website = Backend = Acelasi server:** Site-ul public EJS (ofai.ro) si API-ul mobil (ofai-production.up.railway.app) ruleaza pe ACELASI server Express. Rutele web sunt in `web.js`, API-urile in fisiere separate (`offers.js`, `businesses.js`, etc.).

3. **Dock logic (mobile):**
   - Pe web: `Dock.web.tsx` e selectat automat de bundler (acum responsive: desktop navbar + mobile dock)
   - Pe native: `Dock.tsx` e folosit
   - Root layout (`_layout.tsx`) adauga Dock pentru paginile non-tabs pe web
   - Tabs layout (`(tabs)/_layout.tsx`) gestioneaza Dock pentru tab-uri

4. **API URL detection:** `app/config.ts` detecteaza automat daca e productie sau development bazat pe `__DEV__` si `Platform.OS`
   - APK/Production: `https://ofai-production.up.railway.app`
   - Development Web: `http://localhost:4000`
   - Development Mobile: `http://192.168.0.30:4000`

5. **Cloudinary:** Imaginile din productie sunt stocate pe Cloudinary. Local foloseste folderul `uploads/` din backend.

6. **EAS Update vs EAS Build:**
   - `eas build` = creeaza APK nou (trebuie reinstalat)
   - `eas update` = OTA update instant (doar JS/assets, fara reinstalare)
   - Dupa `eas update`, inchide si redeschide app-ul pentru a primi update

7. **Mapbox:**
   - Access Token (public): in `BusinessMap.native.tsx`
   - Download Token (secret): in `app.config.js` si `eas.json`
   - Nu functioneaza in Expo Go (necesita build nativ)

8. **iOS Emulator:** Necesita Mac cu Xcode. Nu se poate emula iOS pe Windows.

9. **AI Review Summaries:**
   - Se genereaza DOAR prin batch job (la 2 zile) sau manual din admin
   - Frontend-ul NU poate declansa generare (prevenire abuse/costuri)
   - Business-urile au nevoie de minim 3 recenzii valide
   - Daca ANTHROPIC_API_KEY lipseste, feature-ul este dezactivat silentios

10. **Branding:** Peste tot in UI/email-uri scrie "OFAI". Folderele locale si package names raman `appredueri_*` pentru a nu sparge import paths.

11. **Paginare (v3):** Toate endpoint-urile de lista returneaza acum `{ data: [...], pagination: { page, limit, total, totalPages } }`. Frontend-ul foloseste pattern-ul `Array.isArray(json) ? json : (json.data ?? json)` pentru backward compatibility.

12. **n8n webhook data:** Cand primesti date de la webhook in n8n Code node, acceseaza via `$input.first().json.body` (nu `.json` direct). n8n wraps POST body sub `.body`.

13. **EJS Design System CSS:** `main.css` contine design system complet cu CSS custom properties (--bg-primary, --accent, --border, etc.), Google Fonts (Inter + DM Serif Display), glassmorphism, scroll reveal animations, responsive breakpoints. Toate paginile noi trebuie sa refoloseasca aceste clase existente.

14. **Cloudflare DNS:** ofai.ro este pe Cloudflare (nameservers schimbate la rotld.ro). CNAME record: ofai.ro → vurfk849.up.railway.app cu proxy ON. SSL: Full mode. Daca site-ul nu merge, verifica SSL/TLS settings in Cloudflare dashboard.

15. **EJS Migrare Plan:** Planul complet pentru migrarea site-ului EJS este salvat in `C:\Users\tiber\.claude\plans\replicated-scribbling-widget.md`. Contine 5 batch-uri cu toate detaliile (rute, EJS templates, CSS, JS, API calls).

---

## ISTORIC ACTUALIZARI

### 9 Februarie 2026 (v4)
**Design Overhaul (Option A) + Domain Migration + EJS Website Launch:**

1. **Mobile Design Overhaul (Option A)**
   - Aliniere completa design mobil cu web design system
   - Theme expandat: fonts (DM Serif Display + Inter), spacing, radii, shadows
   - Background schimbat: #09090b → #06060a (match web --bg-primary)
   - OfferCard rescris: cover image hero (140px), logo overlap, discount badge accent solid, glow animation
   - BusinessCard rescris: cover image hero (120px), offers badge, bottom separator
   - Dock.web.tsx: responsive desktop navbar (glassmorphic) + mobile dock
   - AuroraBackground: opacitati reduse, blob violet, grid pattern web
   - SkeletonCard + HomeSkeleton: match noul card pattern
   - Google Fonts instalate: @expo-google-fonts/dm-serif-display + inter
   - _layout.tsx: useFonts, web CSS injection actualizat
   - Config: app.config.js, +html.tsx, web/index.html pe #06060a

2. **Domain Migration: Vercel → Railway + Cloudflare**
   - Proiect Vercel sters complet
   - Cloudflare nameservers configurate la rotld.ro (registrar)
   - CNAME flattening: ofai.ro → vurfk849.up.railway.app
   - Railway custom domain: ofai.ro cu SSL certificat activ
   - Cloudflare SSL: Full mode
   - Site confirmat functional pe https://ofai.ro

3. **Public Website EJS (2 pagini)**
   - Home page: hero cu stats animate, search, marquee businesses, categories grid, featured offers bento, how-it-works, cities scroll, CTA
   - Offers page: grid cu filter categorii + orase, search, paginare
   - Design system CSS complet: 1355 linii (dark theme, glassmorphism, scroll reveal, responsive)
   - Navbar: floating glassmorphic cu logo, nav links, mobile hamburger
   - Footer: 4 coloane
   - main.js: navbar scroll, IntersectionObserver reveal, animated counters

4. **Masterplan Migrare EJS**
   - Plan complet in 5 batch-uri pentru migrarea tuturor functionalitaților
   - Fisier: `C:\Users\tiber\.claude\plans\replicated-scribbling-widget.md`

**Fisiere create (backend):**
- `src/routes/web.js` — 2 rute EJS (home, oferte)
- `src/views/public/home.ejs`, `oferte.ejs`
- `src/views/public/partials/head.ejs`, `navbar.ejs`, `footer.ejs`
- `src/public/css/main.css` (1355 linii)
- `src/public/js/main.js` (147 linii)

**Fisiere modificate (mobile):**
- `app/lib/theme.ts` — expandat complet
- `app/_layout.tsx` — fonts, CSS injection
- `app/+html.tsx` — rescris
- `app.config.js` — #06060a
- `app/(tabs)/index.tsx` — DM Serif Display, glassmorphic search
- `components/OfferCard.tsx` — rescris
- `components/BusinessCard.tsx` — rescris
- `components/Dock.web.tsx` — rescris
- `components/AuroraBackground.tsx` — subtilizat
- `components/SkeletonCard.tsx` — match noul pattern
- `components/HomeSkeleton.tsx` — sort bar skeleton
- `web/index.html` — Google Fonts, scrollbar, glow
- `package.json` — +2 font dependencies

---

### 7 Februarie 2026 (v3)
**n8n Integration + Production Hardening + UI Improvements:**

1. **n8n Workflow Automation**
   - Creat `src/services/n8n.js` — helper centralizat fire-and-forget webhook
   - Integrat webhook triggers in: auth.js, reviews.js, business-portal.js, admin.js, subscriptions.js
   - WF1: New Review → Email Owner (via Resend API din n8n)
   - Export JSON in `n8n-workflows/WF1_New_Review_Notify_Owner.json`

2. **Security Hardening**
   - JWT_SECRET throw fatal in production (auth.js + middleware/auth.js)
   - Rate limiting: verifyResetCodeLimiter (5/15min), adminLimiter (200/min)
   - Removed admin skip din generalLimiter
   - CORS restrict — nu mai accepta orice .vercel.app/.railway.app wildcard in productie
   - Admin error handler — mesaj generic in productie, HTML escaped in dev

3. **Paginare pe toate endpoint-urile**
   - Helper centralizat: `src/helpers/validate.js` (parsePagination, paginatedResponse)
   - Endpoint-uri: /offers, /businesses, /reviews/business/:id, /favorites, /subscriptions
   - Format: `{ data, pagination: { page, limit, total, totalPages } }`
   - Frontend actualizat cu pattern `Array.isArray(json) ? json : (json.data ?? json)`

4. **Input Validation**
   - isValidEmail, sanitizeString (max length), validateInt, isValidCoordinates
   - Review comment sanitizat la max 2000 caractere
   - business_id required validation pe POST /reviews

5. **Database**
   - statement_timeout: 10000 (10s max per query)

6. **Bug Fix: Onboarding Skip**
   - `app/onboarding.tsx`: `router.replace("/")` → `router.replace("/(tabs)")`
   - Butonul "Sari peste deocamdata" nu functiona pentru ca ruta "/" nu exista

7. **Tab "Colectia mea" (merge Urmarite + Favorite)**
   - `app/(tabs)/subscriptions.tsx` rescris complet
   - ModeToggle cu 2 butoane: "Business-uri" (storefront icon) si "Oferte" (bookmark icon)
   - Badge count pe fiecare buton, accent orange pe cel activ
   - Business-uri view: search, sort, city chips, unfollow (logica existenta)
   - Oferte view: OfferCard + buton "Sterge din favorite"
   - Header: "Colectia mea" (redenumit din "Urmarite")
   - Guest state unificat
   - Pull-to-refresh pe ambele moduri

**Fisiere create:**
- `src/services/n8n.js`
- `src/helpers/validate.js`
- `n8n-workflows/WF1_New_Review_Notify_Owner.json`

**Fisiere modificate (backend):**
- `src/index.js` — CORS, rate limiters, admin error handler
- `src/db.js` — statement_timeout
- `src/middleware/auth.js` — JWT_SECRET guard
- `src/middleware/rateLimiter.js` — new limiters
- `src/routes/auth.js`, `offers.js`, `businesses.js`, `reviews.js`, `favorites.js`, `subscriptions.js`, `business-portal.js`, `admin.js`

**Fisiere modificate (frontend):**
- `app/onboarding.tsx` — skip fix
- `app/(tabs)/subscriptions.tsx` — rescris complet (ModeToggle)
- `app/(tabs)/index.tsx` — pagination support
- `app/business/[id].tsx` — pagination support
- `app/offer/[id].tsx` — pagination support
- `app/favorites/index.tsx` — pagination support

---

### 3 Februarie 2026 (v2)
**AI Review Summarization & Rebranding:**

1. **Claude Haiku - Review Summarization**
   - Integrare Anthropic SDK (`@anthropic-ai/sdk`)
   - Sumarizare automata pentru business-uri cu 3+ recenzii
   - Batch job scheduled la 2 zile (Railway Cron, 03:00 AM)
   - Filtrare avansata: spam, injuraturi, caractere random
   - Admin panel: `/admin/review-summaries`
   - Frontend: card "Pe baza recenziilor"

2. **Rebranding AppReduceri → OFAI**
   - Toate ecranele mobile, legal pages, backend
   - Email sender: `OFAI <noreply@ofai.ro>`
   - Cloudinary upload folder: `ofai/`

3. **Fix active_offers_count**

---

### 3 Februarie 2026
**EAS Build & Mobile App:**
- EAS Build configurat (Android APK functional)
- OTA Updates cu `eas update`
- Mapbox harta cu business markers
- UI/UX improvements (toast, aurora, vignete)

---

### 31 Ianuarie 2026
**Push Notifications implementate**

### 27 Ianuarie 2026
**Faza 1 - Fundatie:** Rate limiting, Sentry, Resend email, DB indexes

### 24 Ianuarie 2026
- Setup initial proiect, Dock, Business Portal, Auth flow
