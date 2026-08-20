/**
 * Generates high-contrast label PNGs used as camera-free fixtures.
 * No extra dependencies: Node zlib + a 5x7 bitmap font scaled up for OCR.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const imageDir = path.join(root, 'testdata', 'images');
const assetDir = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'testdata');

const L = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
];
const G = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111',
];
const R = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
];
const FIRST = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];

const FONT = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10001', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '/': ['00001', '00010', '00100', '01000', '10000', '10000', '10000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
};

function ean13Bits(code) {
  const first = Number(code[0]);
  const pattern = FIRST[first];
  let bits = '101';
  for (let i = 1; i <= 6; i += 1) {
    const digit = Number(code[i]);
    bits += pattern[i - 1] === 'L' ? L[digit] : G[digit];
  }
  bits += '01010';
  for (let i = 7; i <= 12; i += 1) {
    bits += R[Number(code[i])];
  }
  bits += '101';
  return bits;
}

function createCanvas(width, height, fill = [255, 255, 255]) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = fill[0];
    pixels[i + 1] = fill[1];
    pixels[i + 2] = fill[2];
  }
  return { width, height, pixels };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return;
  }
  const i = (y * canvas.width + x) * 3;
  canvas.pixels[i] = color[0];
  canvas.pixels[i + 1] = color[1];
  canvas.pixels[i + 2] = color[2];
}

function fillRect(canvas, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      setPixel(canvas, xx, yy, color);
    }
  }
}

function drawText(canvas, text, x, y, scale, color = [0, 0, 0]) {
  let cursor = x;
  for (const char of text.toUpperCase()) {
    const glyph = FONT[char] ?? FONT[' '];
    for (let gy = 0; gy < 7; gy += 1) {
      for (let gx = 0; gx < 5; gx += 1) {
        if (glyph[gy][gx] === '1') {
          fillRect(canvas, cursor + gx * scale, y + gy * scale, scale, scale, color);
        }
      }
    }
    cursor += 6 * scale;
  }
}

function drawBarcode(canvas, code, x, y, module, barHeight) {
  const bits = ean13Bits(code);
  fillRect(canvas, x - 16, y - 8, bits.length * module + 32, barHeight + 16, [255, 255, 255]);
  for (let i = 0; i < bits.length; i += 1) {
    if (bits[i] === '1') {
      fillRect(canvas, x + i * module, y, module, barHeight, [0, 0, 0]);
    }
  }
}

function writePng(file, canvas) {
  const rows = [];
  for (let y = 0; y < canvas.height; y += 1) {
    const row = Buffer.alloc(1 + canvas.width * 3);
    canvas.pixels.copy(row, 1, y * canvas.width * 3, (y + 1) * canvas.width * 3);
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function drawLabel(canvas, lines, barcode) {
  fillRect(canvas, 40, 40, canvas.width - 80, canvas.height - 80, [255, 255, 255]);
  fillRect(canvas, 40, 40, canvas.width - 80, 8, [0, 0, 0]);
  fillRect(canvas, 40, canvas.height - 48, canvas.width - 80, 8, [0, 0, 0]);
  let y = 80;
  lines.forEach((line, index) => {
    drawText(canvas, line, 80, y, index === 0 ? 6 : 8);
    y += index === 0 ? 70 : 84;
  });
  drawBarcode(canvas, barcode, 90, y + 10, 3, 140);
  drawText(canvas, barcode, 90, y + 160, 4);
}

const labels = [
  {
    file: 'valid-pharma-label.png',
    lines: ['ACME PHARMA', 'LOT ABC1234', 'EXP 12/31/2027'],
    barcode: '5901234123457',
  },
  {
    file: 'invalid-lot-regex.png',
    lines: ['ACME PHARMA', 'LOT AB#12', 'EXP 12/31/2027'],
    barcode: '5901234123457',
  },
  {
    file: 'invalid-ean-checksum.png',
    lines: ['ACME PHARMA', 'LOT XYZ9876', 'EXP 06/15/2028'],
    barcode: '5901234123450',
  },
  {
    file: 'duplicate-of-valid.png',
    lines: ['ACME PHARMA', 'LOT ABC1234', 'EXP 12/31/2027'],
    barcode: '5901234123457',
  },
];

fs.mkdirSync(imageDir, { recursive: true });
fs.mkdirSync(assetDir, { recursive: true });

for (const label of labels) {
  const canvas = createCanvas(1100, 700);
  drawLabel(canvas, label.lines, label.barcode);
  const dest = path.join(imageDir, label.file);
  writePng(dest, canvas);
  fs.copyFileSync(dest, path.join(assetDir, label.file));
  console.log('wrote', label.file);
}
