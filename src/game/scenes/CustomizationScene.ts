import * as Phaser from 'phaser';
import { UpgradeManager, UpgradeLevels } from '../systems/UpgradeManager';
import { SkillTreeManager, SkillNode, Specialization, type SkillTreeBuildSlot } from '../systems/SkillTreeManager';
import { loadWaveTotalsConvex } from '@/lib/convexClient';
import { getPlayerColor, setPlayerColor } from '../systems/playerAppearance';

interface Point2D {
  x: number;
  y: number;
}

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
  private treeContainer?: Phaser.GameObjects.Container;
  private tooltip?: Phaser.GameObjects.Text;
  private idToNodeContainer: Map<string, Phaser.GameObjects.Container> = new Map();
  // Main tabs/groups
  private activeMainTab: 'customize' | 'tree' | 'builds' = 'customize';
  private customizeGroup?: Phaser.GameObjects.Container;
  private treeGroup?: Phaser.GameObjects.Container;
  private buildsGroup?: Phaser.GameObjects.Container;
  private isTreeDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private containerStartX = 0;
  private containerStartY = 0;
  private treeZoom = 1;
  private totalScore = 0;
  private totalsReady = false;
  private buildSlots: Map<number, SkillTreeBuildSlot> = new Map();
  private buildSlotWidgets: Map<number, { label: Phaser.GameObjects.Text; button: Phaser.GameObjects.Text }> = new Map();
  private buildSlotUIReady = false;
  private uiReady = false;

  constructor() {
    super({ key: 'CustomizationScene' });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  init(data: { currentScore?: number } = {}) {
    this.upgradeManager = new UpgradeManager();
    this.skillTree = new SkillTreeManager();
    // Reset UI state in case this scene is re-entered
    this.uiReady = false;
    this.buildSlotUIReady = false;
    this.buildSlotWidgets.clear();
    this.totalScore = this.computeLocalTotalScore();
    void this.skillTree.initialize().then(() => {
      void this.refreshBuildSlots();
      void this.refreshTotalScore();
      this.recomputePoints();
      this.updateAllDisplays();
    });
    void this.refreshBuildSlots();
    void this.refreshTotalScore();
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

    // Main tabs
    const tabCustomize = this.add.text(centerX - 220, 90, 'CUSTOMIZE', { fontSize: '16px', color: '#ffffaa', backgroundColor: '#003355', padding: { x: 8, y: 4 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const tabTree = this.add.text(centerX, 90, 'SKILL TREE', { fontSize: '16px', color: '#dddddd', backgroundColor: '#002233', padding: { x: 8, y: 4 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const tabBuilds = this.add.text(centerX + 220, 90, 'BUILDS', { fontSize: '16px', color: '#dddddd', backgroundColor: '#002233', padding: { x: 8, y: 4 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const setMainTab = (which: 'customize' | 'tree' | 'builds') => {
      this.activeMainTab = which;
      tabCustomize.setColor(which === 'customize' ? '#ffffaa' : '#dddddd');
      tabTree.setColor(which === 'tree' ? '#ffffaa' : '#dddddd');
      tabBuilds.setColor(which === 'builds' ? '#ffffaa' : '#dddddd');
      this.customizeGroup?.setVisible(which === 'customize');
      this.treeGroup?.setVisible(which === 'tree');
      this.buildsGroup?.setVisible(which === 'builds');
    };

    // Current score display
    this.scoreText = this.add.text(centerX, 120, `Available Points: ${this.currentScore.toLocaleString()}`, {
      fontSize: '24px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Character display area
    this.customizeGroup = this.add.container(0, 0);
    const beforeCount = this.children.list.length;
    this.createCharacterDisplay();
    const createdAfter = this.children.list.slice(beforeCount);
    this.customizeGroup.add(createdAfter as Phaser.GameObjects.GameObject[]);

    // Tabs and skill tree interface
    this.treeGroup = this.add.container(0, 0);
    const prevCount = this.children.list.length;
    this.createSkillTreeUI();
    this.enableZoomPan();
    const afterTree = this.children.list.slice(prevCount);
    this.treeGroup.add(afterTree as Phaser.GameObjects.GameObject[]);

    this.buildsGroup = this.add.container(0, 0);
    const prevCount2 = this.children.list.length;
    this.renderBuildSlotsUI();
    const afterBuilds = this.children.list.slice(prevCount2);
    this.buildsGroup.add(afterBuilds as Phaser.GameObjects.GameObject[]);

    // Default tab
    setMainTab('customize');
    tabCustomize.on('pointerdown', () => setMainTab('customize'));
    tabTree.on('pointerdown', () => setMainTab('tree'));
    tabBuilds.on('pointerdown', () => setMainTab('builds'));

    // Attempt to load remote legacy upgrades (migration support only, non-blocking)
    this.upgradeManager.loadFromRemote().catch(() => {});

    // Control buttons
    this.createControlButtons();

    // Initial update
    this.updateAllDisplays();

    // Mark UI as ready and handle shutdown cleanup
    this.uiReady = true;
    this.events.once('shutdown', () => {
      this.uiReady = false;
      this.buildSlotUIReady = false;
      this.buildSlotWidgets.clear();
    });
  }

  private createCharacterDisplay() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2 + 20;

    // Character preview area (centered)
    this.add.rectangle(centerX, centerY - 60, 220, 220, 0x003366, 0.3).setOrigin(0.5);
    this.add.text(centerX, centerY - 180, 'CHARACTER PREVIEW', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Player sprite (simple rectangle for now) - initialize with saved color
    const savedColor = getPlayerColor();
    this.playerSprite = this.add.rectangle(centerX, centerY - 60, 32, 32, savedColor).setOrigin(0.5);

    // Current stats HUD (restored)
    this.statTexts = {};
    const statsPanelX = centerX + 260;
    const statsPanelY = centerY - 60;
    const statsPanel = this.add.rectangle(statsPanelX, statsPanelY, 280, 220, 0x000000, 0.35).setOrigin(0.5).setStrokeStyle(2, 0x00ccff, 0.4);
    const statsHeader = this.add.text(statsPanelX, statsPanelY - 95, 'CURRENT STATS', {
      fontSize: '18px',
      color: '#ffffaa',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    const statRows = [
      { key: 'health', label: 'Health', unit: 'HP' },
      { key: 'speed', label: 'Speed', unit: 'px/s' },
      { key: 'maxAmmo', label: 'Max Ammo', unit: 'bullets' },
      { key: 'reloadSpeed', label: 'Reload', unit: 'ms' },
      { key: 'bulletSpeed', label: 'Bullet Speed', unit: 'px/s' },
      { key: 'bulletDamage', label: 'Bullet Damage', unit: 'dmg' }
    ];
    statRows.forEach((row, index) => {
      const lineY = statsPanelY - 60 + index * 32;
      const statText = this.add.text(statsPanelX - 120, lineY, `${row.label}: -- ${row.unit}`, {
        fontSize: '16px',
        color: '#ffffff'
      }).setOrigin(0, 0.5);
      this.statTexts[row.key] = statText;
    });

    // Ensure panel elements stay above swatches
    statsPanel.setDepth(1);
    statsHeader.setDepth(2);
    Object.values(this.statTexts).forEach(t => t.setDepth(2));

    // Basic customization options (placeholder): color swatches for the player sprite
    const colors = [0xffffff, 0xff6666, 0x66ff99, 0x66ccff, 0xffdd66, 0xbb88ff];
    const swatches: Phaser.GameObjects.Rectangle[] = [];
    colors.forEach((c, i) => {
      const box = this.add.rectangle(centerX - 70 + i * 28, centerY + 70, 20, 20, c).setOrigin(0.5).setStrokeStyle(1, 0xffffff, 0.5);
      box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.playerSprite.setFillStyle(c);
        setPlayerColor(c);
        this.cameras.main.flash(80, 50, 120, 255);
      });
      swatches.push(box);
    });
    this.add.text(centerX - 120, centerY + 70, 'Color:', { fontSize: '14px', color: '#cccccc' }).setOrigin(0, 0.5);
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
    const centerX = this.scale.width / 2;
    const topArea = 160;
    this.add.text(centerX, topArea - 20, 'SKILL TREE', {
      fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.treeContainer = this.add.container(0, 0);
    this.renderSkillTree();
  }

  private clearSkillTreeUI() {
    this.nodeContainers.forEach(c => c.destroy());
    this.linkLines.forEach(g => g.destroy());
    this.nodeContainers = [];
    this.linkLines = [];
    if (this.treeContainer) this.treeContainer.removeAll(true);
    this.idToNodeContainer.clear();
  }

  private renderSkillTree() {
    this.clearSkillTreeUI();
    // Overarching tree: render all nodes with specialization-based offsets
    const nodes = this.skillTree.getNodes();
    const originX = this.scale.width * 0.5;
    const originY = 200;
    const cellW = 260;
    const cellH = 150;

    const specOffset: Partial<Record<Specialization, { x: number; y: number }>> = {
      basic: { x: 0, y: 0 },
      defense: { x: -2, y: 0 },
      special: { x: 2, y: 0 },
      offense: { x: 1, y: -2 },
      mobility: { x: 1, y: 2 },
      hybrid: { x: 0, y: 1 }
    };

    // Background polygons per specialization path
    const specColor: Record<string, number> = { basic: 0x3377ff, special: 0xaa88ff, defense: 0x55cc77, offense: 0xff6666, mobility: 0xffcc55, hybrid: 0x66ccff };
    const specs: Specialization[] = ['basic', 'defense', 'special', 'offense', 'mobility', 'hybrid'];
    // Effective grid positions (after offsets) for adjacency logic
    const effectivePos = new Map<string, { gx: number; gy: number }>();
    nodes.forEach(n => {
      const off = specOffset[n.specialization] || { x: 0, y: 0 };
      effectivePos.set(n.id, { gx: off.x + n.position.x, gy: off.y + n.position.y });
    });
    const rootPos = effectivePos.get('root_start');
    const rootUnlocked = this.skillTree.getUnlocked('root_start') > 0;
    for (const spec of specs) {
      const list = nodes.filter(n => n.specialization === spec);
      if (list.length === 0) continue;
      const points = list.map(n => {
        const off = specOffset[spec] || { x: 0, y: 0 };
        return { x: originX + (off.x + n.position.x) * cellW, y: originY + (off.y + n.position.y) * cellH };
      });
      const hull = this.computeConvexHull(points);
      const bg = this.add.graphics();
      bg.fillStyle(specColor[spec] ?? 0x335577, 0.09);
      if (hull.length >= 3) {
        const padded = this.expandPolygon(hull, 30);
        bg.beginPath();
        bg.moveTo(padded[0].x, padded[0].y);
        for (let i = 1; i < padded.length; i++) bg.lineTo(padded[i].x, padded[i].y);
        bg.closePath();
        bg.fillPath();
      } else if (hull.length === 2) {
        const [a, b] = hull;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        bg.fillCircle(mid.x, mid.y, 80);
      } else if (hull.length === 1) {
        bg.fillCircle(hull[0].x, hull[0].y, 80);
      }
      this.linkLines.push(bg);
      if (this.treeContainer) this.treeContainer.add(bg);
    }

    // Color legend (top-right corner)
    const legend = this.add.container(this.scale.width - 180, 130);
    let ly = 0;
    for (const spec of specs) {
      const dot = this.add.rectangle(0, ly, 12, 12, specColor[spec]).setOrigin(0, 0.5);
      const txt = this.add.text(18, ly, spec.toUpperCase(), { fontSize: '12px', color: '#ffffff' }).setOrigin(0, 0.5);
      legend.add([dot, txt]);
      ly += 16;
    }
    if (this.treeContainer) this.treeContainer.add(legend);

    // Draw prerequisite links
    const g = this.add.graphics();
    g.lineStyle(2, 0x444444, 1);
    for (const n of nodes) {
      if (!n.prerequisites) continue;
      n.prerequisites.forEach(p => {
        const from = nodes.find(x => x.id === p.nodeId);
        if (!from) return;
        const offFrom = specOffset[from.specialization] || { x: 0, y: 0 };
        const offTo = specOffset[n.specialization] || { x: 0, y: 0 };
        const x1 = originX + (offFrom.x + from.position.x) * cellW;
        const y1 = originY + (offFrom.y + from.position.y) * cellH;
        const x2 = originX + (offTo.x + n.position.x) * cellW;
        const y2 = originY + (offTo.y + n.position.y) * cellH;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.strokePath();
      });
    }
    this.linkLines.push(g);
    if (this.treeContainer) this.treeContainer.add(g);

    for (const n of nodes) {
      const off = specOffset[n.specialization] || { x: 0, y: 0 };
      const cx = originX + (off.x + n.position.x) * cellW;
      const cy = originY + (off.y + n.position.y) * cellH;
      const container = this.add.container(cx, cy);
      const bgRect = this.add.rectangle(0, 0, 220, 100, 0x002244, 0.95).setStrokeStyle(3, 0xffffff, 0.7);

      const rank = this.skillTree.getUnlocked(n.id);
      const cost = this.skillTree.getNextCost(n.id);
      let prereqsMet = !n.prerequisites || n.prerequisites.every(p => this.skillTree.getUnlocked(p.nodeId) >= p.minRank);
      // Adjacency unlock: if root is unlocked, any node directly adjacent to root becomes available
      if (!prereqsMet && rootUnlocked && rootPos) {
        const pos = effectivePos.get(n.id);
        if (pos && Math.abs(pos.gx - rootPos.gx) + Math.abs(pos.gy - rootPos.gy) === 1) {
          prereqsMet = true;
        }
      }
      const affordable = this.currentScore >= cost;
      const title = this.add.text(0, -24, `${n.title}${n.kind === 'active' ? ' [A]' : ' [P]'}`, { fontSize: '18px', color: prereqsMet ? '#ffffaa' : '#dddddd', fontStyle: 'bold' }).setOrigin(0.5);
      const rankText = this.add.text(0, 5, `Rank ${rank}/${n.maxRank}`, { fontSize: '14px', color: '#cccccc' }).setOrigin(0.5);
      const btnLabel = rank >= n.maxRank
        ? 'MAXED'
        : (prereqsMet ? `UNLOCK (-${cost.toLocaleString()})` : 'LOCKED');
      const btn = this.add.text(0, 30, btnLabel, {
        fontSize: '14px', color: prereqsMet ? (affordable ? '#ffffff' : '#bbbbbb') : '#888888', backgroundColor: prereqsMet ? (affordable ? '#004400' : '#333333') : '#333333', padding: { x: 12, y: 4 }
      }).setOrigin(0.5)
        .on('pointerover', () => {
          const tooltipPos = this.getNodeWorldPoint(container, 110, 0);
          this.showNodeTooltip(n, tooltipPos.x, tooltipPos.y);
        })
        .on('pointerout', () => this.hideTooltip());

      if (n.id === 'root_start' || prereqsMet) {
        btn.setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            const res = this.skillTree.unlock(n.id, this.currentScore);
            if (res.success) {
              this.currentScore = res.newPoints;
              const fxPos = this.getNodeWorldPoint(container);
              this.playUnlockFx(fxPos.x, fxPos.y);
              this.flashNewlyAvailable(n.id, nodes);
              this.updateAllDisplays();
            } else {
              // Feedback when unaffordable
              this.cameras.main.shake(120, 0.003);
            }
          });
      }

      // Active vs passive styling
      bgRect.setStrokeStyle(3, specColor[n.specialization] ?? 0xffffff, 0.9);
      if (n.kind === 'active') {
        title.setColor('#ffff66');
      }

      container.add([bgRect, title, rankText, btn]);
      this.nodeContainers.push(container);
      this.idToNodeContainer.set(n.id, container);
      if (this.treeContainer) this.treeContainer.add(container);
    }
  }

  // Visual FX when unlocking a node
  private playUnlockFx(x: number, y: number) {
    const ring = this.add.graphics({ x, y });
    ring.lineStyle(3, 0xffffaa, 1);
    ring.strokeCircle(0, 0, 10);
    const spark = this.add.graphics({ x, y });
    spark.fillStyle(0xffffee, 1);
    spark.fillCircle(0, 0, 4);
    this.tweens.add({ targets: ring, scaleX: 3, scaleY: 3, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
    this.tweens.add({ targets: spark, alpha: 0, y: y - 20, duration: 400, onComplete: () => spark.destroy() });
  }

  // Flash containers that just became available due to unlocking nodeId
  private flashNewlyAvailable(nodeId: string, nodes: SkillNode[]) {
    const nowAvailable = nodes.filter(n => {
      if (!n.prerequisites || n.prerequisites.length === 0) return false;
      if (!n.prerequisites.some(p => p.nodeId === nodeId)) return false;
      return this.skillTree.canUnlock(n.id, this.currentScore);
    });
    nowAvailable.forEach(n => {
      const c = this.idToNodeContainer.get(n.id);
      if (!c) return;
      this.tweens.add({ targets: c, scaleX: 1.05, scaleY: 1.05, yoyo: true, repeat: 2, duration: 120 });
    });
  }

  // Geometry helpers for background polygons
  private computeConvexHull(points: Point2D[]): Point2D[] {
    if (points.length <= 1) return points.slice();
    const pts = points.slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
    const cross = (o: Point2D, a: Point2D, b: Point2D) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower: Point2D[] = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper: Point2D[] = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }

  private expandPolygon(points: Point2D[], pad: number): Point2D[] {
    if (points.length === 0) return points;
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    return points.map(p => {
      const vx = p.x - cx; const vy = p.y - cy;
      const len = Math.max(1, Math.hypot(vx, vy));
      return { x: p.x + (vx / len) * pad, y: p.y + (vy / len) * pad };
    });
  }

  private getNodeWorldPoint(container: Phaser.GameObjects.Container, offsetX = 0, offsetY = 0): Phaser.Math.Vector2 {
    const matrix = container.getWorldTransformMatrix();
    const worldPoint = new Phaser.Math.Vector2();
    matrix.transformPoint(offsetX, offsetY, worldPoint);
    return worldPoint;
  }

  private enableZoomPan() {
    // Pan/zoom by transforming the tree container (no extra camera)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.activeMainTab !== 'tree') return;
      if (!pointer.leftButtonDown()) return;
      this.isTreeDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.containerStartX = this.treeContainer?.x || 0;
      this.containerStartY = this.treeContainer?.y || 0;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isTreeDragging || this.activeMainTab !== 'tree') return;
      if (!this.treeContainer) return;
      const dx = pointer.x - this.dragStartX;
      const dy = pointer.y - this.dragStartY;
      this.treeContainer.x = this.containerStartX + dx;
      this.treeContainer.y = this.containerStartY + dy;
    });
    this.input.on('pointerup', () => { this.isTreeDragging = false; });
    this.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _dx: number,
      dy: number
    ) => {
      if (this.activeMainTab !== 'tree') return;
      if (!this.treeContainer) return;
      const factor = dy > 0 ? 0.9 : 1.1;
      this.treeZoom = Phaser.Math.Clamp(this.treeZoom * factor, 0.6, 2.5);
      this.treeContainer.setScale(this.treeZoom);
    });
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

  private computeLocalTotalScore(): number {
    try {
      const classicScores = JSON.parse(localStorage.getItem('leaderboard') || '[]');
      const waveScores = JSON.parse(localStorage.getItem('leaderboard_wave') || '[]');
      let total = 0;
      classicScores.forEach((entry: number | { score?: number }) => {
        const score = typeof entry === 'number' ? entry : (entry.score || 0);
        total += score;
      });
      waveScores.forEach((entry: number | { score?: number }) => {
        const score = typeof entry === 'number' ? entry : (entry.score || 0);
        total += score;
      });
      return total;
    } catch {
      return 0;
    }
  }

  private async refreshTotalScore(): Promise<void> {
    const fallback = this.computeLocalTotalScore();
    try {
      const totals = await loadWaveTotalsConvex();
      if (totals) {
        this.totalScore = totals.totalScore ?? fallback;
        this.totalsReady = true;
      } else {
        this.totalScore = fallback;
        this.totalsReady = false;
      }
    } catch {
      this.totalScore = fallback;
      this.totalsReady = false;
    }
    this.recomputePoints();
    this.updateScoreText();
  }

  private updateScoreText() {
    if (!this.uiReady) return;
    if (!this.scoreText) return;
    if (!this.scoreText.scene) return;
    if (this.scoreText.active === false) return;
    try {
      this.scoreText.setText(`Available Points: ${this.currentScore.toLocaleString()}`);
    } catch {
      // Ignore draw/update errors if scene is transitioning
    }
  }

  private async saveBuildSlot(slot: number, name: string) {
    const normalizedSlot = Math.max(1, Math.min(3, Math.floor(slot)));
    const trimmedName = name.trim();
    const snapshot = this.skillTree.snapshotBuild();
    const record: SkillTreeBuildSlot = { slot: normalizedSlot, name: trimmedName, snapshot };
    this.buildSlots.set(normalizedSlot, record);
    this.updateBuildSlotUI();
    const success = await this.skillTree.saveBuildSlot(normalizedSlot, trimmedName, snapshot);
    if (!success) {
      console.warn('Failed to persist build slot to Convex; using local cache only.');
    }
    void this.refreshBuildSlots();
  }

  private loadBuildSlot(slot: number) {
    const normalizedSlot = Math.max(1, Math.min(3, Math.floor(slot)));
    const entry = this.buildSlots.get(normalizedSlot);
    if (!entry) return;
    this.skillTree.applyBuild(entry.snapshot);
    this.updateAllDisplays();
  }

  private async refreshBuildSlots() {
    try {
      const slots = await this.skillTree.loadBuildSlots();
      this.buildSlots.clear();
      slots.forEach(slot => this.buildSlots.set(slot.slot, slot));
    } catch (error) {
      console.warn('Failed to load build slots:', error);
    }
    if (this.buildSlotUIReady) {
      this.updateBuildSlotUI();
    }
  }

  private updateBuildSlotUI() {
    for (let i = 1; i <= 3; i++) {
      const widgets = this.buildSlotWidgets.get(i);
      if (!widgets) continue;
      const entry = this.buildSlots.get(i);
      const name = entry?.name || '';
      if (widgets.label.scene && widgets.label.active !== false) {
        try { widgets.label.setText(name || `Build ${i}`); } catch {}
      }
      if (widgets.button.scene && widgets.button.active !== false) {
        try {
          widgets.button
            .setText(name ? 'Load' : 'Save')
            .setStyle({ backgroundColor: name ? '#004466' : '#336633' });
        } catch {}
      }
    }
  }

  private renderBuildSlotsUI() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2 + 40;
    const spacing = 220;
    // Clear any stale widget references from previous runs
    this.buildSlotWidgets.clear();
    for (let i = 1; i <= 3; i++) {
      const box = this.add.rectangle(centerX - spacing + (i - 1) * spacing, centerY, 180, 90, 0x002244, 0.8)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0x00aaff, 0.6);
      const label = this.add.text(box.x, box.y - 10, `Build ${i}`, { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
      const btn = this.add.text(box.x, box.y + 20, 'Save', {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#336633',
        padding: { x: 10, y: 6 }
      }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const entry = this.buildSlots.get(i);
          if (entry) {
            this.loadBuildSlot(i);
          } else {
            const entered = prompt('Enter build name:', `Build ${i}`) || `Build ${i}`;
            void this.saveBuildSlot(i, entered);
          }
        });
      this.buildSlotWidgets.set(i, { label, button: btn });
    }
    this.buildSlotUIReady = true;
    this.updateBuildSlotUI();
  }

  private getTotalSpent(): number {
    try {
      return this.skillTree.getState().totalSpent;
    } catch {
      return this.upgradeManager.getTotalSpent();
    }
  }

  private recomputePoints() {
    const totalScore = this.totalScore;
    const totalSpent = this.getTotalSpent();
    this.currentScore = Math.max(0, totalScore - totalSpent);
    this.updateScoreText();
  }

  private goBack() {
    this.scene.start('StartMenuScene');
  }
}
