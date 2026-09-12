// 로케이션 역할 → safeZones/farmableArea 투영 (2026-09-12).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { hasLocationRole, locationRoleRects, locationRoleTag, projectLocationRoles } from "@/project/locationRoles";
import type { GameMap, MapNamedLocation } from "@/project/types";

function location(id: string, extra: Partial<MapNamedLocation> = {}): MapNamedLocation {
  return { id, name: id, x: 1, y: 1, w: 3, h: 2, ...extra };
}

function mapWith(locations: MapNamedLocation[], extra: Partial<GameMap> = {}): GameMap {
  return {
    id: "map_a",
    name: "맵",
    width: 20,
    height: 20,
    tilesetId: "easyrpg_chipset_combined_town",
    tileSize: 16,
    lowerTiles: new Array(400).fill(0),
    upperTiles: new Array(400).fill(0),
    events: [],
    locations,
    ...extra,
  };
}

describe("location roles", () => {
  it("역할은 태그 하나로 표현되고 정의된 낱말만 인정한다", () => {
    expect(locationRoleTag({ tags: ["safeZone"] })).toBe("safeZone");
    expect(locationRoleTag({ tags: ["아무말"] })).toBeUndefined();
    expect(hasLocationRole({ tags: ["farmable"] }, "farmable")).toBe(true);
    expect(hasLocationRole({ tags: ["farmable"] }, "safeZone")).toBe(false);
  });

  it("역할 구역이 해당 배열로 투영된다", () => {
    const map = mapWith([location("loc1", { tags: ["safeZone"] }), location("loc2", { x: 5, y: 5, tags: ["farmable"] })]);
    // 배열 2건 + 기록 1건. 반환값은 «바뀐 것» 의 수다(무변경 판정에만 쓰인다).
    expect(projectLocationRoles(map)).toBe(3);
    expect(map.safeZones).toEqual([{ x: 1, y: 1, w: 3, h: 2 }]);
    expect(map.farmableArea).toEqual([{ x: 5, y: 5, w: 3, h: 2 }]);
    expect(locationRoleRects(map, "safeZone")).toHaveLength(1);
  });

  it("두 번 투영해도 늘지 않는다(멱등)", () => {
    const map = mapWith([location("loc1", { tags: ["safeZone"] })]);
    // 배열 1건 + 기록 1건.
    expect(projectLocationRoles(map)).toBe(2);
    expect(projectLocationRoles(map)).toBe(0);
    expect(map.safeZones).toHaveLength(1);
  });

  it("손으로 넣은 사각형은 지우지 않는다 — 출처가 다르다", () => {
    // 추격자 툴(make_chase_scene)이 넣은 사각형을 흉내낸다(출처 없는 배열 항목).
    const map = mapWith([location("loc1", { tags: ["safeZone"] })], {
      safeZones: [{ x: 9, y: 9, w: 2, h: 2 }],
    });
    projectLocationRoles(map);
    expect(map.safeZones).toEqual([{ x: 9, y: 9, w: 2, h: 2 }, { x: 1, y: 1, w: 3, h: 2 }]);
  });

  it("역할을 뗀 구역의 사각형은 그 출처의 것만 사라진다", () => {
    const map = mapWith([location("loc1")], {
      safeZones: [{ x: 1, y: 1, w: 3, h: 2 }, { x: 9, y: 9, w: 2, h: 2 }],
      // loc1 이 예전에는 역할이었고 그 흔적이 남아 있다고 가정한다.
    });
    // 출처 표시가 남아 있어야 «우리 것» 으로 식별된다.
    map.locationRoleProjection = { safeZone: { loc1: { x: 1, y: 1, w: 3, h: 2 } } };
    projectLocationRoles(map);
    expect(map.safeZones).toEqual([{ x: 9, y: 9, w: 2, h: 2 }]);
  });

  it("역할이 없는 맵은 아무것도 바꾸지 않는다", () => {
    const map = mapWith([location("loc1")]);
    expect(projectLocationRoles(map)).toBe(0);
    expect(map.safeZones).toBeUndefined();
    expect(map.farmableArea).toBeUndefined();
  });

  it("구역을 옮기면 투영도 따라간다 — 복사본이 아니라 투영이다", () => {
    const map = mapWith([location("loc1", { tags: ["safeZone"] })]);
    projectLocationRoles(map);
    map.locations![0] = { ...map.locations![0]!, x: 7, y: 8 };
    projectLocationRoles(map);
    expect(map.safeZones).toEqual([{ x: 7, y: 8, w: 3, h: 2 }]);
    expect(map.safeZones).toHaveLength(1);
  });

  it("마지막 역할 구역이 사라지면 키 자체가 없어진다 — 빈 배열을 남기지 않는다", () => {
    // 역할을 떼고 구역도 지운 상태 — 기록만 남아 있다.
    const map = mapWith([], {
      safeZones: [{ x: 1, y: 1, w: 3, h: 2 }],
    });
    map.locationRoleProjection = { safeZone: { loc1: { x: 1, y: 1, w: 3, h: 2 } } };
    projectLocationRoles(map);
    expect(map.safeZones).toBeUndefined();
  });
});
