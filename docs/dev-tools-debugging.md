# Dev tools, debugging, network, hot reload

## The dev menu

With the app running in **debug** mode, open the in-app dev menu:

- **iOS Simulator:** `Cmd + D`, or shake gesture on a real device
- **Android emulator:** `Cmd + M` (macOS) / `Ctrl + M`, or shake gesture on a real device

The dev menu gives you: reload, toggle inspector, toggle performance
monitor, open the JS debugger, and Fast Refresh settings.

## Hot reload / Fast Refresh

Fast Refresh is **on by default** — save a file, the app updates in place
without losing most component state (this is React Native's equivalent of
Flutter's stateful hot reload). It's automatic as long as Metro
(`npm start`) is running; no flag needed.

- Full reload (equivalent of Flutter's hot *restart*, resets all state):
  press `R` twice in the Simulator, or `Cmd/Ctrl + R` from the dev menu.
- If Fast Refresh gets into a bad state (stale closures, weird errors that
  don't match your code), do a full reload before assuming there's a real bug.

## Reading errors: LogBox

React Native's in-app error/warning overlay is called **LogBox**. Yellow
banner = warning (non-fatal, app keeps running); red screen = fatal error
(component crashed). Tap a LogBox warning banner to expand and read the
full stack trace and source location.

## Console logs

`console.log` / `console.warn` / `console.error` in JS show up in:

- The Metro terminal (the one running `npm start`) — simplest, always works
- Xcode's console (Window → Devices and Simulators, or the build log pane)
  when running from Xcode
- `npx react-native log-ios` / `npx react-native log-android` (see `docs/commands.md`)
- The Chrome/Safari JS debugger console (see below)

## JS debugger (breakpoints, step-through)

Open the dev menu → **"Open Debugger"**. This opens Hermes's debugger
frontend in Chrome DevTools (or Safari's Web Inspector on iOS), giving you
real breakpoints, step-through, and a console — the RN equivalent of
Flutter DevTools' debugger pane.

## Network inspector

The Chrome DevTools opened via "Open Debugger" includes a **Network** tab
that shows every `fetch`/XHR call this app makes (this app uses Axios,
which uses XHR under the hood, so it's fully visible) — request/response
headers, payloads, timing. This is the direct equivalent of Flutter
DevTools' Network tab.

Alternative: for a native, more powerful HTTP/socket inspector, install
[Flipper](https://fbflipper.com/) and its Network plugin — it works with
this project out of the box since it's a standard (non-Expo) React Native
app.

## Performance monitor

Dev menu → **"Show Perf Monitor"** overlays live JS/UI FPS, useful for
catching jank the same way Flutter's performance overlay does.

## Native-side debugging

- **iOS:** open `ios/PolicyBhandar.xcworkspace` in Xcode and run from
  there for native breakpoints, view hierarchy debugger, and Instruments
  (memory/CPU/energy profiling) — same idea as Flutter's DevTools memory
  view but with full native tooling since this is a real Xcode project.
- **Android:** open `android/` in Android Studio for native breakpoints
  and `adb logcat` for raw native logs (see `docs/commands.md`).

## Element inspector

Dev menu → **"Show Element Inspector"** (or `Cmd+D` → tap the inspector
icon) lets you tap any on-screen element to see its component name, props,
and applied styles — the RN equivalent of Flutter's widget inspector.
