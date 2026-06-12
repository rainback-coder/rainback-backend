// ═══════════════════════════════════════════════════════
// RAINBACK — Miami Seed (5 restaurants, real members + owners)
// Triggered via GET /api/admin/seed-miami?secret=rainback2026
// Every membership creates a real member user who can log in.
// Every restaurant has a real owner user who can log in.
// ═══════════════════════════════════════════════════════

import { db } from '../db/client.js'
import bcrypt from 'bcryptjs'

const RESTAURANTS = [
  {
    slug: 'limoncello-miami-beach', lat: 25.7846, lng: -80.13,
    name: 'Limoncello',
    neighborhood: 'South Beach',
    cuisine: 'Southern Italian · Pizzeria',
    instagram: '@limoncello_miami',
    description: 'Trattoria-style Southern Italian in the heart of South Beach. Handmade pasta finished tableside in a cheese wheel, wood-oven pizza, and an Amalfi-coast atmosphere.',
    founding_story: 'Family owned since 2021. We brought the flavors of Southern Italy to Washington Avenue — fresh pasta, a wood oven, and lots of love.',
    price: 200, cap: 200, tier: 'Founding Member', sold: 72,
    owner: { email: 'owner@limoncello.rainback.club', firstName: 'Giuseppe', lastName: 'Limoncello' },
    perks: ['Priority reservations — weekend tables guaranteed','Cheese wheel pasta finished tableside','Complimentary Limoncello Spritz on every visit','Two private chef dinners per year','Founding status — never reissued'],
    dishes: [['Cacio e Pepe','Pasta',620,22,28,68],['Lobster Ravioli','Pasta',580,30,26,52],['Branzino filet, grilled','Main',420,46,18,12],['Wood-oven Margherita','Pizza',680,28,24,84]],
    event: { title: 'Cheese Wheel Pasta Night', desc: 'Five-course Southern Italian tasting, each pasta finished tableside in the wheel.', days: 14, cap: 20 },
    vote: { q: 'Which pasta should we add next?', opts: ["Bucatini all'Amatriciana", 'Paccheri al ragù Napoletano', 'Spaghetti alle vongole'] },
    note: { title: 'Fresh seafood in daily', body: 'Our branzino and octopus arrive fresh every morning. Members get first reservation tonight.' },
  },
  {
    slug: 'ceviche-105-miami', lat: 25.7752, lng: -80.1936,
    name: 'Ceviche 105',
    neighborhood: 'Downtown Miami',
    cuisine: 'Peruvian · Seafood',
    instagram: '@ceviche105',
    description: 'Authentic Peruvian ceviche and pisco bar in Downtown Miami. Fresh catch cured daily, classic Lima recipes, and the best pisco sours in the city.',
    founding_story: 'Born in Lima, raised in the kitchen. We opened Ceviche 105 to bring real Peruvian seafood to Miami — nothing frozen, everything fresh.',
    price: 150, cap: 250, tier: 'Member', sold: 58,
    owner: { email: 'owner@ceviche105.rainback.club', firstName: 'Diego', lastName: 'Vargas' },
    perks: ['Priority tables — even Friday nights','Welcome pisco sour on arrival','Quarterly Peruvian tasting dinners','First access to seasonal ceviche specials','Founding status — never reissued'],
    dishes: [['Ceviche Clásico','Starter',280,32,6,22],['Lomo Saltado','Main',620,42,28,48],['Causa Limeña','Starter',320,12,14,38],['Ají de Gallina','Main',540,34,30,32]],
    event: { title: 'Pisco & Ceviche Pairing', desc: 'Five ceviches paired with five piscos. A journey through the coast of Peru.', days: 10, cap: 24 },
    vote: { q: 'Next pisco cocktail to add?', opts: ['Chilcano', 'Pisco Punch', 'Maracuyá Sour'] },
    note: { title: 'Today\'s catch: corvina', body: 'Fresh corvina just arrived from the docks. On the ceviche clásico tonight — members first.' },
  },
  {
    slug: 'la-mar-wynwood', lat: 25.801, lng: -80.199,
    name: 'La Mar',
    neighborhood: 'Wynwood',
    cuisine: 'Latin American · Steakhouse',
    instagram: '@lamarwynwood',
    description: 'Wood-fire Latin American grill in the heart of Wynwood. Argentine cuts, open-flame cooking, and a natural-wine list under the murals.',
    founding_story: 'We built La Mar around one fire pit and a belief: the best meat needs nothing but flame, salt, and time.',
    price: 175, cap: 200, tier: 'Founding Member', sold: 41,
    owner: { email: 'owner@lamar.rainback.club', firstName: 'Mateo', lastName: 'Fuentes' },
    perks: ['Priority counter seats at the fire','Your cut aged and held for you','Two open-flame private dinners per year','First access to special cuts','Founding status — never reissued'],
    dishes: [['Bife de Chorizo','Main',680,54,46,4],['Provoleta','Starter',420,22,34,8],['Empanadas (3)','Starter',360,16,20,30],['Dulce de Leche Flan','Dessert',390,7,16,54]],
    event: { title: 'Asado Night — Whole Animal', desc: 'One animal, cooked whole over the fire. Chef decides the beast on the day.', days: 18, cap: 16 },
    vote: { q: 'What cut should we add to the menu?', opts: ['Entraña (skirt)', 'Ojo de bife (ribeye)', 'Vacío (flank)'] },
    note: { title: '45-day dry-age ready', body: 'Our 45-day dry-aged ribeye is ready to cut. Only six portions this weekend — members get first call.' },
  },
  {
    slug: 'kazumi-brickell', lat: 25.7617, lng: -80.1918,
    name: 'Kazumi',
    neighborhood: 'Brickell',
    cuisine: 'Japanese · Omakase',
    instagram: '@kazumibrickell',
    description: 'Intimate twelve-seat omakase in Brickell. Fish flown from Toyosu twice a week, sake selection curated by our in-house sommelier.',
    founding_story: 'Chef Kazumi trained in Tokyo for a decade. In Brickell he built a counter where every guest is treated like family.',
    price: 350, cap: 80, tier: 'Founding Member', sold: 23,
    owner: { email: 'owner@kazumi.rainback.club', firstName: 'Kazumi', lastName: 'Tanaka' },
    perks: ['Guaranteed counter seat — no waitlist','Monthly private omakase for two','Access to special seasonal fish','Chef\'s note when exceptional fish arrives','Founding status — never reissued'],
    dishes: [['Otoro Nigiri','Main',180,14,12,8],['Uni Handroll','Starter',220,12,8,28],['A5 Wagyu, truffle','Main',310,22,24,4],['Matcha Nama Chocolate','Dessert',190,4,14,18]],
    event: { title: 'Toyosu Preview Tasting', desc: 'Chef Kazumi shares the week\'s Toyosu purchase. Eight-piece tasting, sake pairing.', days: 7, cap: 8 },
    vote: { q: 'Next month\'s special addition?', opts: ['Shirako', 'Kinmedai', 'Ankimo'] },
    note: { title: 'Exceptional bluefin this week', body: 'The bluefin from Tuesday\'s Toyosu run is the best of the year. Counter slots open for members.' },
  },
  {
    slug: 'verde-coconut-grove', lat: 25.728, lng: -80.2436,
    name: 'Verde',
    neighborhood: 'Coconut Grove',
    cuisine: 'Mediterranean · Plant-forward',
    instagram: '@verdegrove',
    description: 'Plant-forward Mediterranean in leafy Coconut Grove. Garden-driven menus, wood-grilled vegetables, and a terrace under the banyan trees.',
    founding_story: 'We started with a garden and a question: how good can vegetables taste when you treat them like the main event? Verde is the answer.',
    price: 120, cap: 300, tier: 'Member', sold: 64,
    owner: { email: 'owner@verde.rainback.club', firstName: 'Elena', lastName: 'Costa' },
    perks: ['Priority terrace tables in season','A complimentary garden cocktail on arrival','Seasonal harvest dinners','Voting rights on the rotating garden menu','Founding status — never reissued'],
    dishes: [['Wood-grilled Cauliflower','Main',320,12,18,32],['Heirloom Tomato Burrata','Starter',380,18,28,16],['Charred Eggplant, tahini','Starter',280,9,20,22],['Olive Oil Cake','Dessert',360,6,18,46]],
    event: { title: 'Garden Harvest Dinner', desc: 'A six-course menu built entirely from this week\'s garden harvest. On the terrace.', days: 12, cap: 22 },
    vote: { q: 'Next season\'s garden focus?', opts: ['Heirloom tomatoes', 'Stone fruit', 'Root vegetables'] },
    note: { title: 'First tomatoes of the season', body: 'Our heirloom tomatoes just came in from the garden. On the burrata starter from tonight.' },
  },
]

