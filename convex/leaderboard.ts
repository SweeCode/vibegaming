import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

export const topScores = query({
  args: { mode: v.union(v.literal('endless'), v.literal('wave')), limit: v.optional(v.number()) },
  handler: async (ctx, { mode, limit }) => {
    const lim = Math.min(Math.max(limit ?? 10, 1), 100)
    const rows = await ctx.db
      .query('scores')
      .withIndex('by_mode_score_time', q => q.eq('mode', mode))
      .order('desc')
      .take(lim)

    // Sort by score desc, then time asc, then date asc
    rows.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.time - b.time))

    return rows.map(r => ({ id: r._id, name: r.name, score: r.score, time: r.time, createdAt: r.createdAt }))
  }
})

export const submitScore = mutation({
  args: {
    name: v.string(),
    score: v.number(),
    time: v.number(),
    mode: v.union(v.literal('endless'), v.literal('wave')),
    deviceId: v.string()
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('scores', {
      name: args.name,
      score: args.score,
      time: args.time,
      mode: args.mode,
      deviceId: args.deviceId,
      createdAt: Date.now()
    })
    return { ok: true }
  }
})

export const resetDeviceScores = mutation({
  args: {
    deviceId: v.string(),
    mode: v.optional(v.union(v.literal('endless'), v.literal('wave')))
  },
  handler: async (ctx, { deviceId, mode }) => {
    let query = ctx.db
      .query('scores')
      .filter(q => q.eq(q.field('deviceId'), deviceId))

    if (mode) {
      query = query.filter(q => q.eq(q.field('mode'), mode))
    }

    const rows = await query.collect()

    for (const row of rows) {
      await ctx.db.delete(row._id)
    }

    return { deleted: rows.length }
  }
})
