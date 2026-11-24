import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { createBlankProject, DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, EventPageCondition, GameEvent, NpcScheduleEntry, Project } from "@/project/types";
import { el } from "@/util/dom";
import { findByTestId, installFakeDom, renderWithFakeDom, FakeElement } from "./fakeDom";
import { validateEventDraftBody, validateEventDraft } from "@/editor/eventDraftValidator";
import { renderNpcActivityCondition } from "@/editor/panels/eventEditor/conditionForm";
import { collectNpcActivitySuggestions } from "@/editor/panels/eventEditor/options";
import { isolateTimers } from "./mergedTeardown";

// 페이지 조건의 "꺼짐/없음" 방향 저작 보증.
// 런타임은 switch value:false / item present:false / actor present:false 를 정상 평가하는데
// (src/project/io/pageResolution.ts:33-46) 좌측 "언제 보이나요" 패널은 항상 true 로만 써서
// (a) 데이터에 있는 false 를 화면에서 볼 수 없고 (b) id 를 한 번 바꾸면 조용히 true 로 뒤집혔다.
describe("eventPageConditionOffValue", () => {
  isolateTimers();
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

    it("고급 스위치에서 꺼짐을 저작한 뒤 대상을 바꿔도 value:false를 유지한다", () => {
      const switches = store.getCurrent().switches;
      const { mapId, page } = seedPage([
        { kind: "switch", switchId: switches[0]?.id ?? "sw_1", value: true },
        { kind: "switch", switchId: switches[1]?.id ?? "sw_2", value: true },
        { kind: "switch", switchId: switches[2]?.id ?? "sw_3", value: true },
      ]);
      const root = render(mapId, page);
      const polarity = findByTestId(root, "event-page-advanced-condition-switch-value-0");
      const picker = findByTestId(root, "event-page-advanced-condition-switch-0");
      if (!polarity || !picker) throw new Error("advanced switch controls missing");

      polarity.value = "false";
      polarity.dispatchEvent(new Event("change"));
      picker.value = switches[0]?.id ?? "sw_changed";
      picker.dispatchEvent(new Event("change"));

      expect(polarity.textContent).toContain("꺼짐");
      expect(livePage(mapId).conditions[2]).toEqual({
        kind: "switch",
        switchId: switches[0]?.id ?? "sw_changed",
        value: false,
      });
    });

    it("고급 아이템에서 보유 안 함을 저작한 뒤 대상을 바꿔도 present:false를 유지한다", () => {
      const items = store.getCurrent().database.items;
      const { mapId, page } = seedPage([
        { kind: "item", itemId: DEFAULT_ITEM_ID, present: true },
        { kind: "item", itemId: items[1]?.id ?? "item_extra", present: true },
      ]);
      const root = render(mapId, page);
      const polarity = findByTestId(root, "event-page-advanced-condition-item-present-0");
      const picker = findByTestId(root, "event-page-advanced-condition-item-0");
      if (!polarity || !picker) throw new Error("advanced item controls missing");

      polarity.value = "false";
      polarity.dispatchEvent(new Event("change"));
      picker.value = DEFAULT_ITEM_ID;
      picker.dispatchEvent(new Event("change"));

      expect(polarity.textContent).toContain("보유 안 함");
      expect(livePage(mapId).conditions[1]).toEqual({ kind: "item", itemId: DEFAULT_ITEM_ID, present: false });
    });

    it("고급 주인공에서 파티에 없음을 저작한 뒤 대상을 바꿔도 present:false를 유지한다", () => {
      const actors = store.getCurrent().database.actors;
      const { mapId, page } = seedPage([
        { kind: "actor", actorId: DEFAULT_ACTOR_ID, present: true },
        { kind: "actor", actorId: actors[1]?.id ?? "actor_extra", present: true },
      ]);
      const root = render(mapId, page);
      const polarity = findByTestId(root, "event-page-advanced-condition-actor-present-0");
      const picker = findByTestId(root, "event-page-advanced-condition-actor-0");
      if (!polarity || !picker) throw new Error("advanced actor controls missing");

      polarity.value = "false";
      polarity.dispatchEvent(new Event("change"));
      picker.value = DEFAULT_ACTOR_ID;
      picker.dispatchEvent(new Event("change"));

      expect(polarity.textContent).toContain("파티에 없음");
      expect(livePage(mapId).conditions[1]).toEqual({ kind: "actor", actorId: DEFAULT_ACTOR_ID, present: false });
    });
  });
});

