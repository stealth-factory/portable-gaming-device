// The script host (GAM-36): a fresh, bare context per disk, the frame crossing, and every way a disk is stopped.
#include <chrono>
#include <string>

#include "check.hpp"
#include "pgd/script_host.hpp"

using pgd::CommandFrame;
using pgd::ScriptFault;
using pgd::ScriptLimits;

#define CHECK_STR(a, b) do { const std::string va_ = (a), vb_ = (b); if (va_ != vb_) { std::printf("  %s:%d: %s == %s failed (%s vs %s)\n", __FILE__, __LINE__, #a, #b, va_.c_str(), vb_.c_str()); ++pgdtest::failures(); } } while (0)

namespace {
/** Evaluate `body` as a function returning a frame's state, and return that state's JSON ("" on a fault). */
std::string probe(pgd::ScriptHost& host, const std::string& body) {
  CommandFrame frame;
  const std::string code = "globalThis.probe = function (arg) { return { version: 1, ops: new Float64Array(0), "
                           "strings: [], blobs: [], state: (function () { " + body + " })() }; };";
  if (!host.evaluate(code, "probe.js") || !host.call("", "probe", "null", frame)) return "";
  return frame.state;
}
double ms(std::chrono::steady_clock::time_point since) {
  return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - since).count();
}
}  // namespace

TEST("script host: the frame crosses out with its ops, strings, blobs and state") {
  auto host = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK(host->evaluate("var Game = { tick: function (n) { return { version: 1, ops: new Float64Array([1, 4, 0, n, 0, 2.5, 0, -3, 0, 4e9]),"
                       " strings: ['a', 'é漢'], blobs: [new Uint8Array([0, 1, 2, 3])], state: { n: n } }; } };", "game.js"));
  CommandFrame frame;
  CHECK(host->call("Game", "tick", "7", frame));
  CHECK_EQ(frame.version, 1);
  CHECK_EQ(frame.ops.size(), std::size_t{10});
  CHECK_EQ(frame.ops[3], 7.0);
  CHECK_EQ(frame.ops[5], 2.5);
  CHECK_EQ(frame.ops[9], 4e9);
  CHECK(frame.strings.size() == 2 && frame.strings[1] == "\xC3\xA9\xE6\xBC\xA2");
  CHECK(frame.blobs.size() == 1 && frame.blobs[0] == std::vector<std::uint8_t>({ 0, 1, 2, 3 }));
  CHECK(frame.state == "{\"n\":7}");
  // A view onto part of a buffer copies only that part.
  CHECK(host->evaluate("Game.part = function () { var all = new Float64Array([9, 1, 2, 3]); return { version: 1, ops: all.subarray(1, 3), strings: [], blobs: [] }; };", "part.js"));
  CHECK(host->call("Game", "part", "", frame));
  CHECK(frame.ops == std::vector<double>({ 1, 2 }));
  CHECK(frame.state.empty());
  CHECK_EQ(static_cast<int>(host->fault()), static_cast<int>(ScriptFault::None));
}

TEST("script host: only the language, atob, btoa and the host's measure in the global scope") {
  auto host = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK_STR(probe(*host, "return [typeof Date, typeof performance, typeof setTimeout, typeof fetch, typeof console, typeof require, typeof WeakRef];"),
           std::string("[\"undefined\",\"undefined\",\"undefined\",\"undefined\",\"undefined\",\"undefined\",\"undefined\"]"));
  CHECK_STR(probe(*host, "return [btoa('PGD'), atob('UEdE'), typeof Proxy, typeof WeakMap, typeof Float64Array, JSON.stringify(/a+/.exec('caab'))];"),
           std::string("[\"UEdE\",\"PGD\",\"function\",\"function\",\"function\",\"[\\\"aa\\\"]\"]"));
  CHECK_STR(probe(*host, "return [__pgdMeasure('PGD', 8), __pgdMeasure('PGD', 16)];"), std::string("[18,36]"));
}

