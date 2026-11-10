import { describe, expect, it } from "vitest";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeEquipmentRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import { FS_EQUIPMENT_TRAITS, FS_ITEM_ICONS, FS_SARAH_ACTOR, FS_SHOP_SPEARS, applyFallenItemIdentity } from "@/project/flagship/fallen/itemIdentity";
import type { EquipmentRecord, Project } from "@/project/types";

const STATES = ["state_fs_star_mark_1", "fs_state_burn", "state_fs_pierced"];

function fallenLike(): Project {
  const project = createBlankProject();
  for (const id of STATES) {
    if (!project.database.states.some((row) => row.id === id)) project.database.states.push(normalizeStateRecord({ id, name: id }));
  }
  const ids = [...FS_EQUIPMENT_TRAITS.map((row) => row.id), ...FS_SHOP_SPEARS];
  for (const id of ids) {
    if (project.database.equipment.some((row) => row.id === id)) continue;
    project.database.equipment.push(normalizeEquipmentRecord({ id, name: id, slot: "weapon", description: "공격 1.\n평타: 옛 줄." } as Partial<EquipmentRecord> & Pick<EquipmentRecord, "id" | "name">));
  }
  return project;
}

describe("Fallen Star item identity (batch 1)", () => {
  it("every on-hit weapon state lands on at least one ordinary enemy (fs-vqa-fix-all: star lance pierce was blocked everywhere)", () => {
    const project = fallenLike();
    applyFallenItemIdentity(project);
    const lance = project.database.equipment.find((row) => row.id === "equip_fs_spear_star")!;
    expect(lance.stateInflictIds).not.toContain("state_fs_pierced");
    expect(lance.stateInflictIds).toEqual(["state_fs_star_mark_1"]);
  });

  it("each trait replaces the old trait line with exactly one new line and the shop spears let Sarah equip them", () => {
    const project = fallenLike();
    const report = applyFallenItemIdentity(project);
    expect(report.skipped.filter((row) => row.startsWith("equip_"))).toEqual([]);
    for (const trait of FS_EQUIPMENT_TRAITS) {
      const record = project.database.equipment.find((row) => row.id === trait.id)!;
      const lines = record.description.split("\n");
      expect(lines.at(-1)).toBe(trait.traitLine);
      expect(lines.filter((line) => line.startsWith("평타:") || line.startsWith("착용:"))).toHaveLength(1);
    }
    for (const id of FS_SHOP_SPEARS) {
      expect(project.database.equipment.find((row) => row.id === id)!.equippableActorIds).toContain(FS_SARAH_ACTOR);
    }
    for (const icon of Object.values(FS_ITEM_ICONS)) expect(resolveAssetResourceUrl(icon, { project })).toBeTruthy();
  });

  it("in battle, the double-strike sword hits twice and the guard halberd's normal attack reaches every enemy", () => {
    const run = (weaponId: string, enemies: number) => {
      const project = fallenLike();
      applyFallenItemIdentity(project);
      project.system.battleModel = "rm2k3";
      const actor = project.database.actors[0]!;
      const enemy = project.database.enemies[0]!;
      const troop = project.database.troops.find((row) => row.id === project.system.initialTroopId) ?? project.database.troops[0]!;
      troop.enemyIds = Array(enemies).fill(enemy.id);
      troop.members = Array.from({ length: enemies }, (_, i) => ({ enemyId: enemy.id, x: 80, y: 40 + i * 40 }));
      troop.battleEventPages = [];
      actor.initialEquipment = { weapon: weaponId };
      const weapon = project.database.equipment.find((row) => row.id === weaponId)!;
      weapon.equippableActorIds = [...weapon.equippableActorIds, actor.id];
      actor.parameterCurves.agility = Array(99).fill(999);
      enemy.stats = { ...enemy.stats, maxHp: 99999, attack: 1, agility: 1 };
      enemy.actions = [];
      const runtime = createBattleRuntime({
        project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
        party: { levels: { [actor.id]: 1 }, experience: {}, partyActorIds: [actor.id], skillIds: { [actor.id]: [] } },
      });
      const before = runtime.snapshot().timeline.length;
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      const hits = runtime.snapshot().timeline.slice(before).filter((entry) => entry.kind === "damage" && String(entry.targetId).startsWith("enemy-"));
      return { hits: hits.length, targets: new Set(hits.map((entry) => (entry as { targetId: string }).targetId)).size };
    };
    expect(run("equip_fs_sword_gale", 1).hits).toBe(2);
    expect(run("equip_gen_halberd_guard", 3).targets).toBe(3);
  });
});