describe("npcActivitySuggestions", () => {
  isolateTimers();
  const EVENT_ID = "ev-activity-condition";
  const NPC_ID = "ev-scheduled-npc";
  function scheduleEntry(mapId: string, activity: string | undefined): NpcScheduleEntry {
    return { when: { timePhase: "day" }, at: { mapId, x: 3, y: 3 }, activity, facing: "down" };
  }
  function seedScheduledNpc(project: Project, activities: readonly (string | undefined)[]): void {
    const mapId = project.startMapId;
    const npc: GameEvent = {
      id: NPC_ID,
      x: 3,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      schedule: activities.map((activity) => scheduleEntry(mapId, activity)),
    };
    const map = project.maps[mapId];
    if (!map) throw new Error("start map missing");
    map.events = [...map.events.filter((entry) => entry.id !== NPC_ID), npc];
  }
  function activityPage(activity: string): EventPage {
    return {
      id: "page-activity",
      name: "활동 조건",
      conditions: [{ kind: "npcActivity", activity }],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "안녕" }],
    };
  }
  function hostEvent(page: EventPage): GameEvent {
    return { id: EVENT_ID, x: 2, y: 2, trigger: page.trigger, commands: [], pages: [page] };
  }
  function optionValues(root: FakeElement, testId: string): string[] {
    const list = findByTestId(root, testId);
    if (!list) throw new Error(`datalist ${testId} 없음`);
    return list.children.filter((child) => child.tagName === "OPTION").map((option) => option.value);
  }
  describe("활동 조건 저작 도움", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
    });

    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });

    it("프로젝트 일정에 적힌 활동을 중복 없이 정렬해 모은다", () => {
      const project = createBlankProject();
      seedScheduledNpc(project, ["저녁 장터", "귀가", "저녁 장터", "  ", undefined]);

      expect(collectNpcActivitySuggestions(project)).toEqual(["귀가", "저녁 장터"]);
    });

    it("일정이 없으면 빈 목록을 준다", () => {
      expect(collectNpcActivitySuggestions(createBlankProject())).toEqual([]);
    });

    it("페이지 활동 조건 입력이 프로젝트 활동을 후보로 건다", () => {
      const project = createBlankProject();
      seedScheduledNpc(project, ["귀가", "저녁 장터"]);
      const page = activityPage("저녁 장터");
      const mapId = project.startMapId;
      project.maps[mapId]!.events = [...project.maps[mapId]!.events, hostEvent(page)];
      store.replace(project);

      const root = renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, EVENT_ID, page) }));

      expect(optionValues(root, "event-page-npc-activity-condition-options")).toEqual(["귀가", "저녁 장터"]);
      const input = findByTestId(root, "event-page-npc-activity-condition-input");
      expect(input?.getAttribute("list")).toBe("event-page-npc-activity-condition-options");
    });

    it("분기 폼 활동 입력도 같은 후보를 건다", () => {
      const project = createBlankProject();
      seedScheduledNpc(project, ["귀가"]);
      store.replace(project);

      const root = renderWithFakeDom(() =>
        el("div", { children: [renderNpcActivityCondition({ kind: "npcActivity", activity: "귀가" }, () => undefined)] })
      );

      expect(optionValues(root, "event-condition-npc-activity-options")).toEqual(["귀가"]);
      const input = findByTestId(root, "event-condition-npc-activity");
      expect(input?.getAttribute("list")).toBe("event-condition-npc-activity-options");
    });

    it("어떤 일정에도 없는 활동은 저작 시점에 알려준다", () => {
      const project = createBlankProject();
      seedScheduledNpc(project, ["귀가"]);
      const event = hostEvent(activityPage("관광"));
      project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

      const result = validateEventDraftBody(project, project.startMapId, event);
      const issue = result.issues.find((entry) => entry.code === "condition.npcActivity.unknown");

      expect(issue?.severity).toBe("warning");
      expect(issue?.message).toContain("NPC 일정");
    });

    it("일정에 있는 활동은 알리지 않는다", () => {
      const project = createBlankProject();
      seedScheduledNpc(project, ["귀가", "저녁 장터"]);
      const event = hostEvent(activityPage("저녁 장터"));
      project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

      const result = validateEventDraftBody(project, project.startMapId, event);

      expect(result.issues.filter((entry) => entry.code === "condition.npcActivity.unknown")).toEqual([]);
    });

    it("빈 활동은 기존 경고만 내고 미확인 경고를 겹치지 않는다", () => {
      const project = createBlankProject();
      seedScheduledNpc(project, ["귀가"]);
      const event = hostEvent(activityPage("   "));
      project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

      const codes = validateEventDraftBody(project, project.startMapId, event).issues.map((entry) => entry.code);

      expect(codes).toContain("condition.npcActivity.empty");
      expect(codes).not.toContain("condition.npcActivity.unknown");
    });
  });
});

describe("pageConditionAuthoringIntegrity", () => {
  isolateTimers();
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

      // 첫 아이템에 조용히 묶지 않는다 — 빈 참조로 세우고 행의 「아이템을 선택하세요」가 고르게 한다(2026-09-18).
      expect(livePage(mapId).conditions).toEqual([{ kind: "item", itemId: "", present: true }]);
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
});
