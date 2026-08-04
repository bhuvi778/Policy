# Command reference

## Setup

```bash
npm install                          # install JS dependencies
cd ios && pod install && cd ..        # install iOS native dependencies (after any native dep change)
brew install watchman                  # recommended: faster/more reliable Metro file watching
```

## Running the app

```bash
npm start                              # Metro bundler only (leave running in its own terminal)
npm run android                         # build & launch on Android (device/emulator)
npm run ios                              # build & launch on iOS (Simulator)

# Target a specific iOS simulator
npx react-native run-ios --simulator "iPhone 17"
npx react-native run-ios --simulator "iPhone 17 Pro Max"

# Target a specific Android emulator/device
npx react-native run-android --deviceId <id>
adb devices                              # list connected Android devices/emulators
```

Metro must be running for **debug** builds (JS is served live). Release
builds bundle the JS at build time and don't need Metro.

## iOS Simulator management

```bash
xcrun simctl list devices available       # list all available simulators
xcrun simctl boot "iPhone 17"               # boot a simulator without Xcode
open -a Simulator                            # open the Simulator app
xcrun simctl shutdown all                     # shut down all simulators (fixes most flaky states)
xcrun simctl erase "iPhone 17"                 # reset a simulator to factory state
xcrun simctl io booted screenshot out.png       # screenshot the booted simulator
```

If the Simulator gets into a weird state (`Mach error`, app won't launch),
restart the CoreSimulator service:

```bash
killall Simulator
killall com.apple.CoreSimulator.CoreSimulatorService
```

## Android emulator management

```bash
emulator -list-avds                       # list available emulator images
emulator -avd <name>                       # launch a specific emulator
adb devices                                  # list running devices/emulators
adb logcat *:S ReactNative:V ReactNativeJS:V   # Android native + JS logs only
```

## Logs

```bash
npx react-native log-ios              # tail iOS device/simulator logs
npx react-native log-android           # tail Android logcat, RN-filtered

# Raw simulator log stream (more verbose, includes system logs)
xcrun simctl spawn booted log stream --level debug --predicate 'processImagePath contains "PolicyBhandar"'
```

See `docs/dev-tools-debugging.md` for the in-app dev menu, network
inspector, and JS debugger.

## Cache resets (use when things behave inexplicably)

```bash
npx react-native start --reset-cache         # clear Metro's bundler cache
watchman watch-del-all                        # clear watchman's watch state
rm -rf node_modules && npm install             # nuke and reinstall JS deps
cd ios && rm -rf Pods Podfile.lock && pod install && cd ..   # nuke and reinstall iOS pods
cd android && ./gradlew clean && cd ..          # clear Android build cache
```

## Building for release

```bash
# Android — see docs/versioning-releases.md and ANDROID_RELEASE_SIGNING.md
cd android && ./gradlew bundleRelease && cd ..     # produces .aab for Play Store
cd android && ./gradlew assembleRelease && cd ..    # produces .apk

# iOS — see docs/versioning-releases.md and docs/app-store-submission.md
# Open ios/PolicyBhandar.xcworkspace in Xcode, then Product → Archive.
```

## Project scripts

```bash
npm run seed:materials              # run the material-catalog seed script
npm run seed:materials:dry-run       # same, dry-run (no writes)
```

## Xcode project maintenance (iOS)

```bash
gem install xcodeproj                  # Ruby gem used to script pbxproj changes safely
                                         # (avoid hand-editing project.pbxproj — it's easy to corrupt)
```

Always open **`ios/PolicyBhandar.xcworkspace`**, never
`PolicyBhandar.xcodeproj` directly — the workspace is what wires in the
CocoaPods dependencies.
