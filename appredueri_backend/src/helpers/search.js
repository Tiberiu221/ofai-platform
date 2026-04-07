/**
 * Build a fuzzy search condition using pg_trgm similarity + ILIKE fallback.
 *
 * Requires pg_trgm extension enabled in the database.
 * Uses two parameters: $paramIdx for ILIKE (%query%), $paramIdx+1 for similarity (raw query).
 * Exact ILIKE matches rank first, then by best similarity score.
 *
 * @param {Array<{col: string, ilike?: boolean, similarity?: boolean}>} columns
 *   - col: SQL column reference (e.g., 'o.title')
 *   - ilike: include in ILIKE check (default true)
 *   - similarity: include in similarity check (default false — only for short text like title/name)
 * @param {number} paramIdx - starting parameter index for ILIKE ($paramIdx = '%query%')
 * @returns {{ condition: string, orderClause: string, params: function(string): string[] }}
 *   - condition: WHERE clause fragment
 *   - orderClause: ORDER BY clause fragment (exact first, then similarity DESC)
 *   - params: function that takes the raw query and returns [ilikeParam, rawParam]
 */
function buildFuzzySearch(columns, paramIdx) {
  const ilikeIdx = paramIdx;
  const simIdx = paramIdx + 1;

  const ilikeParts = columns
    .filter(c => c.ilike !== false)
    .map(c => `${c.col} ILIKE $${ilikeIdx}`);

  const simParts = columns
    .filter(c => c.similarity === true)
    .map(c => `(length($${simIdx}) >= 5 AND similarity(${c.col}, $${simIdx}) > 0.20)`);

  const simScores = columns
    .filter(c => c.similarity === true)
    .map(c => `similarity(${c.col}, $${simIdx})`);

  // Build WHERE condition: ILIKE matches OR similarity matches
  const allParts = [...ilikeParts, ...simParts];
  const condition = `(${allParts.join(' OR ')})`;

  // Build ORDER BY: exact matches first, then by best similarity score
  let orderClause;
  if (simScores.length > 0) {
    const ilikeCheck = ilikeParts.length > 0 ? ilikeParts.join(' OR ') : 'FALSE';
    orderClause = `CASE WHEN (${ilikeCheck}) THEN 0 ELSE 1 END, GREATEST(${simScores.join(', ')}) DESC`;
  } else {
    orderClause = null; // no similarity ordering needed
  }

  return {
    condition,
    orderClause,
    paramCount: simParts.length > 0 ? 2 : 1,
    params(query) {
      if (simParts.length > 0) {
        return [`%${query}%`, query];
      }
      return [`%${query}%`];
    },
  };
}

module.exports = { buildFuzzySearch };
