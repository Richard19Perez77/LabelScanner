package com.labelscanner.scanner

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers module + view manager.
 *
 * LabelScannerPackage is the catalog.
 *
 * RN does not scan the classpath for your classes.
 *
 * MainApplication must add(LabelScannerPackage()).
 *
 * The package implements ReactPackage and answers two questions:
 *
 *      createNativeModules → here is a LabelScannerModule
 *      createViewManagers → here is a LabelScannerViewManager
 *
 * Without the package, JS would never see either one.
 *
 * Auto linked libraries ship their own package; this scanner is handwritten, so it is registered by hand.
 */
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
