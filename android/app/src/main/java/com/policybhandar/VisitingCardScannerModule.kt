package com.policybhandar

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ContentProviderOperation
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract
import androidx.core.content.ContextCompat
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.ByteArrayOutputStream
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
          .addOnSuccessListener { croppedResult ->
            val croppedText = orderedRecognizedText(croppedResult)
            val croppedParsed = parseVisitingCardText(croppedText)
            if (croppedParsed.phones.isNotEmpty()) {
              resolveProcessedCard(promise, outputFile, cropped, croppedText, croppedParsed)
              return@addOnSuccessListener
            }

            val fullOcrBitmap = scaleBitmapForOcr(oriented)
            recognizer.process(InputImage.fromBitmap(fullOcrBitmap, 0))
              .addOnSuccessListener { fullResult ->
                val fullText = orderedRecognizedText(fullResult)
                val combinedText = listOf(croppedText, fullText)
                  .filter { it.isNotBlank() }
                  .joinToString("\n")
                val parsed = parseVisitingCardText(combinedText)
                resolveProcessedCard(promise, outputFile, cropped, combinedText, parsed)
              }
              .addOnFailureListener {
                resolveProcessedCard(promise, outputFile, cropped, croppedText, croppedParsed)
              }
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

  @ReactMethod
  fun saveScannedContact(name: String, phone: String, imagePath: String?, promise: Promise) {
    Thread {
      try {
        if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.WRITE_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
          promise.reject("CONTACT_PERMISSION_REQUIRED", "Contacts permission is required to save this visiting card.")
          return@Thread
        }

        val cleanName = name.trim().ifBlank { "Scanned Contact" }
        val cleanPhone = phone.replace(Regex("\\D"), "").takeLast(10)
        if (cleanPhone.length != 10) {
          promise.reject("CONTACT_PHONE_INVALID", "A valid 10 digit mobile number is required.")
          return@Thread
        }

        val operations = ArrayList<ContentProviderOperation>()
        operations.add(
          ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI)
            .withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, null)
            .withValue(ContactsContract.RawContacts.ACCOUNT_NAME, null)
            .build()
        )
        operations.add(
          ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
            .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
            .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
            .withValue(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, cleanName)
            .build()
        )
        operations.add(
          ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
            .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
            .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
            .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, cleanPhone)
            .withValue(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE)
            .build()
        )

        val photoBytes = imagePath?.let { buildContactPhotoBytes(it) }
        if (photoBytes != null) {
          operations.add(
            ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
              .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
              .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE)
              .withValue(ContactsContract.CommonDataKinds.Photo.PHOTO, photoBytes)
              .build()
          )
        }

        val results = reactContext.contentResolver.applyBatch(ContactsContract.AUTHORITY, operations)
        val map = Arguments.createMap()
        map.putBoolean("saved", true)
        map.putString("rawContactUri", results.firstOrNull()?.uri?.toString() ?: "")
        promise.resolve(map)
      } catch (error: Exception) {
        promise.reject("CONTACT_SAVE_FAILED", error.message ?: "Unable to save contact.")
      }
    }.start()
  }

  @ReactMethod
  fun openContactEditor(name: String, phone: String, imagePath: String?, promise: Promise) {
    try {
      val cleanName = name.trim().ifBlank { "Scanned Contact" }
      val phones = phone.split(Regex("\\r?\\n|,|;")).flatMap { extractPhonesFromLine(it) }.distinct()
      val cleanPhone = phones.firstOrNull() ?: ""
      val intent = Intent(Intent.ACTION_INSERT).apply {
        type = ContactsContract.Contacts.CONTENT_TYPE
        putExtra(ContactsContract.Intents.Insert.NAME, cleanName)
        if (cleanPhone.length == 10) {
          putExtra(ContactsContract.Intents.Insert.PHONE, cleanPhone)
          putExtra(ContactsContract.Intents.Insert.PHONE_TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE)
        }
        putExtra("finishActivityOnSaveCompleted", true)
      }

      val photoBytes = imagePath?.let { buildContactPhotoBytes(it) }
      if (photoBytes != null || phones.size > 1) {
        val dataRows = arrayListOf<ContentValues>()
        phones.drop(1).forEach { extraPhone ->
          dataRows.add(ContentValues().apply {
            put(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
            put(ContactsContract.CommonDataKinds.Phone.NUMBER, extraPhone)
            put(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE)
          })
        }
        if (photoBytes != null) {
          dataRows.add(ContentValues().apply {
            put(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE)
            put(ContactsContract.CommonDataKinds.Photo.PHOTO, photoBytes)
          })
        }
        if (dataRows.isNotEmpty()) intent.putParcelableArrayListExtra(ContactsContract.Intents.Insert.DATA, dataRows)
      }

      val activity: Activity? = reactContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
      }

      val map = Arguments.createMap()
      map.putBoolean("opened", true)
      map.putBoolean("hasPhone", cleanPhone.length == 10)
      promise.resolve(map)
    } catch (error: ActivityNotFoundException) {
      promise.reject("CONTACT_EDITOR_NOT_FOUND", "No contacts app was found on this phone.")
    } catch (error: Exception) {
      promise.reject("CONTACT_EDITOR_FAILED", error.message ?: "Unable to open phone contact editor.")
    }
  }

  private fun normalizePath(value: String): String {
    val text = value.trim()
    if (text.startsWith("file://")) return Uri.parse(text).path ?: ""
    return text
  }

  private fun buildContactPhotoBytes(value: String): ByteArray? {
    val path = normalizePath(value)
    if (path.isBlank()) return null
    val bitmap = BitmapFactory.decodeFile(path) ?: return null
    val maxSide = 720f
    val scale = min(1f, maxSide / max(bitmap.width, bitmap.height).toFloat())
    val output = if (scale < 1f) {
      Bitmap.createScaledBitmap(
        bitmap,
        max(1, (bitmap.width * scale).toInt()),
        max(1, (bitmap.height * scale).toInt()),
        true
      )
    } else {
      bitmap
    }
    return ByteArrayOutputStream().use { stream ->
      output.compress(Bitmap.CompressFormat.JPEG, 86, stream)
      stream.toByteArray()
    }
  }

  private data class ParsedCard(
    val name: String,
    val mobile: String,
    val phones: List<String>
  )

  private fun resolveProcessedCard(
    promise: Promise,
    outputFile: File,
    cropped: Bitmap,
    text: String,
    parsed: ParsedCard
  ) {
    val map = Arguments.createMap()
    val phones = Arguments.createArray()
    parsed.phones.forEach { phones.pushString(it) }
    map.putString("uri", Uri.fromFile(outputFile).toString())
    map.putString("path", outputFile.absolutePath)
    map.putString("text", text)
    map.putString("name", parsed.name)
    map.putString("mobile", parsed.mobile)
    map.putArray("phones", phones)
    map.putInt("width", cropped.width)
    map.putInt("height", cropped.height)
    promise.resolve(map)
  }

  private fun orderedRecognizedText(result: Text): String {
    val lines = result.textBlocks
      .flatMap { block -> block.lines }
      .sortedWith(compareBy<Text.Line>({ it.boundingBox?.top ?: 0 }, { it.boundingBox?.left ?: 0 }))
      .map { it.text.trim() }
      .filter { it.isNotBlank() }
    return if (lines.isNotEmpty()) lines.joinToString("\n") else result.text.orEmpty()
  }

  private fun parseVisitingCardText(text: String): ParsedCard {
    val lines = text
      .split(Regex("\\r?\\n"))
      .map { it.trim() }
      .filter { it.isNotBlank() }
    val phoneLineIndexes = mutableListOf<Int>()
    val phones = linkedSetOf<String>()

    lines.forEachIndexed { index, line ->
      val linePhones = extractPhonesFromLine(line)
      if (linePhones.isNotEmpty()) {
        phoneLineIndexes.add(index)
        phones.addAll(linePhones)
      }
    }

    val name = pickNameLine(lines, phoneLineIndexes)
    return ParsedCard(name, phones.firstOrNull() ?: "", phones.toList())
  }

  private fun extractPhonesFromLine(line: String): List<String> {
    val normalized = line
      .replace(Regex("[‐‑‒–—−]"), "-")
      .replace('\u00A0', ' ')
    val numberSafe = normalized
      .replace(Regex("[Oo]"), "0")
      .replace(Regex("[Il|]"), "1")
      .replace(Regex("[Ss]"), "5")
    val mobileRegex = Regex("(?:\\(?\\+?\\s*91\\)?[\\s-]*)?(?:0[\\s-]*)?[6-9](?:[\\s-]*\\d){9}")
    val fallbackRegex = Regex("(?:\\(?\\+?\\s*91\\)?[\\s-]*)?(?:0[\\s-]*)?\\d(?:[\\s-]*\\d){9,11}")
    val values = linkedSetOf<String>()

    fun addMatch(value: String) {
      val digits = value.replace(Regex("\\D"), "")
      val clean = when {
        digits.length == 12 && digits.startsWith("91") -> digits.substring(2)
        digits.length == 11 && digits.startsWith("0") -> digits.substring(1)
        digits.length > 10 -> digits.takeLast(10)
        else -> digits
      }
      if (clean.length == 10 && !Regex("^(\\d)\\1{9}$").matches(clean)) values.add(clean)
    }

    mobileRegex.findAll(numberSafe).forEach { addMatch(it.value) }
    fallbackRegex.findAll(numberSafe).forEach { addMatch(it.value) }
    return values.toList()
  }

  private fun pickNameLine(lines: List<String>, phoneLineIndexes: List<Int>): String {
    val badWords = Regex(
      "(phone|mobile|email|www|http|\\.com|@|regards|consultant|advisor|agent|manager|director|pvt|ltd|company|insurance|policy|bhandar|address|office|branch|call|tel|gst|cin|license|licence|website)",
      RegexOption.IGNORE_CASE
    )
    fun cleanName(value: String): String =
      value
        .replace(Regex("(?i)\\b(mr|mrs|ms|miss|dr|shri|smt)\\.?\\s+"), "")
        .replace(Regex("[^A-Za-z .'-]"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()

    fun isGoodName(value: String): Boolean {
      val clean = cleanName(value)
      return clean.length in 3..42 &&
        !badWords.containsMatchIn(value) &&
        !Regex("\\d{3,}").containsMatchIn(value) &&
        clean.any { it.isLetter() }
    }

    fun score(value: String, index: Int): Int {
      val clean = cleanName(value)
      val words = clean.split(Regex("\\s+")).filter { it.isNotBlank() }
      val upperLetters = value.count { it.isLetter() && it.isUpperCase() }
      val letters = value.count { it.isLetter() }.coerceAtLeast(1)
      var score = 0
      if (words.size in 2..4) score += 25
      if (upperLetters * 100 / letters >= 60) score += 18
      if (index <= 5) score += 10
      if (phoneLineIndexes.any { phoneIndex -> index in (phoneIndex - 5)..(phoneIndex - 1) }) score += 22
      if (clean.length in 8..28) score += 8
      return score
    }

    return lines
      .mapIndexed { index, line -> Triple(line, index, if (isGoodName(line)) score(line, index) else -1) }
      .filter { it.third >= 0 }
      .maxByOrNull { it.third }
      ?.first
      ?.let(::cleanName)
      ?: ""
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
    val maxWidth = (bitmap.width * 0.94).toInt()
    val maxHeight = (bitmap.height * 0.5).toInt()
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

  private fun scaleBitmapForOcr(bitmap: Bitmap): Bitmap {
    val maxSide = 1800f
    val scale = min(1f, maxSide / max(bitmap.width, bitmap.height).toFloat())
    if (scale >= 1f) return bitmap
    return Bitmap.createScaledBitmap(
      bitmap,
      max(1, (bitmap.width * scale).toInt()),
      max(1, (bitmap.height * scale).toInt()),
      true
    )
  }
}
