// See include/pgd/disk_file.hpp.
#include "pgd/disk_file.hpp"

namespace pgd {
namespace {

std::uint32_t u16(const std::uint8_t* p) { return static_cast<std::uint32_t>(p[0] | p[1] << 8); }
std::uint32_t u32(const std::uint8_t* p) {
  return static_cast<std::uint32_t>(p[0]) | static_cast<std::uint32_t>(p[1]) << 8 | static_cast<std::uint32_t>(p[2]) << 16 |
         static_cast<std::uint32_t>(p[3]) << 24;
}

bool fail(std::string& error, std::string why) { error = std::move(why); return false; }

}  // namespace

std::uint32_t crc32(const std::uint8_t* data, std::size_t size) {
  std::uint32_t crc = 0xFFFFFFFFu;
  for (std::size_t i = 0; i < size; ++i) {
    crc ^= data[i];
    for (int k = 0; k < 8; ++k) crc = (crc >> 1) ^ (0xEDB88320u & (0u - (crc & 1u)));
  }
  return ~crc;
}

bool readDiskFile(const std::uint8_t* data, std::size_t size, DiskFiles& files, std::string& error) {
  files.clear();
  if (size < 22 || u32(data + size - 22) != 0x06054b50u) return fail(error, "not a disk file: no end of central directory");
  const std::uint8_t* end = data + size - 22;
  const std::uint32_t count = u16(end + 10);
  std::size_t p = u32(end + 16);
  for (std::uint32_t i = 0; i < count; ++i) {
    if (p > size - 22 || size - 22 - p < 46 || u32(data + p) != 0x02014b50u) return fail(error, "bad central directory");
    const std::uint32_t flags = u16(data + p + 8), method = u16(data + p + 10), crc = u32(data + p + 16);
    const std::uint32_t stored = u32(data + p + 20), length = u32(data + p + 24);
    const std::uint32_t nameLen = u16(data + p + 28), extra = u16(data + p + 30), note = u16(data + p + 32);
    const std::size_t local = u32(data + p + 42);
    if (p + 46 + nameLen > size) return fail(error, "bad central directory");
    std::string name(reinterpret_cast<const char*>(data + p + 46), nameLen);
    if (method != 0 || stored != length) return fail(error, name + " is compressed; disk files store entries");
    if (flags & 0x0008u) return fail(error, name + " has a data descriptor");
    if (local > size || size - local < 30 || u32(data + local) != 0x04034b50u) return fail(error, "bad local header for " + name);
    const std::size_t start = local + 30 + u16(data + local + 26) + u16(data + local + 28);
    if (start > size || size - start < length) return fail(error, name + " runs past the end of the file");
    if (crc32(data + start, length) != crc) return fail(error, name + " fails its CRC");
    if (findDiskFile(files, name)) return fail(error, name + " appears twice");
    files.emplace_back(std::move(name), std::string(reinterpret_cast<const char*>(data + start), length));
    p += 46 + nameLen + extra + note;
  }
  return true;
}

const std::string* findDiskFile(const DiskFiles& files, const std::string& name) {
  for (const auto& file : files) if (file.first == name) return &file.second;
  return nullptr;
}

}  // namespace pgd
