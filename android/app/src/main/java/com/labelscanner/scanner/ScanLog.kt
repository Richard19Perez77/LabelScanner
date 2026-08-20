package com.labelscanner.scanner

import android.util.Log

// helper for logging, uses basic log class.
internal object ScanLog {

    // unique id in logcat tag:Rick
    const val TAG = "Rick"

    fun enter(method: String) {
        try {
            Log.i(TAG, method)
        } catch (_: Throwable) {
            // android.util.Log is not mocked in JVM unit tests
        }
    }
}
