// test/runtimeEventFootprint.test.ts
// 이벤트 발자국의 런타임 해석 — 페이지에서 읽어 RuntimeEventView 로 노출한다.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §2.

import { describe, expect, it } from "vitest";
import { UNIT_FOOTPRINT, footprintBounds, nearestCellInRect, pointRect } from "@/project/footprint";
import { facingForDelta } from "@/player/playSceneAutonomousRouteDirection";
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
import { TILE_SIZE } from "@/assets/bundled";
import { characterSpriteX, characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { renderTiles } from "@/player/playSceneMapRuntime";

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

describe("footprintSpriteX — 발자국 가로 중앙", () => {
  it("1x1 은 기존 characterSpriteX 와 같다", () => {
    for (let x = 0; x <= 12; x += 1) {
      expect(footprintSpriteX(x, UNIT_FOOTPRINT)).toBe(characterSpriteX(x));
    }
  });

  it("홀수 폭도 기존과 같다 — 발밑 칸 중앙이 곧 발자국 중앙이다", () => {
    expect(footprintSpriteX(5, { width: 3, height: 3 })).toBe(characterSpriteX(5));
    expect(footprintSpriteX(5, { width: 5, height: 1 })).toBe(characterSpriteX(5));
  });

  it("짝수 폭은 두 칸 경계에 온다", () => {
    expect(footprintSpriteX(5, { width: 2, height: 2 })).toBe(6 * TILE_SIZE);
    expect(footprintSpriteX(5, { width: 4, height: 1 })).toBe(6 * TILE_SIZE);
  });

  it("Y 는 발자국 높이와 무관하게 발밑 칸 하단이다", () => {
    // 높이를 실제로 바꿔가며 본다. 이전 판은 characterSpriteY(7) 하나만 단정해서
    // 발자국이 인자로 등장하지 않았고, 이름이 약속한 높이 무관성을 검사하지 않았다.
    // footprintSpriteY 가 따로 없는 이유가 이것이다: 세로축은 앵커가 이미 그 축의
    // 끝(하단)이라 가로처럼 보정할 게 없다.
    for (const height of [1, 2, 3, 8]) {
      const rect = footprintBounds(7, 7, { width: 2, height });
      expect(rect.bottom, `높이 ${height} 의 하단은 앵커 행이다`).toBe(7);
      expect(rect.top, `높이 ${height} 의 상단은 위로 자란다`).toBe(7 - (height - 1));
      expect(characterSpriteY(rect.bottom), `높이 ${height} 의 스프라이트 Y`).toBe(8 * TILE_SIZE);
    }
  });
});

type CapturedSprite = {
  x: number;
  y: number;
  scale: number;
  setOrigin(originX: number, originY: number): void;
  setDepth(depth: number): void;
  play(key: string): CapturedSprite;
  setPosition(x: number, y: number): void;
  setFrame(frame: string | number): void;
  setScale(value: number): void;
  destroy(): void;
};

function renderSceneFor(target: GameEvent): {
  created: CapturedSprite[];
  scene: Parameters<typeof renderTiles>[0];
} {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.events = [target];
  store.replace(project);

  const created: CapturedSprite[] = [];
  const scene: Parameters<typeof renderTiles>[0] = {
    map,
    session: startSession(project),
    eventPositions: initialRuntimeEventPositions(map.events),
    tileLayer: { removeAll: () => undefined, add: () => undefined },
    eventSprites: new Map(),
    runtimeDom: {
      clearEventMarkers: () => undefined,
      upsertEventMarker: () => undefined,
      syncMissingResourceError: () => undefined,
    },
    missingResources: new Set<string>(),
    add: {
      image: () => ({ y: 0, setOrigin: () => undefined, setDepth: () => undefined }),
      sprite: (x: number, y: number) => {
        const sprite: CapturedSprite = {
          x,
          y,
          scale: 1,
          setOrigin: () => undefined,
          setDepth: () => undefined,
          play: () => sprite,
          setPosition: (px, py) => {
            sprite.x = px;
            sprite.y = py;
          },
          setFrame: () => undefined,
          setScale: (value) => {
            sprite.scale = value;
          },
          destroy: () => undefined,
        };
        created.push(sprite);
        return sprite;
      },
    },
    runEvent: async () => undefined,
    syncRuntimeState: () => undefined,
  };
  return { created, scene };
}

function golemEvent(footprint: { width: number; height: number }, scale: number): GameEvent {
  return {
    id: "ev_golem",
    x: 5,
    y: 7,
    trigger: { kind: "action" },
    commands: [],
    pages: [page({
      footprint,
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, scale },
      priority: "same",
      overlapForbidden: true,
    })],
  };
}

