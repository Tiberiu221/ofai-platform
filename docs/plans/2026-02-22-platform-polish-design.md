# OFAI Platform Polish — Design Document
## Abordare A: Urgency + Personalizare + Gamification + Social/Trust
## Data: 22 Februarie 2026

---

## Scop

Platforma sa para vie, completa si profesionala cand este prezentata business-urilor.
Toate features se aplica pe WEB (EJS) + MOBILE (Flutter) in paralel.

---

## 1. URGENCY & FOMO

### 1.1 Countdown Timer
**Unde:** Offer cards (web + Flutter) + Offer detail screen

- **Cards:** mini-timer sub discount badge: `2z 14h` (doar oferte cu < 7 zile ramase)
- **Detail:** bloc vizual mare deasupra booking CTA: `Expira in 2 zile, 14 ore, 32 min`
- **Culori:** verde > 7 zile, galben 3-7 zile, rosu < 3 zile, rosu pulsant < 24h
- **Implementare:** calcul client-side din `end_date`, actualizare la fiecare minut (web: setInterval, Flutter: Timer.periodic)
- **Nu se arata** daca oferta nu are `end_date` sau > 30 zile ramase

### 1.2 Oferta Zilei (refoloseste `.offer-card.featured`)
**Unde:** HomeScreen sectiune noua, deasupra "Oferte de top"

- **Web:** Refoloseste cardul `.offer-card.featured` (span 2x2, overlay, TiltFx) dar cu badge "OFERTA ZILEI" si countdown
- **Flutter:** Card nou `FeaturedOfferCard` — full-width, 280px height, gradient overlay, countdown timer vizibil
- **Backend:** Camp `is_deal_of_day BOOLEAN DEFAULT FALSE` + `deal_of_day_date DATE` pe `offers` table
  - Ruta admin sau cron care selecteaza automat oferta cu cel mai mare engagement (saves + clicks)
  - Fallback: oferta cu cel mai mare discount daca nu exista engagement data
  - Endpoint: `GET /api/offers/deal-of-day` (cacheable 1h)
- **Portal value prop:** Sectiune in portal "Oferta ta poate deveni Oferta Zilei!" cu criteriile

### 1.3 Social Proof Counter pe Cards
**Unde:** Offer cards (web + Flutter) + Offer detail

- **Cards:** badge mic: `42 salvari` (COUNT din `favorite_offers` WHERE `offer_id = X`)
- **Detail:** text: `87 persoane au salvat aceasta oferta`
- **Implementare:** JOIN sau subquery in query-urile existente de offers
  - Web: `LEFT JOIN (SELECT offer_id, COUNT(*) as save_count FROM favorite_offers GROUP BY offer_id) sc ON o.id = sc.offer_id`
  - Adaugat in response-ul API ca `save_count`
- **Prag minim:** nu se arata daca < 5 salvari (evita "1 salvare" care pare trist)

### 1.4 Coduri Limitate (optional per oferta)
**Unde:** Offer detail screen, offer form portal

- **DB:** Camp nou pe `offers`: `max_reveals INTEGER NULL` (nullable = nelimitat)
- **Calcul:** `remaining = max_reveals - COUNT(code_reveals WHERE offer_id = X)`
- **Display:**
  - `Mai sunt 12 coduri din 50` (verde daca > 50%)
  - `Ultimele 5 coduri!` (rosu, pulsant daca < 20%)
  - `Coduri epuizate` (gri, disabled reveal button)
- **Portal:** Camp optional in offer form: "Limiteaza numarul de coduri (lasa gol pentru nelimitat)"

---

## 2. SOCIAL PROOF & TRUST

### 2.1 Activity Indicators pe Offer Detail
**Unde:** Offer detail, sub titlu

- Text: `Adaugata acum 3 zile` (bazat pe `created_at` sau `start_date`)
- Text: `Vizualizata de 234 ori` (din `business_views` sau nou counter)
- Text: `42 persoane au salvat-o` (din `favorite_offers`)
- Afisate ca row de chips/pills mici, iconite discrete

### 2.2 "Trending" Badge pe Cards
**Unde:** Offer cards (web + Flutter)

- Badge "🔥 Trending" pe cards cu engagement mare (saves + clicks in ultimele 7 zile > prag)
- **Calcul backend:** query periodic sau la request:
  ```sql
  SELECT offer_id, COUNT(*) as recent_saves
  FROM favorite_offers
  WHERE created_at > NOW() - INTERVAL '7 days'
  GROUP BY offer_id
  HAVING COUNT(*) >= 10
  ```
- **Alternativ simplu:** flag calculat in query-ul de offers, returnat ca `is_trending: true`
- **Prag initial:** >= 10 saves in 7 zile (ajustabil)

### 2.3 Rating Breakdown pe Business Detail
**Unde:** Business detail screen, sub rating-ul existent

