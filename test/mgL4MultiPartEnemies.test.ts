import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { ActorRecord, EnemyRecord, Project, SkillRecord, StateRecord } from "@/project/types";

type Setup = { project: Project; actor: ActorRecord; core: EnemyRecord; arm: EnemyRecord; troopId: string };

function setup(): Setup {
  const project = createBlankProject();
  const actor = project.database.actors[0]!;
  const core = project.database.enemies[0]!;
  const arm: EnemyRecord = structuredClone(core);
  arm.id = "enemy_arm";
  arm.name = "집게팔";
  project.database.enemies.push(arm);
  core.stats = { ...core.stats, maxHp: 500, attack: 1, defense: 0, agility: 1 };
  arm.stats = { ...arm.stats, maxHp: 10, attack: 1, defense: 0, agility: 1 };
  arm.actions = [];
  const troop = project.database.troops.find((record) => record.id === project.system.initialTroopId) ?? project.database.troops[0]!;
  troop.members = [
    { enemyId: core.id, x: 80, y: 100 },
    { enemyId: arm.id, x: 120, y: 100, partOf: 0, partTag: "arm" },
  ];
  troop.enemyIds = troop.members.map((member) => member.enemyId);
  troop.battleEventPages = [];
  const crush: SkillRecord = {
    ...project.database.skills[0]!, id: "skill_crush", name: "분쇄", scope: "enemy", power: 1, damageFormula: "1",
    mpCost: { flat: 0, percentMax: 0 }, successRate: 100, hitRate: 100, variance: 0, criticalRate: 0,
    effect: { kind: "damage", statistic: "attack", affects: "hp" }, stateEffects: [],
  };
  delete (crush as Partial<SkillRecord>).hitSequence;
  project.database.skills.push(crush);
  core.actions = [
    { skillId: "skill_crush", priority: 100, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false }, requiresPart: "arm" },
    { skillId: "", priority: 1, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } },
  ];
  actor.parameterCurves.maxHp = Array.from({ length: 99 }, () => 500);
  actor.parameterCurves.attack = Array.from({ length: 99 }, () => 50);
  actor.parameterCurves.agility = Array.from({ length: 99 }, () => 100);
  actor.initialEquipment = {};
  for (const klass of project.database.classes) klass.learnedSkills = [];
  actor.learnedSkills = [];
  return { project, actor, core, arm, troopId: troop.id };
}

function runtime(s: Setup, extra: { stateIds?: string[]; equipment?: Record<string, string> } = {}) {
  return createBattleRuntime({
    project: s.project, troopId: s.troopId, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
    sessionState: { switches: {}, variables: {}, inventory: {}, ...(extra.equipment ? { actorEquipment: { [s.actor.id]: extra.equipment } } : {}) },
    party: {
      levels: { [s.actor.id]: 1 }, experience: { [s.actor.id]: 0 },
      vitals: { [s.actor.id]: { hp: 500, mp: 100 } }, stateIds: { [s.actor.id]: extra.stateIds ?? [] },
      skillIds: { [s.actor.id]: [] }, partyActorIds: [s.actor.id],
      ...(extra.equipment ? { equipment: { [s.actor.id]: extra.equipment } } : {}),
    },
  });
}

const enemySkillNames = (rt: ReturnType<typeof runtime>) =>
  rt.snapshot().timeline.filter((entry) => entry.side === "enemy" && entry.commandKind === "enemySkill").map((entry) => entry.skillName);

describe("mg L4 multi-part enemies (#8)", () => {
  it("core uses a part-tagged action while the part lives", () => {
    const s = setup();
    const rt = runtime(s);
    rt.performActorCommand({ kind: "defend" });
    expect(enemySkillNames(rt)).toContain("분쇄");
  });

  it("destroying the part disables actions that require it", () => {
    const s = setup();
    const rt = runtime(s);
    rt.performActorCommand({ kind: "attack", targetEnemyId: "enemy-2" });
    expect(rt.snapshot().enemies.find((enemy) => enemy.id === "enemy-2")!.hp).toBe(0);
    expect(rt.snapshot().timeline.some((entry) => entry.kind === "special" && entry.message?.includes("파괴"))).toBe(true);
    expect(enemySkillNames(rt)).not.toContain("분쇄");
    rt.performActorCommand({ kind: "defend" });
    expect(enemySkillNames(rt)).not.toContain("분쇄");
  });

  it("core death kills its remaining parts and wins the battle", () => {
    const s = setup();
    s.core.stats = { ...s.core.stats, maxHp: 10 };
    s.arm.stats = { ...s.arm.stats, maxHp: 900 };
    const rt = runtime(s);
    rt.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const snapshot = rt.snapshot();
    expect(snapshot.enemies.find((enemy) => enemy.id === "enemy-1")!.hp).toBe(0);
    expect(snapshot.enemies.find((enemy) => enemy.id === "enemy-2")!.hp).toBe(0);
    expect(snapshot.result).toBe("victory");
  });

  it("troop part links and requiresPart survive save/load", () => {
    const s = setup();
    const round = deserialize(serialize(s.project));
    const troop = round.database.troops.find((entry) => entry.id === s.troopId)!;
    expect(troop.members?.[1]).toMatchObject({ partOf: 0, partTag: "arm" });
    expect(troop.members?.[0]?.partOf).toBeUndefined();
    expect(round.database.enemies.find((entry) => entry.id === s.core.id)!.actions[0]!.requiresPart).toBe("arm");
  });
});

