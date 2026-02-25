# Design: Offers UX Redesign — Filtre & Detail Page

**Data:** 25 Februarie 2026
**Autor:** Claude + Tiberiu
**Status:** APROBAT
**Abordare:** Chips clarificati (filtre) + Breathe & Highlight (detail)

---

## 1. Problema

### Pagina /oferte:
Filtrele sunt confuze — 3-4 randuri de chips identice vizual (categorii, orase, sort) fara labels sau ierarhie clara. Utilizatorul nu stie ce face fiecare rand. Prea mult spatiu ocupat inainte de oferte.

### Offer detail:
Pagina arata "cheap" — totul e compact fortat, chiar si pe desktop informatiile sunt stocate prea vertical ca si cum ar fi pe telefon. Layout-ul e prea ingust. CTA-urile importante (Dezvaluie codul, Suna) nu ies in evidenta. Lipsa de carduri/containere vizuale — text direct pe pagina.

**Audienta:** Utilizatori care browseuiesc oferte si decid daca sa actioneze (reveal code, suna, naviga la business).

---

## 2. Design: Pagina /oferte — Filtre

### Starea actuala:
```
[Header cu titlu + search bar]
[Categorii chips scroll orizontal]
[Preferinte chip (optional)]
[Orase chips scroll orizontal]
[Sort chips: Noi | Populare | Reducere | Expira | Distanta]
[Geo banner (optional)]
= 4 randuri de filtre
```

### Design nou:
```
Rand 1:  [target Pref.] [Toate] [Beauty] [Fitness] [Frizerie] [Auto] ...
                         categorii scroll orizontal

Rand 2:  [clock Noi check] [fire Populare] [% Reducere] [timer Expira]  | [x Reset]  | pin Toate orasele - Schimba
          sort chips (icon + text scurt)                                   reset         escape hatch oras
```

### Modificari concrete:

**1. De la 4 randuri la 2:**
- Rand 1: Preferinte toggle + categorii chips (scroll orizontal)
- Rand 2: Sort chips (cu icon + text scurt) + reset + escape hatch oras
- Eliminam randul separat de orase — daca userul are preferinte, orasele se aplica automat
- "Escape hatch": link text discret "pin Toate orasele - Schimba" (link la /preferinte)

**2. Sort compact:**
- 4 chip-uri cu icon + text scurt (nu text lung ca acum)
- Icoane: clock Noi, fire Populare, %arrow Reducere, timer Expira
- Chip activ = orange fill + white text
- Distance sort ramane ca icon optional (pin) langa sort chips

**3. Active states puternice:**
- Chip selectat: `background: var(--accent); color: #fff;`
- Chip neselectat: `background: transparent; border: 1px solid rgba(255,255,255,0.1);`
- Contrast clar intre activ/inactiv

**4. Preferinte chip:**
- Primul element din rand 1
- Toggle style diferit: outline cu target emoji
- Cand activ: "Preferintele mele check" cu fill

**5. Reset:**
- Apare doar cand exista filtre active
- Text mic cu x: "Reseteaza"
- Click = sterge toate filtrele, reload

### Fisiere afectate:
- `views/public/oferte.ejs` — replace filter HTML (linii 40-96)
- `public/css/main.css` — update `.filter-*` styles
- Zero modificari in web.js route handler (query params raman identice)

### Ce NU schimbam:
- Grid-ul de oferte ramane identic
- Paginarea ramane identica
- Search bar ramane identic
- Card-urile de oferte raman identice
- Logica backend de filtrare ramane identica

---

## 3. Design: Offer Detail — Breathe & Highlight

### Probleme curente:
1. Layout prea ingust pe desktop — totul comprimat pe vertical
2. Spacing mic — sectiunile se lipesc una de alta
3. CTA-urile nu ies in evidenta
4. Arata "cheap" — lipsa de carduri/containere vizuale
5. Hero mic si neimpactant

### 3.1 Hero mai dramatic

**Acum:** Image cu aspect-ratio 21/9, max-height 480px, titlu SUB imagine
**Nou:**
- `min-height: 400px` pe desktop
- Gradient overlay mai pronuntat (60% dark bottom)
- Discount badge mai mare: font 1.5rem, padding 12px 24px
- Titlu ofertei afisat PESTE hero (overlay, alb pe gradient dark)
- Business name sub titlu (link, accent color)

**RISC:** Titlu pe imagine luminoasa = greu de citit
**SOLUTIE:** Gradient overlay puternic + text-shadow pe titlu

### 3.2 Layout wider pe desktop

**Acum:** Grid template columns ambiguous, sidebar 360px
**Nou:**
- Container max-width: `1200px`
- Grid: `1fr 380px` gap `48px`
- Main column beneficiaza de spatiu extra
- Mobile: ramane `1fr` (stacked)

### 3.3 Spacing dublu intre sectiuni

**Acum:** Gap intre sectiuni ~16-24px, padding intern 12-16px
**Nou:**
- Gap intre sectiuni: `48px`
- Padding intern in carduri: `24px-32px`
- Line-height pe text: `1.7` (de la 1.4-1.5)
- Font descriptions: `1rem` (de la 0.875rem)

### 3.4 Sectiuni cu carduri vizuale

Fiecare sectiune cheie devine un card cu background + border subtil.
Folosim `.detail-card` class namespace.

**Card Perioada:**
```
+---------------------------------------------------+
| calendar Perioada                                  |
| 15 Feb — 15 Mar 2026  *  Activa (badge verde)     |
| [progressbar] Expira in 18 zile                    |
+---------------------------------------------------+
```

