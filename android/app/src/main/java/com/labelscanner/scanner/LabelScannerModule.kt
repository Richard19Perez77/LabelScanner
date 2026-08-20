package com.labelscanner.scanner

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.Executors

class LabelScannerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  private val executor = Executors.newSingleThreadExecutor()
  private val pipeline = ScanPipeline()

  override fun getName(): String = NAME

  @ReactMethod
  fun captureOcr(promise: Promise) {
    val view = LabelScannerView.current
    if (view == null) {
      promise.reject("NO_VIEW", "Scanner camera view is not mounted")
      return
    }
    reactContext.runOnUiQueueThread {
      view.captureOcr()
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun processTestImage(assetName: String, templateJson: String, promise: Promise) {
    executor.execute {
      try {
        val template = TemplateProfile.parse(templateJson)
        val bitmap = pipeline.loadAssetBitmap(reactContext, "testdata/$assetName")
        val result = pipeline.processBitmap(
          bitmap = bitmap,
          roi = NormalizedRoi.FULL,
          template = template,
          source = "fixture",
          includeOcr = true,
        )
        promise.resolve(result.toWritableMap())
      } catch (error: Exception) {
        promise.reject("FIXTURE_ERROR", error.message, error)
      }
    }
  }

  @ReactMethod
  fun listTestImages(promise: Promise) {
    executor.execute {
      try {
        val names = reactContext.assets.list("testdata")
          ?.filter { it.endsWith(".png", ignoreCase = true) }
          ?.sorted()
          ?: emptyList()
        val array = Arguments.createArray()
        names.forEach { array.pushString(it) }
        promise.resolve(array)
      } catch (error: Exception) {
        promise.reject("ASSET_ERROR", error.message, error)
      }
    }
  }

  @ReactMethod
  fun resetDuplicateWindow(promise: Promise) {
    pipeline.suppressor.reset()
    LabelScannerView.current?.resetDuplicates()
    promise.resolve(true)
  }

  override fun invalidate() {
    executor.shutdown()
    pipeline.close()
    super.invalidate()
  }

  companion object {
    const val NAME = "LabelScannerModule"
  }
}
