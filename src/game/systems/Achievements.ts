export type AchievementId = 'boss_killer' | 'split_attention' | 'no_shots_no_problem';

export interface Achievement {
  id: AchievementId;
  title: string;
  unlockedAt: number;
}

const STORAGE_KEY = 'achievements';

function loadAll(): Record<string, Achievement> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, Achievement>;
    return data || {};
  } catch {
    return {};
  }
}

function saveAll(map: Record<string, Achievement>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function hasAchievement(id: AchievementId): boolean {
  const all = loadAll();
  return !!all[id];
}

import { grantAchievementConvex, listAchievementsConvex } from '@/lib/convexClient';

export function grantAchievement(id: AchievementId, title: string): void {
  const all = loadAll();
  if (!all[id]) {
    const now = Date.now();
    all[id] = { id, title, unlockedAt: now };
    saveAll(all);
    // Fire-and-forget remote save
    void grantAchievementConvex(id, title, now);
  }
}

export function listAchievements(): Achievement[] {
  const all = loadAll();
  return Object.values(all);
}

// Best-effort hydrate from remote on module init
void (async () => {
  try {
    const rows = await listAchievementsConvex();
    if (rows && rows.length) {
      const merged: Record<string, Achievement> = { ...loadAll() };
      for (const r of rows) merged[r.achievementId] = { id: r.achievementId as AchievementId, title: r.title, unlockedAt: r.unlockedAt };
      saveAll(merged);
    }
  } catch {}
})();


