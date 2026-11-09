# Game Guy 3000 Deluxe

![Game Guy 3000 Deluxe on a green-phosphor CRT monitor](public/og-image.png)

A 1983-style home console in the browser, on an old phosphor monitor. Switch it on, watch the BIOS and the floppy drive boot, pick a disk from the menu and play. Each game has its own loading screen, instructions and high-score table, and it all works offline once loaded.

| The disk menu | Loading Tunnel Raider | Tunnel Raider |
| --- | --- | --- |
| ![The disk menu](docs/screens/menu.png) | ![Tunnel Raider loading](docs/screens/load-tunnel.png) | ![Tunnel Raider](docs/screens/play-tunnel.png) |
| **Loading Dino Run** | **Dino Run** | **Loading Invader Force** |
| ![Dino Run loading](docs/screens/load-dino.png) | ![Dino Run](docs/screens/play-dino.png) | ![Invader Force loading](docs/screens/load-invader.png) |
| **Invader Force** | **Loading I Invade** | **I Invade** |
| ![Invader Force](docs/screens/play-invader.png) | ![I Invade loading](docs/screens/load-iinvade.png) | ![I Invade](docs/screens/play-iinvade.png) |

## Games

| # | Game | File | Load time | What it is |
| --- | --- | --- | --- | --- |
| 1 | **Tunnel Raider** | `TUNNEL.EXE` | 4.4 s | Dig for emeralds, drop sacks of gold on the grubs and outwit smarter monsters every level. A stage clock ticks on the top bar, and digging out every block of earth on a level wins a spare cart. A tribute to Windmill Software's *Digger* (1983). |
| 2 | **Dino Run** | `DINORUN.COM` | 1.8 s | Jump the cacti and boulders, duck the pterosaurs, run as far as you can. A tribute to the offline dinosaur game in Google Chrome (2014). |
| 3 | **Invader Force** | `INVFORCE.EXE` | 3.1 s | Hold the line against a marching alien formation: one shot at a time, walls that crumble, a mystery saucer, a short shield on BOOST, and capsules that drop weapons (Twin, Spread, Rapid, a lightning laser), a stacking shot-speed boost and a rare atomic bomb. A tribute to Taito's *Space Invaders* (1978). |
| 4 | **I Invade** | `IINVADE.EXE` | 2.6 s | The same war from the other side: steer the alien fleet as it sinks, bomb the tanks from its bomb bay, and call in the UFO for a heavy strike. Wipe out the tanks or touch down on their row. The tanks shoot back, and learn to dodge. |

The characters, art, sound and code in all four are original.

Each game also has its own page that boots straight into its disk: `/tunnel-raider`, `/dino-run`, `/invader-force` and `/i-invade`, each with its own title, description and share image.

## The console

- **POWER** switches the set on (or press <kbd>Enter</kbd>). It runs a memory test, beeps, spins up the drive and boots the disk menu.
- **Disk menu:**
  - **Choose a game:** stick, arrow keys or <kbd>1</kbd>–<kbd>9</kbd>.
  - **Load it:** FIRE, <kbd>Space</kbd>, <kbd>Enter</kbd> or a tap on the disk.
- **Loading:** every disk shows a loading screen themed to its game and plays the drive (motor, head recalibrating, track steps, head parking) for exactly as long as it takes to read. Load times differ per game and never exceed 5 seconds.
- **<kbd>G</kbd>** warm-boots back to the disk menu from any game. (A SELECT key for this is built but hidden on the set for now.)
- **RESET** (wine-red key) restarts the whole console from the BIOS.
- **The phosphor dial and switches:**
  - **Dial:** green P1, long-afterglow green P39, radar P7 (a visible beam sweeping down the tube), amber P3, paper white P4 and the two CGA palettes.
  - **Switches:** SOUND, GLOW (all the tube effects), HOLD (pause) and FULL (full screen).
