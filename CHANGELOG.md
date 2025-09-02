# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Snacks counter in the in-game HUD (both Classic and Wave modes) so pet currency is visible during play
- Boss spawn preview with flash effects during countdown - shows exact spawn location with boss-specific colors

### Fixed
- Pet upgrades screen now shows upgrade rows with level, cost, and BUY buttons and updates Snacks balance on purchase
- Snacks HUD refreshes after boss defeats that award snacks
- Leaderboard UI issues: buttons now appear above background, removed duplicate header text
- Leaderboard positioning: moved below mode switching buttons for full visibility

### Changed
- Boss waves now have a cinematic intro on all boss waves (warning typewriter + 3-2-1 countdown with camera shakes) replacing the normal wave banner on boss waves
- Shooter boss volley increased from 5 to 7 shots; bullets flagged as boss-origin for damage scaling
- Artillery boss overhauled: slow homing movement, doubled salvos (36 shots), fires immediately on spawn, max health set to 50
- Boss schedule: wave 5 always Sentinel; wave 10 always Artillery; after wave 10, every 5th wave spawns a boss with a 50/50 Sentinel/Artillery split for variety
- Boss damage scales with later waves: contact damage and boss bullets increase with wave number
- Wave 1 no longer spawns a boss (was previously forced in dev)
- Fixed boss overlap/vanish bug by normalizing overlap arguments and only deactivating bullets
- Robust boss cleanup on death/reset/shutdown; removed lingering colliders/adds; clear enemy bullets on reset
- Bullet behavior hardened: spawn offset from player, set velocity directly, TTL safety, and cleanup of TTL on hit to prevent ghost deactivations
- Wave logging and debug logs gated behind IS_DEV only
- Start menu redesigned with 2D shooter boss theme: parallax starfields, drifting enemy silhouettes, periodic boss flash, scanlines, and pulsing title
- Added WebAudio unlock handler to resume audio after first user gesture and silence autoplay warnings in production
- Leaderboard layout improved: resized panel for better proportions and more entries visible

## [1.0.0] - 2024-01-XX

### Added
- **Game Modes**
  - Classic Mode: Endless survival with progressive difficulty
  - Wave Mode: Structured wave-based combat with breaks
- **Upgrade System**
  - 6 upgradeable player stats (Health, Speed, Max Ammo, Reload Speed, Bullet Speed, Bullet Damage)
  - Score-based currency system
  - Progressive cost scaling (1.5x multiplier per level)
  - Persistent storage in localStorage
- **Core Gameplay Features**
  - WASD movement controls
  - Mouse aiming and shooting
  - Pause system (ESC key)
  - Health and ammo management
  - Reloading mechanics with visual progress bar
- **Visual Features**
  - Swedish-themed main menu with Nordic flag colors
  - Real-time UI elements (health bar, ammo counter, score display)
  - Wave progression notifications
  - Character customization menu
- **Enemy System**
  - Three enemy types: Regular, Fast, and Big enemies
  - Dynamic spawning based on difficulty/wave
  - Off-screen cleanup to prevent memory leaks
- **Leaderboard System**
  - Separate leaderboards for Classic and Wave modes
  - Player name entry for high scores
  - Time tracking for each game session
  - Local storage persistence
- **Scene Management**
  - Proper scene lifecycle management
  - Data passing between scenes
  - Timer cleanup on transitions
  - Pause/resume functionality

### Technical Improvements
- TypeScript implementation for type safety
- Modular architecture with separated concerns
- Proper memory management and cleanup
- Responsive design for different screen sizes
- Scene state management
- Error handling and null checks

### Performance Optimizations
- Object pooling for bullets
- Efficient collision detection
- Proper sprite destruction
- Timer management
- Memory leak prevention

## [0.1.0] - Initial Development

### Added
- Basic Next.js setup with Phaser.js integration
- Simple player movement and shooting
- Basic enemy spawning
- Initial UI elements