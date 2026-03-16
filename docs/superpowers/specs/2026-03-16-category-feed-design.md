# Design: Category Feed pe Home Screen (Flutter)

**Data:** 16 Martie 2026
**Platformă:** Flutter (web se face separat, ulterior)

---

## Obiectiv

Adaugă un feed vertical de categorii pe home screen-ul Flutter. Fiecare categorie afișează un rând orizontal cu ofertele populare din acea categorie. Categoriile apar ordonate după un scor de performanță pre-calculat (cron job la 2 zile). Feed-ul se încarcă lazy, câte 2 categorii pe scroll.

---

## Decizii de design

| Decizie | Răspuns |
|---------|---------|
| Conținut per categorie | Doar oferte (nu business-uri) |
| Ordinea categoriilor | Scor mediu performanță business-uri + boost mic tier |
| Oferte per categorie | Max 20, sortate popular, cu "Vezi toate" la final |
| Prag minim | Categoria apare doar dacă are ≥6 oferte active |
| Categorii goale | Ascunse complet |
| Încărcare | Lazy-load câte 2 categorii pe scroll |
| Layout existent | Păstrat tot — categoriile se inserează după "Oferte Promovate" |
| Ranking update | Cron job la 2 zile, pre-calculat în DB |

---

## Arhitectură

### 1. Migration 058 — `category_rankings`

Tabel nou care stochează ranking-ul pre-calculat:

```sql
CREATE TABLE IF NOT EXISTS category_rankings (
  category_id  INT PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
  rank         INT NOT NULL,
  score        NUMERIC(6,2) NOT NULL DEFAULT 0,
  offer_count  INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_category_rankings_rank ON category_rankings(rank);
```

### 2. Cron Job — `updateCategoryRankings`

**Locație:** `src/services/cronJobs.js`
**Schedule:** `0 2 */2 * *` (02:00 UTC, o dată la 2 zile)
**Logică:** Calculează scor per categorie din date live, folosind semnale existente.

**Formula scor categorie:**
```
AVG per business din categorie:
  COALESCE(avg_review_rating, 0)
  + tier_boost (premium=0.3, standard=0.1, free=0)
```

**Query SQL:**
```sql
WITH category_scores AS (
  SELECT
    b.category_id,
    AVG(
      COALESCE(r.avg_rating, 0)
      + CASE
          WHEN sp.slug = 'premium' THEN 0.3
          WHEN sp.slug = 'standard' THEN 0.1
          ELSE 0
        END
    ) as score,
    COUNT(DISTINCT o.id) FILTER (WHERE o.is_active = TRUE) as offer_count
  FROM businesses b
  LEFT JOIN (
    SELECT business_id, AVG(rating) as avg_rating
    FROM reviews GROUP BY business_id
  ) r ON r.business_id = b.id
  LEFT JOIN business_subscriptions bs ON bs.business_id = b.id
  LEFT JOIN subscription_plans sp ON sp.id = bs.plan_id
  LEFT JOIN offers o ON o.business_id = b.id
  WHERE b.category_id IS NOT NULL
  GROUP BY b.category_id
  HAVING COUNT(DISTINCT o.id) FILTER (WHERE o.is_active = TRUE) >= 6
)
INSERT INTO category_rankings (category_id, rank, score, offer_count, updated_at)
SELECT
  category_id,
  ROW_NUMBER() OVER (ORDER BY score DESC),
  score,
  offer_count,
  NOW()
FROM category_scores
ON CONFLICT (category_id) DO UPDATE SET
  rank = EXCLUDED.rank,
  score = EXCLUDED.score,
  offer_count = EXCLUDED.offer_count,
  updated_at = NOW();

-- Elimină categorii care nu mai califică (sub 6 oferte)
DELETE FROM category_rankings
WHERE category_id NOT IN (
  SELECT category_id FROM category_scores
);
```

**Seed la startup:** Dacă tabelul `category_rankings` e gol la pornirea serverului, se execută calculul imediat (o singură dată). Previne home gol la primul deploy.

