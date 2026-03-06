# Audit #9 — LOW Fixes Implementation Prompt

**Instrucțiuni:** Copiază tot conținutul de mai jos ca prompt într-o sesiune nouă Claude Code. Promptul este self-contained. Rulează DUPĂ ce CRITICAL, HIGH, și MEDIUM fixes au fost aplicate.

---

## PROMPT START

Implementează următoarele fix-uri LOW din Audit #9. Acestea sunt îmbunătățiri operaționale, documentare, și cleanup minor. Fiecare fix are fișierul, descrierea, și ce trebuie schimbat. Commit final pe branch-ul curent.

**REGULI:**
- NU modifica nimic legat de Stripe
- Comentarii în engleză, UI text în română
- Acestea sunt low-risk — focus pe documentare și cleanup

---

### FIX L01: CSRF secret fallback to JWT secret

**Fișier:** `appredueri_backend/src/index.js`
**Linia:** ~157

**Cod curent:**
```js
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
```

Adaugă comentariu:
```js
  // CSRF_SECRET is preferred; falls back to JWT_SECRET for backward compatibility.
  // Set CSRF_SECRET in production for proper secret separation.
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
```

**RISC:** Zero — doar documentare. Fallback-ul e funcțional dar nu ideal.

---

### FIX L02: /auth/logout nu verifică ownership pe refresh token

**Fișier:** `appredueri_backend/src/routes/auth.js`

Caută endpoint-ul POST `/auth/logout`. Verifică dacă revocă refresh token-ul bazat pe user ID (sigur) sau doar pe token value (potențial de altcineva). Dacă face:
```js
UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1
```

Schimbă în:
```js
UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1 AND user_id = $2
```

Adaugă `req.user.id` ca parametru suplimentar.

**RISC:** Low. Dacă nu e auth pe ruta de logout, acest fix nu se aplică (utilizatorul neautentificat nu are `req.user`). Verifică middleware-ul rutei.

---

### FIX L03: Email validation — no local part length check

**Fișier:** `appredueri_backend/src/middleware/validate.js` sau fișierul unde e definită validarea email

Caută regex-ul de email validation. Adaugă check pentru lungime maximă:
```js
if (email.length > 254) return false; // RFC 5321 max email length
const localPart = email.split('@')[0];
if (localPart.length > 64) return false; // RFC 5321 max local-part length
```

**RISC:** Zero — doar adaugă validare. Emails existente nu sunt afectate (doar write-uri noi).

---

### FIX L05: generalLimiter prea permisiv pentru write endpoints

**Fișier:** `appredueri_backend/src/index.js` sau `appredueri_backend/src/middleware/rateLimiter.js`

Caută `generalLimiter`. Dacă limita e >200 req/min, consideră scăderea la 100 req/min pentru endpoints de scriere. Alternativ, adaugă un limiter separat pentru POST/PUT/DELETE:

```js
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Prea multe cereri. Încearcă din nou în curând." },
});
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return writeLimiter(req, res, next);
  }
  next();
});
```

**RISC:** Poate afecta operații batch legitime (ex: admin update multiplu). Setează limita generos (60/min).

---

### FIX L06: Deal-of-Day tie-break non-deterministic

**Fișier:** `appredueri_backend/src/services/cronJobs.js`

Caută query-ul de selecție a nominărilor Deal-of-Day (în jurul liniei 220-236). Dacă `ORDER BY` nu are un tie-breaker determinist, adaugă `nomination_id ASC` ca ultim criteriu:

```sql
ORDER BY weighted_score DESC, dn.id ASC
LIMIT 1
```

**RISC:** Zero — doar face selecția deterministă.

---

### FIX L07: TIER_GATING_ENABLED string comparison case-sensitive

Caută toate aparițiile `TIER_GATING_ENABLED` din cod:
```bash
grep -rn "TIER_GATING_ENABLED" appredueri_backend/src/
```

Verifică că toate fac `=== 'true'` (lowercase). Dacă vreuna face `== true` sau alt pattern, normalizează la:
```js
process.env.TIER_GATING_ENABLED === 'true'
```

**RISC:** Zero — doar consistență.

---

### FIX L08: JSON-LD escaping inconsistent

**Fișier:** `appredueri_backend/src/views/public/partials/head.ejs`
**Linia:** ~46-49

Verifică pattern-ul curent. Dacă folosește `<%- JSON.stringify(sd).replace(/</g, '\\u003c') %>`, e aproape corect dar ar trebui să escape și `</`:

```ejs
<script type="application/ld+json"><%- JSON.stringify(sd).replace(/<\//g, '<\\/') %></script>
```

Sau mai robust:
```ejs
<script type="application/ld+json"><%- JSON.stringify(sd).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %></script>
```

**RISC:** Low — JSON-LD e deja partial-escaped. Doar hardening.

---

### FIX L10: Client-side returnTo open redirect

