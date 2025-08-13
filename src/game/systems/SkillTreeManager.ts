import { loadSkillTreeConvex, saveSkillTreeConvex, loadUpgradesConvex } from '@/lib/convexClient'

export type Specialization = 'basic' | 'special' | 'defense'

export type SkillEffect = {
  stats?: Partial<{
    health: number
    speed: number
    maxAmmo: number
    reloadSpeedMs: number
    bulletSpeed: number
    bulletDamage: number
  }>
  modifiers?: Partial<{
    damageReductionPct: number
    healPerSecond: number
    ricochetBounces: number
    pierceCount: number
    petDrone: { enabled: boolean; dps: number }
    shieldAfterIdle: { enabled: boolean; idleSeconds: number; shieldHp: number }
  }>
}

export type SkillNode = {
  id: string
  title: string
  description: string
  specialization: Specialization
  position: { x: number; y: number }
  maxRank: number
  baseCost: number
  costScale: number
  prerequisites?: Array<{ nodeId: string; minRank: number }>
  effectPerRank: (rank: number) => SkillEffect
}

export type SkillTreeState = {
  version: number
  unlocked: Record<string, number>
  totalSpent: number
  updatedAt: number
}

export type ActiveModifiers = {
  damageReductionPct: number
  healPerSecond: number
  ricochetBounces: number
  pierceCount: number
  petDrone: { enabled: boolean; dps: number }
  shieldAfterIdle: { enabled: boolean; idleSeconds: number; shieldHp: number }
}

const TREE_VERSION = 1

function now(): number { return Date.now() }

export class SkillTreeManager {
  private state: SkillTreeState
  private nodes: SkillNode[]
  private idToNode: Map<string, SkillNode>

  constructor() {
    this.nodes = defineNodes()
    this.idToNode = new Map(this.nodes.map(n => [n.id, n]))
    this.state = this.loadLocal() || { version: TREE_VERSION, unlocked: {}, totalSpent: 0, updatedAt: now() }
  }

  async initialize(): Promise<void> {
    // Try remote
    const remote = await loadSkillTreeConvex()
    if (remote && remote.version === TREE_VERSION) {
      // Last-write-wins by updatedAt
      if (!this.state || remote.updatedAt >= this.state.updatedAt) {
        this.state = { ...remote }
        this.saveLocal()
        return
      }
    }
    // Fallback: migrate from legacy upgrades
    const legacy = await loadUpgradesConvex()
    if (legacy && (!this.state || Object.keys(this.state.unlocked).length === 0)) {
      this.migrateFromLegacy(legacy)
      await saveSkillTreeConvex(this.state)
      this.saveLocal()
    } else {
      // Ensure remote has our local if remote empty
      await saveSkillTreeConvex(this.state)
    }
  }

  private migrateFromLegacy(levels: { [k: string]: number }) {
    const grants: Array<[string, number]> = [
      ['basic_speed_1', Math.min(3, levels.speed ?? 0)],
      ['basic_reload_1', Math.min(2, levels.reloadSpeed ?? 0)],
      ['basic_ammo_1', Math.min(2, levels.maxAmmo ?? 0)],
      ['basic_damage_1', Math.min(3, levels.bulletDamage ?? 0)],
      ['defense_health_1', Math.min(3, levels.health ?? 0)]
    ]
    const unlocked: Record<string, number> = {}
    let spent = 0
    for (const [id, rank] of grants) {
      if (rank <= 0) continue
      const node = this.idToNode.get(id)
      if (!node) continue
      const clamped = Math.min(node.maxRank, rank)
      unlocked[id] = clamped
      // approximate spent cost
      for (let r = 0; r < clamped; r++) {
        spent += Math.floor(node.baseCost * Math.pow(node.costScale, r))
      }
    }
    this.state = { version: TREE_VERSION, unlocked, totalSpent: spent, updatedAt: now() }
  }

  private saveLocal() {
    try { localStorage.setItem('skillTree:v1', JSON.stringify(this.state)) } catch {}
  }
  private loadLocal(): SkillTreeState | null {
    try {
      const raw = localStorage.getItem('skillTree:v1')
      if (!raw) return null
      const parsed = JSON.parse(raw) as SkillTreeState
      return parsed.version === TREE_VERSION ? parsed : null
    } catch { return null }
  }

  getState(): SkillTreeState { return { ...this.state, unlocked: { ...this.state.unlocked } } }

  getUnlocked(nodeId: string): number { return this.state.unlocked[nodeId] ?? 0 }

