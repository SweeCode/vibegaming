import * as Phaser from 'phaser'

export class PetScene extends Phaser.Scene {
  private uiContainer?: Phaser.GameObjects.Container
  private previewBody?: Phaser.GameObjects.Graphics
  private previewEyes?: Phaser.GameObjects.Graphics
  private activeTab: 'upgrades' | 'appearance' = 'upgrades'
  private upgradesGroup?: Phaser.GameObjects.Container
  private appearanceGroup?: Phaser.GameObjects.Container

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
      .text(centerX, centerY - 230, 'PET SETTINGS', { fontSize: '36px', color: '#00ffff', fontStyle: 'bold' })
      .setOrigin(0.5)

    // Tabs within Pet menu
    const tabUp = this.add.text(centerX - 120, centerY - 185, 'UPGRADES', { fontSize: '16px', color: '#ffffaa', backgroundColor: '#003355', padding: { x: 10, y: 6 } }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    const tabAp = this.add.text(centerX + 120, centerY - 185, 'APPEARANCE', { fontSize: '16px', color: '#dddddd', backgroundColor: '#002233', padding: { x: 10, y: 6 } }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    const setTab = (which: 'upgrades' | 'appearance') => {
      this.activeTab = which
      tabUp.setColor(which === 'upgrades' ? '#ffffaa' : '#dddddd')
      tabAp.setColor(which === 'appearance' ? '#ffffaa' : '#dddddd')
      this.upgradesGroup?.setVisible(which === 'upgrades')
      this.appearanceGroup?.setVisible(which === 'appearance')
    }

    // Load modifiers and settings
    const loadCapsAndSettings = async () => {
      const { UpgradeManager } = await import('../systems/UpgradeManager')
      const mgr = new UpgradeManager()
      const mods = mgr.getModifiers()
      const { loadPetSettings, savePetSettings, loadPetAppearance, savePetAppearance, ensurePetStateReady } = await import('../systems/petSettings')
      await ensurePetStateReady()
      const current = loadPetSettings(mods)
      const { getSnacks, getUpgradeCost, getUpgrades, getMaxLevel, setLevel, resetAllWithRefund, getSelectedLevels, setSelectedLevel } = await import('../systems/petUpgrades')

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

      // Caps driven by upgrades/modifiers only; saving settings must not change the low/high ends
      const minRate = Math.max(200, (mods as unknown as { petFireRateMs?: number }).petFireRateMs ?? 200)
      const maxDmg = Math.max(1, Math.floor(mods.petDrone?.dps ?? 9999))

      // Removed caps text per request

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

      // Anchor Save/Back to bottom corners of the panel to avoid overlaps
      saveBtn.setPosition(panel.x - panel.width / 2 + 80, panel.y + panel.height / 2 - 24)
      backBtn.setPosition(panel.x + panel.width / 2 - 80, panel.y + panel.height / 2 - 24)

      saveBtn.on('pointerdown', () => {
        savePetSettings(current)
        savePetAppearance(app)
        this.cameras.main.flash(150, 0, 255, 180)
      })
      backBtn.on('pointerdown', () => this.scene.start('StartMenuScene'))

      // Snacks header and counters (moved to top-left of the panel)
      const snacksText = this.add.text(
        panel.x - panel.width / 2 + 16,
        panel.y - panel.height / 2 + 16,
        `Snacks: ${getSnacks()}`,
        { fontSize: '18px', color: '#ffff66', fontStyle: 'bold' }
      ).setOrigin(0, 0)

      // Sleek reset button tucked in top-right of panel
      const resetBtn = this.add.text(panel.x + panel.width / 2 - 60, panel.y - panel.height / 2 + 16, '↺ Reset', {
        fontSize: '14px', color: '#ffffff', backgroundColor: '#333333', padding: { x: 8, y: 4 }
      }).setOrigin(1, 0)
        .setAlpha(0.75)
        .setInteractive({ useHandCursor: true })
      resetBtn.on('pointerover', () => resetBtn.setAlpha(1))
      resetBtn.on('pointerout', () => resetBtn.setAlpha(0.75))
      resetBtn.on('pointerdown', () => {
        const { snacks } = resetAllWithRefund()
        this.cameras.main.flash(150, 200, 255, 200)
        snacksText.setText(`Snacks: ${snacks}`)
        refreshUpgradesUI()
      })

      // Pet upgrades section
      const upgHeader = this.add.text(centerX, centerY + 40, 'PET UPGRADES', { fontSize: '20px', color: '#aeefff', fontStyle: 'bold' }).setOrigin(0.5)

      const leftUpgX = centerX - 260
      const upgY0 = centerY + 85
      const rowH = 34

      type Row = { label: string; kind: keyof ReturnType<typeof getUpgrades>; y: number }
      const rows: Row[] = [
        { label: 'Fire rate bonus', kind: 'fireRateLevel', y: upgY0 + rowH * 0 },
        { label: 'Damage cap bonus', kind: 'damageLevel', y: upgY0 + rowH * 1 },
        { label: 'Bullet speed', kind: 'bulletSpeedLevel', y: upgY0 + rowH * 2 },
        { label: 'Bullet size', kind: 'bulletSizeLevel', y: upgY0 + rowH * 3 }
      ]

      // Keep direct refs for each row to avoid stale name lookups
      const rowRefs: Record<string, {
        lvl?: Phaser.GameObjects.Text,
        cost?: Phaser.GameObjects.Text,
        dec?: Phaser.GameObjects.Text,
        inc?: Phaser.GameObjects.Text,
        buy?: Phaser.GameObjects.Text
      }> = {}

      const refreshUpgradesUI = () => {
        const u = getUpgrades()
        const s = getSelectedLevels()
        snacksText.setText(`Snacks: ${getSnacks()}`)
        for (const r of rows) {
          const refs = rowRefs[r.kind] || {}
          const lvlText = refs.lvl
          const costText = refs.cost
          const dec = refs.dec
          const inc = refs.inc
          const buy = refs.buy
          const level = u[r.kind]
          const sel = s[r.kind]
          const max = getMaxLevel(r.kind)
          const atMax = level >= max
          const cost = getUpgradeCost(r.kind, level)
          // Show selected/max (e.g., 1/8). Selected is capped by purchased elsewhere.
          lvlText?.setText(`Lv ${sel}/${max}`)
          costText?.setText(atMax ? 'MAX' : `Next: ${cost}`)
          // Update buy button label and interactivity
          if (buy) {
            const canAfford = getSnacks() >= cost
            if (atMax) {
              buy.setText('MAX').setAlpha(0.6).disableInteractive()
            } else {
              buy.setText(`UPGRADE (${cost})`).setAlpha(canAfford ? 1 : 0.6)
              if (canAfford) {
                buy.setInteractive({ useHandCursor: true })
              } else {
                buy.disableInteractive()
              }
            }
          }
          // +/- operate on selected levels: 0..purchased
          if (dec) {
            const canDec = sel > 0
            dec.setAlpha(canDec ? 1 : 0.4)
            if (canDec) dec.setInteractive({ useHandCursor: true }); else dec.disableInteractive()
          }
          if (inc) {
            const canInc = sel < level
            inc.setAlpha(canInc ? 1 : 0.4)
            if (canInc) inc.setInteractive({ useHandCursor: true }); else inc.disableInteractive()
          }
        }
      }

      // Collect created upgrade UI elements so we can add them into the same container
      const upgElements: Phaser.GameObjects.GameObject[] = []
      for (const r of rows) {
        const label = this.add.text(leftUpgX, r.y, r.label, { fontSize: '16px', color: '#ffffff' }).setOrigin(0, 0.5)
        const lvlText = this.add.text(leftUpgX + 260, r.y, '', { fontSize: '16px', color: '#ffff00' }).setOrigin(0, 0.5)
        lvlText.setName(`lvl_${r.kind}`)
        const costText = this.add.text(leftUpgX + 360, r.y, '', { fontSize: '14px', color: '#cccccc' }).setOrigin(0, 0.5)
        costText.setName(`cost_${r.kind}`)
        const dec = this.add.text(leftUpgX + 500 - 30, r.y, '−', { fontSize: '20px', color: '#ffffff', backgroundColor: '#333333', padding: { x: 8, y: 2 } }).setOrigin(0.5)
        dec.setName(`dec_${r.kind}`)
        dec.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          // Lower selected level (cannot go below 0)
          const sNow = getSelectedLevels()
          const res = setSelectedLevel(r.kind, sNow[r.kind] - 1)
          if (res.success) { refreshUpgradesUI() }
        })
        const inc = this.add.text(leftUpgX + 500 + 30, r.y, '+', { fontSize: '20px', color: '#ffffff', backgroundColor: '#004400', padding: { x: 8, y: 2 } }).setOrigin(0.5)
        inc.setName(`inc_${r.kind}`)
        inc.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          // Raise selected level (bounded by purchased)
          const sNow = getSelectedLevels()
          const res = setSelectedLevel(r.kind, sNow[r.kind] + 1)
          if (res.success) { refreshUpgradesUI() }
        })
        // Upgrade (apply) button (placed where the old selected slider was)
        const buyBtn = this.add.text(leftUpgX + 620, r.y, 'UPGRADE', { fontSize: '14px', color: '#ffffff', backgroundColor: '#005599', padding: { x: 10, y: 6 } }).setOrigin(0.5)
          .setName(`buy_${r.kind}`)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            const u = getUpgrades()
            const level = u[r.kind]
            const max = getMaxLevel(r.kind)
            if (level >= max) return
            const cost = getUpgradeCost(r.kind, level)
            if (getSnacks() < cost) { this.cameras.main.shake(80, 0.003); return }
            const res = setLevel(r.kind, level + 1)
            if (res.success) {
              // Auto-sync selected to new purchased so label flips 0/8 -> 1/8 immediately
              setSelectedLevel(r.kind, res.newLevel)
              this.cameras.main.flash(100, 180, 255, 200)
              refreshUpgradesUI()
            }
          })
        // Track refs
        rowRefs[r.kind] = { lvl: lvlText, cost: costText, dec, inc, buy: buyBtn }
        upgElements.push(label, lvlText, costText, dec, inc, buyBtn)
      }

      refreshUpgradesUI()

      // Appearance customization UI (own group with extra spacing)
      const appHeader = this.add.text(centerX, centerY - 30, 'APPEARANCE', { fontSize: '22px', color: '#aeefff', fontStyle: 'bold' }).setOrigin(0.5)
      const app = loadPetAppearance()

      // Preview
      const pvX = centerX
      const pvY = centerY + 10
      this.previewBody = this.add.graphics({ x: pvX, y: pvY })
      this.previewEyes = this.add.graphics({ x: pvX, y: pvY })
      const drawPreview = () => {
        const size = 12
        const half = size / 2
        this.previewBody!.clear(); this.previewEyes!.clear()
        this.previewBody!.fillStyle(app.bodyColor, 1)
        this.previewBody!.lineStyle(1, 0x000000, 0.2)
        if (app.shape === 'square') {
          this.previewBody!.fillRect(-half, -half, size, size)
          this.previewBody!.strokeRect(-half, -half, size, size)
        } else if (app.shape === 'triangle') {
          this.previewBody!.beginPath(); this.previewBody!.moveTo(0, -half); this.previewBody!.lineTo(half, half); this.previewBody!.lineTo(-half, half); this.previewBody!.closePath(); this.previewBody!.fillPath(); this.previewBody!.strokePath()
        } else {
          this.previewBody!.fillCircle(0, 0, half)
          this.previewBody!.strokeCircle(0, 0, half)
        }
        const eyeY = -half * 0.2
        if (app.eyeStyle === 'bar') {
          this.previewEyes!.fillStyle(0x111111, 0.6)
          this.previewEyes!.fillRect(-half * 0.6, eyeY - 1, half * 1.2, 2)
        } else if (app.eyeStyle === 'glow') {
          this.previewEyes!.fillStyle(0xffffaa, 0.9)
          this.previewEyes!.fillCircle(0, eyeY, 2)
          this.previewEyes!.fillStyle(0xffffaa, 0.25)
          this.previewEyes!.fillCircle(0, eyeY, 4)
        } else {
          this.previewEyes!.fillStyle(0x111111, 0.9)
          this.previewEyes!.fillCircle(-3, eyeY, 1)
          this.previewEyes!.fillCircle(3, eyeY, 1)
        }
      }
      drawPreview()

      // Color presets (spaced out)
      const colors = [0x66ccff, 0xff6666, 0x66ff99, 0xffdd66, 0xbb88ff]
      const colorLabel = this.add.text(centerX - 140, centerY + 30, 'Color:', { fontSize: '14px', color: '#cccccc' }).setOrigin(0, 0.5)
      const colorBoxes: Phaser.GameObjects.Rectangle[] = []
      colors.forEach((c, i) => {
        const box = this.add.rectangle(centerX - 84 + i * 42, centerY + 36, 24, 24, c).setOrigin(0.5).setStrokeStyle(1, 0xffffff, 0.6)
        box.setInteractive({ useHandCursor: true }).on('pointerdown', () => { app.bodyColor = c; drawPreview() })
        colorBoxes.push(box)
      })
      const shapeText = this.add.text(centerX - 140, centerY + 90, 'Shape:', { fontSize: '14px', color: '#cccccc' }).setOrigin(0, 0.5)
      const shapeOpts = ['circle', 'triangle', 'square'] as const
      const shapeButtons: Phaser.GameObjects.Text[] = []
      shapeOpts.forEach((s, idx) => {
        const t = this.add.text(centerX - 60 + idx * 90, centerY + 90, s, { fontSize: '14px', color: app.shape === s ? '#ffffaa' : '#dddddd', backgroundColor: app.shape === s ? '#224422' : undefined, padding: app.shape === s ? { x: 6, y: 2 } : undefined }).setOrigin(0.5)
        t.setInteractive({ useHandCursor: true }).on('pointerdown', () => { app.shape = s; drawPreview(); shapeButtons.forEach(b => b.setColor('#dddddd')); t.setColor('#ffffaa') })
        shapeButtons.push(t)
      })
      const eyeText = this.add.text(centerX - 140, centerY + 120, 'Eyes:', { fontSize: '14px', color: '#cccccc' }).setOrigin(0, 0.5)
      const eyeOpts = ['dot', 'bar', 'glow'] as const
      const eyeButtons: Phaser.GameObjects.Text[] = []
      eyeOpts.forEach((s, idx) => {
        const t = this.add.text(centerX - 60 + idx * 80, centerY + 120, s, { fontSize: '14px', color: app.eyeStyle === s ? '#ffffaa' : '#dddddd', backgroundColor: app.eyeStyle === s ? '#224422' : undefined, padding: app.eyeStyle === s ? { x: 6, y: 2 } : undefined }).setOrigin(0.5)
        t.setInteractive({ useHandCursor: true }).on('pointerdown', () => { app.eyeStyle = s; drawPreview(); eyeButtons.forEach(b => b.setColor('#dddddd')); t.setColor('#ffffaa') })
        eyeButtons.push(t)
      })

      // Build groups
      this.upgradesGroup = this.add.container(0, 0, [
        unlocksHeader,
        unlockText,
        futureText,
        settingsHeader,
        fireRateLabel,
        fireText,
        fireDec,
        fireInc,
        dmgLabel,
        dmgText,
        dmgDec,
        dmgInc,
        resetBtn,
        snacksText,
        upgHeader,
        ...upgElements
      ])

      this.appearanceGroup = this.add.container(0, 0, [
        appHeader,
        this.previewBody!,
        this.previewEyes!,
        colorLabel,
        ...colorBoxes,
        shapeText,
        ...shapeButtons,
        eyeText,
        ...eyeButtons
      ])

      // Root container
      this.uiContainer = this.add.container(0, 0, [
        bg,
        panel,
        title,
        tabUp,
        tabAp,
        // settings controls added only in upgrades tab group
        saveBtn,
        backBtn,
        this.upgradesGroup,
        this.appearanceGroup
      ])

      // Initialize tab state
      tabUp.on('pointerdown', () => setTab('upgrades'))
      tabAp.on('pointerdown', () => setTab('appearance'))
      setTab('upgrades')
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
