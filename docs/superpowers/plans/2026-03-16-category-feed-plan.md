# Category Feed Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lazy-loaded category sections with popular offers to the Flutter home screen, ranked by pre-computed business performance scores.

**Architecture:** New `category_rankings` DB table populated by a cron job every 2 days. New `GET /offers/category-feed` API endpoint reads pre-computed rankings and returns batches of 2 categories with their popular offers. Flutter `CategoryFeedNotifier` lazy-loads batches on scroll.

**Tech Stack:** PostgreSQL (migration), Node.js/Express (cron + API), Flutter/Riverpod (provider + UI)

**Spec:** `docs/superpowers/specs/2026-03-16-category-feed-design.md`

---

## File Map

### Backend (new)
- `src/migrations/058_category_rankings.sql` — DB table for pre-computed rankings

### Backend (modified)
- `src/services/cronJobs.js` — add ranking cron job + startup seed
- `src/routes/offers.js` — add `GET /category-feed` endpoint (BEFORE `/:id` route)

### Flutter (new)
- `lib/core/utils/interleave.dart` — extracted interleave utility
- `lib/models/category_feed.dart` — `CategoryWithOffers` model
- `lib/providers/category_feed_provider.dart` — `CategoryFeedNotifier` with lazy-load

### Flutter (modified)
- `lib/core/network/api_endpoints.dart` — add `categoryFeed` constant
- `lib/providers/offers_provider.dart` — replace private `_interleaveOffers` with public import
- `lib/screens/home/home_screen.dart` — insert category feed sections + scroll listener + refresh

---

## Task 1: Migration — `category_rankings` table

**Files:**
- Create: `appredueri_backend/src/migrations/058_category_rankings.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration 058: Category rankings for home feed
-- Pre-computed every 2 days by cron job
-- Date: 2026-03-16

CREATE TABLE IF NOT EXISTS category_rankings (
  category_id  INT PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
  rank         INT NOT NULL,
  score        NUMERIC(6,2) NOT NULL DEFAULT 0,
  offer_count  INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_category_rankings_rank ON category_rankings(rank);
```

- [ ] **Step 2: Run migration on local/dev DB**

```bash
cd appredueri_backend
psql "$DATABASE_URL" -f src/migrations/058_category_rankings.sql
```

Expected: `CREATE TABLE` + `CREATE INDEX`, no errors.

- [ ] **Step 3: Verify table exists**

```bash
psql "$DATABASE_URL" -c "\d category_rankings"
```

Expected: Table with columns `category_id`, `rank`, `score`, `offer_count`, `updated_at`.

---

## Task 2: Cron Job — `updateCategoryRankings`

**Files:**
- Modify: `appredueri_backend/src/services/cronJobs.js:348-353`

- [ ] **Step 1: Add the ranking update function and cron schedule**

Insert BEFORE `console.log('[Cron] All 10 scheduled jobs registered.');` (line 350) in `cronJobs.js`:

