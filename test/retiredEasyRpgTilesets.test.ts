// 폐기된 EasyRPG 계열 칩셋 차단(2026-10-06 사용자 결정 「대체품이 생기기 전까지 막고」 + 「등록 장소는 조수 추천 목록에」).
// 실행기(toolRunner.rejectRetiredEasyRpgMaps)는 조수 실행(ctx.assistantRun)에서만 새 맵·칩셋 변경을 막는다.
import { beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { getTool } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { defaultOutdoorTilesetId } from "@/project/defaults/forestHarmony";
import { isRetiredEasyRpgTileset } from "@/project/retiredEasyRpgTilesets";

const START = "map_blank_start";

function assistant(project = createBlankProject()): ToolContext {
  return { project, currentMapId: START, assistantRun: true };
}

function createMap(ctx: ToolContext, tilesetId: string, id = "map_x") {
  return runTool(ctx, "create_map", { id, name: "새 맵", width: 20, height: 15, tilesetId }, { dryRun: false });
}

beforeEach(() => {
  resetMapEditHistory();
});

describe("폐기 판정", () => {
  it("EasyRPG 계보는 폐기, 손 도트 실내·버들항·월드맵은 아니다", () => {
    const project = createBlankProject();
    for (const id of ["forest_harmony", "forest_harmony_snow", "easyrpg_chipset_dungeon", "atlas_biome_dungeon", "tibo_interior_expanded", "oprn_dungeon_stone"]) {
      expect(isRetiredEasyRpgTileset(project, id), id).toBe(true);
    }
    for (const id of ["atlas_biome_interior", DEFAULT_TILESET_ID, "easyrpg_chipset_world", "atlas_biome_world", "joseon_baram"]) {
      expect(isRetiredEasyRpgTileset(project, id), id).toBe(false);
    }
  });
});

describe("조수 실행 차단", () => {
  it.each(["forest_harmony", "easyrpg_chipset_dungeon", "atlas_biome_dungeon"])("%s 로 새 맵 → 거부, 장소 가져오기 안내", (tilesetId) => {
    const ctx = assistant();
    const result = createMap(ctx, tilesetId);
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("retired-easyrpg-tileset");
    expect(result.issues?.[0]?.message).toContain("import_region_reference");
    expect(ctx.project.maps.map_x).toBeUndefined();
  });

  it("손 도트 실내·버들항 새 맵은 통과", () => {
    const ctx = assistant();
    expect(createMap(ctx, "atlas_biome_interior", "map_in").ok).toBe(true);
    expect(createMap(ctx, DEFAULT_TILESET_ID, "map_town").ok).toBe(true);
  });

  it("이미 숲마을 칩셋으로 깐 맵은 조수도 계속 고친다", () => {
    const human: ToolContext = { project: createBlankProject(), currentMapId: START };
    expect(createMap(human, "forest_harmony", "map_forest").ok).toBe(true);
    const ctx: ToolContext = { project: human.project, currentMapId: "map_forest", assistantRun: true };
    const result = runTool(ctx, "set_map_properties", { mapId: "map_forest", name: "옛 숲" }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_forest?.name).toBe("옛 숲");
  });

  it("조수 표시가 없는 실행(편집기 UI·스크립트)은 그대로", () => {
    const ctx: ToolContext = { project: createBlankProject(), currentMapId: START };
    expect(createMap(ctx, "forest_harmony").ok).toBe(true);
  });

  it("EasyRPG 생성기는 조수에게 숨기고 실행은 남긴다", () => {
    for (const name of ["run_dungeon_room_pipeline", "start_dungeon_room_session", "generate_map"]) {
      const tool = getTool(name);
      expect(tool?.deprecated, name).toBe(true);
      expect(tool?.supersededBy, name).toBe("import_region_reference");
    }
  });
});

describe("기본 칩셋이 숲마을로 새지 않는다", () => {
  it("버들항 프로젝트에 실내 맵이 있어도 야외 기본은 버들항", () => {
    const ctx: ToolContext = { project: createBlankProject(), currentMapId: START };
    expect(createMap(ctx, "atlas_biome_interior", "map_in").ok).toBe(true);
    expect(defaultOutdoorTilesetId(ctx.project)).toBe(DEFAULT_TILESET_ID);
  });

  it("build_world 의 마을·던전·실내 자리는 모두 버들항", () => {
    const ctx = assistant();
    const result = runTool(ctx, "build_world", {
      plan: {
        nodes: [
          { mapId: "map_town", role: "town", label: "마을", width: 20, height: 16 },
          { mapId: "map_cave", role: "dungeon", label: "동굴", width: 20, height: 16 },
        ],
        edges: [{ from: { mapId: "map_town", exit: { side: "east" } }, to: { mapId: "map_cave", entry: { side: "west" } } }],
      },
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_town?.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(ctx.project.maps.map_cave?.tilesetId).toBe(DEFAULT_TILESET_ID);
  });
});
