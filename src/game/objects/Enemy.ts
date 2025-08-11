import * as Phaser from 'phaser';
import { GAME_SETTINGS } from '../config/gameConfig';
import { DifficultySettings } from '../systems/DifficultyManager';
import { WaveSettings } from '../systems/WaveManager';

import { Player } from './Player';

export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  protected speed: number;
  protected scoreValue: number;
  protected health: number;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, speed: number, scoreValue: number, health: number = 1) {
    super(scene, x, y, texture);
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    this.speed = speed;
    this.scoreValue = scoreValue;
    this.health = health;
  }

  getScoreValue(): number {
    return this.scoreValue;
  }

  getHealth(): number {
    return this.health;
  }

  takeDamage(amount: number): boolean {
    this.health -= amount;
    return this.health <= 0;
  }

  update() {
    this.setVelocity(0);
  }

  }

export class RegularEnemy extends Enemy {
  private initialVelocityX: number;
  private initialVelocityY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, target: Player, speedMultiplier: number = 1) {
    const adjustedSpeed = GAME_SETTINGS.enemies.regular.speed * speedMultiplier;
    super(
      scene, 
      x, 
      y, 
      'enemy', 
      adjustedSpeed,
      GAME_SETTINGS.enemies.regular.scoreValue,
      1
    );
    const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    this.initialVelocityX = Math.cos(angle) * this.speed;
    this.initialVelocityY = Math.sin(angle) * this.speed;
  }

  update() {
    this.setVelocity(this.initialVelocityX, this.initialVelocityY);
  }
}

export class FastEnemy extends Enemy {
  private initialVelocityX: number;
  private initialVelocityY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, target: Player, speedMultiplier: number = 1) {
    const adjustedSpeed = GAME_SETTINGS.enemies.fast.speed * speedMultiplier;
    super(
      scene, 
      x, 
      y, 
      'enemy_fast', 
      adjustedSpeed,
      GAME_SETTINGS.enemies.fast.scoreValue,
      1
    );
    const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    this.initialVelocityX = Math.cos(angle) * this.speed;
    this.initialVelocityY = Math.sin(angle) * this.speed;
  }

  update() {
    this.setVelocity(this.initialVelocityX, this.initialVelocityY);
  }
}

export class BigEnemy extends Enemy {
  private target: Player;

  constructor(scene: Phaser.Scene, x: number, y: number, target: Player, speedMultiplier: number = 1) {
    const adjustedSpeed = GAME_SETTINGS.enemies.big.speed * speedMultiplier;
    super(
      scene, 
      x, 
      y, 
      'enemy_big', 
      adjustedSpeed,
      GAME_SETTINGS.enemies.big.scoreValue,
      GAME_SETTINGS.enemies.big.health
    );
    this.target = target;
  }

  update() {
    this.scene.physics.moveToObject(this, this.target, this.speed);
  }
}