```javascript
  // 11. Update category rankings for home feed — Every 2 days at 02:00 UTC
  cron.schedule('0 2 */2 * *', async () => {
    try {
      // Compute category scores from business ratings + tier boost
      const result = await pool.query(`
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
            COUNT(DISTINCT o.id) FILTER (WHERE o.is_active = TRUE AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)) as offer_count
          FROM businesses b
          LEFT JOIN (
            SELECT business_id, AVG(rating) as avg_rating
            FROM reviews GROUP BY business_id
          ) r ON r.business_id = b.id
          LEFT JOIN business_subscriptions bs ON bs.business_id = b.id AND bs.status IN ('active', 'trial')
          LEFT JOIN subscription_plans sp ON sp.id = bs.plan_id
          LEFT JOIN offers o ON o.business_id = b.id
          WHERE b.category_id IS NOT NULL
          GROUP BY b.category_id
          HAVING COUNT(DISTINCT o.id) FILTER (WHERE o.is_active = TRUE AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)) >= 6
        )
        INSERT INTO category_rankings (category_id, rank, score, offer_count, updated_at)
        SELECT
          category_id,
          ROW_NUMBER() OVER (ORDER BY score DESC),
          ROUND(score::numeric, 2),
          offer_count,
          NOW()
        FROM category_scores
        ON CONFLICT (category_id) DO UPDATE SET
          rank = EXCLUDED.rank,
          score = EXCLUDED.score,
          offer_count = EXCLUDED.offer_count,
          updated_at = NOW()
      `);

      // Remove categories that no longer qualify
      await pool.query(`
        DELETE FROM category_rankings
        WHERE category_id NOT IN (
          SELECT b.category_id
          FROM businesses b
          LEFT JOIN offers o ON o.business_id = b.id
          WHERE b.category_id IS NOT NULL
            AND o.is_active = TRUE
            AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
          GROUP BY b.category_id
          HAVING COUNT(DISTINCT o.id) >= 6
        )
      `);

      console.log(`[Cron] Category rankings updated: ${result.rowCount} categories ranked`);
    } catch (err) {
      console.error('[Cron] Category rankings update failed:', err.message);
    }
  });

  // Seed category rankings on first startup if table is empty
  try {
    const check = await pool.query('SELECT COUNT(*) as cnt FROM category_rankings');
    if (parseInt(check.rows[0].cnt) === 0) {
      console.log('[Cron] Category rankings table empty — seeding now...');
      // Run the same ranking query inline
      const seedResult = await pool.query(`
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
            COUNT(DISTINCT o.id) FILTER (WHERE o.is_active = TRUE AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)) as offer_count
          FROM businesses b
          LEFT JOIN (
            SELECT business_id, AVG(rating) as avg_rating
            FROM reviews GROUP BY business_id
          ) r ON r.business_id = b.id
          LEFT JOIN business_subscriptions bs ON bs.business_id = b.id AND bs.status IN ('active', 'trial')
          LEFT JOIN subscription_plans sp ON sp.id = bs.plan_id
          LEFT JOIN offers o ON o.business_id = b.id
          WHERE b.category_id IS NOT NULL
          GROUP BY b.category_id
          HAVING COUNT(DISTINCT o.id) FILTER (WHERE o.is_active = TRUE AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)) >= 6
        )
        INSERT INTO category_rankings (category_id, rank, score, offer_count, updated_at)
        SELECT
          category_id,
          ROW_NUMBER() OVER (ORDER BY score DESC),
          ROUND(score::numeric, 2),
          offer_count,
          NOW()
        FROM category_scores
        ON CONFLICT (category_id) DO UPDATE SET
          rank = EXCLUDED.rank,
          score = EXCLUDED.score,
          offer_count = EXCLUDED.offer_count,
          updated_at = NOW()
      `);
      console.log(`[Cron] Category rankings seeded: ${seedResult.rowCount} categories`);
    }
  } catch (err) {
    console.error('[Cron] Category rankings seed check failed:', err.message);
  }
```

- [ ] **Step 2: Update the job count log**

Change line 350 from:
```javascript
  console.log('[Cron] All 10 scheduled jobs registered.');
```
To:
```javascript
  console.log('[Cron] All 11 scheduled jobs registered.');
```

- [ ] **Step 3: Start server and verify seed runs**

```bash
cd appredueri_backend && node src/index.js
```

Expected in logs: `[Cron] Category rankings seeded: N categories` (or `table empty — seeding now...` followed by count).

- [ ] **Step 4: Verify rankings in DB**

```bash
psql "$DATABASE_URL" -c "SELECT cr.rank, c.name, cr.score, cr.offer_count FROM category_rankings cr JOIN categories c ON c.id = cr.category_id ORDER BY cr.rank"
```

Expected: Categories listed by rank, each with score and offer_count ≥ 6.

---

