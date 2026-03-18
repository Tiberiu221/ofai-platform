# 03 - Rich Share (OG Tags + Flutter share_plus)

## Context
`head.ejs:18-40` are template OG complet dar `web.js` NU trimite `ogTitle/ogDesc/ogImage/ogUrl` in render calls. Cand cineva share-uie un link pe WhatsApp/FB, se vede default-ul generic OFAI.
Flutter: `share_plus ^10.1.4` deja in pubspec, `Launchers` exista. Trebuie trecut de la `Share.share(text)` la `Share.shareUri(url)`.

## Fisiere de modificat

### 1. Offer detail render — adauga OG vars
**Fisier:** `appredueri_backend/src/routes/web.js` (~linia 897)
In `res.render("public/offer-detail", {...})`, adauga:
```javascript
ogTitle: offer.title,
ogDesc: (offer.description || 'Oferta pe OFAI').substring(0, 160),
ogImage: offer.image_url || null,
ogUrl: `https://ofai.ro/oferta/${offer.id}`,
```

### 2. Business detail render — adauga OG vars
**Fisier:** `appredueri_backend/src/routes/web.js` (~linia 1290)
In `res.render("public/business-detail", {...})`, adauga:
```javascript
ogTitle: business.name,
ogDesc: (business.description || `${business.name} pe OFAI`).substring(0, 160),
ogImage: business.cover_image || business.logo_url || null,
ogUrl: `https://ofai.ro/business/${business.id}`,
```

### 3. Flutter — Share.shareUri()
**Fisier:** `ofai_flutter/lib/core/utils/launchers.dart` (liniile 8-16)
Inlocuieste:
```dart
static Future<void> shareOffer(String title, int offerId) async {
  final url = Uri.parse('https://ofai.ro/oferta/$offerId');
  await Share.shareUri(url);
}

static Future<void> shareBusiness(String name, int businessId) async {
  final url = Uri.parse('https://ofai.ro/business/$businessId');
  await Share.shareUri(url);
}
```

## Verificare
1. Restart backend, visit ofai.ro/oferta/1 → view source → verifica `<meta property="og:title">`
2. Facebook Sharing Debugger: paste URL → trebuie sa arate titlu + imagine
3. Flutter: share oferta pe WhatsApp → preview bogat cu imagine
