#include <atomic>
#include <cmath>
#include <thread>
#include <vector>

#include "check.hpp"
#include "pgd/synth.hpp"

using pgd::Synth;

namespace {
constexpr double kRate = 48000;

std::vector<float> run(Synth& s, std::size_t frames, std::size_t block = 512) {
  std::vector<float> out(frames);
  for (std::size_t i = 0; i < frames; i += block) s.render(out.data() + i, std::min(block, frames - i));
  return out;
}
std::size_t at(double seconds) { return static_cast<std::size_t>(std::llround(seconds * kRate)); }
bool silent(const std::vector<float>& v, std::size_t from, std::size_t to) {
  for (std::size_t i = from; i < to && i < v.size(); ++i) if (v[i] != 0.0f) return false;
  return true;
}
double peak(const std::vector<float>& v, std::size_t from, std::size_t to) {
  double p = 0;
  for (std::size_t i = from; i < to && i < v.size(); ++i) p = std::max(p, double(std::fabs(v[i])));
  return p;
}
double rms(const std::vector<float>& v, std::size_t from, std::size_t to) {
  double e = 0;
  for (std::size_t i = from; i < to; ++i) e += double(v[i]) * v[i];
  return std::sqrt(e / double(to - from));
}
/** Pitch in Hz from the falling zero crossings of a square wave between two frames. */
double pitch(const std::vector<float>& v, std::size_t from, std::size_t to) {
  std::size_t first = 0, last = 0, n = 0;
  for (std::size_t i = from + 1; i < to; ++i)
    if (v[i - 1] > 0 && v[i] <= 0) { if (!n) first = i; last = i; ++n; }
  return n < 2 ? 0 : kRate * double(n - 1) / double(last - first);
}
}  // namespace

TEST("synth: a new synth is silent") {
  Synth s(kRate);
  const auto out = run(s, 4800);
  CHECK(silent(out, 0, out.size()));
  CHECK_EQ(s.frames(), std::uint64_t(4800));
}

TEST("synth: a tone lasts exactly its length, then stops") {
  Synth s(kRate);
  CHECK(s.tone(440, 0.1));
  const auto out = run(s, at(0.3));
  // sounding through to the last frame of its 0.1 s, silent from then on
  std::size_t lastSound = 0, sounding = 0;
  for (std::size_t i = 0; i < out.size(); ++i) if (out[i] != 0.0f) { lastSound = i; ++sounding; }
  CHECK(lastSound >= at(0.1) - 3 && lastSound < at(0.1));
  CHECK(sounding > at(0.1) * 98 / 100);
  CHECK(silent(out, at(0.1), out.size()));
  CHECK_EQ(s.activeVoices(), std::size_t(0));
}

TEST("synth: a delayed tone is silent until its delay") {
  Synth s(kRate);
  CHECK(s.tone(1000, 0.2, 0.05, 0, 0.85));   // the cold boot's POST beep
  const auto out = run(s, at(1.2));
  CHECK(silent(out, 0, at(0.85)));
  CHECK(peak(out, at(0.85), at(0.86)) > 0.04);
  CHECK(silent(out, at(1.05), out.size()));
}

TEST("synth: a tone holds its volume, then falls to nothing over the last 15%") {
  Synth s(kRate);
  CHECK(s.tone(500, 0.2, 0.05));
  const auto out = run(s, at(0.2));
  CHECK(std::fabs(rms(out, at(0.02), at(0.16)) - 0.05) < 0.002);   // a square's RMS is its amplitude
  const double early = peak(out, at(0.171), at(0.176)), late = peak(out, at(0.193), at(0.198));
  CHECK(early > late * 2);
  CHECK(late < 0.02);
}

TEST("synth: a tone plays at its pitch") {
  Synth s(kRate);
  CHECK(s.tone(440, 0.5));
  const auto out = run(s, at(0.5));
  CHECK(std::fabs(pitch(out, at(0.05), at(0.4)) - 440) < 1);
}

TEST("synth: a slide sweeps the pitch exponentially to its target") {
  Synth s(kRate);
  CHECK(s.tone(400, 1.0, 0.045, 400));   // 400 Hz to 800 Hz over a second
  const auto out = run(s, at(1.0));
  CHECK(std::fabs(pitch(out, 0, at(0.03)) - 410) < 15);
  // exponential: half way along is the geometric mean, 566 Hz, not the arithmetic 600
  CHECK(std::fabs(pitch(out, at(0.485), at(0.515)) - 566) < 15);
  CHECK(std::fabs(pitch(out, at(0.94), at(0.97)) - 780) < 25);
}

TEST("synth: a slide down stops at 40 Hz, as the web's does") {
  Synth s(kRate);
  CHECK(s.tone(200, 1.0, 0.045, -500));
  const auto out = run(s, at(1.0));
  // 200 × 0.2^t: about 45 Hz on average over the last 15%, where an unclamped slide would be gone
  CHECK(std::fabs(pitch(out, at(0.85), at(0.999)) - 45) < 3);
}

