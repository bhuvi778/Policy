import UIKit

enum PolicyBhandarNativeUI {
  static func topViewController(_ base: UIViewController? = keyWindowRootViewController()) -> UIViewController? {
    if let nav = base as? UINavigationController {
      return topViewController(nav.visibleViewController)
    }
    if let tab = base as? UITabBarController, let selected = tab.selectedViewController {
      return topViewController(selected)
    }
    if let presented = base?.presentedViewController {
      return topViewController(presented)
    }
    return base
  }

  private static func keyWindowRootViewController() -> UIViewController? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }?.rootViewController
  }
}
