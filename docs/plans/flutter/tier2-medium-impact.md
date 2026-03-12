# Tier 2 — Features cu Impact Mediu

> **Prioritate:** Dupa Tier 1
> **Nota:** Unele depind de backend changes

---

## 7. Flash Deals cu Countdown

**Ce:** Oferte limitate (2-4h) cu timer vizibil pe card si detail.

**Unde:**
- Backend: `offers` table — camp `flash_expires_at TIMESTAMPTZ`
- `ofai_flutter/lib/widgets/offer_card.dart` — countdown badge
- `ofai_flutter/lib/screens/offer/offer_detail_screen.dart` — countdown banner

**Plan:**
1. Migration: `ALTER TABLE offers ADD COLUMN flash_expires_at TIMESTAMPTZ`
2. Backend: La create/edit offer, daca `flash_expires_at` e setat, oferta e flash deal
3. Flutter model: Adaug `flashExpiresAt` pe `Offer`
4. OfferCard: Daca `flashExpiresAt` != null si e in viitor, afisez countdown live (HH:MM:SS) cu badge pulsant rosu
5. OfferDetail: Banner mare cu countdown si mesaj urgenta
6. Home screen: Sectiune dedicata "Oferte Flash" (horizontal scroll, inainte de "Pour toi")

---

## 8. Notification Preferences Granulare

**Ce:** Ecran in care user-ul controleaza ce notificari primeste.

**Unde:**
- `ofai_flutter/lib/screens/account/preferences_screen.dart` (extind)
- Backend: coloane noi pe users sau tabel `notification_preferences`

**Plan:**
1. Toggle-uri: Oferta Zilei (daily), Oferte noi de la business-uri urmarite, Flash deals, Digest saptamanal, Marketing
2. Backend: `notification_preferences` table (user_id, pref_key, enabled)
3. Flutter: Sectiune in PreferencesScreen cu SwitchListTile per categorie
4. Push service: Verifica preferintele inainte de a trimite

---

## 9. Expand "Pinch" cu Social Pressure

**Ce:** Pe business detail, arata numarul total de request-uri de oferta.

**Unde:**
- `ofai_flutter/lib/screens/business/business_detail_screen.dart` (exista deja pinch card)
- `ofai_flutter/lib/models/business.dart` (exista `offerRequestCount`)

**Plan:**
1. Verificam ca `offerRequestCount` se afiseaza vizibil pe business detail
2. Daca count > 5, adaugam text "X persoane asteapta o oferta!" cu emoji/icon de foc
3. Pe OfferCard sau BusinessCard, daca business-ul are > 10 requests, badge mic "Cerut de X persoane"

---

## 10. Post-Redemption Review Prompt

**Ce:** 24h dupa ce user-ul da reveal pe un promo code, push notification: "Cum a fost la [Business]?"

**Unde:**
- Backend: `cronJobs.js` — job nou
- Backend: `code_reveals` table (deja exista, are `revealed_at`)
- Push notification cu deep link la `/business/:id` (review section)

**Plan:**
1. Cron job zilnic: SELECT reveals din ultimele 24-48h care nu au review de la acelasi user pe acelasi business
2. Trimite push: "Ai folosit oferta de la [Business]? Lasa un review!"
3. Deep link: `/business/:businessId` (scroll to reviews)

---

## 11. Saved Searches cu Alerte

**Ce:** User-ul salveaza un search (query + filtre) si primeste notificare cand apar oferte noi.

**Unde:**
- Backend: `saved_searches` table (user_id, query, city_id, category_id, created_at)
- Backend: cron job care matchuieste oferte noi cu saved searches
- Flutter: Buton "Salveaza cautarea" pe Explore + ecran "Cautarile mele" in account

**Plan:**
1. Migration: `saved_searches` table
2. Backend: `POST /saved-searches`, `GET /saved-searches`, `DELETE /saved-searches/:id`
3. Backend: Cron daily — oferte noi din ultimele 24h matchuite cu saved searches → push
4. Flutter: Icon bookmark pe Explore search bar
5. Flutter: Lista "Cautarile mele" in Account (cu delete)

---

## 12. Weekly Digest Push

**Ce:** Duminica seara, push personalizat: "7 oferte noi saptamana asta in [Oras]"

**Unde:**
- Backend: `cronJobs.js`
- Folosim preferintele de oras/categorie ale user-ului

**Plan:**
1. Cron job duminica 19:00: pentru fiecare user cu push token activ
2. COUNT oferte noi din ultimele 7 zile in orasele/categoriile preferate
3. Daca count > 0, trimite push: "X oferte noi saptamana asta in [Oras]! Descopera-le pe OFAI"
4. Deep link: `/explore?city=X`
