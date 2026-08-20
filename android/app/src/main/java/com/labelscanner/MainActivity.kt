package com.labelscanner

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        com.labelscanner.scanner.ScanLog.enter("MainActivity.onCreate")
        super.onCreate(savedInstanceState)
    }

    override fun onResume() {
        com.labelscanner.scanner.ScanLog.enter("MainActivity.onResume")
        super.onResume()
    }

    override fun onPause() {
        com.labelscanner.scanner.ScanLog.enter("MainActivity.onPause")
        super.onPause()
    }

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String {
        com.labelscanner.scanner.ScanLog.enter("MainActivity.getMainComponentName")
        return "LabelScanner"
    }

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate {
        com.labelscanner.scanner.ScanLog.enter("MainActivity.createReactActivityDelegate")
        return DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
    }
}
