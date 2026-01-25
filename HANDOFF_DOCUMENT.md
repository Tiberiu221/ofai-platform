# OFAI (AppReduceri) - Handoff Document
## Data: 24 Ianuarie 2026

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
CLOUDINARY_CLOUD_NAME=dtlawgplb
CLOUDINARY_API_KEY=REDACTED
CLOUDINARY_API_SECRET=(din Cloudinary dashboard)
```

---

## ✅ CE ESTE COMPLET

### Infrastructură
- [x] Backend deployed pe Railway cu PostgreSQL
- [x] Frontend deployed pe Vercel
- [x] Domeniu custom ofai.ro configurat
- [x] CORS configurat pentru toate subdomeniile Vercel
- [x] SSL automat

### Autentificare
- [x] Login / Register / Logout
- [x] Password reset flow (cu cod pe email)
- [x] JWT token-based auth
- [x] Role-based access (user, business_owner, admin)
- [x] GDPR-compliant account deletion

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
appredueri_mobile/
├── app/
│   ├── _layout.tsx              # Root layout - Dock logic pentru web
│   ├── auth/
│   │   ├── login.tsx            # + buton "Explorează fără cont"
│   │   ├── register.tsx         # + buton "Explorează fără cont"
│   │   └── forgot-password.tsx  # + buton "Explorează fără cont"
│   └── config.ts                # API URL configuration
│
├── components/
│   ├── Dock.tsx                 # Native Dock (iOS/Android)
│   └── Dock.web.tsx             # Web Dock (framer-motion)
│
└── web/
    └── index.html               # Custom HTML pentru dark theme
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

---

## 🎯 PRIORITĂȚI URMĂTOARE (Sugestii)

1. **Testare completă pe iPhone** - verifică dark theme după clear cache Safari
2. **Email service** - configurare pentru password reset în producție
3. **Android APK** - build cu EAS (`eas build -p android`)
4. **Optimizări performance** - lazy loading imagini, caching
5. **Analytics** - integrare tracking utilizatori

---

## 📝 NOTE IMPORTANTE

1. **Două medii separate:** Localhost și Producție au baze de date diferite. Ce uploadezi local NU apare pe ofai.ro și invers.

2. **Dock logic:** 
   - Pe web: `Dock.web.tsx` e selectat automat de bundler
   - Pe native: `Dock.tsx` e folosit
   - Root layout (`_layout.tsx`) adaugă Dock pentru paginile non-tabs pe web
   - Tabs layout (`(tabs)/_layout.tsx`) gestionează Dock pentru tab-uri

3. **API URL detection:** `app/config.ts` detectează automat dacă e producție sau development bazat pe `NODE_ENV` și `Platform.OS`

4. **Cloudinary:** Imaginile din producție sunt stocate pe Cloudinary. Local folosește folderul `uploads/` din backend.
