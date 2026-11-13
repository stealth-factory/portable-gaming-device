// QuickJS-ng behind ScriptHost (GAM-36). See include/pgd/script_host.hpp.
#include "pgd/script_host.hpp"

#include <chrono>
#include <cmath>
#include <cstdlib>
#include <new>
#include <cstring>
#include <limits>
#include <vector>

#include "pgd/text.hpp"
#include "quickjs.h"

namespace pgd {
namespace {

using Clock = std::chrono::steady_clock;

// Every block the engine allocates carries a header in front: its size, so the host can count the heap itself and
// refuse an allocation past the cap (QuickJS's own limit throws a catchable error; this one also stops the disk),
// and links to the other live blocks, so whatever the engine fails to free is freed with the host.
struct Block {
  std::size_t size;
  Block* prev;
  Block* next;
};
constexpr std::size_t kHeader = (sizeof(Block) + 15) / 16 * 16;

struct Heap {
  std::size_t used = 0, limit = 0;
  bool exceeded = false;
  Block* live = nullptr;
};

std::size_t& sizeOf(void* block) { return static_cast<Block*>(block)->size; }

void link(Heap* heap, Block* b) {
  b->prev = nullptr;
  b->next = heap->live;
  if (heap->live) heap->live->prev = b;
  heap->live = b;
}

void unlink(Heap* heap, Block* b) {
  if (b->prev) b->prev->next = b->next; else heap->live = b->next;
  if (b->next) b->next->prev = b->prev;
}

bool fits(Heap* heap, std::size_t freed, std::size_t wanted) {
  if (wanted > heap->limit || heap->used - freed > heap->limit - wanted) { heap->exceeded = true; return false; }
  return true;
}

void* heapMalloc(void* opaque, std::size_t size) {
  auto* heap = static_cast<Heap*>(opaque);
  if (!fits(heap, 0, size)) return nullptr;
  void* block = std::malloc(size + kHeader);
  if (!block) { heap->exceeded = true; return nullptr; }
  sizeOf(block) = size;
  link(heap, static_cast<Block*>(block));
  heap->used += size;
  return static_cast<char*>(block) + kHeader;
}

void* heapCalloc(void* opaque, std::size_t count, std::size_t size) {
  if (size && count > std::numeric_limits<std::size_t>::max() / size) { static_cast<Heap*>(opaque)->exceeded = true; return nullptr; }
  void* p = heapMalloc(opaque, count * size);
  if (p) std::memset(p, 0, count * size);
  return p;
}

void heapFree(void* opaque, void* ptr) {
  if (!ptr) return;
  auto* heap = static_cast<Heap*>(opaque);
  void* block = static_cast<char*>(ptr) - kHeader;
  heap->used -= sizeOf(block);
  unlink(heap, static_cast<Block*>(block));
  std::free(block);
}

void* heapRealloc(void* opaque, void* ptr, std::size_t size) {
  if (!ptr) return heapMalloc(opaque, size);
  if (!size) { heapFree(opaque, ptr); return nullptr; }
  auto* heap = static_cast<Heap*>(opaque);
  void* block = static_cast<char*>(ptr) - kHeader;
  const std::size_t old = sizeOf(block);
  if (!fits(heap, old, size)) return nullptr;
  unlink(heap, static_cast<Block*>(block));
  void* grown = std::realloc(block, size + kHeader);
  if (!grown) { link(heap, static_cast<Block*>(block)); heap->exceeded = true; return nullptr; }
  link(heap, static_cast<Block*>(grown));
  sizeOf(grown) = size;
  heap->used = heap->used - old + size;
  return static_cast<char*>(grown) + kHeader;
}

std::size_t heapUsable(const void* ptr) {
  return reinterpret_cast<const Block*>(static_cast<const char*>(ptr) - kHeader)->size;
}

const JSMallocFunctions kMalloc = { heapCalloc, heapMalloc, heapFree, heapRealloc, heapUsable };

class QuickJsHost final : public ScriptHost {
 public:
  QuickJsHost(const ScriptLimits& limits, std::uint32_t seed) : limits_(limits), seed_(seed) {
    heap_.limit = limits.heapBytes;
    rt_ = JS_NewRuntime2(&kMalloc, &heap_);
    if (!rt_) { stop(ScriptFault::Memory, "the script engine could not start"); return; }
    JS_SetRuntimeOpaque(rt_, this);
    JS_SetMaxStackSize(rt_, limits.stackBytes);
    JS_SetInterruptHandler(rt_, &QuickJsHost::interrupt, this);
    JS_SetHostPromiseRejectionTracker(rt_, &QuickJsHost::rejection, this);
    ctx_ = JS_NewContextRaw(rt_);
    // The language and nothing else: no Date, no performance, no WeakRef (garbage collection timing would leak).
    if (!ctx_ || JS_AddIntrinsicBaseObjects(ctx_) || JS_AddIntrinsicEval(ctx_) || JS_AddIntrinsicRegExp(ctx_) ||
        JS_AddIntrinsicJSON(ctx_) || JS_AddIntrinsicProxy(ctx_) || JS_AddIntrinsicMapSet(ctx_) ||
        JS_AddIntrinsicTypedArrays(ctx_) || JS_AddIntrinsicPromise(ctx_) || JS_AddIntrinsicAToB(ctx_)) {
      stop(ScriptFault::Memory, "the script context could not start");
      return;
    }
    JS_SetContextOpaque(ctx_, this);
    JSValue global = JS_GetGlobalObject(ctx_);
    JSValue math = JS_GetPropertyStr(ctx_, global, "Math");
    JS_SetPropertyStr(ctx_, math, "random", JS_NewCFunction(ctx_, &QuickJsHost::random, "random", 0));
    JS_SetPropertyStr(ctx_, global, "__pgdMeasure", JS_NewCFunction(ctx_, &QuickJsHost::measure, "__pgdMeasure", 2));
    JS_SetPropertyStr(ctx_, global, "__pgdLayerDiff", JS_NewCFunction(ctx_, &QuickJsHost::layerDiff, "__pgdLayerDiff", 2));
    // String.prototype.normalize reorders combining marks with an insertion sort the interrupt cannot stop, so a
    // long run of marks could hold the host far past the frame's time. Disks have no need for long ones.
    JSValue stringCtor = JS_GetPropertyStr(ctx_, global, "String");
    JSValue proto = JS_GetPropertyStr(ctx_, stringCtor, "prototype");
    normalize_ = JS_GetPropertyStr(ctx_, proto, "normalize");
    JS_DefinePropertyValueStr(ctx_, proto, "normalize", JS_NewCFunction(ctx_, &QuickJsHost::normalize, "normalize", 0),
                              JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE);
    JS_FreeValue(ctx_, proto);
    JS_FreeValue(ctx_, stringCtor);
    JS_FreeValue(ctx_, math);
    JS_FreeValue(ctx_, global);
  }

