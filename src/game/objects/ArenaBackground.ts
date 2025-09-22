import * as Phaser from 'phaser';
import { CRTPipeline } from '../render/CRTPipeline';

export type ArenaTheme = 'space' | 'hell' | 'prison';

interface ThemeLayer {
  show(): void;
  hide(): void;
  update(delta: number): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

type FloatObject = {
  sprite: Phaser.GameObjects.Shape | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Ellipse;
  vx: number;
  vy: number;
  rotationSpeed?: number;
};

const BASE_DEPTH = -1000;
const OVERLAY_DEPTH = 5000;
const SCANLINE_KEY = 'arena-scanlines';
const NOISE_KEY = 'arena-noise';
const PRISON_BAR_KEY = 'arena-prison-bars';
const CRT_PIPELINE_KEY = 'crt-pipeline';

export class ArenaBackground {
  private layers = new Map<ArenaTheme, ThemeLayer>();
  private currentTheme?: ArenaTheme;
  private scanlines?: Phaser.GameObjects.TileSprite;
  private noiseOverlay?: Phaser.GameObjects.TileSprite;
  private vignette?: Phaser.GameObjects.Graphics;
  private resizeHandler: (size: Phaser.Structs.Size) => void;
  private destroyed = false;

  constructor(private scene: Phaser.Scene) {
    this.resizeHandler = (size: Phaser.Structs.Size) => this.handleResize(size.width, size.height);
    scene.scale.on('resize', this.resizeHandler);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.createOverlay();
    this.applyCRTPipeline();
  }

  setTheme(theme: ArenaTheme) {
    if (this.currentTheme === theme) return;

    const previous = this.currentTheme ? this.layers.get(this.currentTheme) : undefined;
    previous?.hide();

    let layer = this.layers.get(theme);
    if (!layer) {
      layer = this.createLayer(theme);
      this.layers.set(theme, layer);
    }

    this.currentTheme = theme;
    layer.show();
    this.showOverlay();
    this.scene.cameras.main.setBackgroundColor(this.getBackgroundColor(theme));
  }

  update(delta: number) {
    if (this.currentTheme) {
      this.layers.get(this.currentTheme)?.update(delta);
    }
    this.scanlines?.setTilePosition(this.scanlines.tilePositionX, this.scanlines.tilePositionY + delta * 0.02);
    if (this.noiseOverlay) {
      this.noiseOverlay.setTilePosition(
        this.noiseOverlay.tilePositionX + delta * 0.005,
        this.noiseOverlay.tilePositionY + delta * 0.007
      );
      const flicker = 0.12 + Math.abs(Math.sin(this.scene.time.now * 0.002)) * 0.03;
      this.noiseOverlay.setAlpha(flicker);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.layers.forEach(layer => layer.destroy());
    this.layers.clear();
    if (this.scanlines) { this.scanlines.destroy(); this.scanlines = undefined; }
    if (this.noiseOverlay) { this.noiseOverlay.destroy(); this.noiseOverlay = undefined; }
    if (this.vignette) { this.vignette.destroy(); this.vignette = undefined; }
    this.scene.scale.off('resize', this.resizeHandler);
  }

  private handleResize(width: number, height: number) {
    this.layers.forEach(layer => layer.resize(width, height));
    if (this.scanlines) {
      this.scanlines.setSize(width, height);
    }
    if (this.noiseOverlay) {
      this.noiseOverlay.setSize(width, height);
    }
    if (this.vignette) {
      this.vignette.clear();
      this.drawVignette(this.vignette, width, height);
    }
  }

  private createLayer(theme: ArenaTheme): ThemeLayer {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    switch (theme) {
      case 'space':
        return new SpaceThemeLayer(this.scene, width, height);
      case 'hell':
        return new HellThemeLayer(this.scene, width, height);
      case 'prison':
        return new PrisonThemeLayer(this.scene, width, height);
      default:
        return new SpaceThemeLayer(this.scene, width, height);
    }
  }

  private createOverlay() {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    ensureScanlineTexture(this.scene);
    ensureNoiseTexture(this.scene);
    ensurePrisonBarTexture(this.scene);

    this.scanlines = this.scene.add.tileSprite(0, 0, width, height, SCANLINE_KEY)
      .setOrigin(0, 0)
      .setAlpha(0.18)
      .setDepth(OVERLAY_DEPTH)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setVisible(false);

    this.noiseOverlay = this.scene.add.tileSprite(0, 0, width, height, NOISE_KEY)
      .setOrigin(0, 0)
      .setAlpha(0.14)
      .setDepth(OVERLAY_DEPTH + 1)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);

    this.vignette = this.scene.add.graphics();
    this.vignette.setDepth(OVERLAY_DEPTH + 2);
    this.drawVignette(this.vignette, width, height);
    this.vignette.setVisible(false);
  }

