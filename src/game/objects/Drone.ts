import * as Phaser from 'phaser'
import { Player } from './Player'
import { loadPetAppearance, type PetAppearance } from '../systems/petSettings'

export class Drone extends Phaser.GameObjects.Container {
  private sceneRef: Phaser.Scene
  private player: Player
  private fireTimer?: Phaser.Time.TimerEvent
  private onFire: (x: number, y: number) => void
  private fireRateMs: number
  private appearance: PetAppearance
  private bodyG: Phaser.GameObjects.Graphics
  private eyesG: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene, player: Player, onFire: (x: number, y: number) => void, fireRateMs = 600) {
    super(scene, player.x, player.y)
    this.sceneRef = scene
    this.player = player
    this.onFire = onFire
    this.fireRateMs = fireRateMs
    this.appearance = loadPetAppearance()

    this.bodyG = scene.add.graphics()
    this.eyesG = scene.add.graphics()
    this.add(this.bodyG)
    this.add(this.eyesG)
    this.redrawAppearance()
    scene.add.existing(this)

    this.startFiring()
  }

  destroy(fromScene?: boolean): void {
    this.fireTimer?.remove()
    this.fireTimer = undefined
    super.destroy(fromScene)
  }

  startFiring() {
    this.fireTimer?.remove()
    this.fireTimer = this.sceneRef.time.addEvent({
      delay: this.fireRateMs,
      loop: true,
      callback: () => this.fire()
    })
  }

  private fire() {
    this.onFire(this.x, this.y)
  }

  refreshAppearanceFromStorage() {
    this.appearance = loadPetAppearance()
    this.redrawAppearance()
  }

  private redrawAppearance() {
    const size = 12
    const half = size / 2
    const color = this.appearance.bodyColor

    this.bodyG.clear()
    this.eyesG.clear()

    this.bodyG.fillStyle(color, 1)
    this.bodyG.lineStyle(1, 0x000000, 0.2)

    switch (this.appearance.shape) {
      case 'square': {
        this.bodyG.fillRect(-half, -half, size, size)
        this.bodyG.strokeRect(-half, -half, size, size)
        break
      }
      case 'triangle': {
        this.bodyG.beginPath()
        this.bodyG.moveTo(0, -half)
        this.bodyG.lineTo(half, half)
        this.bodyG.lineTo(-half, half)
        this.bodyG.closePath()
        this.bodyG.fillPath()
        this.bodyG.strokePath()
        break
      }
      default: {
        this.bodyG.fillCircle(0, 0, half)
        this.bodyG.strokeCircle(0, 0, half)
        break
      }
    }

    // Eyes
    const eyeY = -half * 0.2
    if (this.appearance.eyeStyle === 'bar') {
      this.eyesG.fillStyle(0x111111, 0.6)
      this.eyesG.fillRect(-half * 0.6, eyeY - 1, half * 1.2, 2)
    } else if (this.appearance.eyeStyle === 'glow') {
      this.eyesG.fillStyle(0xffffaa, 0.9)
      this.eyesG.fillCircle(0, eyeY, 2)
      this.eyesG.fillStyle(0xffffaa, 0.25)
      this.eyesG.fillCircle(0, eyeY, 4)
    } else {
      // dot (two eyes)
      this.eyesG.fillStyle(0x111111, 0.9)
      this.eyesG.fillCircle(-3, eyeY, 1)
      this.eyesG.fillCircle(3, eyeY, 1)
    }
  }

  update(time: number): void {
    // orbit around player
    const t = time / 1000
    const radius = 42
    this.x = this.player.x + Math.cos(t * 2) * radius
    this.y = this.player.y + Math.sin(t * 2) * radius
  }
}
