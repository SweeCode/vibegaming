import * as Phaser from 'phaser'

export class PetScene extends Phaser.Scene {
  private uiContainer?: Phaser.GameObjects.Container

  constructor() {
    super({ key: 'PetScene' })
  }

  create() {
    const centerX = this.scale.width / 2
    const centerY = this.scale.height / 2

    // Background
    const bg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x07131e, 1).setOrigin(0, 0)
    const panel = this.add
      .rectangle(centerX, centerY, Math.min(900, this.scale.width * 0.9), Math.min(520, this.scale.height * 0.85), 0x001122, 0.94)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x00ffff, 0.6)

    const title = this.add
      .text(centerX, centerY - 220, 'PET SETTINGS', { fontSize: '36px', color: '#00ffff', fontStyle: 'bold' })
      .setOrigin(0.5)

    // Load modifiers and settings
    const loadCapsAndSettings = async () => {
      const { UpgradeManager } = await import('../systems/UpgradeManager')
      const mgr = new UpgradeManager()
      const mods = mgr.getModifiers()
      const { loadPetSettings, savePetSettings } = await import('../systems/petSettings')
      const current = loadPetSettings(mods)
      const { getSnacks, tryPurchase, getUpgradeCost, getUpgrades, getMaxLevel } = await import('../systems/petUpgrades')

      const labelsStyle = { fontSize: '18px', color: '#ffffff' } as Phaser.Types.GameObjects.Text.TextStyle
      const valueStyle = { fontSize: '18px', color: '#ffff00' } as Phaser.Types.GameObjects.Text.TextStyle

      const leftX = centerX - 320
      const rightX = centerX - 40

      // Left column
      const unlocksHeader = this.add
        .text(leftX, centerY - 140, 'Unlocks', { fontSize: '22px', color: '#aeefff', fontStyle: 'bold' })
        .setOrigin(0, 0.5)
      const unlocked = true
      const unlockText = this.add
        .text(leftX, centerY - 110, unlocked ? 'Pet: Unlocked' : 'Pet: Locked (reach level 10)', {
          fontSize: '16px',
          color: unlocked ? '#00ff99' : '#ff6666'
        })
        .setOrigin(0, 0.5)
      const futureText = this.add
        .text(leftX, centerY - 80, 'Future: Pet skins, AI modes', { fontSize: '14px', color: '#cccccc' })
        .setOrigin(0, 0.5)

      // Right column
      const settingsHeader = this.add
        .text(rightX, centerY - 140, 'Settings', { fontSize: '22px', color: '#aeefff', fontStyle: 'bold' })
        .setOrigin(0, 0.5)

      const minRate = Math.max(200, (mods as unknown as { petFireRateMs?: number }).petFireRateMs ?? current.fireRateMs)
      const maxDmg = Math.max(1, Math.floor(mods.petDrone?.dps ?? current.damage))

      const capText = this.add
        .text(rightX, centerY - 110, `Caps: fire rate ≥ ${minRate}ms, dmg ≤ ${maxDmg}` as string, {
          fontSize: '14px',
          color: '#cccccc'
        })
        .setOrigin(0, 0.5)

      const fireRateLabel = this.add.text(rightX, centerY - 80, 'Fire rate (ms):', labelsStyle).setOrigin(0, 0.5)
      const fireText = this.add.text(centerX + 180, centerY - 80, `${current.fireRateMs}`, valueStyle).setOrigin(0.5)
      const fireDec = this.add
        .text(centerX + 240, centerY - 80, '-50', { fontSize: '18px', color: '#ffffff', backgroundColor: '#333', padding: { x: 8, y: 4 } })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      const fireInc = this.add
        .text(centerX + 290, centerY - 80, '+50', { fontSize: '18px', color: '#ffffff', backgroundColor: '#333', padding: { x: 8, y: 4 } })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      const applyFire = (val: number) => {
        current.fireRateMs = Math.max(minRate, val)
        fireText.setText(`${current.fireRateMs}`)
      }
      fireDec.on('pointerdown', () => applyFire(current.fireRateMs - 50))
      fireInc.on('pointerdown', () => applyFire(current.fireRateMs + 50))

      const dmgLabel = this.add.text(rightX, centerY - 40, 'Damage:', labelsStyle).setOrigin(0, 0.5)
      const dmgText = this.add.text(centerX + 180, centerY - 40, `${current.damage}`, valueStyle).setOrigin(0.5)
      const dmgDec = this.add
        .text(centerX + 240, centerY - 40, '-1', { fontSize: '18px', color: '#ffffff', backgroundColor: '#333', padding: { x: 8, y: 4 } })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      const dmgInc = this.add
        .text(centerX + 290, centerY - 40, '+1', { fontSize: '18px', color: '#ffffff', backgroundColor: '#333', padding: { x: 8, y: 4 } })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      const applyDmg = (val: number) => {
        current.damage = Math.min(maxDmg, Math.max(1, val))
        dmgText.setText(`${current.damage}`)
      }
      dmgDec.on('pointerdown', () => applyDmg(current.damage - 1))
      dmgInc.on('pointerdown', () => applyDmg(current.damage + 1))

      // Buttons
      const saveBtn = this.add
        .text(centerX - 120, centerY + 190, 'SAVE', {
          fontSize: '20px',
          color: '#ffffff',
          backgroundColor: '#004400',
          padding: { x: 14, y: 8 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
      const backBtn = this.add
        .text(centerX + 120, centerY + 190, 'BACK', {
          fontSize: '20px',
          color: '#ffffff',
          backgroundColor: '#660000',
          padding: { x: 14, y: 8 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })

      saveBtn.on('pointerdown', () => {
        savePetSettings(current)
        this.cameras.main.flash(150, 0, 255, 180)
      })
      backBtn.on('pointerdown', () => this.scene.start('StartMenuScene'))

      // Snacks header and counters
      const snacksText = this.add.text(centerX, centerY - 200, `Snacks: ${getSnacks()}`, { fontSize: '20px', color: '#ffff66', fontStyle: 'bold' }).setOrigin(0.5)

      // Pet upgrades section
      const upgHeader = this.add.text(centerX, centerY + 20, 'PET UPGRADES (COST: snacks)', { fontSize: '20px', color: '#aeefff', fontStyle: 'bold' }).setOrigin(0.5)

      const leftUpgX = centerX - 260
      const upgY0 = centerY + 60
      const rowH = 34

      type Row = { label: string; kind: keyof ReturnType<typeof getUpgrades>; y: number }
      const rows: Row[] = [
        { label: 'Fire rate bonus', kind: 'fireRateLevel', y: upgY0 + rowH * 0 },
        { label: 'Damage cap bonus', kind: 'damageLevel', y: upgY0 + rowH * 1 },
        { label: 'Bullet speed', kind: 'bulletSpeedLevel', y: upgY0 + rowH * 2 },
        { label: 'Bullet size', kind: 'bulletSizeLevel', y: upgY0 + rowH * 3 }
      ]

      const refreshUpgradesUI = () => {
        const u = getUpgrades()
        snacksText.setText(`Snacks: ${getSnacks()}`)
        for (const r of rows) {
          const lvlText = this.children.getByName(`lvl_${r.kind}`) as Phaser.GameObjects.Text | null
          const costText = this.children.getByName(`cost_${r.kind}`) as Phaser.GameObjects.Text | null
          const btn = this.children.getByName(`btn_${r.kind}`) as Phaser.GameObjects.Text | null
          const level = u[r.kind]
          const max = getMaxLevel(r.kind)
          const atMax = level >= max
          const cost = getUpgradeCost(r.kind, level)
          lvlText?.setText(`Lv ${level}/${max}`)
          costText?.setText(atMax ? 'MAX' : `Cost: ${cost}`)
          btn?.setText(atMax ? 'MAXED' : 'BUY')
            .setStyle({ backgroundColor: atMax ? '#333333' : '#004400', color: atMax ? '#888888' : '#ffffff' })
          if (btn) btn.disableInteractive()
          if (!atMax) btn?.setInteractive({ useHandCursor: true })
        }
      }

      // Collect created upgrade UI elements so we can add them into the same container
      const upgElements: Phaser.GameObjects.Text[] = []
      for (const r of rows) {
        const label = this.add.text(leftUpgX, r.y, r.label, { fontSize: '16px', color: '#ffffff' }).setOrigin(0, 0.5)
        const lvlText = this.add.text(leftUpgX + 260, r.y, '', { fontSize: '16px', color: '#ffff00' }).setOrigin(0, 0.5)
        lvlText.setName(`lvl_${r.kind}`)
        const costText = this.add.text(leftUpgX + 360, r.y, '', { fontSize: '14px', color: '#cccccc' }).setOrigin(0, 0.5)
        costText.setName(`cost_${r.kind}`)
        const btn = this.add.text(leftUpgX + 460, r.y, 'BUY', { fontSize: '14px', color: '#ffffff', backgroundColor: '#004400', padding: { x: 10, y: 4 } }).setOrigin(0.5)
        btn.setName(`btn_${r.kind}`)
        btn.on('pointerdown', () => {
          const res = tryPurchase(r.kind)
          if (res.success) {
            this.cameras.main.flash(120, 180, 255, 200)
            refreshUpgradesUI()
          } else {
            this.cameras.main.shake(120, 0.004)
          }
        })
        upgElements.push(label, lvlText, costText, btn)
      }

      refreshUpgradesUI()

      // Group for cleanup
      this.uiContainer = this.add.container(0, 0, [
        bg,
        panel,
        title,
        unlocksHeader,
        unlockText,
        futureText,
        settingsHeader,
        capText,
        fireRateLabel,
        fireText,
        fireDec,
        fireInc,
        dmgLabel,
        dmgText,
        dmgDec,
        dmgInc,
        saveBtn,
        backBtn,
        snacksText,
        upgHeader,
        ...upgElements
      ])
    }

    void loadCapsAndSettings()
  }

  shutdown() {
    if (this.uiContainer) {
      this.uiContainer.destroy(true)
      this.uiContainer = undefined
    }
  }
}
