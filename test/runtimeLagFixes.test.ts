// 런타임 렉 수정(2026-09-27)의 동등성 회귀. 각 최적화가 **예전 구현과 같은 답**을 내는지를 본다 —
// 빨라졌다는 것 자체는 단위 테스트로 증명하지 않는다(그건 계수 대조로 본다: 호출 수·뷰 생성 수).
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import * as io from "@/project/io";
import {
  findBlockingEventOverlappingRect,
  findEventOverlappingRect,
  initialRuntimeEventPositions,
  runtimeEventViewById,
  runtimeEventViewsForMap,
} from "@/project/runtimeEventState";
import { footprintBounds, pointRect } from "@/project/footprint";
import { nearestPassableTile } from "@/player/playSceneMapCommands";
import { advanceTimeAcrossDayBoundaries } from "@/player/dayTransition";
import { lightingMaskSignature } from "@/player/lighting";
import { RuntimeDomOverlay } from "@/player/runtimeDom";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { isPassable, isPassableLanding } from "@/project/collision";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { defaultTilesets } from "@/project/defaults/defaultAssets";

function page(id: string, overrides: Partial<EventPage> = {}): EventPage {
  return {
    id, name: id, conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [], ...overrides,
  };
}

function event(id: string, x: number, y: number, pages: EventPage[] = [page(`${id}_p`)]): GameEvent {
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages };
}

function world() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const other: GameMap = { ...structuredClone(map), id: "map_other", events: [] };
  project.maps[other.id] = other;
  // 3x3 골렘(앵커에서 왼쪽·위로 몸이 뻗는다), 스위치로 꺼지는 페이지, 옮겨 온 이벤트, 옮겨 간 이벤트, 소환 이벤트.
  map.events = [
    event("npc", 2, 2),
    event("golem", 10, 10, [page("golem_p", { footprint: { width: 3, height: 3 }, passRows: 1 })]),
    event("dormant", 5, 5, [page("dormant_p", { conditions: [{ kind: "switch", switchId: "sw_on", value: true }] })]),
    event("away", 7, 7),
    event("erased", 8, 8),
  ];
  other.events = [event("visitor", 0, 0), event("template", 1, 1)];
  const session = startSession(project) as PlaySessionLike;
  session.eventLocations = {
    visitor: { mapId: map.id, x: 4, y: 9, direction: "down" },
    away: { mapId: other.id, x: 1, y: 1, direction: "down" },
  };
  session.erasedEventIds = ["erased"];
  session.spawnedEvents = { spawned_1: { mapId: map.id, templateMapId: other.id, templateEventId: "template", x: 12, y: 3 } } as never;
  const positions = initialRuntimeEventPositions(map.events);
  return { project, map, session, positions };
}

afterEach(() => vi.restoreAllMocks());

