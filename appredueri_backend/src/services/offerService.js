/**
 * Offer Service
 * Shared logic for creating offers across web portal and business portal
 */

const { triggerWebhook } = require("./n8n");
const pushService = require("./pushNotifications");
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

  try {
    await client.query("BEGIN");

    // Advisory lock per business to prevent race condition on offer limit check
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('offer_limit_' || $1::text))",
      [String(businessId)]
    );

    // C4: Atomic offer limit check INSIDE transaction (after advisory lock)
    // This prevents race conditions where two concurrent requests both pass
    // the middleware COUNT check and then both INSERT.
    const tierInfo = tier || await getBusinessTier(pool, businessId);
    const plan = tierInfo.plan;

    if (plan.max_active_offers !== null && (isActive !== false)) {
      const countRes = await client.query(
        "SELECT COUNT(*)::int AS cnt FROM offers WHERE business_id = $1 AND is_active = true",
        [businessId]
      );
      if (countRes.rows[0].cnt >= plan.max_active_offers) {
        await client.query("ROLLBACK");
        const err = new Error('offer_limit');
        err.statusCode = 403;
        err.details = {
          error: 'limit_reached',
          message: `Ai atins limita de ${plan.max_active_offers} oferte active pentru planul ${plan.name}.`,
          currentTier: plan.slug,
          limit: plan.max_active_offers,
          current: countRes.rows[0].cnt,
          limitKey: 'max_active_offers',
        };
        throw err;
      }
    }

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

    // AI Offer Validation (outside critical path — graceful fallback)
    let moderation = { score: null, flags: null, reasoning: null, action: 'auto_approve' };
    if (process.env.OFFER_VALIDATION_ENABLED === 'true') {
      try {
        // Fetch business info for category context
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

        // Auto-reject: rollback and throw
        if (moderation.action === 'auto_reject') {
          await client.query("ROLLBACK");
          const err = new Error('offer_rejected');
          err.statusCode = 422;
          err.details = {
            error: 'offer_rejected',
            message: 'Oferta nu a trecut verificarea de calitate. Verifică titlul și descrierea.',
            ai_score: moderation.score,
            ai_flags: moderation.flags,
            ai_reasoning: moderation.reasoning,
          };
          throw err;
        }
      } catch (validationErr) {
        // Re-throw rejection errors
        if (validationErr.message === 'offer_rejected') throw validationErr;
        // For any other validation error, log and continue (don't block offer creation)
        console.error("[OfferValidation] Validation error (non-blocking):", validationErr.message);
        moderation = { score: null, flags: ['validation_error'], reasoning: validationErr.message, action: 'auto_approve' };
      }
    }

    // If pending_review, force offer inactive until admin approves
    const effectiveIsActive = moderation.action === 'pending_review' ? false : (isActive !== false);
    const moderationStatus = moderation.action === 'pending_review' ? 'pending_review' : 'auto_approved';

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

  // Skip notifications for pending_review offers (not yet visible to users)
  if (moderationStatus !== 'pending_review') {
    // Notifications outside transaction (fire-and-forget)
    const bizNameRes = await pool.query("SELECT name FROM businesses WHERE id = $1", [businessId]);
    const bizName = bizNameRes.rows[0]?.name || "Business";

    // Trigger n8n webhook if requested (business portal only)
    if (sendWebhook) {
      triggerWebhook("/webhook/new-offer", {
        offer_id: offerId,
        business_id: parseInt(businessId),
        business_name: bizName,
        title: title,
        discount_type: discountType || null,
        discount_value: discountValue || null,
        start_date: startDate || null,
        end_date: endDate || null,
        created_at: new Date().toISOString(),
      });
    }

    // Push notification to subscribers (gated by has_push_on_offer tier feature)
    try {
      // W11: Reuse pre-fetched tier instead of querying DB again
      const tierInfo = tier || await getBusinessTier(pool, businessId);
      if (process.env.TIER_GATING_ENABLED !== 'true' || tierInfo.plan.has_push_on_offer) {
        let discountText = "";
        if (discountValue) {
          discountText = discountType === "fixed" ? ` (-${discountValue} RON)` : ` (-${discountValue}%)`;
        }
        pushService.sendToBusinessSubscribers(pool, parseInt(businessId), {
          title: `${bizName} are o ofertă nouă!`,
          body: `${title}${discountText}`,
          data: {
            type: "new_offer",
            offerId: String(offerId),
            businessId: String(businessId),
          },
        }).catch(err => console.error("[Push] New offer push error:", err));
      }
    } catch (err) {
      console.error("[Push] Tier check for push_on_offer failed:", err.message);
    }
  }

  return { offerId, moderationStatus, aiScore: moderation.score };
}

module.exports = { createOffer };
