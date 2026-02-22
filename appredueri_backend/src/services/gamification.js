const pool = require("../db");

const POINT_VALUES = {
  favorite: 5,
  reveal_code: 10,
  write_review: 20,
  share: 5,
  first_favorite: 50,
  streak_daily: 10,
  streak_7: 50,
  streak_30: 200,
};

const LEVELS = [
  { name: "Explorator", min: 0, icon: "explore" },
  { name: "Econom", min: 100, icon: "account_balance_wallet" },
  { name: "Expert Reduceri", min: 500, icon: "star" },
  { name: "VIP OFAI", min: 1500, icon: "workspace_premium" },
];

const BADGES = {
  first_save: { label: "Prima salvare", description: "Salveaza prima oferta", icon: "bookmark" },
  reviewer: { label: "Recenzent", description: "Scrie prima recenzie", icon: "rate_review" },
  social: { label: "Social Butterfly", description: "Share 5 oferte", icon: "share" },
  loyal: { label: "Fidel", description: "Streak 7 zile", icon: "local_fire_department" },
  collector: { label: "Colectionar", description: "20 oferte salvate", icon: "collections_bookmark" },
  explorer: { label: "Explorator de orase", description: "Oferte din 3 orase", icon: "map" },
  fan: { label: "Fan #1", description: "Urmareste 10 business-uri", icon: "favorite" },
};

async function awardPoints(userId, action, referenceId = null, referenceType = null) {
  const points = POINT_VALUES[action];
  if (!points) return;

  await pool.query(
    `INSERT INTO point_transactions (user_id, action, points, reference_id, reference_type)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, points, referenceId, referenceType]
  );
  await pool.query(
    `UPDATE users SET points = points + $1 WHERE id = $2`,
    [points, userId]
  );
}

async function updateStreak(userId) {
  const result = await pool.query(
    `SELECT last_visit_date, current_streak FROM users WHERE id = $1`,
    [userId]
  );
  if (result.rows.length === 0) return;

  const { last_visit_date, current_streak } = result.rows[0];
  const today = new Date().toISOString().split("T")[0];

  if (last_visit_date === today) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  let newStreak;

  if (last_visit_date === yesterday) {
    newStreak = (current_streak || 0) + 1;
  } else {
    newStreak = 1;
  }

  await pool.query(
    `UPDATE users SET last_visit_date = $1, current_streak = $2 WHERE id = $3`,
    [today, newStreak, userId]
  );

  await awardPoints(userId, "streak_daily");

  if (newStreak === 7) await awardPoints(userId, "streak_7");
  if (newStreak === 30) await awardPoints(userId, "streak_30");
}

async function checkBadges(userId) {
  const unlocked = [];

  const favCount = await pool.query(`SELECT COUNT(*) FROM favorite_offers WHERE user_id = $1`, [userId]);
  const reviewCount = await pool.query(`SELECT COUNT(*) FROM reviews WHERE user_id = $1`, [userId]);
  const subCount = await pool.query(`SELECT COUNT(*) FROM followed_businesses WHERE user_id = $1`, [userId]);
  const streak = await pool.query(`SELECT current_streak FROM users WHERE id = $1`, [userId]);

  const checks = {
    first_save: parseInt(favCount.rows[0].count) >= 1,
    reviewer: parseInt(reviewCount.rows[0].count) >= 1,
    collector: parseInt(favCount.rows[0].count) >= 20,
    fan: parseInt(subCount.rows[0].count) >= 10,
    loyal: (streak.rows[0]?.current_streak || 0) >= 7,
  };

  for (const [badge, earned] of Object.entries(checks)) {
    if (earned) {
      try {
        const result = await pool.query(
          `INSERT INTO user_badges (user_id, badge_type)
           VALUES ($1, $2)
           ON CONFLICT (user_id, badge_type) DO NOTHING
           RETURNING *`,
          [userId, badge]
        );
        if (result.rows.length > 0) unlocked.push(badge);
      } catch (_) { /* ignore */ }
    }
  }

  return unlocked;
}

function getLevel(points) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (points >= l.min) level = l;
  }
  return level;
}

function getNextLevel(points) {
  for (const l of LEVELS) {
    if (points < l.min) return l;
  }
  return null;
}

module.exports = { awardPoints, updateStreak, checkBadges, getLevel, getNextLevel, BADGES, LEVELS, POINT_VALUES };
