# Design: Trust & First Impression — Primele 30 de Secunde

**Data:** 25 Februarie 2026
**Autor:** Claude + Tiberiu
**Status:** APROBAT
**Abordare:** Value-First Hero (Abordarea A)

---

## 1. Problema

Un vizitator nou (utilizator SAU business owner) ajunge pe ofai.ro si nu intelege instant:
- Ce este OFAI
- De ce sa aiba incredere
- Ce castiga

Hero-ul actual e orientat pe stats (X business-uri, Y oferte) care nu inseamna nimic pentru cineva care nu stie ce e platforma. Lipsesc semnale de trust vizibile.

**Audienta:** Ambele — utilizatori care cauta oferte + business owners care evalueaza daca sa se listeze.

**Stadiu:** Platforma e la inceput, nu avem volume mari de utilizatori. Trust-ul trebuie construit prin claritate si profesionalism, nu prin numere mari.

---

## 2. Starea Actuala (Ce Avem)

### Hero actual (home.ejs linii 4-59):
```
[pill: "X+ oferte noi saptamana aceasta"]
[h1: "Reduceri de la business-uri locale"]
[subtitle cu stats: "peste X business-uri din Y orase"]
[search bar]
[2 CTA: "Exploreaza oferte" + "Cum functioneaza?"]
[3 stats: Business-uri / Oferte active / Orase]
```

### Restul paginii (ordinea actuala):
1. Marquee business-uri partenere
2. Categorii grid
3. "Pentru tine" (followedOffers — doar logati)
4. Deal of the Day
5. Oferte featured (bento grid)
6. Top Business-uri
7. "Cum functioneaza?" (3 pasi)
8. Orase
9. CTA business

### Ce exista bine:
- Marquee cu logo-uri (social proof vizual)
- Verified badge pe business-uri
- Save counts, trending badges
- Deal of the Day
- Gamification (streaks, badges)

### Ce lipseste:
- Trust pillars vizibili ("Gratuit", "Verificat", "Personalizat")
- Headline orientat pe beneficiu (nu pe brand/stats)
- Mesaj clar anti-scepticism ("Fara costuri ascunse")
- Sectiune business-oriented vizibila mai devreme
- "Cum functioneaza" e prea jos pe pagina (dupa oferte)

---

## 3. Design Propus

### 3.1 Hero Refacut

**Structura noua:**

```
HERO SECTION
├── hero-pill: "X+ oferte noi saptamana aceasta" (PASTRAM — e bun)
├── h1: "Cele mai bune oferte din orasul tau, intr-un singur loc"  [NOU]
├── subtitle: "Descopera reduceri verificate la frizerii, restaurante, [NOU]
│             fitness si 12+ categorii. Gratuit. Fara reclame. Fara catch."
├── search-bar (PASTRAM)
├── hero-ctas: "Exploreaza oferte" + "Pentru Business" [MODIFICAT]
├── trust-pillars: 3 carduri glassmorphic [NOU]
│   ├── "100% Gratuit — Fara costuri ascunse"
│   ├── "Business-uri Verificate — Echipa OFAI verifica fiecare partener"
│   └── "Oferte Personalizate — Bazate pe preferintele tale"
└── hero-stats: Business-uri / Oferte / Orase (PASTRAM dar mai mic)
```

**Modificari concrete in home.ejs:**

1. **h1** — de la `"Reduceri de la business-uri locale"` la `"Cele mai bune oferte din orasul tau, intr-un singur loc"`
   - RISC: SEO — titlul actual e OK pentru SEO. Noul titlu e mai bun pentru conversie dar trebuie pastra keywords.
   - SOLUTIE: Pastram `<meta name="description">` cu keywords vechi. h1 e pentru utilizatori.

2. **subtitle** — adaugam "Gratuit. Fara reclame. Fara catch." — elimina suspiciunea #1
   - RISC: Daca adaugam monetizare mai tarziu, "gratuit" devine misleading
   - SOLUTIE: "Gratuit pentru utilizatori" (business-urile pot avea tiers platite)

3. **CTA secundar** — de la "Cum functioneaza?" la "Pentru Business"
   - RISC: Pierdem link direct la #how-it-works
   - SOLUTIE: Trust pillars au implicit "cum functioneaza" vibe. Sectiunea ramane pe pagina.

