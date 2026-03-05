# Design: Liquid Glass Bottom Navigation Bar

**Data:** 2026-03-05
**Componenta:** Flutter bottom nav (`ofai_flutter/lib/app.dart`)
**Abordare:** Enhanced BackdropFilter (Abordare A)

## Obiectiv

Transformarea bottom nav-ului existent într-un efect "liquid glass" mai pronunțat, cu underline orange animat pe tab-ul activ. Zero impact pe performanță — doar ajustări de parametri existenți.

## Ce se schimbă

### 1. Bara — Enhanced Glass

| Proprietate | Valoare curentă | Valoare nouă |
|---|---|---|
| Blur sigma | 20 | 30 |
| Background | `0xCC111111` (80%) | `0x88111111` (~53%) |
| Border top | 0.5px `borderLight` solid | 0.5px gradient (transparent → orange 15% → transparent) |
| Inset shadow | — | BoxShadow internă: alb 3% spread interior top, negru 10% bottom |
| Highlight | — | Gradient subtil vertical: alb 2% sus → transparent jos |

### 2. Orange Underline (înlocuiește dot-ul)

- Linie 2px sub icon+label, lățime ~40px
- Gradient: transparent → `#FB923C` → transparent (fade la capete)
- `AnimatedPositioned` — alunecă între tab-uri, `Curves.easeInOutCubic`, 250ms
- Glow subtil sub linie: BoxShadow orange blur 6px, opacity 30%

### 3. Ce rămâne neschimbat

- Icon-urile (home, explore, bookmark, person)
- Label-urile românești
- Culori active/inactive (orange / textTertiary)
- Height 72px (`AppSpacing.bottomNavHeight`)
- `extendBody: true` pe Scaffold
- Logica GoRouter + `_calculateSelectedIndex()`

## Fișiere afectate

- `lib/app.dart` — secțiunea `_ShellScreen` bottom nav (~30 linii modificate)
- Opțional: `lib/core/theme/app_colors.dart` dacă adăugăm variante noi

## Riscuri și mitigare

- **Blur performance pe low-end**: sigma 30 e sigur — Flutter optimizează BackdropFilter nativ
- **Animație underline**: folosim widget-uri standard Flutter (AnimatedPositioned), fără custom painters
- **Stricarea layout-ului**: nu schimbăm height, spacing sau structura Row — doar vizual
