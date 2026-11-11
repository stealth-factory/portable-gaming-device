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
and the Node conformance host use the same table; the browser continues to
draw text with Silkscreen. The vendored font also supplies the source for
the native bitmap atlas in GAM-35.
