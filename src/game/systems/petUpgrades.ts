import {
  getPetStateSnapshot,
  updatePetState,
  ensurePetStateLoaded,
  type PetUpgradeLevels
} from './petStateStore'

export type PetUpgrades = PetUpgradeLevels

const DEFAULT_UPGRADES: PetUpgrades = {
  fireRateLevel: 0,
  damageLevel: 0,
  bulletSpeedLevel: 0,
  bulletSizeLevel: 0
}

const UPGRADE_MAX: Record<keyof PetUpgrades, number> = {
  fireRateLevel: 8,
  damageLevel: 10,
  bulletSpeedLevel: 10,
  bulletSizeLevel: 10
}

function cloneLevels(levels: PetUpgrades): PetUpgrades {
  return { ...levels }
}

function clampLevels(levels: Partial<PetUpgrades>, cap: PetUpgrades): PetUpgrades {
  return {
    fireRateLevel: Math.max(0, Math.min(cap.fireRateLevel, Math.floor(levels.fireRateLevel ?? 0))),
    damageLevel: Math.max(0, Math.min(cap.damageLevel, Math.floor(levels.damageLevel ?? 0))),
    bulletSpeedLevel: Math.max(0, Math.min(cap.bulletSpeedLevel, Math.floor(levels.bulletSpeedLevel ?? 0))),
    bulletSizeLevel: Math.max(0, Math.min(cap.bulletSizeLevel, Math.floor(levels.bulletSizeLevel ?? 0)))
  }
}

function ensureSelectedWithinPurchased(selected: PetUpgrades, purchased: PetUpgrades): PetUpgrades {
  return {
    fireRateLevel: Math.max(0, Math.min(selected.fireRateLevel, purchased.fireRateLevel)),
    damageLevel: Math.max(0, Math.min(selected.damageLevel, purchased.damageLevel)),
    bulletSpeedLevel: Math.max(0, Math.min(selected.bulletSpeedLevel, purchased.bulletSpeedLevel)),
    bulletSizeLevel: Math.max(0, Math.min(selected.bulletSizeLevel, purchased.bulletSizeLevel))
  }
}

export async function ensurePetUpgradesReady(): Promise<void> {
  await ensurePetStateLoaded()
}

export function getSnacks(): number {
  return getPetStateSnapshot().snacks
}

export function setSnacks(value: number): void {
  updatePetState({ snacks: Math.max(0, Math.floor(value)) })
}

export function addSnacks(amount: number): void {
  const snapshot = getPetStateSnapshot()
  const added = Math.max(0, Math.floor(amount))
  updatePetState({ snacks: Math.max(0, snapshot.snacks + added) })
}

export function getUpgrades(): PetUpgrades {
  const snapshot = getPetStateSnapshot()
  return cloneLevels(snapshot.upgrades)
}

export function saveUpgrades(u: PetUpgrades): void {
  const clamped = clampLevels(u, {
    fireRateLevel: UPGRADE_MAX.fireRateLevel,
    damageLevel: UPGRADE_MAX.damageLevel,
    bulletSpeedLevel: UPGRADE_MAX.bulletSpeedLevel,
    bulletSizeLevel: UPGRADE_MAX.bulletSizeLevel
  })
  updatePetState({ upgrades: clamped })
}

export type PetUpgradeKind = keyof PetUpgrades

export function getUpgradeCost(kind: PetUpgradeKind, currentLevel: number): number {
  const base = 1
  return base + Math.max(0, currentLevel)
}

export function getMaxLevel(kind: PetUpgradeKind): number {
  return UPGRADE_MAX[kind]
}

export function tryPurchase(kind: PetUpgradeKind): { success: boolean; newSnacks: number; newLevel: number; cost: number } {
  const snapshot = getPetStateSnapshot()
  const upgrades = cloneLevels(snapshot.upgrades)
  const current = upgrades[kind]
  const max = getMaxLevel(kind)
  if (current >= max) {
    return { success: false, newSnacks: snapshot.snacks, newLevel: current, cost: getUpgradeCost(kind, current) }
  }
  const cost = getUpgradeCost(kind, current)
  if (snapshot.snacks < cost) {
    return { success: false, newSnacks: snapshot.snacks, newLevel: current, cost }
  }
  const nextLevel = current + 1
  upgrades[kind] = nextLevel
  const newSnacks = snapshot.snacks - cost
  const selected = ensureSelectedWithinPurchased(snapshot.selectedLevels, upgrades)
  updatePetState({ snacks: newSnacks, upgrades, selectedLevels: selected })
  return { success: true, newSnacks, newLevel: nextLevel, cost }
}

