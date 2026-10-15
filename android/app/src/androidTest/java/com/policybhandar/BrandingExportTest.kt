package com.policybhandar

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Matrix
import android.net.Uri
import android.media.MediaMetadataRetriever
import android.os.SystemClock
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.ReadableMap
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.lang.reflect.Proxy
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Pixel checks run on the QA app, using synthetic images and no real profile/account changes. */
@RunWith(AndroidJUnit4::class)
class BrandingExportTest {
  private val context = BridgeReactContext(InstrumentationRegistry.getInstrumentation().targetContext)

  @Test fun watermarkAndDraggedLogoAreBakedAtTheSelectedPosition() {
    val source = image("watermark-white", 512, 512, Color.WHITE)
    val logo = image("drag-red", 128, 128, Color.RED)
    for (position in listOf(0.0, 1.0)) {
      val options = Arguments.createMap().apply {
        putBoolean("includeWatermark", true)
        putString("watermarkText", "TEST ADVISOR")
        putBoolean("includeLogoOverlay", true)
        putString("logoOverlayUrl", logo)
        putDouble("logoOverlayX", position)
        putDouble("logoOverlayY", position)
      }
      val result = awaitResult { DownloadModule(context).prepareCustomizedImage(source, "drag-$position.jpg", options, it) }
      val output = requireNotNull(BitmapFactory.decodeFile(Uri.parse(result.getString("fileUri")).path))
      var watermarkPixels = 0
      for (y in 180..330) for (x in 80..430) {
        val p = output.getPixel(x, y)
        if (Color.red(p) < 240 && Color.green(p) < 240 && Color.blue(p) < 240) watermarkPixels++
      }
      assertTrue("Watermark text must exist in the saved image", watermarkPixels > 30)
      val coordinate = if (position == 0.0) 40 else 470
      val selected = output.getPixel(coordinate, coordinate)
      assertTrue("Selected logo position must reach the export", Color.red(selected) > 190 && Color.green(selected) < 70)
      output.recycle()
    }
  }

  private fun image(name: String, width: Int, height: Int, color: Int): String {
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply { eraseColor(color) }
    val file = File(context.cacheDir, "fixture-$name.png")
    file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    bitmap.recycle()
    return Uri.fromFile(file).toString()
  }

  private fun awaitResult(timeoutSeconds: Long = 30, action: (Promise) -> Unit): ReadableMap {
    val latch = CountDownLatch(1)
    var result: ReadableMap? = null
    var failure: String? = null
    val promise = Proxy.newProxyInstance(Promise::class.java.classLoader, arrayOf(Promise::class.java)) { _, method, args ->
      if (method.name == "resolve") { result = args?.get(0) as? ReadableMap; latch.countDown() }
      if (method.name == "reject") { failure = args?.joinToString(" "); latch.countDown() }
      null
    } as Promise
    action(promise)
    assertTrue("Native processing timed out", latch.await(timeoutSeconds, TimeUnit.SECONDS))
    assertNull(failure, failure)
    return requireNotNull(result)
  }

  @Test fun allExportModesBakePortraitAndLogoIntoTheFile() {
    val source = image("banner", 512, 512, Color.GREEN)
    val portrait = image("portrait", 128, 128, Color.BLUE)
    val logo = image("logo", 128, 128, Color.RED)
    val downloader = DownloadModule(context)
    for (mode in listOf("digicard", "whatsapp", "link")) {
      val options = Arguments.createMap().apply {
        putString("watermarkType", mode)
        putString("advisorName", "Test Advisor")
        putString("profileImageUrl", portrait)
        putString("logoUrl", logo)
        putString("logoOverlayUrl", logo)
        putBoolean("includeLogo", true)
        putBoolean("includeLogoOverlay", true)
        putBoolean("includeWatermark", true)
      }
      val prepared = awaitResult { downloader.prepareCustomizedImage(source, "fixture-$mode.jpg", options, it) }
      assertTrue(prepared.getBoolean("customized"))
      assertFalse(prepared.getBoolean("savedToDevice"))
      assertEquals("image/jpeg", prepared.getString("mimeType"))
      val file = File(requireNotNull(Uri.parse(prepared.getString("fileUri")).path))
      val output = requireNotNull(BitmapFactory.decodeFile(file.path))
      assertEquals(512, output.width)
      assertTrue(output.height > 512)
      var redInBanner = 0
      var blueInFooter = 0
      for (y in 0 until output.height) for (x in 0 until output.width) {
        val pixel = output.getPixel(x, y)
        if (y < 512 && Color.red(pixel) > 190 && Color.blue(pixel) < 70 && Color.green(pixel) < 70) redInBanner++
        if (y >= 512 && Color.blue(pixel) > 190 && Color.red(pixel) < 70 && Color.green(pixel) < 70) blueInFooter++
      }
      assertTrue("$mode lost the business logo", redInBanner > 100)
      assertTrue("$mode lost the profile photo", blueInFooter > 100)
      output.recycle(); file.delete()
    }
  }

