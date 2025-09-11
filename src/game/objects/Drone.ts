import * as Phaser from 'phaser'
import { Player } from './Player'

export class Drone extends Phaser.GameObjects.Container {
  private sceneRef: Phaser.Scene
  private player: Player
  private fireTimer?: Phaser.Time.TimerEvent
  private onFire: (x: number, y: number) => void
  private fireRateMs: number

  constructor(scene: Phaser.Scene, player: Player, onFire: (x: number, y: number) => void, fireRateMs = 600) {
    super(scene, player.x, player.y)
    this.sceneRef = scene
    this.player = player
    this.onFire = onFire
    this.fireRateMs = fireRateMs

    const g = scene.add.graphics()
    g.fillStyle(0x66ccff, 1)
    g.fillCircle(0, 0, 6)
    this.add(g)
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

  update(time: number): void {
    // orbit around player
    const t = time / 1000
    const radius = 42
    this.x = this.player.x + Math.cos(t * 2) * radius
    this.y = this.player.y + Math.sin(t * 2) * radius
  }
}
