/**
 * Gamification Service
 * Points, levels, streaks — fire-and-forget calls
 */
const pool = require("../db");

// Points awarded per action
const POINTS_MAP = {
  review: 5,
  favorite: 2,
  follow: 2,
  code_reveal: 3,
  daily_login: 1,
};

/**
 * Award points to a user (fire-and-forget safe)
 * @param {number} userId
 * @param {string} action - key from POINTS_MAP
 */
async function awardPoints(userId, action) {
  const pts = POINTS_MAP[action];
  if (!pts || !userId) return;
  try {
    await pool.query(
      `INSERT INTO user_points (user_id, total_points)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET total_points = user_points.total_points + $2, updated_at = NOW()`,
      [userId, pts]
    );
  } catch (err) {
    console.error("[gamification] awardPoints error:", err.message);
  }
}

/**
 * Update login streak for a user.
 * Increments if last activity was yesterday, resets to 1 if gap > 1 day.
 * @param {number} userId
 */
async function updateStreak(userId) {
  if (!userId) return;
  try {
    const res = await pool.query(
      "SELECT current_streak, last_activity_date FROM user_streaks WHERE user_id = $1",
      [userId]
    );

    const today = new Date().toISOString().slice(0, 10);

    if (res.rows.length === 0) {
      // First time — create streak
      await pool.query(
        "INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date) VALUES ($1, 1, 1, $2) ON CONFLICT DO NOTHING",
        [userId, today]
      );
      return;
    }

    const row = res.rows[0];
    const lastDate = row.last_activity_date
      ? new Date(row.last_activity_date).toISOString().slice(0, 10)
      : null;

    if (lastDate === today) return; // Already counted today

    // Award daily login point (once per day, inside streak update)
    awardPoints(userId, "daily_login").catch(() => {});

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (lastDate === yesterdayStr) {
      // Consecutive day
      const newStreak = (row.current_streak || 0) + 1;
      const longest = Math.max(newStreak, row.longest_streak || 0);
      await pool.query(
        "UPDATE user_streaks SET current_streak = $1, longest_streak = $2, last_activity_date = $3 WHERE user_id = $4",
        [newStreak, longest, today, userId]
      );
    } else {
      // Streak broken — reset to 1
      await pool.query(
        "UPDATE user_streaks SET current_streak = 1, last_activity_date = $1 WHERE user_id = $2",
        [today, userId]
      );
    }
  } catch (err) {
    console.error("[gamification] updateStreak error:", err.message);
  }
}

/**
 * Get streak info for a user
 * @param {number} userId
 * @returns {Promise<{current_streak: number, longest_streak: number}>}
 */
async function getStreak(userId) {
  try {
    const res = await pool.query(
      "SELECT current_streak, longest_streak FROM user_streaks WHERE user_id = $1",
      [userId]
    );
    if (res.rows.length === 0) return { current_streak: 0, longest_streak: 0 };
    return res.rows[0];
  } catch (err) {
    console.error("[gamification] getStreak error:", err.message);
    return { current_streak: 0, longest_streak: 0 };
  }
}

/**
 * Calculate level info from points
 * @param {number} points
 * @returns {{ level: string, nextLevel: string|null, progress: number, pointsNeeded: number }}
 */
function getLevelInfo(points) {
  if (points >= 1000) return { level: "God Mode", nextLevel: null, progress: 100, pointsNeeded: 1000 };
  if (points >= 500) return { level: "Legend", nextLevel: "God Mode", progress: ((points - 500) / 500) * 100, pointsNeeded: 1000 };
  if (points >= 100) return { level: "Local Hero", nextLevel: "Legend", progress: ((points - 100) / 400) * 100, pointsNeeded: 500 };
  return { level: "Explorer", nextLevel: "Local Hero", progress: (points / 100) * 100, pointsNeeded: 100 };
}

module.exports = { awardPoints, updateStreak, getStreak, getLevelInfo, POINTS_MAP };
