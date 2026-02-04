# Plan Implementare: Reviews Summarization cu LLM

## Descriere Generală

Integrare LLM (OpenAI/Claude) pentru sumarizarea automată a recenziilor business-urilor din platforma OFAI. Când un business are 3+ recenzii, sistemul generează automat un rezumat concis care evidențiază punctele forte și slabe menționate de utilizatori.

---

## Specificații Tehnice

- **Model recomandat**: GPT-3.5-turbo (cost-eficient) sau Claude Haiku
- **Trigger**: Când un business atinge 3+ recenzii
- **Cache**: Rezumatul se regenerează doar când apar recenzii noi
- **Timp estimat total**: 1-2 ore implementare

---

## Structură Bază de Date

### Tabel nou: `review_summaries`
```sql
CREATE TABLE review_summaries (
    id SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    review_count INTEGER NOT NULL,
    last_review_id INTEGER REFERENCES reviews(id),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_used VARCHAR(50),
    UNIQUE(business_id)
);
```

---

## Plan Detaliat - 61 Taskuri

### FAZA 1: Setup și Configurare (8 taskuri)

| # | Task | Descriere | Fișier |
|---|------|-----------|--------|
| 1.1 | Creare cont OpenAI/Anthropic | Înregistrare și obținere API key | - |
| 1.2 | Adăugare API key în .env | `OPENAI_API_KEY=sk-xxx` | `.env` |
| 1.3 | Adăugare API key în Railway | Variabilă de mediu în production | Railway Dashboard |
| 1.4 | Instalare SDK OpenAI | `pip install openai` | `requirements.txt` |
| 1.5 | Creare fișier config LLM | Configurări model, temperatură, max tokens | `app/config/llm_config.py` |
| 1.6 | Creare migration tabel | Tabelul `review_summaries` | `migrations/` |
| 1.7 | Rulare migration local | `alembic upgrade head` | - |
| 1.8 | Rulare migration production | Aplicare în Railway PostgreSQL | - |

### FAZA 2: Model și Repository (10 taskuri)

| # | Task | Descriere | Fișier |
|---|------|-----------|--------|
| 2.1 | Creare model SQLAlchemy | Clasa `ReviewSummary` | `app/models/review_summary.py` |
| 2.2 | Adăugare relație în Business | `business.review_summary` | `app/models/business.py` |
| 2.3 | Creare schema Pydantic response | `ReviewSummaryResponse` | `app/schemas/review_summary.py` |
| 2.4 | Creare schema Pydantic create | `ReviewSummaryCreate` | `app/schemas/review_summary.py` |
| 2.5 | Export în `__init__.py` | Importuri publice | `app/models/__init__.py` |
| 2.6 | Creare repository | `ReviewSummaryRepository` | `app/repositories/review_summary_repository.py` |
| 2.7 | Metodă `get_by_business_id` | Obține summary existent | `app/repositories/review_summary_repository.py` |
| 2.8 | Metodă `create_or_update` | Upsert summary | `app/repositories/review_summary_repository.py` |
| 2.9 | Metodă `needs_regeneration` | Verifică dacă e outdated | `app/repositories/review_summary_repository.py` |
| 2.10 | Metodă `delete_by_business_id` | Șterge summary | `app/repositories/review_summary_repository.py` |

### FAZA 3: Serviciu LLM (15 taskuri)

