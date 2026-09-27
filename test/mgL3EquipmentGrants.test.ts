// 장비가 주는 전투 명령·스킬, MP 소모 절반, 장착 중 장비의 제자리 강화(#7).
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import { battleSkillMpCost, battleSkillUseFailure } from "@/battle/battleSkillUse";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { applyItemUpgrade } from "@/project/upgrades";
import type { Project, SkillRecord } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function project(): Project {
  const p = deserialize(JSON.stringify(battleFixture));
  p.database.skills.push(skill(p, { id: "skill_blade", name: "칼바람", mpCost: { flat: 9, percentMax: 0 } }));
  p.database.equipment.push(
    normalizeEquipmentRecord({
      id: "equip_runeblade", name: "룬 검", slot: "weapon", equippableActorIds: ["actor_hero"],
      grantsSkillIds: ["skill_blade"],
      grantsCommand: { id: "cmd_rune", name: "룬 베기", kind: "skill", skillId: "skill_blade" },
    }),
    normalizeEquipmentRecord({
      id: "equip_ring", name: "절약 반지", slot: "accessory", equippableActorIds: ["actor_hero"],
      effectFlags: { preemptive: false, doubleAttack: false, attackAll: false, ignoreDodge: false, preventCriticalHits: false, increasePhysicalDodge: false, halfMpCost: true, negateTerrainDamage: false, fixedEquipment: false },
    }),
  );
  return p;
}

function skill(p: Project, patch: Partial<SkillRecord> & Pick<SkillRecord, "id">): SkillRecord {
  return {
    ...p.database.skills[0]!,
    name: patch.id,
    scope: "enemy",
    power: 10,
    mpCost: { flat: 0, percentMax: 0 },
    successRate: 100,
    hitRate: 100,
    variance: 0,
    effect: { kind: "damage", statistic: "attack", affects: "hp" },
    stateEffects: [],
    ...patch,
  };
}

function battle(p: Project, equipment: Record<string, string>) {
  return createBattleRuntime({
    project: p, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5,
    party: { levels: {}, experience: {}, equipment: { actor_hero: equipment } },
  });
}

function actorTurn(runtime: ReturnType<typeof createBattleRuntime>): void {
  for (let guard = 0; guard < 200 && runtime.snapshot().phase !== "actorCommand"; guard += 1) runtime.tick(100);
  expect(runtime.snapshot().phase).toBe("actorCommand");
}

describe("equipment grants battle skills and commands", () => {
  it("an equipped weapon makes its granted skill usable without learning it", () => {
    const p = project();
    const bare = battle(p, {});
    actorTurn(bare);
    expect(battleSkillUseFailure(p, bare.snapshot().actors[0]!, "skill_blade")).toBe("notLearned");

    const armed = battle(p, { weapon: "equip_runeblade" });
    actorTurn(armed);
    const hero = armed.snapshot().actors[0]!;
    expect(hero.skillIds).not.toContain("skill_blade");
    expect(hero.equipmentEffects?.grantedSkillIds).toEqual(["skill_blade"]);
    expect(battleSkillUseFailure(p, hero, "skill_blade")).toBeUndefined();
    armed.performActorCommand({ kind: "skill", skillId: "skill_blade", targetEnemyId: "enemy-1" });
    expect(armed.snapshot().timeline.some((entry) => entry.skillName === "칼바람" && entry.hit)).toBe(true);
  });

  it("adds the granted command to the actor's menu only while equipped", () => {
    const p = project();
    const armed = battle(p, { weapon: "equip_runeblade" });
    actorTurn(armed);
    const hero = armed.snapshot().actors[0]!;
    const withGrant = battleCommandsForActor(p, hero.recordId, { classId: hero.classId, grantedCommands: hero.equipmentEffects?.grantedCommands });
    expect(withGrant.find((command) => command.id === "cmd_rune")).toMatchObject({ name: "룬 베기", kind: "skill", skillId: "skill_blade" });
    const without = battleCommandsForActor(p, hero.recordId, { classId: hero.classId });
    expect(without.some((command) => command.id === "cmd_rune")).toBe(false);
  });

  it("auto-battle can pick a granted skill", () => {
    const p = project();
    // 배운 기술을 비워 장비 기술만 후보로 남긴다(클래스 기술도 뺀다).
    p.database.actors[0]!.learnedSkills = [];
    p.database.classes[0]!.learnedSkills = [];
    p.database.classes[0]!.skillIds = [];
    const armed = battle(p, { weapon: "equip_runeblade" });
    actorTurn(armed);
    const command = chooseAutoBattleCommand(p, armed.snapshot(), () => 0);
    expect(command).toMatchObject({ kind: "skill", skillId: "skill_blade" });
  });

  it("grant fields survive save/load", () => {
    const reloaded = deserialize(serialize(project()));
    const blade = reloaded.database.equipment.find((entry) => entry.id === "equip_runeblade");
    expect(blade?.grantsSkillIds).toEqual(["skill_blade"]);
    expect(blade?.grantsCommand).toEqual({ id: "cmd_rune", name: "룬 베기", kind: "skill", skillId: "skill_blade" });
  });
});

