/**
 * Review Summarization Service
 * 
 * This is the main service that orchestrates review summarization:
 * - Fetches reviews from database
 * - Formats them into prompts
 * - Calls Claude API
 * - Caches results in review_summaries table
 * - Handles regeneration logic
 */

const pool = require('../../db');
const { callClaudeWithRetry, formatError } = require('./anthropicClient');
const { 
  SYSTEM_PROMPT, 
  createSummarizationPrompt, 
  validateSummary 
} = require('./prompts');
const { LLM_CONFIG } = require('../../config/llm');

const OFFENSIVE_WORDS = [
  'pula', 'pulaa', 'pulă', 'puli', 'pulii',
  'muie', 'muist', 'muista',
  'fut', 'futu', 'futut', 'fututa',
  'pizda', 'pizd', 'pizdo',
  'sugi', 'suge',
  'dracu', 'dracului',
  'fuck', 'shit', 'bitch', 'cunt'
];

const OFFENSIVE_REGEX = new RegExp(`\\b(${OFFENSIVE_WORDS.join('|')})\\b`, 'i');
const SPECIAL_RUN_REGEX = /[^a-zA-Z0-9\s]{3,}/;
const REPEAT_CHAR_REGEX = /(.)\1{3,}/i;
const VOWEL_REGEX = /[aeiouăâî]/gi;
const LETTER_REGEX = /[a-zA-ZăâîșțĂÂÎȘȚ]/g;
const DIGIT_REGEX = /\d/g;

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isReviewValid(comment) {
  if (!comment) return false;
  const trimmed = comment.trim();

  if (trimmed.length < 8) return false;

  const normalized = normalizeText(trimmed);
  const words = normalized.split(' ').filter(Boolean);
  const alphaWords = words.filter(word => /[a-z]/i.test(word));
  if (alphaWords.length < 3) return false;

  const avgWordLength =
    alphaWords.reduce((sum, word) => sum + word.length, 0) / alphaWords.length;
  if (avgWordLength < 3) return false;

  const alphaCount = (trimmed.match(LETTER_REGEX) || []).length;
  const digitCount = (trimmed.match(DIGIT_REGEX) || []).length;
  const alphaRatio = alphaCount / Math.max(1, alphaCount + digitCount);
  const digitRatio = digitCount / Math.max(1, trimmed.length);

  if (alphaRatio < 0.6) return false;
  if (digitRatio > 0.25) return false;

  const vowelCount = (normalized.match(VOWEL_REGEX) || []).length;
  if (vowelCount < 2) return false;

  if (SPECIAL_RUN_REGEX.test(trimmed)) return false;
  if (REPEAT_CHAR_REGEX.test(trimmed)) return false;

  if (OFFENSIVE_REGEX.test(normalized)) return false;

  return true;
}

function filterReviewsForSummary(reviews) {
  return reviews.filter(review => isReviewValid(review.comment));
}

/**
 * Fetches reviews for a business from the database
 * 
 * @param {number} businessId - The business ID
 * @param {number} [limit] - Maximum number of reviews to fetch
 * @returns {Promise<Array<Object>>} Array of reviews
 */
async function fetchReviewsForBusiness(businessId, limit = LLM_CONFIG.summarization.maxReviewsInPrompt) {
  const result = await pool.query(
    `SELECT
      r.id,
      r.rating,
      r.comment,
      r.created_at,
      COALESCE(u.first_name, 'Utilizator') as first_name,
      COALESCE(u.last_name, '') as last_name
    FROM reviews r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.business_id = $1
    ORDER BY r.created_at DESC
    LIMIT $2`,
    [businessId, limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    rating: row.rating,
    comment: (row.comment || '').substring(0, LLM_CONFIG.summarization.maxReviewCommentLength),
    userName: `${row.first_name || 'Utilizator'} ${row.last_name || ''}`.trim(),
    createdAt: row.created_at
  }));
}

/**
 * Fetches business information
 * 
 * @param {number} businessId - The business ID
 * @returns {Promise<Object>} Business information
 */
