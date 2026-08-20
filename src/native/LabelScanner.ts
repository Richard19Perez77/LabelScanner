// NativeModules: call Kotlin @ReactMethod functions (like LabelScannerModule.captureOcr).
// Platform: "android" | "ios" | "windows" | "macos" | "web" — used to skip iOS here.
// requireNativeComponent: register a native ViewManager as a React component.
import { NativeModules, Platform, requireNativeComponent } from 'react-native';
// NativeSyntheticEvent: JS event wrapper. Real payload is on event.nativeEvent.
// ViewProps: style, testID, children, etc. Native views still accept these.
import type { NativeSyntheticEvent, ViewProps } from 'react-native';
// Roi = { left, top, right, bottom } in 0–1 view space.
// ScanResult = barcode + extracted fields + latency + duplicate flag.
import type { Roi, ScanResult } from '../types';

// Props the JS <RNLabelScannerView /> can pass into Kotlin LabelScannerViewManager.
type NativeProps = ViewProps & {
  // @ReactProp(name = "roi") on the ViewManager.
  roi: Roi;
  // @ReactProp(name = "templateJson") — JSON string of pharma-label-v1.json.
  templateJson: string;
  // @ReactProp(name = "scanningEnabled") — pause/resume the barcode analyzer.
  scanningEnabled: boolean;
  // Direct event "onScanResult". Kotlin emits; JS reads event.nativeEvent.
  onScanResult?: (event: NativeSyntheticEvent<ScanResult>) => void;
  // Direct event "onScanError" with { message }.
  onScanError?: (event: NativeSyntheticEvent<{ message: string }>) => void;
};

// The camera preview host. Name must match LabelScannerViewManager.REACT_CLASS.
export const RNLabelScannerView =
  Platform.OS === 'android'
    // Fabric looks up "RNLabelScannerView" and mounts LabelScannerView (CameraX PreviewView).
    ? requireNativeComponent<NativeProps>('RNLabelScannerView')
    // iOS has no native view. Cast keeps TypeScript happy; ScannerScreen checks null.
    : (null as unknown as ReturnType<typeof requireNativeComponent<NativeProps>>);

// Kotlin class LabelScannerModule, getName() = "LabelScannerModule".
// Undefined on iOS, or if MainApplication did not add LabelScannerPackage.
const NativeLabelScanner = NativeModules.LabelScannerModule as
  | {
      // ImageCapture still → ML Kit OCR inside the ROI.
      captureOcr: () => Promise<boolean>;
      // Decode a PNG from android assets/testdata (Fixtures screen, no camera).
      processTestImage: (
        assetName: string,
        templateJson: string,
      ) => Promise<ScanResult>;
      // List those PNG filenames from assets.
      listTestImages: () => Promise<string[]>;
      // Clear DuplicateSuppressor so the same barcode can emit again.
      resetDuplicateWindow: () => Promise<boolean>;
    }
  | undefined;

// Shared rejection when someone calls a method with no native module.
const unavailable = () =>
  Promise.reject(new Error('LabelScannerModule is only implemented on Android'));

// JS facade so screens never touch NativeModules.LabelScannerModule directly.
export const LabelScanner = {
  // ?. skips the call if the module is missing; ?? runs unavailable() instead.
  captureOcr: () => NativeLabelScanner?.captureOcr() ?? unavailable(),
  processTestImage: (assetName: string, templateJson: string) =>
    NativeLabelScanner?.processTestImage(assetName, templateJson) ?? unavailable(),
  listTestImages: () => NativeLabelScanner?.listTestImages() ?? unavailable(),
  resetDuplicateWindow: () =>
    NativeLabelScanner?.resetDuplicateWindow() ?? unavailable(),
  // True only when we are on Android and the package was registered.
  isAvailable: Platform.OS === 'android' && NativeLabelScanner != null,
};
