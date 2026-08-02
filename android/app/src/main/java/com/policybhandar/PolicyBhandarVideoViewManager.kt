package com.policybhandar

import android.media.MediaPlayer
import android.net.Uri
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.MediaController
import android.widget.VideoView
import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

class PolicyBhandarVideoViewManager : SimpleViewManager<FrameLayout>() {
  override fun getName(): String = "PolicyBhandarVideoView"

  override fun createViewInstance(reactContext: ThemedReactContext): FrameLayout {
    val container = FrameLayout(reactContext)
    val videoView = VideoView(reactContext)
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
      if (container.tag == true) {
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
    container.tag = thumbnailMode
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

  @ReactProp(name = "source")
  fun setSource(container: FrameLayout, source: String?) {
    val videoView = container.getChildAt(0) as? VideoView ?: return
    if (source.isNullOrBlank()) return
    sendEvent(container, "onVideoLoadStart")
    videoView.setVideoURI(Uri.parse(source))
    videoView.requestFocus()
  }

  override fun onDropViewInstance(view: FrameLayout) {
    val videoView = view.getChildAt(0) as? VideoView
    videoView?.stopPlayback()
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
