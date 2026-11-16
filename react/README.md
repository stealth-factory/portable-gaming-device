# PGD for React

`<PGDConsole>` puts the PGD-01 console in another React app, drives it from props and a ref, reports what happens on it, and loads games your app supplies (for example, games an AI harness writes). It installs straight from this repository.

```sh
npm install github:stealth-factory/portable-gaming-device#v0.15.0
```

Pin a release tag (or a commit). The install is this folder, the `pgd-console` copy command and the licences: no Astro, no native code, and no dependencies. React 18 or later is a peer dependency. pnpm, Yarn and Bun take the same `github:` spec.

```tsx
import { PGDConsole } from 'portable-gaming-device/react';

<PGDConsole src="https://pgd.example.com" game="dino-run" power />
```

To serve the console from your own app instead of the PGD site, see [Self-hosting the console](#self-hosting-the-console). That is the way to go when your app inserts its own games.

## How it works

The console runs in an iframe from a PGD build, and the component talks to it through `postMessage`. The frame keeps the console's DOM, styles, sound and storage away from your app. Inline, the engine would take over the whole page: it finds the set's parts by id, sets attributes on `<html>` and styles `body`.

`src` is any PGD build: the live site, a Vercel preview, or the self-hosted console served by your own app (`src="/pgd/index.html"`, see below). The component adds `?embed` to the address, which shows just the set and turns on the bridge (`src/console/embed.ts`).

It renders on the server as a plain `<iframe>` and touches `window` only in effects, so it works in Next.js (the file is marked `'use client'`), Remix, Astro islands and Vite apps.

## Props

| Prop | What it does |
| --- | --- |
| `src` | Where a PGD build is served. Required. |
| `game` | A disk id or slug (`dino-run`, or one of your own disks) to boot straight into on the first power-on. Changing it later loads that disk with a warm boot. |
| `power` | `true` switches the set on, `false` off. Leave it out to let the player use POWER. |
| `lang` | `en`, `zh-hant` or `zh-hans`. |
| `phosphor` | `greenP1`, `greenP39`, `radarP7`, `amberP3`, `whiteP4`, `cga1` or `cga0`. |
| `sound` | The SOUND switch. |
| `paused` | HOLD: pause a game in progress, or carry on. `true` with no game running pauses the next one as it starts. |
| `disks` | Your own games, on the disk menu beside the console's (see below). |
| `nameplate` | Your own name or logo on the set's nameplate, in place of `PGD · PORTABLE GAMING DEVICE`, which also renames the console on the tube and the cabinet (see [Your own nameplate](#your-own-nameplate)). Leave it out for the PGD plate. |
| `splash` | Your own splash on the tube when the set is switched on: a name, a logo or both; `false` for none (see [Your own boot splash](#your-own-boot-splash)). Leave it out for PGD's own. |
| `chrome` | `true` also shows the page around the set: the header, the instructions bar and the leaflet. |
| `title`, `className`, `style` | For the iframe. Without a `height` in `style`, the frame takes the set's height on the desk layout, a 9:16 box (at most the screen's height) on the upright phone layout, and a 6:5 box on the others. Below 480 px wide the set switches to that upright phone layout, which fills whatever box it gets. |

## Data coming out

| Callback | When |
| --- | --- |
| `onReady(ready)` | The console has started: `version`, `session` (new on every reload), `disks` (each with `id`, `slug`, `title`, `genre`, `players`, and `added` for yours), `phosphors`, `langs`. |
| `onStateChange(state)` | Any of `power`, `mode`, `game`, `lang`, `phosphor` and `sound` changes, and `score`, `level` and `lives` at most four times a second. `mode` is one of `off`, `boot`, `menu`, `load`, `ready`, `play`, `dying`, `clear`, `paused`, `entry` and `over`. `game` is null on the boot screen and the menu. |
| `onEvent(name, data)` | Every event the console tracks, with the same names and fields as its analytics (the table in the [main README](../README.md#analytics): `game_load`, `game_start`, `game_over`, `high_score` …), plus `disk_inserted`, `disk_error`, `nameplate_error` and `splash_error`. |
| `onGameOver({ game, score })` | A game ended. |
| `onDiskError({ game, stage, message })` | One of your disks failed. `stage` is `insert` (a bad disk.js, a cover or preview that fails its checks, an origin that isn't allowed, or a `drawCover` or `drawPreview` that threw: the launcher then shows the floppy label), `load` (a bad game.js, no game sent, or `drawLoad` or `create` threw) or `run` (it threw while playing). After a `load` or `run` failure, the console goes back to the disk menu. Replacing the disk that is loading or playing also goes back to the menu, so the old code stops. |

## The ref

```tsx
const pgd = useRef<PGDConsoleHandle>(null);
<PGDConsole ref={pgd} src={SRC} />;

pgd.current?.load('bricks');  // also power(on?), reset(), menu(), focus()
pgd.current?.state;           // the latest PGDState
await pgd.current?.insertDisk({ disk, game }, { boot: true });
```

| Method | What it does |
| --- | --- |
| `power(on?)` | Switch the set on or off. With no argument, flip the switch. |
| `reset()` | RESET: the cold boot, then the disk menu. |
| `menu()` | SELECT: leave the game for the disk menu (a warm boot). |
| `load(game)` | Load a disk by id or slug, switching the set on if it's off. |
| `tap(button)` | Press a set button and let go at once. |
| `press(button)` | Press a set button and hold it. |
| `release(button)` | Let go of a button `press` held. |
| `insertDisk(disk, options?)` | Put a disk in the box. Resolves with it, rejects with the reason. |
| `send(command)` | Any bridge command (see [The protocol](#the-protocol)). |
| `focus()` | Give the frame keyboard focus. |
| `state`, `iframe` | The latest state, and the frame element. |

### Pressing the set's buttons

`button` is one of `PGDButton`:

| Name | Key | On the set |
| --- | --- | --- |
| `fire` | <kbd>Space</kbd>, <kbd>Z</kbd>, <kbd>X</kbd> | FIRE (reads SELECT on the menu and loads) |
| `boost` | <kbd>Shift</kbd>, <kbd>B</kbd> | BOOST (a game may relabel it, e.g. NUKE) |
| `fireL` | <kbd>Z</kbd> | Left bomb bay (I Invade only; dark elsewhere) |
| `fireR` | <kbd>V</kbd> | Right bomb bay (I Invade only; dark elsewhere) |
| `pad1` to `pad6` | arrows, <kbd>Z X C</kbd>, <kbd>A S D</kbd> | The button pad on a game with `controls: 'pad'`; dark elsewhere |

A button a game doesn't map is dark, so the press does nothing. A press on FIRE, or on a tap, acts exactly as a finger would. Holding works for any button. Taps release themselves after about 80 ms, so a hold-to-fire game sees a press without a release only if you call `press` and forget `release`: always pair them.

```tsx
const pgd = useRef<PGDConsoleHandle>(null);

pgd.current?.power(true);       // switch on
pgd.current?.load('invader-force');
pgd.current?.tap('fire');       // one shot, or FIRE on the menu
pgd.current?.press('boost');    // hold SHIELD
pgd.current?.release('boost');
pgd.current?.reset();           // RESET: cold boot
pgd.current?.menu();            // SELECT: back to the disk menu
```

The same things through `send`, as the protocol sees them:

```ts
pgd.current?.send({ command: 'button', button: 'fire' });                 // tap
pgd.current?.send({ command: 'button', button: 'fire', down: true });    // hold
pgd.current?.send({ command: 'button', button: 'fire', down: false });   // release
```

`focus()` gives the frame keyboard focus, which the arrow keys, Space and the rest need. A click or tap on the set focuses it too.

## Your own games

A disk has the same two parts as a `.pgdisk` file ([tools/disks/README.md](../tools/disks/README.md)):

- **disk.js** is a plain script that defines `PGDDisk`, where `PGDDisk.disk` is the disk. It needs at least `id` (lower case, digits and hyphens) and `drawLoad(api, p, t)`, the loading screen. Every other `GameDisk` field (`src/games/types.ts`) is optional: the console fills in the title, load time and buttons, sets the genre to `CUSTOM`, and gives it an empty leaflet.
- **game.js** is a plain script that defines `PGDGame`, where `PGDGame.create(api)` returns `{ start, update, draw }`, as a disk's `game.ts` does.

A built `.pgdisk` file works too: `{ pgdisk: bytes }`.

```tsx
const disks = useMemo(() => [{
  disk: `var PGDDisk = { disk: { id: 'ai-dodge', title: 'AI Dodge', drawLoad(api, p, t) { api.txt('AI DODGE', api.LW / 2, 60, 'text', 'center', 16); api.diskInfo(110, p, t, this); } } };`,
  // a string, or a function the console calls when the player loads the disk (it waits while the drive reads)
  game: async id => (await fetch(`/api/games/${id}/game.js`)).text(),
}], []);

<PGDConsole src={SRC} disks={disks} power />
```

Your disks go on the disk menu with the console's own, and the player picks one like any other. When it's picked, the console fetches the game: the `game` string, or the answer from your `game` function, which gets about 20 seconds. Sending a disk with the same `id` again replaces it, so a harness can iterate. The component sends a disk again only when its sources change, so a new array holding the same disks sends nothing. A reload of the frame starts with only the console's own disks, and the component sends yours again.

Games follow the console's rules: draw only through `api`, use the four palette roles, use no browser globals, and keep loads under 5 seconds. The [developer guide](../docs/developer-guide.md) covers writing one: the `api`, buttons, sound, scores and every disk field, with a whole example game.

**Who may insert disks.** A disk's code runs on the site that serves the console. So the console takes disks only from its own origin, from `localhost`, and from the origins its build lists in `PUBLIC_PGD_EMBED_ORIGINS`. Self-host the console and your app *is* its origin, so none of this needs setting up. Framing the PGD site (or your own build of it) from another origin needs that origin in the list, comma-separated, where `https://*.example.com` matches subdomains:

```sh
PUBLIC_PGD_EMBED_ORIGINS="https://builder.example.com,https://*.vercel.app" npm run build
```

Everything else (props, state, events) works from any origin.

## Your own nameplate

The silver badge on the set reads `PGD · PORTABLE GAMING DEVICE`, over a `PGD-01 · GREEN P1` line that follows the phosphor dial. Your app can put its own name or logo there:

```tsx
<PGDConsole src={SRC} nameplate="RETROBOX" />
<PGDConsole src={SRC} nameplate={{ text: 'RETROBOX', rest: 'GAME STUDIO', model: 'RBX-01' }} />
<PGDConsole src={SRC} nameplate={{ image: '/brand/plate.svg', alt: 'Retrobox' }} />
```

| Field | What it does |
| --- | --- |
| `text` | The name, in the plate's bold capitals (up to 24 characters). A string `nameplate` is this. |
| `rest` | More of the name, after a dot, as `PORTABLE GAMING DEVICE` follows `PGD` (up to 48 characters). Hidden on the upright phone layout, where the plate is small. |
| `image` | A logo to show instead of the text: an `http(s)` address, a path on the console's site (`/…`, `./…`), or a `data:image/…` URL. It is fitted to the plate's height (14 px on the desk, 10 px on phones and the sideways layout), so a wide, short wordmark in dark ink on the silver plate works best. Anything else is refused: the PGD plate stays and the console sends a `nameplate_error` event. An image that fails to load (a 404, bad data) also sends `nameplate_error`, and the plate falls back to its `text`, or to PGD without one. |
| `alt` | The logo's accessible name. Defaults to `text`. |
| `model` | The model code in front of the phosphor name on the line under the plate, and everywhere else the console names its model (below). Default `PGD-01`. |

The plate is sent when the console is ready and again whenever the prop's content changes; setting it back to `undefined` or `null` puts the PGD plate back. A path in `image` is on the console's site, so with a [self-hosted console](#self-hosting-the-console) it is your app's own `public/` folder. Without the component, send `{ command: 'nameplate', nameplate }` over the protocol.

The plate names the whole console, so a framed console carries your brand wherever it says its own name. With `{ text: 'RETROBOX', rest: 'GAME STUDIO', model: 'RBX-01' }`:

| Where | PGD | Yours |
| --- | --- | --- |
| BIOS banner | `PGD-01 GAMING DEVICE   BIOS 1.0` | `RBX-01 RETROBOX   BIOS 1.0` |
| The boot starting | `STARTING PGD-DOS...` | `STARTING RETROBOX-DOS...` (the name's letters and digits, up to 8) |
| Disk menu header | `PGD-01 PORTABLE GAMING DEVICE` | `RBX-01 RETROBOX GAME STUDIO` (shortened with `..` if it won't fit) |
| Cabinet stamp under the tube | `PGD-01 · 12″ PHOSPHOR MONITOR` | `RBX-01 · 12″ PHOSPHOR MONITOR` |
| Burnt-in title on the tube | `PGD-01` | `RBX-01` |
| Leaflet's model line (`chrome`) | `Model PGD-01 · 12″ phosphor monitor` | `Model RBX-01 · 12″ phosphor monitor` |

A logo with no `text` names the console by its `alt`; a plate with only a `model` keeps PGD's words with your model code. The release version under the plate stays as it is, and so do the games' own titles.

The nameplate arrives in v0.19.0, and the boot splash and the rest of the branding in the release after it: pin that tag or later (an older console ignores the commands). On the PGD site, which works offline, an `https` logo from another site is cached once it has loaded (up to ten logos, for 30 days); a self-hosted console has no service worker, so a logo there is fetched like any other image on your page.

## Your own boot splash

When the set is switched on (or RESET), the tube shows a splash for about two seconds before the BIOS lines: PGD's own is its name in the console's chunky pixel letters, drawn in by the beam from the top, with `PORTABLE GAMING DEVICE` typed under it and a short rising chime. Your app can show its own, or none:

```tsx
<PGDConsole src={SRC} splash="RETROBOX" />
<PGDConsole src={SRC} splash={{ text: 'RETROBOX', sub: 'GAME STUDIO' }} />
<PGDConsole src={SRC} splash={{ image: '/brand/splash.png', sub: 'GAME STUDIO' }} />
<PGDConsole src={SRC} splash={false} />
```

| Field | What it does |
| --- | --- |
| `text` | The big line, in the tube's 16 px capitals (8 px if it won't fit), up to 24 characters. A string `splash` is this. |
| `sub` | A smaller line typed in under it, up to 48 characters. |
| `image` | A logo above the text: an `http(s)` address, a path on the console's site, or a `data:image/…` URL, fitted within 160 × 64 tube pixels. Like everything on the tube, it is drawn in the phosphor's four shades by brightness: light parts glow, dark and transparent parts stay dark, so a light logo on a dark or transparent background works best. An image on another site must be served with CORS (`Access-Control-Allow-Origin`), or the console can't read it. A bad address, or an image that won't load, sends `splash_error`; the splash then keeps its `text`, or goes back to PGD's without one. |
| `invert` | `true` flips a dark-on-light logo, so its ink glows. |

FIRE, <kbd>Space</kbd>, <kbd>Enter</kbd> or a tap on the tube skips the splash (after a quarter of a second, so the press that switched the set on doesn't). With reduced motion it appears whole, without the beam or the typing. A warm boot (back to the menu, or `load` while the set is on) never shows it. The splash goes with the boot's sounds, which start when it ends. `false` goes straight to the BIOS, as before this option existed; `null` or leaving the prop out shows PGD's. Without the component, send `{ command: 'splash', splash }`.

## Self-hosting the console

A console tag ships a built console with the component: one page, its scripts and two icons (about 800 KB, no service worker, no analytics). Copy it into your app's static folder and the console is served from your own origin, so it takes your app's disks with no settings, works offline in development, and moves with your deploys.

```sh
npm install github:stealth-factory/portable-gaming-device#console-v0.15.0
npx pgd-console public/pgd
```

```tsx
<PGDConsole src="/pgd/index.html" disks={disks} power />
```

- **Which tag.** `console-vX.Y.Z` is release `vX.Y.Z` plus the built console. A plain `vX.Y.Z` tag has the component but no console, and `pgd-console` says so. The `console` branch follows the latest release, and `console-main` is main's latest, when someone has built it.
- **Where it goes.** `pgd-console <folder> [--base /path/]` copies the console into a folder of its own and rewrites its paths for the address your app serves that folder at (`/pgd/` by default). `npx pgd-console public/games/pgd --base /games/pgd/` serves it at `/games/pgd/`. It replaces an earlier copy, and refuses a folder that holds anything else.
- **Keep it in step.** Run the copy whenever you install a new tag, for example from your scripts: `"predev": "pgd-console public/pgd"`, `"prebuild": "pgd-console public/pgd"`. You can also commit the copy, or leave it out of git (`public/pgd/` in `.gitignore`) and let the scripts make it.
- **Point at the page.** Use `src="/pgd/index.html"`, not `/pgd/`: Next.js serves `public/` files but not a folder's `index.html`, and a Vite dev server answers an unknown folder with your own app.
- **In a monorepo**, run it from the app that serves the files (`apps/builder`), so `public/` is that app's.

A copy of the console is a copy of PGD under its licence ([LICENSING.md](../LICENSING.md)): fine for non-commercial use, and the owner licenses commercial use.

## The protocol

Everything goes through `postMessage` as `{ pgd: 1, type, … }`. The commands are power, reset, menu, button, load, phosphor, lang, sound, pause, nameplate, splash, insert and game. The types (`PGDMessage`, `PGDCommandMessage`) are in [index.d.ts](index.d.ts), and `embedUrl()` and `isPGDMessage()` are exported for apps that make the iframe themselves. The console posts only to the page that framed it (the `origin` query parameter, or the referrer's origin), and it takes commands only from that window.

## Licence

PolyForm Noncommercial 1.0.0, like the rest of PGD: see [LICENSING.md](../LICENSING.md).
