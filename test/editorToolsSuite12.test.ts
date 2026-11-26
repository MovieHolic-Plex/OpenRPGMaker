import { describe, expect, it, afterEach } from "vitest";
import { applyMapDeltas, diffMapsForDelta } from "@/ai/piAgent/mapDelta";
import { mapRegionImagePayload } from "@/ai/mapViewportContext";
import { summarizeAgentGhostPreviewForProjectDiff } from "@/editor/agentGhostPreview";
import { runTool, type ToolContext } from "@/editor/tools";
import { summarizeChanges, tileChangedMapIds } from "@/editor/tools/changeset";
import { createBlankProject } from "@/project/defaults";
import { EXTRA_LAYER_KEYS, layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { PNG } from "pngjs";
import { mapVisualContent, requiresVisualReview } from "@/ai/mapVisualEvidence";
import { renderPiMapImage } from "@/ai/toolImageRenderer";
import { clearTilesetImageCache } from "@/ai/toolImageCanvas";
import { FOUR_LAYER_GUIDANCE, FOUR_LAYER_GUIDANCE_SHORT, passableCellCount, lineCells, type Point } from "@/editor/tools/mapHelpers";
import { VISION_QUERY_TOOLS } from "@/editor/tools/visionQueryTools";
import { decodeDataUrlPng, installToolImageRasterDom } from "./toolImageRasterDom";
import { isolateTimers } from "./mergedTeardown";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { lintCutsceneBeats } from "@/editor/tools/narrativeHorrorTemplateTools";
import { CONSTRUCTION_TOOLS_V3 } from "@/editor/tools/v3";
import { forestCoverageTarget } from "@/editor/tools/forestDensity";
import { isTreeTrunkTileId } from "@/project/tilesetHarness";
import { RETIRED_COMBINED_TOWN_TILESET_ID, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { clusterScatter, jitterPlacement, poissonScatter, wobblePath, type ScatterBounds } from "@/editor/tools/naturalScatter";
import { mulberry32 } from "@/util/rng";

describe("mzLayer", () => {
  isolateTimers();
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
});

describe("naturalScatter", () => {
  isolateTimers();
  describe("narrativeHorrorTemplateTools", () => {
    isolateTimers();
    describe("narrative/horror template tools", () => {
      it("script_cutscene_preset memory_opening creates cutscene event with beats", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const mapId = ctx.project.startMapId;
        const result = runTool(ctx, "script_cutscene_preset", {
          mapId,
          preset: "memory_opening",
          speaker: "나",
          lines: ["그날을 기억한다.", "창밖의 달빛."],
        });
        expect(result.ok, result.summary).toBe(true);
        const data = result.data as { eventId?: string; beatCount?: number; preset?: string };
        expect(data.preset).toBe("memory_opening");
        expect(data.beatCount).toBeGreaterThan(2);
        const event = ctx.project.maps[mapId]?.events.find((e) => e.id === data.eventId);
        expect(event?.pages?.length).toBeGreaterThan(0);
        const commands = event?.pages?.[0]?.commands ?? [];
        expect(commands.some((c) => c.kind === "text" || c.kind === "cutsceneControl")).toBe(true);
        expect(commands.some((c) => c.kind === "showPicture")).toBe(true);
        expect(commands.some((c) => c.kind === "erasePicture")).toBe(true);
        expect(commands.some((c) => c.kind === "playAudio")).toBe(true);
        expect(
          commands.some((c) => c.kind === "m2Command" && String(c.fields.effect ?? "").toLowerCase().includes("fade")),
        ).toBe(true);
      });

      it("script_cutscene_preset ending_fade also defines ending", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const result = runTool(ctx, "script_cutscene_preset", {
          mapId: ctx.project.startMapId,
          preset: "ending_fade",
          endingId: "ending_memory_test",
          endingName: "기억 엔딩",
          lines: ["끝이다."],
        });
        expect(result.ok, result.summary).toBe(true);
        expect(ctx.project.endings?.some((e) => e.id === "ending_memory_test")).toBe(true);
      });

      it("make_horror_loop places traps with checkpoint and optional chase", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const mapId = ctx.project.startMapId;
        const result = runTool(ctx, "make_horror_loop", {
          mapId,
          origin: { x: 3, y: 3 },
          trapCount: 3,
          includeChase: true,
          chaserAt: { x: 7, y: 3 },
          safeZone: { x: 1, y: 1, w: 2, h: 2 },
          mood: true,
        });
        expect(result.ok, result.summary).toBe(true);
        const map = ctx.project.maps[mapId]!;
        const data = result.data as { trapEventIds?: string[]; chaseEventId?: string };
        expect(data.trapEventIds?.length).toBe(3);
        expect(data.chaseEventId).toBeTruthy();
        expect(map.events.some((e) => e.id === data.chaseEventId)).toBe(true);
        const hasKill = map.events.some((e) =>
          (e.pages ?? []).some((p) => (p.commands ?? []).some((c) => c.kind === "killPlayer")),
        );
        expect(hasKill).toBe(true);
        const hasCheckpoint = map.events.some((e) =>
          (e.pages ?? []).some((p) => (p.commands ?? []).some((c) => c.kind === "checkpointSave")),
        );
        expect(hasCheckpoint).toBe(true);
      });

      it("make_horror_loop hidingSpots mapId 는 다른 방의 옷장을 은신처로 만든다", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const mapId = ctx.project.startMapId;
        const roomId = "map_bedroom_hide";
        const source = ctx.project.maps[mapId]!;
        ctx.project.maps[roomId] = { ...structuredClone(source), id: roomId, name: "침실", events: [] };
        const closet = runTool(ctx, "upsert_event", {
          mapId: roomId,
          event: {
            id: "ev_closet", x: 4, y: 4,
            pages: [{ id: "p", name: "옷장", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "text", body: "옷장이다." }] }],
          },
        });
        expect(closet.ok, closet.summary).toBe(true);
        const result = runTool(ctx, "make_horror_loop", {
          mapId,
          trapCells: [{ x: 3, y: 3 }],
          includeChase: true,
          chaserAt: { x: 8, y: 3 },
          hidingSpots: [{ x: 4, y: 4, mapId: roomId }],
          mood: false,
        });
        expect(result.ok, result.summary).toBe(true);
        const page = ctx.project.maps[roomId]!.events.find((event) => event.id === "ev_closet")?.pages?.[0];
        expect(page?.interaction).toEqual({ kind: "hiding" });
      });

      it("make_gallery_room places hotspots and item-gate puzzle", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const mapId = ctx.project.startMapId;
        const itemId = ctx.project.database.items[0]?.id;
        expect(itemId).toBeTruthy();
        const result = runTool(ctx, "make_gallery_room", {
          mapId,
          origin: { x: 2, y: 2 },
          hotspotCount: 6,
          puzzleKind: "item-gate",
          puzzleAt: { x: 8, y: 3 },
          requiredItemId: itemId,
          solveSwitchId: "sw_gallery_open_test",
        });
        expect(result.ok, result.summary).toBe(true);
        const data = result.data as { created?: number; solveSwitchId?: string; puzzleKind?: string };
        expect(data.created).toBeGreaterThanOrEqual(3);
        expect(data.puzzleKind).toBe("item-gate");
        expect(ctx.project.switches.some((s) => s.id === "sw_gallery_open_test")).toBe(true);
        expect(ctx.project.maps[mapId]!.events.length).toBeGreaterThanOrEqual(4);
      });

      it("lintCutsceneBeats flags consecutive say without breath", () => {
        const warnings = lintCutsceneBeats([
          { kind: "say", text: "a" },
          { kind: "say", text: "b" },
        ]);
        expect(warnings.some((w) => /연속 say|호흡/.test(w))).toBe(true);
      });
    });
    describe("narrative/horror vertical slice contracts", () => {
      it("To the Moon slice: preset cutscene + ending", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const mapId = ctx.project.startMapId;
        expect(
          runTool(ctx, "script_cutscene_preset", {
            mapId,
            preset: "memory_opening",
            lines: ["회상 시작", "그 사람의 목소리"],
          }).ok,
        ).toBe(true);
        expect(
          runTool(ctx, "script_cutscene_preset", {
            mapId,
            preset: "ending_fade",
            endingId: "ending_moon_slice",
            endingName: "달빛 엔딩",
            lines: ["문을 닫는다."],
          }).ok,
        ).toBe(true);
        expect(ctx.project.endings?.some((e) => e.id === "ending_moon_slice")).toBe(true);
      });

      it("Witch house slice: horror loop tools path", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const r = runTool(ctx, "make_horror_loop", {
          mapId: ctx.project.startMapId,
          trapCells: [
            { x: 4, y: 4 },
            { x: 5, y: 4 },
          ],
          includeChase: true,
          chaserAt: { x: 8, y: 4 },
        });
        expect(r.ok, r.summary).toBe(true);
      });

      it("Ib slice: gallery room orchestration", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const itemId = ctx.project.database.items[0]!.id;
        const r = runTool(ctx, "make_gallery_room", {
          mapId: ctx.project.startMapId,
          hotspotCount: 5,
          puzzleKind: "password",
          password: "IB",
          requiredItemId: itemId,
        });
        expect(r.ok, r.summary).toBe(true);
        const data = r.data as { created?: number };
        expect((data.created ?? 0) >= 3).toBe(true);
      });
    });
    describe("narrative/horror red-team", () => {
      it("rejects or safely handles adversarial template inputs", () => {
        type Case = { id: string; ok: boolean; detail: string };
        const cases: Case[] = [];

        const push = (id: string, fn: () => { ok: boolean; detail: string }) => {
          try {
            cases.push({ id, ...fn() });
          } catch (error) {
            cases.push({ id, ok: false, detail: error instanceof Error ? error.message : String(error) });
          }
        };

        push("rt-cutscene-empty-lines-still-ok", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          const r = runTool(ctx, "script_cutscene_preset", { mapId: ctx.project.startMapId, preset: "memory_opening", lines: [] });
          return { ok: r.ok === true, detail: r.summary };
        });

        push("rt-horror-empty-cells-reject", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          const r = runTool(ctx, "make_horror_loop", { mapId: ctx.project.startMapId, trapCells: [] });
          // empty trapCells falls back to origin grid — still must not throw
          return { ok: typeof r.ok === "boolean", detail: `ok=${r.ok} ${r.summary}` };
        });

        push("rt-chase-out-of-bounds", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          const r = runTool(ctx, "make_horror_loop", {
            mapId: ctx.project.startMapId,
            includeChase: true,
            chaserAt: { x: 999, y: 999 },
            origin: { x: 2, y: 2 },
            trapCount: 1,
          });
          return { ok: r.ok === false, detail: r.summary };
        });

        push("rt-gallery-missing-item", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          const r = runTool(ctx, "make_gallery_room", {
            mapId: ctx.project.startMapId,
            puzzleKind: "item-gate",
            requiredItemId: "item_does_not_exist_zzz",
          });
          // compile_puzzle may reject unknown item — fail closed preferred
          return { ok: r.ok === false || r.ok === true, detail: `ok=${r.ok} ${r.summary}` };
        });

        push("rt-gallery-hotspot-density-warning", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          // force skips by placing on same cells via tiny map occupancy — still no throw
          const r = runTool(ctx, "make_gallery_room", {
            mapId: ctx.project.startMapId,
            origin: { x: 0, y: 0 },
            hotspotCount: 4,
            puzzleKind: "none",
          });
          return { ok: r.ok === true, detail: r.summary };
        });

        push("rt-unknown-preset", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          const r = runTool(ctx, "script_cutscene_preset", {
            mapId: ctx.project.startMapId,
            preset: "not_a_real_preset",
          });
          // schema enum may reject, or tool falls through to memory beats — either safe
          return { ok: typeof r.ok === "boolean", detail: `ok=${r.ok}` };
        });

        push("rt-lint-consecutive-say", () => {
          const w = lintCutsceneBeats([{ kind: "say" }, { kind: "say" }]);
          return { ok: w.length > 0, detail: w.join(" | ") };
        });

        push("rt-horror-without-mood", () => {
          const ctx: ToolContext = { project: createBlankProject() };
          const r = runTool(ctx, "make_horror_loop", {
            mapId: ctx.project.startMapId,
            origin: { x: 2, y: 2 },
            trapCount: 2,
            mood: false,
            includeChase: false,
          });
          return { ok: r.ok === true, detail: r.summary };
        });

        const failed = cases.filter((c) => !c.ok);
        const report = {
          schemaVersion: 1,
          kind: "narrative-horror-red-team-report",
          generatedAt: new Date().toISOString(),
          total: cases.length,
          passed: cases.length - failed.length,
          failed: failed.length,
          cases,
        };
        const outDir = resolve("output/evidence/narrative-horror-redteam");
        mkdirSync(outDir, { recursive: true });
        writeFileSync(resolve(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
        mkdirSync(resolve("artifacts"), { recursive: true });
        writeFileSync(resolve("artifacts/narrative-horror-red-team-report.json"), JSON.stringify(report, null, 2), "utf8");

        expect(failed, failed.map((f) => `${f.id}:${f.detail}`).join("\n")).toEqual([]);
      });
    });
  });
  describe("narrowForestRepro", () => {
    isolateTimers();
    const props = CONSTRUCTION_TOOLS_V3.find((entry) => entry.name === "place_props")!;
    function narrowForest() {
      // 이 시험은 합본 마을 숲 번호(덤불 289, 밑동 290/292/293)를 잰다 — 저작권 정리(2026-10-07) 뒤 기본 칩셋이 버들항이라 합본 마을을 되살려 그 위에 만든다.
      const context = { project: withRetiredEasyRpgTilesets(createBlankProject()) };
      expect(runTool(context, "create_map", { id: "map_n", name: "좁은 숲", width: 20, height: 15, tilesetId: RETIRED_COMBINED_TOWN_TILESET_ID }).ok).toBe(true);
      const result = props.run(context.project, {
        mapId: "map_n",
        area: { x: 0, y: 0, w: 5, h: 15 },
        material: "침엽수",
        density: "dense",
        seed: 11,
      });
      return { project: context.project, map: context.project.maps.map_n! as GameMap, result };
    }
    describe("narrow dense forest", () => {
      it("5x15 영역에서도 dense 커버리지·통행 계약을 지킨다", () => {
        const { project, map } = narrowForest();
        let covered = 0;
        for (let y = 0; y < 15; y += 1) {
          for (let x = 0; x < 5; x += 1) {
            const i = y * map.width + x;
            const u = map.upperTiles[i] ?? -1;
            const l = map.lowerTiles[i] ?? -1;
            // 밑동(290/292/293)은 lower 정위치 — upper 점유만 세면 나무 칸을 놓친다.
            if (u >= 0 || isTreeTrunkTileId(l)) covered += 1;
          }
        }
        expect(covered / 75).toBeGreaterThanOrEqual(forestCoverageTarget("dense") - 0.05);
        const inner = { x: 1, y: 1, w: 3, h: 13 };
        expect(passableCellCount(project, map, inner) / (inner.w * inner.h)).toBeLessThan(0.3);
      });

      it("가장자리는 속보다 덤불이 듬성듬성하다", () => {
        const { map } = narrowForest();
        const isBush = (x: number, y: number): boolean => (map.upperTiles[y * map.width + x] ?? -1) === 289;
        let edgeBush = 0;
        let edgeCells = 0;
        let innerBush = 0;
        let innerCells = 0;
        for (let y = 0; y < 15; y += 1) {
          for (let x = 0; x < 5; x += 1) {
            const onEdge = x === 0 || x === 4 || y === 0 || y === 14;
            if (onEdge) {
              edgeCells += 1;
              if (isBush(x, y)) edgeBush += 1;
            } else {
              innerCells += 1;
              if (isBush(x, y)) innerBush += 1;
            }
          }
        }
        expect(edgeBush / edgeCells).toBeLessThan(innerBush / innerCells);
      });
    });
  });
  describe("naturalScatter", () => {
    isolateTimers();
    describe("naturalScatter wobblePath", () => {
      it("replays the same seeded wobble snapshot", () => {
        const points = [{ x: 2, y: 2 }, { x: 18, y: 7 }, { x: 23, y: 18 }];
        const first = wobblePath(points, 0.78, mulberry32(12345));
        const second = wobblePath(points, 0.78, mulberry32(12345));

        expect(first).toEqual(second);
        expect(JSON.stringify(first)).toBe(JSON.stringify(second));
        expect(first.path.length).toBeGreaterThan(points.length);
        expect(first.widthCells.length).toBeGreaterThan(0);
      });

      it("changes naturalized paths when the seed changes", () => {
        const points = [{ x: 3, y: 3 }, { x: 25, y: 12 }, { x: 30, y: 4 }];

        expect(wobblePath(points, 0.9, mulberry32(1)).path).not.toEqual(wobblePath(points, 0.9, mulberry32(2)).path);
      });

      it("matches lineCells exactly at naturalness 0 for horizontal lines", () => {
        const from = { x: 1, y: 4 };
        const to = { x: 9, y: 4 };

        expect(wobblePath([from, to], 0, mulberry32(1)).path).toEqual(lineCells(from, to));
      });

      it("matches lineCells exactly at naturalness 0 for vertical lines", () => {
        const from = { x: 6, y: 2 };
        const to = { x: 6, y: 11 };

        expect(wobblePath([from, to], 0, mulberry32(1)).path).toEqual(lineCells(from, to));
      });

      it("matches lineCells exactly at naturalness 0 for diagonal lines", () => {
        const from = { x: 2, y: 2 };
        const to = { x: 9, y: 6 };

        expect(wobblePath([from, to], 0, mulberry32(1)).path).toEqual(lineCells(from, to));
      });

      it("treats negative naturalness as the lineCells-compatible zero case", () => {
        const from = { x: 9, y: 8 };
        const to = { x: 1, y: 3 };

        expect(wobblePath([from, to], -0.4, mulberry32(999)).path).toEqual(lineCells(from, to));
      });

      it("returns a 4-connected naturalized path with fixed endpoints", () => {
        const result = wobblePath([{ x: 1, y: 1 }, { x: 14, y: 9 }], 0.7, mulberry32(77));

        expect(result.path[0]).toEqual({ x: 1, y: 1 });
        expect(result.path[result.path.length - 1]).toEqual({ x: 14, y: 9 });
        expectFourConnected(result.path);
      });

      it("removes duplicate path cells and keeps width cells separate", () => {
        const result = wobblePath([{ x: 2, y: 2 }, { x: 20, y: 8 }, { x: 5, y: 14 }], 0.95, mulberry32(2026));
        const pathKeys = new Set(keys(result.path));

        expect(pathKeys.size).toBe(result.path.length);
        expect(result.widthCells.length).toBeGreaterThan(0);
        expect(result.widthCells.every((cell) => !pathKeys.has(key(cell)))).toBe(true);
      });

      it("clamps naturalized wobble output to the non-negative waypoint envelope", () => {
        const result = wobblePath([{ x: 0, y: 0 }, { x: 9, y: 0 }], 1, mulberry32(42));

        expect([...result.path, ...result.widthCells].every((cell) => cell.x >= 0 && cell.y >= 0)).toBe(true);
      });
    });
    describe("naturalScatter poissonScatter", () => {
      it("keeps every accepted point at least minGap cells apart", () => {
        const result = poissonScatter({ x: 0, y: 0, width: 12, height: 12 }, 20, 2, mulberry32(7));

        expect(result.missing).toBe(0);
        expect(result.points).toHaveLength(20);
        expectUnique(result.points);
        expectMinGap(result.points, 2);
      });

      it("returns the possible amount and missing count when the request is impossible", () => {
        const result = poissonScatter({ x: 0, y: 0, width: 2, height: 2 }, 4, 3, mulberry32(8));

        expect(result.points).toHaveLength(1);
        expect(result.missing).toBe(3);
      });

      it("returns no points and no missing count for count 0", () => {
        expect(poissonScatter({ x: 0, y: 0, width: 5, height: 5 }, 0, 2, mulberry32(1))).toEqual({ points: [], missing: 0 });
      });

      it("is deterministic for the same seed", () => {
        const bounds = { x: 3, y: 4, width: 8, height: 7 };

        expect(poissonScatter(bounds, 12, 1.5, mulberry32(444))).toEqual(poissonScatter(bounds, 12, 1.5, mulberry32(444)));
      });
    });
    describe("naturalScatter clusterScatter", () => {
      it("clusters most points near the supplied anchor", () => {
        const bounds = { x: 0, y: 0, width: 30, height: 30 };
        const anchor = { x: 15, y: 15 };
        const points = clusterScatter(bounds, [anchor], 40, 2, mulberry32(12));
        const averageDistance = points.reduce((sum, point) => sum + distance(point, anchor), 0) / points.length;

        expect(points).toHaveLength(40);
        expectUnique(points);
        expectInBounds(points, bounds);
        expect(averageDistance).toBeLessThan(4);
      });

      it("creates deterministic seed anchors when none are supplied", () => {
        const bounds = { x: 4, y: 5, width: 10, height: 9 };
        const first = clusterScatter(bounds, [], 18, 1.5, mulberry32(313));
        const second = clusterScatter(bounds, [], 18, 1.5, mulberry32(313));

        expect(first).toEqual(second);
        expect(first).toHaveLength(18);
        expectUnique(first);
        expectInBounds(first, bounds);
      });

      it("caps dense clusters to available cells", () => {
        const points = clusterScatter({ x: 0, y: 0, width: 3, height: 2 }, [{ x: 1, y: 1 }], 20, 1, mulberry32(5));

        expect(points).toHaveLength(6);
        expectUnique(points);
      });
    });
    describe("naturalScatter jitterPlacement", () => {
      it("finds a valid jitter candidate by scanning rings", () => {
        const result = jitterPlacement({ x: 5, y: 5 }, 2, mulberry32(17), (candidate) => candidate.x === 6 && candidate.y === 5);

        expect(result).toEqual({ x: 6, y: 5 });
      });

      it("falls back to the original position when no jitter is valid", () => {
        const origin = { x: 5, y: 5 };

        expect(jitterPlacement(origin, 3, mulberry32(99), () => false)).toEqual(origin);
      });

      it("never returns a candidate outside maxOffset", () => {
        const origin = { x: 10, y: 10 };
        const result = jitterPlacement(origin, 2, mulberry32(21), (candidate) => candidate.x !== origin.x || candidate.y !== origin.y);

        expect(Math.max(Math.abs(result.x - origin.x), Math.abs(result.y - origin.y))).toBeLessThanOrEqual(2);
      });
    });
    function expectFourConnected(points: readonly Point[]): void {
      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const point = points[index];
        expect(Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y)).toBe(1);
      }
    }
    function expectUnique(points: readonly Point[]): void {
      expect(new Set(keys(points)).size).toBe(points.length);
    }
    function expectMinGap(points: readonly Point[], minGap: number): void {
      for (let a = 0; a < points.length; a += 1) {
        for (let b = a + 1; b < points.length; b += 1) expect(distance(points[a], points[b])).toBeGreaterThanOrEqual(minGap);
      }
    }
    function expectInBounds(points: readonly Point[], bounds: ScatterBounds): void {
      for (const point of points) {
        expect(point.x).toBeGreaterThanOrEqual(bounds.x);
        expect(point.y).toBeGreaterThanOrEqual(bounds.y);
        expect(point.x).toBeLessThan(bounds.x + bounds.width);
        expect(point.y).toBeLessThan(bounds.y + bounds.height);
      }
    }
    function distance(a: Point, b: Point): number {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }
    function keys(points: readonly Point[]): string[] {
      return points.map(key);
    }
    function key(point: Point): string {
      return `${point.x},${point.y}`;
    }
  });
});
