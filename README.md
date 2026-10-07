# OFAI — Oferte și Reduceri din România

Platformă de oferte și reduceri locale. Conectează utilizatorii cu business-uri din orașul lor prin oferte active, ratings și locații pe hartă.

🌐 **Web:** [ofai.ro](https://ofai.ro)

## Construit cu Claude Code

Repo-ul este dezvoltat cu Claude Code ca unealtă principală de lucru: **730 de commit-uri în 2,5 luni, 555 (76%) co-semnate de Claude**, pe o platformă live ([ofai.ro](https://ofai.ro)) cu ~93.000 de linii scrise de mână (Node/Express + EJS, Flutter), 295 de endpoint-uri REST, 78 de migrații PostgreSQL, 20 de joburi cron și ~530 de teste (Jest, Playwright cu 46 de teste OWASP, Flutter).

Cum lucrez cu agentul, concret (vezi `CLAUDE.md`, `.claude/` și `PROJECT_CONTEXT.md`):

- **Context scris, nu promptat din memorie:** `CLAUDE.md` (reguli, decizii, ~70 de capcane documentate, workflow în 5 pași: explorează → interoghează DB → plan → aprobare → fix în faze) și `PROJECT_CONTEXT.md` (arhitectură, schemă, 12 audituri).
- **Agenți cu roluri** (`.claude/agents/`, 10): backend-dev, frontend-mobile, db-architect, security-auditor, secure-reviewer (read-only), test-engineer, debugger, devops, ui-designer, code-reviewer.
- **Comenzi slash = runbook-uri** (`.claude/commands/`, 22): `/audit`, `/pentest`, `/deploy-verify`, `/push-all`, `/runbook`, `/changelog`, `/investigate`…
- **Hook-uri după fiecare editare** (`.claude/settings.json` + `.claude/hooks/`): `flutter analyze`, `security-scan.sh` (secrete, SQL concatenat, input de utilizator nefiltrat spre LLM, script fără CSP nonce), `format-check.sh`.

Unde a greșit agentul și cum am corectat:

- **Securitate:** notificările toast foloseau `innerHTML` (XSS), iar un header `X-Client: mobile` putea sări CSRF-ul din orice browser. Prinse la auditul #8 cu agentul `security-auditor`; corectate (`textContent`, excepția de CSRF doar cu Bearer valid) și transformate în reguli + hook.
- **Prompt injection:** textul utilizatorilor ajungea direct în prompturile LLM; am introdus fencing `[USER_INPUT]` în toate cele 27 de locuri și un hook care refuză codul fără el.
- **Deploy:** `npm install` local a actualizat lockfile-ul, dar Railway rulează `npm ci` strict → build picat; regulă: `package.json` și `package-lock.json` se commit împreună.

Principiul: agentul propune, pipeline-ul decide. Teste și lint în aceeași comandă ca în producție, diff citit, al doilea agent cu altă lentilă.

## Structura Proiectului

```
ofai/
├── appredueri_backend/     # Node.js + Express API (PostgreSQL)
├── ofai_flutter/           # Flutter mobile app (iOS & Android)
├── .claude/                # Claude Code settings & hooks
└── README.md
```

## Tech Stack

| Component | Tehnologie |
|-----------|-----------|
| **Backend** | Node.js, Express, PostgreSQL |
| **Mobile** | Flutter 3.41+, Dart, Riverpod, GoRouter |
| **Imagini** | Cloudinary (upload/resize), CachedNetworkImage |
| **Auth** | JWT + Refresh Token, Google OAuth |
| **Billing** | Stripe (subscriptions, webhooks) |
| **AI** | Anthropic Claude (validation, moderation, summarization) |
| **Push** | Firebase Cloud Messaging (FCM) |
| **Email** | Resend |
| **Hosting** | Railway (backend), Cloudflare (DNS/CDN) |

## Flutter App — Quick Start

```bash
cd ofai_flutter
flutter pub get
flutter run
```

### Teste

```bash
# Rulează toate testele (68 teste — modele, widgets, formatare)
flutter test

# Sau scriptul complet (analyze + test + build check)
bash scripts/test_all.sh
```

### Structura app

```
ofai_flutter/
├── lib/
│   ├── core/               # Theme, network, storage, utils
│   ├── models/             # 13 models (Offer, Business, User, Category, City, etc.)
│   ├── providers/          # Riverpod state management
│   ├── screens/            # Home, Explore, Collection, Account, etc.
│   └── widgets/            # OfferCard, BusinessCard, TapScale, etc.
├── test/                   # Widget & unit tests
├── scripts/                # test_all.sh
├── ios/                    # iOS native config
└── android/                # Android native config
```

## Backend — Quick Start

```bash
cd appredueri_backend
npm install
cp .env.example .env
npm run dev
```

## API

- **Base URL:** `https://ofai.ro`
- **Auth:** Bearer token (`/api/auth/login`, `/api/auth/register`, `/api/auth/google`)
- **Offers:** `/api/offers`, `/api/offers/:id`, `/api/offers/feed`, `/api/offers/category-feed`
- **Businesses:** `/api/businesses`, `/api/businesses/:id`
- **Favorites:** `/api/favorites`
- **Reviews:** `/api/reviews/business/:id`
- **Collections:** `/api/collections`
- **Saved Searches:** `/api/saved-searches`
- **Billing:** `/api/billing/checkout`, `/api/billing/change-plan`, `/api/billing/webhook`
- **Cities / Categories:** `/api/cities`, `/api/categories`

## Features

- 3-tier subscription system (Free / Standard / Premium) with Stripe billing
- AI-powered business validation, offer moderation, and review summarization
- Multi-location business support with opening hours
- Flash deals with countdown timers
- Curated collections, saved searches with alerts
- Referral system, gamification (badges, points, streaks)
- Push notifications (FCM), weekly digest
- Deep linking (iOS + Android)
- CSP nonce-based security headers, CSRF protection
