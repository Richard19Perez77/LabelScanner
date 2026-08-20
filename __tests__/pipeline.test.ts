import profile from '../src/templates/pharma-label-v1.json';
import {
  DuplicateSuppressor,
  ean13ChecksumValid,
  extractFields,
  matchesRegex,
} from '../src/pipeline/parity';

describe('JSON template profile', () => {
  it('declares exactly two named fields', () => {
    expect(profile.fields.map(field => field.name)).toEqual([
      'lotNumber',
      'expiryDate',
    ]);
  });
});

describe('regex and checksum validation', () => {
  it('accepts a canonical EAN-13 check digit', () => {
    expect(ean13ChecksumValid('5901234123457')).toBe(true);
  });

  it('rejects a tampered EAN-13 check digit', () => {
    expect(ean13ChecksumValid('5901234123450')).toBe(false);
  });

  it('accepts lot numbers from the template regex', () => {
    expect(matchesRegex('ABC1234', profile.fields[0].regex)).toBe(true);
    expect(matchesRegex('AB#12', profile.fields[0].regex)).toBe(false);
  });
});

describe('field extraction', () => {
  it('reads LOT and EXP from anchored lines', () => {
    const fields = extractFields('ACME PHARMA\nLOT ABC1234\nEXP 12/31/2027', profile.fields);
    expect(fields.find(field => field.name === 'lotNumber')).toMatchObject({
      value: 'ABC1234',
      valid: true,
    });
    expect(fields.find(field => field.name === 'expiryDate')).toMatchObject({
      value: '12/31/2027',
      valid: true,
    });
  });
});

describe('duplicate-result suppression', () => {
  it('drops the same key inside the template window', () => {
    const suppressor = new DuplicateSuppressor(profile.duplicateWindowMs);
    expect(suppressor.isDuplicate('ABC', 0)).toBe(false);
    expect(suppressor.isDuplicate('ABC', 400)).toBe(true);
    expect(suppressor.isDuplicate('ABC', 1600)).toBe(false);
  });
});
