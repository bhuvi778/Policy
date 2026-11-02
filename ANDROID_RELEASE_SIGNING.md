# Android Release Signing

Release keystore files and passwords are intentionally not committed to Git.

Set these values in your local `~/.gradle/gradle.properties` or CI environment before running a release build:

```properties
POLICYBHANDAR_STORE_FILE=policybhandar-release.keystore
POLICYBHANDAR_STORE_PASSWORD=your_store_password
POLICYBHANDAR_KEY_ALIAS=policybhandar
POLICYBHANDAR_KEY_PASSWORD=your_key_password
```

Place the keystore file locally at `android/app/policybhandar-release.keystore`, or set `POLICYBHANDAR_STORE_FILE` to its absolute path.

## Play update build

With the four signing variables set in the process environment, run:

```powershell
.\scripts\build-play-release.ps1 -VersionCode 48 -VersionName 1.0.47
```

Use a version code greater than every previously uploaded code in Play Console,
including testing tracks. The script forces the `play` distribution, keeps all
four Android ABIs, and copies the signed AAB, APK, mapping and native symbols to
`outputs/playstore-v48/`. Local signing values and generated files are excluded
from Git.

The Play build offers existing membership access/status without in-app plan
purchases, Razorpay checkout, or links asking users to pay elsewhere. Its native
distribution constant controls this behavior and defaults safely to `play`.
Do not change it from the server or through a user setting.

The separate direct distribution can retain Razorpay:

```powershell
cd android
.\gradlew.bat app:assembleRelease '-PPOLICYBHANDAR_DISTRIBUTION=direct'
```

Never upload the direct-distribution APK/AAB to Play as the access-only release.
