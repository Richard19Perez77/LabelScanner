package com.labelscanner

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.labelscanner.scanner.LabelScannerPackage
import com.labelscanner.scanner.ScanLog

/**
 * 
 * Starts RN, adds the scanner package.
 */
class MainApplication : Application(), ReactApplication {

    override val reactHost: ReactHost by lazy {
        ScanLog.enter("MainApplication.reactHost")
        getDefaultReactHost(
            context = applicationContext,
            packageList =
                PackageList(this).packages.apply {
                    ScanLog.enter("MainApplication.add LabelScannerPackage")
                    add(LabelScannerPackage())
                },
        )
    }

    override fun onCreate() {
        ScanLog.enter("MainApplication.onCreate")
        super.onCreate()
        loadReactNative(this)
    }
}
