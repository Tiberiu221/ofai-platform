const express = require('express');
const router = express.Router();
const pool = require('../db');
const cache = require('../services/cache');
const stripeService = require('../services/stripe');
const { requireBusinessOwner } = require('../middleware/businessWebAuth');
const { syncBadgeType } = require('../helpers/tiers');
const { sendEmail, sendPremiumSupportWelcome } = require('../services/email');

// POST /billing/:businessId/checkout — Create checkout session
router.post('/:businessId/checkout', requireBusinessOwner, async (req, res) => {
  try {
    const { planSlug, billingCycle = 'monthly' } = req.body;

    if (!['standard', 'premium'].includes(planSlug)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    if (!['monthly', 'yearly'].includes(billingCycle)) {
      return res.status(400).json({ error: 'Invalid billing cycle' });
    }

    const stripe = stripeService.getStripe();
    if (!stripe) {
      return res.status(501).json({ error: 'Stripe integration pending — not yet configured' });
    }

    const { url } = await stripeService.createCheckoutSession(pool, {
      userId: req.webUser.id,
      businessId: parseInt(req.params.businessId, 10),
      planSlug,
      billingCycle,
    });

    res.json({ url });
  } catch (err) {
    console.error('[Billing] Checkout error:', err);
    res.status(500).json({ error: 'Checkout session creation failed' });
  }
});

// POST /billing/:businessId/change-plan — Downgrade/upgrade via Stripe subscription update
router.post('/:businessId/change-plan', requireBusinessOwner, async (req, res) => {
  try {
    const { planSlug, billingCycle: requestedCycle } = req.body;
    const bizId = parseInt(req.params.businessId, 10);

    const stripe = stripeService.getStripe();
    if (!stripe) {
      return res.status(501).json({ error: 'Stripe not configured' });
    }

    // Validate target plan
    if (!['standard', 'premium'].includes(planSlug)) {
      return res.status(400).json({ error: 'Plan invalid' });
    }

    const targetPlan = await pool.query(
      'SELECT id, slug, stripe_price_monthly_id, stripe_price_yearly_id, sort_order FROM subscription_plans WHERE slug = $1',
      [planSlug]
    );
    if (!targetPlan.rows[0]) {
      return res.status(400).json({ error: 'Planul nu exista' });
    }
    const newSortOrder = targetPlan.rows[0].sort_order;

    // Get current subscription (must have stripe_subscription_id)
    const currentSub = await pool.query(
      `SELECT bs.stripe_subscription_id, bs.billing_cycle, sp.sort_order AS current_sort_order, sp.slug AS current_slug
       FROM business_subscriptions bs
       JOIN subscription_plans sp ON sp.id = bs.plan_id
       WHERE bs.business_id = $1 AND bs.status = 'active' AND bs.stripe_subscription_id IS NOT NULL
       LIMIT 1`,
      [bizId]
    );

    if (!currentSub.rows[0]) {
      return res.status(400).json({ error: 'Nu exista un abonament Stripe activ' });
    }

    const { stripe_subscription_id: stripeSubId, current_sort_order: currentSortOrder, current_slug: currentSlug, billing_cycle: currentCycle } = currentSub.rows[0];

    // Determine target billing cycle (use requested, or keep current)
    const targetCycle = (requestedCycle === 'monthly' || requestedCycle === 'yearly') ? requestedCycle : currentCycle;

    // Don't allow no-op (same plan + same cycle)
    if (currentSlug === planSlug && currentCycle === targetCycle) {
      return res.status(400).json({ error: 'Esti deja pe acest plan si ciclu de facturare' });
    }

    // Select the correct Stripe Price ID based on target cycle
    const newPriceId = targetCycle === 'yearly'
      ? targetPlan.rows[0].stripe_price_yearly_id
      : targetPlan.rows[0].stripe_price_monthly_id;
    if (!newPriceId) {
      return res.status(400).json({ error: 'Planul nu are un Price ID Stripe configurat pentru acest ciclu' });
    }

    // Retrieve Stripe subscription to get the item ID
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
    const itemId = stripeSub.items?.data?.[0]?.id;
    if (!itemId) {
      return res.status(500).json({ error: 'Subscriptia Stripe nu are items' });
    }

    const isPlanDowngrade = newSortOrder < currentSortOrder;
    const isCycleOnlyChange = currentSlug === planSlug && currentCycle !== targetCycle;

    // Proration logic:
    // - Upgrade (higher plan or monthly→yearly): prorate immediately
    // - Downgrade (lower plan): no proration
    // - Cycle change to yearly (same plan): prorate (user pays difference now, saves long-term)
    // - Cycle change to monthly (same plan): no proration (takes effect at renewal)
    const shouldProrate = isCycleOnlyChange
      ? targetCycle === 'yearly'  // monthly→yearly: prorate; yearly→monthly: no proration
      : !isPlanDowngrade;         // upgrade: prorate; downgrade: no proration

    // Determine action for history
    let action, message;
    const planName = planSlug === 'standard' ? 'Standard' : 'Premium';
    const cycleName = targetCycle === 'yearly' ? 'anual' : 'lunar';

    if (isCycleOnlyChange) {
      action = targetCycle === 'yearly' ? 'upgraded' : 'downgraded';
      message = targetCycle === 'yearly'
        ? `Ai trecut pe facturare anuala. Economisesti 17%!`
        : `Ai trecut pe facturare lunara. Schimbarea se aplica imediat.`;
    } else if (isPlanDowngrade) {
      action = 'downgraded';
      message = `Planul a fost schimbat la ${planName} (${cycleName}). Noul plan este activ imediat.`;
    } else {
      action = 'upgraded';
      message = `Upgrade-ul la ${planName} (${cycleName}) a fost aplicat.`;
    }

    // DB first, then Stripe — if Stripe fails, rollback DB
    const newPlanId = targetPlan.rows[0].id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE business_subscriptions
         SET plan_id = $1, billing_cycle = $2, cancel_at_period_end = FALSE, updated_at = NOW()
         WHERE business_id = $3`,
        [newPlanId, targetCycle, bizId]
      );

      await client.query(
        `INSERT INTO subscription_history
         (business_id, from_plan_id, to_plan_id, action, reason)
         VALUES ($1, (SELECT id FROM subscription_plans WHERE slug = $2), $3, $4, $5)`,
        [bizId, currentSlug, newPlanId, action,
         `Plan changed via portal (${currentSlug} ${currentCycle} -> ${planSlug} ${targetCycle})`]
      );

      // Sync badge type
      const newPlanFull = await client.query(
        'SELECT badge_type FROM subscription_plans WHERE id = $1', [newPlanId]
      );
      if (newPlanFull.rows[0]) {
        await syncBadgeType(client, bizId, newPlanFull.rows[0].badge_type);
      }

      // Update Stripe subscription — if this fails, DB transaction is rolled back
      await stripe.subscriptions.update(stripeSubId, {
        items: [{ id: itemId, price: newPriceId }],
        proration_behavior: shouldProrate ? 'create_prorations' : 'none',
        cancel_at_period_end: false,
      });

      // Fetch updated period end from Stripe and save it
      const updatedSub = await stripe.subscriptions.retrieve(stripeSubId);
      const newPeriodEnd = new Date(updatedSub.current_period_end * 1000);
      await client.query(
        `UPDATE business_subscriptions SET current_period_end = $1 WHERE business_id = $2`,
        [newPeriodEnd, bizId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    console.log(`[Billing] Plan change (${action}): business ${bizId}, ${currentSlug}/${currentCycle} -> ${planSlug}/${targetCycle}`);
    cache.del(`tier:biz:${bizId}`);

    res.json({ success: true, message, action });
  } catch (err) {
    console.error('[Billing] Change plan error:', err);
    res.status(500).json({ error: 'Eroare la schimbarea planului' });
  }
});

// POST /billing/:businessId/reactivate — Undo pending cancellation
router.post('/:businessId/reactivate', requireBusinessOwner, async (req, res) => {
  try {
    const bizId = parseInt(req.params.businessId, 10);
    const stripe = stripeService.getStripe();
    if (!stripe) {
      return res.status(501).json({ error: 'Stripe not configured' });
    }

    const sub = await pool.query(
      `SELECT stripe_subscription_id FROM business_subscriptions
       WHERE business_id = $1 AND status = 'active' AND cancel_at_period_end = TRUE
       LIMIT 1`,
      [bizId]
    );
    if (!sub.rows[0]?.stripe_subscription_id) {
      return res.status(400).json({ error: 'Nu exista o anulare in asteptare' });
    }

    // DB-first pattern (matches change-plan): update DB, then Stripe, rollback on failure
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE business_subscriptions
         SET cancel_at_period_end = FALSE, updated_at = NOW()
         WHERE business_id = $1`,
        [bizId]
      );
      await stripe.subscriptions.update(sub.rows[0].stripe_subscription_id, {
        cancel_at_period_end: false,
      });
      await client.query('COMMIT');
    } catch (stripeErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw stripeErr;
    } finally {
      client.release();
    }

    console.log(`[Billing] Subscription reactivated: business ${bizId}`);
    cache.del(`tier:biz:${bizId}`);
    res.json({ success: true, message: 'Abonamentul a fost reactivat.' });
  } catch (err) {
    console.error('[Billing] Reactivate error:', err);
    res.status(500).json({ error: 'Eroare la reactivarea abonamentului' });
  }
});