export class ShooterEnemy extends Enemy {
  private target: Player;
  private fireTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, x: number, y: number, target: Player, speedMultiplier: number = 1) {
    const adjustedSpeed = GAME_SETTINGS.enemies.shooter.speed * speedMultiplier;
    super(scene, x, y, 'enemy_shooter', adjustedSpeed, GAME_SETTINGS.enemies.shooter.scoreValue, GAME_SETTINGS.enemies.shooter.health);
    this.target = target;
    this.setCollideWorldBounds(true);
    this.startFiring();
  }

  private startFiring() {
    this.fireTimer = this.scene.time.addEvent({
      delay: GAME_SETTINGS.enemies.shooter.fireRateMs,
      loop: true,
      callback: () => this.fire()
    });
  }

  private fire() {
    const sceneWithBullets = this.scene as Phaser.Scene & { enemyBullets?: Phaser.Physics.Arcade.Group };
    const group = sceneWithBullets.enemyBullets;
    if (!group) return;
    const bullet = group.get(this.x, this.y, 'enemy_bullet') as Phaser.Physics.Arcade.Image | null;
    if (!bullet) return;
    bullet.enableBody(true, this.x, this.y, true, true);
    bullet.setActive(true).setVisible(true);
    bullet.setCircle(4, 0, 0);
    this.scene.physics.world.enable(bullet);
    this.scene.physics.moveTo(bullet, this.target.x, this.target.y, GAME_SETTINGS.enemies.shooter.bulletSpeed);
  }

  update() {
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    const min = GAME_SETTINGS.enemies.shooter.preferredRangeMin ?? 220;
    const max = GAME_SETTINGS.enemies.shooter.preferredRangeMax ?? 300;
    const strafe = GAME_SETTINGS.enemies.shooter.strafeSpeed ?? 80;

    let vx = 0;
    let vy = 0;

    if (dist < min) {
      vx = (-dx / dist) * this.speed;
      vy = (-dy / dist) * this.speed;
    } else if (dist > max) {
      vx = (dx / dist) * this.speed;
      vy = (dy / dist) * this.speed;
    } else {
      vx = (-dy / dist) * strafe;
      vy = (dx / dist) * strafe;
    }

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const margin = 12;
    if (this.x <= margin && vx < 0) vx = 0;
    if (this.x >= w - margin && vx > 0) vx = 0;
    if (this.y <= margin && vy < 0) vy = 0;
    if (this.y >= h - margin && vy > 0) vy = 0;
    this.setVelocity(vx, vy);
  }

  destroy(fromScene?: boolean): void {
    if (this.fireTimer) {
      this.fireTimer.remove(false);
      this.fireTimer = undefined;
    }
    super.destroy(fromScene);
  }
}

export class SplitterEnemy extends Enemy {
  private target: Player;
  constructor(scene: Phaser.Scene, x: number, y: number, target: Player, speedMultiplier: number = 1) {
    const adjustedSpeed = GAME_SETTINGS.enemies.splitter.speed * speedMultiplier;
    super(scene, x, y, 'enemy_splitter', adjustedSpeed, GAME_SETTINGS.enemies.splitter.scoreValue, GAME_SETTINGS.enemies.splitter.health);
    this.target = target;
  }

  update() {
    this.scene.physics.moveToObject(this, this.target, this.speed);
  }
}

export class MiniEnemy extends Enemy {
  private initialVelocityX: number;
  private initialVelocityY: number;
  constructor(scene: Phaser.Scene, x: number, y: number, target: Player, speedMultiplier: number = 1) {
    const adjustedSpeed = GAME_SETTINGS.enemies.mini.speed * speedMultiplier;
    super(scene, x, y, 'enemy_mini', adjustedSpeed, GAME_SETTINGS.enemies.mini.scoreValue, GAME_SETTINGS.enemies.mini.health);
    const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    this.initialVelocityX = Math.cos(angle) * this.speed;
    this.initialVelocityY = Math.sin(angle) * this.speed;
  }

  update() {
    this.setVelocity(this.initialVelocityX, this.initialVelocityY);
  }
}

export class EnemySpawner {
  private scene: Phaser.Scene;
  private enemyGroup: Phaser.Physics.Arcade.Group;
  private target: Phaser.GameObjects.GameObject;

  constructor(scene: Phaser.Scene, enemyGroup: Phaser.Physics.Arcade.Group, target: Phaser.GameObjects.GameObject) {
    this.scene = scene;
    this.enemyGroup = enemyGroup;
    this.target = target;
  }

