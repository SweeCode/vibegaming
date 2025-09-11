import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  scores: defineTable({
    name: v.string(),
    score: v.number(),
    time: v.number(), // seconds
    mode: v.union(v.literal('endless'), v.literal('wave')),
    deviceId: v.string(),
    createdAt: v.number() // Date.now()
  })
    .index('by_mode_score_time', [
      'mode',
      'score',
      'time',
      'createdAt'
    ]),
  upgrades: defineTable({
    deviceId: v.string(),
    levels: v.object({
      health: v.number(),
      speed: v.number(),
      maxAmmo: v.number(),
      reloadSpeed: v.number(),
      bulletSpeed: v.number(),
      bulletDamage: v.number()
    }),
    updatedAt: v.number()
  }).index('by_device', ['deviceId'])
  ,
  skillTrees: defineTable({
    userKey: v.string(),
    state: v.object({
      version: v.number(),
      unlocked: v.record(v.string(), v.number()),
      totalSpent: v.number(),
      updatedAt: v.number()
    }),
    updatedAt: v.number()
  }).index('by_user', ['userKey']),
  waveProgress: defineTable({
    deviceId: v.string(),
    waveNumber: v.number(),
    score: v.number(),
    completedAt: v.number(),
    isBoss: v.boolean(),
    bossType: v.optional(v.union(v.literal('sentinel'), v.literal('artillery'))),
    updatedAt: v.number()
  }).index('by_device_wave', ['deviceId', 'waveNumber'])
})
