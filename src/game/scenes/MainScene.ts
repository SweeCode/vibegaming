import * as Phaser from 'phaser';
import { GAME_SETTINGS } from '../config/gameConfig';
import { Player } from '../objects/Player';
import { Enemy, EnemySpawner, MiniEnemy } from '../objects/Enemy';
import { GameUI } from '../ui/GameUI';
import { ReloadingBar } from '../ui/ReloadingBar';
import { DifficultyManager } from '../systems/DifficultyManager';
import { UpgradeManager } from '../systems/UpgradeManager';
import { Drone } from '../objects/Drone';
import { loadPetSettings } from '../systems/petSettings';
import { getBulletSpeedMultiplier, getBulletSizeMultiplier, getSnacks } from '../systems/petUpgrades';
import { getPlayerColor } from '../systems/playerAppearance';
import { ArenaBackground } from '../objects/ArenaBackground';

export class MainScene extends Phaser.Scene {
  private player!: Player;
  private bullets!: Phaser.Physics.Arcade.Group;
   private enemies!: Phaser.Physics.Arcade.Group;
   private enemyBullets!: Phaser.Physics.Arcade.Group;  private enemySpawner!: EnemySpawner;
  private gameUI!: GameUI;
  private reloadingBar!: ReloadingBar;
  private difficultyManager!: DifficultyManager;
  private upgradeManager!: UpgradeManager;
  private drone?: Drone;
  private arenaBackground?: ArenaBackground;
  private score = 0;
  private ammo = GAME_SETTINGS.weapons.bullet.maxAmmo;
  private maxAmmo = GAME_SETTINGS.weapons.bullet.maxAmmo;
  private isReloading = false;
  private gameOver = false;
  private gameStartTime: number = 0;
  private spawnTimer!: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'MainScene' });
  }

  shutdown() {
    // Clean up timers when scene is stopped
    if (this.spawnTimer) {
      this.spawnTimer.destroy();
    }
    if (this.drone) { this.drone.destroy(); this.drone = undefined; }
    if (this.arenaBackground) { this.arenaBackground.destroy(); this.arenaBackground = undefined; }
  }

  preload() {
    this.createTextures();
  }

  create() {
    this.gameStartTime = Date.now(); // Start the timer
    this.upgradeManager = new UpgradeManager();
    this.initializePlayerStats();
    this.createArenaBackground();
    this.createPlayer();
    this.createInputs();
    this.createBullets();
    this.createEnemies();
    this.createEnemyBullets();
    this.createUI();
    this.createReloadingBar();
    this.createDifficultyManager();
    this.setupCollisions();
    this.setupSpawnTimer();
    this.setupMouseInput();
    this.setupKeyboardInput();

    // Spawn pet drone if enabled
    const mods = this.upgradeManager.getModifiers();
    if (mods.petDrone?.enabled) {
      const settings = loadPetSettings(mods);
      this.drone?.destroy();
      this.drone = new Drone(this, this.player, (x: number, y: number) => this.fireDroneBullet(x, y, settings.damage), settings.fireRateMs);
    }
  }

  private initializePlayerStats() {
    const playerStats = this.upgradeManager.getPlayerStats();
    this.maxAmmo = playerStats.maxAmmo;
    this.ammo = this.maxAmmo;
  }

  private createArenaBackground() {
    this.arenaBackground?.destroy();
    this.arenaBackground = new ArenaBackground(this);
    this.arenaBackground.setTheme('space');
  }

  update(_: number, delta: number) {
    if (this.arenaBackground) this.arenaBackground.update(delta);
    if (this.gameOver) return;
    this.updateBullets();
    this.updateEnemies(); // Add enemy cleanup
    if (this.drone) this.drone.update(this.time.now);
    if (this.player) this.player.update();
    if (this.reloadingBar) this.reloadingBar.update();
    // UI indicators
    this.gameUI.setDroneActive(!!this.drone);
    this.gameUI.setShieldActive(false); // MainScene doesn't have shield functionality
    this.updateTimer(); // Update timer display
  }

   private createTextures() {
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
    enemyBulletG.destroy();    const playerColor = getPlayerColor();
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
  }

  private createPlayer() {
    this.player = new Player(this, this.scale.width / 2, this.scale.height / 2);
    // Ensure tint is applied even if Player constructor ran before color persisted
    const color = getPlayerColor();
    if (typeof color === 'number') {
      this.player.setTint(color);
    }
  }

  private createInputs() {
    // Input handling moved to Player class
  }

  private createBullets() {
    const playerStats = this.upgradeManager.getPlayerStats();
    this.bullets = this.physics.add.group({
      defaultKey: 'bullet',
      maxSize: Math.max(playerStats.maxAmmo, GAME_SETTINGS.weapons.bullet.maxAmmo)
    });
  }

   private createEnemyBullets() {
     this.enemyBullets = this.physics.add.group({ defaultKey: 'enemy_bullet', maxSize: 200 });
   }

   private createEnemies() {    this.enemies = this.physics.add.group({
      runChildUpdate: true
    });
    this.enemySpawner = new EnemySpawner(this, this.enemies, this.player);
  }

  private createUI() {
    this.gameUI = new GameUI(this);
    this.gameUI.updateAmmo(this.ammo);
    this.gameUI.updateSnacks(getSnacks());
    this.gameUI.updateScore(this.score);
    this.gameUI.hideWaveProgress(); // Hide wave progress in endless mode
  }

  private createReloadingBar() {
    this.reloadingBar = new ReloadingBar(this, this.player);
  }

  private createDifficultyManager() {
    this.difficultyManager = new DifficultyManager();
  }

  private setupCollisions() {
    this.physics.add.overlap(this.bullets, this.enemies, this.handleBulletEnemyCollision, undefined, this);
    this.physics.add.collider(this.player, this.enemies, this.handlePlayerEnemyCollision, undefined, this);
    this.physics.add.overlap(this.player, this.enemyBullets, (playerObj, bulletObj) => this.handlePlayerHitByEnemyBullet(playerObj as Phaser.GameObjects.GameObject, bulletObj as Phaser.GameObjects.GameObject), undefined, this);
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
    // ESC key to pause game
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.gameOver) {
        this.pauseGame();
      }
    });
  }

  private pauseGame() {
    // Pause the current scene and launch pause menu
    this.scene.pause();
    this.scene.launch('PauseMenuScene', { parentScene: 'MainScene' });
  }

  private handleBulletEnemyCollision(bullet: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, enemy: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile) {
    const bulletObj = bullet as Phaser.GameObjects.Sprite & { pierceLeft?: number, bounceLeft?: number };
    const enemyObj = enemy as Enemy;

    // Don't process if bullet is already inactive or enemy is already destroyed
    if (!bulletObj.active || !enemyObj.active) return;

    const b = bulletObj as Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent, pierceLeft?: number, bounceLeft?: number };
    const hadPierce = (b.pierceLeft ?? 0) > 0;
    if (hadPierce) {
      b.pierceLeft = (b.pierceLeft ?? 0) - 1;
      if (b.body) b.body.velocity.scale(1.0);
    } else if ((b.bounceLeft ?? 0) > 0) {
      if (b.body) {
        b.bounceLeft = (b.bounceLeft ?? 0) - 1;
        const bx = (bulletObj as unknown as { x?: number }).x ?? 0;
        const by = (bulletObj as unknown as { y?: number }).y ?? 0;
        const target = this.getNearestEnemy(bx, by);
        if (target) {
          const ts = target as Phaser.GameObjects.Sprite;
          const dx = ts.x - bx;
          const dy = ts.y - by;
          const len = Math.hypot(dx, dy) || 1;
          const speed = b.body.velocity.length();
          b.body.velocity.set((dx / len) * speed, (dy / len) * speed);
        } else {
          b.body.velocity.set(-b.body.velocity.x, -b.body.velocity.y);
          b.body.velocity.rotate(Phaser.Math.FloatBetween(-0.2, 0.2));
        }
      }
    } else {
      b.setActive(false).setVisible(false);
    }

    const playerStats = this.upgradeManager.getPlayerStats();
    const fromDrone = (bulletObj as unknown as { getData?: (k: string) => unknown }).getData?.('fromDrone') === true;
    const customDroneDmg = (bulletObj as unknown as { getData?: (k: string) => unknown }).getData?.('droneDamage');
    const dmg = fromDrone ? Math.max(1, Math.ceil((typeof customDroneDmg === 'number' ? customDroneDmg : playerStats.bulletDamage * 0.5))) : playerStats.bulletDamage;
    const isDead = enemyObj.takeDamage(dmg);
    if (isDead) {
      this.score += enemyObj.getScoreValue();
      // Split behavior: if splitter, spawn minis
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
      this.updateDifficulty();
      this.gameUI.updateScore(this.score);
    }
  }

  private handlePlayerEnemyCollision(player: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, enemy: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile) {
    const enemyObj = enemy as Enemy;
    // Split behavior on collision as well
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
    this.spawnTimer.paused = true;
    this.player.setTint(0xff0000);
    this.gameOver = true;
    this.gameUI.showGameOver(
      () => this.resetGame(),
      () => this.scene.start('StartMenuScene'),
      () => this.scene.start('ScoreEntryScene', { score: this.score, time: this.getGameTime(), gameMode: 'main' })
    );
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

    // Compute safe direction to avoid zero-length vector when clicking on player
    const dx = pointer.x - this.player.x;
    const dy = pointer.y - this.player.y;
    const len = Math.hypot(dx, dy);
    const dirX = len > 0.0001 ? dx / len : 1;
    const dirY = len > 0.0001 ? dy / len : 0;
    // Offset spawn so the bullet doesn't start inside the player
    const spawnOffset = 18;
    const spawnX = this.player.x + dirX * spawnOffset;
    const spawnY = this.player.y + dirY * spawnOffset;

    const bullet = this.bullets.get(spawnX, spawnY) as (Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent, pierceLeft?: number, bounceLeft?: number }) | null;
    if (bullet) {
      bullet.setActive(true).setVisible(true);
      const playerStats = this.upgradeManager.getPlayerStats();
      if (bullet.body) {
        bullet.body.velocity.set(dirX * playerStats.bulletSpeed, dirY * playerStats.bulletSpeed);
      } else {
        this.physics.moveTo(bullet, spawnX + dirX * 10, spawnY + dirY * 10, playerStats.bulletSpeed);
      }

      // Safety TTL to avoid rare stuck bullets
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
    const bullet = this.bullets.get(x, y) as (Phaser.GameObjects.Sprite & { body?: Phaser.Physics.Arcade.Body, ttlEvent?: Phaser.Time.TimerEvent }) | null;
    if (!bullet) return;
    bullet.setActive(true).setVisible(true);
    const asObj = bullet as unknown as { setData?: (k: string, v: unknown) => void }
    if (typeof asObj.setData === 'function') asObj.setData('fromDrone', true)
    // Apply pet bullet speed upgrade
    {
      const mult = Math.max(0.5, getBulletSpeedMultiplier())
      if (bullet.body) bullet.body.velocity.set(dirX * 350 * mult, dirY * 350 * mult);
    }
    bullet.ttlEvent?.remove(false);
    bullet.ttlEvent = this.time.delayedCall(2000, () => {
      if (bullet.active) bullet.setActive(false).setVisible(false);
      bullet.ttlEvent = undefined;
    });
    const asObj2 = bullet as unknown as { setData?: (k: string, v: unknown) => void }
    if (typeof asObj2.setData === 'function') asObj2.setData('droneDamage', damage)
    // Apply size multiplier visually
    {
      const s = Math.max(0.5, getBulletSizeMultiplier())
      bullet.setScale(s)
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
      // Note: reloadingBar.hide() is called automatically by the ReloadingBar class
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
      const enemySprite = enemy as Phaser.GameObjects.Sprite;
      if (enemySprite.x < -margin || 
          enemySprite.x > this.scale.width + margin || 
          enemySprite.y < -margin || 
          enemySprite.y > this.scale.height + margin) {
        enemySprite.destroy();
      }
    }

    if (this.enemyBullets) {
      for (const b of this.enemyBullets.getMatching('active', true)) {
        const bs = b as Phaser.GameObjects.Sprite;
        if (bs.x < -16 || bs.x > this.scale.width + 16 || bs.y < -16 || bs.y > this.scale.height + 16) {
          bs.setActive(false).setVisible(false);
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
    this.score = 0; // Reset session score, keep total score from ScoreManager
    
    // Refresh player stats in case upgrades were purchased
    this.initializePlayerStats();
    
    this.isReloading = false;
    this.gameStartTime = Date.now(); // Reset timer
    
    this.player.setPosition(this.scale.width / 2, this.scale.height / 2);
    this.player.reset();
    this.gameUI.reset();
    this.gameUI.updateSnacks(getSnacks());
    this.gameUI.hideLeaderboard();
    this.reloadingBar.hide(); // Hide reloading bar if it's showing
    this.difficultyManager.reset(); // Reset difficulty
    
    this.enemies.clear(true, true);
    this.bullets.clear(true, true);
    if (this.drone) { this.drone.destroy(); this.drone = undefined; }
    
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