- Bar chart mic inline: 5 bare orizontale (5 stele -> 1 stea) cu procentaje
  ```
  ★★★★★  ████████████  72%
  ★★★★☆  ████          18%
  ★★★☆☆  ██             6%
  ★★☆☆☆  █              3%
  ★☆☆☆☆                  1%
  ```
- **Implementare:** deja avem reviews cu rating — GROUP BY rating, COUNT
- Vizibil doar daca business-ul are >= 3 reviews

### 2.4 "Verificat" Badge Detaliat
**Unde:** Business detail screen

- Badge-ul existent "Verificat" devine expandabil/clickable
- Tooltip/bottom sheet cu: "Acest business a fost verificat de echipa OFAI: profil complet, contact valid, oferte reale"
- Adauga credibilitate

### 2.5 Numar de Followers pe Business Detail
**Unde:** Business detail, langa follow button

- `234 urmaresc acest business` (COUNT din `followed_businesses`)
- Pe mobile: afisat sub business name ca chip
- Prag minim: nu se arata daca < 3

---

## 3. PERSONALIZARE

### 3.1 "Pentru Tine" Prominent
**Unde:** HomeScreen — prioritate #1 cand user e logat

- **Acum:** exista deja "Pentru tine" cu oferte din feed personalizat
- **Imbunatatire:** Adauga subtitle explicativ: "Bazat pe preferintele tale: Restaurante, Beauty in Bucuresti"
  - Arata categoriile/orasele selectate in subtitle
  - Link "Modifica preferintele" direct la /preferinte
- **Daca nu are preferinte:** CTA card: "Spune-ne ce te intereseaza" → preferinte screen

### 3.2 Distanta pe Offer Cards
**Unde:** Offer cards (web exista deja, Flutter partial)

- **Web:** Deja implementat cu Geolocation + Haversine
- **Flutter:** Verifica daca exista — daca nu, adauga distanta in OfferCard
  - `1.2 km distanta` sau `350 m distanta` sub location
  - Geolocator plugin deja in pubspec
- Fallback: arata doar orasul daca location permission denied

### 3.3 "Oferte Similare" pe Detail
**Unde:** Offer detail screen, sub continut principal

- Sectiune: "Oferte similare" — 3-4 cards orizontale
- **Logica:** aceeasi categorie + acelasi oras, exclude oferta curenta, ORDER BY save_count DESC LIMIT 4
- **Endpoint:** `GET /api/offers?category_id=X&city_id=Y&exclude=ID&limit=4`
  - Refoloseste endpoint-ul existent de offers cu filtre
- **Flutter:** horizontal ListView sub continut
- **Web:** row de mini-cards sub detaliu

### 3.4 "Mai mult de la acest business" pe Offer Detail
**Unde:** Offer detail screen, sub business card

- Daca business-ul are alte oferte active, arata 2-3 ca mini-cards
- Link: "Vezi toate ofertele de la [Business]" → business detail
- **Logica:** aceeasi query ca pe business detail (offers WHERE business_id = X AND is_active AND end_date >= NOW)

---

## 4. GAMIFICATION

### 4.1 Puncte Utilizator
**Unde:** Account screen, offer interactions

- **Sistem simplu:**
  - Salvare oferta: +5 puncte
  - Reveal cod: +10 puncte
  - Review scrisa: +20 puncte
  - Share oferta: +5 puncte
  - Prima oferta salvata: +50 puncte (bonus onboarding)
  - Streak zilnic (vizita zilnica): +10 puncte/zi
- **DB:** Camp `points INTEGER DEFAULT 0` pe `users` + tabel `point_transactions` (user_id, action, points, created_at)
- **Display:** Pe Account screen: "125 puncte OFAI" cu icon/badge
- **Deocamdata fara recompense** — doar acumulare + leaderboard vizual (pregatire monetizare viitoare)

### 4.2 Nivel Utilizator
**Unde:** Account screen, profile

- Bazat pe puncte:
  - 0-99: "Explorator" (icon: compas)
  - 100-499: "Econom" (icon: portofel)
  - 500-1499: "Expert Reduceri" (icon: stea)
  - 1500+: "VIP OFAI" (icon: coroana)
- Progress bar catre urmatorul nivel
- Badge vizibil pe review-uri postate ("Review de la un Expert Reduceri")

### 4.3 Streak Zilnic
**Unde:** HomeScreen, mic widget/pill

- "Zi 5 consecutiva pe OFAI! 🔥" cu counter
- **DB:** `last_visit_date DATE` + `current_streak INTEGER` pe users
- **Update:** la fiecare login/app open, daca `last_visit_date = yesterday` → streak++, altfel reset la 1
- Bonus puncte per streak milestone (7 zile: +50, 30 zile: +200)

### 4.4 Achievement Badges
**Unde:** Account screen, sectiune dedicata

