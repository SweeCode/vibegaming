import * as Phaser from 'phaser';
import { IS_DEV } from '../config/gameConfig';
import { GAME_SETTINGS } from '../config/gameConfig';
import { Player } from '../objects/Player';
import { Enemy, EnemySpawner, MiniEnemy, Boss, SentinelBoss, ArtilleryBoss } from '../objects/Enemy';
import { addSnacks, getSnacks } from '../systems/petUpgrades';
import { getBulletSpeedMultiplier, getBulletSizeMultiplier } from '../systems/petUpgrades';
import { GameUI } from '../ui/GameUI';
import { ReloadingBar } from '../ui/ReloadingBar';
import { WaveManager } from '../systems/WaveManager';
import { UpgradeManager, type PlayerStats } from '../systems/UpgradeManager';
import { ScoreManager } from '../systems/ScoreManager';
import { Drone } from '../objects/Drone';
import { loadPetSettings } from '../systems/petSettings';
import { ensureGuestSessionInitialized, recordCurrentHealth, recordLastWorldVisited, recordSpawnPosition } from '@/lib/guestSession';
import { getPlayerColor } from '../systems/playerAppearance';
import { ArenaBackground, ArenaTheme } from '../objects/ArenaBackground';

type BossPillar = Phaser.GameObjects.Rectangle & {
  pillarBody?: Phaser.Physics.Arcade.StaticBody;
};

const BOSS_PILLAR_MAX_HP = 10;

interface WaveController {
  getCurrentWave(): number;
  getCurrentWaveSettings(): WaveSettings;
  startWave(): void;
  onEnemySpawned(): void;
  onEnemyKilled(): void;
  canSpawnEnemy(): boolean;
  isWaveComplete(): boolean;
  startBreak(): void;
  endBreak(): void;
  isOnBreak(): boolean;
  getWaveProgress(): { spawned: number; killed: number; total: number };
  reset(): void;
}

class BossOnlyWaveManager implements WaveController {
  private currentWave = 1;
  private breakTime = false;

  getCurrentWave(): number {
    return this.currentWave;
  }

  getCurrentWaveSettings(): WaveSettings {
    const waveNumber = this.currentWave;
    const bossType: 'sentinel' | 'artillery' = waveNumber % 2 === 1 ? 'sentinel' : 'artillery';
    return {
      waveNumber,
      title: `Boss ${waveNumber}`,
      enemyCount: 0,
      spawnDelay: 0,
      enemyTypes: { normal: 0, fast: 0, big: 0, shooter: 0, splitter: 0 },
      breakDuration: 1500,
      isBoss: true,
      bossType
    };
  }

  startWave(): void {
    this.breakTime = false;
  }

  onEnemySpawned(): void {}

  onEnemyKilled(): void {}

  canSpawnEnemy(): boolean {
    return false;
  }

  isWaveComplete(): boolean {
    return false;
  }

  startBreak(): void {
    this.breakTime = true;
  }

  endBreak(): void {
    this.breakTime = false;
    this.currentWave++;
  }

  isOnBreak(): boolean {
    return this.breakTime;
  }

  getWaveProgress(): { spawned: number; killed: number; total: number } {
    return { spawned: 0, killed: 0, total: 0 };
  }

  reset(): void {
    this.currentWave = 1;
    this.breakTime = false;
  }
}

export class WaveScene extends Phaser.Scene {
  private player!: Player;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemySpawner!: EnemySpawner;
  private gameUI!: GameUI;
  private reloadingBar!: ReloadingBar;
  private waveManager!: WaveController;
  private upgradeManager!: UpgradeManager;
  private scoreManager!: ScoreManager;
  private boss?: Boss;
  private boss2?: Boss; // optional second boss for challenge boss rush
  private bossHealthBar?: Phaser.GameObjects.Graphics;
  private bossHealthText?: Phaser.GameObjects.Text;
  private bossAddTimer?: Phaser.Time.TimerEvent;
  private bossBulletOverlap?: Phaser.Physics.Arcade.Collider;
  private bossBulletOverlap2?: Phaser.Physics.Arcade.Collider;
  private bossPlayerCollider?: Phaser.Physics.Arcade.Collider;
  private bossPlayerCollider2?: Phaser.Physics.Arcade.Collider;
  private bossPillars: BossPillar[] = [];
  private pillarPlayerCollider?: Phaser.Physics.Arcade.Collider;
  private pillarBulletCollider?: Phaser.Physics.Arcade.Collider;
  private bossPillarHp: Map<BossPillar, number> = new Map();
  // Prevent multiple damage applications from a single collision/frame
  private bossHitCooldownUntil: number = 0;
  private score = 0;
  private currentWaveScore = 0; // Score earned in current wave
  private waveStartTime: number = 0; // When current wave started
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
  private arenaBackground?: ArenaBackground;
  private bossOnlyMode = false;
  private challengeBossRush = false; // spawn both bosses at once
  private challengeDisablePet = false;
  private forcedStats?: Partial<PlayerStats>;

  constructor() {
    super({ key: 'WaveScene' });
  }

