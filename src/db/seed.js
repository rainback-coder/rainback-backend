// ═══════════════════════════════════════════════════════
// RAINBACK — Seed File
// Creates test data for local development
// Run: npm run db:seed
// ═══════════════════════════════════════════════════════
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import pool, { db } from './client.js'

async function seed() {
  console.log('Seeding database...\n')

  // ── OWNER ──────────────────────────────────────────
  const ownerHash = await bcrypt.hash('test1234', 12)
  const owner = await db.findOne(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1, $2, $3, $4, 'owner')
     ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
     RETURNING *`,
    ['owner@test.com', ownerHash, 'Matteo', 'Caprioli']
  )
  console.log(`✓ Owner: ${owner.email} / password: test1234`)

  // ── MEMBER ─────────────────────────────────────────
  const memberHash = await bcrypt.hash('test1234', 12)
  const member = await db.findOne(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1, $2, $3, $4, 'member')
     ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
     RETURNING *`,
    ['member@test.com', memberHash, 'Sofia', 'Marchetti']
  )
  console.log(`✓ Member: ${member.email} / password: test1234`)

  // ── RESTAURANT ─────────────────────────────────────
  const restaurant = await db.findOne(
    `INSERT INTO restaurants (
       owner_id, name, slug, neighborhood, city, country,
       cuisine, description, membership_cap, membership_price,
       membership_duration, tier_name, status, founding_story
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [
      owner.id,
      'Doya', 'doya-miami', 'Wynwood', 'Miami', 'US',
      'Aegean · Live fire · Seafood',
      'Aegean cuisine with live fire cooking in the heart of Wynwood.',
      200, 150.00, '1 year', 'Founding Member', 'active',
      'We opened Doya in 2021 with one idea: bring the fire of the Aegean coast to Miami.',
    ]
  )
  console.log(`✓ Restaurant: ${restaurant.name} (${restaurant.slug})`)

  // ── PERKS ──────────────────────────────────────────
  const perks = [
    { name: 'Priority reservations', description: 'Guaranteed table — even Friday nights in season', order: 0 },
    { name: 'Your table, by name', description: 'Reserved on every visit — no request needed', order: 1 },
    { name: 'Two private dinners with the Chef', description: 'Per year — kitchen table or terrace — members only', order: 2 },
    { name: 'Seasonal menu preview', description: 'First look at new menus before public launch', order: 3 },
    { name: 'Voting rights on menu additions', description: 'Members vote on which dishes make the summer menu', order: 4 },
    { name: 'Private events across the group', description: 'Exclusive invitations to partner venues', order: 5 },
    { name: 'Founding Member status — forever', description: 'Your number is yours, sealed on the day you joined', order: 6 },
  ]
  for (const p of perks) {
    await db.run(
      `INSERT INTO perks (restaurant_id, name, description, sort_order)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [restaurant.id, p.name, p.description, p.order]
    )
  }
  console.log(`✓ Perks: ${perks.length} added`)

  // ── MEMBERSHIP ─────────────────────────────────────
  const membership = await db.findOne(
    `INSERT INTO memberships (
       restaurant_id, member_id, serial_number, tier,
       stripe_payment_id, amount_paid, rainback_fee, restaurant_amount,
       valid_until, pass_serial, pass_auth_token
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,uuid_generate_v4()::text,uuid_generate_v4()::text)
     ON CONFLICT (restaurant_id, serial_number) DO NOTHING
     RETURNING *`,
    [
      restaurant.id, member.id, 1, 'Founding Member',
      'pi_test_seed_001', 150.00, 7.50, 142.50,
      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    ]
  )
  if (membership) console.log(`✓ Membership: ${member.first_name} → ${restaurant.name} #001`)

  // ── EVENT ──────────────────────────────────────────
  const event = await db.findOne(
    `INSERT INTO events (restaurant_id, title, description, event_date, capacity)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [
      restaurant.id,
      "Chef's evening — Summer preview",
      "Five courses. The kitchen comes out for each plate. Members + one guest.",
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      20,
    ]
  )
  console.log(`✓ Event: ${event.title}`)

  // ── VOTE ───────────────────────────────────────────
  const vote = await db.findOne(
    `INSERT INTO votes (restaurant_id, question, closes_at)
     VALUES ($1,$2,$3) RETURNING *`,
    [
      restaurant.id,
      'What should we add to the summer menu?',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ]
  )
  await db.run(
    `INSERT INTO vote_options (vote_id, text, sort_order) VALUES ($1,$2,$3),($1,$4,$5)`,
    [vote.id, 'Charred octopus, fava, dill', 0, 'Lamb kebab, smoked yogurt', 1]
  )
  console.log(`✓ Vote: ${vote.question}`)

  // ── MENU DISHES ────────────────────────────────────
  const dishes = [
    { name: 'Charred octopus, fava, dill', cat: 'Starter', kcal: 380, p: 28, f: 14, c: 22 },
    { name: 'Lamb kebab, smoked yogurt',   cat: 'Main',    kcal: 540, p: 38, f: 28, c: 18 },
    { name: 'Wild greens, feta, pomegranate', cat: 'Starter', kcal: 220, p: 9, f: 14, c: 18 },
    { name: 'Baklava, pistachio, rosewater',  cat: 'Dessert', kcal: 290, p: 5, f: 14, c: 38 },
  ]
  for (const d of dishes) {
    await db.run(
      `INSERT INTO menu_dishes (restaurant_id, name, category, nutrition_mode, kcal, protein_g, fat_g, carbs_g)
       VALUES ($1,$2,$3,'precise',$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [restaurant.id, d.name, d.cat, d.kcal, d.p, d.f, d.c]
    )
  }
  console.log(`✓ Menu: ${dishes.length} dishes`)

  // ── NOTE ───────────────────────────────────────────
  await db.run(
    `INSERT INTO notes (restaurant_id, title, body, sent_at)
     VALUES ($1,$2,$3,NOW())`,
    [
      restaurant.id,
      'New wine list is here',
      'Spent the week with a small grower in the Peloponnese. Six bottles you can\'t find anywhere else. First pour on us, Wednesday night.',
    ]
  )
  console.log(`✓ Note: New wine list`)

  console.log('\n─────────────────────────────────────────')
  console.log('Seed complete. Test credentials:')
  console.log('  Owner:  owner@test.com  / test1234')
  console.log('  Member: member@test.com / test1234')
  console.log(`  Restaurant slug: doya-miami`)
  console.log(`  Restaurant ID:   ${restaurant.id}`)
  console.log('─────────────────────────────────────────\n')

  await pool.end()
}

seed().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