  spawn() {
    const spawnPoint = this.getRandomSpawnPoint();
    const spawnChance = Math.random();
    
    let enemy: Enemy;
    if (spawnChance < GAME_SETTINGS.enemies.big.spawnChance) {
      enemy = new BigEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player);
    } else if (spawnChance < GAME_SETTINGS.enemies.fast.spawnChance + GAME_SETTINGS.enemies.big.spawnChance) {
      enemy = new FastEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player);
    } else {
      enemy = new RegularEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player);
    }
    
    this.enemyGroup.add(enemy);
  }

  spawnWithDifficulty(difficulty: DifficultySettings) {
    const spawnPoint = this.getRandomSpawnPoint();
    const spawnChance = Math.random();
    
    let enemy: Enemy;
    if (spawnChance < difficulty.bigEnemyChance) {
      enemy = new BigEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player, difficulty.enemySpeedMultiplier);
    } else if (spawnChance < difficulty.fastEnemyChance + difficulty.bigEnemyChance) {
      enemy = new FastEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player, difficulty.enemySpeedMultiplier);
    } else if (spawnChance < (difficulty.fastEnemyChance + difficulty.bigEnemyChance + 0.08)) {
      enemy = new SplitterEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player, difficulty.enemySpeedMultiplier);
    } else {
      enemy = new RegularEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player, difficulty.enemySpeedMultiplier);
    }
    
    this.enemyGroup.add(enemy);
  }

  spawnWithWave(waveSettings: WaveSettings) {
    const spawnPoint = this.getRandomSpawnPoint();
    const spawnChance = Math.random();
    
    let enemy: Enemy;
    const bigCut = waveSettings.enemyTypes.big;
    const fastCut = bigCut + waveSettings.enemyTypes.fast;
    const shooterCut = fastCut + waveSettings.enemyTypes.shooter;
    const splitterCut = shooterCut + (waveSettings.enemyTypes.splitter ?? 0);

    if (spawnChance < bigCut) {
      enemy = new BigEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player);
    } else if (spawnChance < fastCut) {
      enemy = new FastEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player);
    } else if (spawnChance < shooterCut) {
      enemy = new ShooterEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player);
    } else if (spawnChance < splitterCut) {
      enemy = new SplitterEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player);
    } else {
      enemy = new RegularEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player);
    }
    
    this.enemyGroup.add(enemy);
  }

  private getRandomSpawnPoint(): { x: number, y: number } {
    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;
    const x = Phaser.Math.Between(0, screenWidth);
    const y = Phaser.Math.Between(0, screenHeight);
    const side = Phaser.Math.Between(0, 3);
    
    switch(side) {
      case 0: // top
        return { x, y: -50 };
      case 1: // right
        return { x: screenWidth + 50, y };
      case 2: // bottom
        return { x, y: screenHeight + 50 };
      case 3: // left
        return { x: -50, y };
      default:
        return { x: 0, y: 0 };
    }
  }
}

// Bosses
export abstract class Boss extends Phaser.Physics.Arcade.Sprite {
  protected maxHealth: number
  protected currentHealth: number
  protected speed: number
  protected scoreValue: number
  protected target: Player

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, target: Player, maxHealth: number, speed: number, scoreValue: number) {
    super(scene, x, y, texture)
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.maxHealth = maxHealth
    this.currentHealth = maxHealth
    this.speed = speed
    this.scoreValue = scoreValue
    this.target = target
    this.setCollideWorldBounds(true)
  }

  takeDamage(amount: number): boolean {
    this.currentHealth -= amount
    return this.currentHealth <= 0
  }

  getHealthPct(): number { return Math.max(0, this.currentHealth / this.maxHealth) }
  getCurrentHealth(): number { return this.currentHealth }
  getMaxHealth(): number { return this.maxHealth }
  getScoreValue(): number { return this.scoreValue }
}

export class SentinelBoss extends Boss {
  private phaseTimer?: Phaser.Time.TimerEvent
  private dashCooldown = 2000
  private shootCooldown = 800
  private lastDash = 0
  private lastShoot = 0

  constructor(scene: Phaser.Scene, x: number, y: number, target: Player) {
    // Wave boss: ensure at least 40 HP
    super(scene, x, y, 'boss_sentinel', target, 40, 110, 500)
    this.setImmovable(true)
    this.startPhases()
  }