  @Test fun smallBannerCanExportItsLogoWithoutAnInvalidSizeRange() {
    val source = image("small-banner", 128, 128, Color.GREEN)
    val logo = image("small-banner-logo", 64, 64, Color.RED)
    val options = Arguments.createMap().apply {
      putBoolean("includeLogoOverlay", true)
      putString("logoOverlayUrl", logo)
    }
    val prepared = awaitResult { DownloadModule(context).prepareCustomizedImage(source, "small-banner.jpg", options, it) }
    val output = requireNotNull(BitmapFactory.decodeFile(Uri.parse(prepared.getString("fileUri")).path))
    assertEquals(128, output.width)
    assertEquals(128, output.height)
    output.recycle()
  }

  @Test fun portraitBannerLeavesReadableSpaceBetweenThePhotoAndQr() {
    val source = image("portrait-banner", 320, 568, Color.GREEN)
    val portrait = image("portrait-banner-photo", 128, 128, Color.BLUE)
    val options = Arguments.createMap().apply {
      putBoolean("includeLogo", true)
      putBoolean("includeQrCode", true)
      putString("profileImageUrl", portrait)
      putString("qrData", "tel:9000000000")
      putString("advisorName", "Actual Advisor")
      putString("advisorEmail", "advisor@example.com")
    }
    val prepared = awaitResult { DownloadModule(context).prepareCustomizedImage(source, "portrait.jpg", options, it) }
    val output = requireNotNull(BitmapFactory.decodeFile(Uri.parse(prepared.getString("fileUri")).path))
    assertEquals(320, output.width)
    assertEquals(644, output.height)
    var bluePixels = 0; var left = output.width; var right = 0
    for (y in 568 until output.height) for (x in 0 until output.width) {
      val pixel = output.getPixel(x, y)
      if (Color.blue(pixel) > 170 && Color.red(pixel) < 85 && Color.green(pixel) < 85) {
        bluePixels++; left = minOf(left, x); right = maxOf(right, x)
      }
    }
    assertTrue("Portrait photo disappeared", bluePixels > 50)
    assertTrue("Portrait photo consumed the footer's text space", right - left <= 58)
    output.recycle()
  }

