import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LabelScanner, startup } from '../native/LabelScanner';
import type { ScanResult, TemplateProfile } from '../types';
import invalidEan from '../../testdata/expected/invalid-ean-checksum.json';
import invalidLot from '../../testdata/expected/invalid-lot-regex.json';
import validLabel from '../../testdata/expected/valid-pharma-label.json';
import duplicateLabel from '../../testdata/expected/duplicate-of-valid.json';

type FixtureSpec = {
  file: string;
  title: string;
  expected: typeof validLabel;
  image: number;
};

const FIXTURES: FixtureSpec[] = [
  {
    file: 'valid-pharma-label.png',
    title: 'Valid lot, expiry, EAN-13',
    expected: validLabel,
    image: require('../../testdata/images/valid-pharma-label.png'),
  },
  {
    file: 'invalid-lot-regex.png',
    title: 'Lot fails regex',
    expected: invalidLot,
    image: require('../../testdata/images/invalid-lot-regex.png'),
  },
  {
    file: 'invalid-ean-checksum.png',
    title: 'EAN-13 checksum fails',
    expected: invalidEan,
    image: require('../../testdata/images/invalid-ean-checksum.png'),
  },
  {
    file: 'duplicate-of-valid.png',
    title: 'Same payload as valid (suppression)',
    expected: duplicateLabel,
    image: require('../../testdata/images/duplicate-of-valid.png'),
  },
];

type Props = {
  templateJson: string;
  template: TemplateProfile;
  onBack: () => void;
};

type RunState = {
  actual?: ScanResult;
  error?: string;
};

export function FixturesScreen({ templateJson, template, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => {
    const values = FIXTURES.map(fixture => grade(fixture, runs[fixture.file]));
    return {
      passed: values.filter(Boolean).length,
      total: FIXTURES.length,
    };
  }, [runs]);

  const runOne = async (file: string) => {
    startup('FixturesScreen.runOne');
    try {
      const actual = await LabelScanner.processTestImage(file, templateJson);
      setRuns(current => ({ ...current, [file]: { actual } }));
    } catch (error) {
      setRuns(current => ({
        ...current,
        [file]: { error: error instanceof Error ? error.message : String(error) },
      }));
    }
  };

  const runAll = async () => {
    startup('FixturesScreen.runAll');
    setBusy(true);
    await LabelScanner.resetDuplicateWindow();
    for (const fixture of FIXTURES) {
      await runOne(fixture.file);
    }
    setBusy(false);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 16,
        gap: 12,
      }}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Scanner</Text>
      </Pressable>
      <Text style={styles.title}>Saved test images</Text>
      <Text style={styles.copy}>
        Each PNG in testdata/images has an expected JSON result. The Kotlin module
        runs barcode + OCR on the asset so you can review extraction without a
        printed label.
      </Text>
      <Pressable style={styles.primary} onPress={runAll} disabled={busy}>
        <Text style={styles.primaryText}>
          {busy ? 'Running…' : `Run all fixtures (${summary.passed}/${summary.total})`}
        </Text>
      </Pressable>
      {FIXTURES.map(fixture => {
        const run = runs[fixture.file];
        const ok = grade(fixture, run);
        return (
          <View key={fixture.file} style={styles.card}>
            <Image source={fixture.image} style={styles.preview} resizeMode="contain" />
            <Text style={styles.cardTitle}>{fixture.title}</Text>
            <Text style={styles.file}>{fixture.file}</Text>
            <Text style={styles.expected}>
              expect LOT {fixture.expected.fields.lotNumber.value} · EXP{' '}
              {fixture.expected.fields.expiryDate.value} · EAN{' '}
              {fixture.expected.barcode.value}
            </Text>
            {run?.actual ? (
              <Text style={[styles.actual, { color: ok ? '#00E5A0' : '#FFB020' }]}>
                actual LOT {fieldValue(run.actual, 'lotNumber')} · EXP{' '}
                {fieldValue(run.actual, 'expiryDate')} · EAN{' '}
                {run.actual.barcode?.value ?? '—'} · {Math.round(run.actual.latencyMs)} ms
                {run.actual.duplicate ? ' · duplicate' : ''}
              </Text>
            ) : null}
            {run?.error ? <Text style={styles.error}>{run.error}</Text> : null}
            <Pressable style={styles.ghost} onPress={() => runOne(fixture.file)}>
              <Text style={styles.ghostText}>Run {template.id}</Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

function fieldValue(result: ScanResult, name: string): string {
  return result.fields.find(field => field.name === name)?.value ?? '—';
}

function grade(fixture: FixtureSpec, run?: RunState): boolean {
  if (!run?.actual) {
    return false;
  }
  const lot = fieldValue(run.actual, 'lotNumber');
  const exp = fieldValue(run.actual, 'expiryDate');
  const barcode = run.actual.barcode?.value ?? null;
  const lotOk = lot === fixture.expected.fields.lotNumber.value;
  const expOk = exp === fixture.expected.fields.expiryDate.value;
  const barcodeOk = barcode === fixture.expected.barcode.value;
  const lotValid =
    run.actual.fields.find(field => field.name === 'lotNumber')?.valid ===
    fixture.expected.fields.lotNumber.valid;
  const barcodeValid =
    Boolean(run.actual.barcode?.valid) === fixture.expected.barcode.valid;
  return lotOk && expOk && barcodeOk && lotValid && barcodeValid;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05070A',
  },
  back: {
    color: '#00E5A0',
    fontWeight: '700',
  },
  title: {
    color: '#F4F7FB',
    fontSize: 26,
    fontWeight: '800',
  },
  copy: {
    color: '#9AA8B8',
    lineHeight: 20,
  },
  primary: {
    backgroundColor: '#00E5A0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#04110C',
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#121821',
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  preview: {
    width: '100%',
    height: 140,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  cardTitle: {
    color: '#F4F7FB',
    fontWeight: '700',
    fontSize: 16,
  },
  file: {
    color: '#7A8899',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  expected: {
    color: '#9AA8B8',
    fontSize: 12,
  },
  actual: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  error: {
    color: '#FF8A80',
  },
  ghost: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2A3644',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  ghostText: {
    color: '#D5DEE8',
  },
});
