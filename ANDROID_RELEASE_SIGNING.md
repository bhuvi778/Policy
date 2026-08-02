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
