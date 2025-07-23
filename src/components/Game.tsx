
'use client';

import * as Phaser from 'phaser';
import { useEffect, useRef } from 'react';

const Game = () => {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameInstance.current) {
      return;
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: gameRef.current || undefined,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false
        }
      },
      scene: {
        preload: preload,
        create: create,
        update: update
      }
    };

    gameInstance.current = new Phaser.Game(config);

    let player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    let keys: { [key: string]: Phaser.Input.Keyboard.Key };
    let bullets: Phaser.Physics.Arcade.Group;
    let enemies: Phaser.Physics.Arcade.Group;
    let score = 0;
    let scoreText: Phaser.GameObjects.Text;
    let ammo = 30;
    let ammoText: Phaser.GameObjects.Text;
    let isReloading = false;
    let health = 100;
    let healthBar: Phaser.GameObjects.Graphics;
    let gameOver = false;

    function preload(this: Phaser.Scene) {
        const playerGraphics = this.make.graphics({ fillStyle: { color: 0xffffff } }, true);
        playerGraphics.fillRect(0, 0, 32, 32);
        playerGraphics.generateTexture('player', 32, 32);
        playerGraphics.destroy();

        const bulletGraphics = this.make.graphics({ fillStyle: { color: 0xff0000 } }, true);
        bulletGraphics.fillRect(0, 0, 8, 8);
        bulletGraphics.generateTexture('bullet', 8, 8);
        bulletGraphics.destroy();

        const enemyGraphics = this.make.graphics({ fillStyle: { color: 0x00ff00 } }, true);
        enemyGraphics.fillRect(0, 0, 24, 24);
        enemyGraphics.generateTexture('enemy', 24, 24);
        enemyGraphics.destroy();
    }

    function create(this: Phaser.Scene) {
      player = this.physics.add.sprite(400, 300, 'player').setCollideWorldBounds(true);

      keys = this.input.keyboard.addKeys('W,A,S,D') as { [key: string]: Phaser.Input.Keyboard.Key };

      bullets = this.physics.add.group({
        defaultKey: 'bullet',
        maxSize: 30
      });

      enemies = this.physics.add.group({
        runChildUpdate: true
      });

      this.time.addEvent({
        delay: 1000,
        callback: spawnEnemy,
        callbackScope: this,
        loop: true
      });

      scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', color: '#fff' });
      ammoText = this.add.text(16, 50, 'Ammo: 30', { fontSize: '32px', color: '#fff' });

      healthBar = this.add.graphics();
      updateHealthBar();

      this.physics.add.collider(bullets, enemies, (bullet, enemy) => {
        (bullet as Phaser.GameObjects.Sprite).setActive(false).setVisible(false);
        enemy.destroy();
        score += 10;
        scoreText.setText('Score: ' + score);
      });

      this.physics.add.collider(player, enemies, (player, enemy) => {
        enemy.destroy();
        health -= 25;
        updateHealthBar();
        if (health <= 0) {
          this.physics.pause();
          player.setTint(0xff0000);
          gameOver = true;
          this.add.text(400, 300, 'Game Over', { fontSize: '64px', color: '#ff0000' }).setOrigin(0.5);
        }
      });

      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (gameOver || isReloading || ammo === 0) return;

        const bullet = bullets.get(player.x, player.y);
        if (bullet) {
          (bullet as Phaser.GameObjects.Sprite).setActive(true).setVisible(true);
          this.physics.moveTo(bullet, pointer.x, pointer.y, 500);
          ammo--;
          ammoText.setText('Ammo: ' + ammo);

          if (ammo === 0) {
            isReloading = true;
            ammoText.setText('Reloading...');
            this.time.delayedCall(2000, () => {
              ammo = 30;
              isReloading = false;
              ammoText.setText('Ammo: ' + ammo);
            });
          }
        }
      });
    }

    function update(this: Phaser.Scene) {
        if (gameOver) return;

        for (const bullet of bullets.getMatching('active', true)) {
            if (bullet.x < 0 || bullet.x > 800 || bullet.y < 0 || bullet.y > 600) {
                (bullet as Phaser.GameObjects.Sprite).setActive(false).setVisible(false);
            }
        }

        const pointer = this.input.activePointer;
        player.rotation = Phaser.Math.Angle.Between(player.x, player.y, pointer.worldX, pointer.worldY);

        const speed = 200;
        let velocityX = 0;
        let velocityY = 0;

        if (keys.W.isDown) {
            velocityY = -1;
        } else if (keys.S.isDown) {
            velocityY = 1;
        }

        if (keys.A.isDown) {
            velocityX = -1;
        } else if (keys.D.isDown) {
            velocityX = 1;
        }

        const velocity = new Phaser.Math.Vector2(velocityX, velocityY).normalize().scale(speed);
        player.setVelocity(velocity.x, velocity.y);
    }

    function spawnEnemy(this: Phaser.Scene) {
        const x = Phaser.Math.Between(0, 800);
        const y = Phaser.Math.Between(0, 600);
        const side = Phaser.Math.Between(0, 3);
        let spawnX = 0, spawnY = 0;

        switch(side) {
            case 0: // top
                spawnX = x;
                spawnY = 0;
                break;
            case 1: // right
                spawnX = 800;
                spawnY = y;
                break;
            case 2: // bottom
                spawnX = x;
                spawnY = 600;
                break;
            case 3: // left
                spawnX = 0;
                spawnY = y;
                break;
        }

      const enemy = enemies.create(spawnX, spawnY, 'enemy');
      if(enemy) {
        this.physics.moveToObject(enemy, player, 100);
      }
    }

    function updateHealthBar() {
      healthBar.clear();
      healthBar.fillStyle(0xff0000, 1);
      healthBar.fillRect(16, 90, 200, 20);
      healthBar.fillStyle(0x00ff00, 1);
      healthBar.fillRect(16, 90, 200 * (health / 100), 20);
    }


    return () => {
      gameInstance.current?.destroy(true);
      gameInstance.current = null;
    };
  }, []);

  return <div ref={gameRef} />;
};

export default Game;
