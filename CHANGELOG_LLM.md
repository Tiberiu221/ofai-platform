# Changelog - LLM Review Summarization Feature

Toate modificările semnificative pentru feature-ul de sumarizare AI a recenziilor.

---

## [1.0.0] - 2026-02-03

### ✨ Added - Backend

**Dependencies:**
- `@anthropic-ai/sdk` - SDK oficial pentru Claude API

**Config:**
- `src/config/llm.js` - Configurări centralizate LLM (model, temperature, tokens, retry logic)

**Services:**
- `src/services/llm/anthropicClient.js` - Client Claude cu exponential backoff retry
- `src/services/llm/prompts.js` - Template-uri prompt + validare summary
- `src/services/llm/summarizationService.js` - Orchestrator principal (fetch, generate, cache)
- `src/services/llm/README.md` - Documentație tehnică serviciu

**Database:**
- `migrations/create_review_summaries.sql` - Tabel `review_summaries` pentru caching
- `migrations/README.md` - Ghid aplicare migrations

**Environment Variables:**
- `ANTHROPIC_API_KEY` - Cheia API Anthropic
- `LLM_MODEL` - Model Claude (default: claude-3-haiku-20240307)
- `LLM_MAX_TOKENS` - Lungime maximă output (default: 300)
- `LLM_TEMPERATURE` - Creativitate model (default: 0.3)

### 🔄 Changed - Backend

**Routes:**
- `src/routes/businesses.js`:
  - Import `getSummary`, `canSummarize` din summarizationService
  - `GET /businesses/:id` - Adaugă field `review_summary` în response
  - `GET /businesses/:id/review-summary` - Endpoint dedicat pentru summary (NOU)
  - `POST /businesses/:id/review-summary/regenerate` - Admin endpoint pentru regenerare forțată (NOU)

- `src/routes/reviews.js`:
  - Import `invalidateSummary` din summarizationService
  - `POST /reviews` - Invalidează cache summary după salvare review (hook async)

**Environment:**
- `.env.example` - Adăugate variabile LLM cu descrieri

### ✨ Added - Frontend

**Dependencies:**
- `date-fns` - Formatare date/timp pentru UI

**Types:**
- `app/types.ts`:
  - Interface `ReviewSummary` (text, review_count, generated_at, is_cached)
  - Field `review_summary` adăugat în interface `Business`

**Components:**
- `components/ReviewSummary.tsx` - Component vizual pentru afișare summary:
  - Badge "Rezumat AI" cu sparkles icon
  - Text summary cu expand/collapse pentru text lung (>150 chars)
  - Timestamp "Actualizat acum X" (folosește date-fns)
  - Indicator cached (flash icon verde)
  - Design modern cu shadows și borders

**Pages:**
- `app/business/[id].tsx`:
  - Import `ReviewSummary` component
  - Afișare `<ReviewSummary>` între secțiunea Locations și Reviews
  - Conditional rendering (doar dacă `business.review_summary` există)

### 📚 Documentation

**Root Level:**
- `LLM_INTEGRATION_GUIDE.md` - Ghid complet:
  - Arhitectură și flow-uri
  - Setup pas-cu-pas (local + production)
  - Testing scenarios (5 teste detaliate)
  - Cost analysis și monitoring
  - Troubleshooting common issues
  - Maintenance tasks
  - Concepte LLM învățate
  - Resurse suplimentare

- `CHANGELOG_LLM.md` - Acest fișier (change tracking)

---

## Database Schema Changes

### New Table: `review_summaries`

```sql
CREATE TABLE review_summaries (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    review_count INTEGER NOT NULL DEFAULT 0,
    last_review_id INTEGER REFERENCES reviews(id) ON DELETE SET NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    model_used VARCHAR(50) DEFAULT 'claude-3-haiku-20240307',
    tokens_used INTEGER,
    UNIQUE(business_id)
);

-- Indexes
CREATE INDEX idx_review_summaries_business_id ON review_summaries(business_id);
CREATE INDEX idx_review_summaries_generated_at ON review_summaries(generated_at);
```

**Purpose:** Cache AI-generated summaries pentru a minimiza costuri API.

**Relationships:**
- `business_id` → `businesses(id)` (CASCADE delete)
- `last_review_id` → `reviews(id)` (SET NULL on delete)

---

## API Changes

### Modified Endpoints

#### `GET /businesses/:id`

**Before:**
```json
{
  "id": 1,
  "name": "Business Name",
  "rating": 4.5,
  ...
}
```

**After:**
```json
{
  "id": 1,
  "name": "Business Name",
  "rating": 4.5,
  "review_summary": {
    "text": "Clienții apreciază...",
    "review_count": 5,
    "generated_at": "2026-02-03T10:30:00Z",
    "is_cached": true
  },
  ...
}
```

**Notes:**
- `review_summary` e `null` dacă business-ul are < 3 reviews
- Summary se generează lazy la primul request
- Erori AI nu blochează response-ul (graceful degradation)

### New Endpoints

#### `GET /businesses/:id/review-summary`

Endpoint dedicat pentru obținerea doar a summary-ului.

**Response (200 OK):**
```json
{
  "business_id": 1,
  "business_name": "Burger House",
  "summary": "Clienții apreciază burgerii și porțiile generoase...",
  "review_count": 5,
  "generated_at": "2026-02-03T10:30:00Z",
  "is_cached": true,
  "metadata": {
    "tokens_used": 550,
    "cost_usd": 0.000275
  }
}
```

