import * as Phaser from 'phaser'
import { AchievementsManager } from '../systems/AchievementsManager'

export class AchievementsScene extends Phaser.Scene {
  private backButton!: Phaser.GameObjects.Text
  private titleText!: Phaser.GameObjects.Text
  private tooltip?: Phaser.GameObjects.Text
  private gridContainer?: Phaser.GameObjects.Container
  private bg?: Phaser.GameObjects.Rectangle
  private headerBg?: Phaser.GameObjects.Rectangle
  // Background FX
  private bgStarsFar?: Phaser.GameObjects.Group
  private bgStarsNear?: Phaser.GameObjects.Group
  private bgShapes?: Phaser.GameObjects.Group
  private bgTimers: Phaser.Time.TimerEvent[] = []
  private bgUpdateActive = false

  constructor() {
    super({ key: 'AchievementsScene' })
  }

  create() {
    const centerX = this.scale.width / 2
    const centerY = this.scale.height / 2

    // Space/glow background
    this.createSpaceBackground()

    // Header (white, no background block)
    this.titleText = this.add.text(centerX, 80, 'ACHIEVEMENTS', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.titleText.setShadow(0, 0, '#ffffff', 16, true, true)
    this.tweens.add({ targets: this.titleText, scale: { from: 1.0, to: 1.04 }, yoyo: true, duration: 1200, repeat: -1, ease: 'Sine.InOut' })

    // Grid of achievement cards
    const defs = AchievementsManager.getInstance().getDefinitions()
    const cols = 5
    const rows = Math.ceil(defs.length / cols)
    const cardW = 200
    const cardH = 120
    const spacingX = 28
    const spacingY = 28
    const gridW = cols * cardW + (cols - 1) * spacingX
    const gridH = rows * cardH + (rows - 1) * spacingY
    const gridX = centerX - gridW / 2
    const gridY = centerY - gridH / 2 + 30

    this.gridContainer = this.add.container(0, 0)

    defs.forEach((def, index) => {
      const c = index % cols
      const r = Math.floor(index / cols)
      const x = gridX + c * (cardW + spacingX)
      const y = gridY + r * (cardH + spacingY)

      const unlocked = AchievementsManager.getInstance().isUnlocked(def.id)
      const card = this.add.rectangle(x + cardW / 2, y + cardH / 2, cardW, cardH, 0x000000, 0)
        .setStrokeStyle(2, 0xffffff, 0.9)
        .setOrigin(0.5)

      const title = this.add.text(x + 16, y + 14, def.title, {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0, 0)

      const status = this.add.text(x + 16, y + cardH - 22, unlocked ? 'Unlocked' : 'Locked', {
        fontSize: '14px',
        color: '#ffffff'
      }).setOrigin(0, 1)

      // Accent stripe (subtle white)
      const stripe = this.add.rectangle(x + cardW / 2, y + 52, cardW - 24, 4, 0xffffff, 1).setOrigin(0.5)
      stripe.setAlpha(0.2)

      const container = this.add.container(0, 0, [card, stripe, title, status])
      container.setSize(cardW, cardH)
      container.setInteractive(new Phaser.Geom.Rectangle(x, y, cardW, cardH), Phaser.Geom.Rectangle.Contains)

      container.on('pointerover', () => {
        card.setAlpha(0.4)
        // subtle hover scale/glow
        this.tweens.add({ targets: [card, stripe, title, status], scaleX: 1.03, scaleY: 1.03, duration: 120, ease: 'Sine.Out' })
        this.showTooltip(def.title, def.description, unlocked, x + cardW / 2, y + cardH / 2)
      })
      container.on('pointerout', () => {
        card.setAlpha(0)
        this.tweens.add({ targets: [card, stripe, title, status], scaleX: 1.0, scaleY: 1.0, duration: 120, ease: 'Sine.In' })
        this.hideTooltip()
      })

      // Click to celebrate if unlocked; placeholder for later deep link/details
      container.on('pointerdown', () => {
        if (unlocked) this.flashCard(card, def.color)
      })

      this.gridContainer?.add(container)
    })

    // Back button
    this.backButton = this.add.text(centerX, this.scale.height - 60, 'BACK', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#660000',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('StartMenuScene'))
      .on('pointerover', () => this.backButton.setStyle({ backgroundColor: '#880000' }))
      .on('pointerout', () => this.backButton.setStyle({ backgroundColor: '#660000' }))

    // Scanlines overlay for retro feel
    this.createScanlines()
  }

  private createSpaceBackground() {
    const w = this.scale.width
    const h = this.scale.height
    // Base fill
    // Sleek dark layered base
    this.bg = this.add.rectangle(0, 0, w, h, 0x0b0d12).setOrigin(0, 0)
    this.add.rectangle(0, 0, w, h, 0x081018, 1).setOrigin(0, 0).setAlpha(0.6)

    this.buildBackgroundTextures()

    // Parallax stars
    this.bgStarsFar = this.add.group()
    this.bgStarsNear = this.add.group()
    for (let i = 0; i < 180; i++) {
      const s = this.add.image(Phaser.Math.Between(0, w), Phaser.Math.Between(0, h), 'ach_star_small').setAlpha(0.5)
      this.bgStarsFar.add(s)
    }
    for (let i = 0; i < 100; i++) {
      const s = this.add.image(Phaser.Math.Between(0, w), Phaser.Math.Between(0, h), 'ach_star_big').setAlpha(0.9)
      this.bgStarsNear.add(s)
    }

    // Ambient neon shapes
    this.bgShapes = this.add.group()
    for (let i = 0; i < 8; i++) this.spawnBgShape()

    // Periodic subtle flash
    const t = this.time.addEvent({ delay: 7000, loop: true, callback: () => this.neonFlash() })
    this.bgTimers.push(t)
    this.bgUpdateActive = true
  }

  private buildBackgroundTextures() {
    // Stars
    const s1 = this.make.graphics({}, false)
    s1.fillStyle(0xffffff, 1).fillCircle(2, 2, 2)
    s1.generateTexture('ach_star_small', 4, 4)
    s1.destroy()
    const s2 = this.make.graphics({}, false)
    s2.fillStyle(0xffffff, 1).fillCircle(3, 3, 3)
    s2.generateTexture('ach_star_big', 6, 6)
    s2.destroy()

    // Triangle
    const tri = this.make.graphics({}, false)
    tri.fillStyle(0x33ffaa, 0.6)
    tri.beginPath(); tri.moveTo(14, 0); tri.lineTo(28, 28); tri.lineTo(0, 28); tri.closePath(); tri.fillPath()
    tri.generateTexture('ach_tri', 28, 28)
    tri.destroy()

    // Circle
    const circ = this.make.graphics({}, false)
    circ.fillStyle(0xff33aa, 0.5)
    circ.fillCircle(16, 16, 16)
    circ.generateTexture('ach_circ', 32, 32)
    circ.destroy()
  }

  private spawnBgShape() {
    const w = this.scale.width
    const h = this.scale.height
    const key = Math.random() < 0.5 ? 'ach_tri' : 'ach_circ'
    const x = Phaser.Math.Between(-40, w + 40)
    const y = Phaser.Math.Between(-40, h + 40)
    const img = this.add.image(x, y, key).setAlpha(0.35).setScale(Phaser.Math.FloatBetween(0.8, 1.6))
    this.bgShapes?.add(img)
    const dir = new Phaser.Math.Vector2(Phaser.Math.FloatBetween(-1, 1), Phaser.Math.FloatBetween(-1, 1)).normalize()
    const speed = Phaser.Math.Between(6, 14)
    this.tweens.add({ targets: img, angle: Phaser.Math.Between(-180, 180), duration: 6000, repeat: -1, yoyo: true, ease: 'Sine.InOut' })
    const mover = this.time.addEvent({ delay: 16, loop: true, callback: () => {
      img.x += dir.x * speed * (16/1000)
      img.y += dir.y * speed * (16/1000)
      if (img.x < -60) img.x = w + 60; if (img.x > w + 60) img.x = -60
      if (img.y < -60) img.y = h + 60; if (img.y > h + 60) img.y = -60
    }})
    this.bgTimers.push(mover)
  }

  private neonFlash() {
    const cx = this.scale.width / 2
    const cy = this.scale.height / 2
    const ring = this.add.rectangle(cx, cy, Math.min(this.scale.width * 0.7, 900), 6, 0x000000, 0)
      .setStrokeStyle(2, 0x00ffff, 0.8)
      .setOrigin(0.5)
    this.tweens.add({ targets: ring, scaleX: { from: 0.6, to: 1.15 }, alpha: { from: 1, to: 0 }, duration: 800, onComplete: () => ring.destroy() })
  }

  private createScanlines() {
    const w = this.scale.width
    const h = this.scale.height
    const g = this.make.graphics({}, false)
    g.fillStyle(0x000000, 0.12)
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2)
    g.generateTexture('ach_scanlines', Math.max(2, Math.floor(w)), Math.max(2, Math.floor(h)))
    g.destroy()
    const sl = this.add.image(0, 0, 'ach_scanlines').setOrigin(0, 0).setAlpha(0.28)
    this.tweens.add({ targets: sl, alpha: { from: 0.2, to: 0.35 }, duration: 1800, yoyo: true, repeat: -1 })
  }

  update(_time: number, delta: number) {
    if (!this.bgUpdateActive) return
    const w = this.scale.width
    const h = this.scale.height
    const df = (delta / 1000)
    const moveAndWrap = (img: Phaser.GameObjects.Image, speed: number) => {
      img.y += speed * df
      if (img.y > h) {
        img.y = -8
        img.x = Phaser.Math.Between(0, w)
      }
    }
    this.bgStarsFar?.getChildren().forEach(c => moveAndWrap(c as Phaser.GameObjects.Image, 14))
    this.bgStarsNear?.getChildren().forEach(c => moveAndWrap(c as Phaser.GameObjects.Image, 28))
  }

  shutdown() {
    for (const t of this.bgTimers) t.remove(false)
    this.bgTimers = []
    this.bgUpdateActive = false
  }

  private showTooltip(title: string, description: string, unlocked: boolean, x: number, y: number) {
    this.tooltip?.destroy()
    const text = `${title}\n\n${description}\n\n${unlocked ? 'Unlocked' : 'Locked'}`
    this.tooltip = this.add.text(x, y, text, {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#001122',
      padding: { x: 12, y: 10 },
      align: 'left'
    }).setOrigin(0.5)
    this.tooltip.setShadow(0, 0, '#00ffff', 12, true, true)
  }

  private hideTooltip() {
    if (this.tooltip) {
      this.tooltip.destroy()
      this.tooltip = undefined
    }
  }

  private flashCard(card: Phaser.GameObjects.Rectangle, color: number) {
    this.tweens.add({ targets: card, alpha: { from: 0.8, to: 0.25 }, duration: 200, yoyo: true, repeat: 2, ease: 'Sine.InOut' })
    const ring = this.add.rectangle(card.x, card.y, card.width + 4, card.height + 4, 0x000000, 0).setStrokeStyle(3, color, 0.9).setOrigin(0.5)
    this.tweens.add({ targets: ring, scale: { from: 1.0, to: 1.15 }, alpha: { from: 1, to: 0 }, duration: 350, onComplete: () => ring.destroy() })
  }
}


