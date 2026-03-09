# Changelog Generator — OFAI

Genereaza changelog structurat din git history. Parseaza commit messages, detecteaza semantic bump, si produce release notes.

## Input: $ARGUMENTS
- **(gol)** — genereaza changelog de la ultimul tag (sau ultimele 20 commits daca nu exista tag)
- **`vX.Y.Z`** — genereaza changelog de la tag-ul specificat pana la HEAD
- **`last N`** — changelog pentru ultimele N commits
- **`full`** — changelog complet (toata istoria)

## Commit Parsing

Parseaza commit messages in format Conventional Commits:
```
<type>[optional scope]: <description>

Types:
- feat     → Added (MINOR bump)
- fix      → Fixed (PATCH bump)
- perf     → Performance (PATCH bump)
- refactor → Changed (no bump)
- docs     → Documentation (no bump)
- test     → Tests (no bump)
- chore    → Maintenance (no bump)
- security → Security (PATCH bump)
- build    → Build (no bump)
- ci       → CI/CD (no bump)

Breaking changes: MAJOR bump
- "BREAKING CHANGE:" in footer
- "!" after type: feat!: ...
```

## Steps

### 1. Colecteaza commits

```bash
# De la ultimul tag
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~20")..HEAD --pretty=format:"%H|%s|%an|%ad" --date=short

# Sau de la un tag specific
git log v1.0.0..HEAD --pretty=format:"%H|%s|%an|%ad" --date=short

# Sau ultimele N
git log -N --pretty=format:"%H|%s|%an|%ad" --date=short
```

### 2. Categorizeaza

Grupeaza commits pe sectiuni Keep a Changelog:
- **Adaugat** (Added) — feat commits
- **Modificat** (Changed) — refactor, update commits
- **Reparat** (Fixed) — fix commits
- **Securitate** (Security) — security commits
- **Performanta** (Performance) — perf commits
- **Sters** (Removed) — remove, delete commits
- **Documentatie** (Documentation) — docs commits

### 3. Detecteaza version bump

```
Has "BREAKING CHANGE" or "!" → MAJOR
Has "feat" → MINOR
Has only "fix"/"perf"/"security" → PATCH
```

### 4. Genereaza output

Format Keep a Changelog (in Romana):

```markdown
# Changelog

## [vX.Y.Z] — YYYY-MM-DD

### Adaugat
- Descrierea feature-ului (#hash)

### Reparat
- Descrierea fix-ului (#hash)

### Securitate
- Descrierea fix-ului de securitate (#hash)

### Modificat
- Descrierea refactoring-ului (#hash)
```

## Special Rules for OFAI

- Commits cu "Co-Authored-By: Claude" — marcheaza cu 🤖
- Commits cu "audit" in message — grupeaza sub "Securitate"
- Commits cu "migration" — noteaza numarul migratiei
- Commit messages in English, dar changelog output in **Romana**

## Output

1. Afiseaza changelog-ul generat in consola
2. Intreaba utilizatorul daca vrea sa-l salveze in `CHANGELOG.md` la root
3. Daca da, prepend la inceputul fisierului (pastrand changelog-ul vechi)

### Exemplu output real:

```markdown
## [v0.9.0] — 2026-03-06

### Securitate
- Aplicat 60+ fix-uri audit #9: XSS, path traversal, URL sanitization, banned_at checks, SSRF guard (3ebb368) 🤖
- Adaugat writeLimiter 60/min pe POST/PUT/DELETE (3ebb368) 🤖
- Express pinned la ~5.1.0 pentru stabilitate (3ebb368) 🤖

### Adaugat
- Migratii 043-047: schema gaps, indexes, password_reset_tokens (3ebb368) 🤖
- .env.example cu toate variabilele documentate (3ebb368) 🤖

### Reparat
- Fix date filter >=CURRENT_DATE cu NULL handling (3ebb368) 🤖
- Fix banned check inainte de password compare la login (3ebb368) 🤖
- Fix Flutter CancelToken pe businesses_provider si search_suggest (3ebb368) 🤖

### Sters
- vercel.json (nu mai folosim Vercel) (3ebb368) 🤖
```
