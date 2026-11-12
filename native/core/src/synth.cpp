#include "pgd/synth.hpp"

#include <algorithm>
#include <cmath>

namespace pgd {

namespace {
constexpr double kPi = 3.14159265358979323846;
constexpr double kFloor = 0.0001;      // where the web's envelopes start and end
constexpr double kClickLen = 0.018;    // a head click's decay, seconds
constexpr double kMotorGain = 0.16, kHumGain = 0.012;
constexpr double kMinSlide = 40;       // the web's floor for a slide's target, Hz
constexpr std::size_t kChunk = 256;    // frames mixed at a time

bool finite(double v) { return std::isfinite(v); }

/** Web Audio's exponentialRampToValueAtTime between v0 and v1, `x` of the way along (0 to 1). */
double expRamp(double v0, double v1, double x) { return v0 * std::pow(v1 / v0, x); }

/** PolyBLEP: the correction that takes the alias out of a naive step at phase 0. */
double blep(double t, double dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1.0; }
  if (t > 1.0 - dt) { t = (t - 1.0) / dt; return t * t + t + t + 1.0; }
  return 0.0;
}

double wrap(double p) { return p - std::floor(p); }
}  // namespace

Biquad Biquad::lowpass(double freq, double sampleRate, double qDb) {
  const double w0 = 2 * kPi * std::min(freq, sampleRate * 0.5 * 0.999) / sampleRate;
  const double alpha = std::sin(w0) / (2 * std::pow(10.0, qDb / 20));
  const double cs = std::cos(w0), a0 = 1 + alpha;
  Biquad f;
  f.b0 = (1 - cs) / 2 / a0;
  f.b1 = (1 - cs) / a0;
  f.b2 = f.b0;
  f.a1 = -2 * cs / a0;
  f.a2 = (1 - alpha) / a0;
  return f;
}

Biquad Biquad::bandpass(double freq, double sampleRate, double q) {
  const double w0 = 2 * kPi * std::min(freq, sampleRate * 0.5 * 0.999) / sampleRate;
  const double alpha = std::sin(w0) / (2 * q);
  const double cs = std::cos(w0), a0 = 1 + alpha;
  Biquad f;
  f.b0 = alpha / a0;
  f.b1 = 0;
  f.b2 = -alpha / a0;
  f.a1 = -2 * cs / a0;
  f.a2 = (1 - alpha) / a0;
  return f;
}

Synth::Synth(double sampleRate, std::uint32_t seed)
    : sr_(sampleRate > 0 && finite(sampleRate) ? sampleRate : 48000.0), seed_(seed ? seed : 1u) {
  gainCoef_ = 1.0 - std::exp(-1.0 / (0.005 * sr_));
}

// ---------- the queue: one producer (the game), one consumer (the audio callback) ----------

bool Synth::push(const Command& c) {
  const std::size_t t = tail_.load(std::memory_order_relaxed);
  if (t - head_.load(std::memory_order_acquire) >= kQueue) return false;
  queue_[t % kQueue] = c;
  tail_.store(t + 1, std::memory_order_release);
  return true;
}

bool Synth::pop(Command& c) {
  const std::size_t h = head_.load(std::memory_order_relaxed);
  if (h == tail_.load(std::memory_order_acquire)) return false;
  c = queue_[h % kQueue];
  head_.store(h + 1, std::memory_order_release);
  return true;
}

// ---------- control side ----------

bool Synth::tone(double freq, double dur, double vol, double slide, double delay) {
  if (muted() || !finite(freq) || !finite(dur) || !finite(vol) || !finite(slide) || !finite(delay)) return false;
  if (freq <= 0 || dur <= 0) return false;
  Command c;
  c.kind = Kind::Tone; c.at = frames(); c.a = freq; c.b = dur; c.c = vol; c.d = slide; c.delay = delay;
  return push(c);
}

bool Synth::click(double delay, double vol, double freq) {
  if (muted() || !finite(delay) || !finite(vol) || !finite(freq) || freq <= 0) return false;
  Command c;
  c.kind = Kind::Click; c.at = frames(); c.a = vol; c.b = freq; c.delay = delay;
  return push(c);
}

bool Synth::motor(double start, double dur) {
  if (muted() || !finite(start) || !finite(dur) || dur <= 0) return false;
  Command c;
  c.kind = Kind::Motor; c.at = frames(); c.b = dur; c.delay = start;
  return push(c);
}

bool Synth::hush() {
  Command c;
  c.kind = Kind::Hush; c.at = frames();
  return push(c);
}

void Synth::setGain(float g) {
  if (!std::isfinite(g)) return;
  gainTarget_.store(std::clamp(g, 0.0f, 1.0f), std::memory_order_relaxed);
}

// ---------- audio side ----------

float Synth::noise(std::uint32_t& s) const {
  // xorshift32: white noise from -1 to 1, the same spread as the web's Math.random() * 2 - 1
  s ^= s << 13; s ^= s >> 17; s ^= s << 5;
  return static_cast<float>(static_cast<double>(s) / 2147483648.0 - 1.0);
}

