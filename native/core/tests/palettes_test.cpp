#include <cstring>

#include "check.hpp"
#include "pgd/palettes.hpp"

namespace {
int role(const pgd::PhosphorMode& m, const char* name) {
  for (int i = 0; i < m.roles->count; ++i) if (std::strcmp(m.roles->entries[i].role, name) == 0) return m.roles->entries[i].index;
  return -1;
}
}  // namespace

TEST("seven phosphor modes, in the dial's order") {
  CHECK_EQ(pgd::kModeCount, 7);
  CHECK(std::strcmp(pgd::kModes[0].key, "greenP1") == 0);
  CHECK(std::strcmp(pgd::kModes[6].key, "cga0") == 0);
}

TEST("colours and roles come from the web's table") {
  const pgd::PhosphorMode& g = pgd::kModes[0];
  CHECK_EQ(int(g.pal[0][0]), 0x14);
  CHECK_EQ(int(g.pal[3][2]), 0xbd);
  CHECK_EQ(role(g, "bg"), 0);
  CHECK_EQ(role(g, "text"), 3);
  CHECK_EQ(role(g, "textDim"), 2);
  CHECK_EQ(role(pgd::kModes[5], "dirt"), 2);   // CGA maps dirt differently
  CHECK(pgd::kModes[2].sweep > 0);               // only the radar tube sweeps
  CHECK(pgd::kModes[0].sweep == 0);
  CHECK(pgd::kModes[5].mask && !pgd::kModes[0].mask);
}
