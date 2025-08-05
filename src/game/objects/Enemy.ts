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

    if (spawnChance < bigCut) {
      enemy = new BigEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player);
    } else if (spawnChance < fastCut) {
      enemy = new FastEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player);
    } else if (spawnChance < shooterCut) {
      enemy = new ShooterEnemy(this.scene, spawnPoint.x, spawnPoint.y, this.target as Player);
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