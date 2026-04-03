// ============================================
// ADMIN ANALYTICS — Extracted Route
// ============================================
// Comprehensive analytics dashboard with 9 sections,
// date range picker (7d/30d/90d), trend indicators, sparklines.

const express = require("express");
const router = express.Router();
const pool = require("../db");
const cache = require("../services/cache");

// ─── Helpers ─────────────────────────────────────────

function pct(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function int(row, col) {
  return parseInt(row?.[col] || 0);
}

function intervalSql(days) {
  // days is validated to 7|30|90, safe for interpolation
  return `${days} days`;
}

// ─── Fetch Functions ─────────────────────────────────

async function fetchRevenue(days) {
  const iv = intervalSql(days);
  const iv2 = intervalSql(days * 2);

  const [mrrResult, tierDistResult, newSubsCurrent, newSubsPrev, sparkSignups] = await Promise.all([
    pool.query(`
      SELECT COALESCE(SUM(CASE
        WHEN bs.billing_cycle = 'monthly' THEN sp.price_monthly
        WHEN bs.billing_cycle = 'yearly' THEN sp.price_yearly / 12
        ELSE 0
      END), 0) as mrr_bani
      FROM business_subscriptions bs
      JOIN subscription_plans sp ON sp.id = bs.plan_id
      WHERE bs.status IN ('active', 'trial')
        AND bs.billing_cycle IN ('monthly', 'yearly')
        AND sp.slug != 'free'
    `),
    pool.query(`
      SELECT sp.slug, sp.name, COUNT(bs.id) as cnt
      FROM business_subscriptions bs
      JOIN subscription_plans sp ON sp.id = bs.plan_id
      WHERE bs.status IN ('active', 'trial')
      GROUP BY sp.slug, sp.name, sp.sort_order
      ORDER BY sp.sort_order
    `),
    pool.query(`SELECT COUNT(*) as cnt FROM subscription_history WHERE action = 'created' AND created_at >= NOW() - INTERVAL '${iv}'`),
    pool.query(`SELECT COUNT(*) as cnt FROM subscription_history WHERE action = 'created' AND created_at >= NOW() - INTERVAL '${iv2}' AND created_at < NOW() - INTERVAL '${iv}'`),
    pool.query(`
      SELECT DATE_TRUNC('day', created_at)::date as d, COUNT(*) as cnt
      FROM subscription_history WHERE action = 'created' AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY 1 ORDER BY 1
    `).catch(() => ({ rows: [] }))
  ]);

  const mrrBani = parseInt(mrrResult.rows[0]?.mrr_bani || 0);
  const mrr = (mrrBani / 100).toFixed(2);
  const arr = ((mrrBani * 12) / 100).toFixed(2);
  const paidCount = tierDistResult.rows.filter(r => r.slug !== 'free').reduce((s, r) => s + parseInt(r.cnt), 0);
  const newCur = int(newSubsCurrent.rows[0], 'cnt');
  const newPrv = int(newSubsPrev.rows[0], 'cnt');

  return {
    mrr, arr, paidCount,
    tierDist: tierDistResult.rows,
    newSubsTrend: pct(newCur, newPrv),
    sparkNewSubs: sparkSignups.rows.map(r => int(r, 'cnt'))
  };
}

async function fetchSubscriptions(days) {
  const [subStatusResult, subHistoryResult] = await Promise.all([
    pool.query(`SELECT status, COUNT(*) as cnt FROM business_subscriptions GROUP BY status`).catch(() => ({ rows: [] })),
    pool.query(`
      SELECT DATE_TRUNC('month', created_at)::date as month, action, COUNT(*) as cnt
      FROM subscription_history
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY 1, 2 ORDER BY 1
    `).catch(() => ({ rows: [] }))
  ]);

  const cancellations30d = subHistoryResult.rows
    .filter(r => r.action === 'cancelled' && new Date(r.month) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    .reduce((sum, r) => sum + parseInt(r.cnt), 0);
  const totalActive = subStatusResult.rows
    .filter(r => ['active', 'trial'].includes(r.status))
    .reduce((sum, r) => sum + parseInt(r.cnt), 0);
  const churnRate = totalActive > 0 ? ((cancellations30d / totalActive) * 100).toFixed(1) : '0.0';

  return {
    statusCounts: subStatusResult.rows,
    history: subHistoryResult.rows,
    churnRate,
    trialCount: subStatusResult.rows.find(r => r.status === 'trial')?.cnt || 0
  };
}

async function fetchUsers(days) {
  const iv = intervalSql(days);
  const iv2 = intervalSql(days * 2);

  const [total, active30d, active7d, newMonth, dormant, signupsWeekly, newCur, newPrev, sparkSignups] = await Promise.all([
    pool.query("SELECT COUNT(*) FROM users"),
    pool.query("SELECT COUNT(*) FROM users WHERE last_active_at >= NOW() - INTERVAL '30 days'"),
    pool.query("SELECT COUNT(*) FROM users WHERE last_active_at >= NOW() - INTERVAL '7 days'"),
    pool.query("SELECT COUNT(*) FROM users WHERE created_at >= DATE_TRUNC('month', NOW())"),
    pool.query("SELECT COUNT(*) FROM users WHERE last_active_at IS NOT NULL AND last_active_at < NOW() - INTERVAL '30 days'"),
    pool.query(`
      SELECT DATE_TRUNC('week', created_at)::date as week, COUNT(*) as cnt
      FROM users WHERE created_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY 1 ORDER BY 1
    `),
    pool.query(`SELECT COUNT(*) as cnt FROM users WHERE created_at >= NOW() - INTERVAL '${iv}'`),
    pool.query(`SELECT COUNT(*) as cnt FROM users WHERE created_at >= NOW() - INTERVAL '${iv2}' AND created_at < NOW() - INTERVAL '${iv}'`),
    pool.query(`
      SELECT DATE_TRUNC('day', created_at)::date as d, COUNT(*) as cnt
      FROM users WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY 1 ORDER BY 1
    `)
  ]);

  return {
    total: int(total.rows[0], 'count'),
    active30d: int(active30d.rows[0], 'count'),
    active7d: int(active7d.rows[0], 'count'),
    newMonth: int(newMonth.rows[0], 'count'),
    dormant: int(dormant.rows[0], 'count'),
    signupsWeekly: signupsWeekly.rows,
    newUsersTrend: pct(int(newCur.rows[0], 'cnt'), int(newPrev.rows[0], 'cnt')),
    sparkSignups: sparkSignups.rows.map(r => int(r, 'cnt'))
  };
}

async function fetchBusinessHealth(days) {
  const iv = intervalSql(days);

  const [bizTotal, bizWithOffers, bizByTier, topBizViews, sparkViews] = await Promise.all([
    pool.query("SELECT COUNT(*) FROM businesses"),
    pool.query(`
      SELECT COUNT(DISTINCT b.id) as cnt FROM businesses b
      JOIN offers o ON o.business_id = b.id AND o.is_active = true
        AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
    `),
    pool.query(`
      SELECT COALESCE(sp.slug, 'free') as tier, COUNT(DISTINCT b.id) as cnt
      FROM businesses b
      LEFT JOIN business_subscriptions bs ON bs.business_id = b.id AND bs.status IN ('active', 'trial')
      LEFT JOIN subscription_plans sp ON sp.id = bs.plan_id
      GROUP BY sp.slug
    `),
    pool.query(`
      SELECT b.name, COUNT(bv.id) as views
      FROM business_views bv
      JOIN businesses b ON b.id = bv.business_id
      WHERE bv.viewed_at >= NOW() - INTERVAL '${iv}'
      GROUP BY b.id, b.name
      ORDER BY views DESC LIMIT 10
    `).catch(() => ({ rows: [] })),
    pool.query(`
      SELECT DATE_TRUNC('day', viewed_at)::date as d, COUNT(*) as cnt
      FROM business_views WHERE viewed_at >= NOW() - INTERVAL '7 days'
      GROUP BY 1 ORDER BY 1
    `).catch(() => ({ rows: [] }))
  ]);

  return {
    total: int(bizTotal.rows[0], 'count'),
    withOffers: int(bizWithOffers.rows[0], 'cnt'),
    byTier: bizByTier.rows,
    topByViews: topBizViews.rows,
    sparkViews: sparkViews.rows.map(r => int(r, 'cnt'))
  };
}

async function fetchEmails(days) {
  const iv = intervalSql(days);
  const iv2 = intervalSql(days * 2);

  const [stats, prevStats, sparkEmails] = await Promise.all([
    pool.query(`
      SELECT email_type,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM email_logs
      WHERE created_at >= NOW() - INTERVAL '${iv}'
      GROUP BY email_type ORDER BY total DESC
    `).catch(() => ({ rows: [] })),
    pool.query(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM email_logs
      WHERE created_at >= NOW() - INTERVAL '${iv2}' AND created_at < NOW() - INTERVAL '${iv}'
    `).catch(() => ({ rows: [{ total: 0, failed: 0 }] })),
    pool.query(`
      SELECT DATE_TRUNC('day', created_at)::date as d, COUNT(*) as cnt
      FROM email_logs WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY 1 ORDER BY 1
    `).catch(() => ({ rows: [] }))
  ]);

  const totalSent = stats.rows.reduce((s, r) => s + parseInt(r.total), 0);
  const totalFailed = stats.rows.reduce((s, r) => s + parseInt(r.failed), 0);
  const prevTotal = int(prevStats.rows[0], 'total');

  return {
    stats: stats.rows,
    totalSent,
    totalFailed,
    sentTrend: pct(totalSent, prevTotal),
    sparkEmails: sparkEmails.rows.map(r => int(r, 'cnt'))
  };
}

async function fetchOfferAnalytics(days) {
  const iv = intervalSql(days);
  const iv2 = intervalSql(days * 2);

  const [activeOffers, viewsCur, viewsPrev, revealsCur, revealsPrev, topOffers, catPerf, sparkViews] = await Promise.all([
    pool.query(`
      SELECT COUNT(*) as cnt FROM offers
      WHERE is_active = true AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        AND moderation_status IN ('approved', 'auto_approved')
    `),
    pool.query(`SELECT COUNT(*) as cnt FROM offer_views WHERE viewed_at >= NOW() - INTERVAL '${iv}'`).catch(() => ({ rows: [{ cnt: 0 }] })),
    pool.query(`SELECT COUNT(*) as cnt FROM offer_views WHERE viewed_at >= NOW() - INTERVAL '${iv2}' AND viewed_at < NOW() - INTERVAL '${iv}'`).catch(() => ({ rows: [{ cnt: 0 }] })),
    pool.query(`SELECT COUNT(*) as cnt FROM code_reveals WHERE revealed_at >= NOW() - INTERVAL '${iv}'`).catch(() => ({ rows: [{ cnt: 0 }] })),
    pool.query(`SELECT COUNT(*) as cnt FROM code_reveals WHERE revealed_at >= NOW() - INTERVAL '${iv2}' AND revealed_at < NOW() - INTERVAL '${iv}'`).catch(() => ({ rows: [{ cnt: 0 }] })),
    pool.query(`
      SELECT o.title, b.name as business_name, COUNT(ov.id) as views
      FROM offer_views ov
      JOIN offers o ON ov.offer_id = o.id
      JOIN businesses b ON b.id = o.business_id
      WHERE ov.viewed_at >= NOW() - INTERVAL '${iv}'
      GROUP BY o.id, o.title, b.name
      ORDER BY views DESC LIMIT 10
    `).catch(() => ({ rows: [] })),
    pool.query(`
      SELECT cat.name, COUNT(ov.id) as views
      FROM offer_views ov
      JOIN offers o ON ov.offer_id = o.id
      JOIN businesses b ON b.id = o.business_id
      JOIN categories cat ON cat.id = b.category_id
      WHERE ov.viewed_at >= NOW() - INTERVAL '${iv}'
      GROUP BY cat.id, cat.name
      ORDER BY views DESC LIMIT 8
    `).catch(() => ({ rows: [] })),
    pool.query(`
      SELECT DATE_TRUNC('day', viewed_at)::date as d, COUNT(*) as cnt
      FROM offer_views WHERE viewed_at >= NOW() - INTERVAL '7 days'
      GROUP BY 1 ORDER BY 1
    `).catch(() => ({ rows: [] }))
  ]);

  const views = int(viewsCur.rows[0], 'cnt');
  const reveals = int(revealsCur.rows[0], 'cnt');

  return {
    activeOffers: int(activeOffers.rows[0], 'cnt'),
    views,
    viewsTrend: pct(views, int(viewsPrev.rows[0], 'cnt')),
    reveals,
    revealsTrend: pct(reveals, int(revealsPrev.rows[0], 'cnt')),
    ctr: views > 0 ? ((reveals / views) * 100).toFixed(1) : '0.0',
    topOffers: topOffers.rows,
    catPerf: catPerf.rows,
    sparkViews: sparkViews.rows.map(r => int(r, 'cnt'))
  };
}

async function fetchEngagement(days) {
  const iv = intervalSql(days);
  const iv2 = intervalSql(days * 2);

  const [favCur, favPrev, folCur, folPrev, revCur, revPrev, topFav, dailyEngagement] = await Promise.all([
    pool.query(`SELECT COUNT(*) as cnt FROM favorite_offers WHERE created_at >= NOW() - INTERVAL '${iv}'`),
    pool.query(`SELECT COUNT(*) as cnt FROM favorite_offers WHERE created_at >= NOW() - INTERVAL '${iv2}' AND created_at < NOW() - INTERVAL '${iv}'`),
    pool.query(`SELECT COUNT(*) as cnt FROM followed_businesses WHERE created_at >= NOW() - INTERVAL '${iv}'`),
    pool.query(`SELECT COUNT(*) as cnt FROM followed_businesses WHERE created_at >= NOW() - INTERVAL '${iv2}' AND created_at < NOW() - INTERVAL '${iv}'`),
    pool.query(`SELECT COUNT(*) as cnt FROM reviews WHERE created_at >= NOW() - INTERVAL '${iv}'`),
    pool.query(`SELECT COUNT(*) as cnt FROM reviews WHERE created_at >= NOW() - INTERVAL '${iv2}' AND created_at < NOW() - INTERVAL '${iv}'`),
    pool.query(`
      SELECT o.title, b.name as business_name, COUNT(*) as saves
      FROM favorite_offers fo
      JOIN offers o ON fo.offer_id = o.id
      JOIN businesses b ON b.id = o.business_id
      WHERE fo.created_at >= NOW() - INTERVAL '${iv}'
      GROUP BY o.id, o.title, b.name
      ORDER BY saves DESC LIMIT 10
    `).catch(() => ({ rows: [] })),
    pool.query(`
      SELECT d::date as day,
        COALESCE(fav.cnt, 0) as favorites,
        COALESCE(fol.cnt, 0) as follows,
        COALESCE(rev.cnt, 0) as reveals
      FROM generate_series(NOW() - INTERVAL '${iv}', NOW(), '1 day') d
      LEFT JOIN (
        SELECT DATE_TRUNC('day', created_at)::date as day, COUNT(*) as cnt
        FROM favorite_offers WHERE created_at >= NOW() - INTERVAL '${iv}'
        GROUP BY 1
      ) fav ON fav.day = d::date
      LEFT JOIN (
        SELECT DATE_TRUNC('day', created_at)::date as day, COUNT(*) as cnt
        FROM followed_businesses WHERE created_at >= NOW() - INTERVAL '${iv}'
        GROUP BY 1
      ) fol ON fol.day = d::date
      LEFT JOIN (
        SELECT DATE_TRUNC('day', revealed_at)::date as day, COUNT(*) as cnt
        FROM code_reveals WHERE revealed_at >= NOW() - INTERVAL '${iv}'
        GROUP BY 1
      ) rev ON rev.day = d::date
      ORDER BY 1
    `).catch(() => ({ rows: [] }))
  ]);

  const fc = int(favCur.rows[0], 'cnt');
  const flc = int(folCur.rows[0], 'cnt');
  const rc = int(revCur.rows[0], 'cnt');

  return {
    favorites: fc,
    favoritesTrend: pct(fc, int(favPrev.rows[0], 'cnt')),
    follows: flc,
    followsTrend: pct(flc, int(folPrev.rows[0], 'cnt')),
    reviews: rc,
    reviewsTrend: pct(rc, int(revPrev.rows[0], 'cnt')),
    topFav: topFav.rows,
    daily: dailyEngagement.rows
  };
}

async function fetchGeo(days) {
  const iv = intervalSql(days);

  const [citiesWithBiz, topCitiesViews, topCitiesOffers] = await Promise.all([
    pool.query("SELECT COUNT(DISTINCT city_id) as cnt FROM businesses"),
    pool.query(`
      SELECT c.name, COUNT(bv.id) as views
      FROM business_views bv
      JOIN businesses b ON bv.business_id = b.id
      JOIN cities c ON c.id = b.city_id
      WHERE bv.viewed_at >= NOW() - INTERVAL '${iv}'
      GROUP BY c.id, c.name
      ORDER BY views DESC LIMIT 10
    `).catch(() => ({ rows: [] })),
    pool.query(`
      SELECT c.name, COUNT(o.id) as offer_count
      FROM offers o
      JOIN businesses b ON o.business_id = b.id
      JOIN cities c ON c.id = b.city_id
      WHERE o.is_active = true AND (o.end_date IS NULL OR o.end_date >= CURRENT_DATE)
      GROUP BY c.id, c.name
      ORDER BY offer_count DESC LIMIT 10
    `).catch(() => ({ rows: [] }))
  ]);

  return {
    citiesWithBiz: int(citiesWithBiz.rows[0], 'cnt'),
    topCity: topCitiesViews.rows[0]?.name || '-',
    topCitiesViews: topCitiesViews.rows,
    topCitiesOffers: topCitiesOffers.rows
  };
}

async function fetchContentHealth(days) {
  const iv = intervalSql(days);
  const iv2 = intervalSql(days * 2);

  const [offersCur, offersPrev, expiring, pending, avgRating, creationRate] = await Promise.all([
    pool.query(`SELECT COUNT(*) as cnt FROM offers WHERE start_date >= NOW() - INTERVAL '${iv}'`),
    pool.query(`SELECT COUNT(*) as cnt FROM offers WHERE start_date >= NOW() - INTERVAL '${iv2}' AND start_date < NOW() - INTERVAL '${iv}'`),
    pool.query(`
      SELECT COUNT(*) as cnt FROM offers
      WHERE is_active = true AND end_date IS NOT NULL
        AND end_date >= CURRENT_DATE AND end_date <= CURRENT_DATE + INTERVAL '7 days'
    `),
    pool.query(`SELECT COUNT(*) as cnt FROM offers WHERE moderation_status = 'pending_review'`),
    pool.query(`
      SELECT ROUND(AVG(rating)::numeric, 1) as avg_rating, COUNT(*) as cnt
      FROM reviews WHERE created_at >= NOW() - INTERVAL '${iv}'
    `),
    pool.query(`
      SELECT DATE_TRUNC('week', start_date)::date as week, COUNT(*) as cnt
      FROM offers WHERE start_date >= NOW() - INTERVAL '12 weeks'
      GROUP BY 1 ORDER BY 1
    `)
  ]);

  const oc = int(offersCur.rows[0], 'cnt');

  return {
    offersCreated: oc,
    offersCreatedTrend: pct(oc, int(offersPrev.rows[0], 'cnt')),
    expiring: int(expiring.rows[0], 'cnt'),
    pending: int(pending.rows[0], 'cnt'),
    avgRating: avgRating.rows[0]?.avg_rating || '0.0',
    reviewCount: int(avgRating.rows[0], 'cnt'),
    creationRate: creationRate.rows
  };
}

// ─── Main Route ──────────────────────────────────────

router.get("/analytics", async (req, res) => {
  try {
    const period = ['7d', '30d', '90d'].includes(req.query.period) ? req.query.period : '30d';
    const days = parseInt(period);
    const cacheKey = `admin:analytics:${period}`;

    const data = await cache.cached(cacheKey, 15 * 60 * 1000, async () => {
      const [revenue, subs, users, biz, emails, offers, engagement, geo, content] = await Promise.all([
        fetchRevenue(days),
        fetchSubscriptions(days),
        fetchUsers(days),
        fetchBusinessHealth(days),
        fetchEmails(days),
        fetchOfferAnalytics(days),
        fetchEngagement(days),
        fetchGeo(days),
        fetchContentHealth(days)
      ]);
      return { revenue, subs, users, biz, emails, offers, engagement, geo, content };
    });

    res.render("admin/analytics", {
      pageTitle: "Analytics",
      activePage: "analytics",
      loadChartJs: true,
      data,
      period
    });
  } catch (err) {
    console.error("[Admin] Analytics error:", err.message, err.stack);
    res.status(500).send("Eroare la incarcarea analytics: " + (process.env.NODE_ENV !== 'production' ? err.message : 'Verifica logurile serverului.'));
  }
});

module.exports = router;