// POST /billing/:businessId/portal — Manage subscription (Stripe portal)
router.post('/:businessId/portal', requireBusinessOwner, async (req, res) => {
  try {
    const stripe = stripeService.getStripe();
    if (!stripe) {
      return res.status(501).json({ error: 'Stripe integration pending — not yet configured' });
    }

    const { url } = await stripeService.createPortalSession(pool, req.params.businessId);
    res.json({ url });
  } catch (err) {
    console.error('[Billing] Portal error:', err);
    res.status(500).json({ error: 'Portal session creation failed' });
  }
});

// POST /billing/webhook — Stripe webhook handler
// IMPORTANT: raw body needed for signature verification
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    return res.status(501).json({ error: 'Webhook not configured' });
  }

  let event;
  try {
    const stripe = stripeService.getStripe();
    if (!stripe) {
      return res.status(501).json({ error: 'Stripe not configured' });
    }
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('[Billing] Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      default:
        console.log(`[Billing] Unhandled webhook event: ${event.type}`);
    }
    res.json({ received: true });
  } catch (err) {
    console.error(`[Billing] Webhook handler error for ${event.type}:`, err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// ─── Webhook handlers ───

async function handleCheckoutCompleted(session) {
  const { businessId, planSlug, billingCycle } = session.metadata;
  if (!businessId || !planSlug) {
    console.error('[Billing] checkout.session.completed missing metadata:', session.metadata);
    return;
  }

  const bizId = parseInt(businessId, 10);

  // Idempotency: skip if this session was already processed
  const checkoutReason = `Stripe checkout completed (session ${session.id})`;
  const alreadyProcessed = await pool.query(
    'SELECT 1 FROM subscription_history WHERE business_id = $1 AND reason = $2',
    [bizId, checkoutReason]
  );
  if (alreadyProcessed.rows.length > 0) {
    console.log(`[Billing] Checkout already processed for session ${session.id}, skipping`);
    return;
  }

  const plan = await stripeService.getPlanBySlug(pool, planSlug);
  if (!plan) {
    console.error(`[Billing] Plan not found for slug: ${planSlug}`);
    return;
  }

  // Retrieve Stripe subscription for period dates
  const stripe = stripeService.getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
  const periodStart = new Date(stripeSub.current_period_start * 1000);
  const periodEnd = new Date(stripeSub.current_period_end * 1000);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current subscription for history
    const currentSub = await client.query(
      `SELECT id, plan_id FROM business_subscriptions
       WHERE business_id = $1 LIMIT 1`,
      [bizId]
    );
    const fromPlanId = currentSub.rows[0]?.plan_id || null;

    // Update existing row (UNIQUE constraint on business_id — one row per business)
    await client.query(
      `UPDATE business_subscriptions
       SET plan_id = $2, status = 'active', billing_cycle = $3,
           stripe_subscription_id = $4, stripe_customer_id = $5,
           current_period_start = $6, current_period_end = $7,
           cancel_at_period_end = FALSE, updated_at = NOW()
       WHERE business_id = $1`,
      [bizId, plan.id, billingCycle, session.subscription,
       session.customer, periodStart, periodEnd]
    );

    // Log to subscription_history (idempotent — skip if already processed)
    await client.query(
      `INSERT INTO subscription_history
       (business_id, from_plan_id, to_plan_id, action, reason)
       SELECT $1, $2, $3, 'upgraded', $4
       WHERE NOT EXISTS (
         SELECT 1 FROM subscription_history WHERE business_id = $1 AND reason = $4
       )`,
      [bizId, fromPlanId, plan.id, checkoutReason]
    );

    // Sync badge type
    await syncBadgeType(client, bizId, plan.badge_type);

    await client.query('COMMIT');
    cache.del(`tier:biz:${bizId}`);
    console.log(`[Billing] Checkout completed: business ${bizId} -> ${planSlug} (${billingCycle})`);

    // Send emails (non-blocking, after commit)
    sendUpgradeEmails(bizId, plan).catch(err =>
      console.error('[Billing] Upgrade email error:', err.message)
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function handleInvoicePaid(invoice) {
  // Skip first invoice — handled by checkout.session.completed
  if (invoice.billing_reason === 'subscription_create') {
    console.log('[Billing] Skipping first invoice (handled by checkout.completed):', invoice.id);
    return;
  }

  const stripeSubId = invoice.subscription;
  if (!stripeSubId) return;

  // Retrieve updated period from Stripe
  const stripe = stripeService.getStripe();
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
  const periodEnd = new Date(stripeSub.current_period_end * 1000);

  const result = await pool.query(
    `UPDATE business_subscriptions
     SET current_period_end = $1, status = 'active', updated_at = NOW()
     WHERE stripe_subscription_id = $2
     RETURNING id, business_id, plan_id`,
    [periodEnd, stripeSubId]
  );

  if (result.rows.length === 0) {
    console.warn('[Billing] No subscription found for stripe_subscription_id:', stripeSubId);
    return;
  }

  const { business_id, plan_id } = result.rows[0];

  const invoiceReason = `Stripe invoice paid (${invoice.id})`;
  await pool.query(
    `INSERT INTO subscription_history
     (business_id, from_plan_id, to_plan_id, action, reason)
     SELECT $1, $2, $2, 'renewed', $3
     WHERE NOT EXISTS (
       SELECT 1 FROM subscription_history WHERE business_id = $1 AND reason = $3
     )`,
    [business_id, plan_id, invoiceReason]
  );

  cache.del(`tier:biz:${business_id}`);
  console.log(`[Billing] Invoice paid (renewal): business ${business_id}, extended to ${periodEnd.toISOString()}`);
}

async function handlePaymentFailed(invoice) {
  const stripeSubId = invoice.subscription;
  if (!stripeSubId) return;

  // Idempotency: only update if status is 'active' (not already 'past_due')
  const result = await pool.query(
    `UPDATE business_subscriptions
     SET status = 'past_due', updated_at = NOW()
     WHERE stripe_subscription_id = $1 AND status = 'active'
     RETURNING id, business_id`,
    [stripeSubId]
  );

  // If no rows updated, subscription was already past_due or doesn't exist — skip email
  if (result.rows.length === 0) return;

  const { business_id } = result.rows[0];
  cache.del(`tier:biz:${business_id}`);
  console.log(`[Billing] Payment failed: business ${business_id} marked as past_due`);

  sendPaymentFailedEmail(business_id).catch(err =>
    console.error('[Billing] Payment failed email error:', err.message)
  );
}

async function handleSubscriptionCancelled(subscription) {
  const stripeSubId = subscription.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find the subscription row by stripe_subscription_id
    const result = await client.query(
      `SELECT id, business_id, plan_id FROM business_subscriptions
       WHERE stripe_subscription_id = $1 AND status IN ('active', 'past_due')
       LIMIT 1`,
      [stripeSubId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      console.warn('[Billing] Subscription cancelled but not found:', stripeSubId);
      return;
    }

    const { business_id, plan_id: fromPlanId } = result.rows[0];

    const freePlan = await client.query(
      "SELECT id, badge_type FROM subscription_plans WHERE slug = 'free'"
    );
    if (!freePlan.rows[0]) throw new Error('Free plan missing from subscription_plans');

    // Downgrade to free plan (UPDATE existing row — UNIQUE constraint on business_id)
    await client.query(
      `UPDATE business_subscriptions
       SET plan_id = $2, status = 'active', billing_cycle = 'none',
           stripe_subscription_id = NULL,
           current_period_end = NULL, cancel_at_period_end = FALSE, updated_at = NOW()
       WHERE business_id = $1`,
      [business_id, freePlan.rows[0].id]
    );

    const cancelReason = `Stripe subscription cancelled (${stripeSubId})`;
    await client.query(
      `INSERT INTO subscription_history
       (business_id, from_plan_id, to_plan_id, action, reason)
       SELECT $1, $2, $3, 'cancelled', $4
       WHERE NOT EXISTS (
         SELECT 1 FROM subscription_history WHERE business_id = $1 AND reason = $4
       )`,
      [business_id, fromPlanId, freePlan.rows[0].id, cancelReason]
    );

    await syncBadgeType(client, business_id, freePlan.rows[0].badge_type);

    await client.query('COMMIT');
    cache.del(`tier:biz:${business_id}`);
    console.log(`[Billing] Subscription cancelled: business ${business_id} downgraded to free`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function handleSubscriptionUpdated(subscription) {
  const stripeSubId = subscription.id;

  // Only process active subscriptions
  if (subscription.status !== 'active') {
    console.log(`[Billing] Subscription updated but status is ${subscription.status}, skipping`);
    return;
  }

  const localSub = await pool.query(
    `SELECT bs.id, bs.business_id, bs.plan_id, sp.slug AS current_slug, sp.sort_order
     FROM business_subscriptions bs
     JOIN subscription_plans sp ON sp.id = bs.plan_id
     WHERE bs.stripe_subscription_id = $1
       AND bs.status IN ('active', 'past_due')
     LIMIT 1`,
    [stripeSubId]
  );

  if (localSub.rows.length === 0) {
    console.warn('[Billing] subscription.updated but not found locally:', stripeSubId);
    return;
  }

  const local = localSub.rows[0];
  const item = subscription.items?.data?.[0];
  if (!item) return;

  const priceId = item.price?.id;
  const unitAmount = item.price?.unit_amount;
  const interval = item.price?.recurring?.interval;
  if (!interval) return;

  const mapped = await stripeService.mapStripePriceIdToPlan(pool, priceId, unitAmount, interval);
  if (!mapped) {
    console.warn(`[Billing] Could not map Stripe price ${priceId || unitAmount}/${interval} to a local plan`);
    return;
  }

  const { plan: newPlan, billingCycle } = mapped;
  const periodEnd = new Date(subscription.current_period_end * 1000);

  // Sync cancel_at_period_end from Stripe (may have been cleared by plan change)
  const cancelAtEnd = subscription.cancel_at_period_end || false;

  // Same plan — just update period/cycle
  if (newPlan.id === local.plan_id) {
    await pool.query(
      `UPDATE business_subscriptions
       SET current_period_end = $1, billing_cycle = $2, cancel_at_period_end = $3,
           status = 'active', updated_at = NOW()
       WHERE id = $4`,
      [periodEnd, billingCycle, cancelAtEnd, local.id]
    );
    console.log(`[Billing] Subscription updated (period/cycle change): business ${local.business_id}`);
    return;
  }

  // Plan changed
  const action = newPlan.sort_order > local.sort_order ? 'upgraded' : 'downgraded';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE business_subscriptions
       SET plan_id = $1, billing_cycle = $2, current_period_end = $3,
           cancel_at_period_end = $4, status = 'active', updated_at = NOW()
       WHERE id = $5`,
      [newPlan.id, billingCycle, periodEnd, cancelAtEnd, local.id]
    );

    // Skip history if a recent record exists for this plan change (avoids duplicate from change-plan endpoint)
    const recentChange = await client.query(
      `SELECT 1 FROM subscription_history
       WHERE business_id = $1 AND to_plan_id = $2
         AND created_at > NOW() - INTERVAL '30 seconds'
       LIMIT 1`,
      [local.business_id, newPlan.id]
    );
    if (recentChange.rows.length === 0) {
      await client.query(
        `INSERT INTO subscription_history
         (business_id, from_plan_id, to_plan_id, action, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [local.business_id, local.plan_id, newPlan.id, action,
         `Plan changed via Stripe webhook (${stripeSubId})`]
      );
    }

    await syncBadgeType(client, local.business_id, newPlan.badge_type);

    await client.query('COMMIT');
    cache.del(`tier:biz:${local.business_id}`);
    console.log(`[Billing] Subscription ${action}: business ${local.business_id}, ${local.current_slug} -> ${newPlan.slug}`);

    if (newPlan.slug === 'premium') {
      sendUpgradeEmails(local.business_id, newPlan).catch(err =>
        console.error('[Billing] Upgrade email error:', err.message)
      );
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ─── Email helpers ───

async function sendUpgradeEmails(businessId, plan) {
  const { rows } = await pool.query(
    `SELECT u.email, u.first_name, b.name AS business_name
     FROM user_businesses ub
     JOIN users u ON u.id = ub.user_id
     JOIN businesses b ON b.id = ub.business_id
     WHERE ub.business_id = $1`,
    [businessId]
  );

  for (const owner of rows) {
    await sendEmail({
      to: owner.email,
      subject: `Abonamentul ${plan.name} a fost activat - OFAI`,
      html: buildSubscriptionEmail(owner.first_name, owner.business_name, plan.name, 'activated'),
    });

    if (plan.slug === 'premium') {
      await sendPremiumSupportWelcome(owner.email, owner.first_name, owner.business_name);
    }
  }
}

async function sendPaymentFailedEmail(businessId) {
  const { rows } = await pool.query(
    `SELECT u.email, u.first_name, b.name AS business_name
     FROM user_businesses ub
     JOIN users u ON u.id = ub.user_id
     JOIN businesses b ON b.id = ub.business_id
     WHERE ub.business_id = $1`,
    [businessId]
  );

  for (const owner of rows) {
    await sendEmail({
      to: owner.email,
      subject: 'Plata abonamentului a esuat - OFAI',
      html: buildSubscriptionEmail(owner.first_name, owner.business_name, null, 'payment_failed'),
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSubscriptionEmail(firstName, businessName, planName, type) {
  const safeFirst = escapeHtml(firstName);
  const safeBiz = escapeHtml(businessName);
  const safePlan = escapeHtml(planName);
  const isFailure = type === 'payment_failed';
  const title = isFailure ? 'Plata abonamentului a esuat' : `Abonament ${safePlan} activat!`;
  const color = isFailure ? '#dc2626' : '#16a34a';
  const body = isFailure
    ? `<p>Plata pentru abonamentul business-ului <strong>${safeBiz}</strong> nu a putut fi procesata.</p>
       <p>Te rugam sa verifici metoda de plata in portalul de facturare.</p>`
    : `<p>Abonamentul <strong>${safePlan}</strong> pentru business-ul <strong>${safeBiz}</strong> a fost <span style="color: ${color}; font-weight: bold;">activat cu succes</span>!</p>
       <p>Poti gestiona abonamentul din Business Portal.</p>`;
  const ctaText = isFailure ? 'Actualizeaza metoda de plata' : 'Mergi la portal';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: ${color}; margin: 0;">${title}</h1>
  </div>
  <p>Salut${safeFirst ? ` ${safeFirst}` : ''},</p>
  ${body}
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://ofai.ro/cont" style="background: ${color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">${ctaText}</a>
  </div>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} OFAI. Toate drepturile rezervate.</p>
</body></html>`;
}

module.exports = router;
