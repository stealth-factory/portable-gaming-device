// Reading a disk file (`<id>-<version>.pgdisk`, GAM-34): a zip of stored entries, as tools/disks/pgdisk.mjs writes
// it. The app checks the file's size and SHA-256 against the signed catalogue first; this only unpacks it, and
// refuses anything that zip didn't write (compressed entries, a bad CRC, a name twice, an entry out of bounds).
#pragma once
#include <cstddef>
#include <cstdint>
#include <string>
#include <utility>
#include <vector>

namespace pgd {

/** The files in order, name then bytes. */
using DiskFiles = std::vector<std::pair<std::string, std::string>>;

/** Unpack a disk file. On failure returns false and says why in `error`. */
bool readDiskFile(const std::uint8_t* data, std::size_t size, DiskFiles& files, std::string& error);

/** The bytes of one file, or nullptr. */
const std::string* findDiskFile(const DiskFiles& files, const std::string& name);

std::uint32_t crc32(const std::uint8_t* data, std::size_t size);

}  // namespace pgd
