package com.labelscanner.scanner

import com.google.mlkit.vision.barcode.common.Barcode

object MlKitFormats {
  fun name(format: Int): String {
    return when (format) {
      Barcode.FORMAT_EAN_13 -> "EAN_13"
      Barcode.FORMAT_EAN_8 -> "EAN_8"
      Barcode.FORMAT_UPC_A -> "UPC_A"
      Barcode.FORMAT_CODE_128 -> "CODE_128"
      Barcode.FORMAT_QR_CODE -> "QR_CODE"
      Barcode.FORMAT_CODE_39 -> "CODE_39"
      Barcode.FORMAT_DATA_MATRIX -> "DATA_MATRIX"
      else -> "UNKNOWN"
    }
  }

  fun flags(formats: List<String>): Int {
    if (formats.isEmpty()) {
      return Barcode.FORMAT_ALL_FORMATS
    }
    return formats.fold(0) { acc, name ->
      acc or when (name.uppercase()) {
        "EAN_13" -> Barcode.FORMAT_EAN_13
        "EAN_8" -> Barcode.FORMAT_EAN_8
        "UPC_A" -> Barcode.FORMAT_UPC_A
        "CODE_128" -> Barcode.FORMAT_CODE_128
        "QR_CODE" -> Barcode.FORMAT_QR_CODE
        "CODE_39" -> Barcode.FORMAT_CODE_39
        "DATA_MATRIX" -> Barcode.FORMAT_DATA_MATRIX
        else -> 0
      }
    }.let { if (it == 0) Barcode.FORMAT_ALL_FORMATS else it }
  }
}
