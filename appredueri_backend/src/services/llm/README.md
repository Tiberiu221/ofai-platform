# LLM Services - Review Summarization

This folder contains all LLM (Large Language Model) related services for AI-powered review summarization using Claude by Anthropic.

## 📁 File Structure

```
llm/
├── README.md                    # This file
├── anthropicClient.js           # Claude API client with retry logic
├── prompts.js                   # Prompt templates and validation
└── summarizationService.js      # Main summarization orchestration
```

## 🧠 How It Works

### High-Level Flow (Scheduled)

```
1. Railway Cron (la 2 zile, noaptea)
   ↓
2. Scriptul verifică toate business-urile cu 3+ recenzii
   ↓
3. Dacă există review-uri noi VALIDe → regenerează summary
   ↓
4. Dacă nu există review-uri noi → păstrează cache-ul
```

### Cache Strategy

- Summary-urile sunt generate DOAR de batch job (nu la request).
- Dacă business-ul nu are summary încă, frontend-ul afișează nimic.
- Cache-ul se actualizează doar când apar review-uri noi valide.

## 🔑 Configuration

All settings are in `src/config/llm.js`:

| Setting | Default | Description |
|---------|---------|-------------|
| `model` | `claude-3-haiku-20240307` | Claude model to use |
| `maxTokens` | 300 | Max length of generated summary |
| `temperature` | 0.3 | Creativity (0=deterministic, 1=creative) |
| `minReviewCount` | 3 | Minimum reviews needed for summarization |
| `maxReviewsInPrompt` | 10 | Max reviews to include (cost control) |
| `regenerateAfterNewReviews` | 3 | Folosit doar în mod on-demand (în prezent nu e activ) |

## 📝 API Endpoints

### GET `/businesses/:id`
Returns business details with `review_summary` field (cached only).

**Response:**
```json
{
  "id": 123,
  "name": "Burger House",
  "review_summary": {
    "text": "Clienții apreciază burgerii și porțiile generoase...",
    "review_count": 15,
    "generated_at": "2026-02-03T10:30:00Z",
    "is_cached": true
  }
}
```

### GET `/businesses/:id/review-summary`
Dedicated endpoint for getting just the cached summary.

**Success Response (200):**
```json
{
  "business_id": 123,
  "business_name": "Burger House",
  "summary": "Clienții apreciază burgerii și porțiile generoase...",
  "review_count": 15,
  "generated_at": "2026-02-03T10:30:00Z",
  "is_cached": true
}
```

**Error Response - Not Generated Yet (404):**
```json
{
  "error": "Summary not available",
  "message": "Rezumatul nu este încă generat. Se actualizează automat o dată la 2 zile.",
  "schedule_days": 2
}
```

### POST `/businesses/:id/review-summary/regenerate` (Admin Only)
Forces regeneration of summary, bypassing cache.

**Headers Required:**
```
Authorization: Basic YWRtaW46cGFzc3dvcmQ=
```

## ⏱️ Scheduled Batch Job (Railway Cron)

Rulează la fiecare 2 zile (ex: 03:00 AM) și regenerează doar dacă există
review-uri noi valide.

**Command:**
```bash
npm run review-summaries:batch
```

**Optional env vars (Railway Cron):**
```env
REVIEW_SUMMARY_SLEEP_MS=750
REVIEW_SUMMARY_BATCH_LIMIT=0   # 0 = no limit
```

## 💰 Cost Analysis

### Per-Summary Cost (Claude Haiku)

**Typical Summary:**
- Input: ~500 tokens (prompt + 5 reviews)
- Output: ~120 tokens (2-3 sentences)
- Cost: $0.0003 per summary

**Monthly Estimate:**
- 100 businesses with 5+ reviews
- Average 1 regeneration per month per business
- Total cost: ~$0.03/month

### Cost Tracking

All costs are logged and saved:

```javascript
{
  tokens_used: 620,           // Total tokens (input + output)
  cost_usd: 0.000275,         // Calculated cost
  model_used: 'claude-3-haiku-20240307'
}
```

Query total costs:
```sql
SELECT 
  COUNT(*) as total_summaries,
  SUM(tokens_used) as total_tokens,
  SUM(tokens_used) * 0.00000025 as estimated_cost_usd
FROM review_summaries;
```

## 🔄 Retry Logic

The `anthropicClient` implements exponential backoff:

