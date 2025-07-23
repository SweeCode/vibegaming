import * as Phaser from 'phaser';
import { GAME_SETTINGS } from '../config/gameConfig';

export class GameUI {
  private scene: Phaser.Scene;
  private scoreText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private healthBar!: Phaser.GameObjects.Graphics;
  private gameOverText?: Phaser.GameObjects.Text;
  private restartText?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI() {
    this.scoreText = this.scene.add.text(16, 16, 'Score: 0', { 
      fontSize: '32px', 
      color: '#fff' 
    });
    
    this.ammoText = this.scene.add.text(16, 50, `Ammo: ${GAME_SETTINGS.weapons.bullet.maxAmmo}`, { 
      fontSize: '32px', 
      color: '#fff' 
    });
    
    this.healthBar = this.scene.add.graphics();
    this.updateHealthBar(1);
  }

  updateScore(score: number) {
    this.scoreText.setText(`Score: ${score}`);
  }

  updateAmmo(ammo: number) {
    this.ammoText.setText(`Ammo: ${ammo}`);
  }

  showReloading() {
    this.ammoText.setText('Reloading...');
  }

  updateHealthBar(healthPercentage: number) {
    this.healthBar.clear();
    this.healthBar.fillStyle(0xff0000, 1);
    this.healthBar.fillRect(16, 90, 200, 20);
    this.healthBar.fillStyle(0x00ff00, 1);
    this.healthBar.fillRect(16, 90, 200 * healthPercentage, 20);
  }

  showGameOver() {
    this.gameOverText = this.scene.add.text(400, 300, 'Game Over', { 
      fontSize: '64px', 
      color: '#ff0000' 
    }).setOrigin(0.5);
    
    this.restartText = this.scene.add.text(400, 350, 'Press to restart', { 
      fontSize: '32px', 
      color: '#fff' 
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: this.restartText,
      alpha: { from: 0, to: 1 },
      ease: 'Linear',
      duration: 1000,
      repeat: -1,
      yoyo: true
    });
  }

  reset() {
    if (this.gameOverText) {
      this.gameOverText.destroy();
      this.gameOverText = undefined;
    }
    
    if (this.restartText) {
      this.restartText.destroy();
      this.restartText = undefined;
    }
    
    this.updateScore(0);
    this.updateAmmo(GAME_SETTINGS.weapons.bullet.maxAmmo);
    this.updateHealthBar(1);
  }
}