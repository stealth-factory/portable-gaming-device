# PGD for iOS

The console as a native app for iPhone, iPhone Duo and iPad, iOS 27 and later (GAM-37). The design is in the
Linear document "iOS app build spec (handoff)", section 9.

This first build is the set with a test pattern on the tube: the bezel, the nameplate, POWER and the
version line, laid out by the web's rule (`SetLayout`). The Metal CRT pass, the engine core
(`native/core`), the controls and the games follow.

| Path | What it is |
| --- | --- |
| `project.yml` | The XcodeGen project: app `PGD` and unit tests `PGDTests`, scheme `PGD` |
| `Config/App.xcconfig` | Shared settings; includes `Local.xcconfig` (never committed) for the team and bundle id |
| `PGD/` | The app: `ConsoleView` (the set), `Picture` (palette-index picture and phosphor colours), `TestPattern`, `Layout` |
| `PGD/Assets.xcassets/AppIcon.appiconset/icon-1024.png` | Made by `node tools/icons/make.cjs`; never edit it by hand |
| `PGDTests/` | Unit tests |

## Build and test on a Mac

Xcode 27.1 or later and XcodeGen (`brew install xcodegen`).

```sh
cd native/ios
cp Config/Local.xcconfig.example Config/Local.xcconfig   # only to run on a device: your team id and a bundle id
xcodegen generate
open PGD.xcodeproj
```

The same check as CI (`.github/workflows/apple.yml`), on a simulator of its own:

```sh
udid=$(xcrun simctl create pgd-check "iPhone 17 Pro")
xcodebuild test -project PGD.xcodeproj -scheme PGD -destination "id=$udid" \
  -derivedDataPath /tmp/pgd-dd CODE_SIGNING_ALLOWED=NO
xcrun simctl delete "$udid"
```

Every push to `main` that touches the app goes to internal TestFlight testers (`testflight.yml`; see
`docs/releasing.md`, "TestFlight").