void Synth::start(const Command& c) {
  if (c.kind == Kind::Hush) {
    for (auto& v : voices_) v.kind = Kind::None;
    return;
  }
  Voice v;
  v.kind = c.kind;
  v.start = static_cast<std::int64_t>(c.at) + std::llround(std::max(0.0, c.delay) * sr_);
  // a command queued while the last render ran may already be late: start it now, from its beginning
  v.start = std::max(v.start, static_cast<std::int64_t>(frames_.load(std::memory_order_relaxed)));
  if (c.kind == Kind::Tone) {
    v.len = c.b; v.vol = c.c; v.f0 = c.a;
    if (c.d != 0) v.logRatio = std::log(std::max(kMinSlide, c.a + c.d) / c.a);
  } else if (c.kind == Kind::Click) {
    v.len = kClickLen; v.vol = c.a;
    v.filter = Biquad::bandpass(c.b, sr_, 2.5);
  } else {
    v.len = c.b;
    v.up = std::min(0.25, v.len * 0.15);
    v.down = std::min(0.35, v.len * 0.15);
    v.humRise = std::min(0.4, v.len * 0.2);
    v.humPhase = 0.5;   // the saw starts at zero
    v.filter = Biquad::lowpass(220, sr_);
  }
  v.end = v.start + std::max<std::int64_t>(1, std::llround(v.len * sr_));
  // each noisy voice reads its own stretch of noise, as the web starts each at a random offset
  seed_ = seed_ * 1664525u + 1013904223u;
  v.rng = seed_ | 1u;
  // a free voice, or else the one that ends soonest
  Voice* slot = nullptr;
  for (auto& s : voices_) {
    if (s.kind == Kind::None) { slot = &s; break; }
    if (!slot || s.end < slot->end) slot = &s;
  }
  *slot = v;
}

void Synth::mix(float* buf, std::size_t n) {
  const auto now = static_cast<std::int64_t>(frames_.load(std::memory_order_relaxed));
  const std::int64_t stop = now + static_cast<std::int64_t>(n);
  std::fill(buf, buf + n, 0.0f);
  std::size_t active = 0;
  for (auto& v : voices_) {
    if (v.kind == Kind::None) continue;
    if (v.end <= now) { v.kind = Kind::None; continue; }
    ++active;
    if (v.start >= stop) continue;
    const std::int64_t from = std::max(now, v.start), to = std::min(stop, v.end);
    for (std::int64_t f = from; f < to; ++f) {
      const double t = static_cast<double>(f - v.start) / sr_;   // seconds into the voice
      double s = 0;
      if (v.kind == Kind::Tone) {
        const double freq = v.logRatio != 0 ? v.f0 * std::exp(v.logRatio * t / v.len) : v.f0;
        const double dt = std::min(0.5, freq / sr_);
        s = (v.phase < 0.5 ? 1.0 : -1.0) + blep(v.phase, dt) - blep(wrap(v.phase + 0.5), dt);
        v.phase = wrap(v.phase + dt);
        // full volume to 85%, then a straight fall to the floor at the end
        const double rel = v.len * 0.85;
        const double g = t < rel ? v.vol : v.vol + (kFloor - v.vol) * ((t - rel) / (v.len - rel));
        s *= g;
      } else if (v.kind == Kind::Click) {
        const double g = expRamp(v.vol, kFloor, t / v.len);
        s = v.filter.step(noise(v.rng)) * g;
      } else {
        // the motor's swell: in over `up`, held, out over `down`, shared by the rumble and the hum
        double env;
        if (t < v.up) env = expRamp(kFloor, 1.0, t / v.up);
        else if (t < v.len - v.down) env = 1.0;
        else env = expRamp(1.0, kFloor, (t - (v.len - v.down)) / v.down);
        const double rumble = v.filter.step(noise(v.rng)) * kMotorGain;
        const double hz = 40 + 35 * std::min(1.0, v.humRise > 0 ? t / v.humRise : 1.0);
        const double dt = std::min(0.5, hz / sr_);
        const double saw = 2 * v.humPhase - 1 - blep(v.humPhase, dt);
        v.humPhase = wrap(v.humPhase + dt);
        s = (rumble + saw * kHumGain) * env;
      }
      buf[f - now] += static_cast<float>(s);
    }
    if (v.end <= stop) { v.kind = Kind::None; --active; }
  }
  active_.store(active, std::memory_order_relaxed);
  const double target = gainTarget_.load(std::memory_order_relaxed);
  for (std::size_t i = 0; i < n; ++i) {
    gain_ += (target - gain_) * gainCoef_;
    if (std::fabs(target - gain_) < 1e-6) gain_ = target;   // land on it, so gain 0 is true silence
    buf[i] = std::clamp(static_cast<float>(buf[i] * gain_), -1.0f, 1.0f);
  }
}

void Synth::render(float* out, std::size_t frames, int channels) {
  if (!out) return;
  if (channels < 1) channels = 1;
  Command c;
  while (pop(c)) start(c);
  float buf[kChunk];
  std::size_t done = 0;
  while (done < frames) {
    const std::size_t n = std::min(kChunk, frames - done);
    mix(buf, n);
    float* o = out + done * static_cast<std::size_t>(channels);
    for (std::size_t i = 0; i < n; ++i)
      for (int ch = 0; ch < channels; ++ch) *o++ = buf[i];
    done += n;
    frames_.store(frames_.load(std::memory_order_relaxed) + n, std::memory_order_release);
  }
}

}  // namespace pgd
