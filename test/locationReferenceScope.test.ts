// 로케이션 ID 는 맵 안에서만 유일하다(loc1, loc2 …). 편집기 참조 화면과 복구가
// 맵 경계를 넘으면 다른 맵의 **다른 장소**를 같은 것으로 취급한다(2026-09-11 적대적 리뷰).
import { describe, expect, it } from "vitest";
import {
  collectMapLocationReferences,
  countLocationReferences,
  repairMapLocationReferences,
} from "@/project/mapLocationReferences";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";

function mapWith(id: string, locationId: string, extra: Partial<GameMap> = {}): GameMap {
  return {
    id,
    name: id,
    width: 10,
    height: 10,
    tilesetId: "easyrpg_chipset_combined_town",
    tileSize: 16,
    lowerTiles: new Array(100).fill(0),
    upperTiles: new Array(100).fill(0),
    events: [],
    locations: [{ id: locationId, name: id + " 광장", x: 1, y: 1, w: 2, h: 2 }],
    ...extra,
  };
}

function projectWithSharedId(): Project {
  const project = createBlankProject();
  const a = mapWith("map_a", "loc1", {
    encounterTable: [{ troopId: "troop_slime", weight: 1, conditions: { locationId: "loc1" } }],
  });
  const b = mapWith("map_b", "loc1", {
    encounterTable: [{ troopId: "troop_bat", weight: 1, conditions: { locationId: "loc1" } }],
  });
  project.maps = { map_a: a, map_b: b };
  project.startMapId = "map_a";
  return project;
}

describe("location reference scope", () => {
  it("mapId 를 주면 그 맵의 참조만 센다", () => {
    const project = projectWithSharedId();
    expect(countLocationReferences(project, "loc1")).toBe(2);
    expect(countLocationReferences(project, "loc1", "map_a")).toBe(1);
    expect(countLocationReferences(project, "loc1", "map_b")).toBe(1);
  });

  it("복구도 그 맵만 고친다 — 다른 맵의 동명 ID 를 건드리지 않는다", () => {
    const project = projectWithSharedId();
    const result = repairMapLocationReferences(project, "loc1", { kind: "detach" }, "map_a");
    expect(result.repaired).toBe(1);
    expect(project.maps.map_a.encounterTable?.[0]?.conditions?.locationId).toBeUndefined();
    expect(project.maps.map_b.encounterTable?.[0]?.conditions?.locationId).toBe("loc1");
  });

  it("mapId 없이 부르면 전량을 복구한다 — 삭제 영향 계산은 그게 맞다", () => {
    const project = projectWithSharedId();
    const result = repairMapLocationReferences(project, "loc1", { kind: "detach" });
    expect(result.repaired).toBe(2);
    expect(collectMapLocationReferences(project)).toHaveLength(0);
  });
});
