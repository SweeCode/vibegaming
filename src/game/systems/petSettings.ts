import type { ActiveModifiers } from './SkillTreeManager'
import { getDamageCapBonus, getFireRateBonusMs } from './petUpgrades'

export type PetSettings = {
  fireRateMs: number
  damage: number
}

const DEFAULTS: PetSettings = { fireRateMs: 600, damage: 3 }

export function loadPetSettings(mods?: Partial<ActiveModifiers>): PetSettings {
  let stored: Partial<PetSettings> = {}
  try {
    const raw = localStorage.getItem('pet_settings')
    if (raw) stored = JSON.parse(raw)
  } catch {}
  const minRate = Math.max(200, Math.floor(((mods as unknown as { petFireRateMs?: number })?.petFireRateMs || DEFAULTS.fireRateMs) - getFireRateBonusMs()))
  const maxDmg = Math.max(1, Math.floor((mods?.petDrone?.dps ?? DEFAULTS.damage) + getDamageCapBonus()))
  const fireRateMs = Math.max(minRate, Math.floor(stored.fireRateMs ?? DEFAULTS.fireRateMs))
  const damage = Math.min(maxDmg, Math.max(1, Math.floor(stored.damage ?? DEFAULTS.damage)))
  return { fireRateMs, damage }
}

export function savePetSettings(settings: PetSettings) {
  try { localStorage.setItem('pet_settings', JSON.stringify(settings)) } catch {}
}

export function getBestLevel(): number {
  try { return Number(localStorage.getItem('best_level') || '0') } catch { return 0 }
}

export function isPetUnlockedFlag(): boolean {
  try { return localStorage.getItem('pet_unlocked') === '1' } catch { return false }
}

export function markPetUnlocked(): void {
  try { localStorage.setItem('pet_unlocked', '1') } catch {}
}
