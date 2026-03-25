---
description: "SEO Audit & Implementation — OFAI"
---

# SEO Audit — OFAI

Run a comprehensive SEO audit on the OFAI web platform. Check all public-facing pages for SEO completeness.

## Audit Checklist

For EACH public page (/, /oferte, /business-uri, /oferta/:id, /business/:id, /categorii, /orase, /preturi, /pentru-business, /termeni, /confidentialitate, /ajutor):

### Meta Tags
- [ ] `<title>` — unique, under 60 chars, includes "OFAI"
- [ ] `<meta name="description">` — unique, 120-160 chars, includes keywords
- [ ] `<link rel="canonical">` — present, self-referencing, correct URL
- [ ] `<meta name="robots">` — noindex on filtered/auth pages only

### Open Graph
- [ ] `og:title`, `og:description`, `og:url`, `og:image` — all present
- [ ] `og:type` — correct (website for listings, article for details)
- [ ] `og:locale` — ro_RO

### Structured Data (JSON-LD)
- [ ] Home: Organization schema
- [ ] Offer detail: Offer + BreadcrumbList
- [ ] Business detail: LocalBusiness + BreadcrumbList + AggregateRating
- [ ] Listings: ItemList + BreadcrumbList
- [ ] Pricing: Product schemas

### Technical SEO
- [ ] gzip compression enabled (check `Content-Encoding` header)
- [ ] Font preconnect/preload in `<head>`
- [ ] `robots.txt` — correct disallows, Sitemap reference
- [ ] `sitemap.xml` — all active offers + businesses, `<lastmod>` present, moderation filter
- [ ] Images: lazy loading, alt text, width/height, Cloudinary WebP
- [ ] Pagination: rel=next/prev on paginated pages

### Duplicate Content
- [ ] Filtered pages (?q=, ?sort=, ?prefs=) have `noIndex: true`
- [ ] Paginated pages have self-referencing canonical
- [ ] No trailing slash issues

## How to Run

1. Read `appredueri_backend/src/views/public/partials/head.ejs` for meta tag implementation
2. Read `appredueri_backend/src/index.js` lines 304-370 for robots.txt + sitemap.xml
3. Grep `res.render` in `appredueri_backend/src/routes/web.js` for all SEO variables passed
4. For each render call, verify: pageTitle, pageDesc, canonicalUrl, structuredData, noIndex
5. Check `appredueri_backend/src/views/public/*.ejs` line 1 for any template-level overrides

## Key Files
- `appredueri_backend/src/views/public/partials/head.ejs` — all meta tags, OG, JSON-LD, canonical, pagination
- `appredueri_backend/src/index.js` — robots.txt, sitemap.xml, compression
- `appredueri_backend/src/routes/web.js` — all page renders with SEO variables
- `appredueri_backend/src/services/cloudinary.js` — image optimization config

## Variables Available in head.ejs
- `pageTitle` — page title (appended with " — OFAI")
- `pageDesc` — meta description (max 160 chars)
- `canonicalUrl` — full canonical URL
- `ogTitle`, `ogDesc`, `ogImage`, `ogUrl`, `ogType` — Open Graph overrides
- `structuredData` — JSON-LD object or array of objects
- `noIndex` — if true, adds `<meta name="robots" content="noindex, follow">`
- `seoPage`, `seoTotalPages`, `seoBaseUrl` — pagination rel=next/prev

Report findings with specific file paths and line numbers. Suggest fixes for any missing items.
