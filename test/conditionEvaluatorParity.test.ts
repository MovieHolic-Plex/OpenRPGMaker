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
const ALLOWLISTED_DIVERGENCES = {} satisfies Partial<Record<ConditionKind, string>>;

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
  monsterSpecies: {
    // 기존 누락(2026-09-27 발견): CONDITION_KINDS 에는 있는데 케이스가 없어 스위트 전체가 수집 단계에서 죽었다.
    condition: { kind: "monsterSpecies", speciesId: "species_parity", present: true },
    satisfying: (state) => {
      state.monsterInstances = { mon_1: { speciesId: "species_parity" } as PlaySession["monsterInstances"][string] };
      state.monsterParty = ["mon_1"];
    },
    nonSatisfying: (state) => { state.monsterInstances = {}; state.monsterParty = []; },
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
  // 명작 공백 G1 — 파티 수치·상태·선두·인원.
  actorStat: {
    condition: { kind: "actorStat", actorId: "leader", stat: "level", op: ">=", value: 5 },
    satisfying: (state) => { state.partyActorIds = ["actor_parity"]; state.actorLevels.actor_parity = 5; },
    nonSatisfying: (state) => { state.partyActorIds = ["actor_parity"]; state.actorLevels.actor_parity = 4; },
  },
  actorState: {
    condition: { kind: "actorState", actorId: "anyone", stateId: "state_poison", present: true },
    satisfying: (state) => { state.partyActorIds = ["actor_parity"]; state.actorStateIds = { actor_parity: ["state_poison"] }; },
    nonSatisfying: (state) => { state.partyActorIds = ["actor_parity"]; state.actorStateIds = { actor_parity: [] }; },
  },
  partyLeader: {
    condition: { kind: "partyLeader", actorId: "actor_parity" },
    satisfying: (state) => { state.partyActorIds = ["actor_parity", "actor_other"]; },
    nonSatisfying: (state) => { state.partyActorIds = ["actor_other", "actor_parity"]; },
  },
  partySize: {
    condition: { kind: "partySize", op: ">=", value: 2 },
    satisfying: (state) => { state.partyActorIds = ["a", "b"]; },
    nonSatisfying: (state) => { state.partyActorIds = ["a"]; },
  },
  facing: {
    condition: { kind: "facing", subject: "player", dir: "up" },
    satisfying: (state) => { state.playerFacing = "up"; },
    nonSatisfying: (state) => { state.playerFacing = "left"; },
  },
  relativeFacing: {
    // 이벤트(3,3)가 아래를 보고, 주인공이 그 위쪽(등 뒤)에 있다.
    condition: { kind: "relativeFacing", relation: "playerBehindEvent" },
    satisfying: (state) => { state.x = 3; state.y = 1; state.eventLocations[OWNER_EVENT.id] = { mapId: state.currentMapId, x: 3, y: 3, direction: "down" }; },
    nonSatisfying: (state) => { state.x = 3; state.y = 6; state.eventLocations[OWNER_EVENT.id] = { mapId: state.currentMapId, x: 3, y: 3, direction: "down" }; },
  },
  hiding: {
    condition: { kind: "hiding", value: true },
    satisfying: (state) => { state.horror = { pursuits: {}, hiding: { mapId: state.currentMapId, eventId: "closet", witnessedBy: [] } }; },
    nonSatisfying: (state) => { state.horror = { pursuits: {} }; },
  },
  pursuitActive: {
    condition: { kind: "pursuitActive", value: true },
    satisfying: (state) => { state.horror = { pursuits: { oni: { home: { mapId: "m", x: 0, y: 0 }, active: true, searchMs: 0, doors: [] } } }; },
    nonSatisfying: (state) => { state.horror = { pursuits: { oni: { home: { mapId: "m", x: 0, y: 0 }, active: false, searchMs: 0, doors: [] } } }; },
  },
  clearCount: {
    condition: { kind: "clearCount", op: ">=", value: 2 },
    satisfying: (state) => { state.clearHistory = { count: 2, endingIds: ["end_a"] }; },
    nonSatisfying: (state) => { state.clearHistory = { count: 1, endingIds: ["end_a"] }; },
  },
  endingSeen: {
    condition: { kind: "endingSeen", endingId: "end_true", value: true },
    satisfying: (state) => { state.clearHistory = { count: 1, endingIds: ["end_true"] }; },
    nonSatisfying: (state) => { state.clearHistory = { count: 1, endingIds: ["end_bad"] }; },
  },
  newGamePlus: {
    condition: { kind: "newGamePlus", value: true },
    satisfying: (state) => { state.flags.ngplus = true; },
    nonSatisfying: (state) => { state.flags.ngplus = false; },
  },
  weekday: {
    // 1년 봄 1일 = 월(1). 봄 6일 = 토(6).
    condition: { kind: "weekday", weekdays: [6] },
    satisfying: (state) => { state.gameTime = { minute: 0, hour: 12, day: 6, season: "spring", year: 1 }; },
    nonSatisfying: (state) => { state.gameTime = { minute: 0, hour: 12, day: 1, season: "spring", year: 1 }; },
  },
  stringVariable: {
    condition: { kind: "stringVariable", stringVariableId: "prayer", op: "==", value: "빛이여" },
    satisfying: (state) => { state.stringVariables = { prayer: "빛이여" }; },
    nonSatisfying: (state) => { state.stringVariables = { prayer: "어둠아" }; },
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
