/**
 * LLM Prompt Templates for Review Summarization
 * 
 * This module contains carefully crafted prompts for generating
 * high-quality review summaries in Romanian.
 */

/**
 * System prompt that defines Claude's role and behavior
 * This sets the "personality" and expertise of the AI
 */
const SYSTEM_PROMPT = `Ești un asistent AI expert în analiza recenziilor pentru o platformă de reduceri și oferte din România (AppReduceri/OFAI).

Sarcina ta este să creezi rezumate obiective și utile ale recenziilor clienților pentru diferite business-uri (restaurante, cafenele, saloane, etc.).

Principii importante:
- Ești OBIECTIV și echilibrat - menționezi atât aspecte pozitive, cât și negative
- Ești CONCIS - rezumatele tale sunt scurte și la obiect
- Ești PRECIS - te bazezi DOAR pe informațiile din recenzii, nu inventezi
- Ești în limba ROMÂNĂ - scrii natural și corect gramatical
- Ești UTIL pentru potențiali clienți - evidențiezi ce contează pentru ei`;

/**
 * Creates a user prompt for summarizing reviews
 * 
 * @param {Object} params - Prompt parameters
 * @param {string} params.businessName - Name of the business
 * @param {string} params.businessCategory - Category (e.g., "Restaurant", "Cafenea")
 * @param {Array<Object>} params.reviews - Array of review objects
 * @param {number} params.reviews[].rating - Rating (1-5)
 * @param {string} params.reviews[].comment - Review comment
 * @param {string} [params.reviews[].userName] - Reviewer name (optional)
 * @returns {string} Formatted prompt
 * 
 * @example
 * const prompt = createSummarizationPrompt({
 *   businessName: "Burger House",
 *   businessCategory: "Restaurant",
 *   reviews: [
 *     { rating: 5, comment: "Cel mai bun burger!" },
 *     { rating: 4, comment: "Mâncare bună, dar așteptare lungă" }
 *   ]
 * });
 */
function createSummarizationPrompt({ businessName, businessCategory, reviews }) {
  // Format reviews for the prompt
  const formattedReviews = reviews
    .map((review, index) => {
      const stars = '⭐'.repeat(review.rating);
      const userName = review.userName ? ` (${review.userName})` : '';
      return `${index + 1}. ${stars} ${review.rating}/5${userName}\n   "${review.comment}"`;
    })
    .join('\n\n');
  
  // Calculate average rating
  const avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
  
  return `Analizează următoarele ${reviews.length} recenzii pentru un business și creează un rezumat concis.

**Business:** ${businessName}
**Categorie:** ${businessCategory}
**Rating mediu:** ${avgRating}/5 (din ${reviews.length} recenzii)

**Recenzii:**

${formattedReviews}

---

**Instrucțiuni de formatare:**

1. Creează un rezumat de MAXIM 3 propoziții (2-3 rânduri)
2. Prima parte: menționează punctele FORTE evidențiate de clienți
3. A doua parte: menționează punctele SLABE sau aspecte de îmbunătățit (dacă există)
4. Folosește un ton neutru și profesional
5. Menționează detalii concrete din recenzii (de ex: "burgerii", "serviciul rapid", "prețurile accesibile")
6. NU folosi cuvinte exagerate ("excepțional", "extraordinar") - rămâi obiectiv
7. NU adăuga introduceri precum "În general" sau "Recenzenții spun" - mergi direct la esență
8. NU inventa informații care nu apar în recenzii

**Format dorit:**
Două-trei propoziții clare, separate prin punct. Prima propoziție despre aspecte pozitive, următoarele despre negative (dacă există) sau detalii suplimentare.

**Răspunde DOAR cu rezumatul (fără alte texte sau explicații).**`;
}

/**
 * Creates a prompt for updating an existing summary with new reviews
 * (Can be used for incremental updates to save tokens)
 * 
 * @param {string} existingSummary - The current summary
 * @param {Array<Object>} newReviews - New reviews to incorporate
 * @returns {string} Formatted prompt
 */
function createUpdateSummarizationPrompt(existingSummary, newReviews) {
  const formattedNewReviews = newReviews
    .map((review, index) => {
      const stars = '⭐'.repeat(review.rating);
      return `${index + 1}. ${stars} ${review.rating}/5\n   "${review.comment}"`;
    })
    .join('\n\n');
  
  return `Ai generat anterior următorul rezumat de recenzii:

"${existingSummary}"

Au apărut ${newReviews.length} recenzii noi:

${formattedNewReviews}

---

Actualizează rezumatul ținând cont de noile recenzii. Păstrează același format (maxim 3 propoziții, concis, obiectiv).

**Răspunde DOAR cu rezumatul actualizat.**`;
}

/**
 * Validates a generated summary to ensure it meets quality standards
 * 
 * @param {string} summary - The generated summary
 * @returns {Object} Validation result
 */
function validateSummary(summary) {
  const issues = [];
  
  // Check if empty
  if (!summary || summary.trim().length === 0) {
    issues.push('Summary is empty');
  }
  
  // Check minimum length (should be at least 50 characters)
  if (summary.length < 50) {
    issues.push('Summary is too short (< 50 characters)');
  }
  
  // Check maximum length (should not exceed 500 characters)
  if (summary.length > 500) {
    issues.push('Summary is too long (> 500 characters)');
  }
  
  // Check for forbidden phrases (indicating AI didn't follow instructions)
  const forbiddenPhrases = [
    'în general',
    'în concluzie',
    'recenzenții spun',
    'conform recenziilor',
    'după cum se poate vedea',
    'în rezumat'
  ];
  
  const lowerSummary = summary.toLowerCase();
  forbiddenPhrases.forEach(phrase => {
    if (lowerSummary.includes(phrase)) {
      issues.push(`Contains forbidden phrase: "${phrase}"`);
    }
  });
  
  // Check for minimum sentence count (at least 1 complete sentence)
  const sentenceCount = summary.split(/[.!?]+/).filter(s => s.trim().length > 10).length;
  if (sentenceCount === 0) {
    issues.push('No complete sentences found');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    summary: summary.trim()
  };
}

module.exports = {
  SYSTEM_PROMPT,
  createSummarizationPrompt,
  createUpdateSummarizationPrompt,
  validateSummary
};