  private startPhases() {
    this.phaseTimer = this.scene.time.addEvent({ delay: 4000, loop: true, callback: () => {
      // Alternate between chase and strafe phases
      this.dashCooldown = 1500 + Math.random()*1000
      this.shootCooldown = 600 + Math.random()*500
    } })
  }

  update() {
    const now = this.scene.time.now
    const dx = this.target.x - this.x
    const dy = this.target.y - this.y
    const dist = Math.hypot(dx, dy) || 1
    // Strafe around the player within mid range
    const desired = 260
    const towards = (dist > desired ? 1 : -1)
    const strafeX = (-dy / dist) * this.speed * 0.8
    const strafeY = (dx / dist) * this.speed * 0.8
    const vx = (dx / dist) * this.speed * 0.6 * towards + strafeX
    const vy = (dy / dist) * this.speed * 0.6 * towards + strafeY
    this.setVelocity(vx, vy)

    if (now - this.lastDash > this.dashCooldown) {
      this.lastDash = now
      const dashV = 280
      this.setVelocity((dx / dist) * dashV, (dy / dist) * dashV)
    }

    if (now - this.lastShoot > this.shootCooldown) {
      this.lastShoot = now
      // Fire a 5-bullet fan
      const sceneWithBullets = this.scene as Phaser.Scene & { enemyBullets?: Phaser.Physics.Arcade.Group }
      const group = sceneWithBullets.enemyBullets
      if (group) {
        const base = Math.atan2(dy, dx)
        for (let i = -2; i <= 2; i++) {
          const angle = base + i * 0.12
          const bullet = group.get(this.x, this.y, 'enemy_bullet') as Phaser.Physics.Arcade.Image | null
          if (!bullet) continue
          bullet.enableBody(true, this.x, this.y, true, true)
          bullet.setActive(true).setVisible(true)
          bullet.setCircle(4, 0, 0)
          this.scene.physics.world.enable(bullet)
          bullet.setVelocity(Math.cos(angle) * 240, Math.sin(angle) * 240)
        }
      }
    }
  }

  destroy(fromScene?: boolean): void {
    this.phaseTimer?.remove()
    super.destroy(fromScene)
  }
}

export class ArtilleryBoss extends Boss {
  private salvoTimer?: Phaser.Time.TimerEvent
  constructor(scene: Phaser.Scene, x: number, y: number, target: Player) {
    super(scene, x, y, 'boss_artillery', target, 400, 80, 700)
    this.startSalvos()
  }
  private startSalvos() {
    this.salvoTimer = this.scene.time.addEvent({ delay: 2500, loop: true, callback: () => this.fireBarrage() })
  }
  private fireBarrage() {
    const sceneWithBullets = this.scene as Phaser.Scene & { enemyBullets?: Phaser.Physics.Arcade.Group }
    const group = sceneWithBullets.enemyBullets
    if (!group) return
    // Circular barrage
    const bullets = 18
    for (let i = 0; i < bullets; i++) {
      const angle = (Math.PI * 2 * i) / bullets
      const bullet = group.get(this.x, this.y, 'enemy_bullet') as Phaser.Physics.Arcade.Image | null
      if (!bullet) continue
      bullet.enableBody(true, this.x, this.y, true, true)
      bullet.setActive(true).setVisible(true)
      bullet.setCircle(4, 0, 0)
      this.scene.physics.world.enable(bullet)
      bullet.setVelocity(Math.cos(angle) * 180, Math.sin(angle) * 180)
    }
  }
  update() {
    // Keep distance, slowly move
    const dx = this.target.x - this.x
    const dy = this.target.y - this.y
    const dist = Math.hypot(dx, dy) || 1
    const desired = 360
    const towards = (dist > desired ? 1 : -1)
    this.setVelocity((dx / dist) * this.speed * towards, (dy / dist) * this.speed * towards)
  }
  destroy(fromScene?: boolean): void {
    this.salvoTimer?.remove()
    super.destroy(fromScene)
  }
}