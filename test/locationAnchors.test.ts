// 로케이션 앵커 (2026-09-12): 좌표 대신 이름으로 목적지를 가리킨다.
import { describe, expect, it } from "vitest";
import { locationCenter, resolveAnchorPoint, resolveLocationAnchorRect } from "@/project/locationAnchors";
import { createBlankProject } from "@/project/defaults";
import { collectProjectReferenceIssues } from "@/project/io/references";
import type { GameMap, Project } from "@/project/types";

function mapWith(id: string, locations: GameMap["locations"]): GameMap {
  return {
    id,
    name: id,
    width: 20,
    height: 20,
    tilesetId: "easyrpg_chipset_combined_town",
    tileSize: 16,
    lowerTiles: new Array(400).fill(0),
    upperTiles: new Array(400).fill(0),
    events: [],
    locations,
  };
}

function projectWith(): Project {
  const project = createBlankProject();
  project.maps = {
    map_a: mapWith("map_a", [{ id: "loc1", name: "광장", x: 4, y: 6, w: 5, h: 3 }]),
    map_b: mapWith("map_b", [{ id: "loc1", name: "다른 광장", x: 40, y: 40, w: 2, h: 2 }]),
  };
  project.startMapId = "map_a";
  return project;
}

describe("location anchors", () => {
  it("중심 칸은 홀수 크기에서 정확히 가운데다", () => {
    expect(locationCenter({ x: 4, y: 6, w: 5, h: 3 })).toEqual({ x: 6, y: 7 });
    expect(locationCenter({ x: 0, y: 0, w: 1, h: 1 })).toEqual({ x: 0, y: 0 });
  });

  it("앵커는 그 맵의 구역 사각형을 푼다", () => {
    const project = projectWith();
    expect(resolveLocationAnchorRect(project, "map_a", { locationId: "loc1" })).toEqual({ x: 4, y: 6, w: 5, h: 3 });
  });

  it("맵을 안 주면 풀지 않는다 — loc1 은 맵마다 다른 장소다", () => {
    const project = projectWith();
    expect(resolveLocationAnchorRect(project, undefined, { locationId: "loc1" })).toBeNull();
    expect(resolveLocationAnchorRect(project, "map_b", { locationId: "loc1" })).toEqual({ x: 40, y: 40, w: 2, h: 2 });
  });

  it("끊긴 참조는 폴백 좌표로 돌려주고 fromLocation=false 로 말한다", () => {
    const project = projectWith();
    const point = resolveAnchorPoint(project, "map_a", { locationId: "loc_missing" }, { x: 1, y: 2 });
    expect(point).toEqual({ x: 1, y: 2, fromLocation: false });
  });

  it("앵커가 있으면 좌표를 무시하고 구역 중심을 쓴다", () => {
    const project = projectWith();
    const point = resolveAnchorPoint(project, "map_a", { locationId: "loc1" }, { x: 1, y: 2 });
    expect(point).toEqual({ x: 6, y: 7, fromLocation: true });
  });

  it("앵커가 없으면 좌표 그대로다 — 옛 정의가 그대로 돈다", () => {
    const project = projectWith();
    expect(resolveAnchorPoint(project, "map_a", {}, { x: 3, y: 4 })).toEqual({ x: 3, y: 4, fromLocation: false });
  });

  it("구역을 옮기면 해석 결과도 따라간다 — 복사본이 아니다", () => {
    const project = projectWith();
    project.maps.map_a.locations = [{ id: "loc1", name: "광장", x: 10, y: 10, w: 5, h: 3 }];
    expect(resolveLocationAnchorRect(project, "map_a", { locationId: "loc1" })).toEqual({ x: 10, y: 10, w: 5, h: 3 });
  });

  it("끊긴 필드 스폰 앵커를 참조 검증이 올린다", () => {
    const project = projectWith();
    project.maps.map_a.fieldSpawns = [
      { id: "spawn_1", troopId: Object.values(project.database.troops)[0]?.id ?? "troop_1", area: { x: 1, y: 1, w: 2, h: 2 }, locationId: "loc_missing" },
    ];
    const issues = collectProjectReferenceIssues(project);
    expect(issues.some((issue) => issue.includes("fieldSpawns[0].locationId does not exist"))).toBe(true);
  });

  it("살아 있는 앵커는 조용하다", () => {
    const project = projectWith();
    const troopId = Object.values(project.database.troops)[0]?.id ?? "troop_1";
    project.maps.map_a.fieldSpawns = [
      { id: "spawn_1", troopId, area: { x: 1, y: 1, w: 2, h: 2 }, locationId: "loc1" },
    ];
    const issues = collectProjectReferenceIssues(project);
    expect(issues.some((issue) => issue.includes("locationId does not exist"))).toBe(false);
  });
});