  @Test fun portraitReelPreservesLogicalDimensionsAndCompactFooter() {
    val source = File(context.cacheDir, "fixture-portrait-with-audio.mp4")
    InstrumentationRegistry.getInstrumentation().context.assets.open("branding-portrait-source.mp4").use { input ->
      source.outputStream().use { input.copyTo(it) }
    }
    val options = Arguments.createMap().apply {
      putBoolean("includeLogo", true)
      putBoolean("includeQrCode", true)
      putString("profileImageUrl", image("portrait-video-photo", 128, 128, Color.BLUE))
      putString("qrData", "tel:9000000000")
      putString("advisorName", "Actual Advisor")
      putString("advisorEmail", "advisor@example.com")
    }
    val prepared = awaitResult(90) { DownloadModule(context).prepareCustomizedVideo(Uri.fromFile(source).toString(), "portrait-fixture.mp4", options, it) }
    assertEquals(320, prepared.getInt("width"))
    assertEquals(644, prepared.getInt("height"))
    val metadata = MediaMetadataRetriever()
    try {
      metadata.setDataSource(requireNotNull(Uri.parse(prepared.getString("fileUri")).path))
      assertEquals("yes", metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO))
      val width = requireNotNull(metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)).toInt()
      val height = requireNotNull(metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)).toInt()
      val rotation = metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      assertEquals(320, if (rotation % 180 != 0) height else width)
      assertEquals(644, if (rotation % 180 != 0) width else height)
      var frame = requireNotNull(metadata.getFrameAtTime(1_000_000, MediaMetadataRetriever.OPTION_CLOSEST))
      if (frame.width != 320 && rotation % 180 != 0) {
        val rotated = Bitmap.createBitmap(frame, 0, 0, frame.width, frame.height, Matrix().apply { postRotate(rotation.toFloat()) }, true)
        if (rotated != frame) frame.recycle()
        frame = rotated
      }
      assertEquals(320, frame.width)
      assertEquals(644, frame.height)
      var blue = 0
      for (y in 568 until frame.height) for (x in 0 until frame.width) {
        val pixel = frame.getPixel(x, y)
        if (Color.blue(pixel) > 170 && Color.red(pixel) < 85 && Color.green(pixel) < 85) blue++
      }
      assertTrue("Portrait footer lost its photo", blue > 50)
      frame.recycle()
    } finally { metadata.release() }
  }

  @Test fun reelExportBakesPortraitAndLogoAndRetainsAudio() {
    val source = File(context.cacheDir, "fixture-source-with-audio.mp4")
    InstrumentationRegistry.getInstrumentation().context.assets.open("branding-source.mp4").use { input ->
      source.outputStream().use { input.copyTo(it) }
    }
    val portrait = image("video-portrait", 128, 128, Color.BLUE)
    val logo = image("video-logo", 128, 128, Color.RED)
    val options = Arguments.createMap().apply {
      putString("advisorName", "Test Advisor")
      putString("profileImageUrl", portrait)
      putString("logoUrl", logo)
      putString("logoOverlayUrl", logo)
      putBoolean("includeLogo", true)
      putBoolean("includeLogoOverlay", true)
      putBoolean("includeWatermark", true)
    }
    val started = SystemClock.elapsedRealtime()
    val prepared = awaitResult(90) {
      DownloadModule(context).prepareCustomizedVideo(Uri.fromFile(source).toString(), "branded-fixture.mp4", options, it)
    }
    val elapsed = SystemClock.elapsedRealtime() - started
    assertEquals("video/mp4", prepared.getString("mimeType"))
    assertTrue(prepared.getBoolean("customized"))
    val file = File(requireNotNull(Uri.parse(prepared.getString("fileUri")).path))
    val metadata = MediaMetadataRetriever()
    try {
      metadata.setDataSource(file.path)
      assertEquals("yes", metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO))
      assertEquals("320", metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH))
      val duration = requireNotNull(metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)).toLong()
      assertTrue("Video duration changed: $duration", duration in 1500..2500)
      val frame = requireNotNull(metadata.getFrameAtTime(1_000_000, MediaMetadataRetriever.OPTION_CLOSEST))
      assertTrue(frame.height > 240)
      var green = 0; var red = 0; var blue = 0
      for (y in 0 until frame.height) for (x in 0 until frame.width) {
        val pixel = frame.getPixel(x, y)
        if (y < 240 && Color.green(pixel) > 70 && Color.red(pixel) < 65 && Color.blue(pixel) < 65) green++
        if (y < 240 && Color.red(pixel) > 170 && Color.green(pixel) < 85 && Color.blue(pixel) < 85) red++
        if (y >= 240 && Color.blue(pixel) > 170 && Color.red(pixel) < 85 && Color.green(pixel) < 85) blue++
      }
      assertTrue("Video source disappeared", green > 10_000)
      assertTrue("Video lost the business logo", red > 50)
      assertTrue("Video lost the profile photo", blue > 50)
      val evidence = File(requireNotNull(context.getExternalFilesDir("test-evidence")), "branded-fixture.mp4")
      file.copyTo(evidence, overwrite = true)
      File(evidence.parentFile, "video-export.txt").writeText("elapsedMs=$elapsed\ndurationMs=$duration\nredPixels=$red\nbluePixels=$blue\ngreenPixels=$green\n")
      // Preserve an existing real preview for device diagnosis without changing its account or quota.
      File(context.cacheDir, "policybhandar-share").listFiles()
        ?.filter { it != file && it.name.startsWith("prepared-") && it.extension == "mp4" && it.length() > file.length() }
        ?.maxByOrNull { it.lastModified() }
        ?.copyTo(File(evidence.parentFile, "real-preview.mp4"), overwrite = true)
      frame.recycle()
    } finally { metadata.release() }
  }

  @Test fun cropPreservesSelectedAreaAndLogoFitPreservesTransparency() {
    val source = image("wide-logo", 512, 256, Color.RED)
    val picker = ProfileImagePickerModule(context)
    val cropped = awaitResult { picker.cropImage(source, 0.25, 0.0, 0.5, 1.0, false, it) }
    var output = requireNotNull(BitmapFactory.decodeFile(Uri.parse(cropped.getString("uri")).path))
    assertEquals(1024, output.width)
    assertEquals(1024, output.height)
    assertEquals(Color.RED, output.getPixel(512, 512))
    output.recycle()
    val fitted = awaitResult { picker.cropImage(source, 0.0, 0.0, 1.0, 1.0, true, it) }
    output = requireNotNull(BitmapFactory.decodeFile(Uri.parse(fitted.getString("uri")).path))
    assertEquals(0, Color.alpha(output.getPixel(512, 10)))
    assertEquals(Color.RED, output.getPixel(512, 512))
    output.recycle()
  }

  @Test fun missingRequestedPhotoFailsInsteadOfExportingAnUnbrandedFile() {
    val source = image("missing-photo-banner", 512, 512, Color.GREEN)
    val latch = CountDownLatch(1)
    var rejected = false
    val promise = Proxy.newProxyInstance(Promise::class.java.classLoader, arrayOf(Promise::class.java)) { _, method, _ ->
      if (method.name == "reject") { rejected = true; latch.countDown() }
      if (method.name == "resolve") latch.countDown()
      null
    } as Promise
    val options = Arguments.createMap().apply { putBoolean("includeLogo", true); putString("profileImageUrl", "file:///missing-profile.png") }
    DownloadModule(context).prepareCustomizedImage(source, "should-not-export.jpg", options, promise)
    assertTrue(latch.await(30, TimeUnit.SECONDS))
    assertTrue("Missing branding must not silently disappear", rejected)
  }
}
