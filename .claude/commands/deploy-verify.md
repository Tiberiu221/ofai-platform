# Deploy & Verify Production

Verifica starea productiei dupa deploy (Railway auto-deploy pe push to main). Ruleaza migratii pending si health check.

## Input: $ARGUMENTS
- **(gol)** — full check: env validation + migratii + health check + site verification
- **`migrate`** — ruleaza doar migratiile pending
- **`health`** — doar health check (fara migratii)
- **`env`** — doar environment variable validation

## Conexiune DB
```
postgresql://postgres:REDACTED@REDACTED_DB_HOST/railway
```
Foloseste `require('pg').Client` cu SSL `{ rejectUnauthorized: false }` din directorul `appredueri_backend/`.

## Step 0: Environment Variable Validation

Verifica ca toate env vars necesare sunt setate pe Railway (fara a expune valorile).

### Required (app crash without these)
```bash
# Conecteaza-te la Railway si verifica env vars setate
# Sau pe production, verifica prin endpoint /health (daca exista)

# Required vars — app nu porneste fara ele:
DATABASE_URL          # PostgreSQL connection string
JWT_SECRET            # JWT signing + CSRF (min 32 chars)
```

### Required for Features
```bash
CLOUDINARY_CLOUD_NAME    # Image uploads
CLOUDINARY_API_KEY       # Image uploads
CLOUDINARY_API_SECRET    # Image uploads
RESEND_API_KEY           # Transactional email
FIREBASE_ADMINSDK_JSON   # Push notifications (ENTIRE JSON file, not just key!)
GOOGLE_CLIENT_ID         # Google OAuth
```

### Optional (features degrade gracefully)
```bash
STRIPE_SECRET_KEY        # Payments (skeleton — not production yet)
STRIPE_WEBHOOK_SECRET    # Stripe webhooks
TIER_GATING_ENABLED      # Subscription gating (default: false)
SENTRY_DSN               # Error tracking
CSRF_SECRET              # Falls back to JWT_SECRET if not set
```

### Validation Checks
1. Citeste `.env.example` si compara cu env vars din Railway
2. Verifica ca `FIREBASE_ADMINSDK_JSON` contine `"type": "service_account"` (JSON valid)
3. Verifica ca `JWT_SECRET` are minim 32 caractere
4. Verifica ca `DATABASE_URL` incepe cu `postgresql://`
5. Daca `TIER_GATING_ENABLED` lipseste, noteaza ca tier gating e OFF

### Secret Leak Detection
```bash
# Scaneaza git history pentru secrete accidental committed
git log --all --diff-filter=A -p -- '*.env' '*.key' '*.pem' | head -20
grep -rn "STRIPE_SECRET\|JWT_SECRET\|CLOUDINARY_API_SECRET\|password.*=.*[A-Za-z0-9]" appredueri_backend/src/ --include="*.js" --include="*.ejs" | grep -v ".env\|node_modules\|\.example"
```

## Step 1: Detecteaza migratii pending

1. Citeste toate fisierele din `appredueri_backend/src/migrations/*.sql` — sorteaza numeric (001, 002, ...)
2. Detecteaza ce tabele/coloane/indexuri exista deja in productie:
   - `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
   - `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`
3. Pentru fiecare migratie, verifica daca obiectele pe care le creeaza exista deja (regex pe `CREATE TABLE`, `ALTER TABLE ADD COLUMN`, `CREATE INDEX`)
4. Listeaza migratiile care par sa nu fi fost aplicate
5. **INTREABA utilizatorul** inainte de a rula orice migratie — arata SQL-ul si cere confirmare

## Step 2: Health Check

Verifica urmatoarele endpoint-uri pe `https://ofai.ro`:

1. **Homepage** — `GET /` — status 200, contine "OFAI"
2. **Offers API** — `GET /offers?limit=1` — status 200, returneaza JSON cu data (ruta mobile mount la root, NU /api/)
3. **Business API** — `GET /businesses?limit=1` — status 200
4. **Static assets** — `GET /css/main.css` — status 200

Foloseste `WebFetch` sau `curl` pentru fiecare endpoint.

## Step 3: Verificari DB

1. **Subscription plans seeded** — `SELECT COUNT(*) FROM subscription_plans` = 3
2. **All businesses have subscription** — `SELECT COUNT(*) FROM businesses b WHERE NOT EXISTS (SELECT 1 FROM business_subscriptions bs WHERE bs.business_id = b.id)` = 0
3. **No orphaned subscriptions** — `SELECT COUNT(*) FROM business_subscriptions bs WHERE NOT EXISTS (SELECT 1 FROM businesses b WHERE b.id = bs.business_id)` = 0
4. **Badge sync** — `SELECT COUNT(*) FROM businesses b JOIN business_subscriptions bs ON bs.business_id = b.id JOIN subscription_plans sp ON sp.id = bs.plan_id WHERE bs.status IN ('active','trial') AND COALESCE(b.subscription_badge_type,'') != COALESCE(sp.badge_type,'')` = 0

## Output

Afiseaza un rezumat clar:
```
=== Deploy Verification ===
Env Vars:   X required set / Y optional missing
Secrets:    No leaks detected
Migrations: X applied / Y already up-to-date
Homepage:   OK (200)
Offers API: OK (200, N results)
Business API: OK (200, N results)
Static CSS: OK (200)
DB Plans:   3 plans seeded
DB Subs:    N businesses covered
Badge Sync: OK (0 mismatches)
```

Daca ceva esueaza, afiseaza eroarea si sugereaza fix-ul.
