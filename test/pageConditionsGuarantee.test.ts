// 페이지 조건 전 kind 작동 보증 — 체크 토글 시드/해제, 고급 목록 가시성, 런타임 평가, UI 컨트롤.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  advancedConditionEntries,
  defaultSimpleCondition,
  type SimpleConditionKind,
  toggleSimpleCondition,
  toggleSwitchCondition,
  toggleTimerCondition,
} from "@/editor/panels/eventEditor/pageConditionModel";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { CONDITION_KINDS } from "@/project/commandKindRegistry";
import { createBlankProject, DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID } from "@/project/defaults";
import { resolveEventPage } from "@/project/io/pageResolution";
import { store } from "@/project/store";
import type { EventPage, EventPageCondition, GameEvent } from "@/project/types";
import { el } from "@/util/dom";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const SIMPLE_KINDS: readonly SimpleConditionKind[] = [
  "variable",
  "item",
  "actor",
  "timePhase",
  "season",
  "npcActivity",
  "friendshipAtLeast",
];

function ensureEventWithPage(conditions: EventPage["conditions"] = []): {
  mapId: string;
  eventId: string;
  page: EventPage;
} {
  const project = store.getCurrent();
  const mapId = project.startMapId;
  const page: EventPage = {
    id: "page-guarantee",
    name: "보증 페이지",
    conditions: [...conditions],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
  const event: GameEvent = {
    id: "ev-cond-guarantee",
    x: 2,
    y: 2,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
  };
  store.update((draft) => {
    const target = draft.maps[mapId];
    if (!target) return;
    target.events = [...target.events.filter((entry) => entry.id !== event.id), structuredClone(event)];
  });
  const live = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === event.id)?.pages?.[0];
  if (!live) throw new Error("page missing");
  return { mapId, eventId: event.id, page: live };
}

function livePage(mapId: string, eventId: string): EventPage {
  const page = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId)?.pages?.[0];
  if (!page) throw new Error("live page missing");
  return page;
}

function sampleCondition(kind: (typeof CONDITION_KINDS)[number]): EventPageCondition {
  const project = store.getCurrent();
  switch (kind) {
    case "switch":
      return { kind: "switch", switchId: project.switches[0]?.id ?? "sw_0001", value: true };
    case "variable":
      return { kind: "variable", variableId: project.variables[0]?.id ?? "var_0001", op: ">=", value: 1 };
    case "selfSwitch":
      return { kind: "selfSwitch", key: "A", value: true };
    case "actor":
      return { kind: "actor", actorId: DEFAULT_ACTOR_ID, present: true };
    case "item":
      return { kind: "item", itemId: DEFAULT_ITEM_ID, present: true };
    case "gold":
      return { kind: "gold", op: ">=", amount: 10 };
    case "timer":
      return { kind: "timer", timerId: "timer1", seconds: 30 };
    case "timePhase":
      return { kind: "timePhase", phase: "day" };
    case "season":
      return { kind: "season", season: "spring" };
    case "npcActivity":
      return { kind: "npcActivity", activity: "work" };
    case "friendshipAtLeast":
      return { kind: "friendshipAtLeast", value: 50 };
  }
}

