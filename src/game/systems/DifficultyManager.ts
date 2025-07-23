export interface DifficultySettings {
  level: number;
  spawnDelay: number;
  enemySpeedMultiplier: number;
  fastEnemyChance: number;
  bigEnemyChance: number;
  maxEnemiesOnScreen: number;
  title: string;
}

export class DifficultyManager {
  private currentLevel: number = 1;
  private gameStartTime: number = 0;
  private lastLevelUpScore: number = 0;

  // Difficulty thresholds based on score
  private static readonly LEVEL_THRESHOLDS = [
    0,    // Level 1: 0+ points
    500,  // Level 2: 500+ points  
    1500, // Level 3: 1500+ points
    3000, // Level 4: 3000+ points
    5500, // Level 5: 5500+ points
    8500, // Level 6: 8500+ points
    12000, // Level 7: 12000+ points
    16500, // Level 8: 16500+ points
    22000, // Level 9: 22000+ points
    30000  // Level 10: 30000+ points (max)
  ];

  private static readonly DIFFICULTY_SETTINGS: DifficultySettings[] = [
    // Level 1 - Easy Start
    {
      level: 1,
      spawnDelay: 1200,
      enemySpeedMultiplier: 1.0,
      fastEnemyChance: 0.1,
      bigEnemyChance: 0.05,
      maxEnemiesOnScreen: 8,
      title: "Beginner"
    },
    // Level 2 - Slightly Faster
    {
      level: 2,
      spawnDelay: 1000,
      enemySpeedMultiplier: 1.1,
      fastEnemyChance: 0.15,
      bigEnemyChance: 0.08,
      maxEnemiesOnScreen: 10,
      title: "Novice"
    },
    // Level 3 - More Enemies
    {
      level: 3,
      spawnDelay: 850,
      enemySpeedMultiplier: 1.2,
      fastEnemyChance: 0.2,
      bigEnemyChance: 0.12,
      maxEnemiesOnScreen: 12,
      title: "Cadet"
    },
    // Level 4 - Faster Pace
    {
      level: 4,
      spawnDelay: 700,
      enemySpeedMultiplier: 1.3,
      fastEnemyChance: 0.25,
      bigEnemyChance: 0.15,
      maxEnemiesOnScreen: 14,
      title: "Soldier"
    },
    // Level 5 - Challenging
    {
      level: 5,
      spawnDelay: 600,
      enemySpeedMultiplier: 1.4,
      fastEnemyChance: 0.3,
      bigEnemyChance: 0.18,
      maxEnemiesOnScreen: 16,
      title: "Veteran"
    },
    // Level 6 - Hard
    {
      level: 6,
      spawnDelay: 500,
      enemySpeedMultiplier: 1.5,
      fastEnemyChance: 0.35,
      bigEnemyChance: 0.22,
      maxEnemiesOnScreen: 18,
      title: "Elite"
    },
    // Level 7 - Very Hard
    {
      level: 7,
      spawnDelay: 420,
      enemySpeedMultiplier: 1.6,
      fastEnemyChance: 0.4,
      bigEnemyChance: 0.25,
      maxEnemiesOnScreen: 20,
      title: "Commander"
    },
    // Level 8 - Extreme
    {
      level: 8,
      spawnDelay: 350,
      enemySpeedMultiplier: 1.7,
      fastEnemyChance: 0.45,
      bigEnemyChance: 0.28,
      maxEnemiesOnScreen: 22,
      title: "Legend"
    },
    // Level 9 - Insane
    {
      level: 9,
      spawnDelay: 300,
      enemySpeedMultiplier: 1.8,
      fastEnemyChance: 0.5,
      bigEnemyChance: 0.32,
      maxEnemiesOnScreen: 25,
      title: "Nightmare"
    },
    // Level 10 - Maximum Chaos
    {
      level: 10,
      spawnDelay: 250,
      enemySpeedMultiplier: 2.0,
      fastEnemyChance: 0.55,
      bigEnemyChance: 0.35,
      maxEnemiesOnScreen: 30,
      title: "Apocalypse"
    }
  ];

  constructor() {
    this.reset();
  }

  reset() {
    this.currentLevel = 1;
    this.gameStartTime = Date.now();
    this.lastLevelUpScore = 0;
  }

  updateDifficulty(currentScore: number): boolean {
    const previousLevel = this.currentLevel;
    
    // Find the appropriate difficulty level based on score
    for (let i = DifficultyManager.LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (currentScore >= DifficultyManager.LEVEL_THRESHOLDS[i]) {
        this.currentLevel = Math.min(i + 1, DifficultyManager.DIFFICULTY_SETTINGS.length);
        break;
      }
    }

    // Return true if level increased (for notifications)
    const levelIncreased = this.currentLevel > previousLevel;
    if (levelIncreased) {
      this.lastLevelUpScore = currentScore;
    }
    
    return levelIncreased;
  }

  getCurrentSettings(): DifficultySettings {
    const index = Math.min(this.currentLevel - 1, DifficultyManager.DIFFICULTY_SETTINGS.length - 1);
    return DifficultyManager.DIFFICULTY_SETTINGS[index];
  }

  getCurrentLevel(): number {
    return this.currentLevel;
  }

  getTimeElapsed(): number {
    return Math.floor((Date.now() - this.gameStartTime) / 1000);
  }

  getNextLevelThreshold(): number | null {
    const nextIndex = this.currentLevel;
    if (nextIndex >= DifficultyManager.LEVEL_THRESHOLDS.length) {
      return null; // Max level reached
    }
    return DifficultyManager.LEVEL_THRESHOLDS[nextIndex];
  }

  getProgressToNextLevel(currentScore: number): number {
    const nextThreshold = this.getNextLevelThreshold();
    if (!nextThreshold) return 1; // Max level
    
    const currentThreshold = DifficultyManager.LEVEL_THRESHOLDS[this.currentLevel - 1];
    const progress = (currentScore - currentThreshold) / (nextThreshold - currentThreshold);
    return Math.max(0, Math.min(1, progress));
  }
}