**Fișier:** `appredueri_backend/src/views/public/login.ejs`

Caută unde `returnTo` din URL query e folosit. Dacă e trimis direct la server, verifică server-side (web.js ~1352-1353) — serverul DEJA validează:
```js
const safeRedirect = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/cont";
```

Dacă client-side face redirect fără validare, adaugă aceeași verificare. Dacă serverul deja validează, adaugă comentariu în login.ejs:
```js
// returnTo is validated server-side (web.js) — no client redirect needed
```

**RISC:** Zero — documentare.

---

### FIX L12-L13: Flutter hardcoded values (cosmetic)

**L12 — `ofai_flutter/lib/...offer_card.dart`:** Caută `BorderRadius(99)` și schimbă la `BorderRadius(100)` pentru consistență cu `pillRadius`.

**L13 — `ofai_flutter/lib/screens/home/home_screen.dart`:** Caută `SizedBox(280)` vs `OfferCard(260)` — dacă 20px sunt unused, ajustează la match.

**RISC:** Zero — cosmetic.

---

### FIX L14: Dead gamificationProvider

**Fișier:** `ofai_flutter/lib/providers/gamification_provider.dart`

Verifică dacă provider-ul e folosit undeva:
```bash
grep -rn "gamificationProvider\|GamificationProvider\|GamificationNotifier" ofai_flutter/lib/
```

Dacă nu e referențiat nicăieri (doar definit), adaugă un TODO comment:
```dart
// TODO: This provider is currently unused — integrate or remove
```

**RISC:** Zero.

---

### FIX L19-L21: Dependency versions (doar documentare)

**L19 — dotenv v17, L20 — bcrypt v6:** Verifică dacă sunt versiuni legitimate cu `npm info dotenv version` și `npm info bcrypt version`. Dacă sunt current, no action.

**L21 — Express 5:** Verifică `package.json` — dacă Express 5 e in use, adaugă comentariu:
```json
"express": "~5.1.0",  // Pinned to 5.1.x — Express 5 is production-ready since Jan 2025
```

Sau dacă e `^5.x`, consideră pinning la `~5.1.0`.

**RISC:** Low — doar version management.

---

### FIX L22: LLM_MODEL deprecated

**Fișier:** `appredueri_backend/.env.example`
**Linia:** 36

**Cod curent:**
```env
LLM_MODEL=claude-3-haiku-20240307
```

**Cod nou:**
```env
LLM_MODEL=claude-haiku-4-5-20251001
```

**RISC:** Zero — doar documentare. Valoarea reală e în env vars, nu în example.

---

### FIX L23: PowerShell scripts at repo root

**Fișiere:** `check_lock.ps1`, `do_rename.ps1` (la root-ul repo-ului)

Verifică dacă sunt folosite. Dacă sunt dev tools Windows:
- Mută-le în `scripts/` sau `scripts/windows/`
- Sau adaugă la `.gitignore` dacă nu sunt necesare în repo

**RISC:** Zero — cleanup.

---

### FIX L25: requirements.txt orphan

**Fișier:** `requirements.txt` la root

Verifică conținutul. Dacă e pentru scraping scripts:
- Mută-l în `scripts/scraping/requirements.txt`
- Sau documentează cu un comentariu la top: `# Dependencies for scripts/scraping/`

**RISC:** Zero — cleanup.

---

### FIX L26-L28: Migration documentation

**L26 — Migration 034 volatile index:** Deja fixat în migration 037. Adaugă comentariu în 034:
```sql
-- Note: Partial index with NOW() is volatile — fixed in migration 037
```

**L27 — Migration 039 wrong comment:** Corectează comentariul:
```sql
-- Drop idx_business_subscriptions_bid (created in 038) —
-- covered by idx_business_push_log_rate composite from 037
```
Verifică exact ce index 039 șterge și corectează comentariul ca să reflecte realitatea.

**L28 — Redundant index:** Deja inclus în `047_missing_indexes.sql` din HIGH fixes (`DROP INDEX IF EXISTS idx_bclicks_action`).

---

### FIX L30: No log when no deal-of-day candidate

**Fișier:** `appredueri_backend/src/services/cronJobs.js`
**Linia:** ~237-239

**Cod curent:**
```js
      if (candidate.rows.length === 0) {
        return;
      }
```

**Cod nou:**
```js
      if (candidate.rows.length === 0) {
        console.log('[Cron] No deal-of-day candidates for ' + tomorrowStr);
        return;
      }
```

**RISC:** Zero — doar logging.

---

### VERIFICARE FINALĂ

1. `cd appredueri_backend && node src/index.js` — serverul pornește
2. `cd ofai_flutter && flutter analyze --no-pub` — fără erori noi
3. Commit cu mesaj: `chore: low-priority fixes from audit #9 (docs, cleanup, validation)`
4. Push pe branch-ul curent

## PROMPT END
