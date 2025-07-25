import * as Phaser from 'phaser';

export class ScoreEntryScene extends Phaser.Scene {
  private score: number = 0;
  private gameTime: number = 0;
  private nameInput!: Phaser.GameObjects.Text;
  private currentName: string = '';
  private maxNameLength: number = 12;
  private saveButton!: Phaser.GameObjects.Text;
  private skipButton!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'ScoreEntryScene' });
  }

  init(data: { score: number, time: number }) {
    this.score = data.score;
    this.gameTime = data.time;
    this.currentName = '';
  }

  create() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Background
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000033).setOrigin(0, 0);

    // Title
    this.add.text(centerX, centerY - 150, 'NEW HIGH SCORE!', {
      fontSize: '48px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Score and time display
    const minutes = Math.floor(this.gameTime / 60);
    const seconds = this.gameTime % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    this.add.text(centerX, centerY - 80, `Score: ${this.score.toLocaleString()}`, {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.add.text(centerX, centerY - 40, `Time: ${formattedTime}`, {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Instructions
    this.instructionText = this.add.text(centerX, centerY + 20, 'Enter your name:', {
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Name input display
    this.nameInput = this.add.text(centerX, centerY + 70, '_', {
      fontSize: '36px',
      color: '#00ff00',
      backgroundColor: '#003300',
      padding: { x: 20, y: 10 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Save button
    this.saveButton = this.add.text(centerX - 80, centerY + 140, 'SAVE', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#004400',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.saveScore, this)
      .on('pointerover', () => this.saveButton.setStyle({ backgroundColor: '#006600' }))
      .on('pointerout', () => this.saveButton.setStyle({ backgroundColor: '#004400' }));

    // Skip button
    this.skipButton = this.add.text(centerX + 80, centerY + 140, 'SKIP', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#444400',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.skipScore, this)
      .on('pointerover', () => this.skipButton.setStyle({ backgroundColor: '#666600' }))
      .on('pointerout', () => this.skipButton.setStyle({ backgroundColor: '#444400' }));

    // Setup keyboard input
    this.input.keyboard?.on('keydown', this.handleKeyInput, this);

    this.updateNameDisplay();
  }

  private handleKeyInput(event: KeyboardEvent) {
    const key = event.key;

    if (key === 'Enter') {
      this.saveScore();
      return;
    }

    if (key === 'Escape') {
      this.skipScore();
      return;
    }

    if (key === 'Backspace') {
      if (this.currentName.length > 0) {
        this.currentName = this.currentName.slice(0, -1);
        this.updateNameDisplay();
      }
      return;
    }

    // Only allow letters, numbers, and some special characters
    if (key.length === 1 && /[a-zA-Z0-9\-_\s]/.test(key) && this.currentName.length < this.maxNameLength) {
      this.currentName += key;
      this.updateNameDisplay();
    }
  }

  private updateNameDisplay() {
    const displayName = this.currentName || '_';
    this.nameInput.setText(displayName);
  }

  private saveScore() {
    const name = this.currentName.trim() || 'Anonymous';
    
    // Get existing scores
    const scores = JSON.parse(localStorage.getItem('leaderboard') || '[]');
    
    // Add new score entry
    const newEntry = {
      name: name,
      score: this.score,
      time: this.gameTime,
      date: new Date().toISOString()
    };
    
    scores.push(newEntry);
    
    // Sort by score first (highest first), then by time (fastest first) for same scores
    scores.sort((a: {score: number, time: number}, b: {score: number, time: number}) => {
      if (b.score !== a.score) {
        return b.score - a.score; // Higher score wins
      }
      // Same score, faster time wins (lower time is better)
      return a.time - b.time;
    });
    
    // Keep only top 10
    localStorage.setItem('leaderboard', JSON.stringify(scores.slice(0, 10)));
    
    // Go to start menu
    this.scene.start('StartMenuScene');
  }

  private skipScore() {
    // Go directly to start menu without saving
    this.scene.start('StartMenuScene');
  }
}