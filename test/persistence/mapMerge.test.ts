import { describe, expect, it } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import type { GameMap, Project } from "@/project/types";
import { changedMapIdsBetween, mapSaveConflicts, mergeProjectMaps } from "@/project/persistence/core/mapMerge";

function mapIds(project: Project): [string, string] {
  const [first, second] = Object.keys(project.maps);
  if (!first || !second) throw new Error("fixture needs two maps");
  return [first, second];
}
function renamed(project: Project, mapId: string, name: string): GameMap {
  const map = project.maps[mapId];
  if (!map) throw new Error(`expected map ${mapId}`);
  return { ...map, name };
}

describe("mapMerge core", () => {
  it("키 순서만 다른 맵은 바뀐 것으로 보지 않는다 (jsonb 왕복)", () => {
    const base = createHouseTemplateGalleryProject();
    const [mapId] = mapIds(base);
    const reordered = structuredClone(base);
    const map = reordered.maps[mapId];
    if (!map) throw new Error("expected map");
    reordered.maps[mapId] = Object.fromEntries(Object.entries(map).reverse()) as unknown as GameMap;
    expect(changedMapIdsBetween(base, reordered)).toEqual([]);
  });

  it("서로 다른 맵을 고친 두 편집은 충돌이 아니고, 병합 결과에 둘 다 남는다", () => {
    const base = createHouseTemplateGalleryProject();
    const [mineId, theirsId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mineId] = renamed(mine, mineId, "내 맵");
    const latest = structuredClone(base);
    latest.maps[theirsId] = renamed(latest, theirsId, "남의 맵");
    const changed = changedMapIdsBetween(base, mine);
    expect(changed).toEqual([mineId]);
    expect(mapSaveConflicts(base, mine, latest, changed)).toEqual([]);
    const merged = mergeProjectMaps(latest, mine, changed, []);
    expect(merged.maps[mineId]?.name).toBe("내 맵");
    expect(merged.maps[theirsId]?.name).toBe("남의 맵");
  });

  it("같은 맵을 다르게 고치면 그 맵만 충돌로 돌려준다", () => {
    const base = createHouseTemplateGalleryProject();
    const [mapId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mapId] = renamed(mine, mapId, "내 맵");
    const latest = structuredClone(base);
    latest.maps[mapId] = renamed(latest, mapId, "남의 맵");
    const changed = changedMapIdsBetween(base, mine);
    expect(mapSaveConflicts(base, mine, latest, changed)).toEqual([{ mapId, name: "내 맵" }]);
  });

  it("최신본과 같은 내용으로 고친 편집은 충돌이 아니다", () => {
    const base = createHouseTemplateGalleryProject();
    const [mapId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mapId] = renamed(mine, mapId, "같은 이름");
    const latest = structuredClone(mine);
    expect(mapSaveConflicts(base, mine, latest, changedMapIdsBetween(base, mine))).toEqual([]);
  });
});