4. **Trust Pillars** — 3 carduri noi dupa CTA-uri, inainte de stats
   - RISC: Creste hero height → push content important sub fold
   - SOLUTIE: Carduri compacte (64px height), grid de 3 pe desktop, stack pe mobile
   - RISC: Arata "fake" daca nu avem proof
   - SOLUTIE: Sunt declaratii de principiu, nu statistici. "Verificam partenerii" e real (avem is_verified).

5. **hero-stats** ramane dar mai mic vizual (sub trust pillars)
   - RISC: Stats mici (ex: 15 orase) pot parea neimpresionante
   - SOLUTIE: Pastram ca secondary info, nu hero principal

### 3.2 Reordonare Sectiuni Home Page

**Ordinea noua:**

```
1. HERO (refacut)
2. MARQUEE business-uri (PASTRAM — imediat dupa hero = "avem parteneri reali")
3. "CUM FUNCTIONEAZA" [MUTAT IN SUS — de la pozitia 7 la 3]
   + CTA signup sub pasi ("Creeaza cont gratuit")
4. DEAL OF THE DAY (PASTRAM)
5. OFERTE FEATURED bento (PASTRAM)
6. CATEGORII (PASTRAM dar dupa oferte)
7. TOP BUSINESS-URI (PASTRAM)
8. ORASE (PASTRAM)
9. CTA BUSINESS (PASTRAM — "Ai un business?")
10. "PENTRU TINE" ramane conditonal (doar logati, in pozitia existenta)
```

**Motivare:**
- "Cum functioneaza" TREBUIE sa fie devreme — vizitatorii noi au nevoie sa inteleaga flow-ul inainte de a vedea oferte
- Categoriile nu sunt urgente — mutat dupa oferte concrete (proof first, taxonomy later)
- "Pentru tine" ramane contextual (apare doar daca userul e logat si are followed businesses)

**RISC:** Reordonarea poate afecta `reveal` CSS animation delays
**SOLUTIE:** Animatiile sunt class-based (`reveal-delay-X`), nu hardcoded in ordine. Vor functiona.

### 3.3 Imbunatatiri "Cum Functioneaza"

**Acum:** 3 pasi scurti (Descopera, Salveaza, Profita) — prea generic.

**Nou:** Aceiasi 3 pasi dar cu detalii concrete:

```
Pasul 1: "Alege orasul si categoriile"
  → "Seteaza preferintele tale in 30 de secunde. Primesti doar oferte relevante."

Pasul 2: "Salveaza si urmareste"
  → "Adauga ofertele la favorite. Urmareste business-urile preferate si primeste notificari."

Pasul 3: "Foloseste reducerea"
  → "Mergi la business, arata codul promo sau mentoneaza oferta. Gata!"
```

Plus CTA sub: `[ Creeaza cont gratuit ]` (link la /register)

**RISC:** CTA de signup poate parea agresiv
**SOLUTIE:** Button secondary (outline), nu primary. Non-intrusive.

### 3.4 Sectiune "Pentru Business" Imbunatatita

**Acum (CTA section, linii 446-460):**
```
"Ai un business? Adauga-l pe OFAI"
"Creste-ti vizibilitatea si atrage clienti noi cu oferte si reduceri atractive. Gratuit."
[Button: "Inregistreaza business-ul"]
```

**Nou:** Adaugam 3 beneficii concrete sub mesaj:

```
"Ai un business? Listeaza-te gratuit"

[Card: Dashboard propriu] [Card: Recenzii de la clienti] [Card: Statistici de audienta]

"Fara comisioane. Fara contracte. Anuleaza oricand."

[Button: "Inscrie-ti afacerea"]
```

**RISC:** Trebuie CSS nou pentru inner cards
**SOLUTIE:** Reusam `.inner-grid` pattern care exista deja (manage.ejs portal il foloseste)
Sau mai simplu: 3 x `<span>` inline cu emoji, fara carduri noi — keep it simple.

### 3.5 Mirror pe Flutter

**Modificari in home_screen.dart:**

1. **Hero text** — aceleasi mesaje (headline orientat pe beneficiu)
2. **Trust Pillars** — 3 pill-uri/chips sub stats row
3. **"Cum functioneaza"** mini-section — 3 pasi compacti (expandable sau static)

