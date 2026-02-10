/**
 * Cleanup script: Șterge toate business-urile generate de seed
 *
 * Identificare: logo_url conține 'dicebear' SAU cover_image_url conține 'picsum'
 *
 * Rulare: node scripts/cleanup-seed.js
 */

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 5,
  statement_timeout: 60000,
});

async function cleanup() {
  const client = await pool.connect();

  try {
    console.log("🔍 Identificare business-uri seed...\n");

    // Găsim toate business-urile seed
    const seedBiz = await client.query(
      `SELECT id, name FROM businesses
       WHERE logo_url LIKE '%dicebear%'
          OR cover_image_url LIKE '%picsum%'`
    );

    const ids = seedBiz.rows.map((r) => r.id);

    if (ids.length === 0) {
      console.log("✅ Nu există business-uri seed de șters.");
      return;
    }

    console.log(`📊 Găsite ${ids.length} business-uri seed.`);
    console.log(`   Primele 5: ${seedBiz.rows.slice(0, 5).map((r) => r.name).join(", ")}...\n`);

    await client.query("BEGIN");

    // Ștergere în cascadă (ordine inversă FK)
    const offerIds = await client.query(
      `SELECT id FROM offers WHERE business_id = ANY($1)`, [ids]
    );
    const oIds = offerIds.rows.map((r) => r.id);

    if (oIds.length > 0) {
      const r1 = await client.query(`DELETE FROM offer_locations WHERE offer_id = ANY($1)`, [oIds]);
      console.log(`   🗑️  offer_locations: ${r1.rowCount} rows`);
    }

    const tables = [
      { name: "offer_views", col: "business_id" },
      { name: "offers", col: "business_id" },
      { name: "business_images", col: "business_id" },
      { name: "business_locations", col: "business_id" },
      { name: "review_responses", col: "business_id" },
      { name: "review_summaries", col: "business_id" },
      { name: "reviews", col: "business_id" },
      { name: "business_views", col: "business_id" },
      { name: "user_businesses", col: "business_id" },
    ];

    for (const t of tables) {
      try {
        const result = await client.query(
          `DELETE FROM ${t.name} WHERE ${t.col} = ANY($1)`, [ids]
        );
        console.log(`   🗑️  ${t.name}: ${result.rowCount} rows`);
      } catch (err) {
        // Tabelul poate să nu existe
        console.log(`   ⚠️  ${t.name}: skip (${err.message.split("\n")[0]})`);
      }
    }

    // Ștergem business-urile
    const bizResult = await client.query(
      `DELETE FROM businesses WHERE id = ANY($1)`, [ids]
    );
    console.log(`   🗑️  businesses: ${bizResult.rowCount} rows`);

    await client.query("COMMIT");

    console.log("\n═══════════════════════════════════════════");
    console.log(`✅ CLEANUP COMPLET! ${ids.length} business-uri șterse.`);
    console.log("═══════════════════════════════════════════");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Cleanup failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
