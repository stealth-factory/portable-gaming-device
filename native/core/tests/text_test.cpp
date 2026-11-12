// The pixel text against what Chromium draws for the web console's txt() (textBaseline 'top').
// The expected pixels come from drawing the same strings in Chromium with the pinned font.
#include <cmath>
#include <string>

#include "check.hpp"
#include "pgd/text.hpp"

using pgd::Raster;
using pgd::TextAlign;

namespace {
int lit(const Raster& r) {
  int n = 0;
  for (int y = 0; y < r.height(); ++y) for (int x = 0; x < r.width(); ++x) n += r.at(x, y) != 0;
  return n;
}
/** The columns lit in one row, as a string of x positions, for readable failures. */
std::string cols(const Raster& r, int y) {
  std::string s;
  for (int x = 0; x < r.width(); ++x) if (r.at(x, y)) s += std::to_string(x) + ",";
  return s;
}
}  // namespace

TEST("text measures as the shared metrics table does") {
  CHECK_EQ(pgd::measureText("PGD-01", 8), 34.0);
  CHECK_EQ(pgd::measureText("PGD-01", 16), 68.0);
  CHECK_EQ(pgd::measureText("", 8), 0.0);
  CHECK_EQ(pgd::measureText("\xC3\xA9", 8), 5.0);        // é, two UTF-8 bytes, one glyph
  CHECK_EQ(pgd::measureText("\xE4\xB8\xAD", 8), 5.0);    // a character the font lacks: the missing advance
  CHECK_EQ(pgd::measureText("\xC1\x81", 8), 10.0);         // an overlong 'A': two malformed bytes
  CHECK_EQ(pgd::measureText("\xED\xA0\x80", 8), 15.0);    // a surrogate: three malformed bytes
  CHECK_EQ(pgd::measureText("\xF4\x90\x80\x80", 8), 20.0); // past U+10FFFF: four malformed bytes
  CHECK_EQ(pgd::measureText("A\tB", 8), pgd::measureText("A B", 8));
  CHECK_EQ(pgd::measureText("\xFF", 8), 5.0);            // a broken byte counts as one missing character
}

TEST("I at a whole-pixel pen lands where Chromium puts it") {
  Raster r(32, 32);
  r.setFill(3);
  pgd::fillText(r, "I", 10, 10, 8);
  CHECK_EQ(lit(r), 5);
  for (int y = 11; y <= 15; ++y) CHECK_EQ(int(r.at(11, y)), 3);
}

TEST("a pen part-way across a pixel lights the column it covers most, both at half") {
  for (const auto& c : { std::pair<double, const char*>{ 10.25, "11," }, { 10.5, "11,12," }, { 10.75, "12," } }) {
    Raster r(32, 32);
    r.setFill(1);
    pgd::fillText(r, "I", c.first, 10, 8);
    CHECK(cols(r, 13) == c.second);
  }
}

TEST("the top snaps up to the next whole pixel") {
  Raster r(32, 32);
  r.setFill(1);
  pgd::fillText(r, "I", 10, 10.25, 8);
  CHECK_EQ(int(r.at(11, 11)), 0);
  CHECK_EQ(int(r.at(11, 12)), 1);
  CHECK_EQ(int(r.at(11, 16)), 1);
}

TEST("centre and right alignment move the pen by the width") {
  Raster a(64, 16), b(64, 16), c(64, 16);
  a.setFill(1); b.setFill(1); c.setFill(1);
  const double w = pgd::measureText("HI", 8);
  pgd::fillText(a, "HI", 20, 2, 8);
  pgd::fillText(b, "HI", 20 + w / 2, 2, 8, TextAlign::Center);
  pgd::fillText(c, "HI", 20 + w, 2, 8, TextAlign::Right);
  for (int y = 0; y < 16; ++y) { CHECK(cols(a, y) == cols(b, y)); CHECK(cols(a, y) == cols(c, y)); }
}

TEST("16 px text is its own bitmap, about twice the size") {
  Raster r(64, 64);
  r.setFill(2);
  pgd::fillText(r, "I", 10, 10, 16);
  CHECK_EQ(lit(r), 20);                                   // 2 wide, 10 tall
  CHECK_EQ(int(r.at(12, 13)), 2);
  CHECK_EQ(int(r.at(13, 22)), 2);
}

TEST("text follows a translation and stays inside the clip") {
  Raster r(32, 32);
  r.setFill(1);
  r.translate(5, 5);
  pgd::fillText(r, "I", 5, 5, 8);
  CHECK_EQ(int(r.at(11, 11)), 1);
  Raster k(32, 32);
  k.setFill(1);
  k.beginPath(); k.rect(0, 0, 32, 13); k.clip();
  pgd::fillText(k, "I", 10, 10, 8);
  CHECK_EQ(lit(k), 2);                                    // rows 11 and 12 only
}

TEST("a scaled text fills each glyph pixel as a square") {
  Raster r(64, 64);
  r.setFill(1);
  r.scale(2, 2);
  pgd::fillText(r, "I", 5, 5, 8);
  CHECK_EQ(lit(r), 20);                                   // 5 pixels, each 2 × 2
  CHECK_EQ(int(r.at(12, 12)), 1);
}

TEST("text far off the picture or at a non-finite place draws nothing") {
  Raster r(16, 16);
  r.setFill(1);
  pgd::fillText(r, "HELLO", 1e12, 1e12, 8);
  pgd::fillText(r, "HELLO", -1e12, 0, 8);
  pgd::fillText(r, "HELLO", std::nan(""), 0, 8);
  CHECK_EQ(lit(r), 0);
}
