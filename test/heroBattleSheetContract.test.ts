import { describe, expect, it } from "vitest";
import { POSE_FRAME, VICTORY_POSE_FRAME, type BattleBattlerPose } from "@/battle/battlePose";

// 주인공 전투 캐릭터셋(리소스 kind "n") 6장의 **출하 규격**을 못 박는다.
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
/**
 * 최소 실루엣 면적. 행 0 만 쓰던 시절 하한은 350 이었지만, 행 1 의 dead(누운 그림)까지
 * 재게 되면서 그 값으로는 정상 시트가 걸린다. 서 있는 포즈의 엄격한 하한은
 * MIN_CELL_FILL 이 따로 맡는다.
 */
const MIN_OPAQUE_PIXELS = 200;
/** 셀 사이 최소 차이(셀 면적 대비 %). */
const MIN_POSE_DIFF_RATIO = 0.02;
/** 서 있는 포즈가 채워야 하는 셀 높이 비율. dead 는 누워서 높이를 못 채우므로 뺀다. */
const MIN_CELL_FILL = 0.7;
/** idle 의 최소 실루엣 면적 — 교체 전 오버월드 프레임(527~663px)을 되돌리지 못하게 막는다. */
const MIN_IDLE_AREA = 900;
/**
 * 셀 사이 최소 **실루엣** 차이 — 마스크 XOR / 합집합.
 *
 * 색만 다른 같은 포즈를 통과시키지 않으려고 픽셀 차이(MIN_POSE_DIFF_RATIO)와 따로 잰다.
 * 행 1 이 존재하는 이유가 "defend 가 idle 과, dead 가 hit 과 다른 그림" 이므로 그 조건을
 * 직접 못 박는다. 출하 6장 실측(2026-08-29): defend↔idle 34.7~41.0%, dead↔hit 64.4~78.5%,
 * defend↔dead 58.9~76.1%. 0.2 는 가장 낮은 값의 절반 수준으로 여유를 둔 하한이다.
 */
const MIN_SILHOUETTE_DIFF_RATIO = 0.2;
/** 가장 큰 실루엣이 채워야 하는 셀 높이 비율. */
const MIN_TALLEST_FILL = 0.9;

// hero-05(성직자)·hero-06(궁수)는 2026-08-29 에 grok 으로 새로 그려 넣었다. 번들 시트를
// 잘라 만든 hero-01~04 와 달리 원본이 1024px 마젠타 JPEG 이라 크로마키·축소를 거치므로,
// 같은 계약으로 재는 것이 특히 중요하다 — 축소 필터나 키잉 허용 오차가 바뀌면 여기서 걸린다.
const SHEETS = ["hero-01", "hero-02", "hero-03", "hero-04", "hero-05", "hero-06"] as const;

type Sheet = { readonly width: number; readonly height: number; readonly pixels: Uint8Array };
type PoseName = BattleBattlerPose;
type Frame = { readonly col: number; readonly row: number };

/** 런타임이 쓰는 5포즈. POSE_FRAME 의 키를 그대로 쓰므로 포즈가 늘면 여기도 자동으로 늘어난다. */
const POSE_NAMES = Object.keys(POSE_FRAME) as readonly PoseName[];

/** 셀 높이를 채워야 하는 포즈 — dead 는 누운 그림이라 높이 검사에서 뺀다. */
const STANDING_POSES = POSE_NAMES.filter((pose) => pose !== "dead");

