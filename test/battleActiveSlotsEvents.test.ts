import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { simulateBattle } from "@/battle/simulate";
import { deserialize } from "@/project/io";
import type { ActorParameterKey, Project } from "@/project/types";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";
import bossFixture from "./fixtures/projects/battle-active-slots-boss-v3.json";

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
