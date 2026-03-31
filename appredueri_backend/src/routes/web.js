/**
 * Web Routes — Pagini publice OFAI.ro
 * Page renders + click/reveal APIs.
 * Auth routes: ./web-auth.js
 * Portal API routes: ./web-portal-api.js
 * Account API routes: ./web-account-api.js
 */

const express = require("express");
const router = express.Router();
const pool = require("../db");
const cache = require("../services/cache");
const { optionalWebAuth, requireWebAuth } = require("../middleware/webAuth");
const { requireBusinessOwner } = require("../middleware/businessWebAuth");
const { attachTier } = require('../middleware/tierAuth');
const { clickLimiter, revealLimiter } = require("../middleware/rateLimiter");

// Apply optional auth to ALL web routes
router.use(optionalWebAuth);

// ═══════════════════════════════════════════════════════
// SEO: robots.txt + sitemap.xml (moved from index.js)
// ═══════════════════════════════════════════════════════
router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /cont
Disallow: /colectia-mea
Disallow: /setari
Disallow: /preferinte
Disallow: /my-businesses
Disallow: /portal
Disallow: /onboarding
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify-code
Disallow: /api/

Sitemap: https://ofai.ro/sitemap.xml`);
});

router.get('/sitemap.xml', async (req, res) => {
  try {
    const BASE = 'https://ofai.ro';
    const today = new Date().toISOString().split('T')[0];

    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/oferte', priority: '0.9', changefreq: 'daily' },
      { loc: '/business-uri', priority: '0.8', changefreq: 'daily' },
      { loc: '/categorii', priority: '0.7', changefreq: 'weekly' },
      { loc: '/orase', priority: '0.7', changefreq: 'weekly' },
      { loc: '/preturi', priority: '0.6', changefreq: 'monthly' },
      { loc: '/pentru-business', priority: '0.6', changefreq: 'monthly' },
      { loc: '/ajutor', priority: '0.4', changefreq: 'monthly' },
      { loc: '/termeni', priority: '0.3', changefreq: 'yearly' },
      { loc: '/confidentialitate', priority: '0.3', changefreq: 'yearly' },
      { loc: '/blog', priority: '0.7', changefreq: 'daily' },
    ];

    const [offers, businesses, blogPosts] = await Promise.all([
      pool.query(
        "SELECT id, start_date::date as lastmod FROM offers WHERE is_active = true AND moderation_status IN ('approved', 'auto_approved') AND (end_date IS NULL OR end_date >= CURRENT_DATE) ORDER BY id DESC LIMIT 5000"
      ),
      pool.query(
        "SELECT id FROM businesses ORDER BY id DESC LIMIT 5000"
      ),
      pool.query(
        "SELECT slug, COALESCE(updated_at, published_at)::date as lastmod FROM blog_posts WHERE is_published = true ORDER BY published_at DESC LIMIT 1000"
      ),
    ]);

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

    for (const page of staticPages) {
      xml += `\n  <url>\n    <loc>${BASE}${page.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`;
    }
    for (const row of offers.rows) {
      xml += `\n  <url>\n    <loc>${BASE}/oferta/${row.id}</loc>\n    <lastmod>${row.lastmod || today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    }
    for (const row of businesses.rows) {
      xml += `\n  <url>\n    <loc>${BASE}/business/${row.id}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
    }
    for (const row of blogPosts.rows) {
      xml += `\n  <url>\n    <loc>${BASE}/blog/${row.slug}</loc>\n    <lastmod>${row.lastmod || today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
    }

    xml += '\n</urlset>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    console.error('[SEO] Sitemap error:', err.message);
    res.status(500).send('Error generating sitemap');
  }
});

// ═══════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════
// Home page helpers (extracted for parallelization)
async function _getDealOfDay() {
  try {
    let dodResult = await pool.query(`
      SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
             b.name as business_name, b.logo_url as business_logo,
             COALESCE(o.logo_url, b.cover_image_url) as image_url,
             ci2.name as city_name,
             b.subscription_badge_type as business_badge_type,
             b.is_verified as business_verified,
             (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities ci2 ON b.city_id = ci2.id
      WHERE o.is_active = TRUE AND o.is_deal_of_day = TRUE AND o.deal_of_day_date = CURRENT_DATE
        AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
        AND o.moderation_status IN ('approved', 'auto_approved')
      LIMIT 1
    `);
    if (dodResult.rows.length === 0) {
      dodResult = await pool.query(`
        SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
               b.name as business_name, b.logo_url as business_logo,
               COALESCE(o.logo_url, b.cover_image_url) as image_url,
               ci2.name as city_name,
               b.subscription_badge_type as business_badge_type,
               b.is_verified as business_verified,
               COALESCE(fav_agg.cnt, 0) as save_count
        FROM offers o
        JOIN businesses b ON o.business_id = b.id
        LEFT JOIN cities ci2 ON b.city_id = ci2.id
        LEFT JOIN (SELECT offer_id, COUNT(*) AS cnt FROM favorite_offers GROUP BY offer_id) fav_agg ON fav_agg.offer_id = o.id
        LEFT JOIN (SELECT offer_id, COUNT(*) AS cnt FROM business_clicks GROUP BY offer_id) click_agg ON click_agg.offer_id = o.id
        WHERE o.is_active = TRUE AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
          AND o.moderation_status IN ('approved', 'auto_approved')
        ORDER BY COALESCE(fav_agg.cnt, 0) + COALESCE(click_agg.cnt, 0) DESC
        LIMIT 1
      `);
    }
    return dodResult.rows.length > 0 ? dodResult.rows[0] : null;
  } catch (e) { return null; /* deal of day is optional */ }
}

async function _getFeaturedOffers(userPrefs, dealOfDay) {
  const where = ["o.is_active = true", "(o.end_date IS NULL OR o.end_date >= CURRENT_DATE)", "o.moderation_status IN ('approved', 'auto_approved')"];
  const params = [];
  let paramIdx = 1;
  if (userPrefs.city_ids && userPrefs.city_ids.length > 0) {
    where.push(`(b.city_id = ANY($${paramIdx++}) OR b.category_id = (SELECT id FROM categories WHERE name = 'Magazine Online'))`);
    params.push(userPrefs.city_ids);
  }
  if (userPrefs.category_ids.length > 0) {
    where.push(`b.category_id = ANY($${paramIdx++})`);
    params.push(userPrefs.category_ids);
  }
  if (dealOfDay) {
    where.push(`o.id != $${paramIdx++}`);
    params.push(dealOfDay.id);
  }
  const result = await pool.query(`
    SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
           b.name as business_name, b.logo_url as business_logo,
           b.cover_image_url as business_cover,
           b.lat as business_lat, b.lng as business_lng,
           b.subscription_badge_type as business_badge_type,
           b.is_verified as business_verified,
           ci.name as city_name, cat.name as category_name,
           COALESCE(o.logo_url, b.cover_image_url) as image_url,
           COALESCE(AVG(r.rating), 0) as rating_avg,
           COUNT(DISTINCT r.id) as rating_count,
           COALESCE(fav_agg.favorite_count, 0) as favorite_count,
           COALESCE(fav_agg.recent_favs, 0) >= 5 as is_trending
    FROM offers o
    JOIN businesses b ON o.business_id = b.id
    LEFT JOIN cities ci ON b.city_id = ci.id
    LEFT JOIN categories cat ON b.category_id = cat.id
    LEFT JOIN reviews r ON r.business_id = b.id
    LEFT JOIN (
      SELECT offer_id,
        COUNT(*) AS favorite_count,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '14 days') AS recent_favs
      FROM favorite_offers GROUP BY offer_id
    ) fav_agg ON fav_agg.offer_id = o.id
    LEFT JOIN business_subscriptions bsub
      ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
    LEFT JOIN subscription_plans splan
      ON splan.id = bsub.plan_id
    WHERE ${where.join(" AND ")}
    GROUP BY o.id, o.title, o.discount_type, o.discount_value, o.end_date,
             b.name, b.logo_url, b.cover_image_url, b.lat, b.lng,
             b.subscription_badge_type, b.is_verified,
             ci.name, cat.name, o.logo_url, splan.slug,
             fav_agg.favorite_count, fav_agg.recent_favs
    ORDER BY (RANDOM() * 0.4 + LEAST(o.discount_value, 100) / 100.0 * 0.3 + CASE WHEN o.end_date <= CURRENT_DATE + INTERVAL '3 days' THEN 0.3 ELSE 0.1 END + CASE WHEN splan.slug = 'premium' THEN 0.4 WHEN splan.slug = 'standard' THEN 0.1 ELSE 0 END) DESC
    LIMIT 6
  `, params);
  return result.rows;
}

async function _getPromotedOffers(dealOfDay) {
  try {
    const params = [];
    let exclude = '';
    if (dealOfDay) {
      params.push(parseInt(dealOfDay.id));
      exclude = `AND o.id != $1`;
    }
    const result = await pool.query(`
      SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
             b.name as business_name, b.logo_url as business_logo,
             b.cover_image_url as business_cover,
             b.lat as business_lat, b.lng as business_lng,
             b.subscription_badge_type as business_badge_type,
             b.is_verified as business_verified,
             ci.name as city_name, cat.name as category_name,
             COALESCE(o.logo_url, b.cover_image_url) as image_url,
             COALESCE(AVG(r.rating), 0) as rating_avg,
             COUNT(DISTINCT r.id) as rating_count,
             (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as favorite_count
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      JOIN business_subscriptions bsub
        ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
      JOIN subscription_plans splan
        ON splan.id = bsub.plan_id AND splan.has_promoted_placement = TRUE
      LEFT JOIN cities ci ON b.city_id = ci.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      LEFT JOIN reviews r ON r.business_id = b.id
      WHERE o.is_active = TRUE AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
        AND o.moderation_status IN ('approved', 'auto_approved')
        ${exclude}
      GROUP BY o.id, o.title, o.discount_type, o.discount_value, o.end_date,
               b.name, b.logo_url, b.cover_image_url, b.lat, b.lng,
               b.subscription_badge_type, b.is_verified,
               ci.name, cat.name, o.logo_url
      ORDER BY RANDOM()
      LIMIT 3
    `, params);
    return result.rows;
  } catch (e) { return []; /* promoted section is non-critical */ }
}

router.get("/", async (req, res) => {
  try {
    const isLoggedIn = !!req.webUser;

    // ── Phase A: All independent queries in parallel ──
    const [
      [bizCount, offerCount, cityCount, recentOffers],
      categoriesResult,
      userPrefsResult,
      dealOfDay,
      citiesResult,
      featuredBizResult,
      topBizResult,
      followedResult,
      favFollowResult,
    ] = await Promise.all([
      // 1. Stats counts (cached 1h)
      cache.cached('home:stats', 60 * 60 * 1000, async () => {
        const [biz, off, cit, rec] = await Promise.all([
          pool.query("SELECT COUNT(*) as total FROM businesses"),
          pool.query("SELECT COUNT(*) as total FROM offers WHERE is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)"),
          pool.query("SELECT COUNT(*) as total FROM cities"),
          pool.query("SELECT COUNT(*) as total FROM offers WHERE is_active = true AND start_date > CURRENT_DATE - INTERVAL '7 days'"),
        ]);
        return [biz, off, cit, rec];
      }, { groups: ['homepage'] }),
      // 2. Categories with offer counts (cached 2h)
      cache.cached('home:categories', 2 * 60 * 60 * 1000, async () => {
        return pool.query(`
          SELECT c.id, c.name, COUNT(DISTINCT o.id) as offer_count
          FROM categories c
          LEFT JOIN businesses b ON b.category_id = c.id
          LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
          GROUP BY c.id, c.name
          ORDER BY offer_count DESC
        `);
      }, { groups: ['homepage'] }),
      // 3. User preferences (null if not logged in)
      isLoggedIn
        ? pool.query("SELECT preferred_city_ids, preferred_category_ids FROM users WHERE id = $1", [req.webUser.id])
        : Promise.resolve(null),
      // 4. Deal of the Day (cached 30min)
      cache.cached('home:dealOfDay', 30 * 60 * 1000, () => _getDealOfDay(), { groups: ['homepage', 'offers'] }),
      // 5. Cities list (cached 2h)
      cache.cached('home:cities', 2 * 60 * 60 * 1000, async () => {
        return pool.query(`
          SELECT c.id, c.name, COUNT(b.id) as business_count
          FROM cities c
          LEFT JOIN businesses b ON b.city_id = c.id
          GROUP BY c.id, c.name
          ORDER BY business_count DESC
          LIMIT 15
        `);
      }, { groups: ['homepage', 'static'] }),
      // 6. Featured businesses (logo strip) — cached pool, shuffled per-request
      (async () => {
        const bizPool = await cache.cached('home:featBizPool', 10 * 60 * 1000, async () => {
          const { rows } = await pool.query("SELECT id, name, logo_url FROM businesses WHERE logo_url IS NOT NULL LIMIT 100");
          return rows;
        }, { groups: ['homepage', 'businesses'] });
        const pool_ = [...bizPool];
        for (let i = pool_.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool_[i], pool_[j]] = [pool_[j], pool_[i]]; }
        return { rows: pool_.slice(0, 20) };
      })(),
      // 7. Top businesses (cached 10min)
      cache.cached('home:topBiz', 10 * 60 * 1000, async () => {
        const tbRes = await pool.query(`
          SELECT b.id, b.name, b.logo_url, b.cover_image_url,
                 b.lat, b.lng, b.is_verified, b.subscription_badge_type,
                 ci.name as city_name, cat.name as category_name,
                 COALESCE(AVG(r.rating), 0) as rating_avg,
                 COUNT(DISTINCT r.id) as rating_count,
                 COUNT(DISTINCT o.id) as offer_count,
                 COALESCE(splan.has_promoted_placement, FALSE) as is_promoted
          FROM businesses b
          LEFT JOIN cities ci ON b.city_id = ci.id
          LEFT JOIN categories cat ON b.category_id = cat.id
          LEFT JOIN reviews r ON r.business_id = b.id
          LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
          LEFT JOIN business_subscriptions bsub
            ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
          LEFT JOIN subscription_plans splan
            ON splan.id = bsub.plan_id
          GROUP BY b.id, b.name, b.logo_url, b.cover_image_url, b.lat, b.lng, b.is_verified, b.subscription_badge_type, ci.name, cat.name, splan.slug, splan.has_promoted_placement
          HAVING COUNT(DISTINCT o.id) > 0
          ORDER BY (COUNT(DISTINCT o.id) + RANDOM() * 2 + CASE WHEN splan.slug = 'premium' THEN 3 WHEN splan.slug = 'standard' THEN 1 ELSE 0 END) DESC, COALESCE(AVG(r.rating), 0) DESC
          LIMIT 8
        `);
        return tbRes;
      }, { groups: ['homepage', 'businesses'] }),
      // 8. Followed offers (null if not logged in)
      isLoggedIn
        ? pool.query(`
            SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
                   b.name as business_name, b.logo_url as business_logo,
                   COALESCE(o.logo_url, b.cover_image_url) as image_url,
                   b.subscription_badge_type as business_badge_type,
                   b.is_verified as business_verified
            FROM offers o
            JOIN businesses b ON o.business_id = b.id
            JOIN followed_businesses fb ON fb.business_id = b.id AND fb.user_id = $1
            WHERE o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
              AND o.start_date >= CURRENT_DATE - INTERVAL '7 days'
            ORDER BY o.id DESC
            LIMIT 6
          `, [req.webUser.id])
        : Promise.resolve(null),
      // 9. User favorite/follow IDs (null if not logged in)
      isLoggedIn
        ? Promise.all([
            pool.query("SELECT offer_id FROM favorite_offers WHERE user_id = $1 LIMIT 500", [req.webUser.id]),
            pool.query("SELECT business_id FROM followed_businesses WHERE user_id = $1 LIMIT 500", [req.webUser.id]),
          ])
        : Promise.resolve(null),
    ]);

    // Unpack user preferences
    let userPrefs = { city_ids: [], category_ids: [] };
    if (userPrefsResult && userPrefsResult.rows[0]) {
      userPrefs.city_ids = userPrefsResult.rows[0].preferred_city_ids || [];
      userPrefs.category_ids = userPrefsResult.rows[0].preferred_category_ids || [];
    }

    // ── Phase B: Queries that depend on Phase A results ──
    const [featuredOffersRows, promotedOffers] = await Promise.all([
      _getFeaturedOffers(userPrefs, dealOfDay),
      _getPromotedOffers(dealOfDay),
    ]);

    // Assemble template data
    const stats = {
      totalBusinesses: parseInt(bizCount.rows[0].total),
      totalOffers: parseInt(offerCount.rows[0].total),
      totalCities: parseInt(cityCount.rows[0].total),
      newOffers: parseInt(recentOffers.rows[0].total) || Math.floor(parseInt(offerCount.rows[0].total) * 0.1),
    };

    const followedOffers = followedResult ? followedResult.rows : [];
    let userFavoriteIds = [];
    let userFollowedIds = [];
    if (favFollowResult) {
      userFavoriteIds = favFollowResult[0].rows.map(r => r.offer_id);
      userFollowedIds = favFollowResult[1].rows.map(r => r.business_id);
    }

    // Preferred city name for banner
    let preferredCityName = null;
    if (userPrefs.city_ids && userPrefs.city_ids.length > 0) {
      const cityName = citiesResult.rows.find(c => c.id === userPrefs.city_ids[0]);
      preferredCityName = cityName ? cityName.name : null;
    }

    res.render("public/home", {
      stats,
      categories: categoriesResult.rows,
      featuredOffers: featuredOffersRows,
      promotedOffers,
      dealOfDay,
      cities: citiesResult.rows,
      featuredBusinesses: featuredBizResult.rows,
      topBusinesses: topBizResult.rows,
      followedOffers,
      preferredCityName,
      hasPreferences: !!((userPrefs.city_ids && userPrefs.city_ids.length > 0) || userPrefs.category_ids.length > 0),
      userFavoriteIds,
      userFollowedIds,
      activePage: "home",
      webUser: req.webUser,
      structuredData: [{
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "OFAI",
        "url": "https://ofai.ro",
        "logo": "https://ofai.ro/images/og-default.svg",
        "description": "Descoperă cele mai bune reduceri și oferte de la business-urile din orașul tău.",
        "contactPoint": {
          "@type": "ContactPoint",
          "contactType": "customer service",
          "url": "https://ofai.ro/ajutor"
        }
      }, {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "OFAI",
        "url": "https://ofai.ro",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://ofai.ro/oferte?q={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      }],
    });
  } catch (err) {
    console.error("[Web] Home page error:", err.message);
    res.status(500).send("A apărut o eroare. Vă rugăm încercați din nou.");
  }
});

// ═══════════════════════════════════════════════════════
// OFFERS PAGE (with filtering, search, pagination)
// ═══════════════════════════════════════════════════════
router.get("/oferte", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 48;
    const offset = (page - 1) * limit;
    const query = req.query.q || "";
    const selectedCategory = req.query.category || null;
    const selectedCity = req.query.city || null;
    const sort = req.query.sort || "newest";

    const conditions = ["o.is_active = true", "(o.end_date IS NULL OR o.end_date >= CURRENT_DATE)", "o.moderation_status IN ('approved', 'auto_approved')"];
    const params = [];
    let paramIdx = 1;

    let searchOrderClause = null;
    if (query) {
      const { buildFuzzySearch } = require("../helpers/search");
      const fuzzy = buildFuzzySearch([
        { col: 'o.title', ilike: true, similarity: true },
        { col: 'o.description', ilike: true, similarity: false },
        { col: 'b.name', ilike: true, similarity: true },
      ], paramIdx);
      conditions.push(fuzzy.condition);
      params.push(...fuzzy.params(query));
      paramIdx += fuzzy.paramCount;
      searchOrderClause = fuzzy.orderClause;
    }

    if (selectedCategory) {
      conditions.push(`b.category_id = $${paramIdx}`);
      params.push(parseInt(selectedCategory));
      paramIdx++;
    }

    if (selectedCity) {
      conditions.push(`(b.city_id = $${paramIdx} OR b.category_id = (SELECT id FROM categories WHERE name = 'Magazine Online'))`);
      params.push(parseInt(selectedCity));
      paramIdx++;
    }

    // Fetch and optionally apply user preferences (cached 5min)
    let userHasPrefs = false;
    let prefsActive = false;
    let userPrefsCityNames = [];
    let userPrefsCategoryNames = [];

    if (req.webUser) {
      const prefData = await cache.cached(`user:${req.webUser.id}:prefs`, 5 * 60 * 1000, async () => {
        const prefsRes = await pool.query(
          "SELECT preferred_city_ids, preferred_category_ids FROM users WHERE id = $1",
          [req.webUser.id]
        );
        if (!prefsRes.rows[0]) return null;
        const p = prefsRes.rows[0];
        const res = { preferred_city_ids: p.preferred_city_ids, preferred_category_ids: p.preferred_category_ids, cityNames: [], categoryNames: [] };
        if (p.preferred_city_ids && p.preferred_city_ids.length > 0) {
          const cn = await pool.query("SELECT name FROM cities WHERE id = ANY($1)", [p.preferred_city_ids]);
          res.cityNames = cn.rows.map(r => r.name);
        }
        if (p.preferred_category_ids && p.preferred_category_ids.length > 0) {
          const cn = await pool.query("SELECT name FROM categories WHERE id = ANY($1)", [p.preferred_category_ids]);
          res.categoryNames = cn.rows.map(r => r.name);
        }
        return res;
      });
      if (prefData) {
        const hasCities = prefData.preferred_city_ids && prefData.preferred_city_ids.length > 0;
        const hasCats = prefData.preferred_category_ids && prefData.preferred_category_ids.length > 0;
        userHasPrefs = hasCities || hasCats;
        userPrefsCityNames = prefData.cityNames || [];
        userPrefsCategoryNames = prefData.categoryNames || [];

        // Apply preference filters only when prefs=1 and no manual city/category override
        if (req.query.prefs === '1' && !selectedCity && !selectedCategory) {
          prefsActive = true;
          if (hasCities) {
            conditions.push(`(b.city_id = ANY($${paramIdx}) OR b.category_id = (SELECT id FROM categories WHERE name = 'Magazine Online'))`);
            params.push(prefData.preferred_city_ids);
            paramIdx++;
          }
          if (hasCats) {
            conditions.push(`b.category_id = ANY($${paramIdx})`);
            params.push(prefData.preferred_category_ids);
            paramIdx++;
          }
        }
      }
    }

    const whereClause = conditions.join(" AND ");

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM offers o JOIN businesses b ON o.business_id = b.id WHERE ${whereClause}`,
      params
    );
    const totalOffers = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalOffers / limit);

    const sortOptions = {
      newest: "o.id DESC",
      popular: `(COALESCE(AVG(r.rating), 0) + CASE WHEN splan.slug = 'premium' THEN 0.4 WHEN splan.slug = 'standard' THEN 0.1 ELSE 0 END) DESC, COUNT(DISTINCT r.id) DESC`,
      discount: "CASE WHEN o.discount_type IN ('percent','percentage') THEN o.discount_value ELSE 0 END DESC, o.discount_value DESC",
      ending_soon: "o.end_date ASC NULLS LAST, o.id DESC",
    };
    const validSorts = ["newest", "popular", "discount", "ending_soon"];
    const sortKey = validSorts.includes(sort) ? sort : "newest";
    const orderBy = sortOptions[sortKey];

    const offersResult = await pool.query(
      `SELECT o.id, o.title, o.description, o.discount_type, o.discount_value, o.end_date,
              o.business_id,
              b.name as business_name, b.logo_url as business_logo,
              b.cover_image_url as business_cover,
              b.lat as business_lat, b.lng as business_lng,
              b.is_verified as business_verified,
              b.subscription_badge_type as business_badge_type,
              ci.name as city_name, cat.name as category_name,
              COALESCE(o.logo_url, b.cover_image_url) as image_url,
              COALESCE(AVG(r.rating), 0) as rating_avg,
              COUNT(DISTINCT r.id) as rating_count,
              (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as favorite_count,
              COALESCE(splan.has_promoted_placement, FALSE) as is_promoted
       FROM offers o
       JOIN businesses b ON o.business_id = b.id
       LEFT JOIN cities ci ON b.city_id = ci.id
       LEFT JOIN categories cat ON b.category_id = cat.id
       LEFT JOIN reviews r ON r.business_id = b.id
       LEFT JOIN business_subscriptions bsub
         ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
       LEFT JOIN subscription_plans splan
         ON splan.id = bsub.plan_id
       WHERE ${whereClause}
       GROUP BY o.id, o.title, o.description, o.discount_type, o.discount_value, o.end_date,
                o.business_id, b.name, b.logo_url, b.cover_image_url, b.lat, b.lng,
                b.is_verified, b.subscription_badge_type,
                ci.name, cat.name, o.logo_url, splan.slug, splan.has_promoted_placement
       ORDER BY ${searchOrderClause ? searchOrderClause + ', ' : ''}${orderBy}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    // Interleave offers so same business doesn't appear consecutively
    const rawOffers = offersResult.rows;
    const interleaved = [];
    const buckets = new Map();
    for (const offer of rawOffers) {
      const bid = offer.business_id;
      if (!buckets.has(bid)) buckets.set(bid, []);
      buckets.get(bid).push(offer);
    }
    const queues = [...buckets.values()].sort((a, b) => b.length - a.length);
    while (queues.some(q => q.length > 0)) {
      for (const q of queues) {
        if (q.length > 0) interleaved.push(q.shift());
      }
    }

    const categoriesResult = await pool.query("SELECT c.id, c.name FROM categories c ORDER BY c.name");

    const citiesResult = await pool.query(`
      SELECT c.id, c.name FROM cities c
      INNER JOIN businesses b ON b.city_id = c.id
      GROUP BY c.id, c.name
      ORDER BY COUNT(b.id) DESC
      LIMIT 15
    `);

    const totalCitiesResult = await pool.query(
      "SELECT COUNT(DISTINCT c.id) as total FROM cities c INNER JOIN businesses b ON b.city_id = c.id"
    );

    const selectedCityName = selectedCity ? (citiesResult.rows.find(c => c.id === parseInt(selectedCity, 10)) || {}).name : null;

    // Fetch user favorite IDs for card heart buttons
    let userFavoriteIds = [];
    if (req.webUser) {
      const favRes = await pool.query("SELECT offer_id FROM favorite_offers WHERE user_id = $1 LIMIT 500", [req.webUser.id]);
      userFavoriteIds = favRes.rows.map(r => r.offer_id);
    }

    const hasOfferFilters = query || selectedCategory || selectedCity || (sort && sort !== 'popular');
    res.render("public/oferte", {
      offers: interleaved,
      categories: categoriesResult.rows,
      cities: citiesResult.rows,
      totalOffers,
      totalPages,
      currentPage: page,
      totalCities: parseInt(totalCitiesResult.rows[0].total),
      query,
      selectedCategory: prefsActive ? null : selectedCategory,
      selectedCity: prefsActive ? null : selectedCity,
      selectedCityName: prefsActive ? null : selectedCityName,
      selectedSort: sort,
      prefsActive,
      userHasPrefs,
      userPrefsCityNames,
      userPrefsCategoryNames,
      userFavoriteIds,
      activePage: "oferte",
      webUser: req.webUser,
      pageTitle: page > 1 ? `Oferte — Pagina ${page}` : 'Oferte',
      pageDesc: 'Toate ofertele și reducerile active din România. Găsește cele mai bune deal-uri de la restaurante, beauty, fitness și altele pe OFAI.',
      canonicalUrl: hasOfferFilters ? null : `https://ofai.ro/oferte${page > 1 ? '?page=' + page : ''}`,
      noIndex: !!hasOfferFilters,
      seoPage: page,
      seoTotalPages: totalPages,
      seoBaseUrl: 'https://ofai.ro/oferte',
      structuredData: [{
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Oferte pe OFAI",
        "numberOfItems": totalOffers,
        "itemListElement": interleaved.slice(0, 10).map((o, i) => ({
          "@type": "ListItem",
          "position": (page - 1) * 48 + i + 1,
          "url": `https://ofai.ro/oferta/${o.id}`,
          "name": o.title
        }))
      }, {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Acasă", "item": "https://ofai.ro" },
          { "@type": "ListItem", "position": 2, "name": "Oferte", "item": "https://ofai.ro/oferte" }
        ]
      }],
    });
  } catch (err) {
    console.error("[Web] Offers page error:", err);
    res.status(500).send("Eroare la încărcarea ofertelor");
  }
});

