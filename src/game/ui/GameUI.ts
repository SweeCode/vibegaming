import * as Phaser from 'phaser';
import { GAME_SETTINGS } from '../config/gameConfig';

export class GameUI {
  private scene: Phaser.Scene;
  private scoreText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private difficultyText!: Phaser.GameObjects.Text;
  private healthBar!: Phaser.GameObjects.Graphics;
  private gameOverText?: Phaser.GameObjects.Text;
  private restartText?: Phaser.GameObjects.Text;
  private leaderboardText?: Phaser.GameObjects.Text;

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

    this.timerText = this.scene.add.text(16, 84, 'Time: 0:00', {
      fontSize: '32px',
      color: '#ffff00'
    });

    this.difficultyText = this.scene.add.text(16, 118, 'Level 1 - Beginner', {
      fontSize: '24px',
      color: '#00ff00'
    });
    
    // ESC instruction
    this.scene.add.text(16, this.scene.scale.height - 40, 'Press ESC to return to menu', {
      fontSize: '18px',
      color: '#aaaaaa'
    });
    
    this.healthBar = this.scene.add.graphics();
    this.updateHealthBar(1, 150); // Adjust health bar position down
  }

  updateScore(score: number) {
    this.scoreText.setText(`Score: ${score}`);
  }

  updateAmmo(ammo: number) {
    this.ammoText.setText(`Ammo: ${ammo}`);
  }

  updateTimer(seconds: number) {
    const formattedTime = this.formatTime(seconds);
    this.timerText.setText(`Time: ${formattedTime}`);
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  showReloading() {
    this.ammoText.setText('Reloading...');
  }

  updateDifficulty(level: number, title: string) {
    this.difficultyText.setText(`Level ${level} - ${title}`);
    
    // Color-code difficulty levels
    let color = '#00ff00'; // Green for easy levels
    if (level >= 7) color = '#ff0000'; // Red for hard levels
    else if (level >= 4) color = '#ffaa00'; // Orange for medium levels
    
    this.difficultyText.setColor(color);
  }

  updateHealthBar(healthPercentage: number, yPosition: number = 90) {
    this.healthBar.clear();
    this.healthBar.fillStyle(0xff0000, 1);
    this.healthBar.fillRect(16, yPosition, 200, 20);
    this.healthBar.fillStyle(0x00ff00, 1);
    this.healthBar.fillRect(16, yPosition, 200 * healthPercentage, 20);
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

  showLeaderboard(scores: (number | {score: number, time: number})[]) {
    const leaderboardTitle = 'LEADERBOARD';
    console.log('GameUI Leaderboard data:', scores); // Debug log
    
    let leaderboardContent = '';
    if (scores.length === 0) {
      leaderboardContent = 'No scores yet!\nPlay a game to set your first score.';
    } else {
      leaderboardContent = scores.map((entry, index) => {
        console.log('GameUI Processing entry:', entry, 'Type:', typeof entry); // Debug log
        // Handle both old format (just numbers) and new format (objects with score and time)
        if (typeof entry === 'number') {
          return `${index + 1}. ${entry.toLocaleString()}`;
        } else if (entry && typeof entry === 'object' && 'score' in entry && 'time' in entry) {
          const formattedTime = this.formatTime(entry.time);
          return `${index + 1}. ${entry.score.toLocaleString()} (${formattedTime})`;
        } else {
          // Fallback for corrupted data
          return `${index + 1}. Invalid entry`;
        }
      }).join('\n');
    }
    
    const leaderboardFullText = `${leaderboardTitle}\n\n${leaderboardContent}`;

    this.leaderboardText = this.scene.add.text(400, 400, leaderboardFullText, {
      fontSize: '24px',
      color: '#fff',
      align: 'center'
    }).setOrigin(0.5);
  }

  hideLeaderboard() {
    if (this.leaderboardText) {
      this.leaderboardText.destroy();
      this.leaderboardText = undefined;
    }
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
    this.updateTimer(0);
    this.updateDifficulty(1, 'Beginner');
    this.updateHealthBar(1, 150);
  }
}