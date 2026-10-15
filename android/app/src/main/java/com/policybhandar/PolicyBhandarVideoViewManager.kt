package com.policybhandar

import android.media.MediaPlayer
import android.net.Uri
import android.view.ViewGroup
import android.view.View
import android.widget.FrameLayout
import android.widget.MediaController
import android.widget.VideoView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

private class PolicyVideoView(context: ThemedReactContext) : VideoView(context) {
  var displayAspectRatio = 0f
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    // Prepared portrait exports may be encoded sideways with rotation metadata.
    // Their logical display dimensions are supplied by the compositor.
    if (displayAspectRatio > 0f) setMeasuredDimension(View.MeasureSpec.getSize(widthMeasureSpec), View.MeasureSpec.getSize(heightMeasureSpec))
    else super.onMeasure(widthMeasureSpec, heightMeasureSpec)
  }
}

private class PolicyVideoContainer(context: ThemedReactContext) : FrameLayout(context) {
  var paused = false
  var thumbnailMode = false
  var source: String? = null
  var lifecycle: LifecycleEventListener? = null
  var displayAspectRatio = 0f
  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    if (displayAspectRatio <= 0f) { super.onLayout(changed, left, top, right, bottom); return }
    val child = getChildAt(0) ?: return
    val fittedWidth = kotlin.math.min(width.toFloat(), height * displayAspectRatio).toInt()
    val fittedHeight = (fittedWidth / displayAspectRatio).toInt()
    child.measure(View.MeasureSpec.makeMeasureSpec(fittedWidth, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(fittedHeight, View.MeasureSpec.EXACTLY))
    val x = (width - fittedWidth) / 2; val y = (height - fittedHeight) / 2
    child.layout(x, y, x + fittedWidth, y + fittedHeight)
  }
}

class PolicyBhandarVideoViewManager : SimpleViewManager<FrameLayout>() {
  override fun getName(): String = "PolicyBhandarVideoView"

  override fun createViewInstance(reactContext: ThemedReactContext): FrameLayout {
    val container = PolicyVideoContainer(reactContext)
    val videoView = PolicyVideoView(reactContext)
    val controller = MediaController(reactContext)

    controller.setAnchorView(videoView)
    videoView.setMediaController(controller)
    videoView.layoutParams = FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
    videoView.setOnPreparedListener { player ->
      player.isLooping = false
      player.setOnInfoListener { _, what, _ ->
        when (what) {
          MediaPlayer.MEDIA_INFO_BUFFERING_START -> sendEvent(container, "onVideoLoadStart")
          MediaPlayer.MEDIA_INFO_BUFFERING_END -> sendEvent(container, "onVideoReady")
        }
        false
      }
      if (container.thumbnailMode || container.paused) {
        videoView.seekTo(1)
        videoView.pause()
      } else {
        videoView.start()
      }
      sendEvent(container, "onVideoReady")
    }
    videoView.setOnErrorListener { _, what, extra ->
      sendEvent(container, "onVideoError", what, extra)
      true
    }

    container.addView(videoView)
    container.lifecycle = object : LifecycleEventListener {
      override fun onHostPause() { videoView.pause() }
      override fun onHostResume() { if (!container.paused && !container.thumbnailMode && container.isShown) videoView.start() }
      override fun onHostDestroy() { videoView.stopPlayback() }
    }
    reactContext.addLifecycleEventListener(container.lifecycle!!)
    return container
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    hashMapOf(
      "onVideoLoadStart" to hashMapOf("registrationName" to "onVideoLoadStart"),
      "onVideoReady" to hashMapOf("registrationName" to "onVideoReady"),
      "onVideoError" to hashMapOf("registrationName" to "onVideoError"),
    )

  @ReactProp(name = "thumbnailMode", defaultBoolean = false)
  fun setThumbnailMode(container: FrameLayout, thumbnailMode: Boolean) {
    (container as PolicyVideoContainer).thumbnailMode = thumbnailMode
    val videoView = container.getChildAt(0) as? VideoView ?: return
    if (thumbnailMode) {
      videoView.setMediaController(null)
    } else {
      val controller = MediaController(container.context)
      controller.setAnchorView(videoView)
      videoView.setMediaController(controller)
    }
    if (thumbnailMode) {
      videoView.seekTo(1)
      videoView.pause()
    }
  }

  @ReactProp(name = "paused", defaultBoolean = false)
  fun setPaused(container: FrameLayout, paused: Boolean) {
    val state = container as PolicyVideoContainer
    state.paused = paused
    val videoView = container.getChildAt(0) as? VideoView ?: return
    if (paused || state.thumbnailMode) videoView.pause() else videoView.start()
  }

  @ReactProp(name = "displayAspectRatio", defaultFloat = 0f)
  fun setDisplayAspectRatio(container: FrameLayout, ratio: Float) {
    val state = container as PolicyVideoContainer
    state.displayAspectRatio = if (ratio.isFinite() && ratio > 0f) ratio else 0f
    (state.getChildAt(0) as? PolicyVideoView)?.displayAspectRatio = state.displayAspectRatio
    state.requestLayout()
    state.post {
      if (state.width > 0 && state.height > 0) {
        state.measure(View.MeasureSpec.makeMeasureSpec(state.width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(state.height, View.MeasureSpec.EXACTLY))
        state.layout(state.left, state.top, state.right, state.bottom)
      }
    }
  }

  @ReactProp(name = "source")
  fun setSource(container: FrameLayout, source: String?) {
    val videoView = container.getChildAt(0) as? VideoView ?: return
    if (source.isNullOrBlank()) return
    val state = container as PolicyVideoContainer
    if (state.source == source) return
    state.source = source
    sendEvent(container, "onVideoLoadStart")
    videoView.setVideoURI(Uri.parse(source))
  }

  override fun onDropViewInstance(view: FrameLayout) {
    val videoView = view.getChildAt(0) as? VideoView
    videoView?.stopPlayback()
    (view as? PolicyVideoContainer)?.lifecycle?.let { (view.context as? ThemedReactContext)?.removeLifecycleEventListener(it) }
    super.onDropViewInstance(view)
  }

  private fun sendEvent(container: FrameLayout, eventName: String, what: Int = 0, extra: Int = 0) {
    val context = container.context as? ThemedReactContext ?: return
    val event = Arguments.createMap().apply {
      putString("event", eventName)
      if (what != 0) putInt("what", what)
      if (extra != 0) putInt("extra", extra)
    }
    context.getJSModule(RCTEventEmitter::class.java).receiveEvent(container.id, eventName, event)
  }
}
