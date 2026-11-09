# The shared game kit

A spec for `src/games/kit/`: a library of gameplay building blocks that any
Game Guy game can import. Tracked as
[WII-44](https://linear.app/stealth-company/issue/WII-44). This document
describes what to build and how it fits the console; nothing in it is
implemented yet.

## Why

The console core (`src/console/`, reached only through `ConsoleAPI`) already
shares console-level services with every game: the CRT picture and palette,
input, the synth, scores and name entry, banners, analytics, the menu and the
loading screens. Gameplay building blocks are not shared at all, so every game
rewrites them. Invader Force and I Invade carry near-identical copies of:

| Building block | Invader Force | I Invade |
| --- | --- | --- |
| Sprites from string art | `art.ts` `sprite()` | `art.ts` `sprite()` |
| Explosions and floating points | `F.bursts`, drawn in `draw()` | same |
| Crumbling walls | `bunkerHit()`, wall drawing | same, different shape |
| Score, best and extra lives | `addScore()` | same, different threshold and jingle |
| The top bar | `hud()` | same, minus the weapon badges |
| Ready → play → dying → clear | first lines of `update()` | same |
| Left/right from stick and keys | two lines in `update()` | same |
| Wave-clear, death and extra-life jingles | `tone()` chords | same |

Dino Run and Tunnel Raider share the top bar, the scoring rule and the round
sequence too, in their own words. A fifth game would copy all of this again.

The kit gives these one home. Games import what they need; the console core is
untouched. Weapon drops from Invader Force (PR #3) become the first pickup
system built on it.

## Rules

1. **It lives in `src/games/kit/`**, beside the game folders, and games import
   it with a relative path (`import { makeFx } from '../kit'`).
2. **It is not part of the console.** The kit never imports from
   `src/console`; it is handed the `ConsoleAPI` like a game is. The plug-in
   rule test in `tests/unit/disks.test.ts` is extended to cover the kit folder.
3. **No side effects on load.** Every module exports types, constants, pure
   functions and factories. Nothing touches the DOM, timers, storage or the
   API at import time, and there is no module-level mutable state: a factory
   returns an object that holds its own state, so two games or two tests can
   hold their own instance. (The games' `useApi()` singleton pattern stays in
   the games; the kit does not copy it.)
4. **Typed from the start.** Kit files are written for `strict: true` and are
   the first entries in the strict list when
   [WII-42](https://linear.app/stealth-company/issue/WII-42) adds one. `S` is
   `any` on `ConsoleAPI` today; the kit reads only the fields it owns
   (`score`, `level`, `lives`, `nextLife`, `mode`, `modeT`, `time`) through a
   small `SharedState` type of its own until WII-42 types `S` properly.
5. **Buttons belong to the console core.** PR #9 puts button mapping in the
   core: which slots exist, their keys, labels, enabled state, press and held
   state, and later gamepad buttons. The kit owns none of that and adds no
   parallel mechanism. It only reads what `api.button(id)` already exposes,
   never assumes a fixed number of buttons, and anything a game needs that
   isn't there goes into `ConsoleAPI` (the plug-in rule: add to the API, not
   the import list).
6. **No change in behaviour when a game migrates.** Same constants, same
   timings, same drawing. Behaviour changes are separate PRs.
7. **Small.** Every game page downloads the kit while the drive "reads" the
   disk, so the kit's shared chunk stays a few kilobytes gzipped. Nothing
   heavy (an ECS, a scene graph, an asset pipeline) belongs here.
8. **Original.** Like the games, the kit holds no third-party art, sound or
   code.

### A note on `tests/unit/disks.test.ts`

The test counts every directory under `src/games/` as a game and expects a
disk for each. Adding `src/games/kit/` would fail it, so the first kit PR
changes the test to treat a folder as a game only when it holds `disk.ts`, and
asserts that `kit/` has none. The registry's `import.meta.glob('./*/disk.ts')`
is unaffected.

### Bundling

Vite splits a module imported by several lazy game chunks into one shared
chunk, which the PWA precaches by hash like everything else, so the kit works
offline with no config change. Disks (`disk.ts`, loaded eagerly for the menu)
may import `kit/sprite` for their loading screens; that pulls only the sprite
module into the eager bundle, which is fine. Disks should not import the rest
of the kit.

## Modules

One file per module, all re-exported from `src/games/kit/index.ts`. Signatures
below are the intent, not a contract; the implementation PR may tidy names.

Common types used throughout:

```ts
export type Box = { x: number; y: number; w: number; h: number };
export type Sprite = string[];          // rows of '#' (ink) and anything else (clear)
```

### `sprite.ts`: pixel art from strings

Replaces the two copies of `sprite()`.

```ts
/** Draw a sprite at (x, y) in one colour role. '#' is ink; any other character is clear. */
export function drawSprite(api: ConsoleAPI, art: Sprite, x: number, y: number, role: Role): void;
/** Multi-colour: a map from character to role, e.g. { '#': 'cart', 'o': 'text' }. */
export function drawSprite(api: ConsoleAPI, art: Sprite, x: number, y: number, roles: Record<string, Role>): void;
export const spriteW = (art: Sprite) => number;
export const spriteH = (art: Sprite) => number;
/** Bound helpers for a game that draws a lot: const { sprite } = sprites(api). */
export function sprites(api: ConsoleAPI): { sprite: (art: Sprite, x: number, y: number, role: Role | Record<string, Role>) => void };
```

Coordinates are rounded as today. Drawing is one `fillRect` per ink pixel;
pre-rasterising to offscreen canvases is a possible later optimisation, not
part of this work.

### `fx.ts`: bursts, pop-ups and rings

Replaces `F.bursts` and the blast rings in both shooters and `S.pops` in
Tunnel Raider.

```ts
export function makeFx(api: ConsoleAPI): Fx;
interface Fx {
  /** An explosion sprite for `secs`, blinking between two roles. */
  burst(x: number, y: number, secs: number, art: Sprite, roles?: [Role, Role]): void;
  /** Floating text (points, a pickup's name). `stack` lifts it above labels still showing nearby. */
  pop(text: string, x: number, y: number, opts?: { secs?: number; role?: Role; stack?: boolean }): void;
  /** A ring racing out to radius `r` over `secs` (capsule blasts, the nuke). */
  ring(x: number, y: number, r: number, secs: number, role?: Role): void;
  update(dt: number): void;     // runs in every mode so nothing sticks over the banners
  draw(): void;
  clear(): void;
  readonly count: number;
}
```

`pop` text is clamped inside the tube horizontally, as Invader Force does for
its weapon labels.

### `walls.ts`: crumbling walls

Replaces `bunkerHit()`, the wall-building loops and the wall drawing.

```ts
export function makeWalls(api: ConsoleAPI): Walls;
interface Walls {
  /** Build a wall from string art at (x, y). */
  add(x: number, y: number, shape: Sprite): void;
  /** Lay `n` copies of a shape in a row, evenly spaced across the tube at height y. */
  row(n: number, y: number, shape: Sprite): void;
  /** A hit at (x, y): if it struck wall, bite a ragged hole of `radius` and return true. */
  bite(x: number, y: number, radius?: number, chance?: number): boolean;
  /** Erase everything within `r` of (cx, cy), with `chance` per pixel (blasts). */
  blast(cx: number, cy: number, r: number, chance?: number): void;
  /** Something large (an alien) grinding through a box of wall. */
  chew(box: Box): void;
  solid(x: number, y: number): boolean;
  draw(role: Role): void;
  clear(): void;
}
```

The castle wall with a gate and the rounded pillbox become string art in each
game's `art.ts`, replacing the arithmetic that draws them today. Default
`chance` values match the current code (0.75 for bites, 0.85 for blasts).

### `score.ts`: points, best and extra lives

Replaces `addScore()` in three games. Writes `api.S.score`, `api.best`,
`api.S.lives` and `api.S.nextLife` (the field the console already seeds in
`startGame()`), so the console and the kit agree on where the next life is.

```ts
export function makeScore(api: ConsoleAPI, opts: {
  extraEvery: number;           // 1500 for Invader Force, 2000 for I Invade, 20000 for Tunnel Raider
  maxLives?: number;
  fx?: Fx;                      // where to float the points
  onExtra?: () => void;         // the game's own jingle (and, later, api.buzz)
}): Score;
interface Score {
  reset(): void;                // score 0, next life at extraEvery
  add(n: number, x?: number, y?: number): void;
  readonly nextLife: number;
}
```

### `hud.ts`: the standard top bar

Replaces four `hud()` functions. Draws the score at the left, `HI` when the
tube is at least 300 px wide, a right-aligned title or wave counter, spare
lives as small sprites, the dotted rule under the bar, and optional badges in
the middle that fit themselves between `HI` and the lives (the weapon timer,
`NUKE` and the speed stack in Invader Force).

```ts
export function drawHud(api: ConsoleAPI, opts: {
  right: string;                                  // 'WAVE 3', 'DINO RUN'
  lives?: { art: Sprite; role: Role; max?: number; spare?: boolean };   // spare: show lives − 1 (default) or all
  badges?: { text: string; role: Role; frac?: number; blink?: boolean }[];   // frac draws a draining bar
  scoreRole?: Role; hiRole?: Role;
}): void;
```

The layout rule from Invader Force (badges after `HI` when they fit, otherwise
in `HI`'s place, never into the lives) moves here. Tunnel Raider's richer bar
(`+n` lives, the streak meter) stays its own; it can adopt `drawHud` for the
common parts later or not at all.

### `round.ts`: the round sequence

Replaces the mode handling at the top of every `update()`, which is the same in
all four games with different timings and hooks.

```ts
export function makeRound(api: ConsoleAPI, hooks: {
  respawn(): void;              // a life lost but lives remain: reset the player, keep the field
  nextLevel(): void;            // the level or wave is cleared: build the next one
  times?: { ready?: number; respawn?: number; dying?: number; clear?: number };   // defaults 1.2, 0.9, 1.4, 1.8
}): Round;
interface Round {
  /** Run the mode timers. Returns true when the game should run its play logic this step. */
  tick(dt: number): boolean;
  /** A life lost. `fatal` ends the game whatever the count (the line has fallen). */
  lose(opts?: { fatal?: boolean; secs?: number }): void;
  /** The level is won; `secs` overrides the clear time (I Invade's touchdown lingers). */
  clear(opts?: { secs?: number }): void;
  readonly phase: 'ready' | 'play' | 'dying' | 'clear';
}
```

`tick` clears queued button presses and taps during `ready` (so a press on the
banner is not fired on the first play frame), counts `S.modeT` down, moves
`clear → ready` through `nextLevel()` with `S.level++`, and `dying → ready`
through `respawn()` or `api.finishGame()` when no lives remain. Banners stay
with the game: each game draws its own words. When
[WII-43](https://linear.app/stealth-company/issue/WII-43) adds `api.buzz()`,
`lose()` is the place the long buzz goes.

### `pickups.ts`: falling pickups and timed power-ups

Generalises the capsule system in `src/games/invader-force/weapons.ts` so any
game can drop, catch and time things. The Invader-specific rules (which weapons
exist, volleys, `canFire`, the nuke's rows) stay in `weapons.ts`; the generic
parts move out.

```ts
export function makePickups<K extends string>(api: ConsoleAPI, opts: {
  size: { w: number; h: number }; speed: number; max: number;
  draw: (kind: K, x: number, y: number) => void;
}): Pickups<K>;
interface Pickups<K> {
  /** Drop one, if fewer than `max` are falling. Returns whether it dropped. */
  drop(x: number, y: number, kind: K): boolean;
  /** Fall, catch against the player's box, drop off the bottom. Returns what was caught. */
  update(dt: number, catcher: Box): K[];
  /** Every pickup overlapping a box (a bomb set one off). Removes and returns them. */
  take(box: Box): { kind: K; x: number; y: number }[];
  draw(): void; clear(): void;
  readonly falling: number;
  readonly list: readonly { kind: K; x: number; y: number }[];
}

/** Does something drop? `rand` is 0..1, `falling` and `max` keep the sky from filling. */
export const roll = (rand: number, chance: number, falling: number, max: number) => boolean;
/** Pick from a pool, leaving out what the player already has. */
export function pickFrom<K>(pool: readonly K[], rand: number, exclude?: K): K;

/** A single timed power-up: the 12 s weapon. */
export function makeTimer(): Timer;
interface Timer { set(secs: number): void; tick(dt: number): 'idle' | 'running' | 'expired'; readonly left: number; frac(total: number): number; stop(): void }
/** A stacking power-up with one shared clock: the ×5 speed boost. */
export function makeStack(max: number, secs: number): Stack;
interface Stack { bump(): number; tick(dt: number): 'idle' | 'running' | 'expired'; readonly level: number; readonly left: number }
```

Mapping from today's `weapons.ts`: `rollDrop`/`rollNuke` → `roll`, `pickDrop` →
`pickFrom`, `catches` → `Pickups.update`, `bombHitsCapsule` → `Pickups.take`,
`tickWeapon` → `Timer`, `stackSpeed`/`tickSpeed` → `Stack`, `inBlast` →
`collide.boxInCircle`. The unit tests in `tests/unit/invader-weapons.test.ts`
move with the functions they test.

### `collide.ts` and `maths.ts`: pure helpers

```ts
// collide.ts
export const overlaps = (a: Box, b: Box) => boolean;
export const pointIn = (x: number, y: number, b: Box) => boolean;
export const boxInCircle = (cx: number, cy: number, r: number, b: Box) => boolean;   // today's inBlast
/** Move something fast in small steps so it can't skip over a target; stop at the first hit. */
export function sweep(from: { x: number; y: number }, dx: number, dy: number, step: number, hit: (x: number, y: number) => boolean): { x: number; y: number; hit: boolean };

// maths.ts
export const clamp = (v: number, lo: number, hi: number) => number;
export const rnd = (a: number, b: number) => number;          // a + Math.random() * (b − a), as every game writes it
export const pick = <T>(xs: readonly T[]) => T;
export const blink = (time: number, hz: number) => boolean;    // Math.floor(time * hz) % 2 === 0, used everywhere
```

### `controls.ts`: reading the buttons (small, and optional)

Everything about the buttons themselves is the console core's (PR #9):
slots, keys, labels, on/off, queued and held state, and the gamepad to come.
This module holds only the two or three lines every game repeats when it
reads that state, and the implementation PR may decide they are not worth a
module at all.

```ts
/** −1, 0 or 1 from the stick first, then the newest left/right key: the two lines every side-scroller writes. */
export function horizontal(api: ConsoleAPI): -1 | 0 | 1;
/** A press on a slot this frame, or a tap on the screen when `tap` is true. Reads `api.button(slot).queued`; does not clear it. */
export function pressed(api: ConsoleAPI, slot: string, tap?: boolean): boolean;
/** Take the presses off the given slots (and taps) once handled, through `api.clearButton` / `api.clearTap`. */
export function consume(api: ConsoleAPI, slots: string[], tap?: boolean): void;
```

If any of these turns out to be useful to the menu or the boot screen as
well, it belongs in the core as part of `ConsoleAPI`, not here. This module
lands only after PR #9 merges.

### `jingles.ts`: short tunes

Every game writes `[f1, f2, f3].forEach((f, i) => tone(f, dur, vol, 0, i * gap))`.

```ts
export type Jingle = { notes: number[]; dur?: number; vol?: number; gap?: number; slide?: number };
export function play(api: ConsoleAPI, j: Jingle): void;
```

Tunes stay in each game as data (they are part of the game's character); the
kit only plays them. Silent when SOUND is off, as `tone()` already is.

## What stays out

- **The console core.** Pausing on tab hide
  ([WII-39](https://linear.app/stealth-company/issue/WII-39)), gamepads
  ([WII-40](https://linear.app/stealth-company/issue/WII-40)), haptics and the
  settings reset (WII-43) are console work; the kit only calls what the core
  exposes.
- **Grids and tile games.** Tunnel Raider's cell grid, digging and particle
  system are its own. It can adopt `score`, `fx.pop` and `round` if a later
  pass finds it worthwhile; this spec does not require it.
- **An engine.** No entity system, no scene graph, no physics. Each module is
  a few dozen lines a game could have written itself.
- **Behaviour changes** to any game, including the formation sizes and drop
  rates in Invader Force.

## Migration

Each phase is a PR, opened as a draft, marked ready for the automated reviews
and babysat to mergeable. No phase changes a game's behaviour.

1. **The kit itself.** `sprite`, `fx`, `walls`, `score`, `hud`, `round`,
   `collide`, `maths`, `jingles`, `pickups`, with unit tests and the test
   changes above. A fake `ConsoleAPI` for the tests (`tests/unit/kit/fake-api.ts`)
   records `fillRect` calls and holds a plain `S`, so drawing and state can be
   asserted without a browser. Nothing imports the kit yet.
2. **I Invade moves onto it.** The simpler shooter: walls, fx, score, hud,
   round, sprites, jingles. Checked against `tests/flow.cjs` and the screenshots
   in `docs/screens/`.
3. **Invader Force moves onto it**, including `pickups`; `weapons.ts` shrinks
   to the weapon rules. `tests/unit/invader-weapons.test.ts` splits between
   `tests/unit/kit/pickups.test.ts` and what remains.
4. **`controls`**, once PR #9 is on `main`, if it still earns its place; both
   shooters and Dino Run take `horizontal()`, `pressed()` and `consume()`.
5. **Dino Run** takes `hud`, `round` and `jingles`. Tunnel Raider is left as it
   is unless the owner wants it moved.

Phases 2 and 3 can be skipped by a new game, which starts on the kit from its
first commit.

## Acceptance

- `src/games/kit/` exists, exports the modules above, imports nothing from
  `src/console`, and has no side effects on import (a unit test imports every
  kit module in a bare Node process and asserts no DOM or API calls were made).
- Every kit module has unit tests; kit coverage is not below the games'.
- `npm test`, `npm run build`, `tests/flow.cjs` and `tests/pages.cjs` pass
  after each phase, and the flow test's Invader Force and I Invade runs reach
  the same states as before.
- The kit compiles under `strict: true`.
- Invader Force and I Invade no longer define `sprite`, `bunkerHit`,
  `addScore`, `hud` or their own burst arrays.
- The kit's shared chunk is under 8 KB gzipped (checked by hand on the build
  output for now; a size test can follow).
- `AGENTS.md` gains a row for `src/games/kit/` and a line in the plug-in rule
  saying games may import the kit.

## Fit with the backlog

| Issue | Relation |
| --- | --- |
| [WII-44](https://linear.app/stealth-company/issue/WII-44) | This spec. |
| [WII-41](https://linear.app/stealth-company/issue/WII-41) browser check | Kit-based games expose the same `debug.state()`; a generic every-disk check can rely on `round.phase` and `score` being in the same place for every game. |
| [WII-42](https://linear.app/stealth-company/issue/WII-42) strict TypeScript | The kit is strict from day one and is the first entry in the strict list. |
| [WII-43](https://linear.app/stealth-company/issue/WII-43) haptics | `round.lose()`, `score.add()` on an extra life and `pickups.update()` on a catch are the three places to call `api.buzz()` once it exists. |
| [WII-39](https://linear.app/stealth-company/issue/WII-39), [WII-40](https://linear.app/stealth-company/issue/WII-40) | Console only; no kit interaction. |
| PR #3 weapon drops | Becomes the first `pickups` client (phase 3). |
| PR #9 button slots | Buttons stay in the core; the kit only reads `api.button()` (phase 4). |

## Open questions for the owner

1. **Location.** `src/games/kit/` as agreed, with the disks test adjusted, or
   `src/kit/` to keep `src/games/` as games only? This spec assumes
   `src/games/kit/`.
2. **Tunnel Raider.** Leave it alone (recommended), or move its scoring and
   pop-ups onto the kit in a later phase?
3. **Walls as art.** Turning the castle and pillbox shapes into string art
   changes nothing on screen but puts the shapes in `art.ts` where the sprites
   are. Any objection?