**Error Responses:**

400 - Insufficient reviews:
```json
{
  "error": "Insufficient reviews",
  "message": "Business needs at least 3 reviews for summarization.",
  "current_count": 1,
  "missing": 2
}
```

404 - Business not found:
```json
{
  "error": "Business not found"
}
```

500 - API Error:
```json
{
  "error": "RATE_LIMIT",
  "message": "Sistem temporar suprasolicitat. Încercați din nou în câteva minute."
}
```

#### `POST /businesses/:id/review-summary/regenerate`

Admin-only endpoint pentru regenerare forțată (bypass cache).

**Authentication:** Required (Basic Auth cu admin credentials)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Summary regenerated successfully",
  "business_id": 1,
  "business_name": "Burger House",
  "summary": "Clienții apreciază...",
  "review_count": 5,
  "generated_at": "2026-02-03T11:00:00Z",
  "metadata": {
    "tokens_used": 550,
    "cost_usd": 0.000275
  }
}
```

---

## Performance Impact

### Cost Analysis

**Per-summary generation:**
- Input: ~500 tokens (prompt + reviews)
- Output: ~120 tokens (summary)
- **Cost: ~$0.0003 per summary**

**Monthly estimate (100 businesses, 2 new reviews/month each):**
- 200 regenerations
- **Total: ~$0.06/month** 🎉

### Latency

**First request (generation):**
- DB queries: ~50ms
- Claude API call: ~400-800ms
- Total: **~500-900ms**

**Subsequent requests (cache hit):**
- DB query: ~20ms
- Total: **~20ms** (25x faster!)

### Database Impact

**New table size estimate:**
- 100 businesses: ~50KB (500 bytes/row)
- 1000 businesses: ~500KB
- **Minimal impact**

---

## Breaking Changes

Nicio modificare breaking. Toate schimbările sunt backwards compatible:
- Endpoint-uri existente păstrează funcționalitatea
- Field nou `review_summary` e optional (poate fi `null`)
- Frontend backward compatible (componenta nou nu afectează UI existent)

---

## Security Considerations

### API Key Protection

✅ **Implemented:**
- API key stocat în `.env` (NOT committed)
- Validare API key la startup (throw error dacă lipsește)
- API key transmis prin header (nu în URL/body)

### Rate Limiting

✅ **Implemented:**
- Exponential backoff pentru retry (previne spam API)
- Cache agresiv (reduce număr requests)
- Admin-only pentru regenerare forțată

### Data Privacy

✅ **Considered:**
- Recenziile sunt deja publice (no GDPR issues)
- Summary-urile sunt agregări (no PII)
- Nu stocăm date personale în summaries

---

## Testing Checklist

- [x] Unit tests: prompts validation
- [x] Unit tests: cost calculation
- [x] Integration: Cache hit/miss scenarios
- [x] Integration: Cache invalidation on new review
- [x] E2E: Full flow (generate → cache → invalidate → regenerate)
- [ ] Load test: 100 concurrent requests
- [ ] Cost monitoring: Track spending first week
- [ ] User acceptance: Gather feedback pe summary quality

---

## Rollback Plan

Dacă feature-ul trebuie dezactivat:

### Backend Rollback

```bash
# 1. Revert route changes
git checkout HEAD~1 src/routes/businesses.js
git checkout HEAD~1 src/routes/reviews.js

# 2. Șterge servicii LLM (optional)
rm -rf src/services/llm/
rm src/config/llm.js

# 3. Drop tabel (ATENȚIE: pierdere date!)
psql $DATABASE_URL -c "DROP TABLE review_summaries CASCADE;"

# 4. Uninstall SDK
npm uninstall @anthropic-ai/sdk

# 5. Redeploy
```

### Frontend Rollback

```bash
# 1. Remove component import
# În app/business/[id].tsx, șterge:
# - import ReviewSummary
# - <ReviewSummary> rendering

# 2. Revert types (optional)
git checkout HEAD~1 app/types.ts

# 3. Uninstall date-fns (optional dacă nu e folosit în altă parte)
npm uninstall date-fns
```

---

## Future Enhancements (Roadmap)

### v1.1.0 (Next Release)
- [ ] A/B testing framework pentru prompt variants
- [ ] Admin dashboard pentru monitoring costuri
- [ ] Email alerts când costuri > threshold
- [ ] Bulk regenerate script pentru prompt improvements

### v1.2.0
- [ ] Sentiment analysis per review (pozitiv/negativ/neutru)
- [ ] Multi-language support (EN, FR, etc.)
- [ ] Category-specific prompts (restaurante vs saloane)
- [ ] Trending topics extraction

### v2.0.0
- [ ] Fine-tuned model pe review-uri românești
- [ ] Predictive ratings (AI prezice trend-ul)
- [ ] Competitor comparison (auto-benchmark)
- [ ] Auto-response la review-uri negative

---

## Contributors

- **Claude (Sonnet 4.5)** - AI Assistant & Implementation Guide
- **Tiber** - Product Owner & Integration

---

## References

- [Anthropic Claude API Docs](https://docs.anthropic.com/)
- [Prompt Engineering Best Practices](https://www.promptingguide.ai/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

**Version:** 1.0.0  
**Release Date:** 2026-02-03  
**Status:** ✅ Production Ready
