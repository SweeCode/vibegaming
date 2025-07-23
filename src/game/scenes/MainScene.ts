import * as Phaser from 'phaser';
import { GAME_SETTINGS } from '../config/gameConfig';
import { Player } from '../objects/Player';
import { Enemy, EnemySpawner } from '../objects/Enemy';
import { GameUI } from '../ui/GameUI';

export class MainScene extends Phaser.Scene {
  private player!: Player;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemySpawner!: EnemySpawner;
  private gameUI!: GameUI;
  private score = 0;
  private ammo = GAME_SETTINGS.weapons.bullet.maxAmmo;
  private isReloading = false;
  private gameOver = false;

  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {
    this.createTextures();
  }

  create() {
    this.createPlayer();
    this.createInputs();
    this.createBullets();
    this.createEnemies();
    this.createUI();
    this.setupCollisions();
    this.setupSpawnTimer();
    this.setupMouseInput();
  }

  update() {
    if (this.gameOver) return;

    this.updateBullets();
    this.player.update();
  }

  private createTextures() {
    const playerGraphics = this.make.graphics({ fillStyle: { color: 0xffffff } }, false);
    playerGraphics.fillRect(0, 0, 32, 32);
    playerGraphics.generateTexture('player', 32, 32);
    playerGraphics.destroy();

    const bulletGraphics = this.make.graphics({ fillStyle: { color: 0xff0000 } }, false);
    bulletGraphics.fillRect(0, 0, 8, 8);
    bulletGraphics.generateTexture('bullet', 8, 8);
    bulletGraphics.destroy();

    const enemyGraphics = this.make.graphics({ fillStyle: { color: 0x00ff00 } }, false);
    enemyGraphics.fillRect(0, 0, 24, 24);
    enemyGraphics.generateTexture('enemy', 24, 24);
    enemyGraphics.destroy();

    const fastEnemyGraphics = this.make.graphics({ fillStyle: { color: 0x0000ff } }, false);
    fastEnemyGraphics.fillRect(0, 0, 24, 24);
    fastEnemyGraphics.generateTexture('enemy_fast', 24, 24);
    fastEnemyGraphics.destroy();
  }

  private createPlayer() {
    this.player = new Player(this, 400, 300);
  }

  private createInputs() {
    // Input handling moved to Player class
  }

  private createBullets() {
    this.bullets = this.physics.add.group({
      defaultKey: 'bullet',
      maxSize: GAME_SETTINGS.weapons.bullet.maxAmmo
    });
  }

  private createEnemies() {
    this.enemies = this.physics.add.group({
      runChildUpdate: true
    });
    this.enemySpawner = new EnemySpawner(this, this.enemies, this.player);
  }

  private createUI() {
    this.gameUI = new GameUI(this);
  }

  private setupCollisions() {
    this.physics.add.collider(this.bullets, this.enemies, this.handleBulletEnemyCollision, undefined, this);
    this.physics.add.collider(this.player, this.enemies, this.handlePlayerEnemyCollision, undefined, this);
  }

  private setupSpawnTimer() {
    this.time.addEvent({
      delay: GAME_SETTINGS.enemies.regular.spawnDelay,
      callback: () => this.enemySpawner.spawn(),
      callbackScope: this,
      loop: true
    });
  }

  private setupMouseInput() {
    this.input.on('pointerdown', this.handleShoot, this);
  }

  private handleBulletEnemyCollision(bullet: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, enemy: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile) {
    const bulletObj = bullet as Phaser.GameObjects.Sprite;
    bulletObj.setActive(false).setVisible(false);
    
    const enemyObj = enemy as Enemy;
    this.score += enemyObj.getScoreValue();
    
    enemyObj.destroy();
    this.gameUI.updateScore(this.score);
  }

  private handlePlayerEnemyCollision(player: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, enemy: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile) {
    const enemyObj = enemy as Enemy;
    enemyObj.destroy();
    
    const isDead = this.player.takeDamage(GAME_SETTINGS.player.damagePerHit);
    this.gameUI.updateHealthBar(this.player.getHealthPercentage());
    
    if (isDead) {
      this.handleGameOver();
    }
  }

  private handleGameOver() {
    this.physics.pause();
    this.player.setTint(0xff0000);
    this.gameOver = true;
    this.gameUI.showGameOver();
  }

  private handleShoot(pointer: Phaser.Input.Pointer) {
    if (this.gameOver) {
      this.resetGame();
      return;
    }

    if (this.isReloading || this.ammo === 0) return;

    const bullet = this.bullets.get(this.player.x, this.player.y);
    if (bullet) {
      bullet.setActive(true).setVisible(true);
      this.physics.moveTo(bullet, pointer.x, pointer.y, GAME_SETTINGS.weapons.bullet.speed);
      this.ammo--;
      this.gameUI.updateAmmo(this.ammo);

      if (this.ammo === 0) {
        this.reload();
      }
    }
  }

  private reload() {
    this.isReloading = true;
    this.gameUI.showReloading();
    
    this.time.delayedCall(GAME_SETTINGS.weapons.bullet.reloadTime, () => {
      this.ammo = GAME_SETTINGS.weapons.bullet.maxAmmo;
      this.isReloading = false;
      this.gameUI.updateAmmo(this.ammo);
    });
  }

  private updateBullets() {
    for (const bullet of this.bullets.getMatching('active', true)) {
      if (bullet.x < 0 || bullet.x > 800 || bullet.y < 0 || bullet.y > 600) {
        (bullet as Phaser.GameObjects.Sprite).setActive(false).setVisible(false);
      }
    }
  }

  private resetGame() {
    this.gameOver = false;
    this.score = 0;
    this.ammo = GAME_SETTINGS.weapons.bullet.maxAmmo;
    this.isReloading = false;
    
    this.player.reset();
    this.gameUI.reset();
    
    this.enemies.clear(true, true);
    this.bullets.clear(true, true);
    
    this.physics.resume();
  }
}