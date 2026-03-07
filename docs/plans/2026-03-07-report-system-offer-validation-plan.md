# Plan de Implementare: Sistem de Raportare + Validare AI Oferte

**Data:** 2026-03-07
**Componente:** A. Report System | B. Offer AI Validation
**Migrări:** 048, 049

---

## A. SISTEM DE RAPORTARE (Report System)

### A1. Migrare DB — `048_reports.sql`

```sql
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    target_type VARCHAR(20) NOT NULL,        -- 'offer' sau 'business'
    target_id INTEGER NOT NULL,
    reason VARCHAR(50) NOT NULL,             -- cod motiv (vezi mai jos)
    details TEXT,                            -- text liber (opțional, max 500 chars)
    status VARCHAR(20) DEFAULT 'pending',    -- pending / reviewed / dismissed
    admin_notes TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);

-- Un user nu poate raporta aceeași țintă de 2 ori
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique_per_user
    ON reports(reporter_id, target_type, target_id);
```

**Coduri motiv (reason):**
- `fake_offer` — Ofertă falsă / inexistentă
- `misleading_price` — Preț înșelător
- `closed_business` — Business închis / inexistent
- `inappropriate_content` — Conținut inadecvat
- `spam` — Spam / publicitate agresivă
- `other` — Altul (necesită `details`)

### A2. Backend Routes — `src/routes/reports.js` (NOU)

```
POST   /api/reports                    — Creare raport (auth required)
GET    /api/reports/mine               — Rapoartele mele (auth required)
DELETE /api/reports/:id                — Retragere raport propriu (auth required)
```

**Middleware:** `authMiddleware` (JWT) — NU are nevoie de portalAuth.

**Validare la creare:**
- `target_type` must be `offer` or `business`
- `target_id` must exist (check DB)
- `reason` must be one of codurile de mai sus
- `details` max 500 chars
- Rate limit: max 10 rapoarte per user per zi (count-based, NOT time-based middleware)
- Nu poți raporta propriile oferte/business-uri

**Ce s-ar putea strica:**
- ⚠️ Trebuie montat în `index.js` ca router — risc minim dacă urmăm pattern-ul existent
- ⚠️ CSRF: Ruta e API (JWT), nu web — NU trebuie CSRF middleware

### A3. Backend Routes — Admin (`admin.js` — modificare)

```
GET  /admin/reports                    — Queue rapoarte (pending first)
GET  /admin/reports/:id                — Detalii raport
POST /admin/reports/:id/review         — Marchează reviewed + admin_notes
POST /admin/reports/:id/dismiss        — Marchează dismissed
POST /admin/reports/:id/action         — Acțiune: dezactivare ofertă / suspendare business
```

**Pagina admin/reports:**
- Tabel cu: target, reporter, reason, details, data, status
- Filtrare: pending / reviewed / dismissed
- Sort: pending first, apoi created_at DESC
- Link direct la ofertă/business din admin

**Auto-flag logic:**
- Dacă un target primește ≥3 rapoarte distincte → notificare push la admin
- Dacă un target primește ≥5 rapoarte → oferta se dezactivează automat (is_active = false), admin poate reactiva

**Ce s-ar putea strica:**
- ⚠️ `admin.js` e mare (~1100 linii) — adăugăm la final, risc de typo/bracket mismatch
- ⚠️ Sidebar-ul admin (`layout.ejs`) trebuie extins — riscul e minimal (adăugăm un `<li>`)
- ⚠️ `SELECT *` din offers/businesses — dacă admin page face join-uri, column collision cu reports. Soluție: aliasuri explicite

### A4. Admin Views — EJS Templates

Fișiere noi:
- `views/admin/reports.ejs` — Lista rapoarte (copiem pattern-ul din `business-requests.ejs`)
- `views/admin/report-detail.ejs` — Detalii raport

Modificare:
- `views/admin/layout.ejs` — Adăugare link "Rapoarte" în sidebar + badge count pending

### A5. Flutter — Report UI

