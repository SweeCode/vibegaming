import {
  loadSkillTreeConvex,
  saveSkillTreeConvex,
  loadUpgradesConvex,
  listSkillBuildSlotsConvex,
  saveSkillBuildSlotConvex,
  deleteSkillBuildSlotConvex
} from '@/lib/convexClient'

export type Specialization = 'basic' | 'special' | 'defense' | 'offense' | 'mobility' | 'hybrid'

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
  kind: 'active' | 'passive'
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

export type SkillTreeBuildSlot = {
  slot: number
  name: string
  snapshot: { unlocked: Record<string, number>; totalSpent: number }
}

export type ActiveModifiers = {
  damageReductionPct: number
  healPerSecond: number
  ricochetBounces: number
  pierceCount: number
  petDrone: { enabled: boolean; dps: number }
  shieldAfterIdle: { enabled: boolean; idleSeconds: number; shieldHp: number }
  // Minimum fire rate allowed (ms). Player can choose equal or slower.
  // If 0/undefined, default UI minimum will be used.
  petFireRateMs?: number
  // Example active ability flags (not yet consumed by gameplay):
  reviveOnFatal?: { enabled: boolean; cooldownSeconds: number }
}

const TREE_VERSION = 1

function now(): number { return Date.now() }

export class SkillTreeManager {
  private static readonly BUILD_SLOT_COUNT = 3
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
    let base = Math.floor(node.baseCost * Math.pow(node.costScale, current))
    // Specialization constraint: encourage committing to paths
    const totalRanks = Object.values(this.state.unlocked).reduce((a, b) => a + b, 0)
    if (totalRanks >= 6) {
      const counts = new Map<Specialization, number>()
      for (const n of this.nodes) {
        const r = this.getUnlocked(n.id)
        if (r > 0) counts.set(n.specialization, (counts.get(n.specialization) || 0) + r)
      }
      const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
      const topTwo = new Set(sorted.slice(0, 2).map(([s]) => s))
      if (!topTwo.has(node.specialization)) {
        const penalty = totalRanks >= 10 ? 1.5 : 1.25
        base = Math.floor(base * penalty)
      }
    }
    return base
  }

  unlock(nodeId: string, availablePoints: number): { success: boolean; cost: number; newPoints: number } {
    const node = this.idToNode.get(nodeId)
    if (!node) return { success: false, cost: 0, newPoints: availablePoints }
    if (!this.canUnlock(nodeId, availablePoints)) return { success: false, cost: this.getNextCost(nodeId), newPoints: availablePoints }
    const cost = this.getNextCost(nodeId)
    // Root can be freely unlocked (cost 0)
    const spend = node.id === 'root_start' ? 0 : cost
    const current = this.getUnlocked(nodeId)
    this.state.unlocked[nodeId] = current + 1
    this.state.totalSpent += spend
    this.state.updatedAt = now()
    this.saveLocal()
    void saveSkillTreeConvex(this.state)
    return { success: true, cost: spend, newPoints: availablePoints - spend }
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
    // Synergy: complete specialization bonus
    const specMaxed = this.computeSpecCompletion()
    if (specMaxed.has('offense')) delta.bulletDamage += 1
    if (specMaxed.has('defense')) delta.health += 25
    if (specMaxed.has('mobility')) delta.speed += 30
    if (specMaxed.has('special')) delta.reloadSpeed += -100
    if (specMaxed.has('basic')) delta.maxAmmo += 1
    if (specMaxed.has('hybrid')) {
      delta.bulletSpeed += 40
      delta.speed += 10
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
      // Optional: some nodes may set petFireRateMs via 'as any'
      const anyEff = eff as unknown as { petFireRateMs?: number }
      if (typeof anyEff.petFireRateMs === 'number') {
        (mods as unknown as { petFireRateMs?: number }).petFireRateMs = anyEff.petFireRateMs
      }
    }
    // Synergy: ricochet + pierce => slight DR and bullet speed buff via stats done above; here give small DR
    if (mods.ricochetBounces > 0 && mods.pierceCount > 0) {
      mods.damageReductionPct += 0.02
    }
    // clamp
    mods.damageReductionPct = Math.min(0.8, Math.max(0, mods.damageReductionPct))
    return mods
  }

  getNodes(): SkillNode[] { return this.nodes }

  // Determine which specializations are fully completed (all nodes at max rank)
  computeSpecCompletion(): Set<Specialization> {
    const done = new Set<Specialization>()
    const bySpec = new Map<Specialization, SkillNode[]>()
    for (const n of this.nodes) {
      if (!bySpec.has(n.specialization)) bySpec.set(n.specialization, [])
      bySpec.get(n.specialization)!.push(n)
    }
    for (const [spec, nodes] of bySpec.entries()) {
      let allMaxed = true
      for (const n of nodes) {
        const r = this.getUnlocked(n.id)
        if (r < n.maxRank) { allMaxed = false; break }
      }
      if (allMaxed && nodes.length > 0) done.add(spec)
    }
    return done
  }

  // Build management (save/load 3 build slots via caller)
  snapshotBuild(): { unlocked: Record<string, number>; totalSpent: number } {
    return { unlocked: { ...this.state.unlocked }, totalSpent: this.state.totalSpent }
  }

  applyBuild(snapshot: { unlocked: Record<string, number>; totalSpent?: number }): void {
    const sanitized: Record<string, number> = {}
    for (const [id, rank] of Object.entries(snapshot.unlocked || {})) {
      const node = this.idToNode.get(id)
      if (!node) continue
      sanitized[id] = Math.min(node.maxRank, Math.max(0, Math.floor(rank)))
    }
    // If snapshot contains authoritative totalSpent, trust it to preserve original spend and penalties
    if (typeof snapshot.totalSpent === 'number' && isFinite(snapshot.totalSpent) && snapshot.totalSpent >= 0) {
      this.state = { version: this.state.version, unlocked: sanitized, totalSpent: Math.floor(snapshot.totalSpent), updatedAt: now() }
    } else {
      // Fallback: recompute spent using penalty-aware logic in a deterministic order
      const newState: SkillTreeState = { version: this.state.version, unlocked: {}, totalSpent: 0, updatedAt: now() }
      const entries = Object.entries(sanitized).sort(([a], [b]) => a.localeCompare(b))
      for (const [id, rank] of entries) {
        for (let r = 0; r < rank; r++) {
          this.state = { ...newState, unlocked: { ...newState.unlocked } }
          const cost = this.getNextCost(id)
          const prev = newState.unlocked[id] ?? 0
          newState.unlocked[id] = prev + 1
          newState.totalSpent += cost
        }
      }
      this.state = newState
    }
    this.saveLocal()
    void saveSkillTreeConvex(this.state)
  }

  private buildSlotKey(slot: number): string {
    return `build_slot_${slot}`
  }

  private readLocalBuildSlot(slot: number): SkillTreeBuildSlot | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(this.buildSlotKey(slot))
      if (!raw) return null
      const parsed = JSON.parse(raw) as { name?: string; snap?: { unlocked?: Record<string, number>; totalSpent?: number } }
      if (!parsed?.snap) return null
      return {
        slot,
        name: typeof parsed.name === 'string' ? parsed.name : '',
        snapshot: {
          unlocked: { ...(parsed.snap.unlocked ?? {}) },
          totalSpent: Math.max(0, Math.floor(parsed.snap.totalSpent ?? 0))
        }
      }
    } catch {
      return null
    }
  }

  private writeLocalBuildSlot(slot: number, data: SkillTreeBuildSlot): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        this.buildSlotKey(slot),
        JSON.stringify({ name: data.name, snap: data.snapshot })
      )
    } catch {}
  }

  private deleteLocalBuildSlot(slot: number): void {
    if (typeof window === 'undefined') return
    try { window.localStorage.removeItem(this.buildSlotKey(slot)) } catch {}
  }

  private loadLocalBuildSlots(): SkillTreeBuildSlot[] {
    const slots: SkillTreeBuildSlot[] = []
    for (let i = 1; i <= SkillTreeManager.BUILD_SLOT_COUNT; i++) {
      const entry = this.readLocalBuildSlot(i)
      if (entry) slots.push(entry)
    }
    return slots.sort((a, b) => a.slot - b.slot)
  }

  async loadBuildSlots(): Promise<SkillTreeBuildSlot[]> {
    const merged = new Map<number, SkillTreeBuildSlot>()
    for (const local of this.loadLocalBuildSlots()) {
      merged.set(local.slot, local)
    }
    const remote = await listSkillBuildSlotsConvex()
    if (Array.isArray(remote)) {
      for (const payload of remote) {
        const normalized: SkillTreeBuildSlot = {
          slot: Math.max(1, Math.min(SkillTreeManager.BUILD_SLOT_COUNT, Math.floor(payload.slot))),
          name: typeof payload.name === 'string' ? payload.name : '',
          snapshot: {
            unlocked: { ...(payload.snapshot?.unlocked ?? {}) },
            totalSpent: Math.max(0, Math.floor(payload.snapshot?.totalSpent ?? 0))
          }
        }
        this.writeLocalBuildSlot(normalized.slot, normalized)
        merged.set(normalized.slot, normalized)
      }
    }
    return Array.from(merged.values()).sort((a, b) => a.slot - b.slot)
  }

  async saveBuildSlot(slot: number, name: string, snapshot = this.snapshotBuild()): Promise<boolean> {
    const normalizedSlot = Math.max(1, Math.min(SkillTreeManager.BUILD_SLOT_COUNT, Math.floor(slot)))
    const normalizedName = name.trim()
    const normalizedSnapshot = {
      unlocked: { ...(snapshot.unlocked ?? {}) },
      totalSpent: Math.max(0, Math.floor(snapshot.totalSpent ?? this.state.totalSpent))
    }
    const record: SkillTreeBuildSlot = {
      slot: normalizedSlot,
      name: normalizedName,
      snapshot: normalizedSnapshot
    }
    this.writeLocalBuildSlot(normalizedSlot, record)
    return await saveSkillBuildSlotConvex(normalizedSlot, normalizedName, normalizedSnapshot)
  }

  async deleteBuildSlot(slot: number): Promise<boolean> {
    const normalizedSlot = Math.max(1, Math.min(SkillTreeManager.BUILD_SLOT_COUNT, Math.floor(slot)))
    this.deleteLocalBuildSlot(normalizedSlot)
    return await deleteSkillBuildSlotConvex(normalizedSlot)
  }
}

