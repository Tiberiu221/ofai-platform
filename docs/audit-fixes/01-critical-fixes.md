# Audit #9 — CRITICAL Fixes Implementation Prompt

**Instrucțiuni:** Copiază tot conținutul de mai jos ca prompt într-o sesiune nouă Claude Code. Promptul este self-contained.

---

## PROMPT START

Implementează următoarele 14 fix-uri CRITICE din Audit #9. Fiecare fix are fișierul, linia exactă, codul curent, și codul nou. După fiecare fix, verifică că serverul pornește (`cd appredueri_backend && node src/index.js`) și Flutter analizează corect (`cd ofai_flutter && flutter analyze --no-pub`). Commit final pe branch-ul curent.

**REGULI:**
- NU modifica nimic legat de Stripe (billing.js, stripe.js, subscriptionService.js)
- NU modifica adminAuth.js (CRIT-18 amânat)
- Folosește exact pattern-urile existente în cod
- Comentarii în engleză, UI text în română
- Testează că serverul pornește după fiecare grup de modificări backend

---

### FIX 1: CRIT-02 — webAuth.js fetchUser() nu verifică banned_at

**Fișier:** `appredueri_backend/src/middleware/webAuth.js`
**Linia:** 68-74

**Cod curent:**
```js
async function fetchUser(userId) {
  const { rows } = await pool.query(
    "SELECT id, email, first_name, last_name, role, profile_picture_url, display_badge_id FROM users WHERE id = $1",
    [userId]
  );
  return rows[0] || null;
}
```

**Cod nou:**
```js
async function fetchUser(userId) {
  const { rows } = await pool.query(
    "SELECT id, email, first_name, last_name, role, profile_picture_url, display_badge_id, banned_at FROM users WHERE id = $1",
    [userId]
  );
  if (!rows[0]) return null;
  if (rows[0].banned_at) return null; // Banned user treated as not found
  return rows[0];
}
```

**RISC:** Dacă `banned_at` are valori stale non-NULL, utilizatorii legitimii vor fi blocați. Coloana e definită în migration 015 ca `TIMESTAMP NULL` — NULL = nebanned.
**VERIFICARE:** `tryRefreshTokens()` în același fișier (linia 31-44) DEJA verifică banned_at corect. Acest fix aliniază `fetchUser()` la același comportament.

---

### FIX 2: CRIT-03 — businessAuth.js businessUserAuth() nu verifică banned_at

**Fișier:** `appredueri_backend/src/middleware/businessAuth.js`
**Linia:** 92-120

**Cod curent (liniile 104-113):**
```js
    const userResult = await pool.query(
      "SELECT id, email, role FROM users WHERE id = $1",
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Utilizator inexistent" });
    }

    req.user = userResult.rows[0];
    next();
```

**Cod nou:**
```js
    const userResult = await pool.query(
      "SELECT id, email, role, banned_at FROM users WHERE id = $1",
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "Utilizator inexistent" });
    }

    if (userResult.rows[0].banned_at) {
      return res.status(403).json({ message: "Contul a fost suspendat" });
    }

    req.user = userResult.rows[0];
    next();
```

**VERIFICARE:** `businessAuth()` din același fișier (linia 49-51) DEJA verifică banned_at cu exact acest pattern.

---

### FIX 3: CRIT-04 — businessWebAuth.js requireBusinessOwner() nu verifică banned_at

**Fișier:** `appredueri_backend/src/middleware/businessWebAuth.js`
**Linia:** 69-76

**Cod curent:**
```js
    const { rows } = await pool.query(
      "SELECT id, email, first_name, last_name, role, profile_picture_url FROM users WHERE id = $1",
      [userId]
    );

    if (rows.length === 0) return deny();

    req.webUser = rows[0];
```

**Cod nou:**
```js
    const { rows } = await pool.query(
      "SELECT id, email, first_name, last_name, role, profile_picture_url, banned_at FROM users WHERE id = $1",
      [userId]
    );

    if (rows.length === 0) return deny();
    if (rows[0].banned_at) return deny();

    req.webUser = rows[0];
```

**VERIFICARE:** `tryRefresh()` din același fișier (linia 133-136) DEJA verifică banned_at. `deny()` face redirect la /login.

---

### FIX 4: CRIT-05 — max_reveals nu se verifică la reveal

**Fișier 1:** `appredueri_backend/src/routes/offers.js`
**Linia:** 656-689 (mobile reveal endpoint)

După linia 670 (după `const result = await pool.query(...)` care ia promo code), ÎNAINTE de `const promoRow = result.rows[0]`, adaugă:

