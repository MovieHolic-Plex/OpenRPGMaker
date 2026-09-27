import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { ActorRecord, EnemyRecord, Project, SkillEffect, SkillRecord } from "@/project/types";

type Setup = { project: Project; actor: ActorRecord; enemy: EnemyRecord; troopId: string };

function setup(): Setup {
  const project = createBlankProject();
  const actor = project.database.actors[0]!;
  const enemy = project.database.enemies[0]!;
  const troop = project.database.troops.find((record) => record.id === project.system.initialTroopId) ?? project.database.troops[0]!;
  troop.enemyIds = [enemy.id];
  troop.members = [{ enemyId: enemy.id, x: 100, y: 100 }];
  troop.battleEventPages = [];
  enemy.stats = { ...enemy.stats, maxHp: 9_999, maxMp: 50, attack: 1, defense: 10, mind: 10, agility: 1 };
  actor.parameterCurves.maxHp = Array.from({ length: 99 }, () => 500);
  actor.parameterCurves.agility = Array.from({ length: 99 }, () => 100);
  actor.initialEquipment = {};
  for (const klass of project.database.classes) klass.learnedSkills = [];
  actor.learnedSkills = [];
  return { project, actor, enemy, troopId: troop.id };
}

function addSkill(project: Project, id: string, effect: SkillEffect, extra: Partial<SkillRecord> = {}): SkillRecord {
  const skill: SkillRecord = {
    ...project.database.skills[0]!,
    id, name: id, scope: "enemy", power: 0, mpCost: { flat: 0, percentMax: 0 },
    successRate: 100, hitRate: 100, variance: 0, effect, stateEffects: [], ...extra,
  };
  delete (skill as Partial<SkillRecord>).hitSequence;
  project.database.skills.push(skill);
  return skill;
}

function runtime(s: Setup, skillIds: string[], rng: () => number = () => 0.5, inventory: Record<string, number> = {}) {
  return createBattleRuntime({
    project: s.project, troopId: s.troopId, canEscape: false, canLose: true, battleFlow: "strict", rng,
    sessionState: { switches: {}, variables: {}, inventory: { ...inventory } },
    party: {
      levels: { [s.actor.id]: 1 }, experience: { [s.actor.id]: 0 },
      vitals: { [s.actor.id]: { hp: 500, mp: 100 } }, stateIds: { [s.actor.id]: [] },
      skillIds: { [s.actor.id]: skillIds }, partyActorIds: [s.actor.id],
    },
  });
}

const specialMessages = (rt: ReturnType<typeof runtime>) =>
  rt.snapshot().timeline.filter((entry) => entry.kind === "special").map((entry) => entry.message ?? "");

