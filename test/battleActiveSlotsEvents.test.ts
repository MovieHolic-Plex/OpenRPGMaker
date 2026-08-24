import { describe, expect, it } from "vitest";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { createBattleRuntime } from "@/battle/runtime";
import { simulateBattle } from "@/battle/simulate";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { normalizeClassRecord, normalizeEquipmentRecord, normalizeItemRecord } from "@/project/databaseRecordModel";
import { deserialize } from "@/project/io";
import { startSession } from "@/project/session";
import type { ActorParameterKey, Command, Project } from "@/project/types";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";
import bossFixture from "./fixtures/projects/battle-active-slots-boss-v3.json";
import battleFixture from "./fixtures/projects/battle-v3.json";

const PARTY4 = ["actor_warrior", "actor_mage", "actor_rogue", "actor_priest"] as const;

function strictProject(): Project {
  return deserialize(JSON.stringify(strictFixture));
}

function bossProject(): Project {
  return deserialize(JSON.stringify(bossFixture));
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fourActorProject(): Project {
  const project = strictProject();
  addActorClone(project, "actor_warrior", "class_warrior", "actor_rogue", "class_rogue", "도적");
  addActorClone(project, "actor_mage", "class_mage", "actor_priest", "class_priest", "사제");
  project.system.startActorIds = [...PARTY4];
  project.session.partyActorIds = [...PARTY4];
  const troop = project.database.troops.find((record) => record.id === "troop_strict_training");
  if (!troop) throw new Error("missing troop_strict_training");
  troop.activeSlots = 2;
  return project;
}

function addActorClone(
  project: Project,
  sourceActorId: string,
  sourceClassId: string,
  actorId: string,
  classId: string,
  name: string
): void {
  const sourceActor = project.database.actors.find((record) => record.id === sourceActorId);
  const sourceClass = project.database.classes.find((record) => record.id === sourceClassId);
  if (!sourceActor || !sourceClass) throw new Error(`missing source actor/class: ${sourceActorId}/${sourceClassId}`);
  project.database.classes.push({ ...cloneRecord(sourceClass), id: classId, name });
  project.database.actors.push({ ...cloneRecord(sourceActor), id: actorId, name, classId });
}

function setActorParam(project: Project, actorId: string, key: ActorParameterKey, value: number): void {
  const actor = project.database.actors.find((record) => record.id === actorId);
  if (!actor) throw new Error(`missing actor: ${actorId}`);
  actor.parameterCurves[key] = Array.from({ length: 99 }, () => value);
}

function setEnemyStats(project: Project, stats: { readonly maxHp?: number; readonly attack?: number; readonly defense?: number; readonly agility?: number }): void {
  const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime");
  if (!enemy) throw new Error("missing enemy_training_slime");
  enemy.stats = {
    ...enemy.stats,
    maxHp: stats.maxHp ?? enemy.stats.maxHp,
    attack: stats.attack ?? enemy.stats.attack,
    defense: stats.defense ?? enemy.stats.defense,
    agility: stats.agility ?? enemy.stats.agility,
  };
}

function partyProgress(partyActorIds: readonly string[], vitals: Record<string, { hp: number; mp: number }> = {}) {
  return {
    levels: Object.fromEntries(partyActorIds.map((actorId) => [actorId, 1])),
    experience: {},
    partyActorIds: [...partyActorIds],
    vitals,
  };
}

describe("battle active slots, switching, and battle events", () => {
  it("keeps only the front activeSlots actors on the battlefield and tracks participants", () => {
    const project = fourActorProject();
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      party: partyProgress(PARTY4),
    });

    const snapshot = runtime.snapshot();
    expect(snapshot.activeSlots).toBe(2);
    expect(snapshot.actors.map((actor) => actor.recordId)).toEqual(["actor_warrior", "actor_mage"]);
    expect(snapshot.reserveActors.map((actor) => actor.recordId)).toEqual(["actor_rogue", "actor_priest"]);
    expect(snapshot.switchCandidateActorIds).toEqual(["actor_rogue", "actor_priest"]);
    expect(snapshot.participatingActorIds).toEqual(["actor_warrior", "actor_mage"]);
  });

  it("resolves strict switch commands before faster enemies and records switched-in participants", () => {
    const project = fourActorProject();
    setActorParam(project, "actor_warrior", "agility", 1);
    setActorParam(project, "actor_mage", "agility", 2);
    setEnemyStats(project, { maxHp: 999, attack: 40, agility: 80 });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      activeSlots: 1,
      party: partyProgress(PARTY4),
      rng: () => 0.99,
    });

    const incomingHpBefore = runtime.snapshot().reserveActors.find((actor) => actor.recordId === "actor_rogue")?.hp;

    runtime.performActorCommand({ kind: "switch", targetActorId: "actor_rogue" });

    const snapshot = runtime.snapshot();
    const firstRound = snapshot.roundLogs[0];
    expect(firstRound?.actions[0]).toMatchObject({ userRecordId: "actor_warrior", commandKind: "switch" });
    expect(firstRound?.actions.map((action) => action.userRecordId)).toEqual(["actor_warrior", "enemy_training_slime"]);
    expect(firstRound?.participatingActorIds).toEqual(["actor_warrior", "actor_rogue"]);
    expect(snapshot.actors.map((actor) => actor.recordId)).toEqual(["actor_rogue"]);
    expect(snapshot.reserveActors.map((actor) => actor.recordId)).toEqual(["actor_warrior", "actor_mage", "actor_priest"]);
    expect(snapshot.actors.find((actor) => actor.recordId === "actor_rogue")?.hp).toBeLessThan(incomingHpBefore ?? 0);
  });

  it("requires forced switch for defeated active actors and excludes defeated reserves", () => {
    const project = fourActorProject();
    const partyActorIds = ["actor_warrior", "actor_mage", "actor_rogue"];
    setActorParam(project, "actor_warrior", "agility", 1);
    setEnemyStats(project, { maxHp: 999, attack: 999, agility: 99 });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      activeSlots: 1,
      party: partyProgress(partyActorIds, { actor_rogue: { hp: 0, mp: 0 } }),
      rng: () => 0.99,
    });

    runtime.performActorCommand({ kind: "defend" });
    expect(runtime.snapshot().forcedSwitchActorId).toBe("actor_warrior");
    expect(runtime.snapshot().switchCandidateActorIds).toEqual(["actor_mage"]);

    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().forcedSwitchActorId).toBe("actor_warrior");

    runtime.performActorCommand({ kind: "switch", targetActorId: "actor_rogue" });
    expect(runtime.snapshot().forcedSwitchActorId).toBe("actor_warrior");

    runtime.performActorCommand({ kind: "switch", targetActorId: "actor_mage" });
    const snapshot = runtime.snapshot();
    expect(snapshot.forcedSwitchActorId).toBeUndefined();
    expect(snapshot.activeActorId).toBe("actor_mage");
    expect(snapshot.actors.map((actor) => actor.recordId)).toEqual(["actor_mage"]);
    expect(snapshot.reserveActors.find((actor) => actor.recordId === "actor_rogue")?.defeated).toBe(true);
  });

  it("handles gauge-mode switch immediately and resets active gauges", () => {
    const project = fourActorProject();
    const partyActorIds = ["actor_warrior", "actor_mage"];
    setActorParam(project, "actor_warrior", "agility", 999);
    setEnemyStats(project, { maxHp: 999, attack: 1, agility: 1 });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "gauge",
      activeSlots: 1,
      party: partyProgress(partyActorIds),
      rng: () => 0.99,
    });

    runtime.tick(1_000);
    expect(runtime.snapshot().phase).toBe("actorCommand");
    runtime.performActorCommand({ kind: "switch", targetActorId: "actor_mage" });

    const snapshot = runtime.snapshot();
    expect(snapshot.phase).toBe("charging");
    expect(snapshot.activeActorId).toBeUndefined();
    expect(snapshot.actors.map((actor) => [actor.recordId, actor.gauge])).toEqual([["actor_mage", 0]]);
    expect(snapshot.reserveActors.map((actor) => [actor.recordId, actor.gauge])).toEqual([["actor_warrior", 0]]);
  });

  it("fires onRound/everyRound/enemyHpBelow/switch pages, runOnce pages, and battle event UI commands", () => {
    const project = strictProject();
    project.switches.push(
      { id: "sw_gate", name: "게이트" },
      { id: "sw_round", name: "라운드" },
      { id: "sw_seen", name: "스위치 확인" },
      { id: "sw_choice", name: "선택지" },
      { id: "sw_common", name: "커먼" }
    );
    project.variables.push({ id: "var_every", name: "매 라운드" });
    project.session.switches = { sw_gate: true };
    project.commonEvents.push({
      id: "ce_battle_common",
      name: "전투 커먼",
      trigger: "none",
      commands: [
        { kind: "setSwitch", switchId: "sw_common", value: true },
        { kind: "changeActorMp", actorId: "actor_warrior", op: "-=", amount: 3 },
      ],
    });
    const troop = project.database.troops.find((record) => record.id === "troop_strict_training");
    if (!troop) throw new Error("missing troop_strict_training");
    troop.activeSlots = 1;
    troop.battleEventPages = [
      {
        id: "page_round",
        name: "1라운드",
        conditions: [{ kind: "onRound", round: 1 }],
        span: "moment",
        runOnce: true,
        commands: [
          { kind: "setSwitch", switchId: "sw_round", value: true },
          { kind: "text", speaker: "보스", body: "전투 이벤트 대사" },
          {
            kind: "choices",
            prompt: "응답",
            options: [{ text: "계속", branch: [{ kind: "setSwitch", switchId: "sw_choice", value: true }] }],
          },
          { kind: "callCommonEvent", commonEventId: "ce_battle_common" },
          { kind: "wait", ms: 1 },
        ],
      },
      {
        id: "page_every",
        name: "매 라운드",
        conditions: [{ kind: "everyRound", start: 1, interval: 1 }],
        span: "moment",
        runOnce: false,
        commands: [{ kind: "setVariable", variableId: "var_every", op: "+=", value: 1 }],
      },
      {
        id: "page_switch",
        name: "스위치",
        conditions: [{ kind: "switch", switchId: "sw_gate", value: true }],
        span: "moment",
        runOnce: true,
        commands: [{ kind: "setSwitch", switchId: "sw_seen", value: true }],
      },
      {
        id: "page_half",
        name: "HP 절반",
        conditions: [{ kind: "enemyHpBelow", enemyId: "enemy_training_slime", percent: 50 }],
        span: "moment",
        runOnce: true,
        commands: [{ kind: "text", speaker: "보스", body: "이제 절반이다" }],
      },
    ];
    setActorParam(project, "actor_warrior", "attack", 40);
    setActorParam(project, "actor_warrior", "agility", 99);
    setActorParam(project, "actor_warrior", "maxMp", 10);
    setEnemyStats(project, { maxHp: 100, attack: 1, defense: 0, agility: 1 });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      activeSlots: 1,
      party: partyProgress(["actor_warrior"]),
      rng: () => 0.99,
    });

    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    runtime.performActorCommand({ kind: "defend" });

    const snapshot = runtime.snapshot();
    expect(snapshot.eventState.switches).toMatchObject({
      sw_round: true,
      sw_seen: true,
      sw_choice: true,
      sw_common: true,
    });
    expect(snapshot.eventState.variables.var_every).toBe(2);
    expect(snapshot.actors[0]?.mp).toBe(7);
    expect(snapshot.eventLogs.filter((log) => log.pageId === "page_switch" && log.kind === "fired")).toHaveLength(1);
    expect(snapshot.eventLogs.filter((log) => log.pageId === "page_half" && log.kind === "message")).toHaveLength(1);
    expect(snapshot.eventLogs.filter((log) => log.pageId === "page_every" && log.kind === "fired").map((log) => log.round)).toEqual([1, 2]);
    expect(snapshot.eventLogs.some((log) => log.kind === "choices" && log.detail?.includes("응답"))).toBe(true);
    expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "wait 1ms")).toBe(true);
  });

  it("simulateBattle strict script logs active-slot boss switch participation and HP50 event", () => {
    const result = simulateBattle({
      project: bossProject(),
      troopId: "troop_active_slot_boss",
      heroLevel: 1,
      battleFlow: "strict",
      activeSlots: 2,
      partyActorIds: ["actor_a", "actor_b", "actor_c", "actor_d"],
      seed: 17,
      n: 1,
      maxSteps: 4,
      strictScript: [
        [
          { actorId: "actor_a", command: "attack", target: "enemy-1" },
          { actorId: "actor_b", command: "attack", target: "enemy-1" },
        ],
        [
          { actorId: "actor_a", command: "switch", switchActorId: "actor_c" },
          { actorId: "actor_b", command: "attack", target: "enemy-1" },
        ],
      ],
    });

    expect(result.roundLogs).toHaveLength(2);
    expect(result.roundLogs[1]?.actions[0]).toMatchObject({ userRecordId: "actor_a", commandKind: "switch" });
    expect(result.participatingActorIds).toEqual(["actor_a", "actor_b", "actor_c"]);
    expect(result.eventLogs).toContainEqual(expect.objectContaining({
      pageId: "page_boss_half",
      round: 2,
      kind: "message",
      detail: "보스: 아직 끝나지 않았다",
    }));
  });
});

