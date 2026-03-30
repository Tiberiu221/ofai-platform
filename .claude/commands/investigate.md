# Investigate & Masterplan — OFAI

Investigație profundă pentru bug-uri, comportamente ciudate, sau audituri exploratorii. Nu sari direct la fix — explorează, diagnostichează, apoi propune un plan complet.

## Input: $ARGUMENTS
Descrie problema, screenshot-ul, sau ce nu are sens. Exemple:
- `pe pagina ofertei apare "Arată la casă" dar business-ul e online`
- `booking-ul nu se salvează corect din portal`
- `pe mobile apare altceva decât pe web pentru aceeași ofertă`
- `owner-ul a selectat X dar pe pagina publică apare Y`
- `ce se poate îmbunătăți pe flow-ul de booking?` (audit mode)

## Step 0: Context Check — Ce știm deja?

### Înainte de orice investigație:
1. **Citește CLAUDE.md** — secțiunile "Current State", "Remaining Gaps", "Important Gotchas"
2. **Citește MEMORY.md** — verifică dacă problema e deja documentată sau rezolvată
3. **Verifică git log** — `git log --oneline -20` pentru fix-uri recente relevante

### Determină modul de lucru:
- **Bug mode** — problema specifică, reproductibilă → treci la Step 1
- **Audit mode** — explorare deschisă ("ce se poate îmbunătăți?") → lansează explore agents pe flow-uri mari, colectează findings, filtrează false positives, apoi creează masterplan

## Step 1: Reproduce — Verifică vizual

### Înainte de a te scufunda în cod:
1. **Pornește serverul** (preview_start) și reproduce problema vizual
2. **Screenshot/snapshot** al problemei actuale — confirmă că exista
3. **Dacă nu se reproduce** — problem solved sau alt context necesar

### Dacă e audit mode (nu un bug specific):
- Navighează flow-urile relevante
- Notează ce funcționează bine vs ce lipsește
- Nu presupune probleme — confirmă-le

## Step 2: Explore — Trasează data flow-ul complet

### Lansează Explore agents (max 3, în paralel) pentru a înțelege:
1. **Sursa datelor** — De unde vine valoarea? Form → API route → DB column. Citește codul actual, nu presupune.
2. **Transformările** — Ce se întâmplă cu datele între save și display? Inherit logic, fallbacks, mappings.
3. **Display-ul** — Cum ajunge valoarea în template/screen? Ce condiții verifică?

### Verifică starea reală a datelor:
```bash
# Interoghează DB-ul direct — nu te baza pe ce "ar trebui" să fie
cd appredueri_backend && node -e "require('dotenv').config(); const {Pool}=require('pg'); ..."
```

## Step 3: Validate Findings — Elimină false positives

### Checklist obligatoriu pentru FIECARE finding:
- [ ] **E deja documentat în CLAUDE.md ca known gap?** → skip sau reference
- [ ] **E deja implementat dar ascuns?** (ex: JS face render dinamic, nu doar template-ul static) → verify cu server running
- [ ] **E intentional?** (ex: "Gamification UI hidden" din CLAUDE.md) → skip
- [ ] **Datele din DB confirmă problema?** → COUNT/SELECT query
- [ ] **Afectează useri reali sau doar seed data?** → evaluează impactul real

### Red flags de false positive:
- "Template-ul arată doar un spinner" — dar poate JS-ul face render complet (verifică funcțiile JS)
- "Endpoint lipsește" — dar poate e în alt router file (web.js vs business-portal.js vs web-portal-api.js)
- "Feature lipsește" — dar CLAUDE.md o listează ca implementată

## Step 4: Diagnose — Identifică root cause-ul exact

### Compară cele 3 straturi:
| Strat | Ce arată? | Ce e în DB? | Disconnect? |
|-------|-----------|-------------|-------------|
| Portal (form) | [valoare afișată] | [valoare salvată] | DA/NU |
| Display (web) | [ce vede consumatorul] | [ce citește query-ul] | DA/NU |
| Display (mobile) | [ce vede app-ul] | [ce trimite API-ul] | DA/NU |

### Documentează per finding:
- **Root cause:** ex: "Portal arată preview din profile.phone dar salvează booking_phone = NULL"
- **Impact:** Câte recorduri sunt afectate? (COUNT query)
- **Reproducere:** Pași exacti care duc la bug
- **False positive?** → marchează și exclude din plan

## Step 5: Plan — Masterplan pe faze prioritizate

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

## Step 6: Present — Prezintă user-ului

Arată un summary clar:
1. **Root cause** — ce e stricat și de ce
2. **Impact** — câte business-uri/oferte sunt afectate
3. **False positives eliminate** — ce ai investigat dar NU e o problemă reală
4. **Plan** — fazele cu prioritatea lor
5. Așteaptă aprobarea înainte de implementare

## Step 7: Fix — Implementare pe faze cu batch commits

### Pentru fiecare fază:
1. Editează codul
2. Verifică cu preview tools (snapshot/eval/screenshot)
3. Marchează faza completă

### Commit strategy (pentru masterplan-uri cu 5+ items):
- **Batch commits pe faze** — nu un singur commit uriaș
- Pattern: `fix: masterplan batch N — description (X items)`
- Commit + push după fiecare 3-5 items completate
- Listează items-urile în commit message

### La final:
- Verifică că bug-ul original e rezolvat (preview tools)
- Verifică backward compatibility pe datele existente
- Flutter analyze (dacă s-au modificat fișiere Dart)
- Push final

## Anti-patterns — NU face asta:
- ❌ Nu sari direct la fix fără să înțelegi data flow-ul complet
- ❌ Nu presupune ce e în DB — interoghează
- ❌ Nu fix-ui doar simptomul (display) fără să fix-ui sursa (save)
- ❌ Nu uita de backfill pe datele existente corupte
- ❌ Nu ignora mobile API-ul când fix-ui web-ul (sau invers)
- ❌ Nu presupune că un finding e real — validează cu DB + server running
- ❌ Nu ignora CLAUDE.md — multe "probleme" sunt deja known gaps sau intentional hidden
- ❌ Nu face un singur commit cu 15+ schimbări — batch pe faze