**Fișiere noi:**
- `lib/models/report.dart` — Model Report
- `lib/screens/reports/report_dialog.dart` — Dialog de raportare (bottom sheet)

**Fișiere modificate:**
- `lib/screens/offers/offer_detail_screen.dart` — Adăugare buton "Raportează" în AppBar overflow menu (PopupMenuButton cu 3 dots)
- `lib/screens/business/business_detail_screen.dart` — Adăugare buton "Raportează" în AppBar overflow menu
- `lib/core/network/api_client.dart` (sau echivalent) — Adăugare `postReport()` method

**UX Flow:**
1. User apasă ⋮ (more) → "Raportează"
2. Bottom sheet cu radio buttons pentru motiv
3. Câmp text opțional pentru detalii
4. Buton "Trimite raportul"
5. Snackbar: "Raportul a fost trimis. Mulțumim!"
6. Al doilea raport pe aceeași țintă → Snackbar: "Ai raportat deja această ofertă"

**Ce s-ar putea strica:**
- ⚠️ `offer_detail_screen.dart` — dacă AppBar are deja actions, trebuie sa le păstrăm pe toate (share, save). Adăugăm PopupMenuButton sau un al treilea IconButton
- ⚠️ `business_detail_screen.dart` — aceeași situație
- ⚠️ Flutter analyze hook — orice Edit/Write în ofai_flutter triggeră `flutter analyze`. Trebuie cod curat din prima

### A6. Notificări

- La acțiune admin pe raport → push notification la reporter: "Raportul tău a fost analizat"
- La auto-flag (≥3 rapoarte) → push notification la admin topic
- Pattern: refolosim `sendPushNotification()` din `notifications.js`

### A7. Email

- Adăugăm `sendReportActionEmail(to, targetType, action)` în `email.js`
- Se trimite când admin-ul ia acțiune (review/dismiss/action)

---

## B. VALIDARE AI OFERTE (Offer AI Validation)

### B1. Migrare DB — `049_offer_moderation.sql`

```sql
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ai_score SMALLINT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ai_flags JSONB;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'auto_approved';
-- moderation_status: 'auto_approved' | 'pending_review' | 'approved' | 'rejected'

CREATE INDEX IF NOT EXISTS idx_offers_moderation ON offers(moderation_status);
```

**De ce pe tabela `offers` direct (nu tabelă separată):**
- Evităm JOIN-uri suplimentare la listare
- Pattern consistent cu `business_requests` care are ai_score inline
- Oferele existente primesc `moderation_status = 'auto_approved'` (DEFAULT)

### B2. Serviciu — `src/services/llm/offerValidation.js` (NOU)

**Structura (modelată pe businessValidation.js):**

```
validateOffer(offerData, businessData, db)
├── Pass 1: Verificări Programatice (gratuit, instant)
│   ├── checkUnrealisticDiscount(discount_type, discount_value)
│   │   └── Flag: 'unrealistic_discount' dacă percentage > 90% sau fixed > original_price
│   ├── checkSuspiciousTitle(title)
│   │   └── Flag: 'spam_title' dacă < 5 chars, ALL CAPS, repetitive chars
│   ├── checkDateValidity(start_date, end_date)
│   │   └── Flag: 'suspicious_dates' dacă durată > 365 zile sau end_date < start_date
│   ├── checkDuplicateOffer(db, businessId, title)
│   │   └── Flag: 'duplicate_offer' dacă business-ul are altă ofertă cu titlu ~identic
│   └── checkMinimalContent(title, description)
│       └── Flag: 'minimal_content' dacă description lipsește sau < 20 chars
│
└── Pass 2: Analiză LLM (Claude Haiku, ~$0.0003/call)
    ├── analyzeOfferWithLLM(offerData, businessData)
    │   ├── Titlu-descriere coerență (0-100)
    │   ├── Categorie-ofertă relevanță (0-100) — ex: Restaurant cu "Schimb ulei -50%" = suspect
    │   ├── Descriere calitate (0-100) — copy-paste, lorem ipsum, spam patterns
    │   └── Preț plauzibilitate (0-100) — discount-ul are sens economic?
    │
    └── Sistem de penalizări
        ├── unrealistic_discount: -30
        ├── duplicate_offer: -25
        ├── spam_title: -20
        ├── suspicious_dates: -15
        ├── minimal_content: -10
        └── category_mismatch (from LLM): -20
```

