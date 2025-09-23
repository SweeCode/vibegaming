"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { hasAchievement, listAchievements } from '@/game/systems/Achievements';

type ChallengeNode = {
  id: number;
  slug: 'boss_rush' | 'split_attention' | 'no_shots' | 'glass_cannon' | 'speed_demon';
  title: string;
  achievementId?: 'boss_killer' | 'split_attention' | 'no_shots_no_problem';
  desc: string;
};

const CHALLENGES: ChallengeNode[] = [
  { id: 1, slug: 'boss_rush', title: 'Boss Rush', achievementId: 'boss_killer', desc: 'Two bosses at once in a hell arena.' },
  { id: 2, slug: 'split_attention', title: 'Split Attention', achievementId: 'split_attention', desc: 'Sentinel + swarm of fast enemies.' },
  { id: 3, slug: 'no_shots', title: 'No Shots, No Problem', achievementId: 'no_shots_no_problem', desc: 'Limited reload rounds; high accuracy.' },
  { id: 4, slug: 'glass_cannon', title: 'Glass Cannon', desc: 'HP = 1. Dodge or die.' },
  { id: 5, slug: 'speed_demon', title: 'Speed Demon', desc: 'Double speed, heavy recoil.' }
];

export default function Challenge() {
  const router = useRouter();
  const [achievements, setAchievements] = useState<Record<string, { title: string; unlockedAt: number }>>({});
  const [seenMap, setSeenMap] = useState<Record<string, number>>({});
  const [showCongrats, setShowCongrats] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    try {
      const list = listAchievements();
      const map: Record<string, { title: string; unlockedAt: number }> = {};
      list.forEach(a => { map[a.id] = { title: a.title, unlockedAt: a.unlockedAt }; });
      setAchievements(map);
    } catch {}
    try {
      const stored = localStorage.getItem('achievements_seen');
      if (stored) setSeenMap(JSON.parse(stored));
    } catch {}
    return () => {
      document.body.style.margin = '';
      document.body.style.padding = '';
    };
  }, []);

  const completedCount = useMemo(() => {
    let count = 0;
    for (const c of CHALLENGES) {
      if (c.achievementId && hasAchievement(c.achievementId)) count++;
      else break;
    }
    return count;
  }, [achievements]);

  const isCompleted = (c: ChallengeNode) => c.achievementId ? !!achievements[c.achievementId] || hasAchievement(c.achievementId) : false;
  const isUnlocked = (c: ChallengeNode) => c.id <= completedCount + 1;

  const unseenIds = useMemo(() => {
    const ids: string[] = [];
    for (const [id, a] of Object.entries(achievements)) {
      const seenAt = seenMap[id] || 0;
      if ((a?.unlockedAt || 0) > seenAt) ids.push(id);
    }
    return ids;
  }, [achievements, seenMap]);

  const nodes = useMemo(() => {
    const startX = 120;
    const gap = 180;
    const centerY = 260;
    return CHALLENGES.map((c, idx) => ({
      c,
      x: startX + idx * gap,
      y: centerY + (idx % 2 === 0 ? -30 : 30)
    }));
  }, []);

  const onPlay = (slug: ChallengeNode['slug'], unlocked: boolean) => {
    if (!unlocked) return;
    router.push(`/challenge/play?level=${encodeURIComponent(slug)}`);
  };

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'radial-gradient(1200px 800px at 30% 20%, rgba(20,255,200,0.08), rgba(0,0,0,0)) , radial-gradient(900px 600px at 80% 60%, rgba(0,180,255,0.08), rgba(0,0,0,0)) , linear-gradient(180deg, #05070f 0%, #060913 100%)' }}>
      <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 12 }}>
        <Link href="/" style={{ color: '#93c5fd', fontWeight: 600 }}>&larr; Back</Link>
        <button
          onClick={() => {
            if (unseenIds.length > 0) setShowCongrats(true);
            else router.push('/?show=achievements');
          }}
          style={{ position: 'relative', color: '#111827', fontWeight: 800, background: '#22d3ee', padding: '6px 12px', borderRadius: 10, border: '1px solid #0891b2', cursor: 'pointer', boxShadow: unseenIds.length ? '0 0 16px rgba(34,211,238,0.9), 0 0 32px rgba(34,211,238,0.6)' : 'none', animation: unseenIds.length ? 'pulseShadow 1.2s ease-in-out infinite' : undefined }}
        >
          Achievements
          {unseenIds.length ? (
            <span style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: 'white', borderRadius: 999, padding: '2px 6px', fontSize: 12 }}>{unseenIds.length}</span>
          ) : null}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 36, gap: 6 }}>
        <h1 style={{ color: 'white', fontSize: 34, margin: 0 }}>Challenges</h1>
        <p style={{ color: '#cbd5e1', marginTop: 0 }}>Beat levels to unlock the next. Pets and upgrades disabled.</p>
      </div>

      <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
          {nodes.map((n, i) => {
            if (i === 0) return null;
            const prev = nodes[i - 1];
            const unlocked = isUnlocked(n.c);
            const completed = isCompleted(n.c);
            const color = completed ? '#22d3ee' : unlocked ? '#64748b' : '#334155';
            return (
              <line key={`line-${i}`} x1={prev.x} y1={prev.y} x2={n.x} y2={n.y} stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
            );
          })}
        </svg>

        {nodes.map(({ c, x, y }) => {
          const completed = isCompleted(c);
          const unlocked = isUnlocked(c);
          const locked = !unlocked;
          const size = 72;
          const glow = completed ? '0 0 22px rgba(34,211,238,0.95), 0 0 46px rgba(34,211,238,0.6)' : unlocked ? '0 0 14px rgba(148,163,184,0.5)' : 'none';
          const bg = completed ? 'linear-gradient(180deg, #0b3b46, #051c22)' : unlocked ? 'linear-gradient(180deg, #0b1220, #08111c)' : 'linear-gradient(180deg, #0a0f1a, #070b12)';
          const border = completed ? '#22d3ee' : unlocked ? '#93c5fd' : '#475569';
          const cursor = unlocked ? 'pointer' as const : 'default' as const;
          const animation = unlocked && !completed ? 'pulseShadow 1.6s ease-in-out infinite' : undefined;
          const label = completed ? '✅' : locked ? '🔒' : '🔓';
          const badge = completed && c.achievementId && achievements[c.achievementId]?.title ? achievements[c.achievementId]?.title : completed ? 'Completed' : '';

          return (
            <div key={c.id} onClick={() => onPlay(c.slug, unlocked)} title={c.title}
              style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: '50%', border: `3px solid ${border}`, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0', boxShadow: glow, cursor, transition: 'transform 180ms ease', animation }}
              onMouseEnter={e => { if (unlocked) (e.currentTarget.style.transform = 'scale(1.06)'); }}
              onMouseLeave={e => { (e.currentTarget.style.transform = 'scale(1.0)'); }}
            >
              <div style={{ textAlign: 'center', lineHeight: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{c.id}</div>
                <div style={{ fontSize: 14, opacity: 0.9 }}>{label}</div>
              </div>
              {badge ? (
                <div style={{ position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)', background: '#0b3b46', color: '#22d3ee', padding: '2px 8px', borderRadius: 999, fontSize: 12, border: '1px solid #22d3ee' }}>{badge}</div>
              ) : null}
              <div style={{ position: 'absolute', top: size + 12, left: '50%', transform: 'translateX(-50%)', width: 220, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                {c.title}: {c.desc}
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes pulseShadow {
          0%, 100% { box-shadow: 0 0 8px rgba(148,163,184,0.4); }
          50% { box-shadow: 0 0 22px rgba(148,163,184,0.9); }
        }
      `}</style>

      {showCongrats ? (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 520, background: 'linear-gradient(180deg,#031b21,#051018)', border: '1px solid #22d3ee', borderRadius: 16, padding: 20, color: '#e2e8f0', textAlign: 'center', boxShadow: '0 0 24px rgba(34,211,238,0.5)' }}>
            <div style={{ fontSize: 24, color: '#22d3ee', fontWeight: 800, marginBottom: 10 }}>New Achievement{unseenIds.length > 1 ? 's' : ''}!</div>
            <div style={{ fontSize: 16, color: '#cbd5e1', marginBottom: 16 }}>
              {unseenIds.map((id) => (
                <div key={id} style={{ padding: '6px 10px', margin: '6px 0', borderRadius: 10, background: '#07242b', border: '1px solid #0ea5b9' }}>{achievements[id]?.title || id}</div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  const updated = { ...seenMap };
                  for (const id of unseenIds) updated[id] = Math.max(seenMap[id] || 0, achievements[id]?.unlockedAt || Date.now());
                  setSeenMap(updated);
                  try { localStorage.setItem('achievements_seen', JSON.stringify(updated)); } catch {}
                  setShowCongrats(false);
                }}
                style={{ background: '#22d3ee', color: '#0b1220', fontWeight: 800, padding: '10px 16px', borderRadius: 10, border: '1px solid #0891b2', cursor: 'pointer' }}
              >Claim</button>
              <button onClick={() => router.push('/achievements')} style={{ background: 'transparent', color: '#93c5fd', fontWeight: 700, padding: '10px 16px', borderRadius: 10, border: '1px solid #1e293b', cursor: 'pointer' }}>View All</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}


