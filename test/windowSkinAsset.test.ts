import { describe, expect, it } from "vitest";

type BinaryFsReader = {
  readonly readFileSync: (path: URL) => Uint8Array;
};

type Inflater = {
  readonly inflateSync: (data: Uint8Array) => Uint8Array;
};

const loadBinaryFs = async (): Promise<BinaryFsReader> => {
  const moduleName = "node:fs";
  return (await import(moduleName)) as BinaryFsReader;
};

const loadInflater = async (): Promise<Inflater> => {
  const moduleName = "node:zlib";
  return (await import(moduleName)) as unknown as Inflater;
};

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const WINDOW_SKIN_URL = new URL("../public/assets/ui/windowskin-default.png", import.meta.url);
const WARM_WINDOW_SKIN_URL = new URL("../public/assets/ui/windowskin-warm.png", import.meta.url);

describe("runtime window skin asset", () => {
  it("ships a valid 96x96 RGBA PNG for 24px 9-slice windows", async () => {
    const fs = await loadBinaryFs();
    const bytes = fs.readFileSync(WINDOW_SKIN_URL);

    expect(Array.from(bytes.slice(0, PNG_SIGNATURE.length))).toEqual(Array.from(PNG_SIGNATURE));
    expect(readUint32BE(bytes, 16)).toBe(96);
    expect(readUint32BE(bytes, 20)).toBe(96);
    expect(bytes[24]).toBe(8);
    expect(bytes[25]).toBe(6);
    expect(hasChunk(bytes, "IDAT")).toBe(true);
  });

  // 저작 기본 스킨(windowskin-warm)은 같은 96x96 / 24px 9-slice 규격이어야 border-image 로
  // 동일하게 타일링된다. 규격이 어긋난 PNG 를 갈아끼우면 창 테두리가 조용히 늘어난다.
  it("ships the authored warm skin at the same 96x96 RGBA 9-slice geometry", async () => {
    const fs = await loadBinaryFs();
    const bytes = fs.readFileSync(WARM_WINDOW_SKIN_URL);

    expect(Array.from(bytes.slice(0, PNG_SIGNATURE.length))).toEqual(Array.from(PNG_SIGNATURE));
    expect(readUint32BE(bytes, 16)).toBe(96);
    expect(readUint32BE(bytes, 20)).toBe(96);
    expect(bytes[24]).toBe(8);
    expect(bytes[25]).toBe(6);
    expect(hasChunk(bytes, "IDAT")).toBe(true);
  });

  // 사용자가 원한 것은 "따뜻한 갈색" 이다. 픽셀을 직접 펴서 붉은 채널이 파란 채널보다
  // 우세한지 본다 — 파란 스킨으로 되돌아가는 회귀를 브라우저 없이 잡는 유일한 방어선이다.
  it("paints the warm skin brown, not blue", async () => {
    const fs = await loadBinaryFs();
    const zlib = await loadInflater();
    const pixels = decodeRgbaPng(fs.readFileSync(WARM_WINDOW_SKIN_URL), zlib);

    let warm = 0;
    let cool = 0;
    for (let index = 0; index + 3 < pixels.length; index += 4) {
      if ((pixels[index + 3] ?? 0) < 32) continue;
      const red = pixels[index] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      if (red > blue + 8) warm += 1;
      else if (blue > red + 8) cool += 1;
    }

    expect(warm).toBeGreaterThan(0);
    expect(cool).toBe(0);
    expect(warm).toBeGreaterThan(cool * 10);
  });
});

function decodeRgbaPng(bytes: Uint8Array, zlib: Inflater): Uint8Array {
  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  const compressed: number[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const chunkType = ascii(bytes, offset + 4, offset + 8);
    if (chunkType === "IDAT") compressed.push(...bytes.slice(offset + 8, offset + 8 + length));
    offset += length + 12;
  }

  const raw = zlib.inflateSync(new Uint8Array(compressed));
  const stride = width * 4;
  const out = new Uint8Array(stride * height);
  // PNG 스캔라인 필터 해제(색 타입 6, 비트 심도 8 전용).
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)] ?? 0;
    const source = row * (stride + 1) + 1;
    const target = row * stride;
    for (let column = 0; column < stride; column += 1) {
      const value = raw[source + column] ?? 0;
      const left = column >= 4 ? (out[target + column - 4] ?? 0) : 0;
      const up = row > 0 ? (out[target - stride + column] ?? 0) : 0;
      const upLeft = row > 0 && column >= 4 ? (out[target - stride + column - 4] ?? 0) : 0;
      out[target + column] = (value + unfilter(filter, left, up, upLeft)) & 0xff;
    }
  }
  return out;
}

function unfilter(filter: number, left: number, up: number, upLeft: number): number {
  if (filter === 1) return left;
  if (filter === 2) return up;
  if (filter === 3) return Math.floor((left + up) / 2);
  if (filter === 4) return paeth(left, up, upLeft);
  return 0;
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
  return distanceUp <= distanceUpLeft ? up : upLeft;
}

function hasChunk(bytes: Uint8Array, type: string): boolean {
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const chunkType = ascii(bytes, offset + 4, offset + 8);
    if (chunkType === type) return true;
    offset += length + 12;
  }
  return false;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) * 0x1000000) + (((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0));
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}