describe("runtimeEventViewById — 순회 원본과 같은 답", () => {
  it("모든 id 에서 전체 순회의 결과와 같다(포함·제외·옮김·소환)", () => {
    const { project, map, session, positions } = world();
    const all = runtimeEventViewsForMap(project, map, session, positions);
    for (const id of ["npc", "golem", "dormant", "away", "erased", "visitor", "template", "spawned_1", "nope"]) {
      const expected = all.find((view) => view.event.id === id);
      expect(runtimeEventViewById(project, map, session, positions, id), id).toEqual(expected);
    }
  });

  it("다른 이벤트의 페이지를 해석하지 않는다", () => {
    const { project, map, session, positions } = world();
    const resolve = vi.spyOn(io, "resolveEventPage");
    runtimeEventViewById(project, map, session, positions, "golem");
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});

describe("사각 질의의 앵커 사전 거르기", () => {
  it("맵의 모든 칸에서 거르기 없는 판정과 같은 이벤트를 찾는다", () => {
    const { project, map, session, positions } = world();
    const all = runtimeEventViewsForMap(project, map, session, positions);
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        const rect = pointRect(x, y);
        const body = all.find((view) => view.bodyRect.left <= x && x <= view.bodyRect.right && view.bodyRect.top <= y && y <= view.bodyRect.bottom
          && view.trigger.kind === "action");
        expect(findEventOverlappingRect(project, map, session, positions, rect, "action")?.event.id, `body ${x},${y}`).toBe(body?.event.id);
        const pass = all.find((view) => view.passRect.left <= x && x <= view.passRect.right && view.passRect.top <= y && y <= view.passRect.bottom
          && view.priority === "same" && view.overlapForbidden);
        expect(findBlockingEventOverlappingRect(project, map, session, positions, rect)?.event.id, `pass ${x},${y}`).toBe(pass?.event.id);
      }
    }
  });

  it("최대 크기(8x8) 몸의 가장자리 칸도 놓치지 않는다", () => {
    const { project, map, session, positions } = world();
    map.events.push(event("titan", 20, 20, [page("titan_p", { footprint: { width: 8, height: 8 } })]));
    const body = footprintBounds(20, 20, { width: 8, height: 8 });
    for (const [x, y] of [[body.left, body.top], [body.right, body.top], [body.left, body.bottom], [body.right, body.bottom]] as const) {
      expect(findEventOverlappingRect(project, map, session, positions, pointRect(x, y), "action")?.event.id).toBe("titan");
    }
    expect(findEventOverlappingRect(project, map, session, positions, pointRect(body.right + 1, body.bottom), "action")).toBeUndefined();
  });

  it("멀리 있는 이벤트는 페이지를 해석하지 않는다", () => {
    const { project, map, session, positions } = world();
    const resolve = vi.spyOn(io, "resolveEventPage");
    findBlockingEventOverlappingRect(project, map, session, positions, pointRect(2, 2));
    // npc 만 앵커 범위 안이다(골렘·방문자·소환은 범위 밖).
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});

describe("nearestPassableTile — 고리 훑기가 예전 전체 훑기와 같은 칸을 고른다", () => {
  const tileset = defaultTilesets()[DEFAULT_TILESET_ID]!;
  const project = { tilesets: { [DEFAULT_TILESET_ID]: tileset } } as unknown as Project;

  function legacy(map: GameMap, x: number, y: number): { x: number; y: number } {
    const fx = Math.max(0, Math.min(map.width - 1, x));
    const fy = Math.max(0, Math.min(map.height - 1, y));
    if (isPassableLanding(project, map, fx, fy)) return { x: fx, y: fy };
    for (const accept of [isPassableLanding, isPassable]) {
      for (let radius = 0; radius < Math.max(map.width, map.height); radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (accept(project, map, fx + dx, fy + dy)) return { x: fx + dx, y: fy + dy };
          }
        }
      }
    }
    return { x: fx, y: fy };
  }

  it("무작위 벽 배치 200개에서 결과가 같다", () => {
    let seed = 7;
    const random = (): number => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 2 ** 32; };
    for (let trial = 0; trial < 200; trial += 1) {
      const width = 5 + Math.floor(random() * 9);
      const height = 5 + Math.floor(random() * 9);
      const density = random();
      const lowerTiles = Array.from({ length: width * height }, () => (random() < density ? 306 : random() < 0.2 ? 230 : 240));
      const map = { id: "m", name: "m", width, height, tilesetId: DEFAULT_TILESET_ID, tileSize: 16, lowerTiles,
        upperTiles: new Array<number>(width * height).fill(-1), events: [] } as unknown as GameMap;
      const x = Math.floor(random() * width);
      const y = Math.floor(random() * height);
      expect(nearestPassableTile(project, map, x, y), `trial ${trial}`).toEqual(legacy(map, x, y));
    }
  });
});

