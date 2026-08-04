import UIKit
import Vision
import React

/// Mirrors android/.../VisitingCardScannerModule.kt: crop the center of the captured
/// photo to the visiting-card aspect ratio, then run text recognition (Vision here,
/// ML Kit on Android) over the crop.
@objc(PolicyBhandarVisitingCardScanner)
class PolicyBhandarVisitingCardScanner: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(processCardImage:withFrameRatio:withResolver:withRejecter:)
  func processCardImage(
    _ photoPath: String,
    frameRatio: Double,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      let sourcePath = Self.normalizePath(photoPath)
      guard !sourcePath.isEmpty else {
        reject("CARD_IMAGE_MISSING", "Captured card image path is missing.", nil)
        return
      }
      guard FileManager.default.fileExists(atPath: sourcePath) else {
        reject("CARD_IMAGE_NOT_FOUND", "Captured card image was not found.", nil)
        return
      }
      guard let decoded = UIImage(contentsOfFile: sourcePath) else {
        reject("CARD_IMAGE_DECODE_FAILED", "Unable to read captured card image.", nil)
        return
      }

      let oriented = Self.normalizedOrientation(decoded)
      guard let cropped = Self.cropCenterCard(oriented, ratio: frameRatio > 0 ? frameRatio : 1.72) else {
        reject("CARD_PROCESS_FAILED", "Unable to process visiting card.", nil)
        return
      }

      let outputURL = FileManager.default.temporaryDirectory
        .appendingPathComponent("visiting-card-\(Int(Date().timeIntervalSince1970 * 1000)).jpg")
      guard let jpegData = cropped.jpegData(compressionQuality: 0.92) else {
        reject("CARD_PROCESS_FAILED", "Unable to process visiting card.", nil)
        return
      }
      do {
        try jpegData.write(to: outputURL, options: .atomic)
      } catch {
        reject("CARD_PROCESS_FAILED", error.localizedDescription, error)
        return
      }

      let width = Int(cropped.size.width * cropped.scale)
      let height = Int(cropped.size.height * cropped.scale)

      guard let cgImage = cropped.cgImage else {
        resolve([
          "uri": outputURL.absoluteString,
          "path": outputURL.path,
          "text": "",
          "warning": "Text recognition failed.",
          "width": width,
          "height": height,
        ])
        return
      }

      let request = VNRecognizeTextRequest { request, error in
        var recognizedText = ""
        var warning: String?
        if let error = error {
          warning = error.localizedDescription
        } else if let observations = request.results as? [VNRecognizedTextObservation] {
          recognizedText = observations
            .compactMap { $0.topCandidates(1).first?.string }
            .joined(separator: "\n")
        }

        var result: [String: Any] = [
          "uri": outputURL.absoluteString,
          "path": outputURL.path,
          "text": recognizedText,
          "width": width,
          "height": height,
        ]
        if let warning = warning {
          result["warning"] = warning
        }
        resolve(result)
      }
      request.recognitionLevel = .accurate

      let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
      do {
        try handler.perform([request])
      } catch {
        resolve([
          "uri": outputURL.absoluteString,
          "path": outputURL.path,
          "text": "",
          "warning": error.localizedDescription,
          "width": width,
          "height": height,
        ])
      }
    }
  }

  private static func normalizePath(_ value: String) -> String {
    let text = value.trimmingCharacters(in: .whitespacesAndNewlines)
    if text.hasPrefix("file://"), let url = URL(string: text) {
      return url.path
    }
    return text
  }

  /// UIImage(contentsOfFile:) preserves EXIF orientation as metadata without rotating
  /// the underlying pixel buffer; bake it in before doing pixel-based cropping below
  /// (Android's applyExifOrientation physically rotates the bitmap for the same reason).
  private static func normalizedOrientation(_ image: UIImage) -> UIImage {
    if image.imageOrientation == .up { return image }
    let renderer = UIGraphicsImageRenderer(size: image.size)
    return renderer.image { _ in
      image.draw(in: CGRect(origin: .zero, size: image.size))
    }
  }

  private static func cropCenterCard(_ image: UIImage, ratio: Double) -> UIImage? {
    guard let cgImage = image.cgImage else { return nil }
    let pixelWidth = CGFloat(cgImage.width)
    let pixelHeight = CGFloat(cgImage.height)
    let safeRatio = CGFloat(min(max(ratio, 1.2), 2.2))

    let maxWidth = pixelWidth * 0.9
    let maxHeight = pixelHeight * 0.42
    var cropWidth = maxWidth
    var cropHeight = cropWidth / safeRatio

    if cropHeight > maxHeight {
      cropHeight = maxHeight
      cropWidth = cropHeight * safeRatio
    }

    cropWidth = min(max(cropWidth, pixelWidth / 2), pixelWidth)
    cropHeight = min(max(cropHeight, pixelHeight / 5), pixelHeight)

    let left = max((pixelWidth - cropWidth) / 2, 0)
    let top = max((pixelHeight - cropHeight) / 2, 0)
    let width = min(cropWidth, pixelWidth - left)
    let height = min(cropHeight, pixelHeight - top)

    guard let croppedCGImage = cgImage.cropping(to: CGRect(x: left, y: top, width: width, height: height)) else {
      return nil
    }
    return UIImage(cgImage: croppedCGImage, scale: image.scale, orientation: .up)
  }
}
