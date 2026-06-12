// ═══════════════════════════════════════════════════════
// RAINBACK — NYC Demo Seed
// 10 restaurants, 40 members, sold memberships, events,
// votes, notes, menu dishes. Realistic fake data.
// Triggered via GET /api/admin/seed?secret=rainback2026
// ═══════════════════════════════════════════════════════

import { db } from '../db/client.js'
import bcrypt from 'bcryptjs'

const RESTAURANTS = [
  {
    slug: 'osteria-romana-nyc',
    name: 'Osteria Romana',
    neighborhood: 'West Village',
    city: 'New York',
    cuisine: 'Italian fine dining',
    instagram: '@osteriaromana',
    description: 'Roman trattoria in the heart of the West Village. Handmade pasta, wood-fired proteins, and a wine list built around small Italian producers.',
    founding_story: 'We opened in 2019 after 15 years cooking in Rome. The West Village reminded us of Trastevere — same energy, same loyalty.',
    price: 250, cap: 200, tier: 'Founding Member', sold: 23,
    perks: ['Priority reservations — guaranteed even Saturday nights','Your table by name — no request needed','Two private dinners with the chef per year','Seasonal menu preview before public launch','Voting rights on pasta additions','Private events with invited Italian producers','Founding status — never reissued'],
    dishes: [
      { name: 'Cacio e pepe, tonnarelli', cat: 'Main', kcal: 580, p: 22, f: 24, c: 68 },
      { name: 'Carpaccio di manzo, rucola, parmigiano', cat: 'Starter', kcal: 320, p: 28, f: 18, c: 8 },
      { name: 'Saltimbocca alla romana', cat: 'Main', kcal: 490, p: 38, f: 22, c: 14 },
      { name: 'Tiramisù della casa', cat: 'Dessert', kcal: 380, p: 8, f: 22, c: 42 },
    ],
    event: { title: "Chef's Roman Evening", desc: 'Six courses from the 1960s Roman menu. Wine from Lazio. Ten seats.', days: 12, cap: 10 },
    vote: { q: 'What pasta should we add for summer?', opts: ['Spaghetti alle vongole', 'Rigatoni all\'amatriciana', 'Pappardelle al cinghiale'] },
    note: { title: 'New truffles just arrived', body: 'White truffles from Alba arrived this morning. First shavings on the tajarin tonight — members get first reservation.' },
  },
  {
    slug: 'maple-smoke-brooklyn',
    name: 'Maple & Smoke',
    neighborhood: 'Williamsburg, Brooklyn',
    city: 'New York',
    cuisine: 'American BBQ · Gastropub',
    instagram: '@maplesmokebk',
    description: 'Low and slow BBQ meets craft cocktails in Williamsburg. 14-hour brisket, wood-smoked sides, and a back patio that fills every summer Friday.',
    founding_story: 'Started as a pop-up in 2020. Our regulars kept showing up even when we had no permit. So we got a permit.',
    price: 120, cap: 300, tier: 'Member', sold: 47,
    perks: ['Priority patio tables — summer season guaranteed','First access to limited smoke releases','Quarterly pitmaster dinners — members only','Vote on the rotating specials board','Guest list for all live music nights','Founding status — never reissued'],
    dishes: [
      { name: '14-hour smoked brisket', cat: 'Main', kcal: 680, p: 52, f: 38, c: 12 },
      { name: 'Burnt ends, house pickles', cat: 'Starter', kcal: 420, p: 32, f: 28, c: 8 },
      { name: 'Mac & cheese, jalapeño crust', cat: 'Side', kcal: 340, p: 14, f: 18, c: 34 },
      { name: 'Banana pudding, wafer crumble', cat: 'Dessert', kcal: 310, p: 6, f: 12, c: 46 },
    ],
    event: { title: 'Pitmaster Night', desc: 'Behind the pit with Chef Marcus. Six courses, all smoke, members only.', days: 8, cap: 16 },
    vote: { q: 'What should be on the summer specials board?', opts: ['Smoked lamb ribs', 'BBQ duck tacos', 'Brisket grilled cheese'] },
    note: { title: 'New summer menu dropping Thursday', body: 'We\'ve been testing all spring. Thursday night the new menu goes live — members get a preview on Wednesday.' },
  },
  {
    slug: 'sushi-nozomi-nyc',
    name: 'Sushi Nozomi',
    neighborhood: 'East Village',
    city: 'New York',
    cuisine: 'Japanese · Omakase',
    instagram: '@sushinozomi',
    description: 'Twelve-seat omakase counter. Fish flown from Toyosu three times a week. Chef Kenji trained under Jiro Ono for six years before opening in New York.',
    founding_story: 'I came to New York in 2018. I wanted to show that great sushi doesn\'t need to cost $400. Our omakase is $120 — with a members discount.',
    price: 350, cap: 60, tier: 'Founding Member', sold: 12,
    perks: ['Guaranteed counter seat — no waitlist','Monthly private omakase for two','Access to special seasonal fish not on public menu','Chef\'s note when exceptional fish arrives','Founding status — never reissued'],
    dishes: [
      { name: 'Otoro nigiri', cat: 'Main', kcal: 180, p: 14, f: 12, c: 8 },
      { name: 'Uni, ikura, shiso handroll', cat: 'Starter', kcal: 220, p: 12, f: 8, c: 28 },
      { name: 'A5 Wagyu, truffle ponzu', cat: 'Main', kcal: 310, p: 22, f: 24, c: 4 },
      { name: 'Matcha nama chocolate', cat: 'Dessert', kcal: 190, p: 4, f: 14, c: 18 },
    ],
    event: { title: 'Toyosu Morning Run Preview', desc: 'Chef Kenji shares the week\'s Toyosu purchase. Eight-piece tasting, sake pairing.', days: 6, cap: 6 },
    vote: { q: 'Next month\'s special addition?', opts: ['Shirako (cod milt)', 'Kinmedai (golden eye snapper)', 'Ankimo (monkfish liver)'] },
    note: { title: 'Exceptional tuna this week', body: 'The bluefin from Tuesday\'s Toyosu run is exceptional — best of the year. Available tonight and tomorrow only. Counter slots open for members.' },
  },
  {
    slug: 'le-comptoir-nyc',
    name: 'Le Comptoir',
    neighborhood: 'Upper West Side',
    city: 'New York',
    cuisine: 'French bistro',
    instagram: '@lecomptoirnyc',
    description: 'A real Paris bistro transplanted to the Upper West Side. Steak frites, soupe à l\'oignon, a zinc bar, and paper tablecloths. Loud, warm, and full every night.',
    founding_story: 'I grew up eating at Le Comptoir de la Gastronomie on Rue Montmartre. When I moved to New York I missed it so much I opened my own version.',
    price: 200, cap: 150, tier: 'Founding Member', sold: 31,
    perks: ['Priority reservations — zinc bar seat always available','Your usual order remembered and ready','Two private dinners per year with the sommelier','Seasonal menu preview — French market rotation','Voting rights on plat du jour additions','Founding status — never reissued'],
    dishes: [
      { name: 'Steak frites, sauce béarnaise', cat: 'Main', kcal: 720, p: 48, f: 42, c: 38 },
      { name: 'Soupe à l\'oignon gratinée', cat: 'Starter', kcal: 340, p: 14, f: 16, c: 34 },
      { name: 'Salade niçoise, thon mi-cuit', cat: 'Starter', kcal: 380, p: 28, f: 22, c: 18 },
      { name: 'Crème brûlée à la vanille', cat: 'Dessert', kcal: 290, p: 6, f: 18, c: 28 },
    ],
    event: { title: 'Beaujolais Nouveau Night', desc: 'First pour of the new Beaujolais. Cheese, charcuterie, and the zinc bar all night.', days: 18, cap: 30 },
    vote: { q: 'What should be our new plat du jour?', opts: ['Pot-au-feu on Tuesdays', 'Blanquette de veau on Wednesdays', 'Cassoulet on Thursdays'] },
    note: { title: 'New sommelier, new wine list', body: 'Marie joined us last week from Septime in Paris. She\'s rebuilt the by-the-glass list. Twelve new bottles, all natural, all French. Members get a free first pour tonight.' },
  },
  {
    slug: 'casa-oaxaca-nyc',
    name: 'Casa Oaxaca',
    neighborhood: 'Lower East Side',
    city: 'New York',
    cuisine: 'Mexican · Oaxacan',
    instagram: '@casaoaxacanyc',
    description: 'Oaxacan cooking in the Lower East Side. Mole negro that takes three days to make, tlayudas cooked on volcanic stone, and mezcal you can\'t find anywhere else in New York.',
    founding_story: 'My grandmother made mole negro every Sunday in her kitchen in Oaxaca City. I came to New York and nobody knew what real mole tasted like. I fixed that.',
    price: 100, cap: 400, tier: 'Member', sold: 58,
    perks: ['Priority reservations — every weekend guaranteed','Your usual mezcal poured before you sit','Quarterly private mezcal pairing dinners','Mole tastings before new batches launch publicly','Voting rights on seasonal mole variations','Founding status — never reissued'],
    dishes: [
      { name: 'Mole negro, turkey, black sesame', cat: 'Main', kcal: 520, p: 38, f: 24, c: 42 },
      { name: 'Tlayuda, black beans, Oaxacan cheese', cat: 'Main', kcal: 480, p: 18, f: 22, c: 54 },
      { name: 'Ceviche de camarón, aguachile verde', cat: 'Starter', kcal: 220, p: 24, f: 8, c: 14 },
      { name: 'Churros, chocolate negro', cat: 'Dessert', kcal: 340, p: 6, f: 16, c: 44 },
    ],
    event: { title: 'Mezcal Maestro Evening', desc: 'A mezcalero from Tlacolula visits. Six mezcals, five courses, stories from the palenque.', days: 14, cap: 20 },
    vote: { q: 'New mole for the fall menu?', opts: ['Mole coloradito', 'Mole amarillo', 'Mole chichilo'] },
    note: { title: 'New batch of mole negro ready', body: 'Three days, 34 ingredients, one pot. The new mole negro batch is ready. First plates go out tonight — members get first table.' },
  },
  {
    slug: 'the-pearl-tribeca',
    name: 'The Pearl',
    neighborhood: 'Tribeca',
    city: 'New York',
    cuisine: 'Seafood · Raw bar',
    instagram: '@thepearlnyc',
    description: 'The finest raw bar in Tribeca. Oysters from six coasts, whole fish from day boats, and a wine list built around crisp whites and champagne.',
    founding_story: 'I worked the docks in Maine for three years before culinary school. I know what fresh fish smells like. Most restaurants in New York don\'t.',
    price: 280, cap: 120, tier: 'Founding Member', sold: 19,
    perks: ['Reserved raw bar counter every Friday','Oyster tasting selection before public service','Two private seafood dinners per year with the chef','First access to limited day-boat specials','Seasonal menu preview and tasting','Founding status — never reissued'],
    dishes: [
      { name: 'Oysters selection, six coasts', cat: 'Starter', kcal: 120, p: 14, f: 4, c: 8 },
      { name: 'Whole roasted branzino, herbs, lemon', cat: 'Main', kcal: 420, p: 48, f: 18, c: 8 },
      { name: 'Lobster bisque, tarragon cream', cat: 'Starter', kcal: 380, p: 18, f: 26, c: 18 },
      { name: 'Lemon tart, meringue', cat: 'Dessert', kcal: 320, p: 6, f: 14, c: 44 },
    ],
    event: { title: 'Day Boat Dinner', desc: 'The week\'s catch presented whole at the table. Chef decides the menu that morning at the dock.', days: 10, cap: 8 },
    vote: { q: 'Next raw bar addition?', opts: ['Maine uni on the half shell', 'Razor clams, mignonette', 'King crab, brown butter'] },
    note: { title: 'Day boat just in from Montauk', body: 'Captain Jim brought in striped bass and fluke this morning. Both go on the menu tonight. Members get first reservation — call or message us directly.' },
  },
  {
    slug: 'spice-route-nyc',
    name: 'Spice Route',
    neighborhood: 'Murray Hill',
    city: 'New York',
    cuisine: 'Indian · Modern',
    instagram: '@spiceroutenyc',
    description: 'Modern Indian cooking that respects the traditions. Slow-cooked curries, tandoor breads baked to order, and a cocktail list built around Indian botanicals.',
    founding_story: 'I trained in Delhi, cooked in London, and opened in New York. The Indian food here was either too timid or a caricature. I wanted to do it properly.',
    price: 150, cap: 200, tier: 'Member', sold: 35,
    perks: ['Priority reservations — any night guaranteed','Your heat preference remembered and respected','Quarterly private tasting menus with the chef','Access to regional dishes not on the public menu','Voting rights on seasonal additions','Founding status — never reissued'],
    dishes: [
      { name: 'Rogan josh, slow-cooked lamb', cat: 'Main', kcal: 540, p: 38, f: 28, c: 28 },
      { name: 'Butter chicken, fenugreek', cat: 'Main', kcal: 480, p: 32, f: 26, c: 24 },
      { name: 'Chaat papdi, tamarind, yogurt', cat: 'Starter', kcal: 280, p: 8, f: 12, c: 36 },
      { name: 'Gulab jamun, cardamom syrup', cat: 'Dessert', kcal: 320, p: 6, f: 10, c: 52 },
    ],
    event: { title: 'Regional India Night — Goa', desc: 'A full Goan menu — coconut, seafood, toddy vinegar. Chef\'s family recipes. Members and one guest.', days: 16, cap: 18 },
    vote: { q: 'Regional special for next month?', opts: ['Chettinad feast (Tamil Nadu)', 'Coastal Karnataka menu', 'Rajasthani dal baati churma'] },
    note: { title: 'Fresh turmeric from Kerala', body: 'Fresh turmeric root just arrived from a small farm in Kerala. Different from dried — brighter, more floral. On the new curry from tonight.' },
  },
  {
    slug: 'athens-and-co-astoria',
    name: 'Athens & Co.',
    neighborhood: 'Astoria, Queens',
    city: 'New York',
    cuisine: 'Greek · Mediterranean',
    instagram: '@athensandco',
    description: 'A Greek taverna in the heart of Astoria. Whole fish grilled over charcoal, proper mezze, house-made taramosalata, and an ouzo list that goes forty bottles deep.',
    founding_story: 'My family has run tavernas in Athens for three generations. I moved to Astoria in 2014 because it felt like home. I opened this place for the neighbourhood.',
    price: 130, cap: 250, tier: 'Member', sold: 42,
    perks: ['Priority tables — terrace guaranteed in summer','A complimentary mezze selection on arrival','Two private Greek evenings per year','Access to the house-made wine rotation','Voting rights on seasonal mezze','Founding status — never reissued'],
    dishes: [
      { name: 'Grilled whole sea bream, lemon, oregano', cat: 'Main', kcal: 380, p: 42, f: 16, c: 6 },
      { name: 'Spanakopita, handmade filo', cat: 'Starter', kcal: 320, p: 12, f: 18, c: 28 },
      { name: 'Lamb chops, tzatziki', cat: 'Main', kcal: 520, p: 44, f: 32, c: 8 },
      { name: 'Baklava, walnut, honey', cat: 'Dessert', kcal: 360, p: 8, f: 18, c: 44 },
    ],
    event: { title: 'Meze Night — Summer Edition', desc: 'Fifteen mezze plates, house wine, live bouzouki. Tables outside. Members only.', days: 7, cap: 24 },
    vote: { q: 'New mezze for the summer menu?', opts: ['Htipiti (roasted pepper & feta dip)', 'Kolokithokeftedes (zucchini fritters)', 'Revithia (slow-cooked chickpeas)'] },
    note: { title: 'New terrace open from next week', body: 'The summer terrace is ready. Forty seats outside, string lights, the same menu. Priority booking for members starts now — message us directly.' },
  },
  {
    slug: 'ember-room-hells-kitchen',
    name: 'Ember Room',
    neighborhood: "Hell's Kitchen",
    city: 'New York',
    cuisine: 'Modern American · Wood fire',
    instagram: '@emberroomnyc',
    description: "Everything cooked over live fire in Hell's Kitchen. Dry-aged steaks, wood-roasted vegetables, and a bar program built around smoked cocktails.",
    founding_story: "I spent four years cooking over open fire in Buenos Aires and Copenhagen. When I came back to New York I couldn't find it done properly. So I built a wood-fire kitchen in Hell's Kitchen.",
    price: 175, cap: 180, tier: 'Founding Member', sold: 28,
    perks: ['Priority counter seats at the fire — always','Your cut aged and held for you','Two fire-cooked private dinners per year','First access to special dry-age releases','Voting rights on seasonal smoke menu','Founding status — never reissued'],
    dishes: [
      { name: 'Dry-aged ribeye 45 days, wood fire', cat: 'Main', kcal: 680, p: 54, f: 46, c: 4 },
      { name: 'Wood-roasted bone marrow, sourdough', cat: 'Starter', kcal: 420, p: 12, f: 36, c: 18 },
      { name: 'Ember-roasted carrots, whipped ricotta', cat: 'Side', kcal: 220, p: 8, f: 12, c: 24 },
      { name: 'Dark chocolate tart, smoked caramel', cat: 'Dessert', kcal: 410, p: 6, f: 26, c: 42 },
    ],
    event: { title: 'Whole Animal Dinner', desc: 'One animal, cooked whole over the fire. Chef decides the beast on the day. Members and one guest. Eight seats.', days: 21, cap: 8 },
    vote: { q: 'What cut should we add to the permanent menu?', opts: ['Wagyu Denver steak', 'Wood-fired lamb shoulder', 'Tomahawk for two'] },
    note: { title: '60-day dry-age ready this week', body: 'Our 60-day prime ribeye is ready to cut. Only six portions. Members get first call — reply to this message to reserve yours for the weekend.' },
  },
  {
    slug: 'boulangerie-clement-uws',
    name: 'Boulangerie Clément',
    neighborhood: 'Upper East Side',
    city: 'New York',
    cuisine: 'French · Bakery · Café',
    instagram: '@boulangerieclement',
    description: 'A proper French bakery and café on the Upper East Side. Croissants baked at 5am, sourdough with a 36-hour ferment, and a lunch menu that changes with the market.',
    founding_story: 'I trained at Poilâne in Paris for six years. When I moved to New York I missed bread that actually tasted like something. So I baked my own.',
    price: 80, cap: 500, tier: 'Member', sold: 61,
    perks: ['Pre-dawn Saturday pickup — best croissants reserved','Your weekly sourdough loaf held until noon','Monthly private bakery tour before opening','First access to limited seasonal viennoiserie','Voting rights on seasonal specials','Founding status — never reissued'],
    dishes: [
      { name: 'Croissant au beurre', cat: 'Main', kcal: 280, p: 6, f: 16, c: 28 },
      { name: 'Pain au chocolat', cat: 'Main', kcal: 320, p: 6, f: 18, c: 34 },
      { name: 'Sourdough tartine, jambon, comté', cat: 'Main', kcal: 420, p: 22, f: 18, c: 42 },
      { name: 'Tarte tatin, crème fraîche', cat: 'Dessert', kcal: 360, p: 6, f: 18, c: 44 },
    ],
    event: { title: 'Pre-dawn Bake — Members Morning', desc: 'Join Clément at 4am. You help shape the croissants. Leave with two dozen warm from the oven.', days: 5, cap: 6 },
    vote: { q: 'What seasonal special for autumn?', opts: ['Kouign-amann', 'Chestnut cream mille-feuille', 'Pear & almond tart'] },
    note: { title: 'Autumn loaves start Monday', body: 'New autumn sourdough with toasted walnut and dried fig starts Monday. Members\' loaves are held until noon. Come whenever you can.' },
  },
]

