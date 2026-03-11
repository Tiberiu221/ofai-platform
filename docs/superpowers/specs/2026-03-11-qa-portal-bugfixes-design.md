# Design: QA Portal Bug Fixes

**Data:** 11 Martie 2026
**Referinta:** `docs/qa-portal-report.md`

---

## Bugs de rezolvat

| ID | Severitate | Titlu |
|----|-----------|-------|
| BUG-STD-001 | CRITICA | `TIER_GATING_ENABLED` undefined — backend nu aplica restrictii |
| BUG-STD-002 | ALTA | Limitele (maxOffers/gallery/locations) nu sunt aplicate (consecinta STD-001) |
| BUG-FREE-001 | MEDIE | Tier gate overlays duplicate (10 in loc de 5) |

---

## FIX-1: Fail-closed tier gating (BUG-STD-001 + BUG-STD-002)

### Problema
`tierAuth.js` foloseste `TIER_GATING_ENABLED !== 'true'` ca bypass — daca env var lipseste, toate restrictiile sunt dezactivate. Pattern fail-open periculos.

### Solutia
Inversam la `TIER_GATING_DISABLED === 'true'` — tier gating ON by default, OFF doar cu flag explicit.

### Fisiere afectate

**1. `middleware/tierAuth.js`** (3 check-uri + startup warning):
- Startup warning: `TIER_GATING_ENABLED !== 'true'` → `TIER_GATING_DISABLED === 'true'`
- `attachTier()` catch: `TIER_GATING_ENABLED === 'true'` → `TIER_GATING_DISABLED !== 'true'`
- `requireFeature()`: `TIER_GATING_ENABLED !== 'true'` → `TIER_GATING_DISABLED === 'true'`
- `requireLimit()`: `TIER_GATING_ENABLED !== 'true'` → `TIER_GATING_DISABLED === 'true'`

**2. `routes/business-portal.js`** (3 locuri):
- L227: `TIER_GATING_ENABLED === 'true'` → `TIER_GATING_DISABLED !== 'true'`
- L848: `TIER_GATING_ENABLED === 'true'` → `TIER_GATING_DISABLED !== 'true'`
- L955: `TIER_GATING_ENABLED === 'true'` → `TIER_GATING_DISABLED !== 'true'`

**3. `routes/web-portal-api.js`** (2 locuri):
- L884: `TIER_GATING_ENABLED === 'true'` → `TIER_GATING_DISABLED !== 'true'`
- L1167: `TIER_GATING_ENABLED === 'true'` → `TIER_GATING_DISABLED !== 'true'`

**4. `.env.example`**:
- Sterge `TIER_GATING_ENABLED=true`
- Adauga `# TIER_GATING_DISABLED=true` (comentat — default ON)

### Railway
- Sterge `TIER_GATING_ENABLED` din env vars (daca exista)
- NU adauga nimic — lipsa variabilei = gating ON
- Doar pentru debugging: adauga temporar `TIER_GATING_DISABLED=true`

---

## FIX-2: Overlay dedup (BUG-FREE-001)

### Problema
`applyTierGating()` se apeleaza de 2 ori:
1. L1651: imediat la page load (date server-side `_serverTier`)
2. L1216: cand se incarca tab-ul Abonament via `loadSubscription()`

`gateSection()` deja are dedup (L1243-1245: `existing.remove()` inainte de appendChild) — fix-ul a fost aplicat in sesiunea QA.

### Problema ramasa: concierge random ID
Concierge sections (L1289-1292) primesc ID random la fiecare apel: `'concierge-gate-' + Math.random()`. Asta face dedup-ul imposibil chiar cu `.querySelector('.tier-gate-overlay')` deoarece `querySelectorAll` re-seteaza ID-ul la fiecare `applyTierGating` call.

### Solutia
Inlocuieste random ID cu index stabil:
```javascript
document.querySelectorAll('.concierge-section').forEach(function(el, idx) {
  el.id = 'concierge-gate-' + idx;
  gateSection(el.id, plan.hasConcierge, 'Concierge Onboarding', 'Standard');
});
```

### Fisier afectat
- `views/public/portal/manage.ejs` L1289-1292

---

## Verificare

Dupa aplicarea fix-urilor:
1. Porneste server-ul local
2. Verifica ca startup log NU afiseaza warning-ul de tier gating bypass
3. Testeaza pe Free tier: API-urile Premium returneaza 403
4. Testeaza overlay-urile: exact 1 overlay per sectiune gated (nu duplicat)
