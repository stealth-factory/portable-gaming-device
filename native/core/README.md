# PGD engine core

The native half of the console, shared by the iOS and Android apps (GAM-35). C++17, CMake, no platform
headers and no third-party code. The design is in the Linear document "iOS app build spec (handoff)",
section 8.

What is here so far:

| Path | What it is |
| --- | --- |
| `include/pgd/raster.hpp`, `src/raster.cpp` | The disk contract's drawing surface (`Screen2D`) as a rasteriser into palette indices 0 to 3: rectangles, filled paths with non-zero winding, arcs and `arcTo`, clips, the transform stack, and stamping layers. A pixel is filled when its centre is inside the shape; there is no anti-aliasing |
| `include/pgd/palettes.hpp` | The seven phosphor modes, generated from `src/kit/platform/palettes.ts` by `tools/gen-palettes.mjs`. Never edit it by hand; `tests/unit/native-palettes.test.ts` fails when it is out of date |
| `tests/` | Unit tests with a tiny built-in harness (`check.hpp`) |

Still to come: the pixel font, the synth, the command decoder and the script host (GAM-36).

## Build and test

```sh
cmake -S native/core -B build/core -DCMAKE_BUILD_TYPE=Release
cmake --build build/core
ctest --test-dir build/core --output-on-failure
```

CI runs this with GCC and Clang on Linux, warnings as errors. After changing the web's palettes, run
`node native/core/tools/gen-palettes.mjs`.