**Card Promo Code (CTA principal):**
```
+---------------------------------------------------+
| gift Cod promo                          EXCLUSIV   |
|                                                    |
|  +---------------------------------------------+  |
|  |        [  Dezvaluie codul promo  ]           |  |
|  |      doar X coduri ramase din 100            |  |
|  +---------------------------------------------+  |
|                                                    |
|  Nu ai cont? Inregistreaza-te gratuit              |
+---------------------------------------------------+
```
- Full-width buton intr-un card dedicat
- Glow effect (box-shadow orange subtil)
- Scarcity bar vizual sub buton
- Daca nu e logat: mesaj sub buton

**Card Locatii:**
```
+---------------------------------------------------+
| pin Locatii (3)                                    |
|                                                    |
|  Str. Eroilor 15, Cluj    [phone Suna] [map Nav.]  |
|  Str. Avram Iancu 8       [phone Suna] [map Nav.]  |
|  Bd. Unirii 22            [phone Suna] [map Nav.]  |
+---------------------------------------------------+
```

**Card Conditii:**
```
+---------------------------------------------------+
| info Conditii                                      |
|                                                    |
| Oferta valabila doar la achizitii peste 100 lei.   |
| Nu se cumuleaza cu alte promotii.                   |
+---------------------------------------------------+
```

**Card Cum sa profiti:**
```
+---------------------------------------------------+
| phone Cum sa profiti de oferta?                    |
|                                                    |
| 1. Dezvaluie codul promo de mai sus                |
| 2. Suna la business sau mergi la locatie           |
| 3. Mentioneaza codul la plata                      |
+---------------------------------------------------+
```

### 3.5 CTA "Dezvaluie codul" prominent

- Full-width buton in card dedicat (nu pierdut in text)
- Glow: `box-shadow: 0 0 40px rgba(251, 146, 60, 0.15)`
- Font size: `1rem` bold
- Scarcity: progress bar vizual + "doar X coduri ramase"
- Nelogat: "Creeaza cont pentru a vedea codul" + link register

### 3.6 Business sidebar upgrade

- Logo: `80px` (de la 72px)
- Rating cu stele pline vizuale (SVG filled)
- "Vezi business-ul" buton mai prominent (secondary style, full width)
- Sticky cu shadow subtle la scroll
- Spacing intern crescut

### 3.7 Mobile adjustments

Pe mobile ramane compact (e OK pentru mobile), dar:
- Padding lateral: `20px` (de la 16px)
- CTA full-width
- Business card apare sub description (nu sidebar)
- Bottom padding extra pentru floating elements

---

## 4. Fisiere Afectate

### /oferte filtre:
| Fisier | Modificare | Risc |
|--------|-----------|------|
| `views/public/oferte.ejs` | Replace filter HTML (linii 40-96) | **MEDIU** — structura filter bar |
| `public/css/main.css` | Update filter styles, add sort icon chips | **MEDIU** — clase existente |
| `routes/web.js` | ZERO modificari | **ZERO** |

### Offer detail:
| Fisier | Modificare | Risc |
|--------|-----------|------|
| `views/public/offer-detail.ejs` | Hero overlay, card sections, spacing, CTA | **MARE** — 1318 linii, fisier critic |
| `public/css/main.css` | Stiluri .detail-card, spacing, hero, sidebar | **MARE** — multe clase noi |
| `routes/web.js` | ZERO modificari | **ZERO** |

### Flutter:
| Fisier | Modificare | Risc |
|--------|-----------|------|
| `screens/explore/explore_screen.dart` | Mirror filter simplification | **MEDIU** — 949 linii |
| `screens/offer/offer_detail_screen.dart` | Spacing, card styling, CTA highlight | **MEDIU** — 1297 linii |

### Nu atingem:
- Backend route handlers (datele sunt suficiente)
- API endpoints
- Database
- Promo code reveal logic (JS existent)
- Schema.org structured data
- Similar offers section
- Share/favorite buttons

---

## 5. Ce NU Facem (YAGNI)

- Nu schimbam grid-ul de oferte (carduri, paginare)
- Nu adaugam infinite scroll pe web
- Nu schimbam booking logic
- Nu redesign complet offer detail (upgrade, nu rewrite)
- Nu adaugam animatii complexe
- Nu modificam Flutter offer detail layout fundamental

---

## 6. Criterii de Succes

1. Filtrele pe /oferte sunt clare in 2 randuri (nu 4)
2. Offer detail arata "premium" nu "cheap" pe desktop
3. CTA "Dezvaluie codul" e vizibil fara scroll pe desktop
4. Spacing intre sectiuni face pagina mai citibila
5. Carduri vizuale grupeaza informatia logic
6. Zero regressions pe functionalitate existenta
7. Mobile ramane functional si compact

---

## 7. Analiza de Risc

### R1: offer-detail.ejs e fisier critic (1318 linii)
- **Impact:** Orice eroare EJS = pagina nu se incarca
- **Mitigare:** Editam sectiune cu sectiune, verificam dupa fiecare
- **Test:** Preview dupa fiecare edit

### R2: CSS specificity conflicts
- **Impact:** Stiluri noi pot interfere cu existente
- **Mitigare:** Namespace `.detail-card` + `.filter-bar-v2` pentru clase noi
- **Test:** Desktop + mobile check

### R3: Hero overlay text citibil
- **Impact:** Pe imagini luminoase, textul alb poate fi invizibil
- **Mitigare:** Gradient overlay 60% + text-shadow puternic
- **Test:** Test cu diverse imagini

### R4: Flutter explore_screen.dart e complex (949 linii)
- **Impact:** Modificarile la filtre pot afecta state management
- **Mitigare:** Doar UI changes, nu modificam providers
- **Test:** flutter analyze + test pe emulator
