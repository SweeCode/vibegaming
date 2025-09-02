import * as Phaser from 'phaser';
import { IS_DEV } from '../config/gameConfig';
import { GAME_SETTINGS } from '../config/gameConfig';
import { Player } from '../objects/Player';
import { Enemy, EnemySpawner, MiniEnemy, Boss, SentinelBoss, ArtilleryBoss } from '../objects/Enemy';
import { addSnacks, getSnacks } from '../systems/petUpgrades';
import { GameUI } from '../ui/GameUI';
import { ReloadingBar } from '../ui/ReloadingBar';
import { WaveManager } from '../systems/WaveManager';
import { UpgradeManager } from '../systems/UpgradeManager';
import { Drone } from '../objects/Drone';
import { loadPetSettings } from '../systems/petSettings';

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
  private bossBulletOverlap?: Phaser.Physics.Arcade.Collider;
  private bossPlayerCollider?: Phaser.Physics.Arcade.Collider;
  // Prevent multiple damage applications from a single collision/frame
  private bossHitCooldownUntil: number = 0;
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
  // Boss intro UI/timers
  private bossIntroActive: boolean = false;
  private bossIntroText?: Phaser.GameObjects.Text;
  private bossCountdownText?: Phaser.GameObjects.Text;
  private bossIntroTimers: Phaser.Time.TimerEvent[] = [];
  private bossPreviewFlash?: Phaser.GameObjects.Graphics;
  private drone?: Drone;

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
    this.cleanupBoss();
    this.cleanupBossIntro();
    if (this.drone) { this.drone.destroy(); this.drone = undefined; }
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
    if (this.drone) this.drone.update(this.time.now);
    // If boss exists, do not count off-screen enemies toward wave progress
    if (this.boss && this.boss.active) {
      // Ensure boss AI/movement runs
      (this.boss as Boss).update();
    }
    if (this.player) this.player.update();
    if (this.reloadingBar) this.reloadingBar.update();
    // UI indicators
    this.gameUI.setDroneActive(!!this.drone);
    this.gameUI.setShieldActive(this.player?.hasShield?.() === true);
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
    // Add custom properties for pierce/ricochet
    // Type augmentation via casting where used
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
    this.gameUI.updateSnacks(getSnacks());
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
    const settings = this.waveManager.getCurrentWaveSettings();
    if (settings.isBoss) {
      // On all boss waves, show the boss intro instead of the normal wave notification
      this.startBossIntro(settings.bossType || 'sentinel');
    } else {
      this.showWaveNotification();
      this.setupSpawnTimer();
    }
    // Spawn pet drone if skill is enabled
    const mods = this.upgradeManager.getModifiers();
    if (mods.petDrone?.enabled) {
      const settings = loadPetSettings(mods);
      this.drone?.destroy();
      this.drone = new Drone(this, this.player, (x: number, y: number) => this.fireDroneBullet(x, y, settings.damage), settings.fireRateMs);
    }
  }

  private setupSpawnTimer() {
    const waveSettings = this.waveManager.getCurrentWaveSettings();
    if (IS_DEV) console.log(`Setting up spawn timer for wave ${waveSettings.waveNumber}: ${waveSettings.enemyCount} enemies, ${waveSettings.spawnDelay}ms delay`);

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
      if (IS_DEV) console.log('Cannot spawn enemy - wave complete or inactive');
      return;
    }

    const waveSettings = this.waveManager.getCurrentWaveSettings();
    if (IS_DEV) console.log(`Spawning enemy for wave ${waveSettings.waveNumber}`);

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
    if (IS_DEV) console.log(`Wave ${this.waveManager.getCurrentWave()}: Spawned ${waveProgress.spawned}/${waveProgress.total}, Killed ${waveProgress.killed}/${waveProgress.total}, Active: ${activeEnemies}`);

    const bossActive = !!this.boss && this.boss.active;
    if (!bossActive && this.waveManager.isWaveComplete() && activeEnemies === 0) {
      if (IS_DEV) console.log('Wave completed! Starting break...');
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
    if (IS_DEV) console.log('Starting next wave...');
    this.waveManager.endBreak();
    this.waveManager.startWave();
    if (IS_DEV) console.log(`Now on wave ${this.waveManager.getCurrentWave()}`);
    const settings = this.waveManager.getCurrentWaveSettings();
    if (settings.isBoss) {
      // On all boss waves, show the boss intro instead of the normal wave notification
      this.startBossIntro(settings.bossType || 'sentinel');
    } else {
      this.showWaveNotification();
      this.setupSpawnTimer();
    }
    this.hideBreakNotification();
  }

  private startBossIntro(type: 'sentinel' | 'artillery') {
    if (this.bossIntroActive) return;
    this.bossIntroActive = true;
    this.cleanupBossIntro();

    // Compose message
    // Current wave (reserved for future dynamic messaging)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _waveNum = this.waveManager.getCurrentWave();
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const bossName = type === 'artillery' ? 'ARTILLERY' : 'SENTINEL';
    const message = `WARNING: ${bossName} BOSS INCOMING`;

    // Create initial boss preview flash
    this.createBossPreviewFlash(type);
    
    // Start a subtle pulsing effect during the warning
    this.startBossPreviewPulse();

    // Create intro text with typewriter effect
    this.bossIntroText = this.add.text(centerX, centerY - 40, '', {
      fontSize: '36px',
      color: '#ff3366',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    let idx = 0;
    const typeTimer = this.time.addEvent({
      delay: 35,
      loop: true,
      callback: () => {
        if (!this.bossIntroText) return;
        idx++;
        this.bossIntroText.setText(message.substring(0, idx));
        // Occasional light shake during typing
        if (Math.random() < 0.12) this.cameras.main.shake(80, 0.003);
        if (idx >= message.length) {
          typeTimer.remove(false);
          // Start countdown after brief pause
          const delay = this.time.delayedCall(350, () => this.runBossCountdown(type), undefined, this);
          this.bossIntroTimers.push(delay);
        }
      }
    });
    this.bossIntroTimers.push(typeTimer);
  }

  private runBossCountdown(type: 'sentinel' | 'artillery') {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2 + 20;
    this.bossCountdownText = this.add.text(centerX, centerY, '', {
      fontSize: '64px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Create boss spawn preview flash
    this.createBossPreviewFlash(type);

    const numbers = ['3', '2', '1'];
    let i = 0;
    const showNext = () => {
      if (!this.bossCountdownText) return;
      this.bossCountdownText.setScale(0.5).setAlpha(0.0);
      this.bossCountdownText.setText(numbers[i]);
      this.tweens.add({
        targets: this.bossCountdownText,
        alpha: { from: 0, to: 1 },
        scale: { from: 0.5, to: 1.1 },
        duration: 180,
        ease: 'Back.Out'
      });
      this.cameras.main.shake(120, 0.008);
      
      // Flash the boss preview on each countdown number
      this.flashBossPreview();
      
      i++;
      if (i < numbers.length) {
        const t = this.time.delayedCall(420, showNext);
        this.bossIntroTimers.push(t);
      } else {
        const endT = this.time.delayedCall(450, () => {
          this.cleanupBossIntro();
          this.spawnBoss(type);
          this.bossIntroActive = false;
        });
        this.bossIntroTimers.push(endT);
      }
    };
    showNext();
  }

  private createBossPreviewFlash(type: 'sentinel' | 'artillery') {
    // Clean up any existing preview
    if (this.bossPreviewFlash) {
      this.bossPreviewFlash.destroy();
    }

    // Boss spawn location (same as in spawnBoss method)
    const x = this.scale.width / 2;
    const y = this.scale.height / 2 - 150;
    
    // Create preview flash graphics
    this.bossPreviewFlash = this.add.graphics();
    this.bossPreviewFlash.setDepth(999); // Just below the actual boss
    
    // Set color based on boss type
    const color = type === 'artillery' ? 0x33FFAA : 0xFF3366;
    
    // Create a pulsing outline preview
    this.bossPreviewFlash.lineStyle(4, color, 0.8);
    this.bossPreviewFlash.strokeRoundedRect(-36, -36, 72, 72, 8);
    this.bossPreviewFlash.setPosition(x, y);
    this.bossPreviewFlash.setAlpha(0);
  }

  private startBossPreviewPulse() {
    if (!this.bossPreviewFlash) return;
    
    // Start a subtle pulsing effect during the warning phase
    this.bossPreviewFlash.setAlpha(0.3);
    this.tweens.add({
      targets: this.bossPreviewFlash,
      alpha: { from: 0.3, to: 0.7 },
      duration: 800,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1
    });
  }

  private flashBossPreview() {
    if (!this.bossPreviewFlash) return;
    
    // Quick flash effect
    this.bossPreviewFlash.setAlpha(0);
    this.tweens.add({
      targets: this.bossPreviewFlash,
      alpha: { from: 0, to: 0.9 },
      duration: 100,
      ease: 'Power2',
      yoyo: true,
      repeat: 1
    });
  }

  private cleanupBossIntro() {
    for (const t of this.bossIntroTimers) {
      t.remove(false);
    }
    this.bossIntroTimers = [];
    this.bossIntroActive = false;
    if (this.bossIntroText) { this.bossIntroText.destroy(); this.bossIntroText = undefined; }
    if (this.bossCountdownText) { this.bossCountdownText.destroy(); this.bossCountdownText = undefined; }
    if (this.bossPreviewFlash) { this.bossPreviewFlash.destroy(); this.bossPreviewFlash = undefined; }
  }

  private spawnBoss(type: 'sentinel' | 'artillery') {
    this.enemies.clear(true, true);
    if (this.spawnTimer) { this.spawnTimer.destroy(); this.spawnTimer = undefined; }
    this.bossHitCooldownUntil = 0;
    // Ensure any existing boss is fully cleaned before spawning a new one
    this.cleanupBoss();
    
    // Clean up the preview flash before spawning the actual boss
    if (this.bossPreviewFlash) {
      this.bossPreviewFlash.destroy();
      this.bossPreviewFlash = undefined;
    }
    const x = this.scale.width / 2;
    const y = this.scale.height / 2 - 150;
    // Boss constructors already add themselves to the scene and physics
    this.boss = type === 'artillery' ? new ArtilleryBoss(this, x, y, this.player) : new SentinelBoss(this, x, y, this.player);
    this.boss.setActive(true).setVisible(true).setDepth(1000);
    // Ensure boss isn't in enemies group
    if (this.enemies.contains(this.boss as unknown as Phaser.GameObjects.GameObject)) {
      this.enemies.remove(this.boss as unknown as Phaser.GameObjects.GameObject, false, false);
    }
    // Collisions for boss: use overlap for bullets to avoid physics separation side-effects
    // Clean up any previous boss collider first
    this.bossBulletOverlap?.destroy();
    this.bossBulletOverlap = this.physics.add.overlap(
      this.bullets,
      this.boss,
      this.handleBulletBossCollision as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
    this.bossPlayerCollider = this.physics.add.collider(this.player, this.boss, this.handlePlayerBossCollision as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
    // Ensure the boss body is immovable relative to player collision too
    ;(this.boss.body as Phaser.Physics.Arcade.Body).immovable = true
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
    // Bias spawn mix during boss
    const waveSettings = this.waveManager.getCurrentWaveSettings();
    // Temporarily bias to fast/shooter during boss
    const tempSettings = { ...waveSettings, enemyTypes: { ...waveSettings.enemyTypes, normal: 0.2, fast: 0.4, big: 0.15, shooter: 0.25, splitter: 0 } };
    this.enemySpawner.spawnWithWave(tempSettings);
  }

  private handleBulletBossCollision(objA: Phaser.GameObjects.GameObject, objB: Phaser.GameObjects.GameObject) {
    if (!this.boss) return;

    // Normalize arguments so we always treat the bullet correctly even if order varies
    const isObjABullet = !!this.bullets && this.bullets.contains(objA);
    const isObjBBullet = !!this.bullets && this.bullets.contains(objB);

    let bullet = (isObjABullet ? objA : objB) as (Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent });
    let other = (isObjABullet ? objB : objA) as Phaser.GameObjects.Sprite;

    // If neither object is recognized as a bullet (unexpected), fallback by comparing to boss reference
    if (!isObjABullet && !isObjBBullet) {
      if (objA === this.boss) {
        bullet = objB as Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body };
        other = objA as Phaser.GameObjects.Sprite;
      } else if (objB === this.boss) {
        bullet = objA as Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body };
        other = objB as Phaser.GameObjects.Sprite;
      }
    }

    // Ensure we never disable the boss by mistake
    if (other === (this.boss as unknown)) {
      if (!bullet || !bullet.active) return;
      // Deactivate the bullet without disabling its body, to simplify pooling reuse
      const b = bullet as Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent };
      // Clear any lingering TTL from previous uses before deactivating
      if (b.ttlEvent) { b.ttlEvent.remove(false); b.ttlEvent = undefined; }
      if (b.body) {
        b.body.velocity.set(0, 0);
      }
      b.setActive(false).setVisible(false);
    } else {
      // If normalization failed, do not risk disabling a non-bullet object
      return;
    }

    // Guard against multiple boss hits in the same frame/tick
    const now = this.time.now;
    if (now < this.bossHitCooldownUntil) return;
    this.bossHitCooldownUntil = now + 60; // ~1 tick at 60fps

    // Bosses take fixed damage per hit to guarantee multi-hit fights
    const dmg = 1;
    const before = (this.boss as unknown as { getCurrentHealth?: () => number }).getCurrentHealth?.();
    const dead = (this.boss as Boss).takeDamage(dmg);
    const after = (this.boss as unknown as { getCurrentHealth?: () => number }).getCurrentHealth?.();
    if (IS_DEV) console.log('Boss hit', { dmg, before, after, dead });
    this.updateBossHealthUI();
    if (dead) {
      this.score += (this.boss as Boss).getScoreValue();
      // Reward snacks for defeating a boss
      addSnacks(1);
      this.gameUI.updateSnacks(getSnacks());
      this.cleanupBoss();
      this.cameras.main.shake(200, 0.01);
      this.waveManager.startBreak();
      this.showBreakNotification();
      const waveSettings = this.waveManager.getCurrentWaveSettings();
      this.breakTimer = this.time.delayedCall(waveSettings.breakDuration, () => {
        this.startNextWave();
      });
    }
  }

  private cleanupBoss() {
    // Destroy boss-specific colliders
    if (this.bossBulletOverlap) { this.bossBulletOverlap.destroy(); this.bossBulletOverlap = undefined; }
    if (this.bossPlayerCollider) { this.bossPlayerCollider.destroy(); this.bossPlayerCollider = undefined; }
    // Stop boss add spawns
    this.stopBossAdds();
    // Clear any adds still alive
    if (this.enemies) this.enemies.clear(true, true);
    // Remove boss UI
    if (this.bossHealthBar) { this.bossHealthBar.destroy(); this.bossHealthBar = undefined; }
    if (this.bossHealthText) { this.bossHealthText.destroy(); this.bossHealthText = undefined; }
    // Destroy boss instance
    if (this.boss && this.boss.active) {
      (this.boss as Boss).destroy();
    }
    this.boss = undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handlePlayerBossCollision(_: Phaser.GameObjects.GameObject) {
    if (!this.boss) return;
    // Damage player on contact and slight knockback feeling via camera shake
    this.cameras.main.shake(100, 0.006);
    // Scale boss contact damage by wave number to increase lethality later
    const wave = this.waveManager.getCurrentWave();
    const scale = 1 + Math.max(0, wave - 5) * 0.15; // +15% per wave after 5
    const isDead = this.player.takeDamage(Math.floor(GAME_SETTINGS.player.damagePerHit * 2 * scale));
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
    const bulletObj = bullet as Phaser.GameObjects.Sprite & { pierceLeft?: number, bounceLeft?: number };
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

    const b = bulletObj as Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent, pierceLeft?: number, bounceLeft?: number };
    const hadPierce = (b.pierceLeft ?? 0) > 0;
    if (hadPierce) {
      b.pierceLeft = (b.pierceLeft ?? 0) - 1;
      // Keep bullet active; small nudge to continue
      if (b.body) {
        b.body.velocity.scale(1.0);
      }
    } else if ((b.bounceLeft ?? 0) > 0) {
      // Smarter ricochet: retarget nearest enemy
      if (b.body) {
        b.bounceLeft = (b.bounceLeft ?? 0) - 1;
        const target = this.getNearestEnemy(b.x, b.y);
        if (target) {
          const ts = target as Phaser.GameObjects.Sprite;
          const dx = ts.x - b.x;
          const dy = ts.y - b.y;
          const len = Math.hypot(dx, dy) || 1;
          const speed = b.body.velocity.length();
          b.body.velocity.set((dx / len) * speed, (dy / len) * speed);
        } else {
          // Fallback invert with slight jitter
          b.body.velocity.set(-b.body.velocity.x, -b.body.velocity.y);
          b.body.velocity.rotate(Phaser.Math.FloatBetween(-0.2, 0.2));
        }
      }
    } else {
      if (b.ttlEvent) { b.ttlEvent.remove(false); b.ttlEvent = undefined; }
      if (b.body) {
        b.body.velocity.set(0, 0);
      }
      b.setActive(false).setVisible(false);
    }
    const playerStats = this.upgradeManager.getPlayerStats();
    const fromDrone = (bulletObj as unknown as { getData?: (k: string) => unknown }).getData?.('fromDrone') === true;
    const customDroneDmg = (bulletObj as unknown as { getData?: (k: string) => unknown }).getData?.('droneDamage');
    const dmg = fromDrone ? Math.max(1, Math.ceil((typeof customDroneDmg === 'number' ? customDroneDmg : playerStats.bulletDamage * 0.5))) : playerStats.bulletDamage;
    const isDead = enemyObj.takeDamage(dmg);
    if (isDead) {
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
      if (IS_DEV) console.log(`Enemy killed! Wave progress: ${this.waveManager.getWaveProgress().killed}/${this.waveManager.getWaveProgress().total}`);
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
    if (IS_DEV) console.log(`Enemy destroyed by collision! Wave progress: ${this.waveManager.getWaveProgress().killed}/${this.waveManager.getWaveProgress().total}`);

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

    const fromBoss = (bulletSprite as unknown as { getData?: (key: string) => unknown }).getData?.('fromBoss') === true;
    const baseDamage = Math.floor(GAME_SETTINGS.player.maxHealth * GAME_SETTINGS.enemies.shooter.bulletDamagePct);
    if (fromBoss) {
      // Boss bullets do more damage as waves progress
      const wave = this.waveManager.getCurrentWave();
      const scale = 1 + Math.max(0, wave - 5) * 0.1; // +10% per wave after 5
      const isDead = this.player.takeDamage(Math.floor(baseDamage * scale));
      this.gameUI.updateHealthBar(this.player.getHealthPercentage());
      if (isDead) this.handleGameOver();
      return;
    }
    // Regular enemy bullet damage remains static
    const isDead = this.player.takeDamage(baseDamage);
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

    // Compute safe direction (avoid zero-length when clicking on player)
    const dx = pointer.x - this.player.x;
    const dy = pointer.y - this.player.y;
    const len = Math.hypot(dx, dy);
    const dirX = len > 0.0001 ? dx / len : 1;
    const dirY = len > 0.0001 ? dy / len : 0;
    // Spawn slightly in front to avoid overlapping the player hitbox
    const spawnOffset = 18;
    const spawnX = this.player.x + dirX * spawnOffset;
    const spawnY = this.player.y + dirY * spawnOffset;

    const bullet = this.bullets.get(spawnX, spawnY) as (Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent, pierceLeft?: number, bounceLeft?: number }) | null;
    if (bullet) {
      bullet.setActive(true).setVisible(true);
      const playerStats = this.upgradeManager.getPlayerStats();
      // Set velocity directly to ensure consistent launch even for close clicks
      if (bullet.body) {
        bullet.body.velocity.set(dirX * playerStats.bulletSpeed, dirY * playerStats.bulletSpeed);
      } else {
        this.scene.physics.moveTo(bullet as unknown as Phaser.GameObjects.GameObject, spawnX + dirX * 10, spawnY + dirY * 10, playerStats.bulletSpeed);
      }

      // Safety TTL to prevent rare stuck bullets
      bullet.ttlEvent?.remove(false);
      bullet.ttlEvent = this.time.delayedCall(2000, () => {
        if (bullet.active) bullet.setActive(false).setVisible(false);
        bullet.ttlEvent = undefined;
      });

      // Apply pierce/ricochet from skill tree
      const mods = this.upgradeManager.getModifiers();
      bullet.pierceLeft = Math.max(0, mods.pierceCount || 0);
      bullet.bounceLeft = Math.max(0, mods.ricochetBounces || 0);

      this.ammo--;
      this.gameUI.updateAmmo(this.ammo);

      if (this.ammo === 0) {
        this.reload();
      }
    }
  }

  private fireDroneBullet(x: number, y: number, damage: number) {
    const target = this.getNearestEnemy(x, y);
    if (!target) return;
    const dx = (target as Phaser.GameObjects.Sprite).x - x;
    const dy = (target as Phaser.GameObjects.Sprite).y - y;
    const len = Math.hypot(dx, dy) || 1;
    const dirX = dx / len;
    const dirY = dy / len;
    const bullet = this.bullets.get(x, y) as (Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent, pierceLeft?: number, bounceLeft?: number, fromDrone?: boolean }) | null;
    if (!bullet) return;
    bullet.setActive(true).setVisible(true);
    // Tag as drone-origin using Phaser's Data Manager if available
    const asObj = bullet as unknown as { setData?: (k: string, v: unknown) => void }
    if (typeof asObj.setData === 'function') {
      asObj.setData('fromDrone', true)
    }
    if (bullet.body) {
      bullet.body.velocity.set(dirX * 350, dirY * 350);
    }
    bullet.ttlEvent?.remove(false);
    bullet.ttlEvent = this.time.delayedCall(2000, () => {
      if (bullet.active) bullet.setActive(false).setVisible(false);
      bullet.ttlEvent = undefined;
    });
    bullet.pierceLeft = 0;
    bullet.bounceLeft = 0;
    const asObj2 = bullet as unknown as { setData?: (k: string, v: unknown) => void }
    if (typeof asObj2.setData === 'function') {
      asObj2.setData('droneDamage', damage)
    }
  }

  private getNearestEnemy(x: number, y: number): Phaser.GameObjects.GameObject | null {
    if (!this.enemies) return null;
    let best: Phaser.GameObjects.GameObject | null = null;
    let bestDist = Infinity;
    for (const enemy of this.enemies.getMatching('active', true)) {
      const es = enemy as Phaser.GameObjects.Sprite;
      const dx = es.x - x;
      const dy = es.y - y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestDist) { best = es; bestDist = d2; }
    }
    return best;
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
        // During boss waves, do not count off-screen enemies as kills
        if (!this.boss || !this.boss.active) {
          this.score += enemySprite.getScoreValue();
          this.gameUI.updateScore(this.score);
          this.waveManager.onEnemyKilled();
          if (IS_DEV) console.log(`Enemy went off-screen! Wave progress: ${this.waveManager.getWaveProgress().killed}/${this.waveManager.getWaveProgress().total}`);
        }
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
    this.gameUI.updateSnacks(getSnacks());
    this.reloadingBar.hide();
    this.waveManager.reset();

    this.enemies.clear(true, true);
    this.bullets.clear(true, true);
    if (this.drone) { this.drone.destroy(); this.drone = undefined; }
    if (this.spawnTimer) this.spawnTimer.destroy();
    if (this.breakTimer) this.breakTimer.destroy();
    // Clear enemy bullets as well
    if (this['enemyBullets']) {
      const group = (this as unknown as Phaser.Scene & { enemyBullets?: Phaser.Physics.Arcade.Group }).enemyBullets;
      group?.clear(true, true);
    }
    // Fully cleanup any existing boss
    this.cleanupBoss();

    this.physics.resume();
    this.startFirstWave();
  }
}