TEST("synth: a muted synth drops new sounds but lets ringing ones finish") {
  Synth s(kRate);
  CHECK(s.tone(440, 0.2));
  auto first = run(s, at(0.05));
  s.setMuted(true);
  CHECK(!s.tone(880, 0.2));
  CHECK(!s.click(0));
  CHECK(!s.motor(0, 1));
  auto rest = run(s, at(0.3));
  CHECK(peak(rest, 0, at(0.1)) > 0.04);   // the first tone carries on
  CHECK(silent(rest, at(0.15), rest.size()));
  s.setMuted(false);
  CHECK(s.tone(880, 0.1));
}

TEST("synth: hush cuts what is ringing and what is scheduled, not what comes after") {
  Synth s(kRate);
  CHECK(s.tone(440, 1.0));
  CHECK(s.motor(0.5, 2.0));
  for (int i = 0; i < 20; ++i) CHECK(s.click(0.6 + i * 0.05));
  run(s, at(0.1));
  CHECK(s.activeVoices() > 0);
  CHECK(s.hush());
  auto out = run(s, at(3.0));
  CHECK(silent(out, 0, out.size()));
  CHECK_EQ(s.activeVoices(), std::size_t(0));
  CHECK(s.hush());
  CHECK(s.tone(440, 0.1));
  out = run(s, at(0.1));
  CHECK(peak(out, 0, out.size()) > 0.04);
}

TEST("synth: gain 0 is silence, and gain eases back in without a jump") {
  Synth s(kRate);
  s.setGain(0);
  CHECK(s.tone(440, 1.0, 0.5));
  auto out = run(s, at(0.2));
  CHECK(peak(out, at(0.1), out.size()) == 0.0);
  s.setGain(1);
  out = run(s, at(0.1));
  CHECK(peak(out, 0, 24) < 0.1);           // the first half millisecond is still quiet
  CHECK(peak(out, at(0.05), out.size()) > 0.45);
}

TEST("synth: a head click is a burst of filtered noise, gone in 18 ms") {
  Synth s(kRate);
  CHECK(s.click(0.01, 0.22, 2600));
  const auto out = run(s, at(0.1));
  CHECK(silent(out, 0, at(0.01)));
  CHECK(peak(out, at(0.01), at(0.014)) > 0.01);
  CHECK(silent(out, at(0.01) + at(0.018), out.size()));
}

TEST("synth: the motor swells, holds and fades for exactly its length") {
  Synth s(kRate);
  CHECK(s.motor(0.1, 2.0));
  const auto out = run(s, at(2.5));
  CHECK(silent(out, 0, at(0.1)));
  const double start = rms(out, at(0.1), at(0.11)), held = rms(out, at(1.0), at(1.2));
  CHECK(held > 0.005);
  CHECK(start < held);
  CHECK(rms(out, at(2.09), at(2.1)) < held);
  CHECK(silent(out, at(2.1), out.size()));
}

TEST("synth: the rumble and hum each ramp to their own level, as the web schedules them") {
  Synth s(kRate);
  CHECK(s.motor(0, 3.0));   // spin-up over 0.25 s
  const auto out = run(s, at(3.0));
  // half way up, each part is at the geometric mean of the floor and its own peak: the rumble at 2.5%
  // of its held level and the hum at 9%. One shared ramp scaled afterwards would give 1% for both.
  const double ratio = rms(out, at(0.12), at(0.13)) / rms(out, at(1.0), at(1.5));
  CHECK(ratio > 0.018 && ratio < 0.1);
}

TEST("synth: a click at no volume or below is refused, and the mix stays finite") {
  Synth s(kRate);
  CHECK(!s.click(0, 0));
  CHECK(!s.click(0, -0.2));
  CHECK(s.tone(440, 0.05));
  const auto out = run(s, at(0.05));
  bool finiteAll = true;
  for (float v : out) finiteAll = finiteAll && std::isfinite(v);
  CHECK(finiteAll);
  CHECK(peak(out, 0, out.size()) > 0.04);
}

TEST("synth: a whole disk load fits the queue and voices") {
  Synth s(kRate);
  CHECK(s.motor(1.0, 2.55));
  int queued = 0, asked = 0;
  for (double t = 1.12; t < 3.5; t += 0.013, ++asked) queued += s.click(t, 0.18, 1900);
  CHECK_EQ(queued, asked);
  CHECK(asked > 150);
  const auto out = run(s, at(4.0));
  CHECK(peak(out, 0, out.size()) <= 1.0);
  CHECK(silent(out, at(3.56), out.size()));
}

TEST("synth: a full queue drops sounds instead of blocking") {
  Synth s(kRate);
  std::size_t ok = 0;
  for (std::size_t i = 0; i < Synth::kQueue + 10; ++i) ok += s.click(1.0);
  CHECK_EQ(ok, Synth::kQueue);
  run(s, 64);
  CHECK(s.click(1.0));
}