  private applyCRTPipeline() {
    const renderer = this.scene.game.renderer;
    if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
    type PipelineManagerLike = { has?: (key: string) => boolean; add?: (key: string, pipeline: unknown) => void }
    const pm = renderer.pipelines as unknown as PipelineManagerLike
    if (typeof pm.has === 'function' && typeof pm.add === 'function' && !pm.has(CRT_PIPELINE_KEY)) {
      pm.add(CRT_PIPELINE_KEY, new CRTPipeline(this.scene.game))
    }
    type CameraWithPipelines = Phaser.Cameras.Scene2D.Camera & { postPipeline?: unknown[]; setPostPipeline: (p: unknown) => void }
    const camera = this.scene.cameras.main as CameraWithPipelines
    const list = Array.isArray(camera.postPipeline) ? camera.postPipeline : []
    const already = list.some(p => p instanceof CRTPipeline)
    if (!already) {
      camera.setPostPipeline(CRTPipeline)
    }
  }

  private drawVignette(graphics: Phaser.GameObjects.Graphics, width: number, height: number) {
    graphics.fillStyle(0x000000, 0);
    graphics.fillRect(0, 0, width, height);
    graphics.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0.85, 0.85);
    graphics.fillRect(0, 0, width, height);
    graphics.setScrollFactor(0);
    graphics.setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  private showOverlay() {
    this.scanlines?.setVisible(true);
    this.noiseOverlay?.setVisible(true);
    this.vignette?.setVisible(true);
  }

  private getBackgroundColor(theme: ArenaTheme): number {
    switch (theme) {
      case 'hell':
        return 0x1b0301;
      case 'prison':
        return 0x04070c;
      case 'space':
      default:
        return 0x05030f;
    }
  }
}

class SpaceThemeLayer implements ThemeLayer {
  private width: number;
  private height: number;
  private floaters: FloatObject[] = [];
  private streaks: FloatObject[] = [];

  constructor(private scene: Phaser.Scene, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.createFloaters();
    this.createStreaks();
    this.hide();
  }

  show() {
    this.floaters.forEach(obj => obj.sprite.setVisible(true));
    this.streaks.forEach(obj => obj.sprite.setVisible(true));
  }

  hide() {
    this.floaters.forEach(obj => obj.sprite.setVisible(false));
    this.streaks.forEach(obj => obj.sprite.setVisible(false));
  }

  update(delta: number) {
    const dt = delta / 16.666;
    this.floaters.forEach(obj => this.updateSprite(obj, dt, 0));
    this.streaks.forEach(obj => this.updateSprite(obj, dt, 10));
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    [...this.floaters, ...this.streaks].forEach(obj => {
      obj.sprite.x = Phaser.Math.Wrap(obj.sprite.x, -20, this.width + 20);
      obj.sprite.y = Phaser.Math.Wrap(obj.sprite.y, -20, this.height + 20);
    });
  }

