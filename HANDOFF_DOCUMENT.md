# OFAI - Handoff Document
## Data: 3 Februarie 2026 (Actualizat v2)

---

## 📍 INFORMAȚII PROIECT

**Nume:** OFAI
**Scop:** Platformă de oferte și reduceri pentru piața din România
**Domeniu:** https://ofai.ro

**Tech Stack:**
- **Frontend:** React Native / Expo (cross-platform: web + mobile)
- **Backend:** Node.js / Express
- **Database:** PostgreSQL
- **Hosting Backend:** Railway
- **Hosting Frontend:** Vercel
- **Imagini:** Cloudinary
- **Email:** Resend (welcome + password reset) — domeniu ofai.ro verificat
- **Error Tracking:** Sentry
- **AI/LLM:** Anthropic Claude Haiku (review summarization)
- **GitHub:** https://github.com/Tiberiu221/OFAI

---

## 📂 STRUCTURA PROIECT LOCAL

```
C:\Users\tiber\Desktop\AppReduceri\
├── appredueri_mobile/     # Frontend React Native/Expo
│   ├── app/               # Expo Router pages
│   │   ├── (tabs)/        # Tab-urile principale (Home, Map, Subscriptions, Account)
│   │   ├── auth/          # Login, Register, Forgot Password
│   │   ├── business/      # Pagini detaliu business
│   │   ├── offer/         # Pagini detaliu ofertă
│   │   ├── business-portal/ # Portal pentru business owners
│   │   └── legal/         # Terms, Privacy
│   ├── components/        # Componente reutilizabile
│   └── web/               # Custom web assets (index.html)
│
└── appredueri_backend/    # Backend Node.js
    ├── src/
    │   ├── routes/        # API endpoints
    │   ├── middleware/    # Auth middleware
    │   ├── config/        # LLM config
    │   ├── services/
    │   │   ├── llm/       # Claude AI review summarization
    │   │   ├── cloudinary.js
    │   │   ├── email.js
    │   │   ├── pushNotifications.js
    │   │   └── sentry.js
    │   └── views/admin/   # Admin panel (EJS)
    ├── scripts/           # Batch jobs, monitoring, A/B testing
    └── migrations/        # SQL migrations
```

---

## 🌐 URLs & CONFIGURAȚII

### Producție
- **Website:** https://ofai.ro
- **API:** https://ofai-production.up.railway.app
- **Vercel Dashboard:** Deployment automat pe push la GitHub

