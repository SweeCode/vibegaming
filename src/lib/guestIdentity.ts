const GUEST_ID_STORAGE_KEY = 'bossrush_guest_id'
const PLAYER_NAME_STORAGE_KEY = 'bossrush_player_name'
const LEGACY_DEVICE_ID_KEY = 'deviceId'
const IDENTITY_STORAGE_KEY = 'clientIdentity'
const MAX_PLAYER_NAME_LENGTH = 12

const isBrowser = typeof window !== 'undefined'

const safeLocalStorage = {
  get(key: string): string | null {
    if (!isBrowser) return null
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    if (!isBrowser) return
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // ignore storage errors
    }
  },
  remove(key: string): void {
    if (!isBrowser) return
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore storage errors
    }
  }
}

function generateGuestId(): string {
  const randomSuffix = Math.random().toString(36).substring(2, 15)
  return `guest_${Date.now()}_${randomSuffix}`
}

export interface GuestIdentity {
  guestId: string
  createdAt: number
  playerName?: string
}

function normalizePlayerName(name: string | null): string | null {
  const trimmed = name?.trim() ?? ''
  if (!trimmed) return null
  return trimmed.slice(0, MAX_PLAYER_NAME_LENGTH)
}

export function getGuestId(): string {
  if (!isBrowser) return 'server'

  let id = safeLocalStorage.get(GUEST_ID_STORAGE_KEY)
  if (id) return id

  const identityRaw = safeLocalStorage.get(IDENTITY_STORAGE_KEY)
  if (identityRaw) {
    try {
      const parsed = JSON.parse(identityRaw) as { guestId?: unknown; deviceId?: unknown }
      if (typeof parsed.guestId === 'string' && parsed.guestId) {
        id = parsed.guestId
      } else if (typeof parsed.deviceId === 'string' && parsed.deviceId) {
        id = parsed.deviceId
      }
    } catch {
      // ignore malformed identity
    }
  }

  if (!id) {
    const legacyId = safeLocalStorage.get(LEGACY_DEVICE_ID_KEY)
    if (legacyId) {
      id = legacyId
    }
  }

  if (!id) {
    id = generateGuestId()
  }

  safeLocalStorage.set(GUEST_ID_STORAGE_KEY, id)
  safeLocalStorage.set(LEGACY_DEVICE_ID_KEY, id)

  return id
}

export function getStoredPlayerName(): string | null {
  const raw = safeLocalStorage.get(PLAYER_NAME_STORAGE_KEY)
  return normalizePlayerName(raw)
}

export function setStoredPlayerName(name: string): string | null {
  const normalized = normalizePlayerName(name)
  if (!isBrowser) return normalized

  if (normalized) {
    safeLocalStorage.set(PLAYER_NAME_STORAGE_KEY, normalized)
  } else {
    safeLocalStorage.remove(PLAYER_NAME_STORAGE_KEY)
  }

  const identity = getOrCreateGuestIdentity()
  const updated: GuestIdentity = {
    guestId: identity.guestId,
    createdAt: identity.createdAt
  }

  if (normalized) {
    updated.playerName = normalized
  }

  safeLocalStorage.set(IDENTITY_STORAGE_KEY, JSON.stringify(updated))
  return normalized
}

export function getOrCreateGuestIdentity(): GuestIdentity {
  if (!isBrowser) {
    return { guestId: 'server', createdAt: Date.now() }
  }

  const guestId = getGuestId()
  const storedName = getStoredPlayerName()
  const identityRaw = safeLocalStorage.get(IDENTITY_STORAGE_KEY)

  if (identityRaw) {
    try {
      const parsed = JSON.parse(identityRaw) as Partial<GuestIdentity> & { deviceId?: unknown }
      const createdAt = typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now()
      const playerName = normalizePlayerName(parsed.playerName ?? null) ?? storedName ?? undefined
      const identity: GuestIdentity = { guestId, createdAt }
      if (playerName) identity.playerName = playerName

      const needsUpdate =
        parsed.guestId !== guestId ||
        (playerName ? parsed.playerName !== playerName : typeof parsed.playerName === 'string')

      if (needsUpdate) {
        safeLocalStorage.set(IDENTITY_STORAGE_KEY, JSON.stringify(identity))
      }

      return identity
    } catch {
      // ignore malformed identity and regenerate below
    }
  }

  const identity: GuestIdentity = {
    guestId,
    createdAt: Date.now()
  }
  if (storedName) {
    identity.playerName = storedName
  }

  safeLocalStorage.set(IDENTITY_STORAGE_KEY, JSON.stringify(identity))
  return identity
}

export const storageKeys = {
  guestId: GUEST_ID_STORAGE_KEY,
  playerName: PLAYER_NAME_STORAGE_KEY,
  identity: IDENTITY_STORAGE_KEY
} as const
