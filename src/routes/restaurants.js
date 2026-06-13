import { db } from '../db/client.js'
import { authenticate, requireOwner } from '../middleware/auth.js'
import { createStripeConnectAccount, getOnboardingLink } from '../services/stripe.js'

export default async function restaurantRoutes(app) {

  // ── GET /api/restaurants ────────────────────────────
  // Public: list active restaurants (for Discover map)
  app.get('/', async (req) => {
    const { city, lat, lng } = req.query

    const restaurants = await db.findMany(
      `SELECT r.id, r.name, r.slug, r.neighborhood, r.city, r.cuisine,
              r.cover_image_url, r.membership_price, r.membership_cap,
              r.tier_name, r.description, r.latitude, r.longitude,
              r.membership_cap - COUNT(m.id) AS spots_remaining,
              COUNT(m.id) AS sold
       FROM restaurants r
       LEFT JOIN memberships m ON m.restaurant_id = r.id AND m.status = 'active'
       WHERE r.status = 'active'
         AND ($1::text IS NULL OR r.city ILIKE $1)
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [city || null]
    )

    return restaurants
  })

  // ── GET /api/restaurants/mine/owner ─────────────────
  // Returns the restaurant owned by the logged-in owner.
  // MUST be declared before GET /:slug so "mine" isn't treated as a slug.
  app.get('/mine/owner', { preHandler: authenticate }, async (req, reply) => {
    const restaurant = await db.findOne(
      `SELECT r.*, r.membership_cap - COUNT(m.id) AS spots_remaining,
              COUNT(m.id) AS sold
       FROM restaurants r
       LEFT JOIN memberships m ON m.restaurant_id = r.id AND m.status = 'active'
       WHERE r.owner_id = $1
       GROUP BY r.id
       ORDER BY r.created_at ASC
       LIMIT 1`,
      [req.user.id]
    )
    if (!restaurant) return reply.code(404).send({ error: 'No restaurant found for this owner' })
    return restaurant
  })

  // ── GET /api/restaurants/:slug ──────────────────────
  // Public: single restaurant with perks
  app.get('/:slug', async (req, reply) => {
    const restaurant = await db.findOne(
      `SELECT r.id, r.name, r.slug, r.neighborhood, r.city, r.cuisine,
              r.cover_image_url, r.logo_url, r.description, r.founding_story,
              r.membership_price, r.membership_cap, r.membership_duration,
              r.tier_name, r.founded_year,
              r.membership_cap - COUNT(m.id) AS spots_remaining
       FROM restaurants r
       LEFT JOIN memberships m ON m.restaurant_id = r.id AND m.status = 'active'
       WHERE r.slug = $1 AND r.status = 'active'
       GROUP BY r.id`,
      [req.params.slug]
    )
    if (!restaurant) return reply.code(404).send({ error: 'Restaurant not found' })

    const perks = await db.findMany(
      'SELECT id, name, description FROM perks WHERE restaurant_id = $1 AND is_active = TRUE ORDER BY sort_order',
      [restaurant.id]
    )

    return { ...restaurant, perks }
  })

  // ── POST /api/restaurants ───────────────────────────
  // Owner: create their restaurant (with perks)
  app.post('/', { preHandler: requireOwner }, async (req, reply) => {
    const {
      name, neighborhood, city, country, address, cuisine, instagram,
      description, membershipCap, membershipPrice, membershipDuration,
      tierName, foundingStory, foundedYear, perks,
    } = req.body

    if (!name || !city) return reply.code(400).send({ error: 'name and city required' })

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-') + '-' + city.toLowerCase().replace(/\s+/g, '-')

    const restaurant = await db.findOne(
      `INSERT INTO restaurants (
        owner_id, name, slug, neighborhood, city, country, address,
        cuisine, instagram, description, membership_cap, membership_price,
        membership_duration, tier_name, founding_story, founded_year, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'active')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [
        req.user.id, name, slug, neighborhood, city, country || 'US', address,
        cuisine, instagram, description, membershipCap || 200, membershipPrice || 150,
        membershipDuration || '1 year', tierName || 'Founding Member',
        foundingStory, foundedYear,
      ]
    )

    // Create the perks the owner chose
    if (Array.isArray(perks) && perks.length) {
      for (let i = 0; i < perks.length; i++) {
        const p = perks[i]
        const pName = typeof p === 'string' ? p : (p.name || '')
        const pDesc = typeof p === 'string' ? p : (p.description || p.name || '')
        if (!pName) continue
        await db.run(
          `INSERT INTO perks (restaurant_id, name, description, sort_order)
           VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [restaurant.id, pName, pDesc, i]
        )
      }
    }

    return reply.code(201).send(restaurant)
  })

  // ── PATCH /api/restaurants/:id ──────────────────────
  // Owner: update restaurant settings
  app.patch('/:id', { preHandler: requireOwner }, async (req, reply) => {
    const r = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    )
    if (!r) return reply.code(403).send({ error: 'Not your restaurant' })

    const {
      name, neighborhood, description, cuisine, instagram, address,
      membershipCap, membershipPrice, membershipDuration, tierName,
      foundingStory, status,
    } = req.body

    const updated = await db.findOne(
      `UPDATE restaurants SET
        name               = COALESCE($1,  name),
        neighborhood       = COALESCE($2,  neighborhood),
        description        = COALESCE($3,  description),
        cuisine            = COALESCE($4,  cuisine),
        instagram          = COALESCE($5,  instagram),
        address            = COALESCE($6,  address),
        membership_cap     = COALESCE($7,  membership_cap),
        membership_price   = COALESCE($8,  membership_price),
        membership_duration= COALESCE($9,  membership_duration),
        tier_name          = COALESCE($10, tier_name),
        founding_story     = COALESCE($11, founding_story),
        status             = COALESCE($12, status)
       WHERE id = $13 RETURNING *`,
      [name, neighborhood, description, cuisine, instagram, address,
       membershipCap, membershipPrice, membershipDuration, tierName,
       foundingStory, status, req.params.id]
    )

    return updated
  })

  // ── PUT /api/restaurants/:id/perks ──────────────────
  // Owner: replace their perks list (from the perks page)
  app.put('/:id/perks', { preHandler: requireOwner }, async (req, reply) => {
    const r = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    )
    if (!r) return reply.code(403).send({ error: 'Not your restaurant' })

    const { perks } = req.body
    if (!Array.isArray(perks)) return reply.code(400).send({ error: 'perks array required' })

    // Replace the whole set
    await db.run('DELETE FROM perks WHERE restaurant_id = $1', [r.id])
    for (let i = 0; i < perks.length; i++) {
      const p = perks[i]
      const name = typeof p === 'string' ? p : (p.name || '')
      const desc = typeof p === 'string' ? p : (p.description || p.name || '')
      if (!name) continue
      await db.run(
        `INSERT INTO perks (restaurant_id, name, description, sort_order, is_active)
         VALUES ($1,$2,$3,$4,TRUE)`,
        [r.id, name, desc, i]
      )
    }
    const saved = await db.findMany(
      'SELECT id, name, description FROM perks WHERE restaurant_id = $1 ORDER BY sort_order',
      [r.id]
    )
    return { success: true, perks: saved }
  })

  // ── POST /api/restaurants/:id/stripe-connect ────────
  // Owner: start Stripe Connect onboarding
  app.post('/:id/stripe-connect', { preHandler: requireOwner }, async (req, reply) => {
    const r = await db.findOne(
      'SELECT id, name, stripe_account_id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    )
    if (!r) return reply.code(403).send({ error: 'Not your restaurant' })

    // Stripe must be configured for payouts to work
    if (!process.env.STRIPE_SECRET_KEY) {
      return reply.code(503).send({ error: 'Payouts are not switched on yet. Add your Stripe key to enable bank setup.' })
    }

    try {
      let accountId = r.stripe_account_id
      if (!accountId) {
        accountId = await createStripeConnectAccount(req.user.email, r.name)
        await db.run('UPDATE restaurants SET stripe_account_id = $1 WHERE id = $2', [accountId, r.id])
      }
      const link = await getOnboardingLink(
        accountId,
        `${process.env.FRONTEND_URL}/owner`,
        `${process.env.FRONTEND_URL}/owner`
      )
      return { url: link }
    } catch (err) {
      req.log.error('stripe-connect: ' + err.message)
      return reply.code(502).send({ error: 'Could not reach Stripe. Check that Stripe Connect is enabled and the key is valid.' })
    }
  })

  // ── GET /api/restaurants/:id/mine ───────────────────
  // Owner: get their own restaurant (full data)
  app.get('/:id/mine', { preHandler: requireOwner }, async (req, reply) => {
    const r = await db.findOne(
      'SELECT * FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    )
    if (!r) return reply.code(403).send({ error: 'Not your restaurant' })

    const perks = await db.findMany(
      'SELECT * FROM perks WHERE restaurant_id = $1 ORDER BY sort_order',
      [r.id]
    )
    return { ...r, perks }
  })

  // ── POST /api/restaurants/apply ─────────────────────
  // Public: landing page application form
  app.post('/apply', async (req, reply) => {
    const {
      restaurantName, neighborhood, city, cuisine, instagram, address,
      firstName, lastName, role, email, phone, referral,
      membershipCap, membershipPrice, duration, perks, customPerk,
    } = req.body

    if (!restaurantName || !firstName || !lastName || !email) {
      return reply.code(400).send({ error: 'restaurantName, firstName, lastName, email required' })
    }

    const app_record = await db.findOne(
      `INSERT INTO restaurant_applications (
        restaurant_name, neighborhood, city, cuisine, instagram, address,
        first_name, last_name, role, email, phone, referral,
        membership_cap, membership_price, duration, perks, custom_perk
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [restaurantName, neighborhood, city, cuisine, instagram, address,
       firstName, lastName, role, email, phone, referral,
       membershipCap, membershipPrice, duration, perks, customPerk]
    )

    return reply.code(201).send({ id: app_record.id, message: 'Application received. We will be in touch within 24 hours.' })
  })
}
