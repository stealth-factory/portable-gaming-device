#include "pgd/raster.hpp"

#include <algorithm>
#include <cmath>

namespace pgd {

namespace {
constexpr double kPi = 3.14159265358979323846;
constexpr double kTau = 2 * kPi;
bool finite(double v) { return std::isfinite(v); }
/** First pixel whose centre is at or after `edge`. */
int firstCentre(double edge) { return static_cast<int>(std::ceil(edge - 0.5)); }
}  // namespace

Affine Affine::then(const Affine& m) const {
  return { a * m.a + c * m.b, b * m.a + d * m.b,
           a * m.c + c * m.d, b * m.c + d * m.d,
           a * m.e + c * m.f + e, b * m.e + d * m.f + f };
}
bool Affine::invertible() const {
  const double det = a * d - b * c;
  return finite(det) && det != 0;
}
Affine Affine::inverse() const {
  const double det = a * d - b * c;
  return { d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det };
}

Raster::Raster(int width, int height) { resize(width, height); }

void Raster::resize(int width, int height) {
  w_ = std::max(0, width);
  h_ = std::max(0, height);
  px_.assign(static_cast<std::size_t>(w_) * h_, 0);
  resetState();
}

void Raster::clear(std::uint8_t index) { std::fill(px_.begin(), px_.end(), static_cast<std::uint8_t>(index & 3)); }

void Raster::resetState() {
  st_ = State{};
  stack_.clear();
  path_.clear();
}

/* ---------- filling ---------- */

void Raster::fillRect(double x, double y, double w, double h) {
  if (!finite(x) || !finite(y) || !finite(w) || !finite(h) || w == 0 || h == 0) return;
  const Affine& m = st_.m;
  if (m.axisAligned()) {
    // The common case (nearly every draw a disk makes): straight to spans, no polygon.
    const Point p = m.apply(x, y), q = m.apply(x + w, y + h);
    const int x0 = std::max(0, firstCentre(std::min(p.x, q.x))), x1 = std::min(w_, firstCentre(std::max(p.x, q.x)));
    const int y0 = std::max(0, firstCentre(std::min(p.y, q.y))), y1 = std::min(h_, firstCentre(std::max(p.y, q.y)));
    if (x0 >= x1 || y0 >= y1) return;
    const Mask* clip = st_.clip.get();
    for (int yy = y0; yy < y1; ++yy) {
      std::uint8_t* row = px_.data() + static_cast<std::size_t>(yy) * w_;
      if (!clip) { std::fill(row + x0, row + x1, st_.fill); continue; }
      const std::uint8_t* c = clip->data() + static_cast<std::size_t>(yy) * w_;
      for (int xx = x0; xx < x1; ++xx) if (c[xx]) row[xx] = st_.fill;
    }
    return;
  }
  SubPath r;
  r.pts = { m.apply(x, y), m.apply(x + w, y), m.apply(x + w, y + h), m.apply(x, y + h) };
  r.closed = true;
  fillPolygons({ r }, st_.fill);
}

template <class Span>
void Raster::scan(const std::vector<SubPath>& paths, Span span) const {
  struct Edge { double x0, y0, x1, y1; int dir; };
  std::vector<Edge> edges;
  double ymin = 1e300, ymax = -1e300;
  for (const SubPath& sp : paths) {
    const std::size_t n = sp.pts.size();
    if (n < 2) continue;
    for (std::size_t i = 0; i < n; ++i) {
      const Point a = sp.pts[i], b = sp.pts[(i + 1) % n];   // every subpath is closed for filling
      if (a.y == b.y) continue;
      if (a.y < b.y) edges.push_back({ a.x, a.y, b.x, b.y, 1 });
      else edges.push_back({ b.x, b.y, a.x, a.y, -1 });
      ymin = std::min({ ymin, a.y, b.y });
      ymax = std::max({ ymax, a.y, b.y });
    }
  }
  if (edges.empty()) return;
  const int r0 = std::max(0, firstCentre(ymin)), r1 = std::min(h_, firstCentre(ymax));
  std::vector<std::pair<double, int>> xs;
  for (int row = r0; row < r1; ++row) {
    const double yc = row + 0.5;
    xs.clear();
    for (const Edge& e : edges) {
      if (yc < e.y0 || yc >= e.y1) continue;
      xs.emplace_back(e.x0 + (yc - e.y0) * (e.x1 - e.x0) / (e.y1 - e.y0), e.dir);
    }
    if (xs.size() < 2) continue;
    std::sort(xs.begin(), xs.end(), [](const auto& p, const auto& q) { return p.first < q.first; });
    int wind = 0;
    for (std::size_t i = 0; i + 1 < xs.size(); ++i) {
      wind += xs[i].second;
      if (wind == 0) continue;
      const int a = std::max(0, firstCentre(xs[i].first)), b = std::min(w_, firstCentre(xs[i + 1].first));
      if (a < b) span(row, a, b);
    }
  }
}

void Raster::fillPolygons(const std::vector<SubPath>& paths, std::uint8_t index) {
  const Mask* clip = st_.clip.get();
  scan(paths, [&](int row, int a, int b) {
    std::uint8_t* p = px_.data() + static_cast<std::size_t>(row) * w_;
    if (!clip) { std::fill(p + a, p + b, index); return; }
    const std::uint8_t* c = clip->data() + static_cast<std::size_t>(row) * w_;
    for (int x = a; x < b; ++x) if (c[x]) p[x] = index;
  });
}

void Raster::fillPath() { fillPolygons(path_, st_.fill); }

void Raster::clip() {
  auto mask = std::make_shared<Mask>(px_.size(), 0);
  const Mask* old = st_.clip.get();
  scan(path_, [&](int row, int a, int b) {
    const std::size_t o = static_cast<std::size_t>(row) * w_;
    for (int x = a; x < b; ++x) (*mask)[o + x] = old ? (*old)[o + x] : 1;
  });
  st_.clip = std::move(mask);
}

/* ---------- the path ---------- */

void Raster::beginPath() { path_.clear(); }

Raster::SubPath& Raster::current() {
  if (path_.empty()) path_.emplace_back();
  return path_.back();
}

void Raster::addDevice(Point p) { current().pts.push_back(p); }

bool Raster::lastUser(Point& out) const {
  if (path_.empty() || path_.back().pts.empty()) return false;
  const Point d = path_.back().pts.back();
  if (!st_.m.invertible()) { out = d; return true; }
  out = st_.m.inverse().apply(d.x, d.y);
  return true;
}

void Raster::moveTo(double x, double y) {
  if (!finite(x) || !finite(y)) return;
  path_.emplace_back();
  path_.back().pts.push_back(st_.m.apply(x, y));
}

void Raster::lineTo(double x, double y) {
  if (!finite(x) || !finite(y)) return;
  if (path_.empty() || path_.back().pts.empty()) { moveTo(x, y); return; }
  addDevice(st_.m.apply(x, y));
}

void Raster::closePath() {
  if (path_.empty() || path_.back().pts.empty()) return;
  path_.back().closed = true;
  const Point start = path_.back().pts.front();
  path_.emplace_back();
  path_.back().pts.push_back(start);
}

void Raster::rect(double x, double y, double w, double h) {
  if (!finite(x) || !finite(y) || !finite(w) || !finite(h)) return;
  SubPath r;
  r.pts = { st_.m.apply(x, y), st_.m.apply(x + w, y), st_.m.apply(x + w, y + h), st_.m.apply(x, y + h) };
  r.closed = true;
  path_.push_back(std::move(r));
  moveTo(x, y);
}

void Raster::arc(double x, double y, double r, double start, double end, bool ccw) {
  if (!finite(x) || !finite(y) || !finite(r) || !finite(start) || !finite(end) || r < 0) return;
  double sweep;
  if (!ccw) {
    sweep = end - start;
    if (sweep >= kTau) sweep = kTau;
    else { sweep = std::fmod(sweep, kTau); if (sweep < 0) sweep += kTau; }
  } else {
    sweep = start - end;
    if (sweep >= kTau) sweep = kTau;
    else { sweep = std::fmod(sweep, kTau); if (sweep < 0) sweep += kTau; }
    sweep = -sweep;
  }
  // enough segments that no chord strays more than about a tenth of a pixel from the true curve
  const double scale = std::sqrt(std::fabs(st_.m.a * st_.m.d - st_.m.b * st_.m.c));
  const double rd = std::max(0.5, r * scale);
  const double step = 2 * std::acos(std::max(-1.0, 1 - 0.1 / rd));
  const int n = std::max(1, static_cast<int>(std::ceil(std::fabs(sweep) / std::max(step, 1e-3))));
  const Point first = st_.m.apply(x + r * std::cos(start), y + r * std::sin(start));
  if (path_.empty() || path_.back().pts.empty()) { path_.emplace_back(); }
  addDevice(first);
  for (int i = 1; i <= n; ++i) {
    const double a = start + sweep * i / n;
    addDevice(st_.m.apply(x + r * std::cos(a), y + r * std::sin(a)));
  }
}

void Raster::arcTo(double x1, double y1, double x2, double y2, double r) {
  if (!finite(x1) || !finite(y1) || !finite(x2) || !finite(y2) || !finite(r) || r < 0) return;
  Point p0;
  if (!lastUser(p0)) { moveTo(x1, y1); return; }
  const double ax = p0.x - x1, ay = p0.y - y1, bx = x2 - x1, by = y2 - y1;
  const double la = std::hypot(ax, ay), lb = std::hypot(bx, by), cross = ax * by - ay * bx;
  if (la == 0 || lb == 0 || r == 0 || std::fabs(cross) < 1e-12 * la * lb) { lineTo(x1, y1); return; }
  const double ux = ax / la, uy = ay / la, vx = bx / lb, vy = by / lb;
  const double theta = std::acos(std::max(-1.0, std::min(1.0, ux * vx + uy * vy)));
  const double dist = r / std::tan(theta / 2);
  const double t1x = x1 + ux * dist, t1y = y1 + uy * dist, t2x = x1 + vx * dist, t2y = y1 + vy * dist;
  const double bisx = ux + vx, bisy = uy + vy, bl = std::hypot(bisx, bisy), cd = r / std::sin(theta / 2);
  const double cx = x1 + bisx / bl * cd, cy = y1 + bisy / bl * cd;
  const double a0 = std::atan2(t1y - cy, t1x - cx), a1 = std::atan2(t2y - cy, t2x - cx);
  double delta = a1 - a0;
  while (delta <= -kPi) delta += kTau;
  while (delta > kPi) delta -= kTau;
  lineTo(t1x, t1y);
  arc(cx, cy, r, a0, a0 + delta, delta < 0);
}

/* ---------- state ---------- */

void Raster::save() { stack_.push_back(st_); }
void Raster::restore() {
  if (stack_.empty()) return;
  st_ = stack_.back();
  stack_.pop_back();
}
void Raster::translate(double x, double y) {
  if (!finite(x) || !finite(y)) return;
  st_.m = st_.m.then({ 1, 0, 0, 1, x, y });
}
void Raster::rotate(double angle) {
  if (!finite(angle)) return;
  const double c = std::cos(angle), s = std::sin(angle);
  st_.m = st_.m.then({ c, s, -s, c, 0, 0 });
}
void Raster::scale(double x, double y) {
  if (!finite(x) || !finite(y)) return;
  st_.m = st_.m.then({ x, 0, 0, y, 0, 0 });
}
void Raster::setTransform(double a, double b, double c, double d, double e, double f) {
  if (!finite(a) || !finite(b) || !finite(c) || !finite(d) || !finite(e) || !finite(f)) return;
  st_.m = { a, b, c, d, e, f };
}

/* ---------- layers ---------- */

void Raster::stamp(const Layer& layer, double x, double y) {
  if (layer.w <= 0 || layer.h <= 0 || !finite(x) || !finite(y) || !st_.m.invertible()) return;
  const Affine& m = st_.m;
  const Point c[4] = { m.apply(x, y), m.apply(x + layer.w, y), m.apply(x + layer.w, y + layer.h), m.apply(x, y + layer.h) };
  double minx = c[0].x, maxx = c[0].x, miny = c[0].y, maxy = c[0].y;
  for (const Point& p : c) { minx = std::min(minx, p.x); maxx = std::max(maxx, p.x); miny = std::min(miny, p.y); maxy = std::max(maxy, p.y); }
  const int x0 = std::max(0, firstCentre(minx)), x1 = std::min(w_, firstCentre(maxx));
  const int y0 = std::max(0, firstCentre(miny)), y1 = std::min(h_, firstCentre(maxy));
  const Affine inv = m.inverse();
  const Mask* clip = st_.clip.get();
  for (int yy = y0; yy < y1; ++yy) {
    for (int xx = x0; xx < x1; ++xx) {
      const std::size_t i = static_cast<std::size_t>(yy) * w_ + xx;
      if (clip && !(*clip)[i]) continue;
      const Point u = inv.apply(xx + 0.5, yy + 0.5);
      const double lx = u.x - x, ly = u.y - y;
      if (lx < 0 || ly < 0 || lx >= layer.w || ly >= layer.h) continue;
      px_[i] = layer.px[static_cast<std::size_t>(ly) * layer.w + static_cast<std::size_t>(lx)] & 3;
    }
  }
}

}  // namespace pgd
