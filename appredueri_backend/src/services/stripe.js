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
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

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

  const planResult = await pool.query(
    'SELECT * FROM subscription_plans WHERE slug = $1',
    [planSlug]
  );
  const plan = planResult.rows[0];
  if (!plan) throw new Error('Plan not found');

  const amount = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  if (!amount || amount <= 0) {
    throw new Error('Cannot create checkout for plan with zero price');
  }
  const interval = billingCycle === 'yearly' ? 'year' : 'month';

  // TODO: Replace with saved Stripe Price IDs in production
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
