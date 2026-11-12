# AGENTS.md: PGD (Portable Gaming Device)

Notes for anyone (human or agent) working in this repo. Read this before changing anything.

## Linear

- **Project:** Game Guy (the console's name in Linear until the project is renamed), <https://linear.app/stealth-company/project/game-guy-c4e01570fc18/overview>
- **Team:** Game Guy (key `GAM`, under Stealth Factory), <https://linear.app/stealth-company/team/GAM/overview>
- **Issue IDs:** `GAM-<n>`, for example [GAM-11](https://linear.app/stealth-company/issue/GAM-11). Use that form in branches, PR titles and commits.
- **Old `WII-<n>` IDs:** until 2026-11-09 the issues lived in the wiiiimm team as `WII-<n>`. They were moved and renumbered (WII-45 is now GAM-1, for example), and the old IDs in past PR titles, commits and `CHANGELOG.md` still redirect to the new issues. Leave them as they are; use `GAM` for anything new.
- **Statuses:** Triage, Backlog, Todo, Paused, In Progress, In Review, Ready to Merge, Released, Canceled, Duplicate.
- **Specs and plans** are Linear project documents or issue descriptions, never files in this repo.
- The Linear GitHub integration is on: it links a PR to the issue named in its branch or title and comments the link back on the PR.

**Everything is tracked in Linear:** planned features, bugs, specs and the decisions waiting on the owner. Before starting anything, look for the issue; before proposing something, check it is not already filed, and not already decided against. How work moves between Linear and GitHub is under [Linear and pull requests](#linear-and-pull-requests).

## Never push to `main`

Every change goes through a pull request, unless the owner explicitly says to push that specific change to `main`; permission for one change is not permission for the next. The owner's account can bypass branch protection, so a push to `main` *succeeds*: a `Changes must be made through a pull request` line from GitHub is a bypass warning, not a rejection. To stay off it:

- create branches with `--no-track` (`git switch --no-track -c <branch> origin/main`, or `git worktree add --no-track -b <branch> <path> origin/main`), or point the upstream at the branch itself;
- push only with an explicit refspec: `git push -u origin HEAD:refs/heads/<branch>`. Never `git push origin main`, never a bare `git push` from a branch tracking `main`, never `--force` to `main`;
- note `main`'s SHA (`git ls-remote origin refs/heads/main`) just before every push, run the same command after it, and check `main` did not move. If it did, stop and tell the owner. Do not "fix" it with another push to `main`; revert through a pull request.

## What this is

**PGD-01 Portable Gaming Device** (PGD for short; called Game Guy 3000 Deluxe until 11 November 2026) is a browser game console: one old CRT monitor that boots, shows a game loader, and runs several games. It starts as a copy of [Tunnel Raider](https://github.com/wiiiimm/tunnel-raider), which is still its own repo and site (`tunnel-raider.wiiiimm.codes`); changes made here do not flow back to it.

Requirements 1 to 12 below are built: the console boots into a disk menu with six games, Tunnel Raider, Dino Run, Invader Force, I Invade, Bricks and Martian Storm, and each game has its own page. The SELECT button is built but **hidden for now** (owner's call: with the menu one RESET away it duplicates RESET). The <kbd>G</kbd> key still does SELECT.

## Requirements (from the owner)

### 1. Boot into a game loader

- Switching the set on (POWER) or pressing RESET runs the cold boot (BIOS memory test, POST beep, floppy drive) and then lands in a **game loader interface**, not straight into a game.
- The loader is the console's home screen. It lists the games and lets the player pick one to load.
- **The launcher (GAM-32, owner's pick: concept B, the cover carousel):** the front disk's cover large in the middle with its label strip (title, file and size) and details lines under it, neighbours either side (smaller and dimmer), a numbered tick strip and an `nn/NN` counter. Tiers by tube shape: wide (two neighbours a side, three details lines), portrait (tall front cover, one neighbour a side cropped at the edges), short (one neighbour a side, one details line, plain ticks). Moves are hard cuts with a tick and a two-step drive seek. A tap on a side cover or tick brings that disk to the front; a tap on the front cover loads it. Covers come from `drawCover`, `cover.ts` (captured), or a floppy label; after 0.8 s on a disk (never with reduced motion) the cover gives way to `drawPreview` or the `preview.ts` flipbook (owner's call pending: flipbooks first). The [Launcher design spec](https://linear.app/stealth-company/document/launcher-design-spec-gam-32-06221211fc3a) and [Web launcher build spec](https://linear.app/stealth-company/document/web-launcher-build-spec-gam-32-88a4c25140c8) are Linear documents on GAM-32.
- **The launcher changes only the tube.** The console's physical controls, their layout and their labels stay as they are: FIRE reads SELECT and loads, BOOST stays dark. The old list stays behind `?menu=list` until GAM-52 removes it.
- It must work with every existing control: joystick, arrow keys and WASD, FIRE / <kbd>Space</kbd> / <kbd>Enter</kbd>, and tapping the screen.

### 2. Every game gets its own themed loading screen

- Loading a game from the loader shows a **loading screen themed to that game**: its own title art, wording, colours within the phosphor palette, and progress style. Tunnel Raider's current `LOADING TUNNEL.EXE` sector bar is the model for one of them.

### 3. Loading sounds

- Every game load plays **disk loading sounds**: drive motor spin-up, head recalibrating, track-by-track head clicks, head parking. Reuse and extend the synthesised floppy sounds in `playBoot()`, `noise()` and `headClick()` (Web Audio, no audio files).
- The sound has to match the length of that game's load, so the drive stops when the bar finishes.

### 4. Load times differ per game, up to 5 seconds

- Each game has its own load duration. **No load may take longer than 5 seconds.**
- Durations differ between games (for example a small game loads in about 1.5 s, a big one in close to 5 s), and the bar fills in fits and starts like sectors coming off a disk rather than smoothly.

### 5. Every game has its own instruction menu

- Each game ships its own **Operating Instructions**: how to play, controls, scoring and how it gets harder, in English, Traditional Chinese and Simplified Chinese.
- The instructions shown match the game that is loaded. In the loader they cover the console itself (picking and loading a game, POWER, RESET, the switches and dial).
- Tunnel Raider's current manual (the `#manual` leaflet with its `I18N` strings) becomes that game's instructions; each new game adds its own in the same style.

### 6. Brand the console as PGD

- **The name (owner's call, 11 November 2026, GAM-55):** **PGD-01 Portable Gaming Device**, **PGD** for short, model code `PGD-01`. PGD is meant to sound generic: it's the open console shell that other things build on, like a standard, not a product brand. Until then the console was *Game Guy 3000 Deluxe* (`GG-3000 DX`); before that, Tunnel Raider (`TR-83`). The repo was renamed from `game-guy` to `portable-gaming-device` the same day, then moved from `wiiiimm` to the `stealth-factory` organisation (<https://github.com/stealth-factory/portable-gaming-device>, GAM-61; the old URLs redirect). Past PR titles, commits and `CHANGELOG.md` entries keep the old name.
- The look stays nerdy and retro, a 1983 home console.
- Where the name appears:
  - **Page header:** wordmark (`PGD-01 Portable Gaming Device`, `Header.tsx`) and the model badge (`.mk-model`, `MODEL` in `src/components/site.ts`), with the tagline beside it.
  - **Nameplate on the set:** `PGD · PORTABLE GAMING DEVICE` (`Nameplate.tsx`, the long part in `.np-rest`, hidden on upright phones) with the `PGD-01 · <phosphor>` line set by `setMode()`.
  - **On the tube:** the BIOS banner (`PGD-01 GAMING DEVICE   BIOS 1.0`) and `STARTING PGD-DOS...` in `src/console/boot.ts`, the launcher header (`src/console/launcher/draw.ts`), the old list menu (`program/loader.ts`) and the burnt-in title (`buildBurn()` in `core.ts`).
  - **Instructions:** the `model` and `diskFor` strings in `src/console/strings.ts`, all three languages.
  - **App identity:** `<title>`, `apple-mobile-web-app-title` (`PGD`), share tags and images (`tools/share-images/make.cjs`), the PWA manifest name and short name (`astro.config.mjs`), each disk's page description, README.
  - **Icons:** the app icons carry a silver `PGD` plate under the tube, and the favicon's tube spells PGD in 3 × 5 pixel letters (GAM-58). All of them come from `tools/icons/make.cjs`; edit the drawing there and re-run it, never the PNGs or the ICO.
- **Kept on purpose:** storage keys (`gg-best-<id>`, `gg-board-<id>`, `gg-name` and the rest), the `gg:settings` event and the `__gg` test hook keep their `gg` prefix, so nobody loses their scores or settings.
- Game names (Tunnel Raider and the rest) appear only inside their own game: its loading screen, instructions and title.

### 7. A SELECT button beside RESET

- Add a **SELECT** button next to RESET on the set, labelled `SELECT` in the same style as the RESET label.
- **Colours:** SELECT takes RESET's current look (the dark graphite key, `.resetbtn`). RESET becomes **dark wine red**, so it reads as the dangerous one.
- **What it does:** pressing SELECT leaves the current game and goes back to the game loader, replaying the boot-up and disk loading sounds on the way (the same kind as `playBoot()`), much as RESET replays the cold boot today.
- It does nothing with the set switched off, like RESET.
- It needs a place in every layout (`desk`, `console`, tall console, `phone-portrait`, `tablet-portrait`), sitting with RESET beside POWER.
- **RESET vs SELECT:** RESET reboots the whole console (BIOS, then the loader); SELECT just swaps the game, through the loader.
- Add a keyboard shortcut for it, and an analytics event (for example `select` with the game left and its level).
- **Status:** hidden. `PowerPanel` in `src/components/PowerPanel.tsx` takes `showSelect`; pass it from `ConsoleSet` to bring the button back (and add SELECT back to the console strings). The nameplate on an upright phone shows just `PGD` (`.np-rest` hidden), since the full name would run into RESET. Every layout stamps the release version (`VERSION` in `src/components/site.ts`, read from `package.json`) on its own line under the plate, including phone landscape, where the plate sits on the right in the middle.

### 8. Dino Run, with its own high-score table

- The loader's second game: an original endless desert runner in the spirit of Google Chrome's offline dinosaur game. Jump cacti and boulders, duck pterosaurs. The dinosaur, obstacles, art, sound and code are original; never copy Chrome's sprites.
- It has its own top-ten table and name entry, like Tunnel Raider.

### 9. Invader Force

- The third disk: a fixed-screen alien shooter that plays like Taito's Space Invaders (1978). A formation of six rows (one more every two waves, up to eight, fewer if the tube is short) marches, drops a row at each edge and speeds up as it thins. One shot in the air at a time. Crumbling walls, a mystery saucer, extra cannon every 1,500, and waves that start lower each time.
- Original aliens (jelly, beetle, drone), cannon, saucer, sounds and code. Never reproduce Taito's invader sprites, the 👾 emoji's artwork, or any open-source remake's code or assets.
- BOOST is a short SHIELD that blocks bombs, then recharges; taps on the screen fire (`tap: true` on the disk).
- **Capsules (owner's design):** shot-down aliens sometimes drop a capsule and the saucer always does. Catching one gives a 12-second weapon (Twin, Spread, Rapid, or Pierce: a lightning laser up the column), lost when hit; or a shot-speed boost that stacks up to five times and resets its 60-second clock on each catch; or, very rarely, an atomic bomb that relabels BOOST as NUKE (`api.setButtons({ boost: { label: 'nuke' } })`) and launches a missile that wipes out three or four whole rows where it hits. A bomb that hits a capsule sets it off in a wide blast that can take your cannon; shooting a capsule sets off the same blast but spares you; your shot meeting a bomb sets off a smaller blast that spares you. Rules live in `src/games/invader-force/weapons.ts` (unit-tested).

### 10. I Invade

- The fourth disk: the fixed-screen alien shooter played from the other side, after the owner's brief and direction (GAM-24). The fleet starts at the bottom of the screen and attacks upward; the tanks hold the top (GAM-23). **No steering:** the fleet marches on its own, side to side, a row closer at each edge and faster as it thins. The player only picks which of the three bomb bays fires, and when (the outermost columns and the one nearest the fleet's middle, lit along its front): aiming is timing. Everything the fleet throws goes up.
- **No joystick:** the disk sets `controls: 'pad'`, so while it plays (`ready`, `play`, `dying`, `clear`, `paused`) the stick's zone holds a button pad (`pad1`…`pad6`, two rows of three: ◀ ▲ ▶ bays on top, CLUSTER and METEORS underneath, sixth unused) and FIRE's row steps aside. On the sideways console layout only (`data-layout="console"`, short, tall and full screen) the three red bays sit on the right with CLUSTER under them, and UFO sits above METEORS on the left. Desk and the portrait layouts keep the two-row pad. Keys: <kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> or <kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> for the bays, <kbd>Space</kbd> (FIRE, labelled BOMB) for the middle one, <kbd>A</kbd> cluster, <kbd>S</kbd> meteors, <kbd>Shift</kbd> (BOOST, labelled UFO) the UFO. A tap on the screen fires the nearest bay (`api.tapX`). The stick is back for the console's own screens.
- **The brief's rules:** one fleet a game, no spares (a fresh formation each wave; lose every alien and the invasion is repelled). Tanks have three lives: a knocked-out tank is gone for 1.4 s, then rolls back in blinking and untouchable for 1.2 s. Teams per wave `[1, 1, 2, 3, 3, 4, 5, 6]`, holding at 6. Scoring: hit a tank 100, destroy one 300, every tank destroyed 20 per alien left, touchdown 500 + 20 per alien left.
- **Weapons:** bombs (one in the air per bay, two from wave 6, 0.3 s apart); the cluster sweep (the earth-facing alien in each column, the lowest row index still alive, so a damaged column can fire from a different row: one shot at a time, left to right then right to left, for about 3 s; armed 2.5 s into a wave, then the button stays dark for another 7 s); the UFO carpet (crosses under the fleet, a bomb up every 0.3 s, 12 s recharge, starts half charged, shells through a gap bring it down); the meteor swarm (18 rocks from below the fleet, charged by other weapons' hits and a slow trickle, a bar under the score).
- **Tanks:** `skill` 0 on wave 1 to 1 by wave 6, then only reload shortens. They dodge what's coming up (probabilistically), lead the march when they aim, fire one shell each (a shell knocks out a bomb or a cluster shot and carries on), hunt the bay that fired last, keep 16 px apart, and fire through their own walls when every column left is behind one.
- **Tuning:** `tools/autopilot/i-invade.mjs` plays the game headless (do-nothing, spam-every-bay and timing bots) on desk, phone portrait and phone landscape sizes and prints the waves reached. Targets: a do-nothing fleet is repelled in about 90 s without landing; spamming clears the early waves then thins out; a timing bot is repelled around wave 5 to 8.
- Original fleet (crown, puffer, pod), tanks, UFO, sounds and code.

### 11. Bricks

- The fifth disk: an original one-bat brick game (GAM-28). Move a bat along the bottom, serve one ember into a wall, and clear every breakable brick. There is no second bat and no opponent. The name on the menu, the page and the tube is Bricks.
- Five brick types. Clay breaks in one hit. Kiln cracks, then shatters. Glass breaks and lets the ember through. Cinder takes one neighbouring clay and does not chain. Anvils bounce the ember and never break, so a wave can clear while they remain. No second ember, and BOOST stays dark.
- Some broken bricks (never an anvil) drop one capsule. The bat catches it; a miss loses it. Broad and Slim set the bat to about 1.5× and 0.6× its width, Flare and Damp set the ember to about 1.35× and 0.75× the wave speed, and a new size or speed replaces the last. Both are lost when the ember is missed. Sear hits the next three breakable bricks without a bounce: leaving a brick spends one charge, an anvil always bounces and spends nothing, and glass still breaks with no bounce and spends nothing.
- Up bows the middle of the bat up and down bows it the other way, like a rubber ruler. The curved face changes the ember's leaving angle. Left and right still slide the whole bat. The bow eases back when up and down are released. A tap does not steer.
- The ember does not auto-serve. FIRE, Space, Enter or a tap serves it off the bat; the same controls do nothing while it is in the air. A miss loses a bat and leaves the wall as it was. Three bats, another every 2,000, up to six. Clearing a wall scores 100 times the wave.
- Walls are generated, never drawn by hand. Wave 1 is clay and empty slots only. Rules live in `src/games/bricks/rules.ts` (unit-tested). The leaflet's about line is the only place a commercial brick game is named.
- Original bat, ember, bricks, art, sound and code.

### 12. Martian Storm

- The sixth disk: an original vertical shooter (GAM-46). Fly a skiff up through a Martian dust storm, shoot the aliens that come down, and spend a limited tuck on BOOST to slip through a tight spot. The name on the menu, the page and the tube is Martian Storm. No year appears there.
- Eight legs, counted upward. Leg 1 is the easiest. The dust scrolls for 24 seconds. Spores fly in fours and do not shoot; the third spore shot from a flight drops one weapon capsule, unless one is already falling (GAM-60: shooting all four was too rare). Barbs take three shots (a missile counts as two) and fire one pellet, aimed once, not homing. Slabs, from leg 3, take fourteen shots, stop shots and always drop a pickup. Four barbs in five drop one, a weapon capsule most often.
- **Weapons (owner's brief, GAM-59):** the Blaster (the start, one shot, never on a capsule) and four guns at level 1 to 3: Spread (up to a seven-way fan), Laser (beams through spores and barbs; slabs stop them), Missile (the blaster plus homing missiles from the pods) and Wave (weaving shots). A capsule flashes S, L, M, W. **Guns stack (owner's call, GAM-60):** a gun you don't have joins the ones you do and they all fire together, each on its own clock; a gun you have goes up a level (200 at level 3). The HUD badge reads `BLAST`, or each gun's letter and level (`S3L1M2`, no gaps, so all four guns fit beside TUCK and the lives on a 240 px tube). Researched against the classics: 1942 and Raiden keep power-ups until a life is lost, 1943 runs them on a clock. Martian Storm follows 1942 and Raiden: the stack is kept until the skiff is lost, then back to the Blaster. Up to 120 of the skiff's shots in the air at once.
- **Speed (GAM-60):** a SPEED pickup (two chevrons) adds a level, up to three: 80, 100, 120, 140 px/s. Kept until the skiff is lost. Chevrons after the hearts show the level.
- **Bombs (GAM-60):** the `fireR` slot beside FIRE, labelled BOMB, or <kbd>V</kbd>. Two per skiff, up to five, from BOMB pickups; the key goes dark at none. One press: every spore and barb on screen is destroyed (scored, and spores count towards their flight's capsule), all pellets go and keep going for 0.6 s, slabs (and later bosses) take 8 damage, and the skiff can't be hurt while the rings spread. Bombs left show after the hearts.
- **Hearts:** three per skiff, up to five. A shot or a ram costs one heart (a ram also wrecks a spore or barb for no points) and gives 1.4 s of blinking safety. The last heart loses the skiff; the next skiff has three hearts.
- **Lives:** three skiffs at the start, up to nine: one more for each leg cleared, every 5,000 points, and from a 1UP pickup. The last skiff shows `DUSTED`.
- **Tucks:** at least three at the start of each leg; extra ones caught carry over (owner's call, GAM-60: nothing the skiff holds is cleared between legs, only by losing the skiff). A death on that leg keeps whatever is left. A tuck lasts 0.6 seconds: the hitbox is off, the guns are silent, and the skiff is back where the tuck started. Holding BOOST does not chain. A tuck pickup adds one, up to five. Pickups the skiff cannot hold score 200. Barbs drop: life 5%, heart 15%, tuck 8%, speed 10%, bomb 7%, capsule 35%, nothing 20%. Slabs: life 12%, heart 20%, speed 14%, bomb 12%, capsule 42%.
- The keyboard can hold a diagonal (scaled so it is not faster). The on-screen stick stays the console's 4-way stick.
- **Between legs (GAM-60):** no landing pad. Through `LEG CLEARED` the skiff glides to the bottom centre while the dust speeds up to 560 px/s and stretches into streaks with a rising whoosh, then it slows back to the new leg's pace through `READY`. Guns, speed, bombs, hearts and tucks all carry over.
- Clearing leg 8 lands on a pad with `GROUNDED`, then the console's card. Both endings use `STORM OVER`. Legs 1 to 7 use the kit's clear; leg 8 does not, because that helper would start another leg.
- Load is 3.8 seconds. Rules live in `src/games/martian-storm/rules.ts` (unit-tested). The leaflet's about line is the only place the reference shooter is named.
- Original skiff, spores, barbs, slabs, art, sound and code. Escorts, bosses (the bomb already does them damage), a longer route and an 8-way stick are later work.

## Stack (decided)

**Astro + React components + a plain TypeScript console engine on Canvas 2D.** No game engine: the picture comes from the console's own four-colour quantiser and phosphor pass, which an engine's renderer would fight.

- **Astro:** builds static pages: the console (`/`) and one page per game (`/<slug>`, booting straight into that disk). `build.format: 'file'` plus `vercel.json` `cleanUrls`.
- **React (owner's choice, for reusable components):**
  - **The set's hardware and the page chrome:** React components rendered to static HTML at build time, with no hydration. The engine finds them by id and drives them.
  - **The instructions leaflet:** the one live island (`client:load`). It reads the engine's state through `src/console/bus.ts`.
  - **Rule:** don't let React re-render anything the engine mutates. To make a component live, move its state into the bus first.
- **Offline:** `@vite-pwa/astro` (Workbox `generateSW`, `registerType: 'prompt'`, registered immediately). It precaches every built file by content hash, including each game's lazily loaded code.
- **Analytics:** `@vercel/analytics` (`inject()` in `main.ts`, `track()` through the console's helper).
- **Tests:** Vitest (`tests/unit`: disk rules and the plug-in rule) and Playwright scripts (`tests/flow.cjs`, `tests/pages.cjs`, `tests/stick.cjs`, `tests/haptics.cjs`) against `npm run preview`.
- **Deploy:** Vercel's Astro preset, `npm run build` → `dist`.
- **Releases (decided):** pooled release with production gated by a Promotion Branch. Production branch `production`, platform Vercel. Merges to `main` deploy previews and update one standing `release: vX.Y.Z` PR; merging that PR tags the version and fast-forwards `production`, which Vercel ships. The iOS app ships with the same release through `testflight.yml`: merges to `main` go to internal TestFlight testers, the release tag to external testers and Beta App Review. See [docs/releasing.md](docs/releasing.md).
- **Types:** `tsconfig.json` is `strict` (and `noImplicitAny`) for everything `npm run typecheck` covers: `src` and `tests`. A strict error anywhere fails that check. `tsconfig.kit.json` still typechecks the kit on its own; it is the same `strict` rules, not a looser set for the rest of the project. The console's state bag (`api.S`) stays `any`: each game owns its fields, and the kit names the ones it shares.

## Where things are now

| Path | What it is |
| --- | --- |
| `src/pages/index.astro`, `src/pages/[slug].astro` | The console page, and one page per game |
| `src/layouts/ConsoleLayout.astro` | Head and share tags, the inline layout detector, the set, the leaflet |
| `src/components/` | React components (static): `ConsoleSet` and its parts, `Header`, `ManualBar`, `NetBadge`; `Manual.tsx` is the live island |
| `src/main.ts` | Engine entry: console, PWA, analytics |
| `src/console/core.ts` | CRT picture pipeline, input, switches, the game loop, and the `api` games get |
| `src/console/program/` | The console program, being split out of `core.ts` (GAM-39 part 1): DOM-free, so the native apps can run it as the system disk. `platform.ts` is the `Platform` interface, everything it asks of the machine (clock, storage, sound, cards, analytics); `loader.ts` is the boot screens, disk menu, loading screens, drive timing and SELECT; `scores.ts` is each game's best and top-ten table over the Platform's store; `entry.ts` is name entry, the score table and the attract loop; `host.ts` is the console state still in `core.ts`, bound by core. `tests/unit/program-rules.test.ts` fails if a file here names a browser global or imports the web console |
| `src/console/web/` | The browser's `Platform` (`platform.ts`) and Web Audio sound (`audio.ts`: tones, `motor`, head `click`, `hush`) |
| `src/console/i18n.ts` | Every string (base table plus console and disk strings), no side effects |
| `src/console/strings.ts`, `manual.ts` | The console's own strings and instructions |
| `src/console/bus.ts` | Tiny store shared by the engine and React islands (language, whose instructions) |
| `src/console/pwa.ts` | Install button, offline-ready and update prompts |
| `src/games/types.ts` | Disk contract v1: `Screen2D`, palette-index `Layer`, `GameDisk`, `GameRuntime`, `ConsoleAPI` |
| `src/console/screen.ts`, `layers.ts` | Browser adapters for the disk's drawing surface and palette-index layers; the CRT pipeline keeps its full Canvas context |
| `src/kit/platform/font.ts`, `palettes.ts` | Shared Silkscreen advances and the seven phosphor themes, used by web and headless hosts; `tools/fonts/metrics.py` regenerates the font table |
| `src/games/registry.ts` | Finds `*/disk.ts` (eager) and `*/game.ts` (lazy) |
| `src/games/tunnel-raider/`, `dino-run/`, `invader-force/`, `i-invade/`, `bricks/`, `martian-storm/` | The six games; what each folder holds is under [Game folders](#game-folders) |
| `docs/developer-guide.md` | The game developer guide (GAM-65): the game loop, `ConsoleAPI`, input, buttons and their layout, sound, scores, every disk field, the kit, `.pgdisk`, hosting, and what a game can't do yet. Keep it in step with `types.ts` |
| `src/games/README.md` | Making a game disk in this repo: every file, the artwork and images, and the steps for a new one |
| `src/kit/play/` | The game kit's play layer: gameplay building blocks games import (`sprite`, `fx`, `walls`, `score`, `hud`, `round`, `pickups`, `collide`, `maths`, `jingles`, `controls`). Tested in `tests/unit/kit/` against a fake `ConsoleAPI` |
| `src/kit/platform/` | Console services as DOM-free rules the core wires to the page. `haptics.ts` (GAM-5) is the first: named buzz patterns, the SOUND-off rule and which buzz wins, with the core supplying the vibrate call; button slots, gamepad and pause are to follow. See the [Shared game kit spec](https://linear.app/stealth-company/document/shared-game-kit-spec-338041de484b) |
| `public/` | Icons, favicon, share images (`og-image.png`, `og-<slug>.png` per game) |
| `tools/icons/` | `make.cjs` draws the app icons, maskable icons, Apple touch icon and favicon (`public/icons/`, `public/favicon.svg`, `public/favicon.ico`) from one SVG drawing |
| `tools/share-images/` | `make.cjs` captures the console and renders the share images and `docs/screens/`; `share.css` is their layout. `--covers` also writes each game's launcher cover (`src/games/<folder>/cover.ts`, generated, never edited by hand) from its play capture; `--covers-only` writes just those; `--previews` adds each game's flipbook (`preview.ts`, fetched lazily by `loadPreviews()` in the registry) |
| `tools/disks/` | Disk files for the native apps (GAM-34): `build.mjs` packs each game into `<id>-<version>.pgdisk` (a zip of `manifest.json`, plain-script `disk.js` and `game.js`, and `preview.json`) and writes the Ed25519-signed catalogue `index.json` to `dist/disks/v1/` (`npm run build` runs it); `verify.mjs` checks them; `keys/` holds the public keys; `versions.json` records each disk's version and hash. The format, keys and version rule are in `tools/disks/README.md` |
| `native/core/` | The native engine core for the iOS and Android apps (GAM-35): C++17, CMake, no dependencies. So far the rasteriser (`Screen2D` into palette indices), the phosphor palettes, generated from `src/kit/platform/palettes.ts` (`node native/core/tools/gen-palettes.mjs`), and the Silkscreen bitmap font with `measureText`/`fillText`, baked by `node tools/fonts/atlas.cjs` (unit tests fail if either drifts). See `native/core/README.md`; CI builds and tests it with GCC and Clang |
| `src/console/launcher/` | The disk launcher (GAM-32), DOM-free so the native apps can run it: `system.ts` (the `LauncherSystem` it asks the console for, built in `program/loader.ts`), `state.ts` and `layout.ts` (pure, unit-tested), `cover.ts` (the 2-bit cover codec and painter), `states.ts` (disk-state floppies), `draw.ts`, `index.ts` (`createLauncher`). `tests/flow.cjs` taps what `__gg.launcherTargets()` publishes |

Useful places:

- **Modes:** `S.mode` is one of `off`, `boot`, `menu`, `load`, `ready`, `play`, `dying`, `clear`, `paused`, `entry`, `over`. The console runs `boot`, `menu`, `load`, `entry` and `over`; the loaded game's runtime runs `ready`, `play`, `dying` and `clear`.
- **Flow:** `startConsole('cold' | 'warm')` → `enterMenu()` (or, on a game's page, straight to its disk after the first boot) → `loadGame(i)`, which fetches the game's code while the drive reads (`fetchRuntime`) → `startGame()` → game → `finishGame()` → name entry or the attract loop. POWER and RESET cold-boot; <kbd>G</kbd> (`pressSelect`) warm-boots.
- **The loaded game:** `game` (the disk) and `runtime` in `core.ts`. `setGame()` loads the game's scores, maps the action buttons (the disk's `buttons`) and switches the leaflet.
- **Joystick:** `src/console/stick.ts` holds the thumb-stick's logic (DOM-free, unit-tested); `core.ts` wires it to `#stickzone`. Browsers can drop a finger without a `pointerup` reaching the pad, so the stick lets go on every sign the finger has gone (`lostpointercapture`, a page-wide `pointerup`/`pointercancel`, no touch left on the pad, blur, a hidden page), and a new touch on the pad always takes over. Keep both when changing it.
- **Action buttons:** `src/console/buttons.ts`. Every physical button is a slot (`fire`, `boost`, the optional `fireL`/`fireR`, and the optional pad `pad1`…`pad6` that stands in for the stick while a `controls: 'pad'` disk plays; one `defineSlot()` in `core.ts` adds another, with its keys, label and tap handling). An *optional* slot is an extra button that stays hidden, and leaves its keys to the other slots, unless the app on screen maps it: `fireL` (<kbd>Z</kbd>) and `fireR` (<kbd>V</kbd>; <kbd>C</kbd> stays the phosphor dial) can sit either side of FIRE, and the pad slots take their keys (arrows, <kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd>, <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>) only while the game plays; every other app sees the set as before. Whatever is on screen is an app that declares a `ButtonMap`: an I18N label and `enabled` per slot, and slots it leaves out go dark and ignore presses. The boot and the disk menu are apps too (`BOOT_BUTTONS`, `MENU_BUTTONS` in `console-buttons.ts`: on the menu FIRE reads SELECT and BOOST is dark). Games read `api.button(id)` (or the `fire…`/`boost…` shorthands) and change slots for now with `api.setButtons({ boost: { label: 'nuke' } })`; `null` puts a slot back.
- **Drive sounds:** `playDisk(start, dur)` in `program/loader.ts`, through the Platform's `motor` and `click` (`web/audio.ts` on the web). Boots and loads run on the wall clock so the picture and the sound end together; if a game's code is late, the bar waits at the last sector.
- **Haptics:** games buzz through `api.buzz()` (`'fire'` as a shot leaves, `'lose'` for a life, `'pickup'`; the kit's `round.lose()` and `pickups.update()` already do the last two, and `finishGame()` buzzes `'over'`). The set's own controls call `buzz('tick')` in `core.ts`; a new physical control on the set should too. The joystick doesn't tick when touched (owner's call); it keeps its tiny 6 ms nudge on each change of direction (`setDir` in `core.ts`), which goes through `buzz()` so SOUND off silences it too.
- **Settings reset:** the leaflet's Settings section (`src/components/Settings.tsx`) sends a `gg:settings` event (`reset` or `scores`) that `core.ts` acts on; the defaults and which storage keys count as scores are in `src/console/settings.ts` (unit-tested). A new setting or score key must be added there.
- **Scores:** `src/console/program/scores.ts`, kept as `gg-best-<id>` and `gg-board-<id>` in the Platform's store (localStorage on the web) (Tunnel Raider falls back to the standalone game's `eb-best` and `tr-board`); the last name typed is `gg-name`.
- **Plug-in rule:**
  - **No console imports:** game folders never import from `src/console`. They get everything through `ConsoleAPI` (live getters; read values each frame).
  - **No side effects:** loading a game's modules must have none; allocate state and layers when `create()` or `start()` runs.
  - **No browser globals:** disks and `src/kit/play` never use `window`, `self`, `document`, `navigator`, `localStorage`, `sessionStorage`, `location`, timers, animation frames, `fetch`, `performance`, `Date` or dynamic `import()`. `Math.random` is allowed and the host can seed it. The browser's `registry.ts` is host code, outside disks.
  - **Drawing contract:** `api.g` is only `Screen2D`, never a full Canvas context. Use current palette strings for `fillStyle`, Silkscreen at 8 or 16 px for `font`, and `api.txt` for text. `measureText` uses the shared font table. Use `api.layer(w, h)` (`{ w, h, px: Uint8Array }`, indices 0 to 3 in row order) and `api.stamp(layer, x, y)` for cached pictures; index 0 is opaque too. Palette colour changes follow when stamped; a changed role mapping may rebuild indices in `onPalette()` to preserve the web appearance.
  - **Disk revisions:** every disk declares `contract: 1`, a positive whole-number `version`, and `rating` (all six currently `4+`). Disks keep running as JavaScript on both hosts. When a change alters a disk's built file (its own code, or kit and strings it bundles), raise its `version` and run `node tools/disks/build.mjs --lock`; `tests/unit/disk-files.test.ts` fails until `tools/disks/versions.json` matches.
  - **Add to the API, not the import list:** if a game needs something new from the console, add it to `ConsoleAPI` and to `api` in `core.ts`.
  - **The kit is the exception:** games may import `src/kit/play/` (`import { makeFx } from '../../kit/play'`) and types from `src/kit/platform/`. The kit follows the same rules as a game: no `src/console` imports, nothing on load, no module-level state (factories hold it), and anything new from the console goes through `ConsoleAPI`. `tests/unit/kit/rules.test.ts` checks.
  - **Disks stay light:** a `disk.ts` may import `kit/play/sprite` for its loading screen, but not the rest of the kit.
  - **Browser check:** a new game must be covered by the generic every-disk play-through in `tests/flow.cjs` (boot, load, play, game over, name entry or the table, G back to the menu, at the same three sizes). Any game-specific behaviour (weapons, scoring quirks) needs its own check in that file too.
  - **Contract check:** `tests/unit/kit/contract.test.ts` rejects banned globals and drawing members outside `Screen2D` in games and the play kit. `tools/conformance/run.mjs` records all six disks under Node at a fixed 1/60 s step with seeded randomness and scripted input; see its README for the stream format. System-disk coverage follows the console split in GAM-39.

## Game folders

Every game is one folder, `src/games/<folder>/`, plus a few files outside it. [`src/games/README.md`](src/games/README.md) explains each one, the artwork and images, and the steps for a new disk, and [`docs/developer-guide.md`](docs/developer-guide.md) documents the API a game uses; keep all three in step. **Required** fails the build or the unit tests without it; **expected** is what every game has and review will ask for; **generated** comes from a tool and is never edited by hand.

| File | Status | What it holds |
| --- | --- | --- |
| `src/games/<folder>/disk.ts` | required | `disk: GameDisk`: `contract`, `version`, `rating`, id, order, slug, `genre`, `players`, page title and description, title, file and size, `loadSecs` (≤ 5, unique) and `steps`, blurb, verb, `tap`, `controls`, `buttons`, game-over keys, `manual`, `strings`, `drawLoad`. Loaded up front, so it stays light (only `strings.ts`, `art.ts` and `kit/play/sprite`). |
| `src/games/<folder>/game.ts` | required | Default export `create(api)` → `{ start, update, draw, onPalette?, debug? }`. Fetched while the drive reads. |
| `src/games/<folder>/strings.ts` | expected | `strings: Strings` in `en`, `zh-hant`, `zh-hans`: the name, instructions, button labels and game-over words. Keys carry a game prefix (`dHow`); the table is shared and a test fails on clashing keys. |
| `src/games/<folder>/art.ts` | expected | Original sprites and drawing helpers, drawn only through colour roles (`api.col(role)`). Used by both the loading screen and the game, so no game state. |
| `src/games/<folder>/rules.ts` and similar | as needed | Pure rules (generation, weapons, scoring) with no canvas or `api`, unit-tested in `tests/unit/`. |
| `src/games/<folder>/cover.ts` | required, generated | The launcher cover: 128 × 96, one palette index (0 to 3) per pixel, base64. Written by `make.cjs --covers` (or `--previews`, which also refreshes `preview.ts`) from the game's `play(…)` capture; `covers.test.ts` fails without it. A disk may also draw its own with `drawCover`. |
| `src/games/<folder>/preview.ts` | optional, generated | A flipbook preview in the same format (`{ w, h, fps, frames }`), for disks without `drawPreview`: the cover's frame and seven more. Written by `make.cjs --previews` (with the cover, since `covers.test.ts` requires the first frame to match it). |
| `public/og-<slug>.png` | required | Share image for the game's page, 1200 × 630, full colour, made by `tools/share-images/make.cjs`. Never drawn on the tube; kept out of the offline precache. |
| `docs/screens/load-<short>.png`, `play-<short>.png` | expected | README screenshots, 720 px wide, made by the same script. |
| `tools/share-images/make.cjs` | edit | An `IMAGES` entry, the capture steps (`shot('load-…')`, and `play('play-…', '<folder>')`, which also makes the cover) and the screenshot names for the game. |
| `tests/flow.cjs` | edit | Checks for anything game-specific; the generic play-through covers the rest. |
| `tests/unit/<game>*.test.ts` | as needed | Tests for the rules modules. `disks.test.ts` checks every disk's fields, strings, share image and imports. |
| `tools/autopilot/<game>.mjs` | optional | A headless bot for tuning difficulty. |
| `README.md`, `AGENTS.md` | edit | A Games table row and screenshots; a numbered requirement section here. |

Launcher fields on every disk (GAM-32, see the [Web launcher build spec](https://linear.app/stealth-company/document/web-launcher-build-spec-gam-32-88a4c25140c8)): `genre` (upper case, ≤ 8 characters) and `players` (a unit test checks both), optional `year`, and optional `drawCover(api, x, y, w, h, t)` and `drawPreview(api, x, y, w, h, t)`. `cover` and `preview` are attached by the registry; never set them in `disk.ts`. The launcher tries `drawCover`, then `cover.ts`, then the title on a floppy label; for the preview, `drawPreview`, then `preview.ts`, then the cover held still. Covers are data painted with `fillRect` in the theme's colours, never `<img>`, so they work on every phosphor and in the native apps.

## How the console should keep behaving

- **One monitor, many games.** The CRT set, the phosphor dial, the SOUND / GLOW / HOLD / FULL switches, POWER and RESET belong to the console and work the same in every game.
- **Retro and original.** Games are tributes at most: original names, characters, art, sound and code. Never copy another game's assets or trademarks.
- **Four colours.** Everything on the tube goes through the palette quantiser and colour roles, so it looks right on green, amber, white and CGA.
- **Every screen size.** The layout detector picks `desk`, `phone-portrait`, `tablet-portrait` or `console`, and the playfield grid adapts to the tube's shape. The loader and every loading screen have to fit all of them, including the iPhone 17 Pro and Pro Max, an opened foldable, iPad mini and iPad Pro, in portrait and landscape.
- **Offline.** The console and every game must play with no connection once cached. Anything in `public/` or built from `src/` is precached; files fetched some other way need a `runtimeCaching` rule in `astro.config.mjs`.
- **Languages.** The page chrome and instructions come in English, Traditional Chinese and Simplified Chinese (`I18N`, chosen by `#en`, `#zh-hant` or `#zh-hans`). On-tube text stays English in the pixel font.
- **High scores.** Local only, per device, one table per game (`gg-board-<id>`).
- **Keyboard focus.** After a pointer click or tap on the set's buttons, the console drops focus (`blur`), so Space and Enter go to the game instead of pressing the button again (it used to switch the set off mid-jump). Keep that for any new button on the set.
- **Share images and covers.** Every game page needs `public/og-<slug>.png` (a unit test checks). Re-run `tools/share-images/make.cjs` after visible changes to the set, the menu or a game, and add new games to its `IMAGES` list. Run it with `--previews` when a game's look changes, so its launcher cover and flipbook follow together; a new game adds its `play(…)` capture there too. Every disk also declares `genre` (upper case, at most 8 characters) and `players` for the launcher. Share images stay out of the offline precache.
- **Analytics.** Vercel Web Analytics custom events through `track(name, data)`. The account is on Vercel Pro, which allows **at most two properties per event**, and values must be strings, numbers, booleans or null. When there are several games, put the game id in the event properties and drop a less useful one to stay within two. Keep the README's event table up to date.

## Working conventions

- **Spelling:** Australian / British English in copy, docs and commit messages.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:` …) on a branch, never on `main` (see the top of this file). Each commit body ends with `Refs GAM-<n>` for the issue it works on.
- **PR titles decide releases.** PRs squash-merge with the title as the commit subject, and `git-cliff` reads those subjects for the version and changelog: `feat:` is a minor release, `fix:`/`perf:` a patch, `docs:`/`chore:`/`ci:` start no release. Subjects start lowercase with no full stop (`pr-title.yml` checks). A push to `main` no longer reaches the live site by itself; production moves only when the release PR is merged.
- **Test before pushing:** `npm run build` and `npm test`, then `tests/flow.cjs`, `tests/pages.cjs`, `tests/stick.cjs` and `tests/haptics.cjs` against `npm run preview`, checking for errors and looking at screenshots of anything visual.
- **Apple work: the Mac first, CI last.** When the native iOS / iPadOS app lands, build and test every change to it on a Mac before pushing: run the Apple workflow's own commands, on a simulator and DerivedData of the run's own, and push only when it is green there. CI is the final check, not the place to debug. The steps, and which Mac to use, are in the `claude-software-factory` skill ("Apple builds: the Mac first, CI last"). The vendored `self-hosted-macos-runner` skill says where Apple jobs run: build and test jobs use the self-hosted `runs-on` switch with a hosted fallback; signing and TestFlight (`testflight.yml`) stay on GitHub-hosted runners only.
- **Keep the README current** with controls, games and the analytics event list.
- **Licensing:** code is `PolyForm-Noncommercial-1.0.0` (source-available, no commercial use without the owner's licence; GAM-29), images in `public/` and `docs/screens/` are CC BY-NC-SA 4.0, and the owner grants commercial licences separately (`LICENSING.md`). Third-party files (new agent skills, fonts or anything copied in) keep their own licence: add them to `THIRD_PARTY_NOTICES.md`. Never add code or assets whose licence would stop the owner offering a commercial licence (for example GPL, AGPL or other share-alike code by someone else).

## Linear and pull requests

Every pull request belongs to a Linear issue in the Game Guy project, and the issue says where the work stands.

1. **Find or file the issue first.** Search the project; if nothing covers the work, file one (team `GAM`, project Game Guy) before opening the pull request. Small fixes too: an issue is how the next person finds out it was done and why. Plans and specs go in the issue or a Linear project document, not in the repo.
2. **Branch from the issue.** Use the branch name Linear gives the issue (`feature/gam-10-add-a-browser-check-that-plays-every-disk`; `fix/gam-<n>-…` for a bug), so the integration links the branch, commits and PR to it. Branches with no issue (`release`, bots) are the only exceptions.
3. **Name the issue everywhere.**
   - PR title: a Conventional Commit subject with the issue at the end, `feat(invader-force): weapon capsules (GAM-17)`. The ID survives the squash merge into the commit subject on `main`.
   - Commit bodies: `Refs GAM-<n>` (several are fine: `Refs GAM-11, GAM-16`).
   - PR body: `Fixes GAM-<n>` when merging it finishes the issue, `Refs GAM-<n>` when it is one step of it. Use `Fixes` only in the PR body, never in a commit message: a commit that reaches `main` some other way would close the issue with nobody having reviewed it.
4. **Move the status with the pull request.**

   | When | Linear status |
   | --- | --- |
   | Work starts (branch made) | In Progress |
   | PR marked ready for review | In Review |
   | CI green and review comments dealt with | Ready to Merge |
   | PR that `Fixes` the issue merged into `main` | Released (Linear's name for merged: the change reaches players with the next `release: vX.Y.Z` PR, which lists it) |
   | PR that only `Refs` the issue merged, or a PR closed while work remains | Back to In Progress or Todo, with a comment on what is left |
   | Not doing the issue at all | Canceled (say why in a comment) |
   | Waiting on a decision or another issue | Paused |

   The GitHub integration moves some of these on its own; check the issue after each step and set it by hand when it didn't.
5. **Pull requests open as drafts.** Mark one ready for review when it is ready for the automated reviewers (CodeRabbit, Codex, the Vercel preview), then see it through: fix CI, answer or fix every review comment, until it is good to merge. Merging is the owner's call.

Release PRs (`release: vX.Y.Z`) and bot PRs (ImgBot) need no issue; the release PR lists the issues it ships through their PR titles.

## Gotchas paid for already

- **A push GitHub warns about is a push that landed.** See [Never push to `main`](#never-push-to-main): `--no-track`, an explicit `HEAD:refs/heads/<branch>` refspec and an `ls-remote` of `main` after the push each stop an accidental push to `main`; use all three.
- **`gh pr view <branch>` finds the most recently *merged* PR when no open one exists.** Ask `gh pr list --state open --head <branch> --json number --jq '.[0].number // empty'` and act on the number (`// empty` stops jq printing `null` when no open PR exists).
- **Under squash merge a branch is permanently ahead of `main`.** Comparing commits can never tell you a branch merged; ask the pull request.
- **A secret scan of the diff cannot see commit messages.** This repo is public. Scan `git log origin/main..HEAD` as well as the diff before pushing, and describe a removed secret by its shape, never its value.
- **`$( )` strips every trailing newline.** When building a PR body in a shell, join the pieces explicitly: `printf '%s\n\n%s\n' "$a" "$b"`.

## Open questions

- The site address for the console. Then set `site` in `astro.config.mjs`, absolute share-image URLs and a canonical link in `ConsoleLayout.astro`.
- Which games join after Martian Storm.