// Member name pool — enough unique names for the largest membership count
const FIRST = ['Sofia','James','Elena','David','Priya','Marcus','Isabella','Alex','Nadia','Tom','Yuki','Camille','Carlos','Emma','Raj','Lucia','William','Chloe','Marco','Nina','Diego','Aisha','Liam','Valentina','Omar','Grace','Hugo','Maya','Leo','Zara','Pablo','Hannah','Ravi','Julia','Sam','Fatima','Noah','Bianca','Andre','Mei','Theo','Olivia','Karim','Sara','Felix','Ines','Ben','Rosa','Ivan','Lea','Nico','Dana','Hassan','Clara','Max','Vera','Adam','Lina','Paolo','Tara','Erik','Mira','Jon','Alba','Ravi','Sienna','Kai','Noor','Dario','Eva','Sven','Lola','Amir','Greta','Luca','Ada','Yusuf','Iris','Bruno','Talia']
const LAST = ['Marchetti','Okafor','Vasquez','Chen','Sharma','Williams','Rossi','Kowalski','Hassan','Brennan','Tanaka','Moreau','Rodriguez','Thompson','Patel','Marino','Hartley','Anderson','Bianchi','Johansson','Vargas','Khan','Murphy','Lopez','Haddad','Bennett','Dubois','Nair','Schmidt','Ahmed','Castro','Walsh','Iyer','Romano','Park','Ali','Klein','Ferrari','Costa','Wong']

