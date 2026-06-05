import bcrypt from 'bcryptjs'
import { db } from '../db/client.js'
import { authenticate } from '../middleware/auth.js'
import { sendOTP, sendWelcome } from '../services/email.js'

// In-memory OTP store (use Redis in production)
const otpStore = new Map()

export default async function authRoutes(app) {

  // ── POST /api/auth/signup ───────────────────────────
  app.post('/signup', async (req, reply) => {
    const { email, password, firstName, lastName, phone, role = 'member' } = req.body

    if (!email || !password || !firstName || !lastName) {
      return reply.code(400).send({ error: 'email, password, firstName, lastName required' })
    }

    const existing = await db.findOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
    if (existing) return reply.code(409).send({ error: 'Email already registered' })

    const hash = await bcrypt.hash(password, 12)
    const user = await db.findOne(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role`,
      [email.toLowerCase(), hash, firstName, lastName, phone || null, role]
    )

    const token = app.jwt.sign({ id: user.id, role: user.role })
    await sendWelcome(user)

    return reply.code(201).send({ token, user })
  })

  // ── POST /api/auth/login ────────────────────────────
  app.post('/login', async (req, reply) => {
    const { email, password } = req.body
    if (!email || !password) return reply.code(400).send({ error: 'email and password required' })

    const user = await db.findOne(
      'SELECT id, email, first_name, last_name, role, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    )
    if (!user) return reply.code(401).send({ error: 'Invalid email or password' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return reply.code(401).send({ error: 'Invalid email or password' })

    const token = app.jwt.sign({ id: user.id, role: user.role })
    const { password_hash, ...safeUser } = user
    return { token, user: safeUser }
  })

  // ── POST /api/auth/otp/send ─────────────────────────
  // Passwordless login — send OTP to email
  app.post('/otp/send', async (req, reply) => {
    const { email } = req.body
    if (!email) return reply.code(400).send({ error: 'email required' })

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    otpStore.set(email.toLowerCase(), { code, expires: Date.now() + 10 * 60 * 1000 })

    await sendOTP(email, code)
    return { message: 'OTP sent' }
  })

  // ── POST /api/auth/otp/verify ───────────────────────
  app.post('/otp/verify', async (req, reply) => {
    const { email, code, firstName, lastName } = req.body
    if (!email || !code) return reply.code(400).send({ error: 'email and code required' })

    const stored = otpStore.get(email.toLowerCase())
    if (!stored || stored.code !== code || Date.now() > stored.expires) {
      return reply.code(401).send({ error: 'Invalid or expired code' })
    }
    otpStore.delete(email.toLowerCase())

    // Get or create user
    let user = await db.findOne(
      'SELECT id, email, first_name, last_name, role FROM users WHERE email = $1',
      [email.toLowerCase()]
    )
    if (!user) {
      if (!firstName || !lastName) {
        return reply.code(400).send({ error: 'firstName and lastName required for new account', newUser: true })
      }
      user = await db.findOne(
        `INSERT INTO users (email, first_name, last_name) VALUES ($1, $2, $3)
         RETURNING id, email, first_name, last_name, role`,
        [email.toLowerCase(), firstName, lastName]
      )
      await sendWelcome(user)
    }

    const token = app.jwt.sign({ id: user.id, role: user.role })
    return { token, user }
  })

  // ── GET /api/auth/me ────────────────────────────────
  app.get('/me', { preHandler: authenticate }, async (req) => {
    const user = await db.findOne(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.created_at,
              COUNT(DISTINCT m.id) AS membership_count
       FROM users u
       LEFT JOIN memberships m ON m.member_id = u.id AND m.status = 'active'
       WHERE u.id = $1
       GROUP BY u.id`,
      [req.user.id]
    )
    return user
  })

  // ── PATCH /api/auth/me ──────────────────────────────
  app.patch('/me', { preHandler: authenticate }, async (req, reply) => {
    const { firstName, lastName, phone } = req.body
    const user = await db.findOne(
      `UPDATE users SET first_name = COALESCE($1, first_name),
                        last_name  = COALESCE($2, last_name),
                        phone      = COALESCE($3, phone)
       WHERE id = $4
       RETURNING id, email, first_name, last_name, phone, role`,
      [firstName, lastName, phone, req.user.id]
    )
    return user
  })
}
