package com.labelscanner.scanner

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONObject

data class NormalizedRoi(
  val left: Float,
  val top: Float,
  val right: Float,
  val bottom: Float,
) {
  fun clamped(): NormalizedRoi {
    val l = left.coerceIn(0f, 1f)
    val t = top.coerceIn(0f, 1f)
    val r = right.coerceIn(0f, 1f)
    val b = bottom.coerceIn(0f, 1f)
    return NormalizedRoi(
      left = minOf(l, r),
      top = minOf(t, b),
      right = maxOf(l, r),
      bottom = maxOf(t, b),
    )
  }

  companion object {
    val FULL = NormalizedRoi(0f, 0f, 1f, 1f)
  }
}

data class FieldSpec(
  val name: String,
  val label: String,
  val anchors: List<String>,
  val regex: String,
  val checksum: String,
)

data class BarcodeSpec(
  val formats: List<String>,
  val checksum: String,
)

data class TemplateProfile(
  val id: String,
  val name: String,
  val duplicateWindowMs: Long,
  val barcode: BarcodeSpec,
  val fields: List<FieldSpec>,
) {
  companion object {
    fun parse(json: String): TemplateProfile {
      val root = JSONObject(json)
      val barcodeJson = root.getJSONObject("barcode")
      val formats = barcodeJson.getJSONArray("formats").let { array ->
        (0 until array.length()).map { array.getString(it) }
      }
      val fieldsJson = root.getJSONArray("fields")
      val fields = (0 until fieldsJson.length()).map { index ->
        val item = fieldsJson.getJSONObject(index)
        val anchors = item.getJSONArray("anchors").let { array ->
          (0 until array.length()).map { array.getString(it) }
        }
        FieldSpec(
          name = item.getString("name"),
          label = item.optString("label", item.getString("name")),
          anchors = anchors,
          regex = item.getString("regex"),
          checksum = item.optString("checksum", "none"),
        )
      }
      return TemplateProfile(
        id = root.getString("id"),
        name = root.getString("name"),
        duplicateWindowMs = root.optLong("duplicateWindowMs", 1500L),
        barcode = BarcodeSpec(
          formats = formats,
          checksum = barcodeJson.optString("checksum", "none"),
        ),
        fields = fields,
      )
    }
  }
}

data class OcrBlock(
  val text: String,
  val left: Int,
  val top: Int,
  val right: Int,
  val bottom: Int,
) {
  val centerX: Int get() = (left + right) / 2
  val centerY: Int get() = (top + bottom) / 2
  val height: Int get() = (bottom - top).coerceAtLeast(1)
}

data class ExtractedField(
  val name: String,
  val value: String?,
  val valid: Boolean,
  val reason: String?,
)

data class BarcodeResult(
  val value: String,
  val format: String,
  val valid: Boolean,
  val checksumOk: Boolean,
)

data class ScanResultDto(
  val source: String,
  val duplicate: Boolean,
  val latencyMs: Long,
  val barcode: BarcodeResult?,
  val fields: List<ExtractedField>,
  val rawText: String?,
) {
  fun toWritableMap(): WritableMap {
    val map = Arguments.createMap()
    map.putString("source", source)
    map.putBoolean("duplicate", duplicate)
    map.putDouble("latencyMs", latencyMs.toDouble())
    map.putString("rawText", rawText)
    if (barcode == null) {
      map.putNull("barcode")
    } else {
      val barcodeMap = Arguments.createMap()
      barcodeMap.putString("value", barcode.value)
      barcodeMap.putString("format", barcode.format)
      barcodeMap.putBoolean("valid", barcode.valid)
      barcodeMap.putBoolean("checksumOk", barcode.checksumOk)
      map.putMap("barcode", barcodeMap)
    }
    val fieldsArray: WritableArray = Arguments.createArray()
    fields.forEach { field ->
      val fieldMap = Arguments.createMap()
      fieldMap.putString("name", field.name)
      if (field.value == null) {
        fieldMap.putNull("value")
      } else {
        fieldMap.putString("value", field.value)
      }
      fieldMap.putBoolean("valid", field.valid)
      fieldMap.putString("reason", field.reason)
      fieldsArray.pushMap(fieldMap)
    }
    map.putArray("fields", fieldsArray)
    return map
  }

  fun duplicateKey(): String {
    val barcodeKey = barcode?.value ?: "-"
    val fieldKey = fields.joinToString("|") { "${it.name}=${it.value ?: ""}" }
    return "$barcodeKey::$fieldKey"
  }
}
