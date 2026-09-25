// MZ 4층의 고스트 증분·변경 집계 — 계획 docs/superpowers/plans/2026-09-25-mz-layers-assistant.md Task 4.
// 2층·4층·그림자만 바꾼 쓰기도 증분·고스트 칸·tilesChanged·재검사 대상 맵에 잡혀야 하고, 옛 맵은 전과 같아야 한다.
import { describe, expect, it } from "vitest";
import { applyMapDeltas, diffMapsForDelta } from "@/ai/piAgent/mapDelta";
import { mapRegionImagePayload } from "@/ai/mapViewportContext";
import { summarizeAgentGhostPreviewForProjectDiff } from "@/editor/agentGhostPreview";
import { runTool, type ToolContext } from "@/editor/tools";
import { summarizeChanges, tileChangedMapIds } from "@/editor/tools/changeset";
import { createBlankProject } from "@/project/defaults";
import { EXTRA_LAYER_KEYS, layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import type { GameMap, Project } from "@/project/types";

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
