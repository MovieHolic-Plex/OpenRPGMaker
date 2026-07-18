import { describe, expect, it } from "vitest";
import {
  detectRepeatedSectionPattern,
  sectionPatternSignature,
  type PatternScanMap,
} from "@/editor/harnessSuggestion/patternDetect";
import {
  paletteStampFromKit,
  structureKitFromPattern,
  structureKitSignature,
} from "@/editor/harnessSuggestion/structureKitModel";

const GRASS = 240;
const EMPTY = -1;

// 성벽 정단면(성 문법 정본): 데크 상변 19 → 보행면 49 → 데크 하변 109 → 정면 51 → 정면 하단 81.
const WALL_COLUMN = [19, 49, 109, 51, 81] as const;

function grassMap(width: number, height: number): {
  width: number;
  height: number;
  lowerTiles: number[];
  upperTiles: number[];
} {
  return {
    width,
    height,
    lowerTiles: new Array<number>(width * height).fill(GRASS),
    upperTiles: new Array<number>(width * height).fill(EMPTY),
  };
}

function paintColumn(map: { width: number; lowerTiles: number[] }, x: number, y0: number, tiles: readonly number[]): void {
  tiles.forEach((tile, row) => {
    map.lowerTiles[(y0 + row) * map.width + x] = tile;
  });
}

describe("detectRepeatedSectionPattern — 반복 단면 감지", () => {
  it("성벽 5줄 단면을 가로로 9회 이어 찍으면 period 1 패턴으로 잡는다", () => {
    const map = grassMap(20, 15);
    for (let x = 4; x < 13; x += 1) paintColumn(map, x, 3, WALL_COLUMN);

    const pattern = detectRepeatedSectionPattern(map as PatternScanMap);

    expect(pattern).not.toBeNull();
    expect(pattern).toMatchObject({ x: 4, y: 3, width: 9, height: 5, period: 1, repeats: 9 });
    expect(pattern!.unit.lower).toEqual([...WALL_COLUMN]);
    // 잔디(배경) 행은 단면에 붙지 않는다 — 위/아래가 전부 잔디여도 높이는 5.
    expect(pattern!.unit.upper.every((tile) => tile === EMPTY)).toBe(true);
  });

  it("반복 3회 미만이거나 어휘 3종 미만이면 침묵한다", () => {
    // 2회 반복 — 임계 미달.
    const twice = grassMap(20, 15);
    for (let x = 4; x < 6; x += 1) paintColumn(twice, x, 3, WALL_COLUMN);
    expect(detectRepeatedSectionPattern(twice as PatternScanMap)).toBeNull();

    // 단색 채우기 — 어휘 1종.
    const flat = grassMap(20, 15);
    for (let x = 0; x < 20; x += 1) paintColumn(flat, x, 3, [360, 360, 360]);
    expect(detectRepeatedSectionPattern(flat as PatternScanMap)).toBeNull();

    // 빈 잔디 맵 — 배경뿐.
    expect(detectRepeatedSectionPattern(grassMap(20, 15) as PatternScanMap)).toBeNull();
  });

  it("2열 주기(벽+창 교대) 패턴은 period 2 로 잡는다", () => {
    const map = grassMap(20, 15);
    const wall = [19, 49, 109] as const;
    const window = [19, 142, 109] as const;
    for (let repeat = 0; repeat < 3; repeat += 1) {
      paintColumn(map, 5 + repeat * 2, 4, wall);
      paintColumn(map, 6 + repeat * 2, 4, window);
    }

    const pattern = detectRepeatedSectionPattern(map as PatternScanMap);

    expect(pattern).not.toBeNull();
    expect(pattern).toMatchObject({ x: 5, y: 4, width: 6, height: 3, period: 2, repeats: 3 });
    expect(pattern!.unit.lower).toEqual([19, 19, 49, 142, 109, 109]);
  });

  it("최근 편집 영역(region)과 겹치지 않는 패턴은 무시한다", () => {
    const map = grassMap(20, 15);
    for (let x = 4; x < 13; x += 1) paintColumn(map, x, 3, WALL_COLUMN);

    const near = detectRepeatedSectionPattern(map as PatternScanMap, { region: { x: 6, y: 4, width: 2, height: 2 } });
    const far = detectRepeatedSectionPattern(map as PatternScanMap, { region: { x: 0, y: 10, width: 3, height: 3 } });

    expect(near).not.toBeNull();
    expect(far).toBeNull();
  });
});

describe("structureKit 변환 — 패턴 → 킷 → 팔레트 스탬프 왕복", () => {
  it("킷 서명이 감지 서명과 일치하고, 스탬프 셀이 단면 그대로다", () => {
    const map = grassMap(20, 15);
    for (let x = 4; x < 13; x += 1) paintColumn(map, x, 3, WALL_COLUMN);
    const pattern = detectRepeatedSectionPattern(map as PatternScanMap)!;

    const kit = structureKitFromPattern(pattern, { id: "kit_test" });

    expect(kit).toMatchObject({ id: "kit_test", kind: "section", width: 1, height: 5, learnedFrom: "user-paint" });
    expect(kit.rows.map((row) => row.tiles)).toEqual([[19], [49], [109], [51], [81]]);
    // 상위 레이어가 빈 행은 upperTiles 를 기록하지 않는다(직렬화 최소화).
    expect(kit.rows.every((row) => row.upperTiles === undefined)).toBe(true);
    expect(structureKitSignature(kit)).toBe(pattern.signature);
    expect(structureKitSignature(kit)).toBe(sectionPatternSignature(pattern.unit));

    const stamp = paletteStampFromKit(kit);
    expect(stamp.kitId).toBe("kit_test");
    expect(stamp.width).toBe(1);
    expect(stamp.height).toBe(5);
    expect(stamp.cells).toEqual([
      { dx: 0, dy: 0, layer: "lower", tile: 19 },
      { dx: 0, dy: 1, layer: "lower", tile: 49 },
      { dx: 0, dy: 2, layer: "lower", tile: 109 },
      { dx: 0, dy: 3, layer: "lower", tile: 51 },
      { dx: 0, dy: 4, layer: "lower", tile: 81 },
    ]);
  });
});
