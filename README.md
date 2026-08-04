# PolicyBhandar

React Native app for insurance advisors — browse policy/product materials, scan
visiting cards, manage prospects, and share content with clients. Android and
iOS from a single JavaScript codebase, with a few platform-specific native
modules for downloads, clipboard, image picking, video playback, and visiting
card OCR.

> New to this codebase and coming from Flutter? See
> [`docs/flutter-to-react-native.md`](docs/flutter-to-react-native.md) for a
> concept-mapping guide. This README assumes React Native familiarity.

## Stack

- React Native 0.85.3, React 19.2.3, New Architecture (Fabric/TurboModules) enabled
- React Navigation (stack navigator)
- Native modules: Kotlin (Android) + Swift (iOS) — see `docs/ios-native-modules.md`
- No Redux/MobX — React Context + local component state
- AsyncStorage for local persistence

## Entry point

1. `index.js` — `AppRegistry.registerComponent(appName, () => App)`, `appName` from `app.json`.
2. `App.js` — root component: `SafeAreaProvider` → `GestureHandlerRootView` →
   `AuthProvider` (`src/context/AuthContext.js`) → `NavigationContainer` with
   every screen registered on a single `Stack.Navigator`.

## Architecture

```
.
├── index.js                 # entry point (AppRegistry)
├── App.js                   # root component + navigation route table
├── app.json                 # app name / display name
├── metro.config.js          # Metro bundler config
├── src/
│   ├── screens/              # one file per route (31 screens)
│   ├── components/           # reusable UI pieces
│   ├── context/               # AuthContext.js — auth/session state
│   ├── services/               # api.js, storage.js, downloads.js, authPassword.js,
│   │                            #   materialServiceTree.js, downloadQuota.js, ...
│   ├── data/                    # local JSON/mock data & seed catalogs
│   ├── theme/                    # colors.js — shared design tokens
│   └── assets/                    # bundled images
├── android/                  # native Android project (Kotlin native modules)
├── ios/                      # native iOS project (Xcode workspace, Swift native modules)
├── scripts/                  # one-off Node scripts (e.g. material seeding)
└── docs/                     # reference docs — commands, dev tools, releases, Flutter mapping
```

**Screens vs. components:** `src/screens` = one per navigable route.
`src/components` = smaller reusable pieces composed inside screens.

## State management

No global state library. `AuthContext` (`src/context/AuthContext.js`) holds
auth/session state via React Context and is the only app-wide provider.
Everything else is local `useState`/`useEffect` per screen, with
`src/services/storage.js` (AsyncStorage) for persistence and `src/services/api.js`
for the HTTP layer (Axios).

## Native modules

Five features have platform-specific native code, exposed to JS via
`NativeModules.<Name>` (or `requireNativeComponent` for the video view):

| JS name | Purpose | Android | iOS |
|---|---|---|---|
| `PolicyBhandarClipboard` | Copy link/text to clipboard | `android/.../ClipboardModule.kt` | `ios/PolicyBhandar/NativeModules/PolicyBhandarClipboard.swift` |
| `PolicyBhandarProfileImagePicker` | Pick a profile photo | `ProfileImagePickerModule.kt` | `PolicyBhandarProfileImagePicker.swift` |
| `PolicyBhandarDownloader` | Download/share files | `DownloadModule.kt` | `PolicyBhandarDownloader.swift` |
| `PolicyBhandarVisitingCardScanner` | Crop + OCR a scanned card | `VisitingCardScannerModule.kt` | `PolicyBhandarVisitingCardScanner.swift` |
| `PolicyBhandarVideoView` | Native video player view | `PolicyBhandarVideoViewManager.kt` | `PolicyBhandarVideoViewManager.swift` |

Details, parity notes, and known gaps: `docs/ios-native-modules.md`.

## Running the project

```bash
npm install               # install JS deps

npm start                  # Metro bundler only
npm run android             # build & launch on Android
npm run ios                  # build & launch on iOS
```

iOS native deps are managed by CocoaPods — after changing any native
dependency in `package.json`:

```bash
cd ios && pod install && cd ..
```

Always open `ios/PolicyBhandar.xcworkspace` in Xcode, never the `.xcodeproj`.

Full command reference (logs, cache resets, simulator/emulator commands):
`docs/commands.md`. Debugging, network inspection, hot reload, dev menu:
`docs/dev-tools-debugging.md`.

## Making changes

Day-to-day workflow, where to add a screen/service, and how to trace a
feature end-to-end through the codebase: `docs/code-flow.md`.

## Versioning & release builds

Bumping `versionCode`/`versionName` (Android) and `CFBundleVersion`/
`CFBundleShortVersionString` (iOS), plus release build commands for both
platforms: `docs/versioning-releases.md`.

- **Android signing:** `ANDROID_RELEASE_SIGNING.md`
- **App Store submission (Apple Developer account → App Store Connect →
  Xcode archive → store listing → review):** `docs/app-store-submission.md`

## Docs index

- [`docs/flutter-to-react-native.md`](docs/flutter-to-react-native.md) — concept mapping for Flutter devs
- [`docs/commands.md`](docs/commands.md) — full command reference
- [`docs/dev-tools-debugging.md`](docs/dev-tools-debugging.md) — logs, network inspector, hot reload, dev menu
- [`docs/code-flow.md`](docs/code-flow.md) — how to read/trace the codebase, day-to-day workflow
- [`docs/versioning-releases.md`](docs/versioning-releases.md) — version bumps, release builds
- [`docs/ios-native-modules.md`](docs/ios-native-modules.md) — native module parity status
- [`docs/app-store-submission.md`](docs/app-store-submission.md) — Apple Developer + App Store Connect + submission checklist, every field filled in
- `legal/` — hosted privacy policy, terms, and support pages (for the Privacy Policy URL / Support URL App Store Connect requires)
