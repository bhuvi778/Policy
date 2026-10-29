package com.policybhandar

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.min

class ProfileImagePickerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var pendingPromise: Promise? = null
  private val worker = Executors.newSingleThreadExecutor()
  private val assets = MediaAssetStore(reactContext)

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

      prepareImage(uri.toString(), promise)
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "PolicyBhandarProfileImagePicker"

  @ReactMethod
  fun prepareImage(uri: String, promise: Promise) {
    worker.execute {
      try {
        val bitmap = assets.bitmap(uri)
        try { promise.resolve(saveImage(bitmap)) } finally { bitmap.recycle() }
      } catch (error: Exception) { promise.reject("IMAGE_PREPARE_FAILED", error.message, error) }
    }
  }

  @ReactMethod
  fun cropImage(uri: String, x: Double, y: Double, width: Double, height: Double, fitWholeImage: Boolean, promise: Promise) {
    worker.execute {
      var source: Bitmap? = null
      var output: Bitmap? = null
      try {
        source = assets.bitmap(uri)
        output = Bitmap.createBitmap(1024, 1024, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        if (fitWholeImage) {
          val scale = min(1024f / source.width, 1024f / source.height)
          val w = source.width * scale
          val h = source.height * scale
          canvas.drawBitmap(source, null, RectF((1024 - w) / 2, (1024 - h) / 2, (1024 + w) / 2, (1024 + h) / 2), paint)
        } else {
          require(listOf(x, y, width, height).all { it.isFinite() }) { "Invalid crop area." }
          val left = (x.coerceIn(0.0, 1.0) * source.width).toInt().coerceIn(0, source.width - 1)
          val top = (y.coerceIn(0.0, 1.0) * source.height).toInt().coerceIn(0, source.height - 1)
          val w = max(1, (width.coerceIn(0.0, 1.0) * source.width).toInt()).coerceAtMost(source.width - left)
          val h = max(1, (height.coerceIn(0.0, 1.0) * source.height).toInt()).coerceAtMost(source.height - top)
          canvas.drawBitmap(source, android.graphics.Rect(left, top, left + w, top + h), RectF(0f, 0f, 1024f, 1024f), paint)
        }
        promise.resolve(saveImage(output))
      } catch (error: Exception) { promise.reject("IMAGE_CROP_FAILED", error.message, error) }
      finally { output?.recycle(); source?.recycle() }
    }
  }

  private fun saveImage(bitmap: Bitmap): com.facebook.react.bridge.WritableMap {
    // Private app files survive process restarts until the backend's canonical image is returned.
    val directory = File(reactContext.filesDir, "profile-images").apply { mkdirs() }
    val file = File(directory, "profile-${System.currentTimeMillis()}.png")
    file.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
    return Arguments.createMap().apply {
      putString("uri", Uri.fromFile(file).toString())
      putString("name", file.name)
      putString("type", "image/png")
      putInt("width", bitmap.width)
      putInt("height", bitmap.height)
    }
  }

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
