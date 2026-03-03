# R12 — Fix promotedOffersProvider Double-Filter

> **Severitate:** CRITICAL
> **Fisier:** `ofai_flutter/lib/providers/offers_provider.dart`, linia ~241-249
> **Impact:** Provider-ul cere `promoted_only=1` de la backend (param neverificat), apoi filtreaza client-side din nou. Daca backend-ul nu suporta `promoted_only`, filtrul client-side depinde de `offer.isPromoted` care s-ar putea sa nu fie setat.

---

## Problema

```dart
final promotedOffersProvider = FutureProvider.autoDispose<List<Offer>>((ref) async {
  final response = await ApiClient().dio.get(ApiEndpoints.offers, queryParameters: {
    'sort': 'popular',
    'limit': 3,
    'page': 1,
    'promoted_only': '1',    // ← Backend-ul suporta acest param?
  });
  final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
  return paginated.data.where((o) => o.isPromoted).take(3).toList();
  //                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                    Double-filter: backend + client-side
});
```

### Probleme:
1. **`promoted_only` query param** — Verifica daca backend-ul (in `offers.js` sau `web.js`) recunoaste acest parametru. Daca nu, backend-ul returneaza oferte normale, iar filtrul client-side le elimina pe toate (rezultat gol).
2. **Double filter** — Daca backend-ul returneaza deja doar oferte promovate, `.where((o) => o.isPromoted)` este redundant.
3. **`.take(3)`** — Redundant cu `'limit': 3` trimis la backend.

---

## Fix

### Pas 1: Verifica backend-ul

Cauta in `appredueri_backend/src/routes/offers.js` (sau `web.js`) handler-ul GET pentru offers:

```bash
grep -n "promoted_only\|promoted\|has_promoted" src/routes/offers.js src/routes/web.js
```

**Daca `promoted_only` NU exista in backend:**
- Fie adauga suport in backend (recomandat)
- Fie fa filtrarea exclusiv client-side cu un limit mai mare

**Daca `promoted_only` EXISTA in backend:**
- Elimina filtrarea client-side (trust backend)

### Pas 2: Fix provider (depinde de pas 1)

#### Varianta A: Backend suporta `promoted_only` (elimina double-filter):

```dart
final promotedOffersProvider = FutureProvider.autoDispose<List<Offer>>((ref) async {
  final response = await ApiClient().dio.get(ApiEndpoints.offers, queryParameters: {
    'sort': 'popular',
    'limit': 3,
    'page': 1,
    'promoted_only': '1',
  });
  final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
  return paginated.data; // Backend deja filtreaza — nu mai filtra client-side
});
```

#### Varianta B: Backend NU suporta `promoted_only` (filter client-side only):

```dart
final promotedOffersProvider = FutureProvider.autoDispose<List<Offer>>((ref) async {
  final response = await ApiClient().dio.get(ApiEndpoints.offers, queryParameters: {
    'sort': 'popular',
    'limit': 20,  // Cere mai multe pentru a avea sanse sa gaseasca 3 promovate
    'page': 1,
  });
  final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
  return paginated.data.where((o) => o.isPromoted).take(3).toList();
});
```

#### Varianta C (recomandabila): Adauga suport in backend + simplifica provider

In `offers.js`, in query-ul de listing, adauga:

```js
// Dupa celelalte filtre:
if (req.query.promoted_only === '1') {
  conditions.push(`b.subscription_badge_type = 'premium'`);
  // SAU: conditions.push(`EXISTS (
  //   SELECT 1 FROM business_subscriptions bs
  //   JOIN subscription_plans sp ON sp.id = bs.plan_id
  //   WHERE bs.business_id = o.business_id
  //     AND bs.status = 'active'
  //     AND sp.has_promoted_placement = true
  // )`);
}
```

Apoi in Flutter, foloseste Varianta A (fara double-filter).

---

## Verificare

- [ ] `promotedOffersProvider` returneaza maxim 3 oferte
- [ ] Ofertele returnate sunt de la business-uri cu plan Premium (promoted)
- [ ] Daca nu exista oferte promovate, provider-ul returneaza lista goala (nu crash)
- [ ] Home screen afiseaza sectiunea "Promoted" doar cand exista oferte promovate