  ~QuickJsHost() override {
    if (ctx_) {
      for (auto& r : rejected_) { JS_FreeValue(ctx_, r.promise); JS_FreeValue(ctx_, r.reason); }
      JS_FreeValue(ctx_, normalize_);
      JS_FreeContext(ctx_);
    }
    if (rt_) JS_FreeRuntime(rt_);
    // anything the engine left allocated (a failure path that forgot a buffer) goes with the host
    while (heap_.live) { Block* b = heap_.live; heap_.live = b->next; std::free(b); }
  }

  bool evaluate(std::string_view source, std::string_view name) override {
    if (!begin()) return false;
    const std::string code(source), file(name);  // the engine wants both zero-terminated
    JSValue result = JS_Eval(ctx_, code.c_str(), code.size(), file.c_str(), JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(result)) return caught();
    JS_FreeValue(ctx_, result);
    return drainJobs() && settled();
  }

  bool call(std::string_view object, std::string_view method, std::string_view argJson, CommandFrame& out) override {
    if (!begin()) return false;
    JSValue global = JS_GetGlobalObject(ctx_);
    JSValue self = object.empty() ? JS_DupValue(ctx_, global) : JS_GetPropertyStr(ctx_, global, std::string(object).c_str());
    JS_FreeValue(ctx_, global);
    JSValue fn = JS_GetPropertyStr(ctx_, self, std::string(method).c_str());
    if (!JS_IsFunction(ctx_, fn)) {
      JS_FreeValue(ctx_, fn); JS_FreeValue(ctx_, self);
      if (JS_HasException(ctx_)) return caught();
      return stop(ScriptFault::Exception, std::string(object) + "." + std::string(method) + " is not a function");
    }
    const std::string json(argJson.empty() ? std::string_view("null") : argJson);
    JSValue arg = JS_ParseJSON(ctx_, json.c_str(), json.size(), "<input>");
    if (JS_IsException(arg)) { JS_FreeValue(ctx_, fn); JS_FreeValue(ctx_, self); return caught(); }
    JSValue result = JS_Call(ctx_, fn, self, 1, &arg);
    JS_FreeValue(ctx_, arg); JS_FreeValue(ctx_, fn); JS_FreeValue(ctx_, self);
    if (JS_IsException(result)) return caught();
    // promise reactions run before the frame is taken, as a browser runs microtasks before the next frame
    if (!drainJobs()) { JS_FreeValue(ctx_, result); return false; }
    bool ok = false;
    try {
      ok = copyFrame(result, out);
    } catch (const std::bad_alloc&) {
      out = CommandFrame{};
      ok = stop(ScriptFault::Memory, "the disk's frame did not fit in memory");
    }
    JS_FreeValue(ctx_, result);
    // reading the frame can run disk code too (a getter, a toJSON), so its promise work is drained before it is taken
    if (ok) ok = drainJobs();
    if (!ok) out = CommandFrame{};
    return ok && settled();
  }

