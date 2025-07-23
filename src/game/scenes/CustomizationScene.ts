import * as Phaser from 'phaser';
import { UpgradeManager, UpgradeLevels } from '../systems/UpgradeManager';

export class CustomizationScene extends Phaser.Scene {
  private upgradeManager!: UpgradeManager;
  private currentScore = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private backButton!: Phaser.GameObjects.Text;
  private resetButton!: Phaser.GameObjects.Text;
  private playerSprite!: Phaser.GameObjects.Rectangle;
  private statTexts: { [key: string]: Phaser.GameObjects.Text } = {};
  private upgradeButtons: { [key: string]: Phaser.GameObjects.Text } = {};
  private costTexts: { [key: string]: Phaser.GameObjects.Text } = {};
  private levelTexts: { [key: string]: Phaser.GameObjects.Text } = {};

  constructor() {
    super({ key: 'CustomizationScene' });
  }

  init(data: { currentScore?: number } = {}) {
    this.currentScore = data.currentScore || this.getTotalScore();
    this.upgradeManager = new UpgradeManager();
  }

  create() {
    const centerX = this.scale.width / 2;

    // Background
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x001133).setOrigin(0, 0);

    // Title
    this.add.text(centerX, 50, 'CHARACTER CUSTOMIZATION', {
      fontSize: '40px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Current score display
    this.scoreText = this.add.text(centerX, 100, `Available Points: ${this.currentScore.toLocaleString()}`, {
      fontSize: '24px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Character display area
    this.createCharacterDisplay();

    // Stats and upgrade interface
    this.createStatsInterface();

    // Control buttons
    this.createControlButtons();

    // Initial update
    this.updateAllDisplays();
  }

  private createCharacterDisplay() {
    const leftSide = this.scale.width * 0.25;
    const topArea = 200;

    // Character preview area
    this.add.rectangle(leftSide, topArea, 200, 200, 0x003366, 0.3).setOrigin(0.5);
    this.add.text(leftSide, topArea - 120, 'CHARACTER PREVIEW', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Player sprite (simple rectangle for now)
    this.playerSprite = this.add.rectangle(leftSide, topArea, 32, 32, 0xffffff).setOrigin(0.5);

    // Character stats display
    const stats = this.upgradeManager.getPlayerStats();
    const startY = topArea + 150;

    this.add.text(leftSide, startY, 'CURRENT STATS', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const statNames = [
      { key: 'health', label: 'Health', unit: 'HP' },
      { key: 'speed', label: 'Speed', unit: 'px/s' },
      { key: 'maxAmmo', label: 'Max Ammo', unit: 'bullets' },
      { key: 'reloadSpeed', label: 'Reload Time', unit: 'ms' },
      { key: 'bulletSpeed', label: 'Bullet Speed', unit: 'px/s' },
      { key: 'bulletDamage', label: 'Bullet Damage', unit: 'dmg' }
    ];

    statNames.forEach((stat, index) => {
      const y = startY + 40 + (index * 30);
      const statValue = stats[stat.key as keyof typeof stats];
      this.statTexts[stat.key] = this.add.text(leftSide, y, `${stat.label}: ${statValue} ${stat.unit}`, {
        fontSize: '14px',
        color: '#cccccc'
      }).setOrigin(0.5);
    });
  }

  private createStatsInterface() {
    const rightSide = this.scale.width * 0.75;
    const topArea = 200;

    this.add.text(rightSide, topArea - 50, 'UPGRADES', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const upgradeStats = [
      { key: 'health', label: 'Health', description: '+25 HP per level' },
      { key: 'speed', label: 'Speed', description: '+20 speed per level' },
      { key: 'maxAmmo', label: 'Max Ammo', description: '+2 ammo per level' },
      { key: 'reloadSpeed', label: 'Reload Speed', description: '-150ms per level' },
      { key: 'bulletSpeed', label: 'Bullet Speed', description: '+50 speed per level' },
      { key: 'bulletDamage', label: 'Bullet Damage', description: '+1 damage per level' }
    ];

    upgradeStats.forEach((stat, index) => {
      const y = topArea + (index * 80);
      this.createUpgradeRow(rightSide, y, stat.key as keyof UpgradeLevels, stat.label, stat.description);
    });
  }

  private createUpgradeRow(x: number, y: number, statKey: keyof UpgradeLevels, label: string, description: string) {
    const levels = this.upgradeManager.getUpgradeLevels();
    const maxLevel = 10; // From UpgradeManager
    const cost = this.upgradeManager.getUpgradeCost(statKey);
    const canUpgrade = this.upgradeManager.canUpgrade(statKey, this.currentScore);
    const isMaxLevel = this.upgradeManager.isMaxLevel(statKey);

    // Stat name and level
    this.add.text(x - 150, y - 25, label, {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.levelTexts[statKey] = this.add.text(x - 150, y, `Level ${levels[statKey]}/${maxLevel}`, {
      fontSize: '14px',
      color: '#cccccc'
    }).setOrigin(0.5);

    // Description
    this.add.text(x - 150, y + 20, description, {
      fontSize: '12px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // Cost and upgrade button
    if (!isMaxLevel) {
      this.costTexts[statKey] = this.add.text(x + 50, y - 10, `Cost: ${cost.toLocaleString()}`, {
        fontSize: '14px',
        color: canUpgrade ? '#ffff00' : '#ff0000'
      }).setOrigin(0.5);

      this.upgradeButtons[statKey] = this.add.text(x + 50, y + 15, 'UPGRADE', {
        fontSize: '16px',
        color: canUpgrade ? '#ffffff' : '#666666',
        backgroundColor: canUpgrade ? '#004400' : '#444444',
        padding: { x: 15, y: 5 }
      }).setOrigin(0.5);

      if (canUpgrade) {
        this.upgradeButtons[statKey]
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.handleUpgrade(statKey))
          .on('pointerover', () => {
            if (canUpgrade) {
              this.upgradeButtons[statKey].setStyle({ backgroundColor: '#006600' });
            }
          })
          .on('pointerout', () => {
            if (canUpgrade) {
              this.upgradeButtons[statKey].setStyle({ backgroundColor: '#004400' });
            }
          });
      }
    } else {
      this.add.text(x + 50, y, 'MAX LEVEL', {
        fontSize: '16px',
        color: '#00ff00',
        fontStyle: 'bold'
      }).setOrigin(0.5);
    }
  }

  private createControlButtons() {
    const centerX = this.scale.width / 2;
    const bottomY = this.scale.height - 80;

    // Back button
    this.backButton = this.add.text(centerX - 100, bottomY, 'BACK', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#660000',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.goBack, this)
      .on('pointerover', () => this.backButton.setStyle({ backgroundColor: '#880000' }))
      .on('pointerout', () => this.backButton.setStyle({ backgroundColor: '#660000' }));

    // Reset upgrades button
    this.resetButton = this.add.text(centerX + 100, bottomY, 'RESET ALL', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#444400',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', this.resetUpgrades, this)
      .on('pointerover', () => this.resetButton.setStyle({ backgroundColor: '#666600' }))
      .on('pointerout', () => this.resetButton.setStyle({ backgroundColor: '#444400' }));
  }

  private handleUpgrade(statKey: keyof UpgradeLevels) {
    const result = this.upgradeManager.upgrade(statKey, this.currentScore);
    
    if (result.success) {
      this.currentScore = result.newScore;
      this.updateAllDisplays();
      
      // Show upgrade feedback
      this.showUpgradeNotification(statKey, result.cost);
    }
  }

  private showUpgradeNotification(statKey: keyof UpgradeLevels, cost: number) {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    
    const notification = this.add.text(centerX, centerY - 200, `${statKey.toUpperCase()} UPGRADED!\n-${cost.toLocaleString()} points`, {
      fontSize: '24px',
      color: '#00ff00',
      fontStyle: 'bold',
      align: 'center',
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5);

    // Fade out notification
    this.tweens.add({
      targets: notification,
      alpha: 0,
      y: centerY - 250,
      duration: 2000,
      onComplete: () => notification.destroy()
    });
  }

  private updateAllDisplays() {
    // Update score
    this.scoreText.setText(`Available Points: ${this.currentScore.toLocaleString()}`);

    // Update current stats
    const stats = this.upgradeManager.getPlayerStats();
    const statMappings = [
      { key: 'health', unit: 'HP' },
      { key: 'speed', unit: 'px/s' },
      { key: 'maxAmmo', unit: 'bullets' },
      { key: 'reloadSpeed', unit: 'ms' },
      { key: 'bulletSpeed', unit: 'px/s' },
      { key: 'bulletDamage', unit: 'dmg' }
    ];

    statMappings.forEach(stat => {
      if (this.statTexts[stat.key]) {
        const statValue = stats[stat.key as keyof typeof stats];
        const label = stat.key.charAt(0).toUpperCase() + stat.key.slice(1);
        this.statTexts[stat.key].setText(`${label}: ${statValue} ${stat.unit}`);
      }
    });

    // Recreate upgrade interface to update costs and availability
    this.clearUpgradeInterface();
    this.createStatsInterface();
  }

  private clearUpgradeInterface() {
    // Clear existing upgrade buttons and texts
    Object.values(this.upgradeButtons).forEach(button => button?.destroy());
    Object.values(this.costTexts).forEach(text => text?.destroy());
    Object.values(this.levelTexts).forEach(text => text?.destroy());
    
    this.upgradeButtons = {};
    this.costTexts = {};
    this.levelTexts = {};
  }

  private resetUpgrades() {
    // Show confirmation
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    
    const confirmText = this.add.text(centerX, centerY, 'Reset all upgrades?\nThis cannot be undone!\n\nClick again to confirm', {
      fontSize: '24px',
      color: '#ff0000',
      fontStyle: 'bold',
      align: 'center',
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5);

    const confirmButton = this.add.text(centerX, centerY + 80, 'CONFIRM RESET', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#660000',
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        const totalSpent = this.upgradeManager.getTotalSpent();
        this.upgradeManager.resetUpgrades();
        this.currentScore += totalSpent; // Refund all spent points
        this.updateAllDisplays();
        confirmText.destroy();
        confirmButton.destroy();
        cancelButton.destroy();
      });

    const cancelButton = this.add.text(centerX, centerY + 120, 'CANCEL', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        confirmText.destroy();
        confirmButton.destroy();
        cancelButton.destroy();
      });
  }

  private getTotalScore(): number {
    // Get total score from both leaderboards
    const classicScores = JSON.parse(localStorage.getItem('leaderboard') || '[]');
    const waveScores = JSON.parse(localStorage.getItem('leaderboard_wave') || '[]');
    
    let totalScore = 0;
    
    // Sum all classic scores
    classicScores.forEach((entry: number | { score?: number }) => {
      const score = typeof entry === 'number' ? entry : (entry.score || 0);
      totalScore += score;
    });
    
    // Sum all wave scores
    waveScores.forEach((entry: number | { score?: number }) => {
      const score = typeof entry === 'number' ? entry : (entry.score || 0);
      totalScore += score;
    });
    
    return totalScore;
  }

  private goBack() {
    this.scene.start('StartMenuScene');
  }
}