  canUnlock(nodeId: string, availablePoints: number): boolean {
    const node = this.idToNode.get(nodeId)
    if (!node) return false
    const current = this.getUnlocked(nodeId)
    if (current >= node.maxRank) return false
    // prerequisites
    if (node.prerequisites) {
      for (const p of node.prerequisites) {
        if ((this.state.unlocked[p.nodeId] ?? 0) < p.minRank) return false
      }
    }
    const cost = this.getNextCost(nodeId)
    return availablePoints >= cost
  }

  getNextCost(nodeId: string): number {
    const node = this.idToNode.get(nodeId)
    if (!node) return Number.MAX_SAFE_INTEGER
    const current = this.getUnlocked(nodeId)
    return Math.floor(node.baseCost * Math.pow(node.costScale, current))
  }

  unlock(nodeId: string, availablePoints: number): { success: boolean; cost: number; newPoints: number } {
    const node = this.idToNode.get(nodeId)
    if (!node) return { success: false, cost: 0, newPoints: availablePoints }
    if (!this.canUnlock(nodeId, availablePoints)) return { success: false, cost: this.getNextCost(nodeId), newPoints: availablePoints }
    const cost = this.getNextCost(nodeId)
    const current = this.getUnlocked(nodeId)
    this.state.unlocked[nodeId] = current + 1
    this.state.totalSpent += cost
    this.state.updatedAt = now()
    this.saveLocal()
    void saveSkillTreeConvex(this.state)
    return { success: true, cost, newPoints: availablePoints - cost }
  }

  reset(): void {
    this.state = { version: TREE_VERSION, unlocked: {}, totalSpent: 0, updatedAt: now() }
    this.saveLocal()
    void saveSkillTreeConvex(this.state)
  }

  getEffectiveStats(): { health: number; speed: number; maxAmmo: number; reloadSpeed: number; bulletSpeed: number; bulletDamage: number } {
    const base = { health: 100, speed: 200, maxAmmo: 10, reloadSpeed: 2000, bulletSpeed: 400, bulletDamage: 1 }
    const delta = { health: 0, speed: 0, maxAmmo: 0, reloadSpeed: 0, bulletSpeed: 0, bulletDamage: 0 }
    for (const node of this.nodes) {
      const rank = this.getUnlocked(node.id)
      if (rank <= 0) continue
      const eff = node.effectPerRank(rank).stats
      if (!eff) continue
      delta.health += eff.health ?? 0
      delta.speed += eff.speed ?? 0
      delta.maxAmmo += eff.maxAmmo ?? 0
      delta.reloadSpeed += eff.reloadSpeedMs ?? 0
      delta.bulletSpeed += eff.bulletSpeed ?? 0
      delta.bulletDamage += eff.bulletDamage ?? 0
    }
    return {
      health: base.health + delta.health,
      speed: base.speed + delta.speed,
      maxAmmo: base.maxAmmo + delta.maxAmmo,
      reloadSpeed: Math.max(500, base.reloadSpeed + delta.reloadSpeed),
      bulletSpeed: base.bulletSpeed + delta.bulletSpeed,
      bulletDamage: base.bulletDamage + delta.bulletDamage
    }
  }

  getActiveModifiers(): ActiveModifiers {
    const mods: ActiveModifiers = {
      damageReductionPct: 0,
      healPerSecond: 0,
      ricochetBounces: 0,
      pierceCount: 0,
      petDrone: { enabled: false, dps: 0 },
      shieldAfterIdle: { enabled: false, idleSeconds: 0, shieldHp: 0 }
    }
    for (const node of this.nodes) {
      const rank = this.getUnlocked(node.id)
      if (rank <= 0) continue
      const eff = node.effectPerRank(rank).modifiers
      if (!eff) continue
      mods.damageReductionPct += eff.damageReductionPct ?? 0
      mods.healPerSecond += eff.healPerSecond ?? 0
      mods.ricochetBounces += eff.ricochetBounces ?? 0
      mods.pierceCount += eff.pierceCount ?? 0
      if (eff.petDrone?.enabled) mods.petDrone = eff.petDrone
      if (eff.shieldAfterIdle?.enabled) mods.shieldAfterIdle = eff.shieldAfterIdle
    }
    // clamp
    mods.damageReductionPct = Math.min(0.8, Math.max(0, mods.damageReductionPct))
    return mods
  }

  getNodes(): SkillNode[] { return this.nodes }
}

