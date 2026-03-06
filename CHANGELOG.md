# Changelog

## [v0.9.0] — 2026-03-06

### Securitate
- Aplicat 60+ fix-uri audit #9: XSS escapeHtml, path traversal, URL sanitization, banned_at checks, SSRF guard, writeLimiter, Express ~5.1.0 (3ebb368) 🤖

### Adaugat
- Management locații în portalul business + parsare link-uri Google Maps (82b1be6) 🤖
- Tab-uri oferte per locație pe pagina de business (1a75511) 🤖
- Premium badge card + etichete tab-uri colecție în Flutter (d21aa2b) 🤖
- Câmp descriere business în formularul portalului (89b66ea) 🤖

### Reparat
- Fix edge cases în tab-urile oferte per locație (a74f974) 🤖
- Fix link-uri navigare și acuratețe parsare URL Maps (30a802e) 🤖
- Toast + redirect la #oferte după creare/editare/ștergere ofertă (c8f0233) 🤖
- Adaugat badges la toate endpoint-urile auth: login, register, me, google (2bc76e6) 🤖
- Badge check pe ruta web review + mutare toggle profil (893c1ad) 🤖

### Modificat
- Split 3 god files: main.css → 7 secțiuni, manage.ejs → 6 partials, web.js → 4 sub-routere (7125bba) 🤖
- Limită galerie premium crescută de la 32 la 64 imagini (30461f8) 🤖
- Eliminat UI puncte/niveluri gamificare, păstrat doar badges (cfd86e7) 🤖

### Șters
- Revert Quill rich text editor pentru descriere business (f09ba27)

### Documentație
- Raport complet audit #9 — 120 findings deduplicate (6f30443) 🤖
- 4 fișiere prompt audit fix pe severitate (80437fd) 🤖
- Design premium badge card (a09f4a6) 🤖