### Development
- **Frontend:** http://localhost:8081 (`npx expo start --web`)
- **Backend:** http://localhost:4000 (`npm run dev`)
- **API Config:** `app/config.ts` - detectează automat environment

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
```

### Railway Cron Job
```
Command: npm run review-summaries:batch
Schedule: 0 3 */2 * *   (la 2 zile, 03:00 AM)
```

---

## ✅ CE ESTE COMPLET

### Infrastructură
- [x] Backend deployed pe Railway cu PostgreSQL
- [x] Frontend deployed pe Vercel
- [x] Domeniu custom ofai.ro configurat
- [x] CORS configurat pentru Vercel + Railway subdomains
- [x] SSL automat
- [x] **Rate Limiting** - protecție DDoS/spam (100 req/min general, 10/15min auth)
- [x] **Sentry** - error tracking în producție
- [x] **Database Indexes** - queries optimizate pentru performanță

### Autentificare
- [x] Login / Register / Logout
- [x] Password reset flow (cu cod pe email de pe noreply@ofai.ro)
- [x] JWT token-based auth
- [x] Role-based access (user, business_owner, admin)
- [x] GDPR-compliant account deletion
- [x] **Welcome email** - trimis automat la înregistrare (Resend, de pe ofai.ro)
- [x] **Password reset email** - cu cod de 6 cifre, design profesional

### AI Review Summarization (Claude Haiku)
- [x] Sumarizare automată recenzii business-uri (min 3 reviews)
- [x] Batch job scheduled la 2 zile (Railway Cron, 03:00 AM)
- [x] Filtrare review-uri spam/înjurături/caractere random
- [x] Caching în DB (tabel `review_summaries`)
- [x] NU generează on-demand (anti-abuse, cost fix)
- [x] Admin page: `/admin/review-summaries` (batch manual, regenerare, ștergere cache)
- [x] Frontend: card "Pe baza recenziilor" pe pagina business
- [x] Cost estimat: ~$0.07/lună pentru 100 business-uri

### Business Portal
- [x] Lista business-uri pentru owner
- [x] Editare informații business
- [x] Upload imagini (logo, cover, galerie) - via Cloudinary
- [x] Sistem de rezervări (telefon, WhatsApp, link)
- [x] Gestionare oferte (creare, editare, activare/dezactivare)
- [x] Preview business

### Dock (Navigation Bar)
- [x] Dock animat pe web (framer-motion)
- [x] Dock nativ pe mobile (cu magnifying lens effect)
- [x] Apare pe toate paginile EXCEPȚIE auth (login, register, forgot-password)
- [x] Fișiere: `components/Dock.tsx` (native), `components/Dock.web.tsx` (web)

### Auth Screens
- [x] Buton "Explorează reduceri fără cont" pe toate paginile auth
- [x] Permite accesul la app fără autentificare

### Branding
- [x] Rebrand complet AppReduceri → OFAI (toate ecranele, email-uri, legal, docs)
- [x] Email-uri trimise de pe `noreply@ofai.ro` (Resend, domeniu verificat DKIM)
- [x] Cloudinary upload folder: `ofai/`
- [x] Foldere interne rămân `appredueri_*` (nu se schimbă pentru compatibilitate)

---

## 🔧 CE TREBUIE FĂCUT / CUNOSCUT

### 1. Baza de Date Locală - Migrație Necesară
Dacă primești eroare `column "image_url" does not exist`:
```sql
ALTER TABLE business_images ADD COLUMN IF NOT EXISTS image_url TEXT;
```

### 2. Fișier de Șters
**IMPORTANT:** Șterge `components/Dock.native.tsx` - conținutul a fost mutat în `Dock.tsx`:
```bash
del C:\Users\tiber\Desktop\AppReduceri\appredueri_mobile\components\Dock.native.tsx
```

### 3. Oferte Nu Apar
Problema: Ofertele trebuie să aibă `is_active = TRUE` și `end_date >= CURRENT_DATE`
```sql
-- Verifică ofertele
SELECT id, title, is_active, end_date FROM offers;

-- Fix rapid
UPDATE offers SET end_date = '2026-12-31' WHERE end_date < CURRENT_DATE;
UPDATE offers SET is_active = TRUE WHERE is_active = FALSE;
```

### 4. Cloudinary - Railway
Variabilele de environment pentru Cloudinary trebuie adăugate manual în Railway:
- `CLOUDINARY_CLOUD_NAME` = `dtlawgplb`
- `CLOUDINARY_API_KEY` = `924953315261555`
- `CLOUDINARY_API_SECRET` = (din Cloudinary dashboard)

### 5. Web Mobile Styling (Parțial Rezolvat)
- Problema: Zone albe pe iPhone în Safari (status bar, home indicator)
- Soluție încercată: `web/index.html` cu theme-color meta tag
- Status: Necesită testare după clear cache Safari

---

## 📁 FIȘIERE CHEIE MODIFICATE RECENT

```
appredueri_backend/
├── src/
│   ├── index.js                 # + Rate limiting, Sentry, Push tokens, health check "OFAI"
│   ├── config/
│   │   └── llm.js               # NOU - Configurare Claude Haiku (model, tokens, temperature)
│   ├── middleware/
│   │   ├── auth.js              # + requireAdmin, requireBusinessOwner
│   │   ├── adminAuth.js         # Realm schimbat la "Admin OFAI"
│   │   └── rateLimiter.js       # NOU - Rate limiting middleware
│   ├── services/
│   │   ├── llm/                 # NOU - AI Review Summarization
│   │   │   ├── anthropicClient.js   # Client Claude cu retry/exponential backoff
│   │   │   ├── prompts.js           # System/user prompts + validare summar
│   │   │   ├── summarizationService.js  # Orchestrare generare + cache + filtrare
│   │   │   └── README.md            # Documentație LLM services
│   │   ├── email.js             # Resend email (FROM_EMAIL: noreply@ofai.ro)
│   │   ├── cloudinary.js        # Upload folder: ofai/
│   │   ├── sentry.js            # Sentry error tracking
│   │   └── pushNotifications.js # Expo Push API service
│   ├── routes/
│   │   ├── admin.js             # + Review summaries admin panel (batch, regenerate, clear)
│   │   ├── businesses.js        # + Review summary cache-only retrieval
│   │   ├── reviews.js           # Fără invalidare cache on-demand
│   │   ├── subscriptions.js     # Fix active_offers_count (COUNT DISTINCT)
│   │   ├── auth.js              # + Welcome email, password reset email
│   │   └── push-tokens.js       # Push tokens management
│   ├── views/admin/
│   │   └── review-summaries.ejs # NOU - Admin page review summaries
│   └── migrations/
│       ├── create_review_summaries.sql  # NOU - Tabel review_summaries
│       ├── 009_performance_indexes.sql  # DB indexes
│       └── 010_push_tokens.sql          # Push tokens tables
├── scripts/
│   ├── review-summary-batch.js  # NOU - Batch job (la 2 zile)
│   ├── check-llm-budget.js      # NOU - Monitorizare costuri LLM
│   ├── monitor-llm-costs.sql    # NOU - SQL queries costuri
│   └── ab-test-prompts.js       # NOU - A/B testing prompts

