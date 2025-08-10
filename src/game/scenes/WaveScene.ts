import * as Phaser from 'phaser';
import { GAME_SETTINGS } from '../config/gameConfig';
import { Player } from '../objects/Player';
import { Enemy, EnemySpawner, MiniEnemy, Boss, SentinelBoss, ArtilleryBoss } from '../objects/Enemy';
import { GameUI } from '../ui/GameUI';
import { ReloadingBar } from '../ui/ReloadingBar';
import { WaveManager } from '../systems/WaveManager';
import { UpgradeManager } from '../systems/UpgradeManager';

export class WaveScene extends Phaser.Scene {
  private player!: Player;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemySpawner!: EnemySpawner;
  private gameUI!: GameUI;
  private reloadingBar!: ReloadingBar;
  private waveManager!: WaveManager;
  private upgradeManager!: UpgradeManager;
  private boss?: Boss;
  private bossHealthBar?: Phaser.GameObjects.Graphics;
  private bossHealthText?: Phaser.GameObjects.Text;
  private bossAddTimer?: Phaser.Time.TimerEvent;
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
    if (this.boss && this.boss.active) {
      // Ensure boss AI/movement runs
      (this.boss as Boss).update();
    }
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

    const shooterGraphics = this.make.graphics({ fillStyle: { color: 0xFFA500 } }, false);
    shooterGraphics.fillRect(0, 0, 24, 24);
    shooterGraphics.generateTexture('enemy_shooter', 24, 24);
    shooterGraphics.destroy();

    const splitterGraphics = this.make.graphics({ fillStyle: { color: 0x00FFFF } }, false);
    splitterGraphics.fillRect(0, 0, 28, 28);
    splitterGraphics.generateTexture('enemy_splitter', 28, 28);
    splitterGraphics.destroy();

    const miniGraphics = this.make.graphics({ fillStyle: { color: 0x66FFFF } }, false);
    miniGraphics.fillRect(0, 0, 14, 14);
    miniGraphics.generateTexture('enemy_mini', 14, 14);
    miniGraphics.destroy();

    const enemyBulletG = this.make.graphics(undefined, false);
    enemyBulletG.lineStyle(2, 0xFFFFFF, 1);
    enemyBulletG.fillStyle(0xFF0000, 1);
    enemyBulletG.fillCircle(4, 4, 3);
    enemyBulletG.strokeCircle(4, 4, 4);
    enemyBulletG.generateTexture('enemy_bullet', 8, 8);
    enemyBulletG.destroy();

