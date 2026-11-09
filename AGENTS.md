# AGENTS.md: Game Guy

Notes for anyone (human or agent) working in this repo. Read this before changing anything.

## Linear

- **Project:** Game Guy, <https://linear.app/stealth-company/project/game-guy-c4e01570fc18/overview>
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

**Game Guy 3000 Deluxe** (Game Guy for short) is a browser game console: one old CRT monitor that boots, shows a game loader, and runs several games. It starts as a copy of [Tunnel Raider](https://github.com/wiiiimm/tunnel-raider), which is still its own repo and site (`tunnel-raider.wiiiimm.codes`); changes made here do not flow back to it.

Requirements 1 to 10 below are built: the console boots into a disk menu with four games, Tunnel Raider, Dino Run, Invader Force and I Invade, and each game has its own page. The SELECT button is built but **hidden for now** (owner's call: with the menu one RESET away it duplicates RESET). The <kbd>G</kbd> key still does SELECT.

## Requirements (from the owner)

### 1. Boot into a game loader

- Switching the set on (POWER) or pressing RESET runs the cold boot (BIOS memory test, POST beep, floppy drive) and then lands in a **game loader interface**, not straight into a game.
- The loader is the console's home screen. It lists the games and lets the player pick one to load.
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

### 6. Rebrand the console as Game Guy

- The page header and every bit of branding on the CRT set change from Tunnel Raider to the console's name: **Game Guy 3000 Deluxe** (chosen by the owner). Any shortened form must still say "Game Guy", and the look stays nerdy and retro.
- Today's spots to change:
  - **Page header:** wordmark and `TR-83` badge (`.mk-model`), and the tagline beside it.
  - **Nameplate on the set:** `TUNNEL RAIDER` with the `TR-83 · <phosphor>` line (`.nameplate`, set by `setMode()`).
  - **Embossed model line:** `TR-83 · 12″ PHOSPHOR MONITOR` (`.emboss`).
  - **BIOS banner:** `TR-83 PERSONAL COMPUTER   BIOS 1.0` (`drawBoot()`).
  - **Instructions:** the `model` string in `I18N` for all three languages.
  - **App identity:** `<title>`, `apple-mobile-web-app-title`, share tags and image, `manifest.webmanifest` name and short name, icons, README.
- Model code: replace `TR-83` with `GG-3000 DX`. Game names (Tunnel Raider and the rest) appear only inside their own game: its loading screen, instructions and title.

### 7. A SELECT button beside RESET

- Add a **SELECT** button next to RESET on the set, labelled `SELECT` in the same style as the RESET label.
- **Colours:** SELECT takes RESET's current look (the dark graphite key, `.resetbtn`). RESET becomes **dark wine red**, so it reads as the dangerous one.
- **What it does:** pressing SELECT leaves the current game and goes back to the game loader, replaying the boot-up and disk loading sounds on the way (the same kind as `playBoot()`), much as RESET replays the cold boot today.
- It does nothing with the set switched off, like RESET.
- It needs a place in every layout (`desk`, `console`, tall console, `phone-portrait`, `tablet-portrait`), sitting with RESET beside POWER.
- **RESET vs SELECT:** RESET reboots the whole console (BIOS, then the loader); SELECT just swaps the game, through the loader.
- Add a keyboard shortcut for it, and an analytics event (for example `select` with the game left and its level).
- **Status:** hidden. `PowerPanel` in `src/components/PowerPanel.tsx` takes `showSelect`; pass it from `ConsoleSet` to bring the button back (and add SELECT back to the console strings). The nameplate on an upright phone shows the full name while SELECT is hidden; with SELECT back it may need shortening to GAME GUY again (`.np-rest`).

### 8. Dino Run, with its own high-score table

- The loader's second game: an original endless desert runner in the spirit of Google Chrome's offline dinosaur game. Jump cacti and boulders, duck pterosaurs. The dinosaur, obstacles, art, sound and code are original; never copy Chrome's sprites.
- It has its own top-ten table and name entry, like Tunnel Raider.

### 9. Invader Force

- The third disk: a fixed-screen alien shooter that plays like Taito's Space Invaders (1978). A formation of six rows (one more every two waves, up to eight, fewer if the tube is short) marches, drops a row at each edge and speeds up as it thins. One shot in the air at a time. Crumbling walls, a mystery saucer, extra cannon every 1,500, and waves that start lower each time.
- Original aliens (jelly, beetle, drone), cannon, saucer, sounds and code. Never reproduce Taito's invader sprites, the 👾 emoji's artwork, or any open-source remake's code or assets.
- BOOST is a short SHIELD that blocks bombs, then recharges; taps on the screen fire (`tap: true` on the disk).
- **Capsules (owner's design):** shot-down aliens sometimes drop a capsule and the saucer always does. Catching one gives a 12-second weapon (Twin, Spread, Rapid, or Pierce: a lightning laser up the column), lost when hit; or a shot-speed boost that stacks up to five times and resets its 60-second clock on each catch; or, very rarely, an atomic bomb that relabels BOOST as NUKE (`api.setButtons({ boost: { label: 'nuke' } })`) and launches a missile that wipes out three or four whole rows where it hits. A bomb that hits a capsule sets it off in a wide blast that can take your cannon; shooting a capsule sets off the same blast but spares you; your shot meeting a bomb sets off a smaller blast that spares you. Rules live in `src/games/invader-force/weapons.ts` (unit-tested).

### 10. I Invade

- The fourth disk: the fixed-screen alien shooter played from the other side. You steer the alien fleet left and right while it sinks a step every few seconds (sooner each wave); FIRE drops a bomb from the bomb bay (the lit column nearest the fleet's middle), one in the air at a time.
- The defenders' tanks (two on wave 1, up to five) patrol behind pillboxes, shoot up at the fleet (each hit costs an alien) and, more often each wave, dodge falling bombs.
- Win a wave by destroying every tank, or by touching down on the tanks' row (20 per alien landed). Losing every alien loses a fleet; three fleets, plus one every 2,000.
- BOOST calls in the UFO: it crosses the sky and drops a heavy bomb, which goes through walls, on the first tank it passes over, then recharges (about 14 s). Taps on the screen drop bombs (`tap: true`).
- Original fleet (crown, puffer, pod), tanks, UFO, sounds and code.

## Stack (decided)

**Astro + React components + a plain TypeScript console engine on Canvas 2D.** No game engine: the picture comes from the console's own four-colour quantiser and phosphor pass, which an engine's renderer would fight.

- **Astro:** builds static pages: the console (`/`) and one page per game (`/<slug>`, booting straight into that disk). `build.format: 'file'` plus `vercel.json` `cleanUrls`.
- **React (owner's choice, for reusable components):**
  - **The set's hardware and the page chrome:** React components rendered to static HTML at build time, with no hydration. The engine finds them by id and drives them.
  - **The instructions leaflet:** the one live island (`client:load`). It reads the engine's state through `src/console/bus.ts`.
  - **Rule:** don't let React re-render anything the engine mutates. To make a component live, move its state into the bus first.
- **Offline:** `@vite-pwa/astro` (Workbox `generateSW`, `registerType: 'prompt'`, registered immediately). It precaches every built file by content hash, including each game's lazily loaded code.
- **Analytics:** `@vercel/analytics` (`inject()` in `main.ts`, `track()` through the console's helper).
- **Tests:** Vitest (`tests/unit`: disk rules and the plug-in rule) and Playwright scripts (`tests/flow.cjs`, `tests/pages.cjs`, `tests/stick.cjs`) against `npm run preview`.
- **Deploy:** Vercel's Astro preset, `npm run build` → `dist`.
- **Releases (decided):** pooled release with production gated by a Promotion Branch. Production branch `production`, platform Vercel. Merges to `main` deploy previews and update one standing `release: vX.Y.Z` PR; merging that PR tags the version and fast-forwards `production`, which Vercel ships. See [docs/releasing.md](docs/releasing.md).
- **Types:** TypeScript is loose for now (`strict: false`) because the ported console code is untyped. New code should be typed; tighten module by module.

## Where things are now

| Path | What it is |
| --- | --- |
| `src/pages/index.astro`, `src/pages/[slug].astro` | The console page, and one page per game |
| `src/layouts/ConsoleLayout.astro` | Head and share tags, the inline layout detector, the set, the leaflet |
| `src/components/` | React components (static): `ConsoleSet` and its parts, `Header`, `ManualBar`, `NetBadge`; `Manual.tsx` is the live island |
| `src/main.ts` | Engine entry: console, PWA, analytics |
| `src/console/core.ts` | CRT picture pipeline, input, sound, switches, scores, name entry, game loop, and the `api` games get |
| `src/console/loader.ts` | Boot screens, disk menu, loading screens and drive sounds, SELECT |
| `src/console/i18n.ts` | Every string (base table plus console and disk strings), no side effects |
| `src/console/strings.ts`, `manual.ts` | The console's own strings and instructions |
| `src/console/bus.ts` | Tiny store shared by the engine and React islands (language, whose instructions) |
| `src/console/pwa.ts` | Install button, offline-ready and update prompts |
| `src/games/types.ts` | The plug-in contract: `GameDisk`, `GameRuntime`, `ConsoleAPI` |
| `src/games/registry.ts` | Finds `*/disk.ts` (eager) and `*/game.ts` (lazy) |
| `src/games/tunnel-raider/`, `dino-run/`, `invader-force/`, `i-invade/` | The four games (`disk.ts`, `game.ts`, plus helpers) |
| `public/` | Icons, favicon, share images (`og-image.png`, `og-<slug>.png` per game) |
| `tools/share-images/` | `make.cjs` captures the console and renders the share images and `docs/screens/`; `share.css` is their layout |

Useful places:

- **Modes:** `S.mode` is one of `off`, `boot`, `menu`, `load`, `ready`, `play`, `dying`, `clear`, `paused`, `entry`, `over`. The console runs `boot`, `menu`, `load`, `entry` and `over`; the loaded game's runtime runs `ready`, `play`, `dying` and `clear`.
- **Flow:** `startConsole('cold' | 'warm')` → `enterMenu()` (or, on a game's page, straight to its disk after the first boot) → `loadGame(i)`, which fetches the game's code while the drive reads (`fetchRuntime`) → `startGame()` → game → `finishGame()` → name entry or the attract loop. POWER and RESET cold-boot; <kbd>G</kbd> (`pressSelect`) warm-boots.
- **The loaded game:** `game` (the disk) and `runtime` in `core.ts`. `setGame()` loads the game's scores, maps the action buttons (the disk's `buttons`) and switches the leaflet.
- **Joystick:** `src/console/stick.ts` holds the thumb-stick's logic (DOM-free, unit-tested); `core.ts` wires it to `#stickzone`. Browsers can drop a finger without a `pointerup` reaching the pad, so the stick lets go on every sign the finger has gone (`lostpointercapture`, a page-wide `pointerup`/`pointercancel`, no touch left on the pad, blur, a hidden page), and a new touch on the pad always takes over. Keep both when changing it.
- **Action buttons:** `src/console/buttons.ts`. Every physical button is a slot (`fire`, `boost`, and the optional `fireL`/`fireR`; one `defineSlot()` in `core.ts` adds another, with its keys, label and tap handling). An *optional* slot is an extra button that stays hidden, and leaves its keys to the other slots, unless the app on screen maps it: `fireL` (<kbd>Z</kbd>) and `fireR` (<kbd>V</kbd>; <kbd>C</kbd> stays the phosphor dial) sit either side of FIRE for I Invade's three bomb bays, and every other app sees the set as before. Whatever is on screen is an app that declares a `ButtonMap`: an I18N label and `enabled` per slot, and slots it leaves out go dark and ignore presses. The boot and the disk menu are apps too (`BOOT_BUTTONS`, `MENU_BUTTONS` in `console-buttons.ts`: on the menu FIRE reads SELECT and BOOST is dark). Games read `api.button(id)` (or the `fire…`/`boost…` shorthands) and change slots for now with `api.setButtons({ boost: { label: 'nuke' } })`; `null` puts a slot back.
- **Drive sounds:** `playDisk(start, dur)` in `loader.ts`. Boots and loads run on the wall clock so the picture and the sound end together; if a game's code is late, the bar waits at the last sector.
- **Scores:** `gg-best-<id>` and `gg-board-<id>` in localStorage (Tunnel Raider falls back to the standalone game's `eb-best` and `tr-board`); the last name typed is `gg-name`.
- **Plug-in rule:**
  - **No console imports:** game folders never import from `src/console`. They get everything through `ConsoleAPI` (live getters; read values each frame).
  - **No side effects:** loading a game's modules must have none; make canvases and the like in `create()`.
  - **Add to the API, not the import list:** if a game needs something new from the console, add it to `ConsoleAPI` and to `api` in `core.ts`.
  - **Browser check:** a new game must be covered by the generic every-disk play-through in `tests/flow.cjs` (boot, load, play, game over, name entry or the table, G back to the menu, at the same three sizes). Any game-specific behaviour (weapons, scoring quirks) needs its own check in that file too.

## How the console should keep behaving

- **One monitor, many games.** The CRT set, the phosphor dial, the SOUND / GLOW / HOLD / FULL switches, POWER and RESET belong to the console and work the same in every game.
- **Retro and original.** Games are tributes at most: original names, characters, art, sound and code. Never copy another game's assets or trademarks.
- **Four colours.** Everything on the tube goes through the palette quantiser and colour roles, so it looks right on green, amber, white and CGA.
- **Every screen size.** The layout detector picks `desk`, `phone-portrait`, `tablet-portrait` or `console`, and the playfield grid adapts to the tube's shape. The loader and every loading screen have to fit all of them, including the iPhone 17 Pro and Pro Max, an opened foldable, iPad mini and iPad Pro, in portrait and landscape.
- **Offline.** The console and every game must play with no connection once cached. Anything in `public/` or built from `src/` is precached; files fetched some other way need a `runtimeCaching` rule in `astro.config.mjs`.
- **Languages.** The page chrome and instructions come in English, Traditional Chinese and Simplified Chinese (`I18N`, chosen by `#en`, `#zh-hant` or `#zh-hans`). On-tube text stays English in the pixel font.
- **High scores.** Local only, per device, one table per game (`gg-board-<id>`).
- **Keyboard focus.** After a pointer click or tap on the set's buttons, the console drops focus (`blur`), so Space and Enter go to the game instead of pressing the button again (it used to switch the set off mid-jump). Keep that for any new button on the set.
- **Share images.** Every game page needs `public/og-<slug>.png` (a unit test checks). Re-run `tools/share-images/make.cjs` after visible changes to the set, the menu or a game, and add new games to its `IMAGES` list. Share images stay out of the offline precache.
- **Analytics.** Vercel Web Analytics custom events through `track(name, data)`. The account is on Vercel Pro, which allows **at most two properties per event**, and values must be strings, numbers, booleans or null. When there are several games, put the game id in the event properties and drop a less useful one to stay within two. Keep the README's event table up to date.

## Working conventions

- **Spelling:** Australian / British English in copy, docs and commit messages.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:` …) on a branch, never on `main` (see the top of this file). Each commit body ends with `Refs GAM-<n>` for the issue it works on.
- **PR titles decide releases.** PRs squash-merge with the title as the commit subject, and `git-cliff` reads those subjects for the version and changelog: `feat:` is a minor release, `fix:`/`perf:` a patch, `docs:`/`chore:`/`ci:` start no release. Subjects start lowercase with no full stop (`pr-title.yml` checks). A push to `main` no longer reaches the live site by itself; production moves only when the release PR is merged.
- **Test before pushing:** `npm run build` and `npm test`, then `tests/flow.cjs`, `tests/pages.cjs` and `tests/stick.cjs` against `npm run preview`, checking for errors and looking at screenshots of anything visual.
- **Keep the README current** with controls, games and the analytics event list.
- **Licensing:** code is `AGPL-3.0-only`, images in `public/` and `docs/screens/` are CC BY-NC-SA 4.0, and the owner grants commercial licences separately (`LICENSING.md`). Third-party files (new agent skills, fonts or anything copied in) keep their own licence: add them to `THIRD_PARTY_NOTICES.md`. Never add code or assets whose licence would stop the owner offering a commercial licence (for example GPL or AGPL code by someone else).

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
- Which games join after I Invade.
