// The script host the apps run game disks in (GAM-36): a fresh JavaScript context per loaded disk, with only the
// language's own objects plus atob, btoa, a seeded Math.random and the font measure the shim asks for. No Date,
// no performance, no timers, no fetch, no storage, no console. QuickJS-ng is the engine (third_party/quickjs-ng);
// the interface stays engine-neutral so JavaScriptCore could stand in.
#pragma once
#include <cstddef>
#include <cstdint>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace pgd {

/** What a disk may spend. A call that runs past `sliceMs`, or an allocation past `heapBytes`, stops the disk. */
struct ScriptLimits {
  double sliceMs = 100;                   // script time per call (one frame's update and draw is one call)
  std::size_t heapBytes = 64u << 20;      // everything the engine allocates for this disk
  std::size_t stackBytes = 256u << 10;    // the engine's own recursion limit; the calling thread needs more than this
};

/** Why a disk stopped. Any fault is final: the host refuses every later call, and the console shows DISK ERROR. */
enum class ScriptFault { None, Exception, Timeout, Memory };

/** One frame from the contract shim's command buffer (native/shim/README.md), copied out of the engine. */
struct CommandFrame {
  int version = 0;
  std::vector<double> ops;
  std::vector<std::string> strings;
  std::vector<std::vector<std::uint8_t>> blobs;
  std::string state;  // the frame's `state` field as JSON, or empty when it has none
};

class ScriptHost {
 public:
  virtual ~ScriptHost() = default;

  /** Run a plain script in the global scope, as a browser runs a classic <script>. */
  virtual bool evaluate(std::string_view source, std::string_view name) = 0;

  /** Call `object.method(JSON.parse(argJson))` on a global object (or a global function when `object` is empty)
      and copy the command frame it returns into `out`. One crossing in, one out. */
  virtual bool call(std::string_view object, std::string_view method, std::string_view argJson, CommandFrame& out) = 0;

  virtual ScriptFault fault() const = 0;
  /** The thrown value as text (with its stack where the engine has one), or why the disk was stopped. */
  virtual const std::string& message() const = 0;
  /** Bytes the engine holds for this disk now. */
  virtual std::size_t heapUsed() const = 0;
};

/** A fresh QuickJS-ng runtime and context. `seed` seeds Math.random (Mulberry32, as tools/conformance does). */
std::unique_ptr<ScriptHost> makeQuickJsHost(const ScriptLimits& limits, std::uint32_t seed);

const char* faultName(ScriptFault fault);

}  // namespace pgd
