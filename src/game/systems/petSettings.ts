import type { ActiveModifiers } from './SkillTreeManager'
import { getDamageCapBonus, getFireRateBonusMs } from './petUpgrades'
import {
  getPetStateSnapshot,
  updatePetState,
  ensurePetStateLoaded,
  type PetAppearance,
  type PetSettings
} from './petStateStore'

export type { PetSettings, PetAppearance } from './petStateStore'

const BASE_SETTINGS: PetSettings = { fireRateMs: 600, damage: 3 }

function clampSettings(input: PetSettings, mods?: Partial<ActiveModifiers>): PetSettings {
  const snapshot = getPetStateSnapshot()
  const withDefaults = { ...BASE_SETTINGS, ...snapshot.settings, ...input }
  const fireBonus = getFireRateBonusMs()
  const minFireRate = Math.max(
    200,
    Math.floor(((mods as unknown as { petFireRateMs?: number })?.petFireRateMs ?? withDefaults.fireRateMs) - fireBonus)
  )
  const damageCap = Math.max(
    1,
    Math.floor((mods?.petDrone?.dps ?? withDefaults.damage) + getDamageCapBonus())
  )
  return {
    fireRateMs: Math.max(minFireRate, Math.floor(withDefaults.fireRateMs)),
    damage: Math.min(damageCap, Math.max(1, Math.floor(withDefaults.damage)))
  }
}

export function loadPetSettings(mods?: Partial<ActiveModifiers>): PetSettings {
  const snapshot = getPetStateSnapshot()
  return clampSettings({ ...snapshot.settings }, mods)
}

export function savePetSettings(settings: PetSettings, mods?: Partial<ActiveModifiers>): void {
  const sanitized = clampSettings(settings, mods)
  updatePetState({ settings: sanitized })
}

export function loadPetAppearance(): PetAppearance {
  const snapshot = getPetStateSnapshot()
  return { ...snapshot.appearance }
}

export function savePetAppearance(appearance: PetAppearance): void {
  updatePetState({ appearance: { ...appearance } })
}

export function getBestLevel(): number {
  return getPetStateSnapshot().bestLevel
}

export function isPetUnlockedFlag(): boolean {
  return getPetStateSnapshot().petUnlocked
}

export function markPetUnlocked(): void {
  updatePetState({ petUnlocked: true })
}

export async function ensurePetStateReady(): Promise<void> {
  await ensurePetStateLoaded()
}
