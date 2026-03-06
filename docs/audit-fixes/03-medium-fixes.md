# Audit #9 — MEDIUM Fixes Implementation Prompt

**Instrucțiuni:** Copiază tot conținutul de mai jos ca prompt într-o sesiune nouă Claude Code. Promptul este self-contained. Rulează DUPĂ ce CRITICAL și HIGH fixes au fost aplicate.

---

## PROMPT START

Implementează următoarele fix-uri MEDIUM din Audit #9. Acestea sunt îmbunătățiri de cod, securitate minoră, și cleanup. Fiecare fix are fișierul, descrierea, și codul nou. Commit final pe branch-ul curent.

**REGULI:**
- NU modifica nimic legat de Stripe
- NU modifica adminAuth.js
- Comentarii în engleză, UI text în română
- Verifică că serverul pornește după modificări backend

---

### FIX M01: `/oferte` date filter folosește `>` în loc de `>=`

**Fișier:** `appredueri_backend/src/routes/web.js`
**Linia:** 361

**Cod curent:**
```js
    const conditions = ["o.is_active = true", "o.end_date > CURRENT_DATE"];
```

**Cod nou:**
```js
    const conditions = ["o.is_active = true", "(o.end_date IS NULL OR o.end_date >= CURRENT_DATE)"];
```

**Rațiune:** Ofertele cu `end_date = TODAY` ar trebui să fie vizibile toată ziua. Și ofertele fără end_date (NULL) ar trebui incluse.
**RISC:** Poate arăta câteva oferte în plus. Verifică dacă alte query-uri din fișier folosesc același pattern și aliniază-le.

---

### FIX M02: Login check order — password_hash înainte de banned_at

**Fișier:** `appredueri_backend/src/routes/web.js`
**Linia:** ~1330-1342

Aceasta e doar o reordonare pentru security best practice. Codul curent verifică parola, apoi banned_at. Ordinea nu contează funcțional dar e mai bun din punct de vedere UX — un utilizator baned ar trebui să vadă mesajul de ban, nu "parolă greșită". Verifică ordinea actuală — dacă banned_at e deja verificat DUPĂ password check, inversează:

```js
    // Check banned BEFORE password (so banned users get the right message)
    if (user.banned_at) {
      return res.status(403).json({ message: "Contul tău a fost suspendat." });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Email sau parolă greșită." });
    }
```

**RISC:** Low. Timing oracle minuscul — un atacator ar putea deduce dacă un cont e banned vs. parolă greșită. Acceptabil pentru acest context.

---

### FIX M05: discount_type acceptă orice string

**Fișier:** `appredueri_backend/src/routes/business-portal.js`
**Linia:** ~607-609 (update offer) și ~509 (create offer)

Adaugă validare whitelist pentru `discount_type` ÎNAINTE de inserare/update. Caută unde `discount_type` e folosit în INSERT/UPDATE:

```js
    const VALID_DISCOUNT_TYPES = ['percentage', 'fixed', 'free', 'bogo', 'other'];
    if (discount_type && !VALID_DISCOUNT_TYPES.includes(discount_type)) {
      return res.status(400).json({ message: "Tip de discount invalid" });
    }
```

Adaugă aceeași validare în `web.js` la rutele de creare/update ofertă și în `offerService.js` la `createOffer`.

**RISC:** Oferte existente cu tipuri nestandard vor continua să funcționeze (doar write-ul e validat). Verifică ce valori există: `SELECT DISTINCT discount_type FROM offers;`

---

### FIX M07: reviews.js console.log excesiv cu PII

**Fișier:** `appredueri_backend/src/routes/reviews.js`
**Liniile:** ~97-98, 104, și altele

Caută toate `console.log` din `reviews.js` și elimină-le pe cele care logează date utilizator (user IDs, review content). Păstrează `console.error` pentru erori:

```js
// ELIMINĂ aceste linii:
console.log("Is New Review:", isNewReview);
console.log("Existing reviews found:", existingReview.rows.length);
console.log("Inserting NEW review...");
// etc.
```

**RISC:** Zero — doar eliminare logging.

---

### FIX M08: db.js SSL rejectUnauthorized: false

**Fișier:** `appredueri_backend/src/db.js`
**Linia:** 9

**Cod curent:**
```js
  ssl: isProduction ? { rejectUnauthorized: false } : false,
```

**Cod nou** — adaugă comentariu explicativ:
```js
  // Railway shared-certificate setup: TLS encryption without cert verification.
  // TODO: Obtain Railway CA cert and switch to { rejectUnauthorized: true, ca: ... }
  ssl: isProduction ? { rejectUnauthorized: false } : false,
```

NU schimba valoarea — doar documentează. Schimbarea la `true` fără CA cert ar crăpa conexiunea la Railway.

---

### FIX M09: Admin N+1 query per business

**Fișier:** `appredueri_backend/src/routes/admin.js`

Caută pattern-ul unde se face un query per business (loop cu query individual). Dacă există un loop ca:
```js
for (const business of businesses) {
  const offers = await pool.query("SELECT ... WHERE business_id = $1", [business.id]);
}
```

Refactorizează într-un singur query cu `JOIN` sau `WHERE business_id = ANY($1)`:
```js
const offerCounts = await pool.query(
  "SELECT business_id, COUNT(*) as cnt FROM offers WHERE business_id = ANY($1) GROUP BY business_id",
  [businesses.map(b => b.id)]
);
```

**RISC:** Low. Verifică că rezultatele sunt corect mapate înapoi la businesses.

---

### FIX M11: No Cache-Control pe API responses

