import * as Phaser from 'phaser';
import { IS_DEV } from '../config/gameConfig';
import { fetchTopScoresConvex } from '@/lib/convexClient';

export class StartMenuScene extends Phaser.Scene {
  private startButton!: Phaser.GameObjects.Text;
  private optionsButton!: Phaser.GameObjects.Text;
  private leaderboardButton!: Phaser.GameObjects.Text;
  private gameModesButton?: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private leaderboardTitle?: Phaser.GameObjects.Text;
  private leaderboardDisplay?: Phaser.GameObjects.Text;
  private leaderboardContainer?: Phaser.GameObjects.Container;
  private leaderboardScrollY: number = 0;
  private leaderboardHeader?: Phaser.GameObjects.Text;
  private leaderboardBg?: Phaser.GameObjects.Rectangle;
  private leaderboardMaskShape?: Phaser.GameObjects.Rectangle;
  private leaderboardHeaderRow?: Phaser.GameObjects.Container;
  private backButton?: Phaser.GameObjects.Text;
  private classicButton?: Phaser.GameObjects.Text;
  private waveButton?: Phaser.GameObjects.Text;
  private modesBackButton?: Phaser.GameObjects.Text;
  private showingLeaderboard = false;
  private showingModes = false;
  private currentLeaderboardMode: 'endless' | 'wave' = 'endless';
  // Background FX
  private bgStarsFar?: Phaser.GameObjects.Group;
  private bgStarsNear?: Phaser.GameObjects.Group;
  private bgEnemies?: Phaser.GameObjects.Group;
  private bgTimers: Phaser.Time.TimerEvent[] = [];
  private bgUpdateActive = false;

  constructor() {
    super({ key: 'StartMenuScene' });
  }

  init() {
    // Reset any state when the scene starts
    this.showingLeaderboard = false;
    this.showingModes = false;
    this.currentLeaderboardMode = 'endless';
  }

