import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

const spawnPositionValidator = v.object({
  x: v.number(),
  y: v.number(),
  scene: v.string()
})

const guestSessionUpdateValidator = v.object({
  playerName: v.optional(v.string()),
  spawnPosition: v.optional(spawnPositionValidator),
  sprite: v.optional(v.string()),
  health: v.optional(v.number()),
  lastWorldVisited: v.optional(v.string()),
  linkedUserId: v.optional(v.string())
})

function sanitizePlayerName(name: string | undefined): string | undefined {
  if (name === undefined) return undefined
  const trimmed = name.trim()
  if (!trimmed) return 'Anonymous'
  return trimmed.slice(0, 12)
}

export const getGuestSession = query({
  args: { guestId: v.string() },
  handler: async (ctx, { guestId }) => {
    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_guest', q => q.eq('guestId', guestId))
      .unique()

    if (!session) return null

    return {
      guestId: session.guestId,
      playerName: session.playerName,
      spawnPosition: session.spawnPosition,
      sprite: session.sprite,
      health: session.health,
      lastWorldVisited: session.lastWorldVisited,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastActiveAt: session.lastActiveAt,
      linkedUserId: session.linkedUserId
    }
  }
})

export const upsertGuestSession = mutation({
  args: { guestId: v.string(), data: guestSessionUpdateValidator },
  handler: async (ctx, { guestId, data }) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('guestSessions')
      .withIndex('by_guest', q => q.eq('guestId', guestId))
      .unique()

    const playerName = sanitizePlayerName(data.playerName)

    if (existing) {
      const update: Record<string, unknown> = {
        lastActiveAt: now,
        updatedAt: now
      }

      if (playerName !== undefined) update.playerName = playerName
      if (data.spawnPosition !== undefined) update.spawnPosition = data.spawnPosition
      if (data.sprite !== undefined) update.sprite = data.sprite
      if (data.health !== undefined) update.health = data.health
      if (data.lastWorldVisited !== undefined) update.lastWorldVisited = data.lastWorldVisited
      if (data.linkedUserId !== undefined) update.linkedUserId = data.linkedUserId

      await ctx.db.patch(existing._id, update)
      return { guestId, createdAt: existing.createdAt, updatedAt: now }
    }

    await ctx.db.insert('guestSessions', {
      guestId,
      playerName: playerName ?? 'Anonymous',
      spawnPosition: data.spawnPosition,
      sprite: data.sprite,
      health: data.health,
      lastWorldVisited: data.lastWorldVisited ?? 'start-menu',
      lastActiveAt: now,
      createdAt: now,
      updatedAt: now,
      linkedUserId: data.linkedUserId
    })

    return { guestId, createdAt: now, updatedAt: now }
  }
})

export const linkGuestToUser = mutation({
  args: { guestId: v.string(), userId: v.string() },
  handler: async (ctx, { guestId, userId }) => {
    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_guest', q => q.eq('guestId', guestId))
      .unique()

    if (!session) {
      throw new Error('Guest session not found')
    }

    const now = Date.now()
    await ctx.db.patch(session._id, {
      linkedUserId: userId,
      updatedAt: now,
      lastActiveAt: now
    })

    return { guestId, linkedUserId: userId }
  }
})
