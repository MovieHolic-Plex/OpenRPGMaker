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
//
// `options.filter`:
//   - "none"(기본): 모든 행을 필터 0 으로 쓴다. 픽셀아트(평탄한 색면)에 충분하고, 기존 생성기들의
//     커밋된 바이트가 이 방식으로 만들어져 있어 기본값을 바꾸면 그 재현성 게이트가 전부 깨진다.
//   - "adaptive": 행마다 Sub/Up/Average/Paeth 중 잔차 절대합이 가장 작은 필터를 고른다(libpng 의
//     휴리스틱). 부드러운 그라디언트(고해상도 이펙트 글로우)에서 2~4배 작아진다. 실측: 3840×384
//     이펙트 스트립 956KB → 필터만 적용 시 크게 줄고, 6비트 양자화와 합치면 1/5 이하.
export function writePng(width, height, rgbaBuffer, options = {}) {
  const expected = width * height * 4;
  if (rgbaBuffer.length !== expected) {
    throw new Error(`writePng: RGBA 버퍼 길이가 ${expected} 여야 하는데 ${rgbaBuffer.length} 입니다.`);
  }
  const adaptive = options.filter === "adaptive";
  const rowBytes = width * 4;
  const stride = 1 + rowBytes;
  const raw = Buffer.alloc(stride * height);
  const previous = Buffer.alloc(rowBytes);
  const current = Buffer.alloc(rowBytes);
  const candidate = Buffer.alloc(rowBytes);
  const best = Buffer.alloc(rowBytes);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    rgbaBuffer.subarray ? current.set(rgbaBuffer.subarray(y * rowBytes, (y + 1) * rowBytes)) : current.set(rgbaBuffer.slice(y * rowBytes, (y + 1) * rowBytes));
    if (!adaptive) {
      raw[row] = 0;
      current.copy(raw, row + 1);
      continue;
    }
    let bestType = 0;
    let bestScore = Infinity;
    for (let type = 0; type <= 4; type += 1) {
      const score = filterRow(type, current, y === 0 ? null : previous, candidate);
      if (score < bestScore) {
        bestScore = score;
        bestType = type;
        candidate.copy(best);
      }
    }
    raw[row] = bestType;
    best.copy(raw, row + 1);
    current.copy(previous);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr(width, height)),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** PNG 행 필터 하나를 적용해 out 에 쓰고 잔차 절대합(작을수록 잘 압축된다)을 돌려준다. bpp=4. */
function filterRow(type, current, previous, out) {
  const length = current.length;
  let score = 0;
  for (let i = 0; i < length; i += 1) {
    const a = i >= 4 ? current[i - 4] : 0;
    const b = previous ? previous[i] : 0;
    const c = previous && i >= 4 ? previous[i - 4] : 0;
    let predictor = 0;
    if (type === 1) predictor = a;
    else if (type === 2) predictor = b;
    else if (type === 3) predictor = (a + b) >> 1;
    else if (type === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    const value = (current[i] - predictor) & 0xff;
    out[i] = value;
    score += value < 128 ? value : 256 - value;
  }
  return score;
}
