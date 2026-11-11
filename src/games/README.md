# Making a game disk

Every game on the PGD-01 Portable Gaming Device is a **disk**: one folder in `src/games/`. The console finds it on its own (`registry.ts`), so there is no list to edit. The disk menu, its page (`/<slug>`), its instructions, its high-score table and the offline cache all pick it up.

This page lists every file a game needs, in its folder and outside it, what goes in each, and how to check it. It also covers how a game [chooses its buttons](#controls-and-buttons) and [how it shows up on the menu and the loading screen](#on-the-menu-and-the-loading-screen). [`AGENTS.md`](../../AGENTS.md#game-folders) has the same list in short; the rules for how a game may talk to the console are in [Plug-in rules](#plug-in-rules) below.

## At a glance

```
src/games/<folder>/
├── disk.ts        required   the label: id, title, load time, buttons, instructions, themed loading screen
├── game.ts        required   the game: default export create(api) → { start, update, draw }
├── strings.ts     expected   every word for the page and the instructions, in en, zh-hant and zh-hans
├── art.ts         expected   the sprites and drawing helpers, in colour roles
├── rules.ts …     as needed  pure game rules (weapons, scoring, level generation), unit-tested
├── cover.ts       generated  launcher cover, 2-bit, made by make.cjs --covers
└── preview.ts     generated  launcher flipbook preview (make.cjs --previews)

public/og-<slug>.png                     required   share image for the game's page, 1200 × 630
docs/screens/load-<short>.png            expected   README screenshot of the loading screen
docs/screens/play-<short>.png            expected   README screenshot of play
tools/share-images/make.cjs              edit       an IMAGES entry and the capture steps (a play(…) capture makes the cover)
tests/unit/<game>*.test.ts               as needed  tests for rules.ts and friends
tests/flow.cjs                           edit       game-specific checks (the generic play-through covers the rest)
tools/autopilot/<game>.mjs               optional   a headless bot for tuning difficulty
README.md, AGENTS.md                     edit       the Games table, screenshots and a requirement section
```

**Required** means the build or the unit tests fail without it. **Expected** means every game so far has one and review will ask for it. **Generated** files come from a tool; never edit them by hand.

The folder name is the game's slug in kebab case (`dino-run`). It doesn't have to match the disk's `id`, which is short and goes into storage keys (`gg-board-<id>`), but it usually matches `slug`.

## In the folder

### `disk.ts` (required)

The label. It is loaded up front with every other disk, so the menu and the loading screen show while the game's code is still being fetched. Keep it light: it may import `strings.ts`, `art.ts` and `../../kit/play/sprite`, but nothing heavier.

It exports `disk: GameDisk` (see [`types.ts`](types.ts) for every field):

| Field | What it is |
| --- | --- |
| `id`, `order`, `slug` | Storage and analytics id, place on the menu, and the page path. All three are unique. |
| `page` | English title and description for the game's page and its link preview. |
| `title`, `nameKey` | The title in the pixel font, and the I18N key for it in the leaflet. |
| `file`, `size` | The file the drive "reads" (`DINORUN.COM`) and its size in bytes. |
| `loadSecs`, `steps` | Load time, at most 5 s and different from every other game's, and the uneven progress curve from `[0, 0]` to `[1, 1]`. |
| `blurb`, `verb` | One line under the title on the menu, and the verb for `PRESS FIRE TO …`. |
| `tap`, `controls` | Whether taps on the screen count as a press, and `'pad'` to swap the stick for the button pad. |
| `buttons` | Each action button's I18N label and whether it's lit; slots left out go dark. |
| `overKey`, `againKey` | The game-over card's title and button. |
| `manual`, `strings` | The Operating Instructions and every string they use. |
| `drawLoad(api, p, t)` | The themed loading screen. |
| `genre`, `players`, `year` | Launcher details: `genre` upper case and at most 8 characters (`DIG`, `BAT+BALL`), `players` a whole number of 1 or more, `year` optional. A unit test checks the first two. |
| `drawCover`, `drawPreview` | Optional hand-drawn launcher cover and preview loop, `(api, x, y, w, h, t)`, for when the captured cover reads badly at carousel size. |
| `cover`, `preview` | Never set these in `disk.ts`: the registry attaches them from the folder's generated `cover.ts` and `preview.ts`. |

### `game.ts` (required)

The game itself, fetched while the drive reads the disk. It default-exports `create(api)`, which returns a `GameRuntime`:

- `start()`: a new game. Reset the field and the score.
- `update(dt)`: every step while the mode is `ready`, `play`, `dying` or `clear`.
- `draw()`: draw the playfield and HUD into the low-res buffer.
- `onPalette()` (optional): the phosphor changed; rebuild anything cached in colour.
- `debug` (optional): hooks the Playwright checks call through `__gg`. Every game has one; expose what the tests need to read or set up (`state()`, a way to skip to a wave).

Make canvases, listeners and state inside `create()`, never at the top of the module.

### `strings.ts` (expected)

`export const strings: Strings` with `en`, `zh-hant` and `zh-hans`. It holds the game's name, its instructions, its button labels and its game-over words. The leaflet and the page use these; on-tube text stays English in the pixel font and is written in `disk.ts` and `game.ts`.

All disks share one string table, so prefix your keys with something of the game's own (`dHow`, `dr1` for Dino Run). A unit test fails if two disks define the same key differently. Reuse the console's section headings (`howH`, `secScore` …) rather than defining your own.

The instructions follow Tunnel Raider's leaflet: how to play, the controls (a `keys` list), scoring, and how it gets harder. End with a credit line if the game is a tribute, naming the original and saying the characters, art, sound and code are original.

### `art.ts` (expected)

The game's sprites and drawing helpers: original pixel art built from rectangles or `kit/play/sprite` bitmaps, drawn only in colour roles through `api.col(role)`, never in literal colours. Both `disk.ts` (for the loading screen) and `game.ts` use it, so keep it free of game state.

### Rules modules (as needed)

Anything with rules worth testing on their own goes in its own pure module: `bricks/rules.ts` (wall generation and capsules), `invader-force/weapons.ts`, `i-invade/cluster.ts`. No canvas, no `api`; plain inputs and outputs, so `tests/unit/` can check them.

### `cover.ts` (generated, required) and `preview.ts` (generated, optional)

The launcher's cover, as data the console paints in whatever phosphor is on: `export const cover: Cover = { w: 128, h: 96, data: '<base64>' }`, one palette index (0 = `bg` to 3 = brightest) per pixel, four pixels a byte. `tools/share-images/make.cjs --covers` writes it from the low-res buffer at the same moment as the game's `play-<short>.png` capture (no scanlines or bloom), so never draw or edit it by hand. `covers.test.ts` checks that every disk has one and that it decodes. The codec and painter live in `src/console/launcher/cover.ts`.

`preview.ts` is an optional flipbook in the same format (`{ w, h, fps, frames }`): the cover's frame and seven more over 2 s, which the launcher plays after 0.8 s on a disk. `make.cjs --previews` writes it (and the cover with it), and `loadPreviews()` in the registry fetches it lazily. `covers.test.ts` checks that a preview's first frame is its cover, so whenever a game's capture changes, regenerate both together with `--previews`; `--covers` alone would leave a stale preview and fail the test. A disk can instead draw its own art with `drawCover` and `drawPreview`. The launcher tries `drawCover`, then `cover.ts`, then the title on a floppy label. The full design is in the [Web launcher build spec](https://linear.app/stealth-company/document/web-launcher-build-spec-gam-32-88a4c25140c8).

## Controls and buttons

A game doesn't draw or place its own buttons. The set has a fixed row of physical buttons, and the layout detector decides where they sit for each screen. A game chooses three things: **which buttons are lit**, **what each one is called**, and **whether it uses the stick or the button pad**. It then reads presses through the `ConsoleAPI`.

### The slots

Every physical button is a **slot** with an id and its own keys (`src/console/buttons.ts`, defined in `core.ts`).

| Slot | On the set | Keys | Notes |
| --- | --- | --- | --- |
| `fire` | The big red button | <kbd>Space</kbd>, <kbd>Z</kbd>, <kbd>X</kbd> | Always there. Hidden on screen while the button pad is up, but <kbd>Space</kbd> still presses it. |
| `boost` | The second button | <kbd>Shift</kbd>, <kbd>B</kbd> | Always there. |
| `fireL`, `fireR` | Extra keys either side of FIRE, sharing its row | <kbd>Z</kbd>, <kbd>V</kbd> | **Optional:** hidden, with their keys left to `fire`, unless the game maps them. With all three showing each is about 32 px wide on a small phone, so keep labels to three letters or fewer. |
| `pad1` … `pad6` | The button pad, in the stick's place | `pad1` <kbd>←</kbd> <kbd>Z</kbd>, `pad2` <kbd>↑</kbd> <kbd>X</kbd>, `pad3` <kbd>→</kbd> <kbd>C</kbd>, `pad4` <kbd>A</kbd>, `pad5` <kbd>S</kbd>, `pad6` <kbd>D</kbd> | **Optional,** and only with `controls: 'pad'`. Two rows of three: `pad1`–`pad3` red on top, `pad4`–`pad6` amber underneath. Leave `pad6` out and `pad4` and `pad5` share the bottom row. The pad takes its keys only while the game is up; the console gets them back for the menu, name entry and the tables. |

The console's own controls aren't slots and a game can't take them: POWER, RESET, the dial, the four switches, <kbd>G</kbd> (back to the menu), <kbd>P</kbd> / <kbd>Esc</kbd> (HOLD), <kbd>M</kbd> (SOUND), <kbd>F</kbd> (FULL) and <kbd>C</kbd> (the phosphor; with the pad up, <kbd>C</kbd> is `pad3` instead).

### Choosing them: `buttons` in `disk.ts`

`buttons` maps a slot id to an I18N key for its label and, optionally, `enabled: false`:

```ts
buttons: { fire: { label: 'jump' }, boost: { label: 'duck' } },                    // Dino Run
buttons: { fire: { label: 'serve' } },                                            // Bricks: BOOST left out, so it's dark
buttons: { fire: { label: 'spark' }, boost: { label: 'shield' } },                // Invader Force
```

- **Slots left out go dark** and ignore presses. An optional slot left out stays hidden.
- **`enabled: false`** shows the button greyed and with its label, for one that will light up later (I Invade's METEORS, dimmed until charged).
- **Labels** are I18N keys, so put the words in `strings.ts` in all three languages. The console's own keys (`spark` for FIRE, `boost`) are there to reuse. Keep labels short: FIRE and BOOST fit about six letters on a phone, the pad keys fewer.
- **The launcher** on a wide tube (desk, and a sideways console or tablet with room to spare) lists every lit slot except the pad's as a chip under the cover (`[JUMP] [DUCK]`), so the map doubles as the game's control summary there. Portrait and short tubes don't show the chips, so the leaflet's controls list still matters.

### Reading presses in `game.ts`

```ts
const fire = api.button('fire');            // { label, enabled, queued, held }
if (fire.queued) { shoot(); api.clearButton('fire'); }   // one shot per press
if (api.button('boost').held) shield();     // as long as it's down
```

- **`queued`** is a press not yet handled. It stays set until you clear it, so handle it once and call `clearButton(id)`. Presses outside `play` are dropped for every slot but `fire`, so a game in `ready` should clear `fire` itself (Dino Run calls `api.clearFire()` while counting down) to stop a press on the menu firing the first shot.
- **`held`** is true while the button or any of its keys is down.
- **Shorthands** for the common pair: `api.fireQueued`, `api.fireHeld`, `api.boostQueued`, `api.boostHeld`, `api.clearFire()`, `api.clearBoost()`.
- **<kbd>Enter</kbd>** presses `fire` only in Bricks (whose FIRE reads SERVE) and Martian Storm, because their leaflets promise it (`serveKey()` in `core.ts`). Anywhere else it is POWER, or a new game from the game-over card. A new game that wants it has to be added there for now.

### Changing them mid-game

`api.setButtons(patch)` changes slots for now. Each entry is a new label and/or `enabled`, or `null` to go back to what `disk.ts` declared:

```ts
api.setButtons({ boost: { label: 'nuke' } });     // Invader Force: an atomic bomb is ready
api.setButtons({ pad5: { enabled: true } });      // I Invade: the meteor swarm has charged
api.setButtons({ boost: null });                  // back to SHIELD
```

Slots the set doesn't have are ignored, so asking for one is safe. The console puts the declared map back at the start of every new game.

### Taps and the stick

- **Taps on the screen:** set `tap: true` on the disk and read `api.tapQueued`, `api.tapHeld` and `api.clearTap()`. Taps count only in `ready` and `play`. `api.tapX` is where the last tap landed, in low-res pixels across the tube (I Invade fires the nearest bomb bay). Without `tap`, a tap on the screen does nothing in a game.
- **The stick (`controls: 'stick'`, the default):** `api.wantDir()` is the step to move now (`{ dx, dy }` or `null`), taking the on-screen stick first, then the newest arrow or WASD key. `api.stickDir` and `api.held` give the raw sources: the stick is 4-way, and only the keyboard can hold a diagonal (Martian Storm combines `api.held`).
- **The pad (`controls: 'pad'`):** for a game with no use for the stick. While the game is up the stick and the FIRE row step aside for the pad, so map the pad slots you need and read them with `api.button('pad1')` and so on. The arrows, <kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> and <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> become pad keys, so don't steer with `wantDir()` in a pad game.

### Where they sit on each layout

The layout detector picks the arrangement (`src/styles/console.css`); the game has no say in it.

| Layout | Stick or pad | FIRE and BOOST |
| --- | --- | --- |
| Desk | In the controls column on the right of the tube | Under the stick |
| Console (phone sideways) | Left of the tube | Right of the tube, under the dial and the plate |
| Tall console (tablet or foldable sideways) | Full height, left of the tube | Bottom right, under the dial and the switches |
| Phone portrait, tablet portrait | Under the tube, on the left | Under the tube, on the right |

On desk and the portrait layouts the pad keeps its two rows inside the stick's box. On the sideways console layouts it is split up for I Invade: `pad1`–`pad3` on the right with `pad4` under them, and `boost` above `pad5` on the left. Those places are named for I Invade's keys in `console.css` (`bays`, `clus`, `ufo`, `met`), and `pad6` has none, so a second pad game with a different set of keys needs that block of CSS revisited. Check every layout with the [browser checks](#outside-the-folder) and screenshots.

Adding a new physical button is console work, not game work: one more `defineSlot()` in `core.ts`, the button in `src/components/ActionButtons.tsx`, and its place in every layout in `console.css`. Games that don't map it never see it.

## On the menu and the loading screen

A disk is on the menu as soon as its folder has a `disk.ts`; `registry.ts` finds it, sorts by `order` and attaches its cover. Here is where each field shows up.

### The launcher (the cover carousel)

| What the player sees | Comes from |
| --- | --- |
| Position in the box, the tick strip and the `nn/NN` counter, and the <kbd>1</kbd>–<kbd>9</kbd> key that loads it | `order`, sorted. Keep it unique and add a new disk after the last. |
| The big picture in the middle | `drawCover`, else the generated `cover.ts`, else the title on a floppy label |
| What plays after 0.8 s on the disk (never with reduced motion) | `drawPreview`, else the generated `preview.ts` flipbook, else the cover held still |
| The label strip under the cover | `title`, then `file` and `size` (or the disk's state, such as a load that failed offline) |
| The details lines | **Wide:** `blurb`; then this device's best with `genre`, `players` (`1P`) and `year`; then the controls glyph (`STICK` or `PAD`, plus `+ TAP` with `tap: true`) and a chip for each lit button. **Portrait:** the first two of those, no controls line. **Short:** one line, `blurb` and the best. |

The launcher fits each line to the tube and drops trailing chips when they don't fit, so put the most important button first in `buttons`. The tiers come from the tube's shape (`src/console/launcher/layout.ts`).

### Its own page

`slug` makes `/<slug>`, which boots straight into the disk; `page.title` and `page.description` are its `<title>` and link preview, and `public/og-<slug>.png` its share image. The header, the leaflet and the offline cache follow without any other change.

### The loading screen and the drive

When the player loads the disk, the console runs `drawLoad(api, p, t)` every frame for `loadSecs` seconds (capped at 5), while it fetches `game.ts` in the background.

- **`p`** goes from 0 to 1 along `steps`, a list of `[fraction of the time, fraction loaded]` points from `[0, 0]` to `[1, 1]`. Flat stretches are the drive seeking; steep ones are sectors coming off, so make it uneven.
- **`t`** is seconds since the drive started, for animation.
- **End with `api.diskInfo(y, p, t, disk)`**, which draws the shared sector bar and `LOADING <file>` line and returns the y below them. Draw the title art and scene above it.
- **The drive sound** (motor, recalibrating, track steps, head parking) is played by the console for exactly `loadSecs`, so the disk needs no sound code. If `game.ts` is late, the bar waits at its last sector until it arrives.
- **The instructions** in the leaflet switch to the disk's `manual` as it loads.

Pick a `loadSecs` no other disk uses (`disks.test.ts` checks): around 1.5 s for a small game, up to 5 s for a big one.

## Artwork and images

A game shows up in five places. Each one has its own art, and all of it is original.

| Where | What | Made by | Colours |
| --- | --- | --- | --- |
| The game | Sprites and playfield | `art.ts`, drawn every frame | 4 phosphor colours, through roles |
| The loading screen | Title art, a scene and the sector bar | `drawLoad` in `disk.ts` (end it with `api.diskInfo`) | 4 phosphor colours |
| The launcher | Cover and preview | `cover.ts` and `preview.ts` from `make.cjs --previews`, or `drawCover` / `drawPreview` | 4 phosphor colours |
| The game's page and link previews | `public/og-<slug>.png`, 1200 × 630 | `tools/share-images/make.cjs` | Full colour |
| The README | `docs/screens/load-<short>.png`, `play-<short>.png`, 720 px wide | `tools/share-images/make.cjs` | Full colour |

Anything on the tube goes through the palette quantiser, so it looks right on green, amber, white and CGA. Check the loading screen and the game on all four with the phosphor dial.

The share image and screenshots are never drawn by hand. To make them for a new game:

1. Add the capture steps to `make.cjs`: load the disk, wait for a good moment on the loading screen and in play, and `shot('load-<short>.png')` for the loading screen and `play('play-<short>.png', '<folder>')` for play. `play()` takes the screenshot and, with `--covers`, writes the game's `cover.ts` from the same frame; with `--previews` it also writes `preview.ts`. Add `load-<short>` and `play-<short>` (without `.png`; the script adds it) to the README screenshots list near the end of the script.
2. Add an `IMAGES` entry: `out: 'og-<slug>.png'`, the play capture as `tv`, the title, the `<small>on the PGD-01 Portable Gaming Device</small>` line, a one-sentence tagline and a fan of two floppies.
3. Run it against a preview build:

   ```sh
   # each step runs only if the one before it worked, so a failed build never captures a stale dist/
   npm run build &&
     { npm run preview & } &&   # serves http://localhost:4173
     until curl -sf http://localhost:4173 >/dev/null; do sleep 1; done &&   # wait for it to listen
     NODE_PATH=$(npm root -g) node tools/share-images/make.cjs --previews   # writes cover.ts too
   ```

`--previews` also writes every game's `cover.ts` and `preview.ts`. `--covers` writes only the covers, which leaves a game's existing preview out of step with its new cover, so use it only for a game without a `preview.ts`. `--covers-only` writes just the covers and skips the share images. Share images stay out of the offline precache; players never download them.

## Outside the folder

- **`tests/flow.cjs`:** the generic play-through already boots, loads, plays, ends and checks name entry for every disk at desk, phone portrait and phone landscape sizes. Add checks for anything game-specific (a weapon, a scoring quirk, a pad layout).
- **`tests/unit/`:** tests for your rules modules (`bricks.test.ts`, `invader-weapons.test.ts`). `disks.test.ts` already checks every disk's fields, strings, share image and imports.
- **`tools/autopilot/`:** optional. A bot that plays the game headless and prints how far it got, for tuning difficulty (`i-invade.mjs`).
- **`README.md`:** a row in the Games table, the screenshots in the gallery, the controls, and any new analytics event.
- **`AGENTS.md`:** a numbered requirement section with the owner's rules for the game.

## Plug-in rules

`disks.test.ts` checks the first (no `src/console` imports in any game file). The rest are checked in review, so a passing test run doesn't mean a `disk.ts` import is light enough.

- **No console imports.** A game never imports from `src/console`. Everything comes through the `ConsoleAPI` it is handed. If a game needs something new, add it to `ConsoleAPI` in `types.ts` and to `api` in `core.ts`.
- **No side effects.** Loading a game's modules does nothing; make canvases and listeners in `create()`.
- **The kit is the exception.** Games may import `src/kit/play/` (`import { makeFx } from '../../kit/play'`) and types from `src/kit/platform/`. A `disk.ts` may import only `kit/play/sprite`.
- **Read the API live.** `api.LW`, `api.S` and the rest change with the tube's shape and the mode; read them each frame.
- **Haptics.** Buzz through `api.buzz()`: `'fire'` as a shot leaves, `'lose'` for a life, `'pickup'` on a catch.
- **Analytics.** `api.track(name, data)` with at most two properties, one of them the game id.
- **Original work.** Original names, characters, art, sound and code, even for a tribute. Never copy another game's sprites, sounds or code.

## A new disk, step by step

1. File the Linear issue and branch from it (see `AGENTS.md`).
2. Make `src/games/<folder>/` with `disk.ts`, `game.ts`, `strings.ts` and `art.ts`. Pick a unique `id`, `slug` and `loadSecs`, and give it the next `order` after the existing disks (7 today). `make.cjs`, `tests/flow.cjs` and `tests/pages.cjs` load some disks by menu position (`loadGame(1)` is Dino Run), so a disk slotted in between moves them; if you must, update those indices in the same pull request.
3. Write the instructions in all three languages.
4. Draw the loading screen and check it on all four phosphors and every layout (desk, console, phone and tablet, portrait and landscape).
5. Split testable rules into their own modules and test them.
6. Fill in `genre` and `players`, and choose the buttons (see [Controls and buttons](#controls-and-buttons) and [On the menu and the loading screen](#on-the-menu-and-the-loading-screen)).
7. Add the capture steps and `IMAGES` entry to `make.cjs`, run it with `--previews`, and commit `public/og-<slug>.png`, the two screenshots, `cover.ts` and `preview.ts`.
8. Add game-specific checks to `tests/flow.cjs`.
9. Update the README and `AGENTS.md`.
10. Run `npm run build`, `npm test`, then `tests/flow.cjs`, `tests/pages.cjs`, `tests/stick.cjs` and `tests/haptics.cjs` against `npm run preview`.

## A minimal disk

`disk.ts`:

```ts
import type { ConsoleAPI, GameDisk } from '../types';
import { strings } from './strings';

export const disk: GameDisk = {
  id: 'pong', order: 7, slug: 'paddle-ball', genre: 'BAT+BALL', players: 2,   // the launcher's details line
  page: { title: 'Paddle Ball', description: 'Bat the blip past the other paddle.' },
  title: 'PADDLE BALL', nameKey: 'pbName', file: 'PADDLE.COM', size: 6144, loadSecs: 1.2,
  steps: [[0, 0], [0.3, 0.4], [0.5, 0.45], [1, 1]],
  blurb: 'BAT · BOUNCE · WIN', verb: 'PLAY', overKey: 'over', againKey: 'again',
  buttons: { fire: { label: 'pbServe' }, boost: { label: 'boost', enabled: false } },   // no BOOST: it stays dark
  manual: [{ h: 'howH', p: 'pbHow' }],
  strings,
  drawLoad(api: ConsoleAPI, p: number, t: number){
    api.txt('PADDLE BALL', api.LW / 2, 40, 'text', 'center', 16);
    api.diskInfo(80, p, t, disk);
  },
};
```

`strings.ts`:

```ts
import type { Strings } from '../types';

export const strings: Strings = {
  en: { pbName: 'Paddle Ball', pbHow: 'Bat the blip past the other paddle.', pbServe: 'SERVE' },
  'zh-hant': { pbName: 'Paddle Ball 擋板球', pbHow: '把光點打過對方的擋板。', pbServe: '發球' },
  'zh-hans': { pbName: 'Paddle Ball 挡板球', pbHow: '把光点打过对方的挡板。', pbServe: '发球' },
};
```

`game.ts`:

```ts
import type { CreateGame } from '../types';

const create: CreateGame = api => ({
  start(){ api.fitGrid(); api.S.score = 0; },
  update(dt){ if (api.S.mode === 'ready' && (api.S.modeT -= dt) <= 0) api.S.mode = 'play'; /* … */ },
  draw(){ api.g.fillStyle = api.col('text'); /* … */ },
  debug: { state: () => ({ /* what the tests need */ }) },
});
export default create;
```

That is enough for the disk to appear on the menu and get its own page. The unit tests fail until `public/og-paddle-ball.png` exists, so run the share-image tool next.
