package com.policybhandar

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ClipboardModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "PolicyBhandarClipboard"

  @ReactMethod
  fun copyText(text: String?, promise: Promise) {
    try {
      val value = text?.trim().orEmpty()
      if (value.isBlank()) {
        promise.reject("CLIPBOARD_EMPTY", "Nothing to copy.")
        return
      }

      val clipboard = reactContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      clipboard.setPrimaryClip(ClipData.newPlainText("PolicyBhandar Link", value))
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("CLIPBOARD_FAILED", error.message, error)
    }
  }
}
