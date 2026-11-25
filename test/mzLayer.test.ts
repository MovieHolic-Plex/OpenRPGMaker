import { describe, expect, it, afterEach } from "vitest";
import { applyMapDeltas, diffMapsForDelta } from "@/ai/piAgent/mapDelta";
import { mapRegionImagePayload } from "@/ai/mapViewportContext";
import { summarizeAgentGhostPreviewForProjectDiff } from "@/editor/agentGhostPreview";
import { runTool, type ToolContext } from "@/editor/tools";
import { summarizeChanges, tileChangedMapIds } from "@/editor/tools/changeset";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { EXTRA_LAYER_KEYS, layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { PNG } from "pngjs";
import { mapVisualContent, requiresVisualReview } from "@/ai/mapVisualEvidence";
import { renderPiMapImage } from "@/ai/toolImageRenderer";
import { clearTilesetImageCache } from "@/ai/toolImageCanvas";
import { FOUR_LAYER_GUIDANCE, FOUR_LAYER_GUIDANCE_SHORT } from "@/editor/tools/mapHelpers";
import { VISION_QUERY_TOOLS } from "@/editor/tools/visionQueryTools";
import { decodeDataUrlPng, installToolImageRasterDom } from "./toolImageRasterDom";
import { isolateTimers } from "./mergedTeardown";

// MZ 4층의 고스트 증분·변경 집계 — 계획 docs/superpowers/plans/2026-09-25-mz-layers-assistant.md Task 4.
// 2층·4층·그림자만 바꾼 쓰기도 증분·고스트 칸·tilesChanged·재검사 대상 맵에 잡혀야 하고, 옛 맵은 전과 같아야 한다.
describe("mzLayerGhostAccounting", () => {
  isolateTimers();
  const MAP_ID = "map_blank_start";
  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
  function project(): Project {
    return createBlankProject();
  }
  function mapOf(p: Project): GameMap {
    return p.maps[MAP_ID]!;
  }
  function idx(map: GameMap, x: number, y: number): number {
    return y * map.width + x;
  }
  /** 워커의 섀도우 추적을 흉내 낸다 — diff 하고 그 결과로 섀도우를 전진시킨다. */
  function relay(before: Record<string, GameMap>, after: Record<string, GameMap>) {
    const deltas = diffMapsForDelta(before, after);
    return { deltas, shadow: applyMapDeltas(before, deltas) };
  }
  function expectSameLayers(actual: GameMap, expected: GameMap): void {
    expect(actual.lowerTiles).toEqual(expected.lowerTiles);
    expect(actual.upperTiles).toEqual(expected.upperTiles);
    for (const key of EXTRA_LAYER_KEYS) expect(actual[key], key).toEqual(expected[key]);
  }
  describe("mapDelta — 2층·4층·그림자", () => {
    it("선택 층이 새로 생기면 증분에 실리고, 얹으면 원본과 같아진다", () => {
      const base = project();
      const after = clone(base);
      const map = mapOf(after);
      setLayerTileAt(map, 2, idx(map, 3, 2), 40);
      setLayerTileAt(map, 4, idx(map, 5, 2), 41);
      setShadowAt(map, idx(map, 6, 2), 0b0101);

      const { deltas, shadow } = relay(clone(base.maps), after.maps);
      expect(deltas).toHaveLength(1);
      const layers = deltas[0]!.layers ?? [];
      expect(layers.map((layer) => layer.layer)).toEqual(["layer2", "layer4", "shadow"]);
      expect(layers[0]).toEqual({ layer: "layer2", cells: [{ i: idx(map, 3, 2), t: 40 }] });
      expectSameLayers(shadow[MAP_ID]!, map);
    });

    it("칸 수정·많은 칸(통째)·층 사라짐(absent)까지 왕복한다", () => {
      const base = project();
      const start = clone(base);
      const map = mapOf(start);
      setLayerTileAt(map, 2, idx(map, 1, 1), 7);
      setShadowAt(map, idx(map, 2, 2), 1);
      let shadow = clone(start.maps);

      // 1) 한 칸 수정 → 칸 목록
      const edit = clone(start);
      setLayerTileAt(mapOf(edit), 2, idx(map, 1, 1), 8);
      let step = relay(shadow, edit.maps);
      expect(step.deltas[0]!.layers).toEqual([{ layer: "layer2", cells: [{ i: idx(map, 1, 1), t: 8 }] }]);
      shadow = step.shadow;
      expectSameLayers(shadow[MAP_ID]!, mapOf(edit));

      // 2) 층 대부분을 칠함 → full
      const many = clone(edit);
      const manyMap = mapOf(many);
      for (let i = 0; i < manyMap.width * manyMap.height; i += 1) setLayerTileAt(manyMap, 4, i, 9);
      step = relay(shadow, many.maps);
      expect(step.deltas[0]!.layers?.[0]).toMatchObject({ layer: "layer4" });
      expect(step.deltas[0]!.layers?.[0]?.full).toHaveLength(manyMap.width * manyMap.height);
      shadow = step.shadow;
      expectSameLayers(shadow[MAP_ID]!, manyMap);

      // 3) 정리(compactMapLayers)로 키가 사라짐 → absent 로 키를 지운다
      const gone = clone(many);
      delete mapOf(gone).shadowBits;
      delete mapOf(gone).upperOverlayTiles;
      step = relay(shadow, gone.maps);
      expect(step.deltas[0]!.layers).toEqual([{ layer: "layer4", absent: true }, { layer: "shadow", absent: true }]);
      shadow = step.shadow;
      expect("shadowBits" in shadow[MAP_ID]!).toBe(false);
      expect("upperOverlayTiles" in shadow[MAP_ID]!).toBe(false);
      expectSameLayers(shadow[MAP_ID]!, mapOf(gone));
    });

    it("크기가 바뀐 맵은 선택 층도 통째로 보내 새 길이로 맞춘다", () => {
      const base = project();
      const after = clone(base);
      const map = mapOf(after);
      setLayerTileAt(map, 2, idx(map, 1, 1), 5);
      const before = clone(after.maps);
      // 가로 +2 — 좌상단 기준으로 옮긴 결과를 흉내 낸다.
      const grown = mapOf(after);
      const width = grown.width + 2;
      const remap = (values: number[], empty: number) => Array.from({ length: width * grown.height }, (_, i) => {
        const x = i % width;
        const y = Math.floor(i / width);
        return x < grown.width ? values[y * grown.width + x]! : empty;
      });
      grown.lowerTiles = remap(grown.lowerTiles, 0);
      grown.upperTiles = remap(grown.upperTiles, -1);
      grown.lowerOverlayTiles = remap(grown.lowerOverlayTiles!, -1);
      grown.width = width;
      const { deltas, shadow } = relay(before, after.maps);
      expect(deltas[0]!.layers?.find((layer) => layer.layer === "layer2")?.full).toHaveLength(width * grown.height);
      expectSameLayers(shadow[MAP_ID]!, grown);
      expect(layerTileAt(shadow[MAP_ID]!, 2, 1 * width + 1)).toBe(5);
    });

    it("옛 맵(선택 층 없음)의 증분은 선택 층 항목이 없고 JSON 이 1·3층 증분 그대로다", () => {
      const base = project();
      const after = clone(base);
      const map = mapOf(after);
      map.lowerTiles[idx(map, 2, 2)] = 3;
      map.upperTiles[idx(map, 4, 4)] = 5;
      const { deltas, shadow } = relay(clone(base.maps), after.maps);
      expect(JSON.stringify(deltas)).toBe(JSON.stringify([{
        mapId: MAP_ID,
        layers: [
          { layer: "lower", cells: [{ i: idx(map, 2, 2), t: 3 }] },
          { layer: "upper", cells: [{ i: idx(map, 4, 4), t: 5 }] },
        ],
      }]));
      for (const key of EXTRA_LAYER_KEYS) expect(key in shadow[MAP_ID]!, key).toBe(false);
    });

    it("실제 도구(stamp_layer_block·paint_shadow)가 쓴 선택 층이 워커 섀도우와 브라우저 초안에 같이 남는다", () => {
      const ctx: ToolContext = { project: project() };
      let shadow = clone(ctx.project.maps);
      let browser = clone(ctx.project.maps);
      const calls: Array<[string, Record<string, unknown>]> = [
        ["stamp_layer_block", { mapId: MAP_ID, x: 2, y: 2, layers: { "2": [[30, 31]], "4": [[-1, 32]] } }],
        ["paint_shadow", { mapId: MAP_ID, cells: [{ x: 5, y: 5, quarters: ["tl", "br"] }] }],
        ["tile_erase", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 2, h: 1 }, layer: "2" }],
      ];
      for (const [name, args] of calls) {
        const result = runTool(ctx, name, args);
        expect(result.ok, `${name}: ${result.summary}`).toBe(true);
        const deltas = diffMapsForDelta(shadow, ctx.project.maps);
        shadow = applyMapDeltas(shadow, deltas);
        browser = applyMapDeltas(browser, JSON.parse(JSON.stringify(deltas)));
        expectSameLayers(shadow[MAP_ID]!, mapOf(ctx.project));
        expectSameLayers(browser[MAP_ID]!, mapOf(ctx.project));
      }
      expect(shadowAt(browser[MAP_ID]!, idx(mapOf(ctx.project), 5, 5))).toBe(0b1001);
      expect("lowerOverlayTiles" in browser[MAP_ID]!).toBe(false);
    });
  });
  describe("changeset — 선택 층 변경 집계", () => {
    it("2층만 바꾼 쓰기도 tilesChanged 와 재검사 대상 맵에 잡히고 맵 속성 변경으로 새지 않는다", () => {
      const before = project();
      const after = clone(before);
      const map = mapOf(after);
      setLayerTileAt(map, 2, idx(map, 1, 1), 44);
      setLayerTileAt(map, 2, idx(map, 2, 1), 44);
      setLayerTileAt(map, 4, idx(map, 2, 1), 45); // 같은 칸의 4층 — 칸 수는 1
      setShadowAt(map, idx(map, 3, 3), 2);
      const summary = summarizeChanges(before, after);
      expect(summary.tilesChanged).toBe(3);
      expect(summary.mapPropertiesChanged).toBe(0);
      expect(tileChangedMapIds(before, after)).toEqual([MAP_ID]);
    });

    it("paint_tiles 2층 호출의 diff.tilesChanged 가 0 이 아니다", () => {
      const ctx: ToolContext = { project: project() };
      const result = runTool(ctx, "paint_tiles", { mapId: MAP_ID, layer: "2", mode: "cells", tile: 20, cells: [{ x: 3, y: 3 }, { x: 4, y: 3 }] });
      expect(result.ok, result.summary).toBe(true);
      expect(result.diff?.tilesChanged).toBe(2);
      expect(result.diff?.mapPropertiesChanged).toBe(0);
    });

    it("빈 선택 층 배열이 생기거나 사라지는 것만으로는 바뀐 칸이 아니다", () => {
      const before = project();
      const after = clone(before);
      const map = mapOf(after);
      map.lowerOverlayTiles = new Array<number>(map.width * map.height).fill(-1);
      expect(summarizeChanges(before, after).tilesChanged).toBe(0);
      expect(tileChangedMapIds(before, after)).toEqual([]);
    });

    it("옛 맵은 전과 같이 1·3층만 센다", () => {
      const before = project();
      const after = clone(before);
      const map = mapOf(after);
      map.lowerTiles[idx(map, 1, 1)] = 9;
      map.upperTiles[idx(map, 1, 1)] = 9;
      map.upperTiles[idx(map, 2, 1)] = 9;
      expect(summarizeChanges(before, after).tilesChanged).toBe(2);
      expect(tileChangedMapIds(before, clone(before))).toEqual([]);
    });
  });
  describe("고스트 — 선택 층 변화 칸 표시", () => {
    it("2층·그림자는 아래 칸, 4층은 위 칸으로 표시하고 타일 id 는 그 칸에 보이는 선택 층 타일이다", () => {
      const base = project();
      const draft = clone(base);
      const map = mapOf(draft);
      setLayerTileAt(map, 2, idx(map, 3, 2), 40);
      setLayerTileAt(map, 4, idx(map, 5, 2), 41);
      setShadowAt(map, idx(map, 6, 2), 1);
      const previews = summarizeAgentGhostPreviewForProjectDiff(base, draft);
      expect(previews).toHaveLength(1);
      const cells = [...previews[0]!.cells].sort((a, b) => a.x - b.x);
      expect(cells.map(({ x, y, layer }) => ({ x, y, layer }))).toEqual([
        { x: 3, y: 2, layer: "lower" },
        { x: 5, y: 2, layer: "upper" },
        { x: 6, y: 2, layer: "lower" },
      ]);
      expect(cells[0]!.tileId).toBe(40);
      expect(cells[1]!.tileId).toBe(41);
    });

    it("같은 칸의 1층도 바뀌면 셀은 하나이고 보이는 맨 위(2층) 타일을 싣는다", () => {
      const base = project();
      const draft = clone(base);
      const map = mapOf(draft);
      map.lowerTiles[idx(map, 3, 2)] = 7;
      setLayerTileAt(map, 2, idx(map, 3, 2), 40);
      const previews = summarizeAgentGhostPreviewForProjectDiff(base, draft);
      expect(previews[0]!.cells).toEqual([{ x: 3, y: 2, layer: "lower", tilesetId: map.tilesetId, tileId: 40 }]);
    });

    it("선택 층이 없는 두 맵은 전과 같은 셀만 나온다", () => {
      const base = project();
      const draft = clone(base);
      const map = mapOf(draft);
      map.upperTiles[idx(map, 4, 4)] = 12;
      const previews = summarizeAgentGhostPreviewForProjectDiff(base, draft);
      expect(previews[0]!.cells).toEqual([{ x: 4, y: 4, layer: "upper", tilesetId: map.tilesetId, tileId: 12 }]);
    });
  });
  describe("턴 시작 뷰포트 그림 재료", () => {
    it("맵에 선택 층이 있을 때만 layer2·layer4·shadow 를 싣는다", () => {
      const p = project();
      const map = mapOf(p);
      const old = mapRegionImagePayload(p, MAP_ID, { x: 0, y: 0, w: 3, h: 2 })!;
      expect(Object.keys(old).sort()).toEqual(["h", "lower", "mapId", "tilesetId", "upper", "w", "x", "y"]);
      setLayerTileAt(map, 2, idx(map, 1, 1), 40);
      setShadowAt(map, idx(map, 2, 0), 8);
      const next = mapRegionImagePayload(p, MAP_ID, { x: 0, y: 0, w: 3, h: 2 })!;
      expect(next.layer2).toEqual([[-1, -1, -1], [-1, 40, -1]]);
      expect(next.shadow).toEqual([[0, 0, 8], [0, 0, 0]]);
      expect("layer4" in next).toBe(false);
    });
  });
});