**RISC:** Flutter home_screen.dart e deja complex (500+ linii, multiple widgets)
**SOLUTIE:** Trust pillars = widget simplu (Row cu 3 Container). "Cum functioneaza" = widget separat in fisier propriu.

**RISC:** Performance — adaugam mai mult content pe scroll
**SOLUTIE:** Trust pillars si how-it-works sunt static (fara API calls). Zero impact pe performance.

---

## 4. Fisiere Afectate

### Backend (web)
| Fisier | Modificare | Risc |
|--------|-----------|------|
| `views/public/home.ejs` | Hero h1/subtitle, trust pillars HTML, reordonare sectiuni, CTA business imbunatatit | **MARE** — fisier complex, editing order-ul sectiunilor poate introduce bug-uri EJS |
| `public/css/main.css` | Stiluri trust-pillars, ajustari hero spacing | **MEDIU** — adaugam clase noi, nu modificam existente |
| `routes/web.js` | ZERO modificari necesare | **ZERO** — datele existente sunt suficiente |

### Flutter (mobile)
| Fisier | Modificare | Risc |
|--------|-----------|------|
| `screens/home/home_screen.dart` | Hero text, trust pillars widget | **MEDIU** — adaugam widgets noi, nu modificam existente |
| `widgets/` (NOU optional) | `how_it_works_section.dart` | **MIC** — fisier nou, izolat |

### Nu atingem:
- `web.js` route handler (datele sunt deja suficiente)
- `main.js` (nu e nevoie de JS nou)
- Onboarding (nu modificam flow-ul de preferinte)
- Login/Register pages

---

## 5. Ce NU Facem (YAGNI)

- ❌ Testimoniale — nu avem reale, falsele distrug trust
- ❌ Video hero — complex, necesita hosting video
- ❌ "Despre noi" pagina — poate mai tarziu
- ❌ Blog/articole — necesita content editorial
- ❌ Live social proof ("X vizualizeaza acum") — prematur fara volum
- ❌ Animatii complexe pe trust pillars — simple si rapide
- ❌ A/B testing — nu avem trafic suficient
- ❌ Modificari la onboarding flow (alege oras/categorie) — e functional

---

## 6. Criterii de Succes

1. Un vizitator nou intelege in 5 secunde ce e OFAI
2. Trust pillars sunt vizibile fara scroll pe desktop
3. "Cum functioneaza" apare in primele 2 scrolluri
4. Business owners vad CTA dedicat fara sa caute
5. Zero regressions pe functionalitatea existenta
6. Lighthouse score ramane > 80
7. Mobile responsive (trust pillars stack pe 1 coloana)

---

## 7. Analiza de Risc Detaliata

### R1: home.ejs e fisier critic (462 linii)
- **Impact:** Orice eroare EJS = site-ul nu se incarca
- **Mitigare:** Editam sectiune cu sectiune, verificam dupa fiecare schimbare cu preview
- **Test:** Verificam cu `npm run dev` + browser dupa fiecare edit

### R2: CSS specificity conflicts
- **Impact:** Stiluri noi pot interfere cu existente
- **Mitigare:** Folosim prefixul `.trust-` pentru toate clasele noi (namespace)
- **Test:** Verificam pe mobile + desktop

### R3: SEO regression
- **Impact:** h1 nou poate afecta ranking-ul existent
- **Mitigare:** Pastram meta description cu keywords, h1 ramane relevant, structured data neatins
- **Test:** Verificam ca title/desc/canonical raman corecte

### R4: Performance (CLS — Cumulative Layout Shift)
- **Impact:** Trust pillars adaugate in hero pot cauza layout shift
- **Mitigare:** Height fix pe trust pillars container, sau min-height pe hero
- **Test:** Lighthouse check CLS

### R5: Flutter home_screen.dart complexitate
- **Impact:** Fisierul e deja 500+ linii cu multiple widgets
- **Mitigare:** Trust pillars ca widget inline simplu (< 30 linii). How-it-works in fisier separat
- **Test:** `flutter analyze` + test pe emulator

### R6: "Gratuit" claim daca adaugam monetizare
- **Impact:** Messaging inconsistent in viitor
- **Mitigare:** Textul spune "Gratuit" fara calificativ — se refera la utilizatori. Business-urile vor avea tiers.
- **Decizie:** Acceptabil — cand adaugam monetizare, updatam copy-ul
