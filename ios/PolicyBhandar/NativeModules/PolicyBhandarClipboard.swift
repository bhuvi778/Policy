import UIKit
import React

@objc(PolicyBhandarClipboard)
class PolicyBhandarClipboard: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(copyText:withResolver:withRejecter:)
  func copyText(
    _ text: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let value = (text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !value.isEmpty else {
      reject("CLIPBOARD_EMPTY", "Nothing to copy.", nil)
      return
    }

    DispatchQueue.main.async {
      UIPasteboard.general.string = value
      resolve(true)
    }
  }
}
