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
    // Signal StartMenu via URL to route appropriately
    try {
      const show = params.get('show');
      if (show === 'achievements') {
        // StartMenuScene will read this from URL and open Achievements
      }
    } catch {}
  }, [params]);
  return <Game />;
};

export default GameLoader;
