# R01 + R02 — Fix 034_business_push_log.sql

> **Severitate:** CRITICAL
> **Fisier:** `appredueri_backend/src/migrations/034_business_push_log.sql`
> **Impact:** R1: User deletion crasheaza DB. R2: Index partial inutil (NOW() volatil).

---

## R1: `sent_by NOT NULL` + `ON DELETE SET NULL` contradictoriu

### Problema

```sql
sent_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
```

Cand un user este sters din tabela `users`, PostgreSQL incearca `SET NULL` pe `sent_by`, dar `NOT NULL` constraint blocheaza operatia. Rezultat: **DELETE FROM users WHERE id = X esueaza cu constraint violation**.

### Fix

Creaza o noua migratie `037_fix_push_log_constraints.sql`:

```sql
-- Migration 037: Fix business_push_log constraints
-- R1: sent_by NOT NULL conflicts with ON DELETE SET NULL
-- R2: Partial index with NOW() is useless (volatile function)

-- R1 fix: Allow NULL on sent_by (user can be deleted, log remains)
ALTER TABLE business_push_log
  ALTER COLUMN sent_by DROP NOT NULL;

-- R2 fix: Drop useless partial index, replace with plain index
DROP INDEX IF EXISTS idx_business_push_log_rate;

CREATE INDEX IF NOT EXISTS idx_business_push_log_rate
  ON business_push_log(business_id, created_at DESC);
```

**NU modifica** fisierul 034 original — adauga o noua migratie.

---

## R2: Partial index cu `NOW()` — inutilizabil

### Problema

```sql
CREATE INDEX IF NOT EXISTS idx_business_push_log_rate
  ON business_push_log(business_id, created_at)
  WHERE created_at >= NOW() - INTERVAL '7 days';
```

`NOW()` este o functie volatila in PostgreSQL. Query planner-ul NU poate folosi indexuri partiale cu predicate volatile — indexul nu va fi niciodata selectat pentru scan.

### Fix

Inclus in migratia 037 de mai sus: inlocuieste cu un index plain pe `(business_id, created_at DESC)`.

Rate-limiting-ul se face in query cu `WHERE created_at >= NOW() - INTERVAL '7 days'` — query-ul insusi foloseste `NOW()` corect (evaluat la runtime), dar indexul trebuie sa fie plain.

---

## Verificare

- [ ] Migratie 037 rulata
- [ ] `DELETE FROM users WHERE id = X` nu mai crasheaza (test cu un user care are push log)
- [ ] `EXPLAIN ANALYZE` pe query-ul de rate-limit arata ca foloseste indexul
