# PGD engine core

The native half of the console, shared by the iOS and Android apps (GAM-35). C++17, CMake, no platform
headers. The only third-party code is QuickJS-ng (MIT), vendored unchanged in `third_party/quickjs-ng`. The design is in the Linear document "iOS app build spec (handoff)",
section 8.

What is here so far:

| Path | What it is |
| --- | --- |
| `include/pgd/raster.hpp`, `src/raster.cpp` | The disk contract's drawing surface (`Screen2D`) as a rasteriser into palette indices 0 to 3: rectangles, filled paths with non-zero winding, arcs and `arcTo`, clips, the transform stack, and stamping layers. A pixel is filled when its centre is inside the shape; there is no anti-aliasing |
| `include/pgd/palettes.hpp` | The seven phosphor modes, generated from `src/kit/platform/palettes.ts` by `tools/gen-palettes.mjs`. Never edit it by hand; `tests/unit/native-palettes.test.ts` fails when it is out of date |
| `include/pgd/font_atlas.hpp` | Silkscreen as 1-bit bitmaps at 8 and 16 px, baked in Chromium by `tools/fonts/atlas.cjs`. Never edit it by hand; `tests/unit/native-font.test.ts` fails when it no longer matches the pinned font or its advances |
| `include/pgd/text.hpp`, `src/text.cpp` | `measureText` and `fillText` for the disk contract's text: UTF-8 in, the shared advances, left, centre or right alignment, and Chromium's placement with `textBaseline = 'top'` (the top snaps up to a whole pixel, a half-pixel pen lights both columns). A missing character advances like the web's and draws nothing |
| `include/pgd/synth.hpp`, `src/synth.cpp` | The console's sound, matching the web's `src/console/web/audio.ts`: `tone` (a band-limited square wave with its delay, exponential slide to at least 40 Hz and the web's envelope), `click` (a head click: noise through a Q 2.5 band-pass, gone in 18 ms), `motor` (noise through a 220 Hz low-pass with a 40 to 75 Hz sawtooth hum, swelling in and fading out), `hush`, mute and a master gain. Filters use Web Audio's biquad formulas. The game thread queues commands through a fixed lock-free queue; the audio callback calls `render` for mono or interleaved float samples, which never allocates or locks. Delays count from the frames rendered so far, and a voice ends where the web's envelope reaches its 0.0001 floor |
| `include/pgd/script_host.hpp`, `src/script_host.cpp` | The script host a disk runs in (GAM-36): a fresh QuickJS-ng runtime and context per disk, with the language's own objects plus `atob`, `btoa`, a seeded `Math.random` (Mulberry32, as the conformance runner seeds it), and two helpers for the shim, `__pgdMeasure` and `__pgdLayerDiff`. No `Date`, `performance`, timers, `fetch`, storage or `console`. `call()` runs one function and copies the command frame it returns (`native/shim/README.md`) out of the engine. Limits: 100 ms of script per call, 64 MB of heap (counted by the host's own allocator) and a recursion limit. A disk that runs past one, or throws, is stopped for good, with the fault and message the console shows as DISK ERROR |
| `include/pgd/disk_file.hpp`, `src/disk_file.cpp` | Unpacks a disk file (`.pgdisk`, GAM-34): stored entries only, each CRC checked |
| `tools/disk_run.cpp` | `pgd_disk_run`: plays a disk file in the script host for the conformance check below |
| `third_party/quickjs-ng/` | The engine, pinned; see its README for the version and how to update it |
| `tests/` | Unit tests with a tiny built-in harness (`check.hpp`) |

Still to come: the command decoder that draws a frame's commands into the rasteriser, and the C interface for the app shells.

## Build and test

```sh
cmake -S native/core -B build/core -DCMAKE_BUILD_TYPE=Release
cmake --build build/core
ctest --test-dir build/core --output-on-failure
```

CI runs this with GCC and Clang on Linux, warnings as errors (QuickJS-ng's own warnings are not ours and are off). It then plays every disk file in the native script host and checks it against Node, byte for byte:

```sh
node tools/disks/build.mjs --out build/disks
node tools/conformance/native-check.mjs build/disks build/core/pgd_disk_run
```

Each disk runs `tools/conformance/play.json` through the same scripts in both hosts (`native/shim/shim.js`, the disk's two scripts, `native/shim/host.js`, `tools/conformance/driver.js`); only the engine differs, and the command buffer leaves QuickJS through `ScriptHost::call`. `pgd_disk_run` prints the script time a frame took on average and at most. After changing the web's palettes, run
`node native/core/tools/gen-palettes.mjs`. After changing the font, run `node tools/fonts/atlas.cjs` (it needs Playwright with Chromium).
