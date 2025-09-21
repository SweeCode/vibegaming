// Simple persistent storage for player appearance (currently just body color)

export type PlayerAppearance = {
  bodyColor: number
}

const DEFAULT_APPEARANCE: PlayerAppearance = {
  bodyColor: 0xffffff
}

const STORAGE_KEY = 'player_appearance'

export function loadPlayerAppearance(): PlayerAppearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_APPEARANCE }
    const parsed = JSON.parse(raw) as Partial<PlayerAppearance>
    return { ...DEFAULT_APPEARANCE, ...parsed }
  } catch {
    return { ...DEFAULT_APPEARANCE }
  }
}

export function savePlayerAppearance(appearance: PlayerAppearance): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance)) } catch {}
}

export function getPlayerColor(): number {
  return loadPlayerAppearance().bodyColor
}

export function setPlayerColor(color: number): void {
  const current = loadPlayerAppearance()
  savePlayerAppearance({ ...current, bodyColor: color })
}


