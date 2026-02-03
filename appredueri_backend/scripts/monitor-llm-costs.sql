-- ================================================
-- LLM Cost Monitoring Queries
-- ================================================

-- 1. TOTAL COSTS & USAGE (All time)
SELECT 
  COUNT(*) as total_summaries,
  SUM(tokens_used) as total_tokens,
  ROUND(SUM(tokens_used) * 0.00000025, 6) as input_cost_usd,
  ROUND(SUM(tokens_used) * 0.00000125 * 0.3, 6) as output_cost_usd,
  ROUND(SUM(tokens_used) * 0.00000025 + SUM(tokens_used) * 0.00000125 * 0.3, 6) as total_cost_usd
FROM review_summaries;

-- Expected output:
-- total_summaries | total_tokens | input_cost_usd | output_cost_usd | total_cost_usd
-- 45              | 25000        | 0.006250       | 0.009375        | 0.015625

-- ================================================

-- 2. COSTS PER DAY (Last 7 days)
SELECT 
  DATE(generated_at) as date,
  COUNT(*) as summaries_generated,
  SUM(tokens_used) as tokens,
  ROUND(SUM(tokens_used) * 0.00000025 + SUM(tokens_used) * 0.00000125 * 0.3, 6) as cost_usd
FROM review_summaries
WHERE generated_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(generated_at)
ORDER BY date DESC;

-- ================================================

-- 3. COSTS PER MONTH (Current + Last month)
SELECT 
  TO_CHAR(generated_at, 'YYYY-MM') as month,
  COUNT(*) as summaries_generated,
  SUM(tokens_used) as tokens,
  ROUND(SUM(tokens_used) * 0.00000025 + SUM(tokens_used) * 0.00000125 * 0.3, 6) as cost_usd
FROM review_summaries
WHERE generated_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
GROUP BY TO_CHAR(generated_at, 'YYYY-MM')
ORDER BY month DESC;

-- ================================================

-- 4. TOP 10 MOST EXPENSIVE SUMMARIES (by tokens)
SELECT 
  b.name as business_name,
  rs.review_count,
  rs.tokens_used,
  ROUND(rs.tokens_used * 0.00000025 + rs.tokens_used * 0.00000125 * 0.3, 6) as cost_usd,
  rs.generated_at
FROM review_summaries rs
JOIN businesses b ON b.id = rs.business_id
ORDER BY rs.tokens_used DESC
LIMIT 10;

-- ================================================

-- 5. AVERAGE TOKENS PER SUMMARY
SELECT 
  ROUND(AVG(tokens_used), 0) as avg_tokens,
  MIN(tokens_used) as min_tokens,
  MAX(tokens_used) as max_tokens,
  ROUND(AVG(tokens_used) * 0.00000025 + AVG(tokens_used) * 0.00000125 * 0.3, 6) as avg_cost_usd
FROM review_summaries;

-- ================================================

-- 6. CACHE HIT RATE (aproximativ - bazat pe duplicates)
-- Compară: total requests vs unique businesses cu summaries
WITH request_estimate AS (
  SELECT 
    COUNT(*) as unique_businesses,
    -- Estimăm ~10 requests per business (în medie)
    COUNT(*) * 10 as estimated_total_requests
  FROM review_summaries
)
SELECT 
  unique_businesses,
  estimated_total_requests,
  ROUND(((estimated_total_requests - unique_businesses)::NUMERIC / estimated_total_requests) * 100, 2) as cache_hit_rate_percent,
  ROUND(unique_businesses * 0.0003, 6) as cost_without_cache_usd,
  ROUND(unique_businesses * 0.0003 * 0.1, 6) as cost_with_cache_usd,
  ROUND(unique_businesses * 0.0003 * 0.9, 6) as savings_usd
FROM request_estimate;

-- ================================================

-- 7. OUTDATED SUMMARIES (Need regeneration)
SELECT 
  b.id,
  b.name,
  rs.review_count as cached_reviews,
  COUNT(r.id) as current_reviews,
  COUNT(r.id) - rs.review_count as new_reviews,
  rs.generated_at,
  EXTRACT(DAY FROM NOW() - rs.generated_at) as days_old
FROM review_summaries rs
JOIN businesses b ON b.id = rs.business_id
LEFT JOIN reviews r ON r.business_id = b.id
GROUP BY b.id, b.name, rs.review_count, rs.generated_at
HAVING COUNT(r.id) - rs.review_count >= 3
ORDER BY new_reviews DESC;

-- ================================================

-- 8. MODEL USAGE BREAKDOWN
SELECT 
  model_used,
  COUNT(*) as summaries_count,
  SUM(tokens_used) as total_tokens,
  ROUND(SUM(tokens_used) * 0.00000025 + SUM(tokens_used) * 0.00000125 * 0.3, 6) as cost_usd
FROM review_summaries
GROUP BY model_used
ORDER BY summaries_count DESC;

-- ================================================

-- 9. BUSINESSES WITHOUT SUMMARIES (but have 3+ reviews)
SELECT 
  b.id,
  b.name,
  COUNT(r.id) as review_count
FROM businesses b
JOIN reviews r ON r.business_id = b.id
LEFT JOIN review_summaries rs ON rs.business_id = b.id
WHERE rs.id IS NULL
GROUP BY b.id, b.name
HAVING COUNT(r.id) >= 3
ORDER BY review_count DESC;

-- ================================================

-- 10. PROJECTED MONTHLY COST
-- Bazat pe media zilnică din ultimele 7 zile
WITH daily_avg AS (
  SELECT 
    COALESCE(AVG(daily_cost), 0) as avg_daily_cost
  FROM (
    SELECT 
      DATE(generated_at) as date,
      SUM(tokens_used) * 0.00000025 + SUM(tokens_used) * 0.00000125 * 0.3 as daily_cost
    FROM review_summaries
    WHERE generated_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY DATE(generated_at)
  ) daily_costs
)
SELECT 
  ROUND(avg_daily_cost, 6) as avg_daily_cost_usd,
  ROUND(avg_daily_cost * 30, 6) as projected_monthly_cost_usd,
  CASE 
    WHEN avg_daily_cost * 30 < 5 THEN 'Very Low ✅'
    WHEN avg_daily_cost * 30 < 20 THEN 'Low ✅'
    WHEN avg_daily_cost * 30 < 50 THEN 'Moderate ⚠️'
    ELSE 'High ⚠️⚠️'
  END as cost_level
FROM daily_avg;

-- ================================================
-- END OF MONITORING QUERIES
-- ================================================

-- QUICK USAGE:
-- psql $DATABASE_URL -f scripts/monitor-llm-costs.sql
