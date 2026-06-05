import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pool from './client.js'
import 'dotenv/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  console.log('Running database migration...')
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')

  try {
    await pool.query(schema)
    console.log('✓ Schema applied successfully')
  } catch (err) {
    console.error('✗ Migration failed:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
