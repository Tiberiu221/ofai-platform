const express = require('express');
const router = express.Router();
const pool = require('../db');
const stripeService = require('../services/stripe');
const { requireBusinessOwner } = require('../middleware/businessWebAuth');

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
  } catch (err) {
    console.error(`[Billing] Webhook handler error for ${event.type}:`, err);
  }

  res.json({ received: true });
});

// --- Webhook handlers (skeleton — implement when Stripe goes live) ---

async function handleCheckoutCompleted(session) {
  const { businessId, planSlug, billingCycle } = session.metadata;
  // TODO: Implement full logic
  // 1. Get plan_id from slug
  // 2. Cancel old subscription (UPDATE status = 'cancelled')
  // 3. INSERT new business_subscription with stripe IDs
  // 4. INSERT into subscription_history
  // 5. Sync badge type
  console.log(`[Billing] Checkout completed: business ${businessId} -> ${planSlug} (${billingCycle})`);
}

async function handleInvoicePaid(invoice) {
  // Renewal success — extend current_period_end
  console.log('[Billing] Invoice paid:', invoice.id);
}

async function handlePaymentFailed(invoice) {
  // Mark subscription as past_due
  console.log('[Billing] Payment failed:', invoice.id);
}

async function handleSubscriptionCancelled(subscription) {
  // Downgrade to free tier
  console.log('[Billing] Subscription cancelled:', subscription.id);
}

async function handleSubscriptionUpdated(subscription) {
  // Plan change (upgrade/downgrade from Stripe portal)
  console.log('[Billing] Subscription updated:', subscription.id);
}

module.exports = router;
