# Keep the shared Kotlin runtime calls used by AndroidJUnitRunner/test code.
# This file is applied only to the separate .qa package, never the production build.
-keep class kotlin.** { *; }
-keep class androidx.tracing.** { *; }
-keep class com.policybhandar.DownloadModule { *; }
-keep class com.policybhandar.ProfileImagePickerModule { *; }
-keep class com.facebook.react.bridge.BridgeReactContext { *; }
-keep class com.facebook.react.bridge.Arguments { *; }
