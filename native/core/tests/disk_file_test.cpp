// Unpacking disk files (GAM-34, GAM-36): what tools/disks/pgdisk.mjs writes, and nothing else.
#include <string>
#include <vector>

#include "check.hpp"
#include "pgd/disk_file.hpp"

namespace {
void le(std::vector<std::uint8_t>& b, std::uint32_t v, int bytes) {
  for (int i = 0; i < bytes; ++i) b.push_back(static_cast<std::uint8_t>(v >> (8 * i)));
}
/** A stored zip laid out as pgdisk.mjs's zip() writes it. */
std::vector<std::uint8_t> zip(const std::vector<std::pair<std::string, std::string>>& files, std::uint16_t method = 0) {
  std::vector<std::uint8_t> out, dir;
  for (const auto& [name, data] : files) {
    const auto offset = static_cast<std::uint32_t>(out.size());
    const auto crc = pgd::crc32(reinterpret_cast<const std::uint8_t*>(data.data()), data.size());
    const auto size = static_cast<std::uint32_t>(data.size()), nameLen = static_cast<std::uint32_t>(name.size());
    le(out, 0x04034b50, 4); le(out, 20, 2); le(out, 0x0800, 2); le(out, method, 2); le(out, 0, 2); le(out, 33, 2);
    le(out, crc, 4); le(out, size, 4); le(out, size, 4); le(out, nameLen, 2); le(out, 0, 2);
    out.insert(out.end(), name.begin(), name.end());
    out.insert(out.end(), data.begin(), data.end());
    le(dir, 0x02014b50, 4); le(dir, 20, 2); le(dir, 20, 2); le(dir, 0x0800, 2); le(dir, method, 2); le(dir, 0, 2); le(dir, 33, 2);
    le(dir, crc, 4); le(dir, size, 4); le(dir, size, 4); le(dir, nameLen, 2); le(dir, 0, 2); le(dir, 0, 2);
    le(dir, 0, 2); le(dir, 0, 2); le(dir, 0, 4); le(dir, offset, 4);
    dir.insert(dir.end(), name.begin(), name.end());
  }
  const auto dirAt = static_cast<std::uint32_t>(out.size()), dirSize = static_cast<std::uint32_t>(dir.size());
  out.insert(out.end(), dir.begin(), dir.end());
  le(out, 0x06054b50, 4); le(out, 0, 2); le(out, 0, 2);
  le(out, static_cast<std::uint32_t>(files.size()), 2); le(out, static_cast<std::uint32_t>(files.size()), 2);
  le(out, dirSize, 4); le(out, dirAt, 4); le(out, 0, 2);
  return out;
}
}  // namespace

TEST("disk file: unpacks stored entries in order") {
  const auto bytes = zip({ { "manifest.json", "{\"format\":1}" }, { "disk.js", "var PGDDisk = {};" }, { "game.js", "" } });
  pgd::DiskFiles files;
  std::string error;
  CHECK(pgd::readDiskFile(bytes.data(), bytes.size(), files, error));
  CHECK_EQ(files.size(), std::size_t{3});
  CHECK(files[0].first == "manifest.json" && files[1].first == "disk.js" && files[2].first == "game.js");
  CHECK(*pgd::findDiskFile(files, "disk.js") == "var PGDDisk = {};");
  CHECK(pgd::findDiskFile(files, "preview.json") == nullptr);
  CHECK_EQ(pgd::crc32(reinterpret_cast<const std::uint8_t*>("123456789"), 9), 0xCBF43926u);
}

TEST("disk file: refuses what pgdisk.mjs never writes") {
  pgd::DiskFiles files;
  std::string error;
  auto good = zip({ { "disk.js", "abc" } });
  auto flipped = good; flipped[30 + 7] ^= 1;                         // a byte of disk.js
  CHECK(!pgd::readDiskFile(flipped.data(), flipped.size(), files, error) && error.find("CRC") != std::string::npos);
  auto deflated = zip({ { "disk.js", "abc" } }, 8);
  CHECK(!pgd::readDiskFile(deflated.data(), deflated.size(), files, error) && error.find("compressed") != std::string::npos);
  auto twice = zip({ { "disk.js", "a" }, { "disk.js", "b" } });
  CHECK(!pgd::readDiskFile(twice.data(), twice.size(), files, error) && error.find("twice") != std::string::npos);
  for (std::size_t cut = 0; cut < good.size(); ++cut) CHECK(!pgd::readDiskFile(good.data(), cut, files, error));
  auto pointing = good; pointing[good.size() - 6] = 0xFF;             // central directory offset past the end
  CHECK(!pgd::readDiskFile(pointing.data(), pointing.size(), files, error));
}
