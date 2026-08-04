# Versioning & release builds

## Version numbers, explained

Both platforms track two separate numbers: a **build number** (must
strictly increase on every store upload, users never see it) and a
**display version** (the "1.2.3" users see, doesn't have to be unique).

| | Build number (internal) | Display version (user-facing) |
|---|---|---|
| Android | `versionCode` (integer) | `versionName` (string) |
| iOS | `CURRENT_PROJECT_VERSION` (integer-ish string) | `MARKETING_VERSION` |

## Android — bump version

Edit `android/app/build.gradle`:

```gradle
versionCode 33          // bump by at least 1 every time you upload to Play Console
versionName "1.0.32"     // the human-facing version, bump per your own scheme
```

Current values (as of this doc): `versionCode 33`, `versionName "1.0.32"`.
Play Console rejects an upload whose `versionCode` isn't strictly greater
than the last uploaded build.

## iOS — bump version

Two ways to do it — pick one:

**Xcode (recommended, less error-prone):** open
`ios/PolicyBhandar.xcworkspace` → select the `PolicyBhandar` target →
**General** tab → **Identity** section → edit **Version** (=
`MARKETING_VERSION`, e.g. `1.2.0`) and **Build** (= `CURRENT_PROJECT_VERSION`,
e.g. `4`).

**Command line:**

```bash
cd ios
agvtool new-marketing-version 1.2.0     # sets MARKETING_VERSION (the "1.2.0")
agvtool new-version -all 4               # sets CURRENT_PROJECT_VERSION (the build number)
cd ..
```

Current values (as of this doc, freshly scaffolded): `MARKETING_VERSION =
1.0`, `CURRENT_PROJECT_VERSION = 1`. App Store Connect rejects a build
upload whose `CURRENT_PROJECT_VERSION` isn't strictly greater than the last
uploaded build for the same `MARKETING_VERSION`.

**Keep both platforms' display versions in sync** (e.g. both `1.2.0`) even
though the build-number schemes are independent — this avoids confusion
when users compare "what version am I on" across platforms.

## Android — release build

1. Ensure signing is configured — see `ANDROID_RELEASE_SIGNING.md` for the
   keystore env vars.
2. Bump `versionCode`/`versionName` (above).
3. Build:
   ```bash
   cd android
   ./gradlew bundleRelease     # produces app/build/outputs/bundle/release/app-release.aab — upload this to Play Console
   # or
   ./gradlew assembleRelease    # produces a signed .apk, for direct install/testing
   cd ..
   ```

## iOS — release build (Archive)

1. Bump `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` (above).
2. Open `ios/PolicyBhandar.xcworkspace` in Xcode.
3. Select the **"Any iOS Device (arm64)"** destination (not a simulator —
   Archive is disabled for simulator destinations).
4. **Product → Archive.** Requires valid signing — see
   `docs/app-store-submission.md` for Apple Developer account + signing
   setup if you haven't done this before.
5. When the Archive completes, the **Organizer** window opens
   automatically → **Distribute App → App Store Connect → Upload**.

## Where these numbers live (for scripting/CI)

```bash
# Android
grep -n "versionCode\|versionName" android/app/build.gradle

# iOS
grep -n "MARKETING_VERSION\|CURRENT_PROJECT_VERSION" ios/PolicyBhandar.xcodeproj/project.pbxproj
```

Both files store the version in **two places** (Debug and Release build
configurations) — the Xcode UI and `agvtool` update both automatically;
if hand-editing `project.pbxproj`, update both occurrences.
