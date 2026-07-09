import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { databaseRecordSelect } from "@/editor/panels/eventEditor/pageConditionControls";
import {
  advancedConditionEntries,
  defaultSimpleCondition,
  toggleSimpleCondition,
} from "@/editor/panels/eventEditor/pageConditionModel";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";
import { el } from "@/util/dom";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function ensureEventWithPage(conditions: EventPage["conditions"] = []): {
  mapId: string;
  eventId: string;
  page: EventPage;
} {
  const project = store.getCurrent();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  if (!map) throw new Error("missing start map");
  const page: EventPage = {
    id: "page-item-1",
    name: "아이템 페이지",
    conditions: [...conditions],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
  const event: GameEvent = {
    id: "ev-item-cond",
    name: "아이템 조건 이벤트",
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
  };
  store.update((draft) => {
    const target = draft.maps[mapId];
    if (!target) return;
    target.events = [...target.events.filter((entry) => entry.id !== event.id), event];
  });
  const livePage = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === event.id)?.pages?.[0];
  if (!livePage) throw new Error("page not created");
  return { mapId, eventId: event.id, page: livePage };
}

describe("page item possession condition", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("체크만 켜도 기본 아이템 보유 조건을 심는다", () => {
    const { mapId, eventId, page } = ensureEventWithPage();
    const firstItemId = store.getCurrent().database.items[0]?.id;
    expect(firstItemId).toBeTruthy();

    toggleSimpleCondition({ mapId, eventId, page }, "item", true);

    const nextPage = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId)?.pages?.[0];
    expect(nextPage?.conditions).toEqual([{ kind: "item", itemId: firstItemId, present: true }]);
  });

  it("아이템 보유 체크를 끄면 조건을 제거한다", () => {
    const firstItemId = store.getCurrent().database.items[0]?.id ?? "item_potion";
    const { mapId, eventId, page } = ensureEventWithPage([
      { kind: "item", itemId: firstItemId, present: true },
    ]);

    toggleSimpleCondition({ mapId, eventId, page }, "item", false);

    const nextPage = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId)?.pages?.[0];
    expect(nextPage?.conditions ?? []).toEqual([]);
  });

  it("defaultSimpleCondition(item)은 첫 아이템 + present:true 이다", () => {
    const seeded = defaultSimpleCondition("item");
    const firstItemId = store.getCurrent().database.items[0]?.id;
    expect(seeded).toEqual({ kind: "item", itemId: firstItemId, present: true });
  });

  it("존재하지 않는 itemId도 셀렉트에 표시된다", () => {
    const select = renderWithFakeDom(() =>
      databaseRecordSelect({
        kind: "item",
        currentId: "missing-item",
        testId: "event-page-item-condition-input",
        onChange: () => {},
      })
    ) as FakeElement & { value: string };

    expect(select.value).toBe("missing-item");
    expect(select.textContent).toContain("missing-item");
    expect(select.textContent).toContain("(없음)");
  });

  it("페이지 조건 행에서 아이템 셀렉트가 현재 값을 유지한다", () => {
    const firstItemId = store.getCurrent().database.items[0]?.id ?? "item_potion";
    const page: EventPage = {
      id: "page-1",
      name: "EV",
      conditions: [{ kind: "item", itemId: firstItemId, present: true }],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };

    const root = renderWithFakeDom(() =>
      el("div", { children: renderPageConditions("map-start", "event-1", page) })
    );
    const select = findByTestId(root, "event-page-item-condition-input") as FakeElement & { value: string };
    expect(select?.tagName).toBe("SELECT");
    expect(select?.value).toBe(firstItemId);
    expect(root.textContent).toContain("보유 중");
  });

  it("고급 목록에 셀프 스위치/소지금 조건이 누락되지 않는다", () => {
    const page: EventPage = {
      id: "page-1",
      name: "EV",
      conditions: [
        { kind: "selfSwitch", key: "A", value: true },
        { kind: "gold", op: ">=", amount: 100 },
        { kind: "item", itemId: "item_potion", present: true },
        { kind: "item", itemId: "item_key", present: true },
      ],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };

    const advanced = advancedConditionEntries(page);
    expect(advanced.map((entry) => entry.condition.kind)).toEqual(["selfSwitch", "gold", "item"]);
    expect(advanced[2]?.condition).toEqual({ kind: "item", itemId: "item_key", present: true });
  });
});
