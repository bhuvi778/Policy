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
      guard let data = uiImage.jpegData(compressionQuality: 0.9) else {
        reject?("IMAGE_PICKER_FAILED", "Unable to read selected image.", nil)
        return
      }

      let fileName = "profile-\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
      let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
      do {
        try data.write(to: fileURL, options: .atomic)
        resolve([
          "uri": fileURL.absoluteString,
          "name": fileName,
          "type": "image/jpeg",
        ])
      } catch {
        reject?("IMAGE_PICKER_FAILED", error.localizedDescription, error)
      }
    }
  }
}
