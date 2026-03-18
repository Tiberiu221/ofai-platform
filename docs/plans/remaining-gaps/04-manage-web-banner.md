# 04 - "Gestioneaza pe Web" Banner pe Business Detail

## Context
Cand un business owner isi vede propriul business in app, nu stie ca poate sa-l gestioneze pe web. Adaugam un banner care apare doar pentru owner.

## Fisiere de modificat

### 1. Backend — is_owner in API response
**Fisier:** `appredueri_backend/src/routes/businesses.js`
**Route:** `GET /businesses/:id`

Adauga `optionalAuth` middleware pe route. Dupa ce se asambleaza response-ul, adauga:
```javascript
let isOwner = false;
if (req.user) {
  const { rows: ownerRows } = await pool.query(
    "SELECT 1 FROM user_businesses WHERE user_id = $1 AND business_id = $2",
    [req.user.id, parseInt(id)]
  );
  isOwner = ownerRows.length > 0;
}
// Include in response: is_owner: isOwner
```

### 2. Flutter Business model — isOwner field
**Fisier:** `ofai_flutter/lib/models/business.dart`
- Adauga field: `final bool isOwner;`
- Constructor: `this.isOwner = false`
- fromJson: `isOwner: json['is_owner'] as bool? ?? false`

### 3. Flutter UI — banner
**Fisier:** `ofai_flutter/lib/screens/business/business_detail_screen.dart`
Inainte de numele business-ului (~linia 176), adauga:
```dart
if (business.isOwner) ...[
  GestureDetector(
    onTap: () => Launchers.website('https://ofai.ro/portal/${business.id}'),
    child: Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: AppSpacing.lg),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
        border: Border.all(color: AppColors.accent.withValues(alpha: 0.25)),
      ),
      child: Row(children: [
        Icon(Icons.edit_outlined, size: 20, color: AppColors.accent),
        SizedBox(width: AppSpacing.sm),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Acesta este business-ul tau', style: AppTypography.labelMedium.copyWith(color: AppColors.accent)),
            Text('Gestioneaza pe Web', style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
          ],
        )),
        Icon(Icons.open_in_new, size: 18, color: AppColors.accent),
      ]),
    ),
  ),
],
```

## Verificare
1. Backend: `GET /businesses/:id` cu Bearer token al owner-ului → `is_owner: true`
2. Fara auth → `is_owner: false`
3. Flutter: logat ca owner, navigheaza la business-ul tau → banner vizibil
4. Tap pe banner → deschide portal in browser
5. Business strain → fara banner
