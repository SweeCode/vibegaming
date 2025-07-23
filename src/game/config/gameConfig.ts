import * as Phaser from 'phaser';

export const GAME_CONFIG = {
  width: 800,
  height: 600,
  physics: {
    default: 'arcade' as const,
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  }
};

export const GAME_SETTINGS = {
  player: {
    speed: 200,
    maxHealth: 100,
    damagePerHit: 25
  },
  weapons: {
    bullet: {
      speed: 500,
      maxAmmo: 30,
      reloadTime: 2000
    }
  },
  enemies: {
    regular: {
      speed: 100,
      scoreValue: 10,
      spawnDelay: 1000
    },
    fast: {
      speed: 200,
      scoreValue: 20,
      spawnChance: 0.1
    }
  }
};