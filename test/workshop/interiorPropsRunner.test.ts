import { describe, expect, it } from "vitest";
import { getHarness, workshopHarnesses } from "@/harnesses/_core/registry";
import { makePalette, renderGrid } from "@/harnesses/_core/workshop/grid";
import type { DrawContext, Grid, Verdict, WorkshopEnv } from "@/harnesses/_core/workshop/types";
import { interiorGate, interiorHardCheck, parseInteriorVerdict, TOP_MIN } from "@/harnesses/interior-props/editor/checks";
import { cropCells, itemFromDefinition, itemFromSpec, newItemKey, specObjects, VIEW_FAIL } from "@/harnesses/interior-props/editor/items";
import { DIRECTIONS, NEW_DIRECTIONS, drawBrief, reviewBrief } from "@/harnesses/interior-props/editor/prompts";
import { createInteriorRunner } from "@/harnesses/interior-props/editor/runner";
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
  it("번들 사양 527종, 캔버스는 칸 경계, padTop 은 지금 그림의 투명 윗줄", () => {
    const objects = specObjects();
    expect(objects.length).toBe(527);
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
  it("cropCells 는 반투명 그림자 픽셀을 그대로 보존해 shadow:0 으로 읽힌다", () => {
    const image = sheet(48, 2, () => [0, 0, 0, 0]);
    image.data.set([28, 20, 24, 110], 16 * 4); // 칸 1 의 (0,0): 시트 x=16, y=0
    const crop = cropCells(image, [[0, 0, 1, 3]]);
    expect(Array.from(crop.data.slice(0, 4))).toEqual([28, 20, 24, 110]);
    const palette = paletteForItem(crop);
    expect(palette.byColor.get("28,20,24,110")?.key).toBe("shadow:0");
    expect([...palette.byKey.keys()].some((key) => key.startsWith("own:"))).toBe(false);
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

const fakeEnv = (): WorkshopEnv & { loaded: string[] } => {
  const loaded: string[] = [];
  return {
    loaded,
    loadImage: async (url) => {
      loaded.push(url);
      if (url.includes("interior-chipset")) return sheet(48, 131, (tile) => (tile % 7 === 0 ? [0x9a, 0x54, 0x35, 255] : [0, 0, 0, 0]));
      return { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 4).fill(200) };
    },
    encodePng: (image) => `data:image/png;fake,${image.width}x${image.height}`,
    assetUrl: (path) => `/${path}`,
  };
};

describe("interior-props 실행기", () => {
  it("prepare 가 한 번 실패해도 다음 호출은 다시 시도한다(거부된 약속을 굳히지 않는다)", async () => {
    const runner = createInteriorRunner();
    const env = fakeEnv();
    let failures = 1;
    const base = env.loadImage;
    env.loadImage = async (url) => {
      if (failures > 0) { failures -= 1; throw new Error("네트워크"); }
      return base(url);
    };
    await expect(runner.prepare(env)).rejects.toThrow("네트워크");
    await expect(runner.prepare(env)).resolves.toBeUndefined();
  });

  it("방향: 있는 기물은 DIRECTIONS, 새 기물은 NEW_DIRECTIONS, 5장", async () => {
    const runner = createInteriorRunner();
    const env = fakeEnv();
    await runner.prepare(env);
    await runner.prepare(env);
    expect(env.loaded.filter((u) => u.includes("interior-chipset")).length).toBe(1);
    const items = runner.items([{ key: "new:herb", title: "약초 걸이", description: "말린 약초", tilesW: 1, tilesH: 1, rise: 16, kind: "wall", category: "약방", use: [], refs: ["bookshelf"] }]);
    expect(items.length).toBe(415);
    const existing = items.find((i) => i.key === "crate:cabbage")!;
    const fresh = items.find((i) => i.key === "new:herb")!;
    expect(runner.directions(existing)).toEqual(DIRECTIONS);
    expect(runner.directions(fresh)).toEqual(NEW_DIRECTIONS);
    expect(runner.candidates).toBe(5);
    expect(runner.currentGrid(fresh)).toBeNull();
  });

  it("기준 그림: 가구에는 벽면 걸이·바닥 무늬와 3/4 위반 원본을 주지 않는다", async () => {
    const runner = createInteriorRunner();
    await runner.prepare(fakeEnv());
    const items = runner.items([]);
    const floorItem = items.find((i) => i.kind === "floor")!;
    const anchors = runner.anchors(floorItem, []);
    const kindOf = new Map(items.map((i) => [i.key, i.kind]));
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.length).toBeLessThanOrEqual(4);
    expect(anchors.every((a) => kindOf.get(a.itemKey) !== "hang" && kindOf.get(a.itemKey) !== "flat")).toBe(true);
    expect(anchors.some((a) => VIEW_FAIL.has(a.itemKey))).toBe(false);
    expect(anchors.some((a) => a.itemKey === floorItem.key)).toBe(false);
  });

  it("그리기 지시문: 캔버스·방향·꼭대기 면 규칙·지난 판정·답 형식", async () => {
    const runner = createInteriorRunner();
    const env = fakeEnv();
    await runner.prepare(env);
    const item = runner.items([]).find((i) => i.key === "crate:cabbage")!;
    const ctx: DrawContext = {
      item, palette: runner.palette(item), direction: DIRECTIONS[2], roundNote: "더 밝은 나무", redrawNote: "", attempt: 2, maxAttempts: 3,
      previousGrid: runner.currentGrid(item), lastVerdict: { verdict: "FAIL", codes: ["FRONT"], top: "윗판 1행", topRows: 1, reasons: "납작", fix: "윗판 3행으로", worse: false },
      current: runner.currentGrid(item), anchors: [], rejected: [], notes: [],
    };
    const brief = drawBrief(ctx);
    expect(brief).toContain(`캔버스 ${item.width}×${item.height}px`);
    expect(brief).toContain("방향 C");
    expect(brief).toContain("3행 이상");
    expect(brief).toContain("윗판 3행으로");
    expect(brief).toContain("생물·조각상·가는 막대는 꼭대기 면 규칙 대신 받침대 윗면만 지킨다");
    expect(brief).toContain("더 밝은 나무");
    expect(brief).toContain('"legend"');
    const messages = await runner.drawMessages(ctx, env);
    const parts = messages[1].content as { type: string }[];
    expect(parts.filter((p) => p.type === "image_url").length).toBeGreaterThanOrEqual(10);
  });

  it("검수 지시문: 꼭대기 면을 먼저 재고 JSON 하나로", async () => {
    const runner = createInteriorRunner();
    const env = fakeEnv();
    await runner.prepare(env);
    const item = runner.items([]).find((i) => i.key === "crate:cabbage")!;
    const grid = runner.currentGrid(item)!;
    const text = reviewBrief({ item, palette: runner.palette(item), direction: DIRECTIONS[0], attempt: 1, maxAttempts: 3, candidate: grid, current: grid, anchors: [], previousVerdict: null });
    expect(text).toContain("꼭대기 면");
    expect(text).toContain("top_rows");
    expect(text).toContain("생물·조각상·가는 막대는 시점 판정을 면제하되(받침대 윗면은 본다) WORSE·READ 는 본다.");
    const messages = await runner.reviewMessages({ item, palette: runner.palette(item), direction: DIRECTIONS[0], attempt: 1, maxAttempts: 3, candidate: grid, current: grid, anchors: [], previousVerdict: null }, env);
    expect((messages[1].content as { type: string }[]).some((p) => p.type === "image_url")).toBe(true);
  });
});