**Return:**
```javascript
{
    score: 85,
    flags: [],
    reasoning: "Ofertă legitimă, discount rezonabil...",
    action: 'auto_approve'  // 'auto_approve' | 'pending_review' | 'auto_reject'
}
```

**Thresholds:**
- Score ≥ 70 → `auto_approve` (oferta e live imediat)
- Score 40-69 → `pending_review` (oferta e creată dar cu `is_active = false`, intră în admin queue)
- Score < 40 → `auto_reject` (oferta nu se creează, se returnează eroare cu motiv)

### B3. Integrare în Rutele de Creare Oferte

**Fișiere modificate:**
- `src/routes/business-portal.js` — POST offer creation (line ~584)
- `src/routes/web.js` — POST offer creation (line ~1026)

**Flow modificat:**
```
1. Validare câmpuri (existent) ✓
2. Upload imagine (existent) ✓
3. ★ NOU: validateOffer(offerData, businessData, db)
4. Dacă auto_reject → return 422 cu motiv
5. INSERT offer cu ai_score, ai_flags, ai_reasoning, moderation_status
6. Dacă pending_review → is_active = false, notificare admin
7. Dacă auto_approve → is_active = true (comportament normal)
8. Return offer (cu moderation_status în response)
```

**IMPORTANT: Admin offer creation (admin.js) NU trece prin AI validation** — admin-ul e trusted.

**Ce s-ar putea strica:**
- ⚠️ **business-portal.js ȘI web.js** trebuie modificate identic — risc de divergență. Soluție: extragem logica de validare într-un helper comun
- ⚠️ **Latency:** LLM call adaugă ~1-3 secunde la creare ofertă. Mitigare: Pass 1 e instant, Pass 2 numai dacă Pass 1 nu a dat auto_reject
- ⚠️ **LLM downtime:** Dacă Anthropic API e down, oferta trebuie să se creeze oricum. Fallback: dacă LLM fail → auto_approve cu flag `'llm_unavailable'`
- ⚠️ **Oferte editate:** PUT endpoint-urile trebuie și ele validate (un business poate crea ofertă clean, apoi edita la spam). Trebuie re-validare la edit
- ⚠️ **Flutter UX:** Dacă oferta e `pending_review`, user-ul vede "Oferta ta este în curs de verificare". Trebuie modificat Flutter offer list screen
- ⚠️ **Oferte existente:** Migrarea pune DEFAULT 'auto_approved' — nu re-validăm retroactiv
- ⚠️ **SELECT * collision:** Dacă cod existent face `SELECT * FROM offers`, noile coloane (ai_score, ai_flags, etc.) vor apărea în rezultate. Nu e breaking, dar Flutter model-ul trebuie să le ignore graceful (nullable fields)

### B4. Admin Queue — Offer Moderation

**Fișiere modificate:**
- `src/routes/admin.js` — Rute noi:
  ```
  GET  /admin/offer-moderation              — Queue oferte pending_review
  POST /admin/offer-moderation/:id/approve  — Aprobă (is_active = true, moderation_status = 'approved')
  POST /admin/offer-moderation/:id/reject   — Respinge (moderation_status = 'rejected', rămâne inactive)
  ```

**Fișiere noi:**
- `views/admin/offer-moderation.ejs` — Lista oferte pending (copiem pattern din business-requests.ejs)

**Modificare:**
- `views/admin/layout.ejs` — Link "Moderare Oferte" în sidebar + badge count
- `views/admin/dashboard.ejs` — Adăugare stat `pendingOfferCount`

### B5. Flutter — Moderation Status UI

**Fișiere modificate:**
- `lib/models/offer.dart` — Adăugare câmp `moderationStatus` (nullable String)
- `lib/screens/offers/create_offer_screen.dart` — După creare, dacă `moderation_status == 'pending_review'`, afișare dialog informativ
- `lib/screens/business/business_offers_screen.dart` (sau echivalent) — Badge pe ofertele pending: "În verificare"

