// 몬스터 수집 칩셋 계열 분리(2026-10-06 사용자 결정 「칩셋의 연속성」 + 톤 A).
// 밝은 monster_*, 에메랄드풍 emerald_monster_*, 버들항은 서로 다른 계열이라 한 게임에 섞이지 않는다.
import { beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { applyGenrePreset } from "@/project/genrePresets";
import { requestsModernMap } from "@/ai/modernTilesetPolicy";
import { EMERALD_MONSTER_AUTHORING_GUIDE } from "@/project/emeraldMonsterStyle";
import { tilesetFamily } from "@/project/tilesetFamily";
import { getTool } from "@/editor/tools/toolRegistry";

beforeEach(() => resetMapEditHistory());

function monsterProject() {
  const project = createBlankProject();
  applyGenrePreset(project, "monster-collect");
  return project;
}

describe("몬스터 칩셋 계열", () => {
  it("밝은 킷·에메랄드 재채색·버들항은 서로 다른 계열이다", () => {
    const project = createBlankProject();
    expect(tilesetFamily(project, "monster_overworld")).toBe("oprn-monster");
    expect(tilesetFamily(project, "monster_rooms")).toBe("oprn-monster");
    expect(tilesetFamily(project, "emerald_monster_overworld")).toBe("oprn-monster-emerald");
    expect(tilesetFamily(project, DEFAULT_TILESET_ID)).toBe("oprn-atlas");
  });

  it("몬스터 수집 새 프로젝트는 몬스터 풀밭에서 시작한다", () => {
    const start = monsterProject().maps.map_blank_start!;
    expect(start.tilesetId).toBe("monster_overworld");
    expect(start.tileSize).toBe(16);
  });

  it("손댄 시작 맵은 장르를 바꿔도 칩셋이 그대로다", () => {
    const project = createBlankProject();
    project.maps.map_blank_start!.lowerTiles[4] = 1;
    applyGenrePreset(project, "monster-collect");
    expect(project.maps.map_blank_start!.tilesetId).toBe(DEFAULT_TILESET_ID);
  });

  it("조수는 몬스터 맵에서 같은 계열의 실내 시트로는 새 맵을 만들고, 에메랄드·버들항으로는 못 만든다", () => {
    const ctx: ToolContext = { project: monsterProject(), currentMapId: "map_blank_start", assistantRun: true };
    const create = (id: string, tilesetId: string) =>
      runTool(ctx, "create_map", { id, name: id, width: 20, height: 15, tilesetId }, { dryRun: false });
    expect(create("map_room", "monster_rooms").ok).toBe(true);
    for (const [id, tilesetId] of [["map_emerald", "emerald_monster_overworld"], ["map_town", DEFAULT_TILESET_ID]] as const) {
      const result = create(id, tilesetId);
      expect(result.ok, tilesetId).toBe(false);
      expect(ctx.project.maps[id], tilesetId).toBeUndefined();
    }
  });

  it("포켓몬풍 지침과 몬스터 맵은 PAW 전용 현대 맵 게이트를 켜지 않는다", () => {
    const project = monsterProject();
    expect(requestsModernMap(project, EMERALD_MONSTER_AUTHORING_GUIDE, ["map_blank_start"])).toBe(false);
    expect(requestsModernMap(project, "현대식 상점 거리를 만들어", ["map_blank_start"])).toBe(false);
    expect(requestsModernMap(createBlankProject(), "현대 도시 마을 만들어", ["map_blank_start"])).toBe(true);
  });

  it("폐기 EasyRPG 칩셋 거부는 같은 계열 몬스터 시트를 대안으로 알려 준다", () => {
    const ctx: ToolContext = { project: monsterProject(), currentMapId: "map_blank_start", assistantRun: true };
    const result = runTool(ctx, "create_map", { id: "map_cave", name: "동굴", width: 20, height: 15, tilesetId: "easyrpg_chipset_dungeon" }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.message).toContain("monster_dungeon");
  });

  it("build_monster_game 은 사람이 고른 출연진을 까는 도구라 캐릭터 선택 검사 대상이 아니다", () => {
    expect(getTool("build_monster_game")?.placesCuratedCast).toBe(true);
  });
});