## Task 3: API Endpoint — `GET /offers/category-feed`

**Files:**
- Modify: `appredueri_backend/src/routes/offers.js:377` (insert BEFORE `/deal-of-day` route)

- [ ] **Step 1: Add the category-feed endpoint**

Insert AFTER the `/feed` route closing `});` (line 377) and BEFORE the `/deal-of-day` comment (line 379):

```javascript
// ==============================
// GET /category-feed — Home feed categories with offers
// ==============================
router.get("/category-feed", async (req, res) => {
  try {
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const batch = Math.min(4, Math.max(1, parseInt(req.query.batch) || 2));

    // 1. Get ranked categories for this batch
    const rankResult = await pool.query(`
      SELECT cr.category_id, c.name as category_name, cr.offer_count, cr.rank
      FROM category_rankings cr
      JOIN categories c ON c.id = cr.category_id
      ORDER BY cr.rank ASC
      LIMIT $1 OFFSET $2
    `, [batch, offset]);

    // 2. Get total ranked categories count
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM category_rankings');
    const totalCategories = parseInt(totalResult.rows[0].total);

    // 3. For each category, fetch popular offers (max 20)
    const categories = [];
    for (const cat of rankResult.rows) {
      const offersResult = await pool.query(`
        SELECT
          o.id, o.title, o.description, o.discount_type, o.discount_value,
          o.start_date, o.end_date,
          o.logo_url as offer_logo,
          EXISTS(SELECT 1 FROM promo_codes WHERE offer_id = o.id AND is_active = TRUE) as has_promo_code,

          b.id as business_id, b.name as business_name,
          b.lat, b.lng, b.logo_url as business_logo,
          b.cover_image_url as business_cover,
          b.is_verified as business_verified,
          b.subscription_badge_type as business_badge_type,

          c.name as city_name, cat.name as category_name,

          COALESCE(rev_agg.rating_avg, 0) as rating_avg,
          COALESCE(rev_agg.rating_count, 0) as rating_count,
          COALESCE(fav_agg.save_count, 0) as save_count,
          COALESCE(fav_agg.recent_favs, 0) >= 5 as is_trending,

          COALESCE(splan.has_promoted_placement, FALSE) as is_promoted,
          locs.locations as locations
        FROM offers o
        JOIN businesses b ON o.business_id = b.id
        LEFT JOIN cities c ON b.city_id = c.id
        LEFT JOIN categories cat ON b.category_id = cat.id
        LEFT JOIN (
          SELECT business_id, AVG(rating) AS rating_avg, COUNT(*) AS rating_count
          FROM reviews GROUP BY business_id
        ) rev_agg ON rev_agg.business_id = b.id
        LEFT JOIN (
          SELECT offer_id,
            COUNT(*) AS save_count,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '14 days') AS recent_favs
          FROM favorite_offers GROUP BY offer_id
        ) fav_agg ON fav_agg.offer_id = o.id
        LEFT JOIN business_subscriptions bsub
          ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
        LEFT JOIN subscription_plans splan
          ON splan.id = bsub.plan_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'id', bl.id,
                'address', bl.address,
                'lat', bl.lat,
                'lng', bl.lng,
                'city_name', c2.name
              )
              ORDER BY bl.id
            ) FILTER (WHERE bl.id IS NOT NULL),
            '[]'::json
          ) AS locations
          FROM business_locations bl
          LEFT JOIN cities c2 ON c2.id = bl.city_id
          WHERE bl.business_id = b.id
            AND (
              NOT EXISTS (SELECT 1 FROM offer_locations ol WHERE ol.offer_id = o.id)
              OR bl.id IN (SELECT ol.location_id FROM offer_locations ol WHERE ol.offer_id = o.id)
            )
        ) locs ON true
        WHERE o.is_active = TRUE
          AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
          AND b.category_id = $1
        ORDER BY (
          (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE business_id = b.id)
          + CASE WHEN splan.slug = 'premium' THEN 0.4 WHEN splan.slug = 'standard' THEN 0.1 ELSE 0 END
        ) DESC NULLS LAST, o.id DESC
        LIMIT 20
      `, [cat.category_id]);

      // Map rows to response shape (same as GET /offers)
      const offers = offersResult.rows.map(row => {
        const avg = parseFloat(row.rating_avg || 0);
        const count = parseInt(row.rating_count || 0);
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          discount_type: row.discount_type,
          discount_value: row.discount_value,
          start_date: row.start_date,
          end_date: row.end_date,
          has_promo_code: !!row.has_promo_code,
          save_count: parseInt(row.save_count || 0),
          is_trending: row.is_trending === true,
          is_promoted: row.is_promoted || false,
          image_url: makeAbsoluteUrl(req, row.business_cover || row.offer_logo || row.business_logo),
          locations: Array.isArray(row.locations) ? row.locations : [],
          business: {
            id: row.business_id,
            name: row.business_name,
            logo_url: makeAbsoluteUrl(req, row.business_logo),
            cover_image_url: makeAbsoluteUrl(req, row.business_cover),
            city: row.city_name,
            category: row.category_name,
            lat: row.lat,
            lng: row.lng,
            rating: parseFloat(avg.toFixed(1)),
            rating_count: count,
            is_verified: row.business_verified || false,
            subscription_badge_type: row.business_badge_type || null,
            badge_type: row.business_badge_type || (row.business_verified ? 'verified' : null),
          }
        };
      });

      // Interleave offers (avoid consecutive same-business)
      const interleaved = interleaveOffers(offers);

      categories.push({
        id: cat.category_id,
        name: cat.category_name,
        offerCount: parseInt(cat.offer_count),
        offers: interleaved,
      });
    }

    res.json({
      categories,
      hasMore: offset + batch < totalCategories,
      totalCategories,
    });
  } catch (err) {
    console.error("[Category Feed Error]", err);
    res.status(500).send("Eroare server");
  }
});
```

