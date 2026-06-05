import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// ── CREATE STRIPE CONNECT ACCOUNT FOR RESTAURANT ────
export async function createStripeConnectAccount(email, restaurantName) {
  const account = await stripe.accounts.create({
    type: 'standard',
    email,
    business_profile: {
      name: restaurantName,
      mcc: '5812', // Eating places and restaurants
    },
  })
  return account.id
}

// ── GET STRIPE ONBOARDING LINK ──────────────────────
export async function getOnboardingLink(accountId, returnUrl, refreshUrl) {
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  })
  return link.url
}

// ── CREATE PAYMENT INTENT ────────────────────────────
export async function createPaymentIntent({ amount, currency, restaurantStripeAccountId, applicationFee, metadata }) {
  const intent = await stripe.paymentIntents.create({
    amount,           // in cents
    currency,
    application_fee_amount: applicationFee,  // Rainback's 5% in cents
    transfer_data: {
      destination: restaurantStripeAccountId, // Restaurant gets the rest directly
    },
    metadata,
    automatic_payment_methods: { enabled: true },
  })
  return intent
}

// ── VERIFY PAYMENT AFTER CHECKOUT ───────────────────
export async function confirmMembershipPayment(paymentIntentId) {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
  return intent
}

// ── HANDLE STRIPE WEBHOOK ────────────────────────────
// Verify and parse incoming Stripe webhook events
export function constructWebhookEvent(payload, signature) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  )
}

// ── CREATE CUSTOMER (for saving payment methods) ─────
export async function createOrGetCustomer(email, name) {
  const existing = await stripe.customers.list({ email, limit: 1 })
  if (existing.data.length > 0) return existing.data[0].id

  const customer = await stripe.customers.create({ email, name })
  return customer.id
}

// ── REFUND ───────────────────────────────────────────
export async function refundPayment(paymentIntentId, amount) {
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amount ? Math.round(amount * 100) : undefined, // full refund if no amount
  })
  return refund
}

export default stripe
