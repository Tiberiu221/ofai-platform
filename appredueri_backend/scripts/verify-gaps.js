/**
 * Check gaps in seed data
 */
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 3,
  statement_timeout: 30000,
});

async function check() {
  const client = await pool.connect();
  try {
    // 1. Businesses with empty description
    const emptyDesc = await client.query(
      `SELECT id, name, category_id FROM businesses WHERE (description IS NULL OR description = '') AND logo_url LIKE '%dicebear%'`
    );
    console.log("=== BUSINESSES WITH EMPTY DESCRIPTION ===");
    if (emptyDesc.rows.length === 0) {
      console.log("  None! All good.");
    } else {
      emptyDesc.rows.forEach((r) =>
        console.log(`  ID ${r.id}: ${r.name} (cat_id: ${r.category_id})`)
      );
    }

    // 2. Businesses with only 1 offer
    const singleOffer = await client.query(`
      SELECT b.id, b.name, COUNT(o.id) as offer_count
      FROM businesses b
      LEFT JOIN offers o ON o.business_id = b.id
      WHERE b.logo_url LIKE '%dicebear%'
      GROUP BY b.id, b.name
      HAVING COUNT(o.id) < 2
      ORDER BY COUNT(o.id) ASC
    `);
    console.log("\n=== BUSINESSES WITH < 2 OFFERS ===");
    if (singleOffer.rows.length === 0) {
      console.log("  None! All good.");
    } else {
      singleOffer.rows.forEach((r) =>
        console.log(`  ID ${r.id}: ${r.name} — ${r.offer_count} offers`)
      );
    }

    // 3. 5 non-seed businesses
    const nonSeed = await client.query(
      `SELECT id, name, logo_url FROM businesses WHERE NOT (logo_url LIKE '%dicebear%' OR cover_image_url LIKE '%picsum%') LIMIT 10`
    );
    console.log("\n=== NON-SEED BUSINESSES ===");
    if (nonSeed.rows.length === 0) {
      console.log("  None");
    } else {
      nonSeed.rows.forEach((r) =>
        console.log(`  ID ${r.id}: ${r.name} (logo: ${(r.logo_url || "null").substring(0, 50)})`)
      );
    }

  } finally {
    client.release();
    await pool.end();
  }
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
