// Shared TS shapes for the RN UI and the JSON that Kotlin also parses.
// Kotlin mirrors these in ScanModels.kt (NormalizedRoi, ScanResultDto, TemplateProfile).

// Camera crop box, normalized to the preview view (0 = left/top edge, 1 = right/bottom).
// Passed as the `roi` prop into RNLabelScannerView; Kotlin maps it onto the image.
export type Roi = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

// One barcode hit from ML Kit, after regex/format + EAN-13 check digit.
export type BarcodeResult = {
  value: string; // raw payload, e.g. "5901234123457"
  format: string; // "EAN_13" | "CODE_128" | "QR_CODE" | ...
  valid: boolean; // format allowed by the template AND checksumOk
  checksumOk: boolean; // GS1 EAN-13 check digit; true if checksum is not required
};

// One named field pulled from OCR text (lotNumber, expiryDate).
export type ExtractedField = {
  name: string; // template field id, e.g. "lotNumber"
  value: string | null; // extracted token, or null if not found
  valid: boolean; // matches field.regex (and checksum if any)
  reason: string | null; // "not found" | "regex mismatch" | "checksum failed"
};

// One emit from Kotlin: live barcode, OCR button, or fixture PNG.
export type ScanResult = {
  source: 'barcode' | 'ocr' | 'fixture';
  duplicate: boolean; // true if DuplicateSuppressor dropped a repeat within the window
  latencyMs: number; // SystemClock.elapsedRealtime() from start of work to emit
  barcode: BarcodeResult | null; // null on OCR-only frames with no code in the ROI
  fields: ExtractedField[]; // empty for live barcode frames (OCR is single-shot)
  rawText: string | null; // full ML Kit transcript; useful when debugging fixtures
};

// One field inside the JSON template (see pharma-label-v1.json).
export type FieldSpec = {
  name: string; // machine id used in ExtractedField.name
  label: string; // UI label in ResultPanel
  anchors: string[]; // OCR keywords to hunt, e.g. ["LOT", "BATCH"]
  regex: string; // JS/Kotlin regex the value must match
  checksum: string; // "none" or "ean13"
};

// Whole JSON profile. JS stringifies this and Kotlin TemplateProfile.parse() reads it.
export type TemplateProfile = {
  id: string;
  name: string;
  duplicateWindowMs: number; // cooldown before the same barcode/fields can emit again
  barcode: {
    formats: string[]; // ML Kit formats to enable
    checksum: string; // "ean13" runs the GS1 check digit on EAN-13 values
  };
  fields: FieldSpec[]; // this app extracts exactly two: lot + expiry
};

// Starting ROI: inset rectangle so the user has a visible box to drag.
export const DEFAULT_ROI: Roi = {
  left: 0.08,
  top: 0.22,
  right: 0.92,
  bottom: 0.78,
};