- **FIRE and BOOST** change with the game: FIRE and BOOST in Tunnel Raider, JUMP and DUCK in Dino Run, FIRE and SHIELD in Invader Force (SHIELD turns into NUKE while you hold an atomic bomb), BOMB and UFO in I Invade. In Dino Run, Invader Force and I Invade a tap on the screen works as JUMP, FIRE or BOMB.
- **Instructions:** the printed leaflet under the set shows the console's instructions while the menu is up and the loaded game's while you play.

### High scores

Each game keeps its own top ten on the device, in the browser's local storage, so scores survive offline play and restarts but never leave the device.

- **Entering a name:** a score that makes the table opens arcade-style name entry: up to nine letters and spaces, picked from an on-screen grid with the stick and FIRE, tapped, or typed.
- **After a game:** the game-over card and the table take turns on the screen.
- **Moving over from Tunnel Raider:** scores saved by the standalone Tunnel Raider on the same site are picked up automatically.

## Screens

A layout detector picks a layout from the viewport and input type:

| Layout | When |
| --- | --- |
| Desk | A mouse or trackpad |
| Console | A phone held sideways (gamepad style) |
| Tall console | A tablet or opened foldable held sideways |
| Phone portrait | An upright phone |
| Tablet portrait | An upright tablet |

The playfield's grid follows the shape of the tube.

## Languages

English (default), Traditional Chinese and Simplified Chinese, carried in the link: `#en`, `#zh-hant` (also `#zh-hk`, `#zh-tw`), `#zh-hans` (also `#zh-cn`, `#zh-sg`). Text on the tube stays English in the pixel font.

## Development

**Astro** builds the pages as static HTML; **React** supplies the reusable parts of the set; the **console engine** is plain TypeScript on Canvas 2D. There's no game engine: the picture comes from the console's own four-colour, phosphor-afterglow CRT pass.

```sh
npm install
npm run dev        # local dev server
npm run build      # type-check, then build to dist/
npm run preview    # serve the build on http://localhost:4173
npm test           # unit tests (Vitest)
```

Browser checks use Playwright against `npm run preview`. They need Chromium and the `playwright` package; here the machine-wide copy is found with `NODE_PATH`:

```sh
npm run preview &
NODE_PATH=$(npm root -g) node tests/flow.cjs    # boot → menu → both games → back to the menu → high scores, at three sizes
NODE_PATH=$(npm root -g) node tests/pages.cjs   # the leaflet follows game and language; game pages; offline play
```

Both scripts load pages with `?test`, which exposes a small `window.__gg` hook for driving the console.

### How it fits together

- **Pages** (`src/pages/`): `index.astro` is the console; `[slug].astro` makes one page per game from the disks. Both use `src/layouts/ConsoleLayout.astro`.
- **React components** (`src/components/`): the header, the set (`ConsoleSet`: `Screen`, `Nameplate`, `PhosphorDial`, `Rocker`, `PowerPanel`, `KeyButton`, `Joystick`, `ActionButtons`), the bar under it and the status badge. They render to static HTML at build time with the ids the engine looks for, so they ship no JavaScript.
- **The leaflet** (`Manual.tsx`) is the one live React island. It follows the engine's language and loaded game through a tiny shared store (`src/console/bus.ts`).
- **The console engine** (`src/console/`) runs the 60 fps loop:
  - **`core.ts`:** CRT picture, input, sound, switches, scores and the API games get.
  - **`loader.ts`:** boot screens, disk menu, loading and drive sounds.
  - **`i18n.ts`:** every string, in three languages.
  - **`pwa.ts`:** install button and offline and update prompts.
- **Games** (`src/games/`) plug in through `types.ts`. `registry.ts` finds them on its own.

