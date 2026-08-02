package com.policybhandar

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ProfileImagePickerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var pendingPromise: Promise? = null

  private val activityEventListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != REQUEST_PICK_IMAGE) return

      val promise = pendingPromise ?: return
      pendingPromise = null

      if (resultCode != Activity.RESULT_OK) {
        promise.resolve(null)
        return
      }

      val uri = data?.data
      if (uri == null) {
        promise.reject("IMAGE_PICKER_EMPTY", "No image was selected.")
        return
      }

      try {
        reactContext.contentResolver.takePersistableUriPermission(
          uri,
          Intent.FLAG_GRANT_READ_URI_PERMISSION
        )
      } catch (_: Exception) {
        // Some pickers return temporary read grants only; React Native can still upload them.
      }

      val result = Arguments.createMap()
      result.putString("uri", uri.toString())
      result.putString("name", getDisplayName(uri))
      result.putString("type", reactContext.contentResolver.getType(uri) ?: "image/jpeg")
      promise.resolve(result)
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "PolicyBhandarProfileImagePicker"

  @ReactMethod
  fun pickImage(promise: Promise) {
    val activity = getCurrentActivity()
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Unable to open image picker right now.")
      return
    }
    if (pendingPromise != null) {
      promise.reject("PICKER_BUSY", "Image picker is already open.")
      return
    }

    pendingPromise = promise
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "image/*"
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
    }

    try {
      activity.startActivityForResult(intent, REQUEST_PICK_IMAGE)
    } catch (error: Exception) {
      pendingPromise = null
      promise.reject("IMAGE_PICKER_FAILED", error.message, error)
    }
  }

  private fun getDisplayName(uri: Uri): String {
    reactContext.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
      val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
      if (nameIndex >= 0 && cursor.moveToFirst()) {
        val name = cursor.getString(nameIndex)
        if (!name.isNullOrBlank()) return name
      }
    }
    return "profile-${System.currentTimeMillis()}.jpg"
  }

  companion object {
    private const val REQUEST_PICK_IMAGE = 9021
  }
}
