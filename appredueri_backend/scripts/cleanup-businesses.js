/**
 * Cleanup Script: Delete all businesses with Cloudinary + DB cleanup
 *
 * Usage: node scripts/cleanup-businesses.js
 *
 * Steps:
 * 1. Delete all Cloudinary images (logos, covers, gallery)
 * 2. Clean up business_requests (no CASCADE FK)
 * 3. Delete review_responses + reviews (SET NULL FK — we want full delete)
 * 4. Delete all businesses (CASCADE handles 16+ child tables)
 * 5. Reset sequence counters
 * 6. Verify cleanup
 */

require('dotenv').config();
const pool = require('../src/db');
const { deleteFromCloudinary, getPublicIdFromUrl } = require('../src/services/cloudinary');

async function main() {
  console.log('=== BUSINESS CLEANUP SCRIPT ===\n');

  // ── Step 0: Count before ──
  console.log('--- BEFORE COUNTS ---');
  const beforeCounts = await pool.query(`
    SELECT 'businesses' AS tabel, COUNT(*)::int AS cnt FROM businesses
    UNION ALL SELECT 'offers', COUNT(*)::int FROM offers
    UNION ALL SELECT 'reviews', COUNT(*)::int FROM reviews
    UNION ALL SELECT 'business_images', COUNT(*)::int FROM business_images
    UNION ALL SELECT 'business_subscriptions', COUNT(*)::int FROM business_subscriptions
    UNION ALL SELECT 'user_businesses', COUNT(*)::int FROM user_businesses
    ORDER BY tabel
  `);
  for (const row of beforeCounts.rows) {
    console.log(`  ${row.tabel}: ${row.cnt}`);
  }

  const bizCount = beforeCounts.rows.find(r => r.tabel === 'businesses')?.cnt || 0;
  if (bizCount === 0) {
    console.log('\nNo businesses to delete. Exiting.');
    await pool.end();
    process.exit(0);
  }

  console.log(`\nWill delete ${bizCount} businesses and all related data.\n`);

  // ── Step 1: Cloudinary cleanup ──
  console.log('--- STEP 1: CLOUDINARY CLEANUP ---');

  // 1a. Logos + covers
  const bizRes = await pool.query("SELECT id, logo_url, cover_image_url FROM businesses");
  let cloudDeleted = 0;
  let cloudErrors = 0;

  for (const biz of bizRes.rows) {
    if (biz.logo_url) {
      const publicId = getPublicIdFromUrl(biz.logo_url);
      if (publicId) {
        const ok = await deleteFromCloudinary(publicId);
        if (ok) cloudDeleted++; else cloudErrors++;
      }
    }
    if (biz.cover_image_url) {
      const publicId = getPublicIdFromUrl(biz.cover_image_url);
      if (publicId) {
        const ok = await deleteFromCloudinary(publicId);
        if (ok) cloudDeleted++; else cloudErrors++;
      }
    }
  }

  // 1b. Gallery images
  const imgRes = await pool.query("SELECT image_url FROM business_images WHERE image_url IS NOT NULL");
  for (const img of imgRes.rows) {
    const publicId = getPublicIdFromUrl(img.image_url);
    if (publicId) {
      const ok = await deleteFromCloudinary(publicId);
      if (ok) cloudDeleted++; else cloudErrors++;
    }
  }

  console.log(`  Cloudinary: ${cloudDeleted} deleted, ${cloudErrors} errors\n`);

  // ── Step 2: Database cleanup ──
  console.log('--- STEP 2: DATABASE CLEANUP ---');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // NOTE: CASCADE constraints may not be properly applied in production.
    // Delete explicitly in dependency order (same approach as admin.js L733-754).

    // 2a. Deepest children first: offer child tables
    const cr = await client.query("DELETE FROM code_reveals WHERE offer_id IN (SELECT id FROM offers)");
    console.log(`  code_reveals deleted: ${cr.rowCount}`);
    const pc = await client.query("DELETE FROM promo_codes WHERE offer_id IN (SELECT id FROM offers)");
    console.log(`  promo_codes deleted: ${pc.rowCount}`);
    const ov = await client.query("DELETE FROM offer_views WHERE offer_id IN (SELECT id FROM offers)");
    console.log(`  offer_views deleted: ${ov.rowCount}`);
    const fo = await client.query("DELETE FROM favorite_offers WHERE offer_id IN (SELECT id FROM offers)");
    console.log(`  favorite_offers deleted: ${fo.rowCount}`);
    const ol = await client.query("DELETE FROM offer_locations");
    console.log(`  offer_locations deleted: ${ol.rowCount}`);
    const or2 = await client.query("DELETE FROM offer_requests");
    console.log(`  offer_requests deleted: ${or2.rowCount}`);

    // 2b. Offers
    const offRes = await client.query("DELETE FROM offers");
    console.log(`  offers deleted: ${offRes.rowCount}`);

    // 2c. Review child tables
    const rrRes = await client.query("DELETE FROM review_responses");
    console.log(`  review_responses deleted: ${rrRes.rowCount}`);
    const rsRes = await client.query("DELETE FROM review_summaries");
    console.log(`  review_summaries deleted: ${rsRes.rowCount}`);
    const revRes = await client.query("DELETE FROM reviews");
    console.log(`  reviews deleted: ${revRes.rowCount}`);

    // 2d. Analytics + relationships
    const bv = await client.query("DELETE FROM business_views");
    console.log(`  business_views deleted: ${bv.rowCount}`);
    const bc = await client.query("DELETE FROM business_clicks");
    console.log(`  business_clicks deleted: ${bc.rowCount}`);
    const fb2 = await client.query("DELETE FROM followed_businesses");
    console.log(`  followed_businesses deleted: ${fb2.rowCount}`);
    const ub = await client.query("DELETE FROM user_businesses");
    console.log(`  user_businesses deleted: ${ub.rowCount}`);

    // 2e. Subscription tables
    const sh = await client.query("DELETE FROM subscription_history");
    console.log(`  subscription_history deleted: ${sh.rowCount}`);
    const bs = await client.query("DELETE FROM business_subscriptions");
    console.log(`  business_subscriptions deleted: ${bs.rowCount}`);

    // 2f. Other business tables
    const dn = await client.query("DELETE FROM deal_nominations");
    console.log(`  deal_nominations deleted: ${dn.rowCount}`);
    const bp = await client.query("DELETE FROM business_push_log");
    console.log(`  business_push_log deleted: ${bp.rowCount}`);
    const bl = await client.query("DELETE FROM business_locations");
    console.log(`  business_locations deleted: ${bl.rowCount}`);
    const bi = await client.query("DELETE FROM business_images");
    console.log(`  business_images deleted: ${bi.rowCount}`);

    // 2g. business_requests (no CASCADE FK)
    const brRes = await client.query("UPDATE business_requests SET business_id = NULL WHERE business_id IS NOT NULL");
    console.log(`  business_requests nullified: ${brRes.rowCount}`);

    // 2h. Finally: delete all businesses
    const delRes = await client.query("DELETE FROM businesses");
    console.log(`  businesses deleted: ${delRes.rowCount}`);

    // 2d. Reset sequence counters
    await client.query("ALTER SEQUENCE businesses_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE offers_id_seq RESTART WITH 1");
    console.log('  Sequences reset to 1');

    await client.query('COMMIT');
    console.log('\n  COMMIT successful!\n');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n  ROLLBACK — Error:', err.message);
    throw err;
  } finally {
    client.release();
  }

  // ── Step 3: Verify ──
  console.log('--- AFTER COUNTS ---');
  const afterCounts = await pool.query(`
    SELECT 'businesses' AS tabel, COUNT(*)::int AS cnt FROM businesses
    UNION ALL SELECT 'offers', COUNT(*)::int FROM offers
    UNION ALL SELECT 'reviews', COUNT(*)::int FROM reviews
    UNION ALL SELECT 'business_images', COUNT(*)::int FROM business_images
    UNION ALL SELECT 'business_subscriptions', COUNT(*)::int FROM business_subscriptions
    UNION ALL SELECT 'user_businesses', COUNT(*)::int FROM user_businesses
    UNION ALL SELECT 'followed_businesses', COUNT(*)::int FROM followed_businesses
    UNION ALL SELECT 'business_views', COUNT(*)::int FROM business_views
    ORDER BY tabel
  `);
  let allZero = true;
  for (const row of afterCounts.rows) {
    const status = row.cnt === 0 ? '✓' : '✗';
    if (row.cnt !== 0) allZero = false;
    console.log(`  ${status} ${row.tabel}: ${row.cnt}`);
  }

  console.log(allZero ? '\n=== CLEANUP COMPLETE ===' : '\n=== WARNING: Some tables still have data ===');

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  pool.end().then(() => process.exit(1));
});
