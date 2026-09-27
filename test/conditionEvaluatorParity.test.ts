import { describe, expect, it } from "vitest";
import { createBattleEventRuntime } from "@/battle/battleEvents";
import { CONDITION_KINDS, type ConditionKind } from "@/project/commandKindRegistry";
import { createBlankProject } from "@/project/defaults";
import { resolveEventPage } from "@/project/io/pageResolution";
import { evalCondition, startSession, type PlaySession } from "@/project/session";
import type { Condition, GameEvent, Project } from "@/project/types";
import type { BattleEventPageRecord, TroopRecord } from "@/project/types/database";

const OWNER_EVENT: GameEvent = {
  id: "event_condition_owner",
  characterId: "character_condition_owner",
  x: 0,
  y: 0,
  trigger: { kind: "action" },
  commands: [],
};

const BATTLE_PAGE_ID = "parity_battle_page";
const PARITY_LOCATION_ID = "loc_parity";

// Empty by design: all three surfaces receive the same full state and host event,
// so there is no input limitation that justifies a condition-kind divergence.
// battleResult 는 여기서 «같은 스냅샷 입력 → 같은 판정» 만 고정한다. 실전 시간 의미는
// 표면마다 다르다(맵 fork = 방금 끝난 전투, 전투 중 fork/페이지 = 전투 개시 시점의 직전
// 전투) — 상태-패리티와 시간-패리티를 혼동하지 말 것. fork 폼 힌트가 시간 의미를 설명한다.
const ALLOWLISTED_DIVERGENCES = {
  // «바라보는 대상에 사용»은 필드 메뉴 전용 입력이다 — 전투 이벤트에는 사용 중인 아이템이라는 입력 자체가 없어
  // 항상 거짓이다(페이지·맵 분기는 session.itemUsedId 로 참이 된다). 상태가 아니라 입력 경로의 차이다.
  itemUsed: "field-menu-only input; battle events have no item-in-use state and evaluate false",
} satisfies Partial<Record<ConditionKind, string>>;

type StateMutation = (state: PlaySession) => void;
type ParityCase = {
  readonly condition: Condition;
  readonly satisfying: StateMutation;
  readonly nonSatisfying: StateMutation;
};

const RUN_ACTIVE = {
  version: 1 as const,
  runId: "parity-run",
  seed: 1,
  floor: 3,
  status: "active" as const,
  flags: {},
  roomResetCounts: {},
  roomEventGenerationKeys: {},
};

