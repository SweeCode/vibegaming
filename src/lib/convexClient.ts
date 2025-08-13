import { ConvexClient } from 'convex/browser'

let client: ConvexClient | null = null

export function getConvexClient(): ConvexClient | null {
  if (typeof window === 'undefined') return null
  if (client) return client
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) return null
  client = new ConvexClient(url)
  return client
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'
  const key = 'deviceId'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export type ClientIdentity = { deviceId: string; createdAt: number; name?: string }

export function getOrCreateIdentity(): ClientIdentity {
  if (typeof window === 'undefined') return { deviceId: 'server', createdAt: Date.now() }
  const key = 'clientIdentity'
  const existing = localStorage.getItem(key)
  if (existing) return JSON.parse(existing) as ClientIdentity
  const identity: ClientIdentity = { deviceId: getDeviceId(), createdAt: Date.now() }
  localStorage.setItem(key, JSON.stringify(identity))
  return identity
}

export function getCurrentUserKey(): string {
  // Placeholder for future auth-based identity. For now, deviceId is the user key.
  return getDeviceId()
}

type PublicScore = { name: string; score: number; time: number; createdAt: number }

export async function fetchTopScoresConvex(mode: 'endless' | 'wave', limit = 50): Promise<Array<PublicScore> | null> {
  const client = getConvexClient()
  if (!client) return null
  try {
    const result = await (client as unknown as { query: (name: string, args: unknown) => Promise<unknown> }).query(
      'leaderboard:topScores',
      { mode, limit }
    )
    return Array.isArray(result) ? (result as Array<PublicScore>) : null
  } catch {
    return null
  }
}

export async function submitScoreConvex(args: { name: string; score: number; time: number; mode: 'endless' | 'wave' }): Promise<void> {
  const client = getConvexClient()
  if (!client) return
  try {
    await (client as unknown as { mutation: (name: string, args: unknown) => Promise<unknown> }).mutation('leaderboard:submitScore', {
      ...args,
      deviceId: getDeviceId()
    })
  } catch {
    // ignore network errors; local cache already updated
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
  const client = getConvexClient()
  if (!client) return null
  try {
    const result = await (client as unknown as { query: (name: string, args: unknown) => Promise<unknown> }).query(
      'upgrades:getUpgrades',
      { deviceId: getDeviceId() }
    )
    if (result && typeof result === 'object') return result as UpgradeLevelsPayload
    return null
  } catch {
    return null
  }
}

export async function saveUpgradesConvex(levels: UpgradeLevelsPayload): Promise<void> {
  const client = getConvexClient()
  if (!client) return
  try {
    await (client as unknown as { mutation: (name: string, args: unknown) => Promise<unknown> }).mutation(
      'upgrades:saveUpgrades',
      { deviceId: getDeviceId(), levels }
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
  const client = getConvexClient()
  if (!client) return null
  try {
    const result = await (client as unknown as { query: (name: string, args: unknown) => Promise<unknown> }).query(
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
  const client = getConvexClient()
  if (!client) return
  try {
    await (client as unknown as { mutation: (name: string, args: unknown) => Promise<unknown> }).mutation(
      'skillTree:saveSkillTree',
      { userKey: getCurrentUserKey(), state }
    )
  } catch {
    // ignore
  }
}
