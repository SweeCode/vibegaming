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
  };
  breakDuration: number; // Time between waves in milliseconds
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
    let normalPercentage = Math.max(0.75 - this.currentWave * 0.045, 0.25);
    let fastPercentage = Math.min(0.1 + this.currentWave * 0.03, 0.35);
    let bigPercentage = Math.min(0.1 + this.currentWave * 0.02, 0.25);
    let shooterPercentage = Math.min(0.05 + this.currentWave * 0.02, 0.25);

    // Normalize percentages
    const total = normalPercentage + fastPercentage + bigPercentage + shooterPercentage;
    normalPercentage /= total;
    fastPercentage /= total;
    bigPercentage /= total;
    shooterPercentage /= total;

    // Simple wave titles
    const title = `Wave ${this.currentWave}`;

    return {
      waveNumber: this.currentWave,
      title,
      enemyCount: baseEnemyCount,
      spawnDelay,
        enemyTypes: {
          normal: normalPercentage,
          fast: fastPercentage,
          big: bigPercentage,
          shooter: shooterPercentage
        },      breakDuration: 3000 // Fixed 3 second break between waves
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