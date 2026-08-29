// test/footprintLanding.test.ts
// 워프 착지 해소 — 발자국이 안 맞으면 체비쇼프 나선으로 밀어낸다.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §3 워프 착지.

import { describe, expect, it } from "vitest";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import { UNIT_FOOTPRINT, characterFootprintCells } from "@/project/footprint";
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
    for (const cell of characterFootprintCells(landed.x, landed.y, { width: 2, height: 2 })) {
      expect(isPassable(project, map, cell.x, cell.y), `(${cell.x},${cell.y})`).toBe(true);
    }
    expect(Math.max(Math.abs(landed.x - 8), Math.abs(landed.y - 8))).toBe(1);
  });

  it("같은 거리에 여러 칸이 비면 링 순서가 승자를 정한다 — 열 교대 순서를 고정한다", () => {
    // 링 순서 계약을 고정하는 테스트다. 반경 1 링의 실제 방출 순서는 열 단위 교대인
    // (7,7) (7,9) (8,7) (8,9) (9,7) (9,9) (7,8) (9,8) 이고, 행 우선이라면
    // (7,7) (8,7) (9,7) (7,9) ... 가 된다. 두 순서가 갈리는 건 두 번째 자리다.
    //
    // 그래서 (8,8) 자신과 첫 후보 (7,7) 만 막고 (7,9) 와 (8,7) 은 둘 다 열어 둔다.
    // 열 교대면 (7,9) 가, 행 우선이면 (8,7) 이 이긴다. 거리만 보는 단정은 둘을
    // 구분하지 못하므로 칸을 직접 못박는다.
    const { project, map } = scene();
    const fp = { width: 2, height: 2 };
    setLower(map, 9, 8, TILE.WALL); // (8,8) 자신의 발자국 (8,7)(9,7)(8,8)(9,8) 을 깬다
    setLower(map, 7, 6, TILE.WALL); // 첫 후보 (7,7) 의 발자국 (7,6)(8,6)(7,7)(8,7) 을 깬다

    const landed = land(project, map, [], 8, 8, fp);

    expect(landed).toEqual({ x: 7, y: 9 });
    // 승자가 실제로 유효해야 한다 — 순서만 맞고 자리가 안 맞으면 의미가 없다.
    for (const cell of characterFootprintCells(landed.x, landed.y, fp)) {
      expect(isPassable(project, map, cell.x, cell.y), `(${cell.x},${cell.y})`).toBe(true);
    }
    // 행 우선이면 이겼을 칸도 실제로 비어 있어야 이 테스트가 순서를 구분한다.
    for (const cell of characterFootprintCells(8, 7, fp)) {
      expect(isPassable(project, map, cell.x, cell.y), `행 우선 후보 (${cell.x},${cell.y})`).toBe(true);
    }
  });

  it("맵 경계를 넘으면 안쪽으로 밀린다", () => {
    const { project, map } = scene();
    // (0,0) 3x3 의 발자국은 x -1..1 / y -2..0 이라 경계를 벗어난다.
    const landed = land(project, map, [], 0, 0, { width: 3, height: 3 });
    for (const cell of characterFootprintCells(landed.x, landed.y, { width: 3, height: 3 })) {
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

  // 원래 여기 "탐색은 결정적이다 — 같은 입력이면 같은 칸이 나온다" 테스트가 있었다.
  // 같은 인자로 두 번 부르고 결과를 비교하는 형태였는데, 무작위성도 불안정한 순회도
  // 없는 순수 함수에서는 필연적으로 참이라 링 순서가 틀린 구현도 통과했다. 실제로
  // 지켜야 할 계약은 "여러 칸이 동순위일 때 어느 칸이 이기는가" 이고, 위의 동순위
  // 테스트가 그걸 못박으므로 이 테스트는 그쪽으로 대체했다.
});
