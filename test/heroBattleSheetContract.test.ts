import { describe, expect, it } from "vitest";

// 주인공 전투 캐릭터셋(리소스 kind "n") 4장의 **출하 규격**을 못 박는다.
//
// 왜 브라우저 없이 픽셀을 재는가: 이 시트는 `src/player/battleFieldDom.ts` 의
// `actorBattleImage` 가 background-image 로만 그린다. 프레임 폭/높이와 backgroundSize 를
// 48px 셀 3열 × 8행 기준으로 계산하므로, PNG 크기나 열 배치가 어긋나면 전투 화면에서
// 스프라이트가 잘리거나 옆 프레임이 따라 들어온다. 그 회귀는 타입도 린트도 못 잡는다.
//
// 재는 것 (전부 런타임이 실제로 의존하는 값):
//  1. 정확히 144×384, 8bit RGBA PNG — backgroundSize 산식의 전제.
//  2. 행 0 의 세 열이 전부 비어 있지 않다 — col0 idle / col1 attack / col2 hit·dead.
//     col2 가 비면 피격·전투불능 시 아군이 화면에서 사라진다.
//  3. 세 열이 서로 다르다 — 같으면 공격/피격 프레임 교체가 눈에 보이지 않는다.
//  4. 행 0 바로 아래 8px 띠가 완전히 투명하다 — 과거 48×64 오슬라이스 버그(발밑에
//     아랫행 머리 16px 이 따라오던 증상)의 구조적 재발 방지선.
//  5. 세 열이 각각 셀 높이의 70% 이상, 그중 가장 큰 실루엣은 90% 이상을 채우고, idle 열
//     실루엣이 900px 이상이다 — 전투 필드에서 적 배틀러 이미지는 88×104 논리 px 인데 아군
//     프레임은 96×96 이다. 셀 안에서 작게 그려진 시트는 적보다 절반 크기로 보인다.
//     2026-08-28 교체 전 실측: 높이는 70.8~77.1% 로 70% 문턱을 넘었지만 최대 채움이 77.1%,
//     idle 실루엣이 527~663px 이었다. 즉 **높이 70% 만으로는 회귀가 안 잡힌다** — 교체 전
//     원본도 통과한다. 최대 채움 90% 와 idle 면적 900px 이 실제 쐐기다.
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
/** src/player/battleFieldDom.ts 의 BATTLE_SHEET_CELL / COLUMNS / ROWS 와 같은 값. */
const CELL = 48;
const COLUMNS = 3;
const ROWS = 8;
const SHEET_WIDTH = CELL * COLUMNS;
const SHEET_HEIGHT = CELL * ROWS;
const OPAQUE = 32;
/** 최소 실루엣 면적 — 이보다 적으면 사실상 빈 프레임이다. */
const MIN_OPAQUE_PIXELS = 350;
/** 열 사이 최소 차이(셀 면적 대비 %). */
const MIN_POSE_DIFF_RATIO = 0.02;
/** 모든 열이 채워야 하는 셀 높이 비율. */
const MIN_CELL_FILL = 0.7;
/** 가장 큰 실루엣이 채워야 하는 셀 높이 비율. */
const MIN_TALLEST_FILL = 0.9;
/** idle 열의 최소 실루엣 면적 — 교체 전 오버월드 프레임(527~663px)을 되돌리지 못하게 막는다. */
const MIN_IDLE_AREA = 900;
/** 오슬라이스 방어 띠 높이 — 과거 버그가 아랫행 16px 을 끌어왔으므로 그 절반을 잰다. */
const BLEED_GUARD_HEIGHT = 8;

const SHEETS = ["hero-01", "hero-02", "hero-03", "hero-04"] as const;

type Sheet = { readonly width: number; readonly height: number; readonly pixels: Uint8Array };

