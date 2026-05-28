import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { testConnection } from './db/client.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── AUTO-MIGRATE ON STARTUP ──
async function runMigrations() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  try {
    const schema = readFileSync(join(__dirname, 'db/schema.sql'), 'utf8')
    await pool.query(schema)
    console.log('✓ Migrations applied')
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('✓ Schema already up to date')
    } else {
      console.error('Migration error:', err.message)
    }
  } finally {
    await pool.end()
  }
}

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

await app.register(cors, {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://rainback.com',
    'https://www.rainback.com',
    'https://rainback.club',
    'https://www.rainback.club',
    /\.rainback\.com$/,
    /\.rainback\.club$/,
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

await app.register(stripeWebhookRoutes, { prefix: '/webhooks' })
await app.register(authRoutes,       { prefix: '/api/auth' })
await app.register(restaurantRoutes, { prefix: '/api/restaurants' })
await app.register(membershipRoutes, { prefix: '/api/memberships' })
await app.register(dashboardRoutes,  { prefix: '/api/dashboard' })
await app.register(eventRoutes,      { prefix: '/api/events' })
await app.register(voteRoutes,       { prefix: '/api/votes' })
await app.register(noteRoutes,       { prefix: '/api/notes' })
await app.register(checkinRoutes,    { prefix: '/api/checkin' })
await app.register(menuRoutes,       { prefix: '/api/menu' })

app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

app.setErrorHandler((err, request, reply) => {
  app.log.error(err)
  reply.code(err.statusCode || 500).send({
    error: err.message || 'Internal server error',
    statusCode: err.statusCode || 500,
  })
})

async function start() {
  // Run migrations first
  await runMigrations()

  const dbOk = await testConnection()
  if (!dbOk) { console.error('Cannot connect to database. Exiting.'); process.exit(1) }

  const port = Number(process.env.PORT) || 3001
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`\n🌧  Rainback API running on port ${port}\n`)
}

start().catch(err => { console.error(err); process.exit(1) })

export default app