function defineNodes(): SkillNode[] {
  const nodes: SkillNode[] = []
  // Basic branch
  nodes.push({
    id: 'basic_speed_1', title: 'Fleet Footed', description: '+20 speed per rank', specialization: 'basic', position: { x: 0, y: 0 }, maxRank: 3, baseCost: 150, costScale: 1.5,
    effectPerRank: (r) => ({ stats: { speed: 20 * r } })
  })
  nodes.push({
    id: 'basic_reload_1', title: 'Rapid Reload', description: '-150ms reload per rank', specialization: 'basic', position: { x: 1, y: 0 }, maxRank: 2, baseCost: 250, costScale: 1.5,
    effectPerRank: (r) => ({ stats: { reloadSpeedMs: -150 * r } }), prerequisites: [{ nodeId: 'basic_speed_1', minRank: 1 }]
  })
  nodes.push({
    id: 'basic_ammo_1', title: 'Expanded Mags', description: '+2 ammo per rank', specialization: 'basic', position: { x: 0, y: 1 }, maxRank: 2, baseCost: 200, costScale: 1.5,
    effectPerRank: (r) => ({ stats: { maxAmmo: 2 * r } })
  })
  nodes.push({
    id: 'basic_damage_1', title: 'Hollow Point', description: '+1 damage per rank', specialization: 'basic', position: { x: 1, y: 1 }, maxRank: 3, baseCost: 400, costScale: 1.5,
    effectPerRank: (r) => ({ stats: { bulletDamage: 1 * r } })
  })

  // Special branch
  nodes.push({
    id: 'special_pierce_1', title: 'Piercing Rounds', description: '+1 pierce per rank', specialization: 'special', position: { x: 0, y: 0 }, maxRank: 2, baseCost: 500, costScale: 1.6,
    effectPerRank: (r) => ({ modifiers: { pierceCount: r } }), prerequisites: [{ nodeId: 'basic_damage_1', minRank: 1 }]
  })
  nodes.push({
    id: 'special_ricochet_1', title: 'Ricochet Rounds', description: '+1 bounce', specialization: 'special', position: { x: 1, y: 0 }, maxRank: 1, baseCost: 600, costScale: 1.6,
    effectPerRank: (_r) => ({ modifiers: { ricochetBounces: 1 } }), prerequisites: [{ nodeId: 'special_pierce_1', minRank: 1 }]
  })
  nodes.push({
    id: 'special_pet_1', title: 'Pet Drone', description: 'Summon drone helper', specialization: 'special', position: { x: 2, y: 0 }, maxRank: 1, baseCost: 800, costScale: 1.6,
    effectPerRank: (_r) => ({ modifiers: { petDrone: { enabled: true, dps: 5 } } }), prerequisites: [{ nodeId: 'special_pierce_1', minRank: 1 }]
  })

  // Defensive branch
  nodes.push({
    id: 'defense_health_1', title: 'Juggernaut', description: '+25 HP per rank', specialization: 'defense', position: { x: 0, y: 0 }, maxRank: 3, baseCost: 100, costScale: 1.5,
    effectPerRank: (r) => ({ stats: { health: 25 * r } })
  })
  nodes.push({
    id: 'defense_dr_1', title: 'Iron Skin', description: '-5% damage taken per rank', specialization: 'defense', position: { x: 1, y: 0 }, maxRank: 2, baseCost: 400, costScale: 1.5,
    effectPerRank: (r) => ({ modifiers: { damageReductionPct: 0.05 * r } }), prerequisites: [{ nodeId: 'defense_health_1', minRank: 1 }]
  })
  nodes.push({
    id: 'defense_regen_1', title: 'Combat Regen', description: '+0.5 HP/s per rank', specialization: 'defense', position: { x: 0, y: 1 }, maxRank: 2, baseCost: 350, costScale: 1.5,
    effectPerRank: (r) => ({ modifiers: { healPerSecond: 0.5 * r } })
  })
  nodes.push({
    id: 'defense_shield_1', title: 'Reactive Shield', description: 'Shield after 5s idle', specialization: 'defense', position: { x: 1, y: 1 }, maxRank: 1, baseCost: 700, costScale: 1.6,
    effectPerRank: (_r) => ({ modifiers: { shieldAfterIdle: { enabled: true, idleSeconds: 5, shieldHp: 50 } } }), prerequisites: [{ nodeId: 'defense_dr_1', minRank: 1 }]
  })

  return nodes
}