**Error handling:** Try/catch cu `console.error('[Cron] Category rankings update failed:', err.message)`. Eșecul nu afectează alte cron job-uri.

### 3. API Endpoint — `GET /offers/category-feed`

**Locație:** `src/routes/offers.js` — ÎNAINTE de ruta `/:id` (altfel Express nu o atinge niciodată)

**Parametri query:**
- `offset` (int, default 0) — câte categorii să sară
- `batch` (int, default 2, max 4) — câte categorii să returneze

**Logică:**
1. Citește din `category_rankings` cu `ORDER BY rank ASC`, `LIMIT batch OFFSET offset`
2. JOIN pe `categories` pentru nume
3. Pentru fiecare categorie din batch: SELECT oferte active cu exact același SELECT ca `GET /offers` (include `save_count`, `is_trending`, `is_promoted`, `locations`, `business` nested) + `sort=popular` + `LIMIT 20`
4. Aplică interleave per categorie (evită oferte consecutive de la același business)

**Response shape:**
```json
{
  "categories": [
    {
      "id": 5,
      "name": "Frizerie & Cosmetică",
      "offerCount": 14,
      "offers": [
        { /* Offer object — exact same shape as GET /offers */ }
      ]
    },
    {
      "id": 3,
      "name": "Auto",
      "offerCount": 23,
      "offers": [ /* max 20 */ ]
    }
  ],
  "hasMore": true,
  "totalCategories": 8
}
```

**Note:**
- `offerCount` = totalul real de oferte active (pentru UI: "Vezi toate 23 oferte")
- `hasMore` = mai există categorii ranked după acest batch
- `totalCategories` = câte categorii calificate există (pentru progress indicator)
- Oferele au exact același shape ca cele din `GET /offers` — modelul `Offer` din Flutter se reutilizează fără schimbări
- Endpoint public (fără auth) — category feed e același pentru toți userii

### 4. Flutter — Model nou

**Fișier:** `lib/models/category_feed.dart`

```dart
class CategoryWithOffers {
  final int id;
  final String name;
  final int offerCount;
  final List<Offer> offers;
}
```

Parsare: `offers` se deserializează cu `Offer.fromJson()` existent.

### 5. Flutter — Provider

**Fișier:** `lib/providers/category_feed_provider.dart`

**`CategoryFeedNotifier`** — `StateNotifier<CategoryFeedState>`

State:
```dart
class CategoryFeedState {
  final List<CategoryWithOffers> categories;
  final bool isLoading;
  final bool hasMore;
  final int offset;
  final String? error;
}
```

Metode:
- `loadNextBatch()` — apelat la scroll sau inițial. Face `GET /offers/category-feed?offset=X&batch=2`. Adaugă categoriile la lista existentă. Incrementează offset cu 2. Setează `hasMore` din response.
- `reset()` — resetează state-ul (pentru pull-to-refresh)

**`categoryFeedProvider`** — `StateNotifierProvider<CategoryFeedNotifier, CategoryFeedState>`

### 6. Flutter — Utilitar interleave

**Fișier:** `lib/core/utils/interleave.dart`

Extrage funcția `_interleaveOffers` din `offers_provider.dart` (acum e privată cu `_`) într-un utilitar public:

```dart
List<Offer> interleaveOffers(List<Offer> offers) { ... }
```

Actualizează `offers_provider.dart` să importe și folosească noua funcție publică.

### 7. Flutter — Home Screen Integration

**Fișier:** `lib/screens/home/home_screen.dart`

**Inserție:** După secțiunea "Oferte Promovate" (item 14 actual), înainte de marquee logos.

**Widget structure:**
- `Consumer` care watch-ează `categoryFeedProvider`
- Generează N× `SliverToBoxAdapter`, fiecare cu:
  - `SizedBox(height: AppSpacing.xxl)` spacer
  - `SectionHeader(categoryName, onTap: → /explore?category=id)` cu text "Vezi toate"
  - `SizedBox(height: AppSpacing.md)` spacer
  - Horizontal `ListView.builder` cu `OfferCard(horizontal: true)` (widget existent, refolosit) + card "Vezi toate X oferte" la final

