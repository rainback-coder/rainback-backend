// ═══════════════════════════════════════════════════════
// RAINBACK — Limoncello Miami Beach Seed
// Real restaurant data + owner login account.
// Triggered via GET /api/admin/seed-limoncello?secret=rainback2026
// ═══════════════════════════════════════════════════════

import { db } from '../db/client.js'
import bcrypt from 'bcryptjs'

// ── Real data from limoncellomiamibeach.com / Yelp / OpenTable ──
const LIMONCELLO = {
  slug: 'limoncello-miami-beach',
  name: 'Limoncello',
  neighborhood: 'South Beach',
  city: 'Miami Beach',
  country: 'US',
  cuisine: 'Southern Italian · Pizzeria',
  instagram: '@limoncello_miami',
  address: '1334 Washington Ave, Miami Beach, FL 33139',
  phone: '305-397-8226',
  website: 'https://limoncellomiamibeach.com',
  description: 'Trattoria-style Southern Italian in the heart of South Beach. Homemade pasta finished tableside in a cheese wheel, wood-oven pizza, fresh seafood daily, and an Amalfi-coast atmosphere where lemons are not just an ingredient but an experience.',
  founding_story: 'Family owned and operated since August 2021. We brought the flavors of Southern Italy to Washington Avenue — homemade pasta, a wood oven, fresh fish every day, and lots of love. Voted the best Italian restaurant in Miami Beach with over twelve thousand five-star reviews.',
  price: 200, cap: 200, tier: 'Founding Member', sold: 0,

  // Owner login — REAL credentials to give to the restaurant
  owner: {
    email: 'limoncello@rainback.club',
    password: 'Limoncello2026!',
    firstName: 'Limoncello',
    lastName: 'Miami',
  },

  perks: [
    'Priority reservations — guaranteed table even on weekend nights',
    'The cheese wheel pasta finished at your table on arrival',
    'A complimentary Limoncello Spritz on every visit',
    'Two private chef dinners per year — Southern Italian tasting',
    'First access to seasonal specials before the public menu',
    'Voting rights on new pasta and pizza additions',
    'Founding status — never reissued',
  ],

  // Real dishes from the Limoncello menu
  dishes: [
    { name: 'Cacio e Pepe', cat: 'Pasta', kcal: 620, p: 22, f: 28, c: 68 },
    { name: 'Lobster Ravioli', cat: 'Pasta', kcal: 580, p: 30, f: 26, c: 52 },
    { name: 'Burrata Pugliese, arugula, cherry tomatoes', cat: 'Starter', kcal: 380, p: 18, f: 28, c: 14 },
    { name: 'Grilled Octopus, leek & potato cream', cat: 'Starter', kcal: 340, p: 32, f: 14, c: 22 },
    { name: 'Branzino filet, grilled, mixed vegetables', cat: 'Main', kcal: 420, p: 46, f: 18, c: 12 },
    { name: 'Polpette — homemade meatballs', cat: 'Starter', kcal: 360, p: 26, f: 22, c: 14 },
    { name: 'Chicken Parmesan, spaghetti red sauce', cat: 'Main', kcal: 780, p: 52, f: 38, c: 56 },
    { name: 'Wood-oven Margherita pizza', cat: 'Pizza', kcal: 680, p: 28, f: 24, c: 84 },
    { name: 'Berry Cheesecake', cat: 'Dessert', kcal: 420, p: 8, f: 24, c: 46 },
  ],

  event: {
    title: 'Cheese Wheel Pasta Night',
    desc: 'A five-course Southern Italian tasting, each pasta finished tableside in the wheel. Paired with wines from our best winery. Members and one guest. Twenty seats.',
    days: 14, cap: 20,
  },
  vote: {
    q: 'Which pasta should we add to the menu next?',
    opts: ['Bucatini all\'Amatriciana', 'Paccheri al ragù Napoletano', 'Spaghetti alle vongole'],
  },
  note: {
    title: 'Fresh seafood in daily from the docks',
    body: 'Our branzino and octopus arrive fresh every morning. Tonight\'s catch is exceptional — members get first reservation. Call us or message through the app.',
  },
}

export async function seedLimoncello() {
  console.log('🍋 Seeding Limoncello Miami Beach...')
  const R = LIMONCELLO

  // ── Owner account ──
  const ownerHash = await bcrypt.hash(R.owner.password, 10)
  const owner = await db.findOne(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1,$2,$3,$4,'owner')
     ON CONFLICT (email) DO UPDATE SET first_name=EXCLUDED.first_name, role='owner'
     RETURNING id`,
    [R.owner.email, ownerHash, R.owner.firstName, R.owner.lastName]
  )

  // ── Restaurant ──
  const rest = await db.findOne(
    `INSERT INTO restaurants (
       owner_id, name, slug, neighborhood, city, country,
       cuisine, instagram, description, founding_story,
       membership_cap, membership_price, membership_duration,
       tier_name, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'1 year',$13,'active')
     ON CONFLICT (slug) DO UPDATE SET
       name=EXCLUDED.name, description=EXCLUDED.description,
       owner_id=EXCLUDED.owner_id, membership_price=EXCLUDED.membership_price
     RETURNING id`,
    [owner.id, R.name, R.slug, R.neighborhood, R.city, R.country,
     R.cuisine, R.instagram, R.description, R.founding_story,
     R.cap, R.price, R.tier]
  )

  // ── Perks ──
  for (let i = 0; i < R.perks.length; i++) {
    const parts = R.perks[i].split(' — ')
    await db.run(
      `INSERT INTO perks (restaurant_id, name, description, sort_order)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [rest.id, parts[0], parts[1] || parts[0], i]
    )
  }

  // ── Menu dishes ──
  for (const d of R.dishes) {
    await db.run(
      `INSERT INTO menu_dishes (restaurant_id, name, category, nutrition_mode, kcal, protein_g, fat_g, carbs_g)
       VALUES ($1,$2,$3,'precise',$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [rest.id, d.name, d.cat, d.kcal, d.p, d.f, d.c]
    )
  }

  // ── Event ──
  const eventDate = new Date(Date.now() + R.event.days * 24 * 60 * 60 * 1000)
  await db.run(
    `INSERT INTO events (restaurant_id, title, description, event_date, capacity, status)
     VALUES ($1,$2,$3,$4,$5,'published') ON CONFLICT DO NOTHING`,
    [rest.id, R.event.title, R.event.desc, eventDate, R.event.cap]
  )

  // ── Vote ──
  const vote = await db.findOne(
    `INSERT INTO votes (restaurant_id, question, status, closes_at)
     VALUES ($1,$2,'live', NOW() + INTERVAL '14 days') RETURNING id`,
    [rest.id, R.vote.q]
  )
  if (vote) {
    for (let i = 0; i < R.vote.opts.length; i++) {
      await db.run(
        'INSERT INTO vote_options (vote_id, text, sort_order) VALUES ($1,$2,$3)',
        [vote.id, R.vote.opts[i], i]
      )
    }
  }

  // ── Note ──
  await db.run(
    `INSERT INTO notes (restaurant_id, title, body, sent_at)
     VALUES ($1,$2,$3, NOW()) ON CONFLICT DO NOTHING`,
    [rest.id, R.note.title, R.note.body]
  )

  console.log('  ✓ Limoncello created with owner login')
  return {
    restaurant: R.name,
    city: R.city,
    address: R.address,
    ownerLogin: { email: R.owner.email, password: R.owner.password },
    perks: R.perks.length,
    dishes: R.dishes.length,
  }
}
