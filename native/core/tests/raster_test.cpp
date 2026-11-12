#include <cmath>
#include <string>

#include "check.hpp"
#include "pgd/raster.hpp"

using pgd::Layer;
using pgd::Raster;

namespace {
constexpr double kPi = 3.14159265358979323846;
int count(const Raster& r, std::uint8_t index) {
  int n = 0;
  for (int y = 0; y < r.height(); ++y) for (int x = 0; x < r.width(); ++x) n += r.at(x, y) == index;
  return n;
}
/** The picture as rows of digits, for readable failures while writing tests. */
std::string rows(const Raster& r, int x0, int y0, int w, int h) {
  std::string s;
  for (int y = y0; y < y0 + h; ++y) { for (int x = x0; x < x0 + w; ++x) s += char('0' + r.at(x, y)); s += '\n'; }
  return s;
}
}  // namespace

TEST("fillRect on whole pixels fills exactly those pixels") {
  Raster r(8, 6);
  r.setFill(2);
  r.fillRect(1, 2, 3, 2);
  CHECK_EQ(count(r, 2), 6);
  CHECK_EQ(int(r.at(1, 2)), 2);
  CHECK_EQ(int(r.at(3, 3)), 2);
  CHECK_EQ(int(r.at(4, 3)), 0);
  CHECK_EQ(int(r.at(0, 2)), 0);
}

TEST("fillRect fills a pixel when its centre is inside") {
  Raster r(4, 1);
  r.setFill(1);
  r.fillRect(0.4, 0, 1, 1);   // covers 0.4 to 1.4: pixel 0's centre (0.5) only
  CHECK(rows(r, 0, 0, 4, 1) == "1000\n");
  r.clear(0);
  r.fillRect(0.6, 0, 1, 1);   // 0.6 to 1.6: pixel 1's centre
  CHECK(rows(r, 0, 0, 4, 1) == "0100\n");
}

TEST("fillRect with a negative size draws the other way, as Canvas does") {
  Raster r(6, 6);
  r.setFill(3);
  r.fillRect(4, 4, -2, -3);
  CHECK_EQ(count(r, 3), 6);
  CHECK_EQ(int(r.at(2, 1)), 3);
  CHECK_EQ(int(r.at(3, 3)), 3);
}

TEST("fillRect is clipped to the picture") {
  Raster r(4, 4);
  r.setFill(1);
  r.fillRect(-10, -10, 100, 100);
  CHECK_EQ(count(r, 1), 16);
}

TEST("the fill index is a palette index, 0 to 3") {
  Raster r(2, 1);
  r.setFill(7);
  CHECK_EQ(int(r.fill()), 3);
}

TEST("translate and scale move rectangles") {
  Raster r(10, 10);
  r.setFill(1);
  r.translate(2, 3);
  r.scale(2, 2);
  r.fillRect(0, 0, 1, 1);
  CHECK_EQ(count(r, 1), 4);
  CHECK_EQ(int(r.at(2, 3)), 1);
  CHECK_EQ(int(r.at(3, 4)), 1);
}

TEST("a quarter turn sends x down the picture") {
  Raster r(20, 20);
  r.setFill(2);
  r.translate(10, 10);
  r.rotate(kPi / 2);
  r.fillRect(0, 0, 4, 2);   // x 0..4 becomes y 10..14; y 0..2 becomes x 8..10
  CHECK_EQ(count(r, 2), 8);
  CHECK_EQ(int(r.at(8, 10)), 2);
  CHECK_EQ(int(r.at(9, 13)), 2);
  CHECK_EQ(int(r.at(10, 10)), 0);
}

TEST("setTransform replaces the transform; save and restore bring the old one back") {
  Raster r(10, 10);
  r.setFill(1);
  r.save();
  r.setTransform(1, 0, 0, 1, 5, 5);
  r.fillRect(0, 0, 1, 1);
  r.restore();
  r.fillRect(0, 0, 1, 1);
  CHECK_EQ(int(r.at(5, 5)), 1);
  CHECK_EQ(int(r.at(0, 0)), 1);
  CHECK_EQ(count(r, 1), 2);
}

TEST("save and restore carry the fill colour") {
  Raster r(2, 1);
  r.setFill(1);
  r.save();
  r.setFill(3);
  r.restore();
  CHECK_EQ(int(r.fill()), 1);
}

TEST("a filled triangle covers about half its box") {
  Raster r(20, 20);
  r.setFill(1);
  r.beginPath();
  r.moveTo(0, 0); r.lineTo(10, 0); r.lineTo(0, 10); r.closePath();
  r.fillPath();
  const int n = count(r, 1);
  CHECK(n >= 45 && n <= 55);
  CHECK_EQ(int(r.at(0, 0)), 1);
  CHECK_EQ(int(r.at(9, 9)), 0);
}

