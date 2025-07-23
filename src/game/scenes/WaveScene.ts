import * as Phaser from 'phaser';
import { GAME_SETTINGS } from '../config/gameConfig';
import { Player } from '../objects/Player';
import { Enemy, EnemySpawner } from '../objects/Enemy';
import { GameUI } from '../ui/GameUI';
import { ReloadingBar } from '../ui/ReloadingBar';
import { WaveManager } from '../systems/WaveManager';
import { UpgradeManager } from '../systems/UpgradeManager';

export class WaveScene extends Phaser.Scene {
  private player!: Player;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemySpawner!: EnemySpawner;
  private gameUI!: GameUI;
  private reloadingBar!: ReloadingBar;
  private waveManager!: WaveManager;
  private upgradeManager!: UpgradeManager;
  private score = 0;
  private ammo = GAME_SETTINGS.weapons.bullet.maxAmmo;
  private maxAmmo = GAME_SETTINGS.weapons.bullet.maxAmmo;
  private isReloading = false;
  private gameOver = false;
  private gameStartTime: number = 0;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private breakTimer?: Phaser.Time.TimerEvent;
  private waveText?: Phaser.GameObjects.Text;
  private breakText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'WaveScene' });
  }

  shutdown() {
    // Clean up timers when scene is stopped
    if (this.spawnTimer) {
      this.spawnTimer.destroy();
      this.spawnTimer = undefined;
    }
    if (this.breakTimer) {
      this.breakTimer.destroy();
      this.breakTimer = undefined;
    }
  }

  preload() {
    this.createTextures();
  }

  create() {
    this.gameStartTime = Date.now();
    this.upgradeManager = new UpgradeManager();
    this.initializePlayerStats();
    this.createPlayer();
    this.createBullets();
    this.createEnemies();
    this.createUI();
    this.createReloadingBar();
    this.createWaveManager();
    this.setupCollisions();
    this.setupMouseInput();
    this.setupKeyboardInput();
    this.startFirstWave();
  }

  private initializePlayerStats() {
    const playerStats = this.upgradeManager.getPlayerStats();
    this.maxAmmo = playerStats.maxAmmo;
    this.ammo = this.maxAmmo;
  }

  update() {
    if (this.gameOver) return;

    this.updateBullets();
    this.updateEnemies();
    if (this.player) this.player.update();
    if (this.reloadingBar) this.reloadingBar.update();
    this.updateTimer();
    this.updateWaveSystem();
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

  private createWaveManager() {
    this.waveManager = new WaveManager();
  }

  private setupCollisions() {
    this.physics.add.collider(this.bullets, this.enemies, this.handleBulletEnemyCollision, undefined, this);
    this.physics.add.collider(this.player, this.enemies, this.handlePlayerEnemyCollision, undefined, this);
  }

  private setupMouseInput() {
    this.input.on('pointerdown', this.handleShoot, this);
  }

  private setupKeyboardInput() {
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.gameOver) {
        this.pauseGame();
      }
    });
  }

  private pauseGame() {
    this.scene.pause();
    this.scene.launch('PauseMenuScene', { parentScene: 'WaveScene' });
  }

  private startFirstWave() {
    this.waveManager.startWave();
    this.showWaveNotification();
    this.setupSpawnTimer();
  }

  private setupSpawnTimer() {
    const waveSettings = this.waveManager.getCurrentWaveSettings();
    console.log(`Setting up spawn timer for wave ${waveSettings.waveNumber}: ${waveSettings.enemyCount} enemies, ${waveSettings.spawnDelay}ms delay`);
    
    if (this.spawnTimer) {
      this.spawnTimer.destroy();
    }

    this.spawnTimer = this.time.addEvent({
      delay: waveSettings.spawnDelay,
      callback: () => this.spawnEnemyWithWave(),
      callbackScope: this,
      loop: true
    });
  }

  private spawnEnemyWithWave() {
    if (!this.waveManager.canSpawnEnemy()) {
      console.log('Cannot spawn enemy - wave complete or inactive');
      return;
    }

    const waveSettings = this.waveManager.getCurrentWaveSettings();
    console.log(`Spawning enemy for wave ${waveSettings.waveNumber}`);
    
    // Use wave-based enemy spawning
    this.enemySpawner.spawnWithWave(waveSettings);
    this.waveManager.onEnemySpawned();
  }

  private updateWaveSystem() {
    if (this.waveManager.isOnBreak()) {
      return; // Break timer handles wave progression
    }

    const waveProgress = this.waveManager.getWaveProgress();
    const activeEnemies = this.enemies.countActive();
    
    // Debug logging
    console.log(`Wave ${this.waveManager.getCurrentWave()}: Spawned ${waveProgress.spawned}/${waveProgress.total}, Killed ${waveProgress.killed}/${waveProgress.total}, Active: ${activeEnemies}`);

    if (this.waveManager.isWaveComplete() && activeEnemies === 0) {
      console.log('Wave completed! Starting break...');
      // Wave completed, start break
      this.waveManager.startBreak();
      this.showBreakNotification();
      
      const waveSettings = this.waveManager.getCurrentWaveSettings();
      this.breakTimer = this.time.delayedCall(waveSettings.breakDuration, () => {
        this.startNextWave();
      });
    }
  }

  private startNextWave() {
    console.log('Starting next wave...');
    this.waveManager.endBreak();
    this.waveManager.startWave();
    console.log(`Now on wave ${this.waveManager.getCurrentWave()}`);
    this.showWaveNotification();
    this.setupSpawnTimer();
    this.hideBreakNotification();
  }

  private showWaveNotification() {
    const waveSettings = this.waveManager.getCurrentWaveSettings();
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.waveText = this.add.text(centerX, centerY - 50, `WAVE ${waveSettings.waveNumber}`, {
      fontSize: '48px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const titleText = this.add.text(centerX, centerY + 10, waveSettings.title.toUpperCase(), {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Animate notification
    this.tweens.add({
      targets: [this.waveText, titleText],
      alpha: { from: 0, to: 1 },
      scale: { from: 0.5, to: 1 },
      duration: 500,
      ease: 'Back.easeOut'
    });

    // Remove after 3 seconds
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: [this.waveText, titleText],
        alpha: 0,
        scale: 0.8,
        duration: 300,
        onComplete: () => {
          this.waveText?.destroy();
          titleText.destroy();
        }
      });
    });

    // Update UI to show wave info
    this.gameUI.updateDifficulty(waveSettings.waveNumber, waveSettings.title);
  }

  private showBreakNotification() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.breakText = this.add.text(centerX, centerY, 'WAVE CLEARED!\nPreparing next wave...', {
      fontSize: '32px',
      color: '#00ff00',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5);

    // Pulse animation
    this.tweens.add({
      targets: this.breakText,
      scale: { from: 1, to: 1.1 },
      duration: 1000,
      yoyo: true,
      repeat: -1
    });
  }

  private hideBreakNotification() {
    if (this.breakText) {
      this.breakText.destroy();
      this.breakText = undefined;
    }
  }

  private handleBulletEnemyCollision(bullet: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, enemy: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile) {
    const bulletObj = bullet as Phaser.GameObjects.Sprite;
    const enemyObj = enemy as Enemy;

    if (!bulletObj.active || !enemyObj.active) return;

    bulletObj.setActive(false).setVisible(false);
    
    const isDead = enemyObj.takeDamage(1);
    if (isDead) {
      this.score += enemyObj.getScoreValue();
      enemyObj.destroy();
      this.waveManager.onEnemyKilled();
      console.log(`Enemy killed! Wave progress: ${this.waveManager.getWaveProgress().killed}/${this.waveManager.getWaveProgress().total}`);
      this.gameUI.updateScore(this.score);
    }
  }

  private handlePlayerEnemyCollision(player: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, enemy: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile) {
    const enemyObj = enemy as Enemy;
    
    // Award score for enemy collision
    this.score += enemyObj.getScoreValue();
    this.gameUI.updateScore(this.score);
    
    enemyObj.destroy();
    
    // Count this as an enemy killed for wave progression
    this.waveManager.onEnemyKilled();
    console.log(`Enemy destroyed by collision! Wave progress: ${this.waveManager.getWaveProgress().killed}/${this.waveManager.getWaveProgress().total}`);
    
    const isDead = this.player.takeDamage(GAME_SETTINGS.player.damagePerHit);
    this.gameUI.updateHealthBar(this.player.getHealthPercentage());
    
    if (isDead) {
      this.handleGameOver();
    }
  }

  private handleGameOver() {
    this.physics.pause();
    if (this.spawnTimer) this.spawnTimer.paused = true;
    if (this.breakTimer) this.breakTimer.paused = true;
    this.player.setTint(0xff0000);
    this.gameOver = true;
    this.gameUI.showGameOver();
    this.promptScoreEntry();
  }

  private promptScoreEntry() {
    const gameTime = this.getGameTime();
    
    this.time.delayedCall(2000, () => {
      this.scene.start('ScoreEntryScene', { 
        score: this.score, 
        time: gameTime,
        gameMode: 'wave' // Identify this as wave mode
      });
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
      const playerStats = this.upgradeManager.getPlayerStats();
      this.physics.moveTo(bullet, pointer.x, pointer.y, playerStats.bulletSpeed);
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
    const playerStats = this.upgradeManager.getPlayerStats();
    this.reloadingBar.show(playerStats.reloadSpeed);
    
    this.time.delayedCall(playerStats.reloadSpeed, () => {
      this.ammo = playerStats.maxAmmo;
      this.isReloading = false;
      this.gameUI.updateAmmo(this.ammo);
    });
  }

  private updateBullets() {
    if (!this.bullets) return;
    
    for (const bullet of this.bullets.getMatching('active', true)) {
      if (bullet.x < 0 || bullet.x > this.scale.width || bullet.y < 0 || bullet.y > this.scale.height) {
        (bullet as Phaser.GameObjects.Sprite).setActive(false).setVisible(false);
      }
    }
  }

  private updateEnemies() {
    if (!this.enemies) return;
    
    const margin = 100;
    for (const enemy of this.enemies.getMatching('active', true)) {
      const enemySprite = enemy as Enemy;
      if (enemySprite.x < -margin || 
          enemySprite.x > this.scale.width + margin || 
          enemySprite.y < -margin || 
          enemySprite.y > this.scale.height + margin) {
        // Award score for off-screen enemies (they "escaped" but still count)
        this.score += enemySprite.getScoreValue();
        this.gameUI.updateScore(this.score);
        
        // Count off-screen enemies as killed for wave progression
        this.waveManager.onEnemyKilled();
        console.log(`Enemy went off-screen! Wave progress: ${this.waveManager.getWaveProgress().killed}/${this.waveManager.getWaveProgress().total}`);
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

  private resetGame() {
    this.gameOver = false;
    this.score = 0;
    
    // Refresh player stats in case upgrades were purchased
    this.initializePlayerStats();
    
    this.isReloading = false;
    this.gameStartTime = Date.now();
    
    this.player.setPosition(this.scale.width / 2, this.scale.height / 2);
    this.player.reset();
    this.gameUI.reset();
    this.reloadingBar.hide();
    this.waveManager.reset();
    
    this.enemies.clear(true, true);
    this.bullets.clear(true, true);
    
    if (this.spawnTimer) this.spawnTimer.destroy();
    if (this.breakTimer) this.breakTimer.destroy();
    
    this.physics.resume();
    this.startFirstWave();
  }
}