  ScriptFault fault() const override { return fault_; }
  const std::string& message() const override { return message_; }
  std::size_t heapUsed() const override { return heap_.used; }

 private:
  bool begin() {
    if (fault_ != ScriptFault::None) return false;
    JS_UpdateStackTop(rt_);
    deadline_ = Clock::now() + std::chrono::duration_cast<Clock::duration>(std::chrono::duration<double, std::milli>(limits_.sliceMs));
    return true;
  }

  // A disk that caught the engine's own out-of-memory error and carried on is still stopped, and so is one whose time
  // ran out in native code the interrupt never saw.
  bool settled() {
    if (heap_.exceeded) return stop(ScriptFault::Memory, "the disk ran out of memory");
    if (timedOut_ || late()) return stop(ScriptFault::Timeout, "the disk ran too long");
    return true;
  }

  bool late() {
    if (Clock::now() > deadline_) timedOut_ = true;
    return timedOut_;
  }

  // Run every queued promise job, inside the same time limit; a job that throws stops the disk, and so does a
  // rejection nothing handled once the queue is empty (an error thrown in a .then callback or an async function).
  bool drainJobs() {
    for (;;) {
      JSContext* jobCtx = nullptr;
      const int ran = JS_ExecutePendingJob(rt_, &jobCtx);
      if (ran == 0) {
        if (rejected_.empty()) return true;
        if (!settled()) return false;
        return stop(ScriptFault::Exception, "unhandled promise rejection: " + describe(rejected_.front().reason));
      }
      if (ran < 0) return caught();
      if (heap_.exceeded || late()) return settled();
    }
  }

  bool stop(ScriptFault fault, std::string message) {
    fault_ = fault;
    message_ = std::move(message);
    return false;
  }

  bool caught() {
    JSValue error = JS_GetException(ctx_);
    std::string text = describe(error);
    JS_FreeValue(ctx_, error);
    if (heap_.exceeded) return stop(ScriptFault::Memory, "the disk ran out of memory: " + text);
    if (timedOut_) return stop(ScriptFault::Timeout, "the disk ran longer than " + std::to_string(static_cast<int>(limits_.sliceMs)) + " ms");
    return stop(ScriptFault::Exception, text);
  }

  std::string describe(JSValueConst value) {
    std::string text = str(value);
    if (JS_IsError(value)) {
      JSValue stack = JS_GetPropertyStr(ctx_, value, "stack");
      if (JS_IsString(stack)) text += "\n" + str(stack);
      JS_FreeValue(ctx_, stack);
    }
    if (JS_HasException(ctx_)) JS_FreeValue(ctx_, JS_GetException(ctx_));
    return text;
  }

