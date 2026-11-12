# Shared pixel-font metrics

`Silkscreen-Regular.ttf` is the unmodified regular font from
[`google/fonts` at `7e8d490955e9d2629cd3095e8dadd6fafe3c16b8`](https://github.com/google/fonts/tree/7e8d490955e9d2629cd3095e8dadd6fafe3c16b8/ofl/silkscreen).
Its SIL Open Font License is reproduced in `OFL.txt`.

Generate `src/kit/platform/font-metrics.json` with Python and
`fonttools==4.61.1`:

```sh
python3 tools/fonts/metrics.py
```

The table contains the font's Unicode advances and missing-glyph advance in
font units. `measurePixelText` scales those units to 8 or 16 px. The source
font has no kerning; its positioning tables only attach marks. Web `Screen2D.measureText`
and the Node conformance host use the same table. The browser serves the pinned
regular face as a local hashed asset, preloads it, and waits for it before
booting the console, so text drawing and measurement agree without Google Fonts.
An early POWER or Enter press initialises audio immediately and queues the full
boot until the font is ready. POWER can cancel that queue. The boot clock starts
only when the font is usable.

Each load attempt has a ten-second deadline. A failed or empty font response shows
a translated Retry card; POWER and Enter can also retry. Each attempt creates a
fresh face, and an old attempt cannot start a late boot after failure or cancellation. The vendored font is also the source of the native core's bitmap atlas
(GAM-35). Regenerate `native/core/include/pgd/font_atlas.hpp` after changing the font:

```sh
node tools/fonts/atlas.cjs
```

It draws each glyph in Chromium at 8 and 16 px and keeps pixels at half coverage or
more. `tests/unit/native-font.test.ts` fails if the atlas no longer matches the font.
