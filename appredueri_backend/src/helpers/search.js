/**
 * Search helper — centralized fuzzy search SQL generation
 * Uses pg_trgm + unaccent for typo tolerance and diacritics normalization
 */

const SIMILARITY_THRESHOLD = 0.15;
const SIMILARITY_THRESHOLD_DESC = 0.1;
const SIMILARITY_THRESHOLD_SUGGEST = 0.2;

/**
 * Sanitize search query — strip LIKE wildcards, trim, limit length
 */
function escapeSearchQuery(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[%_\\]/g, '').trim().substring(0, 100);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Build fuzzy search WHERE conditions
 * @param {string} query - sanitized search query
 * @param {object} opts
 * @param {number} opts.paramIdx - starting parameter index ($N)
 * @param {'offers'|'businesses'|'suggest'} opts.mode
 * @param {object} opts.aliases - table aliases { offer, business, category, city }
 * @param {boolean} [opts.includeTierJoin] - whether splan alias is available
 * @returns {{ conditions: string[], params: any[], nextIdx: number }}
 */
function buildSearchConditions(query, opts = {}) {
  const q = escapeSearchQuery(query);
  if (!q) return { conditions: [], params: [], nextIdx: opts.paramIdx || 1 };

  const idx = opts.paramIdx || 1;
  const a = Object.assign({ offer: 'o', business: 'b', category: 'cat', city: 'ci' }, opts.aliases);
  const mode = opts.mode || 'offers';

  const parts = [];
  const norm = (col) => `f_unaccent(lower(${col}))`;
  const param = `f_unaccent(lower($${idx}))`;
  const threshold = mode === 'suggest' ? SIMILARITY_THRESHOLD_SUGGEST : SIMILARITY_THRESHOLD;

  if (mode === 'offers' || mode === 'suggest') {
    // Prefix match (uses GIN index)
    parts.push(`${norm(`${a.offer}.title`)} LIKE ${param} || '%'`);
    parts.push(`${norm(`${a.business}.name`)} LIKE ${param} || '%'`);
    // Fuzzy match (similarity with trigram index)
    parts.push(`similarity(${norm(`${a.offer}.title`)}, ${param}) > ${threshold}`);
    parts.push(`similarity(${norm(`${a.business}.name`)}, ${param}) > ${threshold}`);
    // Category name search (important: "frizerie", "restaurant" etc. are common queries)
    if (a.category) {
      parts.push(`${norm(`${a.category}.name`)} LIKE ${param} || '%'`);
      parts.push(`similarity(${norm(`${a.category}.name`)}, ${param}) > ${threshold}`);
    }
    // Description — only for full search, not suggest (too slow)
    if (mode === 'offers') {
      parts.push(`similarity(${norm(`${a.offer}.description`)}, ${param}) > ${SIMILARITY_THRESHOLD_DESC}`);
    }
  } else if (mode === 'businesses') {
    parts.push(`${norm(`${a.business}.name`)} LIKE ${param} || '%'`);
    parts.push(`similarity(${norm(`${a.business}.name`)}, ${param}) > ${threshold}`);
    // Also search category name
    if (a.category) {
      parts.push(`${norm(`${a.category}.name`)} LIKE ${param} || '%'`);
    }
  }

  return {
    conditions: [`(${parts.join('\n    OR ')})`],
    params: [q],
    nextIdx: idx + 1,
  };
}

/**
 * Build relevance score SQL expression for ORDER BY
 * @param {string} query - sanitized search query
 * @param {object} opts - same as buildSearchConditions
 * @returns {string} SQL expression that evaluates to a numeric score
 */
