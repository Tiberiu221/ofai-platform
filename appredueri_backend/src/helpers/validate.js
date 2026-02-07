/**
 * Input Validation Helpers
 * Centralized validation for OFAI API
 */

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  // Simple but effective email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Sanitize and validate a string field
 * @param {string} value - The input string
 * @param {number} maxLength - Maximum allowed length
 * @returns {string|null} - Trimmed string or null if invalid
 */
function sanitizeString(value, maxLength = 500) {
  if (!value || typeof value !== "string") return null;
  return value.trim().slice(0, maxLength);
}

/**
 * Validate integer input
 * @param {*} value - The value to validate
 * @param {object} options - { min, max }
 * @returns {number|null} - Parsed integer or null
 */
function validateInt(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const num = parseInt(value, 10);
  if (Number.isNaN(num) || num < min || num > max) return null;
  return num;
}

/**
 * Validate coordinates
 * @param {*} lat
 * @param {*} lng
 * @returns {boolean}
 */
function isValidCoordinates(lat, lng) {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return false;
  return latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;
}

/**
 * Extract pagination params from query string
 * @param {object} query - req.query
 * @param {object} defaults - { defaultLimit, maxLimit }
 * @returns {{ page: number, limit: number, offset: number }}
 */
function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (Number.isNaN(page) || page < 1) page = 1;
  if (Number.isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Build paginated response
 * @param {Array} data - The result rows
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {object}
 */
function paginatedResponse(data, total, page, limit) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  isValidEmail,
  sanitizeString,
  validateInt,
  isValidCoordinates,
  parsePagination,
  paginatedResponse,
};
