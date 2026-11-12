# PGD for React

`<PGDConsole>` puts the PGD-01 console in another React app, drives it from props and a ref, reports what happens on it, and loads games your app supplies (for example, games an AI harness writes). It installs straight from this repository.

```sh
npm install github:stealth-factory/portable-gaming-device#v0.15.0
```

Pin a release tag (or a commit). The install is this folder and the licences: no Astro, no native code, and no dependencies. React 18 or later is a peer dependency. pnpm, Yarn and Bun take the same `github:` spec.

```tsx
import { PGDConsole } from 'portable-gaming-device/react';

<PGDConsole src="https://pgd.example.com" game="dino-run" power />
```

## How it works

The console runs in an iframe from a PGD build, and the component talks to it through `postMessage`. The frame keeps the console's DOM, styles, sound and storage away from your app. Inline, the engine would take over the whole page: it finds the set's parts by id, sets attributes on `<html>` and styles `body`.

`src` is any PGD build: the live site, a Vercel preview, or a copy of `dist/` served under your own site (`src="/pgd"`). The component adds `?embed` to the address, which shows just the set and turns on the bridge (`src/console/embed.ts`).

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

**Who may insert disks.** A disk's code runs on the PGD site it's sent to. So the console takes disks only from its own origin, from `localhost`, and from the origins its build lists in `PUBLIC_PGD_EMBED_ORIGINS`. That list is comma-separated, and `https://*.example.com` matches subdomains:

```sh
PUBLIC_PGD_EMBED_ORIGINS="https://builder.example.com,https://*.vercel.app" npm run build
```

Everything else (props, state, events) works from any origin.

## The protocol

Everything goes through `postMessage` as `{ pgd: 1, type, … }`. The types (`PGDMessage`, `PGDCommandMessage`) are in [index.d.ts](index.d.ts), and `embedUrl()` and `isPGDMessage()` are exported for apps that make the iframe themselves. The console posts only to the page that framed it (the `origin` query parameter, or the referrer's origin), and it takes commands only from that window.

## Licence

PolyForm Noncommercial 1.0.0, like the rest of PGD: see [LICENSING.md](../LICENSING.md).
