import { loadPetStateConvex, updatePetStateConvex, type PetStatePayload } from '@/lib/convexClient'

export type PetSettings = {
  fireRateMs: number
  damage: number
}

export type PetAppearance = {
  bodyColor: number
  eyeStyle: 'dot' | 'bar' | 'glow'
  shape: 'circle' | 'triangle' | 'square'
}

export type PetUpgradeLevels = {
  fireRateLevel: number
  damageLevel: number
  bulletSpeedLevel: number
  bulletSizeLevel: number
}

export type PetStateSnapshot = {
  settings: PetSettings
  appearance: PetAppearance
  snacks: number
  upgrades: PetUpgradeLevels
  selectedLevels: PetUpgradeLevels
  bestLevel: number
  petUnlocked: boolean
  updatedAt: number
}

const DEFAULT_SETTINGS: PetSettings = { fireRateMs: 600, damage: 3 }
const DEFAULT_APPEARANCE: PetAppearance = { bodyColor: 0x66ccff, eyeStyle: 'dot', shape: 'circle' }
const DEFAULT_LEVELS: PetUpgradeLevels = { fireRateLevel: 0, damageLevel: 0, bulletSpeedLevel: 0, bulletSizeLevel: 0 }

const UPDATED_AT_KEY = 'pet_state_updated_at'

let state: PetStateSnapshot = readLocalState()
let stateVersion = state.updatedAt
let syncPromise: Promise<void> | null = null

function cloneState(snapshot: PetStateSnapshot): PetStateSnapshot {
  return {
    settings: { ...snapshot.settings },
    appearance: { ...snapshot.appearance },
    snacks: snapshot.snacks,
    upgrades: { ...snapshot.upgrades },
    selectedLevels: { ...snapshot.selectedLevels },
    bestLevel: snapshot.bestLevel,
    petUnlocked: snapshot.petUnlocked,
    updatedAt: snapshot.updatedAt
  }
}

function readLocalState(): PetStateSnapshot {
  const base: PetStateSnapshot = {
    settings: { ...DEFAULT_SETTINGS },
    appearance: { ...DEFAULT_APPEARANCE },
    snacks: 0,
    upgrades: { ...DEFAULT_LEVELS },
    selectedLevels: { ...DEFAULT_LEVELS },
    bestLevel: 0,
    petUnlocked: false,
    updatedAt: 0
  }

  if (typeof window === 'undefined') return base

  try {
    const raw = window.localStorage.getItem('pet_settings')
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PetSettings>
      if (typeof parsed.fireRateMs === 'number') base.settings.fireRateMs = Math.max(200, Math.floor(parsed.fireRateMs))
      if (typeof parsed.damage === 'number') base.settings.damage = Math.max(1, Math.floor(parsed.damage))
    }
  } catch {}

  try {
    const raw = window.localStorage.getItem('pet_appearance')
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PetAppearance>
      if (typeof parsed.bodyColor === 'number') base.appearance.bodyColor = parsed.bodyColor >>> 0
      if (parsed.eyeStyle === 'dot' || parsed.eyeStyle === 'bar' || parsed.eyeStyle === 'glow') base.appearance.eyeStyle = parsed.eyeStyle
      if (parsed.shape === 'circle' || parsed.shape === 'triangle' || parsed.shape === 'square') base.appearance.shape = parsed.shape
    }
  } catch {}

  try {
    const snacksRaw = window.localStorage.getItem('pet_snacks')
    if (snacksRaw) base.snacks = Math.max(0, Math.floor(Number(snacksRaw)))
  } catch {}

  try {
    const upgradesRaw = window.localStorage.getItem('pet_upgrades')
    if (upgradesRaw) {
      const parsed = JSON.parse(upgradesRaw) as Partial<PetUpgradeLevels>
      base.upgrades = {
        fireRateLevel: Math.max(0, Math.floor(parsed.fireRateLevel ?? 0)),
        damageLevel: Math.max(0, Math.floor(parsed.damageLevel ?? 0)),
        bulletSpeedLevel: Math.max(0, Math.floor(parsed.bulletSpeedLevel ?? 0)),
        bulletSizeLevel: Math.max(0, Math.floor(parsed.bulletSizeLevel ?? 0))
      }
    }
  } catch {}

  try {
    const selectedRaw = window.localStorage.getItem('pet_selected_levels')
    if (selectedRaw) {
      const parsed = JSON.parse(selectedRaw) as Partial<PetUpgradeLevels>
      base.selectedLevels = {
        fireRateLevel: Math.max(0, Math.floor(parsed.fireRateLevel ?? base.upgrades.fireRateLevel)),
        damageLevel: Math.max(0, Math.floor(parsed.damageLevel ?? base.upgrades.damageLevel)),
        bulletSpeedLevel: Math.max(0, Math.floor(parsed.bulletSpeedLevel ?? base.upgrades.bulletSpeedLevel)),
        bulletSizeLevel: Math.max(0, Math.floor(parsed.bulletSizeLevel ?? base.upgrades.bulletSizeLevel))
      }
    } else {
      base.selectedLevels = { ...base.upgrades }
    }
  } catch {
    base.selectedLevels = { ...base.upgrades }
  }

  try {
    const bestRaw = window.localStorage.getItem('best_level')
    if (bestRaw) base.bestLevel = Math.max(0, Math.floor(Number(bestRaw)))
  } catch {}

  try {
    base.petUnlocked = window.localStorage.getItem('pet_unlocked') === '1'
  } catch {}

  try {
    const updatedRaw = window.localStorage.getItem(UPDATED_AT_KEY)
    if (updatedRaw) base.updatedAt = Math.max(0, Math.floor(Number(updatedRaw)))
  } catch {}

  return base
}

