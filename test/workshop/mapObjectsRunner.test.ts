// 공방 「맵 기물」(map-objects): 지금 맵 칩셋에 없는 물건을 그 칩셋 색·화풍으로 그려 그 칩셋에 굽는다.
import { describe, expect, it } from "vitest";
import { getHarness, workshopHarnesses } from "@/harnesses/_core/registry";
import type { ContentPart } from "@/ai/llmClient";
import type { DrawContext, Grid, ItemDefinition, RgbaImage, WorkshopEnv, WorkshopTilesetSource } from "@/harnesses/_core/workshop/types";
import { mapObjectHardCheck, parseMapObjectVerdict } from "@/harnesses/map-objects/editor/checks";
import { mapItemFromDefinition, paletteFromHexes } from "@/harnesses/map-objects/editor/items";
import { MAP_DIRECTIONS } from "@/harnesses/map-objects/editor/prompts";
import { createMapObjectRunner } from "@/harnesses/map-objects/editor/runner";
import { dominantColor, objectImage, paletteFromImages, sheetExcerpt, similarObjects } from "@/harnesses/map-objects/editor/sheet";

function image(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4);
  return { width, height, data };
}

/** 4×2 칸 시트: 칸 번호마다 다른 색(빨강 = 칸 번호×10) */
function source(objects: WorkshopTilesetSource["objects"] = []): WorkshopTilesetSource {
  return {
    id: "forest", name: "숲", tileSize: 16, tilesPerRow: 4,
    image: image(64, 32, (x, y) => [(Math.floor(y / 16) * 4 + Math.floor(x / 16)) * 10, 100, 50, 255]),
    objects,
  };
}

const def = (overrides: Partial<ItemDefinition> = {}): ItemDefinition => ({
  key: "new:돌-이정표", title: "돌 이정표", description: "이끼 낀 돌 이정표", tilesW: 1, tilesH: 1, rise: 16,
  kind: "floor", category: "숲", use: [], refs: [], tilesetId: "forest", palette: ["#101010", "#808080", "#f0f0f0"], ...overrides,
});

describe("map-objects 매니페스트", () => {
  it("에디터 공방에 보이고 실행기를 지연 로드한다", async () => {
    const harness = getHarness("map-objects")!;
    expect(harness.entrypoints).toEqual({ cli: false, editorUi: true, assistantTool: false });
    expect(workshopHarnesses(null).map((h) => h.id)).toContain("map-objects");
    expect((await harness.workshop!()).harnessId).toBe("map-objects");
  });
});

describe("칩셋에서 팔레트 뽑기", () => {
  it("자주 쓴 불투명 색을 어두운 것부터, 거의 같은 색은 하나로, 반투명은 뺀다", () => {
    const sheet = image(4, 1, (x) => [[200, 200, 200, 255], [201, 201, 201, 255], [10, 10, 10, 255], [90, 0, 0, 120]][x] as [number, number, number, number]);
    expect(paletteFromImages([{ image: sheet, weight: 1 }])).toEqual(["#0a0a0a", "#c8c8c8"]);
  });
  it("닮은 물체(가중치 큰 그림)의 색이 시트 전체의 땅 색보다 먼저 뽑힌다", () => {
    const ground = image(10, 10, () => [40, 160, 40, 255]);
    const object = image(2, 1, () => [180, 90, 30, 255]);
    expect(paletteFromImages([{ image: ground, weight: 1 }, { image: object, weight: 80 }], 1)).toEqual(["#b45a1e"]);
  });
  it("정의의 팔레트를 c:번호 키로, 없으면 회색 단으로", () => {
    const palette = paletteFromHexes(["#101010", "#FFFFFF", "#101010", "bad"]);
    expect(palette.entries.map((e) => e.key)).toEqual(["c:0", "c:1"]);
    expect(palette.byKey.get("c:1")?.rgba).toEqual([255, 255, 255, 255]);
    expect(paletteFromHexes(undefined).entries.length).toBeGreaterThan(3);
  });
  it("가장 많이 칠한 색을 땅 색으로 쓴다", () => {
    expect(dominantColor(image(8, 8, () => [1, 2, 3, 255]))).toEqual([1, 2, 3, 255]);
  });
});

