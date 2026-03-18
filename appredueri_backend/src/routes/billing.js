const express = require('express');
const router = express.Router();
const pool = require('../db');
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
    const { planSlug } = req.body;
    const bizId = parseInt(req.params.businessId, 10);

    const stripe = stripeService.getStripe();
    if (!stripe) {
      return res.status(501).json({ error: 'Stripe not configured' });
    }

    // Validate target plan + get stripe_price_monthly_id
    if (!['standard', 'premium'].includes(planSlug)) {
      return res.status(400).json({ error: 'Plan invalid' });
    }

    const targetPlan = await pool.query(
      'SELECT id, slug, stripe_price_monthly_id, sort_order FROM subscription_plans WHERE slug = $1',
      [planSlug]
    );
    if (!targetPlan.rows[0] || !targetPlan.rows[0].stripe_price_monthly_id) {
      return res.status(400).json({ error: 'Planul nu are un Price ID Stripe configurat' });
    }
    const newPriceId = targetPlan.rows[0].stripe_price_monthly_id;
    const newSortOrder = targetPlan.rows[0].sort_order;

    // Get current subscription (must have stripe_subscription_id)
    const currentSub = await pool.query(
      `SELECT bs.stripe_subscription_id, sp.sort_order AS current_sort_order, sp.slug AS current_slug
       FROM business_subscriptions bs
       JOIN subscription_plans sp ON sp.id = bs.plan_id
       WHERE bs.business_id = $1 AND bs.status = 'active' AND bs.stripe_subscription_id IS NOT NULL
       LIMIT 1`,
      [bizId]
    );

    if (!currentSub.rows[0]) {
      return res.status(400).json({ error: 'Nu exista un abonament Stripe activ' });
    }

    const { stripe_subscription_id: stripeSubId, current_sort_order: currentSortOrder, current_slug: currentSlug } = currentSub.rows[0];

    // Don't allow changing to same plan
    if (currentSlug === planSlug) {
      return res.status(400).json({ error: 'Esti deja pe acest plan' });
    }

    // Retrieve Stripe subscription to get the item ID
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
    const itemId = stripeSub.items?.data?.[0]?.id;
    if (!itemId) {
      return res.status(500).json({ error: 'Subscriptia Stripe nu are items' });
    }

    const isDowngrade = newSortOrder < currentSortOrder;

    // Update Stripe subscription
    // Also clear any pending cancellation — if user is changing plan, they want to keep it
    await stripe.subscriptions.update(stripeSubId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: isDowngrade ? 'none' : 'create_prorations',
      cancel_at_period_end: false,
    });

    // Webhook `customer.subscription.updated` will handle DB update automatically
    const action = isDowngrade ? 'downgrade' : 'upgrade';
    console.log(`[Billing] Plan change (${action}): business ${bizId}, ${currentSlug} -> ${planSlug}`);

    res.json({
      success: true,
      message: isDowngrade
        ? `Planul se va schimba la ${planSlug === 'standard' ? 'Standard' : 'Premium'} la sfarsitul perioadei curente.`
        : `Upgrade-ul la ${planSlug === 'standard' ? 'Standard' : 'Premium'} a fost aplicat.`,
      action,
    });
  } catch (err) {
    console.error('[Billing] Change plan error:', err);
    res.status(500).json({ error: 'Eroare la schimbarea planului' });
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

    // Log to subscription_history
    await client.query(
      `INSERT INTO subscription_history
       (business_id, from_plan_id, to_plan_id, action, reason)
       VALUES ($1, $2, $3, 'upgraded', $4)`,
      [bizId, fromPlanId, plan.id,
       `Stripe checkout completed (session ${session.id})`]
    );

    // Sync badge type
    await syncBadgeType(client, bizId, plan.badge_type);

    await client.query('COMMIT');
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

  await pool.query(
    `INSERT INTO subscription_history
     (business_id, from_plan_id, to_plan_id, action, reason)
     VALUES ($1, $2, $2, 'renewed', $3)`,
    [business_id, plan_id, `Stripe invoice paid (${invoice.id})`]
  );

  console.log(`[Billing] Invoice paid (renewal): business ${business_id}, extended to ${periodEnd.toISOString()}`);
}

async function handlePaymentFailed(invoice) {
  const stripeSubId = invoice.subscription;
  if (!stripeSubId) return;

  const result = await pool.query(
    `UPDATE business_subscriptions
     SET status = 'past_due', updated_at = NOW()
     WHERE stripe_subscription_id = $1 AND status = 'active'
     RETURNING id, business_id`,
    [stripeSubId]
  );

  if (result.rows.length === 0) return;

  const { business_id } = result.rows[0];
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
           stripe_subscription_id = NULL, stripe_customer_id = NULL,
           current_period_end = NULL, cancel_at_period_end = FALSE, updated_at = NOW()
       WHERE business_id = $1`,
      [business_id, freePlan.rows[0].id]
    );

    await client.query(
      `INSERT INTO subscription_history
       (business_id, from_plan_id, to_plan_id, action, reason)
       VALUES ($1, $2, $3, 'cancelled', $4)`,
      [business_id, fromPlanId, freePlan.rows[0].id,
       `Stripe subscription cancelled (${stripeSubId})`]
    );

    await syncBadgeType(client, business_id, freePlan.rows[0].badge_type);

    await client.query('COMMIT');
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

  const unitAmount = item.price?.unit_amount;
  const interval = item.price?.recurring?.interval;
  if (!unitAmount || !interval) return;

  const mapped = await stripeService.mapStripePriceToPlan(pool, unitAmount, interval);
  if (!mapped) {
    console.warn(`[Billing] Could not map Stripe price ${unitAmount}/${interval} to a local plan`);
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

    await client.query(
      `INSERT INTO subscription_history
       (business_id, from_plan_id, to_plan_id, action, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [local.business_id, local.plan_id, newPlan.id, action,
       `Plan changed via Stripe portal (${stripeSubId})`]
    );

    await syncBadgeType(client, local.business_id, newPlan.badge_type);

    await client.query('COMMIT');
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

function buildSubscriptionEmail(firstName, businessName, planName, type) {
  const isFailure = type === 'payment_failed';
  const title = isFailure ? 'Plata abonamentului a esuat' : `Abonament ${planName} activat!`;
  const color = isFailure ? '#dc2626' : '#16a34a';
  const body = isFailure
    ? `<p>Plata pentru abonamentul business-ului <strong>${businessName}</strong> nu a putut fi procesata.</p>
       <p>Te rugam sa verifici metoda de plata in portalul de facturare.</p>`
    : `<p>Abonamentul <strong>${planName}</strong> pentru business-ul <strong>${businessName}</strong> a fost <span style="color: ${color}; font-weight: bold;">activat cu succes</span>!</p>
       <p>Poti gestiona abonamentul din Business Portal.</p>`;
  const ctaText = isFailure ? 'Actualizeaza metoda de plata' : 'Mergi la portal';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: ${color}; margin: 0;">${title}</h1>
  </div>
  <p>Salut${firstName ? ` ${firstName}` : ''},</p>
  ${body}
  <div style="text-align: center; margin: 30px 0;">
    <a href="https://ofai.ro/cont" style="background: ${color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">${ctaText}</a>
  </div>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="color: #999; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} OFAI. Toate drepturile rezervate.</p>
</body></html>`;
}

module.exports = router;