- [ ] **Step 2: Add the interleave helper at the top of offers.js**

Insert AFTER the `makeAbsoluteUrl` function (after line 22):

```javascript
// Helper: Interleave offers so same business doesn't appear consecutively
function interleaveOffers(offers) {
  if (offers.length <= 2) return offers;
  const buckets = {};
  for (const offer of offers) {
    const bizId = offer.business?.id || 0;
    if (!buckets[bizId]) buckets[bizId] = [];
    buckets[bizId].push(offer);
  }
  const bucketList = Object.values(buckets);
  if (bucketList.length === offers.length) return offers;
  bucketList.sort((a, b) => b.length - a.length);
  const result = [];
  const indices = new Array(bucketList.length).fill(0);
  let placed = 0;
  while (placed < offers.length) {
    let placedThisRound = false;
    for (let i = 0; i < bucketList.length; i++) {
      if (indices[i] < bucketList[i].length) {
        result.push(bucketList[i][indices[i]]);
        indices[i]++;
        placed++;
        placedThisRound = true;
      }
    }
    if (!placedThisRound) break;
  }
  return result;
}
```

- [ ] **Step 3: Test endpoint manually**

```bash
curl "http://localhost:4000/offers/category-feed?offset=0&batch=2" | jq '.categories | length'
```

Expected: `2` (or fewer if less than 2 categories qualify).

```bash
curl "http://localhost:4000/offers/category-feed?offset=0&batch=2" | jq '.categories[0] | {name, offerCount, offersLen: (.offers | length)}'
```

Expected: Category name, offerCount ≥ 6, offers array with up to 20 items.

---

## Task 4: Flutter — Extract interleave utility

**Files:**
- Create: `ofai_flutter/lib/core/utils/interleave.dart`
- Modify: `ofai_flutter/lib/providers/offers_provider.dart:9-48`

- [ ] **Step 1: Create the shared interleave utility**

