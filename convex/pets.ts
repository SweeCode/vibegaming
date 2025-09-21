import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

const settingsValidator = v.object({
  fireRateMs: v.number(),
  damage: v.number()
})

const appearanceValidator = v.object({
  bodyColor: v.number(),
  eyeStyle: v.union(v.literal('dot'), v.literal('bar'), v.literal('glow')),
  shape: v.union(v.literal('circle'), v.literal('triangle'), v.literal('square'))
})

const levelsValidator = v.object({
  fireRateLevel: v.number(),
  damageLevel: v.number(),
  bulletSpeedLevel: v.number(),
  bulletSizeLevel: v.number()
})

const patchValidator = v.object({
  settings: v.optional(settingsValidator),
  appearance: v.optional(appearanceValidator),
  snacks: v.optional(v.number()),
  upgrades: v.optional(levelsValidator),
  selectedLevels: v.optional(levelsValidator),
  bestLevel: v.optional(v.number()),
  petUnlocked: v.optional(v.boolean())
})

const DEFAULT_SETTINGS = { fireRateMs: 600, damage: 3 }
const DEFAULT_APPEARANCE = { bodyColor: 0x66ccff, eyeStyle: 'dot' as const, shape: 'circle' as const }
const DEFAULT_LEVELS = { fireRateLevel: 0, damageLevel: 0, bulletSpeedLevel: 0, bulletSizeLevel: 0 }

type InternalState = {
  settings: typeof DEFAULT_SETTINGS
  appearance: typeof DEFAULT_APPEARANCE
  snacks: number
  upgrades: typeof DEFAULT_LEVELS
  selectedLevels: typeof DEFAULT_LEVELS
  bestLevel: number
  petUnlocked: boolean
  updatedAt: number
}

function cloneState(state: InternalState): InternalState {
  return {
    settings: { ...state.settings },
    appearance: { ...state.appearance },
    snacks: state.snacks,
    upgrades: { ...state.upgrades },
    selectedLevels: { ...state.selectedLevels },
    bestLevel: state.bestLevel,
    petUnlocked: state.petUnlocked,
    updatedAt: state.updatedAt
  }
}

function mergeState(existing: InternalState, patch: Record<string, unknown>, timestamp: number): InternalState {
  const next = cloneState(existing)
  if (patch.settings) next.settings = { ...(patch.settings as typeof DEFAULT_SETTINGS) }
  if (patch.appearance) next.appearance = { ...(patch.appearance as typeof DEFAULT_APPEARANCE) }
  if (patch.snacks !== undefined) next.snacks = patch.snacks as number
  if (patch.upgrades) next.upgrades = { ...(patch.upgrades as typeof DEFAULT_LEVELS) }
  if (patch.selectedLevels) next.selectedLevels = { ...(patch.selectedLevels as typeof DEFAULT_LEVELS) }
  if (patch.bestLevel !== undefined) next.bestLevel = patch.bestLevel as number
  if (patch.petUnlocked !== undefined) next.petUnlocked = patch.petUnlocked as boolean
  next.updatedAt = timestamp
  return next
}

export const getPetState = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const row = await ctx.db
      .query('petStates')
      .withIndex('by_device', q => q.eq('deviceId', deviceId))
      .unique()

    if (!row) {
      return cloneState({
        settings: { ...DEFAULT_SETTINGS },
        appearance: { ...DEFAULT_APPEARANCE },
        snacks: 0,
        upgrades: { ...DEFAULT_LEVELS },
        selectedLevels: { ...DEFAULT_LEVELS },
        bestLevel: 0,
        petUnlocked: false,
        updatedAt: 0
      })
    }

    return cloneState({
      settings: row.settings,
      appearance: row.appearance,
      snacks: row.snacks,
      upgrades: row.upgrades,
      selectedLevels: row.selectedLevels,
      bestLevel: row.bestLevel,
      petUnlocked: row.petUnlocked,
      updatedAt: row.updatedAt ?? 0
    })
  }
})

export const updatePetState = mutation({
  args: { deviceId: v.string(), patch: patchValidator },
  handler: async (ctx, { deviceId, patch }) => {
    const existing = await ctx.db
      .query('petStates')
      .withIndex('by_device', q => q.eq('deviceId', deviceId))
      .unique()

    const now = Date.now()

    if (existing) {
      const base: InternalState = {
        settings: existing.settings,
        appearance: existing.appearance,
        snacks: existing.snacks,
        upgrades: existing.upgrades,
        selectedLevels: existing.selectedLevels,
        bestLevel: existing.bestLevel,
        petUnlocked: existing.petUnlocked
      }
      const merged = mergeState(base, patch as Record<string, unknown>, now)
      await ctx.db.patch(existing._id, { ...merged, updatedAt: now })
      return merged
    }

    const merged = mergeState({
      settings: { ...DEFAULT_SETTINGS },
      appearance: { ...DEFAULT_APPEARANCE },
      snacks: 0,
      upgrades: { ...DEFAULT_LEVELS },
      selectedLevels: { ...DEFAULT_LEVELS },
      bestLevel: 0,
      petUnlocked: false,
      updatedAt: 0
    }, patch as Record<string, unknown>, now)

    await ctx.db.insert('petStates', {
      deviceId,
      ...merged,
      updatedAt: now
    })
    return merged
  }
})
