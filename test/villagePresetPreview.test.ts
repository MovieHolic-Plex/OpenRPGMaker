import { describe, expect, it } from "vitest";
import { PRESET_PREVIEW_SIZE, buildPresetPreview } from "@/editor/panels/villagePresetPreview";
import { presetRecordFromArchetype } from "@/editor/panels/databaseVillageModel";
import { VILLAGE_ARCHETYPES } from "@/editor/tools/village/authoringData";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

// 프리셋 미리보기는 **진짜 시공기**를 돈다 — 화면이 자기 나름의 그림을 상상해 그리면
// 결과와 어긋나고, 어긋난 미리보기는 없는 것보다 나쁘다. 그래서 여기서 보는 것은
// "프리셋 값이 실제 시공에 먹었는지" 와 "초안이 실제 프로젝트로 새지 않는지" 다.

function withPreset(archetypeId: string): { readonly project: Project; readonly presetId: string } {
  const archetype = VILLAGE_ARCHETYPES.find((entry) => entry.id === archetypeId)!;
  const project = createBlankProject();
  const presetId = `vpreset_${archetype.id}`;
  project.villagePresets = [presetRecordFromArchetype(archetype, presetId)];
  return { project, presetId };
}

describe("배치 프리셋 미리보기", () => {
  it("프리셋을 시공해 맵과 타일셋을 돌려준다", () => {
    const { project, presetId } = withPreset("farm-rural");
    const result = buildPresetPreview(project, presetId, 7);
    expect(result.ok, result.ok ? "" : result.reason).toBe(true);
    if (!result.ok) return;
    expect(result.map.width).toBe(PRESET_PREVIEW_SIZE);
    expect(result.map.height).toBe(PRESET_PREVIEW_SIZE);
    expect(result.housesBuilt).toBeGreaterThan(0);
    expect(result.tileset.id).toBe(result.map.tilesetId);
    // 그림이 나오려면 타일이 실제로 깔려 있어야 한다.
    expect(result.map.lowerTiles.some((tile) => tile >= 0)).toBe(true);
  });

  // 미리보기가 프로젝트를 오염시키면 「눌러 봤다」만으로 저장 대상이 늘어난다.
  it("실제 프로젝트에는 맵이 생기지 않는다", () => {
    const { project, presetId } = withPreset("farm-rural");
    const before = Object.keys(project.maps).length;
    const result = buildPresetPreview(project, presetId, 3);
    expect(result.ok).toBe(true);
    expect(Object.keys(project.maps)).toHaveLength(before);
  });

  it("씨앗값이 다르면 배치가 달라진다", () => {
    const { project, presetId } = withPreset("market-fair");
    const a = buildPresetPreview(project, presetId, 3);
    const b = buildPresetPreview(project, presetId, 11);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.map.lowerTiles.join(",")).not.toBe(b.map.lowerTiles.join(","));
  });

  it("모르는 프리셋 id 는 이유를 말하고 물러난다", () => {
    const { project } = withPreset("farm-rural");
    const result = buildPresetPreview(project, "vpreset_nope", 7);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("vpreset_nope");
  });

  it("합본 마을 칩셋이 없으면 그림인 척하지 않는다", () => {
    const { project, presetId } = withPreset("farm-rural");
    for (const tileset of Object.values(project.tilesets)) {
      tileset.image = { type: "bundled", id: "tex_easyrpg_chipset_dungeon" };
    }
    const result = buildPresetPreview(project, presetId, 7);
    expect(result.ok).toBe(false);
  });

  it("원형 6갈래가 전부 시공된다", () => {
    const failed = VILLAGE_ARCHETYPES.flatMap((archetype) => {
      const { project, presetId } = withPreset(archetype.id);
      const result = buildPresetPreview(project, presetId, 7);
      return result.ok ? [] : [`${archetype.id}: ${result.reason}`];
    });
    expect(failed).toEqual([]);
  });
});
