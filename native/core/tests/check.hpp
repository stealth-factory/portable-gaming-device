// A tiny test harness, so the core needs no third-party test framework.
#pragma once
#include <cstdio>
#include <functional>
#include <string>
#include <vector>

namespace pgdtest {
struct Case { const char* name; std::function<void()> run; };
inline std::vector<Case>& cases() { static std::vector<Case> c; return c; }
inline int& failures() { static int f = 0; return f; }
struct Register { Register(const char* n, std::function<void()> f) { cases().push_back({ n, std::move(f) }); } };
}  // namespace pgdtest

#define PGD_CAT2(a, b) a##b
#define PGD_CAT(a, b) PGD_CAT2(a, b)
#define TEST(name) \
  static void PGD_CAT(test_, __LINE__)(); \
  static pgdtest::Register PGD_CAT(reg_, __LINE__)(name, PGD_CAT(test_, __LINE__)); \
  static void PGD_CAT(test_, __LINE__)()
#define CHECK(cond) do { if (!(cond)) { std::printf("  %s:%d: CHECK(%s) failed\n", __FILE__, __LINE__, #cond); ++pgdtest::failures(); } } while (0)
#define CHECK_EQ(a, b) do { auto va_ = (a); auto vb_ = (b); if (!(va_ == vb_)) { std::printf("  %s:%d: %s == %s failed (%s vs %s)\n", __FILE__, __LINE__, #a, #b, std::to_string(va_).c_str(), std::to_string(vb_).c_str()); ++pgdtest::failures(); } } while (0)
