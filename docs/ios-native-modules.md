# iOS native modules — parity status

This app started as Android-only with 5 custom native modules
(`android/app/src/main/java/com/policybhandar/`). This doc tracks their iOS
Swift ports (`ios/PolicyBhandar/NativeModules/`) and any deliberate
behavior differences.

Every native module call site in `src/` is guarded with `NativeModules.X?.method`
optional chaining, so none of this was ever required just to *run* the app on
iOS — it's required for these specific features to work there.

## `PolicyBhandarClipboard`

**Status: full parity.** `copyText(text)` → `UIPasteboard.general.string`.
Same error code (`CLIPBOARD_EMPTY`) for blank input.

## `PolicyBhandarProfileImagePicker`

**Status: full parity**, implementation differs by necessity.

- Android: `ACTION_OPEN_DOCUMENT` system file picker, returns a persistable
  `content://` URI.
- iOS: `PHPickerViewController` (no permission prompt needed — Apple's
  privacy-preserving picker). The picked image is written to a temp JPEG
  and returned as a `file://` URI, matching the `{uri, name, type}` shape
  `MyProfileScreen.js` expects for its upload `FormData`.

## `PolicyBhandarDownloader`

**Status: `download` and `shareFile` ported. `downloadCustomizedImage` /
`downloadImageWithWatermark` intentionally NOT ported.**

Why: `src/services/downloads.js` gates the local on-device watermark
compositor behind `Platform.OS === 'android'` explicitly — on iOS, the app
already relies on the backend rendering the watermarked image
(`resolveBackendDownloadUrl` → `downloadMaterial` API call) before falling
back to `download`/`shareFile`. Porting ~700 lines of Android Canvas
drawing (footer bands, QR placeholder, profile badge, social caption
compositing) to iOS Core Graphics would duplicate work the backend already
does, for a code path the JS never invokes on iOS. If that assumption ever
changes (e.g. product wants offline/local compositing on iOS too), that's a
separate, sizeable follow-up — see `DownloadModule.kt` lines 397–1108 for
the Android reference implementation.

Behavior differences in what *is* ported:

- **Save location:** Android saves to the public `Downloads/` folder via
  `MediaStore`. iOS has no public-storage equivalent without extra
  permissions/UX, so files save to `Documents/Downloads/` inside the app's
  own sandbox, which is visible in the iOS **Files** app under "On My
  iPhone/iPad → PolicyBhandar" (enabled via `UIFileSharingEnabled` +
  `LSSupportsOpeningDocumentsInPlace` in `Info.plist`).
- **`whatsappOnly` share:** Android can silently target the WhatsApp share
  intent directly. iOS has no public API to bypass the share sheet for a
  specific app — `shareFile` always presents the standard
  `UIActivityViewController`, where WhatsApp appears as one of the options
  if installed. This is a platform restriction, not a bug.

## `PolicyBhandarVisitingCardScanner`

**Status: full parity**, OCR engine differs by necessity.

- Android: ML Kit `TextRecognition`.
- iOS: Vision framework `VNRecognizeTextRequest` (`.accurate` recognition
  level).

Crop math (center-crop to the visiting-card aspect ratio, ratio clamped to
1.2–2.2, width/height bounds) is a direct port of `cropCenterCard` in
`VisitingCardScannerModule.kt`. Result shape matches exactly:
`{uri, path, text, width, height, warning?}`.

## `PolicyBhandarVideoView`

**Status: functional parity, simplified controls.**

- Android: system `VideoView` + `MediaController` (play/pause, seek bar,
  auto-hide).
- iOS: `AVPlayer` + `AVPlayerLayer` with a small custom overlay (play/pause
  button, scrub bar, tap-to-toggle-visibility, auto-hide after 2.5s) — iOS
  has no drop-in `MediaController` equivalent that composes as a plain
  `UIView` subview without full view-controller containment, so a
  lightweight custom overlay was built instead.

Same props (`source`, `thumbnailMode`) and same three events
(`onVideoLoadStart`, `onVideoReady`, `onVideoError`) as Android.
`src/components/NativeVideoPlayer.js` now calls `requireNativeComponent('PolicyBhandarVideoView')`
on both platforms (previously Android-only).

## Registering new native files in Xcode

`ios/PolicyBhandar.xcodeproj` uses the classic explicit-file-reference
format (not Xcode 16's synchronized folders), so dropping a `.swift`/`.m`
file into `ios/PolicyBhandar/NativeModules/` does **not** automatically add
it to the build. Use the `xcodeproj` Ruby gem instead of hand-editing
`project.pbxproj`:

```bash
gem install xcodeproj   # one-time
```

Then a short Ruby script (`project.targets.find`, `group.new_reference`,
`target.add_file_references`) adds the file references and source-build-phase
entries safely. Hand-editing `project.pbxproj` text directly is easy to get
subtly wrong (duplicate UUIDs, orphaned refs) — prefer the gem.

## Testing these features in Simulator

- Clipboard, download, share, video: work in Simulator.
- Profile image picker: works in Simulator (Simulator ships a seeded Photos
  library).
- Visiting card scanner: the OCR/crop logic works in Simulator on any
  existing photo, but **camera capture itself** (`react-native-vision-camera`)
  requires a physical device — Simulator has no camera hardware.
