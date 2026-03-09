# Competitive Teardown — OFAI

Analiza competitiva structurata pentru platforma OFAI (oferte/reduceri Romania). Compara cu competitorii directi si indirecti.

## Input: $ARGUMENTS
- **(gol)** — full teardown: feature matrix + pricing + SWOT + action items
- **`<competitor_url>`** — teardown pe un competitor specific
- **`matrix`** — doar feature comparison matrix
- **`pricing`** — doar pricing analysis

## Competitorii OFAI

### Directi (platforme de oferte/reduceri Romania)
1. **Reduceri.ro** — aggregator reduceri online
2. **PromoCod.ro** — coduri promotionale
3. **CuponPlus.ro** — cupoane si vouchere
4. **MyDeal.ro** — oferte locale
5. **Groupon.ro** (defunct?) — oferte de grup

### Indirecti (platforme locale)
6. **Google Maps** — business listings + reviews
7. **Facebook Local** — pagini de business + oferte
8. **Tazz/Bolt Food** — delivery cu promos
9. **eMAG Genius** — deal aggregation
10. **Shopmania.ro** — price comparison

## Step 1: Data Collection

Pentru fiecare competitor:

### Website Analysis
```
- Pricing page: captura structura de preturi
- Features: listeaza toate functionalitatile vizibile
- Target audience: B2C, B2B, sau ambele?
- Business model: freemium, subscription, commission, advertising?
- Tech stack: ce framework folosesc (view source, Wappalyzer)
- Mobile app: exista? Rating pe App Store / Google Play?
- SEO: title tag, meta description, schema markup
```

### App Store Analysis (daca exista)
```
- Rating: stele + numar de reviews
- Downloads: estimare din Google Play
- Ultima actualizare: data
- Top complaints: din reviews 1-2 stele
- Top praise: din reviews 4-5 stele
```

### Social Media
```
- Facebook: followers, posting frequency, engagement
- Instagram: followers, content type
- LinkedIn: company size, job postings (growth signal)
```

## Step 2: Feature Comparison Matrix

Scor 1-5 per dimensiune:

| Dimensiune | OFAI | Competitor 1 | Competitor 2 | ... |
|-----------|------|-------------|-------------|-----|
| **Oferte locale** | ? | ? | ? | |
| **Coduri promotionale** | ? | ? | ? | |
| **Verificare business** | ? | ? | ? | |
| **Reviews/Rating** | ? | ? | ? | |
| **Gamification** | ? | ? | ? | |
| **Mobile App** | ? | ? | ? | |
| **Business Portal** | ? | ? | ? | |
| **Analytics pt business** | ? | ? | ? | |
| **Push notifications** | ? | ? | ? | |
| **SEO/Discoverability** | ? | ? | ? | |
| **UX/Design** | ? | ? | ? | |
| **Pricing (for business)** | ? | ? | ? | |

## Step 3: Pricing Analysis

| | OFAI Free | OFAI Standard | OFAI Premium | Competitor Free | Competitor Paid |
|---|---|---|---|---|---|
| Pret lunar | 0 RON | 49 RON | 199 RON | ? | ? |
| Oferte active | 3 | 6 | Unlimited | ? | ? |
| Gallery images | 4 | 8 | 32 | ? | ? |
| Analytics | 7 days | 30 days | 90 days | ? | ? |
| Verified badge | ❌ | ✅ | ✅ Premium | ? | ? |
| Push custom | ❌ | ❌ | ✅ | ? | ? |
| Deal of Day | ❌ | ❌ | ✅ nominate | ? | ? |

## Step 4: SWOT Analysis

### OFAI Strengths
- (completat din analiza)

### OFAI Weaknesses
- (completat din analiza)

### Opportunities
- (gaps in competitor offerings)

### Threats
- (competitor advantages, market trends)

## Step 5: Positioning Map

```
                    HIGH FEATURE RICHNESS
                          │
                          │
          OFAI Premium ●  │
                          │  ● Google Maps
    LOW ──────────────────┼──────────────── HIGH
    PRICE                 │                 PRICE
                          │
       OFAI Free ●        │
                          │
                    LOW FEATURE RICHNESS
```

## Step 6: Action Items

Categorizeaza in:

### Quick Wins (1-2 saptamani)
- Features pe care competitorii le au si noi nu, dar sunt usor de implementat

### Medium-term (1-2 luni)
- Features strategice care ne diferentiaza

### Strategic (3-6 luni)
- Directii noi bazate pe gap-uri de piata

## Output

Salveaza raportul in `docs/plans/YYYY-MM-DD-competitive-teardown.md` si afiseaza rezumatul cu:
1. Top 3 avantaje OFAI
2. Top 3 dezavantaje OFAI
3. Top 5 actiuni prioritare
4. Positioning statement recomandat
