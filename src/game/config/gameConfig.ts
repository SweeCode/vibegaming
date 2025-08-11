import * as Phaser from 'phaser'

export const GAME_CONFIG = {
  width: window.innerWidth,
  height: window.innerHeight,
  physics: {
    default: 'arcade' as const,
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

export const IS_DEV: boolean = process.env.NODE_ENV !== 'production';

export const GAME_SETTINGS = {
  experimental: {
    splitterEnabled: IS_DEV
  },
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
      speed: 400,
      scoreValue: 20,
      spawnChance: 0.1
    },
    big: {
      speed: 50,
      scoreValue: 50,
      spawnChance: 0.2,
      health: 3
    },
    splitter: {
      // Splits into multiple minis on death
      speed: 90,
      scoreValue: 40,
      spawnChance: 0.12,
      health: 2,
      minisOnSplit: 3
    },
    mini: {
      // Spawned by splitter, no further splitting
      speed: 220,
      scoreValue: 8,
      health: 1
    },
    shooter: {
      speed: 100,
      scoreValue: 30,
      spawnChance: 0.15,
      health: 2,
      fireRateMs: 1500,
      bulletSpeed: 300,
      bulletDamagePct: 0.1,
      preferredRangeMin: 220,
      preferredRangeMax: 300,
      strafeSpeed: 120
    }
  }
};