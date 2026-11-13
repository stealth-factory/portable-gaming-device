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
| `chrome` | `true` also shows the page around the set: the header, the instructions bar and the leaflet. |
| `title`, `className`, `style` | For the iframe. Without a `height` in `style`, the frame takes the set's height on the desk layout, a 9:16 box (at most the screen's height) on the upright phone layout, and a 6:5 box on the others. Below 480 px wide the set switches to that upright phone layout, which fills whatever box it gets. |

## Data coming out

| Callback | When |
| --- | --- |
| `onReady(ready)` | The console has started: `version`, `session` (new on every reload), `disks` (each with `id`, `slug`, `title`, `genre`, `players`, and `added` for yours), `phosphors`, `langs`. |
| `onStateChange(state)` | Any of `power`, `mode`, `game`, `lang`, `phosphor` and `sound` changes, and `score`, `level` and `lives` at most four times a second. `mode` is one of `off`, `boot`, `menu`, `load`, `ready`, `play`, `dying`, `clear`, `paused`, `entry` and `over`. `game` is null on the boot screen and the menu. |
| `onEvent(name, data)` | Every event the console tracks, with the same names and fields as its analytics (the table in the [main README](../README.md#analytics): `game_load`, `game_start`, `game_over`, `high_score` …), plus `disk_inserted` and `disk_error`. |
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

Everything goes through `postMessage` as `{ pgd: 1, type, … }`. The types (`PGDMessage`, `PGDCommandMessage`) are in [index.d.ts](index.d.ts), and `embedUrl()` and `isPGDMessage()` are exported for apps that make the iframe themselves. The console posts only to the page that framed it (the `origin` query parameter, or the referrer's origin), and it takes commands only from that window.

## Licence

PolyForm Noncommercial 1.0.0, like the rest of PGD: see [LICENSING.md](../LICENSING.md).