**Fișier:** `appredueri_backend/src/index.js`
**Linia:** ~136-139 (după security headers)

Adaugă header pentru API routes:

```js
// Prevent caching of authenticated API responses
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
```

Plasează DUPĂ helmet middleware dar ÎNAINTE de routes.

**RISC:** Zero — doar adaugă header. Static assets nu sunt afectate (sunt pe alte path-uri).

---

### FIX M15: Debug console.log în Google OAuth (login.ejs)

**Fișier:** `appredueri_backend/src/views/public/login.ejs`

Caută `console.log` în fișier și elimină-le pe cele de debug din flow-ul Google OAuth:
```js
// ELIMINĂ:
console.log('Google response:', response);
console.log('Token:', response.credential);
console.log('Google auth result:', data);
```

**RISC:** Zero — doar cleanup.

---

### FIX M18: Flutter initial auth status not handled in router

Acest fix e DEJA inclus în CRIT-14 (01-critical-fixes.md). Verifică că a fost aplicat. Dacă da, skip.

---

### FIX M21: Flutter searchSuggest endpoint uses /api/web/ prefix

**Fișier:** `ofai_flutter/lib/core/network/api_endpoints.dart`

Verifică linia cu `searchSuggest` — dacă folosește `/api/web/` prefix (care e web-only), verifică că serverul acceptă acest endpoint și de la mobile. Dacă nu, schimbă la `/api/` prefix. Caută în backend ce rută corespunde.

**RISC:** Schimbarea prefix-ului poate necesita o rută nouă în backend. Verifică întâi.

---

### FIX M22: Flutter businessRequests endpoint inconsistent

**Fișier:** `ofai_flutter/lib/core/network/api_endpoints.dart`

Similar cu M21 — verifică prefix-ul. Document only dacă funcționează corect.

---

### FIX M28: vercel.json committed dar deploy e pe Railway

**Fișier:** `appredueri_backend/vercel.json`

Verifică dacă fișierul mai e necesar. Dacă deploy-ul e exclusiv pe Railway, șterge fișierul.

**RISC:** Dacă cineva mai vrea să deploy pe Vercel, îl pierde. Dar proiectul e committed în git — poate fi recuperat.

---

### FIX M31: n8n.js — webhookPath fără validare

**Fișier:** `appredueri_backend/src/services/n8n.js`
**Linia:** 12-14

**Cod curent:**
```js
function triggerWebhook(webhookPath, payload) {
  if (!N8N_BASE_URL) return;
  const url = `${N8N_BASE_URL}${webhookPath}`;
```

**Cod nou:**
```js
function triggerWebhook(webhookPath, payload) {
  if (!N8N_BASE_URL) return;
  // Ensure webhookPath starts with / and doesn't contain protocol
  if (!webhookPath.startsWith('/') || webhookPath.includes('://')) {
    console.error(`[n8n] Invalid webhook path: ${webhookPath}`);
    return;
  }
  const url = `${N8N_BASE_URL}${webhookPath}`;
```

**RISC:** Zero — doar validare pe input intern.

---

### FIX M35: db.js pool error handler nu face exit

**Fișier:** `appredueri_backend/src/db.js`
**Linia:** 25-27

**Cod curent:**
```js
pool.on("error", (err) => {
  console.error("[DB] Unexpected error on idle client:", err);
});
```

**Cod nou:**
```js
pool.on("error", (err) => {
  console.error("[DB] Unexpected error on idle client:", err);
  // Exit to trigger Railway's process restart — pool may be wedged
  process.exit(-1);
});
```

**RISC:** Serverul se restartează pe orice eroare de pool idle client. Pe Railway, procesul se restart automat. Aceasta e practica recomandată de node-postgres docs.

---

### FIX M37: Migration seed values inconsistente (033 vs 042)

**Fișier:** `appredueri_backend/src/migrations/033_business_subscriptions.sql`

Adaugă comentariu explicativ la seed INSERT:

```sql
-- Note: These initial values were updated post-deploy by migration 042.
-- The values below reflect the ORIGINAL seed, not the current production values.
-- For current values, see migration 042_update_tier_values.sql.
```

**Fișier:** `appredueri_backend/src/migrations/042_update_tier_values.sql`

Adaugă comentariu:
```sql
-- Note: Updates tier values from original 033 seed to final production values.
-- If running on a fresh DB where 033 already has correct values, these UPDATEs are idempotent.
```

**RISC:** Zero — doar documentare.

---

### FIX M38: Unbounded SELECT favorites/follows

**Fișier:** `appredueri_backend/src/routes/web.js`
**Liniile:** ~305-306, 513, 680, 911, 1243

Caută query-urile:
```sql
SELECT offer_id FROM favorite_offers WHERE user_id = $1
SELECT business_id FROM followed_businesses WHERE user_id = $1
```

Adaugă `LIMIT 10000` ca safety cap:
```sql
SELECT offer_id FROM favorite_offers WHERE user_id = $1 LIMIT 10000
SELECT business_id FROM followed_businesses WHERE user_id = $1 LIMIT 10000
```

**RISC:** Un power user cu >10000 favorite va pierde highlighting pe ultimele. Acceptabil — nimeni nu va avea 10000 favorites.

---

### VERIFICARE FINALĂ

1. `cd appredueri_backend && node src/index.js` — serverul pornește
2. `cd ofai_flutter && flutter analyze --no-pub` — fără erori noi
3. Commit cu mesaj: `fix: medium-priority fixes from audit #9 (date filter, validation, logging cleanup)`
4. Push pe branch-ul curent

## PROMPT END
