# Headless disk conformance

Run a disk under Node, without a browser:

```sh
node tools/conformance/run.mjs tunnel-raider tools/conformance/play.json /tmp/tunnel.jsonl
node tools/conformance/run.mjs i-invade tools/conformance/play.json /tmp/invasion.jsonl
```

The first argument is a folder under `src/games`, or a built disk file (`dist/disks/v1/<id>-<version>.pgdisk`, see `tools/disks/README.md`), which runs that file's own `disk.js` and `game.js` the way an app would. The runner bundles that folder's `disk.ts` and `game.ts`, the shared palettes and font metrics using Rolldown, as the existing I Invade autopilot does. Each invocation evaluates the bundle in a fresh JavaScript realm. A Mulberry32 generator replaces that realm's `Math.random` before its modules run. The output contains no timestamps or paths and is identical for the same disk code, input and seed.

Both hosts run the same plain scripts in the disk's realm: the contract shim (`native/shim/shim.js`), the session (`native/shim/host.js`) and the script driver (`driver.js`). The native host does the same in QuickJS:

```sh
node tools/conformance/native.mjs dist/disks/v1/bricks-1.pgdisk tools/conformance/play.json /tmp/bricks-native.jsonl build/core/pgd_disk_run
node tools/conformance/native-check.mjs dist/disks/v1 build/core/pgd_disk_run   # every disk, both hosts, byte for byte
```

`native.mjs` runs `pgd_disk_run` (built with `native/core`, see its README), which writes each frame's command buffer as it left the engine, then decodes it as `run.mjs` does. CI runs `native-check.mjs` after the core's tests.

This host records game play. The system disk and its boot, launcher and loading screens will have their own host when GAM-39 splits the console program from the web platform. It does not simulate those screens or the native rasteriser.

## Input

`play.json` is a 360-frame example shared by all six disks. A script is an object with these optional fields:

| Field | Default | Meaning |
| --- | --- | --- |
| `frames` | `360` | Integer from 1 to 36,000 |
| `seed` | `1` | Unsigned 32-bit seed for `Math.random` |
| `grid` | `{ "w": 15, "h": 10 }` | Grid cells; low-res picture is `w × 24` by `h × 24 + 20` |
| `palette` | `"greenP1"` | A mode from the web console's shared palettes |
| `events` | `[]` | Events in frame order, applied before that frame's update |

An event needs a zero-based `frame` and may set:

- `held`: distinct direction names, newest last, for keyboard movement; persists until replaced.
- `stickDir`: a direction or `null`; persists until replaced and takes precedence over `held`.
- `buttons`: an object mapping slot names to booleans. A false-to-true transition queues a press; the value controls whether the slot remains held. Unmapped or disabled slots ignore it.
- `press`: slot names whose queued flag is set for the game to consume, without holding them down. This supports repeated presses without release events.
- `tap`: `{ "held": true, "x": 180 }`; a false-to-true transition queues a tap only for disks with `tap: true` in `ready` or `play`. `x` is in low-res pixels and changes only on an accepted press. Release clears held state in every mode and keeps the queued flag and last accepted `x`. An ignored held press does not become a new edge when play starts.

Omitted fields retain their values. As on the web, BOOST and optional-slot presses queue only during `play`; FIRE may queue during the ready countdown. Held button state is still updated outside `play`. Both `buttons` and `press` follow those rules, so a released countdown press cannot spend a shield when play starts. Unknown fields, invalid values and out-of-order frames fail before loading a disk. The host starts the disk using the web's ready countdown, advances time by exactly `1 / 60` second, then updates and draws once per frame. It stops updating after `finishGame` and continues drawing the final game picture; name entry and the score table belong to the system disk.

## Stream format 1

Output is newline-delimited JSON. The first line is a `header` with the disk id, disk version, contract, seed, timestep, frame count, grid, palette name and its four colour strings. The next line is `init`, holding commands issued by `create` and `start`. Each remaining line is a `frame` with its number, applied input events, a small state summary and an ordered `commands` array.

A command is an array whose first element is its name:

- Screen2D methods retain their positional arguments. `fillStyle` carries a palette index, not a CSS colour. `font` carries the font string. `measureText` carries the string and measured width, using the shared Silkscreen table.
- `txt` carries `[text, x, y, paletteIndex, alignment, size]`, positioned with the web text helper's top baseline. Text itself remains a higher-level command because `fillText` is outside Screen2D. `rr`, `poly`, `circ` and `banner` expand into their ordinary path, rectangle and text commands.
- `layer` carries `[id, width, height, base64]`. Decoding base64 yields one palette index per byte, in row order. The host emits a definition on the first stamp and again whenever those pixels change. `stamp` carries `[id, x, y]`, referring to the latest definition. Keep layers between frames.
- `tone` and `buzz` retain their API arguments. `buttons` carries the slot patch. `best` records saving the best score. `finishGame` marks the end of game play. `track` does nothing, matching the mobile contract.

The existing `rockjaw` sprite role has no palette mapping. Both web and headless hosts retain the previous ink when a legacy disk asks for an unmapped role, preserving the web picture; they do not assign an undefined colour to Screen2D.

Replay commands in order, including `init`; preserve Screen2D state, its save stack and layer definitions between frames. Every frame begins with an identity transform and a background clear. This stream is a reference recording, not the apps' wire format. The disk's `api` comes from the apps' own contract shim (`native/shim/shim.js`), loaded in the disk's realm, and every command goes through its typed-array command buffer and back through `native/shim/decode.mjs` before it is written, so the streams also prove the buffer carries everything a disk drew. The buffer layout is in `native/shim/README.md`. It contains enough drawing, text and layer data for web and native hosts to replay the same picture independently.

`tests/unit/conformance.test.ts` runs all six disks twice for 360 frames, checks byte-for-byte stability, and checks that changed input and seeds affect recorded game commands.
