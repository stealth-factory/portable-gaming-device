#include "pgd/text.hpp"

#include <cmath>

#include "pgd/font_atlas.hpp"

namespace pgd {
namespace {

/** The next code point, or U+FFFD for a malformed byte (which then measures as a missing character). */
std::uint32_t next(std::string_view s, std::size_t& i) {
  const auto b = [&](std::size_t k) { return static_cast<std::uint8_t>(s[k]); };
  const std::uint8_t c = b(i);
  int extra = c < 0x80 ? 0 : (c >> 5) == 0x6 ? 1 : (c >> 4) == 0xE ? 2 : (c >> 3) == 0x1E ? 3 : -1;
  if (extra < 0 || i + static_cast<std::size_t>(extra) >= s.size() + (extra == 0)) { ++i; return 0xFFFD; }
  std::uint32_t cp = extra == 0 ? c : c & (0x3F >> extra);
  for (int k = 1; k <= extra; ++k) {
    const std::uint8_t t = b(i + static_cast<std::size_t>(k));
    if ((t & 0xC0) != 0x80) { ++i; return 0xFFFD; }
    cp = (cp << 6) | (t & 0x3F);
  }
  // Overlong forms, surrogates and values past U+10FFFF are malformed too: one byte at a time.
  static constexpr std::uint32_t kMin[] = {0, 0x80, 0x800, 0x10000};
  if (cp < kMin[extra] || (cp >= 0xD800 && cp <= 0xDFFF) || cp > 0x10FFFF) { ++i; return 0xFFFD; }
  i += static_cast<std::size_t>(extra) + 1;
  return cp;
}

/** Canvas turns tabs and line breaks into spaces before drawing or measuring. */
std::uint32_t normalise(std::uint32_t cp) { return cp == '\t' || cp == '\n' || cp == '\f' || cp == '\r' ? 0x20 : cp; }

const font::Glyph* find(const font::Glyph* glyphs, std::uint32_t cp) {
  int lo = 0, hi = font::kGlyphCount - 1;
  while (lo <= hi) {
    const int mid = (lo + hi) / 2;
    if (glyphs[mid].code == cp) return &glyphs[mid];
    if (glyphs[mid].code < cp) lo = mid + 1; else hi = mid - 1;
  }
  return nullptr;
}

struct Face { const font::Glyph* glyphs; const std::uint32_t* rows; int missing; };
Face face(int size) {
  if (size == 16) return { font::kGlyphs16, font::kRows16, font::kMissingAdvance8 * 2 };
  return { font::kGlyphs8, font::kRows8, font::kMissingAdvance8 };
}

}  // namespace

double measureText(std::string_view utf8, int size) {
  const Face f = face(size);
  double w = 0;
  for (std::size_t i = 0; i < utf8.size();) {
    const font::Glyph* g = find(f.glyphs, normalise(next(utf8, i)));
    w += g ? g->advance : f.missing;
  }
  return w;
}

void fillText(Raster& r, std::string_view utf8, double x, double y, int size, TextAlign align) {
  if (!std::isfinite(x) || !std::isfinite(y)) return;
  const Face f = face(size);
  const double width = measureText(utf8, size);
  double pen = align == TextAlign::Left ? x : align == TextAlign::Right ? x - width : x - width / 2;
  const Affine& m = r.transform();
  const bool moveOnly = m.a == 1 && m.b == 0 && m.c == 0 && m.d == 1;
  const std::uint8_t index = r.fill();

  for (std::size_t i = 0; i < utf8.size();) {
    const font::Glyph* g = find(f.glyphs, normalise(next(utf8, i)));
    if (!g) { pen += f.missing; continue; }
    if (g->w && g->h) {
      if (moveOnly) {
        const double dx = pen + m.e, top = std::ceil(y + m.f - 1e-9);
        if (top < -64 || top > r.height() + 64) return;   // off the picture: nothing to draw, nothing to overflow
        const double base = std::floor(dx + 1e-9), frac = dx - base;
        // Which column(s) each glyph pixel lights: the one it covers most, or both at exactly half.
        const bool here = frac < 0.5 + 1e-9, right = frac > 0.5 - 1e-9;
        for (int row = 0; row < g->h; ++row) {
          std::uint32_t bits = f.rows[g->first + row];
          const int py = static_cast<int>(top) + g->y + row;
          for (int col = 0; bits; ++col, bits >>= 1) {
            if (!(bits & 1)) continue;
            const double px = base + g->x + col;
            if (px < -1 || px > r.width()) continue;
            if (here) r.plot(static_cast<int>(px), py, index);
            if (right) r.plot(static_cast<int>(px) + 1, py, index);
          }
        }
      } else {
        for (int row = 0; row < g->h; ++row) {
          std::uint32_t bits = f.rows[g->first + row];
          for (int col = 0; bits; ++col, bits >>= 1)
            if (bits & 1) r.fillRect(pen + g->x + col, y + g->y + row, 1, 1);
        }
      }
    }
    pen += g->advance;
  }
}

}  // namespace pgd
