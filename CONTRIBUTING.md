# Contributing to Space Shooter Game

Thank you for your interest in contributing to this project! This document provides guidelines for contributing to the codebase.

## Development Setup

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Git

### Getting Started
1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Start development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) to test

## Code Structure

### Architecture Principles
- **Separation of Concerns**: Each file has a single responsibility
- **Type Safety**: Use TypeScript interfaces and types
- **Memory Management**: Always clean up timers and objects
- **Scene Management**: Follow Phaser.js scene lifecycle

### File Organization
```
src/game/
├── config/        # Game configuration and constants
├── objects/       # Game entities (Player, Enemy)
├── scenes/        # Game scenes and UI
├── systems/       # Game logic systems
└── ui/           # User interface components
```

## Coding Standards

### TypeScript
- Use explicit types for all function parameters and returns
- Define interfaces for complex objects
- Avoid `any` type - use proper typing
- Use `readonly` for immutable arrays and objects

### Naming Conventions
- Classes: PascalCase (`PlayerClass`)
- Functions/Methods: camelCase (`updatePosition`)
- Constants: UPPER_SNAKE_CASE (`MAX_HEALTH`)
- Files: PascalCase for classes, camelCase for utilities

### Scene Management
```typescript
// Always implement proper cleanup
shutdown() {
  if (this.timer) {
    this.timer.destroy();
    this.timer = undefined;
  }
}

// Pass data between scenes properly
this.scene.start('NextScene', { data: value });
```

### Memory Management
- Destroy timers in `shutdown()` methods
- Use object pooling for frequently created objects
- Remove event listeners when no longer needed
- Clean up graphics and sprites properly

## Adding New Features

### New Upgrade Types
1. Add to `PlayerStats` interface in `UpgradeManager.ts`
2. Define base cost and effect calculation
3. Update `CustomizationScene.ts` UI
4. Apply effects in relevant game scenes

### New Enemy Types
1. Extend `Enemy` class in `Enemy.ts`
2. Add spawn logic in `EnemySpawner`
3. Configure in difficulty/wave systems
4. Add appropriate textures/graphics

### New Scenes
1. Extend `Phaser.Scene`
2. Implement required lifecycle methods
3. Add to scene list in `Game.tsx`
4. Handle data passing and transitions

### New Game Modes
1. Create new scene class
2. Implement game logic systems
3. Add to main menu navigation
4. Create separate leaderboard if needed

## Testing Guidelines

### Manual Testing Checklist
- [ ] Game starts without errors
- [ ] Both game modes work correctly
- [ ] Pause/resume functionality
- [ ] Upgrade system purchases and applies effects
- [ ] Leaderboards save and display correctly
- [ ] Scene transitions work smoothly
- [ ] No memory leaks after extended play

### Performance Testing
- Monitor memory usage during gameplay
- Check for timer leaks
- Verify proper object cleanup
- Test scene transitions

## Submitting Changes

### Pull Request Process
1. Create a feature branch from main
2. Make your changes following coding standards
3. Test thoroughly (both game modes)
4. Update documentation if needed
5. Submit pull request with clear description

### Commit Messages
Use clear, descriptive commit messages:
```
feat: add new laser weapon type
fix: resolve scene transition memory leak
docs: update upgrade system documentation
refactor: improve enemy spawning logic
```

### PR Description Template
```markdown
## What does this PR do?
Brief description of changes

## Testing
- [ ] Classic mode works
- [ ] Wave mode works  
- [ ] Upgrade system works
- [ ] No console errors
- [ ] Performance is acceptable

## Screenshots (if applicable)

## Breaking Changes
List any breaking changes
```

## Code Review Guidelines

### What We Look For
- Code follows established patterns
- Proper TypeScript usage
- Memory management considerations
- Performance implications
- User experience impact

### Common Issues
- Missing null checks
- Timer cleanup not implemented
- Scene data not properly passed
- Type safety violations
- Performance bottlenecks

## Bug Reports

### Bug Report Template
```markdown
**Describe the bug**
Clear description of what happened

**To Reproduce**
Steps to reproduce the behavior

**Expected behavior**
What you expected to happen

**Screenshots**
If applicable, add screenshots

**Environment:**
- Browser: [e.g. Chrome 91]
- Device: [e.g. Desktop, Mobile]
- Game Mode: [Classic/Wave]

**Additional context**
Any other context about the problem
```

## Feature Requests

### Before Submitting
- Check if feature aligns with game vision
- Consider implementation complexity
- Think about user experience impact

### Feature Request Template
```markdown
**Is your feature request related to a problem?**
Clear description of the problem

**Describe the solution you'd like**
Clear description of what you want to happen

**Describe alternatives you've considered**
Other solutions you've considered

**Additional context**
Mockups, examples, or additional context
```

## Questions?

Feel free to open an issue for questions about:
- Code architecture decisions
- Implementation approaches
- Testing strategies
- Performance considerations

---

Thank you for contributing! 🚀