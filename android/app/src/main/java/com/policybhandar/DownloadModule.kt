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
import android.net.Uri
import android.os.Build
import android.os.Environment
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
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

class DownloadModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

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
    val logoOverlayUrl: String = "",
    val logoOverlayX: Double = 0.06,
    val logoOverlayY: Double = 0.06,
    val qrCodeUrl: String = "",
    val qrPosition: String = "right",
    val generatedDate: String = ""
  )

  override fun getName(): String = "PolicyBhandarDownloader"

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
      qrCodeUrl = readString(options, "qrCodeUrl"),
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
    val connection = openHttpConnection(url)
    try {
      val status = connection.responseCode
      if (status !in 200..299) {
        throw IOException("Download failed with status $status.")
      }
      val resolvedMime = mimeType?.takeIf { it.isNotBlank() }
        ?: connection.contentType?.substringBefore(";")?.takeIf { it.isNotBlank() }
        ?: "application/octet-stream"

      connection.inputStream.use { input ->
        saveStreamToDownloads(input, fileName, resolvedMime)
      }
      return fileName
    } finally {
      connection.disconnect()
    }
  }

  private fun loadBitmap(url: String): Bitmap {
    val connection = openHttpConnection(url)

    try {
      val status = connection.responseCode
      if (status !in 200..299) {
        throw IOException("Image download failed with status $status.")
      }

      connection.inputStream.use { stream ->
        return BitmapFactory.decodeStream(stream)
          ?: throw IOException("Downloaded file is not a supported image.")
      }
    } finally {
      connection.disconnect()
    }
  }

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
    val connection = openHttpConnection(url)
    try {
      val status = connection.responseCode
      if (status !in 200..299) {
        throw IOException("Share file download failed with status $status.")
      }

      val cacheDir = File(reactContext.cacheDir, "policybhandar-share")
      if (!cacheDir.exists() && !cacheDir.mkdirs()) {
        throw IOException("Unable to prepare share cache.")
      }

      val outputFile = File(cacheDir, fileName)
      connection.inputStream.use { input ->
        FileOutputStream(outputFile).use { output ->
          input.copyTo(output)
        }
      }
      return fileToContentUri(outputFile)
    } finally {
      connection.disconnect()
    }
  }

  private fun fileToContentUri(file: File): Uri {
    if (!file.exists()) throw IOException("Shared file does not exist.")
    return FileProvider.getUriForFile(
      reactContext,
      "${reactContext.packageName}.fileprovider",
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

  private fun drawCustomizedImage(source: Bitmap, options: CustomizationOptions): Bitmap {
    val normalizedType = options.watermarkType.lowercase()
    val appendQrFooter = normalizedType == "whatsapp" || normalizedType == "link"
    val hasFooter = options.includeWatermark ||
      options.includeLogo ||
      options.includeSocialCaption ||
      options.includeQrCode
    val profileFooterHeight = if (hasFooter && !appendQrFooter) {
      max((source.height * 0.23f).toInt(), (source.width * 0.24f).toInt())
    } else {
      0
    }
    val cardHeight = if (appendQrFooter) {
      max((source.height * 0.28f).toInt(), (source.width * 0.52f).toInt())
    } else {
      profileFooterHeight
    }

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

    if (options.includeLogoOverlay) {
      drawTemplateLogoOverlay(canvas, source.width, source.height, options)
    }

    if (hasFooter) {
      if (appendQrFooter) {
        drawQrAppendFooter(canvas, source.width, source.height, cardHeight.toFloat(), options)
      } else {
        drawFooterBand(canvas, result.width, source.height, cardHeight.toFloat(), options)
      }
    }

    return result
  }

  private fun drawTemplateLogoOverlay(canvas: Canvas, width: Int, imageHeight: Int, options: CustomizationOptions) {
    val rawLogoUrl = options.logoOverlayUrl.ifBlank { options.logoUrl }
    val logoBitmap = loadOptionalBitmap(rawLogoUrl) ?: return
    try {
      val minSide = min(width, imageHeight).toFloat()
      val size = (minSide * 0.16f).coerceIn(52f, minSide * 0.28f)
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

  private fun drawQrAppendFooter(canvas: Canvas, width: Int, imageHeight: Int, footerHeight: Float, options: CustomizationOptions) {
    val top = imageHeight.toFloat()
    val bottom = top + footerHeight
    val centerX = width / 2f
    val textColor = Color.rgb(15, 23, 42)
    val subTextColor = Color.rgb(51, 65, 85)

    val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.WHITE
      setShadowLayer(max(4f, width * 0.012f), 0f, -max(2f, width * 0.004f), Color.argb(45, 0, 0, 0))
    }
    canvas.drawRect(0f, top, width.toFloat(), bottom, bgPaint)
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(17, 24, 39)
      strokeWidth = max(2f, min(width, imageHeight) * 0.003f)
      canvas.drawLine(0f, top, width.toFloat(), top, this)
    }

    val headerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = textColor
      textAlign = Paint.Align.CENTER
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      textSize = (width * 0.038f).coerceIn(18f, 42f)
    }
    val header = if (options.watermarkType.equals("link", ignoreCase = true)) {
      "For more info, scan or open the shared link"
    } else {
      "Scan QR for more details"
    }
    var y = top + footerHeight * 0.12f
    canvas.drawText(ellipsize(header, headerPaint, width * 0.9f), centerX, y, headerPaint)

    val qrBitmap = loadOptionalBitmap(options.qrCodeUrl)
      ?: createQrPlaceholder((width * 0.42f).toInt().coerceAtLeast(180), qrSeed(options))
    val maxQrWidth = width * 0.45f
    val maxQrHeight = footerHeight * 0.58f
    val ratio = min(maxQrWidth / qrBitmap.width, maxQrHeight / qrBitmap.height)
    val qrWidth = qrBitmap.width * ratio
    val qrHeight = qrBitmap.height * ratio
    y += footerHeight * 0.07f
    val qrRect = RectF(centerX - qrWidth / 2f, y, centerX + qrWidth / 2f, y + qrHeight)
    drawBitmapFit(canvas, qrBitmap, qrRect, 0f)
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.rgb(220, 38, 38)
      style = Paint.Style.STROKE
      strokeWidth = max(4f, width * 0.008f)
      canvas.drawRect(qrRect, this)
    }
    if (!qrBitmap.isRecycled) qrBitmap.recycle()

    val footerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = textColor
      textAlign = Paint.Align.CENTER
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      textSize = (width * 0.04f).coerceIn(18f, 46f)
    }
    val name = options.advisorName.ifBlank { options.recipientName }.uppercase()
    val phone = options.advisorMobile
    val footerText = when {
      name.isNotBlank() && phone.isNotBlank() -> "$name | $phone"
      name.isNotBlank() -> name
      phone.isNotBlank() -> phone
      else -> "POLICYBHANDAR"
    }
    val maxWidth = width * 0.9f
    while (footerPaint.measureText(footerText) > maxWidth && footerPaint.textSize > 14f) {
      footerPaint.textSize *= 0.92f
    }
    canvas.drawText(ellipsize(footerText, footerPaint, maxWidth), centerX, min(bottom - footerHeight * 0.08f, qrRect.bottom + footerHeight * 0.14f), footerPaint)

    if (options.watermarkType.equals("link", ignoreCase = true) && options.advisorEmail.isNotBlank()) {
      val emailPaint = Paint(footerPaint).apply {
        color = subTextColor
        textSize = footerPaint.textSize * 0.72f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
      }
      canvas.drawText(ellipsize(options.advisorEmail, emailPaint, maxWidth), centerX, bottom - footerHeight * 0.025f, emailPaint)
    }
  }

  private fun drawSingleLineWatermark(
    canvas: Canvas,
    width: Int,
    height: Int,
    text: String,
    requestedColor: String?,
    orientation: String
  ) {
    val minSide = min(width, height).toFloat()
    val fillColor = watermarkBaseColor(requestedColor)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      textAlign = Paint.Align.CENTER
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    val normalizedOrientation = orientation.lowercase()
    val rotation = when (normalizedOrientation) {
      "horizontal" -> 0f
      "vertical" -> -90f
      else -> -32f
    }
    val maxTextWidth = when (normalizedOrientation) {
      "vertical" -> height * 0.72f
      "horizontal" -> width * 0.76f
      else -> min(width, height) * 0.9f
    }
    var textSize = (minSide * 0.19f).coerceIn(42f, 136f)
    paint.textSize = textSize
    while (paint.measureText(text) > maxTextWidth && textSize > 28f) {
      textSize *= 0.92f
      paint.textSize = textSize
    }

    val outlinePaint = Paint(paint).apply {
      style = Paint.Style.STROKE
      strokeWidth = max(1.5f, textSize / 24f)
      color = Color.argb(
        24,
        255 - Color.red(fillColor),
        255 - Color.green(fillColor),
        255 - Color.blue(fillColor)
      )
    }

    val centerX = width / 2f
    val centerY = height / 2f - (paint.descent() + paint.ascent()) / 2f

    canvas.save()
    canvas.rotate(rotation, width / 2f, height / 2f)
    paint.color = Color.argb(
      72,
      Color.red(fillColor),
      Color.green(fillColor),
      Color.blue(fillColor)
    )
    canvas.drawText(text, centerX, centerY, outlinePaint)
    canvas.drawText(text, centerX, centerY, paint)
    canvas.restore()
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

    val logoSize = (footerHeight - pad * 1.35f).coerceIn(minSide * 0.12f, footerHeight * 0.88f)
    val qrOnLeft = options.qrPosition.equals("left", ignoreCase = true)
    var textLeft = pad
    var textRight = width - pad

    val qrSize = logoSize
    var qrBitmap: Bitmap? = null
    if (options.includeQrCode) {
      qrBitmap = loadOptionalBitmap(options.qrCodeUrl)
        ?: createQrPlaceholder(qrSize.toInt(), qrSeed(options))
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
      logoBitmap = loadOptionalBitmap(options.logoUrl)
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
        raw.startsWith("http://", ignoreCase = true) || raw.startsWith("https://", ignoreCase = true) -> {
          loadBitmap(raw)
        }
        raw.startsWith("content://", ignoreCase = true) -> {
          reactContext.contentResolver.openInputStream(Uri.parse(raw))?.use { stream ->
            BitmapFactory.decodeStream(stream)
          }
        }
        raw.startsWith("file://", ignoreCase = true) -> {
          BitmapFactory.decodeFile(Uri.parse(raw).path)
        }
        raw.startsWith("data:image", ignoreCase = true) -> {
          val base64Data = raw.substringAfter(",", "")
          if (base64Data.isBlank()) null else {
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
          }
        }
        else -> {
          val file = File(raw)
          if (file.exists()) BitmapFactory.decodeFile(file.absolutePath) else null
        }
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun createQrPlaceholder(size: Int, seed: String): Bitmap {
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val white = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    val black = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK }
    canvas.drawRect(0f, 0f, size.toFloat(), size.toFloat(), white)

    val grid = 25
    val quiet = 2
    val cell = size.toFloat() / grid
    drawQrFinder(canvas, black, white, cell, quiet, quiet)
    drawQrFinder(canvas, black, white, cell, grid - quiet - 7, quiet)
    drawQrFinder(canvas, black, white, cell, quiet, grid - quiet - 7)

    val base = seed.ifBlank { "PolicyBhandar" }
    for (row in quiet until grid - quiet) {
      for (col in quiet until grid - quiet) {
        val inFinder =
          (row < 9 && col < 9) ||
            (row < 9 && col > grid - 10) ||
            (row > grid - 10 && col < 9)
        if (inFinder) continue

        val value = abs((base.hashCode() + row * 31 + col * 17 + row * col * 7) % 11)
        if (value == 0 || value == 3 || value == 7) {
          canvas.drawRect(col * cell, row * cell, (col + 1) * cell, (row + 1) * cell, black)
        }
      }
    }

    return bitmap
  }

  private fun drawQrFinder(canvas: Canvas, black: Paint, white: Paint, cell: Float, col: Int, row: Int) {
    fun rect(offset: Int, span: Int, paint: Paint) {
      canvas.drawRect(
        (col + offset) * cell,
        (row + offset) * cell,
        (col + offset + span) * cell,
        (row + offset + span) * cell,
        paint
      )
    }
    rect(0, 7, black)
    rect(1, 5, white)
    rect(2, 3, black)
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
