import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateEventDraft } from "@/editor/eventDraftValidator";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { createBlankProject, DEFAULT_ITEM_ID } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, EventPageCondition, GameEvent } from "@/project/types";
import { el } from "@/util/dom";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const EVENT_ID = "ev-condition-integrity";

function seedPage(conditions: readonly EventPageCondition[]): { mapId: string; page: EventPage } {
  const mapId = store.getCurrent().startMapId;
  const page: EventPage = {
    id: "page-condition-integrity",
    name: "조건 무결성",
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
    const map = draft.maps[mapId];
    if (!map) return;
    map.events = [...map.events.filter((entry) => entry.id !== EVENT_ID), structuredClone(event)];
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

describe("페이지 조건 저작 무결성", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it.each([
    {
      name: "스위치",
      condition: () => ({ kind: "switch", switchId: store.getCurrent().switches[0]?.id ?? "sw_1", value: false }) as EventPageCondition,
      pickerTestId: "event-page-switch-condition-input",
      errorTestId: "event-page-switch-condition-error",
      expected: { kind: "switch", switchId: "", value: false },
      issueCode: "reference.switch.missing",
    },
    {
      name: "아이템",
      condition: () => ({ kind: "item", itemId: DEFAULT_ITEM_ID, present: false }) as EventPageCondition,
      pickerTestId: "event-page-item-condition-input",
      errorTestId: "event-page-item-condition-error",
      expected: { kind: "item", itemId: "", present: false },
      issueCode: "reference.item.missing",
    },
  ])("$name 참조를 비워도 조건을 보존하고 인라인 오류와 집계 검증을 표시한다", ({ condition, pickerTestId, errorTestId, expected, issueCode }) => {
    const { mapId, page } = seedPage([condition()]);
    const root = render(mapId, page);
    const picker = findByTestId(root, pickerTestId);
    const error = findByTestId(root, errorTestId);
    if (!picker || !error) throw new Error("reference controls missing");

    picker.value = "";
    picker.dispatchEvent(new Event("change"));

    expect(livePage(mapId).conditions[0]).toEqual(expected);
    expect(error.hidden).toBe(false);
    const validation = validateEventDraft(store.getCurrent(), mapId, EVENT_ID);
    expect(validation.issues.some((issue) => issue.code === issueCode)).toBe(true);
  });

  it("비활성 아이템 행에서 대상을 바꾸면 행을 눈에 보이게 활성화하고 조건을 추가한다", () => {
    const { mapId, page } = seedPage([]);
    const root = render(mapId, page);
    const row = findByTestId(root, "event-condition-row-아이템");
    const picker = findByTestId(root, "event-page-item-condition-input");
    const checkbox = row?.querySelector("input");
    if (!row || !picker || !checkbox) throw new Error("disabled item row missing");

    expect(checkbox.checked).toBe(false);
    expect(row.dataset.conditionActive).toBe("false");
    picker.value = DEFAULT_ITEM_ID;
    picker.dispatchEvent(new Event("change"));

    expect(checkbox.checked).toBe(true);
    expect(row.dataset.conditionActive).toBe("true");
    expect(row.classList.contains("disabled")).toBe(false);
    expect(livePage(mapId).conditions).toEqual([{ kind: "item", itemId: DEFAULT_ITEM_ID, present: true }]);
  });
});
