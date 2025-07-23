import * as Phaser from 'phaser';
import { GAME_SETTINGS } from '../config/gameConfig';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private keys: { [key: string]: Phaser.Input.Keyboard.Key };
  private health: number;
  private maxHealth: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    this.setCollideWorldBounds(true);
    
    this.health = GAME_SETTINGS.player.maxHealth;
    this.maxHealth = GAME_SETTINGS.player.maxHealth;
    
    this.keys = scene.input.keyboard?.addKeys('W,A,S,D') as { [key: string]: Phaser.Input.Keyboard.Key } || {};
  }

  update() {
    this.updateRotation();
    this.updateMovement();
  }

  private updateRotation() {
    const pointer = this.scene.input.activePointer;
    this.rotation = Phaser.Math.Angle.Between(
      this.x, 
      this.y, 
      pointer.worldX, 
      pointer.worldY
    );
  }

  private updateMovement() {
    const speed = GAME_SETTINGS.player.speed;
    let velocityX = 0;
    let velocityY = 0;

    if (this.keys.W?.isDown) {
      velocityY = -1;
    } else if (this.keys.S?.isDown) {
      velocityY = 1;
    }

    if (this.keys.A?.isDown) {
      velocityX = -1;
    } else if (this.keys.D?.isDown) {
      velocityX = 1;
    }

    const velocity = new Phaser.Math.Vector2(velocityX, velocityY).normalize().scale(speed);
    this.setVelocity(velocity.x, velocity.y);
  }

  takeDamage(amount: number): boolean {
    this.health -= amount;
    return this.health <= 0;
  }

  getHealth(): number {
    return this.health;
  }

  getHealthPercentage(): number {
    return this.health / this.maxHealth;
  }

  reset() {
    this.health = this.maxHealth;
    this.clearTint();
    // Position will be set by the scene
  }
}