# OFAI - Note Proiect

> Ultima actualizare: Ianuarie 2026

---

## 🔗 Servicii & Dashboard-uri

| Serviciu | URL | Scop |
|----------|-----|------|
| **Railway** | https://railway.app/dashboard | Backend hosting + PostgreSQL |
| **Vercel** | https://vercel.com/dashboard | Frontend hosting + DNS |
| **GitHub** | https://github.com/Tiberiu221 | Repository cod |
| **Sentry** | https://sentry.io | Error tracking |
| **Resend** | https://resend.com | Email transactional |
| **Cloudinary** | https://cloudinary.com/console | Stocare imagini |
| **pgAdmin 4** | Local app | Administrare bază de date |

---

## 🔑 Credențiale (NU păstra aici - folosește password manager!)

Toate credențialele sunt în:
- **Railway** → Variables (pentru producție)
- **Bitwarden/1Password** (pentru backup personal)

### Variabile necesare în Railway:

```
DATABASE_URL=postgresql://...
JWT_SECRET=...
ADMIN_USER=...
ADMIN_PASSWORD=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
SENTRY_DSN=...
RESEND_API_KEY=...
FROM_EMAIL=OFAI <noreply@ofai.ro>
NODE_ENV=production
```

---

## 🏗️ Arhitectură

```
AppReduceri/
├── appredueri_backend/     # Node.js + Express API
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Auth, rate limiting
│   │   ├── services/       # Cloudinary, Email, Sentry
│   │   └── views/admin/    # Admin panel (EJS)
│   └── migrations/         # SQL migrations
│
├── appredueri_mobile/      # React Native + Expo
│   ├── app/                # Screens (Expo Router)
│   ├── components/         # UI components
│   └── lib/                # API client, utilities
│
└── PROJECT_NOTES.md        # Acest fișier
```

---

## 🌐 URL-uri Producție

| Ce | URL |
|----|-----|
| API Backend | https://ofai-production.up.railway.app |
| Admin Panel | https://ofai-production.up.railway.app/admin |
| Website/App | https://ofai.ro |

---

## 🗄️ Conectare la Baza de Date (pgAdmin 4)

| Câmp | Valoare |
|------|---------|
| Host | `REDACTED_DB_HOST` |
| Port | `11803` |
| Database | `railway` |
| Username | `postgres` |
| Password | (din Railway → PostgreSQL → Variables) |
| SSL Mode | Require |

---

## 📧 Email (Resend)

- **Domeniu verificat:** ofai.ro
- **DKIM:** ✅ Verificat
- **SPF/MX:** Pending (funcționează și fără)
- **FROM_EMAIL:** `OFAI <noreply@ofai.ro>`

---

## 🌍 DNS (Vercel)

Domeniul `ofai.ro` folosește nameservers Vercel:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

Înregistrări adăugate:
- TXT `resend._domainkey` → DKIM pentru email
- TXT `send` → SPF (pending)

---

## ✅ Faze Implementate

### Faza 1 - Fundație ✅ COMPLETĂ
- [x] Rate limiting pe API
- [x] Sentry error tracking
- [x] Email transactional (Resend)
- [x] Indexuri DB pentru performanță

### Faza 2 - Engagement (TODO)
- [ ] Push notifications
- [ ] Nearby offers (sortare după distanță)
- [ ] Căutare îmbunătățită
- [ ] Sistem de puncte

### Faza 3 - Monetizare (TODO)
- [ ] Stripe integration
- [ ] Planuri pentru business-uri
- [ ] Dashboard analytics
- [ ] Featured offers

### Faza 4 - Scalare (TODO)
- [ ] Self-service onboarding
- [ ] Referral system
- [ ] Deep links
- [ ] Expansion în orașe noi

---

## 🐛 Probleme Cunoscute / De Rezolvat

- [ ] MX record pentru Resend (nu se poate adăuga din Vercel UI - necesită CLI)
- [ ] ... (adaugă aici ce mai găsești)

---

## 📝 Comenzi Utile

### Git
```bash
git add .
git commit -m "mesaj"
git push
```

### Railway CLI
```bash
railway link              # Conectează proiectul
railway up               # Deploy manual
railway logs             # Vezi loguri
railway connect postgres # Conectare DB
```

### Vercel CLI
```bash
vercel                   # Deploy
vercel dns add ofai.ro   # Adaugă DNS record
```

### Local Development
```bash
# Backend
cd appredueri_backend
npm run dev

# Mobile
cd appredueri_mobile
npx expo start
```

---

## 📅 Istoric Schimbări

### Ianuarie 2026
- Adăugat rate limiting
- Integrat Sentry pentru error tracking
- Integrat Resend pentru email-uri
- Creat indexuri DB pentru performanță
- Conectat pgAdmin 4 la Railway

---

## 🆘 Dacă Ceva Nu Merge

1. **Backend crash:** Verifică Railway logs
2. **Email nu se trimite:** Verifică RESEND_API_KEY în Railway
3. **Erori în producție:** Verifică Sentry dashboard
4. **DB lent:** Rulează `ANALYZE;` în pgAdmin
5. **Nu mă pot conecta la DB:** Verifică dacă Public Networking e activ în Railway

---

*Actualizează acest fișier când faci schimbări majore!*
