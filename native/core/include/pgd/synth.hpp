// The console's sound as a software synth: the PC-speaker square waves and the floppy drive (GAM-35).
//
// The same sounds as the web console's Web Audio graph in `src/console/web/audio.ts`, rendered into a
// float buffer the shell pulls from its audio callback:
//
// - `tone`: a band-limited square wave with an optional exponential slide of its pitch, a delay, and the
//   web's envelope (full volume for 85% of the note, then a straight fall to silence at its end).
// - `click`: one head click, white noise through a band-pass filter (Q 2.5) with a fast exponential decay.
// - `motor`: the drive motor, white noise through a 220 Hz low-pass filter, with a sawtooth hum underneath
//   that rises from 40 to 75 Hz; both swell in, hold and fade out.
// - `hush`: cuts everything ringing or already scheduled, like the web's `hush()`.
//
// Threads: the control side (`tone`, `click`, `motor`, `hush`, `setMuted`, `setGain`) is meant for one
// thread, the game's; `render` is meant for one other thread, the audio callback. Commands cross between
// them through a fixed, lock-free queue, and `render` never allocates, locks or waits.
//
// Timing: a delay counts from the audio clock as it stood when the command was queued (`frames()`, the
// frames rendered so far), as the web's counts from `AudioContext.currentTime`. A voice ends where its
// envelope reaches the web's floor (0.0001); the web lets the oscillator run 20 to 50 ms longer at that
// level, which nobody can hear.
#pragma once
#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>

namespace pgd {

/** A second-order IIR filter with Web Audio's BiquadFilterNode coefficients (the RBJ cookbook). */
struct Biquad {
  double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  double z1 = 0, z2 = 0;
  /** Web Audio's 'lowpass': `q` is in decibels, as the Web Audio spec has it (default 1). */
  static Biquad lowpass(double freq, double sampleRate, double qDb = 1);
  /** Web Audio's 'bandpass' (0 dB at the centre): `q` is the plain quality factor. */
  static Biquad bandpass(double freq, double sampleRate, double q);
  double step(double x) {
    const double y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    return y;
  }
};

class Synth {
 public:
  /** Commands that can wait in the queue between two renders. A load schedules about 150 at once. */
  static constexpr std::size_t kQueue = 1024;
  /** Voices sounding or scheduled at once. When all are taken, the one that ends soonest gives way. */
  static constexpr std::size_t kVoices = 256;

  explicit Synth(double sampleRate, std::uint32_t seed = 0x2545F491u);
  Synth(const Synth&) = delete;
  Synth& operator=(const Synth&) = delete;

  // ---- control side ----
  // Each returns false when the sound is dropped: muted, a value that is not finite, a length or pitch
  // that is not positive, a click volume that is not above 0, or a full queue. A negative delay plays now.

  /** A square-wave note: `freq` Hz for `dur` seconds at `vol`, sliding to max(40, freq + slide) Hz by its end. */
  bool tone(double freq, double dur, double vol = 0.045, double slide = 0, double delay = 0);
  /** One head click `delay` seconds from now: noise through a band-pass at `freq` Hz, decaying in 18 ms. */
  bool click(double delay, double vol = 0.22, double freq = 2600);
  /** The drive motor running for `dur` seconds from `start` seconds from now. */
  bool motor(double start, double dur);
  /** Cut every sound ringing or scheduled so far. Sounds asked for after it play as usual. */
  bool hush();
  /** While muted, new sounds are dropped (the SOUND switch); sounds already playing carry on, as on the web. */
  void setMuted(bool m) { muted_.store(m, std::memory_order_relaxed); }
  bool muted() const { return muted_.load(std::memory_order_relaxed); }
  /** The master gain, 0 to 1, eased over about 5 ms so a pause never clicks. */
  void setGain(float g);
  float gain() const { return gainTarget_.load(std::memory_order_relaxed); }

  // ---- audio side ----

  /** Mix the next `frames` frames into `out`, overwriting it: `channels` interleaved copies of the mono
      mix, each sample clamped to -1..1. */
  void render(float* out, std::size_t frames, int channels = 1);

  /** Frames rendered so far: the audio clock that delays count from. Safe from either thread. */
  std::uint64_t frames() const { return frames_.load(std::memory_order_acquire); }
  double sampleRate() const { return sr_; }
  /** Voices sounding or waiting to start, as of the last render (for tests and debugging). */
  std::size_t activeVoices() const { return active_.load(std::memory_order_relaxed); }

 private:
  enum class Kind : std::uint8_t { None, Tone, Click, Motor, Hush };
  struct Command {
    Kind kind = Kind::None;
    std::uint64_t at = 0;   // the audio clock when it was queued
    double a = 0, b = 0, c = 0, d = 0, delay = 0;
  };
  struct Voice {
    Kind kind = Kind::None;
    std::int64_t start = 0, end = 0;   // absolute frames, end exclusive
    double len = 0;                    // seconds
    double vol = 0;
    double f0 = 0, logRatio = 0;       // tone: pitch and the slide's log(f1 / f0)
    double phase = 0, humPhase = 0;
    double up = 0, down = 0, humRise = 0;   // motor envelope times, seconds
    std::uint32_t rng = 1;
    Biquad filter;
  };

  bool push(const Command& c);
  bool pop(Command& c);
  std::size_t queued() const;
  void start(const Command& c);
  void mix(float* buf, std::size_t n);
  float noise(std::uint32_t& s) const;

  double sr_;
  std::uint32_t seed_;
  std::array<Command, kQueue> queue_{};
  std::atomic<std::size_t> head_{0}, tail_{0};
  std::array<Voice, kVoices> voices_{};
  std::atomic<std::uint64_t> frames_{0};
  std::atomic<std::size_t> active_{0};
  std::atomic<bool> muted_{false};
  std::atomic<float> gainTarget_{1.0f};
  double gain_ = 1.0, gainCoef_ = 0;
};

static_assert(std::atomic<std::uint64_t>::is_always_lock_free, "the synth's audio clock must be lock-free");
static_assert(std::atomic<std::size_t>::is_always_lock_free, "the synth's command queue must be lock-free");

}  // namespace pgd
