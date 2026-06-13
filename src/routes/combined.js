// ═══════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════
import { db } from '../db/client.js'
import { authenticate, requireOwner } from '../middleware/auth.js'

export async function eventRoutes(app) {

  // GET /api/events/restaurant/:restaurantId — member feed
  app.get('/restaurant/:restaurantId', { preHandler: authenticate }, async (req, reply) => {
    const membership = await db.findOne(
      'SELECT id FROM memberships WHERE restaurant_id = $1 AND member_id = $2 AND status = $3',
      [req.params.restaurantId, req.user.id, 'active']
    )
    if (!membership) return reply.code(403).send({ error: 'Membership required' })

    const events = await db.findMany(
      `SELECT e.*,
              (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id) AS rsvp_count,
              EXISTS(SELECT 1 FROM event_rsvps r WHERE r.event_id = e.id AND r.member_id = $2) AS i_rsvped
       FROM events e
       WHERE e.restaurant_id = $1 AND e.status = 'published' AND e.event_date >= NOW()
       ORDER BY e.event_date`,
      [req.params.restaurantId, req.user.id]
    )
    return events
  })

  // POST /api/events/:restaurantId — owner creates event
  app.post('/:restaurantId', { preHandler: requireOwner }, async (req, reply) => {
    const restaurant = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.restaurantId, req.user.id]
    )
    if (!restaurant) return reply.code(403).send({ error: 'Not your restaurant' })

    const { title, description, eventDate, capacity, audience, status } = req.body
    if (!title || !eventDate) return reply.code(400).send({ error: 'title and eventDate required' })

    const event = await db.findOne(
      `INSERT INTO events (restaurant_id, title, description, event_date, capacity, audience, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.restaurantId, title, description, eventDate, capacity || 20, audience || 'all', status || 'published']
    )
    return reply.code(201).send(event)
  })

  // POST /api/events/:eventId/rsvp — member RSVPs
  app.post('/:eventId/rsvp', { preHandler: authenticate }, async (req, reply) => {
    const event = await db.findOne(
      `SELECT e.*, (SELECT COUNT(*) FROM event_rsvps WHERE event_id = e.id) AS rsvp_count
       FROM events e WHERE e.id = $1`,
      [req.params.eventId]
    )
    if (!event) return reply.code(404).send({ error: 'Event not found' })
    if (parseInt(event.rsvp_count) >= event.capacity) {
      return reply.code(409).send({ error: 'Event is full' })
    }

    const membership = await db.findOne(
      'SELECT id FROM memberships WHERE restaurant_id = $1 AND member_id = $2 AND status = $3',
      [event.restaurant_id, req.user.id, 'active']
    )
    if (!membership) return reply.code(403).send({ error: 'Membership required' })

    try {
      await db.run(
        'INSERT INTO event_rsvps (event_id, member_id, membership_id) VALUES ($1,$2,$3)',
        [req.params.eventId, req.user.id, membership.id]
      )
      return { success: true }
    } catch (e) {
      if (e.code === '23505') return reply.code(409).send({ error: 'Already RSVPed' })
      throw e
    }
  })

  // DELETE /api/events/:eventId/rsvp — cancel RSVP
  app.delete('/:eventId/rsvp', { preHandler: authenticate }, async (req) => {
    await db.run(
      'DELETE FROM event_rsvps WHERE event_id = $1 AND member_id = $2',
      [req.params.eventId, req.user.id]
    )
    return { success: true }
  })

  // GET /api/events/:restaurantId/all — owner view all events
  app.get('/:restaurantId/all', { preHandler: requireOwner }, async (req, reply) => {
    const restaurant = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.restaurantId, req.user.id]
    )
    if (!restaurant) return reply.code(403).send({ error: 'Not your restaurant' })

    const events = await db.findMany(
      `SELECT e.*,
              (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id) AS rsvp_count
       FROM events e
       WHERE e.restaurant_id = $1
       ORDER BY e.event_date DESC`,
      [req.params.restaurantId]
    )
    return events
  })
}

// ═══════════════════════════════════════════════════════
// VOTES
// ═══════════════════════════════════════════════════════
export async function voteRoutes(app) {

  app.get('/restaurant/:restaurantId', { preHandler: authenticate }, async (req, reply) => {
    // Allow access if the user is an active member OR the owner of this restaurant
    const membership = await db.findOne(
      'SELECT id FROM memberships WHERE restaurant_id = $1 AND member_id = $2 AND status = $3',
      [req.params.restaurantId, req.user.id, 'active']
    )
    const isOwner = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.restaurantId, req.user.id]
    )
    if (!membership && !isOwner && req.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Membership required' })
    }

    const votes = await db.findMany(
      `SELECT v.*,
              json_agg(json_build_object(
                'id', vo.id, 'text', vo.text,
                'count', (SELECT COUNT(*) FROM vote_responses vr WHERE vr.vote_option_id = vo.id),
                'voted', EXISTS(SELECT 1 FROM vote_responses vr WHERE vr.vote_option_id = vo.id AND vr.member_id = $2)
              ) ORDER BY vo.sort_order) AS options,
              (SELECT COUNT(*) FROM vote_responses vr WHERE vr.vote_id = v.id) AS total_votes,
              EXISTS(SELECT 1 FROM vote_responses vr WHERE vr.vote_id = v.id AND vr.member_id = $2) AS i_voted
       FROM votes v
       JOIN vote_options vo ON vo.vote_id = v.id
       WHERE v.restaurant_id = $1
       GROUP BY v.id
       ORDER BY v.created_at DESC`,
      [req.params.restaurantId, req.user.id]
    )
    return votes
  })

  app.post('/:restaurantId', { preHandler: requireOwner }, async (req, reply) => {
    const r = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.restaurantId, req.user.id]
    )
    if (!r) return reply.code(403).send({ error: 'Not your restaurant' })

    const { question, options, closesAt } = req.body
    if (!question || !options?.length) return reply.code(400).send({ error: 'question and options required' })

    const vote = await db.findOne(
      'INSERT INTO votes (restaurant_id, question, closes_at) VALUES ($1,$2,$3) RETURNING *',
      [req.params.restaurantId, question, closesAt || null]
    )
    for (let i = 0; i < options.length; i++) {
      await db.run(
        'INSERT INTO vote_options (vote_id, text, sort_order) VALUES ($1,$2,$3)',
        [vote.id, options[i], i]
      )
    }
    return reply.code(201).send(vote)
  })

  app.post('/:voteId/respond', { preHandler: authenticate }, async (req, reply) => {
    const { optionId } = req.body
    if (!optionId) return reply.code(400).send({ error: 'optionId required' })

    const vote = await db.findOne('SELECT * FROM votes WHERE id = $1 AND status = $2', [req.params.voteId, 'live'])
    if (!vote) return reply.code(404).send({ error: 'Vote not found or closed' })

    const membership = await db.findOne(
      'SELECT id FROM memberships WHERE restaurant_id = $1 AND member_id = $2 AND status = $3',
      [vote.restaurant_id, req.user.id, 'active']
    )
    if (!membership) return reply.code(403).send({ error: 'Membership required' })

    try {
      await db.run(
        'INSERT INTO vote_responses (vote_id, vote_option_id, member_id) VALUES ($1,$2,$3)',
        [req.params.voteId, optionId, req.user.id]
      )
      return { success: true }
    } catch (e) {
      if (e.code === '23505') return reply.code(409).send({ error: 'Already voted' })
      throw e
    }
  })
}

// ═══════════════════════════════════════════════════════
// NOTES
// ═══════════════════════════════════════════════════════
export async function noteRoutes(app) {

  app.get('/restaurant/:restaurantId', { preHandler: authenticate }, async (req, reply) => {
    const membership = await db.findOne(
      'SELECT id FROM memberships WHERE restaurant_id = $1 AND member_id = $2 AND status = $3',
      [req.params.restaurantId, req.user.id, 'active']
    )
    if (!membership) return reply.code(403).send({ error: 'Membership required' })

    const notes = await db.findMany(
      'SELECT id, title, body, sent_at FROM notes WHERE restaurant_id = $1 AND sent_at IS NOT NULL ORDER BY sent_at DESC LIMIT 20',
      [req.params.restaurantId]
    )
    return notes
  })

  app.post('/:restaurantId', { preHandler: requireOwner }, async (req, reply) => {
    const r = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.restaurantId, req.user.id]
    )
    if (!r) return reply.code(403).send({ error: 'Not your restaurant' })

    const { title, body, audience } = req.body
    if (!title || !body) return reply.code(400).send({ error: 'title and body required' })

    const note = await db.findOne(
      `INSERT INTO notes (restaurant_id, title, body, audience, sent_at)
       VALUES ($1,$2,$3,$4,NOW()) RETURNING *`,
      [req.params.restaurantId, title, body, audience || 'all']
    )
    // TODO: trigger push notifications to members here
    return reply.code(201).send(note)
  })

  app.get('/:restaurantId/all', { preHandler: requireOwner }, async (req, reply) => {
    const r = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.restaurantId, req.user.id]
    )
    if (!r) return reply.code(403).send({ error: 'Not your restaurant' })

    const notes = await db.findMany(
      'SELECT * FROM notes WHERE restaurant_id = $1 ORDER BY created_at DESC',
      [req.params.restaurantId]
    )
    return notes
  })
}

// ═══════════════════════════════════════════════════════
// CHECK-IN
// ═══════════════════════════════════════════════════════
export async function checkinRoutes(app) {

  // POST /api/checkin — owner scans member's QR/NFC
  app.post('/', { preHandler: requireOwner }, async (req, reply) => {
    const { passSerial, restaurantId, partySize, method } = req.body
    if (!passSerial || !restaurantId) return reply.code(400).send({ error: 'passSerial and restaurantId required' })

    const restaurant = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [restaurantId, req.user.id]
    )
    if (!restaurant) return reply.code(403).send({ error: 'Not your restaurant' })

    const membership = await db.findOne(
      `SELECT m.*, u.first_name, u.last_name, u.email,
              r.name AS restaurant_name, r.tier_name
       FROM memberships m
       JOIN users u ON u.id = m.member_id
       JOIN restaurants r ON r.id = m.restaurant_id
       WHERE m.pass_serial = $1 AND m.restaurant_id = $2 AND m.status = 'active'`,
      [passSerial, restaurantId]
    )
    if (!membership) return reply.code(404).send({ error: 'Membership not found or inactive' })

    // Check membership hasn't expired
    if (membership.valid_until && new Date(membership.valid_until) < new Date()) {
      return reply.code(403).send({ error: 'Membership expired', memberName: `${membership.first_name} ${membership.last_name}` })
    }

    const checkin = await db.findOne(
      `INSERT INTO check_ins (membership_id, restaurant_id, member_id, party_size, method)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [membership.id, restaurantId, membership.member_id, partySize || 1, method || 'qr']
    )

    const visitCount = await db.findOne(
      'SELECT COUNT(*) AS count FROM check_ins WHERE membership_id = $1',
      [membership.id]
    )

    return {
      success: true,
      member: {
        firstName: membership.first_name,
        lastName: membership.last_name,
        serial: `№ ${String(membership.serial_number).padStart(3,'0')} / ${membership.membership_cap || 200}`,
        tier: membership.tier,
        visits: parseInt(visitCount.count),
        validUntil: membership.valid_until,
      },
      checkin,
    }
  })

  // GET /api/checkin/verify/:passSerial — fast QR verification
  app.get('/verify/:passSerial', { preHandler: requireOwner }, async (req, reply) => {
    const { restaurantId } = req.query
    const membership = await db.findOne(
      `SELECT m.id, m.serial_number, m.tier, m.valid_until,
              u.first_name, u.last_name,
              (SELECT COUNT(*) FROM check_ins ci WHERE ci.membership_id = m.id) AS visit_count
       FROM memberships m
       JOIN users u ON u.id = m.member_id
       WHERE m.pass_serial = $1 AND m.restaurant_id = $2 AND m.status = 'active'`,
      [req.params.passSerial, restaurantId]
    )
    if (!membership) return reply.code(404).send({ valid: false })

    return {
      valid: true,
      memberName: `${membership.first_name} ${membership.last_name}`,
      serial: membership.serial_number,
      tier: membership.tier,
      visits: parseInt(membership.visit_count),
    }
  })
}