  create() {
    if (IS_DEV) console.log('StartMenuScene created'); // Debug log
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Create arcade shooter themed background
    this.createShooterBackground();

    // Game Title
    this.titleText = this.add.text(centerX, centerY - 200, 'BOSS RUSH', {
      fontSize: '72px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.titleText.setShadow(0, 0, '#ff3366', 24, true, true);
    this.tweens.add({ targets: this.titleText, scale: { from: 1.0, to: 1.06 }, yoyo: true, duration: 1200, repeat: -1, ease: 'Sine.InOut' });

    // Primary Game Modes Button
    this.startButton = this.add.text(centerX, centerY - 80, 'GAME MODES', {
      fontSize: '28px',
      color: '#00ff00',
      backgroundColor: '#004400',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.showGameModes, this)
      .on('pointerover', () => this.startButton.setStyle({ backgroundColor: '#006600' }))
      .on('pointerout', () => this.startButton.setStyle({ backgroundColor: '#004400' }));

    // Customization Button
    this.optionsButton = this.add.text(centerX, centerY - 20, 'CUSTOMIZE', {
      fontSize: '28px',
      color: '#ffff00',
      backgroundColor: '#444400',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.showOptions, this)
      .on('pointerover', () => this.optionsButton.setStyle({ backgroundColor: '#666600' }))
      .on('pointerout', () => this.optionsButton.setStyle({ backgroundColor: '#444400' }));

    // Leaderboard Button
    this.leaderboardButton = this.add.text(centerX, centerY + 40, 'LEADERBOARD', {
      fontSize: '32px',
      color: '#00ffff',
      backgroundColor: '#004444',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (IS_DEV) console.log('Leaderboard button clicked'); // Debug log
        this.showLeaderboard();
      }, this)
      .on('pointerover', () => this.leaderboardButton.setStyle({ backgroundColor: '#006666' }))
      .on('pointerout', () => this.leaderboardButton.setStyle({ backgroundColor: '#004444' }));



    // Instructions
    this.add.text(this.scale.width / 2, this.scale.height - 60, 'Ctrl+Shift+R to reset leaderboard', {
      fontSize: '16px',
      color: '#666666'
    }).setOrigin(0.5);

    // Add scanline overlay
    this.createScanlines();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Ensure WebAudio context resumes only after a user gesture to avoid browser warnings
    this.setupAudioUnlock();
  }

  private createShooterBackground() {
    const w = this.scale.width, h = this.scale.height;
    // Dark gradient-like fill
    const bg = this.add.rectangle(0, 0, w, h, 0x0a0a1a).setOrigin(0, 0);
    bg.setFillStyle(0x0a0a1a, 1);

    this.buildBackgroundTextures();

    // Parallax stars
    this.bgStarsFar = this.add.group();
    this.bgStarsNear = this.add.group();
    for (let i = 0; i < 140; i++) {
      const s = this.add.image(Phaser.Math.Between(0, w), Phaser.Math.Between(0, h), 'star_small').setAlpha(0.6);
      this.bgStarsFar.add(s);
    }
    for (let i = 0; i < 80; i++) {
      const s = this.add.image(Phaser.Math.Between(0, w), Phaser.Math.Between(0, h), 'star_big').setAlpha(0.9);
      this.bgStarsNear.add(s);
    }

    // Background enemies
    this.bgEnemies = this.add.group();
    for (let i = 0; i < 10; i++) this.spawnBgEnemy();

    // Flash indicator
    const flashTimer = this.time.addEvent({ delay: 6500, loop: true, callback: () => this.bossFlash() });
    this.bgTimers.push(flashTimer);
    this.bgUpdateActive = true;
  }

  private buildBackgroundTextures() {
    // Stars
    const s1 = this.make.graphics({}, false);
    s1.fillStyle(0xffffff, 1).fillCircle(2, 2, 2);
    s1.generateTexture('star_small', 4, 4); s1.destroy();
    const s2 = this.make.graphics({}, false);
    s2.fillStyle(0xffffff, 1).fillCircle(3, 3, 3);
    s2.generateTexture('star_big', 6, 6); s2.destroy();

    // Enemy triangle
    const tri = this.make.graphics({}, false);
    tri.fillStyle(0x33ffaa, 0.9);
    tri.beginPath(); tri.moveTo(12, 0); tri.lineTo(24, 24); tri.lineTo(0, 24); tri.closePath(); tri.fillPath();
    tri.generateTexture('bg_enemy_tri', 24, 24); tri.destroy();

    // Boss silhouette
    const boss = this.make.graphics({}, false);
    boss.fillStyle(0xff3366, 0.7);
    boss.fillRoundedRect(0, 0, 140, 140, 18);
    boss.fillStyle(0x000000, 0.25);
    boss.fillCircle(40, 50, 8); boss.fillCircle(100, 50, 8);
    boss.generateTexture('bg_boss_sil', 140, 140); boss.destroy();
  }

  private spawnBgEnemy() {
    if (!this.bgEnemies) return;
    const w = this.scale.width, h = this.scale.height;
    const x = Phaser.Math.Between(-40, w + 40);
    const y = Phaser.Math.Between(-40, h + 40);
    const s = this.add.image(x, y, 'bg_enemy_tri').setAlpha(0.4);
    this.bgEnemies.add(s);
    const dir = new Phaser.Math.Vector2(Phaser.Math.FloatBetween(-1, 1), Phaser.Math.FloatBetween(-1, 1)).normalize();
    const speed = Phaser.Math.Between(8, 18);
    this.tweens.add({ targets: s, angle: Phaser.Math.Between(-180, 180), duration: 4000, repeat: -1, yoyo: true, ease: 'Sine.InOut' });
    const t = this.time.addEvent({ delay: 16, loop: true, callback: () => {
      s.x += dir.x * speed * (16/1000);
      s.y += dir.y * speed * (16/1000);
      if (s.x < -60) s.x = w + 60; if (s.x > w + 60) s.x = -60;
      if (s.y < -60) s.y = h + 60; if (s.y > h + 60) s.y = -60;
    }});
    this.bgTimers.push(t);
  }

  private bossFlash() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const img = this.add.image(centerX, centerY - 60, 'bg_boss_sil').setAlpha(0).setScale(0.6);
    const txt = this.add.text(centerX, centerY + 40, 'WARNING: BOSS ENCOUNTER', { fontSize: '32px', color: '#ff3366', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0);
    this.cameras.main.shake(200, 0.01);
    this.tweens.add({ targets: [img, txt], alpha: { from: 0, to: 1 }, duration: 220, yoyo: true, onComplete: () => { img.destroy(); txt.destroy(); } });
  }

  private createScanlines() {
    const w = this.scale.width, h = this.scale.height;
    const g = this.make.graphics({}, false);
    g.fillStyle(0x000000, 0.12);
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2);
    g.generateTexture('scanlines', Math.max(2, Math.floor(w)), Math.max(2, Math.floor(h)));
    g.destroy();
    const sl = this.add.image(0, 0, 'scanlines').setOrigin(0, 0).setAlpha(0.3);
    this.tweens.add({ targets: sl, alpha: { from: 0.2, to: 0.35 }, duration: 1800, yoyo: true, repeat: -1 });
  }

  private startGame() {
    this.scene.start('MainScene');
  }

  private startWaveMode() {
    this.scene.start('WaveScene');
  }

  private showOptions() {
    // Go to customization scene
    this.scene.start('CustomizationScene');
  }

  private showLeaderboard() {
    if (this.showingLeaderboard) return;

    this.showingLeaderboard = true;

    // Hide main menu buttons
    this.startButton.setVisible(false);
    this.optionsButton.setVisible(false);
    this.leaderboardButton.setVisible(false);
    this.gameModesButton?.setVisible(false);
    this.titleText.setVisible(false);

    // Show leaderboard mode selection
    this.showLeaderboardModeSelection();
  }

  private showLeaderboardModeSelection() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Mode selection title
    if (this.leaderboardTitle) { this.leaderboardTitle.destroy(); this.leaderboardTitle = undefined; }
    this.leaderboardTitle = this.add.text(centerX, centerY - 200, 'SELECT LEADERBOARD', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Classic mode button (above the list)
    this.classicButton = this.add.text(centerX - 100, centerY - 140, 'CLASSIC', {
      fontSize: '24px',
      color: '#00ff00',
      backgroundColor: this.currentLeaderboardMode === 'endless' ? '#006600' : '#004400',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { if (this.currentLeaderboardMode !== 'endless') this.showSpecificLeaderboard('endless'); }, this)
      .on('pointerover', () => this.classicButton?.setStyle({ backgroundColor: '#006600' }))
      .on('pointerout', () => this.classicButton?.setStyle({ 
        backgroundColor: this.currentLeaderboardMode === 'endless' ? '#006600' : '#004400' 
      }));

    // Wave mode button (above the list)
    this.waveButton = this.add.text(centerX + 100, centerY - 140, 'WAVE', {
      fontSize: '24px',
      color: '#ff00ff',
      backgroundColor: this.currentLeaderboardMode === 'wave' ? '#660066' : '#440044',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { if (this.currentLeaderboardMode !== 'wave') this.showSpecificLeaderboard('wave'); }, this)
      .on('pointerover', () => this.waveButton?.setStyle({ backgroundColor: '#660066' }))
      .on('pointerout', () => this.waveButton?.setStyle({ 
        backgroundColor: this.currentLeaderboardMode === 'wave' ? '#660066' : '#440044' 
      }));

    // Back button below the list (create once)
    if (!this.backButton) {
      this.backButton = this.add.text(centerX, centerY + 220, 'BACK', {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#660000',
        padding: { x: 20, y: 10 }
      }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', this.hideLeaderboard, this)
        .on('pointerover', () => this.backButton?.setStyle({ backgroundColor: '#880000' }))
        .on('pointerout', () => this.backButton?.setStyle({ backgroundColor: '#660000' }));
    }

    // Show the default leaderboard
    this.showSpecificLeaderboard(this.currentLeaderboardMode);
  }

  private async showSpecificLeaderboard(mode: 'endless' | 'wave') {
    this.currentLeaderboardMode = mode;

    // Update button styles
    if (this.classicButton) {
      this.classicButton.setStyle({ 
        backgroundColor: mode === 'endless' ? '#006600' : '#004400' 
      });
    }
    if (this.waveButton) {
      this.waveButton.setStyle({ 
        backgroundColor: mode === 'wave' ? '#660066' : '#440044' 
      });
    }

    // Remove existing leaderboard display and listeners
    if (this.leaderboardDisplay) {
      this.leaderboardDisplay.destroy();
      this.leaderboardDisplay = undefined;
    }
    if (this.leaderboardContainer) {
      this.leaderboardContainer.destroy(true);
      this.leaderboardContainer = undefined;
    }
    this.input.removeAllListeners('wheel');
    this.leaderboardScrollY = 0;

    // Get scores for the selected mode
    const leaderboardKey = mode === 'wave' ? 'leaderboard_wave' : 'leaderboard';
    // Try online first, fallback to local
    let scores: Array<{name?: string, score: number, time: number, createdAt?: number}> = [];
    const online = await fetchTopScoresConvex(mode === 'wave' ? 'wave' : 'endless', 50);
    if (online && online.length) {
      scores = online;
    }
    if (!scores || scores.length === 0) {
      scores = JSON.parse(localStorage.getItem(leaderboardKey) || '[]');
    }
    if (IS_DEV) console.log(`${mode} leaderboard data:`, scores);

    // Header
    if (this.leaderboardHeader) { this.leaderboardHeader.destroy(); this.leaderboardHeader = undefined; }
    this.leaderboardHeader = this.add.text(this.scale.width / 2, this.scale.height / 2 - 140, `${mode.toUpperCase()} MODE LEADERBOARD`, {
      fontSize: '28px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Panel and container
    const listX = this.scale.width / 2;
    const listY = this.scale.height / 2 + 10;
    const rowHeight = 28;
    const panelWidth = Math.min(this.scale.width * 0.8, 900);
    const panelHeight = 340;
    const maxVisible = Math.floor(panelHeight / rowHeight);

    if (this.leaderboardBg) { this.leaderboardBg.destroy(); this.leaderboardBg = undefined; }
    this.leaderboardBg = this.add.rectangle(listX, listY, panelWidth, maxVisible * rowHeight + 40, 0x001133, 0.75)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x00ffff, 0.6);

    // Column headers
    const colRankX = -panelWidth / 2 + 40;
    const colNameX = -panelWidth / 2 + 100;
    const colScoreX = panelWidth / 2 - 220;
    const colTimeX = panelWidth / 2 - 120;
    const colDateX = panelWidth / 2 - 20;

    const headerY = listY - (maxVisible * rowHeight) / 2 - 10;
    const header = this.add.container(listX, headerY);
    const headerBg = this.add.rectangle(0, 0, panelWidth, 30, 0x003355, 0.9)
      .setOrigin(0.5);
    header.add(headerBg);
    const hdrStyle = { fontSize: '16px', color: '#aeefff' } as Phaser.Types.GameObjects.Text.TextStyle;
    header.add(this.add.text(colRankX, 0, '#', hdrStyle).setOrigin(0, 0.5));
    header.add(this.add.text(colNameX, 0, 'Name', hdrStyle).setOrigin(0, 0.5));
    header.add(this.add.text(colScoreX, 0, 'Score', hdrStyle).setOrigin(0, 0.5));
    header.add(this.add.text(colTimeX, 0, 'Time', hdrStyle).setOrigin(0, 0.5));
    header.add(this.add.text(colDateX, 0, 'Date', hdrStyle).setOrigin(1, 0.5));
    // Save to clear later
    this.leaderboardHeaderRow?.destroy(true);
    this.leaderboardHeaderRow = header;

    // Scrollable rows container
    this.leaderboardContainer = this.add.container(listX, listY - (maxVisible * rowHeight) / 2);
    this.leaderboardScrollY = 0;

    const formatTime = (secondsVal: number) => {
      const m = Math.floor((secondsVal || 0) / 60);
      const s = (secondsVal || 0) % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const rowStyle = { fontSize: '16px', color: '#ffffff' } as Phaser.Types.GameObjects.Text.TextStyle;

    if (scores.length === 0) {
      const empty = this.add.text(listX, listY, 'No scores yet!\nPlay a game to set your first score.', { fontSize: '18px', color: '#ffffff', align: 'center' })
        .setOrigin(0.5);
      this.leaderboardContainer.add(empty);
    } else {
      scores.forEach((entry, index) => {
        const y = index * rowHeight;
        const isAlt = index % 2 === 1;
        const bg = this.add.rectangle(0, y, panelWidth, rowHeight, isAlt ? 0x002244 : 0x001a33, 0.6).setOrigin(0.5, 0);
        this.leaderboardContainer?.add(bg);

        // Rank with medal for top 3
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        const rankText = this.add.text(colRankX, y + rowHeight / 2, `${index + 1}${medal ? ' ' + medal : ''}`, rowStyle).setOrigin(0, 0.5);
        this.leaderboardContainer?.add(rankText);

        // Name
        const name = entry.name || 'Anonymous';
        const nameText = this.add.text(colNameX, y + rowHeight / 2, name, rowStyle).setOrigin(0, 0.5);
        this.leaderboardContainer?.add(nameText);

        // Score
        const scoreText = this.add.text(colScoreX, y + rowHeight / 2, (entry.score || 0).toLocaleString(), rowStyle).setOrigin(0, 0.5);
        this.leaderboardContainer?.add(scoreText);

        // Time
        const timeText = this.add.text(colTimeX, y + rowHeight / 2, formatTime(entry.time || 0), rowStyle).setOrigin(0, 0.5);
        this.leaderboardContainer?.add(timeText);

        // Date
        const dateStr = entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '';
        const dateText = this.add.text(colDateX, y + rowHeight / 2, dateStr, rowStyle).setOrigin(1, 0.5);
        this.leaderboardContainer?.add(dateText);
      });
    }

    // Mask to clip overflow
    if (this.leaderboardMaskShape) { this.leaderboardMaskShape.destroy(); this.leaderboardMaskShape = undefined; }
    this.leaderboardMaskShape = this.add.rectangle(listX, listY + 10, panelWidth, maxVisible * rowHeight, 0x000000, 0).setOrigin(0.5);
    this.leaderboardContainer.setMask(this.leaderboardMaskShape.createGeometryMask());

    // Scroll handlers
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _go: unknown, _dx: number, dy: number) => {
      const totalHeight = (scores.length) * rowHeight;
      const limit = Math.max(0, totalHeight - maxVisible * rowHeight);
      this.leaderboardScrollY = Phaser.Math.Clamp(this.leaderboardScrollY + dy, -limit, 0);
      this.leaderboardContainer?.setY(listY - (maxVisible * rowHeight) / 2 + this.leaderboardScrollY);
    });

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const step = rowHeight * 3;
      const totalHeight = (scores.length) * rowHeight;
      const limit = Math.max(0, totalHeight - maxVisible * rowHeight);
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        this.leaderboardScrollY = Phaser.Math.Clamp(this.leaderboardScrollY + step, -limit, 0);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        this.leaderboardScrollY = Phaser.Math.Clamp(this.leaderboardScrollY - step, -limit, 0);
      }
      this.leaderboardContainer?.setY(listY - (maxVisible * rowHeight) / 2 + this.leaderboardScrollY);
    });

    // Back button (only create once)
    if (!this.backButton) {
      this.backButton = this.add.text(this.scale.width / 2, this.scale.height / 2 + 200, 'BACK', {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#660000',
        padding: { x: 20, y: 10 }
      }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', this.hideLeaderboard, this)
        .on('pointerover', () => this.backButton?.setStyle({ backgroundColor: '#880000' }))
        .on('pointerout', () => this.backButton?.setStyle({ backgroundColor: '#660000' }));
    }
  }

  private hideLeaderboard() {
    if (!this.showingLeaderboard) return;
    this.showingLeaderboard = false;

    this.startButton.setVisible(true);
    this.optionsButton.setVisible(true);
    this.leaderboardButton.setVisible(true);
    this.gameModesButton?.setVisible(true);

    if (this.leaderboardDisplay) { this.leaderboardDisplay.destroy(); this.leaderboardDisplay = undefined; }
    if (this.leaderboardContainer) { this.leaderboardContainer.destroy(true); this.leaderboardContainer = undefined; }
    this.input.removeAllListeners('wheel');
    this.input.keyboard?.removeAllListeners();
    this.currentLeaderboardMode = 'endless';

    if (this.leaderboardHeader) { this.leaderboardHeader.destroy(); this.leaderboardHeader = undefined; }
    if (this.leaderboardBg) { this.leaderboardBg.destroy(); this.leaderboardBg = undefined; }
    if (this.leaderboardMaskShape) { this.leaderboardMaskShape.destroy(); this.leaderboardMaskShape = undefined; }
    if (this.leaderboardHeaderRow) { this.leaderboardHeaderRow.destroy(true); this.leaderboardHeaderRow = undefined; }
    if (this.leaderboardTitle) { this.leaderboardTitle.destroy(); this.leaderboardTitle = undefined; }

    if (this.backButton) { this.backButton.destroy(); this.backButton = undefined; }
    if (this.classicButton) { this.classicButton.destroy(); this.classicButton = undefined; }
    if (this.waveButton) { this.waveButton.destroy(); this.waveButton = undefined; }

    this.titleText.setVisible(true);
  }

  private setupKeyboardShortcuts() {
    // Reset leaderboard with Ctrl+Shift+R
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        this.resetLeaderboard();
      }
    });
  }

  private resetLeaderboard() {
    // Clear leaderboard data for both modes
    localStorage.removeItem('leaderboard');
    localStorage.removeItem('leaderboard_wave');

    // Show confirmation message
    const confirmText = this.add.text(this.scale.width / 2, this.scale.height - 100, 'Leaderboards Reset!', {
      fontSize: '32px',
      color: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Remove message after 2 seconds
    this.time.delayedCall(2000, () => {
      confirmText.destroy();
    });
  }

  private setupAudioUnlock() {
    const tryUnlock = () => {
      try {
        if (this.sound.locked) this.sound.unlock();
        // Best-effort resume for WebAudio; HTML5/NoAudio may not expose context
        const soundAny = this.sound as unknown as { context?: AudioContext };
        const ctx = soundAny.context;
        if (ctx && ctx.state === 'suspended') void ctx.resume();
      } catch {}
    };
    const soundAny = this.sound as unknown as { locked?: boolean; context?: AudioContext };
    if (soundAny.locked || (soundAny.context && soundAny.context.state !== 'running')) {
      this.input.once('pointerdown', tryUnlock);
      this.input.keyboard?.once('keydown', tryUnlock);
    }
  }

  private showGameModes() {
    if (this.showingModes) return;
    this.showingModes = true;

    this.startButton.setVisible(false);
    this.optionsButton.setVisible(false);
    this.leaderboardButton.setVisible(false);
    this.gameModesButton?.setVisible(false);

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;



    this.classicButton = this.add.text(centerX - 100, centerY - 20, 'ENDLESS', {
      fontSize: '28px',
      color: '#00ff00',
      backgroundColor: '#004400',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.startGame, this)
      .on('pointerover', () => this.classicButton?.setStyle({ backgroundColor: '#006600' }))
      .on('pointerout', () => this.classicButton?.setStyle({ backgroundColor: '#004400' }));

    this.waveButton = this.add.text(centerX + 100, centerY - 20, 'WAVE', {
      fontSize: '28px',
      color: '#ff00ff',
      backgroundColor: '#440044',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.startWaveMode, this)
      .on('pointerover', () => this.waveButton?.setStyle({ backgroundColor: '#660066' }))
      .on('pointerout', () => this.waveButton?.setStyle({ backgroundColor: '#440044' }));

    this.modesBackButton = this.add.text(centerX, centerY + 120, 'BACK', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#660000',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hideGameModes(), this)
      .on('pointerover', () => this.modesBackButton?.setStyle({ backgroundColor: '#880000' }))
      .on('pointerout', () => this.modesBackButton?.setStyle({ backgroundColor: '#660000' }));
  }

  private hideGameModes() {
    if (!this.showingModes) return;
    this.showingModes = false;

    this.startButton.setVisible(true);
    this.optionsButton.setVisible(true);
    this.leaderboardButton.setVisible(true);
    this.gameModesButton?.setVisible(true);

    if (this.classicButton) { this.classicButton.destroy(); this.classicButton = undefined; }
    if (this.waveButton) { this.waveButton.destroy(); this.waveButton = undefined; }
    if (this.modesBackButton) { this.modesBackButton.destroy(); this.modesBackButton = undefined; }
  }

  update(_time: number, delta: number) {
    if (!this.bgUpdateActive) return;
    const w = this.scale.width, h = this.scale.height;
    const df = (delta / 1000);
    const moveAndWrap = (img: Phaser.GameObjects.Image, speed: number) => {
      img.y += speed * df;
      if (img.y > h) {
        img.y = -8;
        img.x = Phaser.Math.Between(0, w);
      }
    };
    this.bgStarsFar?.getChildren().forEach(c => moveAndWrap(c as Phaser.GameObjects.Image, 18));
    this.bgStarsNear?.getChildren().forEach(c => moveAndWrap(c as Phaser.GameObjects.Image, 36));
  }

  shutdown() {
    // Clean background timers
    for (const t of this.bgTimers) t.remove(false);
    this.bgTimers = [];
    this.bgUpdateActive = false;
  }
}