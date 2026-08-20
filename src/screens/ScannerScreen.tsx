// Hooks: useState for screen data, useCallback to keep function identity stable,
// useEffect to run once after mount (here: already-granted camera check).
import React, { useCallback, useEffect, useState } from 'react';

import {
  PermissionsAndroid, // Android runtime CAMERA prompt (maps to Manifest.permission.CAMERA)
  Platform, // "android" | "ios" | ... so we skip the native view on iOS
  Pressable, // tappable view; like a button without default styling
  StyleSheet, // creates a StyleSheet id map (cheaper than inline objects)
  Text,
  View, // basic layout box (Yoga flexbox, not android.view.View directly)
  type NativeSyntheticEvent, // wrapper around events from native; payload is .nativeEvent
} from 'react-native';

// Notch / status bar / home indicator insets so HUD and buttons are not under the system UI.
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LatencyHud } from '../components/LatencyHud';
import { ResultPanel } from '../components/ResultPanel';
import { RoiOverlay } from '../components/RoiOverlay';

// RNLabelScannerView = CameraX PreviewView. LabelScanner = NativeModules methods.
import { LabelScanner, RNLabelScannerView } from '../native/LabelScanner';
import type { Roi, ScanResult, TemplateProfile } from '../types';
import { DEFAULT_ROI } from '../types';

// Props come from App.tsx: the JSON profile plus a callback to switch screens.
type Props = {
  template: TemplateProfile; // parsed pharma-label-v1.json (field names/labels)
  templateJson: string; // same profile as a string, pushed into Kotlin
  onOpenFixtures: () => void; // App sets screen to "fixtures"
};

export function ScannerScreen({
  template,
  templateJson,
  onOpenFixtures,
}: Props) {
  // { top, bottom, left, right } in dp. Used so overlays clear the status bar.
  const insets = useSafeAreaInsets();
  // Camera permission gate. "unknown" = not asked yet this session.
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>(
    'unknown',
  );
  // Green crop box. Changing this re-renders NativeView with a new `roi` prop.
  const [roi, setRoi] = useState<Roi>(DEFAULT_ROI);
  // Last ScanResult from Kotlin (barcode and/or OCR fields).
  const [result, setResult] = useState<ScanResult | null>(null);
  // Last barcode-path latency for the HUD (live stream).
  const [barcodeMs, setBarcodeMs] = useState<number | null>(null);
  // Last OCR-path latency for the HUD (capture button).
  const [ocrMs, setOcrMs] = useState<number | null>(null);
  // Native onScanError message, or a failed captureOcr() promise.
  const [error, setError] = useState<string | null>(null);

  // [] = this function is created once. Pressable can keep a stable onPress.
  const requestPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setPermission('denied');
      return;
    }
    // System dialog. Denied-forever still returns DENIED; user must use Settings.
    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera permission',
        message: 'Label Scanner needs the camera for barcode preview and OCR.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    setPermission(status === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
  }, []);

  // Run on first mount: if the user already allowed camera, skip the explainer.
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA).then(granted => {
      if (granted) {
        setPermission('granted');
      }
    });
  }, []);

  const handleScanResult = useCallback((event: NativeSyntheticEvent<ScanResult>) => {
    const next = event.nativeEvent; // ScanResult fields live here, not on `event` itself
    setResult(next);
    setError(null);
    if (next.source === 'ocr') {
      setOcrMs(next.latencyMs);
    } else {
      setBarcodeMs(next.latencyMs); // live barcode frames and fixtures
    }
  }, []);

  // Early return: do not mount CameraX until CAMERA is granted.
  if (permission !== 'granted') {
    return (
      <View style={[styles.permission, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.hero}>Android label scanner</Text>
        <Text style={styles.copy}>
          Camera preview and realtime barcodes run in a Kotlin CameraX + ML Kit
          module. OCR is a single shot inside the ROI you draw.
        </Text>
        <Pressable style={styles.primary} onPress={requestPermission}>
          <Text style={styles.primaryText}>Enable camera</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onOpenFixtures}>
          <Text style={styles.secondaryText}>Replay saved test images</Text>
        </Pressable>
        {permission === 'denied' ? (
          <Text style={styles.warn}>Camera permission is required for live scanning.</Text>
        ) : null}
      </View>
    );
  }

  // Local alias so TypeScript can narrow: iOS export is null.
  const NativeView = RNLabelScannerView;
  if (!NativeView) {
    return (
      <View style={styles.permission}>
        <Text style={styles.copy}>Native scanner view is Android-only.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* collapsable={false} keeps this View in the Android tree so PreviewView can layout. */}
      <View style={styles.camera} collapsable={false}>
        <NativeView
          style={StyleSheet.absoluteFill}
          roi={roi}
          templateJson={templateJson}
          scanningEnabled
          onScanResult={handleScanResult}
          onScanError={event => setError(event.nativeEvent.message)}
        />
      </View>
      {/* JS overlay on top of the preview. Drag/resize updates `roi` state. */}
      <RoiOverlay roi={roi} onChange={setRoi} />
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Text style={styles.profile}>{template.id}</Text>
      </View>
      <LatencyHud
        barcodeMs={barcodeMs}
        ocrMs={ocrMs}
        duplicate={Boolean(result?.duplicate)}
      />
      {/* Bottom sheet: results + actions. paddingBottom clears the home indicator. */}
      <View style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ResultPanel template={template} result={result} />
        <View style={styles.actions}>
          <Pressable
            style={styles.primary}
            onPress={() => {
              // Native module → LabelScannerView.captureOcr() (still + OCR, not the live stream).
              LabelScanner.captureOcr().catch(err =>
                setError(err instanceof Error ? err.message : String(err)),
              );
            }}>
            <Text style={styles.primaryText}>Single-shot OCR</Text>
          </Pressable>
          <Pressable style={styles.ghost} onPress={() => setRoi(DEFAULT_ROI)}>
            <Text style={styles.ghostText}>Reset ROI</Text>
          </Pressable>
          <Pressable style={styles.ghost} onPress={onOpenFixtures}>
            <Text style={styles.ghostText}>Fixtures</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Named styles. flex: 1 fills leftover space (camera grows; sheet stays at the bottom).
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05070A',
  },
  camera: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute', // drawn over the camera, not in the flex column
    left: 16,
  },
  profile: {
    color: '#00E5A0',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row', // OCR button + Reset + Fixtures on one row
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#121821',
  },
  primary: {
    flex: 1, // OCR button takes leftover width; ghost buttons stay hug-content
    backgroundColor: '#00E5A0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#04110C',
    fontWeight: '800',
  },
  ghost: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2A3644',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    color: '#D5DEE8',
    fontWeight: '600',
  },
  error: {
    color: '#FF8A80',
    backgroundColor: '#121821',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  permission: {
    flex: 1,
    backgroundColor: '#05070A',
    paddingHorizontal: 24,
    gap: 16,
  },
  hero: {
    color: '#F4F7FB',
    fontSize: 28,
    fontWeight: '800',
  },
  copy: {
    color: '#9AA8B8',
    fontSize: 16,
    lineHeight: 22,
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryText: {
    color: '#00E5A0',
    fontWeight: '700',
  },
  warn: {
    color: '#FFB020',
  },
});
