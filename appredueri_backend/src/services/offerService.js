/**
 * Offer Service
 * Shared logic for creating offers across web portal and business portal
 */

const { getBusinessTier } = require('../helpers/tiers');
const { validateOfferData } = require('./llm/offerValidation');

/**
 * Create a new offer with promo codes, push notifications, and n8n webhook
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Object} params - Offer creation parameters
 * @param {number} params.businessId - Business ID
 * @param {string} params.title - Offer title
 * @param {string} [params.description] - Offer description
 * @param {string} [params.discountType] - 'percent' or 'fixed'
 * @param {number} [params.discountValue] - Discount value
 * @param {string} [params.conditions] - Offer conditions
 * @param {string} [params.startDate] - Start date (YYYY-MM-DD)
 * @param {string} [params.endDate] - End date (YYYY-MM-DD)
 * @param {boolean} [params.isActive] - Whether offer is active
 * @param {string} [params.logoUrl] - Cloudinary logo URL (business portal only)
 * @param {string} [params.bookingType] - 'inherit', 'phone', 'whatsapp', 'url'
 * @param {string} [params.bookingPhone] - Booking phone number
 * @param {string} [params.bookingWhatsapp] - Booking WhatsApp number
 * @param {string} [params.bookingUrl] - Booking URL
 * @param {string} [params.bookingInstructions] - Booking instructions
 * @param {Array<{code: string, is_active: boolean}>} [params.promoCodes] - Array of promo codes
 * @param {number} [params.maxReveals] - Maximum number of code reveals (null = unlimited)
 * @param {boolean} [params.sendWebhook] - Whether to send n8n webhook (default: true for business portal)
 * @param {Object} [params.tier] - Pre-fetched tier info from req.tier (avoids redundant DB query)
 * @returns {Promise<number>} - Created offer ID
 */
async function createOffer(pool, params) {
  const {
    businessId,
    title,
    description,
    discountType,
    discountValue,
    conditions,
    startDate,
    endDate,
    isActive,
    logoUrl,
    bookingType,
    bookingPhone,
    bookingWhatsapp,
    bookingUrl,
    bookingInstructions,
    promoCodes,
    maxReveals,
    sendWebhook = false, // Only business portal triggers webhook by default
    tier = null, // Pre-fetched tier info from middleware (avoids redundant DB query)
  } = params;

  const VALID_DISCOUNT_TYPES = ['percentage', 'fixed', 'free', 'bogo', 'other'];
  if (discountType && !VALID_DISCOUNT_TYPES.includes(discountType)) {
    throw new Error("Tip de discount invalid");
  }

  // Use transaction for offer + promo codes
  const client = await pool.connect();
  let offerId;
  let moderation = { score: null, flags: null, reasoning: null };
  let moderationStatus = 'pending_review';

  try {
    await client.query("BEGIN");

    // Advisory lock per business to prevent race condition on offer limit check
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('offer_limit_' || $1::text))",
      [String(businessId)]
    );

    // Tier info for promo code limits
    const tierInfo = tier || await getBusinessTier(pool, businessId);
    const plan = tierInfo.plan;

    // Note: Active offer limit is NOT checked here because all offers are
    // created as inactive (pending admin review). The limit is enforced when
    // the offer is activated (toggle endpoint or admin approval).

    // Promo code limit check
    if (promoCodes && Array.isArray(promoCodes)) {
      const validCodes = promoCodes.filter(pc => pc.code && pc.code.trim());
      if (validCodes.length > 0) {
        const promoLimit = plan.max_promo_codes_per_offer;
        if (promoLimit !== null && validCodes.length > promoLimit) {
          await client.query("ROLLBACK");
          const err = new Error('promo_code_limit');
          err.statusCode = 403;
          err.details = {
            error: 'limit_reached',
            message: promoLimit === 0
              ? `Codurile promotionale nu sunt disponibile pe planul ${plan.name}.`
              : `Maximum ${promoLimit} coduri per oferta pe planul ${plan.name}.`,
            currentTier: plan.slug,
            limit: promoLimit,
            current: validCodes.length,
            limitKey: 'max_promo_codes_per_offer',
          };
          throw err;
        }
      }
    }

    // AI Offer Validation (advisory only — score/reasoning for admin review)
    try {
      const bizRes = await client.query(
        `SELECT b.name, c.name AS category_name
         FROM businesses b LEFT JOIN categories c ON c.id = b.category_id
         WHERE b.id = $1`,
        [businessId]
      );
      const bizInfo = bizRes.rows[0] || {};

      moderation = await validateOfferData(
        { title, description, discountType, discountValue, conditions, startDate, endDate },
        { name: bizInfo.name, categoryName: bizInfo.category_name }
      );
    } catch (validationErr) {
      // AI failure is non-blocking — offer still goes to pending_review
      console.error("[OfferValidation] Validation error (non-blocking):", validationErr.message);
      moderation = { score: null, flags: ['validation_error'], reasoning: validationErr.message };
    }

    // All offers go to pending_review — admin decides
    const effectiveIsActive = false;

    const result = await client.query(`
      INSERT INTO offers (
        business_id, title, description, discount_type, discount_value,
        conditions, start_date, end_date, is_active, logo_url,
        booking_type, booking_phone, booking_whatsapp, booking_url, booking_instructions,
        max_reveals, moderation_status, ai_score, ai_flags, ai_reasoning
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING id
    `, [
      businessId,
      title,
      description || null,
      discountType || null,
      discountValue ?? null,
      conditions || null,
      startDate || null,
      endDate || null,
      effectiveIsActive,
      logoUrl || null,
      bookingType || 'inherit',
      bookingPhone || null,
      bookingWhatsapp || null,
      bookingUrl || null,
      bookingInstructions || null,
      maxReveals ?? null,
      moderationStatus,
      moderation.score,
      moderation.flags ? JSON.stringify(moderation.flags) : null,
      moderation.reasoning || null,
    ]);

    offerId = result.rows[0].id;

    if (promoCodes && Array.isArray(promoCodes)) {
      const validCodes = promoCodes.filter(pc => pc.code && pc.code.trim());
      for (const pc of validCodes) {
        await client.query(
          "INSERT INTO promo_codes (offer_id, code, is_active) VALUES ($1, $2, $3)",
          [offerId, pc.code.trim(), pc.is_active !== false]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // Notifications are NOT sent here — all offers are pending_review.
  // Push notifications and webhooks will be triggered when admin approves
  // the offer (via the admin approval route).

  return { offerId, moderationStatus, aiScore: moderation.score };
}

module.exports = { createOffer };
