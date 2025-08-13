import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

const stateValidator = v.object({
  version: v.number(),
  unlocked: v.record(v.string(), v.number()),
  totalSpent: v.number(),
  updatedAt: v.number()
})

export const getSkillTree = query({
  args: { userKey: v.string() },
  handler: async (ctx, { userKey }) => {
    const row = await ctx.db
      .query('skillTrees')
      .withIndex('by_user', q => q.eq('userKey', userKey))
      .unique()
    if (!row) return null
    return row.state
  }
})

export const saveSkillTree = mutation({
  args: { userKey: v.string(), state: stateValidator },
  handler: async (ctx, { userKey, state }) => {
    const existing = await ctx.db
      .query('skillTrees')
      .withIndex('by_user', q => q.eq('userKey', userKey))
      .unique()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, { state: { ...state, updatedAt: state.updatedAt ?? now }, updatedAt: now })
      return { ok: true }
    }
    await ctx.db.insert('skillTrees', { userKey, state: { ...state, updatedAt: state.updatedAt ?? now }, updatedAt: now })
    return { ok: true }
  }
})