describe("renderEvents 는 발자국 중앙에 배율을 걸어 그린다", () => {
  it("2x2 배율 2 는 두 칸 경계에 배율 2 로 놓인다", () => {
    const { created, scene } = renderSceneFor(golemEvent({ width: 2, height: 2 }, 2));
    renderTiles(scene);

    expect(created).toHaveLength(1);
    expect(created[0].x).toBe(6 * TILE_SIZE);
    expect(created[0].y).toBe(8 * TILE_SIZE);
    expect(created[0].scale).toBe(2);
  });

  it("1x1 배율 1 은 기존 좌표와 배율 그대로다", () => {
    const { created, scene } = renderSceneFor(golemEvent({ width: 1, height: 1 }, 1));
    renderTiles(scene);

    expect(created).toHaveLength(1);
    expect(created[0].x).toBe(characterSpriteX(5));
    expect(created[0].y).toBe(characterSpriteY(7));
    expect(created[0].scale).toBe(1);
  });

  it("배율만 크고 발자국은 1x1 인 조합도 성립한다", () => {
    const { created, scene } = renderSceneFor(golemEvent({ width: 1, height: 1 }, 3));
    renderTiles(scene);

    expect(created[0].x).toBe(characterSpriteX(5));
    expect(created[0].scale).toBe(3);
  });
});

describe("골렘 시나리오 — 2x2 가 길을 막고 어디서든 말이 걸린다", () => {
  // 여태 프리미티브·통행·히트테스트·렌더를 따로 검증해 왔다. 여기서 보는 것은
  // **저작물 한 개**에서 넷이 동시에 맞는지다. 그래서 같은 golem 객체를 통행/조사
  // 질의와 renderTiles 양쪽에 통과시킨다 — 서로 다른 이벤트를 쓰면 "페이지에서
  // 읽는 경로"와 "그리는 경로"가 갈라져 있어도 통과해버린다.
  //
  // 이 테스트가 실패하려면 무엇이 깨져야 하는가:
  //  - 발자국 4칸 막힘 → findBlockingEventOverlappingRect 가 발자국 사각 대신 앵커
  //    점만 보면 (5,6) (6,6) (6,7) 세 칸이 undefined 로 떨어진다.
  //  - 서는 칸 4개가 안 막힘 → footprintBounds 가 반대로 전개하면(left 를
  //    x-(width-1) 로 잡으면) (4,7) 이 막혀버린다.
  //  - 4방향 조사 → 점 질의를 사각으로 승격하지 않으면 앵커 (5,7) 말고 세 칸이 빈다.
  //  - 렌더 x → renderEvents 가 footprintSpriteX 대신 characterSpriteX 를 쓰면
  //    5.5*TILE_SIZE 가 나온다(짝수 폭의 두 칸 경계가 아니라 한 칸 중앙).
  //  - 렌더 scale → graphic.scale 배선이 끊기면 1 이 나온다.
  it("발자국 네 칸이 통행을 막고 인접 네 방향에서 조사가 걸리고 두 칸 경계에 그려진다", () => {
    const golem = golemEvent({ width: 2, height: 2 }, 2);
    const { project, map } = mapWithEvent(golem);
    const positions = initialRuntimeEventPositions(map.events);

    // 발자국은 (5,6) (6,6) (5,7) (6,7).
    for (const [x, y] of [[5, 6], [6, 6], [5, 7], [6, 7]]) {
      expect(findBlockingRuntimeEventAtInMap(project, map, session(), positions, x, y), `막힘 (${x},${y})`).toBeDefined();
    }

    // 발자국 바로 바깥에서 정면 조사 — 각 방향에서 인접 칸을 조사하면 골렘이 잡힌다.
    // 서는 칸이 비어 있다는 단정을 같이 두는 이유: 발자국이 과도하게 커져도
    // "조사가 걸린다" 쪽만 보면 통과하기 때문이다.
    const probes = [
      [4, 7, 5, 7], // 왼쪽에서 오른쪽 보기 — 앵커 칸이라 1x1 이어도 잡힌다
      [7, 6, 6, 6], // 오른쪽에서 왼쪽 보기 — 앵커 아님. 발자국 없으면 빈 칸이다
      [5, 5, 5, 6], // 위에서 아래 보기 — 앵커 아님
      [6, 8, 6, 7], // 아래에서 위 보기 — 앵커 아님
    ] as const;
    for (const [px, py, tx, ty] of probes) {
      expect(findBlockingRuntimeEventAtInMap(project, map, session(), positions, px, py), `서는 칸 (${px},${py})`).toBeUndefined();
      expect(findRuntimeEventAtInMap(project, map, session(), positions, tx, ty, "action")?.event.id, `조사 (${tx},${ty})`).toBe("ev_golem");
    }

    // 렌더 좌표: 2x2 라 두 칸 경계, 배율 2.
    const view = runtimeEventView(golem, session(), positions);
    expect(footprintSpriteX(view.x, view.footprint)).toBe(6 * TILE_SIZE);
    expect(view.scale).toBe(2);

    // 같은 골렘을 실제 렌더 경로에 태운다. 위 두 줄은 footprintSpriteX 를 직접 부르므로
    // renderEvents 가 그 함수를 **쓴다는 것**은 증명하지 않는다.
    const { created, scene } = renderSceneFor(golem);
    renderTiles(scene);
    expect(created).toHaveLength(1);
    expect(created[0].x, "렌더된 스프라이트 x").toBe(6 * TILE_SIZE);
    expect(created[0].y, "렌더된 스프라이트 y — 발밑 칸 하단").toBe(characterSpriteY(7));
    expect(created[0].scale, "렌더된 스프라이트 배율").toBe(2);
  });
});

