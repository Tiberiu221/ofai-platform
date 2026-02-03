/**
 * A/B Test Script for Prompt Variants
 * 
 * Compares multiple prompt versions to find the best one.
 * 
 * Usage: node scripts/ab-test-prompts.js
 */

require('dotenv').config();
const { callClaudeWithRetry } = require('../src/services/llm/anthropicClient');
const { SYSTEM_PROMPT } = require('../src/services/llm/prompts');
const pool = require('../src/db');

// Define prompt variants to test
const PROMPT_VARIANTS = {
  original: (reviews, businessName) => `
Analizează următoarele recenzii pentru ${businessName} și creează un rezumat concis.

Recenzii:
${reviews}

Instrucțiuni:
- Maxim 2-3 propoziții
- Menționează puncte forte și slabe
- Ton neutru
`,

  detailed: (reviews, businessName) => `
Creează un rezumat profesional al recenziilor pentru ${businessName}.

Recenzii:
${reviews}

Structură OBLIGATORIE:
1. Prima propoziție: Top 2-3 lucruri apreciate de clienți (concrete!)
2. A doua propoziție: Aspecte de îmbunătățit (dacă există)

Reguli:
- Folosește detalii SPECIFICE din recenzii
- NU folosești cuvinte generice ("bun", "ok")
- NU inventezi informații
- Maxim 150 tokeni
`,

  concise: (reviews, businessName) => `
${businessName} - Rezumat recenzii:

${reviews}

Output: 2 propoziții scurte (max 20 cuvinte fiecare):
1. Ce e APRECIAT
2. Ce e CRITICAT

Folosește doar info din reviews. Natural, românește.
`,
};

async function testPromptVariant(variantName, promptFn, businessId) {
  console.log(`\n📝 Testing variant: ${variantName}`);
  console.log('─'.repeat(50));
  
  try {
    // Fetch reviews
    const reviewsResult = await pool.query(`
      SELECT r.rating, r.comment, u.first_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.business_id = $1
      ORDER BY r.created_at DESC
      LIMIT 5
    `, [businessId]);
    
    if (reviewsResult.rows.length === 0) {
      console.log('❌ No reviews found for this business');
      return null;
    }
    
    // Fetch business name
    const bizResult = await pool.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
    const businessName = bizResult.rows[0]?.name || 'Business';
    
    // Format reviews
    const reviewsText = reviewsResult.rows
      .map((r, i) => `${i + 1}. ${'⭐'.repeat(r.rating)} "${r.comment}"`)
      .join('\n');
    
    // Generate prompt
    const userPrompt = promptFn(reviewsText, businessName);
    
    // Call API
    const startTime = Date.now();
    const response = await callClaudeWithRetry({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 200,
      temperature: 0.3
    });
    const duration = Date.now() - startTime;
    
    const summary = response.content[0].text.trim();
    
    // Stats
    const wordCount = summary.split(/\s+/).length;
    const sentenceCount = summary.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    
    console.log('✅ Generated summary:');
    console.log(`"${summary}"`);
    console.log('');
    console.log('📊 Stats:');
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);
    console.log(`   Cost: $${response.metadata.cost_usd.toFixed(6)}`);
    console.log(`   Words: ${wordCount}`);
    console.log(`   Sentences: ${sentenceCount}`);
    console.log(`   Chars: ${summary.length}`);
    
    return {
      variant: variantName,
      summary,
      duration,
      tokens: response.usage.input_tokens + response.usage.output_tokens,
      cost: response.metadata.cost_usd,
      wordCount,
      sentenceCount,
      charCount: summary.length
    };
    
  } catch (error) {
    console.error(`❌ Error testing ${variantName}:`, error.message);
    return null;
  }
}

async function runABTest() {
  console.log('🧪 Starting A/B Test for Prompt Variants\n');
  
  // Get a business with reviews
  const bizResult = await pool.query(`
    SELECT b.id, b.name, COUNT(r.id) as review_count
    FROM businesses b
    JOIN reviews r ON r.business_id = b.id
    GROUP BY b.id, b.name
    HAVING COUNT(r.id) >= 3
    ORDER BY review_count DESC
    LIMIT 1
  `);
  
  if (bizResult.rows.length === 0) {
    console.log('❌ No businesses with 3+ reviews found');
    process.exit(1);
  }
  
  const business = bizResult.rows[0];
  console.log(`🏢 Testing with: ${business.name} (${business.review_count} reviews)\n`);
  
  const results = [];
  
  // Test each variant
  for (const [name, promptFn] of Object.entries(PROMPT_VARIANTS)) {
    const result = await testPromptVariant(name, promptFn, business.id);
    if (result) results.push(result);
    
    // Wait 1s between requests (rate limiting)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary comparison
  console.log('\n' + '='.repeat(50));
  console.log('📊 COMPARISON SUMMARY');
  console.log('='.repeat(50) + '\n');
  
  console.log('Variant      | Words | Sentences | Tokens | Cost      | Duration');
  console.log('─'.repeat(70));
  results.forEach(r => {
    console.log(
      `${r.variant.padEnd(12)} | ${String(r.wordCount).padEnd(5)} | ` +
      `${String(r.sentenceCount).padEnd(9)} | ${String(r.tokens).padEnd(6)} | ` +
      `$${r.cost.toFixed(6)} | ${r.duration}ms`
    );
  });
  
  console.log('\n💡 Recommendation:');
  console.log('   Read all summaries above and choose the one that:');
  console.log('   1. Sounds most natural and useful');
  console.log('   2. Is concise but informative');
  console.log('   3. Uses specific details from reviews');
  console.log('   4. Has appropriate length (not too short/long)');
  
  console.log('\n🔧 To apply winner:');
  console.log('   1. Copy winning prompt to src/services/llm/prompts.js');
  console.log('   2. Replace createSummarizationPrompt function');
  console.log('   3. Test with: curl -X POST .../review-summary/regenerate');
  
  await pool.end();
}

runABTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
