import * as Phaser from 'phaser';
import { GAME_SETTINGS } from '../config/gameConfig';

export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  protected speed: number;
  protected scoreValue: number;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, speed: number, scoreValue: number) {
    super(scene, x, y, texture);
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    this.speed = speed;
    this.scoreValue = scoreValue;
  }

  moveToTarget(target: Phaser.GameObjects.GameObject) {
    this.scene.physics.moveToObject(this, target, this.speed);
  }

  getScoreValue(): number {
    return this.scoreValue;
  }
}

export class RegularEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(
      scene, 
      x, 
      y, 
      'enemy', 
      GAME_SETTINGS.enemies.regular.speed,
      GAME_SETTINGS.enemies.regular.scoreValue
    );
  }
}

export class FastEnemy extends Enemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(
      scene, 
      x, 
      y, 
      'enemy_fast', 
      GAME_SETTINGS.enemies.fast.speed,
      GAME_SETTINGS.enemies.fast.scoreValue
    );
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
    const isFast = Math.random() < GAME_SETTINGS.enemies.fast.spawnChance;
    
    const enemy = isFast 
      ? new FastEnemy(this.scene, spawnPoint.x, spawnPoint.y)
      : new RegularEnemy(this.scene, spawnPoint.x, spawnPoint.y);
    
    this.enemyGroup.add(enemy);
    enemy.moveToTarget(this.target);
  }

  private getRandomSpawnPoint(): { x: number, y: number } {
    const x = Phaser.Math.Between(0, 800);
    const y = Phaser.Math.Between(0, 600);
    const side = Phaser.Math.Between(0, 3);
    
    switch(side) {
      case 0: // top
        return { x, y: 0 };
      case 1: // right
        return { x: 800, y };
      case 2: // bottom
        return { x, y: 600 };
      case 3: // left
        return { x: 0, y };
      default:
        return { x: 0, y: 0 };
    }
  }
}