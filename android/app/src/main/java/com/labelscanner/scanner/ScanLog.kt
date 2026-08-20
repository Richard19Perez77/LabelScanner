package com.labelscanner.scanner

import android.util.Log

internal object ScanLog {

    const val TAG = "Rick"

    fun enter(method: String) {
        try {
            Log.i(TAG, method)
        } catch (_: Throwable) {
            // android.util.Log is not mocked in JVM unit tests
        }
    }
}
