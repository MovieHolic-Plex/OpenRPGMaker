import { describe, expect, it } from "vitest";
import { getHarness, workshopHarnesses } from "@/harnesses/_core/registry";
import { makePalette, renderGrid } from "@/harnesses/_core/workshop/grid";
import type { Grid, Verdict } from "@/harnesses/_core/workshop/types";
import { interiorGate, interiorHardCheck, parseInteriorVerdict, TOP_MIN } from "@/harnesses/interior-props/editor/checks";
import { cropCells, itemFromDefinition, itemFromSpec, newItemKey, specObjects, VIEW_FAIL } from "@/harnesses/interior-props/editor/items";
import { basePaletteEntries, INTERIOR_SHADOWS, paletteForItem, V5_RAMPS } from "@/harnesses/interior-props/editor/palette";

const sheet = (columns: number, rows: number, fill: (tile: number) => [number, number, number, number]) => {
  const width = columns * 16, height = rows * 16, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fill(Math.floor(y / 16) * columns + Math.floor(x / 16)), (y * width + x) * 4);
  return { width, height, data };
};

describe("interior-props 매니페스트", () => {
  it("에디터 화면만 있고 공방 실행기를 지연 로드한다", async () => {
    const harness = getHarness("interior-props")!;
    expect(harness.entrypoints).toEqual({ cli: false, editorUi: true, assistantTool: false });
    expect(workshopHarnesses(null).map((h) => h.id)).toContain("interior-props");
    expect(workshopHarnesses("monster-collect").map((h) => h.id)).toContain("interior-props");
    expect(typeof harness.workshop).toBe("function");
  });
});

describe("팔레트", () => {
  it("v5 램프 29개 + 그림자 2색", () => {
    expect(V5_RAMPS.length).toBe(29);
    expect(V5_RAMPS[0]).toEqual({ name: "wood", colors: expect.arrayContaining(["#9a5435"]) });
    const entries = basePaletteEntries();
    expect(entries.find((e) => e.key === "wood:4")?.rgba).toEqual([0x9a, 0x54, 0x35, 255]);
    expect(INTERIOR_SHADOWS.map((e) => e.rgba[3])).toEqual([110, 58]);
  });
  it("지금 그림의 v5 밖 색은 own:N 으로 더한다", () => {
    const current = { width: 2, height: 1, data: new Uint8ClampedArray([0x9a, 0x54, 0x35, 255, 1, 2, 3, 255]) };
    const palette = paletteForItem(current);
    expect(palette.byKey.get("own:0")?.rgba).toEqual([1, 2, 3, 255]);
    expect(palette.byColor.get("154,84,53,255")?.key).toBe("wood:4");
  });
});

describe("기물 사전", () => {
  it("번들 사양 414종, 캔버스는 칸 경계, padTop 은 지금 그림의 투명 윗줄", () => {
    const objects = specObjects();
    expect(objects.length).toBe(414);
    const [, crate] = objects.find(([key]) => key === "crate:cabbage")!;
    const blank = { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 4) };
    blank.data.fill(255, 4 * 16 * 3); // 위 3줄은 투명, 나머지 칠함
    const item = itemFromSpec("crate:cabbage", crate, blank);
    expect([item.width, item.height, item.padTop, item.kind, item.isNew]).toEqual([16, 16, 3, "floor", false]);
  });
  it("cropCells 는 시트 48칸 폭에서 dx·dy 대로 잘라 붙인다", () => {
    const image = sheet(48, 2, (tile) => [tile % 256, 0, 0, 255]);
    const crop = cropCells(image, [[0, -1, 1, 3], [0, 0, 49, 3]]);
    expect([crop.width, crop.height]).toEqual([16, 32]);
    expect(crop.data[0]).toBe(1);
    expect(crop.data[16 * 16 * 4]).toBe(49);
  });
  it("새 기물 정의: 높이는 16 배수로 올리고 남는 위를 padTop 으로", () => {
    const item = itemFromDefinition({ key: "new:herb", title: "약초 걸이", description: "말린 약초", tilesW: 2, tilesH: 1, rise: 10, kind: "wall", category: "약방", use: [], refs: [] });
    expect([item.width, item.height, item.padTop, item.isNew]).toEqual([32, 32, 6, true]);
    expect(newItemKey("약초 걸이", new Set(["new:약초-걸이"]))).toBe("new:약초-걸이-2");
  });
  it("3/4 전수조사 위반 원본 목록이 있다", () => {
    expect(VIEW_FAIL.size).toBe(44);
  });
});

describe("깨짐 검사·꼭대기 면 판정", () => {
  const palette = makePalette(basePaletteEntries());
  const item = itemFromDefinition({ key: "new:box", title: "상자", description: "", tilesW: 1, tilesH: 1, rise: 0, kind: "floor", category: "c", use: [], refs: [] });
  const solid = (rows: (string | null)[][]): Grid => ({ width: rows[0].length, height: rows.length, cells: rows.flat() });
  const box = (): (string | null)[][] => Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => (x >= 2 && x <= 13 && y >= 4 ? "wood:4" : null)));

  it("멀쩡한 격자는 통과", () => {
    expect(interiorHardCheck(item, solid(box()), null)).toEqual([]);
    expect(renderGrid(solid(box()), palette).width).toBe(16);
  });
  it("크기·빈 그림·귀퉁이 배경·위 패딩·접지선", () => {
    expect(interiorHardCheck(item, solid([["wood:4"]]), null)[0]).toContain("크기");
    expect(interiorHardCheck(item, solid(box().map((r) => r.map(() => null))), null)[0]).toContain("비었다");
    const filled = box().map((r) => r.map(() => "wood:4"));
    expect(interiorHardCheck(item, solid(filled), null).join()).toContain("귀퉁이");
    const floating = box().map((r, y) => (y === 15 ? r.map(() => null) : r));
    expect(interiorHardCheck(item, solid(floating), null).join()).toContain("접지선");
    const padded = { ...item, padTop: 6 };
    expect(interiorHardCheck(padded, solid(box()), null).join()).toContain("위 패딩");
  });
  const verdict = (topRows: number | null): Verdict => ({ verdict: "PASS", codes: [], top: "윗판", topRows, reasons: "", fix: "", worse: false });
  it(`가구는 꼭대기 윗면 ${TOP_MIN}행 미만이면 FRONT 로 떨어뜨린다`, () => {
    const gated = interiorGate(item, verdict(2));
    expect([gated.verdict, gated.codes]).toEqual(["FAIL", ["FRONT"]]);
    expect(gated.fix).toContain("3행");
    expect(interiorGate(item, verdict(3)).verdict).toBe("PASS");
    expect(interiorGate({ ...item, kind: "hang" }, verdict(1)).verdict).toBe("PASS");
    expect(interiorGate(item, verdict(null)).verdict).toBe("PASS");
  });
  it("검수 답 해석: top_rows·대소문자·못 읽은 답", () => {
    expect(parseInteriorVerdict('```json\n{"verdict":"pass","codes":[],"top":"윗판 4행","top_rows":4,"reasons":"ok","fix":"","worse":false}\n```'))
      .toMatchObject({ verdict: "PASS", topRows: 4 });
    expect(parseInteriorVerdict("모르겠어요")).toMatchObject({ verdict: "FAIL", codes: ["READ"], reasons: expect.stringContaining("검수 답") });
  });
});