TEST("a circle is round and the right size") {
  Raster r(40, 40);
  r.setFill(3);
  r.beginPath();
  r.arc(20, 20, 8, 0, 2 * kPi);
  r.fillPath();
  const int n = count(r, 3);
  CHECK(std::abs(n - int(kPi * 64)) <= 8);
  // symmetric about both axes through the centre
  bool sym = true;
  for (int y = 0; y < 40; ++y) for (int x = 0; x < 40; ++x) {
    if (r.at(x, y) != r.at(39 - x, y) || r.at(x, y) != r.at(x, 39 - y)) sym = false;
  }
  CHECK(sym);
}

TEST("an arc's sweep follows Canvas: y points down, so clockwise from π to 0 is the upper half") {
  Raster top(20, 20), bottom(20, 20), under(20, 20);
  top.setFill(1); bottom.setFill(1); under.setFill(1);
  top.beginPath(); top.arc(10, 10, 6, kPi, 0, false); top.fillPath();          // through 3π/2: up
  bottom.beginPath(); bottom.arc(10, 10, 6, kPi, 0, true); bottom.fillPath();  // through π/2: down
  under.beginPath(); under.arc(10, 10, 6, 0, kPi, false); under.fillPath();    // clockwise 0 to π: down
  CHECK_EQ(int(top.at(10, 6)), 1);
  CHECK_EQ(int(top.at(10, 13)), 0);
  CHECK_EQ(int(bottom.at(10, 13)), 1);
  CHECK_EQ(int(bottom.at(10, 6)), 0);
  CHECK_EQ(int(under.at(10, 13)), 1);
  CHECK_EQ(int(under.at(10, 6)), 0);
}

TEST("arcTo rounds the corners of a rectangle (the console's rr)") {
  Raster r(20, 20);
  r.setFill(2);
  const double x = 2, y = 2, w = 16, h = 12, rad = 4;
  r.beginPath();
  r.moveTo(x + rad, y);
  r.arcTo(x + w, y, x + w, y + h, rad);
  r.arcTo(x + w, y + h, x, y + h, rad);
  r.arcTo(x, y + h, x, y, rad);
  r.arcTo(x, y, x + w, y, rad);
  r.closePath();
  r.fillPath();
  CHECK_EQ(int(r.at(2, 2)), 0);    // the corners are cut
  CHECK_EQ(int(r.at(17, 13)), 0);
  CHECK_EQ(int(r.at(10, 2)), 2);   // the straight edges are not
  CHECK_EQ(int(r.at(2, 8)), 2);
  CHECK_EQ(int(r.at(10, 8)), 2);
  const int n = count(r, 2);
  CHECK(n < 16 * 12 && n > 16 * 12 - 4 * 4);
}

TEST("non-zero winding: a reversed inner path makes a hole, a same-way one does not") {
  Raster r(12, 12);
  r.setFill(1);
  r.beginPath();
  r.rect(0, 0, 12, 12);
  r.moveTo(4, 4); r.lineTo(4, 8); r.lineTo(8, 8); r.lineTo(8, 4); r.closePath();   // the other way round
  r.fillPath();
  CHECK_EQ(int(r.at(6, 6)), 0);
  CHECK_EQ(int(r.at(1, 1)), 1);
  Raster s(12, 12);
  s.setFill(1);
  s.beginPath();
  s.rect(0, 0, 12, 12);
  s.rect(4, 4, 4, 4);
  s.fillPath();
  CHECK_EQ(int(s.at(6, 6)), 1);
}

TEST("fillRect leaves the current path alone") {
  Raster r(10, 10);
  r.setFill(1);
  r.beginPath();
  r.rect(0, 0, 2, 2);
  r.fillRect(5, 5, 2, 2);
  r.setFill(2);
  r.fillPath();
  CHECK_EQ(int(r.at(0, 0)), 2);
  CHECK_EQ(int(r.at(5, 5)), 1);
}

TEST("clip limits drawing until restore") {
  Raster r(10, 10);
  r.setFill(1);
  r.save();
  r.beginPath();
  r.rect(2, 2, 3, 3);
  r.clip();
  r.fillRect(0, 0, 10, 10);
  CHECK_EQ(count(r, 1), 9);
  r.restore();
  r.setFill(2);
  r.fillRect(0, 0, 10, 10);
  CHECK_EQ(count(r, 2), 100);
}

TEST("a second clip narrows the first") {
  Raster r(10, 10);
  r.setFill(1);
  r.beginPath(); r.rect(0, 0, 6, 6); r.clip();
  r.beginPath(); r.rect(4, 4, 6, 6); r.clip();
  r.fillRect(0, 0, 10, 10);
  CHECK_EQ(count(r, 1), 4);
  CHECK_EQ(int(r.at(4, 4)), 1);
  CHECK_EQ(int(r.at(6, 6)), 0);
}

