// 공용 PNG 인코딩 프리미티브 — generate-window-skin.mjs 에서 추출.
// 외부 이미지 라이브러리 없이 flat RGBA 버퍼를 PNG 바이트로 직렬화한다.
import { deflateSync } from "node:zlib";

export const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let value = n;
  for (let k = 0; k < 8; k += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[n] = value >>> 0;
}

export function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

export function chunk(type, payload) {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, payload]);
  const out = Buffer.alloc(12 + payload.length);
  out.writeUInt32BE(payload.length, 0);
  typeBytes.copy(out, 4);
  payload.copy(out, 8);
  out.writeUInt32BE(crc32(body), 8 + payload.length);
  return out;
}

export function ihdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

// flat RGBA(Uint8Array/Buffer, length = width*height*4) → 완성된 PNG 바이트 버퍼.
export function writePng(width, height, rgbaBuffer) {
  const expected = width * height * 4;
  if (rgbaBuffer.length !== expected) {
    throw new Error(`writePng: RGBA 버퍼 길이가 ${expected} 여야 하는데 ${rgbaBuffer.length} 입니다.`);
  }
  const stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const src = (y * width + x) * 4;
      const dst = row + 1 + x * 4;
      raw[dst] = rgbaBuffer[src];
      raw[dst + 1] = rgbaBuffer[src + 1];
      raw[dst + 2] = rgbaBuffer[src + 2];
      raw[dst + 3] = rgbaBuffer[src + 3];
    }
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr(width, height)),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
