/**
 * Seed script: random analytics data for last 30 days + business ownership
 * Tables populated: business_views, offer_views, business_clicks, followed_businesses
 * Also links user to one business per category via user_businesses
 *
 * Rulare: cd appredueri_backend && node scripts/seed-stats.js
 */

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 5,
  statement_timeout: 30000,
});

// ─── CONFIG ─────────────────────────────────────────────────
const OWNER_USER_ID = 1; // owner@example.com
const DAYS = 30;

// Action types for business_clicks (weighted - more common ones appear more)
const CLICK_ACTIONS = [
  { type: "phone", weight: 20 },
  { type: "whatsapp", weight: 15 },
  { type: "website", weight: 15 },
  { type: "navigate", weight: 25 },
  { type: "booking_url", weight: 10 },
  { type: "share", weight: 5 },
  { type: "gallery", weight: 8 },
  { type: "copy_code", weight: 12 },
  { type: "favorite", weight: 6 },
  { type: "follow", weight: 4 },
];

// Fake IPs and user agents for realism
const FAKE_IPS = [
  "86.124.32.", "79.112.45.", "188.25.67.", "93.115.89.",
  "82.77.123.", "89.38.210.", "5.13.78.", "109.163.55.",
  "77.81.12.", "31.5.244.",
];

const FAKE_UAS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/17",
  "Mozilla/5.0 (Linux; Android 13; Samsung Galaxy S23)",
  "OFAIApp/1.0 (Flutter; Dart)",
];

// ─── HELPERS ────────────────────────────────────────────────
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomIp() {
  return FAKE_IPS[rand(0, FAKE_IPS.length - 1)] + rand(1, 254);
}

function randomUa() {
  return FAKE_UAS[rand(0, FAKE_UAS.length - 1)];
}

function randomAction() {
  const totalWeight = CLICK_ACTIONS.reduce((s, a) => s + a.weight, 0);
  let r = Math.random() * totalWeight;
  for (const a of CLICK_ACTIONS) {
    r -= a.weight;
    if (r <= 0) return a.type;
  }
  return CLICK_ACTIONS[0].type;
}

function randomTimestamp(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(rand(7, 23), rand(0, 59), rand(0, 59), 0);
  return d.toISOString();
}

// Weekday factor: more traffic on weekdays
function dayFactor(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const dow = d.getDay(); // 0=Sun
  if (dow === 0) return 0.5;
  if (dow === 6) return 0.7;
  return 1.0;
}