  std::string str(JSValueConst value) {
    std::size_t length = 0;
    const char* chars = JS_ToCStringLen2(ctx_, &length, value, false);
    if (!chars) { if (JS_HasException(ctx_)) JS_FreeValue(ctx_, JS_GetException(ctx_)); return "(unprintable)"; }
    std::string text(chars, length);
    JS_FreeCString(ctx_, chars);
    return text;
  }

  bool bad(const char* why) { return stop(ScriptFault::Exception, std::string("the disk returned a bad frame: ") + why); }

  // Count `bytes` against the frame's budget (the disk's heap cap, as the copy is native memory the cap never sees),
  // and stop the disk when the frame is too big or its time has run out while it is copied.
  bool spend(std::size_t bytes) {
    if (bytes > limits_.heapBytes || frameBytes_ > limits_.heapBytes - bytes)
      return stop(ScriptFault::Memory, "the disk's frame is larger than its heap");
    frameBytes_ += bytes;
    if (late()) return stop(ScriptFault::Timeout, "the disk ran too long");
    return true;
  }

  // A value or C string released on every way out of a scope, including a std::bad_alloc from a native copy.
  struct Held {
    JSContext* ctx;
    JSValue v;
    Held(JSContext* c, JSValue value) : ctx(c), v(value) {}
    Held(const Held&) = delete;
    Held& operator=(const Held&) = delete;
    ~Held() { JS_FreeValue(ctx, v); }
  };
  struct HeldChars {
    JSContext* ctx;
    const char* chars;
    HeldChars(JSContext* c, const char* text) : ctx(c), chars(text) {}
    HeldChars(const HeldChars&) = delete;
    HeldChars& operator=(const HeldChars&) = delete;
    ~HeldChars() { if (chars) JS_FreeCString(ctx, chars); }
  };

  bool copyFrame(JSValueConst frame, CommandFrame& out) {
    out = CommandFrame{};
    frameBytes_ = 0;
    if (JS_IsUndefined(frame) || JS_IsNull(frame)) return true;
    if (!JS_IsObject(frame)) return bad("not an object");
    double v = 0;
    {
      Held version(ctx_, JS_GetPropertyStr(ctx_, frame, "version"));
      if (!JS_IsNumber(version.v) || JS_ToFloat64(ctx_, &v, version.v)) return bad("no version");
    }
    if (!std::isfinite(v) || !(v >= 1 && v <= 1000) || v != std::floor(v)) return bad("no version");
    out.version = static_cast<int>(v);

    {
      Held ops(ctx_, JS_GetPropertyStr(ctx_, frame, "ops"));
      bool ok = JS_GetTypedArrayType(ops.v) == JS_TYPED_ARRAY_FLOAT64;
      if (ok) {
        std::size_t offset = 0, bytes = 0, per = 0;
        Held buffer(ctx_, JS_GetTypedArrayBuffer(ctx_, ops.v, &offset, &bytes, &per));
        std::size_t size = 0;
        std::uint8_t* data = JS_IsException(buffer.v) ? nullptr : JS_GetArrayBuffer(ctx_, &size, buffer.v);
        ok = data && offset + bytes <= size && spend(bytes);
        if (ok) {
          out.ops.resize(bytes / sizeof(double));
          if (bytes) std::memcpy(out.ops.data(), data + offset, out.ops.size() * sizeof(double));
        }
      }
      if (fault_ != ScriptFault::None) return false;
      if (!ok) return bad("ops is not a Float64Array");
    }

    {
      Held strings(ctx_, JS_GetPropertyStr(ctx_, frame, "strings"));
      const bool ok = forEach(strings.v, [&](JSValueConst item) {
        if (!JS_IsString(item)) return false;
        std::size_t length = 0;
        HeldChars chars(ctx_, JS_ToCStringLen2(ctx_, &length, item, false));
        if (!chars.chars || !spend(length)) return false;
        out.strings.emplace_back(chars.chars, length);
        return true;
      });
      if (fault_ != ScriptFault::None) return false;
      if (JS_HasException(ctx_)) return caught();
      if (!ok) return bad("strings is not an array of strings");
    }

    {
      Held blobs(ctx_, JS_GetPropertyStr(ctx_, frame, "blobs"));
      const bool ok = forEach(blobs.v, [&](JSValueConst item) {
        if (JS_GetTypedArrayType(item) != JS_TYPED_ARRAY_UINT8) return false;
        std::size_t size = 0;
        std::uint8_t* data = JS_GetUint8Array(ctx_, &size, item);
        // a detached or out-of-bounds view gives no pointer and an exception; an empty array is fine
        if (!data && (size || JS_HasException(ctx_))) return false;
        if (!spend(size)) return false;
        out.blobs.emplace_back(data, data + size);
        return true;
      });
      if (fault_ != ScriptFault::None) return false;
      if (JS_HasException(ctx_)) return caught();
      if (!ok) return bad("blobs is not an array of Uint8Arrays");
    }

    Held state(ctx_, JS_GetPropertyStr(ctx_, frame, "state"));
    if (JS_IsUndefined(state.v)) return true;
    Held json(ctx_, JS_JSONStringify(ctx_, state.v, JS_UNDEFINED, JS_UNDEFINED));
    if (JS_IsException(json.v)) return caught();
    if (!JS_IsString(json.v)) return true;
    std::size_t length = 0;
    HeldChars chars(ctx_, JS_ToCStringLen2(ctx_, &length, json.v, false));
    if (!chars.chars) return caught();
    if (!spend(length)) return false;   // the state is copied out too, so it counts against the frame
    out.state.assign(chars.chars, length);
    return true;
  }

