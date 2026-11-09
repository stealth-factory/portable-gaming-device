# Making a game disk

Every game on the Game Guy 3000 Deluxe is a **disk**: one folder in `src/games/`. The console finds it on its own (`registry.ts`), so there is no list to edit. The disk menu, its page (`/<slug>`), its instructions, its high-score table and the offline cache all pick it up.

This page lists every file a game needs, in its folder and outside it, what goes in each, and how to check it. [`AGENTS.md`](../../AGENTS.md#game-folders) has the same list in short; the rules for how a game may talk to the console are in [Plug-in rules](#plug-in-rules) below.

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
2. Add an `IMAGES` entry: `out: 'og-<slug>.png'`, the play capture as `tv`, the title, the `<small>on the Game Guy 3000 Deluxe</small>` line, a one-sentence tagline and a fan of two floppies.
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
6. Fill in `genre` and `players`.
7. Add the capture steps and `IMAGES` entry to `make.cjs`, run it with `--covers`, and commit `public/og-<slug>.png`, the two screenshots and `cover.ts`.
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
