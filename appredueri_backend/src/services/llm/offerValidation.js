/**
 * Offer Validation Pipeline
 *
 * Two-pass validation for user-created offers:
 * Pass 1: Programmatic checks (instant, free)
 * Pass 2: Claude Haiku text analysis (~$0.0003/call)
 *
 * Modeled after businessValidation.js
 */

const { callClaudeWithRetry, formatError } = require("./anthropicClient");
const { LLM_CONFIG } = require("../../config/llm");

// Thresholds for auto-moderation
const SCORE_AUTO_APPROVE = 70;
const SCORE_PENDING_REVIEW = 40;
// Below SCORE_PENDING_REVIEW = auto_reject

/**
 * Pass 1: Programmatic validation (instant, no AI cost)
 */
function programmaticChecks(offerData, businessData) {
  const flags = [];
  const checks = {};

  const { title, description, discountType, discountValue, startDate, endDate } = offerData;

  // 1. Title quality
  const trimmedTitle = (title || "").trim();
  checks.titleLength = trimmedTitle.length;
  if (trimmedTitle.length < 3) {
    flags.push("title_too_short");
  }
  if (trimmedTitle.length > 0 && trimmedTitle === trimmedTitle.toUpperCase() && trimmedTitle.length > 5) {
    flags.push("title_all_caps");
  }
  // Repetitive characters pattern (e.g., "aaaa", "!!!!")
  if (/(.)\1{4,}/.test(trimmedTitle)) {
    flags.push("spam_title");
  }

  // 2. Unrealistic discount
  if (discountType === "percentage" && discountValue != null) {
    checks.discountValue = discountValue;
    if (discountValue > 95) {
      flags.push("unrealistic_discount");
    } else if (discountValue <= 0) {
      flags.push("invalid_discount");
    }
  }

  // 3. Date validity
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationDays = (end - start) / (1000 * 60 * 60 * 24);
    checks.durationDays = Math.round(durationDays);

    if (durationDays > 365) {
      flags.push("suspicious_duration");
    }
    if (end < start) {
      flags.push("invalid_dates");
    }
  }

  // 4. Minimal content
  const trimmedDesc = (description || "").trim();
  checks.descriptionLength = trimmedDesc.length;
  if (trimmedDesc.length > 0 && trimmedDesc.length < 10) {
    flags.push("minimal_content");
  }

  // 5. Lorem ipsum / test content detection
  const combined = `${trimmedTitle} ${trimmedDesc}`.toLowerCase();
  if (combined.includes("lorem ipsum") || combined.includes("test test") || combined.includes("asdasd")) {
    flags.push("test_content");
  }

  return { programmaticFlags: flags, checks };
}

/**
 * Pass 2: Claude Haiku text analysis
 */
async function aiAnalysis(offerData, businessData, pass1Results) {
  if (!LLM_CONFIG.apiKey) {
    return {
      score: null,
      flags: ["ai_unavailable"],
      reasoning: "AI validation unavailable — ANTHROPIC_API_KEY not configured."
    };
  }

  const systemPrompt = `Ești un moderator de conținut pentru o platformă de oferte și reduceri din România.
Analizează datele ofertei și determină cât de legitimă pare.

Primești:
- Datele ofertei (titlu, descriere, tip discount, valoare, condiții)
- Datele business-ului (nume, categorie)
- Rezultatele verificărilor automate

Verifică:
1. Titlu: e clar și relevant? Sau spam/generic? ("Test", "asdf", "OFERTA!!!!")
2. Descriere: text coerent sau copy-paste/lorem ipsum/spam?
3. Categorie-ofertă relevanță: un Restaurant cu "Schimb cauciucuri -50%" = suspect
4. Discount plauzibil: are sens economic? (99% reducere e nerealist în general)
5. Consistență generală: datele se potrivesc între ele?

Returnează STRICT JSON (fără altceva, fără markdown):
{
  "score": <0-100>,
  "flags": ["flag1", "flag2"],
  "reasoning": "Explicație scurtă pentru admin (2-3 propoziții)"
}

Score guide:
- 80-100: Ofertă legitimă, date coerente
- 50-79: Probabil OK dar conținut slab sau minore probleme
- 20-49: Suspect — spam, inconsistențe, sau date invalide
- 0-19: Foarte probabil spam/fake

Flags posibile: spam_content, category_mismatch, unrealistic_offer, low_quality_text, suspicious_pattern, misleading_price`;

  const userMessage = `Date ofertă:
- Titlu: ${offerData.title || "N/A"}
- Descriere: ${offerData.description || "Fără descriere"}
- Tip discount: ${offerData.discountType || "Nespecificat"}
- Valoare discount: ${offerData.discountValue || "N/A"}
- Condiții: ${offerData.conditions || "Nespecificate"}
- Perioadă: ${offerData.startDate || "?"} - ${offerData.endDate || "?"}

Business:
- Nume: ${businessData.name || "N/A"}
- Categorie: ${businessData.categoryName || "Nespecificată"}

Verificări automate:
- Lungime titlu: ${pass1Results.checks.titleLength} caractere
- Lungime descriere: ${pass1Results.checks.descriptionLength} caractere
- Durată ofertă: ${pass1Results.checks.durationDays ?? "N/A"} zile
- Flags programatice: ${pass1Results.programmaticFlags.length > 0 ? pass1Results.programmaticFlags.join(", ") : "Niciuna"}`;

  try {
    const response = await callClaudeWithRetry({
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      max_tokens: 300,
      temperature: 0.2
    });

    const text = response.content[0].text.trim();

    let parsed;
    try {
      const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("[OfferValidation] Failed to parse AI response:", text);
      return {
        score: null,
        flags: ["ai_parse_error"],
        reasoning: "AI response could not be parsed: " + text.slice(0, 200)
      };
    }

    return {
      score: typeof parsed.score === "number" ? Math.min(100, Math.max(0, Math.round(parsed.score))) : null,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.slice(0, 500) : ""
    };
  } catch (err) {
    const formatted = formatError(err);
    console.error("[OfferValidation] AI analysis failed:", formatted.message);
    return {
      score: null,
      flags: ["ai_unavailable"],
      reasoning: `AI validation failed: ${formatted.userMessage}`
    };
  }
}

