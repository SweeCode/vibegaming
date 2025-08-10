'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { getOrCreateIdentity } from '@/lib/convexClient';

const Game = dynamic(() => import('@/components/Game'), { ssr: false });

const GameLoader = () => {
  useEffect(() => {
    // Ensure identity exists on first load
    try { getOrCreateIdentity(); } catch {}
  }, []);
  return <Game />;
};

export default GameLoader;
