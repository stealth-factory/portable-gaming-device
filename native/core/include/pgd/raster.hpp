// The disk contract's drawing surface (Screen2D, contract v1) as a rasteriser into palette indices.
//
// Every pixel of the low-res picture is one palette index, 0 to 3. There is no anti-aliasing: a shape
// fills a pixel when the pixel's centre is inside it (non-zero winding), so the result matches the web
// console's picture after its four-colour quantiser wherever the web's edges are whole pixels.
//
// Semantics follow Canvas 2D: path points are transformed as they are added, fillRect leaves the
// current path alone, clip intersects with the clip already in force, and save/restore carry the
// transform, the clip and the fill colour.
#pragma once
#include <cstdint>
#include <memory>
#include <vector>

namespace pgd {

struct Point { double x = 0, y = 0; };

/** A 2D affine transform, as Canvas's setTransform(a, b, c, d, e, f): x' = a x + c y + e, y' = b x + d y + f. */
struct Affine {
  double a = 1, b = 0, c = 0, d = 1, e = 0, f = 0;
  Point apply(double x, double y) const { return { a * x + c * y + e, b * x + d * y + f }; }
  /** this × m: m is applied first, as Canvas's translate, rotate and scale do. */
  Affine then(const Affine& m) const;
  bool invertible() const;
  Affine inverse() const;
  /** True when the transform keeps rectangles axis-aligned (no rotation or shear). */
  bool axisAligned() const { return b == 0 && c == 0; }
};

/** An off-screen picture of palette indices (api.layer): row-major, one byte per pixel. */
struct Layer {
  int w = 0, h = 0;
  std::vector<std::uint8_t> px;
  Layer() = default;
  // A negative size makes an empty layer rather than a huge allocation.
  Layer(int w_, int h_)
      : w(w_ > 0 ? w_ : 0), h(h_ > 0 ? h_ : 0), px(static_cast<std::size_t>(w) * static_cast<std::size_t>(h), 0) {}
};

class Raster {
 public:
  Raster(int width, int height);

  /** Change the picture's size. The picture is cleared to index 0 and the drawing state reset. */
  void resize(int width, int height);
  int width() const { return w_; }
  int height() const { return h_; }
  const std::uint8_t* pixels() const { return px_.data(); }
  std::uint8_t at(int x, int y) const { return px_[static_cast<std::size_t>(y) * w_ + x]; }
  /** Fill the whole picture with one index, ignoring transform and clip. */
  void clear(std::uint8_t index);
  /** Forget the path, the clip and the transform, and restore the save stack to empty (the start of a frame). */
  void resetState();

  void setFill(std::uint8_t index) { st_.fill = index & 3; }
  std::uint8_t fill() const { return st_.fill; }

  void fillRect(double x, double y, double w, double h);

  void beginPath();
  void moveTo(double x, double y);
  void lineTo(double x, double y);
  void rect(double x, double y, double w, double h);
  void arc(double x, double y, double r, double start, double end, bool counterclockwise = false);
  void arcTo(double x1, double y1, double x2, double y2, double r);
  void closePath();
  /** Fill the current path (non-zero winding) in the fill index. */
  void fillPath();
  /** Intersect the clip with the current path. */
  void clip();

  void save();
  void restore();
  void translate(double x, double y);
  void rotate(double angle);
  void scale(double x, double y);
  void setTransform(double a, double b, double c, double d, double e, double f);
  const Affine& transform() const { return st_.m; }

  /** Copy a layer onto the picture with its top-left at (x, y), through the transform and clip. */
  void stamp(const Layer& layer, double x, double y);

  /** Set one pixel in device space, through the clip (for the pixel font). */
  void plot(int x, int y, std::uint8_t index) {
    if (x < 0 || y < 0 || x >= w_ || y >= h_) return;
    std::size_t i = static_cast<std::size_t>(y) * w_ + x;
    if (st_.clip && !(*st_.clip)[i]) return;
    px_[i] = index & 3;
  }

 private:
  struct SubPath { std::vector<Point> pts; bool closed = false; };
  using Mask = std::vector<std::uint8_t>;
  struct State { Affine m; std::shared_ptr<const Mask> clip; std::uint8_t fill = 0; };

  /** Calls `span(y, x0, x1)` for every run of pixels inside the polygons, centre rule, non-zero winding. */
  template <class Span> void scan(const std::vector<SubPath>& paths, Span span) const;
  void fillPolygons(const std::vector<SubPath>& paths, std::uint8_t index);
  SubPath& current();
  /** The current point in user space (Canvas maps the device point back through the inverse transform). */
  bool lastUser(Point& out) const;
  void addDevice(Point p);

  int w_ = 0, h_ = 0;
  std::vector<std::uint8_t> px_;
  State st_;
  std::vector<State> stack_;
  std::vector<SubPath> path_;
};

}  // namespace pgd
