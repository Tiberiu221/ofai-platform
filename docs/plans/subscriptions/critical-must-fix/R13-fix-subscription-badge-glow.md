# R13 — Fix SubscriptionBadge Premium Glow

> **Severitate:** CRITICAL
> **Fisier:** `ofai_flutter/lib/widgets/subscription_badge.dart`, linia ~22-38
> **Impact:** Premium badge-ul are `boxShadow` pe un `Container` fara suprafata vizibila — glow-ul mov nu se vede sau este minim/clipat.

---

## Problema

```dart
if (badgeType == 'premium') {
  return Container(
    decoration: const BoxDecoration(
      boxShadow: [
        BoxShadow(
          color: AppColors.premiumPurpleGlow,
          blurRadius: 8,
          spreadRadius: 1,
        ),
      ],
    ),
    child: Icon(
      Icons.verified,
      color: AppColors.premiumPurple,
      size: size,
    ),
  );
}
```

### Ce nu functioneaza:
- `BoxDecoration` are doar `boxShadow`, fara `color`, `borderRadius`, sau `shape`
- In Flutter, `boxShadow` deseneaza umbra in jurul box-ului container-ului
- Fara padding, Container-ul se potriveste exact pe Icon (tight fit)
- Umbra rectangulara pe un container tight fara border-radius nu arata ca un "glow" — arata ca un dreptunghi mov in spatele icon-ului
- Pe unele dispozitive, shadow-ul poate fi clipat de parent widgets

---

## Fix

Inlocuieste build-ul pentru `'premium'` cu o varianta care foloseste padding si shape circular:

```dart
if (badgeType == 'premium') {
  return Container(
    padding: const EdgeInsets.all(2),
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      boxShadow: [
        BoxShadow(
          color: AppColors.premiumPurpleGlow,
          blurRadius: 10,
          spreadRadius: 2,
        ),
      ],
    ),
    child: Icon(
      Icons.verified,
      color: AppColors.premiumPurple,
      size: size,
    ),
  );
}
```

### Schimbari:
1. `padding: EdgeInsets.all(2)` — da spatiu pentru shadow sa fie vizibil
2. `shape: BoxShape.circle` — shadow-ul este circular (potrivit cu forma icon-ului)
3. `blurRadius: 10` (crescut de la 8) — glow mai soft
4. `spreadRadius: 2` (crescut de la 1) — glow mai vizibil

### Alternativa (daca cliparea e cauzata de parent):

Daca parent-ul are `clipBehavior: Clip.hardEdge` sau `overflow: hidden`, glow-ul va fi clipat indiferent. In acest caz, foloseste un `Stack` cu un widget de glow dedesubt:

```dart
if (badgeType == 'premium') {
  return SizedBox(
    width: size + 8,
    height: size + 8,
    child: Stack(
      alignment: Alignment.center,
      clipBehavior: Clip.none,
      children: [
        // Glow layer (behind icon)
        Container(
          width: size * 0.6,
          height: size * 0.6,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.premiumPurpleGlow,
            boxShadow: [
              BoxShadow(
                color: AppColors.premiumPurpleGlow,
                blurRadius: 10,
                spreadRadius: 3,
              ),
            ],
          ),
        ),
        // Icon layer
        Icon(
          Icons.verified,
          color: AppColors.premiumPurple,
          size: size,
        ),
      ],
    ),
  );
}
```

**Recomandare:** Incearca fix-ul simplu (Container cu padding + circle shape) mai intai. Daca nu se vede, treci la varianta cu Stack.

---

## Verificare

- [ ] Premium badge afiseaza un glow mov vizibil in jurul icon-ului
- [ ] Badge-ul nu adauga spatiu excesiv (compara cu badge-ul verified care nu are glow)
- [ ] Glow-ul se vede pe fundal intunecat (#06060a) — contrast suficient
- [ ] Badge-ul functioneaza la size = 16 (default), size = 20 (detail screen), size = 12 (cards)
- [ ] Standard badge (verified, portocaliu) nu este afectat de modificari
