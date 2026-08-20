/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('../src/native/LabelScanner', () => {
  const { View } = require('react-native');
  return {
    RNLabelScannerView: View,
    LabelScanner: {
      captureOcr: jest.fn(async () => true),
      processTestImage: jest.fn(async () => ({
        source: 'fixture',
        duplicate: false,
        latencyMs: 12,
        barcode: null,
        fields: [],
        rawText: '',
      })),
      listTestImages: jest.fn(async () => []),
      resetDuplicateWindow: jest.fn(async () => true),
      isAvailable: true,
    },
  };
});

import App from '../App';

test('renders the permission / entry screen', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
