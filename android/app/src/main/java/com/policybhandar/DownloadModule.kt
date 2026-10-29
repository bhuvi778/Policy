package com.policybhandar

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ContentValues
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.media.MediaScannerConnection
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Base64
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.modules.core.DeviceEventManagerModule
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.Size
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.GlMatrixTransformation
import androidx.media3.effect.OverlayEffect
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import java.util.concurrent.atomic.AtomicBoolean
import java.util.UUID
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

@androidx.annotation.OptIn(markerClass = [UnstableApi::class])
class DownloadModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val assets = MediaAssetStore(reactContext)
  private val mainHandler = Handler(Looper.getMainLooper())
  private val videoBusy = AtomicBoolean(false)
  private var activeTransformer: Transformer? = null
  private var activeExportCancel: (() -> Unit)? = null

  override fun invalidate() {
    mainHandler.post { activeExportCancel?.invoke(); activeExportCancel = null; activeTransformer = null }
    super.invalidate()
  }

  private fun sendProgress(phase: String, percent: Int = -1) {
    if (!reactContext.hasActiveReactInstance()) return
    val event = Arguments.createMap().apply { putString("phase", phase); putInt("percent", percent) }
    runCatching { reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("PolicyBhandarExportProgress", event) }
  }

  private data class CustomizationOptions(
    val recipientType: String = "",
    val recipientName: String = "",
    val watermarkText: String = "",
    val watermarkType: String = "digicard",
    val watermarkOrientation: String = "diagonal",
    val fontColor: String = "",
    val includeWatermark: Boolean = false,
    val includeLogo: Boolean = false,
    val includeLogoOverlay: Boolean = false,
    val includeSocialCaption: Boolean = false,
    val includeQrCode: Boolean = false,
    val advisorName: String = "",
    val advisorDesignation: String = "",
    val advisorMobile: String = "",
    val advisorEmail: String = "",
    val logoUrl: String = "",
    val profileImageUrl: String = "",
    val logoOverlayUrl: String = "",
    val logoOverlayX: Double = 0.06,
    val logoOverlayY: Double = 0.06,
    val qrCodeUrl: String = "",
    val qrData: String = "",
    val qrPosition: String = "right",
    val generatedDate: String = ""
  )

  override fun getName(): String = "PolicyBhandarDownloader"

  @ReactMethod
  fun prepareCustomizedImage(url: String, fileName: String?, options: ReadableMap?, promise: Promise) {
    val customization = optionsFromReadableMap(options)
    sendProgress("loading")
    Thread {
      var source: Bitmap? = null
      var output: Bitmap? = null
      try {
        source = loadBitmap(url)
        output = drawCustomizedImage(source, customization)
        val file = newPreparedFile("jpg")
        file.outputStream().use { check(output.compress(Bitmap.CompressFormat.JPEG, 94, it)) }
        promise.resolve(preparedResult(file, safeImageFileName(fileName), "image/jpeg", output.width, output.height))
      } catch (error: Exception) { promise.reject("PREPARE_IMAGE_FAILED", error.message, error) }
      finally { if (output != source) output?.recycle(); source?.recycle() }
    }.start()
  }

  @ReactMethod
  fun prepareCustomizedVideo(url: String, fileName: String?, options: ReadableMap?, promise: Promise) {
    if (!videoBusy.compareAndSet(false, true)) {
      promise.reject("EXPORT_BUSY", "A reel is already being prepared. Please wait for it to finish.")
      return
    }
    val customization = optionsFromReadableMap(options)
    sendProgress("loading")
    Thread {
      var overlay: Bitmap? = null
      var outputFile: File? = null
      try {
        val source = assets.localFile(url)
        val metadata = MediaMetadataRetriever()
        val dimensions = try {
          metadata.setDataSource(source.path)
          val w = metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
          val h = metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
          val rotation = metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
          if (rotation % 180 != 0) Pair(h, w) else Pair(w, h)
        } finally { metadata.release() }
        require(dimensions.first > 0 && dimensions.second > 0) { "This reel has no supported video track." }
        val scale = min(1.0, 1280.0 / max(dimensions.first, dimensions.second))
        val width = ((dimensions.first * scale).toInt() / 2 * 2).coerceAtLeast(2)
        val height = ((dimensions.second * scale).toInt() / 2 * 2).coerceAtLeast(2)
        val footerHeight = ((width * 0.24f).toInt() / 2 * 2).coerceAtLeast(2)
        val totalHeight = height + footerHeight
        val bitmap = Bitmap.createBitmap(width, totalHeight, Bitmap.Config.ARGB_8888)
        overlay = bitmap
        val canvas = Canvas(bitmap)
        drawTextWatermark(canvas, width, height, customization)
        if (customization.includeLogoOverlay) drawTemplateLogoOverlay(canvas, width, height, customization)
        drawFooterBand(canvas, width, height, footerHeight.toFloat(), customization)
        val file = newPreparedFile("mp4")
        outputFile = file
        val matrix = FloatArray(16).also {
          android.opengl.Matrix.setIdentityM(it, 0)
          it[5] = height.toFloat() / totalHeight
          it[13] = footerHeight.toFloat() / totalHeight
        }
        val framing = object : GlMatrixTransformation {
          override fun configure(inputWidth: Int, inputHeight: Int): Size = Size(width, totalHeight)
          override fun getGlMatrixArray(presentationTimeUs: Long): FloatArray = matrix
        }
        mainHandler.post {
          try {
            val handler = Handler(Looper.getMainLooper())
            val done = AtomicBoolean(false)
            var monitor: Runnable? = null
            val started = System.currentTimeMillis()
            val listener = object : Transformer.Listener {
              override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                if (!done.compareAndSet(false, true)) return
                monitor?.let { handler.removeCallbacks(it) }
                activeTransformer = null
                activeExportCancel = null
                videoBusy.set(false)
                bitmap.recycle()
                sendProgress("ready", 100)
                try { promise.resolve(preparedResult(file, safeFileName(fileName, "video/mp4", url).substringBeforeLast('.') + ".mp4", "video/mp4", width, totalHeight)) }
                catch (error: Exception) { promise.reject("PREPARE_VIDEO_FAILED", error.message, error) }
              }
              override fun onError(composition: Composition, exportResult: ExportResult, exception: ExportException) {
                if (!done.compareAndSet(false, true)) return
                monitor?.let { handler.removeCallbacks(it) }
                activeTransformer = null
                activeExportCancel = null
                videoBusy.set(false)
                bitmap.recycle()
                file.delete()
                promise.reject("PREPARE_VIDEO_FAILED", "Unable to personalize this reel. Please try again.", exception)
              }
            }
            val transformer = Transformer.Builder(reactContext)
              .setVideoMimeType(MimeTypes.VIDEO_H264)
              .setAudioMimeType(MimeTypes.AUDIO_AAC)
              .addListener(listener).build()
            activeTransformer = transformer
            activeExportCancel = {
              if (done.compareAndSet(false, true)) {
                monitor?.let { handler.removeCallbacks(it) }
                transformer.cancel(); bitmap.recycle(); file.delete(); videoBusy.set(false)
                promise.reject("EXPORT_CANCELLED", "Reel preparation was cancelled. Please retry.")
              }
            }
            val edited = EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(source)))
              .setEffects(Effects(emptyList(), listOf(framing, OverlayEffect(listOf(BitmapOverlay.createStaticBitmapOverlay(bitmap))))))
              .build()
            transformer.start(edited, file.path)
            monitor = object : Runnable {
              override fun run() {
                if (done.get()) return
                if (System.currentTimeMillis() - started > 180000) {
                  done.set(true); transformer.cancel(); activeTransformer = null; activeExportCancel = null
                  bitmap.recycle(); file.delete(); videoBusy.set(false)
                  promise.reject("EXPORT_TIMEOUT", "This reel took too long to prepare. Please try a shorter reel or retry.")
                  return
                }
                val progress = ProgressHolder()
                if (transformer.getProgress(progress) == Transformer.PROGRESS_STATE_AVAILABLE) sendProgress("exporting", progress.progress)
                handler.postDelayed(this, 500)
              }
            }
            handler.post(monitor!!)
          } catch (error: Exception) {
            activeTransformer?.cancel(); activeTransformer = null; activeExportCancel = null
            videoBusy.set(false); bitmap.recycle(); file.delete()
            promise.reject("PREPARE_VIDEO_FAILED", error.message, error)
          }
        }
      } catch (error: Exception) {
        videoBusy.set(false); overlay?.recycle(); outputFile?.delete()
        promise.reject("PREPARE_VIDEO_FAILED", error.message, error)
      }
    }.start()
  }

  private fun newPreparedFile(extension: String): File {
    val dir = File(reactContext.cacheDir, "policybhandar-share").apply { mkdirs() }
    val expiry = System.currentTimeMillis() - 3 * 24 * 60 * 60 * 1000L
    dir.listFiles()?.filter { it.lastModified() < expiry }?.forEach { it.delete() }
    return File(dir, "prepared-${UUID.randomUUID()}.$extension")
  }

  private fun preparedResult(file: File, name: String, mime: String, width: Int = 0, height: Int = 0) = Arguments.createMap().apply {
    putString("filename", name)
    putString("fileUri", Uri.fromFile(file).toString())
    putString("contentUri", fileToContentUri(file).toString())
    putString("mimeType", mime)
    putBoolean("customized", true)
    putBoolean("savedToDevice", false)
    putInt("width", width)
    putInt("height", height)
  }

  @ReactMethod
  fun download(url: String, fileName: String?, mimeType: String?, promise: Promise) {
    Thread {
      try {
        if (url.isBlank()) {
          promise.reject("DOWNLOAD_URL_MISSING", "Download URL is missing.")
          return@Thread
        }

        val safeName = safeFileName(fileName, mimeType, url)
        val savedName = downloadUrlToDownloads(url, safeName, mimeType)
        val result = Arguments.createMap()
        result.putString("filename", savedName)
        result.putString("directory", Environment.DIRECTORY_DOWNLOADS)
        result.putString("url", url)
        promise.resolve(result)
      } catch (error: Exception) {
        promise.reject("DOWNLOAD_FAILED", error.message, error)
      }
    }.start()
  }

  @ReactMethod
  fun shareFile(
    url: String,
    fileName: String?,
    mimeType: String?,
    message: String?,
    whatsappOnly: Boolean,
    promise: Promise
  ) {
    Thread {
      try {
        if (url.isBlank()) {
          promise.reject("SHARE_URL_MISSING", "Share URL is missing.")
          return@Thread
        }

        val resolvedMime = resolveMimeType(mimeType, url)
        val safeName = safeFileName(fileName, resolvedMime, url)
        val shareUri = resolveShareUri(url, safeName, resolvedMime)

        reactContext.runOnUiQueueThread {
          try {
            launchShareIntent(shareUri, resolvedMime, message.orEmpty(), whatsappOnly)
            val result = Arguments.createMap()
            result.putString("uri", shareUri.toString())
            result.putString("filename", safeName)
            result.putString("mimeType", resolvedMime)
            result.putBoolean("whatsappOnly", whatsappOnly)
            promise.resolve(result)
          } catch (error: Exception) {
            promise.reject("SHARE_FAILED", error.message, error)
          }
        }
      } catch (error: Exception) {
        promise.reject("SHARE_FAILED", error.message, error)
      }
    }.start()
  }

  @ReactMethod
  fun shareFileToApp(
    url: String,
    fileName: String?,
    mimeType: String?,
    message: String?,
    targetApp: String?,
    promise: Promise
  ) {
    Thread {
      try {
        if (url.isBlank()) {
          promise.reject("SHARE_URL_MISSING", "Share URL is missing.")
          return@Thread
        }

        val resolvedMime = resolveMimeType(mimeType, url)
        val safeName = safeFileName(fileName, resolvedMime, url)
        val shareUri = resolveShareUri(url, safeName, resolvedMime)

        reactContext.runOnUiQueueThread {
          try {
            launchTargetShareIntent(shareUri, resolvedMime, message.orEmpty(), targetApp.orEmpty())
            val result = Arguments.createMap()
            result.putString("uri", shareUri.toString())
            result.putString("filename", safeName)
            result.putString("mimeType", resolvedMime)
            result.putString("targetApp", targetApp.orEmpty())
            promise.resolve(result)
          } catch (error: Exception) {
            promise.reject("SHARE_FAILED", error.message, error)
          }
        }
      } catch (error: Exception) {
        promise.reject("SHARE_FAILED", error.message, error)
      }
    }.start()
  }

  @ReactMethod
  fun downloadCustomizedImage(
    url: String,
    fileName: String?,
    options: ReadableMap?,
    promise: Promise
  ) {
    val customOptions = optionsFromReadableMap(options)
    startCustomizedImageDownload(url, fileName, customOptions, promise)
  }

  @ReactMethod
  fun downloadImageWithWatermark(
    url: String,
    fileName: String?,
    watermarkText: String?,
    options: ReadableMap?,
    promise: Promise
  ) {
    val customOptions = optionsFromReadableMap(options, watermarkText)
    startCustomizedImageDownload(url, fileName, customOptions, promise)
  }

  private fun startCustomizedImageDownload(
    url: String,
    fileName: String?,
    customOptions: CustomizationOptions,
    promise: Promise
  ) {
    Thread {
      var sourceBitmap: Bitmap? = null
      var customizedBitmap: Bitmap? = null

      try {
        if (url.isBlank()) {
          promise.reject("DOWNLOAD_URL_MISSING", "Download URL is missing.")
          return@Thread
        }

        sourceBitmap = loadBitmap(url)
        customizedBitmap = drawCustomizedImage(sourceBitmap, customOptions)

        val safeName = safeImageFileName(fileName)
        val savedUri = saveBitmapToDownloads(customizedBitmap, safeName)

        val result = Arguments.createMap()
        result.putString("filename", safeName)
        result.putString("directory", Environment.DIRECTORY_DOWNLOADS)
        result.putString("url", url)
        result.putString("contentUri", savedUri)
        result.putString("fileUri", savedUri)
        result.putBoolean("customized", true)
        promise.resolve(result)
      } catch (error: Exception) {
        promise.reject("CUSTOM_DOWNLOAD_FAILED", error.message, error)
      } finally {
        if (customizedBitmap != null && customizedBitmap != sourceBitmap) {
          customizedBitmap.recycle()
        }
        sourceBitmap?.recycle()
      }
    }.start()
  }

  private fun optionsFromReadableMap(options: ReadableMap?, legacyWatermarkText: String? = null): CustomizationOptions {
    return CustomizationOptions(
      recipientType = readString(options, "recipientType"),
      recipientName = readString(options, "recipientName"),
      watermarkText = readString(options, "watermarkText").ifBlank { legacyWatermarkText?.trim().orEmpty() },
      watermarkType = readString(options, "watermarkType")
        .ifBlank { readString(options, "downloadMode") }
        .ifBlank { "digicard" },
      watermarkOrientation = readString(options, "watermarkOrientation")
        .ifBlank { readString(options, "watermarkDirection") }
        .ifBlank { "diagonal" },
      fontColor = readString(options, "fontColor"),
      includeWatermark = readBoolean(options, "includeWatermark") || readBoolean(options, "watermark") || readBoolean(options, "waterMark") || !legacyWatermarkText.isNullOrBlank(),
      includeLogo = readBoolean(options, "includeLogo") || readBoolean(options, "showLogo") || readBoolean(options, "yourLogo"),
      includeLogoOverlay = readBoolean(options, "includeLogoOverlay") || readBoolean(options, "logoOverlay") || readBoolean(options, "showLogoOverlay"),
      includeSocialCaption = readBoolean(options, "includeSocialCaption") || readBoolean(options, "showSocialCaption") || readBoolean(options, "socialCaption"),
      includeQrCode = readBoolean(options, "includeQrCode") || readBoolean(options, "showQrCode") || readBoolean(options, "qrCode"),
      advisorName = readString(options, "advisorName"),
      advisorDesignation = readString(options, "advisorDesignation"),
      advisorMobile = readString(options, "advisorMobile"),
      advisorEmail = readString(options, "advisorEmail"),
      logoUrl = firstNonBlank(
        readString(options, "logoUrl"),
        readString(options, "profileLogo"),
        readString(options, "companyLogo"),
        readString(options, "companyLogoUrl"),
        readString(options, "businessLogo"),
        readString(options, "logoImage"),
        readString(options, "logoImageUrl"),
        readString(options, "brandLogo"),
        readString(options, "brandLogoUrl"),
        readString(options, "profileImage"),
        readString(options, "profileImageUrl"),
        readString(options, "profilePhoto"),
        readString(options, "profilePhotoUrl"),
        readString(options, "profilePicture"),
        readString(options, "profilePictureUrl"),
        readString(options, "profilePic"),
        readString(options, "avatar"),
        readString(options, "avatarUrl"),
        readString(options, "photo"),
        readString(options, "photoUrl"),
        readString(options, "image"),
        readString(options, "imageUrl")
      ),
      logoOverlayUrl = firstNonBlank(
        readString(options, "logoOverlayUrl"),
        readString(options, "overlayLogoUrl")
      ),
      logoOverlayX = readDouble(options, "logoOverlayX", readDouble(options, "logoX", 0.06)),
      logoOverlayY = readDouble(options, "logoOverlayY", readDouble(options, "logoY", 0.06)),
      profileImageUrl = readString(options, "profileImageUrl"),
      qrCodeUrl = readString(options, "qrCodeUrl"),
      qrData = readString(options, "qrData"),
      qrPosition = readString(options, "qrPosition")
        .ifBlank { readString(options, "qrCodePosition") }
        .ifBlank { "right" },
      generatedDate = readString(options, "generatedDate")
        .ifBlank { readString(options, "downloadDate") }
    )
  }

  private fun readString(options: ReadableMap?, key: String): String {
    if (options == null || !options.hasKey(key) || options.isNull(key)) return ""
    return when (options.getType(key)) {
      ReadableType.String -> options.getString(key)?.trim().orEmpty()
      ReadableType.Number -> options.getDouble(key).toString()
      ReadableType.Boolean -> options.getBoolean(key).toString()
      else -> ""
    }
  }

  private fun readBoolean(options: ReadableMap?, key: String): Boolean {
    if (options == null || !options.hasKey(key) || options.isNull(key)) return false
    return when (options.getType(key)) {
      ReadableType.Boolean -> options.getBoolean(key)
      ReadableType.String -> options.getString(key)?.equals("true", ignoreCase = true) == true
      ReadableType.Number -> options.getDouble(key) != 0.0
      else -> false
    }
  }

  private fun readDouble(options: ReadableMap?, key: String, fallback: Double): Double {
    if (options == null || !options.hasKey(key) || options.isNull(key)) return fallback
    return when (options.getType(key)) {
      ReadableType.Number -> options.getDouble(key)
      ReadableType.String -> options.getString(key)?.toDoubleOrNull() ?: fallback
      ReadableType.Boolean -> if (options.getBoolean(key)) 1.0 else 0.0
      else -> fallback
    }
  }

  private fun firstNonBlank(vararg values: String): String {
    return values.firstOrNull { it.isNotBlank() } ?: ""
  }

  private fun downloadUrlToDownloads(url: String, fileName: String, mimeType: String?): String {
    val local = assets.localFile(url)
    local.inputStream().use { saveStreamToDownloads(it, fileName, resolveMimeType(mimeType, fileName)) }
    return fileName
  }

  private fun loadBitmap(url: String): Bitmap = assets.bitmap(url)

  private fun openHttpConnection(url: String): HttpURLConnection {
    return (URL(url).openConnection() as HttpURLConnection).apply {
      instanceFollowRedirects = true
      connectTimeout = 20000
      readTimeout = 45000
      setRequestProperty("User-Agent", "PolicyBhandar/1.0")
    }
  }

  private fun resolveShareUri(url: String, fileName: String, mimeType: String): Uri {
    val raw = url.trim()
    if (raw.startsWith("content://", ignoreCase = true)) return Uri.parse(raw)

    if (raw.startsWith("file://", ignoreCase = true)) {
      val path = Uri.parse(raw).path ?: throw IOException("Shared file path is not available.")
      return fileToContentUri(File(path))
    }

    val directFile = File(raw)
    if (directFile.exists()) return fileToContentUri(directFile)

    if (raw.startsWith("http://", ignoreCase = true) || raw.startsWith("https://", ignoreCase = true)) {
      return downloadUrlToShareCache(raw, fileName, mimeType)
    }

    throw IOException("Unsupported share URL.")
  }

  private fun downloadUrlToShareCache(url: String, fileName: String, mimeType: String): Uri {
    val source = assets.localFile(url)
    val directory = File(reactContext.cacheDir, "policybhandar-share").apply { mkdirs() }
    val file = File(directory, "${source.name.take(24)}-$fileName")
    if (!file.exists() || file.lastModified() < source.lastModified()) source.copyTo(file, overwrite = true)
    return fileToContentUri(file)
  }

  private fun fileToContentUri(file: File): Uri {
    if (!file.exists()) throw IOException("Shared file does not exist.")
    return FileProvider.getUriForFile(
      reactContext,
      "${reactContext.packageName}.downloads.fileprovider",
      file
    )
  }

  private fun launchShareIntent(uri: Uri, mimeType: String, message: String, whatsappOnly: Boolean) {
    val baseIntent = Intent(Intent.ACTION_SEND).apply {
      type = mimeType
      putExtra(Intent.EXTRA_STREAM, uri)
      if (message.isNotBlank()) putExtra(Intent.EXTRA_TEXT, message)
      clipData = ClipData.newUri(reactContext.contentResolver, "PolicyBhandar", uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    if (whatsappOnly) {
      val packages = listOf("com.whatsapp", "com.whatsapp.w4b")
      for (packageName in packages) {
        try {
          val intent = Intent(baseIntent).setPackage(packageName)
          reactContext.startActivity(intent)
          return
        } catch (_: ActivityNotFoundException) {
          // Try the next WhatsApp package, then fall back to the chooser below.
        } catch (_: SecurityException) {
          // Try the next WhatsApp package, then fall back to the chooser below.
        }
      }
    }

    val chooser = Intent.createChooser(baseIntent, "Share with").apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactContext.startActivity(chooser)
  }

  private fun launchTargetShareIntent(uri: Uri, mimeType: String, message: String, targetApp: String) {
    val baseIntent = Intent(Intent.ACTION_SEND).apply {
      type = mimeType
      putExtra(Intent.EXTRA_STREAM, uri)
      if (message.isNotBlank()) putExtra(Intent.EXTRA_TEXT, message)
      clipData = ClipData.newUri(reactContext.contentResolver, "PolicyBhandar", uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    val packages = when (targetApp.lowercase()) {
      "whatsapp" -> listOf("com.whatsapp", "com.whatsapp.w4b")
      "facebook" -> listOf("com.facebook.katana", "com.facebook.lite")
      "instagram" -> listOf("com.instagram.android")
      else -> emptyList()
    }

    for (packageName in packages) {
      try {
        val intent = Intent(baseIntent).setPackage(packageName)
        reactContext.startActivity(intent)
        return
      } catch (_: ActivityNotFoundException) {
        // Fall back to the next package or the system chooser below.
      } catch (_: SecurityException) {
        // Fall back to the next package or the system chooser below.
      }
    }

    val chooser = Intent.createChooser(baseIntent, "Share with").apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactContext.startActivity(chooser)
  }

  private fun drawCustomizedImage(source: Bitmap, options: CustomizationOptions): Bitmap {
    val hasFooter = options.includeWatermark || options.includeLogo || options.includeSocialCaption || options.includeQrCode
    val cardHeight = if (hasFooter) (source.width * 0.24f).toInt().coerceAtLeast(2) else 0

    val result = if (cardHeight > 0) {
      Bitmap.createBitmap(source.width, source.height + cardHeight, Bitmap.Config.ARGB_8888).also {
        Canvas(it).drawColor(Color.WHITE)
      }
    } else {
      source.copy(Bitmap.Config.ARGB_8888, true)
        ?: Bitmap.createBitmap(source.width, source.height, Bitmap.Config.ARGB_8888)
    }

    val canvas = Canvas(result)
    if (cardHeight > 0) {
      canvas.drawBitmap(source, 0f, 0f, null)
    } else if (result !== source) {
      canvas.drawBitmap(source, 0f, 0f, null)
    }

    drawTextWatermark(canvas, source.width, source.height, options)
    if (options.includeLogoOverlay) {
      drawTemplateLogoOverlay(canvas, source.width, source.height, options)
    }

    if (hasFooter) drawFooterBand(canvas, result.width, source.height, cardHeight.toFloat(), options)

    return result
  }

  private fun drawTextWatermark(canvas: Canvas, width: Int, height: Int, options: CustomizationOptions) {
    if (!options.includeWatermark) return
    val text = options.watermarkText.ifBlank { options.advisorName }.trim()
    if (text.isBlank()) return
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = watermarkBaseColor(options.fontColor)
      alpha = 46
      textAlign = Paint.Align.CENTER
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      textSize = width * 0.055f
    }
    val available = width * 0.85f
    if (paint.measureText(text) > available) paint.textSize *= available / paint.measureText(text)
    canvas.save()
    if (options.watermarkOrientation == "diagonal") canvas.rotate(-25f, width / 2f, height / 2f)
    canvas.drawText(text, width / 2f, height / 2f - (paint.ascent() + paint.descent()) / 2f, paint)
    canvas.restore()
  }

  private fun drawTemplateLogoOverlay(canvas: Canvas, width: Int, imageHeight: Int, options: CustomizationOptions) {
    val rawLogoUrl = options.logoOverlayUrl.ifBlank { options.logoUrl }
    val logoBitmap = loadBrandBitmap(rawLogoUrl) ?: return
    try {
      val minSide = min(width, imageHeight).toFloat()
      val maximumSize = minSide * 0.28f
      val size = (minSide * 0.16f).coerceIn(min(52f, maximumSize), maximumSize)
      val pad = (size * 0.11f).coerceIn(5f, 12f)
      val maxX = max(0f, width - size)
      val maxY = max(0f, imageHeight - size)
      val x = (options.logoOverlayX.toFloat().coerceIn(0f, 1f) * maxX).coerceIn(0f, maxX)
      val y = (options.logoOverlayY.toFloat().coerceIn(0f, 1f) * maxY).coerceIn(0f, maxY)
      val rect = RectF(x, y, x + size, y + size)
      val corner = (size * 0.13f).coerceIn(8f, 18f)

      val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(238, 255, 255, 255)
        setShadowLayer(max(3f, size * 0.06f), 0f, size * 0.025f, Color.argb(55, 0, 0, 0))
      }
      canvas.drawRoundRect(rect, corner, corner, bgPaint)
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(168, 85, 247)
        style = Paint.Style.STROKE
        strokeWidth = max(2f, size * 0.025f)
        canvas.drawRoundRect(rect, corner, corner, this)
      }
      drawBitmapFit(canvas, logoBitmap, rect, pad)
    } finally {
      if (!logoBitmap.isRecycled) logoBitmap.recycle()
    }
  }

  private fun drawFooterBand(canvas: Canvas, width: Int, imageHeight: Int, footerHeight: Float, options: CustomizationOptions) {
    val minSide = min(width, imageHeight).toFloat()
    val top = imageHeight.toFloat()
    val bottom = top + footerHeight
    val pad = (minSide * 0.028f).coerceIn(14f, 32f)
    val corner = (minSide * 0.02f).coerceIn(12f, 24f)
    val accent = accentBaseColor(options.fontColor)
    val profileAccent = Color.rgb(168, 85, 247)

    val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
    }
    canvas.drawRect(0f, top, width.toFloat(), bottom, bgPaint)

    Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(17, 24, 39)
      strokeWidth = max(2f, minSide * 0.003f)
      canvas.drawLine(0f, top, width.toFloat(), top, this)
    }

    val logoSize = (footerHeight - pad * 1.35f)
      .coerceIn(minSide * 0.12f, footerHeight * 0.88f).coerceAtMost(width * 0.18f)
    val qrOnLeft = options.qrPosition.equals("left", ignoreCase = true)
    var textLeft = pad
    var textRight = width - pad

    val qrSize = logoSize
    var qrBitmap: Bitmap? = null
    if (options.includeQrCode) {
      qrBitmap = if (options.qrData.isNotBlank()) createQrBitmap(qrSize.toInt(), options.qrData) else loadOptionalBitmap(options.qrCodeUrl)
        ?: createQrBitmap(qrSize.toInt(), qrSeed(options))
      val qrRect = if (qrOnLeft) {
        RectF(pad, top + pad, pad + qrSize, top + pad + qrSize)
      } else {
        RectF(width - pad - qrSize, top + pad, width - pad, top + pad + qrSize)
      }
      val qrBg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
      canvas.drawRoundRect(qrRect, corner, corner, qrBg)
      qrBitmap?.let { drawBitmapFit(canvas, it, qrRect, pad * 0.14f) }
      if (qrOnLeft) textLeft = qrRect.right + pad else textRight = qrRect.left - pad
    }

    var logoBitmap: Bitmap? = null
    if (options.includeLogo) {
      val logoRect = if (options.includeQrCode && qrOnLeft) {
        RectF(width - pad - logoSize, top + pad * 0.58f, width - pad, top + pad * 0.58f + logoSize)
      } else {
        RectF(pad, top + pad * 0.58f, pad + logoSize, top + pad * 0.58f + logoSize)
      }
      logoBitmap = loadBrandBitmap(options.profileImageUrl.ifBlank { options.logoUrl })
      drawProfileBadge(canvas, logoRect, logoBitmap, options, profileAccent, corner)
      if (options.includeQrCode && qrOnLeft) textRight = min(textRight, logoRect.left - pad)
      else textLeft = max(textLeft, logoRect.right + pad * 0.42f)
    }

    drawFooterText(canvas, top, footerHeight, textLeft, textRight, options, accent)

    if (logoBitmap != null && !logoBitmap.isRecycled) logoBitmap.recycle()
    if (qrBitmap != null && !qrBitmap.isRecycled) qrBitmap.recycle()
  }

  private fun drawFooterText(
    canvas: Canvas,
    top: Float,
    footerHeight: Float,
    left: Float,
    right: Float,
    options: CustomizationOptions,
    accent: Int
  ) {
    if (right <= left) return

    val width = right - left
    val name = options.advisorName.ifBlank { options.recipientName }.ifBlank { "PolicyBhandar Advisor" }
    val designation = options.advisorDesignation.ifBlank { "Insurance Advisor" }
    val rows = mutableListOf<String>()
    rows.add("With Best Regards,")
    rows.add(name.uppercase())
    if (designation.isNotBlank()) rows.add(designation)
    if (options.advisorMobile.isNotBlank()) rows.add(options.advisorMobile)
    if (options.advisorEmail.isNotBlank()) rows.add(options.advisorEmail)

    var greetingSize = (footerHeight * 0.085f).coerceIn(9f, 18f)
    var titleSize = (footerHeight * 0.17f).coerceIn(16f, 36f)
    var bodySize = (footerHeight * 0.105f).coerceIn(10f, 20f)
    var iconSize = if (options.includeSocialCaption) (bodySize * 1.12f).coerceIn(13f, 24f) else 0f
    var lineGap = (bodySize * 0.17f).coerceIn(2f, 6f)
    val availableHeight = footerHeight - (footerHeight * 0.14f)
    val totalTextHeight =
      greetingSize +
        titleSize +
        bodySize * (rows.size - 2).coerceAtLeast(0) +
        (if (options.includeSocialCaption) bodySize else 0f) +
        lineGap * (rows.size + if (options.includeSocialCaption) 0 else -1).coerceAtLeast(0)
    if (totalTextHeight > availableHeight) {
      val scale = (availableHeight / totalTextHeight).coerceIn(0.72f, 1f)
      greetingSize *= scale
      titleSize *= scale
      bodySize *= scale
      iconSize *= scale
      lineGap *= scale
    }

    val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = if (options.fontColor.isBlank() || options.fontColor.equals("#111111", ignoreCase = true)) {
        Color.rgb(17, 24, 39)
      } else {
        accent
      }
      textSize = titleSize
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val greetingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(31, 41, 55)
      textSize = greetingSize
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
    }
    val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(31, 41, 55)
      textSize = bodySize
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
    }

    val greetingHeight = paintTextHeight(greetingPaint)
    val titleHeight = paintTextHeight(titlePaint)
    val bodyHeight = paintTextHeight(bodyPaint)
    val detailRows = rows.drop(2)
    val socialHeight = if (options.includeSocialCaption) max(bodyHeight, iconSize) else 0f
    val gapCount = (1 + detailRows.size + if (options.includeSocialCaption) 1 else 0).coerceAtLeast(0)
    val contentHeight =
      greetingHeight +
        titleHeight +
        bodyHeight * detailRows.size +
        socialHeight +
        lineGap * gapCount
    var baseline = top + (footerHeight - contentHeight) / 2f - greetingPaint.ascent()

    canvas.drawText(ellipsize(rows[0], greetingPaint, width), left, baseline, greetingPaint)
    baseline += greetingHeight + lineGap
    baseline += 10f
    canvas.drawText(ellipsize(rows[1], titlePaint, width), left, baseline, titlePaint)
    baseline += titleHeight + lineGap
    detailRows.forEach { line ->
      canvas.drawText(ellipsize(line, bodyPaint, width), left, baseline, bodyPaint)
      baseline += bodyHeight + lineGap
    }
    if (options.includeSocialCaption) {
      drawSocialCaptionRow(canvas, left, baseline, width, bodyPaint, iconSize)
    }
  }

  private fun paintTextHeight(paint: Paint): Float {
    val metrics = paint.fontMetrics
    return metrics.descent - metrics.ascent
  }

  private fun drawProfileBadge(
    canvas: Canvas,
    rect: RectF,
    bitmap: Bitmap?,
    options: CustomizationOptions,
    accent: Int,
    corner: Float
  ) {
    val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = accent
      style = Paint.Style.STROKE
      strokeWidth = max(3f, rect.width() * 0.026f)
    }
    canvas.drawRoundRect(rect, corner, corner, bgPaint)
    canvas.drawRoundRect(rect, corner, corner, borderPaint)

    if (bitmap != null && !bitmap.isRecycled) {
      drawBitmapFit(canvas, bitmap, rect, rect.width() * 0.12f)
      return
    }

    val initial = options.advisorName
      .ifBlank { options.recipientName }
      .ifBlank { "PolicyBhandar" }
      .trim()
      .take(1)
      .uppercase()
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(17, 24, 39)
      textAlign = Paint.Align.CENTER
      textSize = (rect.height() * 0.44f).coerceIn(26f, 92f)
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    val baseline = rect.centerY() - (paint.descent() + paint.ascent()) / 2f
    canvas.drawText(initial, rect.centerX(), baseline, paint)
  }

  private fun drawSocialCaptionRow(
    canvas: Canvas,
    left: Float,
    baseline: Float,
    maxWidth: Float,
    bodyPaint: Paint,
    iconSize: Float
  ) {
    if (maxWidth <= 0f || iconSize <= 0f) return

    val label = "All"
    val labelWidth = bodyPaint.measureText(label)
    canvas.drawText(label, left, baseline, bodyPaint)

    val gap = iconSize * 0.36f
    val radius = iconSize * 0.5f
    var centerX = left + labelWidth + gap + radius
    val centerY = baseline - bodyPaint.textSize * 0.36f
    val icons = listOf(
      Triple("f", Color.rgb(24, 119, 242), 1.0f),
      Triple("ig", Color.rgb(225, 48, 108), 0.68f),
      Triple("x", Color.BLACK, 0.86f),
      Triple("in", Color.rgb(0, 119, 181), 0.68f)
    )

    icons.forEach { (labelText, color, scale) ->
      if (centerX + radius > left + maxWidth) return
      val circlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
      canvas.drawCircle(centerX, centerY, radius, circlePaint)
      val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = Color.WHITE
        textAlign = Paint.Align.CENTER
        textSize = iconSize * scale
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      }
      val textBaseline = centerY - (textPaint.descent() + textPaint.ascent()) / 2f
      canvas.drawText(labelText, centerX, textBaseline, textPaint)
      centerX += iconSize + gap
    }
  }

  private fun drawBitmapFit(canvas: Canvas, bitmap: Bitmap, outer: RectF, inset: Float = 0f) {
    val dest = RectF(outer.left + inset, outer.top + inset, outer.right - inset, outer.bottom - inset)
    if (dest.width() <= 0f || dest.height() <= 0f) return

    val sourceRatio = bitmap.width.toFloat() / bitmap.height.toFloat()
    val destRatio = dest.width() / dest.height()
    val fitted = RectF(dest)

    if (sourceRatio > destRatio) {
      val fittedHeight = dest.width() / sourceRatio
      fitted.top = dest.centerY() - fittedHeight / 2f
      fitted.bottom = fitted.centerY() + fittedHeight / 2f
    } else {
      val fittedWidth = dest.height() * sourceRatio
      fitted.left = dest.centerX() - fittedWidth / 2f
      fitted.right = fitted.centerX() + fittedWidth / 2f
    }

    canvas.drawBitmap(bitmap, null, fitted, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
  }

  private fun loadBrandBitmap(url: String): Bitmap? {
    if (url.isBlank()) return null
    return loadOptionalBitmap(url) ?: throw IOException("Your profile photo/logo could not be loaded. Please update it in My Profile and retry.")
  }

  private fun loadOptionalBitmap(url: String): Bitmap? {
    val raw = url.trim()
    if (raw.isBlank()) return null
    return try {
      when {
        raw.equals("policybhandar://logo", ignoreCase = true) -> {
          val resourceId = reactContext.resources.getIdentifier(
            "src_assets_images_policybhandar_logo",
            "drawable",
            reactContext.packageName
          ).takeIf { it != 0 } ?: reactContext.resources.getIdentifier(
            "splashscreen_logo",
            "drawable",
            reactContext.packageName
          )
          if (resourceId != 0) BitmapFactory.decodeResource(reactContext.resources, resourceId) else null
        }
        else -> assets.bitmap(raw, 512)
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun createQrBitmap(size: Int, seed: String): Bitmap {
    val matrix = QRCodeWriter().encode(seed.ifBlank { "POLICYBHANDAR" }, BarcodeFormat.QR_CODE, size.coerceAtLeast(64), size.coerceAtLeast(64))
    val result = Bitmap.createBitmap(matrix.width, matrix.height, Bitmap.Config.ARGB_8888)
    val pixels = IntArray(matrix.width * matrix.height) { index -> if (matrix[index % matrix.width, index / matrix.width]) Color.BLACK else Color.WHITE }
    result.setPixels(pixels, 0, matrix.width, 0, 0, matrix.width, matrix.height)
    return result
  }

  private fun qrSeed(options: CustomizationOptions): String =
    listOf(options.advisorName, options.advisorMobile, options.advisorEmail, options.recipientName)
      .filter { it.isNotBlank() }
      .joinToString("|")

  private fun ellipsize(text: String, paint: Paint, maxWidth: Float): String {
    if (paint.measureText(text) <= maxWidth) return text
    var next = text
    while (next.length > 4 && paint.measureText("$next...") > maxWidth) {
      next = next.dropLast(1)
    }
    return "$next..."
  }

  private fun saveStreamToDownloads(input: InputStream, fileName: String, mimeType: String) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val resolver = reactContext.contentResolver
      val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
        put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
        put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        put(MediaStore.MediaColumns.IS_PENDING, 1)
      }

      val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        ?: throw IOException("Unable to create download file.")

      try {
        resolver.openOutputStream(uri)?.use { output ->
          input.copyTo(output)
        } ?: throw IOException("Unable to open download file.")

        values.clear()
        values.put(MediaStore.MediaColumns.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
      } catch (error: Exception) {
        resolver.delete(uri, null, null)
        throw error
      }
      return
    }

    val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
    if (!downloadsDir.exists() && !downloadsDir.mkdirs()) {
      throw IOException("Unable to access Downloads folder.")
    }

    val outputFile = File(downloadsDir, fileName)
    FileOutputStream(outputFile).use { output ->
      input.copyTo(output)
    }

    MediaScannerConnection.scanFile(
      reactContext,
      arrayOf(outputFile.absolutePath),
      arrayOf(mimeType),
      null
    )
  }

  private fun saveBitmapToDownloads(bitmap: Bitmap, fileName: String): String {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val resolver = reactContext.contentResolver
      val values = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
        put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
        put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        put(MediaStore.MediaColumns.IS_PENDING, 1)
      }

      val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        ?: throw IOException("Unable to create download file.")

      try {
        resolver.openOutputStream(uri)?.use { output ->
          if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 94, output)) {
            throw IOException("Unable to write customized image.")
          }
        } ?: throw IOException("Unable to open download file.")

        values.clear()
        values.put(MediaStore.MediaColumns.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        return uri.toString()
      } catch (error: Exception) {
        resolver.delete(uri, null, null)
        throw error
      }
    }

    val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
    if (!downloadsDir.exists() && !downloadsDir.mkdirs()) {
      throw IOException("Unable to access Downloads folder.")
    }

    val outputFile = File(downloadsDir, fileName)
    FileOutputStream(outputFile).use { output ->
      if (!bitmap.compress(Bitmap.CompressFormat.JPEG, 94, output)) {
        throw IOException("Unable to write customized image.")
      }
    }

    MediaScannerConnection.scanFile(
      reactContext,
      arrayOf(outputFile.absolutePath),
      arrayOf("image/jpeg"),
      null
    )
    return outputFile.absolutePath
  }

  private fun safeFileName(fileName: String?, mimeType: String?, url: String?): String {
    val clean = (fileName ?: "policybhandar-${System.currentTimeMillis()}")
      .replace(Regex("[^A-Za-z0-9._-]+"), "-")
      .ifBlank { "policybhandar-${System.currentTimeMillis()}" }

    if (Regex("\\.[A-Za-z0-9]{2,5}$").containsMatchIn(clean)) return clean

    val extensionFromUrl = url
      ?.substringBefore("?")
      ?.substringBefore("#")
      ?.let { Regex("\\.[A-Za-z0-9]{2,5}$").find(it)?.value }

    val extension = extensionFromUrl ?: when (mimeType?.lowercase()) {
      "image/png" -> ".png"
      "image/webp" -> ".webp"
      "video/mp4" -> ".mp4"
      "application/pdf" -> ".pdf"
      else -> ".jpg"
    }

    return "$clean$extension"
  }

  private fun resolveMimeType(mimeType: String?, url: String?): String {
    val supplied = mimeType?.trim().orEmpty()
    if (supplied.isNotBlank() && supplied != "application/octet-stream") return supplied

    val clean = url
      ?.substringBefore("?")
      ?.substringBefore("#")
      ?.lowercase()
      .orEmpty()

    return when {
      clean.endsWith(".mp4") || clean.endsWith(".m4v") -> "video/mp4"
      clean.endsWith(".mov") -> "video/quicktime"
      clean.endsWith(".webm") -> "video/webm"
      clean.endsWith(".png") -> "image/png"
      clean.endsWith(".webp") -> "image/webp"
      clean.endsWith(".pdf") -> "application/pdf"
      clean.endsWith(".mp3") -> "audio/mpeg"
      clean.endsWith(".m4a") -> "audio/mp4"
      clean.endsWith(".wav") -> "audio/wav"
      clean.endsWith(".jpg") || clean.endsWith(".jpeg") || clean.startsWith("content://") -> "image/jpeg"
      else -> "application/octet-stream"
    }
  }

  private fun safeImageFileName(fileName: String?): String {
    val baseName = (fileName ?: "policybhandar-${System.currentTimeMillis()}.jpg")
      .replace(Regex("[^A-Za-z0-9._-]+"), "-")
      .ifBlank { "policybhandar-${System.currentTimeMillis()}.jpg" }
      .replace(Regex("\\.(webp|png|jpe?g)$", RegexOption.IGNORE_CASE), "")

    return "$baseName.jpg"
  }

  private fun parseColorOrDefault(value: String?, fallback: Int): Int {
    return try {
      if (value.isNullOrBlank()) fallback else Color.parseColor(value)
    } catch (_: Exception) {
      fallback
    }
  }

  private fun watermarkBaseColor(value: String?): Int {
    if (value.isNullOrBlank() || value.equals("#111111", ignoreCase = true)) {
      return Color.rgb(128, 128, 128)
    }

    return parseColorOrDefault(value, Color.rgb(128, 128, 128))
  }

  private fun accentBaseColor(value: String?): Int {
    if (value.isNullOrBlank() || value.equals("#111111", ignoreCase = true)) {
      return Color.rgb(192, 57, 43)
    }

    return parseColorOrDefault(value, Color.rgb(192, 57, 43))
  }
}