TEST("script host: __pgdLayerDiff answers the shim's layer check") {
  auto host = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK_STR(probe(*host, "var a = new Uint8Array([0, 1, 2, 3]), b = new Uint8Array(a), c = new Uint8Array([0, 1, 2, 2]), d = new Uint8Array([4, 1, 2, 3]);"
                         " return [__pgdLayerDiff(a, b), __pgdLayerDiff(c, a), __pgdLayerDiff(d, a), __pgdLayerDiff(new Uint8Array(0), new Uint8Array(0)), __pgdLayerDiff(a, c.subarray(1))];"),
            std::string("[0,1,-1,0,1]"));
  CHECK_STR(probe(*host, "try { __pgdLayerDiff([1], new Uint8Array(1)); return 'no'; } catch (e) { return 'threw'; }"), std::string("\"threw\""));
}

TEST("script host: Math.random is Mulberry32 from the seed, as in the conformance runner") {
  auto a = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK_STR(probe(*a, "return [Math.random(), Math.random()];"), std::string("[0.6270739405881613,0.002735721180215478]"));
  auto b = pgd::makeQuickJsHost(ScriptLimits{}, 4294967295u);
  CHECK_STR(probe(*b, "return Math.random();"), std::string("0.8964226141106337"));
}

TEST("script host: each host is a fresh context") {
  auto a = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  auto b = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK(a->evaluate("var leak = 1; Object.prototype.leak = 2;", "a.js"));
  CHECK_STR(probe(*b, "return [typeof leak, ({}).leak === undefined];"), std::string("[\"undefined\",true]"));
}

TEST("script host: a thrown error stops the disk with its message, and the host refuses later calls") {
  auto host = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK(!host->evaluate("function boom() { throw new Error('the reactor melted'); } boom();", "boom.js"));
  CHECK_EQ(static_cast<int>(host->fault()), static_cast<int>(ScriptFault::Exception));
  CHECK(host->message().find("the reactor melted") != std::string::npos);
  CHECK(host->message().find("boom.js") != std::string::npos);
  CHECK(!host->evaluate("1", "after.js"));
  auto syntax = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK(!syntax->evaluate("var = ;", "bad.js"));
  CHECK_EQ(static_cast<int>(syntax->fault()), static_cast<int>(ScriptFault::Exception));
}

TEST("script host: an endless loop is stopped at the time limit, even one that catches everything") {
  ScriptLimits limits;
  limits.sliceMs = 50;
  for (const char* loop : { "for (;;) {}", "for (;;) { try { for (;;) {} } catch (e) {} }" }) {
    auto host = pgd::makeQuickJsHost(limits, 1);
    CHECK(host->evaluate(std::string("var Game = { tick: function () { ") + loop + " } };", "loop.js"));
    CommandFrame frame;
    const auto start = std::chrono::steady_clock::now();
    CHECK(!host->call("Game", "tick", "", frame));
    const double took = ms(start);
    CHECK_EQ(static_cast<int>(host->fault()), static_cast<int>(ScriptFault::Timeout));
    CHECK(took >= 50 && took < 1000);
  }
}

TEST("script host: runaway memory is stopped at the heap cap, even when the disk catches the error") {
  ScriptLimits limits;
  limits.heapBytes = 16u << 20;
  for (const char* hog : { "var a = []; for (;;) a.push(new Float64Array(4096));",
                           "var a = []; for (;;) { try { a.push(new Array(100000).fill(1)); } catch (e) {} }" }) {
    auto host = pgd::makeQuickJsHost(limits, 1);
    CHECK(!host->evaluate(hog, "hog.js"));
    CHECK_EQ(static_cast<int>(host->fault()), static_cast<int>(ScriptFault::Memory));
    CHECK(host->heapUsed() <= limits.heapBytes);
  }
}

TEST("script host: endless recursion is a stack overflow error, not a crash") {
  auto host = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK(!host->evaluate("function down(n) { return down(n + 1) + 1; } down(0);", "deep.js"));
  CHECK_EQ(static_cast<int>(host->fault()), static_cast<int>(ScriptFault::Exception));
  CHECK(host->message().find("stack") != std::string::npos);
}

