# Tier 3 — Nice to Have (Diferentiere)

> **Prioritate:** Cand Tier 1 si 2 sunt gata
> **Nota:** Fiecare item e independent, se pot implementa in orice ordine

---

## 13. Collections / Liste Curate

**Ce:** Liste editoriale: "Top 10 restaurante cu reduceri in Cluj", "Weekend la spa sub 100 RON"

**Unde:**
- Backend: `collections` table (id, title, description, image_url, offer_ids[], is_active, sort_order)
- Backend: `GET /collections` (public), `POST/PUT/DELETE /admin/collections` (admin)
- Flutter: Sectiune pe Home + ecran dedicat CollectionDetailScreen

**Plan:**
1. Migration: `collections` table + `collection_offers` junction table
2. Admin: CRUD collections cu drag-and-drop offer ordering
3. API: `GET /collections` (lista), `GET /collections/:id` (detaliu cu oferte)
4. Flutter Home: Sectiune "Colectii" cu horizontal scroll de carduri mari (imagine + titlu)
5. Flutter: CollectionDetailScreen cu lista oferte din colectie

---

## 14. Gamification UI (Re-integrare)

**Ce:** Provider-ul exista (`gamification_provider.dart`) dar UI-ul e scos. Re-integram vizual.

**Unde:**
- `ofai_flutter/lib/screens/account/account_screen.dart`
- `ofai_flutter/lib/providers/gamification_provider.dart`
- Posibil ecran dedicat `GamificationScreen`

**Plan:**
1. Pe Account screen: card cu nivel, puncte, streak counter (inline, nu ecran separat)
2. Progress bar catre urmatorul nivel
3. Badge showcase (deja exista partial — verificam)
4. Optional: ecran detaliat cu istoricul punctelor si badge-urilor castigate
5. Cleanup: stergem TODO-ul din provider, actualizam FAQ-ul din Help screen

---

## 15. Offline Voucher Storage

**Ce:** QR codes/promo codes revelate salvate local pentru acces offline.

**Unde:**
- SharedPreferences sau Hive
- `ofai_flutter/lib/screens/offer/offer_detail_screen.dart` (la reveal)
- Posibil ecran "Ofertele Mele"

**Plan:**
1. La reveal promo code, salvez local: offer_id, code, business_name, offer_title, revealed_at, expires_at
2. Ecran "Ofertele Mele" (in Collection tab sau Account) cu lista codurilor revelate
3. Fiecare cod are QR generat local (qr_flutter package)
4. Functioneaza offline — datele sunt locale
5. Expira automat dupa endDate

---

## 16. Deep Links Universale

**Ce:** ofai.ro/oferta/123 deschide app-ul daca e instalat, altfel web.

**Unde:**
- Android: `AndroidManifest.xml` (intent filters)
- iOS: `Info.plist` + `apple-app-site-association`
- Backend: `/.well-known/apple-app-site-association` + `/.well-known/assetlinks.json`
- Flutter: GoRouter route matching

**Plan:**
1. Android: Adaug intent filter pentru `https://ofai.ro/oferta/*` si `https://ofai.ro/business/*`
2. iOS: Apple App Site Association file pe backend
3. Backend: Serve `.well-known/assetlinks.json` pentru Android App Links
4. Flutter: GoRouter deja are `/offer/:id` si `/business/:id` — trebuie doar sa parseze incoming links
5. Testare: share link -> open in browser -> redirect to app

---

## 17. Light Mode Toggle

**Ce:** Optiune de a schimba intre dark si light mode.

**Unde:**
- `ofai_flutter/lib/core/theme/app_theme.dart` (adaug `AppTheme.light`)
- `ofai_flutter/lib/core/theme/app_colors.dart` (variante light)
- `ofai_flutter/lib/screens/account/preferences_screen.dart` (toggle)
- SharedPreferences (persista alegerea)

**Plan:**
1. Definesc palette light in `app_colors.dart` (bg alb, text negru, accent orange pastrat)
2. Creez `AppTheme.light` in `app_theme.dart`
3. Provider `themeProvider` care citeste din SharedPreferences
4. MaterialApp: `themeMode` dinamic (system/light/dark)
5. Toggle in Preferences: System / Light / Dark
