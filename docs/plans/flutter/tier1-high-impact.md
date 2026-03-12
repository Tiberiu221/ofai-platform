# Tier 1 — Features cu Impact Mare

> **Prioritate:** MAXIMA — se fac primele
> **Excluderi:** Map view pe Explore (amânat), Business portal Flutter (web-only, adaugam banner redirect)

---

## 1. Social Proof pe Carduri

**Ce:** Badge-uri vizuale pe OfferCard si FeaturedOfferCard — "Nou", "Se termina curand", numar reveals.

**Unde:**
- `ofai_flutter/lib/widgets/offer_card.dart`
- `ofai_flutter/lib/widgets/featured_offer_card.dart`
- `ofai_flutter/lib/models/offer.dart` (verificam ca avem `revealCount`, `createdAt`, `endDate`)

**Plan:**
1. Badge **"Nou"** — daca oferta are < 48h de la creare (folosim `offer.id` DESC ca proxy, sau adaugam `created_at` pe model daca backend-ul il trimite)
2. Badge **"Se termina curand"** — daca `endDate` e in urmatoarele 48h. Culoare urgenta (rosu/amber)
3. Badge **"X persoane au profitat"** — afisam `revealCount` pe card daca > 0. Text: "127 au profitat"
4. Badge **"Trending"** — deja exista `isTrending` pe model. Verificam ca se afiseaza vizibil
5. Badge **"Promovat"** — deja exista `isPromoted`. Verificam vizibilitate

**Reguli design:**
- Badge-urile stau pe imagine (colturi) sau sub titlu, in metadata row
- Max 2 badge-uri vizibile per card (prioritate: Trending > Nou > Se termina curand)
- Culori: Nou = accent, Se termina = danger, Trending = gradient accent

---

## 2. Recent Viewed (Vazute Recent)

**Ce:** Sectiune pe Home screen cu ultimele 5-10 oferte/business-uri vizitate.

**Unde:**
- `ofai_flutter/lib/screens/home/home_screen.dart`
- `ofai_flutter/lib/providers/` (provider nou sau SharedPreferences)
- `ofai_flutter/lib/widgets/offer_card.dart` (reuse horizontal mode)

**Plan:**
1. Creez `RecentlyViewedService` — salveaza ultimele 10 offer IDs + 10 business IDs in SharedPreferences (JSON list)
2. In `offer_detail_screen.dart` si `business_detail_screen.dart` — la initState, adaug ID-ul la recently viewed
3. Pe Home screen — sectiune "Vazute recent" cu horizontal scroll OfferCards (dupa "Pour toi" section)
4. Provider simplu care citeste din SharedPreferences si fetch-uieste detaliile

**Reguli:**
- Nu depinde de autentificare (functioneaza si nelogat)
- Max 10 items, FIFO (oldest removed when full)
- Nu afisam sectiunea daca lista e goala

---

## 3. Search History

**Ce:** Ultimele 10 cautari salvate local, afisate in dropdown-ul de search pe Explore.

**Unde:**
- `ofai_flutter/lib/screens/explore/explore_screen.dart`
- `ofai_flutter/lib/widgets/search_suggest_dropdown.dart`
- SharedPreferences (sau provider dedicat)

**Plan:**
1. Creez `SearchHistoryService` — salveaza ultimele 10 query-uri in SharedPreferences
2. La submit search pe Explore, salvez query-ul
3. In `SearchSuggestDropdown` — cand query e gol si dropdown e deschis, afisez "Cautari recente" cu chip X de stergere per item
4. Buton "Sterge istoricul" la final
5. Tap pe un search history item = populate search field + trigger search

---

## 4. Referral Program (Minimal Viable)

**Ce:** Fiecare user are un cod unic de referral. Share-ul codului aduce reward (badge + puncte) la signup.

**Unde:**
- Backend: migration noua (referral_code pe users, referrals table)
- `ofai_flutter/lib/screens/account/account_screen.dart` (sectiune "Invita prieteni")
- `ofai_flutter/lib/providers/auth_provider.dart` (fetch referral code)

**Plan:**
1. **Backend:** Migration — `ALTER TABLE users ADD COLUMN referral_code VARCHAR(8) UNIQUE`
2. **Backend:** Generate referral code at registration (8 char alphanumeric)
3. **Backend:** `POST /auth/register` accepta optional `referralCode` field
4. **Backend:** `referrals` table (referrer_id, referred_id, created_at, reward_given)
5. **Backend:** La register cu referral code valid — ambii useri primesc puncte (100) + badge "Ambasador"
6. **Flutter:** Pe Account screen, card "Invita prieteni" cu codul + buton Share
7. **Flutter:** Pe Register screen, camp optional "Cod de invitatie"

**Reguli:**
- Self-referral blocat (nu poti folosi propriul cod)
- Un user poate fi referred o singura data
- Reward-ul se da instant la signup (nu la prima actiune)

---

## 5. Rich Share Previews

**Ce:** Cand user-ul share-uieste o oferta, generam text + link cu OG tags pe backend.

**Unde:**
- Backend: `offer-detail.ejs` (OG meta tags)
- Backend: `business-detail.ejs` (OG meta tags)
- `ofai_flutter/lib/screens/offer/offer_detail_screen.dart` (share text)

**Plan:**
1. **Backend:** Adaug OG meta tags pe offer-detail.ejs:
   - `og:title` = offer title + discount
   - `og:description` = offer description (truncated 160 chars)
   - `og:image` = offer image URL
   - `og:url` = `https://ofai.ro/oferta/${offer.slug || offer.id}`
2. **Backend:** Acelasi lucru pe business-detail.ejs
3. **Flutter:** Share text include URL-ul web: "Vezi aceasta oferta pe OFAI: https://ofai.ro/oferta/123"
4. Verificam ca URL-urile web sunt accesibile public (nu necesita auth)

---

## 6. Banner "Gestioneaza pe Web" (in loc de business portal)

**Ce:** In loc de portal business in Flutter, adaugam info ca managementul se face pe web.

**Unde:**
- `ofai_flutter/lib/screens/account/account_screen.dart` (link existent "Adauga business")
- `ofai_flutter/lib/screens/business/business_detail_screen.dart` (daca esti owner)

**Plan:**
1. Pe Account screen — link-ul "Adauga business" exista deja. Verificam ca duce la URL corect
2. Pe Business detail — daca user-ul e owner-ul business-ului, afisam banner: "Gestioneaza acest business pe ofai.ro/portal"
3. Folosim `url_launcher` sa deschida in browser

**Nota:** Necesita ca backend-ul sa returneze `isOwner: true` in business detail response cand user-ul autentificat e owner. Verificam daca exista deja.