```
src/pages/                 index.astro, [slug].astro
src/layouts/               ConsoleLayout.astro: head, layout detector, the set, the leaflet
src/components/            React components (static) and Manual.tsx (island)
src/console/               the engine: core, loader, i18n, strings, manual, bus, pwa
src/games/types.ts         the plug-in contract: GameDisk, GameRuntime, ConsoleAPI
src/games/registry.ts      finds the disks; fetches a game's code when it loads
src/games/<id>/disk.ts     a game's label, loading screen, instructions and strings
src/games/<id>/game.ts     the game itself: default export create(api)
src/styles/console.css     the set, its layouts and the leaflet
public/                    icons, favicon, share image
```

### Adding a game

Make a folder in `src/games/` with two files. Nothing else needs editing: the disk menu, its page (`/<slug>`), its instructions, its high-score table and the offline cache all pick it up.

`disk.ts` is the label. It's small and loaded up front, so the menu and the loading screen can show while the game is fetched:

```ts
import type { ConsoleAPI, GameDisk } from '../types';

export const disk: GameDisk = {
  id: 'pong', order: 3, slug: 'paddle-ball',
  page: { title: 'Paddle Ball', description: 'Bat the blip past the other paddle.' },
  title: 'PADDLE BALL', nameKey: 'pbName', file: 'PADDLE.COM', size: 6144, loadSecs: 1.2,
  steps: [[0, 0], [0.3, 0.4], [0.5, 0.45], [1, 1]],
  blurb: 'BAT · BOUNCE · WIN', verb: 'PLAY', overKey: 'over', againKey: 'again',
  buttons: { fire: { label: 'spark' }, boost: { label: 'boost', enabled: false } },   // no BOOST in this game: it stays dark
  manual: [{ h: 'howH', p: 'pbHow' }],
  strings: { en: { pbName: 'Paddle Ball', pbHow: '…' }, 'zh-hant': { … }, 'zh-hans': { … } },
  drawLoad(api: ConsoleAPI, p: number, t: number){ api.txt('PADDLE BALL', api.LW / 2, 40, 'text', 'center', 16); api.diskInfo(80, p, t, disk); },
};
```

`game.ts` is the game. It's downloaded while the drive reads the disk, and gets everything from the `api` it's handed:

```ts
import type { CreateGame } from '../types';

const create: CreateGame = api => ({
  start(){ api.fitGrid(); api.S.score = 0; },
  update(dt){ if (api.S.mode === 'ready' && (api.S.modeT -= dt) <= 0) api.S.mode = 'play'; /* … */ },
  draw(){ api.g.fillStyle = api.col('text'); /* … */ },
});
export default create;
```

Rules (the unit tests check them):
- **No console imports:** a game never imports from `src/console`; everything comes through `ConsoleAPI`.
- **No side effects:** loading a game's modules must not do anything (no canvases or listeners at the top level); do that in `create()`.
- **Loads within 5 seconds:** `loadSecs` is 5 or less, and different from every other game's.
- **Three languages:** the name and instructions come in `en`, `zh-hant` and `zh-hans`.
- **Original work:** characters, art and sound are your own, even for a tribute.

### Share images and screenshots

