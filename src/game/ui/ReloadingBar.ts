import * as Phaser from 'phaser';

export class ReloadingBar {
  private scene: Phaser.Scene;
  private player: Phaser.GameObjects.GameObject;
  private container!: Phaser.GameObjects.Container;
  private background!: Phaser.GameObjects.Graphics;
  private progressBar!: Phaser.GameObjects.Graphics;
  private text!: Phaser.GameObjects.Text;
  private isVisible: boolean = false;
  private reloadTween?: Phaser.Tweens.Tween;

  private barWidth: number = 80;
  private barHeight: number = 8;
  private offsetY: number = -50; // Distance above player

  constructor(scene: Phaser.Scene, player: Phaser.GameObjects.GameObject) {
    this.scene = scene;
    this.player = player;
    
    this.createReloadingBar();
  }

  private createReloadingBar() {
    // Create container to hold all reload bar elements
    this.container = this.scene.add.container(0, 0);
    this.container.setVisible(false);

    // Background bar (dark)
    this.background = this.scene.add.graphics();
    this.background.fillStyle(0x333333, 0.8);
    this.background.fillRoundedRect(-this.barWidth / 2, -this.barHeight / 2, this.barWidth, this.barHeight, 2);
    this.background.lineStyle(1, 0x666666, 1);
    this.background.strokeRoundedRect(-this.barWidth / 2, -this.barHeight / 2, this.barWidth, this.barHeight, 2);

    // Progress bar (colored)
    this.progressBar = this.scene.add.graphics();
    this.updateProgressBar(0);

    // "RELOADING" text
    this.text = this.scene.add.text(0, -20, 'RELOADING', {
      fontSize: '12px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Add all elements to container
    this.container.add([this.background, this.progressBar, this.text]);
  }

  private updateProgressBar(progress: number) {
    this.progressBar.clear();
    
    // Clamp progress between 0 and 1
    progress = Phaser.Math.Clamp(progress, 0, 1);
    
    // Color changes from red to yellow to green as it progresses
    let color: number;
    if (progress < 0.5) {
      color = 0xff4444; // Red
    } else if (progress < 0.8) {
      color = 0xffaa00; // Orange/Yellow
    } else {
      color = 0x44ff44; // Green
    }
    
    this.progressBar.fillStyle(color, 1);
    const currentWidth = this.barWidth * progress;
    if (currentWidth > 0) {
      this.progressBar.fillRoundedRect(-this.barWidth / 2, -this.barHeight / 2, currentWidth, this.barHeight, 2);
    }
  }

  show(reloadDuration: number) {
    if (this.isVisible) return;
    
    this.isVisible = true;
    this.container.setVisible(true);
    
    // Reset progress
    this.updateProgressBar(0);
    
    // Animate the progress bar
    const progressObj = { progress: 0 };
    this.reloadTween = this.scene.tweens.add({
      targets: progressObj,
      progress: 1,
      duration: reloadDuration,
      ease: 'Linear',
      onUpdate: () => {
        this.updateProgressBar(progressObj.progress);
      },
      onComplete: () => {
        this.hide();
      }
    });

    // Add a subtle pulsing effect to the text
    this.scene.tweens.add({
      targets: this.text,
      alpha: { from: 1, to: 0.5 },
      duration: 300,
      yoyo: true,
      repeat: -1
    });
  }

  hide() {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    this.container.setVisible(false);
    
    // Stop any running tweens
    if (this.reloadTween) {
      this.reloadTween.destroy();
      this.reloadTween = undefined;
    }
    
    // Stop text pulsing
    this.scene.tweens.killTweensOf(this.text);
    this.text.setAlpha(1);
  }

  update() {
    if (!this.isVisible) return;
    
    // Position the bar above the player
    const playerSprite = this.player as Phaser.GameObjects.Sprite;
    this.container.setPosition(playerSprite.x, playerSprite.y + this.offsetY);
  }

  destroy() {
    this.hide();
    if (this.container) {
      this.container.destroy();
    }
  }
}