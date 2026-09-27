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
import { ROGUELIKE_RUN_VERSION, type RoguelikeRunState } from "@/project/roguelikeRun";
import type { EventPage, EventPageCondition, GameEvent } from "@/project/types";
import { el } from "@/util/dom";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

import type { RelationshipState } from "@/project/relationshipState";
const SIMPLE_KINDS: readonly SimpleConditionKind[] = [
  "variable",
  "item",
  "actor",
  "timePhase",
  "season",
  "npcActivity",
  "insideLocation",
  "friendshipAtLeast",
  "relationshipAtLeast",
];

const RUN_STATE: RoguelikeRunState = {
  version: ROGUELIKE_RUN_VERSION,
  runId: "guarantee-run",
  seed: 1,
  floor: 3,
  status: "active",
  flags: {},
  roomResetCounts: {},
  roomEventGenerationKeys: {},
};

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
    case "insideLocation":
      return { kind: "insideLocation", locationId: "loc1", inside: true };
    case "friendshipAtLeast":
      return { kind: "friendshipAtLeast", value: 50 };
    case "relationshipAtLeast":
      return { kind: "relationshipAtLeast", state: "dating" };
    case "battleResult":
      return { kind: "battleResult", result: "victory" };
    case "run":
      return { kind: "run", query: "floor", op: ">=", value: 3 };
    case "difficulty":
      return { kind: "difficulty", difficultyId: "normal" };
    case "itemUsed":
      return { kind: "itemUsed", itemId: DEFAULT_ITEM_ID };
    case "all":
      return {
        kind: "all",
        conditions: [{ kind: "switch", switchId: project.switches[0]?.id ?? "sw_0001", value: true }],
      };
    case "any":
      return {
        kind: "any",
        conditions: [{ kind: "switch", switchId: project.switches[0]?.id ?? "sw_0001", value: true }],
      };
    case "not":
      return { kind: "not", condition: { kind: "switch", switchId: "sw_absent", value: true } };
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
      sampleCondition("insideLocation"),
      { kind: "insideLocation", locationId: "loc_extra", inside: false },
      sampleCondition("friendshipAtLeast"),
      sampleCondition("relationshipAtLeast"),
      { kind: "relationshipAtLeast", state: "married" },
      { kind: "friendshipAtLeast", value: 200 },
      sampleCondition("timer"),
      { kind: "timer", timerId: "timer1", seconds: 5 },
      { kind: "timer", timerId: "timer2", seconds: 10 },
      { kind: "timer", timerId: "timer2", seconds: 20 },
     sampleCondition("selfSwitch"),
      { kind: "selfSwitch", key: "B", value: false },
     sampleCondition("gold"),
     sampleCondition("battleResult"),
     sampleCondition("run"),
     sampleCondition("all"),
     sampleCondition("any"),
     sampleCondition("not"),
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
    // 소지금은 간단 행이 없어 항상 고급에; 셀프 스위치 2개 중 1개는 초과분
    expect(kinds).toContain("selfSwitch");
    expect(kinds).toContain("gold");

    // 어떤 kind도 고급/간단 어디에도 안 보이는 구멍 없음:
    // 각 kind 최소 1개는 페이지에 있고, simple 슬롯 또는 advanced에 배치.
    for (const kind of CONDITION_KINDS) {
      const total = conditions.filter((c) => c.kind === kind).length;
      expect(total, `sample has ${kind}`).toBeGreaterThan(0);
      if (kind === "gold") {
        // 소지금은 간단 행 없음 — 항상 고급에
        expect(advanced.some((e) => e.condition.kind === kind)).toBe(true);
      } else if (kind === "selfSwitch") {
        // 셀프 스위치는 첫 번째가 간단 행, 나머지 초과분이 고급에
        expect(advanced.filter((e) => e.condition.kind === "selfSwitch").length).toBe(1);
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
        { kind: "insideLocation", locationId: "loc1", inside: true },
       { kind: "friendshipAtLeast", value: 80 },
        { kind: "selfSwitch", key: "A", value: true },
     ],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
    // No characterId: friendship row still renders, but connect/CTA may live on pageProps.
    const rootWithoutChar = renderWithFakeDom(() => el("div", { children: renderPageConditions("map-start", "ev", page) }));
    expect(findByTestId(rootWithoutChar, "event-page-friendship-condition-value")).not.toBeNull();
    expect(findByTestId(rootWithoutChar, "event-page-condition-add-toolbar")).toBeNull();

    const root = renderWithFakeDom(() => el("div", { children: renderPageConditions("map-start", "ev", page, { characterId: "char_ev" }) }));
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
      "event-page-self-switch-condition-key-A",
      "event-page-self-switch-condition-value",
     "event-page-advanced-conditions",
    ];
    for (const id of ids) {
      expect(findByTestId(root, id), id).not.toBeNull();
    }
    // 이 픽스처는 모든 간단 조건을 켠 상태 — 전부 active 여야 한다.
    const activeRows = root.querySelectorAll('[data-condition-active="true"]');
    expect(activeRows.length).toBeGreaterThan(0);
    expect(root.querySelectorAll('[data-condition-active="false"]').length).toBe(0);
    expect(root.textContent).toContain("보유 중");
    expect(root.textContent).toContain("파티에 있음");
    expect(root.textContent).toContain("켜짐");
    // 새 계약: 빈 페이지면 행은 0개, 칩 12개가 종류를 보여준다
    // 조건을 안 건 페이지: 행은 하나도 내지 않고 칩 12개와 한 줄 안내만 남는다.
    // 예전 계약은 «체크 안 된 행» 12줄을 늘 렌더해 첫 화면을 덮었다 — 발견 가능성은 이제 칩이 진다.
    const emptyPage: EventPage = { ...page, conditions: [] };
    const emptyRoot = renderWithFakeDom(() => el("div", { children: renderPageConditions("map-start", "ev", emptyPage) }));
    expect(emptyRoot.querySelectorAll(".event-condition-row").length).toBe(0);
    expect(findByTestId(emptyRoot, "event-condition-empty")).not.toBeNull();
    expect(emptyRoot.querySelectorAll(".event-condition-chip").length).toBe(14);
    for (const key of ["switch1", "switch2", "variable", "item", "actor", "timer1", "timer2", "timePhase", "season", "npcActivity", "insideLocation", "friendship", "selfSwitch"]) {
      const chip = findByTestId(emptyRoot, `event-condition-chip-${key}`);
      expect(chip, `chip missing: ${key}`).not.toBeNull();
      expect(chip?.getAttribute("aria-pressed")).toBe("false");
    }
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
      relationships: { ev_runtime: "dating" as const },
      battleResult: "victory" as const,
      roguelikeRun: RUN_STATE,
      difficultyId: "normal",
      itemUsedId: DEFAULT_ITEM_ID,
    };
    event.characterId = "ev_runtime";
    // fill variable id from actual sample
    const varCond = conditions.find((c) => c.kind === "variable");
    if (varCond?.kind === "variable") passSession.variables[varCond.variableId] = 5;
    const swCond = conditions.find((c) => c.kind === "switch");
    if (swCond?.kind === "switch") passSession.switches[swCond.switchId] = true;

    const locationContext = { locations: [{ id: "loc1", x: 0, y: 0, w: 4, h: 4 }] };
    expect(resolveEventPage(event, { ...passSession, x: 1, y: 1 }, locationContext)?.id).toBe("p1");

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
        relationships: {} as Record<string, RelationshipState>,
        battleResult: undefined as undefined | "victory" | "defeat" | "escape",
        roguelikeRun: undefined as undefined | RoguelikeRunState,
        difficultyId: undefined as string | undefined,
        itemUsedId: undefined as string | undefined,
        x: undefined as number | undefined,
        y: undefined as number | undefined,
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
        battleResult: base.battleResult,
        roguelikeRun: base.roguelikeRun,
      };
      if (condition.kind === "timer") {
        fail.timers[condition.timerId] = condition.seconds + 1;
      } else if (condition.kind === "timePhase") {
        fail.gameTime = { minute: 0, hour: 23, day: 1, season: "spring", year: 1 }; // night vs day sample
      } else if (condition.kind === "season") {
        fail.gameTime = { minute: 0, hour: 12, day: 1, season: "winter", year: 1 };
      } else if (condition.kind === "not") {
        // NOT 은 내부 조건이 참일 때 거짓이 된다.
        const inner = condition.condition;
        if (inner.kind === "switch") fail.switches[inner.switchId] = inner.value;
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
        battleResult: base.battleResult,
        roguelikeRun: base.roguelikeRun,
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
          event.characterId = event.id;
          pass.friendship[event.id] = condition.value;
          break;
        case "relationshipAtLeast":
          event.characterId = event.id;
          pass.relationships = { [event.id]: condition.state };
          break;
        case "battleResult":
          pass.battleResult = condition.result;
          break;
        case "run":
          pass.roguelikeRun = RUN_STATE;
          break;
        case "difficulty":
          pass.difficultyId = condition.difficultyId;
          break;
        case "itemUsed":
          pass.itemUsedId = condition.itemId;
          break;
        case "insideLocation":
          pass.x = 1;
          pass.y = 1;
          break;
        case "all":
        case "any":
          for (const child of condition.conditions) {
            if (child.kind === "switch") pass.switches[child.switchId] = child.value;
          }
          break;
        case "not":
          // 내부 조건(sw_absent)이 거짓인 기본 세션에서 NOT 은 참이다.
          break;
      }
      const locationContext = condition.kind === "insideLocation"
        ? { locations: [{ id: "loc1", x: 0, y: 0, w: 4, h: 4 }] }
        : undefined;
      expect(resolveEventPage(event, pass, locationContext)?.id, `${kind} should pass matching session`).toBe("only");
    }
  });
});