const CASES = {
  switch: {
    condition: { kind: "switch", switchId: "switch_gate", value: true },
    satisfying: (state) => { state.switches.switch_gate = true; },
    nonSatisfying: (state) => { state.switches.switch_gate = false; },
  },
  variable: {
    condition: { kind: "variable", variableId: "variable_gate", op: ">=", value: 5 },
    satisfying: (state) => { state.variables.variable_gate = 5; },
    nonSatisfying: (state) => { state.variables.variable_gate = 4; },
  },
  selfSwitch: {
    condition: { kind: "selfSwitch", key: "A", value: true },
    satisfying: (state) => { state.selfSwitches = { [OWNER_EVENT.id]: { A: true } }; },
    nonSatisfying: (state) => { state.selfSwitches = { [OWNER_EVENT.id]: { A: false } }; },
  },
  actor: {
    condition: { kind: "actor", actorId: "actor_condition", present: true },
    satisfying: (state) => { state.partyActorIds = ["actor_condition"]; },
    nonSatisfying: (state) => { state.partyActorIds = []; },
  },
  item: {
    condition: { kind: "item", itemId: "item_condition", present: true },
    satisfying: (state) => { state.inventory.item_condition = 1; },
    nonSatisfying: (state) => { state.inventory.item_condition = 0; },
  },
  gold: {
    condition: { kind: "gold", op: ">=", amount: 10 },
    satisfying: (state) => { state.gold = 10; },
    nonSatisfying: (state) => { state.gold = 9; },
  },
  timer: {
    condition: { kind: "timer", timerId: "timer1", seconds: 10 },
    satisfying: (state) => { state.timers.timer1 = 10; },
    nonSatisfying: (state) => { state.timers.timer1 = 11; },
  },
  timePhase: {
    condition: { kind: "timePhase", phase: "day" },
    satisfying: (state) => { state.gameTime = gameTime(12, "spring"); },
    nonSatisfying: (state) => { state.gameTime = gameTime(23, "spring"); },
  },
  season: {
    condition: { kind: "season", season: "summer" },
    satisfying: (state) => { state.gameTime = gameTime(12, "summer"); },
    nonSatisfying: (state) => { state.gameTime = gameTime(12, "winter"); },
  },
  npcActivity: {
    condition: { kind: "npcActivity", activity: "work" },
    satisfying: (state) => { state.npcActivities = { [OWNER_EVENT.id]: "work" }; },
    nonSatisfying: (state) => { state.npcActivities = { [OWNER_EVENT.id]: "sleep" }; },
  },
  insideLocation: {
    condition: { kind: "insideLocation", locationId: PARITY_LOCATION_ID, inside: true },
    // 주인공 좌표만 움직인다 — 세 표면 모두 같은 로케이션 기하로 같은 판정을 내야 한다.
    satisfying: (state) => { state.x = 1; state.y = 1; },
    nonSatisfying: (state) => { state.x = 9; state.y = 9; },
  },
  friendshipAtLeast: {
    condition: { kind: "friendshipAtLeast", value: 20 },
    satisfying: (state) => { state.friendship = { [OWNER_EVENT.characterId as string]: 20 }; },
    nonSatisfying: (state) => { state.friendship = { [OWNER_EVENT.characterId as string]: 19 }; },
  },
  relationshipAtLeast: {
    condition: { kind: "relationshipAtLeast", state: "dating" },
    satisfying: (state) => { state.relationships = { [OWNER_EVENT.characterId as string]: "engaged" }; },
    nonSatisfying: (state) => { state.relationships = { [OWNER_EVENT.characterId as string]: "single" }; },
  },
  battleResult: {
    condition: { kind: "battleResult", result: "victory" },
    satisfying: (state) => { state.battleResult = "victory"; },
    nonSatisfying: (state) => { state.battleResult = "defeat"; },
  },
  run: {
    condition: { kind: "run", query: "active", value: true },
    satisfying: (state) => { state.roguelikeRun = structuredClone(RUN_ACTIVE); },
    nonSatisfying: (state) => { state.roguelikeRun = { ...structuredClone(RUN_ACTIVE), status: "completed" }; },
  },
  difficulty: {
    condition: { kind: "difficulty", difficultyId: "hard" },
    satisfying: (state) => { state.difficultyId = "hard"; },
    nonSatisfying: (state) => { state.difficultyId = "easy"; },
  },
  itemUsed: {
    condition: { kind: "itemUsed", itemId: "item_potion" },
    satisfying: (state) => { state.itemUsedId = "item_potion"; },
    nonSatisfying: (state) => { state.itemUsedId = "item_ether"; },
  },
  all: {
    condition: {
      kind: "all",
      conditions: [
        { kind: "switch", switchId: "all_switch", value: true },
        { kind: "gold", op: ">=", amount: 10 },
      ],
    },
    satisfying: (state) => { state.switches.all_switch = true; state.gold = 10; },
    nonSatisfying: (state) => { state.switches.all_switch = true; state.gold = 9; },
  },
  any: {
    condition: {
      kind: "any",
      conditions: [
        { kind: "switch", switchId: "any_switch", value: true },
        { kind: "gold", op: ">=", amount: 10 },
      ],
    },
    satisfying: (state) => { state.switches.any_switch = true; state.gold = 0; },
    nonSatisfying: (state) => { state.switches.any_switch = false; state.gold = 0; },
  },
  not: {
    condition: { kind: "not", condition: { kind: "switch", switchId: "not_switch", value: true } },
    satisfying: (state) => { state.switches.not_switch = false; },
    nonSatisfying: (state) => { state.switches.not_switch = true; },
  },
} satisfies Record<ConditionKind, ParityCase>;