async function fetchBusinessInfo(businessId) {
  const result = await pool.query(
    `SELECT b.id, b.name, c.name as category
    FROM businesses b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.id = $1`,
    [businessId]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Business with ID ${businessId} not found`);
  }
  
  return {
    id: result.rows[0].id,
    name: result.rows[0].name,
    category: result.rows[0].category || 'Business'
  };
}

/**
 * Checks if a summary exists and is still valid (not outdated)
 * 
 * @param {number} businessId - The business ID
 * @returns {Promise<Object|null>} Existing summary or null
 */
async function getExistingSummary(businessId) {
  const result = await pool.query(
    `SELECT 
      rs.id,
      rs.summary_text,
      rs.review_count,
      rs.last_review_id,
      rs.generated_at,
      rs.model_used,
      rs.tokens_used,
      (SELECT COUNT(*) FROM reviews WHERE business_id = $1) as current_review_count
    FROM review_summaries rs
    WHERE rs.business_id = $1`,
    [businessId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const summary = result.rows[0];
  
  // Check if summary is outdated (new reviews since generation)
  const newReviewsCount = summary.current_review_count - summary.review_count;
  const needsRegeneration = newReviewsCount >= LLM_CONFIG.summarization.regenerateAfterNewReviews;
  
  return {
    ...summary,
    is_outdated: needsRegeneration,
    new_reviews_count: newReviewsCount
  };
}

/**
 * Generates a summary using Claude API
 * 
 * @param {number} businessId - The business ID
 * @param {Object} [options] - Generation options
 * @param {boolean} [options.force] - Force regeneration even if cached
 * @returns {Promise<Object>} Generated summary with metadata
 */
async function generateSummary(businessId, options = {}) {
  console.log(`[Summarization] Starting generation for business ${businessId}...`);
  
  // 1. Fetch business info
  const business = await fetchBusinessInfo(businessId);
  console.log(`[Summarization] Business: ${business.name} (${business.category})`);
  
  // 2. Fetch reviews
  const rawReviews = await fetchReviewsForBusiness(businessId);
  const reviews = filterReviewsForSummary(rawReviews);
  const skippedCount = rawReviews.length - reviews.length;
  console.log(`[Summarization] Found ${rawReviews.length} reviews (${reviews.length} valid, ${skippedCount} skipped)`);
  
  // 3. Check minimum review count
  if (reviews.length < LLM_CONFIG.summarization.minReviewCount) {
    throw new Error(
      `Insufficient reviews for summarization. ` +
      `Required valid: ${LLM_CONFIG.summarization.minReviewCount}, ` +
      `Found valid: ${reviews.length}`
    );
  }
  
  // 4. Check for existing summary (unless force regeneration)
  if (!options.force) {
    const existing = await getExistingSummary(businessId);
    if (existing && !existing.is_outdated) {
      console.log(`[Summarization] Using cached summary (generated ${existing.generated_at})`);
      return {
        summary: existing.summary_text,
        cached: true,
        generated_at: existing.generated_at,
        review_count: existing.review_count,
        tokens_used: existing.tokens_used
      };
    }
  }
  
  // 5. Create prompt
  const userPrompt = createSummarizationPrompt({
    businessName: business.name,
    businessCategory: business.category,
    reviews: reviews
  });
  
  console.log(`[Summarization] Prompt created (${userPrompt.length} characters)`);
  
  // 6. Call Claude API
  let response;
  try {
    response = await callClaudeWithRetry({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });
  } catch (error) {
    console.error(`[Summarization] API call failed:`, error);
    throw error;
  }
  
  // 7. Extract and validate summary
  const summaryText = response.content[0].text.trim();
  const validation = validateSummary(summaryText);
  
  if (!validation.isValid) {
    console.warn(`[Summarization] Generated summary failed validation:`, validation.issues);
    // You might want to retry here, but for now we'll use it anyway
  }
  
  console.log(`[Summarization] Summary generated: "${summaryText.substring(0, 100)}..."`);
  
  // 8. Calculate total tokens
  const totalTokens = response.usage.input_tokens + response.usage.output_tokens;
  
  // 9. Save to database
  const lastReviewId = reviews[0].id; // Most recent valid review
  const result = await pool.query(
    `INSERT INTO review_summaries 
      (business_id, summary_text, review_count, last_review_id, model_used, tokens_used)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (business_id) 
    DO UPDATE SET
      summary_text = EXCLUDED.summary_text,
      review_count = EXCLUDED.review_count,
      last_review_id = EXCLUDED.last_review_id,
      generated_at = CURRENT_TIMESTAMP,
      model_used = EXCLUDED.model_used,
      tokens_used = EXCLUDED.tokens_used
    RETURNING id, generated_at`,
    [
      businessId,
      validation.summary,
      reviews.length,
      lastReviewId,
      LLM_CONFIG.model,
      totalTokens
    ]
  );
  
  console.log(`[Summarization] Summary saved to database (ID: ${result.rows[0].id})`);
  
  // 10. Return result
  return {
    summary: validation.summary,
    cached: false,
    generated_at: result.rows[0].generated_at,
    review_count: reviews.length,
    tokens_used: totalTokens,
    cost_usd: response.metadata.cost_usd,
    validation: validation
  };
}

/**
 * Returns the latest valid review id (ignoring spam/offensive content)
 *
 * @param {number} businessId - The business ID
 * @returns {Promise<number|null>} Latest valid review id or null
 */
async function getLatestValidReviewId(businessId) {
  const reviews = await fetchReviewsForBusiness(
    businessId,
    LLM_CONFIG.summarization.maxReviewsInPrompt * 3
  );
  const validReviews = filterReviewsForSummary(reviews);
  return validReviews.length > 0 ? validReviews[0].id : null;
}

/**
 * Gets a summary for a business (from cache or generates new)
 * This is the main entry point for getting summaries
 * 
 * @param {number} businessId - The business ID
 * @param {Object} [options] - Options
 * @param {boolean} [options.force] - Force regeneration
 * @returns {Promise<Object>} Summary object
 */
async function getSummary(businessId, options = {}) {
  try {
    return await generateSummary(businessId, options);
  } catch (error) {
    // Format error for user-friendly display
    const formattedError = formatError(error);
    
    // Log original error for debugging
    console.error(`[Summarization] Error getting summary for business ${businessId}:`, {
      originalError: error.message,
      code: formattedError.code
    });
    
    // Re-throw with formatted info
    throw {
      ...error,
      formatted: formattedError
    };
  }
}

/**
 * Invalidates (deletes) the cached summary for a business
 * Call this when reviews are added/edited/deleted
 * 
 * @param {number} businessId - The business ID
 * @returns {Promise<boolean>} True if deleted, false if didn't exist
 */
async function invalidateSummary(businessId) {
  const result = await pool.query(
    'DELETE FROM review_summaries WHERE business_id = $1 RETURNING id',
    [businessId]
  );
  
  const wasDeleted = result.rows.length > 0;
  
  if (wasDeleted) {
    console.log(`[Summarization] Invalidated summary for business ${businessId}`);
  }
  
  return wasDeleted;
}

/**
 * Checks if a business has enough reviews for summarization
 * 
 * @param {number} businessId - The business ID
 * @returns {Promise<Object>} Status object
 */
async function canSummarize(businessId) {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM reviews WHERE business_id = $1',
    [businessId]
  );
  
  const reviewCount = parseInt(result.rows[0].count);
  const minRequired = LLM_CONFIG.summarization.minReviewCount;
  
  return {
    can_summarize: reviewCount >= minRequired,
    review_count: reviewCount,
    min_required: minRequired,
    missing: Math.max(0, minRequired - reviewCount)
  };
}

module.exports = {
  getSummary,
  generateSummary,
  invalidateSummary,
  canSummarize,
  getExistingSummary,
  getLatestValidReviewId,
  filterReviewsForSummary
};