**Lazy-load trigger:**
- `ScrollController` listener pe `CustomScrollView`
- Când `scrollPosition.pixels >= scrollPosition.maxScrollExtent - 500` și `hasMore && !isLoading` → `loadNextBatch()`

**Pull-to-refresh:**
- Adaugă `ref.read(categoryFeedProvider.notifier).reset()` la `onRefresh`
- După reset, primul batch se re-încarcă automat (trigger de scroll sau explicit `loadNextBatch()`)

**Inițializare:**
- În `initState`, apelează `loadNextBatch()` o dată (primele 2 categorii)

**Card "Vezi toate":**
- Ultimul element din horizontal ListView
- Design: bordered container cu text "Vezi toate X oferte →" + icon
- Tap → `context.push('/explore?category=$categoryId')`

---

## Layout final Home Screen

```
1.  Header OFAI
2.  Search bar
3.  Categories chips (orizontal)
4.  Cities pills (orizontal)
5.  Deal of the Day
6.  Location banner
7.  "Pentru tine" / "Oferte populare" (orizontal)
8.  Oferte Promovate (orizontal)
9.  ── 🆕 CATEGORY FEED ──
    9a. [Categoria #1 ranked] Header + oferte orizontal + "Vezi toate"
    9b. [Categoria #2 ranked] Header + oferte orizontal + "Vezi toate"
    ... (lazy-load câte 2 la scroll)
10. Marquee logos
11. "Business-uri" header + lista verticală
```

---

## Fișiere afectate

### Backend (noi)
- `src/migrations/058_category_rankings.sql` — tabel nou

### Backend (modificate)
- `src/services/cronJobs.js` — adaugă cron job `updateCategoryRankings`
- `src/routes/offers.js` — adaugă endpoint `GET /category-feed`

### Flutter (noi)
- `lib/models/category_feed.dart` — model `CategoryWithOffers`
- `lib/providers/category_feed_provider.dart` — provider cu lazy-load
- `lib/core/utils/interleave.dart` — utilitar interleave extras

### Flutter (modificate)
- `lib/screens/home/home_screen.dart` — inserție category feed sections + scroll listener + refresh
- `lib/providers/offers_provider.dart` — înlocuiește `_interleaveOffers` cu import din utilitar
- `lib/core/network/api_endpoints.dart` — adaugă `categoryFeed` endpoint constant

---

## Edge cases

| Caz | Comportament |
|-----|-------------|
| Tabel `category_rankings` gol (prim deploy) | Seed automat la startup server |
| 0 categorii calificate | Feed-ul nu apare deloc (secțiunea ascunsă) |
| Categoria are exact 6 oferte | Apare în feed, "Vezi toate" tot prezent |
| Ofertă expiră între cron runs | Oferta nu mai apare (query-ul live filtrează `is_active`) dar categoria rămâne vizibilă până la next cron |
| Categorie scade sub 6 oferte între cron runs | Categoria rămâne vizibilă dar cu mai puține oferte; la next cron run dispare din ranking |
| Pull-to-refresh | Resetează feed state + re-fetch primele 2 categorii |
| Scroll rapid | `isLoading` guard previne fetch-uri duplicate |
| Network error la lazy-load | Toast cu eroare, buton retry, `hasMore` rămâne true |

---

## Ce NU se schimbă

- Secțiunile existente (Deal of Day, Pentru tine, Promovate, Business-uri) — neatinse
- Modelul `Offer` — reutilizat exact ca atare
- Widget-ul `OfferCard` — reutilizat cu `horizontal: true`
- `SectionHeader` widget — reutilizat cu pattern-ul existent
- Endpoint-urile existente (`GET /offers`, `GET /categories`) — neatinse
- Ruta `/:id` din offers.js — nu se mișcă, doar noul endpoint se adaugă înainte
