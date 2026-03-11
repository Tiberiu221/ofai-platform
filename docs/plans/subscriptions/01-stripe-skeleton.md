# 01 — Stripe Skeleton (Placeholder)

> **Scop:** Schelet pentru integrarea Stripe — NU implementare completă. Structura de fișiere, webhook skeleton, checkout flow de bază.
> **Dependințe:** `00-subscription-foundation.md` (tabele DB, tier helpers)
> **Fișiere afectate:** `package.json`, `src/routes/billing.js` (NOU), `src/services/stripe.js` (NOU), `src/routes/business-portal.js`, `.env`
> **Nota:** Procesorul de plată final (Stripe/Netopia/alt) nu e decis. Acest plan creează o interfață abstractă pe care orice processor se poate cupla.

---

## 1. Env Vars noi

```
STRIPE_SECRET_KEY=sk_test_...          # Test mode key
STRIPE_PUBLISHABLE_KEY=pk_test_...     # For frontend checkout
STRIPE_WEBHOOK_SECRET=whsec_...        # Webhook signature verification
```

---

## 2. Package

```bash
cd appredueri_backend && npm install stripe
```

---

## 3. Service: `src/services/stripe.js` (NOU)

```js
const Stripe = require('stripe');

let stripeInstance = null;

function getStripe() {
  if (!stripeInstance && process.env.STRIPE_SECRET_KEY) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    });
  }
  return stripeInstance;
}

/**
 * Create or retrieve a Stripe Customer for a business owner
 */
async function getOrCreateCustomer(pool, userId, businessId) {
  // Check if business already has a stripe_customer_id
  const { rows } = await pool.query(
    `SELECT stripe_customer_id FROM business_subscriptions
     WHERE business_id = $1 AND stripe_customer_id IS NOT NULL
     LIMIT 1`,
    [businessId]
  );

  if (rows.length > 0 && rows[0].stripe_customer_id) {
    return rows[0].stripe_customer_id;
  }

  // Get user info for customer creation
  const userResult = await pool.query(
    'SELECT email, first_name, last_name FROM users WHERE id = $1',
    [userId]
  );
  const user = userResult.rows[0];

  // Get business info
  const bizResult = await pool.query(
    'SELECT name FROM businesses WHERE id = $1',
    [businessId]
  );

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.first_name} ${user.last_name}`,
    metadata: {
      userId: String(userId),
      businessId: String(businessId),
      businessName: bizResult.rows[0]?.name || '',
    },
  });

  return customer.id;
}

/**
 * Create a Checkout Session for subscription
 * Returns: { sessionId, url }
 */
async function createCheckoutSession(pool, { userId, businessId, planSlug, billingCycle }) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const customerId = await getOrCreateCustomer(pool, userId, businessId);

  // Get plan pricing — in a real implementation, use Stripe Price IDs
  // For now, create prices dynamically (switch to saved Price IDs in production)
  const planResult = await pool.query(
    'SELECT * FROM subscription_plans WHERE slug = $1',
    [planSlug]
  );
  const plan = planResult.rows[0];
  if (!plan) throw new Error('Plan not found');

  const amount = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  const interval = billingCycle === 'yearly' ? 'year' : 'month';

  // TODO: Replace with saved Stripe Price IDs in production
  // const priceId = plan[`stripe_price_id_${billingCycle}`];

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'ron',
        product_data: {
          name: `OFAI ${plan.name}`,
          description: `Plan ${plan.name} — ${billingCycle === 'yearly' ? 'anual' : 'lunar'}`,
        },
        unit_amount: amount,
        recurring: { interval },
      },
      quantity: 1,
    }],
    metadata: {
      businessId: String(businessId),
      planSlug,
      billingCycle,
    },
    success_url: `${process.env.BASE_URL || 'https://ofai.ro'}/my-businesses/${businessId}?subscription=success`,
    cancel_url: `${process.env.BASE_URL || 'https://ofai.ro'}/my-businesses/${businessId}?subscription=cancelled`,
    allow_promotion_codes: true,
  });

  return { sessionId: session.id, url: session.url };
}

/**
 * Create a Customer Portal session (manage billing, cancel, etc.)
 */
async function createPortalSession(pool, businessId) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const { rows } = await pool.query(
    `SELECT stripe_customer_id FROM business_subscriptions
     WHERE business_id = $1 AND stripe_customer_id IS NOT NULL
     LIMIT 1`,
    [businessId]
  );

  if (!rows.length || !rows[0].stripe_customer_id) {
    throw new Error('No Stripe customer found for this business');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: rows[0].stripe_customer_id,
    return_url: `${process.env.BASE_URL || 'https://ofai.ro'}/my-businesses/${businessId}`,
  });

  return { url: session.url };
}

module.exports = {
  getStripe,
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
};
```

---

## 4. Routes: `src/routes/billing.js` (NOU)

```js
const express = require('express');
const router = express.Router();
const stripe = require('../services/stripe');
const { getBusinessTier, TIERS } = require('../helpers/tiers');
const { businessWebAuth } = require('../middleware/businessWebAuth');