  destroy() {
    this.floaters.forEach(obj => obj.sprite.destroy());
    this.streaks.forEach(obj => obj.sprite.destroy());
    this.floaters = [];
    this.streaks = [];
  }

  private createFloaters() {
    const count = 80;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.FloatBetween(0, this.width);
      const y = Phaser.Math.FloatBetween(0, this.height);
      const radius = Phaser.Math.FloatBetween(1.2, 2.6);
      const sprite = this.scene.add.ellipse(x, y, radius * 2, radius * 2, 0xffffff, Phaser.Math.FloatBetween(0.3, 0.7));
      sprite.setBlendMode(Phaser.BlendModes.ADD);
      sprite.setDepth(BASE_DEPTH);
      sprite.setScrollFactor(0);
      const vx = Phaser.Math.FloatBetween(-0.08, 0.08);
      const vy = Phaser.Math.FloatBetween(0.12, 0.35);
      this.floaters.push({ sprite, vx, vy });
    }
  }

  private createStreaks() {
    const count = 36;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.FloatBetween(0, this.width);
      const y = Phaser.Math.FloatBetween(0, this.height);
      const length = Phaser.Math.FloatBetween(10, 22);
      const sprite = this.scene.add.rectangle(x, y, 2, length, 0xe9f4ff, Phaser.Math.FloatBetween(0.35, 0.55));
      sprite.setAngle(Phaser.Math.FloatBetween(-8, 8));
      sprite.setDepth(BASE_DEPTH - 10);
      sprite.setBlendMode(Phaser.BlendModes.SCREEN);
      sprite.setScrollFactor(0);
      const vx = Phaser.Math.FloatBetween(-0.15, 0.15);
      const vy = Phaser.Math.FloatBetween(0.45, 1.4);
      const rotationSpeed = Phaser.Math.FloatBetween(-0.01, 0.01);
      this.streaks.push({ sprite, vx, vy, rotationSpeed });
    }
  }

  private updateSprite(obj: FloatObject, dt: number, margin: number) {
    const sprite = obj.sprite;
    sprite.x += obj.vx * dt;
    sprite.y += obj.vy * dt;
    if (obj.rotationSpeed) {
      sprite.rotation += obj.rotationSpeed * dt;
    }
    if (sprite.y - margin > this.height) {
      sprite.y = -margin;
      sprite.x = Phaser.Math.FloatBetween(0, this.width);
    }
    if (sprite.x < -margin) {
      sprite.x = this.width + margin;
    } else if (sprite.x > this.width + margin) {
      sprite.x = -margin;
    }
  }
}

class HellThemeLayer implements ThemeLayer {
  private width: number;
  private height: number;
  private embers: FloatObject[] = [];
  private pillars: Phaser.GameObjects.Rectangle[] = [];
  private haze: Phaser.GameObjects.TileSprite;

  constructor(private scene: Phaser.Scene, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.haze = this.createHeatHaze();
    this.createPillars();
    this.createEmbers();
    this.hide();
  }

  show() {
    this.haze.setVisible(true);
    this.pillars.forEach(p => p.setVisible(true));
    this.embers.forEach(e => e.sprite.setVisible(true));
  }

  hide() {
    this.haze.setVisible(false);
    this.pillars.forEach(p => p.setVisible(false));
    this.embers.forEach(e => e.sprite.setVisible(false));
  }

  update(delta: number) {
    const dt = delta / 16.666;
    this.embers.forEach(obj => {
      obj.sprite.x += obj.vx * dt;
      obj.sprite.y += obj.vy * dt;
      if (obj.sprite.y + 10 < 0) {
        obj.sprite.y = this.height + Phaser.Math.FloatBetween(10, 40);
        obj.sprite.x = Phaser.Math.FloatBetween(0, this.width);
      }
      if (obj.sprite.x < -10) {
        obj.sprite.x = this.width + 10;
      } else if (obj.sprite.x > this.width + 10) {
        obj.sprite.x = -10;
      }
    });
    this.haze.tilePositionY += delta * 0.045;
    this.haze.tilePositionX += Math.sin(this.scene.time.now * 0.0015) * 0.2;
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.haze.setSize(width, height);
    this.positionPillars();
  }

