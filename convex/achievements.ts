import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const listAchievements = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query('achievements').withIndex('by_device', q => q.eq('deviceId', args.deviceId)).collect()
    return rows
  }
})

export const grantAchievement = mutation({
  args: { deviceId: v.string(), achievementId: v.string(), title: v.string(), unlockedAt: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('achievements').withIndex('by_device_ach', q => q.eq('deviceId', args.deviceId).eq('achievementId', args.achievementId)).unique()
    if (existing) return existing._id
    const id = await ctx.db.insert('achievements', { ...args })
    return id
  }
})


