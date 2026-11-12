# PGD game developer guide

How to make a game for the **PGD-01 Portable Gaming Device**: what the console gives a game, what a game gives the console, and what a game can and can't control. It is written for people and for AI harnesses that generate games, so every rule is spelt out rather than left to the examples.

A PGD game is a **disk**: a small label (`disk.ts`) the console shows on its menu and loading screen, and the game itself (`game.ts`), which the console fetches while the drive reads. The console owns the monitor, the switches, the sounds of the drive, the high-score tables and every button on the set. The game owns the playfield. The two talk only through one object, the [`ConsoleAPI`](#the-consoleapi-at-a-glance), defined in [`src/games/types.ts`](../src/games/types.ts), which is the source of truth for every type named here.

Other pages:

- [`src/games/README.md`](../src/games/README.md): adding a disk to **this repo**: the files outside the game's folder, share images, screenshots, tests and the review checklist.
- [`tools/disks/README.md`](../tools/disks/README.md): the `.pgdisk` file and the signed catalogue in detail.
- [`tools/conformance/README.md`](../tools/conformance/README.md): the headless runner and its script and stream formats.

## Contents

1. [Quick start: a whole game in four files](#1-quick-start-a-whole-game-in-four-files)
2. [How a game runs](#2-how-a-game-runs)
3. [The screen](#3-the-screen)
4. [Input](#4-input)
5. [Buttons and their layout](#5-buttons-and-their-layout)
6. [Sound and haptics](#6-sound-and-haptics)
7. [Score, lives and the end of a game](#7-score-lives-and-the-end-of-a-game)
8. [The disk: every field](#8-the-disk-every-field)
9. [The game kit](#9-the-game-kit)
10. [Rules every disk follows](#10-rules-every-disk-follows)
11. [Testing](#11-testing)
12. [The `.pgdisk` file](#12-the-pgdisk-file)
13. [Hosting PGD in another app](#13-hosting-pgd-in-another-app)
14. [Checklist for AI harnesses](#14-checklist-for-ai-harnesses)
15. [Not possible yet](#15-not-possible-yet)
16. [The ConsoleAPI at a glance](#the-consoleapi-at-a-glance)

## 1. Quick start: a whole game in four files

*Star Catch*: slide a basket, catch falling stars, and DASH on BOOST. It uses the stick, one button whose state changes mid-game, sound, haptics, the shared HUD, lives, levels and the high-score table. It has been run through the headless runner and in the browser console.

```
src/games/star-catch/
├── strings.ts   every word for the instructions and buttons, in three languages
├── art.ts       sprites as text
├── disk.ts      the label, the buttons and the loading screen
└── game.ts      the game
```

`strings.ts`:

```ts
import type { Strings } from '../types';

export const strings: Strings = {
  en: { scName: 'Star Catch', scHow: 'Slide the basket and catch the falling stars. Miss one and you lose a basket.', scDash: 'DASH', scOver: 'ALL MISSED', scAgain: 'CATCH AGAIN' },
  'zh-hant': { scName: 'Star Catch 接星星', scHow: '左右移動籃子，接住落下的星星。漏接一顆就少一個籃子。', scDash: '衝刺', scOver: '全部漏接', scAgain: '再接一次' },
  'zh-hans': { scName: 'Star Catch 接星星', scHow: '左右移动篮子，接住落下的星星。漏接一颗就少一个篮子。', scDash: '冲刺', scOver: '全部漏接', scAgain: '再接一次' },
};
```

`art.ts`:

```ts
import type { Sprite } from '../../kit/play/types';

export const BASKET: Sprite = [
  '#..........#',
  '##........##',
  '.##########.',
  '..########..',
];
export const STAR: Sprite = [
  '..#..',
  '.###.',
  '#####',
  '.###.',
  '.#.#.',
];
```

`disk.ts`:

```ts
import type { ConsoleAPI, GameDisk } from '../types';
import { drawSprite } from '../../kit/play/sprite';
import { STAR } from './art';
import { strings } from './strings';

export const disk: GameDisk = {
  contract: 1, version: 1, rating: '4+',
  id: 'stars', order: 7, slug: 'star-catch',
  page: { title: 'Star Catch', description: 'Catch the falling stars on the PGD-01 Portable Gaming Device.' },
  title: 'STAR CATCH', nameKey: 'scName', file: 'STARS.COM', size: 4096,
  loadSecs: 1.3, steps: [[0, 0], [0.2, 0.3], [0.45, 0.35], [0.7, 0.8], [1, 1]],
  blurb: 'CATCH · DASH · DON\'T DROP', verb: 'CATCH',
  genre: 'ARCADE', players: 1,
  buttons: { boost: { label: 'scDash' } },          // FIRE left out: it goes dark
  overKey: 'scOver', againKey: 'scAgain',
  manual: [{ h: 'howH', p: 'scHow' }],
  strings,
  drawLoad(api: ConsoleAPI, p: number, t: number){
    api.txt('STAR CATCH', api.LW / 2, 40, 'text', 'center', 16);
    for (let i = 0; i < 5; i++) drawSprite(api, STAR, api.LW / 2 - 40 + i * 18, 70 + Math.round(Math.sin(t * 4 + i) * 3), i / 5 < p ? 'gold' : 'textDim');
    api.diskInfo(100, p, t, disk);
  },
};
```

`game.ts`:

```ts
import type { CreateGame } from '../types';
import { clamp, drawHud, drawSprite, horizontal, makeFx, makeRound, makeScore, rnd, spriteW } from '../../kit/play';
import { BASKET, STAR } from './art';

const create: CreateGame = api => {
  const S = api.S;
  const fx = makeFx(api);
  const score = makeScore(api, { extraEvery: 500, maxLives: 5, fx });
  let x = 0, dash = 0, cool = 0, spawn = 0;
  let stars: { x: number; y: number; v: number }[] = [];
  const reset = () => { x = api.LW / 2; stars = []; spawn = 0.5; dash = 0; cool = 0; api.setButtons({ boost: null }); };
  const round = makeRound(api, { respawn: reset, nextLevel: reset });
  const floor = () => api.LH - 10;

  return {
    start(){ api.fitGrid(); score.reset(); reset(); },
    update(dt){
      fx.update(dt);
      if (!round.tick(dt)) return;                         // ready, dying and clear are run by the kit
      if (api.boostQueued) { api.clearBoost(); dash = 0.25; cool = 2; api.setButtons({ boost: { enabled: false } }); api.tone(660, 0.08, 0.05, 300); }
      if (cool > 0 && (cool -= dt) <= 0) api.setButtons({ boost: null });   // lit again
      dash = Math.max(0, dash - dt);
      x = clamp(x + horizontal(api) * (dash > 0 ? 260 : 110) * dt, 8, api.LW - 8);
      if ((spawn -= dt) <= 0) { spawn = Math.max(0.35, 1.1 - S.level * 0.1); stars.push({ x: rnd(8, api.LW - 8), y: api.HUD, v: rnd(40, 60) + S.level * 8 }); }
      for (const s of stars) s.y += s.v * dt;
      for (const s of stars.filter(s => s.y > floor() - 6 && Math.abs(s.x - x) < 8)) {
        score.add(10, s.x, s.y); api.tone(880, 0.05, 0.05, 440); api.buzz('pickup');
        stars.splice(stars.indexOf(s), 1);
      }
      if (stars.some(s => s.y > api.LH)) { api.tone(160, 0.4, 0.06, -80); round.lose(); return; }
      if (S.score >= S.level * 200) round.clear();
    },
    draw(){
      for (const s of stars) drawSprite(api, STAR, s.x - 2, s.y - 2, 'gold');
      drawSprite(api, BASKET, x - spriteW(BASKET) / 2, floor(), S.mode === 'dying' ? 'textDim' : 'cart');
      fx.draw();
      drawHud(api, { right: 'LEVEL ' + S.level, lives: { art: ['###', '.#.'], role: 'cart' } });
      if (S.mode === 'ready') api.banner('GET READY', 'LEVEL ' + S.level);
      if (S.mode === 'clear') api.banner('LEVEL CLEARED');
    },
    debug: { state: () => ({ x, stars: stars.length, cool }) },
  };
};
export default create;
```

Drop the folder into `src/games/` and run `npm run dev`; outside this repo, bundle it into two plain scripts and a host app can send it to a running console instead ([section 13](#13-hosting-pgd-in-another-app)). The disk appears seventh in the launcher and gets its own page at `/star-catch`, with no list to edit. To ship it in this repo, it also needs a generated cover, a share image and tests: see [`src/games/README.md`](../src/games/README.md#a-new-disk-step-by-step). Without `cover.ts` the web console still runs it, but `npm run build` stops when it packs the disk files.

## 2. How a game runs

### Who runs what

The console and the game take turns, and `api.S.mode` says whose turn it is.

| Mode | Runs it | What's happening | Calls into the game |
| --- | --- | --- | --- |
| `off` | console | The set is switched off | none |
| `boot` | console | BIOS memory test and floppy | none |
| `menu` | console | The launcher | none |
| `load` | console | The game's loading screen and drive sounds, while `game.ts` downloads | `disk.drawLoad` |
| `ready` | **game** | The countdown before play. The console sets it with `S.modeT = 1.2` after `start()` | `update`, `draw` |
| `play` | **game** | Playing | `update`, `draw` |
| `dying` | **game** | A life has just been lost | `update`, `draw` |
| `clear` | **game** | A level has just been won | `update`, `draw` |
| `paused` | console | HOLD is on (the switch, <kbd>P</kbd>, <kbd>Esc</kbd>, or the page went into the background) | `draw` only |
| `entry` | console | Name entry for the high-score table | `draw` only (your last picture stays behind it) |
| `over` | console | The game-over card and the attract loop | `draw` only |

`ready` → `play` → `dying` or `clear` → `ready` again is the game's job, and so is calling `api.finishGame()`. The kit's [`makeRound`](#9-the-game-kit) does all of that, so most games never set `S.mode` themselves.

### The loop

- **`create(api)`** runs once, when the game's code arrives. Build closures, layers and kit helpers here. Don't touch the screen or start a game.
- **`start()`** runs for every new game. Before it, the console resets `S.level = 1`, `S.score = 0`, `S.lives = 3` and `S.nextLife = 20000`, and puts the disk's buttons back. After it, the console sets `S.mode = 'ready'` and `S.modeT = 1.2`. Call `api.fitGrid()` first, then reset your own state.
- **`update(dt)`** runs in `ready`, `play`, `dying` and `clear`, in fixed steps of at most 1/60 s. A frame never feeds more than 0.05 s in total, so a stalled tab doesn't make the game jump. `dt` is seconds; move things in pixels per second.
- **`draw()`** runs once per frame whenever the console isn't drawing its own screen, so also while paused, during name entry and behind the game-over card. Before it, the console resets the transform and clears the picture to `bg`. Draw the whole frame every time; nothing persists.
- **`onPalette()`** (optional) runs when the player turns the phosphor dial. See [Layers](#layers-cached-pictures).
- **`debug`** (optional) is a bag of functions the browser tests can call (`__gg.runtime.debug.state()` with `?test` in the address). Expose what a test needs to read or set up.

### The shared state, `api.S`

`S` is one object the console and the game share. It is untyped on purpose: each game adds its own fields.

| Field | Who writes it | Meaning |
| --- | --- | --- |
| `mode`, `modeT` | game in its modes, console otherwise | The mode above, and a countdown in seconds that the game runs down |
| `time` | console | Seconds since the page started, for blinking and animation |
| `score`, `level`, `lives`, `nextLife` | game (console resets them) | Shown on the game-over card and used for the high-score table |
| `charge`, `boost`, `boostT` | game, optional | The FIRE button looks cooled while `charge < 1`; the BOOST button shows a fill of `boost` (0 to 1) and lights while `boostT > 0`. Web only; set them in `start()` if you use them |

Prefer closures in `create()` for the game's own state, as Star Catch does. Fields you put on `S` stay there after your game ends, and other disks see them.

## 3. The screen

### Size and shape

The picture is a small low-res buffer, snapped to four colours and run through the CRT pass. Its size follows the shape of the tube on the player's screen:

- **`api.LW` × `api.LH`** pixels. `LW = W × 24` and `LH = H × 24 + 20`.
- **Sideways screens** get `W` = 15 or 17 cells and `H` = 7 to 14. **Upright screens** get `W` = 10 to 13 and `H` = 9 to 22. So `LW` runs from 240 to 408 and `LH` from 188 to 548.
- **`api.HUD`** = 20: the top 20 rows are the status bar. Draw the playfield from `y = HUD` down.
- The size is fixed for the whole game: `api.fitGrid()` in `start()` picks it, and the console only re-fits while nothing is playing. Read `LW` and `LH` live anyway (`api.LW`, not a copy made in `create()`), since the next game may get a different shape.
- Lay the playfield out from `LW` and `LH`, never from fixed numbers. Test the narrow upright case (240 wide) and the short sideways one (188 high).
- Tile games can use the grid: `api.W` × `api.H` cells of 24 px, `api.C` = 32 game units a cell, `api.K` = 0.75 pixels a unit, with `api.idx(x, y)`, `api.inb(x, y)` and `api.DIRS`.

### Four colours, by role

Everything on the tube goes through a four-colour palette, and the player can change the palette at any time with the phosphor dial (green, long green, radar, amber, paper white and two CGA sets). So a game never names a colour. It names a **role**, and `api.col(role)` gives the current colour for it:

```ts
api.g.fillStyle = api.col('gold');
api.g.fillRect(x, y, 4, 4);
```

| Role | Mono index | CGA index | Use it for |
| --- | --- | --- | --- |
| `bg` | 0 | 0 | Background |
| `text` | 3 | 3 | Main text, the brightest ink |
| `textDim` | 2 | 1 | Secondary text, shadows of the brightest things |
| `hud` | 2 | 1 | The status bar |
| `dirt` | 1 | 2 | The dimmest fill, ground, walls |
| `gold`, `spark`, `sun`, `eye`, `lamp`, `cart` | 3 | 3 | Bright things: the player, pickups, explosions |
| `gem`, `bag`, `grub`, `drill`, `wheel` | 2 | 1 to 3 | Middle tones |
| `window`, `track` | 1 | 2 | Dark details |

The full list is in [`src/kit/platform/palettes.ts`](../src/kit/platform/palettes.ts) (`MONO_ROLES` and `CGA_ROLES`). Index 0 is the background and 3 the brightest. The names come from the first game, so pick by brightness, not by name. A role the palette doesn't define keeps the previous colour, so stick to the listed ones. `api.palette.pal[i]` is also allowed as a `fillStyle`; any other colour string fails in development and is ignored in release.

Check the game on green and on CGA: mono roles differ by brightness, CGA ones by hue, and something readable on one can vanish on the other.

### Drawing: `api.g`

`api.g` is a `Screen2D`: a small subset of the Canvas 2D context that native hosts can also run. Only filled shapes, no strokes, no images, no gradients and no transparency.

| Member | Notes |
| --- | --- |
| `fillStyle` | A colour from `api.col(role)` or `api.palette.pal` |
| `fillRect(x, y, w, h)` | The workhorse. Use whole pixels |
| `beginPath`, `rect`, `moveTo`, `lineTo`, `arc`, `arcTo`, `closePath`, `fill`, `clip` | Filled paths and clipping |
| `save`, `restore`, `translate`, `rotate`, `scale`, `setTransform` | The transform stack |
| `font`, `measureText(s)` | Silkscreen at 8 or 16 px; widths come from a shared table, so they match on every host |

Helpers on `api`:

- **`api.txt(s, x, y, role?, align?, size?)`**: pixel-font text, top-left anchored, `align` `'left'`, `'center'` or `'right'`, `size` 8 (default) or 16. Text on the tube is English, upper case reads best, and the font has Latin letters, digits and common punctuation only.
- **`api.banner(title, sub?)`**: the centred two-line banner for GET READY, LEVEL CLEARED and the like.
- **`api.rr(x, y, w, h, r)`**: a rounded-rectangle path; call `api.g.fill()` after it.
- **`api.poly([x0, y0, x1, y1, …])`** and **`api.circ(x, y, r)`**: filled in the current `fillStyle`.
- **Sprites:** the kit's `drawSprite(api, art, x, y, role)` draws text art (`'#'` is ink), or several roles with a map such as `{ '#': 'cart', 'o': 'text' }`.

### Layers: cached pictures

For something expensive that rarely changes (a scrolling background, a big wall), draw it once into a layer:

```ts
const sky = api.layer(api.LW, 40);                // { w, h, px: Uint8Array }, all index 0
for (let i = 0; i < 60; i++) sky.px[(Math.random() * sky.px.length) | 0] = 3;   // stars
// each frame:
api.stamp(sky, 0, api.HUD);
```

`px` holds one palette **index** (0 to 3) per pixel, row by row. Every pixel is opaque, including index 0. Stamping uses the current transform and clip, and the colours follow the dial on their own. A layer stores indices, not roles, so if you filled it from roles (`api.palette.roles.gold`), rebuild it in `onPalette()`: mono and CGA map roles to different indices.

## 4. Input

### The stick and the arrow keys

| Read | Gives |
| --- | --- |
| `api.wantDir()` | The step to move now, `{ dx, dy }` or `null`: the on-screen stick first, then the newest arrow or WASD key |
| `api.stickDir` | The stick alone: `'up'`, `'down'`, `'left'`, `'right'` or `null` |
| `api.held` | Direction keys held, newest last. The only way to read a diagonal |
| kit `horizontal(api)` | −1, 0 or 1, for games that only move sideways |

The on-screen stick is 4-way. Only the keyboard can hold a diagonal (Martian Storm combines `api.held`).

### Action buttons

Every button on the set is a **slot** (more in [Buttons and their layout](#5-buttons-and-their-layout)). Read one with `api.button(id)`:

```ts
const fire = api.button('fire');                         // { label, enabled, queued, held }
if (fire.queued) { shoot(); api.clearButton('fire'); }    // one action per press
if (api.button('boost').held) shield();                  // for as long as it's down
```

- **`queued`** is a press not yet handled. It stays set until you call `clearButton(id)`, so handle it once and clear it.
- **`held`** is true while the button or any of its keys is down.
- **Shorthands:** `api.fireQueued`, `api.fireHeld`, `api.boostQueued`, `api.boostHeld`, `api.clearFire()`, `api.clearBoost()`.
- **Outside `play`**, presses are dropped for every slot except `fire`. FIRE can queue during `ready`, so clear it while counting down (`makeRound` does) or the first shot fires itself.
- **Held keys repeat.** The keyboard's auto-repeat queues the slot again while a key stays down; the on-screen button doesn't. For strictly one action per press, act on `held` turning true and keep the last value yourself.
- **<kbd>Enter</kbd>** is POWER, or a new game from the game-over card. During `ready` and `play` it presses FIRE only when FIRE's label key is `'serve'`, or in Martian Storm. Any other game that wants Enter needs a console change (`serveKey()` in `core.ts`).

### Taps on the screen

Set `tap: true` on the disk, then read `api.tapQueued`, `api.tapHeld` and `api.clearTap()` like a button. Taps count only in `ready` and `play`. `api.tapX` is where the last tap landed, in pixels across the tube (I Invade fires the nearest bomb bay). Without `tap: true`, a tap on the tube does nothing during a game. The kit's `pressed(api, 'fire', true)` and `consume(api, 'fire', true)` treat a tap and FIRE as one.

### Keys a game can't have

POWER, RESET, the phosphor dial, the four switches, and the keys <kbd>G</kbd> (back to the menu), <kbd>P</kbd> / <kbd>Esc</kbd> (HOLD), <kbd>M</kbd> (SOUND), <kbd>F</kbd> (FULL) and <kbd>C</kbd> (the phosphor, except when the button pad is up) belong to the console.

## 5. Buttons and their layout

A game doesn't draw or place its own buttons. The set has a fixed group of physical buttons, the console's layout decides where they sit on each screen, and the game decides **which ones are there, which are lit, what they say, and whether it uses the stick or a button pad**.

### The slots

| Slot | On the set | Keys | Shown |
| --- | --- | --- | --- |
| `fire` | The big red button | <kbd>Space</kbd>, <kbd>Z</kbd>, <kbd>X</kbd> | Always (hidden while the pad is up, but <kbd>Space</kbd> still presses it) |
| `boost` | The second button, under or beside FIRE | <kbd>Shift</kbd>, <kbd>B</kbd> | Always |
| `fireL`, `fireR` | Extra buttons either side of FIRE, sharing its row | <kbd>Z</kbd>, <kbd>V</kbd> | Only if the game maps them. With all three, each is about 32 px wide on a small phone, so keep their labels to three letters |
| `pad1` … `pad6` | A pad of buttons in the stick's place | `pad1` <kbd>←</kbd> <kbd>Z</kbd>, `pad2` <kbd>↑</kbd> <kbd>X</kbd>, `pad3` <kbd>→</kbd> <kbd>C</kbd>, `pad4` <kbd>A</kbd>, `pad5` <kbd>S</kbd>, `pad6` <kbd>D</kbd> | Only with `controls: 'pad'`, and only the ones the game maps, while the game is up |

An optional slot the game doesn't map stays hidden and leaves its keys to the others (so <kbd>Z</kbd> is FIRE in most games, and the left bay in I Invade).

### Declaring them: `buttons` on the disk

`buttons` maps a slot id to `{ label, enabled? }`:

```ts
buttons: { fire: { label: 'jump' }, boost: { label: 'duck' } },              // Dino Run
buttons: { fire: { label: 'serve' } },                                      // Bricks: BOOST dark
buttons: { fire: { label: 'spark' }, boost: { label: 'msLoop' }, fireR: { label: 'msBomb' } },   // Martian Storm: BOMB beside FIRE
```

- **A slot left out goes dark** and ignores presses; an optional slot left out stays hidden.
- **`enabled: false`** shows the button greyed with its label: one that lights up later.
- **`label`** is a key into the strings table, so put the words in `strings` in all three languages. The console's own `spark` (FIRE) and `boost` (BOOST) are there to reuse. FIRE and BOOST fit about six letters on a phone; the pad and the side buttons fewer.
- **Order matters on the launcher:** on wide tubes it lists each lit slot (pad slots aside) as a chip under the cover, `[JUMP] [DUCK]`, and drops chips from the end when they don't fit. Put the most important one first.

### Changing them mid-game: `api.setButtons`

```ts
api.setButtons({ boost: { label: 'nuke' } });     // Invader Force: an atomic bomb is ready
api.setButtons({ pad5: { enabled: true } });      // I Invade: the meteor swarm has charged
api.setButtons({ fireR: { label: 'scBomb', enabled: true } });   // show an optional slot the disk left out, and light it
api.setButtons({ boost: null });                  // back to what the disk declared
```

Each entry changes the label, `enabled`, or both; a field you leave out keeps its current value, and an optional slot the disk didn't declare starts dark, so pass `enabled: true` to light it. `null` puts the slot back to the disk's declaration (and hides an optional slot the disk didn't map). Unknown slots are ignored, so asking for one the set doesn't have is safe. The console puts the declared map back at the start of every game. Disabling a slot also drops its pending press.

### The stick or the pad: `controls`

- **`controls: 'stick'`** (the default): the 4-way stick, with FIRE and BOOST.
- **`controls: 'pad'`**: for a game with no use for a stick. While the game is in `ready`, `play`, `dying`, `clear` or `paused`, the stick's place holds a pad of up to six buttons in two rows of three (`pad1` to `pad3` red on top, `pad4` to `pad6` amber below), and the FIRE row steps aside. The arrows, <kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> and <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> become pad keys, so don't steer with `wantDir()`. Leave `pad6` out and `pad4` and `pad5` share the bottom row. The stick comes back for the console's own screens.

### Where they sit

The console's layout follows the screen, and the game has no say in it:

| Layout | Stick or pad | FIRE and BOOST |
| --- | --- | --- |
| Desk (a computer) | Controls column right of the tube | Under the stick |
| Console (phone sideways) | Left of the tube | Right of the tube, under the dial and the plate |
| Tall console (tablet or foldable sideways) | Full height, left of the tube | Bottom right, under the dial and the switches |
| Phone and tablet upright | Under the tube, on the left | Under the tube, on the right |

On desk and the upright layouts the pad keeps its two rows. On the sideways console layouts it is split for I Invade: `pad1` to `pad3` on the right with `pad4` under them, and BOOST above `pad5` on the left. `pad6` has no place there yet, so a second pad game with a different set of keys means revisiting that block in `src/styles/console.css`.

### What a game can't do with buttons (yet)

- Place, size, colour or reshape a button, or choose a different arrangement per layout.
- Add buttons beyond the ten slots above. A new physical button is console work: a `defineSlot()` in `core.ts`, the button in `src/components/ActionButtons.tsx` and its place in every layout in `console.css`. Games that don't map it never see it.
- Rebind keys, or take <kbd>Enter</kbd> (see above) or any console key.
- Make the on-screen buttons auto-repeat.
- Read a gamepad.

If a game needs one of these, raise it as a console change in Linear rather than working round it in the game.

## 6. Sound and haptics

### Tones

```ts
api.tone(freq, dur, vol = 0.045, slide = 0, delay = 0);
```

One square-wave beep: `freq` in Hz, `dur` in seconds, `vol` from 0 to about 0.08 (louder clips against the console's own sounds), `slide` Hz to glide by over the note (down to 40 Hz at the lowest), and `delay` seconds to schedule it later. Tones are silent with SOUND off. That is the whole sound API: no noise channel, no samples, no music files. Melodies are tones in a row; the kit's `play(api, { notes, dur, gap })` plays a jingle.

The drive sounds on the loading screen are the console's, timed to `loadSecs`, so a disk never plays its own.

### Haptics

`api.buzz(h)` vibrates phones that can: a name, a length in milliseconds, or a pattern `[buzz, pause, buzz …]` (at most nine steps of up to a second each).

| Name | Use it when |
| --- | --- |
| `'fire'` | A shot leaves |
| `'pickup'` | Something is caught |
| `'lose'` | A life is lost (`round.lose()` does it) |
| `'over'` | The game ends (the console does it) |
| `'tick'` | Reserved for the set's own controls |

Nothing happens with SOUND off or where the device can't vibrate, and a short buzz never cuts off a longer one.

## 7. Score, lives and the end of a game

- **Score** lives in `S.score`, **lives** in `S.lives` and the **level** in `S.level`. The kit's `makeScore` adds points, floats them on screen, keeps `api.best` up to date and gives an extra life every `extraEvery` points.
- **`api.best`** is this game's best on this device. Raise it when the score passes it; `api.saveBest()` stores it (the console also saves it at the end).
- **Ending:** call `api.finishGame()` once, when the last life is gone. The console then saves the best, buzzes, records `game_over`, and runs name entry if the score made this device's top ten, or else the game-over card titled with your `overKey` and a button reading `againKey`. The attract loop alternates that card with the table. `update` isn't called again; `draw` keeps your last picture up behind it. `makeRound` calls `finishGame()` for you when `dying` ends with no lives left.
- **Tables** are per disk and per device: `gg-best-<id>` and `gg-board-<id>` in local storage, ten entries, names up to nine letters. A game never reads or writes them directly.
- **Analytics:** the console already records `game_load`, `game_start`, `game_over`, `new_best` and `high_score` with the game's id. For anything else, `api.track(name, data)` with at most two properties, one of them the game id. It does nothing in the native apps.

## 8. The disk: every field

`disk.ts` exports `disk: GameDisk`. It is loaded with every other disk before anything is played, so keep it light: it may import its `strings.ts`, `art.ts` and `kit/play/sprite`, nothing heavier.

### Identity and revision

| Field | Type | Rule |
| --- | --- | --- |
| `contract` | `1` | The `ConsoleAPI` version the disk was written for |
| `version` | whole number ≥ 1 | Raise it whenever the disk's built code changes (the disk-file lock checks) |
| `rating` | `'4+'` | The lowest App Store age band it suits; only `4+` for now |
| `id` | string | Short and unique. Storage keys and analytics use it, so never change it once players have scores |
| `order` | number | Position in the launcher, and the <kbd>1</kbd>–<kbd>9</kbd> key that loads it. Unique; new disks go after the last |
| `slug` | kebab-case | Unique. Makes the game's own page, `/<slug>` |
| `page` | `{ title, description }` | English title and description for that page and its link preview |

### The label and the load

| Field | Rule |
| --- | --- |
| `title` | Upper case, in the pixel font, on the launcher and the loading screen |
| `nameKey` | Strings key for the game's name in the instructions |
| `file`, `size` | The file the drive "reads" (`STARS.COM`) and its size in bytes, shown on the label |
| `loadSecs` | Load time in seconds, at most 5, and different from every other disk's (about 1.5 for a small game, nearer 5 for a big one) |
| `steps` | The progress curve: `[fraction of the time, fraction loaded]` from `[0, 0]` to `[1, 1]`. Make it uneven: flat stretches are the drive seeking, steep ones are sectors coming off |
| `blurb` | One line under the title on the launcher |
| `verb` | Fills in `PRESS FIRE TO …` on the high-score table |
| `drawLoad(api, p, t)` | The themed loading screen, below |

**`drawLoad`** runs every frame while the drive reads. `p` goes from 0 to 1 along `steps`; `t` is seconds since the drive started. Draw the title and a scene in the game's style, then end with `api.diskInfo(y, p, t, disk)`, which draws the shared sector bar and the `LOADING <file>` line and returns the y below them. The screen can stay up past `loadSecs` (at least another 0.35 s, longer if the code is slow to arrive), so loop or hold any animation rather than ending it at `loadSecs`.

### The launcher

| Field | Rule |
| --- | --- |
| `genre` | Upper case, at most 8 characters (`ARCADE`, `SHOOTER`, `BAT+BALL`) |
| `players` | Whole number, 1 or more |
| `year` | Optional; shown on wide tubes only |
| `drawCover(api, x, y, w, h, t)` | Optional hand-drawn cover, for when the captured one reads badly at carousel size. `t` is seconds at the front (0 for side covers) |
| `drawPreview(api, x, y, w, h, t)` | Optional scripted preview, about a 6 s loop starting on the cover's frame |
| `cover`, `preview` | Never set these yourself. In this repo they come from the generated `cover.ts` and `preview.ts` |

The launcher shows the front disk's cover large, with its label strip (`title`, `file`, `size`) and, on wide tubes, `blurb`; the best score with `genre`, `players` and `year`; and the controls (`STICK` or `PAD`, `+ TAP`, then a chip per lit button). Upright tubes show the first two lines, short ones a single line. For the cover it tries `drawCover`, then `cover.ts`, then the title on a floppy label; after 0.8 s on a disk (never with reduced motion) it plays `drawPreview`, else the `preview.ts` flipbook, else holds the cover.

### Controls

| Field | Rule |
| --- | --- |
| `buttons` | Required. See [Buttons and their layout](#5-buttons-and-their-layout) |
| `controls` | `'stick'` (default) or `'pad'` |
| `tap` | `true` to take taps on the screen as presses |

### The end of a game

| Field | Rule |
| --- | --- |
| `overKey`, `againKey` | Strings keys for the game-over card's title (`ALL MISSED`) and its button (`CATCH AGAIN`) |

### Instructions and strings

`manual` is the game's Operating Instructions in the leaflet beside the set, which switches to them as the disk loads. Each section is one of:

```ts
{ h: 'howH', p: 'scHow' }                                                  // heading and a paragraph
{ h: 'ctlH', keys: true, list: [{ k: 'scK1', v: 'scK1v' }] }               // a controls list
{ h: 'secScore', list: [{ k: 'scS1', v: 'scS1v' }] }                       // a dotted-leader list
{ h: 'scTipsH', notes: true, list: [{ k: 'scT1', v: 'scT1v' }] }           // a list whose rows are sentences
```

Every value is a key into `strings`. A list row's `v` can be literal HTML with `lit: true` (for <kbd>keys</kbd>). `wrap: true` lets a long value break under its name on narrow columns.

`strings` holds every key in `en`, `zh-hant` (Traditional Chinese) and `zh-hans` (Simplified Chinese). All disks share one table, so prefix your keys with something of your game's own (`sc…` for Star Catch); a unit test fails if two disks define a key differently. Reuse the console's headings: `howH` (How it plays), `ctlH` (Controls), `secScore` (Scoring). Follow the shipped games: how to play, the controls, scoring, how it gets harder, and a credit line if it is a tribute. The strings are for the leaflet and the buttons; text on the tube stays English.

## 9. The game kit

Games may import the play kit from `src/kit/play` (`import { makeRound } from '../../kit/play'`). Every helper takes the `api`, has no state of its own until you make one, and works on every host.

| Module | Gives you |
| --- | --- |
| `round` | `makeRound(api, { respawn, nextLevel, times?, clearOnReady? })`: runs `ready` → `play` → `dying` / `clear`, `tick(dt)` returns true when play logic should run, `lose({ fatal? })`, `clear()`, and calls `finishGame()` |
| `score` | `makeScore(api, { extraEvery, maxLives?, fx?, onExtra? })`: `reset()`, `add(n, x?, y?)` |
| `hud` | `drawHud(api, { right, lives?, badges? })`: score, HI, a title or wave, spare lives and badges with timers |
| `fx` | `makeFx(api)`: explosion sprites, floating text and rings; `update(dt)` and `draw()` |
| `sprite` | `drawSprite`, `spriteW`, `spriteH`, `sprites(api)` |
| `pickups` | `makePickups` (things that fall to be caught), `makeTimer`, `makeStack`, `roll`, `pickFrom` |
| `walls` | `makeWalls(api)`: crumbling bunkers bitten pixel by pixel |
| `collide` | `overlaps`, `pointIn`, `boxInCircle`, `sweep` |
| `controls` | `horizontal`, `pressed`, `consume` |
| `jingles` | `play(api, { notes, dur?, vol?, gap?, slide? })` |
| `maths` | `clamp`, `rnd`, `pick`, `blink` |

`src/kit/platform` has types games may import (haptic names, palettes, the font table), but no code to call.

## 10. Rules every disk follows

A disk is a guest that has to run in the browser, in the native apps' script engines and in a headless test runner. So:

- **Only the `api`.** Never import from `src/console` and never touch the page. Everything comes through `ConsoleAPI`. If a game needs something new, the change is to add it to `ConsoleAPI` (`types.ts`) and to `api` in `core.ts`, for every game.
- **No browser globals.** No `window`, `self`, `document`, `navigator`, `localStorage`, `sessionStorage`, `location`, `setTimeout` or other timers, `requestAnimationFrame`, `fetch`, `performance`, `Date` or dynamic `import()`. Time comes from `dt`; storage from `api.best`. `tests/unit/kit/contract.test.ts` checks.
- **`Math.random` is fine.** The host supplies it and seeds it for repeatable runs. `api.mulberry32(seed)` gives a separate seeded generator.
- **No side effects on load.** Importing a disk's modules does nothing. Allocate state and layers in `create()` or `start()`.
- **Only `Screen2D` drawing** (above), in palette colours, with Silkscreen at 8 or 16 px.
- **A light `disk.ts`.** Strings, art and `kit/play/sprite` only.
- **Original work.** Original names, characters, art, sound and code, even for a tribute. Never copy another game's sprites, sounds, code or trademarks. Name the original only in the leaflet's credit line.
- **Everyone can play it:** rated 4+, playable with touch alone (stick, buttons or taps), and on every screen shape.

## 11. Testing

- **Headless:** `node tools/conformance/run.mjs <folder> <script.json> <out.jsonl>` runs a disk under Node with no browser, at a fixed 1/60 s step and seeded `Math.random`, and records every drawing command, tone, buzz and button change. A script can hold directions, press buttons and tap at given frames, so you (or a harness) can play the game, check it reaches `finishGame`, and diff runs. Format: [`tools/conformance/README.md`](../tools/conformance/README.md).

  ```sh
  echo '{"frames":4000,"events":[{"frame":200,"buttons":{"boost":true}},{"frame":210,"buttons":{"boost":false}},{"frame":220,"held":["right"]}]}' > /tmp/play.json
  node tools/conformance/run.mjs star-catch /tmp/play.json /tmp/run.jsonl
  grep -o '"state":{[^}]*}' /tmp/run.jsonl | tail -1     # mode "over" once the game has ended
  ```

- **Types:** `npm run typecheck` runs strict TypeScript over the games.
- **Rules:** `npm test` checks every disk's fields, strings, imports, covers and the plug-in rules.
- **In the browser:** `npm run dev`, then `/<slug>` boots straight into the disk. Add `?test` to the address for the `__gg` test hook. Turn the phosphor dial to check every palette, and resize the window through upright, sideways and short shapes.
- **Repo checks** for a shipped game (the generic play-through in `tests/flow.cjs` and the rest) are in [`src/games/README.md`](../src/games/README.md#outside-the-folder).

## 12. The `.pgdisk` file

The iOS and Android apps don't bundle games; they download disk files listed in a signed catalogue. `npm run build` packs every folder in `src/games/` into `dist/disks/v1/<id>-<version>.pgdisk`:

| Entry | What it holds |
| --- | --- |
| `manifest.json` | `format: 1` and every data field of the disk (everything except functions), plus the cover |
| `disk.js` | A plain script (no `import` or `export`) that defines the global `PGDDisk`; the disk is `PGDDisk.disk`, functions included |
| `game.js` | A plain script that defines `PGDGame`; the factory is `PGDGame.create(api)` |
| `preview.json` | The flipbook, if the disk has one |

Each script carries its own copy of any kit or strings it uses. A host runs both in one fresh realm with its own seeded `Math.random` and without `Date` or `performance`. The catalogue, `index.json`, is signed with Ed25519, and each file is checked by size and SHA-256. Details, keys and the version lock: [`tools/disks/README.md`](../tools/disks/README.md).

Three things to know if you generate disks outside this repo:

- **You may not need a `.pgdisk` at all.** A host app can send the two scripts as strings ([section 13](#13-hosting-pgd-in-another-app)). A file matters for the native apps and for sharing a disk whole.
- **There is no stand-alone packer yet.** `tools/disks/build.mjs` packs only folders under `src/games/`, and it needs each folder's generated `cover.ts`. To make a `.pgdisk` from elsewhere today:
  1. Copy the folder into `src/games/`.
  2. Add a `play('play-<short>.png', '<folder>')` capture for it in `tools/share-images/make.cjs` (see [`src/games/README.md`](../src/games/README.md#artwork-and-images)). The cover is written only from that capture.
  3. Build the site without packing disks, since the packer needs the cover you don't have yet, and serve it: `npx astro build && npm run preview` (it listens on `http://localhost:4173`).
  4. Write the cover: `NODE_PATH=$(npm root -g) node tools/share-images/make.cjs --covers-only`.
  5. Build everything, disks included: `npm run build`.
- **Only signed disks run in the native apps.** A disk you build yourself runs in the web console and the headless runner; the apps load only disks in a catalogue signed with a key they trust.

## 13. Hosting PGD in another app

A React app, such as a builder where an AI harness writes games, can embed the console with `<PGDConsole>` from `portable-gaming-device/react` (installed from this repo with `npm install github:stealth-factory/portable-gaming-device#<tag>`) and load games into it at run time. The console runs in an iframe, because the engine takes over the page it runs on. [`react/README.md`](../react/README.md) is the reference for the component: its props, callbacks, ref and message protocol. The site's own [`/host`](../src/pages/host.astro) page uses it, and is a quick way to try a disk: paste the two scripts in, or drop a `.pgdisk` file.

The app can frame the PGD site, or serve the console itself: install a `console-vX.Y.Z` tag, run `npx pgd-console public/pgd` and use `<PGDConsole src="/pgd/index.html">` ([self-hosting](../react/README.md#self-hosting-the-console)). Self-hosted, the console shares the app's origin, so it takes the app's disks with nothing to configure. `npm run build:console` builds the same console from a checkout of this repo.

The rest of this section covers only what a game author needs to know.

What matters for a game:

- **The same two scripts as a `.pgdisk`.** `insertDisk({ disk, game }, { boot })` takes strings: `disk.js`, a plain script defining `PGDDisk` (with `PGDDisk.disk`), and `game.js`, defining `PGDGame` (with `PGDGame.create(api)`). It also takes a whole file as `{ pgdisk: bytes }`. The `disks` prop does the same for a list of disks, and there `game` may be a function `(id) => string | Promise<string>` that the console calls only when the player loads that disk.
- **Only `id` and `drawLoad` are required** on an inserted disk (`id` in lower case, digits and hyphens); the console fills in the rest, with a 2 s load, the genre `CUSTOM` and an empty leaflet. Fill them in anyway: the launcher, the leaflet and the game-over card read them.
- **Plain scripts, no imports.** An inserted disk is handed the `api` and nothing else from PGD, and the game kit isn't on the page as a global. It is not sandboxed, though: its scripts run in the console page's own scope, so browser globals such as `fetch` and `localStorage` are within reach. Keep to [section 10](#10-rules-every-disk-follows) anyway, or the disk won't run in the native apps. To use the kit, bundle it into your scripts as `tools/disks/build.mjs` does (Rolldown with `format: 'iife'` and the names `PGDDisk` and `PGDGame`), or write the game without it.
- **A cover is optional.** Pass `cover` in the generated `cover.ts` shape (`{ w, h, data }`) and `preview` in the `preview.ts` shape (`{ w, h, fps, frames }`) alongside the scripts, or give the disk a `drawCover`. Without either, the launcher shows the title on a floppy label.
- **Same `id`, new disk.** Inserting a disk whose `id` is already there replaces it, so a harness can iterate on one game. If the old one is loading or playing, the console stops it and goes back to the menu (or straight into the new one with `boot`).
- **Errors come back to the host.** `onDiskError({ game, stage, message })` reports a disk that fails to insert (`'insert'`, including a `drawCover` or `drawPreview` that throws, after which the launcher shows the floppy label), to load (`'load'`: a bad `game.js`, or a `drawLoad` or `create` that throws) or while it plays (`'run'`). A `load` or `run` failure also sends the console back to the menu, so check those errors in a harness's loop.
- **Who may insert disks:** the same origin (always the case for a self-hosted console), localhost, and the origins in the PGD build's `PUBLIC_PGD_EMBED_ORIGINS`. An inserted disk runs code on the site that serves the console, which is why [section 10](#10-rules-every-disk-follows) matters most here.

## 14. Checklist for AI harnesses

Before handing a disk to a player, check that it:

1. Exports `disk` from `disk.ts` with every required field (`contract: 1`, `version`, `rating: '4+'`, `id`, `order`, `slug`, `page`, `title`, `nameKey`, `file`, `size`, `loadSecs` ≤ 5, `steps`, `blurb`, `verb`, `buttons`, `overKey`, `againKey`, `manual`, `strings`, `drawLoad`, `genre` ≤ 8 upper-case characters, `players`), and a default `create(api)` from `game.ts` returning `start`, `update` and `draw`.
2. Uses a unique `id`, `slug`, `order` and `loadSecs`, and string keys with its own prefix.
3. Has every string key it uses (`nameKey`, button labels, `overKey`, `againKey`, every `manual` key) in all three languages.
4. Calls `api.fitGrid()` in `start()` and lays everything out from `api.LW`, `api.LH` and `api.HUD`.
5. Moves `ready` → `play` itself (or uses `makeRound`), and calls `api.finishGame()` exactly once.
6. Clears every `queued` press it acts on, and clears FIRE during `ready`.
7. Draws only with `api.col(role)` colours and `Screen2D` members, text only through `api.txt`, and the whole frame in every `draw()`.
8. Uses no browser globals, timers or `Date`, and does nothing when its modules load.
9. Plays with touch alone: a stick game needs nothing but the stick and its lit buttons; a pad game maps the pad slots it reads.
10. Runs headless to `over` with `tools/conformance/run.mjs` and a script that plays it, with no exceptions.

## 15. Not possible yet

| Want | Today | Where it would change |
| --- | --- | --- |
| Place, size or restyle buttons, or a layout of the game's own | Fixed slots in fixed places per layout | `ActionButtons.tsx`, `console.css` |
| More than ten buttons, or a second pad arrangement on sideways phones | `fire`, `boost`, `fireL`, `fireR`, `pad1`–`pad6`; the sideways pad is shaped for I Invade, `pad6` has no place | `defineSlot()` in `core.ts`, `console.css` |
| <kbd>Enter</kbd> as FIRE | Only for FIRE labelled `serve`, and Martian Storm | `serveKey()` in `core.ts` |
| Gamepads | Not supported | Backlog |
| Noise, samples or music | Square-wave tones only | `ConsoleAPI.tone` and the platforms' sound |
| Images, strokes, gradients, transparency | Filled shapes and palette-index layers | `Screen2D` |
| More than four colours on screen | Four, chosen by the player's dial | By design |
| Two players at once | One set of controls | Not planned |
| Saving progress other than the best score | `api.best` and the table only | `ConsoleAPI` |
| Packing a `.pgdisk` from outside the repo | Folders under `src/games/` only, with a generated cover | `tools/disks/` |

## The ConsoleAPI at a glance

Every member, grouped. Values are live: read them when you need them.

| Group | Members |
| --- | --- |
| Picture | `g`, `layer(w, h)`, `stamp(layer, x, y)`, `LW`, `LH`, `HUD`, `fitGrid()`, `col(role)`, `palRGB`, `palette` |
| Grid | `W`, `H`, `C`, `K`, `idx(x, y)`, `inb(x, y)`, `DIRS` |
| Drawing helpers | `txt(s, x, y, role?, align?, size?)`, `banner(title, sub?)`, `rr(x, y, w, h, r)`, `poly(pts)`, `circ(x, y, r)` |
| State | `S` |
| Stick and keys | `held`, `stickDir`, `wantDir()` |
| Buttons | `button(id)`, `clearButton(id)`, `setButtons(patch)`, `fireQueued`, `fireHeld`, `boostQueued`, `boostHeld`, `clearFire()`, `clearBoost()`, `setBoostLabel(key)` (deprecated: use `setButtons`) |
| Taps | `tapQueued`, `tapHeld`, `tapX`, `clearTap()` |
| Sound and touch | `tone(freq, dur, vol?, slide?, delay?)`, `buzz(h)` |
| Scores | `best`, `saveBest()`, `finishGame()` |
| Odds and ends | `track(name, data?)`, `mulberry32(seed)`, `diskInfo(y, p, t, disk)` |

And the game gives back, from `create(api)`: `start()`, `update(dt)`, `draw()`, and optionally `onPalette()` and `debug`.
