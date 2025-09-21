import * as Phaser from 'phaser';
import { UpgradeManager } from '../systems/UpgradeManager';
import type { ActiveModifiers } from '../systems/SkillTreeManager';
import { getPlayerColor } from '../systems/playerAppearance';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private keys: { [key: string]: Phaser.Input.Keyboard.Key };
  private health: number;
  private maxHealth: number;
  private upgradeManager: UpgradeManager;
  private playerStats: { health: number; speed: number; maxAmmo: number; reloadSpeed: number; bulletSpeed: number; bulletDamage: number };
  private modifiers: ActiveModifiers;
  private lastDamageAtMs: number = 0;
  private shieldHp: number = 0;
  private regenAccumulatorMs: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    
    scene.add.existing(this);
    scene.physics.add.existing(this);
    
    this.setCollideWorldBounds(true);
    
    // Initialize upgrade system and get current stats
    this.upgradeManager = new UpgradeManager();
    this.playerStats = this.upgradeManager.getPlayerStats();
    this.modifiers = this.upgradeManager.getModifiers();
    
    this.health = this.playerStats.health;
    this.maxHealth = this.playerStats.health;
    
    this.keys = scene.input.keyboard?.addKeys('W,A,S,D') as { [key: string]: Phaser.Input.Keyboard.Key } || {};

    // Apply saved color tint on spawn
    const color = getPlayerColor();
    if (typeof color === 'number') {
      this.setTint(color);
    }
  }

  update() {
    this.updateRotation();
    this.updateMovement();
    this.updateDefensiveEffects();
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
    const speed = this.playerStats.speed; // Use upgraded speed
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
    // Apply damage reduction
    const reduced = Math.ceil(amount * (1 - (this.modifiers?.damageReductionPct ?? 0)));
    let remaining = reduced;
    // Consume shield first
    if (this.shieldHp > 0 && remaining > 0) {
      const absorbed = Math.min(this.shieldHp, remaining);
      this.shieldHp -= absorbed;
      remaining -= absorbed;
    }
    // Apply to health
    if (remaining > 0) {
      this.health -= remaining;
    }
    // Mark as damaged to gate regen/shield
    this.lastDamageAtMs = this.scene.time.now;
    return this.health <= 0;
  }

  getHealth(): number {
    return this.health;
  }

  getHealthPercentage(): number {
    return this.health / this.maxHealth;
  }

  reset() {
    // Refresh stats in case upgrades were purchased
    this.playerStats = this.upgradeManager.getPlayerStats();
    this.modifiers = this.upgradeManager.getModifiers();
    this.maxHealth = this.playerStats.health;
    this.health = this.maxHealth;
    this.shieldHp = 0;
    this.lastDamageAtMs = 0;
    this.regenAccumulatorMs = 0;
    this.clearTint();
    const color = getPlayerColor();
    if (typeof color === 'number') {
      this.setTint(color);
    }
    // Position will be set by the scene
  }

  getPlayerStats() {
    return this.playerStats;
  }

  private updateDefensiveEffects() {
    // Regen over time
    const healPerSecond = this.modifiers?.healPerSecond ?? 0;
    if (healPerSecond > 0 && this.health > 0) {
      const dt = (this.scene.game.loop.delta || 0);
      this.regenAccumulatorMs += dt;
      if (this.regenAccumulatorMs >= 100) {
        const ticks = Math.floor(this.regenAccumulatorMs / 100);
        this.regenAccumulatorMs -= ticks * 100;
        const healPerMs = healPerSecond / 1000;
        const healAmount = Math.max(0, Math.floor(healPerMs * ticks * 100));
        if (healAmount > 0) {
          const timeSinceDamage = (this.scene.time.now - (this.lastDamageAtMs || 0)) / 1000;
          const inCombat = timeSinceDamage < 4;
          const cap = inCombat ? Math.floor(this.maxHealth * 0.5) : this.maxHealth;
          this.health = Math.min(cap, this.health + healAmount);
        }
      }
    }

    // Shield after idle
    const shield = this.modifiers?.shieldAfterIdle;
    if (shield?.enabled) {
      const timeSinceDamage = (this.scene.time.now - (this.lastDamageAtMs || 0)) / 1000;
      if (timeSinceDamage >= (shield.idleSeconds || 0) && this.shieldHp <= 0) {
        this.shieldHp = shield.shieldHp || 0;
      }
    }
  }

  hasShield(): boolean {
    return this.shieldHp > 0;
  }
}