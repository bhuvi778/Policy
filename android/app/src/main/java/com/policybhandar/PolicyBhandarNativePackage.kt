package com.policybhandar

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PolicyBhandarNativePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(
      DownloadModule(reactContext),
      ClipboardModule(reactContext),
      ProfileImagePickerModule(reactContext),
      VisitingCardScannerModule(reactContext)
    )

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    listOf(PolicyBhandarVideoViewManager())
}
