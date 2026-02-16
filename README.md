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
| **Imagini** | CachedNetworkImage |
| **Auth** | JWT + Refresh Token |
| **Hosting** | Railway (backend) |

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
│   ├── models/             # Offer, Business, User, Category, City
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
- **Auth:** Bearer token (`/api/auth/login`, `/api/auth/register`)
- **Offers:** `/api/offers`, `/api/offers/:id`, `/api/offers/feed`
- **Businesses:** `/api/businesses`, `/api/businesses/:id`
- **Favorites:** `/api/favorites`
- **Cities / Categories:** `/api/cities`, `/api/categories`
