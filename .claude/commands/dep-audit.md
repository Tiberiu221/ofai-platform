# Dependency Auditor — OFAI

Scaneaza dependentele backend (npm) si mobile (Flutter/pub) pentru vulnerabilitati, licente problematice, pachete outdated, si bloat.

## Input: $ARGUMENTS
- **(gol)** — full audit: vulnerabilities + licenses + outdated + bloat
- **`vuln`** — doar vulnerability scan
- **`outdated`** — doar outdated check
- **`license`** — doar license compliance
- **`bloat`** — doar unused/oversized deps

## Step 1: Backend (npm) — Vulnerability Scan

```bash
cd appredueri_backend

# npm audit — built-in CVE scanner
npm audit --omit=dev
npm audit --json | jq '.vulnerabilities | to_entries | map({name: .key, severity: .value.severity, via: .value.via[0]}) | sort_by(.severity)'

# Alternativ: snyk (mai detaliat)
npx snyk test --severity-threshold=medium
```

### Checklist vulnerabilitati:
- [ ] 0 critical/high vulnerabilities
- [ ] express pinned la ~5.1.0 (verificat)
- [ ] Toate middleware-urile (helmet, cors, cookie-parser, multer) la versiuni recente
- [ ] pg (node-postgres) — verificat pentru SQL injection patterns
- [ ] jsonwebtoken — verificat pentru JWT vulnerabilities
- [ ] stripe — verificat la ultima versiune stabila

## Step 2: Flutter (pub) — Vulnerability Scan

```bash
cd ofai_flutter
"C:/dev/flutter/bin/flutter.bat" pub outdated
"C:/dev/flutter/bin/flutter.bat" pub deps
```

### Checklist Flutter:
- [ ] dio — ultima versiune (HTTP client, CancelToken)
- [ ] flutter_riverpod — versiune compatibila
- [ ] go_router — versiune compatibila
- [ ] flutter_secure_storage — fara known issues
- [ ] firebase_messaging — compatibil cu Firebase BoM

## Step 3: Outdated Dependencies

```bash
# Backend — check outdated
cd appredueri_backend && npm outdated

# Categorize:
# PATCH updates (safe): npm update
# MINOR updates (usually safe): review changelog first
# MAJOR updates (breaking): plan migration

# Flutter — check outdated
cd ofai_flutter && "C:/dev/flutter/bin/flutter.bat" pub outdated --show-all
```

### Priority Updates:
- **Security-critical**: jsonwebtoken, helmet, express, pg, stripe → update immediately
- **Feature deps**: multer, cloudinary, sharp → update monthly
- **Dev deps**: nodemon, eslint → update quarterly
- **Flutter**: check flutter.dev for breaking changes before updating

## Step 4: License Compliance

```bash
cd appredueri_backend

# Check all licenses
npx license-checker --summary
npx license-checker --failOn "GPL-2.0;GPL-3.0;AGPL-3.0" --production

# Acceptable licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD
# Warning: LGPL-2.1 (usually OK for Node.js), MPL-2.0 (file-level copyleft)
# Block: GPL-2.0, GPL-3.0, AGPL-3.0 (viral copyleft)
```

### License Rules for OFAI:
- OFAI is a proprietary commercial product
- **ALLOWED**: MIT, Apache-2.0, BSD, ISC, 0BSD, Unlicense, CC0
- **WARNING**: LGPL, MPL (review usage carefully)
- **BLOCKED**: GPL, AGPL (incompatible with proprietary distribution)

## Step 5: Dependency Bloat

```bash
cd appredueri_backend

# Unused dependencies
npx depcheck

# Large dependencies (top 20)
du -sh node_modules/* 2>/dev/null | sort -rh | head -20

# Total node_modules size
du -sh node_modules/

# Check for redundant packages (same functionality)
# Common overlaps to check:
# - axios vs node-fetch vs got (we use none — Express handles requests)
# - moment vs dayjs vs date-fns (check if any imported)
# - lodash vs underscore (check if whole lodash imported vs lodash/method)
```

### Flutter Bloat:
```bash
cd ofai_flutter
"C:/dev/flutter/bin/flutter.bat" pub deps --style=compact
# Check for unused imports in lib/
"C:/dev/flutter/bin/flutter.bat" analyze --no-pub
```

## Output

```
=== Dependency Audit — OFAI ===
Date: YYYY-MM-DD

## Vulnerabilities
Backend: X critical, Y high, Z medium
Flutter: X issues

## Outdated
Backend: X major, Y minor, Z patch updates available
Flutter: X updates available

## Licenses
Backend: X packages total, all compliant: YES/NO
Blocked licenses found: [list]

## Bloat
node_modules: X MB
Unused backend deps: [list]
Unused Flutter deps: [list]

## Priority Actions
1. [CRITICAL] Update package X — CVE-YYYY-NNNNN
2. [HIGH] Remove unused dep Y — saves Z MB
3. [MEDIUM] Update Z packages to latest minor
```

Daca gaseste vulnerabilitati CRITICAL sau HIGH, sugereaza fix-uri concrete cu `npm audit fix` sau update manual.
