# PGD engine core: the native half of the console shared by the iOS and Android apps (GAM-35).
# C++17, no platform headers. The only third-party code is QuickJS-ng (MIT), vendored in third_party/quickjs-ng.
# Build and test on any machine:
#   cmake -S native/core -B build/core -G Ninja && cmake --build build/core && ctest --test-dir build/core
cmake_minimum_required(VERSION 3.20)
project(pgd_core LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# QuickJS-ng v0.18.0, the script host's engine (GAM-36). Built as it ships, so its own warnings are not ours.
set(QJS_DIR ${CMAKE_CURRENT_SOURCE_DIR}/third_party/quickjs-ng)
add_library(pgd_quickjs STATIC ${QJS_DIR}/dtoa.c ${QJS_DIR}/libregexp.c ${QJS_DIR}/libunicode.c ${QJS_DIR}/quickjs.c)
set_target_properties(pgd_quickjs PROPERTIES C_STANDARD 11 C_EXTENSIONS ON COMPILE_WARNING_AS_ERROR OFF)
target_include_directories(pgd_quickjs PUBLIC ${QJS_DIR})
target_compile_definitions(pgd_quickjs PRIVATE _GNU_SOURCE)
if(MSVC)
  target_compile_options(pgd_quickjs PRIVATE /W0)
else()
  target_compile_options(pgd_quickjs PRIVATE -w)
endif()
find_package(Threads REQUIRED)
target_link_libraries(pgd_quickjs PUBLIC Threads::Threads)
if(NOT WIN32)
  target_link_libraries(pgd_quickjs PUBLIC m)
endif()

add_library(pgd_core STATIC
  src/raster.cpp
  src/synth.cpp
  src/text.cpp
  src/disk_file.cpp
  src/script_host.cpp
)
target_include_directories(pgd_core PUBLIC include)
target_link_libraries(pgd_core PRIVATE pgd_quickjs)
if(MSVC)
  target_compile_options(pgd_core PRIVATE /W4)
else()
  target_compile_options(pgd_core PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wno-sign-conversion)
endif()

add_executable(pgd_disk_run tools/disk_run.cpp)
target_link_libraries(pgd_disk_run PRIVATE pgd_core)
if(MSVC)
  target_compile_options(pgd_disk_run PRIVATE /W4)
else()
  target_compile_options(pgd_disk_run PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wno-sign-conversion)
endif()

option(PGD_CORE_TESTS "Build the core's unit tests" ON)
if(PGD_CORE_TESTS)
  enable_testing()
  add_executable(pgd_core_tests tests/main.cpp tests/raster_test.cpp tests/palettes_test.cpp tests/text_test.cpp tests/synth_test.cpp
    tests/script_host_test.cpp tests/disk_file_test.cpp)
  find_package(Threads REQUIRED)   # the synth's test queues from one thread while another renders
  target_link_libraries(pgd_core_tests PRIVATE pgd_core Threads::Threads)
  add_test(NAME pgd_core_tests COMMAND pgd_core_tests)
endif()