  destroy() {
    this.haze.destroy();
    this.pillars.forEach(p => p.destroy());
    this.embers.forEach(e => e.sprite.destroy());
    this.pillars = [];
    this.embers = [];
  }

  private createPillars() {
    const pillarCount = 4;
    for (let i = 0; i < pillarCount; i++) {
      const x = (i + 1) * (this.width / (pillarCount + 1));
      const heightScale = Phaser.Math.FloatBetween(0.72, 0.92);
      const rect = this.scene.add.rectangle(x, this.height / 2, 44, this.height * heightScale, 0x4b0c0c, 0.35);
      rect.setStrokeStyle(2, 0xff7a39, 0.45);
      rect.setDepth(BASE_DEPTH - 30);
      rect.setBlendMode(Phaser.BlendModes.ADD);
      rect.setScrollFactor(0);
      this.pillars.push(rect);
    }
    this.positionPillars();
  }

  private positionPillars() {
    const pillarCount = this.pillars.length;
    if (!pillarCount) return;
    this.pillars.forEach((rect, index) => {
      rect.x = (index + 1) * (this.width / (pillarCount + 1));
      rect.height = this.height * Phaser.Math.FloatBetween(0.7, 0.9);
    });
  }

  private createEmbers() {
    const count = 36;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.FloatBetween(0, this.width);
      const y = Phaser.Math.FloatBetween(0, this.height);
      const sprite = this.scene.add.ellipse(x, y, Phaser.Math.FloatBetween(3, 6), Phaser.Math.FloatBetween(3, 6), 0xff8540, Phaser.Math.FloatBetween(0.4, 0.8));
      sprite.setDepth(BASE_DEPTH - 20);
      sprite.setBlendMode(Phaser.BlendModes.ADD);
      sprite.setScrollFactor(0);
      const vx = Phaser.Math.FloatBetween(-6, 6);
      const vy = -Phaser.Math.FloatBetween(20, 45);
      this.embers.push({ sprite, vx, vy });
    }
  }

  private createHeatHaze() {
    const haze = this.scene.add.tileSprite(0, 0, this.width, this.height, NOISE_KEY)
      .setOrigin(0, 0)
      .setDepth(BASE_DEPTH - 40)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.SCREEN);
    haze.setAlpha(0.18);
    return haze;
  }
}

class PrisonThemeLayer implements ThemeLayer {
  private width: number;
  private height: number;
  private bars: Phaser.GameObjects.TileSprite;
  private dust: FloatObject[] = [];
  private spotlights: Phaser.GameObjects.Polygon[] = [];

  constructor(private scene: Phaser.Scene, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.bars = this.createBars();
    this.createSpotlights();
    this.createDust();
    this.hide();
  }

  show() {
    this.bars.setVisible(true);
    this.spotlights.forEach(s => s.setVisible(true));
    this.dust.forEach(d => d.sprite.setVisible(true));
  }

  hide() {
    this.bars.setVisible(false);
    this.spotlights.forEach(s => s.setVisible(false));
    this.dust.forEach(d => d.sprite.setVisible(false));
  }

  update(delta: number) {
    const dt = delta / 16.666;
    this.bars.tilePositionY += delta * 0.03;
    this.dust.forEach(obj => {
      obj.sprite.x += obj.vx * dt;
      obj.sprite.y += obj.vy * dt;
      if (obj.sprite.x > this.width + 10) {
        obj.sprite.x = -10;
        obj.sprite.y = Phaser.Math.FloatBetween(0, this.height);
      }
      if (obj.sprite.y > this.height + 10) {
        obj.sprite.y = -10;
        obj.sprite.x = Phaser.Math.FloatBetween(0, this.width);
      }
    });
    this.spotlights.forEach((spotlight, index) => {
      const phase = this.scene.time.now * 0.001 + index;
      const tilt = Math.sin(phase) * 0.08;
      spotlight.rotation = tilt;
      spotlight.alpha = 0.25 + Math.sin(phase * 0.8) * 0.08;
    });
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.bars.setSize(width, height);
    this.positionSpotlights();
  }

