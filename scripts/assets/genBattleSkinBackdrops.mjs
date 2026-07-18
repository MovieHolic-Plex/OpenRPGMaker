import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const WIDTH = 320;
const HEIGHT = 180;
const OUTPUT_DIR = path.resolve("public/assets/generated/battle-skins");

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  name.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return result;
}

export function encodePng(width, height, pixels, channels) {
  if (channels !== 3 && channels !== 4) throw new Error("PNG channels must be RGB or RGBA");
  if (pixels.length !== width * height * channels) throw new Error("PNG pixel buffer has the wrong size");
  const scanlines = Buffer.alloc(height * (1 + width * channels));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * channels);
    scanlines[row] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * channels, width * channels).copy(scanlines, row + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function decodePng(png) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!png.subarray(0, 8).equals(signature)) throw new Error("Not a PNG file");
  let offset = 8;
  let width;
  let height;
  let channels;
  const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || (data[9] !== 2 && data[9] !== 6)) throw new Error("Only 8-bit RGB/RGBA PNGs are supported");
      channels = data[9] === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = new Uint8ClampedArray(width * height * channels);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const start = y * (stride + 1);
    const filter = raw[start];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[start + 1 + x];
      const at = y * stride + x;
      const left = x >= channels ? pixels[at - channels] : 0;
      const up = y ? pixels[at - stride] : 0;
      const upLeft = y && x >= channels ? pixels[at - stride - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up
        : filter === 3 ? Math.floor((left + up) / 2) : filter === 4 ? paeth(left, up, upLeft) : NaN;
      if (Number.isNaN(predictor)) throw new Error(`Unsupported PNG filter ${filter}`);
      pixels[at] = (value + predictor) & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

const rgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

function backdrop(painter) {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y += 1) for (let x = 0; x < WIDTH; x += 1) {
    const color = painter(x, y);
    const at = (y * WIDTH + x) * 3;
    pixels[at] = clamp(color[0]); pixels[at + 1] = clamp(color[1]); pixels[at + 2] = clamp(color[2]);
  }
  return pixels;
}

function vertical(top, bottom, horizon = 1) {
  return backdrop((x, y) => mix(top, bottom, Math.min(1, y / (HEIGHT * horizon))));
}

function makeBackdrops() {
  const skyGrass = (top, bottom, horizon, band) => backdrop((x, y) => {
    if (y < horizon) return mix(top, mix(top, bottom, 0.18), y / horizon);
    const t = (y - horizon) / (HEIGHT - horizon);
    const base = mix(band, bottom, t);
    const soft = Math.exp(-((y - horizon) ** 2) / 90) * 18;
    return base.map((v) => v + soft);
  });
  return {
    pokemon: skyGrass(rgb("#98d0d8"), rgb("#68b048"), 105, rgb("#a8cf78")),
    rm2003: skyGrass(rgb("#84b8e3"), rgb("#368b37"), 94, rgb("#79a85d")),
    rm2000: vertical(rgb("#101c48"), rgb("#183828")),
    octopath: backdrop((x, y) => {
      const distance = Math.hypot((x - WIDTH / 2) / 175, (y - HEIGHT * 0.58) / 100);
      const glow = Math.max(0, 1 - distance) ** 2;
      return [12 + 62 * glow, 18 + 43 * glow, 32 + 8 * glow];
    }),
    chrono: backdrop((x, y) => {
      const base = mix(rgb("#0a1a3a"), rgb("#173c70"), y / HEIGHT);
      const glow = Math.exp(-((y - 120) ** 2) / 420) * 0.72;
      return mix(base, rgb("#2fa8ff"), glow);
    }),
    bravely: vertical(rgb("#f6efe2"), rgb("#d8a24a")),
    dragonquest: backdrop((x, y) => {
      const floor = Math.max(0, (y - 142) / 38);
      return mix(rgb("#000814"), rgb("#10274d"), floor * 0.58);
    }),
    ff: backdrop((x, y) => {
      const t = y / HEIGHT;
      const base = mix(rgb("#101838"), rgb("#5878c8"), Math.min(1, t * 1.15));
      const horizon = Math.exp(-((y - 126) ** 2) / 170) * 22;
      return base.map((v) => v + horizon);
    }),
    mother: backdrop((x, y) => {
      const palette = [rgb("#ff4fd8"), rgb("#22e8ff"), rgb("#ffe84a"), rgb("#09000f")];
      const band = ((Math.floor((x + y * 1.7) / 28) % palette.length) + palette.length) % palette.length;
      const edge = ((x + y * 1.7) % 28) / 28;
      return mix(palette[band], palette[(band + 1) % palette.length], Math.max(0, (edge - 0.78) / 0.22));
    }),
    goldensun: backdrop((x, y) => {
      const top = rgb("#ffcf3a"), low = rgb("#0e1830");
      const base = mix(top, low, y / HEIGHT);
      const horizon = Math.exp(-((y - 128) ** 2) / 260) * 0.48;
      return mix(base, rgb("#ffcf3a"), horizon);
    }),
  };
}

function makeDemoBattler() {
  const pixels = new Uint8Array(48 * 48 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 0; pixels[i + 1] = 255; pixels[i + 2] = 0; pixels[i + 3] = 255;
  }
  const paint = (x, y, color) => {
    if (x < 0 || y < 0 || x >= 48 || y >= 48) return;
    const at = (y * 48 + x) * 4;
    pixels.set([...color, 255], at);
  };
  for (let y = 12; y <= 39; y += 1) for (let x = 8; x <= 39; x += 1) {
    const body = ((x - 24) / 16) ** 2 + ((y - 27) / 15) ** 2 <= 1;
    const ear = (x < 17 && y < 21 && x + y > 23) || (x > 31 && y < 21 && y - x > -25);
    if (body || ear) paint(x, y, y < 25 ? [116, 72, 148] : [77, 61, 103]);
  }
  for (const [x, y] of [[18, 25], [30, 25]]) {
    paint(x, y, [232, 220, 245]); paint(x, y + 1, [35, 25, 48]);
  }
  for (let x = 20; x <= 28; x += 1) if (Math.abs(x - 24) >= 2) paint(x, 33 + (Math.abs(x - 24) > 3 ? 0 : 1), [210, 112, 190]);
  return pixels;
}

export function generateAssets() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const written = [];
  for (const [id, pixels] of Object.entries(makeBackdrops())) {
    const file = path.join(OUTPUT_DIR, `${id}-backdrop.png`);
    fs.writeFileSync(file, encodePng(WIDTH, HEIGHT, pixels, 3));
    written.push(file);
  }
  const battler = path.join(OUTPUT_DIR, "demo-battler-magenta.png");
  fs.writeFileSync(battler, encodePng(48, 48, makeDemoBattler(), 4));
  written.push(battler);
  for (const file of written) console.log(`${path.relative(process.cwd(), file)} ${fs.statSync(file).size} bytes`);
  return written;
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(new URL(import.meta.url).pathname)) generateAssets();
