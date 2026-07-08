import { describe, expect, it } from "vitest";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { createBattleRuntime } from "@/battle/runtime";
import { simulateBattle } from "@/battle/simulate";
import { commandPanel } from "@/player/battleCommandDom";
import { deserialize } from "@/project/io";
import { store } from "@/project/store";
import type { ActorParameterKey, Project } from "@/project/types";
import { installFakeDom, type FakeElement } from "./fakeDom";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";

function strictProject(): Project {
  return deserialize(JSON.stringify(strictFixture));
}

function setActorParam(project: Project, actorId: string, key: ActorParameterKey, value: number): void {
  const actor = project.database.actors.find((record) => record.id === actorId);
  if (!actor) throw new Error(`missing actor: ${actorId}`);
  actor.parameterCurves[key] = Array.from({ length: 99 }, () => value);
}

function setStrictBattleStats(project: Project): void {
  setActorParam(project, "actor_warrior", "agility", 10);
  setActorParam(project, "actor_warrior", "attack", 8);
  setActorParam(project, "actor_mage", "agility", 30);
  setActorParam(project, "actor_mage", "attack", 6);
  setActorParam(project, "actor_mage", "mind", 24);
  const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime");
  if (!enemy) throw new Error("missing enemy_training_slime");
  enemy.stats = { ...enemy.stats, maxHp: 999, attack: 1, agility: 20 };
}

function commandPanelTexts(root: FakeElement): string[] {
  return root.querySelectorAll("button").map((button) => button.textContent);
}

