# Gaps Tehnice — Bugs, Dead Code, Missing Integrations

> **Prioritate:** CRITICA — se rezolva primele, inainte de features noi
> **Efort total estimat:** ~2-3h

---

## BUG-01: HelpScreen foloseste Navigator.pushNamed in loc de GoRouter

**Severitate:** Bug — linkurile Terms/Privacy din Help screen probabil nu functioneaza

**Fisier:** `ofai_flutter/lib/screens/help/help_screen.dart` (liniile ~61-65)

**Problema:** `Navigator.of(context).pushNamed('/terms')` si `.pushNamed('/privacy')` — app-ul foloseste GoRouter, nu Navigator clasic.

**Fix:**
```dart
// Inainte:
Navigator.of(context).pushNamed('/terms');
// Dupa:
context.push('/terms');
```

Import necesar: `import 'package:go_router/go_router.dart';`

---

## CLEANUP-01: gamificationProvider unused + FAQ stale

**Severitate:** Cleanup

**Fisiere:**
- `ofai_flutter/lib/providers/gamification_provider.dart` (linia 1: TODO unused)
- `ofai_flutter/lib/screens/help/help_screen.dart` (FAQ mentioneaza "puncte")

**Fix:**
1. Daca re-integram gamification (Tier 3 #14): pastram provider-ul, scoatem TODO
2. Daca NU: stergem provider-ul + actualizam FAQ-ul sa nu mentioneze puncte
3. **Decizie:** Pastram provider-ul (planificat pentru re-integrare). Scoatem TODO, actualizam FAQ

---

## CLEANUP-02: Dead code in ApiEndpoints

**Severitate:** Cleanup

**Fisier:** `ofai_flutter/lib/core/network/api_endpoints.dart`

**Items:**
1. `similarOffers(int id)` — definit dar neapelat (app-ul foloseste `/offers` cu query params)
2. `pushTokensMyDevices` — definit dar neapelat

**Fix:** Stergem ambele endpoint-uri nefolosite

---

## GAP-01: "My Reports" inexistent

**Severitate:** Gap mediu — userii pot raporta dar nu pot vedea statusul

**Backend existent:**
- `GET /reports/mine` — lista rapoarte user
- `DELETE /reports/:id` — retrage raport pending

**Flutter lipseste:**
- Endpoint constants in `api_endpoints.dart`
- Provider sau functionalitate in report_dialog sau account
- Ecran sau sectiune "Rapoartele mele"

**Fix:**
1. Adaug endpoints in `api_endpoints.dart`: `myReports`, `deleteReport(id)`
2. Adaug sectiune in Account screen: "Rapoartele mele" (sub "Exporta datele")
3. La tap: fetch `GET /reports/mine`, afisez lista cu status (pending/reviewed/resolved)
4. Swipe-to-delete pe reports pending
5. **Alternativa minima:** Nu facem ecran separat, doar adaugam confirmation toast dupa report submit: "Raportul tau a fost trimis. Il poti urmari din contul tau." (chiar daca nu implementam inca ecranul)

---

## GAP-02: Cancel business request

**Severitate:** Low-medium

**Backend:** `DELETE /api/business-requests/:id` exista

**Flutter:** `business_requests_provider.dart` are `submitRequest()` si `fetchMine()` dar nu `deleteRequest()`

**Fix:**
1. Adaug `deleteRequest(int id)` in provider
2. In Account screen, unde se afiseaza "Cererile mele" (daca exista) — adaug buton Cancel
3. **Nota:** Verificam mai intai daca exista UI pentru a vedea cererile tale. Daca nu, e low priority.

---

## UX-01: Pull-to-refresh pe detail screens

**Severitate:** UX improvement

**Fisiere:**
- `ofai_flutter/lib/screens/offer/offer_detail_screen.dart`
- `ofai_flutter/lib/screens/business/business_detail_screen.dart`

**Fix:**
1. Wrap `CustomScrollView` in `RefreshIndicator`
2. La refresh: `ref.invalidate(offerDetailProvider(offerId))` / `ref.invalidate(businessDetailProvider(businessId))`
3. Styling consistent: `color: AppColors.accent, backgroundColor: AppColors.bgCard`

---

## UX-02: Offline indicator banner

**Severitate:** UX improvement

**Ce:** Cand user-ul pierde conexiunea, afisam banner persistent "Esti offline" in loc de doar error states.

**Unde:**
- `ofai_flutter/lib/app.dart` (wrap MaterialApp cu connectivity listener)
- Widget nou: `OfflineBanner`

**Plan:**
1. Adaug `connectivity_plus` package (daca nu exista)
2. Creez `ConnectivityProvider` care asculta schimbarile de retea
3. Creez `OfflineBanner` widget — banner rosu subtil sub AppBar/status bar
4. In ShellRoute builder, afisez banner-ul cand `isOffline == true`
5. Auto-dismiss cand revine conexiunea

---

## UX-03: FAQ stale references

**Severitate:** Low

**Fisier:** `ofai_flutter/lib/screens/help/help_screen.dart`

**Problema:** FAQ mentioneaza "castig puncte" si "folosirea punctelor" dar gamification UI e scos.

**Fix:** Actualizam textul FAQ sa reflecte starea curenta a app-ului:
- Inlocuim referintele la puncte cu referinte la badge-uri si favorite
- Sau pastram referintele daca re-integram gamification (Tier 3 #14)
