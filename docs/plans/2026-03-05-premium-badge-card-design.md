# Premium Badge Card — Flutter Account Screen

## Obiectiv
Redesign sectiunea de badge-uri din ecranul Cont Flutter intr-un card glassmorphism premium, consistent cu stilul OFAI.

## Stare curenta
- Badge-uri in ListView horizontal fara container
- Cercuri 46-52px, text se taie la 64px latime
- Icon-uri generice (verified_rounded / star_rounded)
- Selectia: glow + marime animata
- "Niciuna" = cerc cu X

## Design nou

### Card Container
- `Container` cu `BackdropFilter` blur(12)
- Background: `rgba(255,255,255,0.04)`
- Border: `rgba(255,255,255,0.08)`, borderRadius 16
- Padding: 16 top/bottom, 0 lateral (scroll bleeds to edges)
- Inner shadow top (white 3%) for depth

### Header (padding 16h)
- Row: "Insigne câștigate" (labelLarge) + Spacer + count in orange pill
- Subtitle: "Selectează pentru recenzii" (captionMuted)

### Badge Strip
- ListView.builder horizontal, BouncingScrollPhysics
- ShaderMask fade pe margini (pastram)
- Fiecare badge: **80px latime** (de la 64)
  - Cerc **54px** (de la 46/52)
  - Background: badgeColor 12% opacity
  - Border: badgeColor 30% normal, 100% selectat
  - Glow: BoxShadow badgeColor 40%, blur 14 — doar selectat
  - Icon: Icons.star_rounded colorat (consistent cu web)
  - Checkmark overlay 12px colt dreapta-jos cand selectat
  - Text 2 randuri (maxLines: 2, fontSize: 10)

### "Niciuna" badge
- Stil: bgSecondary, icon close, fara glow
- Text: "Fara insigna"

### Animatii
- AnimatedContainer pe cerc — 200ms easeOut (pastram)
- Scale: 1.0 → 1.08 selectat

## Fisiere de modificat
- `ofai_flutter/lib/screens/account/account_screen.dart` — badges section + _BadgeChip widget
