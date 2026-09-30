import { describe, expect, it } from "vitest";
import { resolveRetroClassChoreography, resolveRetroMonsterChoreography } from "@/assets/retroSkillCatalog";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";

describe("battle choreography audit identity", () => {
  it("keeps own class and monster contracts ahead of cross-kind borrowed fields", () => {
    const actor = { id: "skill_ranger_snipe", retroChoreographyId: "skill_mon_acid_spit" };
    const monster = { id: "skill_mon_acid_spit", retroChoreographyId: "skill_ranger_snipe" };
    expect(resolveRetroClassChoreography(actor)?.id).toBe(actor.id);
    expect(resolveRetroMonsterChoreography(actor)).toBeUndefined();
    expect(resolveRetroMonsterChoreography(monster)?.id).toBe(monster.id);
    expect(resolveRetroClassChoreography(monster)).toBeUndefined();
  });

  it("borrows either kind for a custom ID", () => {
    expect(resolveRetroClassChoreography({ id: "custom", retroChoreographyId: "skill_gunner_snipe" })?.id).toBe("skill_gunner_snipe");
    expect(resolveRetroMonsterChoreography({ id: "custom", retroChoreographyId: "skill_mon_acid_spit" })?.id).toBe("skill_mon_acid_spit");
  });

  it("keeps exact equipped skill identity when the actor owns another skill with the same name", () => {
    const project = createBlankProject();
    const actor = project.database.actors.find(row => row.id === "actor_ranger")!;
    const troop = project.database.troops[0]!;
    const enemy = project.database.enemies.find(row => row.id === troop.enemyIds[0])!;
    const charm = project.database.equipment.find(row => row.id === "equip_focus_charm")!;
    actor.initialEquipment = { accessory: charm.id };
    actor.parameterCurves.maxMp = Array(99).fill(100);
    actor.parameterCurves.agility = Array(99).fill(999);
    charm.grantsSkillIds = ["skill_gunner_snipe"];
    enemy.stats.maxHp = 9999;
    enemy.stats.agility = 1;
    enemy.actions = [];
    troop.enemyIds = [enemy.id];
    troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
    troop.battleEventPages = [];
    const runtime = createBattleRuntime({ project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
      party: { partyActorIds: [actor.id], levels: { [actor.id]: 22 }, experience: {} } });
    expect(runtime.snapshot().actors[0]!.skillIds).toContain("skill_ranger_snipe");
    expect(runtime.snapshot().actors[0]!.skillIds).toContain("skill_gunner_snipe");
    runtime.performActorCommand({ kind: "skill", skillId: "skill_gunner_snipe", targetEnemyId: "enemy-1" });
    const fact = runtime.snapshot().timeline.find(row => row.kind === "damage" && row.userRecordId === actor.id)!;
    expect(fact).toMatchObject({ skillName: "저격", skillId: "skill_gunner_snipe" });
  });

  it("carries enemy special skill identity and command kind into its presentation fact", () => {
    const project = createBlankProject();
    const actor = project.database.actors[0]!;
    const troop = project.database.troops[0]!;
    const enemy = project.database.enemies.find(row => row.id === troop.enemyIds[0])!;
    const skill = normalizeSkillRecord({ id: "audit_scan", name: "Borrowed scan", scope: "enemy", effect: { kind: "scan" },
      retroChoreographyId: "skill_gunner_snipe", mpCost: { flat: 0, percentMax: 0 }, hitRate: 100, successRate: 100 });
    project.database.skills.push(skill);
    actor.parameterCurves.agility = Array(99).fill(1);
    enemy.stats.agility = 999;
    enemy.stats.maxHp = 9999;
    enemy.actions = [{ skillId: skill.id, priority: 50, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
    troop.enemyIds = [enemy.id];
    troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
    troop.battleEventPages = [];
    const runtime = createBattleRuntime({ project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
      party: { partyActorIds: [actor.id], levels: { [actor.id]: 1 }, experience: {} } });
    runtime.performActorCommand({ kind: "defend" });
    expect(runtime.snapshot().timeline.find(row => row.kind === "special" && row.side === "enemy"))
      .toMatchObject({ skillId: skill.id, skillName: skill.name, commandKind: "enemySkill", targetId: actor.id });
  });
});
