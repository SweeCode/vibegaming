'use client';

import * as Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { GAME_CONFIG } from '@/game/config/gameConfig';
import { MainScene } from '@/game/scenes/MainScene';

const Game = () => {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameInstance.current) {
      return;
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: GAME_CONFIG.width,
      height: GAME_CONFIG.height,
      parent: gameRef.current || undefined,
      physics: GAME_CONFIG.physics,
      scene: [MainScene]
    };

    gameInstance.current = new Phaser.Game(config);

    return () => {
      gameInstance.current?.destroy(true);
      gameInstance.current = null;
    };
  }, []);

  return <div ref={gameRef} />;
};

export default Game;