function makeMembers(count, startIdx) {
  const members = []
  for (let i = 0; i < count; i++) {
    const fn = FIRST[(startIdx + i) % FIRST.length]
    const ln = LAST[(startIdx + i * 3) % LAST.length]
    const num = startIdx + i
    members.push({ fn, ln, email: `${fn.toLowerCase()}.${ln.toLowerCase()}${num}@member.rainback.club` })
  }
  return members
}

export async function seedMiami() {
  console.log('🌴 Seeding Miami — 5 restaurants...')
  const memberHash = await bcrypt.hash('Member2026!', 10)
  const ownerHash = await bcrypt.hash('Owner2026!', 10)
  const results = { restaurants: 0, owners: 0, members: 0, memberships: 0 }
  let memberCursor = 0

  for (const R of RESTAURANTS) {
    try {
      // ── Owner account (real login) ──
      const owner = await db.findOne(
        `INSERT INTO users (email, password_hash, first_name, last_name, role)
         VALUES ($1,$2,$3,$4,'owner')
         ON CONFLICT (email) DO UPDATE SET role='owner', first_name=EXCLUDED.first_name
         RETURNING id`,
        [R.owner.email, ownerHash, R.owner.firstName, R.owner.lastName]
      )
      results.owners++

      // ── Restaurant ──
      const rest = await db.findOne(
        `INSERT INTO restaurants (
           owner_id, name, slug, neighborhood, city, country,
           cuisine, instagram, description, founding_story,
           membership_cap, membership_price, membership_duration, tier_name, status,
           latitude, longitude
         ) VALUES ($1,$2,$3,$4,'Miami Beach','US',$5,$6,$7,$8,$9,$10,'1 year',$11,'active',$12,$13)
         ON CONFLICT (slug) DO UPDATE SET
           name=EXCLUDED.name, owner_id=EXCLUDED.owner_id, membership_price=EXCLUDED.membership_price,
           latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude
         RETURNING id`,
        [owner.id, R.name, R.slug, R.neighborhood,
         R.cuisine, R.instagram, R.description, R.founding_story,
         R.cap, R.price, R.tier, R.lat, R.lng]
      )
      results.restaurants++

      // ── Clear this restaurant's old perks/dishes/events/votes/notes ──
      // so re-running the seed doesn't pile up duplicates.
      await db.run('DELETE FROM perks WHERE restaurant_id = $1', [rest.id])
      await db.run('DELETE FROM menu_dishes WHERE restaurant_id = $1', [rest.id])
      await db.run(`DELETE FROM vote_responses WHERE vote_id IN (SELECT id FROM votes WHERE restaurant_id = $1)`, [rest.id])
      await db.run(`DELETE FROM vote_options WHERE vote_id IN (SELECT id FROM votes WHERE restaurant_id = $1)`, [rest.id])
      await db.run('DELETE FROM votes WHERE restaurant_id = $1', [rest.id])
      await db.run(`DELETE FROM event_rsvps WHERE event_id IN (SELECT id FROM events WHERE restaurant_id = $1)`, [rest.id])
      await db.run('DELETE FROM events WHERE restaurant_id = $1', [rest.id])
      await db.run('DELETE FROM notes WHERE restaurant_id = $1', [rest.id])

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
          [rest.id, d[0], d[1], d[2], d[3], d[4], d[5]]
        )
      }

      // ── Members + memberships (real users who can log in) ──
      const members = makeMembers(R.sold, memberCursor)
      memberCursor += R.sold
      const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      const fee = Math.round(R.price * 0.05 * 100) / 100
      for (let i = 0; i < members.length; i++) {
        const m = members[i]
        const user = await db.findOne(
          `INSERT INTO users (email, password_hash, first_name, last_name, role)
           VALUES ($1,$2,$3,$4,'member')
           ON CONFLICT (email) DO UPDATE SET first_name=EXCLUDED.first_name
           RETURNING id`,
          [m.email, memberHash, m.fn, m.ln]
        )
        results.members++
        await db.run(
          `INSERT INTO memberships (
             restaurant_id, member_id, serial_number, tier, status,
             stripe_payment_id, amount_paid, rainback_fee, restaurant_amount, valid_until, purchased_at
           ) VALUES ($1,$2,$3,$4,'active',$5,$6,$7,$8,$9, NOW() - (random() * INTERVAL '120 days'))
           ON CONFLICT (restaurant_id, serial_number) DO NOTHING`,
          [rest.id, user.id, i + 1, R.tier,
           'seed_' + R.slug + '_' + (i + 1), R.price, fee, R.price - fee, validUntil]
        )
        results.memberships++

        // A few check-ins for realism
        if (i % 4 === 0) {
          await db.run(
            `INSERT INTO check_ins (membership_id, restaurant_id, member_id, checked_in_at)
             SELECT id, $1, $2, NOW() - (random() * INTERVAL '30 days')
             FROM memberships WHERE restaurant_id=$1 AND member_id=$2 LIMIT 1`,
            [rest.id, user.id]
          ).catch(() => {})
        }
      }

      // ── Event ──
      const eventDate = new Date(Date.now() + R.event.days * 24 * 60 * 60 * 1000)
      const event = await db.findOne(
        `INSERT INTO events (restaurant_id, title, description, event_date, capacity, status)
         VALUES ($1,$2,$3,$4,$5,'published') RETURNING id`,
        [rest.id, R.event.title, R.event.desc, eventDate, R.event.cap]
      )
      // Some RSVPs from real members
      const { rows: someMembers } = await db.query(
        'SELECT member_id FROM memberships WHERE restaurant_id=$1 LIMIT 5', [rest.id]
      )
      for (const row of someMembers.slice(0, 4)) {
        await db.run('INSERT INTO event_rsvps (event_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [event.id, row.member_id]).catch(() => {})
      }

      // ── Vote + real responses ──
      const vote = await db.findOne(
        `INSERT INTO votes (restaurant_id, question, status, closes_at)
         VALUES ($1,$2,'live', NOW() + INTERVAL '10 days') RETURNING id`,
        [rest.id, R.vote.q]
      )
      const optIds = []
      for (let i = 0; i < R.vote.opts.length; i++) {
        const o = await db.findOne(
          'INSERT INTO vote_options (vote_id, text, sort_order) VALUES ($1,$2,$3) RETURNING id',
          [vote.id, R.vote.opts[i], i]
        )
        optIds.push(o.id)
      }
      // Real members cast real votes
      const { rows: voters } = await db.query(
        'SELECT member_id FROM memberships WHERE restaurant_id=$1 LIMIT 30', [rest.id]
      )
      for (const v of voters) {
        const opt = optIds[Math.floor(Math.random() * optIds.length)]
        await db.run('INSERT INTO vote_responses (vote_id, vote_option_id, member_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [vote.id, opt, v.member_id]).catch(() => {})
      }

      // ── Note ──
      await db.run(
        `INSERT INTO notes (restaurant_id, title, body, sent_at)
         VALUES ($1,$2,$3, NOW() - INTERVAL '1 day') ON CONFLICT DO NOTHING`,
        [rest.id, R.note.title, R.note.body]
      )

      console.log(`  ✓ ${R.name} — ${R.sold} members, owner: ${R.owner.email}`)
    } catch (err) {
      console.error(`  ✗ ${R.name}: ${err.message}`)
    }
  }

  console.log('\n🌴 Miami seed complete:', JSON.stringify(results))
  return {
    ...results,
    ownerLogins: RESTAURANTS.map(r => ({ restaurant: r.name, email: r.owner.email, password: 'Owner2026!', members: r.sold })),
    memberPassword: 'Member2026!',
    note: 'Every owner can log in to see their real members. Every membership is a real user account.',
  }
}
