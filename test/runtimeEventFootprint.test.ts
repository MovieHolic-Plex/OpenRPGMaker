// test/runtimeEventFootprint.test.ts
// 이벤트 발자국의 런타임 해석 — 페이지에서 읽어 RuntimeEventView 로 노출한다.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §2.

import { describe, expect, it } from "vitest";
import { UNIT_FOOTPRINT, pointRect } from "@/project/footprint";
import {
  findBlockingEventOverlappingRect,
  findBlockingRuntimeEventAt,
  findBlockingRuntimeEventAtInMap,
  findEventOverlappingRect,
  findRuntimeEventAt,
  findRuntimeEventAtInMap,
  initialRuntimeEventPositions,
  runtimeEventView,
} from "@/project/runtimeEventState";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

function page(overrides: Partial<EventPage> = {}): EventPage {
  return {
    id: "page1",
    name: "page1",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
    ...overrides,
  };
}

function event(pages: EventPage[]): GameEvent {
  return { id: "ev1", x: 5, y: 7, trigger: { kind: "action" }, commands: [], pages };
}

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

function viewOf(pages: EventPage[]) {
  const target = event(pages);
  return runtimeEventView(target, session(), initialRuntimeEventPositions([target]));
}

describe("RuntimeEventView.footprint", () => {
  it("발자국이 없는 페이지는 1x1 이다", () => {
    expect(viewOf([page()]).footprint).toEqual(UNIT_FOOTPRINT);
  });

  it("페이지가 지정한 발자국을 노출한다", () => {
    expect(viewOf([page({ footprint: { width: 2, height: 2 } })]).footprint).toEqual({ width: 2, height: 2 });
  });

  it("쓰레기 값은 1x1 로 정규화된다", () => {
    const broken = page({ footprint: { width: 0, height: 999 } as never });
    expect(viewOf([broken]).footprint).toEqual({ width: 1, height: 8 });
  });

  it("페이지가 아예 없는 레거시 이벤트도 1x1 이다", () => {
    const legacy: GameEvent = { id: "ev0", x: 1, y: 1, trigger: { kind: "action" }, commands: [] };
    const view = runtimeEventView(legacy, session(), initialRuntimeEventPositions([legacy]));
    expect(view.footprint).toEqual(UNIT_FOOTPRINT);
  });
});

describe("RuntimeEventView.scale", () => {
  it("배율이 없으면 1 이다", () => {
    expect(viewOf([page()]).scale).toBe(1);
  });

  it("그래픽 배율을 노출한다", () => {
    expect(viewOf([page({ graphic: { scale: 2 } })]).scale).toBe(2);
  });

  it("배율과 발자국은 독립이다 — 한쪽만 줘도 다른 쪽은 기본값이다", () => {
    const view = viewOf([page({ graphic: { scale: 3 } })]);
    expect(view.scale).toBe(3);
    expect(view.footprint).toEqual(UNIT_FOOTPRINT);
  });
});

function mapWithEvent(target: GameEvent): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = createBlankMap("발자국 맵", 20, 15, project.maps[project.startMapId].tilesetId);
  map.events = [target];
  project.maps[map.id] = map;
  return { project, map };
}

function bigEvent(footprint: { width: number; height: number }): GameEvent {
  return {
    id: "ev_big",
    x: 5,
    y: 7,
    trigger: { kind: "action" },
    commands: [],
    pages: [page({ footprint, priority: "same", overlapForbidden: true })],
  };
}

describe("사각 질의 승격 — 2x2 이벤트", () => {
  // (5,7) 에 선 2x2 의 발자국은 (5,6) (6,6) (5,7) (6,7).
  const OCCUPIED = [[5, 6], [6, 6], [5, 7], [6, 7]] as const;
  const FREE = [[4, 7], [7, 7], [5, 5], [5, 8]] as const;

  it("발자국 네 칸 어디에서 조사해도 같은 이벤트를 찾는다", () => {
    const target = bigEvent({ width: 2, height: 2 });
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    for (const [x, y] of OCCUPIED) {
      const found = findRuntimeEventAtInMap(project, map, session(), positions, x, y, "action");
      expect(found?.event.id, `(${x},${y})`).toBe("ev_big");
    }
  });

  it("발자국 밖에서는 찾지 못한다", () => {
    const target = bigEvent({ width: 2, height: 2 });
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    for (const [x, y] of FREE) {
      expect(findRuntimeEventAtInMap(project, map, session(), positions, x, y, "action"), `(${x},${y})`).toBeUndefined();
    }
  });

  it("발자국 네 칸 전부가 통행을 막는다", () => {
    const target = bigEvent({ width: 2, height: 2 });
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    for (const [x, y] of OCCUPIED) {
      expect(findBlockingRuntimeEventAtInMap(project, map, session(), positions, x, y), `(${x},${y})`).toBeDefined();
    }
    for (const [x, y] of FREE) {
      expect(findBlockingRuntimeEventAtInMap(project, map, session(), positions, x, y), `(${x},${y})`).toBeUndefined();
    }
  });
});