Create `lib/core/utils/interleave.dart`:

```dart
import '../../models/offer.dart';

/// Interleave offers so same business doesn't appear consecutively.
/// Round-robin from business-grouped buckets, sorted by bucket size DESC.
List<Offer> interleaveOffers(List<Offer> offers) {
  if (offers.length <= 2) return offers;

  // Group by business ID
  final buckets = <int, List<Offer>>{};
  for (final offer in offers) {
    final bizId = offer.business?.id ?? 0;
    buckets.putIfAbsent(bizId, () => []).add(offer);
  }

  // If all from different businesses, no interleaving needed
  if (buckets.length == offers.length) return offers;

  // Sort buckets by size DESC (largest groups first)
  final sortedBuckets = buckets.values.toList()
    ..sort((a, b) => b.length.compareTo(a.length));

  // Round-robin: pick one from each bucket in turn
  final result = <Offer>[];
  final indices = List<int>.filled(sortedBuckets.length, 0);
  var placed = 0;
  final total = offers.length;

  while (placed < total) {
    var placedThisRound = false;
    for (var i = 0; i < sortedBuckets.length; i++) {
      if (indices[i] < sortedBuckets[i].length) {
        result.add(sortedBuckets[i][indices[i]]);
        indices[i]++;
        placed++;
        placedThisRound = true;
      }
    }
    if (!placedThisRound) break;
  }

  return result;
}
```

- [ ] **Step 2: Update offers_provider.dart to use the shared utility**

In `offers_provider.dart`, replace lines 1-48 (the imports + private `_interleaveOffers` function) with:

```dart
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../core/network/api_exceptions.dart';
import '../models/offer.dart';
import '../models/pagination.dart';
import '../core/utils/interleave.dart';
```

Then in the file body, replace all occurrences of `_interleaveOffers(` with `interleaveOffers(`.

- [ ] **Step 3: Run flutter analyze**

```bash
"C:/dev/flutter/bin/flutter.bat" analyze --no-pub lib/core/utils/interleave.dart lib/providers/offers_provider.dart
```

Expected: No errors (only pre-existing infos).

---

## Task 5: Flutter — Model + API Endpoint constant

**Files:**
- Create: `ofai_flutter/lib/models/category_feed.dart`
- Modify: `ofai_flutter/lib/core/network/api_endpoints.dart:34`

- [ ] **Step 1: Create the CategoryWithOffers model**

Create `lib/models/category_feed.dart`:

```dart
import 'offer.dart';

class CategoryWithOffers {
  final int id;
  final String name;
  final int offerCount;
  final List<Offer> offers;

  const CategoryWithOffers({
    required this.id,
    required this.name,
    required this.offerCount,
    required this.offers,
  });

  factory CategoryWithOffers.fromJson(Map<String, dynamic> json) {
    return CategoryWithOffers(
      id: json['id'] as int,
      name: json['name'] as String,
      offerCount: json['offerCount'] as int? ?? 0,
      offers: (json['offers'] as List<dynamic>?)
              ?.map((e) => Offer.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
```

- [ ] **Step 2: Add API endpoint constant**

In `api_endpoints.dart`, add after line 35 (`static String similarOffers...`):

```dart
  static const String categoryFeed = '/offers/category-feed';
```

- [ ] **Step 3: Run flutter analyze**

```bash
"C:/dev/flutter/bin/flutter.bat" analyze --no-pub lib/models/category_feed.dart lib/core/network/api_endpoints.dart
```

Expected: No errors.

---

## Task 6: Flutter — Category Feed Provider

**Files:**
- Create: `ofai_flutter/lib/providers/category_feed_provider.dart`

- [ ] **Step 1: Create the provider file**

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../models/category_feed.dart';
import '../core/utils/interleave.dart';

class CategoryFeedState {
  final List<CategoryWithOffers> categories;
  final bool isLoading;
  final bool hasMore;
  final int offset;
  final String? error;

