package com.labelscanner.scanner

import android.graphics.Bitmap
import android.graphics.Rect
import kotlin.math.roundToInt

object RoiCropper {
  fun uprightSize(width: Int, height: Int, rotationDegrees: Int): Pair<Int, Int> {
    return if (rotationDegrees % 180 == 0) width to height else height to width
  }

  fun toPixelRect(roi: NormalizedRoi, width: Int, height: Int): Rect {
    val clamped = roi.clamped()
    val left = (clamped.left * width).roundToInt().coerceIn(0, width)
    val top = (clamped.top * height).roundToInt().coerceIn(0, height)
    val right = (clamped.right * width).roundToInt().coerceIn(left + 1, width)
    val bottom = (clamped.bottom * height).roundToInt().coerceIn(top + 1, height)
    return Rect(left, top, right, bottom)
  }

  fun crop(bitmap: Bitmap, roi: NormalizedRoi): Bitmap {
    val rect = toPixelRect(roi, bitmap.width, bitmap.height)
    val width = (rect.width()).coerceAtLeast(1)
    val height = (rect.height()).coerceAtLeast(1)
    if (rect.left == 0 && rect.top == 0 && width == bitmap.width && height == bitmap.height) {
      return bitmap
    }
    return Bitmap.createBitmap(bitmap, rect.left, rect.top, width, height)
  }

  fun intersects(roi: Rect, box: Rect?): Boolean {
    if (box == null) {
      return true
    }
    return Rect.intersects(roi, box)
  }
}