function defineNodes(): SkillNode[] {
  const nodes: SkillNode[] = []
  // Root node (always unlockable, cost 0). Unlocking this enables adjacent paths.
  nodes.push({
    id: 'root_start', title: 'Awakening', description: 'Begin your specialization journey', specialization: 'basic', kind: 'active', position: { x: 0, y: -1 }, maxRank: 1, baseCost: 0, costScale: 1,
    effectPerRank: () => ({})
  })
  // Basic branch
  nodes.push({
    id: 'basic_speed_1', title: 'Fleet Footed', description: '+20 speed per rank', specialization: 'basic', kind: 'passive', position: { x: 0, y: 0 }, maxRank: 3, baseCost: 150, costScale: 1.5,
    effectPerRank: (r) => ({ stats: { speed: 20 * r } }), prerequisites: [{ nodeId: 'root_start', minRank: 1 }]
  })
  nodes.push({
    id: 'basic_reload_1', title: 'Rapid Reload', description: '-150ms reload per rank', specialization: 'basic', kind: 'passive', position: { x: 1, y: 0 }, maxRank: 2, baseCost: 250, costScale: 1.5,
    effectPerRank: (r) => ({ stats: { reloadSpeedMs: -150 * r } }), prerequisites: [{ nodeId: 'basic_speed_1', minRank: 1 }]
  })
  nodes.push({
    id: 'basic_ammo_1', title: 'Expanded Mags', description: '+2 ammo per rank', specialization: 'basic', kind: 'passive', position: { x: 0, y: 1 }, maxRank: 2, baseCost: 200, costScale: 1.5,
    effectPerRank: (r) => ({ stats: { maxAmmo: 2 * r } }), prerequisites: [{ nodeId: 'root_start', minRank: 1 }]
  })
  nodes.push({
    id: 'basic_damage_1', title: 'Hollow Point', description: '+1 damage per rank', specialization: 'basic', kind: 'passive', position: { x: 1, y: 1 }, maxRank: 3, baseCost: 400, costScale: 1.5,
    effectPerRank: (r) => ({ stats: { bulletDamage: 1 * r } }), prerequisites: [{ nodeId: 'root_start', minRank: 1 }]
  })

  // Special branch
  nodes.push({
    id: 'special_pierce_1', title: 'Piercing Rounds', description: '+1 pierce per rank', specialization: 'special', kind: 'passive', position: { x: 0, y: 0 }, maxRank: 2, baseCost: 500, costScale: 1.6,
    effectPerRank: (r) => ({ modifiers: { pierceCount: r } }), prerequisites: [{ nodeId: 'basic_damage_1', minRank: 1 }]
  })
  nodes.push({
    id: 'special_ricochet_1', title: 'Ricochet Rounds', description: '+1 bounce', specialization: 'special', kind: 'passive', position: { x: 1, y: 0 }, maxRank: 1, baseCost: 600, costScale: 1.6,
    effectPerRank: (r) => ({ modifiers: { ricochetBounces: Math.min(1, r) } }), prerequisites: [{ nodeId: 'special_pierce_1', minRank: 1 }]
  })
  nodes.push({
    id: 'special_pet_1', title: 'Pet Drone', description: 'Summon drone helper', specialization: 'special', kind: 'active', position: { x: 2, y: 0 }, maxRank: 1, baseCost: 800, costScale: 1.6,
    effectPerRank: (r) => ({ modifiers: { petDrone: { enabled: r > 0, dps: 5 } } }), prerequisites: [{ nodeId: 'special_pierce_1', minRank: 1 }]
  })

  // Defensive branch
  nodes.push({
    id: 'defense_health_1', title: 'Juggernaut', description: '+25 HP per rank', specialization: 'defense', kind: 'passive', position: { x: 0, y: 0 }, maxRank: 3, baseCost: 100, costScale: 1.5,
    effectPerRank: (r) => ({ stats: { health: 25 * r } }), prerequisites: [{ nodeId: 'root_start', minRank: 1 }]
  })
  nodes.push({
    id: 'defense_dr_1', title: 'Iron Skin', description: '-5% damage taken per rank', specialization: 'defense', kind: 'passive', position: { x: 1, y: 0 }, maxRank: 2, baseCost: 400, costScale: 1.5,
    effectPerRank: (r) => ({ modifiers: { damageReductionPct: 0.05 * r } }), prerequisites: [{ nodeId: 'defense_health_1', minRank: 1 }]
  })
  nodes.push({
    id: 'defense_regen_1', title: 'Combat Regen', description: '+0.5 HP/s per rank', specialization: 'defense', kind: 'passive', position: { x: 0, y: 1 }, maxRank: 2, baseCost: 350, costScale: 1.5,
    effectPerRank: (r) => ({ modifiers: { healPerSecond: 0.5 * r } }), prerequisites: [{ nodeId: 'root_start', minRank: 1 }]
  })
  nodes.push({
    id: 'defense_shield_1', title: 'Reactive Shield', description: 'Shield after 5s idle', specialization: 'defense', kind: 'active', position: { x: 1, y: 1 }, maxRank: 1, baseCost: 700, costScale: 1.6,
    effectPerRank: (r) => ({ modifiers: { shieldAfterIdle: { enabled: r > 0, idleSeconds: 5, shieldHp: 50 } } }), prerequisites: [{ nodeId: 'defense_dr_1', minRank: 1 }]
  })

  // Offense branch
  nodes.push({
    id: 'offense_damage_1', title: 'Glass Cannon', description: '+2 damage per rank', specialization: 'offense', kind: 'passive', position: { x: 0, y: 0 }, maxRank: 3, baseCost: 450, costScale: 1.6,
    effectPerRank: (r) => ({ stats: { bulletDamage: 2 * r } }), prerequisites: [{ nodeId: 'root_start', minRank: 1 }]
  })
  nodes.push({
    id: 'offense_speed_1', title: 'Hot Rounds', description: '+60 bullet speed per rank', specialization: 'offense', kind: 'passive', position: { x: 1, y: 0 }, maxRank: 2, baseCost: 400, costScale: 1.6,
    effectPerRank: (r) => ({ stats: { bulletSpeed: 60 * r } }), prerequisites: [{ nodeId: 'offense_damage_1', minRank: 1 }]
  })

  // Mobility branch
  nodes.push({
    id: 'mobility_speed_1', title: 'Sprinter', description: '+30 speed per rank', specialization: 'mobility', kind: 'passive', position: { x: 0, y: 0 }, maxRank: 3, baseCost: 180, costScale: 1.5,
    effectPerRank: (r) => ({ stats: { speed: 30 * r } }), prerequisites: [{ nodeId: 'root_start', minRank: 1 }]
  })
  nodes.push({
    id: 'mobility_reload_1', title: 'Slide Reload', description: '-100ms reload per rank', specialization: 'mobility', kind: 'passive', position: { x: 1, y: 0 }, maxRank: 2, baseCost: 240, costScale: 1.5,
    effectPerRank: (r) => ({ stats: { reloadSpeedMs: -100 * r } }), prerequisites: [{ nodeId: 'mobility_speed_1', minRank: 1 }]
  })

  // Hybrid branch (offense+mobility synergy)
  nodes.push({
    id: 'hybrid_dashshot_1', title: 'Dash Shot', description: 'Bullets travel +40 while moving', specialization: 'hybrid', kind: 'active', position: { x: 0, y: 0 }, maxRank: 1, baseCost: 600, costScale: 1.7,
    effectPerRank: () => ({ stats: { bulletSpeed: 40 } }), prerequisites: [
      { nodeId: 'offense_speed_1', minRank: 1 }, { nodeId: 'mobility_speed_1', minRank: 2 }
    ]
  })

  return nodes
}
