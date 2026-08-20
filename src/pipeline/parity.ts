/**
 * Parity helpers for Jest. Production scanning runs in Kotlin
 * (see android/.../scanner). Keep these algorithms aligned with Validators.kt,
 * FieldExtractor.kt, and DuplicateSuppressor.kt.
 */

export function ean13ChecksumValid(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 13) {
    return false;
  }
  const numbers = digits.split('').map(Number);
  const sum = numbers.slice(0, 12).reduce((total, digit, index) => {
    return total + (index % 2 === 0 ? digit : digit * 3);
  }, 0);
  const check = (10 - (sum % 10)) % 10;
  return check === numbers[12];
}

export function matchesRegex(value: string, regex: string): boolean {
  return new RegExp(regex).test(value.trim());
}

export function validateField(
  spec: { name: string; regex: string; checksum: string },
  raw: string | null,
): { name: string; value: string | null; valid: boolean; reason: string | null } {
  if (!raw || !raw.trim()) {
    return { name: spec.name, value: null, valid: false, reason: 'not found' };
  }
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();
  const value = spec.name.toLowerCase().includes('date') ? trimmed : upper;
  const candidate = matchesRegex(trimmed, spec.regex)
    ? trimmed
    : matchesRegex(value, spec.regex)
      ? value
      : trimmed;
  if (!matchesRegex(candidate, spec.regex)) {
    return { name: spec.name, value: trimmed, valid: false, reason: 'regex mismatch' };
  }
  if (spec.checksum.toLowerCase() === 'ean13') {
    const ok = ean13ChecksumValid(candidate);
    return {
      name: spec.name,
      value: candidate,
      valid: ok,
      checksumOk: ok,
      reason: ok ? null : 'checksum failed',
    } as any;
  }
  return { name: spec.name, value: candidate, valid: true, reason: null };
}

export function extractSameLine(fullText: string, anchors: string[]): string | null {
  const pattern = new RegExp(
    `(?:${anchors.map(escapeRegex).join('|')})\\s*[:#.-]?\\s*([^\\s]+)`,
    'i',
  );
  return fullText.match(pattern)?.[1] ?? null;
}

export function extractFields(
  fullText: string,
  fields: Array<{ name: string; anchors: string[]; regex: string; checksum: string }>,
) {
  return fields.map(spec => {
    const sameLine = extractSameLine(fullText, spec.anchors);
    if (sameLine) {
      const result = validateField(spec, sameLine);
      if (result.value) {
        return result;
      }
    }
    const hunted = fullText.match(new RegExp(spec.regex))?.[0] ?? null;
    return validateField(spec, hunted);
  });
}

export class DuplicateSuppressor {
  lastKey: string | null = null;
  lastAcceptedAt = 0;

  constructor(public windowMs: number) {}

  isDuplicate(key: string, nowMs: number): boolean {
    const duplicate = key === this.lastKey && nowMs - this.lastAcceptedAt < this.windowMs;
    if (!duplicate) {
      this.lastKey = key;
      this.lastAcceptedAt = nowMs;
    }
    return duplicate;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
