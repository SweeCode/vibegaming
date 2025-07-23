'use client';

import dynamic from 'next/dynamic';

const Game = dynamic(() => import('@/components/Game'), { ssr: false });

const GameLoader = () => {
  return <Game />;
};

export default GameLoader;
