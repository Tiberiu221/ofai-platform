/**
 * Gallery image query helper
 * Consolidates Cloudinary (image_url) + legacy (image_filename) logic in one place
 */

/**
 * Maps a business_images row to a public URL.
 * Cloudinary image_url takes precedence over legacy image_filename.
 *
 * @param {Object} img - Row from business_images table
 * @param {string} img.image_url - Cloudinary URL (may be null for legacy)
 * @param {string} img.image_filename - Legacy local filename (may be null for new uploads)
 * @param {Function|string} makeAbsoluteUrl - URL builder function or base URL string
 * @returns {string} Absolute image URL
 */
function resolveImageUrl(img, makeAbsoluteUrl) {
  if (img.image_url) return img.image_url;
  if (typeof makeAbsoluteUrl === "function") {
    return makeAbsoluteUrl(`/uploads/businesses/${img.image_filename}`);
  }
  // If makeAbsoluteUrl is a base URL string
  return `${makeAbsoluteUrl}/uploads/businesses/${img.image_filename}`;
}

module.exports = { resolveImageUrl };