### B6. Notificări

- Ofertă `pending_review` → push notification la admin topic: "Ofertă nouă necesită verificare"
- Ofertă aprobată/respinsă de admin → push notification la business owner
- Email la rejection cu motiv

---

## ANALIZĂ DE IMPACT COMPLETĂ

### Ce s-ar putea strica:

| Risc | Severitate | Mitigare |
|------|-----------|----------|
| **Dual route divergence** (business-portal.js + web.js) | 🔴 HIGH | Extragem validarea într-un helper comun, ambele rute apelează aceeași funcție |
| **LLM latency la creare ofertă** (+1-3s) | 🟡 MEDIUM | Pass 1 instant, Pass 2 doar dacă necesar. Fallback la auto_approve dacă LLM down |
| **admin.js crește** (+200 linii) | 🟡 MEDIUM | Putem extrage report routes într-un fișier separat `admin-reports.js` |
| **Flutter model changes** (offer.dart) | 🟡 MEDIUM | Noile câmpuri sunt nullable, backwards compatible cu API responses vechi |
| **SELECT * column collisions** | 🟢 LOW | Coloanele noi pe offers nu au nume comune. Testăm query-urile existente |
| **manage.ejs** (~2000+ linii) | 🟢 LOW | Nu modificăm manage.ejs — raportarea e doar pe Flutter și admin |
| **CSRF pe rute noi** | 🟢 LOW | API routes (JWT) = fără CSRF. Admin routes = urmăm pattern existent cu CSRF |
| **Migrare pe DB producție** | 🟢 LOW | Doar ADD COLUMN / CREATE TABLE — non-destructive, zero downtime |
| **Rate limiting rapoarte** | 🟢 LOW | Count-based per zi, simplu de implementat |
| **Firebase notifications fail** | 🟢 LOW | Fire-and-forget, nu blochează flow-ul principal |

### Ordine de implementare recomandată:

```
FAZA 1 — Report System (A)
  1. Migration 048_reports.sql
  2. Backend: reports.js routes + mount in index.js
  3. Admin: routes + views (reports queue)
  4. Flutter: report dialog + buton pe offer/business detail
  5. Email + notifications

FAZA 2 — Offer AI Validation (B)
  1. Migration 049_offer_moderation.sql
  2. Service: offerValidation.js
  3. Backend: integrare în business-portal.js + web.js
  4. Admin: offer moderation queue + views
  5. Flutter: moderation status UI
  6. Email + notifications
```

### Fișiere afectate total:

**Noi (10 fișiere):**
- `src/migrations/048_reports.sql`
- `src/migrations/049_offer_moderation.sql`
- `src/routes/reports.js`
- `src/services/llm/offerValidation.js`
- `src/views/admin/reports.ejs`
- `src/views/admin/report-detail.ejs`
- `src/views/admin/offer-moderation.ejs`
- `ofai_flutter/lib/models/report.dart`
- `ofai_flutter/lib/screens/reports/report_dialog.dart`
- `ofai_flutter/lib/widgets/moderation_badge.dart`

**Modificate (12 fișiere):**
- `src/routes/admin.js` — rute reports + offer moderation
- `src/routes/business-portal.js` — AI validation la creare/edit ofertă
- `src/routes/web.js` — AI validation la creare/edit ofertă
- `src/index.js` — mount reports router
- `src/services/email.js` — funcții email noi
- `src/services/cronJobs.js` — cron auto-flag reports
- `src/views/admin/layout.ejs` — sidebar links noi
- `src/views/admin/dashboard.ejs` — stats noi
- `ofai_flutter/lib/models/offer.dart` — câmpuri moderation
- `ofai_flutter/lib/screens/offers/offer_detail_screen.dart` — buton report
- `ofai_flutter/lib/screens/business/business_detail_screen.dart` — buton report
- `ofai_flutter/lib/screens/offers/create_offer_screen.dart` — pending_review feedback