appredueri_mobile/
├── app/
│   ├── _layout.tsx              # + usePushNotifications hook
│   ├── types.ts                 # + ReviewSummary interface
│   ├── (tabs)/
│   │   ├── index.tsx            # Rebrand "Contul tău OFAI"
│   │   └── account.tsx          # Versiune: "OFAI v1.0.4"
│   ├── business/
│   │   └── [id].tsx             # + ReviewSummary component
│   ├── settings.tsx             # Rebrand "OFAI v1.0.4"
│   ├── help.tsx                 # Rebrand, email support@ofai.ro
│   ├── legal/
│   │   ├── terms.tsx            # Rebrand complet OFAI
│   │   └── privacy.tsx          # Rebrand complet OFAI
│   ├── hooks/
│   │   └── usePushNotifications.ts
│   ├── auth/
│   │   ├── login.tsx            # + buton "Explorează fără cont"
│   │   ├── register.tsx         # + buton "Explorează fără cont"
│   │   └── forgot-password.tsx  # + buton "Explorează fără cont"
│   └── config.ts               # API URL configuration
│
├── components/
│   ├── ReviewSummary.tsx        # NOU - Card "Pe baza recenziilor"
│   ├── Dock.tsx                 # Native Dock (iOS/Android)
│   ├── Dock.web.tsx             # Web Dock (framer-motion)
│   ├── BusinessMap.native.tsx   # Mapbox hartă cu markers
│   ├── AuroraBackground.tsx     # + Vignete în background
│   └── Toast.tsx                # Toast notifications component
│
├── assets/legal/
│   └── privacy-policy.md       # Rebrand OFAI
├── app.config.js               # Înlocuiește app.json (suport env vars)
├── eas.json                    # EAS Build configuration
│
└── web/
    └── index.html              # Custom HTML pentru dark theme

Root/
├── REVIEWS_SUMMARIZATION_PLAN.md    # Plan integrare LLM
├── LLM_INTEGRATION_GUIDE.md        # Ghid complet LLM (concepte, costuri, flow)
├── CHANGELOG_LLM.md                # Changelog feature LLM
├── PROJECT_NOTES.md                 # Documentație și organizare
└── README.md                        # Rebrand: "# OFAI"
```

---

## 🚀 COMENZI UTILE

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
# Vercel și Railway se actualizează automat
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

# OTA Update (după ce ai build instalat)
eas update --branch preview --message "descriere modificări"

# Vezi builds
eas build:list

# Pornește emulator și app
npx expo start --android
```