// ═══════════════════════════════════════════════════════
// BUSINESSES PAGE (with filtering, search, pagination)
// ═══════════════════════════════════════════════════════
router.get("/business-uri", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 24;
    const offset = (page - 1) * limit;
    const query = req.query.q || "";
    const selectedCategory = req.query.category || null;
    const selectedCity = req.query.city || null;
    const sort = req.query.sort || "popular";

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    let searchOrderClauseBiz = null;
    if (query) {
      const { buildFuzzySearch } = require("../helpers/search");
      const fuzzy = buildFuzzySearch([
        { col: 'b.name', ilike: true, similarity: true },
      ], paramIdx);
      conditions.push(fuzzy.condition);
      params.push(...fuzzy.params(query));
      paramIdx += fuzzy.paramCount;
      searchOrderClauseBiz = fuzzy.orderClause;
    }

    if (selectedCategory) {
      conditions.push(`b.category_id = $${paramIdx}`);
      params.push(parseInt(selectedCategory));
      paramIdx++;
    }

    if (selectedCity) {
      conditions.push(`(b.city_id = $${paramIdx} OR b.category_id = (SELECT id FROM categories WHERE name = 'Magazine Online'))`);
      params.push(parseInt(selectedCity));
      paramIdx++;
    }

    // Fetch and optionally apply user preferences (cached 5min)
    let userHasPrefs = false;
    let prefsActive = false;
    let userPrefsCityNames = [];
    let userPrefsCategoryNames = [];

    if (req.webUser) {
      const prefData = await cache.cached(`user:${req.webUser.id}:prefs`, 5 * 60 * 1000, async () => {
        const prefsRes = await pool.query(
          "SELECT preferred_city_ids, preferred_category_ids FROM users WHERE id = $1",
          [req.webUser.id]
        );
        if (!prefsRes.rows[0]) return null;
        const p = prefsRes.rows[0];
        const res = { preferred_city_ids: p.preferred_city_ids, preferred_category_ids: p.preferred_category_ids, cityNames: [], categoryNames: [] };
        if (p.preferred_city_ids && p.preferred_city_ids.length > 0) {
          const cn = await pool.query("SELECT name FROM cities WHERE id = ANY($1)", [p.preferred_city_ids]);
          res.cityNames = cn.rows.map(r => r.name);
        }
        if (p.preferred_category_ids && p.preferred_category_ids.length > 0) {
          const cn = await pool.query("SELECT name FROM categories WHERE id = ANY($1)", [p.preferred_category_ids]);
          res.categoryNames = cn.rows.map(r => r.name);
        }
        return res;
      });
      if (prefData) {
        const hasCities = prefData.preferred_city_ids && prefData.preferred_city_ids.length > 0;
        const hasCats = prefData.preferred_category_ids && prefData.preferred_category_ids.length > 0;
        userHasPrefs = hasCities || hasCats;
        userPrefsCityNames = prefData.cityNames || [];
        userPrefsCategoryNames = prefData.categoryNames || [];

        // Apply preference filters only when prefs=1 and no manual city/category override
        if (req.query.prefs === '1' && !selectedCity && !selectedCategory) {
          prefsActive = true;
          if (hasCities) {
            conditions.push(`(b.city_id = ANY($${paramIdx}) OR b.category_id = (SELECT id FROM categories WHERE name = 'Magazine Online'))`);
            params.push(prefData.preferred_city_ids);
            paramIdx++;
          }
          if (hasCats) {
            conditions.push(`b.category_id = ANY($${paramIdx})`);
            params.push(prefData.preferred_category_ids);
            paramIdx++;
          }
        }
      }
    }

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM businesses b ${whereClause}`,
      params
    );
    const totalBusinesses = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalBusinesses / limit);

    const sortOptions = {
      popular: `(COUNT(DISTINCT o.id) + CASE WHEN splan.slug = 'premium' THEN 3 WHEN splan.slug = 'standard' THEN 1 ELSE 0 END) DESC, COALESCE(AVG(r.rating), 0) DESC`,
      rating: "COALESCE(AVG(r.rating), 0) DESC, COUNT(DISTINCT r.id) DESC",
      newest: "b.id DESC",
      offers: "COUNT(DISTINCT o.id) DESC, b.id DESC",
    };
    const orderBy = sortOptions[sort] || sortOptions.popular;

    const businessesResult = await pool.query(
      `SELECT b.id, b.name, b.logo_url, b.cover_image_url,
              b.lat, b.lng, b.is_verified, b.subscription_badge_type,
              ci.name as city_name, cat.name as category_name,
              COALESCE(AVG(r.rating), 0) as rating_avg,
              COUNT(DISTINCT r.id) as rating_count,
              COUNT(DISTINCT o.id) as offer_count,
              COALESCE(splan.has_promoted_placement, FALSE) as is_promoted
       FROM businesses b
       LEFT JOIN cities ci ON b.city_id = ci.id
       LEFT JOIN categories cat ON b.category_id = cat.id
       LEFT JOIN reviews r ON r.business_id = b.id
       LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
       LEFT JOIN business_subscriptions bsub
         ON bsub.business_id = b.id AND bsub.status IN ('active', 'trial')
       LEFT JOIN subscription_plans splan
         ON splan.id = bsub.plan_id
       ${whereClause}
       GROUP BY b.id, b.name, b.logo_url, b.cover_image_url, b.lat, b.lng, b.is_verified, b.subscription_badge_type, ci.name, cat.name, splan.slug, splan.has_promoted_placement
       ORDER BY ${searchOrderClauseBiz ? searchOrderClauseBiz + ', ' : ''}${orderBy}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    const categoriesResult = await pool.query("SELECT c.id, c.name FROM categories c ORDER BY c.name");

    const citiesResult = await pool.query(`
      SELECT c.id, c.name FROM cities c
      INNER JOIN businesses b ON b.city_id = c.id
      GROUP BY c.id, c.name
      ORDER BY COUNT(b.id) DESC
      LIMIT 15
    `);

    const totalCitiesResult = await pool.query(
      "SELECT COUNT(DISTINCT c.id) as total FROM cities c INNER JOIN businesses b ON b.city_id = c.id"
    );

    // Fetch user followed IDs for card heart buttons
    let userFollowedIds = [];
    if (req.webUser) {
      const followRes = await pool.query("SELECT business_id FROM followed_businesses WHERE user_id = $1 LIMIT 500", [req.webUser.id]);
      userFollowedIds = followRes.rows.map(r => r.business_id);
    }

    const hasFilters = query || selectedCategory || selectedCity || (sort && sort !== 'popular');
    res.render("public/business-uri", {
      businesses: businessesResult.rows,
      categories: categoriesResult.rows,
      cities: citiesResult.rows,
      totalBusinesses,
      totalPages,
      currentPage: page,
      totalCities: parseInt(totalCitiesResult.rows[0].total),
      query,
      selectedCategory: prefsActive ? null : selectedCategory,
      selectedCity: prefsActive ? null : selectedCity,
      selectedSort: sort,
      prefsActive,
      userHasPrefs,
      userPrefsCityNames,
      userPrefsCategoryNames,
      userFollowedIds,
      activePage: "business-uri",
      webUser: req.webUser,
      pageTitle: page > 1 ? `Business-uri — Pagina ${page}` : 'Business-uri',
      pageDesc: 'Descoperă business-urile verificate din România. Restaurante, saloane, fitness și multe altele cu oferte exclusive pe OFAI.',
      canonicalUrl: hasFilters ? null : `https://ofai.ro/business-uri${page > 1 ? '?page=' + page : ''}`,
      noIndex: !!hasFilters,
      seoPage: page,
      seoTotalPages: totalPages,
      seoBaseUrl: 'https://ofai.ro/business-uri',
      structuredData: [{
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Business-uri pe OFAI",
        "numberOfItems": totalBusinesses,
        "itemListElement": businessesResult.rows.slice(0, 10).map((biz, i) => ({
          "@type": "ListItem",
          "position": (page - 1) * 24 + i + 1,
          "url": `https://ofai.ro/business/${biz.id}`,
          "name": biz.name
        }))
      }, {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Acasă", "item": "https://ofai.ro" },
          { "@type": "ListItem", "position": 2, "name": "Business-uri", "item": "https://ofai.ro/business-uri" }
        ]
      }],
    });
  } catch (err) {
    console.error("[Web] Businesses page error:", err);
    res.status(500).send("Eroare la încărcarea business-urilor");
  }
});

