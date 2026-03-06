/**
 * Input Validation Helpers
 * Centralized validation for OFAI API
 */
const sanitizeHtmlLib = require("sanitize-html");

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

/**
 * Validate a business request submission
 * @param {object} data - The business request data
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateBusinessRequest(data) {
  const errors = [];

  // Name is required
  const name = sanitizeString(data.name, 200);
  if (!name || name.length < 2) {
    errors.push("Numele business-ului este obligatoriu (minim 2 caractere).");
  }

  // City is required
  const cityId = validateInt(data.city_id, { min: 1 });
  if (!cityId) {
    errors.push("Orașul este obligatoriu.");
  }

  // Category is optional but must be valid if provided
  if (data.category_id) {
    const catId = validateInt(data.category_id, { min: 1 });
    if (!catId) {
      errors.push("Categoria selectată nu este validă.");
    }
  }

  // Phone format (optional)
  if (data.phone) {
    const phone = sanitizeString(data.phone, 50);
    if (phone && !/^(\+?40|0)[2-9]\d{7,8}$/.test(phone.replace(/[\s\-().]/g, ""))) {
      errors.push("Numărul de telefon nu pare valid (format RO).");
    }
  }

  // Website URL (optional)
  if (data.website) {
    const website = sanitizeString(data.website, 500);
    if (website) {
      try {
        const url = new URL(website.startsWith("http") ? website : `https://${website}`);
        if (!["http:", "https:"].includes(url.protocol)) {
          errors.push("Website-ul trebuie să fie o adresă HTTP/HTTPS validă.");
        }
      } catch {
        errors.push("Website-ul nu este o adresă URL validă.");
      }
    }
  }

  // Description length check (optional)
  if (data.description) {
    const desc = sanitizeString(data.description, 2000);
    if (desc && desc.length < 10) {
      errors.push("Descrierea trebuie să aibă minim 10 caractere.");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate Romanian phone number format
 * @param {string} phone
 * @returns {boolean}
 */
function isValidRomanianPhone(phone) {
  if (!phone || typeof phone !== "string") return false;
  const cleaned = phone.replace(/[\s\-().]/g, "");
  return /^(\+?40|0)[2-9]\d{7,8}$/.test(cleaned);
}

/**
 * Validate password strength
 * Requirements: min 8 chars, at least 1 digit
 * @param {string} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePassword(password) {
  const errors = [];
  if (!password || typeof password !== "string") {
    errors.push("Parola este obligatorie.");
    return { valid: false, errors };
  }
  if (password.length < 8) {
    errors.push("Parola trebuie să aibă minim 8 caractere.");
  }
  if (!/\d/.test(password)) {
    errors.push("Parola trebuie să conțină cel puțin o cifră.");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Allowed image MIME types for file uploads.
 * Blocks SVG (XSS vector), TIFF, BMP, and other potentially dangerous formats.
 */
const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/**
 * Creates a multer fileFilter that only allows safe image MIME types.
 * @returns {Function} multer fileFilter callback
 */
/**
 * Sanitize rich-text HTML for description fields.
 * Allows only basic formatting tags produced by the Quill editor.
 * Strips everything else (scripts, styles, event handlers, etc.).
 * @param {string} html - Raw HTML from Quill editor
 * @param {number} maxLength - Max length of the stripped text content
 * @returns {string|null} - Sanitized HTML or null if empty
 */
function sanitizeDescriptionHtml(html, maxLength = 2000) {
  if (!html || typeof html !== "string") return null;

  const clean = sanitizeHtmlLib(html, {
    allowedTags: ["p", "br", "strong", "em", "s", "h1", "h2", "h3"],
    allowedAttributes: {},
    allowedSchemes: [],
  });

  // Strip tags to check text length
  const textOnly = clean.replace(/<[^>]*>/g, "").trim();
  if (!textOnly) return null;
  if (textOnly.length > maxLength) {
    // Truncate by cutting HTML at a safe point (re-sanitize to close tags)
    return sanitizeHtmlLib(clean.slice(0, maxLength * 3), {
      allowedTags: ["p", "br", "strong", "em", "s", "h1", "h2", "h3"],
      allowedAttributes: {},
    });
  }

  return clean;
}

function createImageFilter() {
  return (req, file, cb) => {
    if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tip de fișier nepermis: ${file.mimetype}. Doar JPEG, PNG, WebP și GIF sunt acceptate.`));
    }
  };
}

module.exports = {
  isValidEmail,
  sanitizeString,
  sanitizeDescriptionHtml,
  validateInt,
  isValidCoordinates,
  parsePagination,
  paginatedResponse,
  validateBusinessRequest,
  isValidRomanianPhone,
  ALLOWED_IMAGE_MIMES,
  createImageFilter,
  validatePassword,
};
