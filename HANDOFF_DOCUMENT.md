# OFAI (AppReduceri) - Handoff Document
## Data: 3 Februarie 2026 (Actualizat)

---

## 📍 INFORMAȚII PROIECT

**Nume:** AppReduceri / OFAI
**Scop:** Platformă de oferte și reduceri pentru piața din România
**Domeniu:** https://ofai.ro

**Tech Stack:**
- **Frontend:** React Native / Expo (cross-platform: web + mobile)
- **Backend:** Node.js / Express
- **Database:** PostgreSQL
- **Hosting Backend:** Railway
- **Hosting Frontend:** Vercel
- **Imagini:** Cloudinary
- **Email:** Resend (welcome + password reset)
- **Error Tracking:** Sentry
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
    └── src/
        ├── routes/        # API endpoints
        ├── middleware/    # Auth middleware
        ├── services/      # Cloudinary, etc.
        └── views/         # Admin panel (EJS)
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
FROM_EMAIL=AppReduceri <noreply@ofai.ro>
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
- [x] Password reset flow (cu cod pe email)
- [x] JWT token-based auth
- [x] Role-based access (user, business_owner, admin)
- [x] GDPR-compliant account deletion
- [x] **Welcome email** - trimis automat la înregistrare (Resend)
- [x] **Password reset email** - cu cod de 6 cifre, design profesional

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
│   ├── index.js                 # + Rate limiting, Sentry, Push tokens route
│   ├── middleware/
│   │   ├── auth.js              # + requireAdmin, requireBusinessOwner
│   │   └── rateLimiter.js       # NOU - Rate limiting middleware
│   ├── services/
│   │   ├── email.js             # NOU - Resend email service
│   │   ├── sentry.js            # NOU - Sentry error tracking
│   │   └── pushNotifications.js # NOU - Expo Push API service
│   ├── routes/
│   │   ├── auth.js              # + Welcome email, password reset email
│   │   └── push-tokens.js       # NOU - Push tokens management
│   └── migrations/
│       ├── 009_performance_indexes.sql  # NOU - DB indexes
│       └── 010_push_tokens.sql          # NOU - Push tokens tables

appredueri_mobile/
├── app/
│   ├── _layout.tsx              # + usePushNotifications hook
│   ├── (tabs)/
│   │   └── index.tsx            # Fix filtru categorii pentru users logați
│   ├── business/
│   │   └── [id].tsx             # Toast în loc de Alert pentru reviews
│   ├── hooks/
│   │   └── usePushNotifications.ts  # Push notifications hook
│   ├── auth/
│   │   ├── login.tsx            # + buton "Explorează fără cont"
│   │   ├── register.tsx         # + buton "Explorează fără cont"
│   │   └── forgot-password.tsx  # + buton "Explorează fără cont"
│   └── config.ts                # API URL configuration
│
├── components/
│   ├── Dock.tsx                 # Native Dock (iOS/Android)
│   ├── Dock.web.tsx             # Web Dock (framer-motion)
│   ├── BusinessMap.native.tsx   # Mapbox hartă cu markers
│   ├── AuroraBackground.tsx     # + Vignete în background
│   └── Toast.tsx                # Toast notifications component
│
├── app.config.js                # NOU - Înlocuiește app.json (suport env vars)
├── eas.json                     # EAS Build configuration
│
└── web/
    └── index.html               # Custom HTML pentru dark theme

Root/
└── PROJECT_NOTES.md             # NOU - Documentație și organizare proiect
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

---

## 🔧 SERVICII EXTERNE CONFIGURATE

### Sentry (Error Tracking)
- **Dashboard:** https://sentry.io
- **Proiect:** appreduceri-backend
- **Funcționare:** Capturează automat erorile 500+ în producție

### Resend (Email)
- **Dashboard:** https://resend.com
- **Domeniu:** ofai.ro (DKIM verificat ✅)
- **Email-uri active:**
  - Welcome email (la înregistrare)
  - Password reset (cu cod 6 cifre)
- **Status DNS:** DKIM ✅, SPF/MX pending (funcționează și fără)

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

---

## 📅 ISTORIC ACTUALIZĂRI

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
