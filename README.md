# Space Shooter Game

A modern web-based space shooter game built with Next.js, TypeScript, and Phaser.js featuring progressive difficulty, upgrade systems, and multiple game modes.

## 🎮 Features

### Game Modes
- **Classic Mode**: Endless survival with progressive difficulty scaling
- **Wave Mode**: Structured wave-based combat with breaks between waves

### Upgrade System
- **6 Upgradeable Stats**: Health, Speed, Max Ammo, Reload Speed, Bullet Speed, Bullet Damage
- **Score-Based Currency**: Spend points earned from gameplay
- **Progressive Costs**: Each upgrade level costs more (1.5x multiplier)
- **Persistent Storage**: Upgrades saved between sessions

### Core Gameplay
- **WASD Movement**: Smooth directional controls
- **Mouse Aiming**: Point and click to shoot
- **Pause System**: ESC to pause, resume or quit
- **Health System**: Take damage and heal between rounds
- **Ammo Management**: Limited ammo with reload mechanics
- **Persistent Score System**: Wave completion tracking with Convex backend storage

### Visual Features
- **Swedish Theme**: Nordic-inspired main menu design
- **Real-time UI**: Health bars, ammo counters, score tracking
- **Wave Notifications**: Clear progression indicators
- **Customization Menu**: Character preview and stats display

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd my-app

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to play the game.

### Building for Production
```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🎯 How to Play

### Controls
- **WASD**: Move your character
- **Mouse**: Aim and shoot
- **ESC**: Pause game
- **Left Click**: Fire weapon

### Game Modes

#### Classic Mode
- Endless survival gameplay
- Progressive difficulty every few points
- Enemies spawn continuously
- Survive as long as possible

#### Wave Mode  
- Structured wave-based progression
- 3-second breaks between waves
- Increasing enemy counts and variety
- Clear objectives per wave
- **Persistent Progress**: Wave completion tracked across sessions
- **Score Validation**: Prevents duplicate scoring on replay
- **Progress Indicators**: Visual feedback for completed vs uncompleted waves
- **Boss Battles**: Epic boss encounters every 5 waves with cinematic intros and spawn previews

### Boss Battles
- **Sentinel Boss**: Red-colored boss with rapid-fire attacks
- **Artillery Boss**: Cyan-colored boss with devastating salvos
- **Cinematic Intros**: Warning messages with typewriter effects
- **Spawn Previews**: Visual flash effects showing exact boss spawn location
- **Countdown System**: Dramatic 3-2-1 countdown with camera shakes
- **Boss Schedule**: Every 5th wave (waves 5, 10, 15, etc.)

### Upgrade System
1. **Earn Points**: Play either game mode to earn score points
2. **Access Customization**: Click "CUSTOMIZE" from main menu
3. **Purchase Upgrades**: Spend points on 6 different stats
4. **See Immediate Effects**: Upgrades apply instantly in-game

#### Available Upgrades
| Stat | Effect | Base Value | Per Level |
|------|--------|------------|-----------|
| Health | Maximum HP | 100 | +25 |
| Speed | Movement speed | 200 px/s | +20 |
| Max Ammo | Bullet capacity | 10 | +2 |
| Reload Speed | Reload time | 2000ms | -150ms |
| Bullet Speed | Projectile speed | 400 px/s | +50 |
| Bullet Damage | Damage per hit | 1 | +1 |

## 📁 Project Structure

```
src/
├── app/                    # Next.js app directory
├── components/             # React components
│   └── Game.tsx           # Main game component
└── game/                  # Phaser game code
    ├── config/            # Game configuration
    ├── objects/           # Game entities
    │   ├── Player.ts      # Player character
    │   └── Enemy.ts       # Enemy types and spawning
    ├── scenes/            # Game scenes
    │   ├── StartMenuScene.ts      # Main menu
    │   ├── MainScene.ts           # Classic mode gameplay
    │   ├── WaveScene.ts           # Wave mode gameplay
    │   ├── PauseMenuScene.ts      # Pause overlay
    │   ├── ScoreEntryScene.ts     # Name entry for scores
    │   └── CustomizationScene.ts  # Upgrade interface
    ├── systems/           # Game systems
    │   ├── DifficultyManager.ts   # Classic mode difficulty
    │   ├── WaveManager.ts         # Wave mode progression
    │   ├── UpgradeManager.ts      # Character upgrades
    │   └── ScoreManager.ts        # Persistent score tracking
    └── ui/                # UI components
        ├── GameUI.ts      # In-game interface
        └── ReloadingBar.ts # Reload progress indicator
```

## 🛠 Technical Details

### Technologies Used
- **Next.js 15.4.3**: React framework
- **TypeScript**: Type-safe JavaScript
- **Phaser.js 3.90.0**: Game engine
- **Convex**: Backend database for persistent score storage
- **LocalStorage**: Data persistence for upgrades and settings

### Key Systems

#### Upgrade System Architecture
```typescript
interface PlayerStats {
  health: number;
  speed: number;
  maxAmmo: number;
  reloadSpeed: number;
  bulletSpeed: number;
  bulletDamage: number;
}
```

#### Scene Management
- Proper scene lifecycle management
- Data passing between scenes
- Timer cleanup on scene transitions
- Pause/resume functionality

#### Data Persistence
- Upgrade levels stored in localStorage
- Separate leaderboards for each game mode
- Wave completion tracking in Convex database
- Score accumulation across sessions with duplicate prevention

## 🎨 Customization

### Adding New Upgrades
1. Add to `PlayerStats` interface in `UpgradeManager.ts`
2. Define base cost and effect in upgrade system
3. Update customization UI
4. Apply effects in game scenes

### Creating New Enemy Types
1. Extend `Enemy` class in `Enemy.ts`
2. Add to enemy spawning logic
3. Configure in wave/difficulty systems

### Adding New Scenes
1. Create scene class extending `Phaser.Scene`
2. Add to scene list in `Game.tsx`
3. Handle transitions and data passing

## 🐛 Known Issues

- None currently reported

## 🔮 Future Features

The architecture is designed to easily support:
- **Character Classes**: Different player types with unique abilities
- **Weapon Varieties**: Multiple weapon types with distinct characteristics
- **Equipment System**: Armor, shields, and special items
- **Skill Trees**: Branching upgrade paths
- **Multiplayer**: Co-op or competitive modes
- **Sound Effects**: Audio feedback and music
- **Achievements**: Unlockable goals and rewards

## 📝 Development Notes

### Adding New Features
- Follow existing patterns for scene management
- Use TypeScript interfaces for type safety
- Implement proper cleanup in `shutdown()` methods
- Store persistent data in localStorage with versioning

### Performance Considerations
- Object pooling for bullets and enemies
- Proper sprite destruction to prevent memory leaks
- Efficient collision detection
- Timer cleanup on scene transitions

## 📄 License

This project is for educational and personal use.

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

---

**Enjoy your space adventure!** 🚀✨
