import { db } from '../db/client.js'

// Verify JWT and attach user to request
export async function authenticate(request, reply) {
  try {
    await request.jwtVerify()
    // Attach full user from DB
    const user = await db.findOne(
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = $1',
      [request.user.id]
    )
    if (!user) return reply.code(401).send({ error: 'User not found' })
    request.user = user
  } catch (err) {
    return reply.code(401).send({ error: 'Invalid or expired token' })
  }
}

// Require owner role
export async function requireOwner(request, reply) {
  await authenticate(request, reply)
  if (request.user?.role !== 'owner' && request.user?.role !== 'admin') {
    return reply.code(403).send({ error: 'Owner access required' })
  }
}

// Require admin role
export async function requireAdmin(request, reply) {
  await authenticate(request, reply)
  if (request.user?.role !== 'admin') {
    return reply.code(403).send({ error: 'Admin access required' })
  }
}

// Require the owner to own this specific restaurant
export async function requireRestaurantOwner(request, reply) {
  await requireOwner(request, reply)
  const restaurantId = request.params.restaurantId || request.body?.restaurantId
  if (!restaurantId) return reply.code(400).send({ error: 'Restaurant ID required' })

  const restaurant = await db.findOne(
    'SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2',
    [restaurantId, request.user.id]
  )
  if (!restaurant) {
    return reply.code(403).send({ error: 'You do not own this restaurant' })
  }
  request.restaurant = restaurant
}
