import * as Phaser from 'phaser';

export class StartMenuScene extends Phaser.Scene {
  private startButton!: Phaser.GameObjects.Text;
  private optionsButton!: Phaser.GameObjects.Text;
  private leaderboardButton!: Phaser.GameObjects.Text;
  private gameModesButton!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private leaderboardDisplay?: Phaser.GameObjects.Text;
  private backButton?: Phaser.GameObjects.Text;
  private showingLeaderboard = false;

  constructor() {
    super({ key: 'StartMenuScene' });
  }

  init() {
    // Reset any state when the scene starts
    this.showingLeaderboard = false;
  }

  create() {
    console.log('StartMenuScene created'); // Debug log
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Create background
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x001122).setOrigin(0, 0);

    // Game Title
    this.titleText = this.add.text(centerX, centerY - 200, 'SPACE SHOOTER', {
      fontSize: '64px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Start Game Button
    this.startButton = this.add.text(centerX, centerY - 80, 'START GAME', {
      fontSize: '32px',
      color: '#00ff00',
      backgroundColor: '#004400',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.startGame, this)
      .on('pointerover', () => this.startButton.setStyle({ backgroundColor: '#006600' }))
      .on('pointerout', () => this.startButton.setStyle({ backgroundColor: '#004400' }));

    // Options Button
    this.optionsButton = this.add.text(centerX, centerY - 20, 'OPTIONS', {
      fontSize: '32px',
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

    // Game Modes Button
    this.gameModesButton = this.add.text(centerX, centerY + 100, 'GAME MODES', {
      fontSize: '32px',
      color: '#ff00ff',
      backgroundColor: '#440044',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.showGameModes, this)
      .on('pointerover', () => this.gameModesButton.setStyle({ backgroundColor: '#660066' }))
      .on('pointerout', () => this.gameModesButton.setStyle({ backgroundColor: '#440044' }));

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

  private showOptions() {
    // Placeholder for future options implementation
    this.add.text(this.scale.width / 2, this.scale.height - 100, 'Options coming soon!', {
      fontSize: '24px',
      color: '#ffff00'
    }).setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      this.scene.restart();
    });
  }

  private showLeaderboard() {
    if (this.showingLeaderboard) return;

    this.showingLeaderboard = true;
    
    // Hide main menu buttons
    this.startButton.setVisible(false);
    this.optionsButton.setVisible(false);
    this.leaderboardButton.setVisible(false);
    this.gameModesButton.setVisible(false);

    // Get scores from localStorage
    const scores = JSON.parse(localStorage.getItem('leaderboard') || '[]');
    console.log('Leaderboard data:', scores); // Debug log
    
    let leaderboardText = 'LEADERBOARD\n\n';
    if (scores.length === 0) {
      leaderboardText += 'No scores yet!\nPlay a game to set your first score.';
    } else {
      scores.slice(0, 10).forEach((entry: number | {name?: string, score: number, time: number}, index: number) => {
        console.log('Processing entry:', entry, 'Type:', typeof entry); // Debug log
        
        if (typeof entry === 'number') {
          // Old format - just score
          leaderboardText += `${index + 1}. ${entry.toLocaleString()}\n`;
        } else if (entry && typeof entry === 'object') {
          // New format with name, score, and time
          const name = entry.name || 'Anonymous';
          const score = entry.score || 0;
          const time = entry.time || 0;
          
          const minutes = Math.floor(time / 60);
          const seconds = time % 60;
          const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          
          leaderboardText += `${index + 1}. ${name}: ${score.toLocaleString()} (${formattedTime})\n`;
        } else {
          // Fallback for corrupted data
          leaderboardText += `${index + 1}. Invalid entry\n`;
        }
      });
    }

    this.leaderboardDisplay = this.add.text(this.scale.width / 2, this.scale.height / 2, leaderboardText, {
      fontSize: '28px',
      color: '#ffffff',
      align: 'center',
      backgroundColor: '#000044',
      padding: { x: 30, y: 20 }
    }).setOrigin(0.5);

    // Back button
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

  private hideLeaderboard() {
    console.log('hideLeaderboard called, currently showing:', this.showingLeaderboard); // Debug log
    if (!this.showingLeaderboard) return;

    this.showingLeaderboard = false;

    // Show main menu buttons
    this.startButton.setVisible(true);
    this.optionsButton.setVisible(true);
    this.leaderboardButton.setVisible(true);
    this.gameModesButton.setVisible(true);

    // Hide leaderboard display
    if (this.leaderboardDisplay) {
      this.leaderboardDisplay.destroy();
      this.leaderboardDisplay = undefined;
    }

    if (this.backButton) {
      this.backButton.destroy();
      this.backButton = undefined;
    }
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
    // Clear leaderboard data
    localStorage.removeItem('leaderboard');
    
    // Show confirmation message
    const confirmText = this.add.text(this.scale.width / 2, this.scale.height - 100, 'Leaderboard Reset!', {
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
    // Placeholder for future game modes implementation
    this.add.text(this.scale.width / 2, this.scale.height - 100, 'Game Modes coming soon!', {
      fontSize: '24px',
      color: '#ff00ff'
    }).setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      this.scene.restart();
    });
  }
}