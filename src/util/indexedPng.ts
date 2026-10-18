// 팔레트(색 번호) PNG 인코더 — 캔버스·Node 없이 브라우저·Node 가 같은 바이트를 낸다.
// 도트 그림은 투명 칸과 같은 색이 길게 이어지므로 고정 허프만 deflate + LZ77 로 충분히 작다
// (무압축 저장 블록이면 288×288 시트 한 장이 data URL 로 수백 KB 가 된다 — 프로젝트 JSON 이 붓는다).

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const WINDOW = 32768;
const MAX_MATCH = 258;
const MAX_CHAIN = 96;

class BitWriter {
  private readonly bytes: number[] = [];
  private acc = 0;
  private count = 0;

  /** 값의 아랫비트부터(deflate 의 추가 비트·머리). */
  bits(value: number, length: number): void {
    for (let i = 0; i < length; i += 1) this.push((value >>> i) & 1);
  }

  /** 허프만 부호는 윗비트부터 쓴다. */
  code(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i -= 1) this.push((value >>> i) & 1);
  }

  private push(bit: number): void {
    this.acc |= bit << this.count;
    this.count += 1;
    if (this.count === 8) {
      this.bytes.push(this.acc);
      this.acc = 0;
      this.count = 0;
    }
  }

  finish(): Uint8Array {
    if (this.count > 0) this.bytes.push(this.acc);
    return Uint8Array.from(this.bytes);
  }
}

function writeLiteralLength(out: BitWriter, symbol: number): void {
  if (symbol < 144) out.code(0x30 + symbol, 8);
  else if (symbol < 256) out.code(0x190 + symbol - 144, 9);
  else if (symbol < 280) out.code(symbol - 256, 7);
  else out.code(0xc0 + symbol - 280, 8);
}

function tableIndex(base: readonly number[], value: number): number {
  let index = base.length - 1;
  while (base[index]! > value) index -= 1;
  return index;
}

/** 고정 허프만 블록 하나로 압축한 raw deflate. */
export function deflateFixed(data: Uint8Array): Uint8Array {
  const out = new BitWriter();
  out.bits(1, 1); // BFINAL
  out.bits(1, 2); // BTYPE=01 고정 허프만
  const head = new Int32Array(1 << 15).fill(-1);
  const prev = new Int32Array(data.length).fill(-1);
  const hashAt = (i: number): number => ((data[i]! << 10) ^ (data[i + 1]! << 5) ^ data[i + 2]!) & 0x7fff;
  let i = 0;
  while (i < data.length) {
    let bestLength = 0;
    let bestDistance = 0;
    if (i + 2 < data.length) {
      const hash = hashAt(i);
      let candidate = head[hash]!;
      let chain = 0;
      while (candidate >= 0 && i - candidate <= WINDOW && chain < MAX_CHAIN) {
        let length = 0;
        const limit = Math.min(MAX_MATCH, data.length - i);
        while (length < limit && data[candidate + length] === data[i + length]) length += 1;
        if (length > bestLength) {
          bestLength = length;
          bestDistance = i - candidate;
          if (length === limit) break;
        }
        candidate = prev[candidate]!;
        chain += 1;
      }
    }
    const step = bestLength >= 3 ? bestLength : 1;
    if (bestLength >= 3) {
      const lengthIndex = tableIndex(LENGTH_BASE, bestLength);
      writeLiteralLength(out, 257 + lengthIndex);
      out.bits(bestLength - LENGTH_BASE[lengthIndex]!, LENGTH_EXTRA[lengthIndex]!);
      const distIndex = tableIndex(DIST_BASE, bestDistance);
      out.code(distIndex, 5);
      out.bits(bestDistance - DIST_BASE[distIndex]!, DIST_EXTRA[distIndex]!);
    } else {
      writeLiteralLength(out, data[i]!);
    }
    for (let k = 0; k < step; k += 1) {
      const at = i + k;
      if (at + 2 < data.length) {
        const hash = hashAt(at);
        prev[at] = head[hash]!;
        head[hash] = at;
      }
    }
    i += step;
  }
  writeLiteralLength(out, 256);
  return out.finish();
}

let crcTable: Uint32Array | undefined;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  for (let k = 0; k < 4; k += 1) out[4 + k] = type.charCodeAt(k);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

export interface IndexedImage {
  readonly width: number;
  readonly height: number;
  /** width×height 색 번호. 0 = 투명. */
  readonly pixels: Uint8Array;
  /** 색 번호 → [r,g,b]. 0번은 투명이라 색값을 쓰지 않는다. 최대 256. */
  readonly palette: readonly (readonly [number, number, number])[];
}

/** 팔레트 PNG(색 형식 3, 8비트) 바이트. 0번 색은 tRNS 로 완전 투명, 나머지는 불투명(알파 0/255). */
export function encodeIndexedPng(image: IndexedImage): Uint8Array {
  const { width, height, pixels, palette } = image;
  if (palette.length < 1 || palette.length > 256) throw new Error(`palette size ${palette.length} (1..256)`);
  const raw = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y += 1) raw.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  const deflated = deflateFixed(raw);
  let a = 1, b = 0;
  for (const byte of raw) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  const zlib = new Uint8Array(deflated.length + 6);
  zlib[0] = 0x78;
  zlib[1] = 0x01;
  zlib.set(deflated, 2);
  new DataView(zlib.buffer).setUint32(zlib.length - 4, ((b << 16) | a) >>> 0);
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 8;
  header[9] = 3;
  const plte = new Uint8Array(palette.length * 3);
  palette.forEach(([r, g, bl], index) => plte.set([r, g, bl], index * 3));
  const trns = Uint8Array.from(palette, (_, index) => (index === 0 ? 0 : 255));
  const parts = [
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("PLTE", plte),
    chunk("tRNS", trns),
    chunk("IDAT", zlib),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

export function pngDataUrl(bytes: Uint8Array): string {
  let binary = "";
  for (let k = 0; k < bytes.length; k += 0x8000) binary += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return `data:image/png;base64,${btoa(binary)}`;
}
