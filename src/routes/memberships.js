import { db } from '../db/client.js'
import { authenticate, requireOwner } from '../middleware/auth.js'
import { createPaymentIntent, confirmMembershipPayment } from '../services/stripe.js'
import { generateMemberPass } from '../services/passkit.js'

export default async function membershipRoutes(app) {

  // ── POST /api/memberships/intent ────────────────────
  // Create a Stripe PaymentIntent before purchase
  app.post('/intent', { preHandler: authenticate }, async (req, reply) => {
    const { restaurantId } = req.body
    if (!restaurantId) return reply.code(400).send({ error: 'restaurantId required' })

    const restaurant = await db.findOne(
      `SELECT r.id, r.name, r.membership_price, r.membership_cap,
              r.stripe_account_id, r.stripe_onboarded,
              r.membership_cap - COUNT(m.id) AS spots_remaining
       FROM restaurants r
       LEFT JOIN memberships m ON m.restaurant_id = r.id AND m.status = 'active'
       WHERE r.id = $1 AND r.status = 'active'
       GROUP BY r.id`,
      [restaurantId]
    )
    if (!restaurant) return reply.code(404).send({ error: 'Restaurant not found' })
    if (parseInt(restaurant.spots_remaining) <= 0) {
      return reply.code(409).send({ error: 'Sold out' })
    }
    if (!restaurant.stripe_account_id || !restaurant.stripe_onboarded) {
      return reply.code(400).send({ error: 'Restaurant not yet connected to payments' })
    }

    // Check member doesn't already have active membership here
    const existing = await db.findOne(
      `SELECT id FROM memberships
       WHERE restaurant_id = $1 AND member_id = $2 AND status = 'active'`,
      [restaurantId, req.user.id]
    )
    if (existing) return reply.code(409).send({ error: 'You already have an active membership here' })

    const price = parseFloat(restaurant.membership_price)
    const rainbackFee = Math.round(price * 0.05 * 100) // 5% in cents
    const total = Math.round(price * 1.05 * 100)       // total member pays in cents

    const intent = await createPaymentIntent({
      amount: total,
      currency: 'usd',
      restaurantStripeAccountId: restaurant.stripe_account_id,
      applicationFee: rainbackFee,
      metadata: {
        restaurantId,
        memberId: req.user.id,
        restaurantName: restaurant.name,
      },
    })

    return {
      clientSecret: intent.client_secret,
      amount: total / 100,
      price: price,
      fee: rainbackFee / 100,
    }
  })

  // ── POST /api/memberships/purchase ──────────────────
  // Called after successful Stripe payment
  app.post('/purchase', { preHandler: authenticate }, async (req, reply) => {
    const { restaurantId, stripePaymentIntentId } = req.body
    if (!restaurantId || !stripePaymentIntentId) {
      return reply.code(400).send({ error: 'restaurantId and stripePaymentIntentId required' })
    }

    // Verify payment with Stripe
    const payment = await confirmMembershipPayment(stripePaymentIntentId)
    if (payment.status !== 'succeeded') {
      return reply.code(400).send({ error: 'Payment not confirmed' })
    }

    const restaurant = await db.findOne(
      `SELECT r.*, r.membership_cap - COUNT(m.id) AS spots_remaining
       FROM restaurants r
       LEFT JOIN memberships m ON m.restaurant_id = r.id AND m.status = 'active'
       WHERE r.id = $1 GROUP BY r.id`,
      [restaurantId]
    )
    if (parseInt(restaurant.spots_remaining) <= 0) {
      return reply.code(409).send({ error: 'Sold out' })
    }

    // Assign next serial number
    const { rows: [{ max_serial }] } = await db.query(
      'SELECT COALESCE(MAX(serial_number), 0) AS max_serial FROM memberships WHERE restaurant_id = $1',
      [restaurantId]
    )
    const serialNumber = parseInt(max_serial) + 1

    const price = parseFloat(restaurant.membership_price)
    const fee = Math.round(price * 0.05 * 100) / 100
    const restaurantAmount = price - fee

    // Calculate valid_until
    const durationMap = { '1 year': 365, '6 months': 182, 'season': 91 }
    const days = durationMap[restaurant.membership_duration] || 365
    const validUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

    const membership = await db.findOne(
      `INSERT INTO memberships (
        restaurant_id, member_id, serial_number, tier,
        stripe_payment_id, amount_paid, rainback_fee, restaurant_amount,
        valid_until
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        restaurantId, req.user.id, serialNumber, restaurant.tier_name,
        stripePaymentIntentId, price, fee, restaurantAmount, validUntil,
      ]
    )

    // Generate Apple Wallet pass
    const member = await db.findOne(
      'SELECT first_name, last_name, email FROM users WHERE id = $1',
      [req.user.id]
    )
    const passUrl = await generateMemberPass({
      membership,
      restaurant,
      member,
    })

    if (passUrl) {
      await db.run(
        'UPDATE memberships SET pass_url = $1 WHERE id = $2',
        [passUrl, membership.id]
      )
      membership.pass_url = passUrl
    }

    return reply.code(201).send({
      membership,
      serialNumber,
      totalSold: serialNumber,
      cap: restaurant.membership_cap,
      passUrl,
    })
  })

  // ── GET /api/memberships/mine ────────────────────────
  // Member: get all their memberships
  app.get('/mine', { preHandler: authenticate }, async (req) => {
    const memberships = await db.findMany(
      `SELECT m.*, r.name AS restaurant_name, r.neighborhood, r.city,
              r.cuisine, r.cover_image_url, r.tier_name,
              m.valid_until,
              (SELECT COUNT(*) FROM check_ins ci WHERE ci.membership_id = m.id) AS visit_count
       FROM memberships m
       JOIN restaurants r ON r.id = m.restaurant_id
       WHERE m.member_id = $1 AND m.status = 'active'
       ORDER BY m.purchased_at DESC`,
      [req.user.id]
    )
    return memberships
  })

  // ── GET /api/memberships/:id/pass ───────────────────
  // Serve or regenerate the .pkpass file
  app.get('/:id/pass', { preHandler: authenticate }, async (req, reply) => {
    const membership = await db.findOne(
      `SELECT m.*, r.name AS restaurant_name, r.neighborhood, r.city, r.tier_name
       FROM memberships m
       JOIN restaurants r ON r.id = m.restaurant_id
       WHERE m.id = $1 AND m.member_id = $2`,
      [req.params.id, req.user.id]
    )
    if (!membership) return reply.code(404).send({ error: 'Membership not found' })

    return { passUrl: membership.pass_url }
  })

  // ── GET /api/memberships/restaurant/:restaurantId ───
  // Owner: list all members of their restaurant
  app.get('/restaurant/:restaurantId', { preHandler: requireOwner }, async (req, reply) => {
    const restaurant = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.restaurantId, req.user.id]
    )
    if (!restaurant) return reply.code(403).send({ error: 'Not your restaurant' })

    const members = await db.findMany(
      `SELECT m.id, m.serial_number, m.tier, m.status, m.purchased_at,
              m.valid_until, m.amount_paid,
              u.first_name, u.last_name, u.email, u.phone,
              (SELECT COUNT(*) FROM check_ins ci WHERE ci.membership_id = m.id) AS visit_count,
              (SELECT MAX(ci.checked_in_at) FROM check_ins ci WHERE ci.membership_id = m.id) AS last_visit
       FROM memberships m
       JOIN users u ON u.id = m.member_id
       WHERE m.restaurant_id = $1
       ORDER BY m.serial_number`,
      [req.params.restaurantId]
    )
    return members
  })

  // ── POST /api/memberships/demo-purchase ──────────────
  // Creates a membership WITHOUT real Stripe — for demo/testing only.
  // Works for the seed restaurants that have no Stripe Connect account.
  app.post('/demo-purchase', { preHandler: authenticate }, async (req, reply) => {
    const { restaurantId } = req.body
    if (!restaurantId) return reply.code(400).send({ error: 'restaurantId required' })

    const restaurant = await db.findOne(
      `SELECT r.*, r.membership_cap - COUNT(m.id) AS spots_remaining
       FROM restaurants r
       LEFT JOIN memberships m ON m.restaurant_id = r.id AND m.status = 'active'
       WHERE r.id = $1 GROUP BY r.id`,
      [restaurantId]
    )
    if (!restaurant) return reply.code(404).send({ error: 'Restaurant not found' })
    if (parseInt(restaurant.spots_remaining) <= 0) return reply.code(409).send({ error: 'Sold out' })

    // Already a member?
    const existing = await db.findOne(
      `SELECT id, serial_number FROM memberships WHERE restaurant_id = $1 AND member_id = $2 AND status = 'active'`,
      [restaurantId, req.user.id]
    )
    if (existing) {
      return reply.code(409).send({ error: 'You already have an active membership here', serialNumber: existing.serial_number })
    }

    const { rows: [{ max_serial }] } = await db.query(
      'SELECT COALESCE(MAX(serial_number), 0) AS max_serial FROM memberships WHERE restaurant_id = $1',
      [restaurantId]
    )
    const serialNumber = parseInt(max_serial) + 1
    const price = parseFloat(restaurant.membership_price)
    const fee = Math.round(price * 0.05 * 100) / 100
    const durationMap = { '1 year': 365, '6 months': 182, 'season': 91 }
    const days = durationMap[restaurant.membership_duration] || 365
    const validUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

    const membership = await db.findOne(
      `INSERT INTO memberships (
        restaurant_id, member_id, serial_number, tier,
        stripe_payment_id, amount_paid, rainback_fee, restaurant_amount, valid_until
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [restaurantId, req.user.id, serialNumber, restaurant.tier_name,
       'pi_demo_' + Date.now(), price, fee, price - fee, validUntil]
    )

    return reply.code(201).send({
      membership,
      serialNumber,
      cap: restaurant.membership_cap,
      restaurantName: restaurant.name,
    })
  })

}
