import { getConvexClient } from './convexClient'
import { getGuestId, getOrCreateGuestIdentity, getStoredPlayerName, setStoredPlayerName } from './guestIdentity'

const isBrowser = typeof window !== 'undefined'

export interface SpawnPosition {
  x: number
  y: number
  scene: string
}

export interface GuestSessionUpdate {
  playerName?: string
  spawnPosition?: SpawnPosition
  sprite?: string
  health?: number
  lastWorldVisited?: string
}

export interface GuestSessionRecord extends GuestSessionUpdate {
  guestId: string
  createdAt: number
  updatedAt: number
  lastActiveAt: number
}

function pruneUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>
}

function sanitizeSpawnPosition(position: SpawnPosition | undefined): SpawnPosition | undefined {
  if (!position) return undefined
  const { x, y, scene } = position
  if (typeof x !== 'number' || typeof y !== 'number' || typeof scene !== 'string') return undefined
  return { x, y, scene }
}

async function upsertGuestSession(update: GuestSessionUpdate): Promise<void> {
  if (!isBrowser) return
  const convex = getConvexClient()
  if (!convex) return

  const guestId = getGuestId()
  const payload = pruneUndefined({
    ...update,
    spawnPosition: sanitizeSpawnPosition(update.spawnPosition)
  })

  if (Object.keys(payload).length === 0) {
    // Nothing to sync
    return
  }

  try {
    await (convex as unknown as { mutation: (name: string, args: unknown) => Promise<unknown> }).mutation(
      'guestSessions:upsertGuestSession',
      { guestId, data: payload }
    )
  } catch (error) {
    console.warn('Failed to sync guest session:', error)
  }
}

export async function ensureGuestSessionInitialized(extra?: GuestSessionUpdate): Promise<void> {
  if (!isBrowser) return
  const identity = getOrCreateGuestIdentity()
  const storedName = identity.playerName ?? getStoredPlayerName() ?? undefined
  const playerName = extra?.playerName ?? storedName ?? 'Anonymous'

  const baseUpdate: GuestSessionUpdate = {
    playerName,
    lastWorldVisited: extra?.lastWorldVisited ?? 'start-menu'
  }

  const mergedUpdate = { ...baseUpdate, ...extra }
  await upsertGuestSession(mergedUpdate)
}

export async function fetchGuestSession(): Promise<GuestSessionRecord | null> {
  if (!isBrowser) return null
  const convex = getConvexClient()
  if (!convex) return null
  try {
    const result = await (convex as unknown as { query: (name: string, args: unknown) => Promise<unknown> }).query(
      'guestSessions:getGuestSession',
      { guestId: getGuestId() }
    )
    if (result && typeof result === 'object') {
      return result as GuestSessionRecord
    }
  } catch (error) {
    console.warn('Failed to load guest session:', error)
  }
  return null
}

export function persistGuestPlayerName(name: string): string {
  const normalized = setStoredPlayerName(name) ?? 'Anonymous'
  void upsertGuestSession({ playerName: normalized })
  return normalized
}

export function recordLastWorldVisited(worldId: string): void {
  if (!worldId) return
  void upsertGuestSession({ lastWorldVisited: worldId })
}

export function recordSpawnPosition(position: SpawnPosition): void {
  void upsertGuestSession({ spawnPosition: position })
}

export function recordSpriteSelection(sprite: string): void {
  if (!sprite) return
  void upsertGuestSession({ sprite })
}

export function recordCurrentHealth(health: number): void {
  if (Number.isNaN(health)) return
  void upsertGuestSession({ health })
}