// Step 3(2026-08-20) Tier-1 배틀 이벤트 커맨드 회귀 스펙.
// 하네스는 battleEventsSelfSwitch.test.ts 관례(battle-v3 + troop_slime + defend 1액션)와 동일.
describe("battle event Tier-1 commands (Step 3)", () => {
  const PAGE_ID = "page_tier1";

  function tier1Project(): Project {
    return deserialize(JSON.stringify(battleFixture));
  }

  function runPage(project: Project, commands: readonly Command[]) {
    const troop = project.database.troops.find((record) => record.id === "troop_slime");
    if (!troop) throw new Error("missing troop_slime");
    troop.battleEventPages = [{
      id: PAGE_ID,
      name: "Tier-1",
      conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
      span: "battle",
      commands: [...commands],
    }];
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "defend" });
    return runtime;
  }

  it("gotoLabel 은 라벨까지의 명령을 건너뛰고 라벨 이후를 실행한다", () => {
    const project = tier1Project();
    const runtime = runPage(project, [
      { kind: "setSwitch", switchId: "sw_a", value: true },
      { kind: "gotoLabel", name: "skip" },
      { kind: "setSwitch", switchId: "sw_b", value: true },
      { kind: "label", name: "skip" },
      { kind: "setSwitch", switchId: "sw_c", value: true },
    ]);
    const switches = runtime.snapshot().eventState.switches;
    expect(switches.sw_a).toBe(true);
    expect(switches.sw_b).toBeUndefined();
    expect(switches.sw_c).toBe(true);
  });

  it("fork 분기 안에서 페이지 최상위 라벨로 점프한다(맵 gotoLabel 과 동형의 스택 탐색)", () => {
    const project = tier1Project();
    const runtime = runPage(project, [
      {
        kind: "fork",
        // 미설정 스위치는 false → value:false 조건은 참(분기 진입).
        condition: { kind: "switch", switchId: "sw_unset", value: false },
        then: [
          { kind: "gotoLabel", name: "out" },
          { kind: "setSwitch", switchId: "sw_skipped_inside", value: true },
        ],
      },
      { kind: "setSwitch", switchId: "sw_skipped_mid", value: true },
      { kind: "label", name: "out" },
      { kind: "setSwitch", switchId: "sw_end", value: true },
    ]);
    const switches = runtime.snapshot().eventState.switches;
    expect(switches.sw_end).toBe(true);
    expect(switches.sw_skipped_inside).toBeUndefined();
    expect(switches.sw_skipped_mid).toBeUndefined();
  });

  it("미진입 fork 분기 안의 라벨은 찾지 못하고 unsupported 로그 후 계속 진행한다(보수적 스코프)", () => {
    const project = tier1Project();
    const runtime = runPage(project, [
      {
        kind: "fork",
        condition: { kind: "switch", switchId: "sw_unset", value: true },
        then: [{ kind: "label", name: "inner" }],
      },
      { kind: "gotoLabel", name: "inner" },
      { kind: "setSwitch", switchId: "sw_after", value: true },
    ]);
    const snapshot = runtime.snapshot();
    expect(snapshot.eventState.switches.sw_after).toBe(true);
    expect(snapshot.eventLogs.some((log) => log.kind === "unsupported" && log.detail === "missing label: inner")).toBe(true);
  });

  it("loop 는 breakLoop 로 탈출하고 루프 다음 명령을 이어 실행한다", () => {
    const project = tier1Project();
    project.variables.push({ id: "var_count", name: "카운트" });
    const runtime = runPage(project, [
      {
        kind: "loop",
        body: [
          { kind: "setVariable", variableId: "var_count", op: "+=", value: 1 },
          {
            kind: "fork",
            condition: { kind: "variable", variableId: "var_count", op: ">=", value: 3 },
            then: [{ kind: "breakLoop" }],
          },
        ],
      },
      { kind: "setSwitch", switchId: "sw_after_loop", value: true },
    ]);
    const snapshot = runtime.snapshot();
    expect(snapshot.eventState.variables.var_count).toBe(3);
    expect(snapshot.eventState.switches.sw_after_loop).toBe(true);
  });

  it("탈출 없는 loop 는 반복 상한 가드로 종료하고 unsupported 로그를 남긴다", () => {
    const project = tier1Project();
    project.variables.push({ id: "var_guard", name: "가드" });
    const runtime = runPage(project, [
      { kind: "loop", body: [{ kind: "setVariable", variableId: "var_guard", op: "+=", value: 1 }] },
      { kind: "setSwitch", switchId: "sw_after_guard", value: true },
    ]);
    const snapshot = runtime.snapshot();
    expect(snapshot.eventState.variables.var_guard).toBe(10_000);
    expect(snapshot.eventState.switches.sw_after_guard).toBe(true);
    expect(snapshot.eventLogs.some((log) => log.kind === "unsupported" && log.detail === "loop iteration limit reached")).toBe(true);
  });

  it("setFlag/timer 는 배틀 이벤트 state 에 기록되고 전투 종료 시 세션으로 write-back 된다", () => {
    const project = tier1Project();
    const runtime = runPage(project, [
      { kind: "setFlag", flag: "flag_boss_seen", value: true },
      { kind: "timer", action: "set", seconds: 90, timerId: "timer1" },
      { kind: "timer", action: "start", seconds: 45, timerId: "timer2" },
      { kind: "timer", action: "stop", timerId: "timer2" },
    ]);
    const snapshot = runtime.snapshot();
    expect(snapshot.eventState.flags?.flag_boss_seen).toBe(true);
    expect(snapshot.eventState.timers?.timer1).toBe(90);
    // stop 은 남은 초를 유지한다(진행/정지는 맵 씬 소관).
    expect(snapshot.eventState.timers?.timer2).toBe(45);

    const session = startSession(project);
    applyBattleRewardsToSession(
      session,
      { result: "victory", rewards: snapshot.rewards, actors: snapshot.actors, eventState: snapshot.eventState },
      project
    );
    expect(session.flags.flag_boss_seen).toBe(true);
    expect(session.timers.timer1).toBe(90);
    expect(session.timers.timer2).toBe(45);
  });

  it("showAnimation 은 showBattleAnimation 콜백으로 라우팅되어 lastAnimation 을 세팅한다", () => {
    const project = tier1Project();
    const runtime = runPage(project, [
      { kind: "showAnimation", target: "player", animationId: "anim_hit" },
    ]);
    const snapshot = runtime.snapshot();
    expect(snapshot.lastAnimation?.animationId).toBe("anim_hit");
    // "player" 타깃은 행동 중 액터(방어한 영웅)의 배틀러 id 로 해석된다.
    expect(snapshot.lastAnimation?.targetId).toBe(snapshot.actors[0]?.id);
    expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "showAnimation anim_hit")).toBe(true);
  });

  it("gameOver 는 defeat 결과로 매핑되어 전투를 즉시 종결한다(후처리는 canLose 의미론)", () => {
    const project = tier1Project();
    const runtime = runPage(project, [{ kind: "gameOver" }]);
    const snapshot = runtime.snapshot();
    expect(snapshot.result).toBe("defeat");
    expect(snapshot.phase).toBe("resolved");
    expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "gameOver→defeat")).toBe(true);
  });

  it("killPlayer 는 액터 HP 를 0 으로 만들고 defeat 로 종결한다", () => {
    const project = tier1Project();
    const runtime = runPage(project, [{ kind: "killPlayer", message: "쓰러졌다" }]);
    const snapshot = runtime.snapshot();
    expect(snapshot.result).toBe("defeat");
    expect(snapshot.actors.every((actor) => actor.hp === 0)).toBe(true);
    expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "killPlayer→defeat 쓰러졌다")).toBe(true);
  });

  it("changeFace/displayTextSettings 는 메시지 스트립 프레젠테이션 로그를 남긴다", () => {
    const project = tier1Project();
    const runtime = runPage(project, [
      { kind: "changeFace", resourceId: "easyrpg-faceset-actor1", faceIndex: 2, position: "left", flipHorizontally: false },
      { kind: "displayTextSettings", format: "normal", position: "bottom", preventObscuringPlayer: false, allowEventMovementDuringWait: false },
    ]);
    const logs = runtime.snapshot().eventLogs;
    expect(logs.some((log) => log.kind === "message" && log.detail === "changeFace easyrpg-faceset-actor1#2")).toBe(true);
    expect(logs.some((log) => log.kind === "message" && log.detail === "displayTextSettings normal/bottom")).toBe(true);
  });
});

