import * as Phaser from 'phaser';

export class PauseMenuScene extends Phaser.Scene {
  private resumeButton!: Phaser.GameObjects.Text;
  private quitButton!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private background!: Phaser.GameObjects.Rectangle;
  private parentScene: string = 'MainScene'; // Default to MainScene
  private crtToggle!: Phaser.GameObjects.Text;
  private crtEnabled: boolean = true;

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

    // Detect current CRT state from parent scene if available
    try {
      const parent = this.scene.get(this.parentScene) as unknown as { arenaBackground?: { isCRTEnabled?: () => boolean } };
      if (parent && parent['arenaBackground'] && typeof parent['arenaBackground'].isCRTEnabled === 'function') {
        this.crtEnabled = !!parent['arenaBackground'].isCRTEnabled();
      }
    } catch {}

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

    // CRT Toggle button (below Quit, above instructions)
    this.crtToggle = this.add.text(centerX, centerY + 120, this.getCRTLabel(), {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#112233',
      padding: { x: 18, y: 8 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleCRT())
      .on('pointerover', () => this.crtToggle.setStyle({ backgroundColor: '#1b314a' }))
      .on('pointerout', () => this.crtToggle.setStyle({ backgroundColor: '#112233' }));

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
    this.add.text(centerX, centerY + 160, 'Press ESC to resume', {
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
    // Stop parent scene and go to appropriate menu
    const parent = this.parentScene;
    this.scene.stop(parent);
    this.scene.stop();
    const isChallengeUrl = (() => {
      try { return typeof window !== 'undefined' && window.location.pathname.startsWith('/challenge'); } catch { return false; }
    })();
    if (parent === 'ChallengeScene' || isChallengeUrl) {
      try { window.location.href = '/challenge'; } catch { this.scene.start('StartMenuScene'); }
      return;
    }
    this.scene.start('StartMenuScene');
  }

  private toggleCRT() {
    this.crtEnabled = !this.crtEnabled;
    this.crtToggle.setText(this.getCRTLabel());
    try {
      const parent = this.scene.get(this.parentScene) as unknown as { arenaBackground?: { enableCRT?: (v: boolean) => void } };
      if (parent && parent['arenaBackground'] && typeof parent['arenaBackground'].enableCRT === 'function') {
        parent['arenaBackground'].enableCRT(this.crtEnabled);
      }
    } catch {}
  }

  private getCRTLabel(): string {
    return this.crtEnabled ? 'CRT: ON' : 'CRT: OFF';
  }
}