const pool = require("../db");

// ============================================
// BADGE SERVICE — Gamification layer
// ============================================

/**
 * Conditions for each badge slug.
 *
 * Two formats are supported:
 *  - Simple count: { table, minCount } — counts rows in `table` WHERE user_id = userId
 *  - Custom query: { customQuery, minCount } — executes the SQL string with $1 = userId,
 *      expects a single row with column `cnt`
 *  - Special check: { countQuery, check } — executes a raw SELECT and passes the rows
 *      plus the userId to a predicate function
 */
const BADGE_CONDITIONS = {
  early_adopter: {
    countQuery: "SELECT id FROM users ORDER BY id LIMIT 100",
    check: (userId, rows) => rows.some((r) => r.id === userId),
  },
  first_review: { table: "reviews", minCount: 1 },
  reviewer_bronze: { table: "reviews", minCount: 5 },
  reviewer_silver: { table: "reviews", minCount: 10 },
  reviewer_gold: { table: "reviews", minCount: 25 },
  first_favorite: { table: "favorite_offers", minCount: 1 },
  social_butterfly: { table: "followed_businesses", minCount: 5 },
  loyal_fan: { table: "followed_businesses", minCount: 15 },
  code_hunter: { table: "code_reveals", minCount: 10 },
  explorer: {
    minCount: 10,
    customQuery: `
      SELECT COUNT(DISTINCT business_id) AS cnt
      FROM (
        SELECT business_id FROM reviews          WHERE user_id = $1
        UNION
        SELECT business_id FROM followed_businesses WHERE user_id = $1
      ) AS visited
    `,
  },
};

// ============================================
// Internal helpers
// ============================================

/**
 * Returns true if the user has already earned the badge identified by `slug`.
 *
 * @param {number} userId
 * @param {string} slug
 * @returns {Promise<boolean>}
 */
async function isAlreadyEarned(userId, slug) {
  const result = await pool.query(
    `SELECT 1
     FROM user_badges ub
     JOIN badge_definitions bd ON bd.id = ub.badge_id
     WHERE ub.user_id = $1
       AND bd.slug    = $2`,
    [userId, slug]
  );
  return result.rowCount > 0;
}

/**
 * Evaluates whether the user currently meets the condition for a given badge slug.
 *
 * @param {number} userId
 * @param {string} slug
 * @returns {Promise<boolean>}
 */
async function conditionMet(userId, slug) {
  const condition = BADGE_CONDITIONS[slug];
  if (!condition) return false;

  // --- Special "early adopter" pattern: raw query + predicate ----------------
  if (condition.countQuery && condition.check) {
    const result = await pool.query(condition.countQuery);
    return condition.check(userId, result.rows);
  }

  // --- Custom aggregate query ------------------------------------------------
  if (condition.customQuery) {
    const result = await pool.query(condition.customQuery, [userId]);
    const cnt = parseInt(result.rows[0]?.cnt ?? "0", 10);
    return cnt >= condition.minCount;
  }

  // --- Simple table count ----------------------------------------------------
  if (condition.table) {
    const result = await pool.query(
      `SELECT COUNT(*) AS cnt FROM ${condition.table} WHERE user_id = $1`,
      [userId]
    );
    const cnt = parseInt(result.rows[0]?.cnt ?? "0", 10);
    return cnt >= condition.minCount;
  }

  return false;
}

/**
 * Inserts a badge award row for the user. Uses ON CONFLICT DO NOTHING as a
 * safety net against race conditions (the UNIQUE constraint on user_badges
 * also prevents duplicates at the DB level).
 *
 * @param {number} userId
 * @param {string} slug
 * @returns {Promise<void>}
 */
async function awardBadge(userId, slug) {
  await pool.query(
    `INSERT INTO user_badges (user_id, badge_id)
     SELECT $1, id FROM badge_definitions WHERE slug = $2
     ON CONFLICT DO NOTHING`,
    [userId, slug]
  );
}

// ============================================
// Public API
// ============================================

/**
 * Checks a set of badge slugs for a user and awards any that the user now
 * qualifies for but has not yet earned.
 *
 * This function is designed to be called in a fire-and-forget style after
 * user actions (reviews, favorites, follows, etc.). It catches and logs all
 * errors internally so that badge failures never propagate to the caller.
 *
 * @param {number} userId - The user to check.
 * @param {string[]} badgeSlugsToCheck - Subset of badge slugs relevant to the
 *   action that was just performed.
 * @returns {Promise<string[]>} Slugs of badges that were newly awarded.
 *   Returns an empty array on any error.
 */
async function checkAndAwardBadges(userId, badgeSlugsToCheck) {
  const newlyEarned = [];

  try {
    for (const slug of badgeSlugsToCheck) {
      try {
        if (await isAlreadyEarned(userId, slug)) continue;
        if (await conditionMet(userId, slug)) {
          await awardBadge(userId, slug);
          newlyEarned.push(slug);
        }
      } catch (slugErr) {
        // A single badge check failing should not abort the rest
        console.error(`[badgeService] Eroare la verificarea badge-ului '${slug}' pentru user ${userId}:`, slugErr);
      }
    }
  } catch (err) {
    console.error(`[badgeService] Eroare generala la checkAndAwardBadges pentru user ${userId}:`, err);
  }

  return newlyEarned;
}

/**
 * Returns all badges earned by a user, ordered by badge sort_order.
 *
 * @param {number} userId
 * @returns {Promise<Array<{slug: string, name: string, description: string, icon: string, color: string, category: string, earned_at: Date}>>}
 */
async function getUserBadges(userId) {
  const result = await pool.query(
    `SELECT bd.id,
            bd.slug,
            bd.name,
            bd.description,
            bd.icon,
            bd.color,
            bd.category,
            ub.earned_at
     FROM user_badges ub
     JOIN badge_definitions bd ON bd.id = ub.badge_id
     WHERE ub.user_id = $1
     ORDER BY bd.sort_order ASC`,
    [userId]
  );
  return result.rows;
}

/**
 * Returns the full catalogue of badge definitions, ordered by sort_order.
 * Useful for displaying all possible badges (earned or not) in a UI.
 *
 * @returns {Promise<Array<{slug: string, name: string, description: string, icon: string, color: string, category: string, sort_order: number}>>}
 */
async function getAllBadgeDefinitions() {
  const result = await pool.query(
    `SELECT slug,
            name,
            description,
            icon,
            color,
            category,
            sort_order
     FROM badge_definitions
     ORDER BY sort_order`
  );
  return result.rows;
}

module.exports = {
  checkAndAwardBadges,
  getUserBadges,
  getAllBadgeDefinitions,
};
