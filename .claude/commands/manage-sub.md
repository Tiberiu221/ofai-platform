# Manage Business Subscription

Gestioneaza subscriptiile business-urilor pe baza de date de productie.

## Input: $ARGUMENTS
Argumentul poate fi:
- **Numele business-ului** + actiunea dorita (ex: `MegaStore Online premium`, `Frizeria Cool downgrade free`)
- **`list`** — listeaza toate business-urile cu plan activ != free
- **`status <nume>`** — afiseaza detalii complete despre subscriptia unui business

## Conexiune DB
```
postgresql://postgres:REDACTED@REDACTED_DB_HOST/railway
```
Foloseste `require('pg').Client` cu SSL `{ rejectUnauthorized: false }` din directorul `appredueri_backend/`.

## Plan IDs (din subscription_plans)
| ID | Slug | Name | Badge |
|----|------|------|-------|
| 1 | free | Gratuit | null |
| 2 | standard | Standard | verified |
| 3 | premium | Premium | premium |

## Actiuni suportate

### Upgrade / Downgrade
1. Cauta business-ul cu `WHERE name ILIKE '%<nume>%'` — daca sunt mai multe rezultate, listeaza-le si intreaba
2. UPDATE `business_subscriptions` SET `plan_id`, `updated_at = NOW()` WHERE `business_id` AND `status IN ('active', 'trial')`
3. UPDATE `businesses` SET `subscription_badge_type` = badge-ul planului nou
4. INSERT in `subscription_history` cu `action` = 'upgraded' sau 'downgraded', `reason` = 'Manual via /manage-sub'
5. Afiseaza rezultatul final cu verificare

### Status
1. Cauta business-ul
2. Afiseaza: plan curent, status, badge, billing_cycle, date-uri relevante, istoric subscriptii

### List
1. `SELECT b.name, sp.name, bs.status FROM business_subscriptions bs JOIN businesses b ON ... JOIN subscription_plans sp ON ... WHERE sp.slug != 'free' ORDER BY sp.sort_order DESC, b.name`

## Reguli
- INTOTDEAUNA verifica rezultatul dupa UPDATE cu un SELECT
- INTOTDEAUNA logheaza in subscription_history
- Daca business-ul nu exista, spune clar si sugereaza cautare partiala
- NU sterge subscriptii, doar update plan_id
- Sincronizeaza MEREU subscription_badge_type pe tabela businesses
