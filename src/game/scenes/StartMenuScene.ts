import * as Phaser from 'phaser';
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
    console.log('StartMenuScene created'); // Debug log
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Create Swedish-themed background
    this.createSwedishBackground();

    // Game Title
    this.titleText = this.add.text(centerX, centerY - 200, 'Welcome!', {
      fontSize: '64px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

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
        console.log('Leaderboard button clicked'); // Debug log
        this.showLeaderboard();
      }, this)
      .on('pointerover', () => this.leaderboardButton.setStyle({ backgroundColor: '#006666' }))
      .on('pointerout', () => this.leaderboardButton.setStyle({ backgroundColor: '#004444' }));



    // Instructions
    this.add.text(this.scale.width / 2, this.scale.height - 60, 'Ctrl+Shift+R to reset leaderboard', {
      fontSize: '16px',
      color: '#666666'
    }).setOrigin(0.5);

    // Add some decorative elements
    this.createStars();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  private createSwedishBackground() {
    // Swedish flag colors: blue (#006AA7) and yellow (#FECC00)
    const blueColor = 0x006AA7;
    const yellowColor = 0xFECC00;
    
    // Create base blue background
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, blueColor).setOrigin(0, 0);
    
    // Add Swedish flag cross pattern (simplified and artistic)
    const crossWidth = 40;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    
    // Vertical stripe (slightly off-center like Swedish flag)
    const verticalX = centerX - this.scale.width * 0.1;
    this.add.rectangle(verticalX, 0, crossWidth, this.scale.height, yellowColor).setOrigin(0.5, 0).setAlpha(0.3);
    
    // Horizontal stripe
    this.add.rectangle(0, centerY, this.scale.width, crossWidth, yellowColor).setOrigin(0, 0.5).setAlpha(0.3);
    
    // Add some Nordic-style decorative elements
    this.createNordicPatterns();
  }

  private createNordicPatterns() {
    // Add subtle Nordic-inspired geometric patterns
    const patternColor = 0xFFFFFF;
    const alpha = 0.1;
    
    // Create diamond patterns in corners
    for (let corner = 0; corner < 4; corner++) {
      const x = corner < 2 ? 100 : this.scale.width - 100;
      const y = corner % 2 === 0 ? 100 : this.scale.height - 100;
      
      // Small diamond pattern
      for (let i = 0; i < 3; i++) {
        const size = 20 + i * 10;
        const diamond = this.add.graphics();
        diamond.lineStyle(2, patternColor, alpha);
        diamond.strokeRect(x - size/2, y - size/2, size, size);
        diamond.setRotation(Math.PI / 4); // 45 degree rotation for diamond
      }
    }
  }

  private createStars() {
    // Add some background stars for decoration
    for (let i = 0; i < 100; i++) {
      const x = Phaser.Math.Between(0, this.scale.width);
      const y = Phaser.Math.Between(0, this.scale.height);
      const star = this.add.circle(x, y, Phaser.Math.Between(1, 3), 0xffffff, 0.8);
      
      // Add twinkling effect
      this.tweens.add({
        targets: star,
        alpha: { from: 0.2, to: 1 },
        duration: Phaser.Math.Between(1000, 3000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000)
      });
    }
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
    console.log(`${mode} leaderboard data:`, scores);

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
}