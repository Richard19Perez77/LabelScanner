package com.labelscanner.scanner

/**
 * Emits a value at most once per [windowMs] for the same key. A different key
 * always passes. The cooldown is not extended on suppressed hits, so a held
 * label can re-emit after the window if the operator needs a retry.
 */
class DuplicateSuppressor(var windowMs: Long = 1500L) {
  private var lastKey: String? = null
  private var lastAcceptedAt: Long = 0L

  fun isDuplicate(key: String, nowMs: Long): Boolean {
    val duplicate = key == lastKey && nowMs - lastAcceptedAt < windowMs
    if (!duplicate) {
      lastKey = key
      lastAcceptedAt = nowMs
    }
    return duplicate
  }

  fun reset() {
    lastKey = null
    lastAcceptedAt = 0L
  }
}