describe("page conditions working guarantee (all kinds)", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("CONDITION_KINDS 전원이 default 시드 또는 토글 경로를 가진다", () => {
    for (const kind of SIMPLE_KINDS) {
      const seeded = defaultSimpleCondition(kind);
      expect(seeded, `defaultSimpleCondition(${kind})`).not.toBeNull();
      expect(seeded?.kind).toBe(kind);
    }
  });

  it.each(SIMPLE_KINDS)("simple 조건 %s: 체크 ON 시드 → OFF 제거", (kind) => {
    const { mapId, eventId, page } = ensureEventWithPage();
    toggleSimpleCondition({ mapId, eventId, page }, kind, true);
    const afterOn = livePage(mapId, eventId);
    expect(afterOn.conditions.some((c) => c.kind === kind)).toBe(true);

    toggleSimpleCondition({ mapId, eventId, page: afterOn }, kind, false);
    const afterOff = livePage(mapId, eventId);
    expect(afterOff.conditions.some((c) => c.kind === kind)).toBe(false);
  });

  it("스위치 slot0/slot1: 체크 ON 시드 → OFF 제거 (서로 독립)", () => {
    const { mapId, eventId, page } = ensureEventWithPage();
    const sw0 = store.getCurrent().switches[0]?.id;
    const sw1 = store.getCurrent().switches[1]?.id ?? sw0;
    expect(sw0).toBeTruthy();

    toggleSwitchCondition({ mapId, eventId, page, slot: 0 }, true);
    let live = livePage(mapId, eventId);
    expect(live.conditions.filter((c) => c.kind === "switch")).toHaveLength(1);

    toggleSwitchCondition({ mapId, eventId, page: live, slot: 1 }, true);
    live = livePage(mapId, eventId);
    expect(live.conditions.filter((c) => c.kind === "switch")).toHaveLength(2);

    toggleSwitchCondition({ mapId, eventId, page: live, slot: 0 }, false);
    live = livePage(mapId, eventId);
    const remaining = live.conditions.filter((c) => c.kind === "switch");
    expect(remaining).toHaveLength(1);
    // slot1 이 남아 있어야 한다
    expect(remaining[0]?.kind).toBe("switch");

    toggleSwitchCondition({ mapId, eventId, page: live, slot: 0 }, false); // already empty slot0
    toggleSwitchCondition({ mapId, eventId, page: livePage(mapId, eventId), slot: 1 }, false);
    expect(livePage(mapId, eventId).conditions.filter((c) => c.kind === "switch")).toHaveLength(0);
    void sw1;
  });

  it("타이머 1/2: 체크 ON 시드 → OFF 제거", () => {
    const { mapId, eventId, page } = ensureEventWithPage();
    toggleTimerCondition({ mapId, eventId, page }, "timer1", true);
    toggleTimerCondition({ mapId, eventId, page: livePage(mapId, eventId) }, "timer2", true);
    let live = livePage(mapId, eventId);
    expect(live.conditions.filter((c) => c.kind === "timer")).toHaveLength(2);

    toggleTimerCondition({ mapId, eventId, page: live }, "timer1", false);
    live = livePage(mapId, eventId);
    expect(live.conditions).toEqual([{ kind: "timer", timerId: "timer2", seconds: 0 }]);

    toggleTimerCondition({ mapId, eventId, page: live }, "timer2", false);
    expect(livePage(mapId, eventId).conditions).toEqual([]);
  });

  it("고급 목록: 간단 행 초과분 + selfSwitch/gold 가 모두 보인다", () => {
    const conditions: EventPageCondition[] = [
      sampleCondition("switch"),
      sampleCondition("switch"),
      { kind: "switch", switchId: "sw_extra", value: true },
      sampleCondition("variable"),
      { kind: "variable", variableId: "var_extra", op: ">=", value: 2 },
      sampleCondition("item"),
      { kind: "item", itemId: "item_extra", present: true },
      sampleCondition("actor"),
      { kind: "actor", actorId: "actor_extra", present: true },
      sampleCondition("timePhase"),
      { kind: "timePhase", phase: "night" },
      sampleCondition("season"),
      { kind: "season", season: "winter" },
      sampleCondition("npcActivity"),
      { kind: "npcActivity", activity: "sleep" },
      sampleCondition("friendshipAtLeast"),
      { kind: "friendshipAtLeast", value: 200 },
      sampleCondition("timer"),
      { kind: "timer", timerId: "timer1", seconds: 5 },
      { kind: "timer", timerId: "timer2", seconds: 10 },
      { kind: "timer", timerId: "timer2", seconds: 20 },
      sampleCondition("selfSwitch"),
      sampleCondition("gold"),
    ];
    const page: EventPage = {
      id: "p",
      name: "p",
      conditions,
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
    const advanced = advancedConditionEntries(page);
    const kinds = advanced.map((e) => e.condition.kind);
    // 초과분
    expect(kinds).toContain("switch");
    expect(kinds).toContain("variable");
    expect(kinds).toContain("item");
    expect(kinds).toContain("actor");
    expect(kinds).toContain("timePhase");
    expect(kinds).toContain("season");
    expect(kinds).toContain("npcActivity");
    expect(kinds).toContain("friendshipAtLeast");
    expect(kinds).toContain("timer");
    // 간단 행 없는 종류 — 반드시 고급에
    expect(kinds).toContain("selfSwitch");
    expect(kinds).toContain("gold");

    // 어떤 kind도 고급/간단 어디에도 안 보이는 구멍 없음:
    // 각 kind 최소 1개는 페이지에 있고, simple 슬롯 또는 advanced에 배치.
    for (const kind of CONDITION_KINDS) {
      const total = conditions.filter((c) => c.kind === kind).length;
      expect(total, `sample has ${kind}`).toBeGreaterThan(0);
      if (kind === "selfSwitch" || kind === "gold") {
        expect(advanced.some((e) => e.condition.kind === kind)).toBe(true);
      } else if (kind === "timer") {
        // timer1 first + timer2 first are simple; extras advanced
        expect(advanced.filter((e) => e.condition.kind === "timer").length).toBeGreaterThanOrEqual(1);
      } else if (kind === "switch") {
        expect(advanced.filter((e) => e.condition.kind === "switch").length).toBe(1); // 3rd
      } else {
        expect(advanced.some((e) => e.condition.kind === kind)).toBe(true); // 2nd+
      }
    }
  });

  it("UI: 모든 간단 조건 행의 컨트롤 testid가 렌더된다", () => {
    const project = store.getCurrent();
    const page: EventPage = {
      id: "p",
      name: "p",
      conditions: [
        { kind: "switch", switchId: project.switches[0]?.id ?? "", value: true },
        { kind: "switch", switchId: project.switches[1]?.id ?? project.switches[0]?.id ?? "", value: true },
        { kind: "variable", variableId: project.variables[0]?.id ?? "", op: ">=", value: 1 },
        { kind: "item", itemId: DEFAULT_ITEM_ID, present: true },
        { kind: "actor", actorId: DEFAULT_ACTOR_ID, present: true },
        { kind: "timer", timerId: "timer1", seconds: 65 },
        { kind: "timer", timerId: "timer2", seconds: 10 },
        { kind: "timePhase", phase: "evening" },
        { kind: "season", season: "fall" },
        { kind: "npcActivity", activity: "patrol" },
        { kind: "friendshipAtLeast", value: 80 },
      ],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
    const root = renderWithFakeDom(() => el("div", { children: renderPageConditions("map-start", "ev", page) }));
    const ids = [
      "event-page-switch-condition-input",
      "event-page-switch2-condition-input",
      "event-page-variable-condition-input",
      "event-page-variable-condition-op",
      "event-page-variable-condition-value",
      "event-page-item-condition-input",
      "event-page-actor-condition-input",
      "event-page-timer1-condition-minutes",
      "event-page-timer1-condition-seconds",
      "event-page-timer2-condition-minutes",
      "event-page-timer2-condition-seconds",
      "event-page-time-phase-condition-input",
      "event-page-season-condition-input",
      "event-page-npc-activity-condition-input",
      "event-page-friendship-condition-value",
      "event-page-advanced-conditions",
    ];
    for (const id of ids) {
      expect(findByTestId(root, id), id).not.toBeNull();
    }
    expect(root.textContent).toContain("보유 중");
    expect(root.textContent).toContain("파티에 있음");
    expect(root.textContent).toContain("켜짐");
  });

  it("런타임: CONDITION_KINDS 전원이 true/false로 평가된다", () => {
    const conditions = CONDITION_KINDS.map((kind) => sampleCondition(kind));
    const event: GameEvent = {
      id: "ev_runtime",
      x: 0,
      y: 0,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "p1",
          name: "p1",
          conditions,
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        },
      ],
    };

    const passSession = {
      switches: { [sampleCondition("switch").kind === "switch" ? (sampleCondition("switch") as { switchId: string }).switchId : ""]: true },
      variables: {} as Record<string, number>,
      selfSwitches: { ev_runtime: { A: true, B: false, C: false, D: false } },
      inventory: { [DEFAULT_ITEM_ID]: 1 },
      partyActorIds: [DEFAULT_ACTOR_ID],
      gold: 10,
      timers: { timer1: 10, timer2: 0 },
      gameTime: { minute: 0, hour: 12, day: 1, season: "spring" as const, year: 1 },
      npcActivities: { ev_runtime: "work" },
      friendship: { ev_runtime: 50 },
    };
    // fill variable id from actual sample
    const varCond = conditions.find((c) => c.kind === "variable");
    if (varCond?.kind === "variable") passSession.variables[varCond.variableId] = 5;
    const swCond = conditions.find((c) => c.kind === "switch");
    if (swCond?.kind === "switch") passSession.switches[swCond.switchId] = true;

    expect(resolveEventPage(event, passSession)?.id).toBe("p1");

    // fail item
    expect(
      resolveEventPage(event, {
        ...passSession,
        inventory: {},
      })?.id
    ).toBeUndefined();
  });

  it("런타임: 각 kind를 단독으로 true/false 토글 가능하다", () => {
    for (const kind of CONDITION_KINDS) {
      const condition = sampleCondition(kind);
      const event: GameEvent = {
        id: `ev_${kind}`,
        x: 0,
        y: 0,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "only",
            name: "only",
            conditions: [condition],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
          },
        ],
      };

      const base = {
        switches: {} as Record<string, boolean>,
        variables: {} as Record<string, number>,
        selfSwitches: {} as Record<string, Partial<Record<"A" | "B" | "C" | "D", boolean>>>,
        inventory: {} as Record<string, number>,
        partyActorIds: [] as string[],
        gold: 0,
        timers: {} as Record<string, number>,
        gameTime: undefined as undefined | { minute: number; hour: number; day: number; season: "spring" | "summer" | "fall" | "winter"; year: number },
        npcActivities: {} as Record<string, string>,
        friendship: {} as Record<string, number>,
      };

      // failing session — timer는 "N초 이하"라 미설정(0)도 참이므로 초과 값으로 실패시킨다.
      const fail = {
        ...base,
        switches: { ...base.switches },
        variables: { ...base.variables },
        selfSwitches: { ...base.selfSwitches },
        inventory: { ...base.inventory },
        partyActorIds: [...base.partyActorIds],
        timers: { ...base.timers },
        npcActivities: { ...base.npcActivities },
        friendship: { ...base.friendship },
        gameTime: base.gameTime,
        gold: base.gold,
      };
      if (condition.kind === "timer") {
        fail.timers[condition.timerId] = condition.seconds + 1;
      } else if (condition.kind === "timePhase") {
        fail.gameTime = { minute: 0, hour: 23, day: 1, season: "spring", year: 1 }; // night vs day sample
      } else if (condition.kind === "season") {
        fail.gameTime = { minute: 0, hour: 12, day: 1, season: "winter", year: 1 };
      }
      expect(resolveEventPage(event, fail), `${kind} should fail mismatched session`).toBeUndefined();

      // passing session
      const pass = {
        ...base,
        switches: { ...base.switches },
        variables: { ...base.variables },
        selfSwitches: { ...base.selfSwitches },
        inventory: { ...base.inventory },
        partyActorIds: [...base.partyActorIds],
        timers: { ...base.timers },
        npcActivities: { ...base.npcActivities },
        friendship: { ...base.friendship },
        gameTime: base.gameTime,
        gold: base.gold,
      };
      switch (condition.kind) {
        case "switch":
          pass.switches[condition.switchId] = condition.value;
          break;
        case "variable":
          pass.variables[condition.variableId] = condition.value;
          break;
        case "selfSwitch":
          pass.selfSwitches[event.id] = { [condition.key]: condition.value };
          break;
        case "actor":
          pass.partyActorIds = condition.present ? [condition.actorId] : [];
          break;
        case "item":
          pass.inventory[condition.itemId] = condition.present ? 1 : 0;
          break;
        case "gold":
          pass.gold = condition.amount;
          break;
        case "timer":
          pass.timers[condition.timerId] = condition.seconds;
          break;
        case "timePhase":
          pass.gameTime = { minute: 0, hour: condition.phase === "night" ? 23 : 12, day: 1, season: "spring", year: 1 };
          break;
        case "season":
          pass.gameTime = { minute: 0, hour: 12, day: 1, season: condition.season, year: 1 };
          break;
        case "npcActivity":
          pass.npcActivities[event.id] = condition.activity;
          break;
        case "friendshipAtLeast":
          pass.friendship[event.id] = condition.value;
          break;
      }
      expect(resolveEventPage(event, pass)?.id, `${kind} should pass matching session`).toBe("only");
    }
  });
});
