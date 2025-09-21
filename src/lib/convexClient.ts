import { ConvexClient } from 'convex/browser'
import { getGuestId, getOrCreateGuestIdentity, type GuestIdentity, getStoredPlayerName, setStoredPlayerName } from './guestIdentity'

let client: ConvexClient | null = null

export function getConvexClient(): ConvexClient | null {
  if (typeof window === 'undefined') return null
  if (client) return client
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) return null
  client = new ConvexClient(url)
  return client
}

export type ClientIdentity = GuestIdentity

export function getDeviceId(): string {
  return getGuestId()
}

export function getOrCreateIdentity(): ClientIdentity {
  return getOrCreateGuestIdentity()
}

export function getCurrentUserKey(): string {
  return getGuestId()
}

type PublicScore = { name: string; score: number; time: number; createdAt: number }

export async function fetchTopScoresConvex(mode: 'endless' | 'wave', limit = 50): Promise<Array<PublicScore> | null> {
  const convex = getConvexClient()
  if (!convex) return null
  try {
    const result = await (convex as unknown as { query: (name: string, args: unknown) => Promise<unknown> }).query(
      'leaderboard:topScores',
      { mode, limit }
    )
    return Array.isArray(result) ? (result as Array<PublicScore>) : null
  } catch {
    return null
  }
}

export async function submitScoreConvex(args: { name: string; score: number; time: number; mode: 'endless' | 'wave' }): Promise<void> {
  const convex = getConvexClient()
  if (!convex) return
  try {
    await (convex as unknown as { mutation: (name: string, args: unknown) => Promise<unknown> }).mutation('leaderboard:submitScore', {
      ...args,
      deviceId: getGuestId()
    })
  } catch {
    // ignore network errors; local cache already updated
  }
}

export type WaveTotalsPayload = {
  totalScore: number
  completedWaves: number
  highestWave: number
}

export async function loadWaveTotalsConvex(): Promise<WaveTotalsPayload | null> {
  const convex = getConvexClient()
  if (!convex) return null
  try {
    const result = await (convex as unknown as { query: (name: string, args: unknown) => Promise<unknown> }).query(
      'waveProgress:getTotalScore',
      { deviceId: getGuestId() }
    )
    if (result && typeof result === 'object') {
      const payload = result as WaveTotalsPayload & { waveScores?: unknown }
      return {
        totalScore: payload.totalScore,
        completedWaves: payload.completedWaves,
        highestWave: payload.highestWave
      }
    }
    return null
  } catch {
    return null
  }
}

export type UpgradeLevelsPayload = {
  health: number
  speed: number
  maxAmmo: number
  reloadSpeed: number
  bulletSpeed: number
  bulletDamage: number
}

export async function loadUpgradesConvex(): Promise<UpgradeLevelsPayload | null> {
  const convex = getConvexClient()
  if (!convex) return null
  try {
    const result = await (convex as unknown as { query: (name: string, args: unknown) => Promise<unknown> }).query(
      'upgrades:getUpgrades',
      { deviceId: getGuestId() }
    )
    if (result && typeof result === 'object') return result as UpgradeLevelsPayload
    return null
  } catch {
    return null
  }
}

export async function saveUpgradesConvex(levels: UpgradeLevelsPayload): Promise<void> {
  const convex = getConvexClient()
  if (!convex) return
  try {
    await (convex as unknown as { mutation: (name: string, args: unknown) => Promise<unknown> }).mutation(
      'upgrades:saveUpgrades',
      { deviceId: getGuestId(), levels }
    )
  } catch {
    // ignore
  }
}

export type SkillTreeStatePayload = {
  version: number
  unlocked: Record<string, number>
  totalSpent: number
  updatedAt: number
}

