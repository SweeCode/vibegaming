import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const petSettingsValidator = v.object({
  fireRateMs: v.number(),
  damage: v.number()
})

const petAppearanceValidator = v.object({
  bodyColor: v.number(),
  eyeStyle: v.union(v.literal('dot'), v.literal('bar'), v.literal('glow')),
  shape: v.union(v.literal('circle'), v.literal('triangle'), v.literal('square'))
})

const petLevelsValidator = v.object({
  fireRateLevel: v.number(),
  damageLevel: v.number(),
  bulletSpeedLevel: v.number(),
  bulletSizeLevel: v.number()
})

const skillBuildSnapshotValidator = v.object({
  unlocked: v.record(v.string(), v.number()),
  totalSpent: v.number()
})

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
  guestSessions: defineTable({
    guestId: v.string(),
    playerName: v.string(),
    spawnPosition: v.optional(v.object({
      x: v.number(),
      y: v.number(),
      scene: v.string()
    })),
    sprite: v.optional(v.string()),
    health: v.optional(v.number()),
    lastWorldVisited: v.optional(v.string()),
    lastActiveAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    linkedUserId: v.optional(v.string())
  }).index('by_guest', ['guestId']),
  waveProgress: defineTable({
    deviceId: v.string(),
    waveNumber: v.number(),
    score: v.number(),
    completedAt: v.number(),
    isBoss: v.boolean(),
    bossType: v.optional(v.union(v.literal('sentinel'), v.literal('artillery'))),
    updatedAt: v.number()
  }).index('by_device_wave', ['deviceId', 'waveNumber'])
  ,
  petStates: defineTable({
    deviceId: v.string(),
    settings: petSettingsValidator,
    appearance: petAppearanceValidator,
    snacks: v.number(),
    upgrades: petLevelsValidator,
    selectedLevels: petLevelsValidator,
    bestLevel: v.number(),
    petUnlocked: v.boolean(),
    updatedAt: v.number()
  }).index('by_device', ['deviceId'])
  ,
  skillBuilds: defineTable({
    userKey: v.string(),
    slot: v.number(),
    name: v.string(),
    snapshot: skillBuildSnapshotValidator,
    updatedAt: v.number()
  }).index('by_user_slot', ['userKey', 'slot'])
  ,
  achievements: defineTable({
    deviceId: v.string(),
    achievementId: v.string(),
    title: v.string(),
    unlockedAt: v.number()
  })
    .index('by_device', ['deviceId'])
    .index('by_device_ach', ['deviceId', 'achievementId'])
})
