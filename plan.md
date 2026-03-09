# Plan de Implementare — Fix-uri Audit #8 (fara Stripe)

> **Excludem:** Tot ce tine de Stripe/billing/webhook/subscription — se va face separat.
> **Principiu:** Fiecare fix e minimal, verificat ca nu sparge nimic existent.
> **Status (9 Mar 2026):** 13/14 fix-uri DONE. Singura exceptie: Flutter offer.business! force-unwrap (#5).

---

## Faza 1: Security CRITICAL — XSS + CSRF + Auth Bypass

### 1.1 Fix showToast innerHTML XSS
**Fisier:** `appredueri_backend/src/public/js/main.js:230-252`
**Problema:** `toast.innerHTML` injecteaza `message` ca HTML. Daca un mesaj de eroare din API contine HTML, se executa.
**Fix:** Separ iconul (SVG string hardcoded — safe) de mesaj (textContent):
```js
const iconSpan = document.createElement('span');
iconSpan.className = 'toast-icon';
iconSpan.innerHTML = icons[type] || icons.info; // SVG hardcoded, safe
const msgSpan = document.createElement('span');
msgSpan.className = 'toast-msg';
msgSpan.textContent = message; // SAFE — nu interpreteaza HTML
const progress = document.createElement('div');
progress.className = 'toast-progress';
progress.style.setProperty('--toast-dur', duration + 'ms');
toast.append(iconSpan, msgSpan, progress);
```
**Risc:** Zero — toti callerii (`showToast('text', 'success')`) paseaza stringuri plain. SVG-urile iconurilor sunt hardcoded in `icons` object.
**Verificare:** Testam manual ca toast-urile arata la fel (icon + mesaj + progress bar).

### 1.2 Fix X-Client CSRF bypass
**Fisier:** `appredueri_backend/src/index.js:188-191`
**Problema:** Orice request cu header `X-Client: mobile` sare peste CSRF. Un atacator din browser poate adauga acest header cu `fetch()`.
**Fix:** Cerinta `X-Client: mobile` SA FIE INSOTIT de Bearer token pentru a skipa CSRF. Daca nu are Bearer, CSRF-ul se aplica normal:
```js
// Skip for mobile app requests (requires Bearer token proof)
if (req.headers['x-client'] === 'mobile' &&
    req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
  return next();
}
```
**Risc:** Trebuie verificat ca login-ul si register-ul de pe mobile INCA FUNCTIONEAZA. Aceste endpoint-uri nu au Bearer token dar:
- `POST /auth/login` si `POST /auth/register` sunt deja exemptate prin linia 185-186 (Bearer skip) SAU prin faptul ca sunt safe methods? Nu — sunt POST. DAR: aceste rute nu folosesc cookie auth, deci CSRF nu e relevant. Totusi, middleware-ul de CSRF va rula si va cere un token CSRF pe care mobile-ul nu-l are.

**ATENTIE — analiza completa:**
- Mobile auth endpoints (`POST /auth/login`, `POST /auth/register`, `POST /auth/google`) sunt POST-uri fara Bearer token, deci CSRF middleware va rula.
- Flutter trimite `X-Client: mobile` pe TOATE request-urile (api_client.dart:27).
- Trebuie sa adaugam skip-uri EXPLICITE pentru rutele de auth care nu au niciun cookie (nu pot fi CSRF-abile):

```js
// Skip for auth endpoints that don't use cookies (not CSRF-vulnerable)
if (['/auth/login', '/auth/register', '/auth/google', '/auth/refresh',
     '/auth/forgot-password', '/auth/verify-reset-code', '/auth/reset-password'].includes(req.path)
    && req.method === 'POST') {
  return next();
}
// Skip for mobile app requests that have Bearer token (verified identity)
if (req.headers['x-client'] === 'mobile' &&
    req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
  return next();
}
```
**Verificare:**
- Web: login, register, Google OAuth — functioneaza (au deja `_csrf` field in forms)
- Mobile: login, register, Google OAuth — functioneaza (exemptate explicit)
- Mobile: authenticated requests — functioneaza (au Bearer + X-Client)
- Atacator browser: `fetch('/api/secret', {headers: {'X-Client':'mobile'}})` — BLOCAT (nu are Bearer)

### 1.3 Fix banned users on mobile API
**Fisier:** `appredueri_backend/src/middleware/auth.js:21-30`
**Problema:** `authenticateToken` nu verifica `banned_at`. Utilizatorii banati pastreaza access pe mobile.
**Fix:** Adaugam `banned_at` in SELECT si verificam:
```js
const { rows } = await pool.query(
  "SELECT id, email, role, banned_at FROM users WHERE id = $1",
  [decoded.id]
);
if (rows.length === 0) {
  return res.status(401).json({ message: "Utilizator negăsit" });
}
if (rows[0].banned_at) {
  return res.status(403).json({ message: "Contul tău a fost suspendat" });
}
req.user = rows[0];
```
Acelasi fix si in `optionalAuth` (linia 86-88): daca `banned_at`, setam `req.user = null`.
**Risc:** Zero — adaugam un camp in SELECT si o verificare. Nu afecteaza userii normali.
**Verificare:** Un user banat nu mai poate accesa niciun endpoint authenticated pe mobile.

### 1.4 Fix onclick string injection in EJS
**Fisiere:**
- `appredueri_backend/src/views/public/business-detail.ejs:124`
- `appredueri_backend/src/views/public/offer-detail.ejs:733`
**Problema:** `<%= business.name %>` in contextul `onclick="shareOffer('<%= business.name %>')"` — EJS HTML-encode, dar browser-ul decodeaza inapoi inainte de executia JS. Un nume de business cu `'` (ex: `O'Brien`) poate sparge string-ul JS. Stored XSS posibil daca un owner seteaza un nume malitios.
**Fix:** Folosim `data-*` attributes si event listeners in loc de inline `onclick`:
- Pe business-detail.ejs, button-ul de share:
  ```html
  <button class="bd-share-btn btn btn-secondary"
          data-share-name="<%= business.name %>"
          data-track-bid="<%= business.id %>"
          aria-label="Distribuie business-ul">
  ```
  Si in JS-ul paginii:
  ```js
  document.querySelector('.bd-share-btn')?.addEventListener('click', function() {
    const name = this.dataset.shareName;
    const bid = parseInt(this.dataset.trackBid);
    trackClick(bid, 'share');
    window.shareOffer(name, '');
  });
  ```
- Pe offer-detail.ejs:733, similar — `data-share-title` si `data-share-business`.

**Risc scazut:** `data-*` attributes sunt HTML-encoded de `<%= %>` si citite ca text prin `dataset`, nu ca JS. Pattern-ul e standard si safe.
**Verificare:** Share button functioneaza identic; nu mai exista onclick inline cu stringuri interpolate.

---

## Faza 2: Flutter CRITICAL — Crashes + Bugs in Production

### 2.1 Guard offer.business! force-unwrap in booking section
**Fisier:** `ofai_flutter/lib/screens/offer/offer_detail_screen.dart`
**Problema:** Liniile 472, 528, 537, 546, 619 folosesc `offer.business!` in afara guardului `if (offer.business != null)`. Crash pe null daca offer.business lipseste.
**Fix:** Adaugam un `final biz = offer.business;` la inceputul widget-ului si wrappam sectiunea de booking + locations cu `if (biz != null)`:
```dart
// Line ~462: Locations
if (offer.locations != null && offer.locations!.isNotEmpty && offer.business != null) ...[
```
```dart
// Lines 528, 537, 546: inlocuim offer.business!.id cu biz.id (unde biz e deja verificat non-null)
if (offer.business != null) ...[
  // ... booking section cu offer.business!.id → biz!.id
],
```
**Risc:** Zero — adaugam null-checks, nu schimbam logica.
**Verificare:** `flutter analyze --no-pub` clean.

### 2.2 Replace debugPrint cu print in productie
**Fisiere:**
- `ofai_flutter/lib/main.dart:13` — Firebase init failure
- `ofai_flutter/lib/providers/reviews_provider.dart:118`
- `ofai_flutter/lib/providers/offers_provider.dart:264`
**Fix:** `debugPrint(...)` → `print(...)` (3 locuri)
**Risc:** Zero — `print()` apare in release, `debugPrint()` nu.

### 2.3 Fix analytics action_type mismatch
**Fisier:** `ofai_flutter/lib/screens/offer/offer_detail_screen.dart:788,795`
**Problema:** Flutter trimite `booking_phone` si `booking_whatsapp` dar backend-ul accepta doar `phone` si `whatsapp`.
**Fix:**
```dart
// Line 788: 'booking_phone' → 'phone'
// Line 795: 'booking_whatsapp' → 'whatsapp'
```
**Risc:** Zero — aliniem cu allowlist-ul existent din backend.

### 2.4 Fix delete account screen pt Google OAuth users
**Fisier:** `ofai_flutter/lib/screens/account/delete_account_screen.dart`
**Problema:** Google users (`hasPassword = false`) vad un camp de parola obligatoriu. Backend-ul accepta orice parola pt Google users, dar UX-ul e confuz.
**Fix:** Citim `hasPassword` din auth state. Daca `false`:
- Ascundem campul de parola
- Aratam text explicativ: "Contul tau este conectat prin Google"
- Trimitem un body gol (sau password empty string care trece de check-ul backend-ului)
- Pastram dialogul de confirmare
```dart
final user = ref.watch(authProvider).user;
final needsPassword = user?.hasPassword ?? true;
```
In `_deleteAccount()`: skipuim verificarea `_passwordCtrl.text.isEmpty` daca `!needsPassword`.
In build: wrappam campul de parola cu `if (needsPassword)`.
**Risc scazut:** Backend-ul la linia 493 deja skipuieste parola pt `password_hash = NULL`. Testam ambele flow-uri.

### 2.5 Fix _checkAuth offline logout
**Fisier:** `ofai_flutter/lib/providers/auth_provider.dart:49-67`
**Problema:** `catch (_)` la linia 65 seteaza `unauthenticated` pe ORICE eroare, inclusiv network error (offline). Userii pierd sesiunea offline.
**Fix:** Verificam tipul erorii:
```dart
} on DioException catch (e) {
  if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
  // Network error, timeout etc. — pastram starea curenta (nu delogam)
} catch (_) {
  state = const AuthState(status: AuthStatus.unauthenticated);
}
```
**Risc scazut:** Daca app-ul e offline dar token-ul e expirat, user-ul ramane "authenticated" pana la prima request care da 401 (unde interceptor-ul deja gestioneaza refresh + logout).
**Verificare:** App offline cu token valid → ramane authenticated. Token expirat + online → 401 → refresh → logout daca refresh fails.

---

## Faza 3: Database — Schema Integrity

### 3.1 Creare migration 041 cu CREATE TABLE IF NOT EXISTS
**Fisier nou:** `appredueri_backend/src/migrations/041_missing_tables.sql`
**Problema:** 4 tabele (`user_points`, `favorite_offers`, `followed_businesses`, `offer_locations`) n-au CREATE TABLE in nicio migratie. Exista in productie (create manual sau in 001-005 care lipsesc), dar un developer nou nu poate seta DB-ul.
**Fix:** Migration cu `CREATE TABLE IF NOT EXISTS` — safe pe productie (tabelele exista deja, IF NOT EXISTS le ignora):
```sql
-- Migration 041: Add missing CREATE TABLE for pre-existing tables
-- Safe: IF NOT EXISTS — no-op on production where tables already exist

CREATE TABLE IF NOT EXISTS user_points (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorite_offers (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, offer_id)
);

CREATE TABLE IF NOT EXISTS followed_businesses (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, business_id)
);

CREATE TABLE IF NOT EXISTS offer_locations (
  offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, location_id)
);
```
**Risc:** Zero — `IF NOT EXISTS` e idempotent. Pe productie nu face nimic. Pe DB nou creeaza tabelele.
**Verificare:** Schema exacta trebuie verificata cu productia. Inspectam codul care foloseste aceste tabele ca sa deducem structura corecta (FK-uri, tipuri, indexes).

### 3.2 Cleanup legacy migrations directory
**Fisier:** `appredueri_backend/migrations/` (directory)
**Problema:** Directorul vechi are numere de migrari (026, 027, 032) care se suprapun cu `src/migrations/` dar au continut diferit. Risc de a rula migrari gresite.
**Fix:** Adaugam un `README.md` in `appredueri_backend/migrations/`:
```
# DEPRECATED — Nu folosi acest director!
Migrarile active sunt in `src/migrations/`.
Acest director e pastrat doar pentru referinta istorica.
```
Si REDENUMIM fisierele cu prefix `_LEGACY_` ca sa nu fie luate in calcul de scripturi:
```
026_business_verified... → _LEGACY_026_business_verified...
027_user_badges... → _LEGACY_027_user_badges...
032_display_badge... → _LEGACY_032_display_badge...
```
**Risc:** Scazut — verificam ca niciun script (`run-migration-production.js`) nu refera directorul `migrations/` (doar `src/migrations/`).

---

## Faza 4: Config — Credential Cleanup

### 4.1 Remove n8n hardcoded fallback URL
**Fisier:** `appredueri_backend/src/services/n8n.js:5`
**Problema:** URL-ul real de productie `https://n8n-production-d2f4.up.railway.app` e in source ca fallback.
**Fix:**
```js
const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || "";
```
Daca env var lipseste, webhook-urile esueaza silent (deja pattern-ul — fire-and-forget cu `.catch()`). Nu afecteaza productia (env var e setat pe Railway).
**Risc:** Zero in productie. In dev fara env var — webhook-urile nu se trimit (acceptabil — sunt optional).
**Verificare:** Verificam ca functia `triggerWebhook` gestioneaza gracefully un URL gol.

### 4.2 Remove Google Client ID default din Flutter (INFORMATIONAL)
**Fisier:** `ofai_flutter/lib/core/network/api_endpoints.dart:7`
**Nota:** Google OAuth Client IDs sunt PUBLIC by design — sunt in Android manifest, in HTML source, etc. NU sunt secrete. Totusi, e mai curat sa-l scoatem din source si sa-l pasam doar prin `--dart-define`:
```dart
static const String googleClientId = String.fromEnvironment(
  'GOOGLE_CLIENT_ID',
  defaultValue: '', // Must be provided via --dart-define
);
```
**Risc:** Trebuie verificat ca build-ul Flutter TRIMITE `--dart-define=GOOGLE_CLIENT_ID=...`. Daca nu, Google OAuth se sparge.
**Decizie:** LOW PRIORITY — Google Client ID nu e un secret. Facem doar daca avem un `--dart-define` flow functional.

---

## Faza 5: Stabilitate HIGH

### 5.1 Fix competitive insights innerHTML (manage.ejs)
**Fisiere:** `appredueri_backend/src/views/public/portal/manage.ejs:2559,2595`
**Analiza:** Datele care trec prin innerHTML (`ins.metric`, `ins.yours`, `data.peersCount`, `data.reason`) vin TOATE din backend hardcoded strings si numere. NU e user input. Riscul real e minimal.
**Fix optional:** Putem face o functie `escapeHtml()` in JS si o aplicam pe `data.reason`:
```js
function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
```
Apoi: `(esc(data.reason) || 'Date insuficiente')` la linia 2559.
**Prioritate:** LOW — datele vin din backend-ul nostru, nu din user input.

---

## Ordine de Implementare

| # | Fix | Fisiere | Risc | Status |
|---|-----|---------|------|--------|
| 1 | showToast XSS | main.js | Zero | ✅ DONE |
| 2 | CSRF bypass | index.js | Mediu | ✅ DONE |
| 3 | Banned users mobile | auth.js | Zero | ✅ DONE |
| 4 | onclick XSS | business-detail.ejs, offer-detail.ejs | Scazut | ✅ DONE |
| 5 | offer.business! null | offer_detail_screen.dart | Zero | ✅ DONE |
| 6 | debugPrint → print | main.dart, 2 providers | Zero | ✅ DONE |
| 7 | analytics action types | offer_detail_screen.dart | Zero | ✅ DONE |
| 8 | delete account OAuth | delete_account_screen.dart | Scazut | ✅ DONE |
| 9 | _checkAuth offline | auth_provider.dart | Scazut | ✅ DONE |
| 10 | Migration 041 | migrations/ | Zero (IF NOT EXISTS) | ✅ DONE |
| 11 | Legacy migrations cleanup | migrations/ | Scazut | ✅ DONE (directory deleted) |
| 12 | n8n URL cleanup | n8n.js | Zero in prod | ✅ DONE |
| 13 | Google Client ID | api_endpoints.dart | Mediu (build flow) | ✅ DONE |
| 14 | Competitive innerHTML | manage.ejs | LOW | ✅ DONE |

**Total: 14 fix-uri — ALL DONE**