TEST("script host: a malformed frame or a missing method stops the disk") {
  const char* frames[] = { "return 7;", "return { version: 1, ops: [1, 2], strings: [], blobs: [] };",
                           "return { version: 1, ops: new Float64Array(0), strings: [1], blobs: [] };",
                           "return { version: 1, ops: new Float64Array(0), strings: [], blobs: [[1]] };",
                           "return { ops: new Float64Array(0), strings: [], blobs: [] };" };
  for (const char* body : frames) {
    auto host = pgd::makeQuickJsHost(ScriptLimits{}, 1);
    CHECK(host->evaluate(std::string("var Game = { tick: function () { ") + body + " } };", "bad.js"));
    CommandFrame frame;
    CHECK(!host->call("Game", "tick", "", frame));
    CHECK_EQ(static_cast<int>(host->fault()), static_cast<int>(ScriptFault::Exception));
  }
  auto host = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CommandFrame frame;
  CHECK(!host->call("Nothing", "tick", "", frame));
  CHECK_EQ(static_cast<int>(host->fault()), static_cast<int>(ScriptFault::Exception));
  auto other = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK(other->evaluate("var Game = {};", "game.js"));
  CHECK(!other->call("Game", "tick", "", frame));
  CHECK(other->message().find("not a function") != std::string::npos);
}

TEST("script host: a frame version that is not a whole number from 1 to 1000 stops the disk") {
  for (const char* version : { "NaN", "1.5", "0", "Infinity", "1001" }) {
    auto host = pgd::makeQuickJsHost(ScriptLimits{}, 1);
    CHECK(host->evaluate(std::string("var Game = { tick: function () { return { version: ") + version +
                         ", ops: new Float64Array(0), strings: [], blobs: [] }; } };", "version.js"));
    CommandFrame frame;
    CHECK(!host->call("Game", "tick", "", frame));
    CHECK_EQ(static_cast<int>(host->fault()), static_cast<int>(ScriptFault::Exception));
  }
}

TEST("script host: a frame that repeats one big string or blob is stopped at the heap cap, quickly") {
  ScriptLimits limits;
  limits.heapBytes = 16u << 20;
  limits.sliceMs = 10000;   // a memory test: slow sanitiser builds must not reach the time limit first
  for (const char* body : { "var s = 'x'.repeat(1 << 20), a = []; for (var i = 0; i < 4096; i++) a.push(s);"
                            " return { version: 1, ops: new Float64Array(0), strings: a, blobs: [] };",
                            "var b = new Uint8Array(1 << 20), a = []; for (var i = 0; i < 4096; i++) a.push(b);"
                            " return { version: 1, ops: new Float64Array(0), strings: [], blobs: a };" }) {
    auto host = pgd::makeQuickJsHost(limits, 1);
    CHECK(host->evaluate(std::string("var Game = { tick: function () { ") + body + " } };", "big.js"));
    CommandFrame frame;
    const auto start = std::chrono::steady_clock::now();
    CHECK(!host->call("Game", "tick", "", frame));
    CHECK_EQ(static_cast<int>(host->fault()), static_cast<int>(ScriptFault::Memory));
    CHECK(ms(start) < 5000);
  }
}

TEST("script host: a blob whose buffer was detached stops the disk") {
  auto host = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK(host->evaluate("var Game = { tick: function () { var b = new Uint8Array(8); b.buffer.transfer(); "
                       "return { version: 1, ops: new Float64Array(0), strings: [], blobs: [b] }; } };", "detached.js"));
  CommandFrame frame;
  CHECK(!host->call("Game", "tick", "", frame));
  CHECK_EQ(static_cast<int>(host->fault()), static_cast<int>(ScriptFault::Exception));
}

TEST("script host: __pgdMeasure refuses a text too long to measure") {
  auto host = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK_STR(probe(*host, "try { __pgdMeasure('x'.repeat(1 << 17), 8); return 'measured'; } catch (e) { return e.name; }"),
            std::string("\"RangeError\""));
}