// MZ 4층 PR ④ Task 1 — 조수가 네 층을 본다: show_map_region 배열·이미지, get_map_region 기호, 타일 사용 분석, 시각 검토 투영.
describe("mzLayerVision", () => {
  isolateTimers();
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
      // blockedCells 는 e5427cd9e1(show_map_region 이 막힌 칸을 알린다)에서 더해졌다 — 층 키는 여전히 없다.
      expect(JSON.stringify(result.data)).toBe(JSON.stringify({
        h: 2, lower: [[0, 1, 2], [3, 0, 1]], mapId: map.id, upper: [[-1, 2, -1], [-1, 3, -1]], w: 3, x: 0, y: 0, blockedCells: [],
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

    it("도구 설명이 네 층 뜻(짧은 안내)과 배열 이름을 알린다", () => {
      const description = VISION_QUERY_TOOLS.find((tool) => tool.name === "show_map_region")!.description;
      expect(description).toContain(FOUR_LAYER_GUIDANCE_SHORT);
      expect(description).not.toContain(FOUR_LAYER_GUIDANCE);
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

    it("어느 층이든 물이 있으면 ~(main 의 cellLayerTiles 규칙) — 2층 물도 ~", () => {
      const { project, map } = plainProject(4, 1);
      map.lowerTiles = [1, 0, 1, 0];
      map.upperOverlayTiles = [2, -1, 3, -1];
      map.lowerOverlayTiles = [-1, 1, -1, -1];
      expect(grid(project, map)).toBe("~~~.");
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
});
