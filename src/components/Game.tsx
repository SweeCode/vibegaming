'use client';

import * as Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { GAME_CONFIG } from '@/game/config/gameConfig';
import { MainScene } from '@/game/scenes/MainScene';
import { StartMenuScene } from '@/game/scenes/StartMenuScene';
import { ScoreEntryScene } from '@/game/scenes/ScoreEntryScene';

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
      scale: GAME_CONFIG.scale,
      scene: [StartMenuScene, MainScene, ScoreEntryScene]
    };

    gameInstance.current = new Phaser.Game(config);

    return () => {
      gameInstance.current?.destroy(true);
      gameInstance.current = null;
    };
  }, []);

  return (
    <div 
      ref={gameRef} 
      style={{ 
        width: '100vw', 
        height: '100vh', 
        margin: 0, 
        padding: 0,
        overflow: 'hidden'
      }} 
    />
  );
};

export default Game;