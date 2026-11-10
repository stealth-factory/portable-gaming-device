# Changelog

Every release of Game Guy, and what changed in it. Generated from the commit
subjects, which is why they are worth writing carefully.

## [0.8.0] - 2026-11-10

### Documentation

- Document the files every game disk needs (GAM-47) (#66)

### Features

- **launcher**: Add disk genres and captured covers (GAM-49) (#74)
- **launcher**: The cover carousel and flipbook previews (GAM-50, GAM-51) (#78)

### Miscellaneous

- **skills**: Update private skills from upstream (GAM-48) (#69)

## [0.7.0] - 2026-11-09

### Bug Fixes

- **i-invade**: Repair the operating instructions from the weapons section (#44)
- **bricks**: Quicken the bat on a sideways stick (GAM-30) (#45)

### Features

- **i-invade**: Sweep cluster fire and move the console pad (#46)

### Performance

- **ImgBot**: Optimize images (#42)

## [0.6.0] - 2026-11-09

### Bug Fixes

- **layout**: Widen action-button gap and tidy the upright power row (GAM-27) (#39)

### Documentation

- Switch the code licence to PolyForm Noncommercial (GAM-29) (#38)

### Features

- **bricks**: Add the bricks disk (GAM-28) (#40)

## [0.5.0] - 2026-11-09

### Bug Fixes

- **console**: Keep the power knob inside its slot on sideways phones (GAM-26) (#34)

### Features

- Haptics on phones and a settings reset (GAM-5) (#30)
- **i-invade**: Auto-marching fleet, button pad, tank teams with three lives and more weapons (GAM-24) (#31)

## [0.4.0] - 2026-11-09

### Bug Fixes

- **console**: Hold the game when the tab or app is hidden (GAM-20) (#29)

### Features

- **kit**: Add the game kit's play layer (GAM-14) (#15)
- Extra fire buttons that appear only when a game maps them (GAM-7) (#17)
- **console**: Show the release version under the nameplate (#25)

### Refactor

- **i-invade**: Move I Invade onto the game kit, with three bomb bays and the fleet attacking upward (GAM-13) (#21)
- **invader-force**: Run Invader Force on the game kit (GAM-12) (#24)

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
