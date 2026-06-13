import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err)
})

export const db = {
  query: (text, params) => pool.query(text, params),

  // Shorthand helpers
  findOne: async (text, params) => {
    const { rows } = await pool.query(text, params)
    return rows[0] || null
  },

  findMany: async (text, params) => {
    const { rows } = await pool.query(text, params)
    return rows
  },

  run: async (text, params) => {
    const result = await pool.query(text, params)
    return result
  },
}

export async function testConnection() {
  try {
    const { rows } = await pool.query('SELECT NOW()')
    console.log('✓ Database connected:', rows[0].now)
    return true
  } catch (err) {
    console.error('✗ Database connection failed:', err.message)
    return false
  }
}

export default pool
