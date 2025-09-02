'use client';

import * as Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { GAME_CONFIG } from '@/game/config/gameConfig';
import { MainScene } from '@/game/scenes/MainScene';
import { StartMenuScene } from '@/game/scenes/StartMenuScene';
import { ScoreEntryScene } from '@/game/scenes/ScoreEntryScene';
import { PauseMenuScene } from '@/game/scenes/PauseMenuScene';
import { WaveScene } from '@/game/scenes/WaveScene';
import { CustomizationScene } from '@/game/scenes/CustomizationScene';

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
      audio: {
        disableWebAudio: false,
        noAudio: false
      },
      scene: [StartMenuScene, MainScene, WaveScene, ScoreEntryScene, PauseMenuScene, CustomizationScene]
    };

    gameInstance.current = new Phaser.Game(config);

    return () => {
      // Clean up audio context before destroying the game
      try {
        const game = gameInstance.current;
        if (game && game.sound) {
          const soundAny = game.sound as unknown as { context?: AudioContext };
          const ctx = soundAny.context;
          if (ctx && ctx.state !== 'closed') {
            // Don't close the context, just ensure it's suspended
            if (ctx.state === 'running') {
              void ctx.suspend();
            }
          }
        }
      } catch (error) {
        // Silently handle cleanup errors
        console.warn('Audio context cleanup failed:', error);
      }
      
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