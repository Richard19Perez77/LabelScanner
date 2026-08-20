package com.labelscanner.scanner

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class LabelScannerPackage : ReactPackage {
    init {
        ScanLog.enter("LabelScannerPackage.init")
    }

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        ScanLog.enter("LabelScannerPackage.createNativeModules")
        return listOf(LabelScannerModule(reactContext))
    }

    override fun createViewManagers(
        reactContext: ReactApplicationContext,
    ): List<ViewManager<*, *>> {
        ScanLog.enter("LabelScannerPackage.createViewManagers")
        return listOf(LabelScannerViewManager())
    }
}
