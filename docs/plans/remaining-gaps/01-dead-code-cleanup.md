# 01 - Dead Code Cleanup & Missing deleteRequest()

## Context
1. `similarOffers()` in `api_endpoints.dart:36` — endpoint definit dar niciodata apelat. Provider-ul `similarOffersProvider` foloseste `ApiEndpoints.offers` cu query params.
2. `deleteRequest()` lipseste din `business_requests_provider.dart`. Exista doar `fetchMyRequests()` si `submitRequest()`.

## Fisiere de modificat

### 1. Sterge `similarOffers()` dead code
**Fisier:** `ofai_flutter/lib/core/network/api_endpoints.dart`
**Linia 36:** Sterge:
```dart
static String similarOffers(int id) => '/offers/$id/similar';
```

### 2. Adauga `deleteRequest()` in provider
**Fisier:** `ofai_flutter/lib/providers/business_requests_provider.dart`
Dupa `submitRequest()` (dupa linia 95), adauga:

```dart
Future<bool> deleteRequest(int requestId) async {
  try {
    await _api.dio.delete('${ApiEndpoints.businessRequests}/$requestId');
    state = state.copyWith(
      requests: state.requests.where((r) => r.id != requestId).toList(),
    );
    return true;
  } catch (_) {
    return false;
  }
}
```

### 3. Adauga buton delete in UI
**Fisier:** `ofai_flutter/lib/screens/business_request/business_request_screen.dart`
Pentru fiecare request `pending` sau `rejected`, adauga buton "Sterge cererea" cu confirm dialog.

## Verificare
1. `flutter analyze` — zero erori noi
2. Search `similarOffers` in codebase — zero rezultate
3. Test delete: trimite un request, apoi sterge-l din screen
