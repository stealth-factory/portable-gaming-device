# Changelog

Every release of Game Guy, and what changed in it. Generated from the commit
subjects, which is why they are worth writing carefully.

## [0.3.1] - 2026-11-09

### Bug Fixes

- **stick**: Never leave the joystick stuck when a finger's release is lost (WII-54) (#14)

### Documentation

- Track every change in Linear and land it through a pull request (WII-45) (#13)
- Point AGENTS.md at the Game Guy team and its GAM issue prefix (GAM-21) (#19)

### Tests

- Play every disk from the menu (WII-41) (#16)

## [0.3.0] - 2026-11-09

### Bug Fixes

- Show a real DOS prompt (A:\>) on the boot screen (#8)

### Features

- **invader-force**: Shooting a capsule sets it off (#10)
- Per-app button mapping, with SELECT on the disk menu (#9)

## [0.2.0] - 2026-11-09

### Features

- **invader-force**: Weapon capsules, lightning laser, speed boost, blasts and an atomic bomb (#3)

## [0.1.0] - 2026-11-09

The baseline: everything built before releases were cut, written by hand
rather than generated from the history behind it.

### Features

- **console**: Game Guy 3000 Deluxe, a 1983-style console on a phosphor CRT that cold-boots (BIOS memory test, POST beep, floppy drive) into a disk menu
- **console**: A themed loading screen, synthesised drive sounds and its own load time (never over 5 seconds) for every disk
- **console**: Operating instructions per game in English, Traditional Chinese and Simplified Chinese
- **console**: Phosphor dial, SOUND, GLOW, HOLD and FULL switches, RESET, and offline play once loaded
- **tunnel-raider**: Tunnel Raider, the first disk
- **dino-run**: Dino Run, with its own top-ten table
- **invader-force**: Invader Force, with BOOST as a recharging shield
- **i-invade**: I Invade, the alien shooter played from the fleet's side
- **pages**: A page per game that boots straight into its disk, with its own title, description and share image
