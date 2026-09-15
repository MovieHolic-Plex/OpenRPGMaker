// PNG 픽셀 검사 — 생성 에셋 러너(scripts/oprn-generated-assets.mjs)와 저장소 계약 테스트가 **같은 판정**을 쓴다.
//
// 왜 공유 모듈인가: 2026-09-15 에 dry-run 가짜 5장이 `public/assets/generated/starter/` 로 승격돼 있었는데,
// 판정이 러너 안에만 있어서 러너를 돌릴 때만(그것도 그 파일을 승격 대상으로 지정했을 때만) 잡혔다.
// 저장소 전체를 훑는 계약 테스트가 같은 함수를 쓰게 해서 같은 사고가 다시 조용히 들어오지 못하게 한다.
import { inflateSync } from "node:zlib";
import { readFileSync } from "node:fs";

/** PNG 스캔라인 필터(0~4)를 풀어 RGBA 픽셀 버퍼로 돌려준다. 지원하지 않는 필터면 null. */
export function decodeRgba(inflated, width, height) {
  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    if (pos + 1 + stride > inflated.length) return null;
    const filter = inflated[pos];
    pos += 1;
    const rowStart = y * stride;
    const prevStart = rowStart - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = inflated[pos + x];
      const left = x >= bpp ? out[rowStart + x - bpp] : 0;
      const up = y > 0 ? out[prevStart + x] : 0;
      const upLeft = y > 0 && x >= bpp ? out[prevStart + x - bpp] : 0;
      let recon;
      if (filter === 0) recon = value;
      else if (filter === 1) recon = value + left;
      else if (filter === 2) recon = value + up;
      else if (filter === 3) recon = value + ((left + up) >> 1);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        recon = value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      } else {
        return null;
      }
      out[rowStart + x] = recon & 255;
    }
    pos += stride;
  }
  return out;
}

/** dry-run 전용 가짜 픽셀인가 — 실제 그림이 우연히 이 공식을 만족할 수는 없다. */
export function isDryRunFake(pixels, width, height) {
  const stride = width * 4;
  const stepX = Math.max(1, Math.floor(width / 16));
  const stepY = Math.max(1, Math.floor(height / 16));
  let sampled = 0;
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const value = (x * 17 + y * 31) % 251;
      const offset = y * stride + x * 4;
      if (pixels[offset] !== value || pixels[offset + 1] !== (80 + value) % 251
        || pixels[offset + 2] !== (160 + value) % 251 || pixels[offset + 3] !== 255) return false;
      sampled += 1;
    }
  }
  return sampled >= 4;
}

/**
 * PNG 바이트에서 IHDR 크기와 픽셀을 얻는다. IDAT 만 모아 inflate 한다(런너의 inspectPng 와 같은 방식).
 * 반환: { width, height, pixels } 또는 { error }.
 */
export function readPngPixels(bytes) {
  if (bytes.length < 8 || bytes.readUInt32BE(0) !== 0x89504e47) return { error: "not-png" };
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const data = bytes.subarray(dataStart, dataStart + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset = dataStart + length + 4;
  }
  if (!width || !height || idat.length === 0) return { error: "no-pixels" };
  const pixels = decodeRgba(inflateSync(Buffer.concat(idat)), width, height);
  return pixels ? { width, height, pixels } : { error: "unsupported-filter" };
}

/** 파일 하나 판정 — 테스트·검사 스크립트가 쓰는 한 줄짜리 입구. */
export function inspectPngFile(path) {
  const inspection = readPngPixels(readFileSync(path));
  if (inspection.error) return { path, error: inspection.error };
  return {
    path,
    width: inspection.width,
    height: inspection.height,
    dryRunFake: isDryRunFake(inspection.pixels, inspection.width, inspection.height),
  };
}