describe("같은 날 안의 시계 전진", () => {
  function timed() {
    const project = createBlankProject();
    project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28, minutesPerRealSecond: 1 };
    store.replaceProject(project);
    const session = startSession(project, 11);
    session.gameTime = { year: 1, season: "spring", day: 3, hour: 10, minute: 0 };
    return { project, session };
  }

  it("날짜 경계 전에는 세션을 복제하지 않고 시계만 옮긴다", () => {
    const { project, session } = timed();
    const inventory = session.inventory;
    const clone = vi.spyOn(globalThis, "structuredClone");
    const result = advanceTimeAcrossDayBoundaries(project, session, 5);
    expect(result).toMatchObject({ ok: true, receipts: [], time: { hour: 10, minute: 5 } });
    expect(session.gameTime).toMatchObject({ day: 3, hour: 10, minute: 5 });
    // 세션 전체 복제·교체가 없으면 소유 객체 정체성이 그대로다.
    expect(session.inventory).toBe(inventory);
    expect(clone.mock.calls.every(([value]) => value !== session)).toBe(true);
  });

  it("경계를 넘는 전진은 예전처럼 날짜 전이를 거친다", () => {
    const { project, session } = timed();
    session.gameTime = { year: 1, season: "spring", day: 3, hour: 25, minute: 55 };
    const result = advanceTimeAcrossDayBoundaries(project, session, 10);
    expect(result).toMatchObject({ ok: true, receipts: [{ sourceDayKey: "1:spring:3" }] });
  });
});

describe("조명 서명", () => {
  it("값이 같으면 같고, 좌표·세기가 바뀌면 다르다", () => {
    const base = { ambient: 0.5, color: "#000000", width: 320, height: 240,
      gradients: [{ id: "lamp", centerX: 10.0001, centerY: 20, radiusPx: 64, intensity: 0.6, color: undefined, flicker: 1 }] };
    expect(lightingMaskSignature(base)).toBe(lightingMaskSignature(structuredClone(base)));
    expect(lightingMaskSignature(base)).toBe(lightingMaskSignature({ ...base, gradients: [{ ...base.gradients[0]!, centerX: 10.0004 }] }));
    expect(lightingMaskSignature(base)).not.toBe(lightingMaskSignature({ ...base, gradients: [{ ...base.gradients[0]!, centerX: 11 }] }));
    expect(lightingMaskSignature(base)).not.toBe(lightingMaskSignature({ ...base, gradients: [{ ...base.gradients[0]!, intensity: 0.7 }] }));
    expect(lightingMaskSignature(base)).not.toBe(lightingMaskSignature({ ...base, ambient: 0.6 }));
  });
});

describe("QA 상태 미러는 읽을 때만 만든다", () => {
  it("프레임마다 출처를 걸어도 읽기 전에는 스냅샷을 만들지 않고, 읽으면 최신 값을 낸다", () => {
    const restore = installFakeDom();
    try {
      const host = new FakeElement("div");
      const overlay = new RuntimeDomOverlay(() => host as unknown as HTMLElement, { qaInstrumentation: true });
      let gold = 0;
      const build = vi.fn(() => ({ mapId: "map_town", gold } as never));
      for (let frame = 0; frame < 120; frame += 1) {
        gold = frame;
        overlay.syncRuntimeStateSource(build, { mapId: "map_town", x: 1, y: 2, inputEnabled: true, running: false });
      }
      expect(build).not.toHaveBeenCalled();
      const node = findByTestId(host, "runtime-state-json");
      expect(JSON.parse(node!.textContent)).toMatchObject({ mapId: "map_town", gold: 119 });
      expect(build).toHaveBeenCalledTimes(1);
      expect((node as unknown as HTMLElement).dataset.liveFlags).toBe("map_town|1|2|true|false");
    } finally {
      restore();
    }
  });

  it("계측 부팅이 아니면 미러를 만들지 않는다", () => {
    const restore = installFakeDom();
    try {
      const host = new FakeElement("div");
      const overlay = new RuntimeDomOverlay(() => host as unknown as HTMLElement);
      const build = vi.fn(() => ({}) as never);
      overlay.syncRuntimeStateSource(build);
      expect(findByTestId(host, "runtime-state-json")).toBeNull();
      expect(build).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

