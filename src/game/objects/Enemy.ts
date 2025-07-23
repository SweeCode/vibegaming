import * as Phaser from 'phaser';
import { GAME_SETTINGS } from '../config/gameConfig';

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

  constructor(scene: Phaser.Scene, x: number, y: number, target: Player) {
    super(
      scene, 
      x, 
      y, 
      'enemy', 
      GAME_SETTINGS.enemies.regular.speed,
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

  constructor(scene: Phaser.Scene, x: number, y: number, target: Player) {
    super(
      scene, 
      x, 
      y, 
      'enemy_fast', 
      GAME_SETTINGS.enemies.fast.speed,
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

  constructor(scene: Phaser.Scene, x: number, y: number, target: Player) {
    super(
      scene, 
      x, 
      y, 
      'enemy_big', 
      GAME_SETTINGS.enemies.big.speed,
      GAME_SETTINGS.enemies.big.scoreValue,
      GAME_SETTINGS.enemies.big.health
    );
    this.target = target;
  }

  update() {
    this.scene.physics.moveToObject(this, this.target, this.speed);
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