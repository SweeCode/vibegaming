import * as Phaser from 'phaser';
import { GAME_SETTINGS } from '../config/gameConfig';
import { Player } from '../objects/Player';
import { Enemy, EnemySpawner } from '../objects/Enemy';
import { GameUI } from '../ui/GameUI';
import { ReloadingBar } from '../ui/ReloadingBar';
import { DifficultyManager } from '../systems/DifficultyManager';

export class MainScene extends Phaser.Scene {
  private player!: Player;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemySpawner!: EnemySpawner;
  private gameUI!: GameUI;
  private reloadingBar!: ReloadingBar;
  private difficultyManager!: DifficultyManager;
  private score = 0;
  private ammo = GAME_SETTINGS.weapons.bullet.maxAmmo;
  private isReloading = false;
  private gameOver = false;
  private gameStartTime: number = 0;
  private spawnTimer!: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {
    this.createTextures();
  }

  create() {
    this.gameStartTime = Date.now(); // Start the timer
    this.createPlayer();
    this.createInputs();
    this.createBullets();
    this.createEnemies();
    this.createUI();
    this.createReloadingBar();
    this.createDifficultyManager();
    this.setupCollisions();
    this.setupSpawnTimer();
    this.setupMouseInput();
    this.setupKeyboardInput();
  }

  update() {
    if (this.gameOver) return;

    this.updateBullets();
    this.updateEnemies(); // Add enemy cleanup
    this.player.update();
    this.reloadingBar.update();
    this.updateTimer(); // Update timer display
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

    const bigEnemyGraphics = this.make.graphics({ fillStyle: { color: 0x800080 } }, false);
    bigEnemyGraphics.fillRect(0, 0, 48, 48);
    bigEnemyGraphics.generateTexture('enemy_big', 48, 48);
    bigEnemyGraphics.destroy();
  }

