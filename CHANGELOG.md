# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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