describe("칩셋 물체를 화풍 기준으로", () => {
  it("물체를 아래층·위층 순서로 겹쳐 그리고, 시트 밖(이식) 칸이 있으면 쓰지 않는다", () => {
    const src = source();
    const tree = objectImage(src, { name: "나무", description: "", layers: [[[5]], [[-1]]] })!;
    expect([tree.width, tree.height, tree.data[0]]).toEqual([16, 16, 50]);
    const two = objectImage(src, { name: "바위", description: "", layers: [[[0, 1]], [[2, -1]]] })!;
    expect([two.width, two.data[0]]).toEqual([32, 20]); // 위층 칸 2 가 아래층 칸 0 을 덮는다
    expect(objectImage(src, { name: "이식", description: "", layers: [[[999]]] })).toBeNull();
  });
  it("이름·설명 낱말이 겹치는 물체부터, 모자라면 여러 칸 물체로 채운다", () => {
    const src = source([
      { name: "꽃밭", description: "", layers: [[[1]]] },
      { name: "돌 비석", description: "오래된 비석", layers: [[[2]]] },
      { name: "큰 나무", description: "", layers: [[[3], [7]]] },
      { name: "이식된 것", description: "돌", layers: [[[500]]] },
    ]);
    expect(similarObjects(src, "돌 이정표", "이끼 낀 돌", 2).map((o) => o.name)).toEqual(["돌 비석", "큰 나무"]);
  });
  it("물체가 없는 칩셋은 색이 가장 다양한 시트 조각을 기준으로 준다", () => {
    const excerpt = sheetExcerpt(source(), 32);
    expect([excerpt.width, excerpt.height]).toEqual([32, 32]);
  });
});

describe("깨짐 검사", () => {
  const item = mapItemFromDefinition(def({ tilesH: 1, rise: 8 }));
  const grid = (rows: string[]): Grid => ({ width: rows[0]!.length, height: rows.length, cells: rows.join("").split("").map((c) => (c === "." ? null : "c:0")) });
  const blank = (): string[] => Array.from({ length: 32 }, () => ".".repeat(16));

  it("캔버스는 발밑 칸 + 솟은 px 를 16 단위로 올린 높이, 위 패딩은 비운다", () => {
    expect([item.width, item.height, item.padTop, item.tilesetId]).toEqual([16, 32, 8, "forest"]);
  });
  it("맨 아래 줄에 닿고 위 패딩이 비면 통과", () => {
    const rows = blank();
    rows[31] = "....aaaa........";
    rows[20] = "....aa..........";
    expect(mapObjectHardCheck(item, grid(rows))).toEqual([]);
  });
  it("떠 있음·패딩 침범·네 귀퉁이 배경·크기 틀림·빈 그림을 잡는다", () => {
    const floating = blank();
    floating[20] = "aaaa............";
    expect(mapObjectHardCheck(item, grid(floating)).join()).toContain("접지선");
    const padded = blank();
    padded[2] = "a...............";
    padded[31] = "a...............";
    expect(mapObjectHardCheck(item, grid(padded)).join()).toContain("위 패딩");
    const filled = blank().map(() => "a".repeat(16));
    expect(mapObjectHardCheck({ ...item, padTop: 0 }, grid(filled)).join()).toContain("배경");
    expect(mapObjectHardCheck(item, grid(["a"]))[0]).toContain("크기");
    expect(mapObjectHardCheck(item, grid(blank()))[0]).toContain("비었다");
  });
  it("바닥 무늬는 칸을 다 채워도 배경이 아니다", () => {
    const flat = mapItemFromDefinition(def({ kind: "flat", rise: 0 }));
    expect(mapObjectHardCheck(flat, grid(Array.from({ length: 16 }, () => "a".repeat(16))))).toEqual([]);
  });
  it("검수 답을 읽고, 못 읽으면 불합격", () => {
    expect(parseMapObjectVerdict('{"verdict":"pass","codes":[],"top_rows":3,"reasons":"ok","fix":""}')).toMatchObject({ verdict: "PASS", topRows: 3 });
    expect(parseMapObjectVerdict("모르겠다").verdict).toBe("FAIL");
  });
});