- Grid de badges (unele unlocked, altele locked/gri):
  - "Prima salvare" — salveaza prima oferta
  - "Recenzent" — scrie prima review
  - "Social Butterfly" — share 5 oferte
  - "Fidel" — streak 7 zile
  - "Colectionar" — 20 oferte salvate
  - "Explorator de orase" — viziteaza oferte din 3 orase diferite
  - "Fan #1" — urmareste 10 business-uri
- **DB:** tabel `user_badges` (user_id, badge_type, unlocked_at)
- **Check:** la fiecare actiune relevanta, verificam daca s-a deblocat un badge nou → toast/notification

---

## 5. MODIFICARI BACKEND NECESARE

### 5.1 Migratie DB noua (024)
```sql
-- Offers: deal of day + limited codes
ALTER TABLE offers ADD COLUMN is_deal_of_day BOOLEAN DEFAULT FALSE;
ALTER TABLE offers ADD COLUMN deal_of_day_date DATE;
ALTER TABLE offers ADD COLUMN max_reveals INTEGER;

-- Users: gamification
ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN current_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN last_visit_date DATE;
ALTER TABLE users ADD COLUMN level VARCHAR(20) DEFAULT 'explorer';

-- Point transactions
CREATE TABLE point_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  points INTEGER NOT NULL,
  reference_id INTEGER,
  reference_type VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_point_transactions_user ON point_transactions(user_id);

-- User badges
CREATE TABLE user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  badge_type VARCHAR(50) NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_type)
);
CREATE INDEX idx_user_badges_user ON user_badges(user_id);
```

### 5.2 Endpoints noi / modificate
- `GET /api/offers/deal-of-day` — returneaza oferta zilei (cached)
- Modificare queries existente offers: adauga `save_count`, `is_trending` in response
- `GET /api/users/me/points` — puncte, nivel, streak, badges
- `POST /api/users/me/streak` — update streak la app open (sau automat in auth middleware)
- Gamification logic: helper `awardPoints(userId, action, referenceId)` apelat din routes existente

### 5.3 Modificari queries oferte
- Adauga LEFT JOIN `favorite_offers` count in toate query-urile de offers (home, explore, detail)
- Adauga `is_trending` flag calculat (saves recente > prag)
- Offer detail: adauga `reveals_remaining` daca `max_reveals` e setat

---

## 6. ORDINE DE IMPLEMENTARE (prioritate impact)

| Faza | Feature | Impact | Efort |
|------|---------|--------|-------|
| **P1** | Countdown timer (cards + detail) | Mare — urgency vizibila instant | Mic — client-side, fara DB |
| **P1** | Save count pe cards + detail | Mare — social proof instant | Mic — un JOIN |
| **P1** | Trending badge | Mare — platforma pare vie | Mic — query simplu |
| **P1** | Oferta Zilei (refoloseste .featured) | Mare — focal point homepage | Mediu — endpoint + admin/cron |
| **P2** | Oferte similare pe detail | Mare — discovery + retentie | Mic — refoloseste endpoint |
| **P2** | Mai mult de la business | Mediu — cross-sell | Mic — query existent |
| **P2** | Followers count pe business | Mediu — social proof | Mic — un COUNT |
| **P2** | Rating breakdown chart | Mediu — trust | Mic — GROUP BY |
| **P2** | Coduri limitate | Mediu — urgency/scarcity | Mediu — DB + logic |
| **P2** | Activity indicators detail | Mediu — platforma pare activa | Mic — date existente |
| **P3** | Puncte utilizator | Mare — engagement loop | Mare — DB + logic + UI |
| **P3** | Nivel utilizator | Mediu — gamification vizibila | Mic — calcul din puncte |
| **P3** | Streak zilnic | Mediu — retentie zilnica | Mediu — DB + middleware |
| **P3** | Achievement badges | Mare — motivatie colectie | Mare — DB + triggers + UI |
| **P3** | Personalizare "Pentru tine" improved | Mediu — relevanta | Mic — UI tweak |
| **P3** | Distanta pe Flutter cards | Mic — deja pe web | Mic — plugin existent |
| **P3** | Verified badge detaliat | Mic — trust | Mic — tooltip/sheet |

**P1 = implementam primul (cel mai mare impact cu cel mai mic efort)**
**P2 = al doilea sprint**
**P3 = al treilea sprint (gamification + personalizare)**

---

## 7. CE NU FACEM (YAGNI)

- NU adaugam "X persoane vad acum" (fake real-time, necesita WebSocket)
- NU adaugam reviews pe oferte individuale (prea complex, business reviews sunt suficiente)
- NU adaugam referral system (Abordare C, separat)
- NU adaugam leaderboard public (privacy concerns, poate later)
- NU adaugam recompense/premii pentru puncte (pregatim doar acumularea)
- NU adaugam A/B testing oferte (portal feature, nu consumer UX)