module.exports = (pool) => {

  // POST /billing/:businessId/checkout — Create checkout session
  router.post('/:businessId/checkout', businessWebAuth(pool), async (req, res) => {
    try {
      const { planSlug, billingCycle = 'monthly' } = req.body;

      if (!['standard', 'premium'].includes(planSlug)) {
        return res.status(400).json({ error: 'Invalid plan' });
      }
      if (!['monthly', 'yearly'].includes(billingCycle)) {
        return res.status(400).json({ error: 'Invalid billing cycle' });
      }

      const { url } = await stripe.createCheckoutSession(pool, {
        userId: req.webUser.id,
        businessId: req.params.businessId,
        planSlug,
        billingCycle,
      });

      res.json({ url });
    } catch (err) {
      console.error('Checkout error:', err);
      res.status(500).json({ error: 'Checkout session creation failed' });
    }
  });

  // POST /billing/:businessId/portal — Manage subscription (Stripe portal)
  router.post('/:businessId/portal', businessWebAuth(pool), async (req, res) => {
    try {
      const { url } = await stripe.createPortalSession(pool, req.params.businessId);
      res.json({ url });
    } catch (err) {
      console.error('Portal error:', err);
      res.status(500).json({ error: 'Portal session creation failed' });
    }
  });

  // POST /billing/webhook — Stripe webhook handler
  // IMPORTANT: raw body needed for signature verification
  router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      const stripeLib = stripe.getStripe();
      event = stripeLib.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(pool, event.data.object);
          break;
        case 'invoice.paid':
          await handleInvoicePaid(pool, event.data.object);
          break;
        case 'invoice.payment_failed':
          await handlePaymentFailed(pool, event.data.object);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionCancelled(pool, event.data.object);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(pool, event.data.object);
          break;
        default:
          console.log(`Unhandled webhook event: ${event.type}`);
      }
    } catch (err) {
      console.error(`Webhook handler error for ${event.type}:`, err);
    }

    res.json({ received: true });
  });

  return router;
};

// --- Webhook handlers (skeleton — implement per event) ---

async function handleCheckoutCompleted(pool, session) {
  const { businessId, planSlug, billingCycle } = session.metadata;
  const stripeSubscriptionId = session.subscription;
  const stripeCustomerId = session.customer;

  // TODO: Implement full logic
  // 1. Get plan_id from slug
  // 2. Cancel old subscription (UPDATE status = 'cancelled')
  // 3. INSERT new business_subscription with stripe IDs
  // 4. INSERT into subscription_history
  // 5. Update is_verified on businesses if plan has badge
  console.log(`Checkout completed: business ${businessId} → ${planSlug} (${billingCycle})`);
}

async function handleInvoicePaid(pool, invoice) {
  // Renewal success — extend current_period_end
  console.log('Invoice paid:', invoice.id);
}

async function handlePaymentFailed(pool, invoice) {
  // Mark subscription as past_due
  console.log('Payment failed:', invoice.id);
}

async function handleSubscriptionCancelled(pool, subscription) {
  // Downgrade to free tier
  console.log('Subscription cancelled:', subscription.id);
}

async function handleSubscriptionUpdated(pool, subscription) {
  // Plan change (upgrade/downgrade from Stripe portal)
  console.log('Subscription updated:', subscription.id);
}
```

---

## 5. Integrare în `index.js`

```js
// IMPORTANT: webhook route MUST be before express.json() middleware
// because Stripe needs raw body for signature verification
app.use('/billing', require('./routes/billing')(pool));

// ... existing express.json() middleware AFTER this
```

**Alternativ**, dacă `express.json()` e deja global, folosește `express.raw()` doar pe ruta webhook (deja făcut în billing.js).

---

## 6. Ce NU implementăm acum

- [ ] Stripe Price IDs salvate (folosim price_data dinamic — ok pentru test)
- [ ] Stripe Customer Portal configuration (trebuie setat din Stripe Dashboard)
- [ ] Email notifications la plată (vine din Stripe automat)
- [ ] Facturare fiscală RO (CUI, adresa fiscală)
- [ ] Netopia ca alternativă
- [ ] Mobile billing (doar web portal)

---

## 7. Testare manuală

1. Setează `STRIPE_SECRET_KEY=sk_test_...` în .env
2. `POST /billing/:businessId/checkout` cu `{ planSlug: 'standard', billingCycle: 'monthly' }`
3. Redirectează la URL-ul returnat
4. Folosește card test `4242 4242 4242 4242`
5. Verifică webhook-ul în Stripe Dashboard → Developers → Webhooks
6. `stripe listen --forward-to localhost:4000/billing/webhook` (Stripe CLI local)

---

## 8. Gotchas

1. **Raw body pentru webhooks** — Stripe webhook signature necesită body-ul raw, nu parsed JSON. Ruta webhook TREBUIE să folosească `express.raw()`.
2. **CSRF skip** — Webhook-ul vine de la Stripe, nu are CSRF token. Adaugă `/billing/webhook` în CSRF skip list din `index.js`.
3. **Moneda `ron`** — Stripe suportă RON. Amount în bani (4900 = 49.00 RON).
4. **Idempotency** — `checkout.session.completed` poate veni de mai multe ori. Handler-ul trebuie să fie idempotent (check if subscription already created).
5. **Test vs Live** — `sk_test_` vs `sk_live_`. NICIODATĂ chei live în dev.
