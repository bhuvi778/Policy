# Reading the code: how a feature flows through this app

## Start here when tracing any feature

1. **Find the screen.** `App.js` has the full route table — search for the
   route name (e.g. `'ScanScreen'`) to find which file under `src/screens/`
   owns it.
2. **Read the screen's imports.** Every screen imports the components it
   renders (`src/components/`) and the services it calls (`src/services/`).
   That import list *is* the feature's dependency graph.
3. **Follow data down into services.** UI screens don't call `fetch`/Axios
   directly — they call functions from `src/services/*.js` (e.g.
   `src/services/api.js`, `src/services/downloads.js`). Read the service
   function to see the actual HTTP call, native module call, or storage
   read/write.
4. **Native calls are always guarded.** Every native module call in this
   codebase goes through `NativeModules.X?.method` (optional chaining) or a
   `Platform.OS === 'android'` check. If a feature seems to "do nothing" on
   one platform, check the guard first — it's very likely intentional
   platform-specific fallback behavior, not a bug.

## Example trace: "Download a template to device"

1. UI: some screen calls `downloadTemplateToDevice(item, details)` (imported
   from `src/services/downloads.js`).
2. `downloadTemplateToDevice` (in `downloads.js`) first checks the download
   quota (`assertCanDownload`, from `downloadQuota.js`), then decides
   between three paths depending on platform and options: a local
   Android-only image compositor (`PolicyBhandarDownloader.downloadCustomizedImage`),
   a backend-rendered URL (`resolveBackendDownloadUrl`, which calls
   `downloadMaterial`/`getDirectDownload` in `api.js`), or a plain native
   download (`PolicyBhandarDownloader.download`).
3. The native module call lands in Kotlin (`android/.../DownloadModule.kt`)
   or Swift (`ios/PolicyBhandar/NativeModules/PolicyBhandarDownloader.swift`).
4. Quota is recorded (`recordDownload`) after a successful download.

That five-hop chain — **screen → service → (native module | API call) →
platform code → quota bookkeeping** — is the shape of most non-trivial
features in this app.

## Where things live

| Looking for... | Look in... |
|---|---|
| A specific screen's UI | `src/screens/<Name>Screen.js` |
| A reusable UI piece (card, sheet, header) | `src/components/` |
| An HTTP API call | `src/services/api.js` |
| Auth/session state, login/logout | `src/context/AuthContext.js` |
| Local persistence (tokens, flags) | `src/services/storage.js` (AsyncStorage) |
| Download/share logic | `src/services/downloads.js` |
| Colors/design tokens | `src/theme/colors.js` |
| Mock/seed/local catalog data | `src/data/` |
| A native module's JS-facing call | `grep -rn "NativeModules" src/` |
| A native module's platform implementation | `android/app/src/main/java/com/policybhandar/`, `ios/PolicyBhandar/NativeModules/` |
| Navigation route table | `App.js` |

## Day-to-day change workflow

1. `npm start` in one terminal (leave it running).
2. `npm run ios` or `npm run android` in another (only needed once per
   session unless native code changed — after that, Fast Refresh keeps the
   running app in sync with your JS edits automatically).
3. Edit a screen/component/service — save — the Simulator/emulator updates
   via Fast Refresh (see `docs/dev-tools-debugging.md`).
4. If you touched **native** code (`android/`, `ios/`, or added a native
   npm dependency), Fast Refresh won't pick it up — rebuild:
   - iOS: re-run `npm run ios` (or Xcode's Run button), and `cd ios && pod install`
     first if a native dependency changed.
   - Android: re-run `npm run android`.
5. If something is behaving inexplicably (stale bundle, phantom errors),
   see the cache-reset commands in `docs/commands.md` before assuming a
   real bug — Metro's cache is the first suspect.

## Adding a new screen

1. Create `src/screens/YourScreen.js` (copy an existing simple screen as a
   starting template — `AboutUsScreen.js` is a good minimal example).
2. Import it in `App.js` and add a `<Stack.Screen name="Your" component={YourScreen} />` entry.
3. Navigate to it from elsewhere with `navigation.navigate('Your')`.

## Adding a new service function

Put pure data/business logic in `src/services/`, not inside screen
components — screens should stay focused on rendering and user
interaction. If a function talks to the network, add it to `api.js` (or a
feature-specific service file that itself calls into `api.js`).
