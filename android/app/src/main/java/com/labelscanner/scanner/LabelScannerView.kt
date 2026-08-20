package com.labelscanner.scanner

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.SystemClock
import android.util.Log
import android.widget.FrameLayout
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Native camera view shown from React Native.
 *
 * Live preview and barcode detection run here in Kotlin (CameraX + ML Kit).
 * JS only hosts this view and displays results. OCR still uses a still capture
 * ([captureOcr]), not the live analysis stream.
 *
 * Debugger note: attach Java only. Dual/Native (LLDB) can freeze CameraX.
 */
@SuppressLint("ViewConstructor")
class LabelScannerView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {
  // TextureView-based preview; more compatible with RN's layout than the default SurfaceView.
  private val previewView = PreviewView(reactContext).apply {
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    scaleType = PreviewView.ScaleType.FILL_CENTER
  }
  // CameraX analysis callback thread. Keep this short: copy the frame, close ImageProxy.
  private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  // ML Kit barcode work. Separate so analysis is not blocked while decoding.
  private val barcodeExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  private val pipeline = ScanPipeline()
  private var cameraProvider: ProcessCameraProvider? = null
  private var imageCapture: ImageCapture? = null
  private var barcodeClient: BarcodeScanner = BarcodeScanning.getClient()
  private val capturing = AtomicBoolean(false)
  private var lastFrameAt = 0L

  private var cameraStarted = false
  // RN Fabric can leave this view at 0x0. Force a measure/layout pass after requestLayout.
  private val measureAndLayout = Runnable {
    measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
    layout(left, top, right, bottom)
  }

  /** Scan window in 0–1 view coordinates (left, top, right, bottom). */
  var roi: NormalizedRoi = NormalizedRoi(0.08f, 0.22f, 0.92f, 0.78f)
  var scanningEnabled: Boolean = true
  var template: TemplateProfile = TemplateProfile.parse(DEFAULT_TEMPLATE_JSON)