  private createPlayer() {
    this.player = new Player(this, this.scale.width / 2, this.scale.height / 2);
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

  private createReloadingBar() {
    this.reloadingBar = new ReloadingBar(this, this.player);
  }

  private createDifficultyManager() {
    this.difficultyManager = new DifficultyManager();
  }

  private setupCollisions() {
    this.physics.add.collider(this.bullets, this.enemies, this.handleBulletEnemyCollision, undefined, this);
    this.physics.add.collider(this.player, this.enemies, this.handlePlayerEnemyCollision, undefined, this);
  }

  private setupSpawnTimer() {
    const difficulty = this.difficultyManager.getCurrentSettings();
    this.spawnTimer = this.time.addEvent({
      delay: difficulty.spawnDelay,
      callback: () => this.spawnEnemyWithDifficulty(),
      callbackScope: this,
      loop: true
    });
  }

  private setupMouseInput() {
    this.input.on('pointerdown', this.handleShoot, this);
  }

  private setupKeyboardInput() {
    // ESC key to return to menu
    this.input.keyboard?.on('keydown-ESC', () => {
      console.log('ESC pressed, going to menu'); // Debug log
      this.scene.start('StartMenuScene');
    });
  }

  private handleBulletEnemyCollision(bullet: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, enemy: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile) {
    const bulletObj = bullet as Phaser.GameObjects.Sprite;
    const enemyObj = enemy as Enemy;

    // Don't process if bullet is already inactive or enemy is already destroyed
    if (!bulletObj.active || !enemyObj.active) return;

    bulletObj.setActive(false).setVisible(false);
    
    const isDead = enemyObj.takeDamage(1);
    if (isDead) {
      this.score += enemyObj.getScoreValue();
      enemyObj.destroy();
      this.updateDifficulty();
      this.gameUI.updateScore(this.score);
    }
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
    this.spawnTimer.paused = true;
    this.player.setTint(0xff0000);
    this.gameOver = true;
    this.gameUI.showGameOver();
    this.promptScoreEntry();
  }

  private promptScoreEntry() {
    const gameTime = this.getGameTime();
    
    // Delay to show game over screen briefly, then show score entry
    this.time.delayedCall(2000, () => {
      this.scene.start('ScoreEntryScene', { score: this.score, time: gameTime });
    });
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
    this.reloadingBar.show(GAME_SETTINGS.weapons.bullet.reloadTime);
    
    this.time.delayedCall(GAME_SETTINGS.weapons.bullet.reloadTime, () => {
      this.ammo = GAME_SETTINGS.weapons.bullet.maxAmmo;
      this.isReloading = false;
      this.gameUI.updateAmmo(this.ammo);
      // Note: reloadingBar.hide() is called automatically by the ReloadingBar class
    });
  }

  private updateBullets() {
    for (const bullet of this.bullets.getMatching('active', true)) {
      if (bullet.x < 0 || bullet.x > this.scale.width || bullet.y < 0 || bullet.y > this.scale.height) {
        (bullet as Phaser.GameObjects.Sprite).setActive(false).setVisible(false);
      }
    }
  }

  private updateEnemies() {
    // Clean up enemies that have gone off-screen
    const margin = 100; // Give some margin before cleanup
    for (const enemy of this.enemies.getMatching('active', true)) {
      const enemySprite = enemy as Phaser.GameObjects.Sprite;
      if (enemySprite.x < -margin || 
          enemySprite.x > this.scale.width + margin || 
          enemySprite.y < -margin || 
          enemySprite.y > this.scale.height + margin) {
        enemySprite.destroy();
      }
    }
  }

  private updateTimer() {
    if (this.gameStartTime > 0) {
      const currentTime = Math.floor((Date.now() - this.gameStartTime) / 1000);
      this.gameUI.updateTimer(currentTime);
    }
  }

  private getGameTime(): number {
    return Math.floor((Date.now() - this.gameStartTime) / 1000);
  }

  private spawnEnemyWithDifficulty() {
    const difficulty = this.difficultyManager.getCurrentSettings();
    
    // Check if we've reached max enemies on screen
    const activeEnemies = this.enemies.countActive();
    if (activeEnemies >= difficulty.maxEnemiesOnScreen) {
      return;
    }
    
    // Spawn enemy using the difficulty-adjusted enemy spawner
    this.enemySpawner.spawnWithDifficulty(difficulty);
  }

  private updateDifficulty() {
    const levelIncreased = this.difficultyManager.updateDifficulty(this.score);
    
    if (levelIncreased) {
      const difficulty = this.difficultyManager.getCurrentSettings();
      
      // Recreate spawn timer with new delay
      this.spawnTimer.destroy();
      this.spawnTimer = this.time.addEvent({
        delay: difficulty.spawnDelay,
        callback: () => this.spawnEnemyWithDifficulty(),
        callbackScope: this,
        loop: true
      });
      
      // Show level up notification
      this.showLevelUpNotification(difficulty.level, difficulty.title);
      
      // Update UI difficulty display
      this.gameUI.updateDifficulty(difficulty.level, difficulty.title);
    }
  }

  private showLevelUpNotification(level: number, title: string) {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    
    const levelText = this.add.text(centerX, centerY - 50, `LEVEL ${level}`, {
      fontSize: '48px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    const titleText = this.add.text(centerX, centerY + 10, title.toUpperCase(), {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Animate the notification
    this.tweens.add({
      targets: [levelText, titleText],
      alpha: { from: 0, to: 1 },
      scale: { from: 0.5, to: 1 },
      duration: 500,
      ease: 'Back.easeOut'
    });
    
    // Remove after 2 seconds
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: [levelText, titleText],
        alpha: 0,
        scale: 0.8,
        duration: 300,
        onComplete: () => {
          levelText.destroy();
          titleText.destroy();
        }
      });
    });
  }

  private resetGame() {
    this.gameOver = false;
    this.score = 0;
    this.ammo = GAME_SETTINGS.weapons.bullet.maxAmmo;
    this.isReloading = false;
    this.gameStartTime = Date.now(); // Reset timer
    
    this.player.setPosition(this.scale.width / 2, this.scale.height / 2);
    this.player.reset();
    this.gameUI.reset();
    this.gameUI.hideLeaderboard();
    this.reloadingBar.hide(); // Hide reloading bar if it's showing
    this.difficultyManager.reset(); // Reset difficulty
    
    this.enemies.clear(true, true);
    this.bullets.clear(true, true);
    
    // Reset spawn timer to initial difficulty
    const difficulty = this.difficultyManager.getCurrentSettings();
    this.spawnTimer.destroy();
    this.spawnTimer = this.time.addEvent({
      delay: difficulty.spawnDelay,
      callback: () => this.spawnEnemyWithDifficulty(),
      callbackScope: this,
      loop: true
    });
    
    this.physics.resume();
    this.spawnTimer.paused = false;
  }
}