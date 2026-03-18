# 07 - Referral System

## Context
ZERO infrastructura existenta. Full build: migration, backend registration, deep links, Flutter UI, gamification.

## Fisiere de creat/modificat

### A. Migration (NOU)
**Fisier:** `appredueri_backend/src/migrations/063_referral_system.sql`
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;

-- Genereaza coduri pentru useri existenti
UPDATE users SET referral_code = UPPER(SUBSTR(MD5(RANDOM()::TEXT || id::TEXT), 1, 8))
WHERE referral_code IS NULL;

CREATE TABLE IF NOT EXISTS referral_rewards (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_type VARCHAR(50) DEFAULT 'signup_bonus',
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referrer_id, referee_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id);
```

### B. Gamification — adauga 'referral' action
**Fisier:** `appredueri_backend/src/services/gamification.js` (linia 13-19)
Adauga in POINTS_MAP: `referral: 50`

### C. Registration — accept referral_code
**Fisier:** `appredueri_backend/src/routes/auth.js` (POST /auth/register)
- Extract `referral_code` din body
- Dupa user insert: genereaza `referral_code` pentru noul user
- Daca `referral_code` furnizat: cauta referrer → set `referred_by` → insert `referral_rewards` → `awardPoints` la ambii (fire-and-forget)

### D. API referral code
**Fisier:** `appredueri_backend/src/routes/users.js`
Endpoint nou: `GET /users/me/referral-code` → returneaza codul (genereaza daca lipseste)

### E. Web redirect
**Fisier:** `appredueri_backend/src/routes/web.js`
`GET /r/:code` → redirect la `/register?ref=:code`

### F. Deep links
- `apple-app-site-association`: adauga `/r/*` in paths
- `AndroidManifest.xml`: adauga intent-filter cu `pathPrefix="/r/"`

### G. Flutter API endpoint
**Fisier:** `ofai_flutter/lib/core/network/api_endpoints.dart`
`static const String referralCode = '/users/me/referral-code';`

### H. Flutter Account screen
**Fisier:** `ofai_flutter/lib/screens/account/account_screen.dart`
- Tile "Invita prieteni" (icon: card_giftcard)
- Bottom sheet cu codul + share button
- Share text: "Descopera ofertele din orasul tau pe OFAI! https://ofai.ro/r/{code}"

### I. Flutter deep link route
**Fisier:** `ofai_flutter/lib/app.dart`
`GoRoute(path: '/r/:code', redirect: (ctx, state) => '/register?ref=${state.pathParameters['code']}')`

### J. Flutter register screen
**Fisier:** `ofai_flutter/lib/screens/auth/register_screen.dart`
- Extract `ref` query param din GoRouterState
- Trimite `referral_code` in body la POST /auth/register

## Verificare
1. Ruleaza migration
2. Verifica `SELECT referral_code FROM users LIMIT 5` — toate au cod
3. Register cu `referral_code` → verifica logs, points, referral_rewards
4. `GET /users/me/referral-code` → returneaza cod
5. `GET /r/CODE123` → redirect la register
6. Flutter: Account → "Invita prieteni" → share pe WhatsApp
7. Deep link: deschide `ofai.ro/r/CODE` pe telefon → deschide register screen
