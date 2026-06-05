import { db } from '../db/client.js'
import { requireOwner } from '../middleware/auth.js'

export default async function dashboardRoutes(app) {

  // GET /api/dashboard/:restaurantId
  // Returns everything the owner dashboard needs in one request
  app.get('/:restaurantId', { preHandler: requireOwner }, async (req, reply) => {
    const restaurant = await db.findOne(
      'SELECT * FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.restaurantId, req.user.id]
    )
    if (!restaurant) return reply.code(403).send({ error: 'Not your restaurant' })

    const rid = req.params.restaurantId

    // Run all queries in parallel
    const [
      membershipStats,
      cashStats,
      visitStats,
      tonightReservations,
      activeVote,
      recentActivity,
      menuStats,
    ] = await Promise.all([

      // Membership progress
      db.findOne(
        `SELECT COUNT(*) AS sold,
                SUM(CASE WHEN purchased_at > NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) AS sold_30d,
                SUM(CASE WHEN purchased_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) AS sold_7d
         FROM memberships WHERE restaurant_id = $1 AND status = 'active'`,
        [rid]
      ),

      // Cash
      db.findOne(
        `SELECT
           SUM(CASE WHEN purchased_at > DATE_TRUNC('month', NOW()) THEN restaurant_amount ELSE 0 END) AS cash_month,
           SUM(CASE WHEN purchased_at > DATE_TRUNC('year', NOW()) THEN restaurant_amount ELSE 0 END) AS cash_ytd,
           SUM(CASE WHEN purchased_at > NOW() - INTERVAL '30 days' THEN restaurant_amount ELSE 0 END) AS cash_30d
         FROM memberships WHERE restaurant_id = $1 AND status = 'active'`,
        [rid]
      ),

      // Visit stats
      db.findOne(
        `SELECT
           COUNT(*) AS visits_month,
           COUNT(DISTINCT member_id) AS unique_members_month,
           ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT DATE_TRUNC('week', checked_in_at)),0),1) AS avg_weekly
         FROM check_ins
         WHERE restaurant_id = $1 AND checked_in_at > DATE_TRUNC('month', NOW())`,
        [rid]
      ),

      // Tonight's reservations (members who RSVPed to tonight's events OR checked in today)
      db.findMany(
        `SELECT DISTINCT u.first_name, u.last_name, m.serial_number, m.tier,
                (SELECT COUNT(*) FROM check_ins ci WHERE ci.membership_id = m.id) AS visit_count,
                er.created_at AS rsvp_at
         FROM event_rsvps er
         JOIN events e ON e.id = er.event_id
         JOIN memberships m ON m.restaurant_id = e.restaurant_id AND m.member_id = er.member_id
         JOIN users u ON u.id = er.member_id
         WHERE e.restaurant_id = $1 AND DATE(e.event_date) = CURRENT_DATE
         ORDER BY er.created_at`,
        [rid]
      ),

      // Active vote
      db.findOne(
        `SELECT v.id, v.question, v.closes_at,
                (SELECT COUNT(*) FROM vote_responses vr WHERE vr.vote_id = v.id) AS total_votes,
                json_agg(json_build_object(
                  'id', vo.id, 'text', vo.text,
                  'count', (SELECT COUNT(*) FROM vote_responses vr WHERE vr.vote_option_id = vo.id)
                ) ORDER BY vo.sort_order) AS options
         FROM votes v
         JOIN vote_options vo ON vo.vote_id = v.id
         WHERE v.restaurant_id = $1 AND v.status = 'live'
         GROUP BY v.id
         ORDER BY v.created_at DESC
         LIMIT 1`,
        [rid]
      ),

      // Recent activity feed
      db.findMany(
        `(SELECT 'join' AS type, u.first_name || ' ' || u.last_name AS name,
                 m.serial_number, m.tier, m.amount_paid, m.purchased_at AS ts
          FROM memberships m JOIN users u ON u.id = m.member_id
          WHERE m.restaurant_id = $1
          ORDER BY m.purchased_at DESC LIMIT 5)
         UNION ALL
         (SELECT 'visit' AS type, u.first_name || ' ' || u.last_name AS name,
                 m.serial_number, m.tier, NULL AS amount_paid, ci.checked_in_at AS ts
          FROM check_ins ci
          JOIN memberships m ON m.id = ci.membership_id
          JOIN users u ON u.id = ci.member_id
          WHERE ci.restaurant_id = $1
          ORDER BY ci.checked_in_at DESC LIMIT 5)
         ORDER BY ts DESC LIMIT 10`,
        [rid]
      ),

      // Menu stats
      db.findOne(
        `SELECT COUNT(*) AS total_dishes,
                ROUND(AVG(kcal)) AS avg_kcal,
                SUM(CASE WHEN nutrition_mode = 'ai' THEN 1 ELSE 0 END) AS ai_count,
                SUM(CASE WHEN nutrition_mode = 'precise' THEN 1 ELSE 0 END) AS precise_count
         FROM menu_dishes WHERE restaurant_id = $1 AND is_visible = TRUE`,
        [rid]
      ),
    ])

    const sold = parseInt(membershipStats?.sold || 0)
    const cap  = restaurant.membership_cap
    const pct  = cap > 0 ? Math.round((sold / cap) * 100) : 0

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        neighborhood: restaurant.neighborhood,
        city: restaurant.city,
        stripeOnboarded: restaurant.stripe_onboarded,
      },
      kpis: {
        cashMonth:   parseFloat(cashStats?.cash_month  || 0).toFixed(2),
        cashYTD:     parseFloat(cashStats?.cash_ytd    || 0).toFixed(2),
        cash30d:     parseFloat(cashStats?.cash_30d    || 0).toFixed(2),
        visitsMonth: parseInt(visitStats?.visits_month || 0),
        uniqueMonth: parseInt(visitStats?.unique_members_month || 0),
        avgWeekly:   parseFloat(visitStats?.avg_weekly || 0),
      },
      progress: {
        sold,
        cap,
        pct,
        remaining: cap - sold,
        sold30d: parseInt(membershipStats?.sold_30d || 0),
        sold7d:  parseInt(membershipStats?.sold_7d  || 0),
      },
      tonightCount:   tonightReservations.length,
      tonight:        tonightReservations,
      activeVote:     activeVote || null,
      recentActivity: recentActivity,
      menu: {
        totalDishes:   parseInt(menuStats?.total_dishes || 0),
        avgKcal:       parseInt(menuStats?.avg_kcal || 0),
        aiCount:       parseInt(menuStats?.ai_count || 0),
        preciseCount:  parseInt(menuStats?.precise_count || 0),
      },
    }
  })

  // GET /api/dashboard/:restaurantId/sales-chart
  // 30 days of daily sales for the chart
  app.get('/:restaurantId/sales-chart', { preHandler: requireOwner }, async (req, reply) => {
    const restaurant = await db.findOne(
      'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
      [req.params.restaurantId, req.user.id]
    )
    if (!restaurant) return reply.code(403).send({ error: 'Not your restaurant' })

    const data = await db.findMany(
      `SELECT DATE(purchased_at) AS date, COUNT(*) AS count, SUM(restaurant_amount) AS revenue
       FROM memberships
       WHERE restaurant_id = $1 AND purchased_at > NOW() - INTERVAL '30 days'
       GROUP BY DATE(purchased_at)
       ORDER BY date`,
      [req.params.restaurantId]
    )
    return data
  })
}