describe("hero battle charset sheets", () => {
  it.each(SHEETS)("%s-battle.png ships the 144x384 five-pose contract", async (slug) => {
    const fs = await loadBinaryFs();
    const zlib = await loadInflater();
    const bytes = fs.readFileSync(sheetUrl(slug));

    expect(Array.from(bytes.slice(0, PNG_SIGNATURE.length))).toEqual(Array.from(PNG_SIGNATURE));
    expect(readUint32BE(bytes, 16)).toBe(SHEET_WIDTH);
    expect(readUint32BE(bytes, 20)).toBe(SHEET_HEIGHT);
    expect(bytes[24]).toBe(8);
    expect(bytes[25]).toBe(6);

    const sheet = decodeRgbaPng(bytes, zlib);
    const cells = Object.fromEntries(
      POSE_NAMES.map((pose) => [pose, measureCell(sheet, POSE_FRAME[pose])] as const)
    ) as Record<PoseName, ReturnType<typeof measureCell>>;

    // 다섯 포즈 전부 그림이 있어야 한다. 비면 그 상태에서 배틀러가 화면에서 사라진다.
    for (const pose of POSE_NAMES) {
      expect(cells[pose].opaque, `${pose} 실루엣 면적`).toBeGreaterThanOrEqual(MIN_OPAQUE_PIXELS);
    }

    // 서 있는 포즈는 셀 높이를 채워야 한다 — 오버월드 걷기 프레임(작고 납작함)으로
    // 되돌아가는 회귀를 여기서 잡는다.
    for (const pose of STANDING_POSES) {
      expect(cells[pose].height / CELL, `${pose} 셀 높이 점유율`).toBeGreaterThanOrEqual(MIN_CELL_FILL);
    }

    expect(cells.idle.opaque, "idle 실루엣 면적").toBeGreaterThanOrEqual(MIN_IDLE_AREA);

    expect(diffRatio(sheet, POSE_FRAME.idle, POSE_FRAME.attack), "idle vs attack").toBeGreaterThan(MIN_POSE_DIFF_RATIO);
    expect(diffRatio(sheet, POSE_FRAME.idle, POSE_FRAME.hit), "idle vs hit").toBeGreaterThan(MIN_POSE_DIFF_RATIO);
    expect(diffRatio(sheet, POSE_FRAME.attack, POSE_FRAME.hit), "attack vs hit").toBeGreaterThan(MIN_POSE_DIFF_RATIO);

    // 행 1 의 존재 이유 — 실루엣이 실제로 다른 그림이어야 한다. 행 0 칸을 복사해 넣으면
    // 픽셀 차이는 0 이 되고 여기서 걸린다.
    expect(silhouetteDiff(sheet, POSE_FRAME.defend, POSE_FRAME.idle), "defend vs idle 실루엣")
      .toBeGreaterThan(MIN_SILHOUETTE_DIFF_RATIO);
    expect(silhouetteDiff(sheet, POSE_FRAME.dead, POSE_FRAME.hit), "dead vs hit 실루엣")
      .toBeGreaterThan(MIN_SILHOUETTE_DIFF_RATIO);
    expect(silhouetteDiff(sheet, POSE_FRAME.defend, POSE_FRAME.dead), "defend vs dead 실루엣")
      .toBeGreaterThan(MIN_SILHOUETTE_DIFF_RATIO);

    // 행 1 열 2 는 victory 다(2026-09-26 부터 채운다). 비어 있으면 battleFieldDom.ts 의
    // victoryFrameFor 가 idle 로 떨어져 승리 포즈가 보이지 않는다. 그림이 있고 idle 과 달라야 한다.
    const victory = measureCell(sheet, VICTORY_POSE_FRAME);
    expect(victory.opaque, "victory 실루엣 면적").toBeGreaterThanOrEqual(MIN_OPAQUE_PIXELS);
    expect(victory.height / CELL, "victory 셀 높이 점유율").toBeGreaterThanOrEqual(MIN_CELL_FILL);
    expect(diffRatio(sheet, POSE_FRAME.idle, VICTORY_POSE_FRAME), "idle vs victory").toBeGreaterThan(MIN_POSE_DIFF_RATIO);
    expect(silhouetteDiff(sheet, VICTORY_POSE_FRAME, POSE_FRAME.idle), "victory vs idle 실루엣")
      .toBeGreaterThan(MIN_SILHOUETTE_DIFF_RATIO);

    // 행 2~7 전체가 투명하다. 예전에는 행 0 바로 아래 8px 띠만 봤는데(오슬라이스 회귀 방어선),
    // 이제 런타임이 Y 를 움직이므로 띠 가드는 성립하지 않는다. 대신 **쓰지 않는 행 전체**를
    // 검사한다 — 순증이다. 뭔가 그려 두면 시트를 읽는 사람만 속는다.
    expect(opaqueInRows(sheet, 2 * CELL, ROWS * CELL), "행 2~7").toBe(0);

    // 서 있는 세 포즈만 셀 높이를 채워야 한다. dead 는 누운 그림이라 세로가 짧다(실측 fill 29~32%).
    const tallest = Math.max(cells.idle.height, cells.attack.height, cells.hit.height, cells.defend.height);
    expect(tallest / CELL, "가장 큰 실루엣의 셀 높이 점유율").toBeGreaterThanOrEqual(MIN_TALLEST_FILL);

    // dead 는 바닥에 붙어야 한다 — 정사각 크롭이 세로 중앙에 놓으면 시체가 공중에 뜬다
    // (생성기의 bottomAlignFrame 이 내려 붙인다).
    expect(cells.dead.bottom, "dead 실루엣 하단").toBeGreaterThanOrEqual(CELL - 2);
  });
});

function sheetUrl(slug: string): URL {
  return new URL(`../public/assets/generated/starter/${slug}-battle.png`, import.meta.url);
}

/** 셀 좌표 → 픽셀 오프셋. `bottom` 은 셀 안에서 실루엣이 끝나는 y(0-based, 없으면 -1). */
function measureCell(
  sheet: Sheet,
  frame: Frame
): { readonly opaque: number; readonly height: number; readonly bottom: number } {
  let opaque = 0;
  let minY = CELL;
  let maxY = -1;
  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      const index = ((frame.row * CELL + y) * sheet.width + frame.col * CELL + x) * 4;
      if ((sheet.pixels[index + 3] ?? 0) < OPAQUE) continue;
      opaque += 1;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { opaque, height: maxY < 0 ? 0 : maxY - minY + 1, bottom: maxY };
}

function diffRatio(sheet: Sheet, a: Frame, b: Frame): number {
  let differing = 0;
  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      const indexA = ((a.row * CELL + y) * sheet.width + a.col * CELL + x) * 4;
      const indexB = ((b.row * CELL + y) * sheet.width + b.col * CELL + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        if (sheet.pixels[indexA + channel] !== sheet.pixels[indexB + channel]) {
          differing += 1;
          break;
        }
      }
    }
  }
  return differing / (CELL * CELL);
}

/** 마스크 XOR / 합집합 — 실루엣이 얼마나 다른지. 합집합이 0 이면 0. */
function silhouetteDiff(sheet: Sheet, a: Frame, b: Frame): number {
  let differing = 0;
  let union = 0;
  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      const indexA = ((a.row * CELL + y) * sheet.width + a.col * CELL + x) * 4;
      const indexB = ((b.row * CELL + y) * sheet.width + b.col * CELL + x) * 4;
      const onA = (sheet.pixels[indexA + 3] ?? 0) >= OPAQUE;
      const onB = (sheet.pixels[indexB + 3] ?? 0) >= OPAQUE;
      if (onA !== onB) differing += 1;
      if (onA || onB) union += 1;
    }
  }
  return union === 0 ? 0 : differing / union;
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
