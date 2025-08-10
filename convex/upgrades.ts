import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

const levelsValidator = v.object({
  health: v.number(),
  speed: v.number(),
  maxAmmo: v.number(),
  reloadSpeed: v.number(),
  bulletSpeed: v.number(),
  bulletDamage: v.number()
})

export const getUpgrades = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const row = await ctx.db
      .query('upgrades')
      .withIndex('by_device', q => q.eq('deviceId', deviceId))
      .unique()
    if (!row) return null
    return row.levels
  }
})

export const saveUpgrades = mutation({
  args: { deviceId: v.string(), levels: levelsValidator },
  handler: async (ctx, { deviceId, levels }) => {
    const existing = await ctx.db
      .query('upgrades')
      .withIndex('by_device', q => q.eq('deviceId', deviceId))
      .unique()
    if (existing) {
      await ctx.db.patch(existing._id, { levels, updatedAt: Date.now() })
      return { ok: true }
    }
    await ctx.db.insert('upgrades', { deviceId, levels, updatedAt: Date.now() })
    return { ok: true }
  }
})
