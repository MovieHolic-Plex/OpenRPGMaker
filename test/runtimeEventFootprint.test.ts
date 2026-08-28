// test/runtimeEventFootprint.test.ts
// 이벤트 발자국의 런타임 해석 — 페이지에서 읽어 RuntimeEventView 로 노출한다.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §2.

import { describe, expect, it } from "vitest";
import { UNIT_FOOTPRINT } from "@/project/footprint";
import { initialRuntimeEventPositions, runtimeEventView } from "@/project/runtimeEventState";
import type { EventPage, GameEvent } from "@/project/types";
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
