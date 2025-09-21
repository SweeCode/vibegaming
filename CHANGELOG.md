# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Upgrade overhaul
- Unified skill tree rendered on a single, centered map with distinct paths (basic, defense, special, offense, mobility, hybrid)
- Pan and zoom on the tree (drag to pan, mouse wheel to zoom); larger spacing between nodes for readability
- New root node "Awakening" (cost 0). Unlocking it reveals adjacent nodes; prerequisites/affordability now clearly indicated
- Active vs Passive traits labeled and styled; branch colors standardized with an on-screen legend
- Background polygons tint each path; unlock FX and pulse feedback for newly available nodes
- Score-connected unlocking respected (Available Points = total score − total spent)
- Build management: 3 centered build slots with save/load and naming
- Tabs within Customization: Customize (avatar only), Skill Tree (full map), Builds (centered cards)
- **Fixed**: Tooltip and unlock FX positioning for nodes in panned/zoomed tree view
- **Fixed**: Active/passive trait detection using proper typing instead of 'as any'
- **Added**: Current stats HUD restored in Customize tab with proper layering
- **Added**: Point2D interface for type safety in geometry helpers
- **Fixed**: Build slot name variable scoping so saved builds can be loaded after first save
- **Fixed**: Wheel event typing and proper handling of pointer events
- Skill builds now sync to Convex (with localStorage fallback) so named loadouts follow the player across devices
- Available points pull from the hosted Convex wave totals when present, keeping spendable score in step with cross-session progress

### Pet upgrade and appearance overhaul
- PetScene split into tabs: UPGRADES and APPEARANCE (no overlap between sections)
- Upgrades UI: clearer spacing; shows current level and “Next: cost”; minus/plus controls and a dedicated “UPGRADE” button per row
- Refund/reset: sleek corner Reset button returns all spent snacks on pet upgrades
- Appearance editor: centered preview with larger color swatches; selectable shape (circle/triangle/square) and eye styles (dot/bar/glow)
- Drone rendering updated to reflect appearance (color, shape, eyes) with a refresh method for live updates
- Snacks counter and upgrade rows update immediately after purchases
- Pet settings, appearance, snacks, and upgrade levels hydrate from/sync to Convex via the shared pet state store, ensuring consistent pet loadouts beyond a single browser

### Added
- **Pet System**: Comprehensive pet management and customization system
  - PetScene for managing pet settings and configurations
  - Pet unlock system requiring level 10 achievement
  - Configurable pet fire rate and damage settings
  - Pet settings menu integrated into start screen
  - Pet drone with customizable fire rate (minimum 200ms)
  - Pet damage caps based on skill tree upgrades
- **Enhanced Skill Tree System**: Improved skill tree interface and functionality
  - Better tooltip system showing unlock requirements and prerequisites
  - Detailed unlock status display (LOCKED/UNLOCKABLE/MAXED)
  - Prerequisite checking with specific rank requirements
  - Pet fire rate modifiers in skill tree
  - Enhanced skill tree backend with Convex integration
- **Persistent Wave Progress System**: Complete wave-based scoring system with Convex backend storage
  - Individual wave completion tracking with timestamps
  - Score persistence across game sessions
  - Wave completion status display ("ALREADY COMPLETED" notifications)
  - Wave progress indicator in UI showing highest completed wave
- **Score Management System**: Comprehensive score tracking and validation
  - ScoreManager class for handling wave completion and score calculation
  - Base score calculation for regular and boss waves
  - Efficiency bonus system based on kill ratio and completion speed
  - Duplicate score prevention for already completed waves
- **Enhanced Wave Mode Features**:
  - Wave progress display in start menu
  - Visual indicators for completed vs uncompleted waves
  - Boss wave completion status in intro sequences
- Snacks counter in the in-game HUD (both Classic and Wave modes) so pet currency is visible during play
- Boss spawn preview with flash effects during countdown - shows exact spawn location with boss-specific colors

### Fixed
- **Score System Bug**: Fixed issue where replaying completed waves would appear to award additional score
  - Score accumulation now properly prevented for already completed waves
  - UI display correctly shows only total score for completed waves
  - Current wave score resets appropriately when waves are already completed
- Pet upgrades screen now shows upgrade rows with level, cost, and BUY buttons and updates Snacks balance on purchase
- Snacks HUD refreshes after boss defeats that award snacks
- Leaderboard UI issues: buttons now appear above background, removed duplicate header text
- Leaderboard positioning: moved below mode switching buttons for full visibility

### Changed
- High score flow now reuses/persists the stored player name through the guest session helpers so localStorage and Convex stay aligned.
- **Pet System Integration**: Enhanced pet functionality throughout the game
  - Pet drone now supports configurable fire rate in constructor
  - Player shield detection method added for pet system integration
  - Pet button in start menu with unlock requirements and tooltips
- **Wave Completion Logic**: Improved wave completion handling with proper score validation
  - Wave completion now checks against persistent storage before awarding score
  - Boss and regular wave completion properly integrated with score system
  - Wave notifications show completion status with appropriate styling
- **Game Scene Management**: Updated scene registration and management
  - PetScene added to main game scene list
  - Audio configuration preserved during scene updates
- **Development Improvements**: Cleaned up development-specific features
  - Removed dev-only boss spawning on wave 1
  - Improved skill tree tooltip system with better error handling
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
