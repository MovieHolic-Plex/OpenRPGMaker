import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleProject(): Project {
  return deserialize(JSON.stringify(battleFixture));
}

function addSkill(project: Project, id: string, name: string, effect: "damage" | "healing" = "damage"): void {
  project.database.skills = project.database.skills.filter((skill) => skill.id !== id);
  project.database.skills.push({
    id,
    name,
    scope: effect === "healing" ? "ally" : "enemy",
    power: effect === "healing" ? 50 : 1,
    description: "",
    type: "normal",
    mpCost: { flat: 0, percentMax: 0 },
    successRate: 100,
    variance: 0,
    hitRate: 100,
    effect: effect === "healing"
      ? { kind: "healing", statistic: "mind", affects: "hp" }
      : { kind: "damage", statistic: "attack", affects: "hp" },
  });
}

function untilActorCommand(runtime: ReturnType<typeof createBattleRuntime>, maxTicks = 40): void {
  for (let i = 0; i < maxTicks; i += 1) {
    runtime.tick(1_000);
    if (runtime.snapshot().phase === "actorCommand" || runtime.snapshot().result) return;
  }
}

function untilEnemyAction(runtime: ReturnType<typeof createBattleRuntime>, maxTicks = 40): string | undefined {
  let seen = runtime.snapshot().lastActionResult?.skillName;
  for (let i = 0; i < maxTicks; i += 1) {
    if (runtime.snapshot().phase === "actorCommand") runtime.performActorCommand({ kind: "defend" });
    runtime.tick(1_000);
    const next = runtime.snapshot().lastActionResult?.skillName;
    if (next && next !== seen) return next;
    seen = next;
  }
  return runtime.snapshot().lastActionResult?.skillName;
}