// Step 3d(2026-08-20) — RM2K3 배틀 허용 커맨드 changeEquipment/promoteActor 회귀 스펙.
// 스탯 재계산은 battleBattlers 생성 산식과 공유(refreshActorBattlerDerivedStats)되고,
// HP/MP/게이지/상태이상은 보존(새 최대치 클램프만), 전투 종료 시 세션 write-back(canLose 의미론).
describe("battle event equipment/class commands (Step 3d)", () => {
  const EQUIP_ID = "equip_champion_sword";
  const ORB_ID = "item_orb";

  function flatCurve(value: number): number[] {
    return Array.from({ length: 99 }, () => value);
  }

  // strict 흐름 + rng()=0.5(분산 계수 정확히 1.0, 크리티컬 없음) — 데미지가 결정론 정수로 떨어진다.
  function equipProject(): Project {
    const project = strictProject();
    project.database.equipment.push(normalizeEquipmentRecord({
      id: EQUIP_ID,
      name: "챔피언 검",
      slot: "weapon",
      statBonuses: { attack: 24, defense: 0, mind: 0, agility: 0 },
      equippableClassIds: ["class_warrior"],
    }));
    project.session.inventory = { ...project.session.inventory, [EQUIP_ID]: 1 };
    const troop = project.database.troops.find((record) => record.id === "troop_strict_training");
    if (!troop) throw new Error("missing troop_strict_training");
    troop.battleEventPages = [{
      id: "page_equip",
      name: "장비 변경",
      conditions: [{ kind: "actorCommand", actorId: "actor_warrior", commandId: "defend" }],
      span: "battle",
      commands: [{ kind: "changeEquipment", actorId: "actor_warrior", slot: "weapon", equipmentId: EQUIP_ID }],
    }];
    return project;
  }

  function runEquipBattle(project: Project) {
    return createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      activeSlots: 1,
      party: partyProgress(["actor_warrior"]),
      rng: () => 0.5,
    });
  }

  it("changeEquipment 는 배틀러 공격력을 재계산해(HP/MP 보존) 후속 공격 데미지에 반영한다", () => {
    const runtime = runEquipBattle(equipProject());
    const before = runtime.snapshot().actors[0]!;
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    runtime.performActorCommand({ kind: "defend" }); // 페이지 발화 → 장비 변경
    const mid = runtime.snapshot().actors[0]!;
    expect(mid.effectiveStats?.attack).toBe((before.effectiveStats?.attack ?? 0) + 24);
    expect(mid.maxHp).toBe(before.maxHp);
    expect(mid.hp).toBe(before.hp);
    expect(mid.mp).toBe(before.mp);
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();
    const actorDamage = snapshot.timeline
      .filter((entry) => entry.kind === "damage" && entry.side === "actor")
      .map((entry) => entry.amount ?? 0);
    expect(actorDamage).toHaveLength(2);
    // 통상공격 위력은 attackPower + floor(attackPower/2): +24 장비 → 정확히 +36 데미지.
    expect(actorDamage[1]! - actorDamage[0]!).toBe(36);
    expect(snapshot.eventState.actorEquipment?.actor_warrior?.weapon).toBe(EQUIP_ID);
    expect(snapshot.eventState.inventory[EQUIP_ID] ?? 0).toBe(0);
    expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === `changeEquipment actor_warrior weapon=${EQUIP_ID}`)).toBe(true);
  });

  it("changeEquipment 는 승리 시 세션 장비/인벤토리로 write-back 되고 canLose=false 패배 시 미반영", () => {
    const project = equipProject();
    const runtime = runEquipBattle(project);
    runtime.performActorCommand({ kind: "defend" });
    const snapshot = runtime.snapshot();

    const session = startSession(project);
    applyBattleRewardsToSession(
      session,
      { result: "victory", rewards: snapshot.rewards, actors: snapshot.actors, eventState: snapshot.eventState },
      project
    );
    expect(session.actorEquipment?.actor_warrior?.weapon).toBe(EQUIP_ID);
    expect(session.inventory[EQUIP_ID] ?? 0).toBe(0);

    const lost = startSession(project);
    applyBattleRewardsToSession(
      lost,
      { result: "defeat", canLose: false, rewards: snapshot.rewards, actors: snapshot.actors, eventState: snapshot.eventState },
      project
    );
    expect(lost.actorEquipment?.actor_warrior?.weapon).toBeUndefined();
    expect(lost.inventory[EQUIP_ID]).toBe(1);
  });

  // battle-v3(게이지 흐름) + class_champion 전직. 대조군(무전직)과 같은 명령 시퀀스를 돌려
  // "스탯 필드만 갱신"을 증명한다 — HP/MP/게이지/상태이상은 대조군과 완전 일치해야 한다.
  function promoteProject(pageCommands: readonly Command[]): Project {
    const project = deserialize(JSON.stringify(battleFixture));
    project.database.classes.push(normalizeClassRecord({
      id: "class_champion",
      name: "챔피언",
      parameterCurves: {
        maxHp: flatCurve(999),
        maxMp: flatCurve(99),
        attack: flatCurve(80),
        defense: flatCurve(30),
        mind: flatCurve(25),
        agility: flatCurve(70),
      },
      learnedSkills: [{ level: 1, skillId: "skill_claw" }],
      battleCommands: [{ id: "cmd_champion_strike", name: "강타", kind: "attack" }],
    }));
    project.database.items.push(normalizeItemRecord({ id: ORB_ID, name: "전직 보주" }));
    project.session.inventory = { ...project.session.inventory, [ORB_ID]: 1 };
    const troop = project.database.troops.find((record) => record.id === "troop_slime");
    if (!troop) throw new Error("missing troop_slime");
    troop.battleEventPages = [{
      id: "page_promote",
      name: "전직",
      conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
      span: "battle",
      commands: [...pageCommands],
    }];
    return project;
  }

  function setFighterPromotion(project: Project, requires: { itemId?: string; switchId?: string }): void {
    const fighter = project.database.classes.find((record) => record.id === "class_fighter");
    if (!fighter) throw new Error("missing class_fighter");
    fighter.promotions = [{ toClassId: "class_champion", requires }];
  }

  function runGaugeDefend(project: Project) {
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 });
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "defend" });
    return runtime;
  }

  const promoteCommand: Command = {
    kind: "promoteActor",
    actorId: "actor_hero",
    toClassId: "class_champion",
    successBranch: [{ kind: "setSwitch", switchId: "sw_promoted", value: true }],
    failureBranch: [{ kind: "setSwitch", switchId: "sw_promo_failed", value: true }],
  };

  it("promoteActor 는 전투 중 전직을 실행해 클래스/스탯/커맨드/스킬을 재계산하고 HP·MP·게이지를 보존한다", () => {
    const promotedProject = promoteProject([promoteCommand]);
    setFighterPromotion(promotedProject, { itemId: ORB_ID });
    const controlProject = promoteProject([{ kind: "setSwitch", switchId: "sw_control", value: true }]);
    setFighterPromotion(controlProject, { itemId: ORB_ID });

    const promoted = runGaugeDefend(promotedProject);
    const control = runGaugeDefend(controlProject);
    const promotedActor = promoted.snapshot().actors[0]!;
    const controlActor = control.snapshot().actors[0]!;

    expect(promotedActor.classId).toBe("class_champion");
    expect(controlActor.classId).toBe("class_fighter");
    expect(promotedActor.effectiveStats?.attack).toBe(80);
    expect(promotedActor.maxHp).toBe(999);
    // 재생성이 아니라 스탯 필드만 갱신 — 현재 HP/MP/게이지/상태이상은 대조군과 동일해야 한다.
    expect(promotedActor.hp).toBe(controlActor.hp);
    expect(promotedActor.mp).toBe(controlActor.mp);
    expect(promotedActor.gauge).toBe(controlActor.gauge);
    expect(promotedActor.stateIds).toEqual(controlActor.stateIds);
    // 클래스 스킬 즉시 학습 + 기존 습득 스킬 유지.
    expect(promotedActor.skillIds).toContain("skill_claw");
    expect(promotedActor.skillIds).toContain("skill_fire");
    // 배틀 커맨드가 새 클래스에서 온다(배틀 DOM 은 snapshot.classId 로 메뉴를 해석).
    const commands = battleCommandsForActor(promotedProject, "actor_hero", { classId: promotedActor.classId });
    expect(commands[0]?.id).toBe("cmd_champion_strike");

    const eventState = promoted.snapshot().eventState;
    expect(eventState.classOverrides?.actor_hero).toBe("class_champion");
    expect(eventState.flags?.promoteActorSuccess).toBe(true);
    expect(eventState.switches.sw_promoted).toBe(true);
    expect(eventState.switches.sw_promo_failed).toBeUndefined();
    expect(eventState.inventory[ORB_ID] ?? 0).toBe(0); // 승급 요구 아이템 소모
  });

  it("promoteActor 는 승리 시 세션 classOverrides/바이탈/스킬로 write-back 되고 canLose=false 패배 시 미반영", () => {
    const project = promoteProject([promoteCommand]);
    setFighterPromotion(project, { itemId: ORB_ID });
    const runtime = runGaugeDefend(project);
    const snapshot = runtime.snapshot();

    const session = startSession(project);
    applyBattleRewardsToSession(
      session,
      { result: "victory", rewards: snapshot.rewards, actors: snapshot.actors, eventState: snapshot.eventState },
      project
    );
    expect(session.classOverrides?.actor_hero).toBe("class_champion");
    // 전직 write-back 은 바이탈보다 먼저 새 클래스 최대치를 세우고, 전투 HP 를 그 안에 클램프한다.
    expect(session.actorVitals.actor_hero?.maxHp).toBe(999);
    expect(session.actorVitals.actor_hero?.hp).toBe(snapshot.actors[0]?.hp);
    expect(session.actorSkillIds.actor_hero).toContain("skill_claw");
    expect(session.inventory[ORB_ID] ?? 0).toBe(0);

    const lost = startSession(project);
    applyBattleRewardsToSession(
      lost,
      { result: "defeat", canLose: false, rewards: snapshot.rewards, actors: snapshot.actors, eventState: snapshot.eventState },
      project
    );
    expect(lost.classOverrides?.actor_hero).toBeUndefined();
    expect(lost.inventory[ORB_ID]).toBe(1);
  });

  it("promoteActor 요건 미충족 시 failureBranch 를 실행하고 상태를 바꾸지 않는다", () => {
    const project = promoteProject([promoteCommand]);
    setFighterPromotion(project, { switchId: "sw_never" }); // 꺼진 스위치 요건 → 실패
    const runtime = runGaugeDefend(project);
    const snapshot = runtime.snapshot();

    expect(snapshot.actors[0]?.classId).toBe("class_fighter");
    expect(snapshot.eventState.classOverrides?.actor_hero).toBeUndefined();
    expect(snapshot.eventState.flags?.promoteActorSuccess).toBe(false);
    expect(snapshot.eventState.switches.sw_promo_failed).toBe(true);
    expect(snapshot.eventState.switches.sw_promoted).toBeUndefined();
    expect(snapshot.eventState.inventory[ORB_ID]).toBe(1);
    expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "promoteActor failed: requirements-not-met")).toBe(true);
  });
});
