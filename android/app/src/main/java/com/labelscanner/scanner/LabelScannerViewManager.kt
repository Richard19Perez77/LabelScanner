package com.labelscanner.scanner

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class LabelScannerViewManager : SimpleViewManager<LabelScannerView>() {
    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): LabelScannerView {
        return LabelScannerView(reactContext)
    }

    @ReactProp(name = "scanningEnabled", defaultBoolean = true)
    fun setScanningEnabled(view: LabelScannerView, enabled: Boolean) {
        view.scanningEnabled = enabled
    }

    @ReactProp(name = "templateJson")
    fun setTemplateJson(view: LabelScannerView, json: String?) {
        if (!json.isNullOrBlank()) {
            view.applyTemplateJson(json)
        }
    }

    @ReactProp(name = "roi")
    fun setRoi(view: LabelScannerView, roi: ReadableMap?) {
        if (roi == null) {
            return
        }
        view.roi = NormalizedRoi(
            left = roi.getDouble("left").toFloat(),
            top = roi.getDouble("top").toFloat(),
            right = roi.getDouble("right").toFloat(),
            bottom = roi.getDouble("bottom").toFloat(),
        ).clamped()
    }

    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> {
        return hashMapOf(
            "onScanResult" to hashMapOf("registrationName" to "onScanResult"),
            "onScanError" to hashMapOf("registrationName" to "onScanError"),
        )
    }

    override fun onDropViewInstance(view: LabelScannerView) {
        view.release()
        super.onDropViewInstance(view)
    }

    companion object {
        const val REACT_CLASS = "RNLabelScannerView"
    }
}