describe("사각으로 찾은 이벤트를 앵커 점으로 돌려세우지 않는다", () => {
  // playSceneMovement.directionTowardPlayer 는 정확히 이 합성이다. 히트테스트가
  // 발자국 사각으로 올라갔으므로 그 결과를 쓰는 방향 계산도 사각을 봐야 한다 —
  // 앵커 델타를 쓰면 앵커가 최근접 칸이 아닐 때 엉뚱한 쪽을 본다.
  //
  // 이 테스트가 실패하려면: 델타를 앵커에서 뽑으면(near 대신 anchor) 첫 단정이
  // facingForDelta(1, 1) → |dx| >= |dy| 가로 우선 → "right" 로 뒤집힌다.
  function facingToward(
    anchorX: number,
    anchorY: number,
    footprint: { width: number; height: number },
    px: number,
    py: number
  ): string {
    const near = nearestCellInRect(footprintBounds(anchorX, anchorY, footprint), px, py);
    return facingForDelta(px - near.x, py - near.y, "down");
  }

  const GOLEM = { width: 2, height: 2 }; // 앵커 (15,18) → (15,17)(16,17)(15,18)(16,18)

  it("2x2 의 비앵커 칸 정남향에서는 down 이다", () => {
    // QA 하네스의 down-alt 프로브가 정확히 이 입력이다.
    expect(facingToward(15, 18, GOLEM, 16, 19)).toBe("down");
    expect(facingToward(15, 18, GOLEM, 15, 19), "앵커 칸 정남향").toBe("down");
  });

  it("2x2 의 나머지 세 면도 사람 눈과 일치한다", () => {
    expect(facingToward(15, 18, GOLEM, 15, 16), "위").toBe("up");
    expect(facingToward(15, 18, GOLEM, 16, 16), "위 — 오른쪽 열").toBe("up");
    expect(facingToward(15, 18, GOLEM, 17, 18), "오른쪽").toBe("right");
    expect(facingToward(15, 18, GOLEM, 14, 17), "왼쪽 — 위쪽 행").toBe("left");
  });

  it("1x1 은 기존 동작과 같다", () => {
    expect(facingToward(5, 7, UNIT_FOOTPRINT, 5, 8)).toBe("down");
    expect(facingToward(5, 7, UNIT_FOOTPRINT, 5, 6)).toBe("up");
    expect(facingToward(5, 7, UNIT_FOOTPRINT, 6, 7)).toBe("right");
    expect(facingToward(5, 7, UNIT_FOOTPRINT, 4, 7)).toBe("left");
    // 1x1 대각은 예전처럼 가로 우선이다 — 클램프가 항등이라 아무것도 바뀌지 않는다.
    expect(facingToward(5, 7, UNIT_FOOTPRINT, 6, 8)).toBe("right");
  });
});
