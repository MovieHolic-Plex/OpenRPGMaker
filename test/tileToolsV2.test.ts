// 툴 스택 단순화 계약: 정공법(v3) 노출 + 레거시 v1 엔진 getTool 호환 + 구 v2 래퍼 제거.
import { describe, expect, it } from "vitest";
import { getTool, runTool, toOpenAiTools, LEGACY_TILE_KNOWLEDGE_SUPERSEDED, type ToolContext } from "@/editor/tools";
import { REMOVED_V2_PLACE_TOOLS, V1_TILE_SUPERSEDED } from "@/editor/tools/v2";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function freshProject(): { project: Project; mapId: string } {
  const project = createBlankProject();
  const mapId = Object.keys(project.maps)[0];
  return { project, mapId };
}

function runNamed(name: string, project: Project, args: Record<string, unknown>) {
  const tool = getTool(name);
  if (!tool) throw new Error(`tool missing: ${name}`);
  return tool.run(project, args);
}

describe("툴 스택 단순화 레지스트리", () => {
  it("구 v2 배치 4종은 레지스트리에서 제거됐고 정공법 v3는 노출된다", () => {
    const exposed = new Set(toOpenAiTools().map((tool) => tool.function.name));
    for (const name of REMOVED_V2_PLACE_TOOLS.keys()) {
      expect(getTool(name), name).toBeUndefined();
      expect(exposed.has(name), name).toBe(false);
    }
    for (const name of ["build_wall", "place_props", "fill_region", "tile_erase", "paint_road", "tile_query"]) {
      expect(exposed.has(name), name).toBe(true);
    }
  });

  it("deprecated v1 엔진 툴은 getTool로 실행 가능하고 supersededBy가 정공법을 가리킨다", () => {
    for (const [v1Name, canonical] of V1_TILE_SUPERSEDED) {
      const v1 = getTool(v1Name);
      expect(v1, v1Name).toBeDefined();
      expect(v1?.deprecated).toBe(true);
      expect(v1?.supersededBy).toBe(canonical);
      // 대체 이름은 레지스트리에 존재(또는 tile_query 등 활성)
      expect(getTool(canonical), `${v1Name}→${canonical}`).toBeDefined();
    }
  });

  it("레거시 비전 툴 supersede 맵이 유효하다", () => {
    for (const [legacy, next] of LEGACY_TILE_KNOWLEDGE_SUPERSEDED) {
      expect(getTool(next), next).toBeDefined();
      const tool = getTool(legacy);
      if (tool) {
        expect(tool.deprecated).toBe(true);
        expect(tool.supersededBy).toBe(next);
      }
    }
  });
});

describe("레거시 엔진 실행 호환 (이름 유지, LLM 비노출)", () => {
  it("paint_tiles rect 페인트", () => {
    const { project, mapId } = freshProject();
    const before = [...project.maps[mapId].lowerTiles];
    const result = runNamed("paint_tiles", project, {
      mapId, mode: "rect", layer: "lower", tile: 360, from: { x: 1, y: 1 }, to: { x: 3, y: 2 },
    });
    expect(result.summary.length).toBeGreaterThan(0);
    expect(project.maps[mapId].lowerTiles).not.toEqual(before);
  });

  it("paint_road 폴리라인", () => {
    const { project, mapId } = freshProject();
    const result = runNamed("paint_road", project, {
      mapId, points: [{ x: 0, y: 7 }, { x: 9, y: 8 }, { x: 18, y: 5 }], style: "dirt", naturalness: 0.4, seed: 7,
    });
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("scatter_object 그룹 산포", () => {
    const { project, mapId } = freshProject();
    const tileset = project.tilesets[project.maps[mapId].tilesetId];
    const groupId = tileset.tileGroups?.[0]?.id;
    if (!groupId) return;
    const result = runNamed("scatter_object", project, {
      mapId, groupId, area: { x: 1, y: 1, w: 8, h: 6 }, count: 2, seed: 3,
    });
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

// 2026-09-16 실측 회귀: 모델이 tile_query 로 `타일 인덱스 범위 밖: 99999 (0~479)` 를 받고도
// 이어서 paint_tiles 를 호출했고, 이 툴만 범위 검사가 없어 99999 가 map.lowerTiles 에 저장됐다.
// 형제 도구(palettePreset·groupSample·visionQuery·tileMetadata·vocabulary)는 모두 거부하는데
// paint_tiles 만 빠져 있었다 — 그 계약을 여기서 고정한다.
describe("paint_tiles 타일 인덱스 계약", () => {
  function context(): { ctx: ToolContext; mapId: string } {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = Object.keys(ctx.project.maps)[0];
    if (!mapId) throw new Error("blank project has no map");
    return { ctx, mapId };
  }

  it("타일셋 범위 밖 인덱스는 거부하고 지도를 바꾸지 않는다", () => {
    const { ctx, mapId } = context();
    const tileset = ctx.project.tilesets[ctx.project.maps[mapId].tilesetId];
    const outOfRange = tileset.count + 41;
    const before = [...ctx.project.maps[mapId].lowerTiles];
    const result = runTool(ctx, "paint_tiles", {
      mapId, layer: "lower", mode: "cells", tile: outOfRange, cells: [{ x: 3, y: 3 }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("tile-out-of-range");
    // 거부는 «지도를 그대로 둔다» 까지 포함한다 — 부분 적용이 남으면 데이터가 오염된다.
    expect(ctx.project.maps[mapId].lowerTiles).toEqual(before);
  });

  it("음수 상한 밖(-2)도 거부한다", () => {
    const { ctx, mapId } = context();
    const result = runTool(ctx, "paint_tiles", {
      mapId, layer: "lower", mode: "cells", tile: -2, cells: [{ x: 3, y: 3 }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("tile-out-of-range");
  });

  it("-1(비움)은 범위 검사에 걸리지 않고 실제로 비운다", () => {
    const { ctx, mapId } = context();
    const result = runTool(ctx, "paint_tiles", {
      mapId, layer: "lower", mode: "cells", tile: -1, cells: [{ x: 3, y: 3 }],
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(ctx.project.maps[mapId].lowerTiles[3 * ctx.project.maps[mapId].width + 3]).toBe(-1);
  });

  it("경계값(count-1)은 정상 페인트된다", () => {
    const { ctx, mapId } = context();
    const tileset = ctx.project.tilesets[ctx.project.maps[mapId].tilesetId];
    const result = runTool(ctx, "paint_tiles", {
      mapId, layer: "lower", mode: "cells", tile: tileset.count - 1, cells: [{ x: 4, y: 4 }],
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });
});
