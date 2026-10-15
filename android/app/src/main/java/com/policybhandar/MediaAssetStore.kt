package com.policybhandar

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.util.Base64
import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.UUID
import kotlin.math.max

/** Disk-backed assets keep source downloads and full-resolution decodes off the JS/UI thread. */
internal class MediaAssetStore(private val context: Context) {
  private val directory = File(context.cacheDir, "media-assets").apply { mkdirs() }

  @Synchronized fun localFile(raw: String): File {
    val uri = Uri.parse(raw)
    if (uri.scheme == "file") return File(requireNotNull(uri.path))
    if (uri.scheme == null && File(raw).exists()) return File(raw)
    val key = MessageDigest.getInstance("SHA-256").digest(raw.toByteArray()).joinToString("") { "%02x".format(it) }
    val file = File(directory, key)
    if (file.exists() && file.length() > 0 && System.currentTimeMillis() - file.lastModified() < 24 * 60 * 60 * 1000L) return file
    val temp = File(directory, "$key-${UUID.randomUUID()}.part")
    try {
      when (uri.scheme) {
        "http", "https" -> {
          val connection = URL(raw).openConnection() as HttpURLConnection
          connection.connectTimeout = 15000
          connection.readTimeout = 45000
          connection.setRequestProperty("User-Agent", "PolicyBhandar/1.0")
          try {
            if (connection.responseCode !in 200..299) throw IOException("Media could not be loaded (${connection.responseCode}).")
            connection.inputStream.use { input -> temp.outputStream().use { input.copyTo(it) } }
          } finally { connection.disconnect() }
        }
        "content" -> context.contentResolver.openInputStream(uri)?.use { input -> temp.outputStream().use { input.copyTo(it) } }
          ?: throw IOException("Selected image is no longer accessible. Please select it again.")
        "data" -> temp.writeBytes(Base64.decode(raw.substringAfter(','), Base64.DEFAULT))
        else -> throw IOException("Unsupported media address.")
      }
      if (temp.length() == 0L) throw IOException("The media file is empty.")
      if (file.exists() && file.length() > 0 && System.currentTimeMillis() - file.lastModified() < 24 * 60 * 60 * 1000L) return file
      if (file.exists()) file.delete()
      if (!temp.renameTo(file) && (!file.exists() || file.length() == 0L)) throw IOException("Unable to cache the media file.")
      // Bound disk use; never remove the asset being returned to the renderer.
      var bytes = directory.listFiles()?.sumOf { it.length() } ?: 0L
      directory.listFiles()?.filter { it != file && !it.name.endsWith(".part") }?.sortedBy { it.lastModified() }?.forEach {
        if (bytes > 256 * 1024 * 1024L) { val length = it.length(); if (it.delete()) bytes -= length }
      }
      return file
    } finally { temp.delete() }
  }

  fun bitmap(raw: String, maxSide: Int = 2048): Bitmap {
    val file = localFile(raw)
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw IOException("The selected file is not a supported image.")
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / sample > maxSide * 2) sample *= 2
    val decoded = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
      ?: throw IOException("Unable to read this image.")
    val orientation = try { ExifInterface(file).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) } catch (_: Exception) { ExifInterface.ORIENTATION_NORMAL }
    val matrix = Matrix().apply {
      when (orientation) {
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> setScale(-1f, 1f)
        ExifInterface.ORIENTATION_ROTATE_180 -> setRotate(180f)
        ExifInterface.ORIENTATION_FLIP_VERTICAL -> setScale(1f, -1f)
        ExifInterface.ORIENTATION_TRANSPOSE -> { setRotate(90f); postScale(-1f, 1f) }
        ExifInterface.ORIENTATION_ROTATE_90 -> setRotate(90f)
        ExifInterface.ORIENTATION_TRANSVERSE -> { setRotate(-90f); postScale(-1f, 1f) }
        ExifInterface.ORIENTATION_ROTATE_270 -> setRotate(-90f)
      }
    }
    var result = if (matrix.isIdentity) decoded else Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true).also { if (it != decoded) decoded.recycle() }
    val side = max(result.width, result.height)
    if (side > maxSide) {
      val scaled = Bitmap.createScaledBitmap(result, max(1, result.width * maxSide / side), max(1, result.height * maxSide / side), true)
      if (scaled != result) result.recycle()
      result = scaled
    }
    return result
  }
}