TEST("stamp copies a layer's indices, through the clip") {
  Layer l(3, 2);
  for (int i = 0; i < 6; ++i) l.px[i] = std::uint8_t(i % 4);
  Raster r(8, 8);
  r.stamp(l, 2, 1);
  CHECK(rows(r, 2, 1, 3, 2) == "012\n301\n");
  CHECK_EQ(int(r.at(1, 1)), 0);
  Raster c(8, 8);
  c.beginPath(); c.rect(3, 0, 8, 8); c.clip();
  c.clear(0);
  c.stamp(l, 2, 1);
  CHECK(rows(c, 2, 1, 3, 2) == "012\n001\n");   // the left column is clipped away
}

TEST("stamp follows the transform") {
  Layer l(2, 1);
  l.px = { 1, 2 };
  Raster r(8, 8);
  r.scale(2, 2);
  r.stamp(l, 1, 1);
  CHECK(rows(r, 2, 2, 4, 2) == "1122\n1122\n");
}

TEST("lineTo with no current point starts the path there") {
  Raster r(10, 10);
  r.setFill(1);
  r.beginPath();
  r.lineTo(0, 0); r.lineTo(10, 0); r.lineTo(10, 10); r.lineTo(0, 10);
  r.fillPath();
  CHECK_EQ(count(r, 1), 100);
}

TEST("non-finite numbers are ignored, as Canvas ignores them") {
  Raster r(4, 4);
  r.setFill(1);
  r.fillRect(NAN, 0, 2, 2);
  r.translate(INFINITY, 0);
  r.fillRect(0, 0, 1, 1);
  CHECK_EQ(count(r, 1), 1);
}

TEST("resize clears the picture and the drawing state") {
  Raster r(4, 4);
  r.setFill(2);
  r.translate(1, 1);
  r.fillRect(0, 0, 1, 1);
  r.resize(6, 5);
  CHECK_EQ(r.width(), 6);
  CHECK_EQ(r.height(), 5);
  CHECK_EQ(count(r, 0), 30);
  CHECK_EQ(int(r.fill()), 0);
  r.setFill(1);
  r.fillRect(0, 0, 1, 1);
  CHECK_EQ(int(r.at(0, 0)), 1);
}

TEST("shapes far larger than the picture are clipped, not lost") {
  Raster r(8, 8);
  r.setFill(1);
  r.fillRect(-1e12, -1e12, 2e12, 2e12);
  CHECK_EQ(count(r, 1), 64);
  Raster s(8, 4);
  s.setFill(2);
  s.fillRect(0, 0, 1e10, 4);
  CHECK_EQ(count(s, 2), 32);
  Raster p(8, 8);
  p.setFill(3);
  p.beginPath(); p.moveTo(-1e12, -1e12); p.lineTo(1e12, -1e12); p.lineTo(1e12, 1e12); p.lineTo(-1e12, 1e12); p.fillPath();
  CHECK_EQ(count(p, 3), 64);
}

TEST("a circle stretched one way keeps its curve") {
  Raster e(240, 40);
  e.setFill(1);
  e.scale(10, 1);
  e.beginPath();
  e.arc(12, 20, 10, 0, 2 * kPi);   // an ellipse 200 by 20
  e.fillPath();
  const int n = count(e, 1);
  CHECK(std::abs(n - int(kPi * 100 * 10)) <= 40);   // pi a b, within the rim's pixels
  CHECK_EQ(int(e.at(120, 20)), 1);
  CHECK_EQ(int(e.at(21, 20)), 1);    // near the left tip, still inside
  CHECK_EQ(int(e.at(25, 12)), 0);    // outside the curve near the end, where a few long chords would cut across
}

TEST("stamp ignores a layer whose pixels don't fill its size") {
  Layer l(4, 4);
  l.px.clear();
  Raster r(8, 8);
  r.stamp(l, 0, 0);
  CHECK_EQ(count(r, 0), 64);
}

TEST("a subpath pushed past a double's range is dropped, the rest still fills") {
  Raster r(8, 8);
  r.setFill(1);
  r.beginPath();
  r.rect(0, 0, 4, 4);
  r.moveTo(0, 0);
  r.lineTo(1e308, 0);
  r.lineTo(0, 1e308);
  r.scale(10, 10);      // later points are transformed when added, so this overflows to infinity
  r.lineTo(1e308, 1e308);
  r.fillPath();
  CHECK_EQ(count(r, 1), 16);
}

TEST("a negative layer size makes an empty layer") {
  Layer l(-3, 5);
  CHECK_EQ(l.w, 0);
  CHECK_EQ(l.h, 5);
  CHECK_EQ(int(l.px.size()), 0);
}