describe("condition evaluator parity", () => {
  it("covers every canonical condition kind", () => {
    expect(Object.keys(CASES)).toEqual([...CONDITION_KINDS]);
  });

  for (const kind of CONDITION_KINDS) {
    const reason = ALLOWLISTED_DIVERGENCES[kind];
    if (reason) continue;
    const parityCase = CASES[kind];

    it.each([
      ["satisfying", parityCase.satisfying, true],
      ["non-satisfying", parityCase.nonSatisfying, false],
    ] as const)(`${kind}: %s state has the same verdict on page, map fork, and battle`, (_label, mutate, expected) => {
      const project = parityProject();
      const state = startSession(project);
      mutate(state);

      const verdicts = {
        page: pageVerdict(parityCase.condition, state, project),
        mapFork: evalCondition(state, parityCase.condition, OWNER_EVENT, { map: project.maps[state.currentMapId] }),
        battle: battleVerdict(project, parityCase.condition, state),
      };

      expect(verdicts).toEqual({ page: expected, mapFork: expected, battle: expected });
    });
  }

  // 소유 이벤트가 없는 전투(랜덤 인카운터/필드 스폰)에서만 토토로지상 불가피한 간결이 남는다:
  // 평가할 호스트 이벤트 자슴이 없으므로 false + 추적 로그(selfSwitch 와 동일 관례)로 도달한다.
  it("npcActivity without an owner event stays false and logs one unsupported entry", () => {
    const project = parityProject();
    const state = startSession(project);
    state.npcActivities = { [OWNER_EVENT.id]: "work" };
    const runtime = ownerlessRuntime(project, { kind: "npcActivity", activity: "work" }, state);

    runtime.applyTroopEvents({ turn: 1 });
    runtime.applyTroopEvents({ turn: 2 });

    expect(runtime.logs().filter((log) => log.kind === "fired")).toEqual([]);
    expect(
      runtime.logs().filter(
        (log) => log.kind === "unsupported" && log.detail === "npcActivity condition without owner event (treated as false)"
      )
    ).toHaveLength(1);
  });
});

function parityProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.events.push(OWNER_EVENT);
  // insideLocation 패리티용 구역. 세 표면 모두 같은 맵의 같은 로케이션을 본다.
  map.locations = [{ id: PARITY_LOCATION_ID, name: "패리티 구역", x: 0, y: 0, w: 2, h: 2 }];
  return project;
}

function pageVerdict(condition: Condition, state: PlaySession, project?: Project): boolean {
  const event: GameEvent = {
    ...OWNER_EVENT,
    pages: [{
      id: "parity_page",
      name: "parity",
      conditions: [condition],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    }],
  };
  const locations = project?.maps[state.currentMapId]?.locations;
  return resolveEventPage(event, state, { locations })?.id === "parity_page";
}

function battleVerdict(project: Project, condition: Condition, state: PlaySession): boolean {
  const runtime = createBattleEventRuntime({
    ...battleRuntimeOptions(project, condition, state),
    ownerEventId: OWNER_EVENT.id,
  });

  runtime.applyTroopEvents({ turn: 1 });
  return runtime.logs().some((log) => log.kind === "fired" && log.pageId === BATTLE_PAGE_ID);
}

function ownerlessRuntime(project: Project, condition: Condition, state: PlaySession) {
  return createBattleEventRuntime(battleRuntimeOptions(project, condition, state));
}

function battleRuntimeOptions(project: Project, condition: Condition, state: PlaySession) {
  const page: BattleEventPageRecord = {
    id: BATTLE_PAGE_ID,
    name: "parity",
    conditions: [condition],
    span: "moment",
    commands: [{ kind: "text", body: "parity" }],
  };
  const troopRecord: TroopRecord = {
    id: "troop_condition_parity",
    name: "parity",
    enemyIds: [],
    autoAlign: true,
    battleEventPages: [page],
  };
  return {
    project,
    troopRecord,
    actors: [],
    enemies: [],
    stateIds: [],
    state,
  };
}

function gameTime(hour: number, season: "spring" | "summer" | "fall" | "winter") {
  return { minute: 0, hour, day: 1, season, year: 1 };
}
