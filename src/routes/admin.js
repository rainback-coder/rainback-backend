import { seedNYC } from '../db/seed-nyc.js'
import { seedLimoncello } from '../db/seed-limoncello.js'

export default async function adminRoutes(app) {

  // GET /api/admin/seed?secret=rainback2026
  app.get('/seed', async (req, reply) => {
    if (req.query.secret !== 'rainback2026') {
      return reply.code(401).send({ error: 'Invalid secret' })
    }
    try {
      const results = await seedNYC()
      return { success: true, message: '🎉 NYC demo data seeded successfully', ...results }
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })

  // GET /api/admin/seed-limoncello?secret=rainback2026
  // Adds the real Limoncello Miami Beach restaurant + owner login
  app.get('/seed-limoncello', async (req, reply) => {
    if (req.query.secret !== 'rainback2026') {
      return reply.code(401).send({ error: 'Invalid secret' })
    }
    try {
      const results = await seedLimoncello()
      return { success: true, message: '🍋 Limoncello Miami Beach added successfully', ...results }
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })
}