const MEMBER_NAMES = [
  ['Sarah', 'Mitchell'], ['James', 'Okafor'], ['Elena', 'Vasquez'],
  ['David', 'Chen'], ['Priya', 'Sharma'], ['Marcus', 'Williams'],
  ['Sophia', 'Laurent'], ['Alex', 'Kowalski'], ['Nadia', 'Hassan'],
  ['Tom', 'Brennan'], ['Yuki', 'Tanaka'], ['Isabelle', 'Moreau'],
  ['Carlos', 'Rodriguez'], ['Emma', 'Thompson'], ['Raj', 'Patel'],
  ['Sofia', 'Marchetti'], ['William', 'Hartley'], ['Chloe', 'Anderson'],
  ['Marco', 'Bianchi'], ['Nina', 'Johansson'],
]

export async function seedNYC() {
  console.log('🌧  Seeding NYC restaurants...')
  const results = { restaurants: 0, owners: 0, members: 0, memberships: 0, events: 0, votes: 0, notes: 0, dishes: 0 }

  // Create shared member accounts (they belong to multiple restaurants)
  const memberIds = []
  const memberHash = await bcrypt.hash('Demo2026!', 10)
  for (let i = 0; i < MEMBER_NAMES.length; i++) {
    const [fn, ln] = MEMBER_NAMES[i]
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}@demo.rainback.com`
    try {
      const m = await db.findOne(
        `INSERT INTO users (email, password_hash, first_name, last_name, role)
         VALUES ($1,$2,$3,$4,'member')
         ON CONFLICT (email) DO UPDATE SET first_name=EXCLUDED.first_name
         RETURNING id`,
        [email, memberHash, fn, ln]
      )
      memberIds.push(m.id)
      results.members++
    } catch (e) { /* skip */ }
  }

  // Create each restaurant
  for (const R of RESTAURANTS) {
    try {
      // Owner account
      const ownerEmail = `owner@${R.slug}.demo.rainback.com`
      const ownerHash = await bcrypt.hash('Demo2026!', 10)
      const ownerName = R.name.split(' ')
      const owner = await db.findOne(
        `INSERT INTO users (email, password_hash, first_name, last_name, role)
         VALUES ($1,$2,$3,$4,'owner')
         ON CONFLICT (email) DO UPDATE SET first_name=EXCLUDED.first_name
         RETURNING id`,
        [ownerEmail, ownerHash, ownerName[0], ownerName[1] || 'Owner']
      )
      results.owners++

      // Restaurant
      const rest = await db.findOne(
        `INSERT INTO restaurants (
           owner_id, name, slug, neighborhood, city, country,
           cuisine, instagram, description, founding_story,
           membership_cap, membership_price, membership_duration,
           tier_name, status
         ) VALUES ($1,$2,$3,$4,$5,'US',$6,$7,$8,$9,$10,$11,'1 year',$12,'active')
         ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name
         RETURNING id`,
        [owner.id, R.name, R.slug, R.neighborhood, R.city,
         R.cuisine, R.instagram, R.description, R.founding_story,
         R.cap, R.price, R.tier]
      )
      results.restaurants++

      // Perks
      for (let i = 0; i < R.perks.length; i++) {
        const parts = R.perks[i].split(' — ')
        await db.run(
          `INSERT INTO perks (restaurant_id, name, description, sort_order)
           VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [rest.id, parts[0], parts[1] || parts[0], i]
        )
      }

      // Menu dishes
      for (const d of R.dishes) {
        await db.run(
          `INSERT INTO menu_dishes (restaurant_id, name, category, nutrition_mode, kcal, protein_g, fat_g, carbs_g)
           VALUES ($1,$2,$3,'precise',$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
          [rest.id, d.name, d.cat, d.kcal, d.p, d.f, d.c]
        )
        results.dishes++
      }

      // Sell some memberships to random members
      const shuffled = [...memberIds].sort(() => 0.5 - Math.random())
      const buyers = shuffled.slice(0, R.sold)
      for (let i = 0; i < buyers.length; i++) {
        const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        const fee = Math.round(R.price * 0.05 * 100) / 100
        await db.run(
          `INSERT INTO memberships (
             restaurant_id, member_id, serial_number, tier,
             stripe_payment_id, amount_paid, rainback_fee, restaurant_amount, valid_until
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (restaurant_id, serial_number) DO NOTHING`,
          [rest.id, buyers[i], i + 1, R.tier,
           `pi_demo_${R.slug}_${i+1}`, R.price, fee, R.price - fee, validUntil]
        )
        results.memberships++

        // Add 1-2 check-ins for some members
        if (i % 3 === 0) {
          await db.run(
            `INSERT INTO check_ins (membership_id, restaurant_id, member_id, checked_in_at)
             SELECT m.id, $1, $2, NOW() - INTERVAL '${Math.floor(Math.random()*30)} days'
             FROM memberships m WHERE m.restaurant_id=$1 AND m.member_id=$2 LIMIT 1`,
            [rest.id, buyers[i]]
          ).catch(() => {})
        }
      }

      // Event
      const eventDate = new Date(Date.now() + R.event.days * 24 * 60 * 60 * 1000)
      const event = await db.findOne(
        `INSERT INTO events (restaurant_id, title, description, event_date, capacity, status)
         VALUES ($1,$2,$3,$4,$5,'published') RETURNING id`,
        [rest.id, R.event.title, R.event.desc, eventDate, R.event.cap]
      )
      results.events++

      // Add 2-3 RSVPs to the event
      const rsvpBuyers = buyers.slice(0, Math.min(3, buyers.length))
      for (const memberId of rsvpBuyers) {
        await db.run(
          `INSERT INTO event_rsvps (event_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [event.id, memberId]
        ).catch(() => {})
      }

      // Vote
      const vote = await db.findOne(
        `INSERT INTO votes (restaurant_id, question, status, closes_at)
         VALUES ($1,$2,'live', NOW() + INTERVAL '7 days') RETURNING id`,
        [rest.id, R.vote.q]
      )
      for (let i = 0; i < R.vote.opts.length; i++) {
        await db.run(
          'INSERT INTO vote_options (vote_id, text, sort_order) VALUES ($1,$2,$3)',
          [vote.id, R.vote.opts[i], i]
        )
      }
      // Add some votes from members
      const { rows: opts } = await db.query('SELECT id FROM vote_options WHERE vote_id=$1', [vote.id])
      const votingMembers = buyers.slice(0, Math.min(Math.floor(R.sold * 0.6), buyers.length))
      for (const memberId of votingMembers) {
        const opt = opts[Math.floor(Math.random() * opts.length)]
        await db.run(
          `INSERT INTO vote_responses (vote_id, vote_option_id, member_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [vote.id, opt.id, memberId]
        ).catch(() => {})
      }
      results.votes++

      // Note
      await db.run(
        `INSERT INTO notes (restaurant_id, title, body, sent_at)
         VALUES ($1,$2,$3, NOW() - INTERVAL '2 days')`,
        [rest.id, R.note.title, R.note.body]
      )
      results.notes++

      console.log(`  ✓ ${R.name} — ${R.sold} memberships sold`)

    } catch (err) {
      console.error(`  ✗ ${R.name}: ${err.message}`)
    }
  }

  console.log('\n🎉 NYC seed complete:')
  console.log(`   ${results.restaurants} restaurants`)
  console.log(`   ${results.members} members`)
  console.log(`   ${results.memberships} memberships sold`)
  console.log(`   ${results.dishes} menu dishes`)
  console.log(`   ${results.events} events`)
  console.log(`   ${results.votes} votes`)
  return results
}
