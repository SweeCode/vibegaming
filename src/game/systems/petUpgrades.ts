export type PetUpgrades = {
  fireRateLevel: number
  damageLevel: number
  bulletSpeedLevel: number
  bulletSizeLevel: number
}

const DEFAULT_UPGRADES: PetUpgrades = {
  fireRateLevel: 0,
  damageLevel: 0,
  bulletSpeedLevel: 0,
  bulletSizeLevel: 0
}

const SNACKS_KEY = 'pet_snacks'
const UPGRADES_KEY = 'pet_upgrades'

export function getSnacks(): number {
  try { return Math.max(0, Math.floor(Number(localStorage.getItem(SNACKS_KEY) || '0'))) } catch { return 0 }
}

export function setSnacks(value: number): void {
  try { localStorage.setItem(SNACKS_KEY, String(Math.max(0, Math.floor(value)))) } catch {}
}

export function addSnacks(amount: number): void {
  setSnacks(getSnacks() + Math.max(0, Math.floor(amount)))
}

export function getUpgrades(): PetUpgrades {
  try {
    const raw = localStorage.getItem(UPGRADES_KEY)
    if (!raw) return { ...DEFAULT_UPGRADES }
    const parsed = JSON.parse(raw) as Partial<PetUpgrades>
    return { ...DEFAULT_UPGRADES, ...parsed }
  } catch {
    return { ...DEFAULT_UPGRADES }
  }
}

export function saveUpgrades(u: PetUpgrades): void {
  try { localStorage.setItem(UPGRADES_KEY, JSON.stringify(u)) } catch {}
}

export type PetUpgradeKind = keyof PetUpgrades

export function getUpgradeCost(kind: PetUpgradeKind, currentLevel: number): number {
  // Linear cost growth: 1, 2, 3, ... keeps progress steady with boss kills
  const base = 1
  return base + Math.max(0, currentLevel)
}

export function getMaxLevel(kind: PetUpgradeKind): number {
  switch (kind) {
    case 'fireRateLevel': return 8 // up to 8*50ms = 400ms faster
    case 'damageLevel': return 10 // up to +10 damage cap
    case 'bulletSpeedLevel': return 10 // up to +100% speed
    case 'bulletSizeLevel': return 10 // up to +100% size
  }
}

export function tryPurchase(kind: PetUpgradeKind): { success: boolean; newSnacks: number; newLevel: number; cost: number } {
  const u = getUpgrades()
  const current = u[kind]
  const max = getMaxLevel(kind)
  if (current >= max) return { success: false, newSnacks: getSnacks(), newLevel: current, cost: getUpgradeCost(kind, current) }
  const cost = getUpgradeCost(kind, current)
  const snacks = getSnacks()
  if (snacks < cost) return { success: false, newSnacks: snacks, newLevel: current, cost }
  // spend and level up
  setSnacks(snacks - cost)
  const next = current + 1
  u[kind] = next
  saveUpgrades(u)
  return { success: true, newSnacks: getSnacks(), newLevel: next, cost }
}

// Effects helpers
export function getFireRateBonusMs(): number {
  const lvl = getUpgrades().fireRateLevel
  return 50 * lvl
}

export function getDamageCapBonus(): number {
  return getUpgrades().damageLevel
}

export function getBulletSpeedMultiplier(): number {
  const lvl = getUpgrades().bulletSpeedLevel
  return 1 + 0.1 * lvl
}

export function getBulletSizeMultiplier(): number {
  const lvl = getUpgrades().bulletSizeLevel
  return 1 + 0.1 * lvl
}
