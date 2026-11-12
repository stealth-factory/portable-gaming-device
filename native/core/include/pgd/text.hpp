// The console's pixel text: Silkscreen at 8 and 16 px from the baked atlas (font_atlas.hpp), drawn into a
// Raster the way the web console's `txt()` draws it on Canvas with `textBaseline = 'top'` (GAM-35).
#pragma once
#include <string_view>
#include <cstdint>

#include "pgd/raster.hpp"

namespace pgd {

enum class TextAlign { Left, Center, Right };

/** Width in pixels of UTF-8 text at 8 or 16 px, the same sum of advances as `measurePixelText` on the web.
    Any other size measures as 8 px. Bytes that are not valid UTF-8 count as one missing character each. */
double measureText(std::string_view utf8, int size);

/** Draw text in the current fill index with its top at y, through the transform and clip.

    Under a transform that only moves (the console's case), this matches Chromium: the top snaps up to the
    next whole pixel, and a pen that falls part-way across a pixel lights the column it covers most, or
    both columns at exactly half. Under a scale or rotation each glyph pixel is filled as a small square. */
void fillText(Raster& r, std::string_view utf8, double x, double y, int size, TextAlign align = TextAlign::Left);

}  // namespace pgd