export function setLevel(kind: PetUpgradeKind, targetLevel: number): { success: boolean; newSnacks: number; newLevel: number; deltaCost: number } {
  const snapshot = getPetStateSnapshot()
  const upgrades = cloneLevels(snapshot.upgrades)
  const current = upgrades[kind]
  const max = getMaxLevel(kind)
  const clampedTarget = Math.max(0, Math.min(max, Math.floor(targetLevel)))
  if (clampedTarget === current) {
    return { success: true, newSnacks: snapshot.snacks, newLevel: current, deltaCost: 0 }
  }
  let deltaCost = 0
  if (clampedTarget > current) {
    for (let lvl = current; lvl < clampedTarget; lvl++) {
      deltaCost += getUpgradeCost(kind, lvl)
    }
    if (snapshot.snacks < deltaCost) {
      return { success: false, newSnacks: snapshot.snacks, newLevel: current, deltaCost }
    }
    upgrades[kind] = clampedTarget
    const newSnacks = snapshot.snacks - deltaCost
    const selected = ensureSelectedWithinPurchased(snapshot.selectedLevels, upgrades)
    updatePetState({ snacks: newSnacks, upgrades, selectedLevels: selected })
    return { success: true, newSnacks, newLevel: clampedTarget, deltaCost }
  }

  for (let lvl = clampedTarget; lvl < current; lvl++) {
    deltaCost += getUpgradeCost(kind, lvl)
  }
  upgrades[kind] = clampedTarget
  const newSnacks = snapshot.snacks + deltaCost
  const selected = ensureSelectedWithinPurchased(snapshot.selectedLevels, upgrades)
  updatePetState({ snacks: newSnacks, upgrades, selectedLevels: selected })
  return { success: true, newSnacks, newLevel: clampedTarget, deltaCost }
}

export function resetAllWithRefund(): { refunded: number; snacks: number; newLevels: PetUpgrades } {
  const snapshot = getPetStateSnapshot()
  const upgrades = cloneLevels(snapshot.upgrades)
  let refund = 0
  for (const kind of Object.keys(upgrades) as (keyof PetUpgrades)[]) {
    const level = upgrades[kind]
    for (let lvl = 0; lvl < level; lvl++) {
      refund += getUpgradeCost(kind, lvl)
    }
    upgrades[kind] = 0
  }
  const selected = ensureSelectedWithinPurchased(DEFAULT_UPGRADES, upgrades)
  const newSnacks = snapshot.snacks + refund
  updatePetState({ snacks: newSnacks, upgrades, selectedLevels: selected })
  return { refunded: refund, snacks: newSnacks, newLevels: upgrades }
}

export function getSelectedLevels(): PetUpgrades {
  const snapshot = getPetStateSnapshot()
  return cloneLevels(ensureSelectedWithinPurchased(snapshot.selectedLevels, snapshot.upgrades))
}

export function saveSelectedLevels(levels: PetUpgrades): void {
  const snapshot = getPetStateSnapshot()
  const clamped = ensureSelectedWithinPurchased(levels, snapshot.upgrades)
  updatePetState({ selectedLevels: clamped })
}

export function setSelectedLevel(kind: PetUpgradeKind, value: number): { success: boolean; newSelected: number } {
  const snapshot = getPetStateSnapshot()
  const selected = cloneLevels(snapshot.selectedLevels)
  const target = Math.max(0, Math.min(snapshot.upgrades[kind], Math.floor(value)))
  selected[kind] = target
  updatePetState({ selectedLevels: ensureSelectedWithinPurchased(selected, snapshot.upgrades) })
  return { success: true, newSelected: target }
}

export function getFireRateBonusMs(): number {
  const lvl = getSelectedLevels().fireRateLevel
  return 50 * lvl
}

export function getDamageCapBonus(): number {
  return getSelectedLevels().damageLevel
}

export function getBulletSpeedMultiplier(): number {
  const lvl = getSelectedLevels().bulletSpeedLevel
  return 1 + 0.1 * lvl
}

export function getBulletSizeMultiplier(): number {
  const lvl = getSelectedLevels().bulletSizeLevel
  return 1 + 0.1 * lvl
}