  init(data?: { bossOnly?: boolean, challengeBossRush?: boolean, disablePet?: boolean, forcedStats?: Partial<PlayerStats>, challengeMode?: boolean, challengeId?: 'boss_rush' | 'split_attention' | 'glass_cannon' | 'speed_demon' }) {
    this.bossOnlyMode = !!data?.bossOnly;
    this.challengeBossRush = !!data?.challengeBossRush;
    this.challengeDisablePet = !!data?.disablePet;
    this.forcedStats = data?.forcedStats;
    // store challenge metadata on scene for completion message
    (this as unknown as { _challengeMode?: boolean })._challengeMode = !!data?.challengeMode;
    (this as unknown as { _challengeId?: string })._challengeId = data?.challengeId;
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
    if (this.arenaBackground) { this.arenaBackground.destroy(); this.arenaBackground = undefined; }
  }

  preload() {
    this.createTextures();
  }

  create() {
    this.gameStartTime = Date.now();
    this.upgradeManager = new UpgradeManager();
    this.scoreManager = new ScoreManager();
    void ensureGuestSessionInitialized({ lastWorldVisited: 'wave-mode' });
    this.initializePlayerStats();
    this.createArenaBackground();
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

  private createArenaBackground() {
    this.arenaBackground?.destroy();
    this.arenaBackground = new ArenaBackground(this);
    this.setDefaultArenaTheme();
  }

  private setDefaultArenaTheme() {
    this.arenaBackground?.setTheme('space');
  }

  private setArenaThemeForBoss(type: 'sentinel' | 'artillery') {
    const nextTheme: ArenaTheme = type === 'artillery' ? 'prison' : 'hell';
    this.arenaBackground?.setTheme(nextTheme);
  }

  update(_: number, delta: number) {
    if (this.arenaBackground) this.arenaBackground.update(delta);
    if (this.gameOver) return;

    this.updateBullets();
    this.updateEnemies();
    if (this.drone) this.drone.update(this.time.now);
    // If boss exists, do not count off-screen enemies toward wave progress
    if (this.boss && this.boss.active) {
      // Ensure boss AI/movement runs
      (this.boss as Boss).update();
    }
    if (this.boss2 && this.boss2.active) {
      (this.boss2 as Boss).update();
    }
    if (this.player) this.player.update();
    if (this.reloadingBar) this.reloadingBar.update();
    // UI indicators
    this.gameUI.setDroneActive(!!this.drone);
    this.gameUI.setShieldActive(false); // Shield functionality not implemented yet
    this.updateTimer();
    this.updateWaveSystem();
  }

  private createTextures() {
    const playerColor = getPlayerColor();
    const playerGraphics = this.make.graphics({ fillStyle: { color: playerColor } }, false);
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
    this.player = new Player(this, this.scale.width / 2, this.scale.height / 2, { forcedStats: this.forcedStats });
    recordLastWorldVisited('wave-mode');
    recordSpawnPosition({ x: this.player.x, y: this.player.y, scene: 'wave-mode' });
    recordCurrentHealth(this.player.getHealth());
    // Ensure saved tint is applied
    const color = getPlayerColor();
    if (typeof color === 'number') {
      this.player.setTint(color);
    }
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
    this.gameUI.updateScore(this.scoreManager.getTotalScore());
  }

  private createReloadingBar() {
    this.reloadingBar = new ReloadingBar(this, this.player);
  }

  private createWaveManager() {
    this.waveManager = this.bossOnlyMode ? new BossOnlyWaveManager() : new WaveManager();
    // Update progress display now that wave manager is initialized
    this.updateProgressDisplay();
  }

  private setupCollisions() {
    this.physics.add.collider(this.bullets, this.enemies, this.handleBulletEnemyCollision, undefined, this);
    this.physics.add.collider(this.player, this.enemies, this.handlePlayerEnemyCollision, undefined, this);
    this.physics.add.overlap(this.player, this.enemyBullets, (playerObj, bulletObj) => this.handlePlayerHitByEnemyBullet(playerObj as Phaser.GameObjects.GameObject, bulletObj as Phaser.GameObjects.GameObject), undefined, this);
  }

  private createBossPillars() {
    this.destroyBossPillars();
    const w = this.scale.width;
    const h = this.scale.height;
    const baseWidth = 28;
    const baseHeight = 120;
    const pillarWidth = Math.round(baseWidth * 1.2);
    const pillarHeight = Math.round(baseHeight * 2);
    const halfWidth = pillarWidth / 2;
    const halfHeight = pillarHeight / 2;
    const marginX = Math.ceil(halfWidth + 40);
    const marginY = Math.ceil(halfHeight + 40);
    const minDistance = Math.max(pillarHeight, pillarWidth) * 1.2;
    const minDistanceSq = minDistance * minDistance;

    const generatePos = (): { x: number; y: number } => ({
      x: Phaser.Math.Between(marginX, Math.max(marginX, w - marginX)),
      y: Phaser.Math.Between(marginY, Math.max(marginY, h - marginY))
    });

    const isTooClose = (a: { x: number; y: number }, b: { x: number; y: number }): boolean => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return dx * dx + dy * dy < minDistanceSq;
    };

    const avoidPlayer = (p: { x: number; y: number }) => {
      const dx = p.x - this.player.x;
      const dy = p.y - this.player.y;
      return dx * dx + dy * dy < 220 * 220;
    };

    // Pick two positions with retries
    let p1 = generatePos();
    let attempts = 0;
    while ((avoidPlayer(p1) || p1.x <= marginX || p1.x >= w - marginX) && attempts++ < 30) p1 = generatePos();
    let p2 = generatePos();
    attempts = 0;
    while ((isTooClose(p1, p2) || avoidPlayer(p2)) && attempts++ < 40) p2 = generatePos();

    const makePillar = (pos: { x: number; y: number }): BossPillar => {
      const rect = this.add.rectangle(pos.x, pos.y, pillarWidth, pillarHeight, 0xffffff, 0.18)
        .setStrokeStyle(2, 0xffffff, 0.55)
        .setDepth(500)
        .setScrollFactor(0) as BossPillar;
      this.physics.add.existing(rect, true);
      rect.pillarBody = rect.body as Phaser.Physics.Arcade.StaticBody;
      if (rect.pillarBody) {
        (rect.pillarBody as unknown as { bossPillar?: BossPillar }).bossPillar = rect;
      }
      rect.setAngle(Phaser.Math.FloatBetween(-6, 6));
      rect.pillarBody.updateFromGameObject();
      this.bossPillarHp.set(rect, BOSS_PILLAR_MAX_HP);
      this.updateBossPillarVisual(rect);
      return rect;
    };

    const r1 = makePillar(p1);
    const r2 = makePillar(p2);
    this.bossPillars = [r1, r2];
    this.setupBossPillarColliders();

    // Boss bullets must pass through pillars: no collider/overlap registered for enemyBullets vs pillars
  }

