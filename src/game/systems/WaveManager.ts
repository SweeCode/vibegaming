import { IS_DEV } from '../config/gameConfig'

export interface WaveSettings {
  waveNumber: number;
  title: string;
  enemyCount: number;
  spawnDelay: number;
  enemyTypes: {
    normal: number;
    fast: number;
    big: number;
    shooter: number;
    splitter: number;
  };
  breakDuration: number; // Time between waves in milliseconds
  isBoss: boolean;
  bossType?: 'sentinel' | 'artillery';
}

export class WaveManager {
  private currentWave = 1;
  private enemiesSpawned = 0;
  private enemiesKilled = 0;
  private isWaveActive = false;
  private isBreakTime = false;

  constructor() {
    this.reset();
  }

  getCurrentWave(): number {
    return this.currentWave;
  }

  getCurrentWaveSettings(): WaveSettings {
    // Progressive wave difficulty with more enemies and faster spawning
    const baseEnemyCount = Math.min(8 + this.currentWave * 3, 40); // More enemies, cap at 40
    const spawnDelay = Math.max(1200 - this.currentWave * 80, 300); // Much faster spawning
    
    // Calculate enemy type distribution based on wave
    let normalPercentage = Math.max(0.70 - this.currentWave * 0.04, 0.15);
    let fastPercentage = Math.min(0.12 + this.currentWave * 0.03, 0.35);
    let bigPercentage = Math.min(0.10 + this.currentWave * 0.02, 0.25);
    let shooterPercentage = Math.min(0.05 + this.currentWave * 0.015, 0.2);
    let splitterPercentage = Math.min(0.03 + this.currentWave * 0.02, 0.2);

    // Normalize percentages
    const total = normalPercentage + fastPercentage + bigPercentage + shooterPercentage + splitterPercentage;
    normalPercentage /= total;
    fastPercentage /= total;
    bigPercentage /= total;
    shooterPercentage /= total;
    splitterPercentage /= total;

    // Boss every 5 waves (5,10,15...), and also on wave 1 during development for testing
    const isBoss = this.currentWave % 5 === 0 || (IS_DEV && this.currentWave === 1);
    let bossType: 'sentinel' | 'artillery' | undefined = undefined;
    if (isBoss) {
      if (IS_DEV && this.currentWave === 1) {
        // On wave 1 during development, force the alternate boss for testing
        bossType = 'artillery';
      } else if (this.currentWave === 5) {
        bossType = 'sentinel';
      } else if (this.currentWave === 10) {
        bossType = 'artillery';
      } else if (this.currentWave > 10) {
        // After wave 10, randomize boss type at each boss wave
        bossType = Math.random() < 0.5 ? 'sentinel' : 'artillery';
      } else {
        // Fallback for unexpected cases
        bossType = this.currentWave % 10 === 0 ? 'artillery' : 'sentinel';
      }
    }

    // Titles (use a clean boss index)
    const bossIndex = Math.max(1, Math.ceil(this.currentWave / 5));
    const title = isBoss ? `BOSS ${bossIndex}` : `Wave ${this.currentWave}`;

    return {
      waveNumber: this.currentWave,
      title,
      enemyCount: isBoss ? 0 : baseEnemyCount,
      spawnDelay,
        enemyTypes: {
          normal: normalPercentage,
          fast: fastPercentage,
          big: bigPercentage,
          shooter: shooterPercentage,
          splitter: splitterPercentage
        },      breakDuration: 3000, // Fixed 3 second break between waves
      isBoss,
      bossType
    };
  }

  startWave(): void {
    this.isWaveActive = true;
    this.isBreakTime = false;
    this.enemiesSpawned = 0;
    this.enemiesKilled = 0;
  }

  onEnemySpawned(): void {
    if (this.isWaveActive) {
      this.enemiesSpawned++;
    }
  }

  onEnemyKilled(): void {
    if (this.isWaveActive) {
      this.enemiesKilled++;
    }
  }

  canSpawnEnemy(): boolean {
    if (!this.isWaveActive || this.isBreakTime) return false;
    const waveSettings = this.getCurrentWaveSettings();
    return this.enemiesSpawned < waveSettings.enemyCount;
  }

  isWaveComplete(): boolean {
    if (!this.isWaveActive) return false;
    const waveSettings = this.getCurrentWaveSettings();
    // Boss waves are completed explicitly by the scene when the boss dies
    if (waveSettings.isBoss) return false;
    return this.enemiesSpawned >= waveSettings.enemyCount && this.enemiesKilled >= waveSettings.enemyCount;
  }

  startBreak(): void {
    this.isWaveActive = false;
    this.isBreakTime = true;
  }

  endBreak(): void {
    this.isBreakTime = false;
    this.currentWave++;
  }

  isOnBreak(): boolean {
    return this.isBreakTime;
  }

  getWaveProgress(): { spawned: number; killed: number; total: number } {
    const waveSettings = this.getCurrentWaveSettings();
    return {
      spawned: this.enemiesSpawned,
      killed: this.enemiesKilled,
      total: waveSettings.enemyCount
    };
  }

  reset(): void {
    this.currentWave = 1;
    this.enemiesSpawned = 0;
    this.enemiesKilled = 0;
    this.isWaveActive = false;
    this.isBreakTime = false;
  }
}
