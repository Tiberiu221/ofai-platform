/**
 * Cleanup Script: Delete all users with DB cleanup
 *
 * Usage: node scripts/cleanup-users.js
 *
 * Steps:
 * 1. Count before
 * 2. Delete child tables in dependency order (don't rely on CASCADE)
 * 3. Delete all users
 * 4. Reset sequence counter
 * 5. Verify cleanup
 *
 * NOTE: Run AFTER cleanup-businesses.js — businesses should already be deleted.
 *       If businesses still exist, user_businesses deletion will handle the links.
 */

require('dotenv').config();
const pool = require('../src/db');

async function main() {
  console.log('=== USER CLEANUP SCRIPT ===\n');

  // ── Step 0: Count before ──
  console.log('--- BEFORE COUNTS ---');
  const beforeCounts = await pool.query(`
    SELECT 'users' AS tabel, COUNT(*)::int AS cnt FROM users
    UNION ALL SELECT 'refresh_tokens', COUNT(*)::int FROM refresh_tokens
    UNION ALL SELECT 'password_reset_tokens', COUNT(*)::int FROM password_reset_tokens
    UNION ALL SELECT 'push_tokens', COUNT(*)::int FROM push_tokens
    UNION ALL SELECT 'user_points', COUNT(*)::int FROM user_points
    UNION ALL SELECT 'favorite_offers', COUNT(*)::int FROM favorite_offers
    UNION ALL SELECT 'followed_businesses', COUNT(*)::int FROM followed_businesses
    UNION ALL SELECT 'reviews', COUNT(*)::int FROM reviews
    UNION ALL SELECT 'review_responses', COUNT(*)::int FROM review_responses
    UNION ALL SELECT 'business_requests', COUNT(*)::int FROM business_requests
    UNION ALL SELECT 'user_businesses', COUNT(*)::int FROM user_businesses
    UNION ALL SELECT 'points_history', COUNT(*)::int FROM points_history
    UNION ALL SELECT 'code_reveals', COUNT(*)::int FROM code_reveals
    UNION ALL SELECT 'user_streaks', COUNT(*)::int FROM user_streaks
    UNION ALL SELECT 'user_badges', COUNT(*)::int FROM user_badges
    UNION ALL SELECT 'offer_requests', COUNT(*)::int FROM offer_requests
    UNION ALL SELECT 'audit_log', COUNT(*)::int FROM audit_log
    ORDER BY tabel
  `);
  for (const row of beforeCounts.rows) {
    console.log(`  ${row.tabel}: ${row.cnt}`);
  }

  const userCount = beforeCounts.rows.find(r => r.tabel === 'users')?.cnt || 0;
  if (userCount === 0) {
    console.log('\nNo users to delete. Exiting.');
    await pool.end();
    process.exit(0);
  }

  console.log(`\nWill delete ${userCount} users and all related data.\n`);

  // ── Step 1: Database cleanup ──
  console.log('--- STEP 1: DATABASE CLEANUP ---');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete in dependency order (deepest children first)

    // 1a. Auth tokens
    const rt = await client.query("DELETE FROM refresh_tokens");
    console.log(`  refresh_tokens deleted: ${rt.rowCount}`);
    const prt = await client.query("DELETE FROM password_reset_tokens");
    console.log(`  password_reset_tokens deleted: ${prt.rowCount}`);
    const pt = await client.query("DELETE FROM push_tokens");
    console.log(`  push_tokens deleted: ${pt.rowCount}`);

    // 1b. Gamification
    const up = await client.query("DELETE FROM user_points");
    console.log(`  user_points deleted: ${up.rowCount}`);
    const ph = await client.query("DELETE FROM points_history");
    console.log(`  points_history deleted: ${ph.rowCount}`);
    const us = await client.query("DELETE FROM user_streaks");
    console.log(`  user_streaks deleted: ${us.rowCount}`);
    const ub2 = await client.query("DELETE FROM user_badges");
    console.log(`  user_badges deleted: ${ub2.rowCount}`);

    // 1c. Favorites & follows (may already be empty if businesses cleaned)
    const fo = await client.query("DELETE FROM favorite_offers");
    console.log(`  favorite_offers deleted: ${fo.rowCount}`);
    const fb = await client.query("DELETE FROM followed_businesses");
    console.log(`  followed_businesses deleted: ${fb.rowCount}`);

    // 1d. Offer requests
    const or2 = await client.query("DELETE FROM offer_requests");
    console.log(`  offer_requests deleted: ${or2.rowCount}`);

    // 1e. Code reveals
    const cr = await client.query("DELETE FROM code_reveals");
    console.log(`  code_reveals deleted: ${cr.rowCount}`);

    // 1f. Reviews (delete completely — businesses already cleaned)
    const rr = await client.query("DELETE FROM review_responses");
    console.log(`  review_responses deleted: ${rr.rowCount}`);
    const rv = await client.query("DELETE FROM reviews");
    console.log(`  reviews deleted: ${rv.rowCount}`);

    // 1g. Business requests (no CASCADE FK on user_id)
    const br = await client.query("DELETE FROM business_requests");
    console.log(`  business_requests deleted: ${br.rowCount}`);

    // 1h. User-business ownership links
    const ub = await client.query("DELETE FROM user_businesses");
    console.log(`  user_businesses deleted: ${ub.rowCount}`);

    // 1i. Audit log — nullify user references (keep log entries for compliance)
    const al = await client.query("UPDATE audit_log SET user_id = NULL WHERE user_id IS NOT NULL");
    console.log(`  audit_log nullified: ${al.rowCount}`);

    // 1j. Finally: delete all users
    const delRes = await client.query("DELETE FROM users");
    console.log(`  users deleted: ${delRes.rowCount}`);

    // 1k. Reset sequence counter
    await client.query("ALTER SEQUENCE users_id_seq RESTART WITH 1");
    console.log('  Sequence users_id_seq reset to 1');

    await client.query('COMMIT');
    console.log('\n  COMMIT successful!\n');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n  ROLLBACK — Error:', err.message);
    throw err;
  } finally {
    client.release();
  }

  // ── Step 2: Verify ──
  console.log('--- AFTER COUNTS ---');
  const afterCounts = await pool.query(`
    SELECT 'users' AS tabel, COUNT(*)::int AS cnt FROM users
    UNION ALL SELECT 'refresh_tokens', COUNT(*)::int FROM refresh_tokens
    UNION ALL SELECT 'password_reset_tokens', COUNT(*)::int FROM password_reset_tokens
    UNION ALL SELECT 'push_tokens', COUNT(*)::int FROM push_tokens
    UNION ALL SELECT 'user_points', COUNT(*)::int FROM user_points
    UNION ALL SELECT 'reviews', COUNT(*)::int FROM reviews
    UNION ALL SELECT 'business_requests', COUNT(*)::int FROM business_requests
    UNION ALL SELECT 'user_businesses', COUNT(*)::int FROM user_businesses
    UNION ALL SELECT 'user_streaks', COUNT(*)::int FROM user_streaks
    UNION ALL SELECT 'user_badges', COUNT(*)::int FROM user_badges
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
