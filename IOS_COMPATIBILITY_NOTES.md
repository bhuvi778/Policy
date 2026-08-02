# iOS Compatibility Notes

This source package currently contains the Android React Native project and shared JavaScript source.

## Current status

- Android app code is present under `android/`.
- Shared React Native screens, services, assets, and app entry files are present under `src/`, `assets/`, `App.js`, and `index.js`.
- There is no `ios/` Xcode project folder in this checkout.

## Native modules that need iOS equivalents

The Android app uses custom native modules in `android/app/src/main/java/com/policybhandar/`:

- `DownloadModule.kt`
- `ClipboardModule.kt`
- `ProfileImagePickerModule.kt`
- `PolicyBhandarVideoViewManager.kt`
- `VisitingCardScannerModule.kt`

Before App Store submission, create an iOS target and implement matching native modules in Swift/Objective-C, or replace these features with cross-platform React Native/Expo packages.

## Visiting card scanner

The latest Android scanner uses:

- Center-frame card crop in `VisitingCardScannerModule.kt`
- ML Kit text recognition to prefill name/mobile in `DataEntryScreen`

For iOS, implement an equivalent using Vision/VisionKit text recognition or a cross-platform OCR package.
