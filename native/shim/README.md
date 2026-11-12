# The disk contract shim

`shim.js` builds the `api` a game disk is handed in the iOS and Android apps (GAM-36). It records everything the disk draws or asks for into one flat command buffer per frame, which the engine core reads in a single crossing. It is a plain script with no imports, exports or host globals, so QuickJS, JavaScriptCore and Node run it the same way. It defines one global, `PGDShim`.

A host runs `shim.js` in the same fresh context as the disk's `disk.js` and `game.js` (see `tools/disks/README.md`), then:

```js
const shim = PGDShim.createShim({ disk, grid: { w, h }, palette: { pal, roles }, measurePixelText });
const runtime = PGDGame.create(shim.api);
runtime.start();
// every frame:
shim.input(event);           // only when the input changed
shim.step(runtime);          // update in ready/play/dying/clear, clear the picture, draw
const frame = shim.take();   // { version, ops, strings, blobs }; the buffer starts empty again
```

`measurePixelText(text, font)` returns `{ width }` from the shared Silkscreen advances; the apps answer it from `native/core`'s `measureText`. `palette` is one mode from `src/kit/platform/palettes.ts`. `input(event)` takes the same fields as an event in `tools/conformance/README.md` (`held`, `stickDir`, `buttons`, `press`, `tap`), and keeps the web's rules for which presses and taps queue in which mode. `state()` returns the small summary the conformance stream records.

The console state (`S`), the held directions, the stick, the buttons and the taps live in the shim, so a disk reads them without crossing into the core. A disk with `tap: true` gets taps only in `ready` and `play`.

## The command buffer, version 1

A frame is:

| Field | What it holds |
| --- | --- |
| `version` | `1`. A host refuses a buffer whose version it doesn't know |
| `ops` | A `Float64Array` of commands, one after another |
| `strings` | The frame's strings, each once, indexed from 0 |
| `blobs` | The frame's layer pixels as `Uint8Array`s, indexed from 0 |

A command is its opcode, its argument count, then two numbers for each argument: a tag and a value.

| Tag | Argument | Value |
| --- | --- | --- |
| 0 | a number | the number |
| 1 | a boolean | 0 or 1 |
| 2 | a string | index into `strings` |
| 3 | `null` | 0 |
| 4 | `undefined` (an argument passed as `undefined`) | 0 |
| 5 | an object or array | index into `strings`, holding its JSON |
| 6 | layer pixels | index into `blobs` |

A command keeps exactly the arguments the disk passed, so `arc` with and without its `counterclockwise` flag stay distinct and a trailing optional argument is never invented.

| Opcode | Command | Arguments |
| --- | --- | --- |
| 1 | `fillRect` | x, y, w, h |
| 2 | `beginPath` | |
| 3 | `rect` | x, y, w, h |
| 4 | `moveTo` | x, y |
| 5 | `lineTo` | x, y |
| 6 | `arc` | x, y, radius, start, end, and optionally counterclockwise |
| 7 | `arcTo` | x1, y1, x2, y2, radius |
| 8 | `closePath` | |
| 9 | `fill` | |
| 10 | `clip` | |
| 11 | `save` | |
| 12 | `restore` | |
| 13 | `translate` | x, y |
| 14 | `rotate` | angle |
| 15 | `scale` | x, y |
| 16 | `setTransform` | a, b, c, d, e, f |
| 17 | `fillStyle` | palette index 0 to 3 |
| 18 | `font` | the font string |
| 19 | `measureText` | the text and its measured width (a record; nothing to draw) |
| 20 | `txt` | text, x, y, palette index, alignment, size; the top of the text at y |
| 21 | `layer` | id, w, h, pixels (one palette index per byte, in row order) |
| 22 | `stamp` | id, x, y |
| 23 | `tone` | the disk's arguments: frequency, duration, and optionally volume, slide, delay |
| 24 | `buzz` | a haptic name, a length in ms, or a pattern (JSON) |
| 25 | `buttons` | the slot patch (JSON) |
| 26 | `best` | the score saved as best |
| 27 | `finishGame` | |

Opcodes are never renumbered; a new command takes the next number. A change to what an existing command means raises the version.

`txt`, `rr`, `poly`, `circ` and `banner` arrive as the drawing commands they expand into (`txt` sets `font` and `fillStyle`, then sends `txt`). A layer's pixels are sent on its first stamp and again only when they change; a host keeps layer definitions between frames, and every `stamp` refers to the latest definition of its id. Each frame starts with `setTransform(1, 0, 0, 1, 0, 0)`, the background `fillStyle` and a full-screen `fillRect`.

## Tests

`tests/unit/shim.test.ts` checks the layout in Node: a known frame's exact numbers, every tag, string sharing within a frame, layers sent only on change, growth past the first allocation, and that the shim runs in a context with nothing but the language's own globals.

The conformance runner (`tools/conformance/run.mjs`) draws every disk through this shim and `decode.mjs`, which turns a buffer back into stream format 1. Its recorded streams are what `tests/unit/conformance.test.ts` and `tests/unit/disk-files.test.ts` compare, so a buffer that lost or changed a command would fail them.
