import { describe, expect, it } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { serialize } from "@/project/io";
import type { GameMap, Project } from "@/project/types";
import { mapPatchChangeSet, planMapPatch, readMapPatchSnapshot } from "@/project/persistence/core/mapPatch";

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
/** 서버가 돌려주는 모양: 직렬화 → JSON 왕복(jsonb 처럼 키 순서가 바뀔 수 있다). */
function asStoredJson(project: Project): unknown {
  return JSON.parse(serialize(projectWithoutEventDrafts(project)));
}

describe("planMapPatch", () => {
  it("비겹침 편집은 후보를 만들고 후보에 최신본의 다른 맵이 남는다", async () => {
    const base = createHouseTemplateGalleryProject();
    const [mineId, theirsId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mineId] = renamed(mine, mineId, "내 맵");
    const latest = structuredClone(base);
    latest.maps[theirsId] = renamed(latest, theirsId, "남의 맵");

    const plan = await planMapPatch(mapPatchChangeSet(base, mine), readMapPatchSnapshot(asStoredJson(latest)));

    expect(plan.kind).toBe("candidate");
    if (plan.kind !== "candidate") return;
    expect(plan.mergedProject.maps[mineId]?.name).toBe("내 맵");
    expect(plan.mergedProject.maps[theirsId]?.name).toBe("남의 맵");
    expect(plan.wire.serialized).toBe(serialize(plan.mergedProject));
    expect(plan.wire.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("같은 맵의 다른 편집은 충돌이다", async () => {
    const base = createHouseTemplateGalleryProject();
    const [mapId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mapId] = renamed(mine, mapId, "내 맵");
    const latest = structuredClone(base);
    latest.maps[mapId] = renamed(latest, mapId, "남의 맵");

    const plan = await planMapPatch(mapPatchChangeSet(base, mine), readMapPatchSnapshot(asStoredJson(latest)));

    expect(plan).toEqual({ kind: "conflict", conflicts: [{ mapId, name: "내 맵" }] });
  });

  it("최신본이 없으면(첫 저장) 기준본을 최신본으로 써서 후보를 만든다", async () => {
    const base = createHouseTemplateGalleryProject();
    const [mapId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mapId] = renamed(mine, mapId, "내 맵");
    const changeSet = mapPatchChangeSet(base, mine);

    const plan = await planMapPatch(changeSet, changeSet.canonicalBase);

    expect(plan.kind).toBe("candidate");
  });

  it("호출자가 changedMapIds 를 주면 그 목록만 병합한다", async () => {
    const base = createHouseTemplateGalleryProject();
    const [mineId, otherId] = mapIds(base);
    const mine = structuredClone(base);
    mine.maps[mineId] = renamed(mine, mineId, "내 맵");
    mine.maps[otherId] = renamed(mine, otherId, "안 보낼 편집");
    const changeSet = mapPatchChangeSet(base, mine, [mineId]);

    const plan = await planMapPatch(changeSet, changeSet.canonicalBase);

    expect(plan.kind).toBe("candidate");
    if (plan.kind !== "candidate") return;
    expect(plan.mergedProject.maps[otherId]?.name).toBe(base.maps[otherId]?.name);
  });
});
