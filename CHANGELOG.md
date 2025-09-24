# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixes and updates
- ChallengeScene: normalized bullet–pillar collider args and guarded Arcade Body before calling `setVelocity` to fix runtime TypeError.
- Enemy bullets: added `collideWorldBounds` + `onWorldBounds` and a world-bounds handler to deactivate offscreen bullets; added enemy bullets ↔ pillars collider to deactivate on impact; increased enemy bullet pool to 400 to prevent bosses from “running out” of bullets and stopping fire.
- Challenge page hydration: removed server-time access to `hasAchievement` during render; completion/unlock visuals now derive from client-loaded `achievements` state to avoid SSR/CSR mismatch.
- Achievements navigation: challenge page buttons now route with `?show=achievements&from=challenge`; AchievementsScene Back first attempts `history.back()` then falls back to `/challenge`; raised Achievements button z-index on challenge page for clickability.
- Start Menu Game Modes layout: rearranged buttons (Boss Test top, Challenges beneath, Endless left, Wave right) with clearer spacing; fixed persistence so the Challenges button is destroyed when leaving Game Modes.

### Challenge Mode (Boss Rush) – fixes and improvements
- Added dedicated `ChallengeScene` for challenge levels with Boss Rush restored:
  - Green “hell” theme arena, two bosses at once (Sentinel + Artillery)
  - Four random pillars with safe placement and static colliders
  - Proper intro (silhouettes, title/subtitle, 2.4s hold, flash/shake)
  - Two separate boss health bars (SENTINEL top, ARTILLERY bottom)
  - ESC pause opens existing `PauseMenuScene`; Retry fully resets inputs/timers/physics
  - On victory: congrats overlay with Continue button returning to Challenge selector
- Bullet physics hardening to fix runtime errors:
  - Use Arcade Body `setVelocity(...)` everywhere; guard bodies with safe casts
  - Clean deactivation on pillar collision for both player and enemy bullets
  - World-bounds cleanup for enemy bullets
- Damage model aligned with Wave mode (no unexpected one‑shots):
  - Boss Rush uses normal HP; only Glass Cannon sets HP=1
  - Enemy collision and boss bullets use `GAME_SETTINGS` scaling
  - Boss contact damage mirrors WaveScene logic
- Start Menu integration:
  - Auto-route `/challenge/play?level=...` into `ChallengeScene`
  - CHALLENGE button added under Game Modes (routes to `/challenge` selector)
- Challenge selector page:
  - Vibrant node map with locked/unlocked/completed visuals and connections
  - Back button top-left; Achievements button bottom-center (pulses on new)
  - Achievements button routes to Start Menu with Achievements auto-opened
- Achievements (per-player):
  - Local achievements now hydrate from/sync to Convex (best-effort)
  - New-achievement “claim” overlay on the challenge selector; badge pulses until seen

### Technical
- Restored `ChallengeScene` registration in `Game.tsx`
- Added `/challenge` and `/challenge/play` routes back into App Router
- Fixed physics callback typings; removed lingering `any` bodies and guarded casts
- Minor lint fixes in challenge code paths

## [1.1.0] - 2025-09-22 — Arena UI & Background changes (branch: ARENA-UI-background-changes)

### Changed
- Space theme background simplified: removed long white stick/streak elements for clearer visuals; retained small soft dots drifting subtly.

### Added
- Boss arena pillars: exactly two randomly placed pillars appear when a boss spawns.
  - Pillars are static colliders: the player cannot move through them.
  - Player bullets collide with pillars and are removed on impact.
  - Boss bullets ignore pillars (no collision) to preserve boss patterns.
  - Pillars are cleaned up when the boss ends, during wave transitions, and on full reset.
- Placement safety: Pillars spawn within bounds, do not overlap each other, and avoid spawning on top of the player.

### Implementation details (how)
- Background cleanup: disabled creation of stick-shaped streaks by removing `createStreaks()` call in `ArenaBackground.ts` (`SpaceThemeLayer` constructor), keeping only `createFloaters()`.
- Pillars: created in `WaveScene.ts` when spawning a boss (`spawnBoss` calls `createBossPillars`). Each pillar is a `Phaser.GameObjects.Rectangle` with a static Arcade Physics body.
  - Collisions: added collider for `player ↔ pillars` and `player bullets ↔ pillars` (deactivates bullets on impact). No collider registered for `enemyBullets ↔ pillars` so boss bullets pass through.
  - Lifecycle: `destroyBossPillars()` is invoked in `cleanupBoss()`, non-boss `startNextWave()` paths, and `resetGame()` to ensure pillars never linger between states.

### Files changed
- `src/game/objects/ArenaBackground.ts`
  - `SpaceThemeLayer`: removed `createStreaks()` invocation to eliminate stick-shaped background streaks.
- `src/game/scenes/WaveScene.ts`
  - Added fields: `bossPillars`, `pillarPlayerCollider`, `pillarBulletCollider`.
  - Added methods: `createBossPillars()`, `destroyBossPillars()`.
  - Hooked into lifecycle: call `createBossPillars()` in `spawnBoss()`, and `destroyBossPillars()` in `cleanupBoss()`, `startNextWave()` (when not boss), and `resetGame()`.
  - Collision setup: colliders for player vs pillars and player bullets vs pillars; intentionally no collider for enemy/boss bullets vs pillars.

### Notes
- Visual decorative pillars in the hell theme background remain purely aesthetic; gameplay pillars are separate colliders spawned only during boss phases.


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