// ═══════════════════════════════════════════════════════
// OFFER DETAIL PAGE
// ═══════════════════════════════════════════════════════
router.get("/oferta/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).render("public/404", { activePage: null, webUser: req.webUser || null, pageTitle: "Oferta negăsită" });

    const result = await pool.query(`
      SELECT
        o.id, o.business_id, o.title, o.description,
        o.discount_type, o.discount_value, o.conditions,
        o.start_date, o.end_date, o.is_active,
        o.logo_url as offer_logo,
        EXISTS(SELECT 1 FROM promo_codes WHERE offer_id = o.id AND is_active = TRUE) as has_promo_code,
        o.booking_type as offer_booking_type,
        o.booking_phone as offer_booking_phone,
        o.booking_whatsapp as offer_booking_whatsapp,
        o.booking_url as offer_booking_url,
        o.booking_instructions as offer_booking_instructions,
        b.name as business_name, b.address as business_address,
        b.phone as business_phone, b.website as business_website,
        b.lat as business_lat, b.lng as business_lng,
        b.logo_url as business_logo, b.cover_image_url as business_cover,
        b.subscription_badge_type, b.is_verified as business_verified,
        b.booking_type as biz_booking_type,
        b.booking_phone as biz_booking_phone,
        b.booking_whatsapp as biz_booking_whatsapp,
        b.booking_url as biz_booking_url,
        b.booking_instructions as biz_booking_instructions,
        c.id as city_id, c.name as city_name,
        cat.id as cat_id, cat.name as cat_name,
        (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE business_id = b.id) as rating_avg,
        (SELECT COUNT(*) FROM reviews WHERE business_id = b.id) as rating_count,
        (SELECT COUNT(*) FROM favorite_offers fo WHERE fo.offer_id = o.id) as save_count,
        (CASE WHEN (SELECT COUNT(*) FROM favorite_offers fo2 WHERE fo2.offer_id = o.id AND fo2.created_at > NOW() - INTERVAL '14 days') >= 5 THEN true ELSE false END) as is_trending,
        o.max_reveals,
        o.redemption_method,
        (SELECT COUNT(*) FROM code_reveals cr WHERE cr.offer_id = o.id) as reveal_count
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      WHERE o.id = $1 AND o.is_active = true AND o.moderation_status IN ('approved', 'auto_approved')
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });
    }

    const row = result.rows[0];

    // Fire-and-forget view tracking
    pool.query(
      "INSERT INTO offer_views (offer_id, business_id, viewer_ip, user_agent) VALUES ($1, $2, $3, $4)",
      [id, row.business_id, req.ip || null, (req.get("user-agent") || "").substring(0, 500)]
    ).catch(err => console.error('[Analytics] Tracking failed:', err.message));

    // Effective booking (inherit logic)
    let booking = { type: 'none', phone: null, whatsapp: null, url: null, instructions: null };
    const offerBookingType = row.offer_booking_type || 'inherit';
    if (offerBookingType === 'inherit') {
      booking = { type: row.biz_booking_type || 'none', phone: row.biz_booking_phone, whatsapp: row.biz_booking_whatsapp, url: row.biz_booking_url, instructions: row.biz_booking_instructions };
    } else {
      booking = { type: offerBookingType, phone: row.offer_booking_phone, whatsapp: row.offer_booking_whatsapp, url: row.offer_booking_url, instructions: row.offer_booking_instructions };
    }
    // Normalize legacy values (link→url, case normalization)
    booking.type = (booking.type || 'none').toLowerCase().replace('link', 'url');

    // Profile fallbacks (defense in depth — covers cases where booking_* field is NULL but profile has data)
    if (booking.type === 'phone' && !booking.phone) booking.phone = row.business_phone;
    if (booking.type === 'whatsapp' && !booking.whatsapp) booking.whatsapp = row.business_phone;
    if (booking.type === 'url' && !booking.url) booking.url = row.business_website;

    // Locations
    const linkRes = await pool.query("SELECT location_id FROM offer_locations WHERE offer_id = $1", [id]);
    const specificLocationIds = linkRes.rows.map(r => r.location_id);

    let locations = [];
    const baseLocQuery = `SELECT bl.id, bl.address, bl.lat, bl.lng, bl.phone, bl.maps_url,
      bl.booking_type, bl.booking_phone, bl.booking_whatsapp, bl.booking_url, bl.booking_instructions,
      c.name as city_name
      FROM business_locations bl LEFT JOIN cities c ON bl.city_id = c.id`;

    if (specificLocationIds.length > 0) {
      const locsRes = await pool.query(`${baseLocQuery} WHERE bl.id = ANY($1)`, [specificLocationIds]);
      locations = locsRes.rows;
    } else {
      const allLocsRes = await pool.query(`${baseLocQuery} WHERE bl.business_id = $1`, [row.business_id]);
      locations = allLocsRes.rows;
    }

    // Check favorite status
    let isFavorite = false;
    if (req.webUser) {
      const favRes = await pool.query(
        "SELECT 1 FROM favorite_offers WHERE user_id = $1 AND offer_id = $2",
        [req.webUser.id, id]
      );
      isFavorite = favRes.rowCount > 0;
    }

    const avg = parseFloat(row.rating_avg || 0);
    const count = parseInt(row.rating_count || 0);

    const offer = {
      id: row.id,
      title: row.title,
      description: row.description,
      discount_type: row.discount_type,
      discount_value: row.discount_value,
      conditions: row.conditions,
      start_date: row.start_date,
      end_date: row.end_date,
      is_active: row.is_active,
      has_promo_code: !!row.has_promo_code,
      save_count: parseInt(row.save_count || 0),
      is_trending: row.is_trending === true,
      max_reveals: row.max_reveals || null,
      reveal_count: parseInt(row.reveal_count || 0),
      image_url: row.offer_logo || row.business_cover || row.business_logo,
      redemption_method: row.redemption_method || null,
      booking,
      business: {
        id: row.business_id,
        name: row.business_name,
        phone: row.business_phone,
        website: row.business_website,
        logo_url: row.business_logo,
        city: { id: row.city_id, name: row.city_name },
        category: { id: row.cat_id, name: row.cat_name },
        rating: parseFloat(avg.toFixed(1)),
        rating_count: count,
        badge_type: row.subscription_badge_type || (row.business_verified ? 'verified' : null),
      },
      locations: locations.map(l => ({
        id: l.id, address: l.address, lat: l.lat, lng: l.lng, phone: l.phone, cityName: l.city_name,
        booking_type: (l.booking_type || 'none').toLowerCase().replace('link', 'url'),
        booking_phone: l.booking_phone, booking_whatsapp: l.booking_whatsapp,
        booking_url: l.booking_url, booking_instructions: l.booking_instructions,
      })),
    };

    // Load multi-platform booking methods (offer-level override > business-level fallback)
    const { getActionLabel, getBookingHref, getPlatform } = require('../helpers/bookingPlatforms');
    const mapBM = (rows) => rows.map(m => ({
      ...m,
      actionLabel: getActionLabel(m, req.language || 'ro'),
      href: getBookingHref(m),
      color: (getPlatform(m.platform) || {}).color || '#a1a1aa',
      type: (getPlatform(m.platform) || {}).type || 'url',
    }));
    // Check offer-specific first
    const offerBmRes = await pool.query(
      "SELECT platform, platform_label, value, sort_order FROM offer_booking_methods WHERE offer_id = $1 ORDER BY sort_order, id",
      [offer.id]
    );
    if (offerBmRes.rows.length > 0) {
      offer.bookingMethods = mapBM(offerBmRes.rows);
    } else {
      // Fallback to business-level
      const bizBmRes = await pool.query(
        "SELECT platform, platform_label, value, sort_order FROM business_booking_methods WHERE business_id = $1 ORDER BY sort_order, id",
        [row.business_id]
      );
      offer.bookingMethods = mapBM(bizBmRes.rows);
    }

    // Similar offers (same category, respecting competitor blocking)
    let similarOffers = [];
    if (row.cat_id) {
      try {
        // Check if the current offer's business has competitor blocking enabled
        let blockCompetitors = false;
        try {
          const tierCheck = await pool.query(`
            SELECT splan.has_competitor_blocking, b.competitor_blocking_enabled
            FROM business_subscriptions bsub
            JOIN subscription_plans splan ON splan.id = bsub.plan_id
            JOIN businesses b ON b.id = bsub.business_id
            WHERE bsub.business_id = $1
              AND bsub.status IN ('active', 'trial')
            LIMIT 1
          `, [row.business_id]);
          if (tierCheck.rows.length > 0
              && tierCheck.rows[0].has_competitor_blocking
              && tierCheck.rows[0].competitor_blocking_enabled) {
            blockCompetitors = true;
          }
        } catch (e) { /* fail open — don't block on tier errors */ }

        let simQuery;
        let simParams;

        if (blockCompetitors) {
          // Show only offers from the SAME business (no competitors)
          simQuery = `
            SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
                   b.name as business_name, b.logo_url as business_logo,
                   COALESCE(o.logo_url, b.cover_image_url) as image_url,
                   c2.name as city_name,
                   b.subscription_badge_type as business_badge_type, b.is_verified as business_verified
            FROM offers o
            JOIN businesses b ON o.business_id = b.id
            LEFT JOIN cities c2 ON b.city_id = c2.id
            LEFT JOIN (SELECT offer_id, COUNT(*) as cnt FROM favorite_offers GROUP BY offer_id) fav_agg ON fav_agg.offer_id = o.id
            WHERE o.id != $1 AND o.is_active = TRUE
              AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
              AND o.business_id = $2
            ORDER BY COALESCE(fav_agg.cnt, 0) DESC
            LIMIT 4
          `;
          simParams = [id, row.business_id];
        } else {
          // Default: show offers from any business in the same category
          simQuery = `
            SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
                   b.name as business_name, b.logo_url as business_logo,
                   COALESCE(o.logo_url, b.cover_image_url) as image_url,
                   c2.name as city_name,
                   b.subscription_badge_type as business_badge_type, b.is_verified as business_verified
            FROM offers o
            JOIN businesses b ON o.business_id = b.id
            LEFT JOIN cities c2 ON b.city_id = c2.id
            LEFT JOIN (SELECT offer_id, COUNT(*) as cnt FROM favorite_offers GROUP BY offer_id) fav_agg ON fav_agg.offer_id = o.id
            WHERE o.id != $1 AND o.is_active = TRUE
              AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
              AND b.category_id = $2
            ORDER BY COALESCE(fav_agg.cnt, 0) DESC
            LIMIT 4
          `;
          simParams = [id, row.cat_id];
        }

        const simResult = await pool.query(simQuery, simParams);
        similarOffers = simResult.rows;
      } catch (e) { /* silently fail */ }
    }

    // Fetch user favorite IDs for similar offer heart buttons
    let userFavoriteIds = [];
    if (req.webUser) {
      const favRes = await pool.query("SELECT offer_id FROM favorite_offers WHERE user_id = $1 LIMIT 500", [req.webUser.id]);
      userFavoriteIds = favRes.rows.map(r => r.offer_id);
    }

    res.render("public/offer-detail", {
      offer,
      similarOffers,
      isFavorite,
      userFavoriteIds,
      activePage: null,
      webUser: req.webUser,
      ogTitle: offer.title,
      ogDesc: (offer.description || 'Oferta pe OFAI').substring(0, 160),
      ogImage: offer.image_url || null,
      ogUrl: `https://ofai.ro/oferta/${offer.id}`,
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "Offer",
          "name": offer.title,
          "description": (offer.description || '').substring(0, 300),
          "url": `https://ofai.ro/oferta/${offer.id}`,
          ...(offer.image_url ? { "image": offer.image_url } : {}),
          ...(offer.start_date ? { "validFrom": offer.start_date } : {}),
          ...(offer.end_date ? { "validThrough": offer.end_date } : {}),
          "offeredBy": {
            "@type": "LocalBusiness",
            "name": offer.business?.name || ''
          }
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Acasă", "item": "https://ofai.ro" },
            { "@type": "ListItem", "position": 2, "name": "Oferte", "item": "https://ofai.ro/oferte" },
            { "@type": "ListItem", "position": 3, "name": offer.title }
          ]
        }
      ],
    });
  } catch (err) {
    console.error("[Web] Offer detail error:", err);
    res.status(500).send("Eroare la încărcarea ofertei");
  }
});

