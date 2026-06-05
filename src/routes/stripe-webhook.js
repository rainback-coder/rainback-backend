import { db } from '../db/client.js'
import { constructWebhookEvent } from '../services/stripe.js'
import { generateMemberPass } from '../services/passkit.js'

export default async function stripeWebhookRoutes(app) {

  // Stripe requires the raw body — add content-type parser here
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => done(null, body)
  )

  app.post('/stripe', async (req, reply) => {
    const sig = req.headers['stripe-signature']
    let event

    try {
      event = constructWebhookEvent(req.body, sig)
    } catch (err) {
      app.log.error('Webhook signature failed:', err.message)
      return reply.code(400).send({ error: `Webhook Error: ${err.message}` })
    }

    switch (event.type) {

      case 'payment_intent.succeeded': {
        const intent = event.data.object
        const { restaurantId, memberId } = intent.metadata
        if (!restaurantId || !memberId) break

        // Check if membership already created (idempotency)
        const existing = await db.findOne(
          'SELECT id FROM memberships WHERE stripe_payment_id = $1',
          [intent.id]
        )
        if (existing) break

        const restaurant = await db.findOne('SELECT * FROM restaurants WHERE id = $1', [restaurantId])
        const member = await db.findOne('SELECT * FROM users WHERE id = $1', [memberId])
        if (!restaurant || !member) break

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
          [restaurantId, memberId, serialNumber, restaurant.tier_name,
           intent.id, price, fee, price - fee, validUntil]
        )

        // Generate Apple Wallet pass
        const passUrl = await generateMemberPass({ membership, restaurant, member })
        if (passUrl) {
          await db.run('UPDATE memberships SET pass_url = $1 WHERE id = $2', [passUrl, membership.id])
        }

        app.log.info(`Membership created: ${member.first_name} ${member.last_name} → ${restaurant.name} #${serialNumber}`)
        break
      }

      case 'account.updated': {
        // Restaurant completed Stripe Connect onboarding
        const account = event.data.object
        if (account.details_submitted) {
          await db.run(
            'UPDATE restaurants SET stripe_onboarded = TRUE WHERE stripe_account_id = $1',
            [account.id]
          )
          app.log.info(`Restaurant onboarded to Stripe: ${account.id}`)
        }
        break
      }

      default:
        app.log.info(`Unhandled Stripe event: ${event.type}`)
    }

    return reply.send({ received: true })
  })
}