  destroy() {
    this.bars.destroy();
    this.spotlights.forEach(s => s.destroy());
    this.dust.forEach(d => d.sprite.destroy());
    this.spotlights = [];
    this.dust = [];
  }

  private createBars() {
    return this.scene.add.tileSprite(0, 0, this.width, this.height, PRISON_BAR_KEY)
      .setOrigin(0, 0)
      .setDepth(BASE_DEPTH - 50)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setAlpha(0.5);
  }

  private createSpotlights() {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const spotlight = this.scene.add.polygon(0, 0, [0, 0, 120, 0, 180, this.height], 0x284d71, 0.18);
      spotlight.setDepth(BASE_DEPTH - 60);
      spotlight.setBlendMode(Phaser.BlendModes.SCREEN);
      spotlight.setScrollFactor(0);
      this.spotlights.push(spotlight);
    }
    this.positionSpotlights();
  }

  private positionSpotlights() {
    const count = this.spotlights.length;
    if (!count) return;
    this.spotlights.forEach((spotlight, index) => {
      const spacing = this.width / (count + 1);
      spotlight.x = spacing * (index + 1) - 60;
      spotlight.y = -this.height * 0.1;
    });
  }

  private createDust() {
    const count = 28;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.FloatBetween(0, this.width);
      const y = Phaser.Math.FloatBetween(0, this.height);
      const sprite = this.scene.add.rectangle(x, y, Phaser.Math.FloatBetween(2, 4), Phaser.Math.FloatBetween(6, 12), 0xcfd5ff, Phaser.Math.FloatBetween(0.15, 0.35));
      sprite.setDepth(BASE_DEPTH - 45);
      sprite.setScrollFactor(0);
      const vx = Phaser.Math.FloatBetween(12, 26);
      const vy = Phaser.Math.FloatBetween(4, 12);
      this.dust.push({ sprite, vx, vy });
    }
  }
}

function ensureScanlineTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(SCANLINE_KEY)) return;
  const gfx = scene.add.graphics({ x: 0, y: 0 }).setVisible(false);
  gfx.fillStyle(0xffffff, 0.12);
  gfx.fillRect(0, 0, 4, 1);
  gfx.generateTexture(SCANLINE_KEY, 4, 4);
  gfx.destroy();
}

function ensureNoiseTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(NOISE_KEY)) return;
  const size = 48;
  const texture = scene.textures.createCanvas(NOISE_KEY, size, size);
  if (!texture) return;
  const ctx = texture.getContext();
  const imageData = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const tint = Phaser.Math.Between(140, 255);
    const alpha = Phaser.Math.Between(20, 65);
    imageData.data[i * 4] = tint;
    imageData.data[i * 4 + 1] = tint;
    imageData.data[i * 4 + 2] = 255;
    imageData.data[i * 4 + 3] = alpha;
  }
  ctx.putImageData(imageData, 0, 0);
  texture.refresh();
}

function ensurePrisonBarTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(PRISON_BAR_KEY)) return;
  const gfx = scene.add.graphics({ x: 0, y: 0 }).setVisible(false);
  gfx.fillStyle(0x0a1016, 1);
  gfx.fillRect(0, 0, 64, 64);
  gfx.fillStyle(0x1c2c3a, 1);
  gfx.fillRect(28, 0, 8, 64);
  gfx.lineStyle(1, 0x2f4658, 0.9);
  gfx.strokeRect(28, 0, 8, 64);
  gfx.generateTexture(PRISON_BAR_KEY, 64, 64);
  gfx.destroy();
}