    const boss1 = this.make.graphics({ fillStyle: { color: 0xFF3366 } }, false);
    boss1.fillRect(0, 0, 72, 72);
    boss1.generateTexture('boss_sentinel', 72, 72);
    boss1.destroy();
    const boss2 = this.make.graphics({ fillStyle: { color: 0x33FFAA } }, false);
    boss2.fillRect(0, 0, 84, 84);
    boss2.generateTexture('boss_artillery', 84, 84);
    boss2.destroy();
  }

  private createPlayer() {
    this.player = new Player(this, this.scale.width / 2, this.scale.height / 2);
  }

  private createBullets() {
    const playerStats = this.upgradeManager.getPlayerStats();
    this.bullets = this.physics.add.group({
      defaultKey: 'bullet',
      maxSize: Math.max(playerStats.maxAmmo, GAME_SETTINGS.weapons.bullet.maxAmmo)
    });
  }

  private createEnemies() {
    this.enemies = this.physics.add.group({
      runChildUpdate: true
    });
    this.enemyBullets = this.physics.add.group({ defaultKey: 'enemy_bullet', maxSize: 200 });
    this.enemySpawner = new EnemySpawner(this, this.enemies, this.player);
  }

  private createUI() {
    this.gameUI = new GameUI(this);
    this.gameUI.updateAmmo(this.ammo);
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
    this.physics.add.overlap(this.player, this.enemyBullets, (playerObj, bulletObj) => this.handlePlayerHitByEnemyBullet(playerObj as Phaser.GameObjects.GameObject, bulletObj as Phaser.GameObjects.GameObject), undefined, this);
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
    const settings = this.waveManager.getCurrentWaveSettings();
    if (settings.isBoss) {
      this.spawnBoss(settings.bossType || 'sentinel');
    } else {
      this.setupSpawnTimer();
    }
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

    const bossActive = !!this.boss && this.boss.active;
    if (!bossActive && this.waveManager.isWaveComplete() && activeEnemies === 0) {
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
    const settings = this.waveManager.getCurrentWaveSettings();
    if (settings.isBoss) {
      this.spawnBoss(settings.bossType || 'sentinel');
    } else {
      this.setupSpawnTimer();
    }
    this.hideBreakNotification();
  }

  private spawnBoss(type: 'sentinel' | 'artillery') {
    this.enemies.clear(true, true);
    if (this.spawnTimer) { this.spawnTimer.destroy(); this.spawnTimer = undefined; }
    const x = this.scale.width / 2;
    const y = this.scale.height / 2 - 150;
    // Boss constructors already add themselves to the scene and physics
    this.boss = type === 'artillery' ? new ArtilleryBoss(this, x, y, this.player) : new SentinelBoss(this, x, y, this.player);
    this.boss.setActive(true).setVisible(true);
    // Collisions for boss
    this.physics.add.collider(this.bullets, this.boss, this.handleBulletBossCollision as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.physics.add.collider(this.player, this.boss, this.handlePlayerBossCollision as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    this.createBossHealthUI();
    this.startBossAdds();
  }

  private createBossHealthUI() {
    this.bossHealthBar?.destroy();
    this.bossHealthText?.destroy();
    this.bossHealthBar = this.add.graphics();
    const centerX = this.scale.width / 2;
    const topY = 30;
    this.bossHealthText = this.add.text(centerX, topY - 16, 'BOSS', { fontSize: '18px', color: '#ff3366', fontStyle: 'bold' }).setOrigin(0.5);
    const draw = () => {
      if (!this.boss || !this.bossHealthBar) return;
      const pct = (this.boss as Boss).getHealthPct();
      const w = 420, h = 16;
      this.bossHealthBar.clear();
      this.bossHealthBar.fillStyle(0x222222, 0.9).fillRoundedRect(centerX - w/2, topY, w, h, 8);
      this.bossHealthBar.fillStyle(0xff3366, 1).fillRoundedRect(centerX - w/2, topY, w * pct, h, 8);
      this.bossHealthBar.lineStyle(2, 0xffffff, 1).strokeRoundedRect(centerX - w/2, topY, w, h, 8);
    };
    draw();
  }

  private updateBossHealthUI() {
    if (!this.boss || !this.bossHealthBar) return;
    const centerX = this.scale.width / 2;
    const topY = 30;
    const pct = (this.boss as Boss).getHealthPct();
    const w = 420, h = 16;
    this.bossHealthBar.clear();
    this.bossHealthBar.fillStyle(0x222222, 0.9).fillRoundedRect(centerX - w/2, topY, w, h, 8);
    this.bossHealthBar.fillStyle(0xff3366, 1).fillRoundedRect(centerX - w/2, topY, w * pct, h, 8);
    this.bossHealthBar.lineStyle(2, 0xffffff, 1).strokeRoundedRect(centerX - w/2, topY, w, h, 8);
  }

  private startBossAdds() {
    this.stopBossAdds();
    this.bossAddTimer = this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => this.spawnBossAdd()
    });
  }

  private stopBossAdds() {
    if (this.bossAddTimer) {
      this.bossAddTimer.remove();
      this.bossAddTimer = undefined;
    }
  }

  private spawnBossAdd() {
    if (!this.boss || !this.boss.active) return;
    const r = Math.random();
    const waveSettings = this.waveManager.getCurrentWaveSettings();
    // Temporarily bias to fast/shooter during boss
    const tempSettings = { ...waveSettings, enemyTypes: { ...waveSettings.enemyTypes, normal: 0.2, fast: 0.4, big: 0.15, shooter: 0.25, splitter: 0 } };
    this.enemySpawner.spawnWithWave(tempSettings);
  }

  private handleBulletBossCollision(bulletObj: Phaser.GameObjects.GameObject, _bossObj: Phaser.GameObjects.GameObject) {
    const bullet = bulletObj as Phaser.GameObjects.Sprite;
    if (!bullet.active || !this.boss) return;
    bullet.setActive(false).setVisible(false);
    const dmg = this.upgradeManager.getPlayerStats().bulletDamage;
    const dead = (this.boss as Boss).takeDamage(dmg);
    this.updateBossHealthUI();
    if (dead) {
      this.score += (this.boss as Boss).getScoreValue();
      (this.boss as Boss).destroy();
      this.boss = undefined;
      this.bossHealthBar?.destroy(); this.bossHealthBar = undefined;
      this.bossHealthText?.destroy(); this.bossHealthText = undefined;
      this.stopBossAdds();
      // Camera shake for dramatic finish
      this.cameras.main.shake(200, 0.01);
      // Begin break
      this.waveManager.startBreak();
      this.showBreakNotification();
      const waveSettings = this.waveManager.getCurrentWaveSettings();
      this.breakTimer = this.time.delayedCall(waveSettings.breakDuration, () => {
        this.startNextWave();
      });
    }
  }

  private handlePlayerBossCollision(_playerObj: Phaser.GameObjects.GameObject) {
    if (!this.boss) return;
    // Damage player on contact and slight knockback feeling via camera shake
    this.cameras.main.shake(100, 0.006);
    const isDead = this.player.takeDamage(GAME_SETTINGS.player.damagePerHit * 2);
    this.gameUI.updateHealthBar(this.player.getHealthPercentage());
    if (isDead) this.handleGameOver();
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

    // If a boss is present and this bullet also overlaps the boss, route to boss handler
    if (this.boss && this.boss.active) {
      const bossSprite = this.boss as unknown as Phaser.GameObjects.Sprite;
      if (Phaser.Geom.Intersects.RectangleToRectangle(bulletObj.getBounds(), bossSprite.getBounds())) {
        this.handleBulletBossCollision(bulletObj, bossSprite);
        return;
      }
    }

    bulletObj.setActive(false).setVisible(false);
    
    const playerStats = this.upgradeManager.getPlayerStats();
    let deadProcessed = false;
    // Boss hit?
    if (this.boss && (enemy as unknown) === (this.boss.body as unknown)) {
      const sprite = this.boss as Boss;
      const bossDead = sprite.takeDamage(playerStats.bulletDamage);
      if (this.bossHealthBar) { this.bossHealthBar.clear(); }
      if (bossDead) {
        this.score += sprite.getScoreValue();
        sprite.destroy();
        this.boss = undefined;
        this.bossHealthBar?.destroy(); this.bossHealthBar = undefined;
        this.bossHealthText?.destroy(); this.bossHealthText = undefined;
        deadProcessed = true;
        // Start break immediately
        this.waveManager.startBreak();
        this.showBreakNotification();
        const waveSettings = this.waveManager.getCurrentWaveSettings();
        this.breakTimer = this.time.delayedCall(waveSettings.breakDuration, () => {
          this.startNextWave();
        });
      }
    } else {
      const isDead = enemyObj.takeDamage(playerStats.bulletDamage);
      if (isDead) {
        deadProcessed = true;
        this.score += enemyObj.getScoreValue();
        const isSplitter = (enemyObj as unknown as Phaser.GameObjects.Sprite).texture?.key === 'enemy_splitter';
        const spawnMinis = isSplitter ? GAME_SETTINGS.enemies.splitter.minisOnSplit : 0;
        const ex = (enemyObj as Phaser.GameObjects.Sprite).x;
        const ey = (enemyObj as Phaser.GameObjects.Sprite).y;
        enemyObj.destroy();
        if (isSplitter && this.enemies) {
          for (let i = 0; i < spawnMinis; i++) {
            const angle = (Math.PI * 2 * i) / spawnMinis + Math.random() * 0.5;
            const offset = 10;
            const mini = new MiniEnemy(this, ex + Math.cos(angle) * offset, ey + Math.sin(angle) * offset, this.player);
            this.enemies.add(mini);
          }
        }
        this.waveManager.onEnemyKilled();
        console.log(`Enemy killed! Wave progress: ${this.waveManager.getWaveProgress().killed}/${this.waveManager.getWaveProgress().total}`);
        this.gameUI.updateScore(this.score);
      }
    }
    if (deadProcessed) {
      this.score += enemyObj.getScoreValue();
      this.gameUI.updateScore(this.score);
    }
  }

  private handlePlayerEnemyCollision(player: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, enemy: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile) {
    const enemyObj = enemy as Enemy;
    
    // Award score for enemy collision
    this.score += enemyObj.getScoreValue();
    this.gameUI.updateScore(this.score);
    
    // Splitter behavior on collision
    const isSplitter = (enemyObj as unknown as Phaser.GameObjects.Sprite).texture?.key === 'enemy_splitter';
    const spawnMinis = isSplitter ? GAME_SETTINGS.enemies.splitter.minisOnSplit : 0;
    const ex = (enemyObj as Phaser.GameObjects.Sprite).x;
    const ey = (enemyObj as Phaser.GameObjects.Sprite).y;
    enemyObj.destroy();
    if (isSplitter && this.enemies) {
      for (let i = 0; i < spawnMinis; i++) {
        const angle = (Math.PI * 2 * i) / spawnMinis + Math.random() * 0.5;
        const offset = 10;
        const mini = new MiniEnemy(this, ex + Math.cos(angle) * offset, ey + Math.sin(angle) * offset, this.player);
        this.enemies.add(mini);
      }
    }
    
    // Count this as an enemy killed for wave progression
    this.waveManager.onEnemyKilled();
    console.log(`Enemy destroyed by collision! Wave progress: ${this.waveManager.getWaveProgress().killed}/${this.waveManager.getWaveProgress().total}`);
    
    const isDead = this.player.takeDamage(GAME_SETTINGS.player.damagePerHit);
    this.gameUI.updateHealthBar(this.player.getHealthPercentage());
    
    if (isDead) {
      this.handleGameOver();
    }
  }

  private handlePlayerHitByEnemyBullet(player: Phaser.GameObjects.GameObject, bullet: Phaser.GameObjects.GameObject) {
    const bulletSprite = bullet as Phaser.GameObjects.Sprite;
    if (!bulletSprite.active) return;
    bulletSprite.setActive(false).setVisible(false);

    const damage = Math.floor(GAME_SETTINGS.player.maxHealth * GAME_SETTINGS.enemies.shooter.bulletDamagePct);
    const isDead = this.player.takeDamage(damage);
    this.gameUI.updateHealthBar(this.player.getHealthPercentage());
    if (isDead) this.handleGameOver();
  }

  private handleGameOver() {
    this.physics.pause();
    if (this.spawnTimer) this.spawnTimer.paused = true;
    if (this.breakTimer) this.breakTimer.paused = true;
    this.player.setTint(0xff0000);
    this.gameOver = true;
    this.gameUI.showGameOver(
      () => this.resetGame(),
      () => this.scene.start('StartMenuScene'),
      () => this.scene.start('ScoreEntryScene', { score: this.score, time: this.getGameTime(), gameMode: 'wave' })
    );
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
        this.score += enemySprite.getScoreValue();
        this.gameUI.updateScore(this.score);
        this.waveManager.onEnemyKilled();
        console.log(`Enemy went off-screen! Wave progress: ${this.waveManager.getWaveProgress().killed}/${this.waveManager.getWaveProgress().total}`);
        enemySprite.destroy();
      }
    }

    if (this['enemyBullets']) {
      const group = (this as unknown as Phaser.Scene & { enemyBullets?: Phaser.Physics.Arcade.Group }).enemyBullets;
      if (group) {
        for (const b of group.getMatching('active', true)) {
          const bs = b as Phaser.GameObjects.Sprite;
          if (bs.x < -16 || bs.x > this.scale.width + 16 || bs.y < -16 || bs.y > this.scale.height + 16) {
            bs.setActive(false).setVisible(false);
          }
        }
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