  template <typename Each>
  bool forEach(JSValueConst array, Each each) {
    if (!JS_IsArray(array)) return false;
    std::int64_t length = 0;
    if (JS_GetLength(ctx_, array, &length)) return false;
    for (std::int64_t i = 0; i < length; ++i) {
      if (!spend(sizeof(std::string))) return false;   // each entry costs something, even an empty one
      Held item(ctx_, JS_GetPropertyUint32(ctx_, array, static_cast<std::uint32_t>(i)));
      if (!each(item.v)) return false;
    }
    return true;
  }

  // Keeps the rejections nothing has handled yet; one handled later (a .catch added afterwards) is let go.
  static void rejection(JSContext* ctx, JSValueConst promise, JSValueConst reason, bool handled, void* opaque) {
    auto* self = static_cast<QuickJsHost*>(opaque);
    auto& list = self->rejected_;
    for (auto it = list.begin(); it != list.end(); ++it) {
      if (JS_VALUE_GET_PTR(it->promise) != JS_VALUE_GET_PTR(promise)) continue;
      if (!handled) return;
      JS_FreeValue(ctx, it->promise);
      JS_FreeValue(ctx, it->reason);
      list.erase(it);
      return;
    }
    if (!handled) list.push_back({ JS_DupValue(ctx, promise), JS_DupValue(ctx, reason) });
  }

  static int interrupt(JSContext*, void* opaque) {
    auto* self = static_cast<QuickJsHost*>(opaque);
    if (self->heap_.exceeded) return 1;
    if (Clock::now() > self->deadline_) { self->timedOut_ = true; return 1; }
    return 0;
  }

  // Mulberry32, the same sequence as tools/conformance/run.mjs gives Math.random.
  static JSValue random(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    auto* self = static_cast<QuickJsHost*>(JS_GetContextOpaque(ctx));
    std::uint32_t& a = self->seed_;
    a += 0x6D2B79F5u;
    std::uint32_t t = (a ^ (a >> 15)) * (1u | a);
    t = (t + ((t ^ (t >> 7)) * (61u | t))) ^ t;
    return JS_NewFloat64(ctx, static_cast<double>(t ^ (t >> 14)) / 4294967296.0);
  }

  // __pgdMeasure(text, size): the shared Silkscreen advances, for the shim's measurePixelText.
  static JSValue measure(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (argc < 2) return JS_ThrowTypeError(ctx, "__pgdMeasure needs text and a size");
    std::size_t length = 0;
    const char* chars = JS_ToCStringLen2(ctx, &length, argv[0], false);
    if (!chars) return JS_EXCEPTION;
    std::int32_t size = 8;
    if (JS_ToInt32(ctx, &size, argv[1])) { JS_FreeCString(ctx, chars); return JS_EXCEPTION; }
    auto* self = static_cast<QuickJsHost*>(JS_GetContextOpaque(ctx));
    // the measure is native, so the interrupt cannot stop it: refuse text no tube could show, and check the clock after
    if (length > kMaxMeasure) { JS_FreeCString(ctx, chars); return JS_ThrowRangeError(ctx, "__pgdMeasure: text too long"); }
    const double width = measureText(std::string_view(chars, length), size);
    JS_FreeCString(ctx, chars);
    if (self->late()) return JS_ThrowInternalError(ctx, "the disk ran too long");
    return JS_NewFloat64(ctx, width);
  }