  private destroyBossPillars() {
    while (this.bossPillars.length > 0) {
      this.removeBossPillar(this.bossPillars[0]);
    }
    this.bossPillarHp.clear();
    this.setupBossPillarColliders();
  }

  private updateBossPillarVisual(pillar: BossPillar) {
    const hp = this.bossPillarHp.get(pillar) ?? BOSS_PILLAR_MAX_HP;
    const ratio = Phaser.Math.Clamp(hp / BOSS_PILLAR_MAX_HP, 0, 1);
    pillar.setAlpha(0.14 + 0.26 * ratio);
    pillar.setStrokeStyle(2, 0xffffff, 0.25 + 0.5 * ratio);
  }

  private damageBossPillar(pillar: BossPillar, bulletSprite: Phaser.GameObjects.Sprite & { getData?: (key: string) => unknown }) {
    if (!pillar.scene) return;
    // Collisions can fire before bookkeeping finishes initializing, so fall back to full HP
    const existingHp = this.bossPillarHp.get(pillar);
    const currentHp = existingHp ?? BOSS_PILLAR_MAX_HP;
    if (currentHp <= 0) return;
    const updatedHp = Math.max(0, currentHp - 1);
    this.bossPillarHp.set(pillar, updatedHp);
    if (updatedHp <= 0) {
      const breakX = pillar.x;
      const breakY = pillar.y;
      this.removeBossPillar(pillar);
      this.spawnPillarBreakEffect(breakX, breakY);
    } else {
      this.updateBossPillarVisual(pillar);
    }
  }

  private spawnPillarBreakEffect(x: number, y: number) {
    const flash = this.add.circle(x, y, 12, 0xffffff, 0.5).setDepth(600).setScrollFactor(0);
    this.tweens.add({
      targets: flash,
      radius: { from: 12, to: 48 },
      alpha: { from: 0.5, to: 0 },
      duration: 180,
      onComplete: () => flash.destroy()
    });
  }

  private removeBossPillar(pillar: BossPillar) {
    const index = this.bossPillars.indexOf(pillar);
    if (index !== -1) {
      this.bossPillars.splice(index, 1);
    }
    if (pillar.active) pillar.setActive(false);
    if (pillar.visible) pillar.setVisible(false);
    if (pillar.pillarBody) {
      pillar.pillarBody.destroy();
      pillar.pillarBody = undefined;
    }
    pillar.destroy();
    this.bossPillarHp.delete(pillar);
    this.setupBossPillarColliders();
  }

  private getPlayerBulletDamage(bulletSprite: Phaser.GameObjects.Sprite & { getData?: (key: string) => unknown }): number {
    const playerStats = this.upgradeManager.getPlayerStats();
    const fromDrone = bulletSprite.getData?.('fromDrone') === true;
    const customDroneDmg = bulletSprite.getData?.('droneDamage');
    if (fromDrone) {
      const base = typeof customDroneDmg === 'number' ? customDroneDmg : playerStats.bulletDamage * 0.5;
      return Math.max(1, Math.ceil(base));
    }
    return Math.max(1, Math.ceil(playerStats.bulletDamage));
  }