// ═══════════════════════════════════════════════════════
// CLICK TRACKING (anonymous, GDPR-friendly)
// ═══════════════════════════════════════════════════════
router.post("/api/web/clicks", clickLimiter, async (req, res) => {
  const { business_id, offer_id, action_type } = req.body || {};
  const validActions = ['phone','whatsapp','booking_url','website','navigate','share','follow','unfollow','favorite','unfavorite','gallery','copy_code'];
  if (!business_id || !action_type || !validActions.includes(action_type)) {
    return res.status(400).json({ message: "Invalid" });
  }
  pool.query(
    "INSERT INTO business_clicks (business_id, offer_id, action_type) VALUES ($1, $2, $3)",
    [parseInt(business_id), offer_id ? parseInt(offer_id) : null, action_type]
  ).catch(err => console.error('[Analytics] Tracking failed:', err.message));
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════
// OFFER PROMO CODE REVEAL (Web, auth required)
// ═══════════════════════════════════════════════════════
router.post("/api/web/offers/:id/reveal-code", revealLimiter, requireWebAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // First check if offer exists and is active
    const offerCheck = await pool.query("SELECT id FROM offers WHERE id = $1 AND is_active = TRUE", [id]);
    if (offerCheck.rows.length === 0) {
      return res.status(404).json({ message: "Oferta nu există" });
    }

    // Check max_reveals limit
    const limitCheck = await pool.query(
      "SELECT o.max_reveals, (SELECT COUNT(*) FROM code_reveals cr WHERE cr.offer_id = o.id) as reveal_count FROM offers o WHERE o.id = $1",
      [id]
    );
    if (limitCheck.rows[0] && limitCheck.rows[0].max_reveals !== null) {
      if (parseInt(limitCheck.rows[0].reveal_count) >= parseInt(limitCheck.rows[0].max_reveals)) {
        return res.status(410).json({ message: "Codul promoțional a atins limita de utilizări" });
      }
    }

    // Get a random active promo code for this offer
    const result = await pool.query(
      "SELECT id, code FROM promo_codes WHERE offer_id = $1 AND is_active = TRUE ORDER BY RANDOM() LIMIT 1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Această ofertă nu are cod promoțional activ" });
    }

    const promoRow = result.rows[0];

    // Log reveal with promo_code_id (fire-and-forget)
    pool.query(
      "INSERT INTO code_reveals (offer_id, user_id, viewer_ip, promo_code_id) VALUES ($1, $2, $3, $4)",
      [id, req.webUser.id, req.ip || null, promoRow.id]
    ).catch(err => console.error('[Analytics] Tracking failed:', err.message));

    // Fire-and-forget: award points + check badges
    const { awardPoints } = require("../services/gamification");
    const { checkAndAwardBadges } = require("../services/badgeService");
    awardPoints(req.webUser.id, "code_reveal").catch(() => {});
    checkAndAwardBadges(req.webUser.id, ["code_hunter"]).catch(() => {});

    res.json({ promo_code: promoRow.code });
  } catch (err) {
    console.error("[Web] Reveal code error:", err);
    res.status(500).json({ message: "Eroare server" });
  }
});

