# Flutter → React Native: concept map

You know Flutter. This maps that mental model onto this codebase so the
transition is faster. It's a translation guide, not a tutorial — read
`README.md` for how this specific project is structured.

## The big shift

In Flutter, one Dart codebase compiles through the Flutter engine (Skia)
on every platform — your widgets paint their own pixels. In React Native,
your JavaScript runs on a JS engine (Hermes here) and calls into **real
native UI components and native code** on each platform via the bridge (or
the New Architecture's JSI/Fabric, which this project uses). `android/` and
`ios/` are full native Gradle/Xcode projects you can open and edit directly
— not disposable generated output like Flutter's `build/` folder.

## Concept mapping

| Flutter | React Native | Where it lives here |
|---|---|---|
| `main.dart` / `void main()` | JS entry point that registers the root component | `index.js` |
| `MaterialApp` / root `Widget` | Root React component | `App.js` |
| `Widget` (`StatelessWidget`/`StatefulWidget`) | React component (function + hooks) | `src/screens/*.js`, `src/components/*.js` |
| `setState()` | `useState()` / `useEffect()` | throughout `src/screens` |
| `Provider` / `InheritedWidget` | React Context | `src/context/AuthContext.js` |
| `Navigator` / named routes | React Navigation (`Stack.Navigator`) | `App.js` (route table) |
| `pubspec.yaml` | `package.json` | repo root |
| `flutter pub get` | `npm install` | repo root |
| Platform channels (`MethodChannel`) | Native Modules (`NativeModules.X`) | `android/app/src/main/java/com/policybhandar/*.kt`, `ios/PolicyBhandar/NativeModules/*.swift` |
| `android/`, `ios/` folders | Same idea — real native project wrappers, not disposable | `android/`, `ios/` |
| Hot reload | Metro bundler + Fast Refresh | `npm start` |
| `flutter build apk/ipa` | Gradle assemble / Xcode Archive | `docs/versioning-releases.md` |
| `flutter run` device selection | Simulator/emulator selection via `--simulator`/`-d` flags | `docs/commands.md` |
| `DevTools` (widget inspector, network) | React Native dev menu + Flipper/Chrome debugger | `docs/dev-tools-debugging.md` |

## Widgets vs. components

**Screens vs. components**, here: `src/screens` = one file per navigable
route — the equivalent of a full-page `Scaffold` widget you'd push with
`Navigator.push`. `src/components` = smaller reusable pieces composed
inside screens — your `Widget` building blocks (cards, sheets, headers).

There's no `build()` method returning a widget tree — a React component
*is* a function that returns JSX, called on every re-render triggered by
state/prop changes (conceptually similar to Flutter rebuilding the widget
subtree on `setState`, but React uses a virtual DOM diff instead of
re-painting).

## State management

No Redux/MobX/Bloc here — just React Context (`AuthContext.js`) for
global auth/session state, plus local `useState`/`useEffect` per screen.
`AsyncStorage` (`src/services/storage.js`) is the RN equivalent of
`shared_preferences`.

If you're used to Bloc/Riverpod-style unidirectional state, the closest
analogue in this codebase is: Context for cross-screen state, and
prop-drilling / lifting state up to a shared ancestor for anything
screen-local that needs to be shared with a few children.

## Native modules — the platform channel equivalent

Flutter's `MethodChannel` lets Dart call into platform-specific Kotlin/Swift
code and back. React Native's **Native Modules** do the same job:

- JS calls `NativeModules.PolicyBhandarClipboard.copyText(text)`
- Android side: a Kotlin class extending `ReactContextBaseJavaModule`,
  annotated `@ReactMethod` (see `android/app/src/main/java/com/policybhandar/`)
- iOS side: a Swift class + a small Objective-C bridging file using
  `RCT_EXTERN_MODULE`/`RCT_EXTERN_METHOD` (see `ios/PolicyBhandar/NativeModules/`)

Both sides expose the *same* JS-facing method names and promise-based
return values, so from the JS/React side it's platform-agnostic — same as
calling a `MethodChannel` and not caring whether it resolves through Kotlin
or Swift underneath. See `docs/ios-native-modules.md` for the full list and
current parity status.

## Package manager & tooling differences

- No `flutter doctor` — the closest equivalent is `npx react-native doctor`,
  which checks Xcode/Android SDK/CocoaPods/watchman versions.
- No `.dart_tool/` — instead: `node_modules/` (JS deps), `ios/Pods/`
  (CocoaPods native deps), `android/.gradle`/`android/build` (Gradle caches).
- CocoaPods is the iOS native dependency manager — the rough equivalent of
  Flutter's iOS `Podfile` under `ios/`, except here **you** manage it
  directly (`pod install`) rather than Flutter generating it for you.

## Where to go next

- `README.md` — project architecture, running the app, commands
- `docs/code-flow.md` — how to trace a feature through the codebase
- `docs/dev-tools-debugging.md` — the RN equivalent of Flutter DevTools