| # | Task | Descriere | Fișier |
|---|------|-----------|--------|
| 3.1 | Creare folder servicii LLM | Structură organizată | `app/services/llm/` |
| 3.2 | Creare client OpenAI wrapper | Abstractizare API calls | `app/services/llm/openai_client.py` |
| 3.3 | Implementare retry logic | Exponential backoff pentru rate limits | `app/services/llm/openai_client.py` |
| 3.4 | Implementare error handling | Catch și log erori API | `app/services/llm/openai_client.py` |
| 3.5 | Creare prompt template | Template pentru sumarizare | `app/services/llm/prompts.py` |
| 3.6 | Variabile în prompt | Inserare reviews dinamice | `app/services/llm/prompts.py` |
| 3.7 | Prompt în limba română | Localizare output | `app/services/llm/prompts.py` |
| 3.8 | Creare `SummarizationService` | Serviciul principal | `app/services/llm/summarization_service.py` |
| 3.9 | Metodă `format_reviews_for_prompt` | Pregătire text reviews | `app/services/llm/summarization_service.py` |
| 3.10 | Metodă `generate_summary` | Call API și parsare răspuns | `app/services/llm/summarization_service.py` |
| 3.11 | Metodă `should_regenerate` | Logică invalidare cache | `app/services/llm/summarization_service.py` |
| 3.12 | Metodă `get_or_generate_summary` | Entry point principal | `app/services/llm/summarization_service.py` |
| 3.13 | Limitare lungime input | Max 10 reviews, cele mai recente | `app/services/llm/summarization_service.py` |
| 3.14 | Logging apeluri LLM | Track usage și costuri | `app/services/llm/summarization_service.py` |
| 3.15 | Unit tests serviciu | Teste cu mock API | `tests/services/test_summarization.py` |

### FAZA 4: Integrare în Endpoint-uri (12 taskuri)

| # | Task | Descriere | Fișier |
|---|------|-----------|--------|
| 4.1 | Modificare `GET /businesses/{id}` | Include summary în response | `app/routers/businesses.py` |
| 4.2 | Adăugare field în BusinessResponse | `review_summary: Optional[str]` | `app/schemas/business.py` |
| 4.3 | Lazy generation la fetch | Generează dacă lipsește și are 3+ reviews | `app/routers/businesses.py` |
| 4.4 | Creare endpoint dedicat | `GET /businesses/{id}/review-summary` | `app/routers/businesses.py` |
| 4.5 | Endpoint regenerare manuală | `POST /businesses/{id}/review-summary/regenerate` | `app/routers/businesses.py` |
| 4.6 | Restricție admin pentru regenerare | Doar admin poate forța regenerare | `app/routers/businesses.py` |
| 4.7 | Hook la creare review | Invalidează cache când review nou | `app/routers/reviews.py` |
| 4.8 | Hook la ștergere review | Invalidează cache când review șters | `app/routers/reviews.py` |
| 4.9 | Hook la editare review | Invalidează cache când review editat | `app/routers/reviews.py` |
| 4.10 | Background task generation | Async generation să nu blocheze request | `app/routers/businesses.py` |
| 4.11 | Rate limiting endpoint | Max 10 req/min per user | `app/routers/businesses.py` |
| 4.12 | Integration tests | Teste end-to-end | `tests/routers/test_business_summary.py` |

### FAZA 5: Frontend Mobile (12 taskuri)

| # | Task | Descriere | Fișier |
|---|------|-----------|--------|
| 5.1 | Adăugare type în TypeScript | `reviewSummary?: string` în Business | `types/business.ts` |
| 5.2 | Creare component `ReviewSummary` | UI pentru afișare summary | `components/ReviewSummary.tsx` |
| 5.3 | Styling component | Design consistent cu tema | `components/ReviewSummary.tsx` |
| 5.4 | Iconiță AI indicator | Badge "Generat cu AI" | `components/ReviewSummary.tsx` |
| 5.5 | Loading state | Skeleton mientras se încarcă | `components/ReviewSummary.tsx` |
| 5.6 | Error state | Fallback dacă generarea eșuează | `components/ReviewSummary.tsx` |
| 5.7 | Integrare în BusinessDetails | Afișare deasupra listei reviews | `app/business/[id].tsx` |
| 5.8 | Condiție afișare | Doar dacă există și are 3+ reviews | `app/business/[id].tsx` |
| 5.9 | Animație fade-in | Apariție smooth | `components/ReviewSummary.tsx` |
| 5.10 | Expand/collapse | Opțional pentru summary lung | `components/ReviewSummary.tsx` |
| 5.11 | Timestamp afișare | "Actualizat acum 2 zile" | `components/ReviewSummary.tsx` |
| 5.12 | Test pe device | Verificare UI Android | - |

### FAZA 6: Optimizări și Monitoring (4 taskuri)

| # | Task | Descriere | Fișier |
|---|------|-----------|--------|
| 6.1 | Dashboard usage | Track nr. generări, costuri | Admin panel |
| 6.2 | Alertă budget | Notificare când se apropie limita | Make.com/Email |
| 6.3 | A/B test prompt | Testare variante prompt | `app/services/llm/prompts.py` |
| 6.4 | Documentație API | Swagger pentru noul endpoint | `app/routers/businesses.py` |

