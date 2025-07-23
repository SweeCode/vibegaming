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
      speed: 400,
      scoreValue: 20,
      spawnChance: 0.1
    },
    big: {
      speed: 50,
      scoreValue: 50,
      spawnChance: 0.2,
      health: 3
    }
  }
};