// ═══════════════════════════════════════════════════════
// BUSINESS DETAIL PAGE
// ═══════════════════════════════════════════════════════
router.get("/business/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(404).render("public/404", { activePage: null, webUser: req.webUser || null, pageTitle: "Business negăsit" });

    const businessRes = await pool.query(`
      SELECT b.id, b.name, b.description, b.address, b.phone, b.website, b.lat, b.lng,
             b.logo_url, b.cover_image_url, b.is_verified, b.subscription_badge_type,
             b.booking_type, b.booking_phone, b.booking_whatsapp, b.booking_url, b.booking_instructions,
             c.id as city_id, c.name as city_name,
             cat.id as cat_id, cat.name as cat_name,
             COALESCE(AVG(r.rating), 0) as rating_avg,
             COUNT(r.id) as rating_count,
             (SELECT COUNT(*) FROM followed_businesses fb WHERE fb.business_id = b.id) as follower_count,
             (SELECT json_agg(json_build_object('rating', r_dist.rating, 'count', r_dist.cnt))
              FROM (SELECT rating, COUNT(*) as cnt FROM reviews WHERE business_id = b.id GROUP BY rating) r_dist
             ) as rating_distribution
      FROM businesses b
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      LEFT JOIN reviews r ON b.id = r.business_id
      WHERE b.id = $1
      GROUP BY b.id, c.id, c.name, cat.id, cat.name
    `, [id]);

    if (businessRes.rows.length === 0) {
      return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });
    }

    const b = businessRes.rows[0];

    // Fire-and-forget view tracking
    pool.query(
      "INSERT INTO business_views (business_id, viewer_ip, user_agent) VALUES ($1, $2, $3)",
      [id, req.ip || null, (req.get("user-agent") || "").substring(0, 500)]
    ).catch(err => console.error('[Analytics] Tracking failed:', err.message));

    // Images
    const imagesRes = await pool.query(
      "SELECT id, image_url, image_filename, sort_order FROM business_images WHERE business_id = $1 ORDER BY sort_order NULLS LAST, id ASC",
      [id]
    );
    const images = imagesRes.rows.map(img => ({
      id: img.id,
      url: img.image_url || (img.image_filename ? `/uploads/businesses/${img.image_filename}` : null),
      sort_order: img.sort_order,
    })).filter(img => img.url);

    // Locations
    const locationsRes = await pool.query(`
      SELECT bl.id, bl.address, bl.lat, bl.lng, bl.phone, bl.maps_url,
             bl.booking_type, bl.booking_phone, bl.booking_whatsapp, bl.booking_url, bl.booking_instructions,
             c.id as city_id, c.name as city_name
      FROM business_locations bl
      LEFT JOIN cities c ON bl.city_id = c.id
      WHERE business_id = $1
    `, [id]);

    // Opening Hours — per-location
    const hoursRes = await pool.query(
      `SELECT bh.location_id, bh.day_of_week,
              to_char(bh.open_time, 'HH24:MI') AS open_time,
              to_char(bh.close_time, 'HH24:MI') AS close_time,
              bh.is_closed
       FROM business_hours bh
       JOIN business_locations bl ON bl.id = bh.location_id
       WHERE bl.business_id = $1
       ORDER BY bh.location_id, bh.day_of_week`,
      [id]
    );
    const hoursMap = {};
    for (const hr of hoursRes.rows) {
      if (!hoursMap[hr.location_id]) hoursMap[hr.location_id] = [];
      hoursMap[hr.location_id].push({
        day_of_week: hr.day_of_week, open_time: hr.open_time,
        close_time: hr.close_time, is_closed: hr.is_closed,
      });
    }

    let locations = [];
    if (locationsRes.rows.length > 0) {
      locations = locationsRes.rows.map(row => ({
        id: row.id, address: row.address, lat: row.lat, lng: row.lng, phone: row.phone,
        maps_url: row.maps_url || null,
        city: { id: row.city_id, name: row.city_name },
        booking_type: (row.booking_type || 'none').toLowerCase().replace('link', 'url'),
        booking_phone: row.booking_phone, booking_whatsapp: row.booking_whatsapp,
        booking_url: row.booking_url, booking_instructions: row.booking_instructions,
        hours: hoursMap[row.id] || [],
      }));
    } else if (b.address) {
      locations = [{ id: 'main', address: b.address, lat: b.lat, lng: b.lng, phone: b.phone,
        city: { id: b.city_id, name: b.city_name },
        booking_type: 'none', booking_phone: null, booking_whatsapp: null, booking_url: null, booking_instructions: null,
        hours: [] }];
    }

    // 3c. Catalog (categories + active items) for business-detail page
    const catalogRes = await pool.query(
      `SELECT ci.id, ci.category_id, ci.type, ci.name, ci.description, ci.price, ci.price_label,
              ci.duration_minutes, ci.image_url, ci.sort_order,
              cc.name AS category_name, cc.sort_order AS cat_sort
       FROM business_catalog_items ci
       LEFT JOIN business_catalog_categories cc ON cc.id = ci.category_id
       WHERE ci.business_id = $1 AND ci.is_active = TRUE
       ORDER BY COALESCE(cc.sort_order, 999999), cc.id, ci.sort_order, ci.id`,
      [id]
    );
    const catalogMap = {};
    const uncategorizedItems = [];
    catalogRes.rows.forEach(row => {
      const item = {
        id: row.id, type: row.type, name: row.name, description: row.description,
        price_display: row.price != null ? (row.price / 100).toFixed(2) + ' RON' : (row.price_label || null),
        duration_minutes: row.duration_minutes, image_url: row.image_url,
      };
      if (row.category_id) {
        if (!catalogMap[row.category_id]) catalogMap[row.category_id] = { id: row.category_id, name: row.category_name, items: [] };
        catalogMap[row.category_id].items.push(item);
      } else { uncategorizedItems.push(item); }
    });
    const catalog = Object.values(catalogMap);
    if (uncategorizedItems.length > 0) catalog.push({ id: null, name: 'Altele', items: uncategorizedItems });

    // Active offers
    const offersRes = await pool.query(`
      SELECT o.id, o.title, o.discount_type, o.discount_value,
             o.start_date, o.end_date,
             COALESCE(o.logo_url, b2.cover_image_url) as image_url,
             b2.name as business_name, b2.logo_url as business_logo,
             COALESCE(fav_agg.cnt, 0) as favorite_count
      FROM offers o
      JOIN businesses b2 ON o.business_id = b2.id
      LEFT JOIN (SELECT offer_id, COUNT(*) as cnt FROM favorite_offers GROUP BY offer_id) fav_agg ON fav_agg.offer_id = o.id
      WHERE o.business_id = $1 AND o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
        AND o.moderation_status IN ('approved', 'auto_approved')
      ORDER BY o.discount_value DESC
      LIMIT 50
    `, [id]);

    // Fetch offer_locations for all active offers (for location tabs)
    const offerIds = offersRes.rows.map(o => o.id);
    let offerLocationMap = {}; // offerId -> [locationId, ...]
    if (offerIds.length > 0) {
      const olRes = await pool.query(
        `SELECT offer_id, location_id FROM offer_locations WHERE offer_id = ANY($1)`,
        [offerIds]
      );
      olRes.rows.forEach(row => {
        if (!offerLocationMap[row.offer_id]) offerLocationMap[row.offer_id] = [];
        offerLocationMap[row.offer_id].push(row.location_id);
      });
    }
    // Attach locationIds to each offer row
    offersRes.rows.forEach(o => {
      o.locationIds = offerLocationMap[o.id] || [];
    });

    // Reviews
    const reviewsRes = await pool.query(`
      SELECT r.id, r.rating, r.comment, r.created_at,
             COALESCE(u.first_name, 'Utilizator') as first_name,
             COALESCE(u.last_name, '') as last_name,
             u.profile_picture_url,
             COALESCE(u.show_picture_in_reviews, TRUE) as show_picture_in_reviews,
             bd_display.color as display_badge_color,
             bd_display.name as display_badge_name,
             rr.response_text, rr.created_at as response_date
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN badge_definitions bd_display ON bd_display.id = u.display_badge_id
      LEFT JOIN review_responses rr ON rr.review_id = r.id
      WHERE r.business_id = $1
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [id]);

    // Check follow status + user review + offer request status
    let isFollowing = false;
    let userReview = null;
    let userRequested = false;
    if (req.webUser) {
      const [followRes, userRevRes, userReqRes] = await Promise.all([
        pool.query("SELECT 1 FROM followed_businesses WHERE user_id = $1 AND business_id = $2", [req.webUser.id, id]),
        pool.query("SELECT id, rating, comment FROM reviews WHERE user_id = $1 AND business_id = $2", [req.webUser.id, id]),
        pool.query(
          `SELECT created_at FROM offer_requests
           WHERE user_id = $1 AND business_id = $2
           ORDER BY created_at DESC LIMIT 1`,
          [req.webUser.id, id]
        ),
      ]);
      isFollowing = followRes.rowCount > 0;
      userReview = userRevRes.rows[0] || null;

      // Check if user has an active request (within last 7 days)
      if (userReqRes.rows.length > 0) {
        const lastRequest = new Date(userReqRes.rows[0].created_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        userRequested = lastRequest > sevenDaysAgo;
      }
    }

    // Offer request count (all users)
    const requestCountRes = await pool.query(
      `SELECT COUNT(*) as total
       FROM offer_requests
       WHERE business_id = $1`,
      [id]
    );
    const requestCount = parseInt(requestCountRes.rows[0].total || 0);

    // Determine showPinch flag
    let showPinch = false;
    const activeOffers = offersRes.rows;
    if (activeOffers.length === 0) {
      // No active offers
      showPinch = true;
    } else {
      // Check if newest offer is older than 30 days
      // offersRes is already ordered by discount_value DESC, so we need to find the max ID
      const newestOffer = activeOffers.reduce((max, offer) => offer.id > max.id ? offer : max, activeOffers[0]);
      const startDate = new Date(newestOffer.start_date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (startDate < thirtyDaysAgo) {
        showPinch = true;
      }
    }

    // Review summary
    let reviewSummary = null;
    try {
      const { getExistingSummary } = require("../services/llm/summarizationService");
      const existingSummary = await getExistingSummary(id);
      if (existingSummary) {
        reviewSummary = { text: existingSummary.summary_text, review_count: existingSummary.review_count };
      }
    } catch (e) {
      console.error("[Web] Review summary error for business", id, ":", e.message || e);
    }

    const coverImage = b.cover_image_url || (images.length > 0 ? images[0].url : b.logo_url);

    const business = {
      id: b.id,
      name: b.name,
      description: b.description,
      address: b.address,
      phone: b.phone,
      website: b.website,
      lat: b.lat,
      lng: b.lng,
      logo_url: b.logo_url,
      cover_image: coverImage,
      is_verified: !!b.is_verified,
      subscription_badge_type: b.subscription_badge_type || null,
      // Legacy fallback: businesses verified before subscription system keep 'verified' badge
      badge_type: b.subscription_badge_type || (b.is_verified ? 'verified' : null),
      city: { id: b.city_id, name: b.city_name },
      category: { id: b.cat_id, name: b.cat_name },
      rating: parseFloat(parseFloat(b.rating_avg).toFixed(1)),
      rating_count: parseInt(b.rating_count),
      follower_count: parseInt(b.follower_count || 0),
      rating_distribution: b.rating_distribution || [],
      images,
      locations,
      booking: {
        type: (b.booking_type || 'none').toLowerCase().replace('link', 'url'),
        phone: b.booking_phone, whatsapp: b.booking_whatsapp,
        url: b.booking_url, instructions: b.booking_instructions,
      },
    };

    // Fetch user favorite IDs for offer card heart buttons
    let userFavoriteIds = [];
    if (req.webUser) {
      const favRes = await pool.query("SELECT offer_id FROM favorite_offers WHERE user_id = $1 LIMIT 500", [req.webUser.id]);
      userFavoriteIds = favRes.rows.map(r => r.offer_id);
    }

    // Load multi-platform booking methods
    const { getActionLabel: getBAL, getBookingHref: getBH, getPlatform: getP } = require('../helpers/bookingPlatforms');
    const bmBizRes = await pool.query(
      "SELECT platform, platform_label, value, sort_order FROM business_booking_methods WHERE business_id = $1 ORDER BY sort_order, id",
      [id]
    );
    business.bookingMethods = bmBizRes.rows.map(m => ({
      ...m,
      actionLabel: getBAL(m, req.language || 'ro'),
      href: getBH(m),
      color: (getP(m.platform) || {}).color || '#a1a1aa',
      type: (getP(m.platform) || {}).type || 'url',
    }));

    res.render("public/business-detail", {
      business,
      catalog,
      offers: offersRes.rows,
      reviews: reviewsRes.rows,
      userReview,
      isFollowing,
      reviewSummary,
      showPinch,
      requestCount,
      userRequested,
      userFavoriteIds,
      activePage: null,
      webUser: req.webUser,
      ogTitle: business.name,
      ogDesc: (business.description || `${business.name} pe OFAI`).substring(0, 160),
      ogImage: business.cover_image || business.logo_url || null,
      ogUrl: `https://ofai.ro/business/${business.id}`,
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": business.name,
          "description": (business.description || '').substring(0, 300),
          "address": {
            "@type": "PostalAddress",
            "streetAddress": business.address || '',
            "addressLocality": business.city?.name || '',
            "addressCountry": "RO"
          },
          ...(business.lat && business.lng ? { "geo": { "@type": "GeoCoordinates", "latitude": business.lat, "longitude": business.lng } } : {}),
          ...(business.phone ? { "telephone": business.phone } : {}),
          ...(business.website ? { "url": business.website } : {}),
          ...(business.cover_image ? { "image": business.cover_image } : {}),
          ...(business.rating > 0 ? { "aggregateRating": { "@type": "AggregateRating", "ratingValue": business.rating, "reviewCount": business.rating_count || 0 } } : {})
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Acasă", "item": "https://ofai.ro" },
            { "@type": "ListItem", "position": 2, "name": "Business-uri", "item": "https://ofai.ro/business-uri" },
            { "@type": "ListItem", "position": 3, "name": business.name }
          ]
        }
      ],
    });
  } catch (err) {
    console.error("[Web] Business detail error:", err);
    res.status(500).send("Eroare la încărcarea business-ului");
  }
});

// ═══════════════════════════════════════════════════════
// AUTH (extracted to web-auth.js)
// ═══════════════════════════════════════════════════════
router.use(require("./web-auth"));

// ═══════════════════════════════════════════════════════
// CATEGORIES PAGE
// ═══════════════════════════════════════════════════════
router.get("/categorii", async (req, res) => {
  try {
    const categories = await pool.query(`
      SELECT c.id, c.name, COUNT(DISTINCT o.id) as offer_count
      FROM categories c
      LEFT JOIN businesses b ON b.category_id = c.id
      LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
      GROUP BY c.id, c.name
      ORDER BY c.name
    `);

    res.render("public/categorii", {
      categories: categories.rows,
      activePage: "categorii",
      webUser: req.webUser,
      pageTitle: 'Categorii',
      pageDesc: 'Explorează oferte pe categorii: restaurante, beauty, fitness, fashion, electronice și multe altele pe OFAI.',
      canonicalUrl: 'https://ofai.ro/categorii',
      structuredData: {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Acasă", "item": "https://ofai.ro" },
          { "@type": "ListItem", "position": 2, "name": "Categorii", "item": "https://ofai.ro/categorii" }
        ]
      },
    });
  } catch (err) {
    console.error("[Web] Categories error:", err);
    res.status(500).send("Eroare la încărcarea categoriilor");
  }
});

