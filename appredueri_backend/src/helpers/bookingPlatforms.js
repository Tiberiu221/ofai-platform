// Booking platform definitions for multi-platform booking system

const PLATFORMS = [
  { slug: 'phone',       label: 'Telefon',         labelEn: 'Phone',           type: 'phone',    color: '#22c55e', inputType: 'tel',  placeholder: '+40 7XX XXX XXX' },
  { slug: 'whatsapp',    label: 'WhatsApp',         labelEn: 'WhatsApp',        type: 'whatsapp', color: '#25D366', inputType: 'tel',  placeholder: '+40 7XX XXX XXX' },
  { slug: 'booksy',      label: 'Booksy',           labelEn: 'Booksy',          type: 'url',      color: '#6C5CE7' },
  { slug: 'fresha',      label: 'Fresha',           labelEn: 'Fresha',          type: 'url',      color: '#00C9A7' },
  { slug: 'airbnb',      label: 'Airbnb',           labelEn: 'Airbnb',          type: 'url',      color: '#FF5A5F' },
  { slug: 'booking_com', label: 'Booking.com',      labelEn: 'Booking.com',     type: 'url',      color: '#003580' },
  { slug: 'calendly',    label: 'Calendly',         labelEn: 'Calendly',        type: 'url',      color: '#006BFF' },
  { slug: 'google',      label: 'Google Business',  labelEn: 'Google Business', type: 'url',      color: '#4285F4' },
  { slug: 'treatwell',   label: 'Treatwell',        labelEn: 'Treatwell',       type: 'url',      color: '#E91E63' },
  { slug: 'planfy',      label: 'Planfy',           labelEn: 'Planfy',          type: 'url',      color: '#FF6B00' },
  { slug: 'website',     label: 'Website propriu',  labelEn: 'Own website',     type: 'url',      color: '#a1a1aa' },
  { slug: 'other',       label: 'Altul',            labelEn: 'Other',           type: 'url',      color: '#71717a', hasCustomLabel: true },
];

const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map(p => [p.slug, p]));
const VALID_SLUGS = new Set(PLATFORMS.map(p => p.slug));

/**
 * Get platform definition by slug
 */
function getPlatform(slug) {
  return PLATFORM_MAP[slug] || null;
}

/**
 * Get display label for a booking method (respects custom label for 'other')
 */
function getDisplayLabel(method, lang = 'ro') {
  if (method.platform === 'other' && method.platform_label) {
    return method.platform_label;
  }
  const p = PLATFORM_MAP[method.platform];
  if (!p) return method.platform_label || method.platform;
  return lang === 'en' ? p.labelEn : p.label;
}

/**
 * Get action label for consumer display (e.g. "Rezervă pe Booksy", "Sună")
 */
function getActionLabel(method, lang = 'ro') {
  const platform = method.platform;
  if (platform === 'phone') return lang === 'en' ? 'Call' : 'Sună';
  if (platform === 'whatsapp') return lang === 'en' ? 'WhatsApp' : 'Scrie pe WhatsApp';
  const name = getDisplayLabel(method, lang);
  return lang === 'en' ? `Book on ${name}` : `Rezervă pe ${name}`;
}

/**
 * Build href for a booking method
 */
function getBookingHref(method) {
  const { platform, value } = method;
  if (!value) return '#';
  if (platform === 'phone') return `tel:${value.replace(/\s/g, '')}`;
  if (platform === 'whatsapp') {
    const num = value.replace(/[\s+\-()]/g, '');
    return `https://wa.me/${num}`;
  }
  // URL platforms
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://${value}`;
}

/**
 * Validate a platform slug
 */
function isValidPlatform(slug) {
  return VALID_SLUGS.has(slug);
}

module.exports = {
  PLATFORMS,
  PLATFORM_MAP,
  getPlatform,
  getDisplayLabel,
  getActionLabel,
  getBookingHref,
  isValidPlatform,
};