  private resolveBossPillar(target: Phaser.GameObjects.GameObject | Phaser.Physics.Arcade.StaticBody | undefined): BossPillar | undefined {
    if (!target) return undefined;
    if (target instanceof Phaser.GameObjects.Rectangle) {
      return target as BossPillar;
    }
    const body = target as Phaser.Physics.Arcade.StaticBody & { gameObject?: Phaser.GameObjects.GameObject; bossPillar?: BossPillar };
    if (body.bossPillar) return body.bossPillar;
    const go = body.gameObject;
    if (go instanceof Phaser.GameObjects.Rectangle) {
      return go as BossPillar;
    }
    return undefined;
  }

  private setupBossPillarColliders() {
    this.pillarPlayerCollider?.destroy();
    this.pillarPlayerCollider = undefined;
    this.pillarBulletCollider?.destroy();
    this.pillarBulletCollider = undefined;

    if (!this.bossPillars.length) return;

    this.pillarPlayerCollider = this.physics.add.collider(this.player, this.bossPillars);
    this.pillarBulletCollider = this.physics.add.collider(
      this.bullets,
      this.bossPillars,
      this.handlePillarBulletCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
  }

  private handlePillarBulletCollision(bulletObj: Phaser.GameObjects.GameObject, target: Phaser.GameObjects.GameObject | Phaser.Physics.Arcade.StaticBody) {
    const bulletSprite = bulletObj as Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent };
    const pillar = this.resolveBossPillar(target);
    if (!pillar || !bulletSprite.active) return;
    if (bulletSprite.ttlEvent) { bulletSprite.ttlEvent.remove(false); bulletSprite.ttlEvent = undefined; }
    if (bulletSprite.body) bulletSprite.body.velocity.set(0, 0);
    bulletSprite.setActive(false).setVisible(false);
    (this.bullets as Phaser.Physics.Arcade.Group).killAndHide(bulletSprite);
    if (bulletSprite.body) {
      bulletSprite.body.enable = false;
    }
    this.damageBossPillar(pillar, bulletSprite);
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
    this.currentWaveScore = 0; // Reset current wave score
    this.waveStartTime = Date.now();
    const settings = this.waveManager.getCurrentWaveSettings();
    if (settings.isBoss) {
      if (this.challengeBossRush) {
        // Custom challenge intro instead of standard boss intro
        this.setArenaThemeForBoss('sentinel');
        this.startChallengeBossRushIntro();
      } else {
        this.setArenaThemeForBoss(settings.bossType || 'sentinel');
        this.startBossIntro(settings.bossType || 'sentinel');
      }
    } else {
      this.setDefaultArenaTheme();
      this.showWaveNotification();
      this.setupSpawnTimer();
    }
    // Spawn pet drone if skill is enabled
    const mods = this.upgradeManager.getModifiers();
    if (!this.challengeDisablePet && mods.petDrone?.enabled) {
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
      // Complete the wave and calculate final score
      this.completeCurrentWave();
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
    this.currentWaveScore = 0; // Reset current wave score
    this.waveStartTime = Date.now();
    if (IS_DEV) console.log(`Now on wave ${this.waveManager.getCurrentWave()}`);
    const settings = this.waveManager.getCurrentWaveSettings();
    if (settings.isBoss) {
      if (this.challengeBossRush) {
        this.setArenaThemeForBoss('sentinel');
        this.startChallengeBossRushIntro();
      } else {
        this.setArenaThemeForBoss(settings.bossType || 'sentinel');
        this.startBossIntro(settings.bossType || 'sentinel');
      }
    } else {
      this.setDefaultArenaTheme();
      this.showWaveNotification();
      this.setupSpawnTimer();
    }
    // Ensure any lingering pillars are removed when not in boss state
    if (!settings.isBoss) this.destroyBossPillars();
    this.hideBreakNotification();
  }

  private startChallengeBossRushIntro() {
    if (this.bossIntroActive) return;
    this.bossIntroActive = true;
    this.cleanupBossIntro();
    this.setArenaThemeForBoss('sentinel');

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const title = this.add.text(centerX, centerY - 40, 'CHALLENGE: BOSS RUSH', {
      fontSize: '40px', color: '#00ffaa', fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0);
    const subtitle = this.add.text(centerX, centerY + 10, 'Two bosses at once. No mercy.', {
      fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: title, alpha: { from: 0, to: 1 }, scale: { from: 0.9, to: 1.02 }, duration: 400, ease: 'Back.Out' });
    this.tweens.add({ targets: subtitle, alpha: { from: 0, to: 1 }, y: centerY + 20, duration: 450, delay: 150 });
    this.cameras.main.flash(250, 255, 64, 64);
    this.cameras.main.shake(220, 0.006);

    // Show boss silhouettes immediately at spawn positions
    const x = this.scale.width / 2;
    const y = this.scale.height / 2 - 150;
    const silLeft = this.add.image(x - 90, y, 'boss_sentinel').setAlpha(0).setTint(0x000000).setDepth(999);
    const silRight = this.add.image(x + 90, y, 'boss_artillery').setAlpha(0).setTint(0x000000).setDepth(999);
    this.tweens.add({ targets: [silLeft, silRight], alpha: { from: 0, to: 0.75 }, duration: 450, ease: 'Sine.Out' });
    // Gentle pulse during intro
    const pulse = this.tweens.add({ targets: [silLeft, silRight], alpha: { from: 0.6, to: 0.85 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 500 });

    // Hold intro for ~2.4s before spawning bosses
    const t = this.time.delayedCall(2400, () => {
      title.destroy();
      subtitle.destroy();
      pulse.stop();
      silLeft.destroy();
      silRight.destroy();
      this.cleanupBossIntro();
      this.spawnBoss('sentinel'); // will spawn both when challengeBossRush is true
      this.bossIntroActive = false;
    });
    this.bossIntroTimers.push(t);
  }

  private startBossIntro(type: 'sentinel' | 'artillery') {
    if (this.bossIntroActive) return;
    this.bossIntroActive = true;
    this.cleanupBossIntro();
    this.setArenaThemeForBoss(type);

    // Compose message
    const waveNum = this.waveManager.getCurrentWave();
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
    this.setArenaThemeForBoss(type);
    
    // Clean up the preview flash before spawning the actual boss
    if (this.bossPreviewFlash) {
      this.bossPreviewFlash.destroy();
      this.bossPreviewFlash = undefined;
    }
    const x = this.scale.width / 2;
    const y = this.scale.height / 2 - 150;
    // Boss constructors already add themselves to the scene and physics
    if (this.challengeBossRush) {
      // Spawn both bosses at once
      this.boss = new SentinelBoss(this, x - 90, y, this.player);
      this.boss2 = new ArtilleryBoss(this, x + 90, y, this.player);
      this.boss.setActive(true).setVisible(true).setDepth(1000);
      this.boss2.setActive(true).setVisible(true).setDepth(1000);
      // Ensure neither boss is in enemies group
      if (this.enemies.contains(this.boss as unknown as Phaser.GameObjects.GameObject)) this.enemies.remove(this.boss as unknown as Phaser.GameObjects.GameObject, false, false);
      if (this.enemies.contains(this.boss2 as unknown as Phaser.GameObjects.GameObject)) this.enemies.remove(this.boss2 as unknown as Phaser.GameObjects.GameObject, false, false);
      // Overlaps for bullets
      this.bossBulletOverlap?.destroy();
      this.bossBulletOverlap2?.destroy();
      this.bossBulletOverlap = this.physics.add.overlap(
        this.bullets,
        this.boss,
        this.handleBulletBossCollision as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
        undefined,
        this
      );
      this.bossBulletOverlap2 = this.physics.add.overlap(
        this.bullets,
        this.boss2,
        this.handleBulletBossCollision as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
        undefined,
        this
      );
      // Player collisions
      this.bossPlayerCollider = this.physics.add.collider(this.player, this.boss, this.handlePlayerBossCollision as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
      this.bossPlayerCollider2 = this.physics.add.collider(this.player, this.boss2, this.handlePlayerBossCollision as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
      ;(this.boss.body as Phaser.Physics.Arcade.Body).immovable = true
      ;(this.boss2.body as Phaser.Physics.Arcade.Body).immovable = true
      // Pillars, UI, adds
      this.createBossPillars();
      this.createBossHealthUI();
      this.startBossAdds();
    } else {
      this.boss = type === 'artillery' ? new ArtilleryBoss(this, x, y, this.player) : new SentinelBoss(this, x, y, this.player);
      this.boss.setActive(true).setVisible(true).setDepth(1000);
      if (this.enemies.contains(this.boss as unknown as Phaser.GameObjects.GameObject)) {
        this.enemies.remove(this.boss as unknown as Phaser.GameObjects.GameObject, false, false);
      }
      this.bossBulletOverlap?.destroy();
      this.bossBulletOverlap = this.physics.add.overlap(
        this.bullets,
        this.boss,
        this.handleBulletBossCollision as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
        undefined,
        this
      );
      this.bossPlayerCollider = this.physics.add.collider(this.player, this.boss, this.handlePlayerBossCollision as unknown as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
      ;(this.boss.body as Phaser.Physics.Arcade.Body).immovable = true
      this.createBossPillars();
      this.createBossHealthUI();
      this.startBossAdds();
    }
  }

  private createBossHealthUI() {
    // Clear existing
    this.bossHealthBar?.destroy();
    this.bossHealthText?.destroy();
    this.bossHealthBar = undefined;
    this.bossHealthText = undefined;

    const centerX = this.scale.width / 2;
    const topY = 30;

    if (this.challengeBossRush && this.boss && this.boss2) {
      // Two separate bars stacked vertically
      this.bossHealthBar = this.add.graphics();
      this.bossHealthText = this.add.text(centerX, topY - 16, (this.boss instanceof ArtilleryBoss) ? 'ARTILLERY' : 'SENTINEL', { fontSize: '18px', color: '#ff3366', fontStyle: 'bold' }).setOrigin(0.5);
      // Reuse bossHealthBar for first; draw second in update using same method on a new graphics created here
      // Create companion graphics/text for boss2 via fields we already added earlier
      ;(this as unknown as { boss2HealthBar?: Phaser.GameObjects.Graphics }).boss2HealthBar = this.add.graphics();
      ;(this as unknown as { boss2HealthText?: Phaser.GameObjects.Text }).boss2HealthText = this.add.text(centerX, topY + 24, (this.boss2 instanceof ArtilleryBoss) ? 'ARTILLERY' : 'SENTINEL', { fontSize: '18px', color: '#ff3366', fontStyle: 'bold' }).setOrigin(0.5);
      this.updateBossHealthUI();
      return;
    }

    // Single boss
    this.bossHealthBar = this.add.graphics();
    this.bossHealthText = this.add.text(centerX, topY - 16, 'BOSS', { fontSize: '18px', color: '#ff3366', fontStyle: 'bold' }).setOrigin(0.5);
    this.updateBossHealthUI();
  }

  private updateBossHealthUI() {
    const centerX = this.scale.width / 2;
    const topY = 30;
    const w = 420, h = 16;

    // Two bars case
    if (this.challengeBossRush) {
      const g1 = this.bossHealthBar as Phaser.GameObjects.Graphics | undefined;
      const g2 = (this as unknown as { boss2HealthBar?: Phaser.GameObjects.Graphics }).boss2HealthBar;
      if (g1) {
        const pct1 = this.boss ? (this.boss as Boss).getHealthPct() : 0;
        g1.clear();
        g1.fillStyle(0x222222, 0.9).fillRoundedRect(centerX - w/2, topY, w, h, 8);
        g1.fillStyle(0xff3366, 1).fillRoundedRect(centerX - w/2, topY, w * pct1, h, 8);
        g1.lineStyle(2, 0xffffff, 1).strokeRoundedRect(centerX - w/2, topY, w, h, 8);
      }
      if (g2) {
        const pct2 = this.boss2 ? (this.boss2 as Boss).getHealthPct() : 0;
        const y2 = topY + 40;
        g2.clear();
        g2.fillStyle(0x222222, 0.9).fillRoundedRect(centerX - w/2, y2, w, h, 8);
        g2.fillStyle(0xff3366, 1).fillRoundedRect(centerX - w/2, y2, w * pct2, h, 8);
        g2.lineStyle(2, 0xffffff, 1).strokeRoundedRect(centerX - w/2, y2, w, h, 8);
      }
      return;
    }

    if (!this.boss || !this.bossHealthBar) return;
    const pct = (this.boss as Boss).getHealthPct();
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
      if (objA === this.boss || (this.boss2 && objA === this.boss2)) {
        bullet = objB as Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body };
        other = objA as Phaser.GameObjects.Sprite;
      } else if (objB === this.boss || (this.boss2 && objB === this.boss2)) {
        bullet = objA as Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body };
        other = objB as Phaser.GameObjects.Sprite;
      }
    }

    // Identify which boss was hit (supports boss2 in challenge)
    const hitBoss = (other === (this.boss as unknown)) ? this.boss : (this.boss2 && other === (this.boss2 as unknown)) ? this.boss2 : undefined;
    // Ensure we never disable a boss object by mistake
    if (hitBoss) {
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
    const before = (hitBoss as unknown as { getCurrentHealth?: () => number }).getCurrentHealth?.();
    const dead = (hitBoss as Boss).takeDamage(dmg);
    const after = (hitBoss as unknown as { getCurrentHealth?: () => number }).getCurrentHealth?.();
    if (IS_DEV) console.log('Boss hit', { dmg, before, after, dead });
    this.updateBossHealthUI();
    if (dead) {
      const waveNum = this.waveManager.getCurrentWave();
      if (!this.scoreManager.isWaveCompleted(waveNum)) {
        this.currentWaveScore += (hitBoss as Boss).getScoreValue();
      }
      // If in boss rush, only complete when both bosses are dead
      if (this.challengeBossRush && this.boss2 && (hitBoss === this.boss ? this.boss2.active : this.boss.active)) {
        // One boss down: destroy just that boss; keep fight going
        (hitBoss as Boss).destroy();
        if (hitBoss === this.boss) this.boss = undefined;
        else this.boss2 = undefined;
        this.updateBossHealthUI();
        return;
      }
      // Otherwise, finish the wave
      this.completeCurrentWave(true);
      addSnacks(1);
      this.gameUI.updateSnacks(getSnacks());
      // If running as challenge, show congrats overlay and return to selector
      if ((this as unknown as { _challengeMode?: boolean })._challengeMode) {
        this.showChallengeCompleteOverlay();
      } else {
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
  }

  private showChallengeCompleteOverlay() {
    this.physics.pause();
    this.cleanupBoss();
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const id = (this as unknown as { _challengeId?: string })._challengeId || 'challenge';
    const messageMap: Record<string, string> = {
      boss_rush: 'Boss Rush Master! Two at once? Easy. ',
      split_attention: 'Split Focus, Solid Aim. You kept control.',
      glass_cannon: 'Fragile but Fearless. You survived!',
      speed_demon: 'Too Fast to Fail. You tamed the speed.'
    };
    const msg = messageMap[id] || 'Challenge Complete!';
    const title = this.add.text(cx, cy - 40, 'CONGRATULATIONS!', { fontSize: '56px', color: '#00ffaa', fontStyle: 'bold' }).setOrigin(0.5);
    const subtitle = this.add.text(cx, cy + 10, msg, { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    const button = this.add.text(cx, cy + 80, 'CONTINUE', { fontSize: '28px', color: '#111827', backgroundColor: '#22d3ee', padding: { x: 24, y: 10 } }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        try { window.location.href = '/challenge'; } catch { this.scene.start('StartMenuScene'); }
      })
      .on('pointerover', () => button.setStyle({ backgroundColor: '#67e8f9' }))
      .on('pointerout', () => button.setStyle({ backgroundColor: '#22d3ee' }));
  }

  private cleanupBoss() {
    // Destroy boss-specific colliders
    if (this.bossBulletOverlap) { this.bossBulletOverlap.destroy(); this.bossBulletOverlap = undefined; }
    if (this.bossBulletOverlap2) { this.bossBulletOverlap2.destroy(); this.bossBulletOverlap2 = undefined; }
    if (this.bossPlayerCollider) { this.bossPlayerCollider.destroy(); this.bossPlayerCollider = undefined; }
    if (this.bossPlayerCollider2) { this.bossPlayerCollider2.destroy(); this.bossPlayerCollider2 = undefined; }
    // Stop boss add spawns
    this.stopBossAdds();
    // Clear any adds still alive
    if (this.enemies) this.enemies.clear(true, true);
    // Remove boss UI
    if (this.bossHealthBar) { this.bossHealthBar.destroy(); this.bossHealthBar = undefined; }
    if (this.bossHealthText) { this.bossHealthText.destroy(); this.bossHealthText = undefined; }
    const g2 = (this as unknown as { boss2HealthBar?: Phaser.GameObjects.Graphics }).boss2HealthBar;
    const t2 = (this as unknown as { boss2HealthText?: Phaser.GameObjects.Text }).boss2HealthText;
    if (g2) (g2 as Phaser.GameObjects.Graphics).destroy();
    if (t2) (t2 as Phaser.GameObjects.Text).destroy();
    ;(this as unknown as { boss2HealthBar?: Phaser.GameObjects.Graphics }).boss2HealthBar = undefined as unknown as Phaser.GameObjects.Graphics;
    ;(this as unknown as { boss2HealthText?: Phaser.GameObjects.Text }).boss2HealthText = undefined as unknown as Phaser.GameObjects.Text;
    // Destroy boss instance
    if (this.boss && this.boss.active) {
      (this.boss as Boss).destroy();
    }
    if (this.boss2 && this.boss2.active) {
      (this.boss2 as Boss).destroy();
    }
    // Remove boss pillars and their colliders
    this.destroyBossPillars();
    this.boss = undefined;
    this.boss2 = undefined;
    this.setDefaultArenaTheme();
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
    const isCompleted = this.scoreManager.isWaveCompleted(waveSettings.waveNumber);

    this.waveText = this.add.text(centerX, centerY - 50, `WAVE ${waveSettings.waveNumber}`, {
      fontSize: '48px',
      color: '#ffd700',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const titleText = this.add.text(centerX, centerY + 10, waveSettings.title.toUpperCase(), {
      fontSize: '28px',
      color: isCompleted ? '#666666' : '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Animate notification
    const targets = [this.waveText, titleText];
    
    this.tweens.add({
      targets,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.5, to: 1 },
      duration: 500,
      ease: 'Back.easeOut'
    });

    // Remove after 3 seconds
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets,
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
    const dmg = this.getPlayerBulletDamage(bulletObj as Phaser.GameObjects.Sprite & { getData?: (key: string) => unknown });
    const isDead = enemyObj.takeDamage(dmg);
    if (isDead) {
      // Only add to current wave score if the wave hasn't been completed yet
      const waveNum = this.waveManager.getCurrentWave();
      if (!this.scoreManager.isWaveCompleted(waveNum)) {
        this.currentWaveScore += enemyObj.getScoreValue();
      }
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
      // Only show current wave score if the wave hasn't been completed yet
      const currentWaveNum = this.waveManager.getCurrentWave();
      const displayScore = this.scoreManager.isWaveCompleted(currentWaveNum) 
        ? this.scoreManager.getTotalScore() 
        : this.scoreManager.getTotalScore() + this.currentWaveScore;
      this.gameUI.updateScore(displayScore);
    }
  }

  private handlePlayerEnemyCollision(player: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, enemy: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile) {
    const enemyObj = enemy as Enemy;

    // Award score for enemy collision (only if wave not completed)
    const waveNum = this.waveManager.getCurrentWave();
    if (!this.scoreManager.isWaveCompleted(waveNum)) {
      this.currentWaveScore += enemyObj.getScoreValue();
    }
    // Only show current wave score if the wave hasn't been completed yet
    const currentWaveNum = this.waveManager.getCurrentWave();
    const displayScore = this.scoreManager.isWaveCompleted(currentWaveNum) 
      ? this.scoreManager.getTotalScore() 
      : this.scoreManager.getTotalScore() + this.currentWaveScore;
    this.gameUI.updateScore(displayScore);

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
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.pause();
    if (this.spawnTimer) this.spawnTimer.paused = true;
    if (this.breakTimer) this.breakTimer.paused = true;
    this.player.setTint(0xff0000);
    this.gameUI.showGameOver(
      () => this.resetGame(),
      () => this.scene.start('StartMenuScene'),
      () => this.scene.start('ScoreEntryScene', { score: this.scoreManager.getTotalScore(), time: this.getGameTime(), gameMode: 'wave' })
    );
  }

  private promptScoreEntry() {
    const gameTime = this.getGameTime();

    this.time.delayedCall(2000, () => {
      this.scene.start('ScoreEntryScene', { 
        score: this.scoreManager.getTotalScore(), 
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
      if (bullet.body) bullet.body.enable = true;
      const playerStats = this.upgradeManager.getPlayerStats();
      // Set velocity directly to ensure consistent launch even for close clicks
      if (bullet.body) {
        bullet.body.velocity.set(dirX * playerStats.bulletSpeed, dirY * playerStats.bulletSpeed);
      } else {
        this.physics.moveTo(bullet as unknown as Phaser.GameObjects.GameObject, spawnX + dirX * 10, spawnY + dirY * 10, playerStats.bulletSpeed);
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
    if (bullet.body) bullet.body.enable = true;
    // Tag as drone-origin using Phaser's Data Manager if available
    const asObj = bullet as unknown as { setData?: (k: string, v: unknown) => void }
    if (typeof asObj.setData === 'function') {
      asObj.setData('fromDrone', true)
    }
    if (bullet.body) {
      const speedMult = Math.max(0.5, getBulletSpeedMultiplier());
      bullet.body.velocity.set(dirX * 350 * speedMult, dirY * 350 * speedMult);
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
    // Apply size multiplier visually
    const sizeMult = Math.max(0.5, getBulletSizeMultiplier());
    bullet.setScale(sizeMult);
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
          // Only add to current wave score if the wave hasn't been completed yet
          const waveNum = this.waveManager.getCurrentWave();
          if (!this.scoreManager.isWaveCompleted(waveNum)) {
            this.currentWaveScore += enemySprite.getScoreValue();
          }
          // Only show current wave score if the wave hasn't been completed yet
          const currentWaveNum = this.waveManager.getCurrentWave();
          const displayScore = this.scoreManager.isWaveCompleted(currentWaveNum) 
            ? this.scoreManager.getTotalScore() 
            : this.scoreManager.getTotalScore() + this.currentWaveScore;
          this.gameUI.updateScore(displayScore);
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

  private updateWaveProgressDisplay() {
    const progress = this.scoreManager.getProgress();
    const currentWave = this.waveManager.getCurrentWave();
    this.gameUI.updateWaveProgress(progress.completedWaves, progress.highestWave, currentWave);
  }

  private getGameTime(): number {
    return Math.floor((Date.now() - this.gameStartTime) / 1000);
  }

  private async completeCurrentWave(isBoss: boolean = false): Promise<void> {
    const currentWave = this.waveManager.getCurrentWave();
    const waveSettings = this.waveManager.getCurrentWaveSettings();
    
    // Calculate base score for the wave
    let finalScore = this.currentWaveScore;
    
    if (isBoss) {
      // Boss waves get their base score plus any additional score from adds
      const baseScore = ScoreManager.calculateWaveBaseScore(currentWave, true, waveSettings.bossType);
      finalScore = Math.max(finalScore, baseScore);
    } else {
      // Regular waves get base score plus efficiency bonus
      const waveProgress = this.waveManager.getWaveProgress();
      const timeElapsed = Math.floor((Date.now() - this.waveStartTime) / 1000);
      const baseScore = ScoreManager.calculateWaveBaseScore(currentWave, false);
      const efficiencyBonus = ScoreManager.calculateEfficiencyBonus(baseScore, waveProgress.killed, waveProgress.spawned, timeElapsed);
      finalScore = Math.max(finalScore, baseScore + efficiencyBonus);
    }

    // Try to complete the wave in the score manager
    const success = await this.scoreManager.completeWave(
      currentWave, 
      finalScore, 
      isBoss, 
      waveSettings.bossType
    );

    if (success) {
      this.score += finalScore;
      this.gameUI.updateScore(this.score);
      this.updateWaveProgressDisplay(); // Update progress display
      if (IS_DEV) console.log(`Wave ${currentWave} completed! Score: ${finalScore} (${isBoss ? 'Boss' : 'Regular'})`);
    } else {
      // Wave already completed - reset currentWaveScore and update UI to show only total score
      this.currentWaveScore = 0;
      this.gameUI.updateScore(this.scoreManager.getTotalScore());
      this.updateWaveProgressDisplay();
      if (IS_DEV) console.log(`Wave ${currentWave} already completed, no score added`);
    }
  }


  private updateProgressDisplay(): void {
    const progress = this.scoreManager.getProgress();
    this.gameUI.updateWaveProgress(
      progress.completedWaves,
      progress.highestWave,
      this.waveManager.getCurrentWave()
    );
  }

  private resetGame() {
    this.gameOver = false;
    this.score = this.scoreManager.getTotalScore(); // Reset to total completed score
    this.currentWaveScore = 0; // Reset current wave score

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
    // Also ensure pillars are gone
    this.destroyBossPillars();

    this.physics.resume();
    this.startFirstWave();
  }
}
