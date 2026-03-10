/**
 * AI Review Response Suggestions (Premium-only)
 *
 * Generates 3 response suggestions (professional, friendly, empathetic)
 * for a business owner to reply to a customer review.
 */

const { callClaudeWithRetry, formatError } = require('./anthropicClient');

const SYSTEM_PROMPT = `Ești un asistent AI care ajută proprietarii de afaceri din România să răspundă la recenziile clienților.

Reguli:
- Scrie în română, natural și fără greșeli
- Fiecare răspuns: maxim 400 caractere
- Nu inventa fapte despre afacere
- Nu promite reduceri sau compensații
- Fii specific la comentariul clientului, nu generic
- Folosește numele clientului dacă e disponibil
- La recenzii negative: recunoaște problema, nu fi defensiv

Returnează EXACT 3 răspunsuri în format JSON:
{"suggestions":["raspuns_profesional","raspuns_prietenos","raspuns_empatic"]}

Tonuri:
1. Profesional — formal, concis, orientat pe soluții
2. Prietenos — cald, conversațional, cu personalitate
3. Empatic — înțelegător, centrat pe client, recunoscător`;

/**
 * Generate 3 AI response suggestions for a review
 * @param {Object} data
 * @param {number} data.rating - Review rating (1-5)
 * @param {string} data.comment - Review text
 * @param {string} data.businessName - Name of the business
 * @param {string} [data.businessCategory] - Business category
 * @param {string} [data.customerName] - Reviewer's name
 * @returns {Promise<{suggestions: string[]}>}
 */
async function generateReviewSuggestions(data) {
  const { rating, comment, businessName, businessCategory, customerName } = data;

  const stars = '⭐'.repeat(rating);
  const userPrompt = [
    `Afacere: ${businessName}${businessCategory ? ` (${businessCategory})` : ''}`,
    `Recenzie: ${stars} (${rating}/5)`,
    customerName ? `Client: ${customerName}` : null,
    `Comentariu: "${comment}"`,
    '',
    'Generează 3 răspunsuri (profesional, prietenos, empatic) în format JSON.',
  ].filter(Boolean).join('\n');

  const response = await callClaudeWithRetry({
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
    max_tokens: 600,
    temperature: 0.7,
  });

  const text = response.content[0].text.trim();

  // Parse JSON from response (handle markdown code blocks)
  let parsed;
  try {
    const jsonMatch = text.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    parsed = JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    console.error('[LLM] Failed to parse review suggestions:', text);
    throw new Error('Eroare la procesarea sugestiilor AI');
  }

  if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length < 3) {
    console.error('[LLM] Invalid suggestions format:', parsed);
    throw new Error('Format sugestii invalid');
  }

  // Trim to 3 suggestions, enforce 400 char limit
  const suggestions = parsed.suggestions.slice(0, 3).map(s =>
    typeof s === 'string' ? s.substring(0, 400) : ''
  );

  return {
    suggestions,
    metadata: response.metadata,
  };
}

module.exports = { generateReviewSuggestions };
