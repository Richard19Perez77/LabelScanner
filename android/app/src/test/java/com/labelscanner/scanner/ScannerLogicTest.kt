package com.labelscanner.scanner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ValidatorsTest {
  @Test
  fun ean13AcceptsKnownCheckDigit() {
    assertTrue(Validators.ean13ChecksumValid("5901234123457"))
  }

  @Test
  fun ean13RejectsWrongCheckDigit() {
    assertFalse(Validators.ean13ChecksumValid("5901234123450"))
  }

  @Test
  fun qrCodeSkipsEan13ChecksumEvenWhenTemplateRequestsIt() {
    val spec = BarcodeSpec(listOf("EAN_13", "QR_CODE"), "ean13")
    val result = Validators.validateBarcode("https://example.com/pair", "QR_CODE", spec)
    assertTrue(result.valid)
    assertTrue(result.checksumOk)
  }

  @Test
  fun ean13StillChecksumsWhenTemplateRequestsIt() {
    val spec = BarcodeSpec(listOf("EAN_13", "QR_CODE"), "ean13")
    val bad = Validators.validateBarcode("5901234123450", "EAN_13", spec)
    assertFalse(bad.valid)
    assertFalse(bad.checksumOk)
  }

  @Test
  fun lotRegexAcceptsCanonicalLot() {
    val spec = FieldSpec("lotNumber", "Lot Number", listOf("LOT"), "^[A-Z0-9]{6,12}$", "none")
    val result = Validators.validateField(spec, "abc1234")
    assertTrue(result.valid)
    assertEquals("ABC1234", result.value)
  }

  @Test
  fun lotRegexRejectsSymbols() {
    val spec = FieldSpec("lotNumber", "Lot Number", listOf("LOT"), "^[A-Z0-9]{6,12}$", "none")
    assertFalse(Validators.validateField(spec, "ab#12").valid)
  }
}

class DuplicateSuppressorTest {
  @Test
  fun suppressesSameKeyInsideWindow() {
    val suppressor = DuplicateSuppressor(1500)
    assertFalse(suppressor.isDuplicate("A", 0))
    assertTrue(suppressor.isDuplicate("A", 500))
    assertFalse(suppressor.isDuplicate("A", 1600))
  }

  @Test
  fun differentKeyAlwaysEmits() {
    val suppressor = DuplicateSuppressor(1500)
    assertFalse(suppressor.isDuplicate("A", 0))
    assertFalse(suppressor.isDuplicate("B", 10))
  }
}

class FieldExtractorTest {
  private val template = TemplateProfile.parse(
    """
    {"id":"pharma-label-v1","name":"Pharmaceutical bottle label","duplicateWindowMs":1500,
     "barcode":{"formats":["EAN_13"],"checksum":"ean13"},
     "fields":[{"name":"lotNumber","label":"Lot Number","anchors":["LOT","BATCH"],
     "regex":"^[A-Z0-9]{6,12}$","checksum":"none"},{"name":"expiryDate","label":"Expiry Date",
     "anchors":["EXP","EXPIRY"],"regex":"^(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])/20[2-9][0-9]$",
     "checksum":"none"}]}
    """.trimIndent(),
  )

  @Test
  fun extractsLotAndExpiryFromAnchoredLines() {
    val blocks = listOf(
      OcrBlock("ACME PHARMA", 10, 10, 400, 50),
      OcrBlock("LOT ABC1234", 10, 80, 300, 120),
      OcrBlock("EXP 12/31/2027", 10, 140, 320, 180),
    )
    val fields = FieldExtractor.extractAll(blocks, template).associateBy { it.name }
    assertEquals("ABC1234", fields.getValue("lotNumber").value)
    assertTrue(fields.getValue("lotNumber").valid)
    assertEquals("12/31/2027", fields.getValue("expiryDate").value)
    assertTrue(fields.getValue("expiryDate").valid)
  }
}

class RoiCropperTest {
  @Test
  fun mapsNormalizedRoiToPixels() {
    val rect = RoiCropper.toPixelRect(NormalizedRoi(0.1f, 0.2f, 0.6f, 0.8f), 1000, 500)
    assertEquals(100, rect.left)
    assertEquals(100, rect.top)
    assertEquals(600, rect.right)
    assertEquals(400, rect.bottom)
  }
}