TEST("script host: promise jobs run before the frame leaves, and a job that never ends is stopped") {
  auto host = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK(host->evaluate("globalThis.ran = 0; Promise.resolve().then(function () { ran = 1; });", "job.js"));
  CHECK_STR(probe(*host, "return ran;"), std::string("1"));
  CHECK(host->evaluate("var Game = { tick: function () { Promise.resolve().then(function () { ran++; });"
                       " return { version: 1, ops: new Float64Array(0), strings: [], blobs: [] }; } };", "tick.js"));
  CommandFrame frame;
  CHECK(host->call("Game", "tick", "", frame));
  CHECK_STR(probe(*host, "return ran;"), std::string("2"));
  ScriptLimits limits;
  limits.sliceMs = 50;
  auto stuck = pgd::makeQuickJsHost(limits, 1);
  const auto start = std::chrono::steady_clock::now();
  CHECK(!stuck->evaluate("Promise.resolve().then(function () { for (;;) {} });", "stuck.js"));
  CHECK_EQ(static_cast<int>(stuck->fault()), static_cast<int>(ScriptFault::Timeout));
  CHECK(ms(start) < 1000);
}

TEST("script host: String.prototype.normalize works on short text and refuses very long text") {
  auto host = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK_STR(probe(*host, "return ['\\u00e9'.normalize('NFD').length, 'e\\u0301'.normalize().length];"), std::string("[2,1]"));
  CHECK_STR(probe(*host, "try { 'a'.repeat(1 << 13).normalize(); return 'normalised'; } catch (e) { return e.name; }"),
            std::string("\"RangeError\""));
  CHECK_STR(probe(*host, "var n = String.prototype.normalize, r = [];"
                         " [null, undefined].forEach(function (v) { try { n.call(v); r.push('ok'); } catch (e) { r.push(e.name); } });"
                         " return r;"), std::string("[\"TypeError\",\"TypeError\"]"));
}

TEST("script host: the frame's state counts against the frame's budget") {
  ScriptLimits limits;
  limits.heapBytes = 16u << 20;
  limits.sliceMs = 10000;   // a memory test: slow sanitiser builds must not reach the time limit first
  auto host = pgd::makeQuickJsHost(limits, 1);
  CHECK(host->evaluate("var Game = { tick: function () { var s = 'x'.repeat(2 << 20), a = []; for (var i = 0; i < 7; i++) a.push(s);"
                       " return { version: 1, ops: new Float64Array(0), strings: a, blobs: [], state: s }; } };", "state.js"));
  CommandFrame frame;
  CHECK(!host->call("Game", "tick", "", frame));
  CHECK_EQ(static_cast<int>(host->fault()), static_cast<int>(ScriptFault::Memory));
}

TEST("script host: a promise rejection nothing handles stops the disk, a handled one does not") {
  auto host = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK(host->evaluate("Promise.reject(new Error('late')).catch(function () {});"
                       " var p = Promise.reject(1); p.then(null, function () {});", "handled.js"));
  CHECK(host->evaluate("var Game = { tick: async function () { throw new Error('async boom'); } };", "async.js"));
  CommandFrame frame;
  CHECK(!host->call("Game", "tick", "", frame));
  CHECK_EQ(static_cast<int>(host->fault()), static_cast<int>(ScriptFault::Exception));
  CHECK(host->message().find("async boom") != std::string::npos);
  CHECK(!host->evaluate("1", "after.js"));
  auto late = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK(late->evaluate("var Game = { tick: function () { return { version: 1, ops: new Float64Array(0), strings: [], blobs: [],"
                       " state: { toJSON: function () { Promise.reject(new Error('late rejection')); return {}; } } }; } };", "late.js"));
  CHECK(!late->call("Game", "tick", "", frame));
  CHECK(late->message().find("late rejection") != std::string::npos);
  auto then = pgd::makeQuickJsHost(ScriptLimits{}, 1);
  CHECK(!then->evaluate("Promise.resolve().then(function () { throw new Error('in then'); });", "then.js"));
  CHECK(then->message().find("in then") != std::string::npos);
}