---

## Prompt Template Recomandat

```python
SUMMARIZATION_PROMPT = """
Analizează următoarele recenzii pentru un business și creează un rezumat concis în limba română.

Business: {business_name}
Categorie: {category}

Recenzii:
{reviews_text}

Instrucțiuni:
1. Rezumatul trebuie să aibă maxim 2-3 propoziții
2. Menționează punctele forte evidențiate de clienți
3. Menționează punctele slabe (dacă există)
4. Folosește un ton neutru și obiectiv
5. NU inventa informații care nu sunt în recenzii

Răspunde DOAR cu rezumatul, fără introduceri sau explicații.
"""
```

---

## Exemplu Output

**Input (3 recenzii)**:
- "Mâncare excelentă, prețuri ok, dar așteptăm mult la comandă" ⭐⭐⭐⭐
- "Cel mai bun burger din oraș! Personal amabil." ⭐⭐⭐⭐⭐
- "Porții mari, locație centrală. Puțin zgomotos." ⭐⭐⭐⭐

**Output LLM**:
> "Clienții apreciază calitatea mâncării, în special burgerii, și porțiile generoase. Personalul este descris ca amabil, iar locația centrală e un plus. Printre aspectele de îmbunătățit: timpul de așteptare și nivelul de zgomot."

---

## Costuri Estimate

| Model | Cost per 1K tokens | Reviews/$ | Recomandare |
|-------|-------------------|-----------|-------------|
| GPT-3.5-turbo | $0.002 | ~5000 | ✅ Recomandat |
| GPT-4 | $0.06 | ~170 | ❌ Prea scump |
| Claude Haiku | $0.00025 | ~40000 | ✅ Cea mai ieftină |
| Claude Sonnet | $0.003 | ~3300 | ⚠️ Opțional |

**Estimare OFAI**:
- 100 business-uri cu 3+ reviews = ~100 generări inițiale
- Cost inițial: ~$0.20 cu GPT-3.5-turbo
- Cost lunar (regenerări): ~$0.05-0.10

---

## Dependențe de Instalat

```bash
# Backend
pip install openai>=1.0.0
# sau pentru Claude
pip install anthropic>=0.18.0
```

```txt
# requirements.txt
openai>=1.0.0
# anthropic>=0.18.0  # alternativ
```

---

## Variabile de Mediu Necesare

```env
# .env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
# sau
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx

# Opțional
LLM_MODEL=gpt-3.5-turbo
LLM_MAX_TOKENS=200
LLM_TEMPERATURE=0.3
```

---

## Timeline Implementare

| Fază | Durată | Dependențe |
|------|--------|------------|
| Faza 1: Setup | 15 min | - |
| Faza 2: Model/Repo | 20 min | Faza 1 |
| Faza 3: Serviciu LLM | 30 min | Faza 2 |
| Faza 4: Endpoints | 25 min | Faza 3 |
| Faza 5: Frontend | 25 min | Faza 4 |
| Faza 6: Optimizări | 15 min | Faza 5 |
| **TOTAL** | **~2 ore** | - |

---

## Checklist Final

- [ ] API key configurat în .env și Railway
- [ ] Migration rulată în production
- [ ] Endpoint funcțional și testat
- [ ] Frontend afișează summary
- [ ] Cache funcționează (nu regenerează la fiecare request)
- [ ] Invalidare cache la review nou
- [ ] Logging pentru tracking costuri
- [ ] Documentație actualizată

---

## Note Importante

1. **Privacy**: Recenziile sunt deja publice, deci nu există probleme GDPR
2. **Rate Limits**: OpenAI are limite - implementează retry cu backoff
3. **Fallback**: Dacă API-ul e down, afișează "Summary indisponibil momentan"
4. **Cache**: Summary-ul se regenerează DOAR când apar recenzii noi
5. **Minimum reviews**: Nu genera pentru < 3 recenzii (nu e reprezentativ)

---

*Document generat pentru proiectul OFAI*
*Data: Februarie 2025*
