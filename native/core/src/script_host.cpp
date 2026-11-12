// QuickJS-ng behind ScriptHost (GAM-36). See include/pgd/script_host.hpp.
#include "pgd/script_host.hpp"

#include <chrono>
#include <cstdlib>
#include <cstring>
#include <limits>

#include "pgd/text.hpp"
#include "quickjs.h"

namespace pgd {
namespace {

using Clock = std::chrono::steady_clock;

// Every block the engine allocates carries its size in front, so the host can count the heap itself and refuse an
// allocation past the cap (QuickJS's own limit throws a catchable error; this one also stops the disk).
constexpr std::size_t kHeader = 16;

struct Heap {
  std::size_t used = 0, limit = 0;
  bool exceeded = false;
};

std::size_t& sizeOf(void* block) { return *static_cast<std::size_t*>(block); }

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
  void* block = static_cast<char*>(ptr) - kHeader;
  static_cast<Heap*>(opaque)->used -= sizeOf(block);
  std::free(block);
}

void* heapRealloc(void* opaque, void* ptr, std::size_t size) {
  if (!ptr) return heapMalloc(opaque, size);
  if (!size) { heapFree(opaque, ptr); return nullptr; }
  auto* heap = static_cast<Heap*>(opaque);
  void* block = static_cast<char*>(ptr) - kHeader;
  const std::size_t old = sizeOf(block);
  if (!fits(heap, old, size)) return nullptr;
  void* grown = std::realloc(block, size + kHeader);
  if (!grown) { heap->exceeded = true; return nullptr; }
  sizeOf(grown) = size;
  heap->used = heap->used - old + size;
  return static_cast<char*>(grown) + kHeader;
}

std::size_t heapUsable(const void* ptr) {
  return *reinterpret_cast<const std::size_t*>(static_cast<const char*>(ptr) - kHeader);
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
    JS_FreeValue(ctx_, math);
    JS_FreeValue(ctx_, global);
  }

  ~QuickJsHost() override {
    if (ctx_) JS_FreeContext(ctx_);
    if (rt_) JS_FreeRuntime(rt_);
  }

  bool evaluate(std::string_view source, std::string_view name) override {
    if (!begin()) return false;
    const std::string code(source), file(name);  // the engine wants both zero-terminated
    JSValue result = JS_Eval(ctx_, code.c_str(), code.size(), file.c_str(), JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(result)) return caught();
    JS_FreeValue(ctx_, result);
    return settled();
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
    const bool ok = copyFrame(result, out);
    JS_FreeValue(ctx_, result);
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

  // A disk that caught the engine's own out-of-memory error and carried on is still stopped.
  bool settled() {
    if (heap_.exceeded) return stop(ScriptFault::Memory, "the disk ran out of memory");
    if (timedOut_) return stop(ScriptFault::Timeout, "the disk ran too long");
    return true;
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

  bool copyFrame(JSValueConst frame, CommandFrame& out) {
    out = CommandFrame{};
    if (JS_IsUndefined(frame) || JS_IsNull(frame)) return true;
    if (!JS_IsObject(frame)) return bad("not an object");
    JSValue version = JS_GetPropertyStr(ctx_, frame, "version");
    double v = 0;
    const bool versionOk = JS_IsNumber(version) && !JS_ToFloat64(ctx_, &v, version);
    JS_FreeValue(ctx_, version);
    if (!versionOk || v < 1 || v > 1000 || v != static_cast<int>(v)) return bad("no version");
    out.version = static_cast<int>(v);

    JSValue ops = JS_GetPropertyStr(ctx_, frame, "ops");
    bool ok = JS_GetTypedArrayType(ops) == JS_TYPED_ARRAY_FLOAT64;
    if (ok) {
      std::size_t offset = 0, bytes = 0, per = 0;
      JSValue buffer = JS_GetTypedArrayBuffer(ctx_, ops, &offset, &bytes, &per);
      std::size_t size = 0;
      std::uint8_t* data = JS_IsException(buffer) ? nullptr : JS_GetArrayBuffer(ctx_, &size, buffer);
      ok = data && offset + bytes <= size;
      if (ok) {
        out.ops.resize(bytes / sizeof(double));
        if (bytes) std::memcpy(out.ops.data(), data + offset, out.ops.size() * sizeof(double));
      }
      JS_FreeValue(ctx_, buffer);
    }
    JS_FreeValue(ctx_, ops);
    if (!ok) return bad("ops is not a Float64Array");

    JSValue strings = JS_GetPropertyStr(ctx_, frame, "strings");
    ok = forEach(strings, [&](JSValueConst item) {
      if (!JS_IsString(item)) return false;
      out.strings.push_back(str(item));
      return true;
    });
    JS_FreeValue(ctx_, strings);
    if (!ok) return bad("strings is not an array of strings");

    JSValue blobs = JS_GetPropertyStr(ctx_, frame, "blobs");
    ok = forEach(blobs, [&](JSValueConst item) {
      if (JS_GetTypedArrayType(item) != JS_TYPED_ARRAY_UINT8) return false;
      std::size_t size = 0;
      std::uint8_t* data = JS_GetUint8Array(ctx_, &size, item);
      if (!data && size) return false;
      out.blobs.emplace_back(data, data + size);
      return true;
    });
    JS_FreeValue(ctx_, blobs);
    if (!ok) return bad("blobs is not an array of Uint8Arrays");

    JSValue state = JS_GetPropertyStr(ctx_, frame, "state");
    if (!JS_IsUndefined(state)) {
      JSValue json = JS_JSONStringify(ctx_, state, JS_UNDEFINED, JS_UNDEFINED);
      if (JS_IsException(json)) { JS_FreeValue(ctx_, state); return caught(); }
      if (JS_IsString(json)) out.state = str(json);
      JS_FreeValue(ctx_, json);
    }
    JS_FreeValue(ctx_, state);
    return true;
  }

  template <typename Each>
  bool forEach(JSValueConst array, Each each) {
    if (!JS_IsArray(array)) return false;
    std::int64_t length = 0;
    if (JS_GetLength(ctx_, array, &length)) return false;
    for (std::int64_t i = 0; i < length; ++i) {
      JSValue item = JS_GetPropertyUint32(ctx_, array, static_cast<std::uint32_t>(i));
      const bool ok = each(item);
      JS_FreeValue(ctx_, item);
      if (!ok) return false;
    }
    return true;
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
    const double width = measureText(std::string_view(chars, length), size);
    JS_FreeCString(ctx, chars);
    return JS_NewFloat64(ctx, width);
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

  ScriptLimits limits_;
  std::uint32_t seed_;
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