function persistLocal(snapshot: PetStateSnapshot): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem('pet_settings', JSON.stringify(snapshot.settings)) } catch {}
  try { window.localStorage.setItem('pet_appearance', JSON.stringify(snapshot.appearance)) } catch {}
  try { window.localStorage.setItem('pet_snacks', String(Math.max(0, Math.floor(snapshot.snacks)))) } catch {}
  try { window.localStorage.setItem('pet_upgrades', JSON.stringify(snapshot.upgrades)) } catch {}
  try { window.localStorage.setItem('pet_selected_levels', JSON.stringify(snapshot.selectedLevels)) } catch {}
  try { window.localStorage.setItem('best_level', String(Math.max(0, Math.floor(snapshot.bestLevel)))) } catch {}
  try { window.localStorage.setItem('pet_unlocked', snapshot.petUnlocked ? '1' : '0') } catch {}
  try { window.localStorage.setItem(UPDATED_AT_KEY, String(snapshot.updatedAt)) } catch {}
}

function toInternal(payload: PetStatePayload): PetStateSnapshot {
  return {
    settings: { ...payload.settings },
    appearance: { ...payload.appearance },
    snacks: Math.max(0, Math.floor(payload.snacks ?? 0)),
    upgrades: { ...payload.upgrades },
    selectedLevels: { ...payload.selectedLevels },
    bestLevel: Math.max(0, Math.floor(payload.bestLevel ?? 0)),
    petUnlocked: !!payload.petUnlocked,
    updatedAt: payload.updatedAt ?? Date.now()
  }
}

function applyState(newState: PetStateSnapshot): void {
  state = cloneState(newState)
  stateVersion = state.updatedAt
  persistLocal(state)
}

async function syncFromConvex(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const remote = await loadPetStateConvex()
    if (!remote) return
    const candidate = toInternal(remote)
    if (candidate.updatedAt >= stateVersion) {
      applyState(candidate)
    }
  } catch {}
}

function ensureSyncInFlight(): Promise<void> {
  if (!syncPromise) {
    syncPromise = syncFromConvex().finally(() => {
      syncPromise = null
    })
  }
  return syncPromise ?? Promise.resolve()
}

if (typeof window !== 'undefined') {
  void ensureSyncInFlight()
}

function partialToRemote(partial: Partial<PetStateSnapshot>): Partial<PetStatePayload> {
  const patch: Partial<PetStatePayload> = {}
  if (partial.settings) patch.settings = { ...partial.settings }
  if (partial.appearance) patch.appearance = { ...partial.appearance }
  if (partial.snacks !== undefined) patch.snacks = Math.max(0, Math.floor(partial.snacks))
  if (partial.upgrades) patch.upgrades = { ...partial.upgrades }
  if (partial.selectedLevels) patch.selectedLevels = { ...partial.selectedLevels }
  if (partial.bestLevel !== undefined) patch.bestLevel = Math.max(0, Math.floor(partial.bestLevel))
  if (partial.petUnlocked !== undefined) patch.petUnlocked = !!partial.petUnlocked
  return patch
}

async function pushRemoteUpdate(partial: Partial<PetStateSnapshot>): Promise<void> {
  if (typeof window === 'undefined') return
  const patch = partialToRemote(partial)
  if (Object.keys(patch).length === 0) return
  try {
    const remote = await updatePetStateConvex(patch)
    if (!remote) return
    const candidate = toInternal(remote)
    if (candidate.updatedAt >= stateVersion) {
      applyState(candidate)
    }
  } catch {}
}

export async function ensurePetStateLoaded(): Promise<void> {
  await ensureSyncInFlight()
}

export function getPetStateSnapshot(): PetStateSnapshot {
  return cloneState(state)
}

export function updatePetState(partial: Partial<PetStateSnapshot>): void {
  if (Object.keys(partial).length === 0) return
  const now = Date.now()
  const next: PetStateSnapshot = {
    settings: partial.settings ? { ...partial.settings } : { ...state.settings },
    appearance: partial.appearance ? { ...partial.appearance } : { ...state.appearance },
    snacks: partial.snacks !== undefined ? Math.max(0, Math.floor(partial.snacks)) : state.snacks,
    upgrades: partial.upgrades ? { ...partial.upgrades } : { ...state.upgrades },
    selectedLevels: partial.selectedLevels ? { ...partial.selectedLevels } : { ...state.selectedLevels },
    bestLevel: partial.bestLevel !== undefined ? Math.max(0, Math.floor(partial.bestLevel)) : state.bestLevel,
    petUnlocked: partial.petUnlocked !== undefined ? !!partial.petUnlocked : state.petUnlocked,
    updatedAt: now
  }
  state = next
  stateVersion = now
  persistLocal(state)
  void pushRemoteUpdate(partial)
}

export function resetPetStateLocalCache(): void {
  state = {
    settings: { ...DEFAULT_SETTINGS },
    appearance: { ...DEFAULT_APPEARANCE },
    snacks: 0,
    upgrades: { ...DEFAULT_LEVELS },
    selectedLevels: { ...DEFAULT_LEVELS },
    bestLevel: 0,
    petUnlocked: false,
    updatedAt: 0
  }
  stateVersion = 0
  persistLocal(state)
}
