import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { testConnection } from './db/client.js'

// Routes
import authRoutes from './routes/auth.js'
import restaurantRoutes from './routes/restaurants.js'
import membershipRoutes from './routes/memberships.js'
import dashboardRoutes from './routes/dashboard.js'
import stripeWebhookRoutes from './routes/stripe-webhook.js'
import { eventRoutes, voteRoutes, noteRoutes, checkinRoutes, menuRoutes } from './routes/combined.js'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
  },
})

// ── PLUGINS ──
await app.register(cors, {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://rainback.com',
    'https://www.rainback.com',
    /\.rainback\.com$/,
  ],
  credentials: true,
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET,
  sign: { expiresIn: '30d' },
})

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
})

// Stripe webhook — raw body, register first
await app.register(stripeWebhookRoutes, { prefix: '/webhooks' })

// ── API ROUTES ──
await app.register(authRoutes,       { prefix: '/api/auth' })
await app.register(restaurantRoutes, { prefix: '/api/restaurants' })
await app.register(membershipRoutes, { prefix: '/api/memberships' })
await app.register(dashboardRoutes,  { prefix: '/api/dashboard' })
await app.register(eventRoutes,      { prefix: '/api/events' })
await app.register(voteRoutes,       { prefix: '/api/votes' })
await app.register(noteRoutes,       { prefix: '/api/notes' })
await app.register(checkinRoutes,    { prefix: '/api/checkin' })
await app.register(menuRoutes,       { prefix: '/api/menu' })

// ── HEALTH CHECK ──
app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

// ── ERROR HANDLER ──
app.setErrorHandler((err, request, reply) => {
  app.log.error(err)
  reply.code(err.statusCode || 500).send({
    error: err.message || 'Internal server error',
    statusCode: err.statusCode || 500,
  })
})

// ── START ──
async function start() {
  const dbOk = await testConnection()
  if (!dbOk) { console.error('Cannot connect to database. Exiting.'); process.exit(1) }

  const port = Number(process.env.PORT) || 3001
  await app.listen({ port, host: process.env.HOST || '0.0.0.0' })
  console.log(`\n🌧  Rainback API running on port ${port}`)
  console.log(`   Health: http://localhost:${port}/health\n`)
}

start().catch(err => { console.error(err); process.exit(1) })

export default app
