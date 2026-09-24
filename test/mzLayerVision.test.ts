// MZ 4층 PR ④ Task 1 — 조수가 네 층을 본다: show_map_region 배열·이미지, get_map_region 기호, 타일 사용 분석, 시각 검토 투영.
import { afterEach, describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { mapVisualContent, requiresVisualReview } from "@/ai/mapVisualEvidence";
import { renderPiMapImage } from "@/ai/toolImageRenderer";
import { clearTilesetImageCache } from "@/ai/toolImageCanvas";
import { runTool } from "@/editor/tools/toolRunner";
import { FOUR_LAYER_GUIDANCE } from "@/editor/tools/mapHelpers";
import { VISION_QUERY_TOOLS } from "@/editor/tools/visionQueryTools";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { decodeDataUrlPng, installToolImageRasterDom } from "./toolImageRasterDom";

const RED = [220, 20, 20] as const;
const GREEN = [20, 200, 20] as const;
const BLUE = [20, 20, 220] as const;
const WHITE = [250, 250, 250] as const;
const COLORS = [RED, GREEN, BLUE, WHITE] as const;

/** 16px 칸 4개(빨·초·파·흰)가 한 줄로 놓인 불투명 아틀라스. */
function atlasDataUrl(): string {
  const png = new PNG({ width: 64, height: 16 });
  for (let y = 0; y < 16; y += 1) for (let x = 0; x < 64; x += 1) {
    const color = COLORS[Math.floor(x / 16)]!;
    const i = (y * 64 + x) * 4;
    png.data[i] = color[0]; png.data[i + 1] = color[1]; png.data[i + 2] = color[2]; png.data[i + 3] = 255;
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

// 지형 합성·받침이 없는 업로드 타일셋. 1=물 그룹, 2=나무 그룹.
function plainTileset(): TilesetDef {
  const count = 4;
  const pass = { up: true, down: true, left: true, right: true };
  return {
    id: "plain", name: "plain", kind: "custom", image: { type: "uploaded", id: "plain_img" },
    tileSize: 16, tilesPerRow: 4, count,
    passability: Array.from({ length: count }, () => ({ ...pass })),
    priority: Array.from({ length: count }, () => "lower" as const),
    terrain: Array.from({ length: count }, () => 0),
    tileGroups: [
      { id: "water", name: "물", role: "water", tileIds: [1] },
      { id: "tree", name: "나무", role: "tree", tileIds: [2] },
    ],
  } as unknown as TilesetDef;
}

function plainProject(width: number, height: number): { project: Project; map: GameMap } {
  const project = createBlankProject();
  project.tilesets.plain = plainTileset();
  project.assets.uploaded.plain_img = { id: "plain_img", name: "plain", kind: "tileset", dataUrl: atlasDataUrl() } as Project["assets"]["uploaded"][string];
  const map: GameMap = {
    ...project.maps[project.startMapId]!, width, height, tilesetId: "plain", events: [],
    lowerTiles: Array.from({ length: width * height }, () => 0),
    upperTiles: Array.from({ length: width * height }, () => -1),
  };
  delete map.lowerOverlayTiles;
  delete map.upperOverlayTiles;
  delete map.shadowBits;
  delete map.lowerTileStacks;
  delete map.upperTileStacks;
  delete map.background;
  project.maps[map.id] = map;
  return { project, map };
}

let restoreDom: (() => void) | null = null;
afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  clearTilesetImageCache();
});

describe("show_map_region 네 층 배열", () => {
  it("옛 맵(2·4층·그림자 없음)은 키와 값이 예전 그대로다", () => {
    const { project, map } = plainProject(3, 2);
    map.lowerTiles = [0, 1, 2, 3, 0, 1];
    map.upperTiles = [-1, 2, -1, -1, 3, -1];
    const result = runTool({ project }, "show_map_region", { mapId: map.id, x: 0, y: 0, w: 3, h: 2 });
    expect(result.ok, result.summary).toBe(true);
    expect(JSON.stringify(result.data)).toBe(JSON.stringify({
      h: 2, lower: [[0, 1, 2], [3, 0, 1]], mapId: map.id, upper: [[-1, 2, -1], [-1, 3, -1]], w: 3, x: 0, y: 0,
    }));
  });

  it("맵에 있는 선택 층만 layer2·layer4·shadow 로 영역만큼 잘라 준다", () => {
    const { project, map } = plainProject(3, 2);
    map.lowerOverlayTiles = [-1, 1, -1, 2, -1, -1];
    map.shadowBits = [0, 0, 5, 0, 15, 0];
    const result = runTool({ project }, "show_map_region", { mapId: map.id, x: 1, y: 0, w: 2, h: 2 });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.layer2).toEqual([[1, -1], [-1, -1]]);
    expect(data.shadow).toEqual([[0, 5], [15, 0]]);
    expect("layer4" in data).toBe(false);
    map.upperOverlayTiles = [3, -1, -1, -1, -1, 3];
    const withFour = runTool({ project }, "show_map_region", { mapId: map.id, x: 1, y: 0, w: 2, h: 2 }).data as Record<string, unknown>;
    expect(withFour.layer4).toEqual([[-1, -1], [-1, 3]]);
  });

  it("도구 설명이 네 층 뜻과 배열 이름을 알린다", () => {
    const description = VISION_QUERY_TOOLS.find((tool) => tool.name === "show_map_region")!.description;
    expect(description).toContain(FOUR_LAYER_GUIDANCE);
    expect(description).toContain("layer2·layer4·shadow");
  });
});

