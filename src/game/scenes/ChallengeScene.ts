import * as Phaser from 'phaser';
import { Player } from '../objects/Player';
import { ArenaBackground } from '../objects/ArenaBackground';
import { Boss, SentinelBoss, ArtilleryBoss, Enemy, EnemySpawner, FastEnemy, RegularEnemy } from '../objects/Enemy';
import { GAME_SETTINGS } from '../config/gameConfig';
import { GameUI } from '../ui/GameUI';
import { ReloadingBar } from '../ui/ReloadingBar';
import { grantAchievement } from '../systems/Achievements';

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
  private bossAHealthBar?: Phaser.GameObjects.Graphics;
  private bossAText?: Phaser.GameObjects.Text;
  private bossBHealthBar?: Phaser.GameObjects.Graphics;
  private bossBText?: Phaser.GameObjects.Text;
  private bossIntroTimers: Phaser.Time.TimerEvent[] = [];
  private gameOver = false;
  private forcedStats: ForcedStats = {};
  private limitReloads?: number; // for no_shots
  private reloadsUsed = 0;
  private ammo = 0;
  private maxAmmo = 0;
  private isReloading = false;
  private noShotsTimerStarted = false;

  // Palette overlay to recolor the arena per level
  private paletteOverlay?: Phaser.GameObjects.Rectangle;
  private paletteResizeHandler?: (size: Phaser.Structs.Size) => void;

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
    // Choose a base theme and color overlay per level
    const { theme, tint, alpha } = this.getThemeAndPalette(this.level);
    this.arenaBackground.setTheme(theme);
    this.applyPaletteOverlay(tint, alpha);

    this.player = new Player(this, this.scale.width / 2, this.scale.height / 2, { forcedStats: this.forcedStats });
    // Apply forced stats to player by mutating internals carefully
    this.applyForcedStats();

    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 120 });
    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.enemyBullets = this.physics.add.group({ defaultKey: 'enemy_bullet', maxSize: 400 });
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
    // World bounds cleanup for enemy bullets
    this.physics.world.on('worldbounds', (body: Phaser.Physics.Arcade.Body) => {
      const go = body.gameObject as unknown as Phaser.GameObjects.GameObject | undefined;
      if (!go) return;
      if (this.enemyBullets.contains(go)) {
        (go as unknown as { setActive?: (a: boolean) => void }).setActive?.(false);
        (go as unknown as { setVisible?: (v: boolean) => void }).setVisible?.(false);
      }
    });
    this.startLevel();
    this.gameOver = false;
    this.physics.resume();
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
    // Only Glass Cannon sets HP to 1
    if (this.level === 'glass_cannon') base.health = 1;
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
    this.input.keyboard?.on('keydown-ESCAPE', () => this.pauseGame());
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
    const body = bullet.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) {
      body.enable = true;
      body.setVelocity(dirX * (this.forcedStats.bulletSpeed ?? 400), dirY * (this.forcedStats.bulletSpeed ?? 400));
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
    this.physics.add.collider(
      this.bullets,
      this.enemies,
      (obj1: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile,
       obj2: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile) => {
        const bulletGo = (obj1 as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject || (obj1 as unknown as Phaser.GameObjects.GameObject);
        const enemyGo = (obj2 as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject || (obj2 as unknown as Phaser.GameObjects.GameObject);
        if (!bulletGo || !enemyGo) return;
        this.onBulletHitsEnemy(
          bulletGo as Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body; ttlEvent?: Phaser.Time.TimerEvent },
          enemyGo as unknown as Enemy
        );
      }
    );
    this.physics.add.collider(this.player, this.enemies, () => this.handlePlayerEnemyCollision());
    this.physics.add.overlap(this.player, this.enemyBullets, (p, b) => this.handlePlayerHitByEnemyBullet(p as Phaser.GameObjects.GameObject, b as Phaser.GameObjects.GameObject));
  }

  private handlePlayerEnemyCollision() {
    const isDead = this.player.takeDamage(GAME_SETTINGS.player.damagePerHit);
    this.ui.updateHealthBar(this.player.getHealthPercentage());
    if (isDead) this.fail();
  }

  private handlePlayerHitByEnemyBullet(player: Phaser.GameObjects.GameObject, bullet: Phaser.GameObjects.GameObject) {
    const bulletSprite = bullet as Phaser.GameObjects.Sprite;
    if (!bulletSprite.active) return;
    bulletSprite.setActive(false).setVisible(false);
    const fromBoss = (bulletSprite as unknown as { getData?: (key: string) => unknown }).getData?.('fromBoss') === true;
    const baseDamage = Math.floor(GAME_SETTINGS.player.maxHealth * GAME_SETTINGS.enemies.shooter.bulletDamagePct);
    const damage = fromBoss ? Math.floor(baseDamage * 1.3) : baseDamage;
    const isDead = this.player.takeDamage(damage);
    this.ui.updateHealthBar(this.player.getHealthPercentage());
    if (isDead) this.fail();
  }

  private handlePlayerBossCollision(_player: Phaser.GameObjects.GameObject, _boss?: Phaser.GameObjects.GameObject) {
    // Similar to WaveScene: boss contact deals heavier damage
    const scale = 1.4; // tuned heavier than enemy collision
    const dmg = Math.floor(GAME_SETTINGS.player.damagePerHit * 2 * scale);
    const isDead = this.player.takeDamage(dmg);
    this.ui.updateHealthBar(this.player.getHealthPercentage());
    if (isDead) this.fail();
  }

  private onBulletHitsEnemy(bulletObj: Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent }, enemyObj: Enemy) {
    if (!bulletObj.active || !enemyObj.active) return;
    // Deactivate bullet on hit
    if (bulletObj.ttlEvent) { bulletObj.ttlEvent.remove(false); bulletObj.ttlEvent = undefined; }
    const b = bulletObj.body as Phaser.Physics.Arcade.Body | undefined;
    if (b) b.setVelocity(0, 0);
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

  private getThemeAndPalette(level: ChallengeLevel): { theme: 'space' | 'hell' | 'prison'; tint: number; alpha: number } {
    // Simple per-level color schemes
    // 1) Green, 2) Purple, 3) Orange, 4) Blue, 5) White
    switch (level) {
      case 'boss_rush':
        return { theme: 'hell', tint: 0x16a34a, alpha: 0.18 }; // green
      case 'split_attention':
        return { theme: 'space', tint: 0x7c3aed, alpha: 0.16 }; // purple
      case 'no_shots':
        return { theme: 'space', tint: 0xf97316, alpha: 0.15 }; // orange
      case 'glass_cannon':
        return { theme: 'prison', tint: 0x60a5fa, alpha: 0.16 }; // blue
      case 'speed_demon':
      default:
        return { theme: 'space', tint: 0xffffff, alpha: 0.10 }; // white
    }
  }

  private applyPaletteOverlay(color: number, alpha: number) {
    // Create a fullscreen rectangle with screen blend to tint the scene
    const width = this.scale.width;
    const height = this.scale.height;
    if (this.paletteOverlay) {
      this.paletteOverlay.destroy();
      this.paletteOverlay = undefined;
    }
    this.paletteOverlay = this.add.rectangle(0, 0, width, height, color, alpha)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(99999)
      .setBlendMode(Phaser.BlendModes.SCREEN);
    // Keep sized on resize
    this.paletteResizeHandler = (size: Phaser.Structs.Size) => {
      this.paletteOverlay?.setSize(size.width, size.height);
    };
    this.scale.on('resize', this.paletteResizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.paletteOverlay) { this.paletteOverlay.destroy(); this.paletteOverlay = undefined; }
      if (this.paletteResizeHandler) { this.scale.off('resize', this.paletteResizeHandler); this.paletteResizeHandler = undefined; }
    });
  }

  private startBossRush() {
    // Intro: silhouettes and delay
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2 - 150;
    const silLeft = this.add.image(cx - 90, cy, 'boss_sentinel').setAlpha(0).setTint(0x000000).setDepth(999);
    const silRight = this.add.image(cx + 90, cy, 'boss_artillery').setAlpha(0).setTint(0x000000).setDepth(999);
    this.tweens.add({ targets: [silLeft, silRight], alpha: { from: 0, to: 0.75 }, duration: 450, ease: 'Sine.Out' });
    const pulse = this.tweens.add({ targets: [silLeft, silRight], alpha: { from: 0.6, to: 0.85 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 500 });
    const titleText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, 'CHALLENGE: BOSS RUSH', { fontSize: '40px', color: '#00ffaa', fontStyle: 'bold' }).setOrigin(0.5);
    const subtitleText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 10, 'Two bosses at once. No mercy.', { fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    titleText.setAlpha(0); subtitleText.setAlpha(0);
    this.tweens.add({ targets: titleText, alpha: { from: 0, to: 1 }, scale: { from: 0.9, to: 1.02 }, duration: 400, ease: 'Back.Out' });
    this.tweens.add({ targets: subtitleText, alpha: { from: 0, to: 1 }, duration: 450, delay: 150 });
    this.cameras.main.flash(250, 255, 64, 64); this.cameras.main.shake(220, 0.006);
    const t = this.time.delayedCall(2400, () => {
      titleText.destroy(); subtitleText.destroy(); pulse.stop(); silLeft.destroy(); silRight.destroy();
      // Spawn bosses and setup fight
      const x = this.scale.width / 2;
      const y = this.scale.height / 2 - 150;
      this.bossA = new SentinelBoss(this, x - 90, y, this.player);
      this.bossB = new ArtilleryBoss(this, x + 90, y, this.player);
      this.enemyBullets = this.enemyBullets || this.physics.add.group({ defaultKey: 'enemy_bullet', maxSize: 400 });
      this.spawnPillars(4);
      this.createBossHealthUI();
      this.physics.add.overlap(this.bullets, [this.bossA, this.bossB], (objA: Phaser.GameObjects.GameObject, objB: Phaser.GameObjects.GameObject) => this.onBulletHitsBoss(objA, objB));
      // Player vs enemyBullets overlap is already registered in setupCollisions().
      this.physics.add.collider(this.player, [this.bossA, this.bossB], (p, b) => this.handlePlayerBossCollision(p as Phaser.GameObjects.GameObject, b as Phaser.GameObjects.GameObject));
    });
    this.bossIntroTimers.push(t);
  }

  private startSplitAttention() {
    // 1 Sentinel boss + swarm of fast enemies
    const x = this.scale.width / 2;
    const y = this.scale.height / 2 - 150;
    this.bossA = new SentinelBoss(this, x, y, this.player);
    this.physics.add.overlap(this.bullets, this.bossA, (objA, objB) => this.onBulletHitsBoss(objA as Phaser.GameObjects.GameObject, objB as Phaser.GameObjects.GameObject));
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
    this.updateBossHealthUI();
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
    txt.setInteractive({ useHandCursor: true }).once('pointerdown', () => {
      // Cleanup to avoid residual timers/inputs
      try { this.input.removeAllListeners(); } catch {}
      try { this.time.removeAllEvents(); } catch {}
      try { this.scene.stop('PauseMenuScene'); } catch {}
      this.scene.start('ChallengeScene', { level: this.level });
    });
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
      this.pillars.push(rect as Phaser.GameObjects.Rectangle & { body?: Phaser.Physics.Arcade.StaticBody });
    }
    // Colliders
    if (this.pillars.length) {
      this.physics.add.collider(this.player, this.pillars);
      // Enemy bullets vs pillars: deactivate bullet
      this.physics.add.collider(
        this.enemyBullets,
        this.pillars,
        (
          objA: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody,
          objB: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody
        ) => {
          const goA = (objA as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject || (objA as unknown as Phaser.GameObjects.GameObject);
          const goB = (objB as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject || (objB as unknown as Phaser.GameObjects.GameObject);
          const bullet = (this.enemyBullets.contains(goA) ? goA : this.enemyBullets.contains(goB) ? goB : undefined) as
            (Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body }) | undefined;
          if (!bullet || !bullet.active) return;
          const body = bullet.body as Phaser.Physics.Arcade.Body | undefined;
          if (body && typeof (body as any).setVelocity === 'function') body.setVelocity(0, 0);
          bullet.setActive(false).setVisible(false);
        }
      );
      this.physics.add.collider(
        this.bullets,
        this.pillars,
        (
          objA: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody,
          objB: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody
        ) => {
          // Extract the bullet GameObject regardless of arg order
          const goA = (objA as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject || (objA as unknown as Phaser.GameObjects.GameObject);
          const goB = (objB as unknown as { gameObject?: Phaser.GameObjects.GameObject }).gameObject || (objB as unknown as Phaser.GameObjects.GameObject);
          const bullet = (this.bullets.contains(goA) ? goA : this.bullets.contains(goB) ? goB : undefined) as
            (Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body; ttlEvent?: Phaser.Time.TimerEvent }) | undefined;
          if (!bullet || !bullet.active) return;
          if (bullet.ttlEvent) { bullet.ttlEvent.remove(false); bullet.ttlEvent = undefined; }
          const body2 = bullet.body as Phaser.Physics.Arcade.Body | undefined;
          if (body2 && typeof (body2 as any).setVelocity === 'function') body2.setVelocity(0, 0);
          bullet.setActive(false).setVisible(false);
        }
      );
    }
  }

  private createBossHealthUI() {
    this.bossAHealthBar?.destroy(); this.bossBHealthBar?.destroy();
    this.bossAText?.destroy(); this.bossBText?.destroy();
    const centerX = this.scale.width / 2;
    const topY = 30;
    this.bossAHealthBar = this.add.graphics();
    this.bossBHealthBar = this.add.graphics();
    this.bossAText = this.add.text(centerX, topY - 16, 'SENTINEL', { fontSize: '18px', color: '#ff3366', fontStyle: 'bold' }).setOrigin(0.5);
    this.bossBText = this.add.text(centerX, topY + 24, 'ARTILLERY', { fontSize: '18px', color: '#ff3366', fontStyle: 'bold' }).setOrigin(0.5);
    this.updateBossHealthUI();
  }

  private updateBossHealthUI() {
    const centerX = this.scale.width / 2;
    const topY = 30;
    const w = 420, h = 16;
    if (this.bossAHealthBar) {
      const pct = this.bossA && this.bossA.active ? (this.bossA as Boss).getHealthPct() : 0;
      this.bossAHealthBar.clear();
      this.bossAHealthBar.fillStyle(0x222222, 0.9).fillRoundedRect(centerX - w/2, topY, w, h, 8);
      this.bossAHealthBar.fillStyle(0xff3366, 1).fillRoundedRect(centerX - w/2, topY, w * pct, h, 8);
      this.bossAHealthBar.lineStyle(2, 0xffffff, 1).strokeRoundedRect(centerX - w/2, topY, w, h, 8);
    }
    if (this.bossBHealthBar) {
      const pct = this.bossB && this.bossB.active ? (this.bossB as Boss).getHealthPct() : 0;
      const y2 = topY + 40;
      this.bossBHealthBar.clear();
      this.bossBHealthBar.fillStyle(0x222222, 0.9).fillRoundedRect(centerX - w/2, y2, w, h, 8);
      this.bossBHealthBar.fillStyle(0xff3366, 1).fillRoundedRect(centerX - w/2, y2, w * pct, h, 8);
      this.bossBHealthBar.lineStyle(2, 0xffffff, 1).strokeRoundedRect(centerX - w/2, y2, w, h, 8);
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