describe("hero battle charset sheets", () => {
  it.each(SHEETS)("%s-battle.png ships the 144x384 three-pose row-0 contract", async (slug) => {
    const fs = await loadBinaryFs();
    const zlib = await loadInflater();
    const bytes = fs.readFileSync(sheetUrl(slug));

    expect(Array.from(bytes.slice(0, PNG_SIGNATURE.length))).toEqual(Array.from(PNG_SIGNATURE));
    expect(readUint32BE(bytes, 16)).toBe(SHEET_WIDTH);
    expect(readUint32BE(bytes, 20)).toBe(SHEET_HEIGHT);
    expect(bytes[24]).toBe(8);
    expect(bytes[25]).toBe(6);

    const sheet = decodeRgbaPng(bytes, zlib);
    const cells = [0, 1, 2].map((column) => measureCell(sheet, column));

    for (const [column, cell] of cells.entries()) {
      expect(cell.opaque, `col ${column} 실루엣 면적`).toBeGreaterThanOrEqual(MIN_OPAQUE_PIXELS);
      expect(cell.height / CELL, `col ${column} 셀 높이 점유율`).toBeGreaterThanOrEqual(MIN_CELL_FILL);
    }

    expect(cells[0]?.opaque ?? 0, "idle 실루엣 면적").toBeGreaterThanOrEqual(MIN_IDLE_AREA);

    expect(diffRatio(sheet, 0, 1), "idle vs attack").toBeGreaterThan(MIN_POSE_DIFF_RATIO);
    expect(diffRatio(sheet, 0, 2), "idle vs hit").toBeGreaterThan(MIN_POSE_DIFF_RATIO);
    expect(diffRatio(sheet, 1, 2), "attack vs hit").toBeGreaterThan(MIN_POSE_DIFF_RATIO);

    expect(opaqueInRows(sheet, CELL, CELL + BLEED_GUARD_HEIGHT), "행 0 아래 띠").toBe(0);

    const tallest = Math.max(...cells.map((cell) => cell.height));
    expect(tallest / CELL, "가장 큰 실루엣의 셀 높이 점유율").toBeGreaterThanOrEqual(MIN_TALLEST_FILL);
  });
});

function sheetUrl(slug: string): URL {
  return new URL(`../public/assets/generated/starter/${slug}-battle.png`, import.meta.url);
}

function measureCell(sheet: Sheet, column: number): { readonly opaque: number; readonly height: number } {
  let opaque = 0;
  let minY = CELL;
  let maxY = -1;
  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      const index = (y * sheet.width + column * CELL + x) * 4;
      if ((sheet.pixels[index + 3] ?? 0) < OPAQUE) continue;
      opaque += 1;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { opaque, height: maxY < 0 ? 0 : maxY - minY + 1 };
}

function diffRatio(sheet: Sheet, columnA: number, columnB: number): number {
  let differing = 0;
  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      const a = (y * sheet.width + columnA * CELL + x) * 4;
      const b = (y * sheet.width + columnB * CELL + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        if (sheet.pixels[a + channel] !== sheet.pixels[b + channel]) {
          differing += 1;
          break;
        }
      }
    }
  }
  return differing / (CELL * CELL);
}

function opaqueInRows(sheet: Sheet, fromY: number, toY: number): number {
  let opaque = 0;
  for (let y = fromY; y < toY; y += 1) {
    for (let x = 0; x < CELL * COLUMNS; x += 1) {
      if ((sheet.pixels[(y * sheet.width + x) * 4 + 3] ?? 0) >= OPAQUE) opaque += 1;
    }
  }
  return opaque;
}

function decodeRgbaPng(bytes: Uint8Array, zlib: Inflater): Sheet {
  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  const parts: Uint8Array[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    if (ascii(bytes, offset + 4, offset + 8) === "IDAT") parts.push(bytes.slice(offset + 8, offset + 8 + length));
    offset += length + 12;
  }

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const compressed = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    compressed.set(part, cursor);
    cursor += part.length;
  }

  const raw = zlib.inflateSync(compressed);
  const stride = width * 4;
  const pixels = new Uint8Array(stride * height);
  // PNG 스캔라인 필터 해제(색 타입 6, 비트 심도 8 전용).
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)] ?? 0;
    const source = row * (stride + 1) + 1;
    const target = row * stride;
    for (let column = 0; column < stride; column += 1) {
      const value = raw[source + column] ?? 0;
      const left = column >= 4 ? (pixels[target + column - 4] ?? 0) : 0;
      const up = row > 0 ? (pixels[target - stride + column] ?? 0) : 0;
      const upLeft = row > 0 && column >= 4 ? (pixels[target - stride + column - 4] ?? 0) : 0;
      pixels[target + column] = (value + unfilter(filter, left, up, upLeft)) & 0xff;
    }
  }
  return { width, height, pixels };
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

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) * 0x1000000) + (((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0));
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}
