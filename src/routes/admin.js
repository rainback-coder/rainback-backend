import { seedNYC } from '../db/seed-nyc.js'
import { seedLimoncello } from '../db/seed-limoncello.js'
import { seedMiami } from '../db/seed-miami.js'
import { db } from '../db/client.js'
import { requireAdmin } from '../middleware/auth.js'

export default async function adminRoutes(app) {

  // ── SEED ENDPOINTS (browser, secret-protected) ──────
  app.get('/seed', async (req, reply) => {
    if (req.query.secret !== 'rainback2026') return reply.code(401).send({ error: 'Invalid secret' })
    try { return { success: true, ...(await seedNYC()) } }
    catch (err) { return reply.code(500).send({ error: err.message }) }
  })
  app.get('/seed-limoncello', async (req, reply) => {
    if (req.query.secret !== 'rainback2026') return reply.code(401).send({ error: 'Invalid secret' })
    try { return { success: true, ...(await seedLimoncello()) } }
    catch (err) { return reply.code(500).send({ error: err.message }) }
  })
  app.get('/seed-miami', async (req, reply) => {
    if (req.query.secret !== 'rainback2026') return reply.code(401).send({ error: 'Invalid secret' })
    try { return { success: true, ...(await seedMiami()) } }
    catch (err) { return reply.code(500).send({ error: err.message }) }
  })

  // ── MAKE-ADMIN (one-time, secret-protected) ─────────
  // Promote a user to admin so they can log into the admin panel.
  // Visit once: /api/admin/make-admin?secret=rainback2026&email=you@email.com
  app.get('/make-admin', async (req, reply) => {
    if (req.query.secret !== 'rainback2026') return reply.code(401).send({ error: 'Invalid secret' })
    const email = req.query.email
    if (!email) return reply.code(400).send({ error: 'email required' })
    const user = await db.findOne(
      `UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, role`,
      [email]
    )
    if (!user) return reply.code(404).send({ error: 'No user with that email. Sign up first, then run this.' })
    return { success: true, message: email + ' is now an admin', user }
  })

  // ── ADMIN: list all restaurants (any status) ────────
  app.get('/restaurants', { preHandler: requireAdmin }, async (req, reply) => {
    const restaurants = await db.findMany(
      `SELECT r.id, r.name, r.slug, r.neighborhood, r.city, r.cuisine,
              r.status, r.membership_price, r.membership_cap,
              r.stripe_onboarded, r.created_at,
              u.first_name, u.last_name, u.email AS owner_email,
              COUNT(m.id) AS members_sold
       FROM restaurants r
       JOIN users u ON u.id = r.owner_id
       LEFT JOIN memberships m ON m.restaurant_id = r.id AND m.status = 'active'
       GROUP BY r.id, u.first_name, u.last_name, u.email
       ORDER BY
         CASE r.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
         r.created_at DESC`
    )
    return restaurants
  })

  // ── ADMIN: change a restaurant's status (activate, pause, close) ──
  app.patch('/restaurants/:id/status', { preHandler: requireAdmin }, async (req, reply) => {
    const { status } = req.body
    const allowed = ['pending', 'active', 'paused', 'closed']
    if (!allowed.includes(status)) return reply.code(400).send({ error: 'Invalid status' })
    const r = await db.findOne(
      `UPDATE restaurants SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, status`,
      [status, req.params.id]
    )
    if (!r) return reply.code(404).send({ error: 'Restaurant not found' })
    return { success: true, restaurant: r }
  })

  // ── ADMIN: dashboard counts ─────────────────────────
  app.get('/stats', { preHandler: requireAdmin }, async (req, reply) => {
    const stats = await db.findOne(
      `SELECT
         (SELECT COUNT(*) FROM restaurants WHERE status = 'pending') AS pending,
         (SELECT COUNT(*) FROM restaurants WHERE status = 'active') AS active,
         (SELECT COUNT(*) FROM restaurants) AS total_restaurants,
         (SELECT COUNT(*) FROM memberships WHERE status = 'active') AS total_members,
         (SELECT COALESCE(SUM(rainback_fee),0) FROM memberships) AS total_revenue`
    )
    return stats
  })
}