// ═══════════════════════════════════════════════════════
// CITIES PAGE
// ═══════════════════════════════════════════════════════
router.get("/orase", async (req, res) => {
  try {
    const cities = await pool.query(`
      SELECT c.id, c.name, COUNT(b.id) as business_count
      FROM cities c
      LEFT JOIN businesses b ON b.city_id = c.id
      GROUP BY c.id, c.name
      ORDER BY business_count DESC, c.name
    `);

    res.render("public/orase", {
      cities: cities.rows,
      activePage: "orase",
      webUser: req.webUser,
      pageTitle: 'Orașe',
      pageDesc: 'Oferte și reduceri în toate orașele din România. Alege orașul tău și descoperă cele mai bune deal-uri locale pe OFAI.',
      canonicalUrl: 'https://ofai.ro/orase',
      structuredData: {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Acasă", "item": "https://ofai.ro" },
          { "@type": "ListItem", "position": 2, "name": "Orașe", "item": "https://ofai.ro/orase" }
        ]
      },
    });
  } catch (err) {
    console.error("[Web] Cities error:", err);
    res.status(500).send("Eroare la încărcarea orașelor");
  }
});

// ═══════════════════════════════════════════════════════
// ACCOUNT PAGES (require auth)
// ═══════════════════════════════════════════════════════
router.get("/cont", requireWebAuth, async (req, res) => {
  try {
    const [pointsRes, favCount, followCount, reviewCount, bizReqRes, userDetails, userBizCount] = await Promise.all([
      pool.query("SELECT total_points FROM user_points WHERE user_id = $1", [req.webUser.id]),
      pool.query("SELECT COUNT(*) as total FROM favorite_offers WHERE user_id = $1", [req.webUser.id]),
      pool.query("SELECT COUNT(*) as total FROM followed_businesses WHERE user_id = $1", [req.webUser.id]),
      pool.query("SELECT COUNT(*) as total FROM reviews WHERE user_id = $1", [req.webUser.id]),
      pool.query("SELECT status, name FROM business_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [req.webUser.id]),
      pool.query("SELECT last_profile_edit FROM users WHERE id = $1", [req.webUser.id]),
      pool.query("SELECT COUNT(*) as total FROM user_businesses WHERE user_id = $1", [req.webUser.id]),
    ]);

    const userPoints = pointsRes.rows[0]?.total_points || 0;
    const bizRequest = bizReqRes.rows[0] || null;
    const lastProfileEdit = userDetails.rows[0]?.last_profile_edit || null;
    const hasBusinesses = parseInt(userBizCount.rows[0].total) > 0;

    res.render("public/account", {
      activePage: "cont",
      noIndex: true,
      webUser: req.webUser,
      userPoints,
      favCount: parseInt(favCount.rows[0].total),
      followCount: parseInt(followCount.rows[0].total),
      reviewCount: parseInt(reviewCount.rows[0].total),
      bizRequest,
      lastProfileEdit,
      hasBusinesses,
    });
  } catch (err) {
    console.error("[Web] Account error:", err);
    res.status(500).send("Eroare la încărcarea contului");
  }
});

router.get("/colectia-mea", requireWebAuth, async (req, res) => {
  try {
    const sort = req.query.sort || "recent";
    const selectedCategory = req.query.category ? parseInt(req.query.category) : null;

    // Sort for favorites (offers)
    let favoritesOrderBy = "f.created_at DESC";
    if (sort === "rating") favoritesOrderBy = "rating_avg DESC";
    else if (sort === "discount") favoritesOrderBy = "o.discount_value DESC";
    else if (sort === "ending_soon") favoritesOrderBy = "o.end_date ASC";
    // distance handled client-side

    const favParams = [req.webUser.id];
    let favCategoryFilter = "";
    if (selectedCategory) {
      favParams.push(selectedCategory);
      favCategoryFilter = `AND b.category_id = $${favParams.length}`;
    }

    const favoritesRes = await pool.query(`
      SELECT o.id, o.title, o.discount_type, o.discount_value, o.end_date,
             b.name as business_name, b.logo_url as business_logo,
             b.cover_image_url as business_cover, b.lat, b.lng,
             COALESCE(o.logo_url, b.cover_image_url, b.logo_url) as image_url,
             ci.name as city_name, cat.name as category_name,
             COALESCE(AVG(r.rating), 0) as rating_avg
      FROM favorite_offers f
      JOIN offers o ON o.id = f.offer_id
      JOIN businesses b ON b.id = o.business_id
      LEFT JOIN cities ci ON ci.id = b.city_id
      LEFT JOIN categories cat ON cat.id = b.category_id
      LEFT JOIN reviews r ON r.business_id = b.id
      WHERE f.user_id = $1 ${favCategoryFilter}
      GROUP BY o.id, o.title, o.discount_type, o.discount_value, o.end_date,
               b.name, b.logo_url, b.cover_image_url, b.lat, b.lng,
               ci.name, cat.name, f.created_at
      ORDER BY ${favoritesOrderBy}
    `, favParams);

    // Sort for subscriptions (businesses)
    let subscriptionsOrderBy = "MAX(f.created_at) DESC";
    if (sort === "rating") subscriptionsOrderBy = "rating_avg DESC";
    else if (sort === "offers") subscriptionsOrderBy = "active_offers_count DESC";
    // distance handled client-side

    const subParams = [req.webUser.id];
    let subCategoryFilter = "";
    if (selectedCategory) {
      subParams.push(selectedCategory);
      subCategoryFilter = `AND b.category_id = $${subParams.length}`;
    }

    const subscriptionsRes = await pool.query(`
      SELECT b.id, b.name, b.logo_url, b.cover_image_url, b.lat, b.lng,
             c.name as city_name, cat.name as category_name,
             COUNT(DISTINCT o.id) as active_offers_count,
             COALESCE(AVG(rev.rating), 0) as rating_avg
      FROM followed_businesses f
      JOIN businesses b ON b.id = f.business_id
      LEFT JOIN cities c ON c.id = b.city_id
      LEFT JOIN categories cat ON cat.id = b.category_id
      LEFT JOIN offers o ON o.business_id = b.id AND o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
      LEFT JOIN reviews rev ON rev.business_id = b.id
      WHERE f.user_id = $1 ${subCategoryFilter}
      GROUP BY b.id, b.name, b.logo_url, b.cover_image_url, b.lat, b.lng, c.name, cat.name
      ORDER BY ${subscriptionsOrderBy}
    `, subParams);

    // Categories present in user's collection (for filter pills)
    const categoriesRes = await pool.query(`
      SELECT DISTINCT cat.id, cat.name FROM categories cat WHERE cat.id IN (
        SELECT b.category_id FROM followed_businesses fb
        JOIN businesses b ON b.id = fb.business_id WHERE fb.user_id = $1
        UNION
        SELECT b2.category_id FROM favorite_offers fo
        JOIN offers o ON o.id = fo.offer_id
        JOIN businesses b2 ON b2.id = o.business_id WHERE fo.user_id = $1
      ) ORDER BY cat.name
    `, [req.webUser.id]);

    // All items on collection page are favorited/followed by definition
    const userFavoriteIds = favoritesRes.rows.map(r => r.id);
    const userFollowedIds = subscriptionsRes.rows.map(r => r.id);

    res.render("public/colectia-mea", {
      noIndex: true,
      favorites: favoritesRes.rows,
      subscriptions: subscriptionsRes.rows,
      categories: categoriesRes.rows,
      selectedCategory,
      sort,
      userFavoriteIds,
      userFollowedIds,
      activePage: "colectie",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Collection error:", err);
    res.status(500).send("Eroare la încărcarea colecției");
  }
});

router.get("/setari", requireWebAuth, async (req, res) => {
  try {
    const { getUserBadges, getAllBadgeDefinitions } = require("../services/badgeService");

    const [userRes, userBadges, allBadges] = await Promise.all([
      pool.query(
        "SELECT show_picture_in_reviews, google_id FROM users WHERE id = $1",
        [req.webUser.id]
      ),
      getUserBadges(req.webUser.id).catch(err => {
        console.error("[Web] Badges fetch error:", err.message);
        return [];
      }),
      getAllBadgeDefinitions().catch(err => {
        console.error("[Web] All badges fetch error:", err.message);
        return [];
      }),
    ]);

    const userSettings = userRes.rows[0] || {};

    res.render("public/setari", {
      activePage: "setari",
      noIndex: true,
      webUser: req.webUser,
      showPictureInReviews: userSettings.show_picture_in_reviews !== false,
      isGoogleUser: !!userSettings.google_id,
      userBadges,
      allBadges,
    });
  } catch (err) {
    console.error("[Web] Settings error:", err);
    res.status(500).send("Eroare la încărcarea setărilor");
  }
});

router.get("/preferinte", requireWebAuth, async (req, res) => {
  try {
    const userRes = await pool.query(
      "SELECT preferred_city_ids, preferred_category_ids FROM users WHERE id = $1",
      [req.webUser.id]
    );
    const cities = await pool.query("SELECT id, name FROM cities ORDER BY name");
    const categories = await pool.query("SELECT id, name FROM categories ORDER BY name");

    const prefs = userRes.rows[0] || {};

    res.render("public/preferinte", {
      activePage: "preferinte",
      noIndex: true,
      webUser: req.webUser,
      cities: cities.rows,
      categories: categories.rows,
      preferredCityIds: prefs.preferred_city_ids || [],
      preferredCategoryIds: prefs.preferred_category_ids || [],
    });
  } catch (err) {
    console.error("[Web] Preferences error:", err);
    res.status(500).send("Eroare la încărcarea preferințelor");
  }
});

// GET /onboarding — Post-registration preference selection
router.get("/onboarding", requireWebAuth, async (req, res) => {
  try {
    const cities = await pool.query("SELECT id, name FROM cities ORDER BY name");
    const categories = await pool.query("SELECT id, name FROM categories ORDER BY name");

    res.render("public/onboarding", {
      activePage: null,
      webUser: req.webUser,
      cities: cities.rows,
      categories: categories.rows,
      loadOnboardingCss: true,
    });
  } catch (err) {
    console.error("[Web] Onboarding error:", err);
    res.redirect("/cont");
  }
});

// ═══════════════════════════════════════════════════════
// BUSINESS PORTAL WEB PAGES
// ═══════════════════════════════════════════════════════

// Attach tier info for all portal routes that carry a :businessId param
router.use('/api/web/portal/:businessId', attachTier());

// ── Tools ──
router.get("/tools/svg-to-png", requireWebAuth, (req, res) => {
  res.render("public/tools/svg-to-png", {
    pageTitle: "SVG → PNG Converter",
    activePage: "portal",
    webUser: req.webUser,
    noIndex: true,
  });
});

router.get("/tools/qr-code", requireWebAuth, (req, res) => {
  res.render("public/tools/qr-code", {
    pageTitle: "Generator QR Code",
    activePage: "portal",
    webUser: req.webUser,
    noIndex: true,
    prefillUrl: req.query.url || '',
  });
});

// Portal Dashboard — lista de business-uri
router.get("/portal", requireWebAuth, async (req, res) => {
  try {
    if (req.webUser.role !== "admin" && req.webUser.role !== "business_owner") {
      return res.redirect("/cont");
    }

    let businesses;
    if (req.webUser.role === "admin") {
      businesses = await pool.query(`
        SELECT b.id, b.name, b.logo_url, b.cover_image_url,
               c.name as city_name, cat.name as category_name,
               sp.slug as plan_slug, sp.name as plan_name,
               COALESCE(ao.cnt, 0) as active_offers
        FROM businesses b
        LEFT JOIN cities c ON b.city_id = c.id
        LEFT JOIN categories cat ON b.category_id = cat.id
        LEFT JOIN business_subscriptions bs ON bs.business_id = b.id
        LEFT JOIN subscription_plans sp ON sp.id = bs.plan_id
        LEFT JOIN (SELECT business_id, COUNT(*) as cnt FROM offers WHERE is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE) GROUP BY business_id) ao ON ao.business_id = b.id
        ORDER BY b.name
      `);
    } else {
      businesses = await pool.query(`
        SELECT b.id, b.name, b.logo_url, b.cover_image_url,
               c.name as city_name, cat.name as category_name,
               sp.slug as plan_slug, sp.name as plan_name,
               COALESCE(ao.cnt, 0) as active_offers
        FROM businesses b
        JOIN user_businesses ub ON ub.business_id = b.id AND ub.user_id = $1
        LEFT JOIN cities c ON b.city_id = c.id
        LEFT JOIN categories cat ON b.category_id = cat.id
        LEFT JOIN business_subscriptions bs ON bs.business_id = b.id
        LEFT JOIN subscription_plans sp ON sp.id = bs.plan_id
        LEFT JOIN (SELECT business_id, COUNT(*) as cnt FROM offers WHERE is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE) GROUP BY business_id) ao ON ao.business_id = b.id
        ORDER BY b.name
      `, [req.webUser.id]);
    }

    res.render("public/portal/dashboard", {
      businesses: businesses.rows,
      activePage: "portal",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Portal dashboard error:", err);
    res.status(500).send("Eroare la încărcarea portalului");
  }
});

// Portal — manage business page (tabs: Info / Oferte / Recenzii / Statistici)
router.get("/portal/:businessId", requireBusinessOwner, attachTier(), async (req, res) => {
  try {
    const { businessId } = req.params;

    // Business details
    const bizRes = await pool.query(`
      SELECT b.id, b.name, b.description, b.address, b.phone, b.website, b.lat, b.lng,
             b.logo_url, b.cover_image_url,
             b.booking_type, b.booking_phone, b.booking_whatsapp, b.booking_url, b.booking_instructions,
             b.city_id, c.name as city_name, b.category_id, cat.name as category_name,
             b.competitor_blocking_enabled
      FROM businesses b
      LEFT JOIN cities c ON b.city_id = c.id
      LEFT JOIN categories cat ON b.category_id = cat.id
      WHERE b.id = $1
    `, [businessId]);

    if (bizRes.rows.length === 0) {
      return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });
    }

    const business = bizRes.rows[0];

    // Gallery images
    const imagesRes = await pool.query(
      "SELECT id, image_url, sort_order FROM business_images WHERE business_id = $1 ORDER BY sort_order, id",
      [businessId]
    );
    business.images = imagesRes.rows.map(img => ({
      id: img.id,
      url: img.image_url,
      sort_order: img.sort_order
    }));

    // Offers
    const offersRes = await pool.query(`
      SELECT id, title, discount_type, discount_value, start_date, end_date, is_active, logo_url, moderation_status, rejection_reason
      FROM offers WHERE business_id = $1 ORDER BY id DESC
    `, [businessId]);

    // Reviews (first 20 with responses)
    const reviewsRes = await pool.query(`
      SELECT r.id, r.rating, r.comment, r.created_at,
             u.first_name, u.last_name,
             rr.id as response_id, rr.response_text, rr.created_at as response_date
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN review_responses rr ON rr.review_id = r.id
      WHERE r.business_id = $1
      ORDER BY r.created_at DESC
      LIMIT 50
    `, [businessId]);

    const reviewCountRes = await pool.query("SELECT COUNT(*) as total FROM reviews WHERE business_id = $1", [businessId]);
    const reviewCount = parseInt(reviewCountRes.rows[0].total);

    // Analytics
    const [viewsRes, subscribersRes, reviewStatsRes, offerStatsRes, ratingRes, offerViewsRes, offerRequestsRes, codeRevealsRes, clicksRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total_views,
                  COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '7 days') as views_7d,
                  COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '30 days') as views_30d,
                  COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '14 days' AND viewed_at < NOW() - INTERVAL '7 days') as views_prev_7d
                  FROM business_views WHERE business_id = $1`, [businessId]),
      pool.query("SELECT COUNT(*) as total FROM followed_businesses WHERE business_id = $1", [businessId]),
      pool.query("SELECT COUNT(*) as total, COALESCE(AVG(rating), 0) as avg_rating FROM reviews WHERE business_id = $1", [businessId]),
      pool.query(`SELECT COUNT(*) as total,
                  COUNT(*) FILTER (WHERE is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)) as active
                  FROM offers WHERE business_id = $1`, [businessId]),
      pool.query("SELECT rating, COUNT(*) as count FROM reviews WHERE business_id = $1 GROUP BY rating ORDER BY rating DESC", [businessId]),
      pool.query(`SELECT COALESCE(COUNT(*), 0) as total FROM offer_views
                  WHERE business_id = $1 AND viewed_at >= NOW() - INTERVAL '30 days'`, [businessId]),
      pool.query(`SELECT COUNT(*) as total_requests,
                  COUNT(DISTINCT user_id) as unique_requesters,
                  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as requests_7d,
                  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as requests_30d
                  FROM offer_requests WHERE business_id = $1`, [businessId]),
      pool.query(`SELECT COUNT(*) as total,
                  COUNT(*) FILTER (WHERE revealed_at >= NOW() - INTERVAL '30 days') as last_30d
                  FROM code_reveals cr JOIN offers o ON cr.offer_id = o.id WHERE o.business_id = $1`, [businessId]),
      pool.query(`SELECT action_type, COUNT(*) as total,
                  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as last_30d
                  FROM business_clicks WHERE business_id = $1
                  GROUP BY action_type ORDER BY total DESC`, [businessId]),
    ]);

    const distribution = [5, 4, 3, 2, 1].map(star => {
      const found = ratingRes.rows.find(r => parseInt(r.rating) === star);
      return { rating: star, count: parseInt(found?.count || 0) };
    });

    const offerRequestStats = offerRequestsRes.rows[0];
    const codeRevealStats = codeRevealsRes.rows[0];

    const clicksBreakdown = clicksRes.rows.map(r => ({
      action: r.action_type,
      total: parseInt(r.total) || 0,
      last30d: parseInt(r.last_30d) || 0,
    }));
    const clicksTotal = clicksBreakdown.reduce((sum, c) => sum + c.total, 0);
    const clicksLast30d = clicksBreakdown.reduce((sum, c) => sum + c.last30d, 0);

    const analytics = {
      views: {
        total: parseInt(viewsRes.rows[0].total_views) || 0,
        last_7d: parseInt(viewsRes.rows[0].views_7d) || 0,
        last_30d: parseInt(viewsRes.rows[0].views_30d) || 0,
        prev_7d: parseInt(viewsRes.rows[0].views_prev_7d) || 0,
      },
      subscribers: parseInt(subscribersRes.rows[0].total) || 0,
      reviews: {
        total: parseInt(reviewStatsRes.rows[0].total) || 0,
        avg_rating: parseFloat(parseFloat(reviewStatsRes.rows[0].avg_rating).toFixed(1)),
        distribution,
      },
      offers: {
        total: parseInt(offerStatsRes.rows[0].total) || 0,
        active: parseInt(offerStatsRes.rows[0].active) || 0,
        total_views_30d: parseInt(offerViewsRes.rows[0].total) || 0,
      },
      offerRequests: {
        total: parseInt(offerRequestStats.total_requests) || 0,
        uniqueRequesters: parseInt(offerRequestStats.unique_requesters) || 0,
        last7d: parseInt(offerRequestStats.requests_7d) || 0,
        last30d: parseInt(offerRequestStats.requests_30d) || 0,
      },
      codeReveals: {
        total: parseInt(codeRevealStats.total) || 0,
        last30d: parseInt(codeRevealStats.last_30d) || 0,
      },
      clicks: {
        total: clicksTotal,
        last30d: clicksLast30d,
        breakdown: clicksBreakdown,
      },
    };

    // Performance Score
    const [scoreImgRes, scoreOffRes, scoreRevRes, scoreRespRes, scoreSubRes] = await Promise.all([
      pool.query("SELECT COUNT(*) as cnt FROM business_images WHERE business_id = $1", [businessId]),
      pool.query("SELECT COUNT(*) as cnt FROM offers WHERE business_id = $1 AND is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)", [businessId]),
      pool.query("SELECT COUNT(*) as total, COALESCE(AVG(rating), 0) as avg_rating FROM reviews WHERE business_id = $1", [businessId]),
      pool.query(`SELECT (SELECT COUNT(*) FROM reviews WHERE business_id = $1) as total_reviews,
                         (SELECT COUNT(*) FROM review_responses WHERE business_id = $1) as total_responses`, [businessId]),
      pool.query("SELECT COUNT(*) as cnt FROM followed_businesses WHERE business_id = $1", [businessId]),
    ]);

    const activeOffers = parseInt(scoreOffRes.rows[0].cnt);
    const totalReviews = parseInt(scoreRevRes.rows[0].total);
    const avgRating = parseFloat(scoreRevRes.rows[0].avg_rating);
    const totalResponses = parseInt(scoreRespRes.rows[0].total_responses);
    const totalReviewsForResp = parseInt(scoreRespRes.rows[0].total_reviews);
    const subscribers = parseInt(scoreSubRes.rows[0].cnt);
    const responseRate = totalReviewsForResp > 0 ? totalResponses / totalReviewsForResp : 0;

    const breakdown = [
      { criterion: "Logo", points: 10, earned: business.logo_url ? 10 : 0, completed: !!business.logo_url, tip: !business.logo_url ? "Adaugă un logo" : null },
      { criterion: "Cover", points: 15, earned: business.cover_image_url ? 15 : 0, completed: !!business.cover_image_url, tip: !business.cover_image_url ? "Adaugă o imagine de cover" : null },
      { criterion: "Telefon", points: 5, earned: business.phone ? 5 : 0, completed: !!business.phone, tip: !business.phone ? "Completează telefonul" : null },
      { criterion: "Website", points: 5, earned: business.website ? 5 : 0, completed: !!business.website, tip: !business.website ? "Adaugă un website" : null },
      { criterion: "Rezervări", points: 10, earned: (business.booking_type && business.booking_type !== "none") ? 10 : 0, completed: !!(business.booking_type && business.booking_type !== "none"), tip: (!business.booking_type || business.booking_type === "none") ? "Configurează rezervările" : null },
      { criterion: "Ofertă activă", points: 15, earned: activeOffers > 0 ? 15 : 0, completed: activeOffers > 0, tip: activeOffers === 0 ? "Creează o ofertă activă" : null },
      { criterion: "Rating ≥ 4.0", points: 10, earned: avgRating >= 4.0 ? 10 : 0, completed: avgRating >= 4.0, tip: avgRating < 4.0 ? "Îmbunătățește experiența clienților" : null },
      { criterion: "5+ recenzii", points: 10, earned: totalReviews >= 5 ? 10 : 0, completed: totalReviews >= 5, tip: totalReviews < 5 ? "Mai ai nevoie de " + (5 - totalReviews) + " recenzii" : null },
      { criterion: "80%+ răspunsuri", points: 10, earned: responseRate >= 0.8 ? 10 : 0, completed: responseRate >= 0.8, tip: responseRate < 0.8 ? "Răspunde la recenzii" : null },
      { criterion: "10+ abonați", points: 10, earned: subscribers >= 10 ? 10 : 0, completed: subscribers >= 10, tip: subscribers < 10 ? "Mai ai nevoie de " + (10 - subscribers) + " abonați" : null },
    ];
    const totalScore = breakdown.reduce((sum, item) => sum + item.earned, 0);
    const score = { score: totalScore, max_score: 100, breakdown };

    // Cities, categories & locations for edit form
    const [citiesRes, categoriesRes, locationsRes] = await Promise.all([
      pool.query("SELECT id, name FROM cities ORDER BY name"),
      pool.query("SELECT id, name FROM categories ORDER BY name"),
      pool.query(
        `SELECT bl.id, bl.address, bl.phone, bl.lat, bl.lng, bl.maps_url, bl.city_id,
                c.name AS city_name
         FROM business_locations bl
         LEFT JOIN cities c ON bl.city_id = c.id
         WHERE bl.business_id = $1
         ORDER BY bl.id`,
        [businessId]
      ),
    ]);

    // Fetch active nominations for this business (for Deal of the Day feature)
    let nominations = [];
    let canNominate = true;
    let nextNominationAt = null;
    try {
      const nomResult = await pool.query(`
        SELECT dn.id, dn.offer_id, dn.status, dn.selected_for_date, dn.nominated_at
        FROM deal_nominations dn
        WHERE dn.business_id = $1
          AND dn.status IN ('pending', 'selected')
        ORDER BY dn.nominated_at DESC
      `, [businessId]);
      nominations = nomResult.rows;

      const lastNom = await pool.query(`
        SELECT nominated_at FROM deal_nominations
        WHERE business_id = $1
          AND nominated_at > NOW() - INTERVAL '7 days'
          AND status IN ('pending', 'selected')
        ORDER BY nominated_at DESC
        LIMIT 1
      `, [businessId]);
      if (lastNom.rows.length > 0) {
        canNominate = false;
        const next = new Date(lastNom.rows[0].nominated_at);
        next.setDate(next.getDate() + 7);
        nextNominationAt = next.toISOString();
      }
    } catch (e) { /* nominations are non-critical */ }

    res.render("public/portal/manage", {
      business,
      offers: offersRes.rows,
      reviews: reviewsRes.rows,
      reviewCount,
      analytics,
      score,
      cities: citiesRes.rows,
      categories: categoriesRes.rows,
      locations: locationsRes.rows,
      activePage: "portal",
      webUser: req.webUser,
      loadChartJs: true,
      loadPortalCss: true,
      tier: req.tier || { tier: 'free', plan: {} },
      nominations,
      canNominate,
      nextNominationAt,
      competitorBlockingEnabled: business.competitor_blocking_enabled,
    });
  } catch (err) {
    console.error("[Web] Portal manage error:", err);
    res.status(500).send("Eroare la încărcarea paginii de management");
  }
});

// Portal — new offer form
router.get("/portal/:businessId/oferta-noua", requireBusinessOwner, attachTier(), async (req, res) => {
  try {
    const { businessId } = req.params;
    const [bizRes, locsRes] = await Promise.all([
      pool.query(
        `SELECT b.id, b.name, b.logo_url, b.cover_image_url,
                c.name AS city_name, cat.name AS category_name
         FROM businesses b
         LEFT JOIN cities c ON b.city_id = c.id
         LEFT JOIN categories cat ON b.category_id = cat.id
         WHERE b.id = $1`,
        [businessId]
      ),
      pool.query(
        `SELECT bl.id, bl.address, c.name AS city_name
         FROM business_locations bl LEFT JOIN cities c ON bl.city_id = c.id
         WHERE bl.business_id = $1 ORDER BY bl.id`,
        [businessId]
      ),
    ]);
    if (bizRes.rows.length === 0) return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });

    res.render("public/portal/offer-form", {
      business: bizRes.rows[0],
      offer: null,
      locations: locsRes.rows,
      selectedLocationIds: [],
      tier: req.tier || { tier: 'free', plan: {} },
      activePage: "portal",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Portal new offer error:", err);
    res.status(500).send("Eroare");
  }
});

// Portal — edit offer form
router.get("/portal/:businessId/oferta/:offerId", requireBusinessOwner, attachTier(), async (req, res) => {
  try {
    const { businessId, offerId } = req.params;
    const bizRes = await pool.query(
      `SELECT b.id, b.name, b.logo_url, b.cover_image_url,
              c.name AS city_name, cat.name AS category_name
       FROM businesses b
       LEFT JOIN cities c ON b.city_id = c.id
       LEFT JOIN categories cat ON b.category_id = cat.id
       WHERE b.id = $1`,
      [businessId]
    );
    if (bizRes.rows.length === 0) return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });

    const [offerRes, promoCodesRes, locsRes, offerLocsRes] = await Promise.all([
      pool.query(
        "SELECT id, title, description, discount_type, discount_value, conditions, start_date, end_date, is_active, logo_url, booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions, promo_code, moderation_status, rejection_reason, redemption_method FROM offers WHERE id = $1 AND business_id = $2",
        [offerId, businessId]
      ),
      pool.query(
        "SELECT id, code, is_active FROM promo_codes WHERE offer_id = $1 ORDER BY id",
        [offerId]
      ),
      pool.query(
        `SELECT bl.id, bl.address, c.name AS city_name
         FROM business_locations bl LEFT JOIN cities c ON bl.city_id = c.id
         WHERE bl.business_id = $1 ORDER BY bl.id`,
        [businessId]
      ),
      pool.query(
        "SELECT location_id FROM offer_locations WHERE offer_id = $1",
        [offerId]
      ),
    ]);

    if (offerRes.rows.length === 0) return res.status(404).render("public/404", { activePage: null, webUser: req.webUser });

    res.render("public/portal/offer-form", {
      business: bizRes.rows[0],
      offer: offerRes.rows[0],
      promoCodes: promoCodesRes.rows,
      locations: locsRes.rows,
      selectedLocationIds: offerLocsRes.rows.map(r => r.location_id),
      tier: req.tier || { tier: 'free', plan: {} },
      activePage: "portal",
      webUser: req.webUser,
    });
  } catch (err) {
    console.error("[Web] Portal edit offer error:", err);
    res.status(500).send("Eroare");
  }
});

// ═══════════════════════════════════════════════════════
// PORTAL API (extracted to web-portal-api.js)
// ═══════════════════════════════════════════════════════
router.use(require("./web-portal-api"));

// ═══════════════════════════════════════════════════════
// BLOG
// ═══════════════════════════════════════════════════════

router.get("/blog", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 12;
    const offset = (page - 1) * limit;
    const rawCategory = req.query.categorie || null;
    const categorySlug = rawCategory && /^[a-z0-9-]+$/.test(rawCategory) ? rawCategory : null;

    const cacheKey = `blog:list:${categorySlug || 'all'}:p${page}`;
    const data = await cache.cached(cacheKey, 15 * 60 * 1000, async () => {
      const categoryFilter = categorySlug
        ? `AND bc.slug = $3`
        : '';
      const countCategoryFilter = categorySlug
        ? `AND bc.slug = $1`
        : '';
      const params = categorySlug
        ? [limit, offset, categorySlug]
        : [limit, offset];

      const [postsResult, countResult, categoriesResult] = await Promise.all([
        pool.query(`
          SELECT bp.*, bc.name AS category_name, bc.slug AS category_slug
          FROM blog_posts bp
          LEFT JOIN blog_categories bc ON bc.id = bp.category_id
          WHERE bp.is_published = TRUE ${categoryFilter}
          ORDER BY bp.published_at DESC
          LIMIT $1 OFFSET $2
        `, params),
        pool.query(`
          SELECT COUNT(*)::int AS cnt
          FROM blog_posts bp
          LEFT JOIN blog_categories bc ON bc.id = bp.category_id
          WHERE bp.is_published = TRUE ${countCategoryFilter}
        `, categorySlug ? [categorySlug] : []),
        pool.query('SELECT id, name, slug FROM blog_categories ORDER BY sort_order'),
      ]);

      return {
        posts: postsResult.rows,
        total: countResult.rows[0].cnt,
        categories: categoriesResult.rows,
      };
    }, { groups: ['blog'] });

    const totalPages = Math.ceil(data.total / limit);

    res.render("public/blog", {
      activePage: 'blog',
      webUser: req.webUser,
      posts: data.posts,
      categories: data.categories,
      currentCategory: categorySlug,
      pagination: { page, limit, total: data.total, totalPages },
      pageTitle: categorySlug ? `Blog — ${data.categories.find(c => c.slug === categorySlug)?.name || 'Articole'}` : 'Blog',
      pageDesc: 'Articole, ghiduri și noutăți despre reduceri, oferte și business-uri locale din România.',
      canonicalUrl: 'https://ofai.ro/blog' + (categorySlug ? `?categorie=${categorySlug}` : '') + (page > 1 ? (categorySlug ? `&page=${page}` : `?page=${page}`) : ''),
      ogTitle: categorySlug ? `Blog — ${data.categories.find(c => c.slug === categorySlug)?.name || 'Articole'} | OFAI` : 'Blog OFAI — Articole & Ghiduri',
      ogDesc: 'Articole, ghiduri și noutăți despre reduceri, oferte și business-uri locale din România.',
      ogUrl: 'https://ofai.ro/blog' + (categorySlug ? `?categorie=${categorySlug}` : ''),
      seoPage: page,
      seoTotalPages: totalPages,
      seoBaseUrl: 'https://ofai.ro/blog' + (categorySlug ? `?categorie=${categorySlug}` : ''),
      loadBlogCss: true,
    });
  } catch (err) {
    console.error('[Blog] List error:', err.message);
    res.status(500).render("public/500", { pageTitle: 'Eroare', activePage: null, webUser: req.webUser || null });
  }
});

router.get("/blog/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(404).render("public/404", { activePage: null, webUser: req.webUser || null });
    }

    const cacheKey = `blog:post:${slug}`;
    const post = await cache.cached(cacheKey, 30 * 60 * 1000, async () => {
      const { rows } = await pool.query(`
        SELECT bp.*, bc.name AS category_name, bc.slug AS category_slug
        FROM blog_posts bp
        LEFT JOIN blog_categories bc ON bc.id = bp.category_id
        WHERE bp.slug = $1 AND bp.is_published = TRUE
      `, [slug]);
      return rows[0] || null;
    }, { groups: ['blog'] });

    if (!post) {
      return res.status(404).render("public/404", { activePage: null, webUser: req.webUser || null });
    }

    // Increment view count (fire-and-forget, outside cache)
    pool.query('UPDATE blog_posts SET view_count = view_count + 1 WHERE id = $1', [post.id]).catch(() => {});

    // Related posts (same category, exclude current)
    const related = await cache.cached(`blog:related:${post.id}`, 30 * 60 * 1000, async () => {
      const { rows } = await pool.query(`
        SELECT bp.id, bp.slug, bp.title, bp.excerpt, bp.image_url, bp.published_at,
               bc.name AS category_name, bc.slug AS category_slug
        FROM blog_posts bp
        LEFT JOIN blog_categories bc ON bc.id = bp.category_id
        WHERE bp.is_published = TRUE AND bp.id != $1
          AND ($2::int IS NULL OR bp.category_id = $2)
        ORDER BY bp.published_at DESC LIMIT 3
      `, [post.id, post.category_id]);
      return rows;
    }, { groups: ['blog'] });

    const structuredData = [{
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.excerpt || post.meta_description || '',
      author: { '@type': 'Person', name: post.author_name || 'Echipa OFAI' },
      datePublished: post.published_at?.toISOString(),
      dateModified: post.updated_at?.toISOString(),
      publisher: { '@type': 'Organization', name: 'OFAI', url: 'https://ofai.ro', logo: { '@type': 'ImageObject', url: 'https://ofai.ro/images/ofai-favicon.png' } },
      mainEntityOfPage: `https://ofai.ro/blog/${post.slug}`,
      ...(post.image_url ? { image: post.image_url } : {}),
    }, {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Acasă', item: 'https://ofai.ro' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://ofai.ro/blog' },
        { '@type': 'ListItem', position: 3, name: post.title, item: `https://ofai.ro/blog/${post.slug}` },
      ]
    }];

    res.render("public/blog-post", {
      activePage: 'blog',
      webUser: req.webUser,
      post,
      related,
      pageTitle: post.meta_title || post.title,
      pageDesc: post.meta_description || post.excerpt || '',
      canonicalUrl: `https://ofai.ro/blog/${post.slug}`,
      ogTitle: post.meta_title || post.title,
      ogDesc: post.meta_description || post.excerpt || '',
      ogImage: post.image_url || null,
      ogType: 'article',
      structuredData,
      loadBlogCss: true,
    });
  } catch (err) {
    console.error('[Blog] Post error:', err.message);
    res.status(500).render("public/500", { pageTitle: 'Eroare', activePage: null, webUser: req.webUser || null });
  }
});

