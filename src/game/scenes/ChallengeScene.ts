import * as Phaser from 'phaser';
import { Player } from '../objects/Player';
import { ArenaBackground } from '../objects/ArenaBackground';
import { Boss, SentinelBoss, ArtilleryBoss, Enemy, EnemySpawner, MiniEnemy, FastEnemy, RegularEnemy } from '../objects/Enemy';
import { GameUI } from '../ui/GameUI';
import { ReloadingBar } from '../ui/ReloadingBar';
import { grantAchievement } from '../systems/Achievements';
import { UpgradeManager } from '../systems/UpgradeManager';

type ChallengeLevel = 'boss_rush' | 'split_attention' | 'no_shots' | 'glass_cannon' | 'speed_demon';

type ForcedStats = Partial<{
  health: number;
  speed: number;
  maxAmmo: number;
  reloadSpeed: number;
  bulletSpeed: number;
  bulletDamage: number;
}>;

export class ChallengeScene extends Phaser.Scene {
  private level: ChallengeLevel = 'boss_rush';
  private player!: Player;
  private arenaBackground?: ArenaBackground;
  private ui!: GameUI;
  private reloadingBar!: ReloadingBar;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemySpawner!: EnemySpawner;
  private bossA?: Boss;
  private bossB?: Boss;
  private gameOver = false;
  private forcedStats: ForcedStats = {};
  private limitReloads?: number; // for no_shots
  private reloadsUsed = 0;
  private ammo = 0;
  private maxAmmo = 0;
  private isReloading = false;
  private noShotsTimerStarted = false;

  // Pillars (simple static obstacles for Boss Rush)
  private pillars: Array<Phaser.GameObjects.Rectangle & { body?: Phaser.Physics.Arcade.StaticBody } > = [];

  constructor() {
    super({ key: 'ChallengeScene' });
  }

  init(data?: { level?: ChallengeLevel }) {
    if (data?.level) this.level = data.level;
  }

  preload() { this.createTextures(); }

