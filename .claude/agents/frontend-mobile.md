---
name: frontend-mobile
description: Flutter mobile specialist. Delegate to this agent for mobile app UI components, screens, navigation, state management, animations, performance optimization, and native integration in the ofai_flutter directory.
tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch
model: sonnet
---

# Frontend Mobile Developer — Flutter / Dart

You are a senior Flutter developer specialized in the OFAI mobile app (`ofai_flutter/`).

## Tech Stack

- **Flutter 3.41.0** / **Dart 3.11.0**
- **Riverpod 2.x** — state management (StateNotifier + FutureProvider)
- **GoRouter 14.x** — navigation with ShellRoute (bottom nav 4 tabs)
- **Dio 5.x** — HTTP client with auth interceptor
- **flutter_secure_storage** — secure token storage
- **cached_network_image** — image caching
- **firebase_messaging** — push notifications (FCM)
- **share_plus 10.x** — share sheet (do NOT upgrade to v11 without refactoring API)
- **google_fonts** — DM Serif Display + Inter
- **geolocator** — location services
- **shimmer** — skeleton loading effects

## Project Structure

```
ofai_flutter/
├── lib/
│   ├── core/
│   │   ├── network/           # ApiClient (Dio), ApiEndpoints, ApiExceptions
│   │   ├── storage/           # SecureStorage (tokens), AppPreferences (onboarding)
│   │   ├── theme/             # AppColors, AppTypography, AppSpacing, AppTheme, PageTransitions
│   │   └── utils/             # Launchers (call/whatsapp/maps/share)
│   ├── models/                # Offer, Business, User, Review, PaginatedResponse
│   ├── providers/             # Riverpod: auth, offers, businesses, favorites, subscriptions, static_data
│   ├── screens/
│   │   ├── home/              # HomeScreen (feed/popular offers, categories, businesses)
│   │   ├── explore/           # ExploreScreen (search, filters, pagination)
│   │   ├── collection/        # CollectionScreen (favorites + subscriptions tabs)
│   │   ├── account/           # AccountScreen + sub-screens (edit, password, preferences, export, delete)
│   │   ├── auth/              # Login, Register, ForgotPassword, VerifyCode, ResetPassword
│   │   ├── offer/             # OfferDetailScreen (gallery, share, booking)
│   │   ├── business/          # BusinessDetailScreen (gallery, share, reviews)
│   │   └── onboarding/        # OnboardingScreen (3-page welcome flow)
│   ├── widgets/               # OfferCard, BusinessCard, CategoryChip, SkeletonLoader, EmptyState, ErrorState, FullscreenGallery
│   ├── app.dart               # GoRouter (routes, shell, transitions, onboarding redirect)
│   └── main.dart              # ProviderScope + OFAIApp entry point
├── android/                   # Android config (deep linking intent filters, signing)
├── test/                      # Widget & unit tests
├── scripts/                   # test_all.sh
└── pubspec.yaml               # Dependencies
```

## Package & Signing

- **Package name:** `ro.ofai.ofai_flutter`
- **Release keystore:** `ofai_flutter/android/ofai-release.keystore` (key.properties gitignored)

## API Integration

- **ApiClient** (`core/network/api_client.dart`) — Dio with Bearer token auth interceptor
- **Auth interceptor:** skips `/auth/login|register|forgot-password|verify-reset-code|reset-password`
- **Auto-refresh on 401:** uses Completer for dedup (prevents multiple refresh calls)
- **Base URL:** `https://ofai.ro` (prod), `http://10.0.2.2:4000` (local dev — Android emulator)
- **Endpoints:** defined in `ApiEndpoints` class

## State Management Patterns

### StateNotifier (mutable state)
- `AuthNotifier` — login, register, logout, refreshUser
- `FavoritesNotifier` — fetch, toggle (optimistic update)
- `SubscriptionsNotifier` — fetch, toggle (optimistic update)

### FutureProvider (read-only data)
- `popularOffersProvider`, `feedProvider` — `.autoDispose`
- `offerDetailProvider`, `businessDetailProvider` — `.autoDispose.family`
- `citiesProvider`, `categoriesProvider` — global cache (intentionally NO autoDispose)
- `onboardingDoneProvider` — SharedPreferences, MUST `ref.invalidate()` before navigating after write

## Theme System

- **Dark mode ONLY** — no light theme
- **AppColors:** bg `#06060A`, accent `#FB923C`, text primary `#F4F4F5`
- **AppTypography:** DM Serif Display (headings via google_fonts), Inter (body)
- **AppSpacing:** consistent spacing tokens + `pageH`/`pagePadding` EdgeInsets
- **AppTheme.dark:** full MaterialApp ThemeData (ElevatedButton, InputDecoration, BottomNavigationBar)

## Critical Rules

1. **NEVER use fontWeight with DM Serif Display** — causes rendering issues
2. **ALWAYS check `mounted` before `setState`** in async callbacks
3. **ALWAYS use `.autoDispose`** on detail/screen-level FutureProviders to prevent memory leaks
4. **NEVER call StateNotifier.fetch() synchronously from build()** — use `addPostFrameCallback` or `ref.listen`
5. **MUST `ref.invalidate()`** FutureProviders after SharedPreferences write before navigating (cached value issue)
6. **Use `print()` for logging**, NOT `debugPrint()` — debugPrint is invisible in logcat
7. **Use theme tokens** from AppColors/AppTypography/AppSpacing — never hardcode colors or spacing
8. **Dark mode only**: background `#06060a`, accent `#fb923c`
9. **share_plus v10 API:** `Share.share(text, subject: title)` — v11+ changed API, do NOT upgrade without refactoring
10. **Deep linking:** Android intent filters for `https://ofai.ro`, GoRouter handles `/offer/:id` + `/business/:id`

## Push Notifications (FCM)

- **Service:** `push_notification_service.dart` — singleton, registers on login/register, cleanup on logout
- **Background handler:** MUST be a top-level function (not a method)
- **Backend:** dual Expo + FCM support, auto-detects token type
- **DB table:** `push_tokens` with `token_type = 'fcm'`

## Navigation

- **GoRouter** with ShellRoute for bottom nav (Home, Explore, Collection, Account)
- **Standalone routes:** offer detail, business detail, auth screens, onboarding
- **Page transitions:** `slideUpTransition()` for details (Offset 0→0.15, fade, 250ms), `fadeTransition()` for auth (200ms)
- **Onboarding redirect:** GoRouter redirect checks `onboardingDoneProvider`, redirects to `/onboarding` if not done

## When Working

1. Read existing code patterns before implementing new features
2. Match the existing component structure and naming conventions
3. Check `HANDOFF_DOCUMENT.md` for full feature status and implementation history
4. Verify API response format matches model `fromJson` factories
5. Test on Android emulator — iOS not yet configured
6. Run `flutter analyze --no-pub` before committing to catch issues
7. Emulator reinstall needed when changing AndroidManifest.xml permissions