/**
 * Combine Pass 1 + Pass 2 results into final score + moderation action
 */
function combineResults(pass1, pass2) {
  const allFlags = [...new Set([...pass1.programmaticFlags, ...pass2.flags])];

  // If AI was unavailable, auto-approve with flag (don't block business)
  if (pass2.score === null) {
    return {
      score: null,
      flags: allFlags,
      reasoning: pass2.reasoning,
      checks: pass1.checks,
      action: "auto_approve"
    };
  }

  // Apply penalties from programmatic checks
  let penalty = 0;
  if (allFlags.includes("unrealistic_discount")) penalty += 30;
  if (allFlags.includes("spam_title")) penalty += 20;
  if (allFlags.includes("test_content")) penalty += 25;
  if (allFlags.includes("title_too_short")) penalty += 15;
  if (allFlags.includes("title_all_caps")) penalty += 10;
  if (allFlags.includes("suspicious_duration")) penalty += 10;
  if (allFlags.includes("minimal_content")) penalty += 10;
  if (allFlags.includes("invalid_discount")) penalty += 15;
  if (allFlags.includes("invalid_dates")) penalty += 15;

  const finalScore = Math.max(0, pass2.score - penalty);

  let action;
  if (finalScore >= SCORE_AUTO_APPROVE) {
    action = "auto_approve";
  } else if (finalScore >= SCORE_PENDING_REVIEW) {
    action = "pending_review";
  } else {
    action = "auto_reject";
  }

  return {
    score: finalScore,
    flags: allFlags,
    reasoning: pass2.reasoning,
    checks: pass1.checks,
    action
  };
}

/**
 * Main validation function — runs the full pipeline
 *
 * @param {object} offerData - Offer fields (title, description, discountType, discountValue, etc.)
 * @param {object} businessData - Business info (name, categoryName)
 * @returns {Promise<{ score: number|null, flags: string[], reasoning: string, action: string }>}
 *   action is one of: 'auto_approve', 'pending_review', 'auto_reject'
 */
async function validateOfferData(offerData, businessData) {
  console.log("[OfferValidation] Starting validation for:", offerData.title);

  // Pass 1: Programmatic checks
  const pass1 = programmaticChecks(offerData, businessData);
  console.log("[OfferValidation] Pass 1 flags:", pass1.programmaticFlags);

  // Quick reject for obviously bad content (skip LLM cost)
  if (pass1.programmaticFlags.includes("test_content")) {
    return {
      score: 5,
      flags: pass1.programmaticFlags,
      reasoning: "Conținut de test detectat (lorem ipsum / test patterns).",
      action: "auto_reject"
    };
  }

  // Pass 2: AI analysis
  const pass2 = await aiAnalysis(offerData, businessData, pass1);
  console.log("[OfferValidation] Pass 2 score:", pass2.score, "flags:", pass2.flags);

  // Combine results
  const result = combineResults(pass1, pass2);
  console.log("[OfferValidation] Final score:", result.score, "action:", result.action);

  return result;
}

module.exports = { validateOfferData };
