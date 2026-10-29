import UIKit
import PhotosUI
import React

@objc(PolicyBhandarProfileImagePicker)
class PolicyBhandarProfileImagePicker: NSObject, PHPickerViewControllerDelegate {

  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?

  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc(pickImage:withRejecter:)
  func pickImage(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      guard let presenter = PolicyBhandarNativeUI.topViewController() else {
        reject("NO_ACTIVITY", "Unable to open image picker right now.", nil)
        return
      }
      guard self.pendingResolve == nil else {
        reject("PICKER_BUSY", "Image picker is already open.", nil)
        return
      }

      self.pendingResolve = resolve
      self.pendingReject = reject

      var config = PHPickerConfiguration(photoLibrary: .shared())
      config.filter = .images
      config.selectionLimit = 1

      let picker = PHPickerViewController(configuration: config)
      picker.delegate = self
      presenter.present(picker, animated: true)
    }
  }

  func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    picker.dismiss(animated: true)

    guard let resolve = pendingResolve else { return }
    let reject = pendingReject
    pendingResolve = nil
    pendingReject = nil

    guard let result = results.first else {
      // User cancelled — matches Android's behavior of resolving null on cancel.
      resolve(NSNull())
      return
    }

    let provider = result.itemProvider
    guard provider.canLoadObject(ofClass: UIImage.self) else {
      reject?("IMAGE_PICKER_EMPTY", "No image was selected.", nil)
      return
    }

    provider.loadObject(ofClass: UIImage.self) { image, error in
      guard let uiImage = image as? UIImage, error == nil else {
        reject?("IMAGE_PICKER_EMPTY", "No image was selected.", error)
        return
      }
      do {
        let longest = max(uiImage.size.width, uiImage.size.height)
        let scale = min(1, 2048 / longest)
        let size = CGSize(width: uiImage.size.width * scale, height: uiImage.size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = false
        let normalized = UIGraphicsImageRenderer(size: size, format: format).image { _ in uiImage.draw(in: CGRect(origin: .zero, size: size)) }
        resolve(try self.writeImage(normalized))
      } catch {
        reject?("IMAGE_PICKER_FAILED", error.localizedDescription, error)
      }
    }
  }

  @objc(prepareImage:withResolver:withRejecter:)
  func prepareImage(_ uri: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        let image = try self.readImage(uri)
        resolve(try self.writeImage(image))
      } catch { reject("IMAGE_PREPARE_FAILED", error.localizedDescription, error) }
    }
  }

  @objc(cropImage:withX:withY:withWidth:withHeight:withFitWholeImage:withResolver:withRejecter:)
  func cropImage(_ uri: String, x: Double, y: Double, width: Double, height: Double, fitWholeImage: Bool,
                 resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        let image = try self.readImage(uri)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = false
        let cropped = UIGraphicsImageRenderer(size: CGSize(width: 1024, height: 1024), format: format).image { _ in
          if fitWholeImage {
            let scale = min(1024 / image.size.width, 1024 / image.size.height)
            let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
            image.draw(in: CGRect(x: (1024 - size.width) / 2, y: (1024 - size.height) / 2, width: size.width, height: size.height))
          } else {
            let w = max(0.001, min(1, width))
            let h = max(0.001, min(1, height))
            image.draw(in: CGRect(x: -max(0, min(1, x)) * 1024 / w, y: -max(0, min(1, y)) * 1024 / h, width: 1024 / w, height: 1024 / h))
          }
        }
        resolve(try self.writeImage(cropped))
      } catch { reject("IMAGE_CROP_FAILED", error.localizedDescription, error) }
    }
  }

  private func readImage(_ uri: String) throws -> UIImage {
    guard let url = URL(string: uri), let image = UIImage(data: try Data(contentsOf: url)) else {
      throw NSError(domain: "ProfileImage", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to read this image."])
    }
    let longest = max(image.size.width, image.size.height)
    let scale = min(1, 2048 / longest)
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
  }

  private func writeImage(_ image: UIImage) throws -> [String: Any] {
    let name = "profile-\(UUID().uuidString).png"
    let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("profile-images")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let url = directory.appendingPathComponent(name)
    guard let data = image.pngData() else { throw NSError(domain: "ProfileImage", code: 2) }
    try data.write(to: url, options: .atomic)
    return ["uri": url.absoluteString, "name": name, "type": "image/png", "width": image.size.width, "height": image.size.height]
  }
}
