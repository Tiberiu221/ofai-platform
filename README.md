# OFAI — Oferte și Reduceri din România

Platformă de oferte și reduceri locale. Conectează utilizatorii cu business-uri din orașul lor prin oferte active, ratings și locații pe hartă.

🌐 **Web:** [ofai.ro](https://ofai.ro)

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