### LLM Review Summaries
```bash
cd C:\Users\tiber\Desktop\AppReduceri\appredueri_backend

# Rulare batch manuală (generare sumare pentru toate business-urile eligibile)
npm run review-summaries:batch

# Monitorizare costuri LLM
node scripts/check-llm-budget.js

# A/B test prompts
node scripts/ab-test-prompts.js
```

---

## 🔧 SERVICII EXTERNE CONFIGURATE

### Sentry (Error Tracking)
- **Dashboard:** https://sentry.io
- **Proiect:** ofai-backend
- **Funcționare:** Capturează automat erorile 500+ în producție

### Resend (Email)
- **Dashboard:** https://resend.com
- **Domeniu:** ofai.ro (DKIM verificat ✅)
- **Email sender:** `OFAI <noreply@ofai.ro>`
- **Email-uri active:**
  - Welcome email (la înregistrare)
  - Password reset (cu cod 6 cifre)
- **Status DNS:** DKIM ✅, SPF/MX pending (funcționează și fără)

### Anthropic / Claude (AI)
- **Dashboard:** https://console.anthropic.com
- **Model:** Claude 3 Haiku (`claude-3-haiku-20240307`)
- **Utilizare:** Sumarizare automată recenzii business-uri
- **Cost:** ~$0.25/1M input tokens, $1.25/1M output tokens
- **Budget estimat:** ~$0.07/lună pentru 100 business-uri
- **Env var:** `ANTHROPIC_API_KEY` (în Railway)

### pgAdmin 4 (Database Management)
- **Conexiune Railway:**
  - Host: `REDACTED_DB_HOST`
  - Port: `11803`
  - Database: `railway`
  - Username: `postgres`
  - SSL Mode: `Require`

---

## 🎯 FAZE IMPLEMENTARE

### ✅ Faza 1 - Fundație (COMPLETĂ)
- [x] Rate limiting pe API
- [x] Sentry error tracking
- [x] Email transactional (Resend)
- [x] Indexuri DB pentru performanță

### ✅ Faza 2 - Engagement (COMPLETĂ)
- [x] Push notifications (Expo Push API)
- [x] EAS Build configurat (Android APK)
- [x] OTA Updates cu `eas update`
- [x] Mapbox hartă integrată
- [x] Sistem de puncte (recenzii)
- [x] Nearby offers (sortare după distanță)

### ✅ Faza 2.5 - AI & Branding (COMPLETĂ)
- [x] AI Review Summarization cu Claude Haiku
- [x] Scheduled batch job (la 2 zile, Railway Cron)
- [x] Admin panel review summaries
- [x] Filtrare review-uri spam/profanity/gibberish
- [x] Rebrand complet AppReduceri → OFAI
- [x] Email sender: noreply@ofai.ro
- [x] Fix active_offers_count (SQL subquery)

### 📋 Faza 3 - Monetizare (TODO)
- [ ] Stripe integration
- [ ] Planuri pentru business-uri
- [ ] Dashboard analytics
- [ ] Featured offers

### 🚀 Faza 4 - Scalare (TODO)
- [ ] Self-service onboarding
- [ ] Referral system
- [ ] Deep links
- [ ] Expansion în orașe noi

---

## 🎯 PRIORITĂȚI URMĂTOARE (Sugestii)

1. **iOS Build** - necesită Mac sau cont Apple Developer ($99/an)
2. **Play Store** - publicare APK pe Google Play
3. **Resend DNS** - verifică MX/SPF records în Vercel pentru email delivery
4. **GitHub Actions** - automatizare `eas update` la git push

---

## 📝 NOTE IMPORTANTE

1. **Două medii separate:** Localhost și Producție au baze de date diferite. Ce uploadezi local NU apare pe ofai.ro și invers.

2. **Dock logic:**
   - Pe web: `Dock.web.tsx` e selectat automat de bundler
   - Pe native: `Dock.tsx` e folosit
   - Root layout (`_layout.tsx`) adaugă Dock pentru paginile non-tabs pe web
   - Tabs layout (`(tabs)/_layout.tsx`) gestionează Dock pentru tab-uri

