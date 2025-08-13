export interface PlayerStats {
  health: number;
  speed: number;
  maxAmmo: number;
  reloadSpeed: number;
  bulletSpeed: number;
  bulletDamage: number;
}

export interface UpgradeCosts {
  health: number;
  speed: number;
  maxAmmo: number;
  reloadSpeed: number;
  bulletSpeed: number;
  bulletDamage: number;
}

export interface UpgradeLevels {
  health: number;
  speed: number;
  maxAmmo: number;
  reloadSpeed: number;
  bulletSpeed: number;
  bulletDamage: number;
}

import { SkillTreeManager } from './SkillTreeManager'
import { IS_DEV } from '../config/gameConfig'

export class UpgradeManager {
  private upgradeLevels: UpgradeLevels;
  private baseCosts: UpgradeCosts;
  private maxLevels: UpgradeLevels;
  private skillTree: SkillTreeManager;

  constructor() {
    // Initialize legacy upgrades (for backward compatibility and migration of UI)
    this.upgradeLevels = this.loadUpgradeLevels();
    // Initialize skill tree manager
    this.skillTree = new SkillTreeManager();
    void this.skillTree.initialize();
    // Kick off background remote sync for legacy (migration support only)
    void this.loadFromRemote();
    
    // Base costs for first upgrade level
    this.baseCosts = {
      health: 100,
      speed: 150,
      maxAmmo: 200,
      reloadSpeed: 250,
      bulletSpeed: 300,
      bulletDamage: 400
    };

    // Maximum upgrade levels
    this.maxLevels = {
      health: 10,
      speed: 10,
      maxAmmo: 10,
      reloadSpeed: 10,
      bulletSpeed: 10,
      bulletDamage: 10
    };
  }

  private loadUpgradeLevels(): UpgradeLevels {
    const saved = localStorage.getItem('upgradeLevels');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      health: 0,
      speed: 0,
      maxAmmo: 0,
      reloadSpeed: 0,
      bulletSpeed: 0,
      bulletDamage: 0
    };
  }

  private saveUpgradeLevels(): void {
    localStorage.setItem('upgradeLevels', JSON.stringify(this.upgradeLevels));
  }

  // Convex sync helpers (load if present; save on changes)
  async loadFromRemote(): Promise<void> {
    try {
      const mod = await import('@/lib/convexClient');
      const remote = await mod.loadUpgradesConvex();
      if (remote) {
        this.upgradeLevels = { ...remote } as UpgradeLevels;
        this.saveUpgradeLevels();
      }
    } catch { /* ignore */ }
  }

  async saveToRemote(): Promise<void> {
    try {
      const mod = await import('@/lib/convexClient');
      await mod.saveUpgradesConvex({ ...this.upgradeLevels });
    } catch { /* ignore */ }
  }

  getUpgradeLevels(): UpgradeLevels {
    return { ...this.upgradeLevels };
  }

  getUpgradeCost(stat: keyof UpgradeLevels): number {
    const currentLevel = this.upgradeLevels[stat];
    const baseCost = this.baseCosts[stat];
    
    // Exponential cost increase: baseCost * (1.5 ^ currentLevel)
    return Math.floor(baseCost * Math.pow(1.5, currentLevel));
  }

  canUpgrade(stat: keyof UpgradeLevels, currentScore: number): boolean {
    const currentLevel = this.upgradeLevels[stat];
    const maxLevel = this.maxLevels[stat];
    const cost = this.getUpgradeCost(stat);
    
    return currentLevel < maxLevel && currentScore >= cost;
  }

  isMaxLevel(stat: keyof UpgradeLevels): boolean {
    return this.upgradeLevels[stat] >= this.maxLevels[stat];
  }

  upgrade(stat: keyof UpgradeLevels, currentScore: number): { success: boolean; newScore: number; cost: number } {
    if (!this.canUpgrade(stat, currentScore)) {
      return { success: false, newScore: currentScore, cost: this.getUpgradeCost(stat) };
    }

    const cost = this.getUpgradeCost(stat);
    this.upgradeLevels[stat]++;
    this.saveUpgradeLevels();
    // Fire and forget
    void this.saveToRemote();
    
    return { 
      success: true, 
      newScore: currentScore - cost, 
      cost 
    };
  }

  getPlayerStats(): PlayerStats {
    // Prefer skill tree effective stats; fallback to legacy if skill tree not initialized yet
    try {
      const s = this.skillTree.getEffectiveStats();
      return { ...s } as PlayerStats;
    } catch {
      const baseStats = {
        health: 100,
        speed: 200,
        maxAmmo: 10,
        reloadSpeed: 2000,
        bulletSpeed: 400,
        bulletDamage: 1
      };
      return {
        health: baseStats.health + (this.upgradeLevels.health * 25),
        speed: baseStats.speed + (this.upgradeLevels.speed * 20),
        maxAmmo: baseStats.maxAmmo + (this.upgradeLevels.maxAmmo * 2),
        reloadSpeed: Math.max(500, baseStats.reloadSpeed - (this.upgradeLevels.reloadSpeed * 150)),
        bulletSpeed: baseStats.bulletSpeed + (this.upgradeLevels.bulletSpeed * 50),
        bulletDamage: baseStats.bulletDamage + (this.upgradeLevels.bulletDamage * 1)
      };
    }
  }

  getModifiers() {
    try {
      const mods = this.skillTree.getActiveModifiers();
      // In development, unlock pet drone for everyone
      if (IS_DEV) {
        mods.petDrone = { enabled: true, dps: mods.petDrone?.dps ?? 5 };
      }
      return mods;
    } catch {
      return { damageReductionPct: 0, healPerSecond: 0, ricochetBounces: 0, pierceCount: 0, petDrone: { enabled: false, dps: 0 }, shieldAfterIdle: { enabled: false, idleSeconds: 0, shieldHp: 0 } };
    }
  }

  getStatIncrease(stat: keyof UpgradeLevels): number {
    switch (stat) {
      case 'health': return 25;
      case 'speed': return 20;
      case 'maxAmmo': return 2;
      case 'reloadSpeed': return 150; // This is a reduction in reload time
      case 'bulletSpeed': return 50;
      case 'bulletDamage': return 1;
      default: return 0;
    }
  }

  getTotalSpent(): number {
    let total = 0;
    for (const stat of Object.keys(this.upgradeLevels) as Array<keyof UpgradeLevels>) {
      for (let level = 0; level < this.upgradeLevels[stat]; level++) {
        const baseCost = this.baseCosts[stat];
        total += Math.floor(baseCost * Math.pow(1.5, level));
      }
    }
    return total;
  }

  resetUpgrades(): void {
    this.upgradeLevels = {
      health: 0,
      speed: 0,
      maxAmmo: 0,
      reloadSpeed: 0,
      bulletSpeed: 0,
      bulletDamage: 0
    };
    this.saveUpgradeLevels();
    void this.saveToRemote();
  }
}