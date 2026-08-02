package com.policybhandar

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min

class VisitingCardScannerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "PolicyBhandarVisitingCardScanner"

  @ReactMethod
  fun processCardImage(photoPath: String, frameRatio: Double, promise: Promise) {
    Thread {
      try {
        val sourcePath = normalizePath(photoPath)
        if (sourcePath.isBlank()) {
          promise.reject("CARD_IMAGE_MISSING", "Captured card image path is missing.")
          return@Thread
        }

        val sourceFile = File(sourcePath)
        if (!sourceFile.exists()) {
          promise.reject("CARD_IMAGE_NOT_FOUND", "Captured card image was not found.")
          return@Thread
        }

        val decoded = BitmapFactory.decodeFile(sourceFile.absolutePath)
        if (decoded == null) {
          promise.reject("CARD_IMAGE_DECODE_FAILED", "Unable to read captured card image.")
          return@Thread
        }

        val oriented = applyExifOrientation(decoded, sourceFile.absolutePath)
        val cropped = cropCenterCard(oriented, if (frameRatio > 0) frameRatio else 1.72)
        val outputFile = File(reactContext.cacheDir, "visiting-card-${System.currentTimeMillis()}.jpg")
        FileOutputStream(outputFile).use { stream ->
          cropped.compress(Bitmap.CompressFormat.JPEG, 92, stream)
        }

        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        recognizer.process(InputImage.fromBitmap(cropped, 0))
          .addOnSuccessListener { result ->
            val map = Arguments.createMap()
            map.putString("uri", Uri.fromFile(outputFile).toString())
            map.putString("path", outputFile.absolutePath)
            map.putString("text", result.text ?: "")
            map.putInt("width", cropped.width)
            map.putInt("height", cropped.height)
            promise.resolve(map)
          }
          .addOnFailureListener { error ->
            val map = Arguments.createMap()
            map.putString("uri", Uri.fromFile(outputFile).toString())
            map.putString("path", outputFile.absolutePath)
            map.putString("text", "")
            map.putString("warning", error.message ?: "Text recognition failed.")
            map.putInt("width", cropped.width)
            map.putInt("height", cropped.height)
            promise.resolve(map)
          }
      } catch (error: Exception) {
        promise.reject("CARD_PROCESS_FAILED", error.message ?: "Unable to process visiting card.")
      }
    }.start()
  }

  private fun normalizePath(value: String): String {
    val text = value.trim()
    if (text.startsWith("file://")) return Uri.parse(text).path ?: ""
    return text
  }

  private fun applyExifOrientation(bitmap: Bitmap, path: String): Bitmap {
    return try {
      val orientation = ExifInterface(path).getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_NORMAL
      )
      val degrees = when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
      }
      if (degrees == 0f) bitmap else Bitmap.createBitmap(
        bitmap,
        0,
        0,
        bitmap.width,
        bitmap.height,
        Matrix().apply { postRotate(degrees) },
        true
      )
    } catch (_: Exception) {
      bitmap
    }
  }

  private fun cropCenterCard(bitmap: Bitmap, ratio: Double): Bitmap {
    val safeRatio = ratio.coerceIn(1.2, 2.2)
    val maxWidth = (bitmap.width * 0.9).toInt()
    val maxHeight = (bitmap.height * 0.42).toInt()
    var cropWidth = maxWidth
    var cropHeight = (cropWidth / safeRatio).toInt()

    if (cropHeight > maxHeight) {
      cropHeight = maxHeight
      cropWidth = (cropHeight * safeRatio).toInt()
    }

    cropWidth = min(max(cropWidth, bitmap.width / 2), bitmap.width)
    cropHeight = min(max(cropHeight, bitmap.height / 5), bitmap.height)

    val left = ((bitmap.width - cropWidth) / 2).coerceAtLeast(0)
    val top = ((bitmap.height - cropHeight) / 2).coerceAtLeast(0)
    val width = min(cropWidth, bitmap.width - left)
    val height = min(cropHeight, bitmap.height - top)
    return Bitmap.createBitmap(bitmap, left, top, width, height)
  }
}
