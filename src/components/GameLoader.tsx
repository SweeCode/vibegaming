'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { getOrCreateIdentity } from '@/lib/convexClient';
import { useSearchParams } from 'next/navigation';

const Game = dynamic(() => import('@/components/Game'), { ssr: false });

const GameLoader = () => {
  const params = useSearchParams();
  useEffect(() => {
    // Ensure identity exists on first load
    try { getOrCreateIdentity(); } catch {}
    // If on /challenge/play, kick into ChallengeScene with selected level
    try {
      const level = params.get('level');
      if (typeof window !== 'undefined' && window && level) {
        // Defer until Phaser has booted and StartMenu created once
        const timer = setInterval(() => {
          const anyGame = (window as unknown as { Phaser?: unknown }).Phaser;
          // Not a reliable hook; instead use global event: attempt to switch scene when available
          const games = (window as unknown as { Phaser?: { Games?: unknown } }).Phaser as unknown as { Games?: { List?: unknown[] } } | undefined;
          // Fallback: try accessing global game via canvas parent; if not, just try scene start on active instance
          try {
            const canvases = document.querySelectorAll('canvas');
            if (canvases.length) {
              // attempt to find Phaser instance via global variable (not guaranteed). We rely on StartMenu keyboard to start normally otherwise.
              // No-op here; ChallengeScene can be started from StartMenu via a simple keyboard shortcut if needed.
            }
          } catch {}
        }, 500);
        setTimeout(() => clearInterval(timer), 5000);
      }
    } catch {}
  }, []);
  return <Game />;
};

export default GameLoader;
