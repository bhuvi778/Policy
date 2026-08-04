import UIKit
import React

/// Mirrors android/.../DownloadModule.kt's `download` and `shareFile` methods only.
/// `downloadCustomizedImage` / `downloadImageWithWatermark` are intentionally not ported:
/// src/services/downloads.js gates those calls behind `Platform.OS === 'android'`, so on
/// iOS the JS layer already falls through to backend-rendered images + this module's
/// plain `download`/`shareFile`. See docs/ios-native-modules.md.
@objc(PolicyBhandarDownloader)
class PolicyBhandarDownloader: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(download:withFileName:withMimeType:withResolver:withRejecter:)
  func download(
    _ url: String,
    fileName: String?,
    mimeType: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, let sourceURL = URL(string: trimmed) else {
      reject("DOWNLOAD_URL_MISSING", "Download URL is missing.", nil)
      return
    }

    let safeName = Self.safeFileName(fileName, mimeType: mimeType, url: url)

    let task = URLSession.shared.downloadTask(with: sourceURL) { location, response, error in
      if let error = error {
        reject("DOWNLOAD_FAILED", error.localizedDescription, error)
        return
      }
      if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
        reject("DOWNLOAD_FAILED", "Download failed with status \(http.statusCode).", nil)
        return
      }
      guard let location = location else {
        reject("DOWNLOAD_FAILED", "Download did not return a file.", nil)
        return
      }

      do {
        let destination = try Self.documentsDownloadURL(for: safeName)
        if FileManager.default.fileExists(atPath: destination.path) {
          try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: location, to: destination)
        resolve([
          "filename": safeName,
          "directory": "Documents/Downloads",
          "url": url,
          "path": destination.path,
        ])
      } catch {
        reject("DOWNLOAD_FAILED", error.localizedDescription, error)
      }
    }
    task.resume()
  }

  @objc(shareFile:withFileName:withMimeType:withMessage:withWhatsappOnly:withResolver:withRejecter:)
  func shareFile(
    _ url: String,
    fileName: String?,
    mimeType: String?,
    message: String?,
    whatsappOnly: Bool,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      reject("SHARE_URL_MISSING", "Share URL is missing.", nil)
      return
    }

    let resolvedMime = Self.resolveMimeType(mimeType, url: url)
    let safeName = Self.safeFileName(fileName, mimeType: resolvedMime, url: url)

    Self.resolveShareFile(trimmed, fileName: safeName) { result in
      switch result {
      case .failure(let error):
        reject("SHARE_FAILED", error.localizedDescription, error)
      case .success(let fileURL):
        DispatchQueue.main.async {
          guard let presenter = PolicyBhandarNativeUI.topViewController() else {
            reject("SHARE_FAILED", "Unable to present share sheet.", nil)
            return
          }

          var items: [Any] = [fileURL]
          if let message = message, !message.isEmpty {
            items.append(message)
          }

          // iOS has no public API to silently target a single app (e.g. WhatsApp) with a
          // file attachment — `whatsappOnly` is best-effort: it still shows the standard
          // share sheet, where WhatsApp appears as one of the options if installed.
          let activityVC = UIActivityViewController(activityItems: items, applicationActivities: nil)
          if let popover = activityVC.popoverPresentationController {
            popover.sourceView = presenter.view
            popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 0, height: 0)
            popover.permittedArrowDirections = []
          }

          presenter.present(activityVC, animated: true) {
            resolve([
              "uri": fileURL.absoluteString,
              "filename": safeName,
              "mimeType": resolvedMime,
              "whatsappOnly": whatsappOnly,
            ])
          }
        }
      }
    }
  }

  // MARK: - File resolution

  private static func resolveShareFile(_ raw: String, fileName: String, completion: @escaping (Result<URL, Error>) -> Void) {
    if raw.lowercased().hasPrefix("file://"), let fileURL = URL(string: raw) {
      completion(.success(fileURL))
      return
    }
    if FileManager.default.fileExists(atPath: raw) {
      completion(.success(URL(fileURLWithPath: raw)))
      return
    }
    guard let remoteURL = URL(string: raw), let scheme = remoteURL.scheme?.lowercased(), scheme.hasPrefix("http") else {
      completion(.failure(Self.error("Unsupported share URL.")))
      return
    }

    let task = URLSession.shared.downloadTask(with: remoteURL) { location, response, error in
      if let error = error {
        completion(.failure(error))
        return
      }
      if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
        completion(.failure(Self.error("Share file download failed with status \(http.statusCode).")))
        return
      }
      guard let location = location else {
        completion(.failure(Self.error("Share file download failed.")))
        return
      }
      do {
        let cacheDir = FileManager.default.temporaryDirectory.appendingPathComponent("policybhandar-share", isDirectory: true)
        try FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
        let destination = cacheDir.appendingPathComponent(fileName)
        if FileManager.default.fileExists(atPath: destination.path) {
          try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: location, to: destination)
        completion(.success(destination))
      } catch {
        completion(.failure(error))
      }
    }
    task.resume()
  }

  private static func documentsDownloadURL(for fileName: String) throws -> URL {
    let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let downloadsDir = documents.appendingPathComponent("Downloads", isDirectory: true)
    if !FileManager.default.fileExists(atPath: downloadsDir.path) {
      try FileManager.default.createDirectory(at: downloadsDir, withIntermediateDirectories: true)
    }
    return downloadsDir.appendingPathComponent(fileName)
  }

  // MARK: - Naming / MIME helpers (mirrors DownloadModule.kt's safeFileName/resolveMimeType)

  private static func safeFileName(_ fileName: String?, mimeType: String?, url: String?) -> String {
    var clean = (fileName?.isEmpty == false ? fileName! : "policybhandar-\(Int(Date().timeIntervalSince1970 * 1000))")
    clean = clean.replacingOccurrences(of: "[^A-Za-z0-9._-]+", with: "-", options: .regularExpression)
    if clean.isEmpty {
      clean = "policybhandar-\(Int(Date().timeIntervalSince1970 * 1000))"
    }

    if clean.range(of: "\\.[A-Za-z0-9]{2,5}$", options: .regularExpression) != nil {
      return clean
    }

    var extensionFromUrl: String?
    if let url = url {
      let stripped = url.components(separatedBy: "?").first?.components(separatedBy: "#").first ?? url
      if let range = stripped.range(of: "\\.[A-Za-z0-9]{2,5}$", options: .regularExpression) {
        extensionFromUrl = String(stripped[range])
      }
    }

    let ext = extensionFromUrl ?? {
      switch mimeType?.lowercased() {
      case "image/png": return ".png"
      case "image/webp": return ".webp"
      case "video/mp4": return ".mp4"
      case "application/pdf": return ".pdf"
      default: return ".jpg"
      }
    }()

    return clean + ext
  }

  private static func resolveMimeType(_ mimeType: String?, url: String?) -> String {
    let supplied = mimeType?.trimmingCharacters(in: .whitespaces) ?? ""
    if !supplied.isEmpty && supplied != "application/octet-stream" {
      return supplied
    }

    let clean = (url ?? "")
      .components(separatedBy: "?").first?
      .components(separatedBy: "#").first?
      .lowercased() ?? ""

    if clean.hasSuffix(".mp4") || clean.hasSuffix(".m4v") { return "video/mp4" }
    if clean.hasSuffix(".mov") { return "video/quicktime" }
    if clean.hasSuffix(".webm") { return "video/webm" }
    if clean.hasSuffix(".png") { return "image/png" }
    if clean.hasSuffix(".webp") { return "image/webp" }
    if clean.hasSuffix(".pdf") { return "application/pdf" }
    if clean.hasSuffix(".mp3") { return "audio/mpeg" }
    if clean.hasSuffix(".m4a") { return "audio/mp4" }
    if clean.hasSuffix(".wav") { return "audio/wav" }
    if clean.hasSuffix(".jpg") || clean.hasSuffix(".jpeg") || clean.hasPrefix("content://") { return "image/jpeg" }
    return "application/octet-stream"
  }

  private static func error(_ message: String) -> NSError {
    NSError(domain: "PolicyBhandarDownloader", code: -1, userInfo: [NSLocalizedDescriptionKey: message])
  }
}
