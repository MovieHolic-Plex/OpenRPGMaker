// 페이지 조건의 "꺼짐/없음" 방향 저작 보증.
// 런타임은 switch value:false / item present:false / actor present:false 를 정상 평가하는데
// (src/project/io/pageResolution.ts:33-46) 좌측 "언제 보이나요" 패널은 항상 true 로만 써서
// (a) 데이터에 있는 false 를 화면에서 볼 수 없고 (b) id 를 한 번 바꾸면 조용히 true 로 뒤집혔다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { createBlankProject, DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, EventPageCondition, GameEvent } from "@/project/types";
import { el } from "@/util/dom";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const EVENT_ID = "ev-cond-off";

function seedPage(conditions: readonly EventPageCondition[]): { mapId: string; page: EventPage } {
  const mapId = store.getCurrent().startMapId;
  const page: EventPage = {
    id: "page-off",
    name: "꺼짐 조건",
    conditions: [...conditions],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
  const event: GameEvent = {
    id: EVENT_ID,
    x: 2,
    y: 2,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
  };
  store.update((draft) => {
    const target = draft.maps[mapId];
    if (!target) return;
    target.events = [...target.events.filter((entry) => entry.id !== EVENT_ID), structuredClone(event)];
  });
  return { mapId, page: livePage(mapId) };
}

function livePage(mapId: string): EventPage {
  const page = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === EVENT_ID)?.pages?.[0];
  if (!page) throw new Error("live page missing");
  return page;
}

function render(mapId: string, page: EventPage) {
  return renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, EVENT_ID, page) }));
}

describe("페이지 조건: 꺼짐/없음 방향 저작", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("스위치 조건의 켜짐/꺼짐 셀렉트가 저장된 value 를 보여준다", () => {
    const switchId = store.getCurrent().switches[0]?.id ?? "sw_a";
    const { mapId, page } = seedPage([{ kind: "switch", switchId, value: false }]);
    const root = render(mapId, page);
    const value = findByTestId(root, "event-page-switch-condition-value");
    expect(value).toBeDefined();
    expect(value?.value).toBe("off");
  });

  it("스위치 조건의 셀렉트를 꺼짐으로 바꾸면 store 에 value:false 로 저장된다", () => {
    const switchId = store.getCurrent().switches[0]?.id ?? "sw_a";
    const { mapId, page } = seedPage([{ kind: "switch", switchId, value: true }]);
    const root = render(mapId, page);
    const value = findByTestId(root, "event-page-switch-condition-value");
    if (!value) throw new Error("switch value select missing");
    value.value = "off";
    value.dispatchEvent(new Event("change"));
    const stored = livePage(mapId).conditions.find((entry) => entry.kind === "switch");
    expect(stored).toEqual({ kind: "switch", switchId, value: false });
  });

  it("아이템 조건은 보유/미보유를 저작하고 유지한다", () => {
    const { mapId, page } = seedPage([{ kind: "item", itemId: DEFAULT_ITEM_ID, present: false }]);
    const root = render(mapId, page);
    const value = findByTestId(root, "event-page-item-condition-present");
    expect(value?.value).toBe("absent");
  });

  it("주인공 조건은 파티 있음/없음을 저작하고 유지한다", () => {
    const { mapId, page } = seedPage([{ kind: "actor", actorId: DEFAULT_ACTOR_ID, present: false }]);
    const root = render(mapId, page);
    const value = findByTestId(root, "event-page-actor-condition-present");
    expect(value?.value).toBe("absent");
  });
});
