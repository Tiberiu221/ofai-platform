# Systematic Fix — OFAI

Debug si fix sistematic pentru un bug sau issue specific. Urmeaza metodologia: Reproduce → Locate → Understand → Fix → Verify.

## Input: $ARGUMENTS
Descrie bug-ul, eroarea, sau issue-ul. Exemple:
- `CRIT-05: max_reveals promo codes nu se verifica la reveal`
- `Flutter crash pe offer detail cand business e null`
- `TypeError: Cannot read property 'name' of undefined in web.js`
- `Portal analytics chart nu se incarca`
- `500 error pe POST /api/web/portal/:bid/offers`

## Step 1: Understand — Ce spune bug-ul?

### Parse input-ul
1. Extrage: tipul erorii (crash, wrong behavior, 500, UI, performance)
2. Extrage: fisierul/ruta/componenta afectata (daca e mentionat)
3. Extrage: conditiile de reproducere (daca sunt mentionate)

### Identifica domeniul
| Keywords | Domeniu | Fisiere de verificat |
|----------|---------|---------------------|
| web.js, EJS, portal, /api/web | Backend Web | src/routes/web*.js, src/views/ |
| business-portal, /api/business | Backend Portal | src/routes/business-portal.js |
| offers.js, /offers, /api/offers | Mobile API | src/routes/offers.js |
| Flutter, dart, screen, provider | Flutter | ofai_flutter/lib/ |
| migration, SQL, table, column | Database | src/migrations/, src/db.js |
| CSS, style, layout, responsive | Frontend CSS | src/public/css/ |
| cron, schedule, job | Cron Jobs | src/services/cronJobs.js (18 jobs) |
| stripe, billing, payment | Billing | src/routes/billing.js, src/services/stripe.js |
| tier, subscription, plan | Subscriptions | src/helpers/tiers.js, src/middleware/tierAuth.js |

## Step 2: Locate — Gaseste codul relevant

### Strategia de cautare
1. **Daca ai un mesaj de eroare** — cauta textul exact cu Grep in codebase
2. **Daca ai o ruta** — cauta pattern-ul rutei (ex: `router.post('/offers'`)
3. **Daca ai un fisier** — citeste-l direct
4. **Daca ai doar o descriere** — cauta keywords relevante

### OFAI-specific gotchas de verificat
- Este in **web.js SAU business-portal.js**? (duplicate routes!)
- Foloseste `req.user` sau `req.webUser`? (web = webUser, mobile = user)
- Table-ul offers **NU are created_at** — sort by `o.id DESC`
- `user_businesses` junction table (NU `owner_id`)
- Portal IIFE scope — functii pe `window` pentru `onclick`
- Flutter: `offer.business` poate fi null
- DB pool: `require("../db")` (NU `../config/database`)

## Step 3: Analyze — De ce apare bug-ul?

1. **Citeste codul** complet in jurul bug-ului (nu doar linia problematica)
2. **Trace data flow:** input → validare → DB query → response
3. **Identifica root cause** (nu doar simptomul):
   - Missing null check?
   - Wrong variable name?
   - Race condition?
   - Missing auth middleware?
   - Wrong SQL join?
   - Schema mismatch?
4. **Evalueaza impactul:**
   - Cine e afectat? (toti userii, doar business owners, doar mobile, doar web?)
   - Cat de grav? (crash, wrong data, cosmetic?)
   - Exista workaround?

## Step 4: Fix — Implementeaza solutia

### Reguli de fix
1. **Minimal change** — nu refactoriza in jurul fix-ului
2. **Pastreaza stilul existent** — match code conventions din fisier
3. **Mesaje in Romana** — UI strings sunt in romana
4. **Parametri SQL** — `$1, $2` (NICIODATA string concatenation)
5. **Duplicate routes** — daca fix-ul e intr-o ruta, verifica ca NU exista aceeasi ruta in alt fisier
6. **Fire-and-forget** — gamification calls cu `.catch(() => {})`

### Template de fix
```
BEFORE (ce era gresit):
  <cod original>

AFTER (ce am schimbat):
  <cod nou>

WHY:
  <explicatie scurta de ce fix-ul rezolva root cause>
```

## Step 5: Verify — Confirma ca fix-ul functioneaza

### Backend fix — preview verification
Porneste serverul cu preview_start si verifica vizual ca fix-ul functioneaza (snapshot/eval/screenshot). Nu te baza doar pe "server starts clean".

```bash
cd appredueri_backend
# Server starts clean
timeout 5 node src/index.js 2>&1 | head -20
```

### Flutter fix
```bash
cd ofai_flutter
"C:/dev/flutter/bin/flutter.bat" analyze --no-pub 2>&1 | grep -i "error"
```

### Regression check
- Fix-ul introduce alte probleme?
- Alte rute/componente folosesc aceeasi functie modificata?
- Testele existente trec? (daca exista)

## Step 6: Document

Afiseaza rezumat clar:
```
=== Fix Applied ===
Issue:    <descriere scurta>
Root cause: <ce era gresit>
Files:    <lista fisierelor modificate cu liniile>
Fix:      <ce s-a schimbat>
Verified: ✅ server starts / ✅ flutter analyze clean / ✅ no regression
Risk:     Low / Medium / High
```
