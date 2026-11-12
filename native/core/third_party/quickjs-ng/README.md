# QuickJS-ng, vendored

The engine behind `pgd::ScriptHost` (`include/pgd/script_host.hpp`, GAM-36). MIT; see `LICENSE` and the repository's `THIRD_PARTY_NOTICES.md`.

- Source: <https://github.com/quickjs-ng/quickjs>, tag `v0.18.0`, commit `d7215b0ad3fc2c562e8317fd9bca058fd4863804`.
- Copied unchanged: `quickjs.c` and its headers, `dtoa`, `libregexp`, `libunicode`, `cutils.h`, `list.h` and the generated `builtin-*.h`. Not copied: `quickjs-libc` (files, timers and the OS, which a disk must never reach), the `qjs` and `qjsc` tools, tests and docs.

To update: copy the same files from a newer tag, update the tag and commit here and in `THIRD_PARTY_NOTICES.md`, then run the core's tests and `node tools/conformance/native-check.mjs` (see `native/core/README.md`). A disk must still play byte for byte as it does in Node.
