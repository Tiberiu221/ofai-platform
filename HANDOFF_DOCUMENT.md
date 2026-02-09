# OFAI - Handoff Document
## Data: 9 Februarie 2026 (Actualizat v5 — Post-Migrare EJS)

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
│   │       ├── css/main.css       # Design system complet (~1360 linii)
│   │       └── js/main.js         # Navbar, scroll reveal, counters, favorites, follow
│   ├── scripts/                   # Batch jobs, monitoring
│   └── migrations/                # SQL migrations
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
- [x] **main.js:** Toast system, toggleFavorite, toggleFollow, FAQ accordion, star rating
- [x] **Trust proxy:** Configurat pentru Railway/Cloudflare (cookie Secure, rate limiter IP)

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

### ⚠️ PROBLEMA ACTIVA: Safari/iOS nu acceseaza ofai.ro

**Simptom:** `ERR_NAME_NOT_RESOLVED` pe `www.ofai.ro` din Safari iOS
**Cauza:** Safari pe iOS adauga automat `www.` prefix. Railway trebuie sa recunoasca domeniul `www.ofai.ro`.
**Status DNS:** Cloudflare rezolva corect AMBELE (`@` si `www` → Railway IPs) ✅
**Problema:** Railway returneaza **404** pe `www.ofai.ro` (nu recunoaste domeniul)

**SOLUTIE:** In **Railway Dashboard** → proiect → Settings → Networking → Custom Domains:
- Adauga `www.ofai.ro` ca al doilea custom domain (pe langa `ofai.ro` existent)
- Optional: Adauga Cloudflare Page Rule: `www.ofai.ro/*` → 301 redirect → `https://ofai.ro/$1`

### 2. n8n Workflows de implementat
WF1 (New Review → Email Owner) este complet. Restul:
- **WF2:** New Offer → Push notification la followers
- **WF3:** Daily digest (oferte noi din ziua precedenta)
- **WF4:** Review reminder (dupa vizita/achizitie)
- **WF5:** Welcome series (drip emails dupa inregistrare)
- **WF6:** Admin alerts (business nou, review negativ)

### 3. Footer link-uri
Link-urile din footer sunt pe `#` — trebuie actualizate la paginile EJS existente.

### 4. Galerie imagini business
Business-urile au si `business_images` (galerie) pe langa logo/cover. Galeria NU este inca in portal manage page. Doar logo si cover au upload/delete.

### 5. Oferte Nu Apar
Ofertele trebuie sa aiba `is_active = TRUE` si `end_date >= CURRENT_DATE`:
```sql
UPDATE offers SET end_date = '2026-12-31' WHERE end_date < CURRENT_DATE;
UPDATE offers SET is_active = TRUE WHERE is_active = FALSE;
```

### 6. Seed Production Database
Scriptul de seed pentru business-uri:
```bash
cd C:\Users\tiber\Desktop\AppReduceri\appredueri_backend
DATABASE_URL="postgres://postgres:REDACTED@REDACTED_DB_HOST/railway" node scripts/seed-businesses.js
```

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
- [ ] n8n WF2-WF6

---

## PRIORITATI URMATOARE

1. **⚠️ Railway custom domain `www.ofai.ro`** — adauga in Railway Settings pentru a fixa Safari/iOS
2. **Galerie imagini** — adauga upload/delete gallery images in portal manage page
3. **Footer link-uri** — actualizeaza link-urile din footer.ejs (momentan pe #)
4. **n8n WF2-WF6** — workflow-uri suplimentare
5. **Seed production** — ruleaza seed-businesses.js pe production DB
6. **iOS Build** — necesita Mac sau cont Apple Developer ($99/an)
7. **Play Store** — publicare APK pe Google Play

---

## ISTORIC ACTUALIZARI

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
