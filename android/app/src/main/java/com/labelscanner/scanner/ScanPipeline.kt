package com.labelscanner.scanner

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.SystemClock
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.concurrent.TimeUnit

/**
 * 
 * Turns one still image into a [ScanResultDto]. [processBitmap] crops to the ROI,
 * runs ML Kit barcode (and optional Latin OCR), then [FieldExtractor] plus
 * [Validators] fill lot/expiry and checksums, [DuplicateSuppressor] marks repeats,
 * and [latencyMs] is elapsed time for that still. 
 * 
 * Live preview barcodes skip this class and stay in [LabelScannerView]; OCR captures and fixture PNGs come through
 * here. 
 * 
 * [applyTemplate] rebuilds the barcode client when formats change; [loadAssetBitmap] decodes testdata from assets.
 * 
 */
class ScanPipeline {
    
    // OCR client
    private val textClient: TextRecognizer =
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    
    // Barcode client
    private var barcodeClient: BarcodeScanner = 
        BarcodeScanning.getClient()

    // Signature of the barcode formats
    private var barcodeFormatsSignature: String? = null

    // Duplicate suppressor
    val suppressor = DuplicateSuppressor()

    init {
        // Log the init of the scan pipeline.
        ScanLog.enter("ScanPipeline.init")
    }

    /**
     * Applies the template to the scan pipeline.
     */
    fun applyTemplate(template: TemplateProfile) {
        // Log the apply template of the scan pipeline.
        ScanLog.enter("ScanPipeline.applyTemplate")
        suppressor.windowMs = template.duplicateWindowMs
        val signature = template.barcode.formats.sorted().joinToString(",")
        if (signature != barcodeFormatsSignature) {
            barcodeClient.close()
            barcodeClient = BarcodeScanning.getClient(
                BarcodeScannerOptions.Builder()
                    .setBarcodeFormats(MlKitFormats.flags(template.barcode.formats))
                    .build(),
            )
            barcodeFormatsSignature = signature
        }
    }

    fun processBitmap(
        bitmap: Bitmap,
        roi: NormalizedRoi,
        template: TemplateProfile,
        source: String,
        includeOcr: Boolean,
    ): ScanResultDto {
        ScanLog.enter("ScanPipeline.processBitmap")
        applyTemplate(template)
        val startedAt = SystemClock.elapsedRealtime()
        val cropped = RoiCropper.crop(bitmap, roi)
        val image = InputImage.fromBitmap(cropped, 0)

        val barcodes = Tasks.await(barcodeClient.process(image), 4, TimeUnit.SECONDS)
        val barcode = barcodes.firstOrNull { !it.rawValue.isNullOrBlank() }?.let { code ->
            Validators.validateBarcode(
                value = code.rawValue.orEmpty(),
                format = MlKitFormats.name(code.format),
                spec = template.barcode,
            )
        }

        val text = if (includeOcr) {
            Tasks.await(textClient.process(image), 6, TimeUnit.SECONDS)
        } else {
            null
        }
        val blocks = text?.textBlocks?.map { block ->
            val box = block.boundingBox
            OcrBlock(
                text = block.text,
                left = box?.left ?: 0,
                top = box?.top ?: 0,
                right = box?.right ?: 0,
                bottom = box?.bottom ?: 0,
            )
        } ?: emptyList()
        val fields = if (includeOcr) FieldExtractor.extractAll(blocks, template) else emptyList()
        val rawText = text?.text

        val dto = ScanResultDto(
            source = source,
            duplicate = false,
            latencyMs = SystemClock.elapsedRealtime() - startedAt,
            barcode = barcode,
            fields = fields,
            rawText = rawText,
        )
        val duplicate = suppressor.isDuplicate(dto.duplicateKey(), SystemClock.elapsedRealtime())
        return dto.copy(duplicate = duplicate)
    }

    fun loadAssetBitmap(context: Context, assetPath: String): Bitmap {
        ScanLog.enter("ScanPipeline.loadAssetBitmap")
        context.assets.open(assetPath).use { stream ->
            return BitmapFactory.decodeStream(stream)
                ?: throw IllegalStateException("Could not decode $assetPath")
        }
    }

    fun close() {
        ScanLog.enter("ScanPipeline.close")
        barcodeClient.close()
        textClient.close()
    }
}