3. **API URL detection:** `app/config.ts` detectează automat dacă e producție sau development bazat pe `__DEV__` și `Platform.OS`
   - APK/Production: `https://ofai-production.up.railway.app`
   - Development Web: `http://localhost:4000`
   - Development Mobile: `http://192.168.0.30:4000`

4. **Cloudinary:** Imaginile din producție sunt stocate pe Cloudinary. Local folosește folderul `uploads/` din backend.

5. **EAS Update vs EAS Build:**
   - `eas build` = creează APK nou (trebuie reinstalat)
   - `eas update` = OTA update instant (doar JS/assets, fără reinstalare)
   - După `eas update`, închide și redeschide app-ul pentru a primi update

6. **Mapbox:**
   - Access Token (public): în `BusinessMap.native.tsx`
   - Download Token (secret): în `app.config.js` și `eas.json`
   - Nu funcționează în Expo Go (necesită build nativ)

7. **iOS Emulator:** Necesită Mac cu Xcode. Nu se poate emula iOS pe Windows.

8. **AI Review Summaries:**
   - Se generează DOAR prin batch job (la 2 zile) sau manual din admin
   - Frontend-ul NU poate declanșa generare (prevenire abuse/costuri)
   - Business-urile au nevoie de minim 3 recenzii valide
   - Review-urile cu spam/înjurături/caractere random sunt filtrate automat
   - Admin panel: `/admin/review-summaries` — control complet
   - Dacă ANTHROPIC_API_KEY lipsește, feature-ul este dezactivat silențios (graceful degradation)

9. **Branding:** Peste tot în UI/email-uri scrie "OFAI". Folderele locale și package names rămân `appredueri_*` pentru a nu sparge import paths și config-uri existente.

---

## 📅 ISTORIC ACTUALIZĂRI

### 3 Februarie 2026 (v2)
**AI Review Summarization & Rebranding:**

1. **Claude Haiku - Review Summarization**
   - Integrare Anthropic SDK (`@anthropic-ai/sdk`)
   - Sumarizare automată pentru business-uri cu 3+ recenzii
   - Batch job scheduled la 2 zile (Railway Cron, 03:00 AM)
   - Filtrare avansată: spam, înjurături, caractere random, mesaje prea scurte
   - Prompt engineering: context OFAI, output în română, max 2-3 propoziții
   - Caching în tabel `review_summaries` (anti-abuse, cost fix)
   - Admin panel: `/admin/review-summaries` (batch manual, regenerare individuală, ștergere cache)
   - Frontend: card "Pe baza recenziilor" pe pagina business
   - Retry cu exponential backoff pentru rate limits
   - Cost tracking: tokens_used per summary

2. **Rebranding AppReduceri → OFAI**
   - Toate ecranele mobile (settings, help, account, home)
   - Legal pages (terms, privacy) — inclusiv email-uri contact
   - Backend health check, admin realm
   - Email sender: `OFAI <noreply@ofai.ro>`
   - Cloudinary upload folder: `ofai/`
   - Documentație (README, PROJECT_NOTES, HANDOFF)
   - Folderele interne rămân `appredueri_*` (compatibilitate)

3. **Fix active_offers_count**
   - Bug: JOIN-uri multiple inflau numărul de oferte
   - Fix: subquery în `businesses.js`, `COUNT(DISTINCT)` în `subscriptions.js`

**Migrație necesară:**
```sql
-- Rulează în pgAdmin pentru producție
-- Conținutul din: appredueri_backend/migrations/create_review_summaries.sql
```

**Dependențe noi backend:**
```json
"@anthropic-ai/sdk": "^0.39.x"
```

**Dependențe noi frontend:**
```json
"date-fns": "^4.x"
```

---

### 3 Februarie 2026
**EAS Build & Mobile App:**

1. **EAS Build configurat** (`eas.json`, `app.config.js`)
   - Converted `app.json` → `app.config.js` pentru env vars
   - Mapbox token configurat pentru builds
   - Profiluri: development, preview, production
   - Android APK funcțional

