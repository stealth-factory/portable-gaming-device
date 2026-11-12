# PGD engine core: the native half of the console shared by the iOS and Android apps (GAM-35).
# C++17, no platform headers, no third-party code. Build and test on any machine:
#   cmake -S native/core -B build/core -G Ninja && cmake --build build/core && ctest --test-dir build/core
cmake_minimum_required(VERSION 3.20)
project(pgd_core LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(pgd_core STATIC
  src/raster.cpp
  src/synth.cpp
  src/text.cpp
)
target_include_directories(pgd_core PUBLIC include)
if(MSVC)
  target_compile_options(pgd_core PRIVATE /W4)
else()
  target_compile_options(pgd_core PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wno-sign-conversion)
endif()

option(PGD_CORE_TESTS "Build the core's unit tests" ON)
if(PGD_CORE_TESTS)
  enable_testing()
  add_executable(pgd_core_tests tests/main.cpp tests/raster_test.cpp tests/palettes_test.cpp tests/text_test.cpp tests/synth_test.cpp)
  find_package(Threads REQUIRED)   # the synth's test queues from one thread while another renders
  target_link_libraries(pgd_core_tests PRIVATE pgd_core Threads::Threads)
  add_test(NAME pgd_core_tests COMMAND pgd_core_tests)
endif()