describe("battle runtime defect regressions", () => {
  it("uses enemy action conditions, priority, and switch effects instead of repeating skillIds[0]", () => {
    const project = battleProject();
    addSkill(project, "skill_attack", "공격");
    addSkill(project, "skill_poison_sting", "독침");
    const enemy = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    enemy.stats = { ...enemy.stats, maxHp: 9999, attack: 1, agility: 999 };
    enemy.actions = [
      { skillId: "skill_attack", priority: 1, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } },
      { skillId: "skill_poison_sting", priority: 100, condition: { kind: "turn", start: 2, interval: 1 }, switchOnAfterAction: { enabled: true, switchId: "sw_poison_used" }, switchOffAfterAction: { enabled: false } },
    ];
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: false, canLose: true, rng: () => 0.99 });

    const first = untilEnemyAction(runtime);
    const second = untilEnemyAction(runtime);

    expect(first).toBe("공격");
    expect(second).toBe("독침");
    expect(runtime.snapshot().eventState.switches.sw_poison_used).toBe(true);
  });

  it("falls back to a basic attack when actor MP is insufficient or the skill is not learned", () => {
    const project = battleProject();
    const fire = project.database.skills.find((skill) => skill.id === "skill_fire")!;
    fire.mpCost = { flat: 4, percentMax: 0 };
    const enemy = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    enemy.stats = { ...enemy.stats, maxHp: 9999 };
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      party: {
        levels: { actor_hero: 1 },
        experience: {},
        vitals: { actor_hero: { hp: 500, mp: 0 } },
        skillIds: { actor_hero: [] },
        partyActorIds: ["actor_hero"],
      },
    });
    untilActorCommand(runtime);
    const hpBefore = runtime.snapshot().enemies[0]?.hp ?? 0;

    runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

    const snap = runtime.snapshot();
    expect(snap.actors[0]?.mp).toBe(0);
    expect(snap.lastActionResult?.skillName).toBeUndefined();
    expect((snap.enemies[0]?.hp ?? 0)).toBeLessThan(hpBefore);
  });

  it("includes session-learned skills by level and session, and excludes future skills", () => {
    const project = battleProject();
    const actor = project.database.actors.find((record) => record.id === "actor_hero")!;
    actor.learnedSkills = [
      { level: 1, skillId: "skill_attack" },
      { level: 5, skillId: "skill_fire" },
    ];
    for (const klass of project.database.classes) klass.learnedSkills = [];
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      party: { levels: { actor_hero: 1 }, experience: {}, skillIds: { actor_hero: ["skill_heal"] }, partyActorIds: ["actor_hero"] },
    });

    expect(runtime.snapshot().actors[0]?.skillIds).toEqual(expect.arrayContaining(["skill_attack", "skill_heal"]));
    expect(runtime.snapshot().actors[0]?.skillIds).not.toContain("skill_fire");
  });

  it("adds equipped stat bonuses to battle actor stats", () => {
    const project = battleProject();
    project.database.actors.find((record) => record.id === "actor_hero")!.initialEquipment = {};
    project.database.enemies.find((record) => record.id === "enemy_slime")!.stats.maxHp = 999;
    const session = startSession(project);
    session.actorEquipment.actor_hero = { weapon: "equip_sword" };
    const sword = project.database.equipment.find((record) => record.id === "equip_sword")!;
    sword.statBonuses.attack = 30;

    const plain = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
    const equipped = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      party: { levels: session.actorLevels, experience: session.actorExperience, equipment: session.actorEquipment, partyActorIds: ["actor_hero"] },
    });

    expect(equipped.snapshot().actors[0]!.maxHp).toBe(plain.snapshot().actors[0]!.maxHp);
    expect(equipped.snapshot().actors[0]!.skillIds).toEqual(plain.snapshot().actors[0]!.skillIds);
    untilActorCommand(plain);
    untilActorCommand(equipped);
    const plainHp = plain.snapshot().enemies[0]!.hp;
    const equippedHp = equipped.snapshot().enemies[0]!.hp;
    plain.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    equipped.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    expect(equippedHp - equipped.snapshot().enemies[0]!.hp).toBeGreaterThan(plainHp - plain.snapshot().enemies[0]!.hp);
  });

  it("uses structured state runtime effects instead of Korean description strings", () => {
    const project = battleProject();
    project.database.states.push({
      id: "state_stun_en",
      name: "Stun",
      restriction: "free-form author text",
      runtimeEffects: { restrictsAction: true, attackMultiplier: 3, removeOnBattleEnd: true },
    });
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      party: { levels: { actor_hero: 1 }, experience: {}, stateIds: { actor_hero: ["state_stun_en"] }, partyActorIds: ["actor_hero"] },
    });

    runtime.tick(1_000);

    expect(runtime.snapshot().phase).toBe("charging");
    expect(runtime.snapshot().activeActorId).toBeUndefined();
  });

  it("excludes unrevealed hidden enemies from victory rewards", () => {
    const project = battleProject();
    const troop = project.database.troops.find((record) => record.id === "troop_slime")!;
    // 이 테스트의 핵심은 "숨겨진 드래곤이 보상에서 제외되는가"이다.
    // 슬라임 HP를 1로 낮춰 한 번의 공격으로 승리하게 만든다(fixture 기본 HP 220 회귀와 무관).
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    slime.stats = { ...slime.stats, maxHp: 1 };
    troop.members = [
      { enemyId: "enemy_slime", x: 120, y: 120, hidden: false },
      { enemyId: "enemy_dragon", x: 180, y: 120, hidden: true },
    ];
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
    untilActorCommand(runtime);
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

    const slimeReward = project.database.enemies.find((record) => record.id === "enemy_slime")!.rewards;
    expect(runtime.snapshot().result).toBe("victory");
    expect(runtime.snapshot().rewards.exp).toBe(slimeReward.exp);
    expect(runtime.snapshot().rewards.gold).toBe(slimeReward.gold);
  });

  it("does not damage when an element rate is nullified", () => {
    const project = battleProject();
    project.database.elements = [{ id: "void", name: "Void", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } }];
    project.database.enemies[0]!.elementRates = { void: "E" };
    project.database.enemies[0]!.stats = { ...project.database.enemies[0]!.stats, maxHp: 999 };
    project.database.skills.push({
      id: "skill_void",
      name: "Void",
      scope: "enemy",
      power: 999,
      description: "",
      type: "normal",
      mpCost: { flat: 0, percentMax: 0 },
      successRate: 100,
      variance: 0,
      hitRate: 100,
      effect: { kind: "damage", statistic: "mind", affects: "hp" },
      elementId: "void",
    });
    project.database.actors[0]!.learnedSkills.push({ level: 1, skillId: "skill_void" });
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
    untilActorCommand(runtime);
    const hpBefore = runtime.snapshot().enemies[0]!.hp;

    runtime.performActorCommand({ kind: "skill", skillId: "skill_void", targetEnemyId: "enemy-1" });

    expect(runtime.snapshot().lastActionResult?.amount).toBe(0);
    expect(runtime.snapshot().enemies[0]!.hp).toBe(hpBefore);
  });

  it("targets enemy-side allies when an enemy uses a healing skill", () => {
    const project = battleProject();
    addSkill(project, "skill_heal", "Heal", "healing");
    const healer = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    healer.stats = { ...healer.stats, maxHp: 999, maxMp: 999, agility: 999 };
    healer.actions = [{ skillId: "skill_heal", priority: 100, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: false, canLose: true });
    const actorHp = runtime.snapshot().actors[0]!.hp;

    untilEnemyAction(runtime);

    expect(runtime.snapshot().lastActionResult?.targetId).toBe("enemy-1");
    expect(runtime.snapshot().actors[0]!.hp).toBe(actorHp);
  });

  it("does not auto-win when all troop members start hidden", () => {
    const project = battleProject();
    const troop = project.database.troops.find((record) => record.id === "troop_slime")!;
    troop.members = [
      { enemyId: "enemy_slime", x: 120, y: 120, hidden: true },
      { enemyId: "enemy_dragon", x: 180, y: 120, hidden: true },
    ];
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 });
    // 전원 hidden 이면 가시 적이 0명. 빈 배열에 every() 가 true 를 반환해 즉시 승리 처리되는
    // 함정을 막았는지 확인한다 — reveal 이벤트를 기다리며 전투는 미종료 상태여야 한다.
    expect(runtime.snapshot().enemies.length).toBe(0);
    expect(runtime.snapshot().result).toBeUndefined();
    expect(runtime.snapshot().phase).not.toBe("resolved");
  });
});

describe("battle authoring tool reference guards", () => {
  it("rejects upsert_troop members that reference missing enemies with known id hints", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_ghost", name: "유령", enemyIds: ["enemy_missing"] } }, { dryRun: false });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("enemy-not-found");
    expect(result.issues?.[0]?.message).toContain("허용 예시");
    expect(ctx.project.database.troops.some((troop) => troop.id === "troop_ghost")).toBe(false);
  });

  it("rejects place_battle_blocker troop ids that do not exist", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const result = runTool(ctx, "place_battle_blocker", { mapId, x: 1, y: 1, troopId: "troop_missing" }, { dryRun: false });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("troop-not-found");
    expect(result.issues?.[0]?.message).toContain("허용 예시");
  });
});
