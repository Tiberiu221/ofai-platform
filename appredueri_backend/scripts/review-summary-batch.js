/**
 * Review Summary Batch Job (Scheduled)
 *
 * Runs every 2 days via Railway Cron:
 * - Checks all businesses with 3+ reviews
 * - Regenerates summaries ONLY if there are new valid reviews
 * - Skips spam/offensive reviews
 *
 * Usage:
 *   node scripts/review-summary-batch.js
 */

require('dotenv').config();

const pool = require('../src/db');
const { LLM_CONFIG } = require('../src/config/llm');
const {
  generateSummary,
  getExistingSummary,
  getLatestValidReviewId
} = require('../src/services/llm/summarizationService');

const SLEEP_MS = parseInt(process.env.REVIEW_SUMMARY_SLEEP_MS || '750', 10);
const BATCH_LIMIT = parseInt(process.env.REVIEW_SUMMARY_BATCH_LIMIT || '0', 10);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchBusinessesWithReviews(minReviews) {
  const result = await pool.query(
    `
    SELECT b.id, b.name, COUNT(r.id) AS review_count
    FROM businesses b
    JOIN reviews r ON r.business_id = b.id
    GROUP BY b.id, b.name
    HAVING COUNT(r.id) >= $1
    ORDER BY COUNT(r.id) DESC
    `,
    [minReviews]
  );

  return result.rows;
}

async function runBatch() {
  const startTime = Date.now();
  const minReviews = LLM_CONFIG.summarization.minReviewCount;

  console.log('==============================================');
  console.log('🤖 Review Summary Batch Job - START');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`🔁 Frequency: every 2 days (Railway Cron)`);
  console.log('==============================================\n');

  const businesses = await fetchBusinessesWithReviews(minReviews);
  const totalBusinesses = businesses.length;

  const stats = {
    processed: 0,
    regenerated: 0,
    skipped: 0,
    skipped_no_valid: 0,
    errors: 0,
    total_cost_usd: 0
  };

  const candidates = BATCH_LIMIT > 0 ? businesses.slice(0, BATCH_LIMIT) : businesses;

  console.log(`📊 Businesses with ${minReviews}+ reviews: ${totalBusinesses}`);
  if (BATCH_LIMIT > 0) {
    console.log(`🔎 Batch limit active: ${BATCH_LIMIT}`);
  }
  console.log('');

  for (const business of candidates) {
    stats.processed += 1;
    const businessId = business.id;

    try {
      const existing = await getExistingSummary(businessId);
      const latestValidReviewId = await getLatestValidReviewId(businessId);

      if (!latestValidReviewId) {
        stats.skipped += 1;
        stats.skipped_no_valid += 1;
        console.log(`⏭️  ${business.name} (ID ${businessId}) - skipped (no valid reviews)`);
        continue;
      }

      const needsRegeneration =
        !existing || existing.last_review_id !== latestValidReviewId;

      if (!needsRegeneration) {
        stats.skipped += 1;
        console.log(`⏭️  ${business.name} (ID ${businessId}) - up to date`);
        continue;
      }

      const result = await generateSummary(businessId, { force: true });
      stats.regenerated += 1;
      stats.total_cost_usd += result.cost_usd || 0;

      console.log(
        `✅ ${business.name} (ID ${businessId}) - regenerated ` +
        `(${result.review_count} valid reviews, $${(result.cost_usd || 0).toFixed(6)})`
      );

      await sleep(SLEEP_MS);
    } catch (error) {
      stats.errors += 1;
      const message = error?.formatted?.message || error.message || 'Unknown error';
      console.error(`❌ ${business.name} (ID ${businessId}) - ${message}`);
    }
  }

  const elapsedSec = Math.round((Date.now() - startTime) / 1000);

  console.log('\n==============================================');
  console.log('🤖 Review Summary Batch Job - DONE');
  console.log('==============================================');
  console.log(`✅ Processed: ${stats.processed}`);
  console.log(`✅ Regenerated: ${stats.regenerated}`);
  console.log(`⏭️  Skipped: ${stats.skipped} (no valid: ${stats.skipped_no_valid})`);
  console.log(`❌ Errors: ${stats.errors}`);
  console.log(`💰 Total cost: $${stats.total_cost_usd.toFixed(6)}`);
  console.log(`⏱️  Elapsed: ${elapsedSec}s`);
  console.log('==============================================\n');
}

runBatch()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Batch job failed:', err);
    process.exit(1);
  });