describe("show_map_region 이미지 층 순서", () => {
  // 칸 크기 32px(16px × 배율 2). 칸 가운데와 왼위 사분면 가운데를 본다.
  const pixel = (dataUrl: string, cellX: number, px = 24, py = 24): number[] => {
    const raster = decodeDataUrlPng(dataUrl);
    const i = (py * raster.width + cellX * 32 + px) * 4;
    return [raster.data[i]!, raster.data[i + 1]!, raster.data[i + 2]!];
  };

  it("1 → 2 → 그림자 → 3 → 4 순서로 겹친다", async () => {
    restoreDom = installToolImageRasterDom();
    const { project, map } = plainProject(4, 1);
    map.lowerTiles = [0, 0, 0, 0]; // 모두 빨강 바닥
    map.lowerOverlayTiles = [1, -1, -1, -1]; // 0: 2층 초록이 1층을 덮는다
    map.shadowBits = [0, 0b0001, 0b1111, 0]; // 1: 왼위만 그늘, 2: 전부 그늘
    map.upperTiles = [-1, -1, 2, 2]; // 2: 3층 파랑이 그림자를 덮는다
    map.upperOverlayTiles = [-1, -1, -1, 3]; // 3: 4층 흰색이 3층을 덮는다
    const result = runTool({ project }, "show_map_region", { mapId: map.id, x: 0, y: 0, w: 4, h: 1 });
    const url = await renderPiMapImage(project, result.data);
    expect(pixel(url, 0)).toEqual([...GREEN]);
    expect(pixel(url, 1)).toEqual([...RED]); // 오른아래 사분면은 그늘 없음
    expect(pixel(url, 1, 8, 8)).toEqual(RED.map((c) => Math.round(c * 0.5)));
    expect(pixel(url, 2, 8, 8)).toEqual([...BLUE]);
    expect(pixel(url, 3)).toEqual([...WHITE]);
  });

  it("옛 맵은 1·3층만 그린다", async () => {
    restoreDom = installToolImageRasterDom();
    const { project, map } = plainProject(2, 1);
    map.upperTiles = [-1, 2];
    const result = runTool({ project }, "show_map_region", { mapId: map.id, x: 0, y: 0, w: 2, h: 1 });
    const url = await renderPiMapImage(project, result.data);
    expect(pixel(url, 0, 8, 8)).toEqual([...RED]);
    expect(pixel(url, 1)).toEqual([...BLUE]);
  });
});

describe("get_map_region 기호는 맨 위 층", () => {
  const grid = (project: Project, map: GameMap): string =>
    (runTool({ project }, "get_map_region", { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height }).data as { grid: string[] }).grid.join("\n");

  it("4층 나무가 1층 물을 덮으면 T, 2층 물은 ~, 물·나무 아닌 4층 칸은 아래로 내려가 본다", () => {
    const { project, map } = plainProject(4, 1);
    map.lowerTiles = [1, 0, 1, 0];
    map.upperOverlayTiles = [2, -1, 3, -1];
    map.lowerOverlayTiles = [-1, 1, -1, -1];
    expect(grid(project, map)).toBe("T~~.");
  });

  it("2·4층이 없는 칸은 옛 규칙 그대로(3층 나무 아래 물 = ~)", () => {
    const { project, map } = plainProject(2, 1);
    map.lowerTiles = [1, 0];
    map.upperTiles = [2, 2];
    expect(grid(project, map)).toBe("~T");
  });
});

describe("analyze_map_tile_usage 네 층", () => {
  it("2·4층 칸을 layer2·layer4 로 세고, 층별 칸 수는 선택 층이 있을 때만 싣는다", () => {
    const { project, map } = plainProject(3, 1);
    map.lowerTiles = [0, 0, 0];
    const usage = () => runTool({ project }, "analyze_map_tile_usage", { mapId: map.id, includeDescribed: true }).data as {
      tiles: { tile: number; layers: string[]; count: number }[]; layerCells?: Record<string, number>;
    };
    expect(usage().layerCells).toBeUndefined();
    map.lowerOverlayTiles = [1, 1, -1];
    map.upperOverlayTiles = [-1, 3, -1];
    map.shadowBits = [0, 0, 4];
    const data = usage();
    expect(data.tiles.find((entry) => entry.tile === 1)).toMatchObject({ layers: ["layer2"], count: 2 });
    expect(data.tiles.find((entry) => entry.tile === 3)).toMatchObject({ layers: ["layer4"], count: 1 });
    expect(data.tiles.find((entry) => entry.tile === 0)).toMatchObject({ layers: ["lower"], count: 3 });
    expect(data.layerCells).toEqual({ "1": 3, "2": 2, "3": 0, "4": 1, shadow: 1 });
  });
});

describe("mapVisualContent 선택 층", () => {
  it("옛 맵 투영에는 새 키가 없고, 선택 층 변화는 시각 검토를 요구한다", () => {
    const { project, map } = plainProject(2, 1);
    const content = mapVisualContent(map);
    for (const key of ["lowerOverlayTiles", "upperOverlayTiles", "shadowBits"]) expect(key in content).toBe(false);
    const after = structuredClone(project);
    after.maps[map.id]!.shadowBits = [1, 0];
    expect(mapVisualContent(after.maps[map.id]!)).toMatchObject({ shadowBits: [1, 0] });
    expect(requiresVisualReview(project, after, map.id)).toBe(true);
    const layered = structuredClone(project);
    layered.maps[map.id]!.upperOverlayTiles = [-1, 3];
    expect(requiresVisualReview(project, layered, map.id)).toBe(true);
    expect(requiresVisualReview(project, structuredClone(project), map.id)).toBe(false);
  });
});