// ═══════════════════════════════════════════════════════
// MENU
// ═══════════════════════════════════════════════════════
export async function menuRoutes(app) {

  // GET /api/menu/:restaurantId — public menu for members
  app.get('/:restaurantId', async (req, reply) => {
    const dishes = await db.findMany(
      `SELECT id, name, description, category, price, nutrition_mode,
              kcal, protein_g, fat_g, carbs_g
       FROM menu_dishes
       WHERE restaurant_id = $1 AND is_visible = TRUE
       ORDER BY category, sort_order`,
      [req.params.restaurantId]
    )
    return dishes
  })

  // POST /api/menu/:restaurantId — owner adds dish
  app.post('/:restaurantId', { preHandler: requireOwner }, async (req, reply) => {
    const r = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.restaurantId, req.user.id]
    )
    if (!r) return reply.code(403).send({ error: 'Not your restaurant' })

    const {
      name, description, category, price, nutritionMode,
      aiIngredients, aiPortion, kcal, proteinG, fatG, carbsG,
      ingredients, // array for precise mode: [{name, grams}]
    } = req.body

    if (!name) return reply.code(400).send({ error: 'name required' })

    const dish = await db.findOne(
      `INSERT INTO menu_dishes (
        restaurant_id, name, description, category, price,
        nutrition_mode, ai_ingredients, ai_portion,
        kcal, protein_g, fat_g, carbs_g
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        req.params.restaurantId, name, description, category || 'Main',
        price || null, nutritionMode || 'ai', aiIngredients, aiPortion || 'medium',
        kcal, proteinG, fatG, carbsG,
      ]
    )

    // Save precise ingredients if provided
    if (ingredients?.length) {
      for (let i = 0; i < ingredients.length; i++) {
        await db.run(
          'INSERT INTO menu_ingredients (dish_id, name, grams, sort_order) VALUES ($1,$2,$3,$4)',
          [dish.id, ingredients[i].name, ingredients[i].grams, i]
        )
      }
    }

    return reply.code(201).send(dish)
  })

  // PATCH /api/menu/:restaurantId/:dishId
  app.patch('/:restaurantId/:dishId', { preHandler: requireOwner }, async (req, reply) => {
    const r = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.restaurantId, req.user.id]
    )
    if (!r) return reply.code(403).send({ error: 'Not your restaurant' })

    const { name, description, category, price, kcal, proteinG, fatG, carbsG, isVisible } = req.body
    const dish = await db.findOne(
      `UPDATE menu_dishes SET
        name        = COALESCE($1, name),
        description = COALESCE($2, description),
        category    = COALESCE($3, category),
        price       = COALESCE($4, price),
        kcal        = COALESCE($5, kcal),
        protein_g   = COALESCE($6, protein_g),
        fat_g       = COALESCE($7, fat_g),
        carbs_g     = COALESCE($8, carbs_g),
        is_visible  = COALESCE($9, is_visible)
       WHERE id = $10 AND restaurant_id = $11 RETURNING *`,
      [name, description, category, price, kcal, proteinG, fatG, carbsG, isVisible, req.params.dishId, req.params.restaurantId]
    )
    return dish
  })

  // DELETE /api/menu/:restaurantId/:dishId
  app.delete('/:restaurantId/:dishId', { preHandler: requireOwner }, async (req, reply) => {
    const r = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.restaurantId, req.user.id]
    )
    if (!r) return reply.code(403).send({ error: 'Not your restaurant' })

    await db.run(
      'DELETE FROM menu_dishes WHERE id = $1 AND restaurant_id = $2',
      [req.params.dishId, req.params.restaurantId]
    )
    return { success: true }
  })
}