TEST("synth: hush still cuts when the queue is full, and keeps what comes after") {
  Synth s(kRate);
  std::size_t ok = 0;
  for (std::size_t i = 0; i < Synth::kQueue + 10; ++i) ok += s.click(0.01 + double(i % 50) * 0.01);
  CHECK_EQ(ok, Synth::kQueue);
  CHECK(s.hush());
  auto out = run(s, at(1.0));
  CHECK(silent(out, 0, out.size()));
  CHECK_EQ(s.activeVoices(), std::size_t(0));
  CHECK(s.tone(440, 0.1));
  out = run(s, at(0.1));
  CHECK(peak(out, 0, out.size()) > 0.04);
}

TEST("synth: a hush cuts only what was queued before it, even before a render") {
  Synth s(kRate);
  CHECK(s.tone(220, 0.5));
  CHECK(s.hush());
  CHECK(s.tone(440, 0.5));
  const auto out = run(s, at(0.4));
  CHECK(pitch(out, at(0.05), at(0.35)) > 400);
}

TEST("synth: delays and lengths over an hour are refused") {
  Synth s(kRate);
  CHECK(!s.motor(1e14, 1e14));
  CHECK(!s.motor(0, 3601));
  CHECK(!s.tone(440, 1e14));
  CHECK(!s.tone(440, 0.1, 0.045, 0, 1e14));
  CHECK(!s.click(1e14));
  CHECK(s.motor(3600, 3600));
  run(s, 64);
}

TEST("synth: huge volumes and tiny clicks keep the mix finite") {
  Synth s(kRate);
  CHECK(s.tone(440, 0.05, 1e39));
  CHECK(s.click(0, 1e-320));
  s.setGain(0);
  const auto out = run(s, at(0.05));
  bool finiteAll = true;
  for (float v : out) finiteAll = finiteAll && std::isfinite(v);
  CHECK(finiteAll);
  CHECK(peak(out, 0, out.size()) <= 1.0);
  Synth q(kRate);
  CHECK(q.click(0, 1e-320));
  const auto quiet = run(q, at(0.02));
  CHECK(peak(quiet, 0, quiet.size()) < 1e-3);
}

TEST("synth: bad values are refused") {
  Synth s(kRate);
  CHECK(!s.tone(0, 0.1));
  CHECK(!s.tone(-440, 0.1));
  CHECK(!s.tone(440, 0));
  CHECK(!s.tone(NAN, 0.1));
  CHECK(!s.tone(440, INFINITY));
  CHECK(!s.click(NAN));
  CHECK(!s.motor(0, -1));
  CHECK(s.tone(440, 0.1, 0.045, 0, -1));   // a delay in the past plays now
  const auto out = run(s, 16);
  CHECK(peak(out, 0, out.size()) > 0.04);
}

TEST("synth: loud chords are clamped to -1..1") {
  Synth s(kRate);
  for (int i = 0; i < 8; ++i) CHECK(s.tone(100 + i * 37, 0.1, 0.5));
  const auto out = run(s, at(0.1));
  CHECK(peak(out, 0, out.size()) <= 1.0);
  CHECK(peak(out, 0, out.size()) > 0.9);
}

TEST("synth: interleaved channels carry the same mix") {
  Synth s(kRate);
  CHECK(s.tone(440, 0.05));
  std::vector<float> out(2 * at(0.05));
  s.render(out.data(), at(0.05), 2);
  bool same = true;
  for (std::size_t i = 0; i < out.size(); i += 2) same = same && out[i] == out[i + 1];
  CHECK(same);
  CHECK(peak(out, 0, out.size()) > 0.04);
}

TEST("synth: the result does not depend on the size of the audio callback") {
  Synth a(kRate, 7), b(kRate, 7);
  for (Synth* s : { &a, &b }) { s->tone(660, 0.3, 0.05, -200, 0.02); s->click(0.05); s->motor(0.1, 0.6); }
  const auto x = run(a, at(0.8), 4096), y = run(b, at(0.8), 37);
  bool same = true;
  for (std::size_t i = 0; i < x.size(); ++i) same = same && x[i] == y[i];
  CHECK(same);
}

TEST("synth: the game thread can queue while the audio thread renders") {
  Synth s(kRate);
  std::atomic<bool> done{false};
  std::thread audio([&] {
    std::vector<float> buf(256);
    while (!done.load()) s.render(buf.data(), buf.size());
    for (int i = 0; i < 400; ++i) s.render(buf.data(), buf.size());   // let everything finish
  });
  int queued = 0;
  for (int i = 0; i < 5000; ++i) queued += s.tone(200 + i % 500, 0.01, 0.01) + s.click(0.001);
  done.store(true);
  audio.join();
  CHECK(queued > 0);
  CHECK_EQ(s.activeVoices(), std::size_t(0));
}
