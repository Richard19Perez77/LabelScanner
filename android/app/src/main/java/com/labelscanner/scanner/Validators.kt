package com.labelscanner.scanner

object Validators {
  fun matchesRegex(value: String, regex: String): Boolean {
    return Regex(regex).matches(value.trim())
  }

  /**
   * GS1 EAN-13 check digit: odd-position digits (1-indexed) * 1 plus even-position
   * digits * 3, modulo 10, check digit makes the total a multiple of 10.
   */
  fun ean13ChecksumValid(value: String): Boolean {
    val digits = value.filter { it.isDigit() }
    if (digits.length != 13) {
      return false
    }
    val numbers = digits.map { it - '0' }
    val sum = numbers.take(12).mapIndexed { index, digit ->
      if (index % 2 == 0) digit else digit * 3
    }.sum()
    val check = (10 - (sum % 10)) % 10
    return check == numbers[12]
  }

  fun validateField(spec: FieldSpec, raw: String?): ExtractedField {
    if (raw.isNullOrBlank()) {
      return ExtractedField(spec.name, null, false, "not found")
    }
    val value = raw.trim().uppercase().let { candidate ->
      if (spec.name.contains("date", ignoreCase = true)) raw.trim() else candidate
    }
    if (!matchesRegex(value, spec.regex) && !matchesRegex(raw.trim(), spec.regex)) {
      return ExtractedField(spec.name, raw.trim(), false, "regex mismatch")
    }
    val normalized = if (matchesRegex(raw.trim(), spec.regex)) raw.trim() else value
    return when (spec.checksum.lowercase()) {
      "ean13" -> ExtractedField(
        spec.name,
        normalized,
        ean13ChecksumValid(normalized),
        if (ean13ChecksumValid(normalized)) null else "checksum failed",
      )
      else -> ExtractedField(spec.name, normalized, true, null)
    }
  }

  fun validateBarcode(value: String, format: String, spec: BarcodeSpec): BarcodeResult {
    val isEan13 = format.equals("EAN_13", ignoreCase = true)
    val checksumRequested = isEan13 && spec.checksum.lowercase() == "ean13"
    val checksumOk = if (checksumRequested) ean13ChecksumValid(value) else true
    val formatAllowed = spec.formats.isEmpty() || spec.formats.any {
      it.equals(format, ignoreCase = true)
    }
    return BarcodeResult(
      value = value,
      format = format,
      valid = formatAllowed && checksumOk,
      checksumOk = checksumOk,
    )
  }
}
