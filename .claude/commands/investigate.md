# Investigate & Masterplan — OFAI

Investigație profundă pentru bug-uri, comportamente ciudate, sau lucruri care nu au sens. Nu sari direct la fix — explorează, diagnostichează, apoi propune un plan complet.

## Input: $ARGUMENTS
Descrie problema, screenshot-ul, sau ce nu are sens. Exemple:
- `pe pagina ofertei apare "Arată la casă" dar business-ul e online`
- `booking-ul nu se salvează corect din portal`
- `pe mobile apare altceva decât pe web pentru aceeași ofertă`
- `owner-ul a selectat X dar pe pagina publică apare Y`

## Step 1: Explore — Trasează data flow-ul complet

### Lansează Explore agents (max 3, în paralel) pentru a înțelege:
1. **Sursa datelor** — De unde vine valoarea? Form → API route → DB column. Citește codul actual, nu presupune.
2. **Transformările** — Ce se întâmplă cu datele între save și display? Inherit logic, fallbacks, mappings.
3. **Display-ul** — Cum ajunge valoarea în template/screen? Ce condiții verifică?

### Verifică starea reală a datelor:
```bash
# Interoghează DB-ul direct — nu te baza pe ce "ar trebui" să fie
node -e "require('dotenv').config(); const {Pool}=require('pg'); ..."
```

## Step 2: Diagnose — Identifică root cause-ul exact

### Compară cele 3 straturi:
| Strat | Ce arată? | Ce e în DB? | Disconnect? |
|-------|-----------|-------------|-------------|
| Portal (form) | [valoare afișată] | [valoare salvată] | DA/NU |
| Display (web) | [ce vede consumatorul] | [ce citește query-ul] | DA/NU |
| Display (mobile) | [ce vede app-ul] | [ce trimite API-ul] | DA/NU |

### Documentează:
- **Root cause:** ex: "Portal arată preview din profile.phone dar salvează booking_phone = NULL"
- **Impact:** Câte recorduri sunt afectate? (COUNT query)
- **Reproducere:** Pași exacti care duc la bug

## Step 3: Plan — Masterplan pe faze prioritizate

Intră în **plan mode** și creează un plan cu:

### Structura obligatorie:
```
Faza 1 [CRITICAL] — Fix root cause
  - Ce se schimbă, unde, de ce
  - Backfill date existente (dry-run COUNT înainte de UPDATE)

Faza 2 [IMPORTANT] — Defense in depth
  - Fallback-uri pe display routes
  - Previne recidiva

Faza 3 [MODERATE] — Improvements conexe
  - UX, cleanup, simplificări descoperite în investigație

Faza 4 [LOW] — Nice to have / Deferred
  - Architectural improvements, Flutter sync, etc.
```

### Pentru fiecare fază include:
- Fișierele exacte + linia aproximativă
- Snippet de cod propus (nu pseudocod)
- Riscul schimbării (Low/Medium/High)

## Step 4: Present — Prezintă user-ului

Arată un summary clar:
1. **Root cause** — ce e stricat și de ce
2. **Impact** — câte business-uri/oferte sunt afectate
3. **Plan** — fazele cu prioritatea lor
4. Așteaptă aprobarea înainte de implementare

## Step 5: Fix — Implementare pe faze

Pentru fiecare fază:
1. Editează codul
2. Restart server
3. Verifică (snapshot/screenshot/DB query)
4. Marchează faza completă

### La final:
- Verifică că bug-ul original e rezolvat
- Verifică că ofertele/business-urile existente funcționează (backward compat)
- Flutter analyze (dacă s-au modificat fișiere Dart)
- Commit + push

## Anti-patterns — NU face asta:
- ❌ Nu sari direct la fix fără să înțelegi data flow-ul complet
- ❌ Nu presupune ce e în DB — interoghează
- ❌ Nu fix-ui doar simptomul (display) fără să fix-ui sursa (save)
- ❌ Nu uita de backfill pe datele existente corupte
- ❌ Nu ignora mobile API-ul când fix-ui web-ul (sau invers)