  init {
    addView(previewView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    pipeline.applyTemplate(template)
    current = this
  }

  override fun requestLayout() {
    super.requestLayout()
    post(measureAndLayout)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    current = this
    cameraStarted = false
    // Wait one frame so width/height are usually non-zero before CameraX bind.
    post { startCamera() }
  }

  override fun onDetachedFromWindow() {
    if (current === this) {
      current = null
    }
    stopCamera()
    cameraStarted = false
    super.onDetachedFromWindow()
  }

  /** JS sent a new template JSON: rebuild validators and ML Kit format filter. */
  fun applyTemplateJson(json: String) {
    template = TemplateProfile.parse(json)
    pipeline.applyTemplate(template)
    barcodeClient.close()
    barcodeClient = BarcodeScanning.getClient(
      BarcodeScannerOptions.Builder()
        .setBarcodeFormats(MlKitFormats.flags(template.barcode.formats))
        .build(),
    )
  }

  private fun startCamera() {
    if (cameraStarted) {
      return
    }
    if (width <= 0 || height <= 0) {
      Log.w(TAG, "Preview still 0x0, retrying camera start")
      post { startCamera() }
      return
    }
    // CameraX bind needs the Activity as LifecycleOwner (pause/resume/destroy).
    val activity = reactContext.currentActivity as? LifecycleOwner
    if (activity == null) {
      Log.w(TAG, "No activity yet, retrying camera start")
      postDelayed({ startCamera() }, 200)
      return
    }
    val future = ProcessCameraProvider.getInstance(reactContext)
    future.addListener(
      {
        try {
          val provider = future.get()
          provider.unbindAll()
          val preview = Preview.Builder().build().also { previewUseCase ->
            previewUseCase.surfaceProvider = previewView.surfaceProvider
          }
          // Drop old frames if ML Kit is slow; we only need the latest image.
          val analysis = ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also { it.setAnalyzer(analysisExecutor, ::analyzeFrame) }
          imageCapture = ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .build()
          provider.bindToLifecycle(
            activity,
            CameraSelector.DEFAULT_BACK_CAMERA,
            preview,
            analysis,
            imageCapture,
          )
          cameraProvider = provider
          cameraStarted = true
          Log.i(TAG, "Camera bound ${width}x${height}")
        } catch (error: Exception) {
          Log.e(TAG, "Failed to start camera", error)
          emitError(error.message ?: "Failed to start camera")
        }
      },
      ContextCompat.getMainExecutor(reactContext),
    )
  }

  private fun stopCamera() {
    cameraProvider?.unbindAll()
  }

  /**
   * Live barcode path. Always close [imageProxy] before async ML Kit work so CameraX
   * can keep producing frames (holding it across a debugger pause freezes preview).
   */
  private fun analyzeFrame(imageProxy: ImageProxy) {
    if (!scanningEnabled) {
      imageProxy.close()
      return
    }
    val now = SystemClock.elapsedRealtime()
    // ~8 fps cap so we do not flood ML Kit / JS with every camera frame.
    if (now - lastFrameAt < 120L) {
      imageProxy.close()
      return
    }
    lastFrameAt = now
    val rotation = imageProxy.imageInfo.rotationDegrees
    val frameWidth = imageProxy.width
    val frameHeight = imageProxy.height
    val (uprightWidth, uprightHeight) = RoiCropper.uprightSize(
      frameWidth,
      frameHeight,
      rotation,
    )
    val roiRect = RoiCropper.toPixelRect(roi, uprightWidth, uprightHeight)
    val bitmap: Bitmap
    try {
      bitmap = imageProxy.toBitmap()
    } catch (error: Exception) {
      Log.w(TAG, "Failed to copy analysis frame", error)
      imageProxy.close()
      return
    }
    imageProxy.close()
    val input = InputImage.fromBitmap(bitmap, rotation)
    barcodeClient.process(input)
      .addOnSuccessListener(barcodeExecutor) { codes ->
        // First barcode that has text and overlaps the on-screen ROI.
        val hit = codes.firstOrNull { code ->
          !code.rawValue.isNullOrBlank() && RoiCropper.intersects(roiRect, code.boundingBox)
        } ?: return@addOnSuccessListener
        val barcode = Validators.validateBarcode(
          value = hit.rawValue.orEmpty(),
          format = MlKitFormats.name(hit.format),
          spec = template.barcode,
        )
        // Live barcode events do not run OCR; fields/rawText stay empty until captureOcr().
        val dto = ScanResultDto(
          source = "barcode",
          duplicate = false,
          latencyMs = SystemClock.elapsedRealtime() - now,
          barcode = barcode,
          fields = emptyList(),
          rawText = null,
        )
        val duplicate = pipeline.suppressor.isDuplicate(
          dto.duplicateKey(),
          SystemClock.elapsedRealtime(),
        )
        emitResult(dto.copy(duplicate = duplicate))
        logBarcodeGathered(
          codesInFrame = codes.size,
          hit = hit,
          roiRect = roiRect,
          frameWidth = frameWidth,
          frameHeight = frameHeight,
          uprightWidth = uprightWidth,
          uprightHeight = uprightHeight,
          rotation = rotation,
          barcode = barcode,
          dto = dto,
          duplicate = duplicate,
        )
      }
      .addOnFailureListener(barcodeExecutor) { error ->
        Log.w(TAG, "Barcode analysis failed", error)
      }
      .addOnCompleteListener { bitmap.recycle() }
  }

  fun resetDuplicates() {
    pipeline.suppressor.reset()
  }

  /** Still photo + OCR pipeline (lot, expiry, etc.). Heavier than live barcodes. */
  fun captureOcr() {
    val capture = imageCapture
    if (capture == null) {
      emitError("Camera is not ready")
      return
    }
    if (!capturing.compareAndSet(false, true)) {
      return
    }
    capture.takePicture(
      analysisExecutor,
      object : ImageCapture.OnImageCapturedCallback() {
        override fun onCaptureSuccess(image: ImageProxy) {
          try {
            val bitmap: Bitmap = image.toBitmap()
            val result = pipeline.processBitmap(
              bitmap = bitmap,
              roi = roi,
              template = template,
              source = "ocr",
              includeOcr = true,
            )
            emitResult(result)
          } catch (error: Exception) {
            emitError(error.message ?: "OCR failed")
          } finally {
            image.close()
            capturing.set(false)
          }
        }

        override fun onError(exception: ImageCaptureException) {
          capturing.set(false)
          emitError(exception.message ?: "Capture failed")
        }
      },
    )
  }

  fun emitResult(result: ScanResultDto) {
    Log.d(
      TAG,
      "onScanResult source=${result.source} barcode=${result.barcode?.value} " +
        "format=${result.barcode?.format} valid=${result.barcode?.valid} " +
        "duplicate=${result.duplicate} latencyMs=${result.latencyMs}",
    )
    post { dispatch("onScanResult", result.toWritableMap()) }
  }

  /** Verbose ML Kit dump. Filter Logcat by [TAG] (`LabelScannerView`). */
  private fun logBarcodeGathered(
    codesInFrame: Int,
    hit: Barcode,
    roiRect: Rect,
    frameWidth: Int,
    frameHeight: Int,
    uprightWidth: Int,
    uprightHeight: Int,
    rotation: Int,
    barcode: BarcodeResult,
    dto: ScanResultDto,
    duplicate: Boolean,
  ) {
    val box = hit.boundingBox
    val corners = hit.cornerPoints?.joinToString { "(${it.x},${it.y})" }
    Log.d(TAG, "barcode codesInFrame=$codesInFrame")
    Log.d(TAG, "barcode rotationDeg=$rotation frame=${frameWidth}x${frameHeight} upright=${uprightWidth}x${uprightHeight}")
    Log.d(TAG, "barcode roi=$roiRect")
    Log.d(TAG, "barcode rawValue=${hit.rawValue}")
    Log.d(TAG, "barcode displayValue=${hit.displayValue}")
    Log.d(TAG, "barcode format=${MlKitFormats.name(hit.format)} (${hit.format})")
    Log.d(TAG, "barcode valueType=${mlKitValueTypeName(hit.valueType)} (${hit.valueType})")
    Log.d(TAG, "barcode boundingBox=$box")
    Log.d(TAG, "barcode cornerPoints=$corners")
    hit.url?.let { Log.d(TAG, "barcode urlBookmark title=${it.title} url=${it.url}") }
    hit.wifi?.let {
      Log.d(TAG, "barcode wifi ssid=${it.ssid} password=${it.password} encryptionType=${it.encryptionType}")
    }
    hit.email?.let {
      Log.d(TAG, "barcode email address=${it.address} subject=${it.subject} body=${it.body} type=${it.type}")
    }
    hit.phone?.let { Log.d(TAG, "barcode phone number=${it.number} type=${it.type}") }
    hit.sms?.let { Log.d(TAG, "barcode sms phoneNumber=${it.phoneNumber} message=${it.message}") }
    hit.geoPoint?.let { Log.d(TAG, "barcode geo lat=${it.lat} lng=${it.lng}") }
    hit.contactInfo?.let {
      Log.d(TAG, "barcode contact name=${it.name?.formattedName} org=${it.organization} title=${it.title}")
    }
    hit.calendarEvent?.let {
      Log.d(TAG, "barcode calendar summary=${it.summary} description=${it.description} location=${it.location}")
    }
    hit.driverLicense?.let {
      Log.d(
        TAG,
        "barcode driverLicense ${it.licenseNumber} ${it.firstName} ${it.lastName} ${it.expiryDate}",
      )
    }
    Log.d(
      TAG,
      "barcode validated value=${barcode.value} format=${barcode.format} valid=${barcode.valid} checksumOk=${barcode.checksumOk}",
    )
    Log.d(
      TAG,
      "dto source=${dto.source} duplicate=$duplicate latencyMs=${dto.latencyMs} rawText=${dto.rawText} fields=${dto.fields}",
    )
  }

  private fun mlKitValueTypeName(valueType: Int): String {
    return when (valueType) {
      Barcode.TYPE_CONTACT_INFO -> "CONTACT_INFO"
      Barcode.TYPE_EMAIL -> "EMAIL"
      Barcode.TYPE_ISBN -> "ISBN"
      Barcode.TYPE_PHONE -> "PHONE"
      Barcode.TYPE_PRODUCT -> "PRODUCT"
      Barcode.TYPE_SMS -> "SMS"
      Barcode.TYPE_TEXT -> "TEXT"
      Barcode.TYPE_URL -> "URL"
      Barcode.TYPE_WIFI -> "WIFI"
      Barcode.TYPE_GEO -> "GEO"
      Barcode.TYPE_CALENDAR_EVENT -> "CALENDAR_EVENT"
      Barcode.TYPE_DRIVER_LICENSE -> "DRIVER_LICENSE"
      else -> "UNKNOWN"
    }
  }

  fun emitError(message: String) {
    post {
      val map = Arguments.createMap()
      map.putString("message", message)
      dispatch("onScanError", map)
    }
  }

  /** Fabric event to JS (`onScanResult` / `onScanError` on the native view). */
  private fun dispatch(eventName: String, payload: WritableMap) {
    val surfaceId = UIManagerHelper.getSurfaceId(this)
    val dispatcher = UIManagerHelper.getEventDispatcher(reactContext)
    dispatcher?.dispatchEvent(ScannerDirectEvent(surfaceId, id, eventName, payload))
  }

  fun release() {
    stopCamera()
    barcodeClient.close()
    pipeline.close()
    analysisExecutor.shutdown()
    barcodeExecutor.shutdown()
  }

  companion object {
    private const val TAG = "LabelScannerView"
    /** Last mounted scanner; used by the native module for capture / template from JS. */
    @Volatile
    var current: LabelScannerView? = null

    /** Fallback template if JS has not sent one yet. Mirrors src/templates/pharma-label-v1.json. */
    const val DEFAULT_TEMPLATE_JSON = """
      {"id":"pharma-label-v1","name":"Pharmaceutical bottle label","duplicateWindowMs":1500,
       "barcode":{"formats":["EAN_13","CODE_128","QR_CODE"],"checksum":"ean13"},
       "fields":[{"name":"lotNumber","label":"Lot Number","anchors":["LOT","BATCH","LOT NO"],
       "regex":"^[A-Z0-9]{6,12}$","checksum":"none"},{"name":"expiryDate","label":"Expiry Date",
       "anchors":["EXP","EXPIRY","USE BY","EXP DATE"],
       "regex":"^(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])/20[2-9][0-9]$","checksum":"none"}]}
    """
  }
}

/** RN Fabric event wrapper; [name] is the JS prop (`onScanResult` or `onScanError`). */
private class ScannerDirectEvent(
  surfaceId: Int,
  viewId: Int,
  private val name: String,
  private val payload: WritableMap,
) : Event<ScannerDirectEvent>(surfaceId, viewId) {
  override fun getEventName(): String = name
  override fun getEventData(): WritableMap = payload
}
