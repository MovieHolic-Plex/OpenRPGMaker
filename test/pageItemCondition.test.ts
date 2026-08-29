import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { databaseRecordSelect } from "@/editor/panels/eventEditor/pageConditionControls";
import {
  appendCondition,
  pageConditionEntries,
  removeConditionAt,
} from "@/editor/panels/eventEditor/pageConditionModel";
import { defaultPageCondition } from "@/editor/panels/eventEditor/pageConditionCatalog";
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

  it("아이템 칩만 눌러도 기본 보유 조건을 심는다", () => {
    const { mapId, eventId, page } = ensureEventWithPage();
    const firstItemId = store.getCurrent().database.items[0]?.id;
    expect(firstItemId).toBeTruthy();

    appendCondition({ mapId, eventId, page }, defaultPageCondition("item"));

    const nextPage = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId)?.pages?.[0];
    expect(nextPage?.conditions).toEqual([{ kind: "item", itemId: firstItemId, present: true }]);
  });

  it("아이템 행의 ✕ 는 그 조건을 제거한다", () => {
    const firstItemId = store.getCurrent().database.items[0]?.id ?? "item_potion";
    const { mapId, eventId, page } = ensureEventWithPage([
      { kind: "item", itemId: firstItemId, present: true },
    ]);

    removeConditionAt({ mapId, eventId, page }, 0);

    const nextPage = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId)?.pages?.[0];
    expect(nextPage?.conditions ?? []).toEqual([]);
  });

  it("defaultPageCondition(item)은 첫 아이템 + present:true 이다", () => {
    const seeded = defaultPageCondition("item");
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

  it("셀프 스위치·소지금·중복 아이템이 전부 같은 목록에 한 행씩 온다", () => {
    const page: EventPage = {
      id: "page-1",
      name: "EV",
      conditions: [
        { kind: "selfSwitch", key: "A", value: true },
        { kind: "selfSwitch", key: "B", value: false },
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

    // 예전에는 소지금이 「고급 조건」 에만 있어서 12행 쪽에서는 편집할 방법이 없었다.
    const entries = pageConditionEntries(page);
    expect(entries.map((entry) => entry.condition.kind)).toEqual([
      "selfSwitch",
      "selfSwitch",
      "gold",
      "item",
      "item",
    ]);

    const root = renderWithFakeDom(() =>
      el("div", { children: renderPageConditions("map-start", "event-1", page) })
    );
    expect(root.querySelectorAll(".event-condition-row").length).toBe(5);
    // 같은 종류가 둘이면 두 번째 행에 `-2` 가 붙어 testid 가 겹치지 않는다.
    for (const key of ["이 이벤트 기억", "이 이벤트 기억-2", "소지금", "아이템", "아이템-2"]) {
      expect(findByTestId(root, `event-condition-row-${key}`), key).not.toBeNull();
    }
  });
});
