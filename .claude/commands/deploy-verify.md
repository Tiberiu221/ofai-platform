# Deploy & Verify Production

Verifica starea productiei dupa deploy (Railway auto-deploy pe push to main). Ruleaza migratii pending si health check.

## Input: $ARGUMENTS
- **(gol)** — full check: migratii + health check + site verification
- **`migrate`** — ruleaza doar migratiile pending
- **`health`** — doar health check (fara migratii)

## Conexiune DB
```
postgresql://postgres:REDACTED@REDACTED_DB_HOST/railway
```
Foloseste `require('pg').Client` cu SSL `{ rejectUnauthorized: false }` din directorul `appredueri_backend/`.

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
2. **Offers API** — `GET /api/offers?limit=1` — status 200, returneaza JSON cu data
3. **Business API** — `GET /api/businesses?limit=1` — status 200
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
