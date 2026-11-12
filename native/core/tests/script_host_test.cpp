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