| Attempt | Delay | Scenario |
|---------|-------|----------|
| 1 | 0ms | Initial request |
| 2 | 1000ms (1s) | If rate limit (429) |
| 3 | 2000ms (2s) | If still failing |
| FAIL | - | After 3 attempts |

**Retryable Errors:**
- 429 (Rate Limit Exceeded)
- 500 (Internal Server Error)
- 503 (Service Unavailable)
- ETIMEDOUT / ECONNRESET

**Non-Retryable Errors:**
- 401 (Invalid API Key)
- 400 (Bad Request)
- 404 (Not Found)

## 🧪 Testing Locally

### 1. Get API Key

1. Sign up at: https://console.anthropic.com/
2. Go to API Keys → Create Key
3. Add $5 credit (lasts months!)

### 2. Configure

Add to `.env`:
```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxx
LLM_MODEL=claude-3-haiku-20240307
LLM_MAX_TOKENS=300
LLM_TEMPERATURE=0.3
```

### 3. Apply Migration

```bash
psql $DATABASE_URL -f migrations/create_review_summaries.sql
```

### 4. Run Batch Generation

```bash
npm run review-summaries:batch
```

### 5. Test Endpoints

```bash
# Get business with summary
curl http://localhost:4000/businesses/1

# Get dedicated summary endpoint
curl http://localhost:4000/businesses/1/review-summary

# Force regenerate (admin)
curl -X POST http://localhost:4000/businesses/1/review-summary/regenerate \
  -H "Authorization: Basic $(echo -n 'admin:password' | base64)"
```

### 5. Check Logs

Look for:
```
[LLM] Claude API call successful: {
  attempt: 1,
  duration: '450ms',
  input_tokens: 480,
  output_tokens: 115,
  total_tokens: 595,
  cost: '$0.000274',
  model: 'claude-3-haiku-20240307'
}
```

## 🐛 Troubleshooting

### Error: "ANTHROPIC_API_KEY is not set"

**Solution:** Add API key to `.env` file.

### Error: "Insufficient reviews"

**Normal behavior.** Business needs at least 3 reviews.

### Error: "Rate limit exceeded"

**Solution:** Retry logic will handle this automatically. If persistent:
- Check your Anthropic dashboard for limits
- Consider upgrading tier
- Reduce `maxReviewsInPrompt` to use fewer tokens

### Summary quality is poor

**Solutions:**
1. Increase `temperature` (try 0.5) for more creativity
2. Increase `maxTokens` (try 400) for longer summaries
3. Adjust prompt in `prompts.js`
4. Force regenerate: `POST /businesses/:id/review-summary/regenerate`

## 📊 Monitoring

### Query Active Summaries

```sql
SELECT 
  b.name,
  rs.summary_text,
  rs.review_count,
  rs.generated_at,
  rs.tokens_used
FROM review_summaries rs
JOIN businesses b ON b.id = rs.business_id
ORDER BY rs.generated_at DESC
LIMIT 10;
```

### Query Outdated Summaries

```sql
SELECT 
  b.id,
  b.name,
  rs.review_count as cached_count,
  COUNT(r.id) as current_count,
  COUNT(r.id) - rs.review_count as new_reviews
FROM review_summaries rs
JOIN businesses b ON b.id = rs.business_id
JOIN reviews r ON r.business_id = b.id
GROUP BY b.id, b.name, rs.review_count
HAVING COUNT(r.id) - rs.review_count >= 3
ORDER BY new_reviews DESC;
```

## 🔧 Maintenance

### Regenerate All Summaries

Useful after improving the prompt:

```javascript
// Script: scripts/regenerate-all-summaries.js
const { generateSummary } = require('./src/services/llm/summarizationService');
const pool = require('./src/db');

async function regenerateAll() {
  const result = await pool.query(
    'SELECT DISTINCT business_id FROM review_summaries'
  );
  
  for (const row of result.rows) {
    try {
      await generateSummary(row.business_id, { force: true });
      console.log(`✓ Regenerated summary for business ${row.business_id}`);
    } catch (err) {
      console.error(`✗ Failed for business ${row.business_id}:`, err.message);
    }
  }
}

regenerateAll();
```

## 📚 Learn More

- [Anthropic Claude Documentation](https://docs.anthropic.com/)
- [Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [Token Counting](https://docs.anthropic.com/claude/docs/models-overview#model-comparison)

---

**Questions?** Check the main project documentation or contact the development team.
