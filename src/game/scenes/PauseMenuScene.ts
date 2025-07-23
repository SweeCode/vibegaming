import * as Phaser from 'phaser';

export class PauseMenuScene extends Phaser.Scene {
  private resumeButton!: Phaser.GameObjects.Text;
  private quitButton!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private background!: Phaser.GameObjects.Rectangle;
  private parentScene: string = 'MainScene'; // Default to MainScene

  constructor() {
    super({ key: 'PauseMenuScene' });
  }

  init(data: { parentScene?: string } = {}) {
    this.parentScene = data.parentScene || 'MainScene';
  }

  create() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Semi-transparent dark background
    this.background = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.7)
      .setOrigin(0, 0);

    // Pause title
    this.titleText = this.add.text(centerX, centerY - 100, 'GAME PAUSED', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Resume button
    this.resumeButton = this.add.text(centerX, centerY - 20, 'RESUME', {
      fontSize: '32px',
      color: '#00ff00',
      backgroundColor: '#004400',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.resumeGame, this)
      .on('pointerover', () => this.resumeButton.setStyle({ backgroundColor: '#006600' }))
      .on('pointerout', () => this.resumeButton.setStyle({ backgroundColor: '#004400' }));

    // Quit to menu button
    this.quitButton = this.add.text(centerX, centerY + 40, 'QUIT TO MENU', {
      fontSize: '32px',
      color: '#ff0000',
      backgroundColor: '#440000',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.quitToMenu, this)
      .on('pointerover', () => this.quitButton.setStyle({ backgroundColor: '#660000' }))
      .on('pointerout', () => this.quitButton.setStyle({ backgroundColor: '#440000' }));

    // Instructions
    this.add.text(centerX, centerY + 120, 'Press ESC to resume', {
      fontSize: '20px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // Setup keyboard input
    this.input.keyboard?.on('keydown-ESC', this.resumeGame, this);
  }

  private resumeGame() {
    // Resume the parent scene and close pause menu
    this.scene.resume(this.parentScene);
    this.scene.stop();
  }

  private quitToMenu() {
    // Stop parent scene and go to start menu
    this.scene.stop(this.parentScene);
    this.scene.stop();
    this.scene.start('StartMenuScene');
  }
}