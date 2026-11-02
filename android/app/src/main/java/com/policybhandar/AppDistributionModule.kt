package com.policybhandar

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class AppDistributionModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "PolicyBhandarDistribution"

  override fun getConstants(): Map<String, Any> = mapOf(
    "channel" to BuildConfig.POLICYBHANDAR_DISTRIBUTION,
    "versionName" to BuildConfig.VERSION_NAME,
    "versionCode" to BuildConfig.VERSION_CODE
  )
}