  const CategoryFeedState({
    this.categories = const [],
    this.isLoading = false,
    this.hasMore = true,
    this.offset = 0,
    this.error,
  });

  CategoryFeedState copyWith({
    List<CategoryWithOffers>? categories,
    bool? isLoading,
    bool? hasMore,
    int? offset,
    String? error,
  }) {
    return CategoryFeedState(
      categories: categories ?? this.categories,
      isLoading: isLoading ?? this.isLoading,
      hasMore: hasMore ?? this.hasMore,
      offset: offset ?? this.offset,
      error: error,
    );
  }
}

class CategoryFeedNotifier extends StateNotifier<CategoryFeedState> {
  CategoryFeedNotifier() : super(const CategoryFeedState());

  Future<void> loadNextBatch() async {
    if (state.isLoading || !state.hasMore) return;

    state = state.copyWith(isLoading: true, error: null);

    try {
      final response = await ApiClient().dio.get(
        ApiEndpoints.categoryFeed,
        queryParameters: {
          'offset': state.offset,
          'batch': 2,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final rawCategories = data['categories'] as List<dynamic>? ?? [];
      final hasMore = data['hasMore'] as bool? ?? false;

      final newCategories = rawCategories.map((e) {
        final cat = CategoryWithOffers.fromJson(e as Map<String, dynamic>);
        // Interleave offers within each category
        return CategoryWithOffers(
          id: cat.id,
          name: cat.name,
          offerCount: cat.offerCount,
          offers: interleaveOffers(cat.offers),
        );
      }).toList();

      state = state.copyWith(
        categories: [...state.categories, ...newCategories],
        isLoading: false,
        hasMore: hasMore,
        offset: state.offset + newCategories.length,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Nu s-au putut incarca categoriile',
      );
    }
  }

  void reset() {
    state = const CategoryFeedState();
  }
}

final categoryFeedProvider =
    StateNotifierProvider<CategoryFeedNotifier, CategoryFeedState>(
  (ref) => CategoryFeedNotifier(),
);
```

- [ ] **Step 2: Run flutter analyze**

```bash
"C:/dev/flutter/bin/flutter.bat" analyze --no-pub lib/providers/category_feed_provider.dart
```

Expected: No errors.

---

## Task 7: Flutter — Home Screen Integration

**Files:**
- Modify: `ofai_flutter/lib/screens/home/home_screen.dart`

This is the most delicate task. Changes must be surgical to avoid breaking existing sections.

- [ ] **Step 1: Add imports**

Add to the top of `home_screen.dart` (after existing imports, around line 21):

```dart
import '../../providers/category_feed_provider.dart';
import '../../models/category_feed.dart';
```

- [ ] **Step 2: Add ScrollController and init/dispose**

In `_HomeScreenState`, add a `ScrollController` field after `_searchFocusNode` (line 36):

```dart
  final _scrollController = ScrollController();
```

In `initState` (add the method after `_searchFocusNode` declaration, before `dispose`):

```dart
  @override
  void initState() {
    super.initState();
    // Load first batch of category feed
    Future.microtask(() {
      ref.read(categoryFeedProvider.notifier).loadNextBatch();
    });
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 500) {
      ref.read(categoryFeedProvider.notifier).loadNextBatch();
    }
  }
```

Update `dispose` (line 39-43) to also dispose the scroll controller:

```dart
  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    _scrollController.dispose();
    super.dispose();
  }
