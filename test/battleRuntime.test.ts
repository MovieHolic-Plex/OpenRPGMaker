// SIZE_OK: Battle runtime regressions share one fixture-backed battle harness
// because turn order, M2 troop events, rewards, and snapshot state interact.
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";
import missingTroopFixture from "./fixtures/projects/battle-missing-troop-v3.json";

function battleProject() {
  return deserialize(JSON.stringify(battleFixture));
}

function defeatSlime(runtime: ReturnType<typeof createBattleRuntime>): void {
  while (!runtime.snapshot().result) {
    if (runtime.snapshot().phase === "actorCommand") {
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    }
    runtime.tick(1_000);
  }
}

describe("side-view battle runtime", () => {
  it("system.battleFlow 미설정 프로젝트는 strict 플로우로 시작한다", () => {
    // Given: a project whose system.battleFlow is undefined (no troop/option override).
    const project = battleProject();
    delete (project.system as { battleFlow?: string }).battleFlow;
    expect(project.system.battleFlow).toBeUndefined();

    // Then: the runtime resolves the final fallback to strict before any tick.
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });
    expect(runtime.snapshot().battleFlow).toBe("strict");
    expect(runtime.snapshot().phase).toBe("actorCommand");
  });

  it("fills active-time gauges in actor-before-enemy order", () => {
    // Given: a database-backed battle with one party actor and one troop enemy.
    const runtime = createBattleRuntime({
      project: battleProject(),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
    });

    // When: enough deterministic time passes for the first battler to act.
    runtime.tick(1_000);

    // Then: the actor command phase opens before the enemy can act.
    expect(runtime.snapshot().phase).toBe("actorCommand");
    expect(runtime.snapshot().activeActorId).toBe("actor_hero");
    expect(runtime.snapshot().actors[0]?.gauge).toBe(100);
    expect(runtime.snapshot().enemies[0]?.gauge).toBeLessThan(100);
  });

  it("applies attack damage from actor commands", () => {
    // Given: the hero has an active command turn against the first enemy.
    const runtime = createBattleRuntime({
      project: battleProject(),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
    });
    runtime.tick(1_000);
    const before = runtime.snapshot().enemies[0]?.hp;

    // When: the actor uses the Attack command.
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

    // Then: the slime loses HP but stays standing for a multi-turn exchange.
    const after = runtime.snapshot().enemies[0]?.hp;
    expect(after).toBeLessThan(before ?? 0);
    expect(after).toBeGreaterThan(0);
    expect(runtime.snapshot().result).toBeUndefined();
  });

  it("records skill animation and defeats an enemy into victory", () => {
    // Given: a weakened troop enemy and a hero skill with a battle animation.
    const project = battleProject();
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime");
    expect(slime).toBeDefined();
    if (slime) slime.stats = { ...slime.stats, maxHp: 18 };
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
    });
    runtime.tick(1_000);

    // When: the actor uses the database skill.
    runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

    // Then: the animation is exposed and the weakened slime is defeated.
    expect(runtime.snapshot().lastAnimation?.animationId).toBe("anim_magic");
    expect(runtime.snapshot().enemies[0]?.defeated).toBe(true);
    expect(runtime.snapshot().result).toBe("victory");
    expect(runtime.snapshot().rewards.exp).toBeGreaterThanOrEqual(0);
  });

  it("applies all-enemies skills to every visible enemy", () => {
    const project = battleProject();
    const skill = project.database.skills.find((record) => record.id === "skill_fire");
    expect(skill).toBeDefined();
    if (!skill) return;
    skill.scope = "allEnemies";
    skill.power = 999;
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime");
    expect(slime).toBeDefined();
    if (!slime) return;
    slime.stats.maxHp = 1;
    const troop = project.database.troops.find((record) => record.id === "troop_slime");
    expect(troop).toBeDefined();
    if (!troop) return;
    troop.enemyIds = ["enemy_slime", "enemy_slime"];
    troop.members = [
      { enemyId: "enemy_slime", x: 80, y: 120, hidden: false },
      { enemyId: "enemy_slime", x: 140, y: 120, hidden: false },
    ];

    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
    });
    runtime.tick(1_000);

    runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

    expect(runtime.snapshot().enemies.map((enemy) => enemy.defeated)).toEqual([true, true]);
    expect(runtime.snapshot().result).toBe("victory");
  });

  it("supports item skill use and command-backed troop event triggers", () => {
    // Given: the troop has a battle event page that applies battle-local event commands.
    const project = battleProject();
    const troop = project.database.troops.find((record) => record.id === "troop_slime");
    expect(troop).toBeDefined();
    troop?.battleEventPages.splice(0, troop.battleEventPages.length, {
      id: "troop_state_page",
      name: "화상 적용",
      conditions: [{ kind: "enemyHp", enemyId: "enemy_slime", minPercent: 0, maxPercent: 100 }],
      span: "battle",
      commands: [
        { kind: "setSwitch", switchId: "sw_battle_event", value: true },
        { kind: "setVariable", variableId: "var_battle_hits", op: "+=", value: 1 },
        { kind: "changeItem", itemId: "item_bomb", op: "+=", amount: 2 },
      ],
    });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
    });
    runtime.tick(1_000);

    // When: the actor uses an item backed by a skill.
    runtime.performActorCommand({ kind: "item", itemId: "item_bomb", targetEnemyId: "enemy-1" });

    // Then: the item consumes inventory and the troop page applies its commands once.
    expect(runtime.snapshot().lastAnimation?.animationId).toBe("anim_magic");
    expect(runtime.snapshot().eventState.switches.sw_battle_event).toBe(true);
    expect(runtime.snapshot().eventState.variables.var_battle_hits).toBe(1);
    expect(runtime.snapshot().eventState.inventory.item_bomb).toBe(2);
  });

  it("runs Change Enemy HP from M2 battle event commands", () => {
    const project = battleProject();
    const troop = project.database.troops.find((record) => record.id === "troop_slime");
    expect(troop).toBeDefined();
    troop?.battleEventPages.splice(0, troop.battleEventPages.length, {
      id: "m2_enemy_hp_page",
      name: "M2 enemy HP",
      conditions: [{ kind: "enemyHp", enemyId: "enemy_slime", minPercent: 0, maxPercent: 100 }],
      span: "battle",
      commands: [
        {
          kind: "m2Command",
          commandId: "m2-098-change-enemy-hp",
          fields: { target: "enemy-1", operation: "remove", value: 4 },
        },
      ],
    });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
    });
    runtime.tick(1_000);

    runtime.performActorCommand({ kind: "defend" });

    expect(runtime.snapshot().enemies[0]?.hp).toBe(216);
    expect(runtime.snapshot().result).toBeUndefined();
  });

  it("runs Force Escape from M2 battle event commands without random chance", () => {
    const project = battleProject();
    const troop = project.database.troops.find((record) => record.id === "troop_slime");
    expect(troop).toBeDefined();
    troop?.battleEventPages.splice(0, troop.battleEventPages.length, {
      id: "m2_force_escape_page",
      name: "M2 force escape",
      conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
      span: "battle",
      commands: [{ kind: "m2Command", commandId: "m2-107-force-escape", fields: {} }],
    });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: false,
      canLose: true,
      battleFlow: "gauge",
    });
    runtime.tick(1_000);

    runtime.performActorCommand({ kind: "defend" });

    expect(runtime.snapshot().result).toBe("escape");
    expect(runtime.snapshot().phase).toBe("resolved");
  });

  it("runs Action Times + from M2 battle event commands", () => {
    const project = battleProject();
    const troop = project.database.troops.find((record) => record.id === "troop_slime");
    expect(troop).toBeDefined();
    troop?.battleEventPages.splice(0, troop.battleEventPages.length, {
      id: "m2_action_times_page",
      name: "M2 action times",
      conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
      span: "battle",
      commands: [
        {
          kind: "m2Command",
          commandId: "m2-108-action-times",
          fields: { target: "actor_hero", operation: "add", value: 1 },
        },
      ],
    });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
    });
    runtime.tick(1_000);

    runtime.performActorCommand({ kind: "defend" });

    expect(runtime.snapshot().phase).toBe("actorCommand");
    expect(runtime.snapshot().activeActorId).toBe("actor_hero");

    defeatSlime(runtime);

    expect(runtime.snapshot().result).toBe("victory");
  });

  it("reveals hidden troop members and changes battleback from M2 battle event commands", () => {
    const project = battleProject();
    const troop = project.database.troops.find((record) => record.id === "troop_slime");
    expect(troop).toBeDefined();
    if (!troop) return;
    troop.enemyIds = ["enemy_slime", "enemy_dragon"];
    troop.members = [
      { enemyId: "enemy_slime", x: 120, y: 128, hidden: false },
      { enemyId: "enemy_dragon", x: 196, y: 96, hidden: true },
    ];
    troop.previewBackgroundResourceId = "easyrpg-backdrop-sky1";
    troop.battleEventPages.splice(0, troop.battleEventPages.length, {
      id: "m2_encounter_and_backdrop",
      name: "Enemy encounter and battleback",
      conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
      span: "battle",
      commands: [
        { kind: "m2Command", commandId: "m2-102-change-battleback", fields: { resourceId: "easyrpg-backdrop-dawn1" } },
        { kind: "m2Command", commandId: "m2-101-enemy-encounter", fields: { target: "enemy-2" } },
      ],
    });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
    });
    runtime.tick(1_000);

    expect(runtime.snapshot().backdropResourceId).toBe("easyrpg-backdrop-sky1");
    expect(runtime.snapshot().enemies.map((enemy) => enemy.id)).toEqual(["enemy-1"]);

    runtime.performActorCommand({ kind: "defend" });

    expect(runtime.snapshot().backdropResourceId).toBe("easyrpg-backdrop-dawn1");
    expect(runtime.snapshot().enemies.map((enemy) => enemy.recordId)).toEqual(["enemy_slime", "enemy_dragon"]);
    expect(runtime.snapshot().result).toBeUndefined();
  });

  it("keeps Enemy Encounter and Change Battleback no-ops safe for invalid battle event fields", () => {
    const project = battleProject();
    const troop = project.database.troops.find((record) => record.id === "troop_slime");
    expect(troop).toBeDefined();
    if (!troop) return;
    troop.members = [
      { enemyId: "enemy_slime", x: 120, y: 128, hidden: false },
      { enemyId: "enemy_dragon", x: 196, y: 96, hidden: true },
    ];
    troop.previewBackgroundResourceId = "easyrpg-backdrop-sky1";
    troop.battleEventPages.splice(0, troop.battleEventPages.length, {
      id: "m2_invalid_encounter_and_backdrop",
      name: "Invalid encounter and battleback",
      conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
      span: "battle",
      commands: [
        { kind: "m2Command", commandId: "m2-102-change-battleback", fields: { resourceId: "" } },
        { kind: "m2Command", commandId: "m2-101-enemy-encounter", fields: { target: "enemy-1" } },
        { kind: "m2Command", commandId: "m2-101-enemy-encounter", fields: { target: "enemy-9" } },
      ],
    });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
    });
    runtime.tick(1_000);

    runtime.performActorCommand({ kind: "defend" });

    expect(runtime.snapshot().backdropResourceId).toBe("easyrpg-backdrop-sky1");
    expect(runtime.snapshot().enemies.map((enemy) => enemy.recordId)).toEqual(["enemy_slime"]);
  });

  it("keeps rough fallback state behavior for empty legacy troop pages", () => {
    // Given: a legacy troop page has no battle commands yet.
    const project = battleProject();
    const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
    if (enemy) enemy.stats = { ...enemy.stats, maxHp: 9999 };
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      battleFlow: "gauge",
    });
    runtime.tick(1_000);

    // When: the actor uses an item backed by a skill.
    runtime.performActorCommand({ kind: "item", itemId: "item_bomb", targetEnemyId: "enemy-1" });

    // Then: the runtime still surfaces a rough state effect for playable feedback.
    expect(runtime.snapshot().enemies[0]?.stateIds).toContain("state_burn");
  });

  it("runs troop event commands once after an enemy skill turn", () => {
    const project = battleProject();
    const troop = project.database.troops.find((record) => record.id === "troop_dragon");
    expect(troop).toBeDefined();
    troop?.battleEventPages.splice(0, troop.battleEventPages.length, {
      id: "dragon_turn_once",
      name: "적 턴 1회",
      conditions: [],
      span: "turn",
      commands: [{ kind: "setVariable", variableId: "var_enemy_turns", op: "+=", value: 1 }],
    });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_dragon",
      canEscape: false,
      canLose: true,
      battleFlow: "gauge",
    });

    runtime.tick(1_500);

    expect(runtime.snapshot().eventState.variables.var_enemy_turns).toBe(1);
    expect(runtime.snapshot().result).toBe("defeat");
  });

  it("returns defeat when all actors fall and losing is allowed", () => {
    // Given: an enemy can act against the only party actor.
    const runtime = createBattleRuntime({
      project: battleProject(),
      troopId: "troop_dragon",
      canEscape: false,
      canLose: true,
      battleFlow: "gauge",
    });

    // When: the enemy receives its active turn.
    runtime.tick(1_500);

    // Then: party defeat is surfaced for event branch handoff.
    expect(runtime.snapshot().actors[0]?.defeated).toBe(true);
    expect(runtime.snapshot().result).toBe("defeat");
  });

  it("rejects missing troop references during project validation", () => {
    // Given: a v3 project whose battleProcessing command references a missing troop.
    const raw = JSON.stringify(missingTroopFixture);

    // When / Then: deserialization blocks the invalid battle start path.
    expect(() => deserialize(raw)).toThrow(/battleProcessing: troopId/);
  });
});
