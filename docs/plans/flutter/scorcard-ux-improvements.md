# Scorcard UX — Improvements

> **Scop:** Crestem notele slabe din scorcard-ul UX (accesibilitate 5/10, responsive 3/10, deep linking 6/10, search 8/10)
> **Focus realist:** Accesibilitate + Search polish (cele mai fezabile si cu impact)

---

## A11Y-01: Semantics Labels pe Filtre si Sort (Accesibilitate 5→7)

**Problema:** Filter chips, sort buttons, si bottom sheets nu au Semantics labels.

**Fisiere:**
- `ofai_flutter/lib/screens/explore/explore_screen.dart`
- `ofai_flutter/lib/screens/collection/collection_screen.dart`

**Plan:**
1. Adaug `Semantics(label: 'Filtreaza dupa oras', button: true)` pe city filter chip
2. Adaug `Semantics(label: 'Filtreaza dupa categorie', button: true)` pe category chip
3. Adaug `Semantics(label: 'Sorteaza ofertele', button: true)` pe sort chip
4. Adaug `Semantics(label: 'Reseteaza filtrele', button: true)` pe reset chip
5. Bottom sheets: `Semantics(label: 'Alege oras')` pe BottomSheet header

---

## A11Y-02: Semantics pe Detail Screens

**Fisiere:**
- `ofai_flutter/lib/screens/offer/offer_detail_screen.dart`
- `ofai_flutter/lib/screens/business/business_detail_screen.dart`

**Plan:**
1. Sectiunile principale: `Semantics(header: true, label: 'Descriere oferta')`, `'Locatii'`, `'Recenzii'`
2. Share button: `Semantics(label: 'Distribuie oferta', button: true)`
3. Report button: `Semantics(label: 'Raporteaza oferta', button: true)`
4. Gallery images: `Semantics(label: 'Imagine ${index + 1} din ${total}', image: true)`
5. Rating stars: `Semantics(label: '${rating} din 5 stele')`

---

## A11Y-03: ExcludeSemantics pe Elemente Decorative

**Fisiere:** Multiple widgets

**Plan:**
1. `ParticleBackground` → `ExcludeSemantics(child: ParticleBackground())`
2. `OrangeGlowWave` → `ExcludeSemantics`
3. Gradient overlays pe imagini → `ExcludeSemantics`
4. Divider/separator widgets → implicit excluded, verificam

---

## SEARCH-01: Search History Persistence (Search 8→9)

**Deja planificat in Tier 1 #3.** Cross-reference: `tier1-high-impact.md`

---

## SEARCH-02: Clear Filters Suggestion in Empty State

**Fisier:** `ofai_flutter/lib/screens/explore/explore_screen.dart`

**Problema:** Empty state pe Explore zice "Incearca alte filtre" dar nu ofera buton de reset.

**Fix:**
1. In empty state de Explore, adaug buton action: "Reseteaza filtrele"
2. La tap: clear toate filtrele + re-fetch

---

## RESPONSIVE-01: Notita Minima (Responsive 3/10)

**Realitate:** Tablet support e un proiect mare (LayoutBuilder, adaptive grids, master-detail). Nu facem acum.

**Quick wins fezabile:**
1. Categories grid: `crossAxisCount` bazat pe `MediaQuery.of(context).size.width > 600 ? 3 : 2`
2. Horizontal card lists: width bazat pe screen width, nu hardcoded 260px
3. Page padding: `max(16, screenWidth * 0.04)` pe ecrane mari

**Nota:** Aceste 3 quick wins nu rezolva responsive complet, dar evita ca app-ul sa arate broken pe tablete.

---

## DEEPLINK-01: Notita Minima (Deep Linking 6/10)

**Deja planificat in Tier 3 #16.** Cross-reference: `tier3-nice-to-have.md`

**Quick win fezabil acum:**
1. Verificam ca share text include URL-ul web corect: `https://ofai.ro/oferta/${id}`
2. Verificam ca URL-ul web e accesibil public si are OG tags (cross-ref Tier 1 #5)
3. Universal links (app links) raman Tier 3

---

## Sumar Prioritati Scorcard

| Item | Efort | Impact pe nota |
|------|-------|---------------|
| A11Y-01 Semantics filtre | Mic | 5→6 |
| A11Y-02 Semantics details | Mic | 6→7 |
| A11Y-03 ExcludeSemantics | Mic | 7→7.5 |
| SEARCH-02 Reset filters button | Mic | 8→8.5 |
| RESPONSIVE-01 Quick wins | Mic | 3→4 |
| DEEPLINK-01 Share URL | Mic | 6→6.5 |

**Total efort: ~1-2h pentru toate**