describe("mg L4 battle special command effects (#10)", () => {
  it("steal takes one item from the enemy steal table, once per enemy", () => {
    const s = setup();
    const item = s.project.database.items[0]!;
    s.enemy.stealItems = [{ itemId: item.id, rate: 100 }];
    addSkill(s.project, "skill_steal", { kind: "steal" });
    const rt = runtime(s, ["skill_steal"]);
    const target = rt.snapshot().enemies[0]!.id;
    rt.performActorCommand({ kind: "skill", skillId: "skill_steal", targetEnemyId: target });
    expect(rt.snapshot().eventState.inventory[item.id]).toBe(1);
    expect(specialMessages(rt)[0]).toContain("훔쳤다");
    rt.performActorCommand({ kind: "skill", skillId: "skill_steal", targetEnemyId: target });
    expect(rt.snapshot().eventState.inventory[item.id]).toBe(1);
    expect(specialMessages(rt).at(-1)).toBe("이미 훔쳤다.");
  });

  it("steal fails when the rate roll misses", () => {
    const s = setup();
    const item = s.project.database.items[0]!;
    s.enemy.stealItems = [{ itemId: item.id, rate: 10 }];
    addSkill(s.project, "skill_steal", { kind: "steal" });
    const rt = runtime(s, ["skill_steal"], () => 0.5);
    rt.performActorCommand({ kind: "skill", skillId: "skill_steal", targetEnemyId: rt.snapshot().enemies[0]!.id });
    expect(rt.snapshot().eventState.inventory[item.id] ?? 0).toBe(0);
    expect(specialMessages(rt)[0]).toBe("훔치지 못했다.");
  });

  it("scan reports HP/MP and weakness and marks the enemy scanned", () => {
    const s = setup();
    const element = s.project.database.elements?.[0];
    if (!element) throw new Error("기본 속성이 없습니다.");
    s.enemy.elementRates = { ...s.enemy.elementRates, [element.id]: "A" };
    addSkill(s.project, "skill_scan", { kind: "scan" });
    const rt = runtime(s, ["skill_scan"]);
    expect(rt.snapshot().enemies[0]!.scanned).toBeUndefined();
    rt.performActorCommand({ kind: "skill", skillId: "skill_scan", targetEnemyId: rt.snapshot().enemies[0]!.id });
    const enemy = rt.snapshot().enemies[0]!;
    expect(enemy.scanned).toBe(true);
    expect(enemy.hp).toBe(9_999);
    const message = specialMessages(rt)[0]!;
    expect(message).toContain(`HP ${enemy.hp}/9999`);
    expect(message).toContain(element.name || element.id);
  });

  it("learnEnemySkill copies a learnable enemy skill into the actor's permanent skills", () => {
    const s = setup();
    addSkill(s.project, "skill_blue", { kind: "damage", statistic: "mind", affects: "hp" }, { learnable: true, power: 1 });
    addSkill(s.project, "skill_lore", { kind: "learnEnemySkill" });
    s.enemy.actions = [{ skillId: "skill_blue", priority: 50, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
    s.enemy.skillIds = ["skill_blue"];
    const rt = runtime(s, ["skill_lore"]);
    rt.performActorCommand({ kind: "skill", skillId: "skill_lore", targetEnemyId: rt.snapshot().enemies[0]!.id });
    expect(rt.snapshot().actors[0]!.skillIds).toContain("skill_blue");
    expect(rt.snapshot().eventState.actorSkillIds?.[s.actor.id]).toContain("skill_blue");
  });

  it("a blue mage learns a learnable skill that hits them; non-learnable skills are not learned", () => {
    const s = setup();
    addSkill(s.project, "skill_blue", { kind: "damage", statistic: "mind", affects: "hp" }, { learnable: true, power: 1 });
    addSkill(s.project, "skill_lore", { kind: "learnEnemySkill" }, { scope: "self" });
    s.enemy.actions = [{ skillId: "skill_blue", priority: 50, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
    const rt = runtime(s, ["skill_lore"]);
    rt.performActorCommand({ kind: "defend" });
    expect(rt.snapshot().actors[0]!.skillIds).toContain("skill_blue");

    const plain = setup();
    addSkill(plain.project, "skill_blue", { kind: "damage", statistic: "mind", affects: "hp" }, { power: 1 });
    addSkill(plain.project, "skill_lore", { kind: "learnEnemySkill" }, { scope: "self" });
    plain.enemy.actions = [{ skillId: "skill_blue", priority: 50, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
    const plainRt = runtime(plain, ["skill_lore"]);
    plainRt.performActorCommand({ kind: "defend" });
    expect(plainRt.snapshot().actors[0]!.skillIds).not.toContain("skill_blue");
  });

  it("randomSkillFrom picks one listed skill by rng and applies it", () => {
    const s = setup();
    addSkill(s.project, "skill_weak", { kind: "damage", statistic: "attack", affects: "hp" }, { power: 1, damageFormula: "7" });
    addSkill(s.project, "skill_strong", { kind: "damage", statistic: "attack", affects: "hp" }, { power: 1, damageFormula: "300" });
    addSkill(s.project, "skill_slot", { kind: "randomSkillFrom", skillIds: ["skill_weak", "skill_strong"] });
    const low = runtime(s, ["skill_slot"], () => 0.1);
    low.performActorCommand({ kind: "skill", skillId: "skill_slot", targetEnemyId: low.snapshot().enemies[0]!.id });
    const high = runtime(s, ["skill_slot"], () => 0.9);
    high.performActorCommand({ kind: "skill", skillId: "skill_slot", targetEnemyId: high.snapshot().enemies[0]!.id });
    const lowLoss = 9_999 - low.snapshot().enemies[0]!.hp;
    const highLoss = 9_999 - high.snapshot().enemies[0]!.hp;
    expect(lowLoss).toBeGreaterThan(0);
    expect(highLoss).toBeGreaterThan(lowLoss * 10);
    expect(specialMessages(low)[0]).toContain("skill_weak");
    expect(specialMessages(high)[0]).toContain("skill_strong");
  });

  it("new fields survive serialize/deserialize", () => {
    const s = setup();
    s.enemy.stealItems = [{ itemId: s.project.database.items[0]!.id, rate: 40 }];
    addSkill(s.project, "skill_slot", { kind: "randomSkillFrom", skillIds: ["skill_attack"] }, { learnable: true });
    const round = deserialize(serialize(s.project));
    expect(round.database.enemies.find((e) => e.id === s.enemy.id)?.stealItems).toEqual([{ itemId: s.project.database.items[0]!.id, rate: 40 }]);
    const skill = round.database.skills.find((entry) => entry.id === "skill_slot");
    expect(skill?.effect).toEqual({ kind: "randomSkillFrom", skillIds: ["skill_attack"] });
    expect(skill?.learnable).toBe(true);
  });
});
