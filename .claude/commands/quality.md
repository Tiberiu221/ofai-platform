# Quality Gate — OFAI

Ruleaza verificari de calitate pe backend + Flutter. Fail-fast: se opreste la prima eroare critica.

## Input: $ARGUMENTS
- **(gol)** — full check: backend + Flutter
- **`backend`** — doar backend checks
- **`flutter`** — doar Flutter checks
- **`quick`** — doar lint/analyze (fara server start test)

## Step 1: Backend Quality

### 1.1 Syntax & Lint Check
```bash
cd appredueri_backend
# Check for syntax errors in all JS files
node -c src/index.js 2>&1 || echo "SYNTAX ERROR"
```

### 1.2 Server Start Test (skip daca `quick`)
```bash
cd appredueri_backend
# Start server, wait 5 seconds, check it's running, then kill
timeout 8 node src/index.js &
SERVER_PID=$!
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/ || echo "SERVER FAILED"
kill $SERVER_PID 2>/dev/null
```
**IMPORTANT:** Daca portul 4000 e deja ocupat, skipuieste acest pas si noteaza.

### 1.3 Common Issues Scan
Verifica rapid cu Grep:
- `<%-` in EJS templates — fiecare trebuie sa fie HTML known-safe (nu user data)
- `require("../config/database")` — GRESIT, trebuie `require("../db")`
- `req.user` in web routes — GRESIT in web context, trebuie `req.webUser`
- `created_at` pe tabela offers — NU EXISTA, trebuie `o.id DESC`
- `owner_id` pe businesses — GRESIT, trebuie `user_businesses` junction
- `form-control` in portal templates — GRESIT, trebuie `form-input`/`form-select`

### 1.4 Security Quick Scan
- Template strings in SQL queries (potential SQL injection)
- `innerHTML` cu user data (XSS)
- Missing `parseInt()` pe `req.params` numerici

## Step 2: Flutter Quality

### 2.1 Flutter Analyze
```bash
cd ofai_flutter
"C:/dev/flutter/bin/flutter.bat" analyze --no-pub 2>&1
```
**ATENTIE:** Filtreaza doar liniile cu `error` (majuscula mica). `info` si `warning` sunt pre-existente.

### 2.2 Flutter Common Issues
Verifica cu Grep in `ofai_flutter/lib/`:
- `offer.business!` fara null guard prealabil
- `setState` fara `mounted` check
- `fontWeight` pe DM Serif Display (nu suporta)
- `Clip.antiAlias` pe cards (trebuie `Clip.hardEdge`)
- `autoDispose` pe provideri care nu trebuie (offersListProvider, businessesListProvider)

## Step 3: Cross-Check

### 3.1 Git Status
- Fisiere uncommitted sensibile? (`.env`, `credentials`, `key.properties`)
- Conflicte de merge?

### 3.2 Dependency Check
```bash
cd appredueri_backend && npm audit --omit=dev 2>&1 | tail -5
```

## Output

```
=== Quality Gate — OFAI ===

Backend:
  Syntax:     ✅ / ❌ (detalii)
  Server:     ✅ starts clean / ❌ crash (error msg)
  Patterns:   X issues found / ✅ clean
  Security:   X issues / ✅ clean

Flutter:
  Analyze:    X errors / ✅ clean
  Patterns:   X issues / ✅ clean

Cross-check:
  Git:        ✅ clean / ⚠️ N uncommitted files
  Deps:       X vulnerabilities / ✅ clean

Gate: PASS ✅ / FAIL ❌ (N blocking issues)
```

Daca gate = FAIL, listeaza fiecare issue cu fisier + linie + fix sugerat.
