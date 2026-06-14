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

// ── AUTO-MIGRATE ON STARTUP ──────────────────────────
async function runMigrations() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
  try {
    const schema = readFileSync(join(__dirname, 'db/schema.sql'), 'utf8')
    // Try the whole schema first (works on a fresh database)
    try {
      await pool.query(schema)
      console.log('✓ Full schema applied')
    } catch (err) {
      // On an existing database, the CREATE TABLEs error with "already exists"
      // and stop the rest. So we separately guarantee the columns added later.
      console.log('✓ Schema already exists — ensuring later migrations')
    }
    // ALWAYS ensure these run, even if the schema above stopped early.
    // These are idempotent (IF NOT EXISTS) so they're safe to run every boot.
    const ensures = [
      'ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7)',
      'ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)',
      "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS stripe_account_id TEXT",
      "ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS stripe_onboarded BOOLEAN DEFAULT FALSE",
      "ALTER TABLE menu_dishes DROP CONSTRAINT IF EXISTS menu_dishes_category_check",
      "ALTER TABLE menu_dishes ADD CONSTRAINT menu_dishes_category_check CHECK (category IN ('Starter','Main','Side','Dessert','Drink','Pasta','Pizza'))",
      `CREATE TABLE IF NOT EXISTS member_meals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        dish_id UUID REFERENCES menu_dishes(id) ON DELETE SET NULL,
        dish_name TEXT NOT NULL,
        calories INTEGER DEFAULT 0, protein INTEGER DEFAULT 0,
        carbs INTEGER DEFAULT 0, fat INTEGER DEFAULT 0,
        eaten_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      "CREATE INDEX IF NOT EXISTS idx_member_meals_member ON member_meals(member_id, eaten_at)",
    ]
    for (const stmt of ensures) {
      try { await pool.query(stmt) } catch (e) { console.error('ensure:', e.message.slice(0,100)) }
    }
    console.log('✓ Critical columns ensured (latitude, longitude, stripe)')
  } catch (err) {
    console.error('Migration error:', err.message)
  } finally {
    await pool.end()
  }
}

// ── ROUTES ───────────────────────────────────────────
import authRoutes from './routes/auth.js'
import restaurantRoutes from './routes/restaurants.js'
import membershipRoutes from './routes/memberships.js'
import dashboardRoutes from './routes/dashboard.js'
import stripeWebhookRoutes from './routes/stripe-webhook.js'
import adminRoutes from './routes/admin.js'
import { eventRoutes, voteRoutes, noteRoutes, checkinRoutes, menuRoutes, mealRoutes } from './routes/combined.js'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  },
})

// ── CORS ─────────────────────────────────────────────
await app.register(cors, {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://rainback.com',
    'https://www.rainback.com',
    'https://rainback.club',
    'https://www.rainback.club',
    /\.rainback\.com$/,
    /\.rainback\.club$/,
    /\.vercel\.app$/,
  ],
  credentials: true,
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'fallback-dev-secret-change-in-production',
  sign: { expiresIn: '30d' },
})

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
})

// ── STRIPE WEBHOOK (raw body — before JSON parser) ───
await app.register(stripeWebhookRoutes, { prefix: '/webhooks' })

// ── API ROUTES ───────────────────────────────────────
await app.register(authRoutes,       { prefix: '/api/auth' })
await app.register(restaurantRoutes, { prefix: '/api/restaurants' })
await app.register(membershipRoutes, { prefix: '/api/memberships' })
await app.register(dashboardRoutes,  { prefix: '/api/dashboard' })
await app.register(eventRoutes,      { prefix: '/api/events' })
await app.register(voteRoutes,       { prefix: '/api/votes' })
await app.register(noteRoutes,       { prefix: '/api/notes' })
await app.register(checkinRoutes,    { prefix: '/api/checkin' })
await app.register(menuRoutes,       { prefix: '/api/menu' })
await app.register(mealRoutes,       { prefix: '/api/meals' })
await app.register(adminRoutes,      { prefix: '/api/admin' })

// ── HEALTH ───────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

// ── ERROR HANDLER ────────────────────────────────────
app.setErrorHandler((err, request, reply) => {
  app.log.error(err)
  reply.code(err.statusCode || 500).send({
    error: err.message || 'Internal server error',
    statusCode: err.statusCode || 500,
  })
})

// ── START ────────────────────────────────────────────
async function start() {
  await runMigrations()

  const dbOk = await testConnection()
  if (!dbOk) {
    console.error('Cannot connect to database. Exiting.')
    process.exit(1)
  }

  const port = Number(process.env.PORT) || 3001
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`\n🌧  Rainback API running on port ${port}\n`)
}

start().catch(err => { console.error(err); process.exit(1) })

export default app
