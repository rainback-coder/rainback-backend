import { seedNYC } from '../db/seed-nyc.js'

export default async function adminRoutes(app) {

  // GET /api/admin/seed?secret=rainback2026
  // Visit this URL once in the browser to populate the database
  app.get('/seed', async (req, reply) => {
    if (req.query.secret !== 'rainback2026') {
      return reply.code(401).send({ error: 'Invalid secret' })
    }
    try {
      const results = await seedNYC()
      return {
        success: true,
        message: '🎉 NYC demo data seeded successfully',
        ...results
      }
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })
}