// ─── MAIN ───────────────────────────────────────────────────
async function main() {
  console.log("Starting stats seed...\n");

  // 1. Get all seed businesses with their offers
  const bizRes = await pool.query(`
    SELECT b.id, b.name, b.category_id,
           ARRAY_AGG(o.id) FILTER (WHERE o.id IS NOT NULL) as offer_ids
    FROM businesses b
    LEFT JOIN offers o ON o.business_id = b.id
    WHERE b.source = 'seed'
    GROUP BY b.id, b.name, b.category_id
    ORDER BY b.category_id, b.id
  `);

  const businesses = bizRes.rows;
  console.log(`Found ${businesses.length} seed businesses\n`);

  if (businesses.length === 0) {
    console.log("No seed businesses found. Run seed-businesses.js first.");
    await pool.end();
    return;
  }

  // 2. Clean up old stats for seed businesses
  console.log("Cleaning up old seed stats...");
  const seedBizIds = businesses.map((b) => b.id);

  await pool.query(
    `DELETE FROM business_views WHERE business_id = ANY($1)`,
    [seedBizIds]
  );
  await pool.query(
    `DELETE FROM offer_views WHERE business_id = ANY($1)`,
    [seedBizIds]
  );
  await pool.query(
    `DELETE FROM business_clicks WHERE business_id = ANY($1)`,
    [seedBizIds]
  );
  await pool.query(
    `DELETE FROM followed_businesses WHERE business_id = ANY($1)`,
    [seedBizIds]
  );
  console.log("  Cleaned.\n");

  // 3. Generate stats
  let totalViews = 0;
  let totalOfferViews = 0;
  let totalClicks = 0;
  let totalFollows = 0;

  // Batch arrays for bulk inserts
  let viewRows = [];
  let offerViewRows = [];
  let clickRows = [];

  for (let i = 0; i < businesses.length; i++) {
    const biz = businesses[i];
    const offerIds = biz.offer_ids || [];

    // Each business gets a "popularity" factor (0.5 - 2.0)
    const popularity = 0.5 + Math.random() * 1.5;

    for (let day = 0; day < DAYS; day++) {
      const df = dayFactor(day);

      // Business views: 3-20 per day scaled by popularity
      const viewCount = Math.round(rand(3, 20) * popularity * df);
      for (let v = 0; v < viewCount; v++) {
        viewRows.push(
          `(${biz.id}, '${randomIp()}', '${randomUa()}', '${randomTimestamp(day)}')`
        );
        totalViews++;
      }

      // Offer views: 2-10 per offer per day
      for (const offerId of offerIds) {
        const offerViewCount = Math.round(rand(2, 10) * popularity * df);
        for (let v = 0; v < offerViewCount; v++) {
          offerViewRows.push(
            `(${offerId}, ${biz.id}, '${randomIp()}', '${randomUa()}', '${randomTimestamp(day)}')`
          );
          totalOfferViews++;
        }
      }

      // Business clicks: 1-8 per day
      const clickCount = Math.round(rand(1, 8) * popularity * df);
      for (let c = 0; c < clickCount; c++) {
        const action = randomAction();
        const offerId =
          offerIds.length > 0 && Math.random() > 0.5
            ? offerIds[rand(0, offerIds.length - 1)]
            : null;
        clickRows.push(
          `(${biz.id}, ${offerId || "NULL"}, '${action}', '${randomTimestamp(day)}')`
        );
        totalClicks++;
      }
    }

    // Flush in batches of ~5000 rows
    if (viewRows.length > 5000) {
      await pool.query(
        `INSERT INTO business_views (business_id, viewer_ip, user_agent, viewed_at) VALUES ${viewRows.join(",")}`
      );
      viewRows = [];
    }
    if (offerViewRows.length > 5000) {
      await pool.query(
        `INSERT INTO offer_views (offer_id, business_id, viewer_ip, user_agent, viewed_at) VALUES ${offerViewRows.join(",")}`
      );
      offerViewRows = [];
    }
    if (clickRows.length > 5000) {
      await pool.query(
        `INSERT INTO business_clicks (business_id, offer_id, action_type, created_at) VALUES ${clickRows.join(",")}`
      );
      clickRows = [];
    }

    if ((i + 1) % 30 === 0) {
      console.log(`  ${i + 1}/${businesses.length} businesses processed...`);
    }
  }

  // Flush remaining rows
  if (viewRows.length > 0) {
    await pool.query(
      `INSERT INTO business_views (business_id, viewer_ip, user_agent, viewed_at) VALUES ${viewRows.join(",")}`
    );
  }
  if (offerViewRows.length > 0) {
    await pool.query(
      `INSERT INTO offer_views (offer_id, business_id, viewer_ip, user_agent, viewed_at) VALUES ${offerViewRows.join(",")}`
    );
  }
  if (clickRows.length > 0) {
    await pool.query(
      `INSERT INTO business_clicks (business_id, offer_id, action_type, created_at) VALUES ${clickRows.join(",")}`
    );
  }

  console.log(`  Views: ${totalViews}`);
  console.log(`  Offer views: ${totalOfferViews}`);
  console.log(`  Clicks: ${totalClicks}`);

  // 4. Generate followers — use only real user (id=1) as follower
  // Can't use fake user IDs due to FK constraint on users table
  console.log("\nGenerating followers (user_id=1 follows all seed businesses)...");
  let followRows = [];
  for (const biz of businesses) {
    const daysAgo = rand(0, DAYS);
    followRows.push(
      `(${OWNER_USER_ID}, ${biz.id}, '${randomTimestamp(daysAgo)}')`
    );
    totalFollows++;
  }

  if (followRows.length > 0) {
    await pool.query(
      `INSERT INTO followed_businesses (user_id, business_id, created_at) VALUES ${followRows.join(",")} ON CONFLICT (user_id, business_id) DO NOTHING`
    );
  }
  console.log(`  Followers: ${totalFollows}`);

  // 5. Link owner to one business per category
  console.log("\nLinking user to businesses (1 per category)...");
  const categories = [...new Set(businesses.map((b) => b.category_id))];
  let linkedCount = 0;

  for (const catId of categories) {
    const biz = businesses.find((b) => b.category_id === catId);
    if (biz) {
      await pool.query(
        `INSERT INTO user_businesses (user_id, business_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, business_id) DO NOTHING`,
        [OWNER_USER_ID, biz.id]
      );
      linkedCount++;
      console.log(`  ${biz.name} (category ${catId})`);
    }
  }

  // ─── SUMMARY ────────────────────────────────────────────────
  console.log("\n===================================================");
  console.log("STATS SEED COMPLETE!");
  console.log("===================================================");
  console.log(`  Business views:    ${totalViews}`);
  console.log(`  Offer views:       ${totalOfferViews}`);
  console.log(`  Clicks:            ${totalClicks}`);
  console.log(`  Followers:         ~${totalFollows}`);
  console.log(`  Owner linked to:   ${linkedCount} businesses`);
  console.log("===================================================\n");

  await pool.end();
  console.log("Done!");
}

main().catch((err) => {
  console.error("SEED ERROR:", err);
  pool.end();
  process.exit(1);
});
