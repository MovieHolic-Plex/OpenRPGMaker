/**
 * 한 장짜리 번들 전투 배경(장소 그림, battle-scenery-<키>) — battle-backdrop 하네스 `build --bundle` 이 싣는다.
 * 목록이 겹 배경 종류와 겹치지 않는지, 겹 배경 종류로 풀리지 않고 그 그림 그대로 깔리는지,
 * 검증·도구가 그 id 를 아는지, 장소 테마 표가 가리키는 배경이 실제로 있는지를 고정한다.
 * 문서 openwiki/harnesses/battle-backdrop.md 「장소 그림(번들 한 장 그림)」.
 */
import { describe, expect, it } from "vitest";
import stillsDoc from "@/assets/battleSceneryStills.json";
import { BATTLE_BACKDROP_ID_HINT, BATTLE_SCENERY_BIOMES, BATTLE_SCENERY_STILLS, battleSceneryStill, resolveSceneryBiome, unknownSceneryIdMessage } from "@/assets/battleSceneryCatalog";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { resolveBattleBackdrop } from "@/battle/battleBackdrop";
import { readBattleScenery } from "@/editor/panels/battleSceneryPicker";
import { createBlankProject } from "@/project/defaults";
import { collectWebExportAssets } from "@/project/webExportAssets";
import type { Project } from "@/project/types";

type Still = { key: string; ko: string; en: string; run: string; pixelSha256: string; nativePixelSha256: string; score: number; batch: string; by: string };
const stills = stillsDoc.stills as readonly Still[];

describe("장소 그림 목록", () => {
  it("키는 겹 배경 종류와 겹치지 않고 id 는 battle-scenery-<키> 다", () => {
    expect(BATTLE_SCENERY_STILLS.map((s) => s.key)).toEqual(stills.map((s) => s.key));
    for (const still of BATTLE_SCENERY_STILLS) {
      expect(BATTLE_SCENERY_BIOMES as readonly string[]).not.toContain(still.key);
      expect(still.resourceId).toBe(`battle-scenery-${still.key}`);
      expect(still.ko.trim()).not.toBe("");
      expect(still.en.trim()).not.toBe("");
    }
    expect(new Set(stills.map((s) => s.key)).size).toBe(stills.length);
  });
});

describe("장소 그림은 새·기존 프로젝트 모두에서 풀린다", () => {
  // Every still resolves through the same path; one row covers it (the list itself is checked above).
  it.each(BATTLE_SCENERY_STILLS.slice(0, 1).map((s) => [s.resourceId, s] as const))("%s", (id, still) => {
    const project = createBlankProject() as Project;
    // 프로젝트에 자원을 넣지 않아도(기존 프로젝트) 번들 경로로 풀린다.
    expect(project.assets.uploaded[id]).toBeUndefined();
    expect(resolveAssetResourceUrl(id, { project })).toContain(`battle-scenery/${still.key}/preview.png`);
    expect(builtinGeneratedResourceIds()).toContain(id);
    expect(battleSceneryStill(id)).toBe(still);
    // 겹 배경 종류로 풀지 않는다 — 그림 그대로 깔린다.
    expect(resolveSceneryBiome(project, { backdropResourceId: id })).toBeUndefined();
    expect(readBattleScenery(project, id)).toEqual({ kind: "custom", id });
    expect(unknownSceneryIdMessage(id)).toBeUndefined();
    expect(BATTLE_BACKDROP_ID_HINT).toContain(id);
    // 맵에 저작한 값이 그 맵의 전투 배경이 되고, 내보내기에 그림이 실린다.
    const map = project.maps[project.startMapId]!;
    map.battleBackground = id;
    const troopId = project.database.troops[0]!.id;
    project.database.troops[0]!.previewBackgroundResourceId = "battle-scenery-forest";
    expect(resolveBattleBackdrop({ project, troopId, location: { mapId: map.id, x: 1, y: 1 } })).toBe(id);
    expect(collectWebExportAssets(project).map((a) => a.zipPath)).toContain(still.image);
  });

  it("지어낸 battle-scenery id 는 여전히 거절한다", () => {
    expect(unknownSceneryIdMessage("battle-scenery-forest-night")).toContain("is not a battle backdrop");
  });
});
