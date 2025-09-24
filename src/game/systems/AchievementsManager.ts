export type AchievementId =
  | 'first_blood'
  | 'survivor_5m'
  | 'wave10'
  | 'pet_unlocked'
  | 'score_10k'
  | 'boss_slayer'
  | 'ricochet_master'
  | 'pierce_pro'
  | 'snack_collector'
  | 'speed_runner';

export interface AchievementDefinition {
  readonly id: AchievementId;
  readonly title: string;
  readonly description: string;
  readonly color: number; // Phaser color (0xRRGGBB)
  readonly iconKey?: string; // optional texture key for future icons
}

export interface AchievementState {
  readonly id: AchievementId;
  unlockedAt?: number;
}

type AchievementListener = (id: AchievementId, at: number) => void;

/**
 * AchievementsManager
 * - Keeps a registry of achievement definitions
 * - Stores unlocked state in localStorage
 * - Exposes a tiny event-bus to unlock achievements by id
 * - Scene-agnostic; can be used anywhere
 */
export class AchievementsManager {
  private static instance?: AchievementsManager;
  private readonly definitions: ReadonlyMap<AchievementId, AchievementDefinition>;
  private readonly state: Map<AchievementId, AchievementState> = new Map();
  private readonly listeners: Set<AchievementListener> = new Set();
  private readonly storageKey = 'achievements_state_v1';

  private constructor() {
    const defs: AchievementDefinition[] = [
      { id: 'first_blood', title: 'First Blood', description: 'Defeat your first enemy.', color: 0xff3366 },
      { id: 'survivor_5m', title: 'Survivor', description: 'Survive for 5 minutes.', color: 0xffaa00 },
      { id: 'wave10', title: 'Wave Rider', description: 'Reach wave 10 in Wave mode.', color: 0x33ffaa },
      { id: 'pet_unlocked', title: 'Best Friend', description: 'Unlock your first pet.', color: 0x00ccff },
      { id: 'score_10k', title: 'Big Numbers', description: 'Score 10,000 points in a run.', color: 0xae81ff },
      { id: 'boss_slayer', title: 'Boss Slayer', description: 'Defeat a boss.', color: 0xff5577 },
      { id: 'ricochet_master', title: 'Trick Shots', description: 'Defeat 5 enemies with ricochets.', color: 0x66ffcc },
      { id: 'pierce_pro', title: 'Pierce Pro', description: 'Pierce through 10 enemies in one run.', color: 0xffff66 },
      { id: 'snack_collector', title: 'Snack Collector', description: 'Collect 50 snacks.', color: 0x66ccff },
      { id: 'speed_runner', title: 'Speed Runner', description: 'Beat a boss under 60 seconds.', color: 0x66ff66 }
    ];
    this.definitions = new Map(defs.map(d => [d.id, d]));
    this.load();
  }

  static getInstance(): AchievementsManager {
    if (!AchievementsManager.instance) AchievementsManager.instance = new AchievementsManager();
    return AchievementsManager.instance;
  }

  getDefinitions(): AchievementDefinition[] {
    return Array.from(this.definitions.values());
  }

  isUnlocked(id: AchievementId): boolean {
    return !!this.state.get(id)?.unlockedAt;
  }

  getUnlockedAt(id: AchievementId): number | undefined {
    return this.state.get(id)?.unlockedAt;
  }

  addListener(fn: AchievementListener) {
    this.listeners.add(fn);
  }

  removeListener(fn: AchievementListener) {
    this.listeners.delete(fn);
  }

  /** Unlock by id. Safe to call repeatedly. */
  unlock(id: AchievementId, at: number = Date.now()) {
    if (!this.definitions.has(id)) return;
    const existing = this.state.get(id);
    if (existing?.unlockedAt) return;
    this.state.set(id, { id, unlockedAt: at });
    this.persist();
    for (const l of this.listeners) l(id, at);
  }

  resetAll() {
    this.state.clear();
    this.persist();
  }

  private load() {
    try {
      if (typeof window === 'undefined') return;
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, { unlockedAt?: number }>;
        for (const [k, v] of Object.entries(parsed)) {
          const id = k as AchievementId;
          if (this.definitions.has(id)) this.state.set(id, { id, unlockedAt: v.unlockedAt });
        }
      } else {
        // Initialize with locked states
        for (const def of this.definitions.values()) this.state.set(def.id, { id: def.id });
      }
    } catch {}
  }

  private persist() {
    try {
      if (typeof window === 'undefined') return;
      const obj = {} as Record<AchievementId, { unlockedAt?: number }>;
      for (const [id, st] of this.state) obj[id] = { unlockedAt: st.unlockedAt };
      localStorage.setItem(this.storageKey, JSON.stringify(obj));
    } catch {}
  }
}

/**
 * Lightweight helper API for game code to unlock by events later.
 * Example future usage:
 *   AchievementsAPI.onEnemyKilled(count => { if (count === 1) unlock('first_blood'); })
 */
export const AchievementsAPI = {
  unlock: (id: AchievementId) => AchievementsManager.getInstance().unlock(id),
  isUnlocked: (id: AchievementId) => AchievementsManager.getInstance().isUnlocked(id),
  resetAll: () => AchievementsManager.getInstance().resetAll()
};