// ═══════════════════════════════════════════════════════
// STATIC / LEGAL PAGES
// ═══════════════════════════════════════════════════════
router.get("/termeni", (req, res) => {
  res.render("public/termeni", { activePage: null, webUser: req.webUser, pageTitle: 'Termeni și Condiții', pageDesc: 'Termenii și condițiile de utilizare ale platformei OFAI.', canonicalUrl: 'https://ofai.ro/termeni' });
});

router.get("/confidentialitate", (req, res) => {
  res.render("public/confidentialitate", { activePage: null, webUser: req.webUser, pageTitle: 'Politica de Confidențialitate', pageDesc: 'Politica de confidențialitate și protecția datelor personale pe OFAI.', canonicalUrl: 'https://ofai.ro/confidentialitate' });
});

router.get("/ajutor", (req, res) => {
  res.render("public/ajutor", { activePage: null, webUser: req.webUser, pageTitle: 'Ajutor', pageDesc: 'Întrebări frecvente și ghiduri de utilizare pentru platforma OFAI.', canonicalUrl: 'https://ofai.ro/ajutor' });
});

router.get("/pentru-business", async (req, res) => {
  try {
    const [citiesResult, categoriesResult] = await Promise.all([
      pool.query("SELECT id, name FROM cities ORDER BY name"),
      pool.query("SELECT id, name FROM categories ORDER BY name"),
    ]);
    res.render("public/pentru-business", {
      activePage: null,
      webUser: req.webUser,
      cities: citiesResult.rows,
      categories: categoriesResult.rows,
      pageTitle: 'Pentru Business',
      pageDesc: 'Înscrie-ți business-ul pe OFAI și ajunge la mii de clienți noi. Publică oferte, gestionează recenzii și crește-ți vizibilitatea.',
      canonicalUrl: 'https://ofai.ro/pentru-business',
    });
  } catch (err) {
    console.error("[Web] Pentru-business error:", err.message);
    res.render("public/pentru-business", {
      activePage: null,
      webUser: req.webUser,
      cities: [],
      categories: [],
      pageTitle: 'Pentru Business',
      pageDesc: 'Înscrie-ți business-ul pe OFAI și ajunge la mii de clienți noi.',
      canonicalUrl: 'https://ofai.ro/pentru-business',
    });
  }
});