function buildRelevanceScore(query, opts = {}) {
  const q = escapeSearchQuery(query);
  if (!q) return '0';

  const idx = opts.paramIdx || 1;
  const a = Object.assign({ offer: 'o', business: 'b' }, opts.aliases);
  const mode = opts.mode || 'offers';
  const norm = (col) => `f_unaccent(lower(${col}))`;
  const param = `f_unaccent(lower($${idx}))`;

  const parts = [];

  if (mode === 'offers' || mode === 'suggest') {
    parts.push(`CASE WHEN ${norm(`${a.business}.name`)} = ${param} THEN 100 ELSE 0 END`);
    parts.push(`CASE WHEN ${norm(`${a.business}.name`)} LIKE ${param} || '%' THEN 50 ELSE 0 END`);
    parts.push(`CASE WHEN ${norm(`${a.offer}.title`)} LIKE ${param} || '%' THEN 40 ELSE 0 END`);
    parts.push(`similarity(${norm(`${a.business}.name`)}, ${param}) * 30`);
    parts.push(`similarity(${norm(`${a.offer}.title`)}, ${param}) * 25`);
  } else if (mode === 'businesses') {
    parts.push(`CASE WHEN ${norm(`${a.business}.name`)} = ${param} THEN 100 ELSE 0 END`);
    parts.push(`CASE WHEN ${norm(`${a.business}.name`)} LIKE ${param} || '%' THEN 50 ELSE 0 END`);
    parts.push(`similarity(${norm(`${a.business}.name`)}, ${param}) * 30`);
  }

  return `(${parts.join('\n    + ')})`;
}

/**
 * Build distance filter + Haversine expression
 * @param {number} lat - user latitude
 * @param {number} lng - user longitude
 * @param {number} radiusKm - max distance in km (null = no limit)
 * @param {object} opts
 * @param {number} opts.paramIdx - starting parameter index
 * @param {string} opts.latCol - column for latitude (default: 'b.lat')
 * @param {string} opts.lngCol - column for longitude (default: 'b.lng')
 * @returns {{ conditions: string[], params: any[], nextIdx: number, distanceExpr: string, distanceAlias: string }}
 */
function buildDistanceFilter(lat, lng, radiusKm, opts = {}) {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return { conditions: [], params: [], nextIdx: opts.paramIdx || 1, distanceExpr: null, distanceAlias: null };
  }

  let idx = opts.paramIdx || 1;
  const latCol = opts.latCol || 'b.lat';
  const lngCol = opts.lngCol || 'b.lng';

  // Haversine distance expression
  const distanceExpr = `(6371 * acos(LEAST(1.0, cos(radians($${idx})) * cos(radians(${latCol})) * cos(radians(${lngCol}) - radians($${idx + 1})) + sin(radians($${idx})) * sin(radians(${latCol})))))`;

  const conditions = [];
  const params = [parseFloat(lat), parseFloat(lng)];
  let nextIdx = idx + 2;

  // Null guard — only filter rows that have coordinates
  conditions.push(`${latCol} IS NOT NULL AND ${lngCol} IS NOT NULL`);

  // Bounding box pre-filter (fast, uses btree index)
  if (radiusKm && !isNaN(radiusKm)) {
    const r = Math.min(parseFloat(radiusKm), 100); // cap at 100km
    const delta = r / 111.0;
    const deltaLng = r / (111.0 * Math.cos(parseFloat(lat) * Math.PI / 180));
    conditions.push(`${latCol} BETWEEN $${nextIdx} AND $${nextIdx + 1}`);
    conditions.push(`${lngCol} BETWEEN $${nextIdx + 2} AND $${nextIdx + 3}`);
    params.push(parseFloat(lat) - delta, parseFloat(lat) + delta);
    params.push(parseFloat(lng) - deltaLng, parseFloat(lng) + deltaLng);
    nextIdx += 4;

    // Haversine accuracy filter
    conditions.push(`${distanceExpr} <= $${nextIdx}`);
    params.push(r);
    nextIdx += 1;
  }

  return {
    conditions,
    params,
    nextIdx,
    distanceExpr,
    distanceAlias: 'distance_km',
  };
}

/**
 * Determine match type for a result (for UI hints)
 * @param {string} resultText - the matched text
 * @param {string} query - the search query
 * @returns {'exact'|'prefix'|'fuzzy'}
 */
function getMatchType(resultText, query) {
  if (!resultText || !query) return 'fuzzy';
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nt = norm(resultText);
  const nq = norm(query);
  if (nt === nq) return 'exact';
  if (nt.startsWith(nq)) return 'prefix';
  if (nt.includes(nq)) return 'prefix'; // substring = prefix for UI purposes
  return 'fuzzy';
}

module.exports = {
  escapeSearchQuery,
  buildSearchConditions,
  buildRelevanceScore,
  buildDistanceFilter,
  getMatchType,
};
