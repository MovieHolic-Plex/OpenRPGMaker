// test/playPreflight.test.ts
// 플레이 부팅 전 프로젝트 예비검사(순수) — 수리 코드별 1건, 차단 코드별 1건,
// 건강한 프로젝트 무수리 통과, 입력 불변성.

import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { preflightProjectForPlay } from "@/project/playPreflight";
import type { Project } from "@/project/types";

function codes(list: readonly { code: string }[]): string[] {
  return list.map((entry) => entry.code);
}

describe("preflightProjectForPlay", () => {
  it("건강한 프로젝트는 수리도 차단도 없이 통과한다", () => {
    const project = createBlankProject();
    const result = preflightProjectForPlay(project);
    expect(result.repairs).toEqual([]);
    expect(result.blockers).toEqual([]);
    expect(result.project.startMapId).toBe(project.startMapId);
  });

  it("입력 프로젝트를 변형하지 않는다", () => {
    const project = createBlankProject();
    project.startMapId = "map_gone";
    project.session = { ...project.session, partyActorIds: [] };
    const before = JSON.stringify(project);
    preflightProjectForPlay(project);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("없는 시작 맵은 맵 트리 루트로 재배선한다 (start-map-missing)", () => {
    const project = createBlankProject();
    const rootMapId = project.mapTree.mapId;
    project.startMapId = "map_gone";
    const result = preflightProjectForPlay(project);
    expect(codes(result.repairs)).toContain("start-map-missing");
    expect(result.project.startMapId).toBe(rootMapId);
    expect(result.blockers).toEqual([]);
  });

  it("시작 맵의 타일셋이 없으면 있는 타일셋으로 대체한다 (start-map-tileset-missing)", () => {
    const project = createBlankProject();
    const startMap = project.maps[project.startMapId]!;
    startMap.tilesetId = "tileset_gone";
    const result = preflightProjectForPlay(project);
    expect(codes(result.repairs)).toContain("start-map-tileset-missing");
    const repaired = result.project.maps[result.project.startMapId]!;
    expect(Object.keys(result.project.tilesets)).toContain(repaired.tilesetId);
  });

  it("빈 파티는 첫 액터로 채운다 (party-empty)", () => {
    const project = createBlankProject();
    project.session = { ...project.session, partyActorIds: [] };
    const result = preflightProjectForPlay(project);
    expect(codes(result.repairs)).toContain("party-empty");
    expect(result.project.session.partyActorIds).toEqual([project.database.actors[0]!.id]);
  });

  it("존재하지 않는 파티 액터 id 도 첫 액터로 되돌린다 (party-empty)", () => {
    const project = createBlankProject();
    project.session = { ...project.session, partyActorIds: ["actor_gone"] };
    const result = preflightProjectForPlay(project);
    expect(codes(result.repairs)).toContain("party-empty");
    expect(result.project.session.partyActorIds).toEqual([project.database.actors[0]!.id]);
  });

  it("맵 밖 시작 좌표는 통행 가능한 칸으로 옮긴다 (start-position-unreachable)", () => {
    const project = createBlankProject();
    project.startPos = { x: 999, y: 999 };
    const result = preflightProjectForPlay(project);
    expect(codes(result.repairs)).toContain("start-position-unreachable");
    const map = result.project.maps[result.project.startMapId]!;
    const pos = result.project.startPos;
    expect(isPassable(result.project, map, pos.x, pos.y)).toBe(true);
  });

  it("통행 불가 타일 위 시작 좌표는 가장 가까운 통행 가능 칸으로 옮긴다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    project.startPos = { x: 5, y: 5 };
    map.lowerTiles[5 * map.width + 5] = TILE.WATER;
    map.upperTiles[5 * map.width + 5] = TILE.EMPTY;
    const result = preflightProjectForPlay(project);
    expect(codes(result.repairs)).toContain("start-position-unreachable");
    const repairedMap = result.project.maps[result.project.startMapId]!;
    const pos = result.project.startPos;
    expect(isPassable(result.project, repairedMap, pos.x, pos.y)).toBe(true);
    const distance = Math.max(Math.abs(pos.x - 5), Math.abs(pos.y - 5));
    expect(distance).toBe(1);
  });

  it("startOverride 좌표도 같은 규칙으로 검증·수리한다", () => {
    const project = createBlankProject();
    const result = preflightProjectForPlay(project, { mapId: project.startMapId, x: -3, y: 40 });
    expect(codes(result.repairs)).toContain("start-position-unreachable");
    const map = result.project.maps[result.project.startMapId]!;
    expect(isPassable(result.project, map, result.project.startPos.x, result.project.startPos.y)).toBe(true);
  });

  it("startOverride 의 맵이 없으면 시작 맵을 재배선한다", () => {
    const project = createBlankProject();
    const result = preflightProjectForPlay(project, { mapId: "map_gone", x: 1, y: 1 });
    expect(codes(result.repairs)).toContain("start-map-missing");
    expect(result.project.maps[result.project.startMapId]).toBeTruthy();
  });

  it("맵이 하나도 없으면 던지지 않고 차단 사유를 보고한다 (no-maps)", () => {
    const project = createBlankProject();
    const broken: Project = { ...project, maps: {}, mapTree: { mapId: "", children: [] } };
    const result = preflightProjectForPlay(broken);
    expect(codes(result.blockers)).toContain("no-maps");
    expect(result.blockers[0]!.detail.length).toBeGreaterThan(0);
  });

  it("타일셋이 하나도 없으면 던지지 않고 차단 사유를 보고한다 (no-tilesets)", () => {
    const project = createBlankProject();
    const broken: Project = { ...project, tilesets: {} };
    const result = preflightProjectForPlay(broken);
    expect(codes(result.blockers)).toContain("no-tilesets");
  });

  it("액터가 하나도 없어도 던지지 않는다", () => {
    const project = createBlankProject();
    const broken: Project = {
      ...project,
      database: { ...project.database, actors: [] },
      session: { ...project.session, partyActorIds: [] },
    };
    expect(() => preflightProjectForPlay(broken)).not.toThrow();
  });
});