describe("battle strict runtime and class commands", () => {
  it("renders class battle commands in authored order and falls back to default commands", () => {
    const project = strictProject();
    expect(battleCommandsForActor(project, "actor_warrior").map((command) => command.name)).toEqual(["공격", "방어", "도주"]);

    const mageClass = project.database.classes.find((record) => record.id === "class_mage");
    if (!mageClass) throw new Error("missing mage class");
    mageClass.battleCommands = [];
    expect(battleCommandsForActor(project, "actor_mage").map((command) => command.kind)).toEqual(["attack", "skill", "item", "defend", "escape"]);

    const cleanup = installFakeDom();
    try {
      store.replace(project);
      const runtime = createBattleRuntime({ project, troopId: "troop_strict_training", canEscape: true, canLose: true, battleFlow: "strict" });
      runtime.performActorCommand({ kind: "defend" });
      const root = commandPanel(runtime.snapshot(), {
        runtime,
        submenu: null,
        setSubmenu: () => undefined,
        setDirectorState: () => undefined,
        render: () => undefined,
        runActorCommand: () => undefined,
        beginTargetCommand: () => undefined,
        confirmTargetSelection: () => undefined,
      }) as unknown as FakeElement;
      expect(commandPanelTexts(root)).toEqual(["공격", "스킬2개", "아이템1종", "방어", "도주"]);
    } finally {
      cleanup();
    }
  });

  it("filters skill submenu by class command skill group", () => {
    const project = strictProject();
    const cleanup = installFakeDom();
    try {
      store.replace(project);
      const runtime = createBattleRuntime({ project, troopId: "troop_strict_training", canEscape: true, canLose: true, battleFlow: "strict" });
      runtime.performActorCommand({ kind: "defend" });
      const magic = battleCommandsForActor(project, "actor_mage").find((command) => command.id === "cmd_magic");
      if (!magic) throw new Error("missing magic command");
      const root = commandPanel(runtime.snapshot(), {
        runtime,
        submenu: { kind: "skill", command: magic },
        setSubmenu: () => undefined,
        setDirectorState: () => undefined,
        render: () => undefined,
        runActorCommand: () => undefined,
        beginTargetCommand: () => undefined,
        confirmTargetSelection: () => undefined,
      }) as unknown as FakeElement;
      expect(root.textContent).toContain("화염");
      expect(root.textContent).not.toContain("집중");
    } finally {
      cleanup();
    }
  });

  it("collects all actor commands, then resolves strict rounds by speed", () => {
    const project = strictProject();
    setStrictBattleStats(project);
    const runtime = createBattleRuntime({ project, troopId: "troop_strict_training", canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0 });

    expect(runtime.snapshot().phase).toBe("actorCommand");
    expect(runtime.snapshot().activeActorId).toBe("actor_warrior");
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().activeActorId).toBe("actor_mage");
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

    const firstRound = runtime.snapshot().roundLogs[0];
    expect(firstRound?.actions.map((action) => action.userRecordId)).toEqual(["actor_mage", "enemy_training_slime", "actor_warrior"]);
  });

  it("uses actor-first and index-order tie breaks without RNG", () => {
    const project = strictProject();
    setActorParam(project, "actor_warrior", "agility", 20);
    const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime");
    if (!enemy) throw new Error("missing enemy_training_slime");
    enemy.stats = { ...enemy.stats, maxHp: 999, attack: 1, agility: 20 };

    const runtime = createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      party: { levels: { actor_warrior: 1 }, experience: {}, partyActorIds: ["actor_warrior"] },
      rng: () => 0.99,
    });
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

    expect(runtime.snapshot().roundLogs[0]?.actions.map((action) => action.userRecordId)).toEqual(["actor_warrior", "enemy_training_slime"]);
  });

  it("advances state duration once per strict round", () => {
    const project = strictProject();
    project.database.states.push({
      id: "state_round_marker",
      name: "라운드 표식",
      restriction: "없음",
      removalCondition: "전투 종료 후 유지",
      recoverNaturallyFromTurn: 2,
      recoverNaturallyChance: 100,
    });
    const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime");
    if (!enemy) throw new Error("missing enemy_training_slime");
    enemy.stats = { ...enemy.stats, maxHp: 999, attack: 1 };

    const runtime = createBattleRuntime({
      project,
      troopId: "troop_strict_training",
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      party: {
        levels: { actor_warrior: 1 },
        experience: {},
        partyActorIds: ["actor_warrior"],
        stateIds: { actor_warrior: ["state_round_marker"] },
      },
      rng: () => 0,
    });
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

    expect(runtime.snapshot().roundLogs[0]?.actors[0]?.stateIds).toContain("state_round_marker");
    expect(runtime.snapshot().actors[0]?.stateIds).not.toContain("state_round_marker");
  });

  it("keeps gauge mode as the default battle flow", () => {
    const project = strictProject();
    const troop = project.database.troops.find((record) => record.id === "troop_strict_training");
    if (troop) troop.battleFlow = "gauge";
    const runtime = createBattleRuntime({ project, troopId: "troop_strict_training", canEscape: true, canLose: true });

    expect(runtime.snapshot().battleFlow).toBe("gauge");
    expect(runtime.snapshot().phase).toBe("charging");
    runtime.tick(1_000);
    expect(runtime.snapshot().phase).toBe("actorCommand");
  });

  it("simulateBattle replays a three-round strict script with round logs", () => {
    const project = strictProject();
    setStrictBattleStats(project);

    const result = simulateBattle({
      project,
      troopId: "troop_strict_training",
      heroLevel: 1,
      battleFlow: "strict",
      seed: 7,
      n: 1,
      maxSteps: 6,
      strictScript: [
        [
          { actorId: "actor_warrior", command: "attack", target: "enemy-1" },
          { actorId: "actor_mage", command: "skill", skillId: "skill_fire", target: "enemy-1" },
        ],
        [
          { actorId: "actor_warrior", command: "guard" },
          { actorId: "actor_mage", command: "skill", skillId: "skill_fire", target: "enemy-1" },
        ],
        [
          { actorId: "actor_warrior", command: "attack", target: "enemy-1" },
          { actorId: "actor_mage", command: "attack", target: "enemy-1" },
        ],
      ],
    });

    expect(result.battleFlow).toBe("strict");
    expect(result.roundLogs).toHaveLength(3);
    expect(result.roundLogs[0]?.actions.map((action) => action.userRecordId)).toEqual(["actor_mage", "enemy_training_slime", "actor_warrior"]);
    expect(result.roundLogs[1]?.actions.map((action) => action.commandKind)).toEqual(["skill", "enemyAttack", "defend"]);
    expect(result.roundLogs[2]?.actions.map((action) => action.userRecordId)).toEqual(["actor_mage", "enemy_training_slime", "actor_warrior"]);
  });
});
