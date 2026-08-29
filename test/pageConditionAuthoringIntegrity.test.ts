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

  it("칩으로 아이템 조건을 담으면 행이 생기고, 다시 빼면 안내 한 줄로 돌아간다", () => {
    const { mapId, page } = seedPage([]);
    const emptyRoot = render(mapId, page);
    expect(findByTestId(emptyRoot, "event-condition-empty")).not.toBeNull();
    expect(findByTestId(emptyRoot, "event-condition-row-아이템")).toBeNull();
    const chip = findByTestId(emptyRoot, "event-condition-chip-item");
    if (!chip) throw new Error("item chip missing");
    expect(chip.getAttribute("aria-pressed")).toBe("false");

    chip.click();

    expect(livePage(mapId).conditions).toEqual([{ kind: "item", itemId: DEFAULT_ITEM_ID, present: true }]);
    const openRoot = render(mapId, livePage(mapId));
    const row = findByTestId(openRoot, "event-condition-row-아이템");
    if (!row) throw new Error("enabled item row missing after chip toggle");
    expect(row.dataset.conditionActive).toBe("true");
    expect(row.classList.contains("disabled")).toBe(false);
    expect(findByTestId(openRoot, "event-condition-chip-item")?.getAttribute("aria-pressed")).toBe("true");
    expect(findByTestId(openRoot, "event-page-item-condition-input")).not.toBeNull();

    findByTestId(openRoot, "event-condition-chip-item")?.click();

    expect(livePage(mapId).conditions).toEqual([]);
    expect(findByTestId(render(mapId, livePage(mapId)), "event-condition-empty")).not.toBeNull();
  });
});