```js
    // Check max_reveals limit
    const limitCheck = await pool.query(
      "SELECT o.max_reveals, (SELECT COUNT(*) FROM code_reveals cr WHERE cr.offer_id = o.id) as reveal_count FROM offers o WHERE o.id = $1",
      [id]
    );
    if (limitCheck.rows[0] && limitCheck.rows[0].max_reveals !== null) {
      if (parseInt(limitCheck.rows[0].reveal_count) >= parseInt(limitCheck.rows[0].max_reveals)) {
        return res.status(410).json({ message: "Codul promoțional a atins limita de utilizări" });
      }
    }
```

**Fișier 2:** `appredueri_backend/src/routes/web.js`
**Linia:** 973-1012 (web reveal endpoint)

Adaugă ACELAȘI bloc după linia 987 (după query-ul SELECT promo code), ÎNAINTE de `const promoRow`.

**RISC:** `max_reveals` poate fi NULL (= nelimitat). Check-ul `!== null` asigură că NULL = skip.
**VERIFICARE:** `max_reveals` e definit în migration 032 ca `INTEGER` nullable pe tabelul `offers`.

---

### FIX 5: CRIT-07 — XSS via javascript: URI în href

**Fișier 1:** `appredueri_backend/src/views/public/business-detail.ejs`

Linia 140 — înlocuiește:
```ejs
<a href="<%= business.website %>" target="_blank"
```
cu:
```ejs
<% var safeWebsite = (business.website || '').match(/^https?:\/\//) ? business.website : '#'; %>
<a href="<%= safeWebsite %>" target="_blank"
```

Linia 182 — înlocuiește:
```ejs
<a href="<%= business.booking.url %>" target="_blank"
```
cu:
```ejs
<% var safeBookingUrl = (business.booking.url || '').match(/^https?:\/\//) ? business.booking.url : '#'; %>
<a href="<%= safeBookingUrl %>" target="_blank"
```

Linia 446 — înlocuiește:
```ejs
<a href="<%= loc.booking_url %>" target="_blank"
```
cu:
```ejs
<% var safeLocBooking = (loc.booking_url || '').match(/^https?:\/\//) ? loc.booking_url : '#'; %>
<a href="<%= safeLocBooking %>" target="_blank"
```

**Fișier 2:** `appredueri_backend/src/views/public/offer-detail.ejs`

Linia 993 — aplicați același pattern:
```ejs
<% var safeLocBooking = (loc.booking_url || '').match(/^https?:\/\//) ? loc.booking_url : '#'; %>
<a href="<%= safeLocBooking %>" target="_blank"
```

