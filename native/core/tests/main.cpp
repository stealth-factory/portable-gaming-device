#include "check.hpp"

int main() {
  int failed = 0;
  for (const auto& c : pgdtest::cases()) {
    const int before = pgdtest::failures();
    c.run();
    const bool ok = pgdtest::failures() == before;
    if (!ok) ++failed;
    std::printf("%s %s\n", ok ? "ok  " : "FAIL", c.name);
  }
  std::printf("%zu tests, %d failed\n", pgdtest::cases().size(), failed);
  return failed ? 1 : 0;
}
