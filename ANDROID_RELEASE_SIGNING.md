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
.\scripts\build-play-release.ps1 -VersionCode 49 -VersionName 1.0.48
```

Use a version code greater than every previously uploaded code in Play Console,
including testing tracks. The script forces the `play` distribution, keeps all
four Android ABIs, and copies the signed AAB, APK, mapping and native symbols to
`outputs/playstore-v49/`. Local signing values and generated files are excluded
from Git.

Purchasing is enabled in this release. Membership plans, Buy Now and Upgrade
open the native Razorpay checkout using server-created orders/subscriptions.
The native distribution constant is metadata and does not disable purchasing.

Version 48 used the earlier access-only behavior and is superseded by version 49.
Do not upload v48 when delivering the restored purchase flow. Store billing
eligibility and approval remain separate from the technical checkout fix.

After building, validate the original upload signature, version, JavaScript
sources, four ABIs and 16 KB alignment:

```powershell
.\scripts\verify-play-release.ps1 -VersionCode 49 -VersionName 1.0.48
```
