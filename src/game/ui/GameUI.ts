import * as Phaser from 'phaser';
import { GAME_SETTINGS } from '../config/gameConfig';

export class GameUI {
  private scene: Phaser.Scene;
  private scoreText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private difficultyText!: Phaser.GameObjects.Text;
  private snacksText!: Phaser.GameObjects.Text;
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private gameOverText?: Phaser.GameObjects.Text;
  private restartText?: Phaser.GameObjects.Text;
  private leaderboardText?: Phaser.GameObjects.Text;
  private retryButton?: Phaser.GameObjects.Text;
  private menuButton?: Phaser.GameObjects.Text;
  private saveScoreButton?: Phaser.GameObjects.Text;
  private droneIndicator?: Phaser.GameObjects.Text;
  private shieldIndicator?: Phaser.GameObjects.Text;
  private waveProgressText?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI() {
    this.scoreText = this.scene.add.text(16, 16, 'Score: 0', { 
      fontSize: '32px', 
      color: '#fff' 
    });
    
    // Initial ammo should be set by scene via updateAmmo
    this.ammoText = this.scene.add.text(16, 50, `Ammo: --`, { 
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

    // Snacks counter (updated by scenes)
    this.snacksText = this.scene.add.text(16, 152, 'Snacks: --', {
      fontSize: '24px',
      color: '#ffff66'
    });

    // Wave progress indicator (for wave mode) - discreet display
    this.waveProgressText = this.scene.add.text(16, 186, '', {
      fontSize: '16px',
      color: '#888888'
    });
    this.waveProgressText.setAlpha(0.7);
    this.waveProgressText.setVisible(false);
    
    // ESC instruction
    this.scene.add.text(16, this.scene.scale.height - 40, 'Press ESC to return to menu', {
      fontSize: '18px',
      color: '#aaaaaa'
    });
    
    this.healthBar = this.scene.add.graphics();
    
    // Create health text object that will be positioned with the health bar
    this.healthText = this.scene.add.text(0, 0, '100%', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    
    this.updateHealthBar(1); // Health bar will position itself at bottom

    // Indicators (top-right)
    const margin = 16;
    const ix = this.scene.scale.width - margin;
    const iy = 16;
    this.droneIndicator = this.scene.add.text(ix, iy, '', {
      fontSize: '16px',
      color: '#aeefff'
    }).setOrigin(1, 0).setAlpha(0);
    this.shieldIndicator = this.scene.add.text(ix, iy + 20, '', {
      fontSize: '16px',
      color: '#aaffaa'
    }).setOrigin(1, 0).setAlpha(0);
  }

  updateScore(score: number) {
    this.scoreText.setText(`Score: ${score}`);
  }

  updateAmmo(ammo: number) {
    this.ammoText.setText(`Ammo: ${ammo}`);
  }

  // Optional richer ammo UI for challenge modes
  updateAmmoDetailed(current: number, maxPerMag: number, totalRemaining: number) {
    this.ammoText.setText(`Ammo: ${current}/${maxPerMag}  (Total: ${totalRemaining})`);
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

  updateHealthBar(healthPercentage: number) {
    this.healthBar.clear();
    
    // Position health bar at bottom of screen
    const barWidth = 300;
    const barHeight = 25;
    const margin = 20;
    const yPosition = this.scene.scale.height - barHeight - margin;
    const xPosition = margin;
    
    // Background (red)
    this.healthBar.fillStyle(0xff0000, 1);
    this.healthBar.fillRect(xPosition, yPosition, barWidth, barHeight);
    
    // Health (green)
    this.healthBar.fillStyle(0x00ff00, 1);
    this.healthBar.fillRect(xPosition, yPosition, barWidth * healthPercentage, barHeight);
    
    // Border
    this.healthBar.lineStyle(2, 0xffffff, 1);
    this.healthBar.strokeRect(xPosition, yPosition, barWidth, barHeight);
    
    // Update health text and position it next to the health bar
    const healthText = `${Math.ceil(healthPercentage * 100)}%`;
    this.healthText.setText(healthText);
    this.healthText.setPosition(xPosition + barWidth + 10, yPosition + (barHeight / 2) - 8); // Center vertically next to bar
  }

  updateSnacks(count: number) {
    this.snacksText.setText(`Snacks: ${count}`);
  }

  updateWaveProgress(completedWaves: number, highestWave: number, currentWave?: number) {
    void completedWaves;
    void highestWave;
    void currentWave;
    if (this.waveProgressText) {
      this.waveProgressText.setText('');
      this.waveProgressText.setVisible(false);
    }
  }

  hideWaveProgress() {
    if (this.waveProgressText) {
      this.waveProgressText.setVisible(false);
    }
  }

  showWaveProgress() {
    if (this.waveProgressText) {
      this.waveProgressText.setVisible(false);
    }
  }

  showGameOver(onRetry?: () => void, onMenu?: () => void, onSave?: () => void) {
    const centerX = this.scene.scale.width / 2;
    const centerY = this.scene.scale.height / 2;

    this.gameOverText = this.scene.add.text(centerX, centerY - 100, 'Game Over', { 
      fontSize: '64px', 
      color: '#ff0000' 
    }).setOrigin(0.5);

    const spacing = 40;

    this.saveScoreButton = this.scene.add.text(0, 0, 'SAVE SCORE', {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#004466',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => onSave && onSave());

    this.retryButton = this.scene.add.text(0, 0, 'RETRY', {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#006600',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => onRetry && onRetry());

    this.menuButton = this.scene.add.text(0, 0, 'MAIN MENU', {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#444400',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => onMenu && onMenu());

    const totalWidth = this.saveScoreButton.width + this.retryButton.width + this.menuButton.width + spacing * 2;
    let startX = centerX - totalWidth / 2;
    const y = centerY;

    this.saveScoreButton.setPosition(startX + this.saveScoreButton.width / 2, y);
    startX += this.saveScoreButton.width + spacing;
    this.retryButton.setPosition(startX + this.retryButton.width / 2, y);
    startX += this.retryButton.width + spacing;
    this.menuButton.setPosition(startX + this.menuButton.width / 2, y);
  }

  showLeaderboard(scores: (number | {name?: string, score: number, time: number})[]) {
    const leaderboardTitle = 'LEADERBOARD';
    console.log('GameUI Leaderboard data:', scores); // Debug log
    
    let leaderboardContent = '';
    if (scores.length === 0) {
      leaderboardContent = 'No scores yet!\nPlay a game to set your first score.';
    } else {
      leaderboardContent = scores.map((entry, index) => {
        console.log('GameUI Processing entry:', entry, 'Type:', typeof entry); // Debug log
        
        if (typeof entry === 'number') {
          // Old format - just score
          return `${index + 1}. ${entry.toLocaleString()}`;
        } else if (entry && typeof entry === 'object') {
          // New format with name, score, and time
          const name = entry.name || 'Anonymous';
          const score = entry.score || 0;
          const time = entry.time || 0;
          const formattedTime = this.formatTime(time);
          
          return `${index + 1}. ${name}: ${score.toLocaleString()} (${formattedTime})`;
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

    if (this.retryButton) { this.retryButton.destroy(); this.retryButton = undefined; }
    if (this.menuButton) { this.menuButton.destroy(); this.menuButton = undefined; }
    if (this.saveScoreButton) { this.saveScoreButton.destroy(); this.saveScoreButton = undefined; }
    
    this.updateScore(0);
    this.updateAmmo(GAME_SETTINGS.weapons.bullet.maxAmmo);
    this.updateTimer(0);
    this.updateDifficulty(1, 'Beginner');
    this.updateHealthBar(1);
    // Hide indicators
    this.droneIndicator?.setAlpha(0).setText('');
    this.shieldIndicator?.setAlpha(0).setText('');
  }

  setDroneActive(active: boolean) {
    if (!this.droneIndicator) return;
    if (active) {
      this.droneIndicator.setText('DRONE').setAlpha(1);
    } else {
      this.droneIndicator.setAlpha(0).setText('');
    }
  }

  setShieldActive(active: boolean) {
    if (!this.shieldIndicator) return;
    if (active) {
      this.shieldIndicator.setText('SHIELD').setAlpha(1);
    } else {
      this.shieldIndicator.setAlpha(0).setText('');
    }
  }

  updateProgress(completedWaves: number, highestWave: number, totalScore: number) {
    // Update score text to show total score
    this.scoreText.setText(`Score: ${totalScore}`);
    
    // Add progress info to difficulty text if in wave mode
    const currentText = this.difficultyText.text;
    if (currentText.includes('Wave')) {
      this.difficultyText.setText(`${currentText} | Completed: ${completedWaves}/${highestWave}`);
    }
  }
}
