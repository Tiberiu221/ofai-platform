# R11 — Fix Offer Detail Screen Missing SubscriptionBadge

> **Severitate:** CRITICAL
> **Fisier:** `ofai_flutter/lib/screens/offer/offer_detail_screen.dart`
> **Impact:** Offer detail screen — ecranul unde trust signal-ul conteaza cel mai mult — nu afiseaza badge-ul de verificare/premium al business-ului.

---

## Problema

Sectiunea business info (linia ~374-433) afiseaza:
- Logo business
- Nume business
- Categorie + Oras
- Rating (stea + nota)
- Chevron pentru navigare

**Lipseste:** `SubscriptionBadge` widget langa numele business-ului.

Widgetul `SubscriptionBadge` exista la `lib/widgets/subscription_badge.dart` si este deja folosit pe business detail screen si business cards. Dar pe offer detail — ecranul unde user-ul decide daca sa "dezvaluie codul" — badge-ul lipseste.

---

## Fix

### 1. Adauga import-ul

La inceputul fisierului, dupa celelalte importuri de widgets:

```dart
import '../../widgets/subscription_badge.dart';
```

### 2. Adauga badge-ul langa numele business-ului

Gaseste sectiunea business name (linia ~407):

```dart
// INAINTE:
Text(offer.business!.name, style: AppTypography.labelLarge),
```

Inlocuieste cu:

```dart
// DUPA:
Row(
  children: [
    Flexible(
      child: Text(
        offer.business!.name,
        style: AppTypography.labelLarge,
        overflow: TextOverflow.ellipsis,
      ),
    ),
    if (offer.business!.badgeType != null) ...[
      const SizedBox(width: 4),
      SubscriptionBadge(
        badgeType: offer.business!.badgeType,
        size: 16,
      ),
    ],
  ],
),
```

### 3. Verifica ca `OfferBusiness` model are `badgeType`

Deschide `lib/models/offer.dart` si verifica ca clasa `OfferBusiness` (sau echivalentul) are:
```dart
final String? badgeType;
```

Daca nu exista, trebuie adaugat si parsat din JSON-ul backend-ului. Backend-ul ar trebui sa returneze `badge_type` in raspunsul offer detail (JOIN cu `businesses.subscription_badge_type`).

### 4. Verifica backend-ul

Verifica ca endpoint-ul de offer detail (GET `/api/offers/:id` sau `/oferte/:slug`) include `subscription_badge_type` in business data. Cauta in `web.js` sau `offers.js` query-ul care returneaza offer detail si verifica JOIN-ul cu businesses:

```sql
-- Ar trebui sa includa:
b.subscription_badge_type AS badge_type
```

---

## Verificare

- [ ] Offer detail screen afiseaza badge portocaliu (verified) langa numele unui business Standard
- [ ] Offer detail screen afiseaza badge mov (premium) langa numele unui business Premium
- [ ] Offer detail screen fara badge pentru business Free
- [ ] Badge-ul nu trunchiaza numele business-ului (Flexible + overflow)
- [ ] Tap pe sectiunea business navigheaza corect la business detail