**RISC:** Business-uri existente cu URL-uri non-http (ex: ftp://) vor arăta `#`. Aceasta e comportamentul dorit — doar http/https sunt sigure în href. Telefon și WhatsApp au deja path-uri separate cu `tel:` și `https://wa.me/`.

---

### FIX 6: CRIT-08 — XSS via innerHTML în competitive insights

**Fișier:** `appredueri_backend/src/views/public/portal/manage.ejs`
**Liniile:** 2858-2897

Helper-ul `escapeHtml()` DEJA există la linia 2922 din același fișier. Aplicați-l la toate valorile dinamice din blocul competitive insights:

Linia 2861 — înlocuiește:
```js
'<div>' + (data.reason || 'Date insuficiente') + '</div>' +
```
cu:
```js
'<div>' + escapeHtml(data.reason || 'Date insuficiente') + '</div>' +
```

Linia 2868 — înlocuiește:
```js
'<span><span class="comp-legend-dot" style="background:#3b82f6;"></span>Media categoriei (' + data.peersCount + ' business-uri)</span>' +
```
cu:
```js
'<span><span class="comp-legend-dot" style="background:#3b82f6;"></span>Media categoriei (' + escapeHtml('' + data.peersCount) + ' business-uri)</span>' +
```

Linia 2880 — înlocuiește:
```js
'<div class="comp-metric">' + ins.metric + '</div>' +
```
cu:
```js
'<div class="comp-metric">' + escapeHtml(ins.metric) + '</div>' +
```

Liniile 2885, 2890 — înlocuiește `ins.yours` și `ins.categoryAvg`:
```js
'<div class="comp-bar-value">' + escapeHtml('' + ins.yours) + '</div>' +
...
'<div class="comp-bar-value">' + escapeHtml('' + ins.categoryAvg) + '</div>' +
```

**RISC:** Zero — `escapeHtml` e un wrapper pur textual.

---

### FIX 7: CRIT-11 — Google OAuth Client ID hardcoded în Flutter

**Fișier:** `ofai_flutter/lib/core/network/api_endpoints.dart`
**Linia:** 5-9

**Cod curent:**
```dart
  static const String googleClientId = String.fromEnvironment(
    'GOOGLE_CLIENT_ID',
    defaultValue: '528878938929-6adc8diuadocsf9bh3f12mvekirb93aj.apps.googleusercontent.com',
  );
```

**Cod nou:**
```dart
  static const String googleClientId = String.fromEnvironment(
    'GOOGLE_CLIENT_ID',
    defaultValue: '',
  );
```

Apoi, în fișierul care apelează Google Sign-In, adaugă o verificare early-return dacă `googleClientId` e gol. Caută utilizarea lui `AppConfig.googleClientId` și adaugă:
```dart
if (AppConfig.googleClientId.isEmpty) {
  throw ApiException(message: 'Google Sign-In nu este configurat');
}
```

**RISC:** Dacă build scripts nu trec `--dart-define=GOOGLE_CLIENT_ID=...`, Google OAuth nu va funcționa. Documentează în README.

---

### FIX 8: CRIT-12 — Flutter _checkAuth catch generic → logout

**Fișier:** `ofai_flutter/lib/providers/auth_provider.dart`
**Linia:** 72-74

**Cod curent:**
```dart
    } catch (_) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
```

**Cod nou:**
```dart
    } catch (e) {
      // Non-network error (JSON parsing, etc.) — don't log out
      debugPrint('[Auth] _checkAuth unexpected error: $e');
    }
```

Adaugă `import 'package:flutter/foundation.dart';` la top dacă nu e deja importat (pentru `debugPrint`).

**RISC:** Utilizatorii pot rămâne pe starea `initial` dacă eroarea e irecuperabilă. Fix-ul CRIT-14 (mai jos) rezolvă asta tratând `initial` ca loading.

---

### FIX 9: CRIT-13 — Promo code spinner blocat la null

**Fișier:** `ofai_flutter/lib/screens/offer/offer_detail_screen.dart`
**Linia:** 907-915

**Cod curent:**
```dart
    final code = response.data['promo_code'] as String?;

    if (code != null && mounted) {
      setState(() {
        _code = code;
        _revealed = true;
        _loading = false;
      });
    }
```

**Cod nou:**
```dart
    final code = response.data['promo_code'] as String?;

    if (code != null && mounted) {
      setState(() {
        _code = code;
        _revealed = true;
        _loading = false;
      });
    } else if (mounted) {
      setState(() {
        _error = 'Codul nu este disponibil';
        _loading = false;
      });
    }
```

**RISC:** Zero — doar adaugă handling pentru null.

---

### FIX 10: CRIT-14 — _checkAuth() în constructor race cu router

**Fișier:** `ofai_flutter/lib/app.dart`
**Linia:** 231-252

**Cod curent (linia 232):**
```dart
      final isAuth = notifier.authStatus == AuthStatus.authenticated;
```

**Cod nou — adaugă ÎNAINTE de `final isAuth`:**
```dart
      // Don't redirect while auth is still being checked
      if (notifier.authStatus == AuthStatus.initial) return null;

      final isAuth = notifier.authStatus == AuthStatus.authenticated;
```

**RISC:** Utilizatorii văd un flash de loading. Aceasta e comportament corect — mai bine decât flash de login screen.

---

### FIX 11: CRIT-15 — attachTier() fail-open

**Fișier:** `appredueri_backend/src/middleware/tierAuth.js`
**Linia:** 21-26

**Cod curent:**
```js
    } catch (err) {
      console.error('Tier lookup error:', err);
      req.tier = null;
      next(); // fail open — don't block on tier errors
    }
```

**Cod nou:**
```js
    } catch (err) {
      console.error('Tier lookup error:', err);
      req.tier = null;
      if (process.env.TIER_GATING_ENABLED === 'true') {
        return res.status(503).json({ error: 'Serviciu temporar indisponibil' });
      }
      next(); // fail open only when gating disabled
    }
```

**RISC:** Dacă DB-ul e temporar down și `TIER_GATING_ENABLED=true`, toate rutele tier-gated vor returna 503. Aceasta e postura corectă de securitate.

---

### FIX 12: CRIT-17 — iOS NSAllowsArbitraryLoads = true

**Fișier:** `ofai_flutter/ios/Runner/Info.plist`
**Liniile:** 5-9

**Cod curent:**
```xml
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsArbitraryLoads</key>
		<true/>
	</dict>
```

**Cod nou:**
```xml
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsLocalNetworking</key>
		<true/>
	</dict>
```

**RISC:** Dacă vreun endpoint remote folosește HTTP (nu HTTPS), va eșua. Verificat: `baseUrl` e `https://ofai.ro`, Cloudinary și Firebase folosesc HTTPS. Safe.

---

### FIX 13: CRIT-19,20 — Schema lipsă din src/migrations

**Fișier NOU:** `appredueri_backend/src/migrations/046_schema_from_legacy.sql`

Creează acest fișier cu conținut:

```sql
-- Migration 046: Consolidate schema from legacy migrations directory
-- These tables/columns were created by unnumbered migrations in /migrations/
-- but never replicated in /src/migrations/. This migration ensures a fresh
-- database install from src/migrations/ alone will have the complete schema.
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for idempotency.

-- ── review_responses (used in web.js:1135, 1946, 2720, business-portal.js:1027) ──
CREATE TABLE IF NOT EXISTS review_responses (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_responses_review ON review_responses(review_id);

-- ── review_summaries (used in web.js:2041) ──
CREATE TABLE IF NOT EXISTS review_summaries (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  summary TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  review_count INTEGER DEFAULT 0,
  avg_rating NUMERIC(3,2),
  UNIQUE(business_id)
);

-- ── badge_definitions + user_badges (used in web.js:1134) ──
CREATE TABLE IF NOT EXISTS badge_definitions (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url VARCHAR(500),
  points_required INTEGER DEFAULT 0,
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS user_badges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);

-- ── Missing columns on businesses ──
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- ── Missing columns on users ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_picture_in_reviews BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_badge_id INTEGER REFERENCES badge_definitions(id) ON DELETE SET NULL;

-- ── Booking columns on business_locations ──
ALTER TABLE business_locations ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20);
ALTER TABLE business_locations ADD COLUMN IF NOT EXISTS booking_phone VARCHAR(20);
ALTER TABLE business_locations ADD COLUMN IF NOT EXISTS booking_whatsapp VARCHAR(20);
ALTER TABLE business_locations ADD COLUMN IF NOT EXISTS booking_url VARCHAR(500);
ALTER TABLE business_locations ADD COLUMN IF NOT EXISTS booking_instructions TEXT;
```

**RISC:** Zero — toate operațiunile sunt idempotente cu `IF NOT EXISTS`.

---

### FIX 14: CRIT-21 — Deal-of-Day cron nu e în tranzacție

**Fișier:** `appredueri_backend/src/services/cronJobs.js`
**Liniile:** 241-261

**Cod curent (liniile 243-259):**
```js
      const { nomination_id, offer_id } = candidate.rows[0];

      // Mark nomination as selected
      await pool.query(`
        UPDATE deal_nominations
        SET status = 'selected', selected_for_date = $1
        WHERE id = $2
      `, [tomorrowStr, nomination_id]);

      // Clear any existing deal_of_day flag for tomorrow, then set the new one
      await pool.query(`
        UPDATE offers SET is_deal_of_day = FALSE, deal_of_day_date = NULL
        WHERE deal_of_day_date = $1
      `, [tomorrowStr]);

      await pool.query(`
        UPDATE offers SET is_deal_of_day = TRUE, deal_of_day_date = $1
        WHERE id = $2
      `, [tomorrowStr, offer_id]);
```

**Cod nou:**
```js
      const { nomination_id, offer_id } = candidate.rows[0];

      // Wrap in transaction to prevent partial updates
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(`
          UPDATE deal_nominations
          SET status = 'selected', selected_for_date = $1
          WHERE id = $2
        `, [tomorrowStr, nomination_id]);

        await client.query(`
          UPDATE offers SET is_deal_of_day = FALSE, deal_of_day_date = NULL
          WHERE deal_of_day_date = $1
        `, [tomorrowStr]);

        await client.query(`
          UPDATE offers SET is_deal_of_day = TRUE, deal_of_day_date = $1
          WHERE id = $2
        `, [tomorrowStr, offer_id]);

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
```

**RISC:** Zero — transaction wrapping e pur aditiv. Pattern identic cu cel de la liniile 115-134 (trial downgrade).

---

### VERIFICARE FINALĂ

După toate fix-urile:
1. `cd appredueri_backend && node src/index.js` — serverul pornește fără erori
2. `cd ofai_flutter && flutter analyze --no-pub` — fără erori noi
3. Commit cu mesaj: `fix: critical security fixes from audit #9 (banned bypass, XSS, max_reveals, tier fail-open)`
4. Push pe branch-ul curent

## PROMPT END
