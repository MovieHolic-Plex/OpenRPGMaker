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
  it("집 프리미티브는 LLM 없이 벽, 문, 지붕을 한 번에 시공한다", () => {
    const chat = vi.spyOn(llmClient, "chatCompletion");
    const result = applyBuildPalettePrimitiveToProject(createBlankProject(), selection(), "house");
    expect(result.ok, result.summary).toBe(true);
    expect(chat).not.toHaveBeenCalled();

    const map = result.project.maps[MAP_ID];
    const at = (x: number, y: number) => y * map.width + x;
    expect(map.lowerTiles[at(4, 5)]).not.toBe(0); // wall top-left
    expect(map.lowerTiles[at(7, 8)]).toBe(146); // door bottom
    expect(map.lowerTiles[at(4, 4)]).toBe(404); // roof left cap
    expect(map.lowerTiles[at(7, 4)]).toBe(405); // roof body
    expect(map.lowerTiles[at(9, 4)]).toBe(406); // roof right cap
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
