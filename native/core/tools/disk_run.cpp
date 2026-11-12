// Plays a disk file in the native script host, for the conformance check (GAM-36):
//   pgd_disk_run <file.pgdisk> <script.json> <seed> <out.bin> [repo root]
// It evaluates native/shim/shim.js, the disk's disk.js and game.js, native/shim/host.js and
// tools/conformance/driver.js in one fresh QuickJS context, the same scripts tools/conformance/run.mjs runs in
// Node, then writes each frame's command buffer as it left the engine. tools/conformance/native.mjs turns that
// file into the conformance stream, so the two can be compared byte for byte. `script.json` is a script with its
// defaults filled in (host.mjs's parseScript); `seed` is its seed, which Math.random needs before any script runs.
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>

#include "pgd/disk_file.hpp"
#include "pgd/palettes.hpp"
#include "pgd/script_host.hpp"

namespace {

bool slurp(const std::string& path, std::string& out) {
  std::ifstream in(path, std::ios::binary);
  if (!in) return false;
  std::ostringstream text;
  text << in.rdbuf();
  out = text.str();
  return true;
}

std::string quote(const char* text) {
  std::string out = "\"";
  for (const char* p = text; *p; ++p) {
    if (*p == '"' || *p == '\\') out += '\\';
    out += *p;
  }
  return out + "\"";
}

/** Every phosphor mode as { key: { pal, roles } }, from the generated palettes.hpp. */
std::string palettesJson() {
  std::string out = "{";
  for (int m = 0; m < pgd::kModeCount; ++m) {
    const pgd::PhosphorMode& mode = pgd::kModes[m];
    if (m) out += ",";
    out += quote(mode.key) + ":{\"pal\":[";
    for (int i = 0; i < 4; ++i) {
      char hex[8];
      std::snprintf(hex, sizeof hex, "#%02x%02x%02x", mode.pal[i][0], mode.pal[i][1], mode.pal[i][2]);
      out += (i ? ",\"" : "\"") + std::string(hex) + "\"";
    }
    out += "],\"roles\":{";
    for (int r = 0; r < mode.roles->count; ++r) {
      if (r) out += ",";
      out += quote(mode.roles->entries[r].role) + ":" + std::to_string(mode.roles->entries[r].index);
    }
    out += "}}";
  }
  return out + "}";
}

void put32(std::ostream& out, std::uint32_t n) {
  const unsigned char b[4] = { static_cast<unsigned char>(n), static_cast<unsigned char>(n >> 8),
                               static_cast<unsigned char>(n >> 16), static_cast<unsigned char>(n >> 24) };
  out.write(reinterpret_cast<const char*>(b), 4);
}

void putBytes(std::ostream& out, const void* data, std::size_t size) {
  put32(out, static_cast<std::uint32_t>(size));
  out.write(static_cast<const char*>(data), static_cast<std::streamsize>(size));
}

/** One record: state JSON, ops (little-endian doubles), strings, blobs, each length-prefixed. */
void write(std::ostream& out, const pgd::CommandFrame& frame) {
  putBytes(out, frame.state.data(), frame.state.size());
  put32(out, static_cast<std::uint32_t>(frame.ops.size()));
  for (double op : frame.ops) {
    std::uint64_t bits;
    static_assert(sizeof bits == sizeof op, "doubles are 64-bit");
    std::memcpy(&bits, &op, sizeof bits);
    for (int i = 0; i < 8; ++i) out.put(static_cast<char>(bits >> (8 * i)));
  }
  put32(out, static_cast<std::uint32_t>(frame.strings.size()));
  for (const auto& s : frame.strings) putBytes(out, s.data(), s.size());
  put32(out, static_cast<std::uint32_t>(frame.blobs.size()));
  for (const auto& b : frame.blobs) putBytes(out, b.data(), b.size());
}

int fail(const pgd::ScriptHost& host, const char* what) {
  std::cerr << "DISK ERROR (" << pgd::faultName(host.fault()) << ") in " << what << ": " << host.message() << "\n";
  return 2;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 5 || argc > 6) {
    std::cerr << "usage: pgd_disk_run <file.pgdisk> <script.json> <seed> <out.bin> [repo root]\n";
    return 64;
  }
  const std::string root = argc == 6 ? std::string(argv[5]) + "/" : "";
  std::string bytes, script, shim, session, driver;
  if (!slurp(argv[1], bytes)) { std::cerr << "cannot read " << argv[1] << "\n"; return 66; }
  if (!slurp(argv[2], script)) { std::cerr << "cannot read " << argv[2] << "\n"; return 66; }
  if (!slurp(root + "native/shim/shim.js", shim) || !slurp(root + "native/shim/host.js", session) ||
      !slurp(root + "tools/conformance/driver.js", driver)) {
    std::cerr << "cannot read the shim and driver scripts under '" << root << "'\n";
    return 66;
  }
  pgd::DiskFiles files;
  std::string error;
  if (!pgd::readDiskFile(reinterpret_cast<const std::uint8_t*>(bytes.data()), bytes.size(), files, error)) {
    std::cerr << argv[1] << ": " << error << "\n";
    return 65;
  }
  const std::string* diskJs = pgd::findDiskFile(files, "disk.js");
  const std::string* gameJs = pgd::findDiskFile(files, "game.js");
  if (!diskJs || !gameJs) { std::cerr << argv[1] << ": no disk.js or game.js\n"; return 65; }

  const auto seed = static_cast<std::uint32_t>(std::strtoul(argv[3], nullptr, 10));
  auto host = pgd::makeQuickJsHost(pgd::ScriptLimits{}, seed);
  if (!host->evaluate(shim, "native/shim/shim.js")) return fail(*host, "shim.js");
  if (!host->evaluate(*diskJs, "disk.js")) return fail(*host, "disk.js");
  if (!host->evaluate(*gameJs, "game.js")) return fail(*host, "game.js");
  if (!host->evaluate(session, "native/shim/host.js")) return fail(*host, "host.js");
  if (!host->evaluate(driver, "tools/conformance/driver.js")) return fail(*host, "driver.js");

  std::ofstream out(argv[4], std::ios::binary);
  if (!out) { std::cerr << "cannot write " << argv[4] << "\n"; return 73; }
  pgd::CommandFrame frame;
  if (!host->call("PGDConformance", "boot", "{\"script\":" + script + ",\"palettes\":" + palettesJson() + "}", frame)) return fail(*host, "boot");
  write(out, frame);
  // The script's frame count rides on the header.
  const auto at = frame.state.find("\"frames\":");
  const long frames = at == std::string::npos ? 0 : std::strtol(frame.state.c_str() + at + 9, nullptr, 10);
  double slowest = 0, total = 0;
  for (long i = 0; i < frames; ++i) {
    const auto start = std::chrono::steady_clock::now();
    if (!host->call("PGDConformance", "tick", "", frame)) return fail(*host, "tick");
    const double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count();
    total += ms;
    if (ms > slowest) slowest = ms;
    write(out, frame);
  }
  std::fprintf(stderr, "%ld frames, %.3f ms a frame on average, %.3f ms at most, %zu KB of heap\n", frames,
               frames ? total / static_cast<double>(frames) : 0.0, slowest, host->heapUsed() / 1024);
  return out ? 0 : 74;
}