  // String.prototype.normalize, refusing strings over kMaxNormalize code units (see the constructor).
  static JSValue normalize(JSContext* ctx, JSValueConst self, int argc, JSValueConst* argv) {
    auto* host = static_cast<QuickJsHost*>(JS_GetContextOpaque(ctx));
    // as the intrinsic does: null and undefined are refused, not turned into "null" and "undefined"
    if (JS_IsNull(self) || JS_IsUndefined(self)) return JS_ThrowTypeError(ctx, "normalize called on null or undefined");
    JSValue text = JS_ToString(ctx, self);
    if (JS_IsException(text)) return text;
    JSValue lengthValue = JS_GetPropertyStr(ctx, text, "length");
    std::int64_t length = 0;
    const bool measured = !JS_ToInt64(ctx, &length, lengthValue);
    JS_FreeValue(ctx, lengthValue);
    if (!measured) { JS_FreeValue(ctx, text); return JS_EXCEPTION; }
    if (length > static_cast<std::int64_t>(kMaxNormalize)) {
      JS_FreeValue(ctx, text);
      return JS_ThrowRangeError(ctx, "normalize: the string is too long for a disk");
    }
    JSValue result = JS_Call(ctx, host->normalize_, text, argc, argv);
    JS_FreeValue(ctx, text);
    return result;
  }

  // __pgdLayerDiff(px, sent): 0 when two Uint8Arrays match, else 1, or -1 when px holds an index above 3. The shim's
  // layer check in native code (see native/shim/shim.js).
  static JSValue layerDiff(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (argc < 2) return JS_ThrowTypeError(ctx, "__pgdLayerDiff needs two Uint8Arrays");
    std::size_t size = 0, sentSize = 0;
    const std::uint8_t* px = JS_GetUint8Array(ctx, &size, argv[0]);
    if (!px && size == 0 && JS_HasException(ctx)) return JS_EXCEPTION;
    const std::uint8_t* sent = JS_GetUint8Array(ctx, &sentSize, argv[1]);
    if (!sent && sentSize == 0 && JS_HasException(ctx)) return JS_EXCEPTION;
    if (size == sentSize && (size == 0 || std::memcmp(px, sent, size) == 0)) return JS_NewInt32(ctx, 0);
    for (std::size_t i = 0; i < size; ++i) if (px[i] > 3) return JS_NewInt32(ctx, -1);
    return JS_NewInt32(ctx, 1);
  }

  static constexpr std::size_t kMaxMeasure = 1u << 16;     // bytes of text __pgdMeasure takes
  static constexpr std::size_t kMaxNormalize = 1u << 12;   // code units String.prototype.normalize takes

  ScriptLimits limits_;
  std::uint32_t seed_;
  std::size_t frameBytes_ = 0;
  JSValue normalize_ = JS_UNDEFINED;
  struct Rejected { JSValue promise, reason; };
  std::vector<Rejected> rejected_;
  Heap heap_;
  JSRuntime* rt_ = nullptr;
  JSContext* ctx_ = nullptr;
  Clock::time_point deadline_{};
  bool timedOut_ = false;
  ScriptFault fault_ = ScriptFault::None;
  std::string message_;
};

}  // namespace

std::unique_ptr<ScriptHost> makeQuickJsHost(const ScriptLimits& limits, std::uint32_t seed) {
  return std::make_unique<QuickJsHost>(limits, seed);
}

const char* faultName(ScriptFault fault) {
  switch (fault) {
    case ScriptFault::None: return "none";
    case ScriptFault::Exception: return "exception";
    case ScriptFault::Timeout: return "timeout";
    case ScriptFault::Memory: return "memory";
  }
  return "unknown";
}

}  // namespace pgd
