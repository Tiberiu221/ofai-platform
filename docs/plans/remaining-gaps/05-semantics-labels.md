# 05 - Semantics Labels pentru Accesibilitate

## Context
Acoperire curenta:
- explore_screen.dart: BUNA (filtre, chips etichetate)
- offer_detail_screen.dart: PARTIALA (doar share/report)
- business_detail_screen.dart: PARTIALA (doar share/report/gallery)

## Fisiere de modificat

### 1. offer_detail_screen.dart
- Titlu: `Semantics(label: 'Titlu oferta: ${offer.title}', header: true, child: ...)`
- Discount badge: `Semantics(label: 'Reducere ${offer.discountLabel}', child: ...)`
- Descriere: `Semantics(label: 'Descriere: ${offer.description}', child: ...)`
- Reveal code button: `Semantics(label: 'Dezvaluie codul promotional', button: true, child: ...)`
- Similar offers heading: `Semantics(label: 'Oferte similare', header: true, child: ...)`
- Flash deal banner: `Semantics(label: 'Oferta flash cu timp limitat', child: ...)`

### 2. business_detail_screen.dart
- Business name: `Semantics(label: 'Business: ${business.name}', header: true, child: ...)`
- Category + city: `Semantics(label: '${business.categoryName}, ${business.cityName}', child: ...)`
- Rating: `Semantics(label: 'Nota ${business.rating} din 5, ${business.ratingCount} recenzii', child: ...)`
- _InfoTile: wrap InkWell cu `Semantics(label: label, button: onTap != null, child: ...)`
- _BookingChip: wrap cu `Semantics(label: 'Rezervare prin $label', button: true, child: ...)`
- Hours heading: `Semantics(label: 'Program de lucru', header: true, child: ...)`
- Day rows: `Semantics(label: '${dayName}: ${isClosed ? 'Inchis' : '$open - $close'}', child: ...)`
- Catalog heading: `Semantics(label: 'Servicii si Produse', header: true, child: ...)`
- Catalog items: `Semantics(label: '${item.name}, ${item.priceDisplay}', child: ...)`
- Reviews heading: `Semantics(label: 'Recenzii', header: true, child: ...)`

## Pattern
```dart
Semantics(
  label: 'Text descriptiv in romana',
  header: true,    // pentru headings
  button: true,    // pentru butoane
  image: true,     // pentru imagini
  child: ExistingWidget(...),
)
```

## Verificare
1. `flutter analyze` — zero erori noi
2. Enable TalkBack (Android) / VoiceOver (iOS)
3. Navigheaza la offer detail → screen reader anunta titlu, reducere, descriere
4. Navigheaza la business detail → anunta nume, rating, program, catalog
