// test/footprintLanding.test.ts
// 워프 착지 해소 — 발자국이 안 맞으면 체비쇼프 나선으로 밀어낸다.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §3 워프 착지.

import { describe, expect, it } from "vitest";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import { UNIT_FOOTPRINT, footprintCells } from "@/project/footprint";
import { resolveFootprintLanding } from "@/project/footprintLanding";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

function session(): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorVitals: {},
    currentMapId: "map_runtime",
    x: 0,
    y: 0,
  };
}

function scene(events: GameEvent[] = []): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = createBlankMap("착지 시험장", 20, 15, project.maps[project.startMapId].tilesetId);
  map.events = events;
  project.maps[map.id] = map;
  return { project, map };
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  map.lowerTiles[y * map.width + x] = tile;
}

function land(project: Project, map: GameMap, events: GameEvent[], x: number, y: number, fp: { width: number; height: number }, maxRadius?: number) {
  return resolveFootprintLanding(project, map, session(), initialRuntimeEventPositions(events), x, y, fp, maxRadius);
}

describe("1x1 은 검사 없이 그대로 착지한다", () => {
  it("통행 불가 칸으로도 워프한다 — 컷신 배치를 깨지 않기 위한 기존 동작 보존", () => {
    const { project, map } = scene();
    setLower(map, 5, 5, TILE.WALL);
    expect(isPassable(project, map, 5, 5)).toBe(false);
    expect(land(project, map, [], 5, 5, UNIT_FOOTPRINT)).toEqual({ x: 5, y: 5 });
  });

  it("맵 밖으로도 그대로 준다 — 판정 자체를 하지 않는다", () => {
    const { project, map } = scene();
    expect(land(project, map, [], -3, -3, UNIT_FOOTPRINT)).toEqual({ x: -3, y: -3 });
  });
});

describe("다중 타일 착지", () => {
  it("자리가 있으면 지정 좌표 그대로다", () => {
    const { project, map } = scene();
    expect(land(project, map, [], 8, 8, { width: 2, height: 2 })).toEqual({ x: 8, y: 8 });
  });

  it("벽에 걸리면 가까운 유효 칸으로 밀린다", () => {
    const { project, map } = scene();
    // (8,8) 2x2 의 발자국은 (8,7) (9,7) (8,8) (9,8). 그 중 하나를 막는다.
    setLower(map, 9, 7, TILE.WALL);
    const landed = land(project, map, [], 8, 8, { width: 2, height: 2 });
    expect(landed).not.toEqual({ x: 8, y: 8 });
    for (const cell of footprintCells(landed.x, landed.y, { width: 2, height: 2 })) {
      expect(isPassable(project, map, cell.x, cell.y), `(${cell.x},${cell.y})`).toBe(true);
    }
    expect(Math.max(Math.abs(landed.x - 8), Math.abs(landed.y - 8))).toBe(1);
  });

  it("맵 경계를 넘으면 안쪽으로 밀린다", () => {
    const { project, map } = scene();
    // (0,0) 3x3 의 발자국은 x -1..1 / y -2..0 이라 경계를 벗어난다.
    const landed = land(project, map, [], 0, 0, { width: 3, height: 3 });
    for (const cell of footprintCells(landed.x, landed.y, { width: 3, height: 3 })) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("차단 이벤트 위에는 착지하지 않는다", () => {
    const blocker: GameEvent = {
      id: "ev_block",
      x: 8,
      y: 8,
      trigger: { kind: "action" },
      commands: [],
      pages: [{
        id: "p1", name: "p1", conditions: [], graphic: {},
        trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
      }],
    };
    const { project, map } = scene([blocker]);
    const landed = land(project, map, [blocker], 8, 8, { width: 2, height: 2 });
    expect(landed).not.toEqual({ x: 8, y: 8 });
  });

  it("반경 안에 자리가 없으면 지정 좌표로 폴백한다 — 게임을 죽이지 않는다", () => {
    const { project, map } = scene();
    // 넓게 벽으로 덮어 반경 2 안에 3x3 이 들어갈 자리를 없앤다.
    for (let y = 0; y < 15; y += 1) {
      for (let x = 0; x < 20; x += 1) setLower(map, x, y, TILE.WALL);
    }
    expect(land(project, map, [], 8, 8, { width: 3, height: 3 }, 2)).toEqual({ x: 8, y: 8 });
  });

  it("탐색은 결정적이다 — 같은 입력이면 같은 칸이 나온다", () => {
    const { project, map } = scene();
    setLower(map, 9, 7, TILE.WALL);
    const first = land(project, map, [], 8, 8, { width: 2, height: 2 });
    const second = land(project, map, [], 8, 8, { width: 2, height: 2 });
    expect(second).toEqual(first);
  });
});