2. **OTA Updates funcționale**
   - Comanda: `eas update --branch preview --message "descriere"`
   - Updates instant pe telefoane fără reinstalare
   - Necesită închidere/redeschidere app pentru aplicare

3. **Mapbox hartă** (`components/BusinessMap.native.tsx`)
   - Hartă dark mode cu business markers
   - Badge pentru oferte active (iconiță pricetag)
   - Bottom sheet cu detalii business
   - Filtrare pe categorii și căutare
   - Navigare către Google Maps/Waze
   - Bottom sheet poziționat corect deasupra tab bar

4. **UI/UX Improvements**
   - Eliminat gradient fade din header homepage
   - Adăugat vignete în AuroraBackground
   - Toast notifications în loc de Alert.alert (tema dark)
   - Fix: filtrele categorii funcționează la fel pentru logat/nelogat

5. **Bug Fixes**
   - Fix `active_offers_count` - acum verifică și `end_date >= CURRENT_DATE`
   - Fix filtru categorii pentru utilizatori autentificați (folosește /offers în loc de /feed când sunt filtre active)

**Comenzi EAS:**
```bash
# Build APK pentru testare
eas build --platform android --profile preview

# Update OTA (după ce ai build instalat)
eas update --branch preview --message "descriere"

# Pornește emulator Android
npx expo start --android
```

---

### 31 Ianuarie 2026
**Push Notifications implementate:**

1. **Backend** (`src/routes/push-tokens.js`, `src/services/pushNotifications.js`)
   - Expo Push API integration
   - Salvare/dezactivare tokens per user
   - Trimitere notificări: all, user, subscribers, city
   - Admin endpoints pentru broadcast
   - Logging notificări în DB

2. **Frontend** (`app/hooks/usePushNotifications.ts`)
   - Hook pentru gestionare push notifications
   - Înregistrare automată token la login
   - Dezactivare token la logout
   - Listener pentru notificări în foreground
   - Deep linking la tap pe notificare

3. **Database** (`migrations/010_push_tokens.sql`)
   - Tabel `push_tokens` pentru stocarea tokens
   - Tabel `push_notifications_log` pentru analytics
   - Indexuri pentru performanță

4. **Configurare app.json**
   - Plugin expo-notifications adăugat
   - Android useNextNotificationsApi
   - iOS background modes

**Dependențe noi frontend:**
```bash
npx expo install expo-notifications expo-device
```

**Migrație necesară:**
```sql
-- Rulează în pgAdmin pentru producție
-- Conținutul din: appredueri_backend/src/migrations/010_push_tokens.sql
```

---

### 27 Ianuarie 2026
**Faza 1 - Fundație implementată:**

1. **CORS Fix pentru Railway**
   - Adăugat suport pentru `.up.railway.app` în CORS config
   - Rezolvă eroarea "Not allowed by CORS" în admin panel

2. **Rate Limiting** (`src/middleware/rateLimiter.js`)
   - General: 100 requests/minut per IP
   - Auth: 10 încercări/15 minute (anti-brute force)
   - Password reset: 3 cereri/oră per email

3. **Sentry Error Tracking** (`src/services/sentry.js`)
   - Capturează automat erori 500+
   - Filtrează date sensibile (parole, tokens)
   - Dashboard: https://sentry.io

4. **Email Transactional** (`src/services/email.js`)
   - Integrat Resend API
   - Welcome email la înregistrare
   - Password reset cu design profesional
   - Domeniu ofai.ro verificat (DKIM)

5. **Database Indexes** (`migrations/009_performance_indexes.sql`)
   - Indexuri pe toate tabelele principale
   - Queries de 10-50x mai rapide
   - Rulat manual în pgAdmin

6. **Documentație**
   - Creat `PROJECT_NOTES.md` pentru organizare
   - Actualizat `HANDOFF_DOCUMENT.md`

**Dependențe noi adăugate:**
```json
"express-rate-limit": "^7.x",
"@sentry/node": "^8.x",
"resend": "^4.x"
```

### 24 Ianuarie 2026
- Setup inițial proiect
- Dock navigation implementat
- Business Portal funcțional
- Auth flow complet