describe("실행기", () => {
  const env = (tileset: WorkshopTilesetSource | null): WorkshopEnv => ({
    loadImage: async () => { throw new Error("쓰지 않는다"); },
    encodePng: (img) => `data:image/png;base64,${img.width}x${img.height}`,
    assetUrl: (path) => `/${path}`,
    tilesetSource: async () => tileset,
  });
  const ctxFor = (runner: ReturnType<typeof createMapObjectRunner>, defs: ItemDefinition[]): DrawContext => {
    const item = runner.items(defs)[0]!;
    return {
      item, palette: runner.palette(item), direction: MAP_DIRECTIONS[0]!, roundNote: "", redrawNote: "", attempt: 1, maxAttempts: 3,
      previousGrid: null, lastVerdict: null, current: null, anchors: [], rejected: [], notes: [],
    };
  };

  it("칩셋이 적힌 정의만 기물이 되고, 팔레트는 정의에 적힌 색이다", () => {
    const runner = createMapObjectRunner();
    const items = runner.items([def(), def({ key: "new:옛것", tilesetId: undefined })]);
    expect(items.map((i) => i.key)).toEqual(["new:돌-이정표"]);
    expect(runner.palette(items[0]!).byKey.get("c:2")?.rgba).toEqual([240, 240, 240, 255]);
    expect(runner.currentGrid(items[0]!)).toBeNull();
    expect(runner.directions(items[0]!).slice(0, runner.candidates).map((d) => d.letter)).toEqual(["A", "B", "C"]);
  });

  it("그리기 지시에 칩셋 이름·팔레트 키와 칩셋 물체·조각 그림을 붙인다", async () => {
    const runner = createMapObjectRunner();
    const ctx = ctxFor(runner, [def()]);
    const messages = await runner.drawMessages(ctx, env(source([{ name: "돌 비석", description: "", layers: [[[2]]] }])));
    const parts = messages[1]!.content as ContentPart[];
    const text = parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n");
    expect(text).toContain("칩셋: 숲");
    expect(text).toContain("c:0 #101010");
    expect(text).toContain("칩셋 물체: 돌 비석");
    expect(text).toContain("칩셋 조각");
    expect(parts.filter((p) => p.type === "image_url").length).toBe(2);
  });

  it("칩셋을 못 읽어도 기준 그림 없이 그린다(멈추지 않는다)", async () => {
    const runner = createMapObjectRunner();
    const ctx = ctxFor(runner, [def()]);
    const messages = await runner.drawMessages(ctx, env(null));
    expect((messages[1]!.content as ContentPart[]).filter((p) => p.type === "image_url")).toHaveLength(0);
    const review = await runner.reviewMessages({ item: ctx.item, palette: ctx.palette, direction: ctx.direction, attempt: 1, maxAttempts: 3, candidate: { width: 16, height: 32, cells: Array(512).fill(null) }, current: null, anchors: [], previousVerdict: null }, env(null));
    expect((review[1]!.content as ContentPart[]).filter((p) => p.type === "image_url")).toHaveLength(1);
  });

  it("같은 칩셋에서 고른 기물만 기준 그림이 된다", () => {
    const runner = createMapObjectRunner();
    const items = runner.items([def(), def({ key: "new:벤치", title: "벤치" }), def({ key: "new:눈사람", tilesetId: "snow" })]);
    const grid: Grid = { width: 16, height: 16, cells: Array(256).fill(null) };
    const anchors = runner.anchors(items[0]!, [
      { itemKey: "new:벤치", title: "", grid, picked: true },
      { itemKey: "new:눈사람", title: "", grid, picked: true },
    ]);
    expect(anchors.map((a) => [a.itemKey, a.title])).toEqual([["new:벤치", "벤치"]]);
  });
});
