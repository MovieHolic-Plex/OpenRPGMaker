import { describe, expect, it, vi } from "vitest";
import * as llmClient from "@/ai/llmClient";
import {
  applyBuildPalettePrimitiveToProject,
  BUILD_PALETTE_PRESETS,
  type BuildPaletteSelection,
} from "@/editor/panels/buildPaletteCore";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";

const MAP_ID = "map_blank_start";

function selection(patch: Partial<BuildPaletteSelection> = {}): BuildPaletteSelection {
  return { mapId: MAP_ID, x: 4, y: 4, width: 6, height: 5, ...patch };
}

describe("build palette deterministic stamps", () => {
  it("집 프리미티브는 2×2 미만 선택 영역을 명확한 사유로 거부한다", () => {
    const result = applyBuildPalettePrimitiveToProject(createBlankProject(), selection({ width: 1, height: 1 }), "house");
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("최소 2×2");
    expect(result.summary).not.toContain("완료");
    expect(result.toolResults).toHaveLength(0);
  });

  it("집 프리미티브가 시작 위치를 덮으면 무결성 오류를 사용자 메시지로 요약한다", () => {
    const project = createBlankProject();
    const result = applyBuildPalettePrimitiveToProject(
      project,
      selection({ x: project.startPos.x, y: project.startPos.y - 1, width: 3, height: 4 }),
      "house"
    );

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("시작 위치");
    expect(result.summary).not.toContain("커밋 거부");
    expect(result.toolResults.some((toolResult) => toolResult.issues?.some((issue) => issue.code === "start-position"))).toBe(true);
  });

  it("집 프리미티브는 LLM 없이 벽, 문, 지붕을 한 번에 시공한다", () => {
    const chat = vi.spyOn(llmClient, "chatCompletion");
    const result = applyBuildPalettePrimitiveToProject(createBlankProject(), selection(), "house");
    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("완료");
    expect(chat).not.toHaveBeenCalled();

    const map = result.project.maps[MAP_ID];
    const at = (x: number, y: number) => y * map.width + x;
    // 선택 (4,4) 6×5 → 지붕 2행(용마루 374 + 처마 405) + 벽 3행. 가로는 균일 반복, 파란 계열(406~) 금지.
    for (let x = 4; x <= 9; x++) {
      expect(map.lowerTiles[at(x, 4)], `ridge(${x},4)`).toBe(374);
      expect(map.lowerTiles[at(x, 5)], `eave(${x},5)`).toBe(405);
    }
    expect(map.lowerTiles[at(4, 6)]).not.toBe(0); // wall top-left
    expect(map.lowerTiles[at(7, 8)]).toBe(146); // door bottom
  });

  it("지붕 프리미티브는 용마루→몸통→처마 3단으로 채운다", () => {
    const result = applyBuildPalettePrimitiveToProject(createBlankProject(), selection({ x: 2, y: 10, width: 4, height: 3 }), "roof");
    expect(result.ok, result.summary).toBe(true);
    const map = result.project.maps[MAP_ID];
    const at = (x: number, y: number) => y * map.width + x;
    expect(map.lowerTiles[at(2, 10)]).toBe(374); // 용마루
    expect(map.lowerTiles[at(3, 11)]).toBe(375); // 몸통
    expect(map.lowerTiles[at(2, 12)]).toBe(405); // 처마(최하단)
    expect(map.lowerTiles[at(5, 12)]).toBe(405);
  });

  it("길과 강 프리미티브도 선택 영역 기반으로 결정론 시공하고 LLM을 호출하지 않는다", () => {
    const chat = vi.spyOn(llmClient, "chatCompletion");
    const pathed = applyBuildPalettePrimitiveToProject(createBlankProject(), selection({ y: 10, height: 3 }), "path");
    expect(pathed.ok, pathed.summary).toBe(true);
    expect(chat).not.toHaveBeenCalled();
    const pathMap = pathed.project.maps[MAP_ID];
    const pathMembers = new Set(pathed.project.tilesets[DEFAULT_TILESET_ID].tileGroups?.find((group) => group.id === BUILD_PALETTE_PRESETS.path)?.tileIds ?? []);
    expect(pathMembers.has(pathMap.lowerTiles[11 * pathMap.width + 6])).toBe(true);

    const rivered = applyBuildPalettePrimitiveToProject(createBlankProject(), selection({ x: 2, y: 2, width: 4, height: 3 }), "river");
    expect(rivered.ok, rivered.summary).toBe(true);
    expect(chat).not.toHaveBeenCalled();
    const riverMap = rivered.project.maps[MAP_ID];
    const waterMembers = new Set(rivered.project.tilesets[DEFAULT_TILESET_ID].tileGroups?.find((group) => group.id === BUILD_PALETTE_PRESETS.water)?.tileIds ?? []);
    expect(waterMembers.has(riverMap.lowerTiles[3 * riverMap.width + 3])).toBe(true);
  });
});