describe("mg L4 body-part loss state (#8)", () => {
  function withWeaponAndInjury(s: Setup): { weaponId: string; state: StateRecord } {
    const weapon = s.project.database.equipment.find((entry) => entry.slot === "weapon")!;
    weapon.statBonuses = { ...weapon.statBonuses, attack: 40 };
    weapon.equippableActorIds = [];
    weapon.equippableClassIds = [];
    const state: StateRecord = { id: "state_arm_injury", name: "팔 부상", disablesEquipSlot: "weapon" };
    s.project.database.states.push(state);
    return { weaponId: weapon.id, state };
  }

  it("a disablesEquipSlot state removes that slot's stat bonus and restores it when removed", () => {
    const healthy = setup();
    const { weaponId } = withWeaponAndInjury(healthy);
    const base = runtime(healthy, { equipment: { weapon: weaponId } }).snapshot().actors[0]!.effectiveStats!.attack;

    const s = setup();
    withWeaponAndInjury(s);
    const cure: SkillRecord = {
      ...s.project.database.skills[0]!, id: "skill_cure_arm", name: "치료", scope: "self", power: 0,
      mpCost: { flat: 0, percentMax: 0 }, successRate: 100, hitRate: 100, variance: 0,
      effect: { kind: "support" }, stateEffects: [{ stateId: "state_arm_injury", chance: 100, operation: "remove" }],
    };
    const injure: SkillRecord = { ...cure, id: "skill_injure_arm", name: "팔 꺾기", stateEffects: [{ stateId: "state_arm_injury", chance: 100, operation: "add" }] };
    s.project.database.skills.push(cure, injure);
    const rt = createBattleRuntime({
      project: s.project, troopId: s.troopId, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
      sessionState: { switches: {}, variables: {}, inventory: {}, actorEquipment: { [s.actor.id]: { weapon: weaponId } } },
      party: {
        levels: { [s.actor.id]: 1 }, experience: { [s.actor.id]: 0 }, vitals: { [s.actor.id]: { hp: 500, mp: 100 } },
        stateIds: { [s.actor.id]: [] }, skillIds: { [s.actor.id]: ["skill_injure_arm", "skill_cure_arm"] },
        partyActorIds: [s.actor.id], equipment: { [s.actor.id]: { weapon: weaponId } },
      },
    });
    expect(rt.snapshot().actors[0]!.effectiveStats!.attack).toBe(base);
    rt.performActorCommand({ kind: "skill", skillId: "skill_injure_arm", targetEnemyId: rt.snapshot().actors[0]!.id, targetActorId: s.actor.id });
    expect(rt.snapshot().actors[0]!.stateIds).toContain("state_arm_injury");
    expect(rt.snapshot().actors[0]!.effectiveStats!.attack).toBe(base - 40);
    rt.performActorCommand({ kind: "skill", skillId: "skill_cure_arm", targetEnemyId: rt.snapshot().actors[0]!.id, targetActorId: s.actor.id });
    expect(rt.snapshot().actors[0]!.stateIds).not.toContain("state_arm_injury");
    expect(rt.snapshot().actors[0]!.effectiveStats!.attack).toBe(base);
  });

  it("a disablesEquipSlot state carried in from the field already drops the slot bonus at battle start", () => {
    const healthy = setup();
    const { weaponId } = withWeaponAndInjury(healthy);
    const armed = runtime(healthy, { equipment: { weapon: weaponId } }).snapshot().actors[0]!.effectiveStats!.attack;
    const unarmed = setup();
    withWeaponAndInjury(unarmed);
    const bare = runtime(unarmed, { stateIds: ["state_arm_injury"], equipment: { weapon: weaponId } }).snapshot().actors[0]!.effectiveStats!.attack;
    const emptyHand = runtime(unarmed, { equipment: {} }).snapshot().actors[0]!.effectiveStats!.attack;
    expect(armed).toBeGreaterThan(bare);
    expect(bare).toBe(emptyHand);

    const s = setup();
    withWeaponAndInjury(s);
    const rt = createBattleRuntime({
      project: s.project, troopId: s.troopId, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
      sessionState: { switches: {}, variables: {}, inventory: {}, actorEquipment: { [s.actor.id]: { weapon: weaponId } } },
      party: {
        levels: { [s.actor.id]: 1 }, experience: { [s.actor.id]: 0 }, vitals: { [s.actor.id]: { hp: 321, mp: 7 } },
        stateIds: { [s.actor.id]: ["state_arm_injury"] }, skillIds: { [s.actor.id]: [] },
        partyActorIds: [s.actor.id], equipment: { [s.actor.id]: { weapon: weaponId } },
      },
    });
    const actor = rt.snapshot().actors[0]!;
    expect(actor.stateIds).toContain("state_arm_injury");
    expect(actor.effectiveStats!.attack).toBe(bare);
    // 다시 계산해도 들고 온 HP·MP 는 그대로다.
    expect(actor.hp).toBe(321);
    expect(actor.mp).toBe(7);
  });

  it("disablesEquipSlot survives save/load", () => {
    const s = setup();
    withWeaponAndInjury(s);
    const round = deserialize(serialize(s.project));
    expect(round.database.states.find((entry) => entry.id === "state_arm_injury")?.disablesEquipSlot).toBe("weapon");
  });
});