describe("사각 질의 원본", () => {
  it("겹치는 사각으로 질의하면 찾는다 — 커진 플레이어 경로", () => {
    const target = bigEvent({ width: 2, height: 2 });
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    // 이벤트 발자국은 x 5..6 / y 6..7. 아래 사각은 x 6..8 / y 7..9 라 (6,7) 에서 겹친다.
    const overlapping = { left: 6, right: 8, top: 7, bottom: 9 };
    expect(findEventOverlappingRect(project, map, session(), positions, overlapping, "action")?.event.id).toBe("ev_big");
    expect(findBlockingEventOverlappingRect(project, map, session(), positions, overlapping)?.event.id).toBe("ev_big");
  });

  it("닿지 않는 사각은 못 찾는다", () => {
    const target = bigEvent({ width: 2, height: 2 });
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    const apart = { left: 7, right: 9, top: 8, bottom: 10 };
    expect(findEventOverlappingRect(project, map, session(), positions, apart, "action")).toBeUndefined();
  });

  it("점 질의는 1x1 사각 질의와 같은 답을 준다 — 독립적으로 손으로 계산한 정답과 대조한다", () => {
    // 1x1 이벤트 하나를 (5,7) 에 놓는다. 1x1 의 사각은 그 칸 자신이므로 정답은
    // "(5,7) 에서만 defined, 나머지 55 좌표는 전부 undefined" 라고 손으로 안다 —
    // 함수 자체를 서로 비교하면(피검사 함수를 정답으로 쓰면) 이 비교는 아무것도
    // 보장하지 않는다(findRuntimeEventAtInMap 이 findEventOverlappingRect 를
    // pointRect 로 위임하는 래퍼라 자기 자신과 비교하는 꼴이 되기 때문).
    const anchor = { x: 5, y: 7 };
    const target: GameEvent = {
      id: "ev_unit",
      x: anchor.x,
      y: anchor.y,
      trigger: { kind: "action" },
      commands: [],
      pages: [page({ priority: "same", overlapForbidden: true })],
    };
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    for (let y = 4; y <= 10; y += 1) {
      for (let x = 2; x <= 9; x += 1) {
        const expectedId = x === anchor.x && y === anchor.y ? "ev_unit" : undefined;
        const viaPoint = findRuntimeEventAtInMap(project, map, session(), positions, x, y, "action");
        const viaRect = findEventOverlappingRect(project, map, session(), positions, pointRect(x, y), "action");
        expect(viaPoint?.event.id, `점 질의 (${x},${y})`).toBe(expectedId);
        expect(viaRect?.event.id, `사각 질의 (${x},${y})`).toBe(expectedId);
      }
    }
  });
});

describe("배열 형태 finder 도 발자국을 본다", () => {
  it("findRuntimeEventAt / findBlockingRuntimeEventAt 이 2x2 네 칸에서 잡힌다", () => {
    const target = bigEvent({ width: 2, height: 2 });
    const positions = initialRuntimeEventPositions([target]);
    for (const [x, y] of [[5, 6], [6, 6], [5, 7], [6, 7]]) {
      expect(findRuntimeEventAt([target], session(), positions, x, y, "action")?.event.id, `조사 (${x},${y})`).toBe("ev_big");
      expect(findBlockingRuntimeEventAt([target], session(), positions, x, y), `막힘 (${x},${y})`).toBeDefined();
    }
    for (const [x, y] of [[4, 7], [7, 7], [5, 5], [5, 8]]) {
      expect(findRuntimeEventAt([target], session(), positions, x, y, "action"), `조사 (${x},${y})`).toBeUndefined();
      expect(findBlockingRuntimeEventAt([target], session(), positions, x, y), `막힘 (${x},${y})`).toBeUndefined();
    }
  });
});

describe("1x1 이벤트는 승격 후에도 한 칸만 차지한다", () => {
  it("자기 칸에서만 잡히고 이웃 칸에서는 안 잡힌다", () => {
    const target: GameEvent = {
      id: "ev_small",
      x: 5,
      y: 7,
      trigger: { kind: "action" },
      commands: [],
      pages: [page({ priority: "same", overlapForbidden: true })],
    };
    const { project, map } = mapWithEvent(target);
    const positions = initialRuntimeEventPositions(map.events);
    expect(findRuntimeEventAtInMap(project, map, session(), positions, 5, 7, "action")?.event.id).toBe("ev_small");
    for (const [x, y] of [[4, 7], [6, 7], [5, 6], [5, 8]]) {
      expect(findRuntimeEventAtInMap(project, map, session(), positions, x, y, "action"), `(${x},${y})`).toBeUndefined();
    }
  });
});
