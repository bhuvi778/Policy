import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "PolicyBhandar",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func createRootViewController() -> UIViewController {
    WindowControlsSafeAreaViewController()
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

/// On iPadOS 26+ the iPhone app runs in a window whose close/minimise controls sit in the
/// top-leading corner, and the plain safe area doesn't always clear them. Push the safe area
/// down by the difference so every screen's `useSafeAreaInsets().top` header clears the
/// controls (App Review Guideline 4: "top menu bar cutoff" on iPad).
class WindowControlsSafeAreaViewController: UIViewController {
  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    updateWindowControlsInset()
  }

  override func viewSafeAreaInsetsDidChange() {
    super.viewSafeAreaInsetsDidChange()
    updateWindowControlsInset()
  }

  private func updateWindowControlsInset() {
    guard #available(iOS 26.0, *), let window = view.window else { return }
    // Measured on the window, which additionalSafeAreaInsets never affects, so this can't feed back.
    let controlsTop = window.edgeInsets(for: .safeArea(cornerAdaptation: .vertical)).top
    let extraTop = max(0, controlsTop - window.safeAreaInsets.top).rounded(.up)
    if additionalSafeAreaInsets.top != extraTop {
      additionalSafeAreaInsets.top = extraTop
    }
  }
}
