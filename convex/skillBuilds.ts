import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

const snapshotValidator = v.object({
  unlocked: v.record(v.string(), v.number()),
  totalSpent: v.number()
})

export const listBuildSlots = query({
  args: { userKey: v.string() },
  handler: async (ctx, { userKey }) => {
    const rows = await ctx.db
      .query('skillBuilds')
      .withIndex('by_user_slot', q => q.eq('userKey', userKey))
      .collect()

    return rows
      .sort((a, b) => a.slot - b.slot)
      .map(row => ({ slot: row.slot, name: row.name, snapshot: row.snapshot, updatedAt: row.updatedAt }))
  }
})

export const saveBuildSlot = mutation({
  args: {
    userKey: v.string(),
    slot: v.number(),
    name: v.string(),
    snapshot: snapshotValidator
  },
  handler: async (ctx, { userKey, slot, name, snapshot }) => {
    const existing = await ctx.db
      .query('skillBuilds')
      .withIndex('by_user_slot', q => q.eq('userKey', userKey).eq('slot', slot))
      .unique()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, { name, snapshot, updatedAt: now })
      return { ok: true }
    }

    await ctx.db.insert('skillBuilds', {
      userKey,
      slot,
      name,
      snapshot,
      updatedAt: now
    })
    return { ok: true }
  }
})

export const deleteBuildSlot = mutation({
  args: { userKey: v.string(), slot: v.number() },
  handler: async (ctx, { userKey, slot }) => {
    const existing = await ctx.db
      .query('skillBuilds')
      .withIndex('by_user_slot', q => q.eq('userKey', userKey).eq('slot', slot))
      .unique()

    if (!existing) return { ok: false }

    await ctx.db.delete(existing._id)
    return { ok: true }
  }
})
