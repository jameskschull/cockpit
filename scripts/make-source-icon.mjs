import { writeFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";

// Minimal solid-color PNG generator used once to seed Tauri icon generation.
const SIZE = 512;
const BG = [45, 108, 223];   // #2d6cdf — matches --accent
const FG = [255, 255, 255];

function putU32BE(buf, offset, value) {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  putU32BE(len, 0, data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  putU32BE(crcBuf, 0, crc32(body) >>> 0);
  return Buffer.concat([len, body, crcBuf]);
}

function ihdr(w, h) {
  const b = Buffer.alloc(13);
  putU32BE(b, 0, w);
  putU32BE(b, 4, h);
  b[8] = 8;    // bit depth
  b[9] = 2;    // color type: RGB
  b[10] = 0;
  b[11] = 0;
  b[12] = 0;
  return chunk("IHDR", b);
}

function isInCheck(x, y) {
  // Draw a thick check mark roughly centered.
  const cx = SIZE / 2;
  const cy = SIZE / 2 + 20;
  const tx = x - cx;
  const ty = y - cy;
  // Left arm of the check: slope 1, length ~80, thickness 36
  // Right arm: slope -1, length ~160, thickness 36
  const T = 36;
  const onLeft = tx >= -110 && tx <= -20 && Math.abs(tx - ty + 0) <= T / Math.SQRT2 * 2 && ty >= -70 && ty <= 60;
  const onRight = tx >= -20 && tx <= 140 && Math.abs(tx + ty + 0) <= T / Math.SQRT2 * 2 && ty >= -180 && ty <= 50;
  return onLeft || onRight;
}

function pixels() {
  const rowLen = 1 + SIZE * 3;
  const raw = Buffer.alloc(rowLen * SIZE);
  let off = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[off++] = 0; // filter
    for (let x = 0; x < SIZE; x++) {
      const c = isInCheck(x, y) ? FG : BG;
      raw[off++] = c[0];
      raw[off++] = c[1];
      raw[off++] = c[2];
    }
  }
  return deflateSync(raw, { level: 9 });
}

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const png = Buffer.concat([
  sig,
  ihdr(SIZE, SIZE),
  chunk("IDAT", pixels()),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = process.argv[2] ?? "icon-source.png";
writeFileSync(out, png);
console.log(`Wrote ${out} (${png.length} bytes)`);