export async function loadSkillTreeConvex(): Promise<SkillTreeStatePayload | null> {
  const convex = getConvexClient()
  if (!convex) return null
  try {
    const result = await (convex as unknown as { query: (name: string, args: unknown) => Promise<unknown> }).query(
      'skillTree:getSkillTree',
      { userKey: getCurrentUserKey() }
    )
    if (result && typeof result === 'object') return result as SkillTreeStatePayload
    return null
  } catch {
    return null
  }
}

export async function saveSkillTreeConvex(state: SkillTreeStatePayload): Promise<void> {
  const convex = getConvexClient()
  if (!convex) return
  try {
    await (convex as unknown as { mutation: (name: string, args: unknown) => Promise<unknown> }).mutation(
      'skillTree:saveSkillTree',
      { userKey: getCurrentUserKey(), state }
    )
  } catch {
    // ignore
  }
}

export { getGuestId, getStoredPlayerName, setStoredPlayerName }

export type PetStatePayload = {
  settings: { fireRateMs: number; damage: number }
  appearance: { bodyColor: number; eyeStyle: 'dot' | 'bar' | 'glow'; shape: 'circle' | 'triangle' | 'square' }
  snacks: number
  upgrades: { fireRateLevel: number; damageLevel: number; bulletSpeedLevel: number; bulletSizeLevel: number }
  selectedLevels: { fireRateLevel: number; damageLevel: number; bulletSpeedLevel: number; bulletSizeLevel: number }
  bestLevel: number
  petUnlocked: boolean
  updatedAt: number
}

export async function loadPetStateConvex(): Promise<PetStatePayload | null> {
  const convex = getConvexClient()
  if (!convex) return null
  try {
    const result = await (convex as unknown as { query: (name: string, args: unknown) => Promise<unknown> }).query(
      'pets:getPetState',
      { deviceId: getGuestId() }
    )
    if (result && typeof result === 'object') return result as PetStatePayload
    return null
  } catch {
    return null
  }
}

export async function updatePetStateConvex(patch: Partial<PetStatePayload>): Promise<PetStatePayload | null> {
  const convex = getConvexClient()
  if (!convex) return null
  try {
    const result = await (convex as unknown as { mutation: (name: string, args: unknown) => Promise<unknown> }).mutation(
      'pets:updatePetState',
      { deviceId: getGuestId(), patch }
    )
    if (result && typeof result === 'object') return result as PetStatePayload
    return null
  } catch {
    return null
  }
}

export type SkillBuildSlotPayload = {
  slot: number
  name: string
  snapshot: { unlocked: Record<string, number>; totalSpent: number }
  updatedAt?: number
}

export async function listSkillBuildSlotsConvex(): Promise<SkillBuildSlotPayload[] | null> {
  const convex = getConvexClient()
  if (!convex) return null
  try {
    const result = await (convex as unknown as { query: (name: string, args: unknown) => Promise<unknown> }).query(
      'skillBuilds:listBuildSlots',
      { userKey: getCurrentUserKey() }
    )
    if (Array.isArray(result)) return result as SkillBuildSlotPayload[]
    return null
  } catch {
    return null
  }
}

export async function saveSkillBuildSlotConvex(slot: number, name: string, snapshot: SkillBuildSlotPayload['snapshot']): Promise<boolean> {
  const convex = getConvexClient()
  if (!convex) return false
  try {
    await (convex as unknown as { mutation: (name: string, args: unknown) => Promise<unknown> }).mutation(
      'skillBuilds:saveBuildSlot',
      { userKey: getCurrentUserKey(), slot, name, snapshot }
    )
    return true
  } catch {
    return false
  }
}

export async function deleteSkillBuildSlotConvex(slot: number): Promise<boolean> {
  const convex = getConvexClient()
  if (!convex) return false
  try {
    await (convex as unknown as { mutation: (name: string, args: unknown) => Promise<unknown> }).mutation(
      'skillBuilds:deleteBuildSlot',
      { userKey: getCurrentUserKey(), slot }
    )
    return true
  } catch {
    return false
  }
}
