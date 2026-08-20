import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { simulateBattle } from "@/battle/simulate";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
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
    setEnemyStats(project, { maxHp: 999, attack: 1, agility: 80 });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      party: partyProgress(PARTY4),
      rng: () => 0.99,
    });

    runtime.performActorCommand({ kind: "switch", targetActorId: "actor_rogue" });
    runtime.performActorCommand({ kind: "defend" });

    const snapshot = runtime.snapshot();
    const firstRound = snapshot.roundLogs[0];
    expect(firstRound?.actions[0]).toMatchObject({ userRecordId: "actor_warrior", commandKind: "switch" });
    expect(firstRound?.actions.map((action) => action.userRecordId)).toEqual(["actor_warrior", "enemy_training_slime", "actor_mage"]);
    expect(firstRound?.participatingActorIds).toEqual(["actor_warrior", "actor_mage", "actor_rogue"]);
    expect(snapshot.actors.map((actor) => actor.recordId)).toEqual(["actor_rogue", "actor_mage"]);
    expect(snapshot.reserveActors.map((actor) => actor.recordId)).toEqual(["actor_warrior", "actor_priest"]);
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
