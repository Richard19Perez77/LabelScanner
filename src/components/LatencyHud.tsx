import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  barcodeMs: number | null;
  ocrMs: number | null;
  duplicate: boolean;
};

export function LatencyHud({ barcodeMs, ocrMs, duplicate }: Props) {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.mono}>
        BARCODE {barcodeMs == null ? '—' : `${Math.round(barcodeMs)} ms`}
      </Text>
      <Text style={styles.mono}>
        OCR {ocrMs == null ? '—' : `${Math.round(ocrMs)} ms`}
      </Text>
      {duplicate ? <Text style={styles.dup}>DUPLICATE SUPPRESSED</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(8, 12, 18, 0.78)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  mono: {
    color: '#D7FFE9',
    fontFamily: 'monospace',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  dup: {
    color: '#FFB020',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
});
