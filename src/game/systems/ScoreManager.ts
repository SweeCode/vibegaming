import { getConvexClient, getDeviceId } from '../../lib/convexClient';

export interface WaveScore {
  waveNumber: number;
  score: number;
  completedAt: number; // timestamp
  isBoss: boolean;
  bossType?: 'sentinel' | 'artillery';
}

export interface ScoreProgress {
  totalScore: number;
  completedWaves: number;
  highestWave: number;
  waveScores: WaveScore[];
}

export class ScoreManager {
  private waveScores: Map<number, WaveScore> = new Map();
  private currentSessionScore = 0;
  private deviceId: string;
  private isLoading = false;

  constructor() {
    this.deviceId = getDeviceId();
    this.loadProgress();
  }

  /**
   * Check if a wave has already been completed and scored
   */
  isWaveCompleted(waveNumber: number): boolean {
    return this.waveScores.has(waveNumber);
  }

  /**
   * Get the score earned from a specific wave
   */
  getWaveScore(waveNumber: number): number {
    return this.waveScores.get(waveNumber)?.score || 0;
  }

  /**
   * Complete a wave and add its score to the total (only if not already completed)
   */
  async completeWave(waveNumber: number, score: number, isBoss: boolean = false, bossType?: 'sentinel' | 'artillery'): Promise<boolean> {
    if (this.isWaveCompleted(waveNumber)) {
      return false; // Wave already completed
    }

    const waveScore: WaveScore = {
      waveNumber,
      score,
      completedAt: Date.now(),
      isBoss,
      bossType
    };

    // Save to Convex
    const success = await this.saveWaveToConvex(waveNumber, score, isBoss, bossType);
    if (success) {
      this.waveScores.set(waveNumber, waveScore);
      this.currentSessionScore += score;
    }
    return success;
  }

  /**
   * Get the total score from all completed waves
   */
  getTotalScore(): number {
    let total = 0;
    for (const waveScore of this.waveScores.values()) {
      total += waveScore.score;
    }
    return total;
  }

  /**
   * Get the current session score (score earned in this play session)
   */
  getCurrentSessionScore(): number {
    return this.currentSessionScore;
  }

  /**
   * Get the highest wave number completed
   */
  getHighestWave(): number {
    let highest = 0;
    for (const waveNumber of this.waveScores.keys()) {
      highest = Math.max(highest, waveNumber);
    }
    return highest;
  }

  /**
   * Get the number of completed waves
   */
  getCompletedWaveCount(): number {
    return this.waveScores.size;
  }

  /**
   * Get all wave scores as an array
   */
  getAllWaveScores(): WaveScore[] {
    return Array.from(this.waveScores.values()).sort((a, b) => a.waveNumber - b.waveNumber);
  }

  /**
   * Get progress information
   */
  getProgress(): ScoreProgress {
    return {
      totalScore: this.getTotalScore(),
      completedWaves: this.getCompletedWaveCount(),
      highestWave: this.getHighestWave(),
      waveScores: this.getAllWaveScores()
    };
  }

  /**
   * Reset all progress (for testing or new game)
   */
  async resetProgress(): Promise<boolean> {
    const success = await this.resetProgressInConvex();
    if (success) {
      this.waveScores.clear();
      this.currentSessionScore = 0;
    }
    return success;
  }

  /**
   * Calculate the base score for a wave based on its number and type
   */
  static calculateWaveBaseScore(waveNumber: number, isBoss: boolean = false, bossType?: 'sentinel' | 'artillery'): number {
    if (isBoss) {
      // Boss waves give significantly more score
      const bossMultiplier = bossType === 'artillery' ? 1.4 : 1.0;
      return Math.floor(200 + waveNumber * 50 * bossMultiplier);
    } else {
      // Regular waves give progressive score
      return Math.floor(50 + waveNumber * 25);
    }
  }

  /**
   * Calculate bonus score based on wave completion efficiency
   */
  static calculateEfficiencyBonus(baseScore: number, enemiesKilled: number, enemiesSpawned: number, timeElapsed: number): number {
    // Perfect kill ratio bonus (all enemies killed)
    const killRatio = enemiesSpawned > 0 ? enemiesKilled / enemiesSpawned : 0;
    const killBonus = killRatio >= 1.0 ? baseScore * 0.2 : 0;

    // Speed bonus (faster completion = more bonus)
    const expectedTime = enemiesSpawned * 2; // 2 seconds per enemy as baseline
    const speedRatio = expectedTime > 0 ? Math.max(0, (expectedTime - timeElapsed) / expectedTime) : 0;
    const speedBonus = Math.floor(baseScore * speedRatio * 0.15);

    return Math.floor(killBonus + speedBonus);
  }

  private async loadProgress(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const client = getConvexClient();
      if (!client) {
        this.isLoading = false;
        return;
      }

      const result = await (client as unknown as { query: (name: string, args: unknown) => Promise<unknown> }).query(
        'waveProgress:getWaveProgress',
        { deviceId: this.deviceId }
      );

      if (Array.isArray(result)) {
        this.waveScores.clear();
        for (const waveScore of result as WaveScore[]) {
          this.waveScores.set(waveScore.waveNumber, waveScore);
        }
      }
    } catch (error) {
      console.warn('Failed to load score progress from Convex:', error);
      // Fallback to localStorage if Convex fails
      this.loadProgressFromLocalStorage();
    } finally {
      this.isLoading = false;
    }
  }

  private loadProgressFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('wave_score_progress_fallback');
      if (stored) {
        const data: ScoreProgress = JSON.parse(stored);
        this.waveScores.clear();
        for (const waveScore of data.waveScores) {
          this.waveScores.set(waveScore.waveNumber, waveScore);
        }
      }
    } catch (error) {
      console.warn('Failed to load score progress from localStorage:', error);
      this.waveScores.clear();
    }
  }

  private async saveWaveToConvex(waveNumber: number, score: number, isBoss: boolean, bossType?: 'sentinel' | 'artillery'): Promise<boolean> {
    try {
      const client = getConvexClient();
      if (!client) return false;

      const result = await (client as unknown as { mutation: (name: string, args: unknown) => Promise<unknown> }).mutation(
        'waveProgress:completeWave',
        {
          deviceId: this.deviceId,
          waveNumber,
          score,
          isBoss,
          bossType
        }
      );

      return (result as { success: boolean }).success;
    } catch (error) {
      console.warn('Failed to save wave progress to Convex:', error);
      // Fallback to localStorage
      this.saveProgressToLocalStorage();
      return true;
    }
  }

  private async resetProgressInConvex(): Promise<boolean> {
    try {
      const client = getConvexClient();
      if (!client) return false;

      const result = await (client as unknown as { mutation: (name: string, args: unknown) => Promise<unknown> }).mutation(
        'waveProgress:resetProgress',
        { deviceId: this.deviceId }
      );

      return (result as { success: boolean }).success;
    } catch (error) {
      console.warn('Failed to reset progress in Convex:', error);
      // Fallback to localStorage
      this.saveProgressToLocalStorage();
      return true;
    }
  }

  private saveProgressToLocalStorage(): void {
    try {
      const progress = this.getProgress();
      localStorage.setItem('wave_score_progress_fallback', JSON.stringify(progress));
    } catch (error) {
      console.warn('Failed to save score progress to localStorage:', error);
    }
  }
}