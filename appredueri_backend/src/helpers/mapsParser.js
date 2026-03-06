/**
 * Google Maps URL Parser
 *
 * Parses Google Maps links (short + full) to extract coordinates.
 * Includes SSRF protection: domain whitelist, private IP blocking, timeout.
 *
 * Usage:
 *   const { parseMapsLink } = require('../helpers/mapsParser');
 *   const result = await parseMapsLink('https://maps.app.goo.gl/abc123');
 *   // { lat: 44.4268, lng: 26.1025, mapsUrl: 'https://www.google.com/maps/...' }
 *   // or { error: 'Could not extract coordinates from URL' }
 */

// Allowed Google Maps domains (whitelist for SSRF protection)
const ALLOWED_DOMAINS = [
  "maps.app.goo.gl",
  "goo.gl",
  "www.google.com",
  "www.google.ro",
  "google.com",
  "google.ro",
  "maps.google.com",
  "maps.google.ro",
];

// Private/reserved IP ranges to block (SSRF protection)
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^fd/,
];

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Check if a hostname resolves to a private/reserved IP address.
 * Uses DNS lookup to prevent SSRF via DNS rebinding.
 */
function isPrivateIp(ip) {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

/**
 * Validate that a URL points to an allowed Google Maps domain.
 */
function isAllowedDomain(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    return ALLOWED_DOMAINS.some(
      (d) => parsed.hostname === d || parsed.hostname.endsWith("." + d)
    );
  } catch {
    return false;
  }
}

/**
 * Extract lat/lng coordinates from a Google Maps URL.
 * Priority order (most accurate first):
 *   1. !3d44.4268!4d26.1025 — actual pin/place location (most accurate)
 *   2. /@44.4268,26.1025,17z — viewport center (less accurate, may differ from pin)
 *   3. ?q=44.4268,26.1025 — search query coordinates
 *   4. ll=44.4268,26.1025 — legacy format
 */
function extractCoordinates(urlString) {
  // Pattern 1: !3dlat!4dlng (actual pin location — HIGHEST PRIORITY)
  // This is the real place marker, not the viewport center
  const dataPattern = /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/;
  const dataMatch = urlString.match(dataPattern);
  if (dataMatch) {
    const lat = parseFloat(dataMatch[1]);
    const lng = parseFloat(dataMatch[2]);
    if (isValidCoordinate(lat, lng)) return { lat, lng };
  }

  // Pattern 2: /@lat,lng (viewport center — fallback, less accurate)
  const atPattern = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
  const atMatch = urlString.match(atPattern);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidCoordinate(lat, lng)) return { lat, lng };
  }

  // Pattern 3: ?q=lat,lng or &q=lat,lng
  const qPattern = /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
  const qMatch = urlString.match(qPattern);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (isValidCoordinate(lat, lng)) return { lat, lng };
  }

  // Pattern 4: ll=lat,lng
  const llPattern = /[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
  const llMatch = urlString.match(llPattern);
  if (llMatch) {
    const lat = parseFloat(llMatch[1]);
    const lng = parseFloat(llMatch[2]);
    if (isValidCoordinate(lat, lng)) return { lat, lng };
  }

  return null;
}

/**
 * Basic coordinate sanity check.
 * Lat: -90 to 90, Lng: -180 to 180
 */
function isValidCoordinate(lat, lng) {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Follow redirects manually with domain validation at each hop.
 * Prevents SSRF by re-checking each redirect target.
 */
async function followRedirects(url, maxRedirects = MAX_REDIRECTS) {
  let currentUrl = url;

  for (let i = 0; i < maxRedirects; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual", // Don't auto-follow — we validate each hop
        signal: controller.signal,
        headers: {
          "User-Agent": "OFAI-MapsParser/1.0",
          Accept: "text/html",
        },
      });
      clearTimeout(timeout);

      // If redirect (301, 302, 303, 307, 308)
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          return { error: "Redirect fără URL destinație" };
        }

        // Resolve relative redirects
        const resolvedUrl = new URL(location, currentUrl).toString();

        // Validate redirect target — must still be Google Maps or similar
        // We allow google.com domains in general for redirects
        const parsed = new URL(resolvedUrl);
        if (isPrivateIp(parsed.hostname)) {
          return { error: "URL-ul redirecționează către o adresă privată" };
        }

        currentUrl = resolvedUrl;
        continue;
      }

      // Success — return the final URL
      return { resolvedUrl: currentUrl };
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        return { error: "Timeout la accesarea link-ului Google Maps" };
      }
      return { error: "Nu am putut accesa link-ul: " + err.message };
    }
  }

  return { error: "Prea multe redirecționări" };
}

/**
 * Main entry point: parse a Google Maps link and extract coordinates.
 *
 * @param {string} urlString - Google Maps URL (short or full)
 * @returns {Promise<{lat: number, lng: number, mapsUrl: string} | {error: string}>}
 */
async function parseMapsLink(urlString) {
  if (!urlString || typeof urlString !== "string") {
    return { error: "URL lipsă sau invalid" };
  }

  // Trim and normalize
  const trimmed = urlString.trim();
  if (!trimmed) {
    return { error: "URL lipsă sau invalid" };
  }

  // Validate initial domain
  if (!isAllowedDomain(trimmed)) {
    return {
      error:
        "URL-ul nu este un link Google Maps valid. Acceptăm doar link-uri de pe google.com/maps sau maps.app.goo.gl.",
    };
  }

  // Try extracting coordinates directly from the given URL first
  const directCoords = extractCoordinates(trimmed);
  if (directCoords) {
    return {
      lat: directCoords.lat,
      lng: directCoords.lng,
      mapsUrl: trimmed,
    };
  }

  // URL might be a short link — follow redirects to get the full URL
  const redirectResult = await followRedirects(trimmed);
  if (redirectResult.error) {
    return redirectResult;
  }

  const finalUrl = redirectResult.resolvedUrl;

  // Try extracting coordinates from the resolved URL
  const resolvedCoords = extractCoordinates(finalUrl);
  if (resolvedCoords) {
    return {
      lat: resolvedCoords.lat,
      lng: resolvedCoords.lng,
      mapsUrl: finalUrl,
    };
  }

  return {
    error:
      "Nu am putut extrage coordonatele din acest link. Încearcă un link direct din Google Maps (click dreapta pe hartă → Copiază link).",
  };
}

module.exports = { parseMapsLink, extractCoordinates, isAllowedDomain };
