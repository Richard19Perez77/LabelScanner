import React, { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScanResult, TemplateProfile } from '../types';

type Props = {
  template: TemplateProfile;
  result: ScanResult | null;
};

function httpUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function ResultPanel({ template, result }: Props) {
  const barcodeValue = result?.barcode?.value;
  const url = httpUrl(barcodeValue);

  const openInBrowser = useCallback(() => {
    if (!url) {
      return;
    }
    Linking.openURL(url).catch(() => {
      // Ignore; Android still opens http(s) via the default browser in most cases.
    });
  }, [url]);

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{template.name}</Text>
      <Text style={styles.title}>Extracted fields</Text>
      {template.fields.map(field => {
        const match = result?.fields.find(item => item.name === field.name);
        return (
          <View key={field.name} style={styles.row}>
            <Text style={styles.label}>{field.label}</Text>
            <Text style={styles.value}>{match?.value ?? '—'}</Text>
            <Status valid={match?.valid} empty={!match?.value} />
          </View>
        );
      })}
      <View style={styles.row}>
        <Text style={styles.label}>Barcode</Text>
        {url ? (
          <Pressable style={styles.valuePress} onPress={openInBrowser}>
            <Text style={styles.link}>{barcodeValue}</Text>
          </Pressable>
        ) : (
          <Text style={styles.value}>{barcodeValue ?? '—'}</Text>
        )}
        <Status
          valid={result?.barcode?.valid}
          empty={!barcodeValue}
        />
      </View>
      {url ? (
        <Text style={styles.hint}>Tap the URL to open it in the default browser</Text>
      ) : null}
      {result?.barcode && !result.barcode.checksumOk ? (
        <Text style={styles.hint}>EAN-13 checksum failed</Text>
      ) : null}
    </View>
  );
}

function Status({ valid, empty }: { valid?: boolean; empty: boolean }) {
  const label = empty ? 'WAIT' : valid ? 'OK' : 'FAIL';
  const color = empty ? '#7A8899' : valid ? '#00E5A0' : '#FF5C5C';
  return <Text style={[styles.badge, { color }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#121821',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  kicker: {
    color: '#7A8899',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F4F7FB',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    width: 96,
    color: '#9AA8B8',
    fontSize: 13,
  },
  value: {
    flex: 1,
    color: '#F4F7FB',
    fontFamily: 'monospace',
    fontSize: 14,
  },
  valuePress: {
    flex: 1,
  },
  link: {
    color: '#7EB6FF',
    fontFamily: 'monospace',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  badge: {
    fontSize: 12,
    fontWeight: '800',
    width: 40,
    textAlign: 'right',
  },
  hint: {
    color: '#FF8A80',
    fontSize: 12,
  },
});
