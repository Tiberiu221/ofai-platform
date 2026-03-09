/**
 * Fix broken Unsplash image URLs in seed businesses.
 * Replaces 14 broken photo IDs with known-working alternatives.
 */
require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Map broken photo IDs to working replacements (same category style)
const REPLACEMENTS = {
  // Frizerie (barber)
  "photo-1661542350224-8e3f095ce053": "photo-1503951914875-452162b0f3f1", // barber shop
  "photo-1661281275452-744317772b99": "photo-1521590832167-7bcbfaa6381f", // barber cutting
  // Beauty
  "photo-1661411119301-8cae0adce9a7": "photo-1560066984-138dadb4c035", // beauty salon
  "photo-1681488262364-8aeb1b6aac56": "photo-1522337360788-8b13dee7a37e", // nails/beauty
  // Auto
  "photo-1664970900025-1e3099ca757a": "photo-1486262715619-67b85e0b08d3", // auto repair
  "photo-1733328015522-c497d190f74b": "photo-1530046339160-ce3e530c7d2f", // car service
  // Magazine Online
  "photo-1683134297492-cce5fc6dae31": "photo-1556742049-0cfed4f6a45d", // online shopping
  "photo-1664304180276-4ef02afe2b5e": "photo-1563013544-824ae1b704d3", // e-commerce
  // Cafenea
  "photo-1663047392930-7c1c31d7b785": "photo-1501339847302-ac426a4a7cbb", // coffee shop
  "photo-1661942274165-00cc8d55a93f": "photo-1442512595331-e89e73853f31", // cafe interior
  // Fitness
  "photo-1681966962522-546f370bc98e": "photo-1534438327276-14e5300c3a48", // gym
  "photo-1661292066962-48e5815dc7ce": "photo-1571902943202-507ec2618e8f", // fitness
  // Spa
  "photo-1682129257696-dfe914806043": "photo-1544161515-4ab6ce6db874", // spa
  // Optica / Farmacie / Vet / Stoma / Florarie / Curatatorie / Foto
  "photo-1714618939758-84f1dd5e229c": "photo-1516574187841-cb9cc2ca948b", // general store
};

async function main() {
  console.log("Fixing broken Unsplash image URLs...\n");

  let fixedCount = 0;

  for (const [broken, replacement] of Object.entries(REPLACEMENTS)) {
    // Fix logos
    const logoRes = await pool.query(
      "UPDATE businesses SET logo_url = REPLACE(logo_url, $1, $2) WHERE source = 'seed' AND logo_url LIKE $3 RETURNING id, name",
      [broken, replacement, "%" + broken + "%"]
    );
    // Fix covers
    const coverRes = await pool.query(
      "UPDATE businesses SET cover_image_url = REPLACE(cover_image_url, $1, $2) WHERE source = 'seed' AND cover_image_url LIKE $3 RETURNING id, name",
      [broken, replacement, "%" + broken + "%"]
    );
    // Fix offer images too
    const offerRes = await pool.query(
      "UPDATE offers SET image_url = REPLACE(image_url, $1, $2) WHERE image_url LIKE $3 RETURNING id, title",
      [broken, replacement, "%" + broken + "%"]
    );

    const total = logoRes.rowCount + coverRes.rowCount + offerRes.rowCount;
    if (total > 0) {
      console.log("  " + broken.substring(6, 30) + "... -> " + replacement.substring(6, 30) + "... (" + total + " fixes)");
      fixedCount += total;
    }
  }

  console.log("\nTotal fixes: " + fixedCount);

  // Verify: re-check a sample
  console.log("\nVerifying sample of fixed URLs...");
  const sample = await pool.query(
    "SELECT logo_url, cover_image_url FROM businesses WHERE source = 'seed' ORDER BY RANDOM() LIMIT 10"
  );

  let okCount = 0;
  let failCount = 0;
  for (const row of sample.rows) {
    for (const url of [row.logo_url, row.cover_image_url]) {
      if (!url) continue;
      try {
        const resp = await fetch(url, { method: "HEAD", redirect: "follow" });
        if (resp.ok) okCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
  }
  console.log("  Sample check: " + okCount + " OK, " + failCount + " still broken");

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
