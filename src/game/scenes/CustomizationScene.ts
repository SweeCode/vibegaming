import * as Phaser from 'phaser';
import { UpgradeManager, UpgradeLevels } from '../systems/UpgradeManager';
import { SkillTreeManager, SkillNode, Specialization } from '../systems/SkillTreeManager';

export class CustomizationScene extends Phaser.Scene {
  private upgradeManager!: UpgradeManager;
  private skillTree!: SkillTreeManager;
  private currentScore = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private backButton!: Phaser.GameObjects.Text;
  private resetButton!: Phaser.GameObjects.Text;
  private playerSprite!: Phaser.GameObjects.Rectangle;
  private statTexts: { [key: string]: Phaser.GameObjects.Text } = {};
  private upgradeButtons: { [key: string]: Phaser.GameObjects.Text } = {};
  private costTexts: { [key: string]: Phaser.GameObjects.Text } = {};
  private levelTexts: { [key: string]: Phaser.GameObjects.Text } = {};
  // Skill tree UI state
  private selectedSpec: Specialization = 'basic';
  private tabTexts: Partial<Record<Specialization, Phaser.GameObjects.Text>> = {};
  private nodeContainers: Phaser.GameObjects.Container[] = [];
  private linkLines: Phaser.GameObjects.Graphics[] = [];
  private tooltip?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'CustomizationScene' });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  init(data: { currentScore?: number } = {}) {
    this.upgradeManager = new UpgradeManager();
    this.skillTree = new SkillTreeManager();
    void this.skillTree.initialize().then(() => {
      this.recomputePoints();
      this.updateAllDisplays();
    });
    this.recomputePoints();
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

    // Tabs and skill tree interface
    this.createTabs();
    this.createSkillTreeUI();

    // Attempt to load remote legacy upgrades (migration support only, non-blocking)
    this.upgradeManager.loadFromRemote().catch(() => {});

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

  private createTabs() {
    const rightSide = this.scale.width * 0.75;
    const topY = 130;
    const labels: Array<{ spec: Specialization; text: string }> = [
      { spec: 'basic', text: 'BASIC' },
      { spec: 'special', text: 'SPECIAL' },
      { spec: 'defense', text: 'DEFENSIVE' }
    ];
    const spacing = 160;
    labels.forEach((l, i) => {
      const t = this.add.text(rightSide - spacing + i * spacing, topY, l.text, {
        fontSize: '22px',
        color: this.selectedSpec === l.spec ? '#ffff00' : '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.selectedSpec = l.spec;
          this.updateTabsStyle();
          this.renderSkillTree();
        });
      this.tabTexts[l.spec] = t;
    });
  }

  private updateTabsStyle() {
    (['basic', 'special', 'defense'] as Specialization[]).forEach(spec => {
      const t = this.tabTexts[spec];
      if (t) t.setColor(this.selectedSpec === spec ? '#ffff00' : '#ffffff');
    });
  }

  private createSkillTreeUI() {
    const rightSide = this.scale.width * 0.75;
    const topArea = 160;
    this.add.text(rightSide, topArea - 20, 'SKILL TREE', {
      fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.renderSkillTree();
  }

  private clearSkillTreeUI() {
    this.nodeContainers.forEach(c => c.destroy());
    this.linkLines.forEach(g => g.destroy());
    this.nodeContainers = [];
    this.linkLines = [];
  }

  private renderSkillTree() {
    this.clearSkillTreeUI();
    const nodes = this.skillTree.getNodes().filter(n => n.specialization === this.selectedSpec);
    const originX = this.scale.width * 0.62;
    const originY = 200;
    const cellW = 220;
    const cellH = 120;

    // Draw prerequisite links
    const g = this.add.graphics();
    g.lineStyle(2, 0x444444, 1);
    for (const n of nodes) {
      if (!n.prerequisites) continue;
      n.prerequisites.forEach(p => {
        const from = nodes.find(x => x.id === p.nodeId);
        if (!from) return;
        const x1 = originX + from.position.x * cellW;
        const y1 = originY + from.position.y * cellH;
        const x2 = originX + n.position.x * cellW;
        const y2 = originY + n.position.y * cellH;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.strokePath();
      });
    }
    this.linkLines.push(g);

    for (const n of nodes) {
      const cx = originX + n.position.x * cellW;
      const cy = originY + n.position.y * cellH;
      const container = this.add.container(cx, cy);
      const bg = this.add.rectangle(0, 0, 200, 90, 0x002244, 0.9).setStrokeStyle(2, 0xffffff, 0.6);

      const rank = this.skillTree.getUnlocked(n.id);
      const can = this.skillTree.canUnlock(n.id, this.currentScore);
      const title = this.add.text(0, -20, n.title, { fontSize: '18px', color: can ? '#ffffaa' : '#dddddd', fontStyle: 'bold' }).setOrigin(0.5);
      const rankText = this.add.text(0, 5, `Rank ${rank}/${n.maxRank}`, { fontSize: '14px', color: '#cccccc' }).setOrigin(0.5);
      const btn = this.add.text(0, 28, can ? `UNLOCK (-${this.skillTree.getNextCost(n.id).toLocaleString()})` : (rank >= n.maxRank ? 'MAXED' : 'LOCKED'), {
        fontSize: '14px', color: can ? '#ffffff' : '#888888', backgroundColor: can ? '#004400' : '#333333', padding: { x: 12, y: 4 }
      }).setOrigin(0.5)
        .on('pointerover', () => this.showNodeTooltip(n, cx + 110, cy))
        .on('pointerout', () => this.hideTooltip());

      if (can) {
        btn.setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            const res = this.skillTree.unlock(n.id, this.currentScore);
            if (res.success) {
              this.currentScore = res.newPoints;
              this.updateAllDisplays();
            }
          });
      }

      container.add([bg, title, rankText, btn]);
      this.nodeContainers.push(container);
    }
  }

  // Legacy upgrade row removed in favor of skill tree UI

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

  // Legacy upgrade handler removed in favor of skill tree

  private showNodeTooltip(node: SkillNode, x: number, y: number) {
    const rank = this.skillTree.getUnlocked(node.id);
    const maxed = rank >= node.maxRank;
    const eff = node.effectPerRank(Math.max(1, Math.min(node.maxRank, rank + 1)));
    const parts: string[] = [];
    if (eff.stats) {
      if (eff.stats.health) parts.push(`Health: ${eff.stats.health > 0 ? '+' : ''}${eff.stats.health}`);
      if (eff.stats.speed) parts.push(`Speed: ${eff.stats.speed > 0 ? '+' : ''}${eff.stats.speed}`);
      if (eff.stats.maxAmmo) parts.push(`Max Ammo: ${eff.stats.maxAmmo > 0 ? '+' : ''}${eff.stats.maxAmmo}`);
      if (eff.stats.reloadSpeedMs) parts.push(`Reload: ${eff.stats.reloadSpeedMs}`);
      if (eff.stats.bulletSpeed) parts.push(`Bullet Speed: ${eff.stats.bulletSpeed > 0 ? '+' : ''}${eff.stats.bulletSpeed}`);
      if (eff.stats.bulletDamage) parts.push(`Bullet Damage: ${eff.stats.bulletDamage > 0 ? '+' : ''}${eff.stats.bulletDamage}`);
    }
    if (eff.modifiers) {
      if (eff.modifiers.pierceCount) parts.push(`Pierce: +${eff.modifiers.pierceCount}`);
      if (eff.modifiers.ricochetBounces) parts.push(`Ricochet: +${eff.modifiers.ricochetBounces}`);
      if (eff.modifiers.damageReductionPct) parts.push(`DR: ${Math.round(eff.modifiers.damageReductionPct * 100)}%`);
      if (eff.modifiers.healPerSecond) parts.push(`Regen: +${eff.modifiers.healPerSecond}/s`);
      if (eff.modifiers.petDrone?.enabled) parts.push('Pet Drone');
      if (eff.modifiers.shieldAfterIdle?.enabled) parts.push('Reactive Shield');
    }
    const cost = this.skillTree.getNextCost(node.id);
    const can = this.skillTree.canUnlock(node.id, this.currentScore);
    const reasons: string[] = [];
    if (!maxed) {
      // Prereq reasons
      if (node.prerequisites && node.prerequisites.length > 0) {
        for (const p of node.prerequisites) {
          const have = this.skillTree.getUnlocked(p.nodeId);
          if (have < p.minRank) {
            const prereqNode = this.skillTree.getNodes().find(n => n.id === p.nodeId);
            const title = prereqNode ? prereqNode.title : p.nodeId;
            reasons.push(`Requires ${title} rank ${p.minRank} (you have ${have})`);
          }
        }
      }
      // Points reason
      if (this.currentScore < cost) {
        reasons.push(`Need ${(cost - this.currentScore).toLocaleString()} more points`);
      }
    }

    const header = maxed ? 'MAXED' : (can ? 'UNLOCKABLE' : 'LOCKED');
    const baseLines = [`${node.title} — ${header}`, node.description];
    const nextLine = maxed ? 'No further ranks.' : `Next: ${parts.join(', ') || '—'}`;
    const costLine = maxed ? '' : `Cost: ${cost.toLocaleString()} (You have: ${this.currentScore.toLocaleString()})`;
    const reasonLines = reasons.length ? ['Why locked:', ...reasons] : [];
    const all = [...baseLines, nextLine, costLine, ...reasonLines].filter(Boolean).join('\n');

    this.tooltip?.destroy();
    this.tooltip = this.add.text(x, y, all, {
      fontSize: '12px', color: '#ffffee', backgroundColor: '#000000', padding: { x: 8, y: 6 }
    }).setOrigin(0, 0.5);
  }

  private hideTooltip() {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = undefined;
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
    this.recomputePoints();
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

    // Re-render skill tree to refresh ranks and costs
    this.renderSkillTree();
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
        this.skillTree.reset();
        this.recomputePoints();
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

  private getTotalSpent(): number {
    try {
      return this.skillTree.getState().totalSpent;
    } catch {
      return this.upgradeManager.getTotalSpent();
    }
  }

  private recomputePoints() {
    const totalScore = this.getTotalScore();
    const totalSpent = this.getTotalSpent();
    this.currentScore = Math.max(0, totalScore - totalSpent);
  }

  private goBack() {
    this.scene.start('StartMenuScene');
  }
}