# Code Review — Targeted

Review rapid si targeted al codului modificat recent. Diferit de /audit (full project) — se concentreaza pe schimbarile recente.

## Input: $ARGUMENTS
- **(gol)** — review uncommitted changes (git diff)
- **`last`** sau **`N`** (numar) — review ultimul commit sau ultimele N commit-uri
- **`file <path>`** — review un fisier specific
- **`pr`** — review toate schimbarile din branch-ul curent vs main

## Pasii de review

### 1. Colecteaza schimbarile
- Ruleaza `git diff` (unstaged), `git diff --cached` (staged), sau `git log -N --stat` + `git diff HEAD~N..HEAD`
- Identifica fisierele modificate si tipul lor (backend JS, EJS, CSS, Flutter Dart, SQL migration)

### 2. Review per fisier — verifica aceste reguli specifice proiectului

#### Backend JS (routes/, services/, helpers/, middleware/)
- [ ] SQL injection — parametrii interpolati direct in query? (trebuie $1, $2...)
- [ ] Auth middleware prezent pe toate rutele noi (requireBusinessOwner, businessAuth, requireAdmin, optionalAuth)
- [ ] `parseInt(req.params.*, 10)` pe toti parametrii numerici din URL
- [ ] Error handling — catch blocks care nu inghit erori silentios
- [ ] Business ownership via `user_businesses` (NU owner_id direct)
- [ ] offers table NU are created_at — sort by `o.id DESC`
- [ ] Duplicate logic — ruta noua in web.js exista si in business-portal.js?
- [ ] Tier checks — `requireFeature()` sau `getBusinessTier()` unde e nevoie
- [ ] CSRF — rutele POST din web router au protectie (mobile exempt via X-Client header)

#### EJS Templates (views/)
- [ ] XSS — `<%-` (unescaped) folosit DOAR pentru HTML known-safe, `<%=` pentru user data
- [ ] Inline styles excesive — ar trebui sa fie in main.css (specificity issues)
- [ ] Variables undefined — toate variabilele din template sunt pasate din route
- [ ] Responsive — elementele noi au media queries in main.css

#### CSS (main.css)
- [ ] Specificity conflicts — inline styles > class selectors
- [ ] Dark mode — toate culorile noi folosesc CSS variables (--bg-*, --text-*, --accent)
- [ ] Dead rules — reguli care nu mai au corespondent in EJS

#### Flutter Dart (lib/)
- [ ] Null safety — `?.` si `??` pe campuri nullable
- [ ] DM Serif Display — NICIODATA fontWeight pe acest font
- [ ] FutureProvider — `.autoDispose` pe detail screens
- [ ] Dispose — controllers, focus nodes, animation controllers disposed
- [ ] `Business.category` e `IdName?` — foloseste `b.categoryName` getter
- [ ] Card `Clip.hardEdge` (nu antiAlias)
- [ ] State — Riverpod patterns (StateNotifier, nu setState pe provideri)

#### SQL Migrations
- [ ] `IF NOT EXISTS` pe CREATE TABLE/INDEX
- [ ] `ON DELETE CASCADE` sau `SET NULL` pe FK-uri
- [ ] Indexuri pe coloanele folosite in WHERE/JOIN frecvent
- [ ] Nu are functii volatile (NOW()) in partial index predicates
- [ ] NOT NULL nu conflicta cu ON DELETE SET NULL

### 3. Output

Pentru fiecare problema gasita, afiseaza:
```
[SEVERITY] file:line — descriere
  Cod actual:   <linia problematica>
  Fix sugerat:  <cum ar trebui sa arate>
```

Severity levels: CRITICAL (security/crash), HIGH (bug), MEDIUM (potential issue), LOW (style/convention)

La final, afiseaza summary:
```
=== Review Summary ===
Files reviewed: N
Issues: X critical, Y high, Z medium, W low
Safe to commit: YES/NO
```

Daca nu sunt probleme, confirma clar ca schimbarile sunt safe.