The share images (`public/og-image.png`, plus `public/og-<slug>.png` for each game's page) and the screenshots above (`docs/screens/`) are made from the real console by one script:

```sh
npm run build && npm run preview &
NODE_PATH=$(npm root -g) node tools/share-images/make.cjs
```

It switches the set on, captures the menu, each game's loading screen and some play (Dino Run on autopilot, caught mid-jump). It then lays each capture out beside the name and a fan of floppy disks (`tools/share-images/share.css`) at 1200 × 630.

- **A new game:** add an entry to `IMAGES` in the script.
- **The test that checks it:** the unit tests fail if a game's page has no share image.
- **Kept out of the offline cache:** share images are only for link previews, so players never download them.

### Offline and updates

`@vite-pwa/astro` (Workbox) generates the service worker and manifest at build time and precaches every built file by content hash: every page, every game's code, the icons. Each deploy is a new offline version. When one has downloaded, the set's status badge offers a RESTART instead of interrupting a game. On HTTPS the browser can install the console as an app.

## Analytics

[Vercel Web Analytics](https://vercel.com/docs/analytics) through `@vercel/analytics`: page views plus these custom events. Custom events need a Pro or Enterprise plan; on Pro each event carries at most two properties, so every event stays within two. Nothing personal is sent. Events appear under **Analytics → Events** in the Vercel dashboard.

| Event | Properties | When |
| --- | --- | --- |
| `power_on` | `theme`, `layout` | The set is switched on |
| `game_load` | `game`, `layout` | A disk is loaded from the menu |
| `game_start` | `game`, `layout` | A new game begins |
| `game_over` | `game`, `score` | A game ends |
| `new_best` | `game`, `score` | A game beats this device's best for that game |
| `high_score` | `game`, `rank` | A name goes on a game's table |
| `select` | `game`, `level` | SELECT is pressed (`game` is `menu` from the menu) |
| `reset` | `game`, `mode` | RESET is pressed |
| `level_cleared` | `level`, `secs` | Tunnel Raider: a level ends; `secs` is its stage time |
| `all_dug` | `level`, `secs` | Tunnel Raider: every block of earth dug out (+1 cart) |
| `sunstone` | `level` | Tunnel Raider: the sunstone is picked up |
| `life_lost` | `level`, `cause` | Tunnel Raider: a cart is lost to a `sack`, `grub`, `borer` or `rockjaw` |
| `touchdown` | `level`, `aliens` | I Invade: the fleet lands; `aliens` is how many made it |
| `nuke` | `wave`, `rows` | Invader Force: an atomic bomb goes off (`rows` it wiped out) |
| `theme` | `theme`, `via` | The phosphor changes by `dial` or `key` |
| `language` | `lang` | The leaflet's language changes |
| `instructions_open` | `layout` | The instructions are opened |
| `fullscreen` | `on`, `layout` | Full screen is toggled |
| `launch_installed` | `layout` | Opened as an installed app |
| `install_prompt` | `outcome` | The install prompt is `accepted` or `dismissed` |
| `app_installed` | | The app was installed |
| `offline_ready` | | First cached for offline play |
| `update_applied` | | A player restarted into a new version |

## Deploy

Vercel detects Astro: build command `npm run build`, output directory `dist`. `vercel.json` turns on clean URLs, so `/dino-run` serves `dino-run.html`. Any static host works if it does the same. Turn on Web Analytics in the project for the events above.

**Releases are pooled.** Vercel's production branch is `production`, so merges to `main` only make preview deployments. Each merge updates one standing `release: vX.Y.Z` pull request with the next version and changelog; merging it tags the release and moves `production`, which ships the live site. PR titles are Conventional Commits and decide the version. The whole flow is in [docs/releasing.md](docs/releasing.md), and every release is in [CHANGELOG.md](CHANGELOG.md).

Once the console has its own address:
- **Share tags:** make `og:image` and `twitter:image` absolute in `src/layouts/ConsoleLayout.astro`.
- **Canonical link:** add a canonical link, and set `site` in `astro.config.mjs`.
- **Refresh Facebook's cache:** paste the address into Facebook's Sharing Debugger and press **Scrape Again**.

## Credits

Tunnel Raider is a tribute to Windmill Software's *Digger* (1983); Dino Run to the offline dinosaur game in Google Chrome (2014); Invader Force to Taito's *Space Invaders* (1978), and I Invade turns that genre round so you play the invaders. All four are original work: no characters, art, sound or code are copied.

## Licence

Copyright © 2026 wiiiimm. The code is under the [GNU AGPL-3.0](LICENSE): you can play, study and change it freely, but if you share a changed version or run one on a website, you must release it under the same licence with its full source. The images are under [CC BY-NC-SA 4.0](LICENSES/CC-BY-NC-SA-4.0.txt). Commercial use outside those terms needs a separate licence: ask [wiiiimm](https://github.com/wiiiimm). The vendored agent skills keep their own licences. See [`LICENSING.md`](LICENSING.md), [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md).