```

- [ ] **Step 3: Attach ScrollController to CustomScrollView**

Change line 81 from:
```dart
            child: CustomScrollView(
```
To:
```dart
            child: CustomScrollView(
              controller: _scrollController,
```

- [ ] **Step 4: Add category feed reset to onRefresh**

In the `onRefresh` callback (lines 72-80), add after `ref.invalidate(dealOfDayProvider);`:

```dart
            ref.read(categoryFeedProvider.notifier).reset();
            // Re-load first batch after reset
            ref.read(categoryFeedProvider.notifier).loadNextBatch();
```

- [ ] **Step 5: Insert category feed sections after Promoted Offers**

After the Promoted Offers `SliverToBoxAdapter` closing (line 383) and BEFORE the Marquee logos `SliverToBoxAdapter` (line 385), insert:

```dart
              // Category Feed — lazy-loaded sections
              SliverToBoxAdapter(
                child: Consumer(
                  builder: (context, ref, _) {
                    final feedState = ref.watch(categoryFeedProvider);
                    if (feedState.categories.isEmpty && !feedState.isLoading) {
                      return const SizedBox.shrink();
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final cat in feedState.categories) ...[
                          SectionHeader(
                            title: cat.name,
                            onViewAll: () => context.push(
                              '/explore?category=${cat.id}',
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          SizedBox(
                            height: 288,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.pagePadding,
                              ),
                              itemCount: cat.offers.length + 1, // +1 for "Vezi toate" card
                              separatorBuilder: (_, __) =>
                                  const SizedBox(width: AppSpacing.md),
                              itemBuilder: (context, index) {
                                if (index == cat.offers.length) {
                                  // "Vezi toate" card at the end
                                  return _SeeAllCard(
                                    categoryId: cat.id,
                                    offerCount: cat.offerCount,
                                  );
                                }
                                return SizedBox(
                                  width: 280,
                                  child: OfferCard(
                                    offer: cat.offers[index],
                                    horizontal: true,
                                  ),
                                );
                              },
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xxl),
                        ],
                        // Loading indicator for next batch
                        if (feedState.isLoading)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
                            child: Center(
                              child: SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppColors.accent,
                                ),
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ),
```

- [ ] **Step 6: Add the _SeeAllCard widget**

Add at the bottom of the file, before the closing of the file (after the `_MarqueeLogos` widget class):

```dart
class _SeeAllCard extends StatelessWidget {
  final int categoryId;
  final int offerCount;

  const _SeeAllCard({required this.categoryId, required this.offerCount});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/explore?category=$categoryId'),
      child: Container(
        width: 160,
        decoration: BoxDecoration(
          color: AppColors.bgSecondary,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          border: Border.all(color: AppColors.border),
        ),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.accent.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.arrow_forward_rounded,
                    color: AppColors.accent,
                    size: 24,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Vezi toate',
                  style: AppTypography.labelLarge.copyWith(
                    color: AppColors.accent,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '$offerCount oferte',
                  style: AppTypography.captionMuted,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 7: Run flutter analyze on all changed files**

```bash
"C:/dev/flutter/bin/flutter.bat" analyze --no-pub lib/screens/home/home_screen.dart lib/providers/category_feed_provider.dart lib/providers/offers_provider.dart lib/models/category_feed.dart lib/core/utils/interleave.dart lib/core/network/api_endpoints.dart
```

Expected: No errors (only pre-existing infos).

- [ ] **Step 8: Hot reload and verify**

Press `r` in Flutter terminal. Navigate to home screen. Scroll down past Promoted Offers.

Expected: Category sections appear with horizontal offer carousels. "Vezi toate" card at the end of each row. Scrolling further loads more categories.

---

## Task 8: Commit

- [ ] **Step 1: Commit backend changes**

```bash
cd appredueri_backend
git add src/migrations/058_category_rankings.sql src/services/cronJobs.js src/routes/offers.js
git commit -m "feat: add category feed API + cron job for home screen rankings"
```

- [ ] **Step 2: Commit Flutter changes**

```bash
cd ofai_flutter
git add lib/core/utils/interleave.dart lib/models/category_feed.dart lib/providers/category_feed_provider.dart lib/providers/offers_provider.dart lib/core/network/api_endpoints.dart lib/screens/home/home_screen.dart
git commit -m "feat: add category feed sections to Flutter home screen"
```