  create() {
    // No pets/upgrades: fix base stats depending on level
    this.configureConstraints();

    this.arenaBackground = new ArenaBackground(this);
    // Green hell theme for Level 1 per spec
    this.arenaBackground.setTheme('hell');

    this.player = new Player(this, this.scale.width / 2, this.scale.height / 2, { forcedStats: this.forcedStats });
    // Apply forced stats to player by mutating internals carefully
    this.applyForcedStats();

    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 120 });
    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.enemyBullets = this.physics.add.group({ defaultKey: 'enemy_bullet', maxSize: 200 });
    this.enemySpawner = new EnemySpawner(this, this.enemies, this.player);

    this.maxAmmo = this.getAmmo();
    this.ammo = this.maxAmmo;
    this.ui = new GameUI(this);
    if (this.level === 'no_shots') {
      const totalRemaining = this.ammo + (this.limitReloads ?? 0) * this.maxAmmo;
      this.ui.updateAmmoDetailed(this.ammo, this.maxAmmo, totalRemaining);
    } else {
      this.ui.updateAmmo(this.ammo);
    }
    this.ui.updateScore(0);
    this.ui.hideWaveProgress();
    this.reloadingBar = new ReloadingBar(this, this.player);

    this.setupInputs();
    this.setupCollisions();
    this.startLevel();
  }

  update(_: number, delta: number) {
    if (this.arenaBackground) this.arenaBackground.update(delta);
    if (this.gameOver) return;
    // Ensure bosses run their AI
    if (this.bossA && this.bossA.active) {
      (this.bossA as Boss).update();
    }
    if (this.bossB && this.bossB.active) {
      (this.bossB as Boss).update();
    }
    this.player.update();
    this.reloadingBar.update();
    // Hide pet/shield UI
    this.ui.setDroneActive(false);
    this.ui.setShieldActive(false);
  }

  private configureConstraints() {
    // Default: vanilla baseline
    const base: ForcedStats = { health: 100, speed: 200, maxAmmo: 10, reloadSpeed: 2000, bulletSpeed: 400, bulletDamage: 1 };
    if (this.level === 'glass_cannon') {
      base.health = 1;
    }
    if (this.level === 'speed_demon') {
      base.speed = 400; // doubled per spec
    }
    if (this.level === 'no_shots') {
      // limited reload rounds; keep ammo small to emphasize accuracy
      base.maxAmmo = 6;
      this.limitReloads = 3; // 3 full mags total
    }
    this.forcedStats = base;
  }

  private applyForcedStats() {
    // UpgradeManager exists inside Player; we can override via simple monkey-patch of getters used by scenes
    const sceneAny = this as unknown as { __forcedStats?: ForcedStats };
    sceneAny.__forcedStats = this.forcedStats;
    const playerAny = this.player as unknown as { getPlayerStats?: () => ForcedStats };
    if (playerAny && typeof playerAny.getPlayerStats === 'function') {
      // Player exposes getPlayerStats that scenes call; however Main/Wave use UpgradeManager directly.
      // In this scene, we only read from this.getAmmo(), etc., so we manage ammo locally.
    }
  }

  private getAmmo() {
    return this.forcedStats.maxAmmo ?? 10;
  }

  private setupInputs() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.handleShoot(p));
    this.input.keyboard?.on('keydown-ESC', () => this.pauseGame());
  }

  private pauseGame() {
    if (this.gameOver) return;
    this.scene.pause();
    this.scene.launch('PauseMenuScene', { parentScene: 'ChallengeScene' });
  }

  private handleShoot(pointer: Phaser.Input.Pointer) {
    if (this.gameOver) return;
    if (this.isReloading || this.ammo <= 0) return;
    // Ammo handling: use bullets count on group to approximate; keep local counters minimalistic
    // Fire
    const dx = pointer.x - this.player.x;
    const dy = pointer.y - this.player.y;
    const len = Math.hypot(dx, dy) || 1;
    const dirX = dx / len;
    const dirY = dy / len;
    const spawnX = this.player.x + dirX * 18;
    const spawnY = this.player.y + dirY * 18;
    const bullet = this.bullets.get(spawnX, spawnY) as (Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent }) | null;
    if (!bullet) return;
    bullet.setActive(true).setVisible(true);
    if (!bullet.body) this.physics.world.enable(bullet);
    if (bullet.body) {
      bullet.body.enable = true;
      bullet.body.velocity.set(dirX * (this.forcedStats.bulletSpeed ?? 400), dirY * (this.forcedStats.bulletSpeed ?? 400));
    }
    bullet.ttlEvent?.remove(false);
    bullet.ttlEvent = this.time.delayedCall(2000, () => { if (bullet.active) bullet.setActive(false).setVisible(false); bullet.ttlEvent = undefined; });

    // Recoil for speed demon: slight push opposite direction
    if (this.level === 'speed_demon') {
      const r = 60;
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.velocity.x -= dirX * r;
      body.velocity.y -= dirY * r;
    }

    this.ammo--;
    if (this.level === 'no_shots') {
      const remainingMags = Math.max(0, (this.limitReloads ?? 0) - this.reloadsUsed);
      const totalRemaining = this.ammo + remainingMags * this.maxAmmo;
      this.ui.updateAmmoDetailed(this.ammo, this.maxAmmo, totalRemaining);
    } else {
      this.ui.updateAmmo(this.ammo);
    }
    if (this.ammo <= 0) this.reload();
  }

  private setupCollisions() {
    this.physics.add.collider(this.bullets, this.enemies, (b, e) => this.onBulletHitsEnemy(b as any, e as any));
    this.physics.add.collider(this.player, this.enemies, (_p, _e) => this.fail());
    this.physics.add.overlap(this.player, this.enemyBullets, () => this.fail());
  }

  private onBulletHitsEnemy(bulletObj: Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent }, enemyObj: Enemy) {
    if (!bulletObj.active || !enemyObj.active) return;
    // Deactivate bullet on hit
    if (bulletObj.ttlEvent) { bulletObj.ttlEvent.remove(false); bulletObj.ttlEvent = undefined; }
    if (bulletObj.body) bulletObj.body.setVelocity(0, 0);
    bulletObj.setActive(false).setVisible(false);
    const dead = enemyObj.takeDamage(this.forcedStats.bulletDamage ?? 1);
    if (dead) enemyObj.destroy();
    this.checkWinConditions();
  }

  private startLevel() {
    switch (this.level) {
      case 'boss_rush':
        this.startBossRush();
        break;
      case 'split_attention':
        this.startSplitAttention();
        break;
      case 'no_shots':
        this.startNoShots();
        break;
      case 'glass_cannon':
        // For now, reuse boss rush but with 1 HP constraint already applied
        this.startBossRush();
        break;
      case 'speed_demon':
        this.startSplitAttention();
        break;
    }
  }

  private startBossRush() {
    // 2 bosses at once + 4 random pillars in WaveScene already exist; here we spawn bosses only
    const x = this.scale.width / 2;
    const y = this.scale.height / 2 - 150;
    this.bossA = new SentinelBoss(this, x - 90, y, this.player);
    this.bossB = new ArtilleryBoss(this, x + 90, y, this.player);
    // Ensure enemy bullets group exists and colliders behave like WaveScene
    this.enemyBullets = this.enemyBullets || this.physics.add.group({ defaultKey: 'enemy_bullet', maxSize: 400 });
    // Boss update loops will handle their own firing; we only need to update them in update()
    this.spawnPillars(4);
    // Collisions with bullets
    this.physics.add.overlap(
      this.bullets,
      [this.bossA, this.bossB],
      (objA: Phaser.GameObjects.GameObject, objB: Phaser.GameObjects.GameObject) => this.onBulletHitsBoss(objA, objB)
    );
    // Player gets damaged by enemy bullets from bosses
    this.physics.add.overlap(this.player, this.enemyBullets, () => this.fail());
    // Player collides with bosses -> fail
    this.physics.add.collider(this.player, [this.bossA, this.bossB], () => this.fail());
    // Light ambient spawns are off; only bosses
  }

  private startSplitAttention() {
    // 1 Sentinel boss + swarm of fast enemies
    const x = this.scale.width / 2;
    const y = this.scale.height / 2 - 150;
    this.bossA = new SentinelBoss(this, x, y, this.player);
    this.physics.add.overlap(this.bullets, this.bossA, (objA, objB) => this.onBulletHitsBoss(objA as any, objB as any));
    // Periodically spawn fast enemies
    this.time.addEvent({ delay: 900, loop: true, callback: () => {
      for (let i = 0; i < 3; i++) {
        const sp = this.getRandomSpawnPoint();
        const fe = new FastEnemy(this, sp.x, sp.y, this.player);
        this.enemies.add(fe);
      }
    }});
  }

  private startNoShots() {
    // No pet allowed, limited reload rounds handled via limitReloads
    // Use regular mobs to clear; require accuracy and ammo discipline
    this.time.addEvent({ delay: 800, loop: true, callback: () => {
      const sp = this.getRandomSpawnPoint();
      const pick = Math.random();
      const e = pick < 0.7 ? new RegularEnemy(this, sp.x, sp.y, this.player) : new FastEnemy(this, sp.x, sp.y, this.player);
      this.enemies.add(e);
    }});
  }

  private onBulletHitsBoss(objA: Phaser.GameObjects.GameObject, objB: Phaser.GameObjects.GameObject) {
    const bullet = (this.bullets.contains(objA) ? objA : objB) as Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent };
    const boss = (bullet === objA ? objB : objA) as Boss;
    if (!bullet.active || !boss.active) return;
    if (bullet.ttlEvent) { bullet.ttlEvent.remove(false); bullet.ttlEvent = undefined; }
    bullet.setActive(false).setVisible(false);
    const dead = boss.takeDamage(1);
    if (dead) boss.destroy();
    this.checkWinConditions();
  }

  private getRandomSpawnPoint(): { x: number; y: number } {
    const screenWidth = this.scale.width;
    const screenHeight = this.scale.height;
    const x = Phaser.Math.Between(0, screenWidth);
    const y = Phaser.Math.Between(0, screenHeight);
    const side = Phaser.Math.Between(0, 3);
    switch (side) {
      case 0: return { x, y: -40 };
      case 1: return { x: screenWidth + 40, y };
      case 2: return { x, y: screenHeight + 40 };
      default: return { x: -40, y };
    }
  }

  private checkWinConditions() {
    if (this.level === 'boss_rush') {
      const aDead = !this.bossA || !this.bossA.active;
      const bDead = !this.bossB || !this.bossB.active;
      if (aDead && bDead) {
        grantAchievement('boss_killer', 'Boss Killer');
        this.win();
      }
    } else if (this.level === 'split_attention') {
      const bossDead = !this.bossA || !this.bossA.active;
      if (bossDead) {
        grantAchievement('split_attention', 'Split Attention');
        this.win();
      }
    } else if (this.level === 'no_shots') {
      // Victory by surviving a fixed duration with limited reloads
      // 45 seconds endurance
      if (!this.noShotsTimerStarted) {
        this.noShotsTimerStarted = true;
        this.time.delayedCall(45000, () => {
          grantAchievement('no_shots_no_problem', 'No Shots, No Problem');
          this.win();
        }, undefined, this);
      }
    }
  }

  private win() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.pause();
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const msgMap: Record<string, string> = {
      no_shots: 'Accuracy on point. Ammo discipline paid off.'
    };
    const msg = msgMap[this.level] || 'Challenge Complete!';
    const title = this.add.text(cx, cy - 40, 'CONGRATULATIONS!', { fontSize: '56px', color: '#00ffaa', fontStyle: 'bold' }).setOrigin(0.5);
    const subtitle = this.add.text(cx, cy + 10, msg, { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    const button = this.add.text(cx, cy + 80, 'CONTINUE', { fontSize: '28px', color: '#111827', backgroundColor: '#22d3ee', padding: { x: 24, y: 10 } }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { try { window.location.href = '/challenge'; } catch { this.scene.start('StartMenuScene'); } })
      .on('pointerover', () => button.setStyle({ backgroundColor: '#67e8f9' }))
      .on('pointerout', () => button.setStyle({ backgroundColor: '#22d3ee' }));
  }

  private fail() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.pause();
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const txt = this.add.text(cx, cy, 'FAILED\nClick to retry', { fontSize: '36px', color: '#ff6666', fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
    txt.setInteractive({ useHandCursor: true }).once('pointerdown', () => this.scene.start('ChallengeScene', { level: this.level }));
  }

  private reload() {
    if (this.isReloading) return;
    // Enforce limited reloads for no_shots
    if (this.level === 'no_shots') {
      const allowed = this.limitReloads ?? 0;
      if (this.reloadsUsed >= allowed) {
        return; // Out of reloads
      }
      this.reloadsUsed++;
    }
    this.isReloading = true;
    const speed = this.forcedStats.reloadSpeed ?? 2000;
    this.reloadingBar.show(speed);
    this.time.delayedCall(speed, () => {
      this.ammo = this.maxAmmo;
      if (this.level === 'no_shots') {
        const totalRemaining = this.ammo + Math.max(0, (this.limitReloads ?? 0) - this.reloadsUsed) * this.maxAmmo;
        this.ui.updateAmmoDetailed(this.ammo, this.maxAmmo, totalRemaining);
      } else {
        this.ui.updateAmmo(this.ammo);
      }
      this.isReloading = false;
    });
  }

  private spawnPillars(count: number) {
    // Simple static obstacles
    for (const p of this.pillars) p.destroy();
    this.pillars = [];
    const w = this.scale.width;
    const h = this.scale.height;
    for (let i = 0; i < count; i++) {
      const rx = Phaser.Math.Between(80, w - 80);
      const ry = Phaser.Math.Between(80, h - 80);
      const width = Phaser.Math.Between(28, 42);
      const height = Phaser.Math.Between(120, 180);
      const rect = this.add.rectangle(rx, ry, width, height, 0x4b0c0c, 0.25).setStrokeStyle(2, 0xff7a39, 0.45);
      this.physics.add.existing(rect, true);
      this.pillars.push(rect as any);
    }
    // Colliders
    if (this.pillars.length) {
      this.physics.add.collider(this.player, this.pillars);
      this.physics.add.collider(this.bullets, this.pillars, (b: Phaser.GameObjects.GameObject) => {
        const bullet = b as Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent };
        if (!bullet.active) return;
        if (bullet.ttlEvent) { bullet.ttlEvent.remove(false); bullet.ttlEvent = undefined; }
        if (bullet.body) bullet.body.setVelocity(0, 0);
        bullet.setActive(false).setVisible(false);
      });
    }
  }

  private createTextures() {
    if (!this.textures.exists('player')) {
      const gfx = this.make.graphics({ fillStyle: { color: 0x00aaff } }, false);
      gfx.fillRect(0, 0, 32, 32);
      gfx.generateTexture('player', 32, 32);
      gfx.destroy();
    }
    if (!this.textures.exists('bullet')) {
      const gfx = this.make.graphics({ fillStyle: { color: 0xff0000 } }, false);
      gfx.fillRect(0, 0, 8, 8);
      gfx.generateTexture('bullet', 8, 8);
      gfx.destroy();
    }
    if (!this.textures.exists('enemy_bullet')) {
      const g = this.make.graphics(undefined, false);
      g.lineStyle(2, 0xffffff, 1);
      g.fillStyle(0xff0000, 1);
      g.fillCircle(4, 4, 3);
      g.strokeCircle(4, 4, 4);
      g.generateTexture('enemy_bullet', 8, 8);
      g.destroy();
    }
    const ensureRect = (key: string, w: number, h: number, color: number) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ fillStyle: { color } }, false);
      g.fillRect(0, 0, w, h);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    ensureRect('enemy', 24, 24, 0x00ff00);
    ensureRect('enemy_fast', 24, 24, 0x0000ff);
    ensureRect('enemy_big', 48, 48, 0x800080);
    ensureRect('boss_sentinel', 72, 72, 0xff3366);
    ensureRect('boss_artillery', 84, 84, 0x33ffaa);
  }
}