describe("halfMpCost equipment flag", () => {
  it("halves MP cost with round-up (9 → 5) in legality and consumption", () => {
    expect(battleSkillMpCost({ mpCost: { flat: 9, percentMax: 0 } }, 0, true)).toBe(5);
    expect(battleSkillMpCost({ mpCost: { flat: 1, percentMax: 0 } }, 0, true)).toBe(1);
    const p = project();
    const runtime = battle(p, { weapon: "equip_runeblade", accessory: "equip_ring" });
    actorTurn(runtime);
    const before = runtime.snapshot().actors[0]!;
    expect(before.equipmentEffects?.halfMpCost).toBe(true);
    runtime.performActorCommand({ kind: "skill", skillId: "skill_blade", targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().actors[0]!.mp).toBe(before.mp - 5);
  });

  it("without the ring the full cost is paid", () => {
    const p = project();
    const runtime = battle(p, { weapon: "equip_runeblade" });
    actorTurn(runtime);
    const before = runtime.snapshot().actors[0]!.mp;
    runtime.performActorCommand({ kind: "skill", skillId: "skill_blade", targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().actors[0]!.mp).toBe(before - 9);
  });
});

describe("in-place upgrade of equipped gear", () => {
  function upgradeProject(): Project {
    const p = project();
    p.database.equipment.push(normalizeEquipmentRecord({ id: "equip_runeblade_plus", name: "룬 검+", slot: "weapon", equippableActorIds: ["actor_hero"], statBonuses: { attack: 20, defense: 0, mind: 0, agility: 0 } }));
    p.database.items.push({ ...p.database.items[0]!, id: "item_ore", name: "광석" });
    p.system.itemUpgrades = [{ id: "up_rune", fromItemId: "equip_runeblade", toItemId: "equip_runeblade_plus", target: "equipment", goldCost: 50, ingredients: [{ itemId: "item_ore", count: 1 }] }];
    return p;
  }

  it("replaces the equipped weapon in its slot and pays gold and materials", () => {
    const p = upgradeProject();
    const session = startSession(p);
    session.actorEquipment.actor_hero = { weapon: "equip_runeblade" };
    session.inventory = { item_ore: 2 };
    session.gold = 80;
    expect(applyItemUpgrade(p, session, "up_rune")).toEqual({ ok: true, ruleId: "up_rune", toItemId: "equip_runeblade_plus", equippedActorId: "actor_hero" });
    expect(session.actorEquipment.actor_hero?.weapon).toBe("equip_runeblade_plus");
    expect(session.inventory.item_ore).toBe(1);
    expect(session.inventory.equip_runeblade_plus).toBeUndefined();
    expect(session.gold).toBe(30);

    const runtime = createBattleRuntime({ project: p, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5, sessionState: session });
    expect(runtime.snapshot().actors[0]!.effectiveStats?.attack).toBeGreaterThanOrEqual(20);
  });

  it("upgrades a bag copy when nobody wears it, and rejects without the item or gold", () => {
    const p = upgradeProject();
    const session = startSession(p);
    session.actorEquipment = {};
    session.inventory = { item_ore: 1 };
    session.gold = 80;
    expect(applyItemUpgrade(p, session, "up_rune")).toEqual({ ok: false, reason: "missing-item" });
    session.inventory.equip_runeblade = 1;
    session.gold = 10;
    expect(applyItemUpgrade(p, session, "up_rune")).toEqual({ ok: false, reason: "missing-gold" });
    session.gold = 50;
    expect(applyItemUpgrade(p, session, "up_rune")).toEqual({ ok: true, ruleId: "up_rune", toItemId: "equip_runeblade_plus" });
    expect(session.inventory.equip_runeblade ?? 0).toBe(0);
    expect(session.inventory.equip_runeblade_plus).toBe(1);
  });

  it("rejects a cross-slot upgrade and keeps the equipped item untouched", () => {
    const p = upgradeProject();
    p.system.itemUpgrades = [{ id: "up_bad", fromItemId: "equip_runeblade", toItemId: "equip_ring", target: "equipment" }];
    const session = startSession(p);
    session.actorEquipment.actor_hero = { weapon: "equip_runeblade" };
    expect(applyItemUpgrade(p, session, "up_bad")).toEqual({ ok: false, reason: "invalid-state" });
    expect(session.actorEquipment.actor_hero?.weapon).toBe("equip_runeblade");
  });

  it("equipment-target rules pass reference validation and survive save/load", () => {
    const reloaded = deserialize(serialize(upgradeProject()));
    expect(reloaded.system.itemUpgrades?.[0]?.target).toBe("equipment");
  });
});
