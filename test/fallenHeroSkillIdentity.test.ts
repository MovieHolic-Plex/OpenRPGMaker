import { describe, expect, it } from "vitest";
import { resolveRetroClassChoreography } from "@/assets/retroSkillCatalog";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import {
  FS2_LANCE_SKILLS, FS_HIT_FLASH, FS_STAR_FINISHER_SKILLS, FS_STAR_MARK_FINISHERS, FS_STAR_MARK_SLASHES, FS_STAR_MARK_STATES,
  applyFallenHeroSkillIdentity,
} from "@/project/flagship/fallen/heroSkillIdentity";
import type { Project, SkillRecord } from "@/project/types";

const KAEL_SWORD_SHEETS = ["hero_pierce", "hero_whirl", "hero_meteor_trail", "hero_meteor_impact", "hero_cross"];

function fallenLike(): Project {
  const project = createBlankProject();
  const ids = [...FS_STAR_MARK_SLASHES, ...FS_STAR_MARK_FINISHERS, ...Object.keys(FS2_LANCE_SKILLS)];
  for (const id of ids) {
    if (project.database.skills.some((skill) => skill.id === id)) continue;
    project.database.skills.push(normalizeSkillRecord({ id, name: id, scope: "enemy", power: 10, damageFormula: "100",
      mpCost: { flat: 0, percentMax: 0 }, variance: 0, criticalRate: 0, hitRate: 100, successRate: 100,
      effect: { kind: "damage", statistic: "attack", affects: "hp" } }));
  }
  return project;
}

describe("Fallen Star hero skill identity (batch 1)", () => {
  it("Sarah's lance skills resolve to lance records with no Kael sword sheet, ids unchanged", () => {
    const project = fallenLike();
    const report = applyFallenHeroSkillIdentity(project);
    expect(report.skipped.filter((line) => line.includes("연출"))).toEqual([]);
    for (const [skillId, chorId] of Object.entries(FS2_LANCE_SKILLS)) {
      const skill = project.database.skills.find((row) => row.id === skillId)!;
      expect(skill.retroChoreographyId).toBe(chorId);
      const layers = resolveRetroClassChoreography(skill, project.database.skillChoreographies)!.layers.map((layer) => layer.key);
      expect(layers.length).toBeGreaterThan(0);
      for (const sheet of KAEL_SWORD_SHEETS) expect(layers).not.toContain(sheet);
    }
  });

  it("star finishers burst with heavy weight; mark icons resolve to bundled files", () => {
    const project = fallenLike();
    applyFallenHeroSkillIdentity(project);
    for (const chorId of Object.values(FS_STAR_FINISHER_SKILLS)) {
      expect(project.database.skillChoreographies!.find((row) => row.id === chorId)?.weight).toBe("heavy");
    }
    for (const id of FS_STAR_MARK_STATES) {
      const state = project.database.states.find((row) => row.id === id)!;
      expect(resolveAssetResourceUrl(state.iconResourceId, { project })).toBeTruthy();
    }
  });

  it("in battle, single slashes climb the mark I→II→III and a finisher bursts it for +25/+50/+75%", () => {
    const project = fallenLike();
    applyFallenHeroSkillIdentity(project);
    project.system.battleModel = "rm2k3";
    const actor = project.database.actors[0]!;
    const enemy = project.database.enemies[0]!;
    const troop = project.database.troops.find((row) => row.id === project.system.initialTroopId) ?? project.database.troops[0]!;
    troop.enemyIds = [enemy.id];
    troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
    troop.battleEventPages = [];
    actor.initialEquipment = {};
    actor.parameterCurves.maxHp = Array(99).fill(500);
    actor.parameterCurves.agility = Array(99).fill(999);
    enemy.stats = { ...enemy.stats, maxHp: 99999, attack: 1, defense: 20, mind: 20, agility: 1 };
    enemy.actions = [];
    const slash = FS_STAR_MARK_SLASHES[0];
    const finisher = FS_STAR_MARK_FINISHERS[0];
    const mark = project.database.skills.find((row) => row.id === slash) as SkillRecord;
    mark.damageFormula = "1";
    const run = (marks: number) => {
      const runtime = createBattleRuntime({
        project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
        party: { levels: { [actor.id]: 1 }, experience: {}, partyActorIds: [actor.id], skillIds: { [actor.id]: [slash, finisher] } },
      });
      for (let i = 0; i < marks; i += 1) runtime.performActorCommand({ kind: "skill", skillId: slash, targetEnemyId: "enemy-1" });
      const states = [...runtime.snapshot().enemies[0]!.stateIds];
      const before = runtime.snapshot().timeline.length;
      runtime.performActorCommand({ kind: "skill", skillId: finisher, targetEnemyId: "enemy-1" });
      const hit = runtime.snapshot().timeline.slice(before).find((entry) => entry.kind === "damage" && entry.targetId === "enemy-1");
      return { states, amount: hit?.amount ?? 0, after: runtime.snapshot().enemies[0]!.stateIds };
    };
    const zero = run(0);
    const tiers = [1, 2, 3, 4].map(run);
    expect(tiers[0]!.states).toContain(FS_STAR_MARK_STATES[0]);
    expect(tiers[1]!.states).toContain(FS_STAR_MARK_STATES[1]);
    expect(tiers[2]!.states).toContain(FS_STAR_MARK_STATES[2]);
    expect(tiers[3]!.states.filter((id) => (FS_STAR_MARK_STATES as readonly string[]).includes(id))).toEqual([FS_STAR_MARK_STATES[2]]);
    expect(tiers[0]!.amount / zero.amount).toBeCloseTo(1.25, 1);
    expect(tiers[1]!.amount / zero.amount).toBeCloseTo(1.5, 1);
    expect(tiers[2]!.amount / zero.amount).toBeCloseTo(1.75, 1);
    for (const row of tiers) expect(row.after.some((id) => (FS_STAR_MARK_STATES as readonly string[]).includes(id))).toBe(false);
  });

  it("gives each hero a hex flash colour pair", () => {
    const project = fallenLike();
    applyFallenHeroSkillIdentity(project);
    const hero = project.database.actors.find((row) => row.id === "actor_hero");
    if (hero) expect(hero.battleHitFlash).toEqual({ core: "#eef3f8", edge: "#ff8a2a" });
  });

  it("no two heroes share an edge hue family (fs-vqa-fix-all: Sarah read as Kael's orange)", () => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r!, g!, b!), min = Math.min(r!, g!, b!), d = max - min;
      if (d === 0) return 0;
      const h = max === r ? ((g! - b!) / d) % 6 : max === g ? (b! - r!) / d + 2 : (r! - g!) / d + 4;
      return (h * 60 + 360) % 360;
    };
    const edges = Object.values(FS_HIT_FLASH).map((flash) => hue(flash.edge));
    for (let i = 0; i < edges.length; i += 1) for (let j = i + 1; j < edges.length; j += 1) {
      const gap = Math.abs(edges[i]! - edges[j]!);
      expect(Math.min(gap, 360 - gap)).toBeGreaterThanOrEqual(25);
    }
  });
});