// ═══════════════════════════════════════════════════════
// REFERRAL REDIRECT
// ═══════════════════════════════════════════════════════
router.get("/r/:code", (req, res) => {
  res.redirect(302, `/register?ref=${encodeURIComponent(req.params.code)}`);
});

// ═══════════════════════════════════════════════════════
// ACCOUNT API (extracted to web-account-api.js)
// ═══════════════════════════════════════════════════════
router.use(require("./web-account-api"));

// ═══════════════════════════════════════════════════════
// PRICING PAGE
// ═══════════════════════════════════════════════════════
router.get('/preturi', async (req, res) => {
  try {
    const { rows: plans } = await pool.query(
      'SELECT * FROM subscription_plans ORDER BY sort_order ASC'
    );

    // If logged in, find all user's businesses for portal redirect / modal
    let userBusinessId = null;
    let userBusinesses = [];
    if (req.webUser) {
      const bizResult = await pool.query(
        `SELECT b.id, b.name, b.logo_url, sp.slug AS plan_slug
         FROM businesses b
         JOIN user_businesses ub ON ub.business_id = b.id
         LEFT JOIN business_subscriptions bs ON bs.business_id = b.id
         LEFT JOIN subscription_plans sp ON sp.id = bs.plan_id
         WHERE ub.user_id = $1
         ORDER BY b.name`,
        [req.webUser.id]
      );
      userBusinesses = bizResult.rows;
      if (bizResult.rows[0]) {
        userBusinessId = bizResult.rows[0].id;
      }
    }

    res.render('public/pricing', {
      pageTitle: 'Prețuri',
      pageDesc: 'Planuri de abonament pentru business-uri pe OFAI: Free, Standard (49 RON/lună) și Premium (199 RON/lună). Alege planul potrivit.',
      canonicalUrl: 'https://ofai.ro/preturi',
      activePage: 'preturi',
      plans,
      webUser: req.webUser || null,
      userBusinessId,
      userBusinesses,
      structuredData: (plans || []).filter(p => p.price_monthly > 0).map(p => ({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": `OFAI ${p.name}`,
        "description": p.description || `Plan ${p.name} pentru business-uri pe OFAI`,
        "offers": {
          "@type": "Offer",
          "price": (p.price_monthly / 100).toFixed(2),
          "priceCurrency": "RON",
          "availability": "https://schema.org/InStock",
          "priceValidUntil": new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
        }
      })),
    });
  } catch (err) {
    console.error('[Web] Pricing page error:', err);
    res.status(500).send('Eroare la incarcarea paginii de preturi.');
  }
});

module.exports = router;
