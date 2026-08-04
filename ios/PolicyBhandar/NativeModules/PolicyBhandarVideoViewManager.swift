import UIKit
import AVFoundation
import React

/// Mirrors android/.../PolicyBhandarVideoViewManager.kt: a native video view with
/// `thumbnailMode`/`source` props and onVideoLoadStart/onVideoReady/onVideoError events.
/// Android wraps the system VideoView + MediaController; here that's an AVPlayer layer
/// with a small custom play/pause + scrub overlay (iOS has no drop-in equivalent of
/// MediaController that composes cleanly as a plain UIView subview).
class PolicyBhandarVideoContainerView: UIView {
  @objc var onVideoLoadStart: RCTDirectEventBlock?
  @objc var onVideoReady: RCTDirectEventBlock?
  @objc var onVideoError: RCTDirectEventBlock?

  @objc var source: String? {
    didSet { applyConfiguration() }
  }

  @objc var thumbnailMode: Bool = false {
    didSet { applyConfiguration() }
  }

  private var configuredSource: String?
  private var player: AVPlayer?
  private var playerLayer: AVPlayerLayer?
  private var statusObservation: NSKeyValueObservation?
  private var timeObserverToken: Any?
  private var isScrubbing = false
  private var controlsHideTimer: Timer?

  private let activityIndicator = UIActivityIndicatorView(style: .large)
  private let playPauseButton = UIButton(type: .system)
  private let progressSlider = UISlider()

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .black
    setupControls()
    addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap)))
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  deinit {
    tearDownPlayer()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    playerLayer?.frame = bounds
    activityIndicator.center = CGPoint(x: bounds.midX, y: bounds.midY)
    playPauseButton.frame = CGRect(x: bounds.midX - 28, y: bounds.midY - 28, width: 56, height: 56)
    progressSlider.frame = CGRect(x: 12, y: bounds.height - 32, width: max(bounds.width - 24, 0), height: 24)
  }

  private func setupControls() {
    activityIndicator.hidesWhenStopped = true
    addSubview(activityIndicator)

    playPauseButton.tintColor = .white
    playPauseButton.setImage(UIImage(systemName: "play.circle.fill"), for: .normal)
    playPauseButton.addTarget(self, action: #selector(togglePlayback), for: .touchUpInside)
    playPauseButton.alpha = 0
    addSubview(playPauseButton)

    progressSlider.minimumTrackTintColor = .white
    progressSlider.maximumTrackTintColor = UIColor.white.withAlphaComponent(0.35)
    progressSlider.alpha = 0
    progressSlider.addTarget(self, action: #selector(scrubbingStarted), for: .touchDown)
    progressSlider.addTarget(self, action: #selector(scrubbingEnded(_:)), for: [.touchUpInside, .touchUpOutside])
    addSubview(progressSlider)
  }

  private func applyConfiguration() {
    progressSlider.isHidden = thumbnailMode
    playPauseButton.isHidden = thumbnailMode

    guard let source = source, !source.isEmpty else { return }

    if source == configuredSource {
      if thumbnailMode {
        player?.pause()
      }
      return
    }

    configuredSource = source
    loadVideo(from: source)
  }

  private func loadVideo(from source: String) {
    guard let url = URL(string: source) else {
      onVideoError?(["error": "Invalid video URL."])
      return
    }

    tearDownPlayer()
    onVideoLoadStart?([:])
    activityIndicator.startAnimating()

    let item = AVPlayerItem(url: url)
    let newPlayer = AVPlayer(playerItem: item)
    let layer = AVPlayerLayer(player: newPlayer)
    layer.videoGravity = .resizeAspect
    layer.frame = bounds
    self.layer.insertSublayer(layer, at: 0)

    player = newPlayer
    playerLayer = layer

    let thumbnailModeAtLoad = thumbnailMode
    statusObservation = item.observe(\.status, options: [.new]) { [weak self] observedItem, _ in
      DispatchQueue.main.async {
        self?.handleStatusChange(observedItem, thumbnailMode: thumbnailModeAtLoad, player: newPlayer)
      }
    }

    let interval = CMTime(seconds: 0.5, preferredTimescale: 600)
    timeObserverToken = newPlayer.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
      guard let self = self, !self.isScrubbing,
            let duration = self.player?.currentItem?.duration, duration.seconds.isFinite, duration.seconds > 0
      else { return }
      self.progressSlider.value = Float(time.seconds / duration.seconds)
    }

    NotificationCenter.default.addObserver(
      self, selector: #selector(playerDidFinishPlaying),
      name: .AVPlayerItemDidPlayToEndTime, object: item
    )
  }

  private func handleStatusChange(_ item: AVPlayerItem, thumbnailMode: Bool, player: AVPlayer) {
    switch item.status {
    case .readyToPlay:
      activityIndicator.stopAnimating()
      onVideoReady?([:])
      if thumbnailMode {
        player.seek(to: CMTime(value: 1, timescale: 1000))
        player.pause()
      } else {
        player.play()
        updatePlayPauseIcon(isPlaying: true)
        showControls()
        scheduleControlsHide()
      }
    case .failed:
      activityIndicator.stopAnimating()
      onVideoError?(["error": item.error?.localizedDescription ?? "Playback failed"])
    default:
      break
    }
  }

  @objc private func playerDidFinishPlaying() {
    player?.seek(to: .zero)
    updatePlayPauseIcon(isPlaying: false)
    showControls()
  }

  @objc private func handleTap() {
    guard !thumbnailMode, player != nil else { return }
    if playPauseButton.alpha > 0 {
      hideControls()
    } else {
      showControls()
      scheduleControlsHide()
    }
  }

  @objc private func togglePlayback() {
    guard let player = player else { return }
    if player.timeControlStatus == .playing {
      player.pause()
      updatePlayPauseIcon(isPlaying: false)
      controlsHideTimer?.invalidate()
    } else {
      player.play()
      updatePlayPauseIcon(isPlaying: true)
      scheduleControlsHide()
    }
  }

  @objc private func scrubbingStarted() {
    isScrubbing = true
    controlsHideTimer?.invalidate()
  }

  @objc private func scrubbingEnded(_ slider: UISlider) {
    isScrubbing = false
    guard let duration = player?.currentItem?.duration, duration.seconds.isFinite else { return }
    let target = CMTime(seconds: Double(slider.value) * duration.seconds, preferredTimescale: 600)
    player?.seek(to: target)
    scheduleControlsHide()
  }

  private func updatePlayPauseIcon(isPlaying: Bool) {
    let name = isPlaying ? "pause.circle.fill" : "play.circle.fill"
    playPauseButton.setImage(UIImage(systemName: name), for: .normal)
  }

  private func scheduleControlsHide() {
    controlsHideTimer?.invalidate()
    controlsHideTimer = Timer.scheduledTimer(withTimeInterval: 2.5, repeats: false) { [weak self] _ in
      self?.hideControls()
    }
  }

  private func showControls() {
    UIView.animate(withDuration: 0.2) {
      self.playPauseButton.alpha = 1
      self.progressSlider.alpha = 1
    }
  }

  private func hideControls() {
    UIView.animate(withDuration: 0.2) {
      self.playPauseButton.alpha = 0
      self.progressSlider.alpha = 0
    }
  }

  private func tearDownPlayer() {
    if let token = timeObserverToken {
      player?.removeTimeObserver(token)
      timeObserverToken = nil
    }
    statusObservation?.invalidate()
    statusObservation = nil
    NotificationCenter.default.removeObserver(self, name: .AVPlayerItemDidPlayToEndTime, object: player?.currentItem)
    controlsHideTimer?.invalidate()
    player?.pause()
    playerLayer?.removeFromSuperlayer()
    player = nil
    playerLayer = nil
  }
}

@objc(PolicyBhandarVideoViewManager)
class PolicyBhandarVideoViewManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool { true }

  override func view() -> UIView! {
    PolicyBhandarVideoContainerView()
  }
}
