import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import contactBounds from "@/assets/battleContactBounds.json";
import { actorBattlers, battlerSnapshot, refreshActorBattlerDerivedStats } from "@/battle/battleBattlers";
import { actorBattleSheetForEquipment } from "@/battle/battleWeaponSheet";
import { normalizeWeaponBattleSheets } from "@/project/actorModel";
import { normalizeEquipmentRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults/blankProject";
import { FS_WEAPON_BATTLE_SHEETS, applyFallenHeroSkillIdentity, FS2_LANCE_SKILLS, FS_HIT_FLASH, FS_KAEL_STAR_SLASH, FS_STAR_FINISHER_SKILLS, FS_STAR_MARK_FINISHERS, FS_STAR_MARK_SLASHES, FS_STAR_MARK_STATES } from "@/project/flagship/fallen/heroSkillIdentity";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import type { Project, SkillRecord } from "@/project/types";
import { resolveRetroClassChoreography } from "@/assets/retroSkillCatalog";
import { createBattleRuntime } from "@/battle/runtime";
import { isolateTimers } from "./mergedTeardown";

describe("battleWeaponSheet", () => {
  isolateTimers();
  // 장비한 무기의 계열(attackElementIds)로 전투 시트를 고른다 — 「창을 든 카엘은 창 자세로 선다」(2026-11-15 폴른 스타 QA 9번).
  // 표는 게임 자료(ActorRecord.weaponBattleSheets)가 정하고, 표가 없거나 그 계열이 없으면 지금 시트 그대로다.
  const BASE = "charset-battler-actor1-0";
  const SPEAR = "charset-battler-actor1-0-spear";
  function projectWithTable(): { project: Project; actorId: string } {
    const project = createBlankProject();
    const actor = project.database.actors[0]!;
    project.database.equipment.push(
      normalizeEquipmentRecord({ id: "equip_t_spear", name: "시험 창", slot: "weapon", attackElementIds: ["spear"] }),
      normalizeEquipmentRecord({ id: "equip_t_sword", name: "시험 검", slot: "weapon", attackElementIds: ["sword"] }),
      normalizeEquipmentRecord({ id: "equip_t_plain", name: "계열 없는 막대", slot: "weapon" }),
      normalizeEquipmentRecord({ id: "equip_t_glaive", name: "베는 창", slot: "weapon", attackElementIds: ["sword", "spear"] }),
    );
    actor.battleCharacterResourceId = BASE;
    actor.weaponBattleSheets = { spear: SPEAR };
    return { project, actorId: actor.id };
  }
  function sheetWith(project: Project, actorId: string, weapon: string | undefined): string | undefined {
    return actorBattlers(project, { partyActorIds: [actorId], equipment: { [actorId]: weapon ? { weapon } : {} } })[0]!.battleCharacterResourceId;
  }
  describe("무기 계열로 전투 시트 고르기", () => {
    it("표에 있는 계열의 무기를 들면 그 시트, 아니면 지금 시트 그대로", () => {
      const { project, actorId } = projectWithTable();
      expect(sheetWith(project, actorId, "equip_t_spear")).toBe(SPEAR);
      expect(sheetWith(project, actorId, "equip_t_sword")).toBe(BASE);
      expect(sheetWith(project, actorId, "equip_t_plain")).toBe(BASE);
      // 계열이 둘이면 표에 있는 첫 계열을 쓴다.
      expect(sheetWith(project, actorId, "equip_t_glaive")).toBe(SPEAR);
    });

    it("표가 없는 배우는 무엇을 들어도 시트가 바뀌지 않는다", () => {
      const { project, actorId } = projectWithTable();
      delete project.database.actors[0]!.weaponBattleSheets;
      expect(sheetWith(project, actorId, "equip_t_spear")).toBe(BASE);
      expect(sheetWith(project, actorId, "equip_t_sword")).toBe(BASE);
    });

    it("무기가 없거나 자료에 없는 무기면 지금 시트 그대로", () => {
      const { project } = projectWithTable();
      const actor = project.database.actors[0]!;
      expect(actorBattleSheetForEquipment(project, actor, undefined)).toBe(BASE);
      expect(actorBattleSheetForEquipment(project, actor, {})).toBe(BASE);
      expect(actorBattleSheetForEquipment(project, actor, { weapon: "equip_missing" })).toBe(BASE);
    });

    it("전투 중 무기를 바꾸면 그 배틀러의 시트를 다시 고르고 스냅숏에 실린다", () => {
      const { project, actorId } = projectWithTable();
      const battler = actorBattlers(project, { partyActorIds: [actorId], equipment: { [actorId]: { weapon: "equip_t_sword" } } })[0]!;
      expect(battlerSnapshot(battler).battleCharacterResourceId).toBe(BASE);
      refreshActorBattlerDerivedStats(project, battler, { equipment: { weapon: "equip_t_spear" } });
      expect(battlerSnapshot(battler).battleCharacterResourceId).toBe(SPEAR);
      refreshActorBattlerDerivedStats(project, battler, { equipment: { weapon: "equip_t_sword" } });
      expect(battlerSnapshot(battler).battleCharacterResourceId).toBe(BASE);
      refreshActorBattlerDerivedStats(project, battler, { equipment: {} });
      expect(battlerSnapshot(battler).battleCharacterResourceId).toBe(BASE);
    });

    it("저장·불러오기: 표는 프로젝트에 남고, 시트는 저장하지 않고 세션 장비로 그때그때 고른다", () => {
      const { project, actorId } = projectWithTable();
      const loaded = deserialize(serialize(project));
      expect(loaded.database.actors[0]!.weaponBattleSheets).toEqual({ spear: SPEAR });
      const session = startSession(loaded);
      session.actorEquipment = { ...session.actorEquipment, [actorId]: { ...session.actorEquipment?.[actorId], weapon: "equip_t_spear" } };
      const saved = JSON.parse(JSON.stringify(session)) as typeof session;
      expect(JSON.stringify(saved)).not.toContain(SPEAR);
      const battler = actorBattlers(loaded, { partyActorIds: [actorId], equipment: saved.actorEquipment })[0]!;
      expect(battler.battleCharacterResourceId).toBe(SPEAR);
    });

    it("표 정규화: 빈 칸은 버리고, 줄이 없으면 표를 두지 않는다", () => {
      expect(normalizeWeaponBattleSheets({ " spear ": " sheet-a ", bow: "", "": "sheet-b", axe: 3 })).toEqual({ spear: "sheet-a" });
      expect(normalizeWeaponBattleSheets({})).toBeUndefined();
      expect(normalizeWeaponBattleSheets(undefined)).toBeUndefined();
      expect(normalizeWeaponBattleSheets(["spear"])).toBeUndefined();
    });
  });
  describe("폴른 스타 · 창을 든 카엘", () => {
    it("카엘만 창 시트 표를 갖는다 — 다른 인물은 그대로", () => {
      const project = createBlankProject();
      const before = project.database.actors.map((actor) => [actor.id, actor.battleCharacterResourceId]);
      const report = applyFallenHeroSkillIdentity(project);
      expect(Object.keys(FS_WEAPON_BATTLE_SHEETS)).toEqual(["actor_hero"]);
      expect(report.applied.some((line) => line.startsWith("무기 시트 "))).toBe(true);
      const withTable = project.database.actors.filter((actor) => actor.weaponBattleSheets);
      expect(withTable.map((actor) => actor.id)).toEqual(["actor_hero"]);
      expect(withTable[0]!.weaponBattleSheets).toEqual({ spear: SPEAR });
      // 기본 시트(battleCharacterResourceId)는 누구도 바뀌지 않는다.
      expect(project.database.actors.map((actor) => [actor.id, actor.battleCharacterResourceId])).toEqual(before);
    });

    it("창 시트와 창 캐스트 시트가 묶음에 있고 주소로 풀린다, 접촉 치수도 있다", () => {
      const project = createBlankProject();
      expect(resolveAssetResourceUrl(SPEAR, { project })).toBe("/assets/generated/charset-battlers/actor1-0-spear.png");
      expect(existsSync(resolve(process.cwd(), "public/assets/generated/charset-battlers/actor1-0-spear.png"))).toBe(true);
      expect(existsSync(resolve(process.cwd(), "public/assets/generated/charset-battlers/cast/actor1-0-spear.png"))).toBe(true);
      expect(Object.keys(contactBounds as Record<string, unknown>)).toContain("assets/generated/charset-battlers/actor1-0-spear.png");
    });
  });
});

describe("fallenHeroSkillIdentity", () => {
  isolateTimers();
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

    it("only Kael's own slash carves the star mark; the shared skill_sword_slash enemies use does not (fs-vqa-fix-all)", () => {
      const project = fallenLike();
      applyFallenHeroSkillIdentity(project);
      const shared = project.database.skills.find((row) => row.id === "skill_sword_slash")!;
      const kael = project.database.skills.find((row) => row.id === FS_KAEL_STAR_SLASH)!;
      const marks = (skill: SkillRecord) => (skill.stateEffects ?? []).filter((row) => (FS_STAR_MARK_STATES as readonly string[]).includes(row.stateId));
      expect(marks(shared)).toEqual([]);
      expect(shared.description).not.toContain("별 표식");
      expect(marks(kael)).toHaveLength(1);
      expect(kael.name).toBe(shared.name);
      expect(kael.animationId).toBe(shared.animationId);
      const hero = project.database.classes.find((row) => row.id === "class_hero")!;
      expect(hero.learnedSkills.map((row) => row.skillId)).toContain(FS_KAEL_STAR_SLASH);
      expect(hero.learnedSkills.map((row) => row.skillId)).not.toContain("skill_sword_slash");
      expect(hero.skillIds).not.toContain("skill_sword_slash");

      // 실전: 적이 공용 검격으로 아군을 베어도 표식이 생기지 않는다.
      project.system.battleModel = "rm2k3";
      const actor = project.database.actors[0]!;
      const enemy = project.database.enemies[0]!;
      const troop = project.database.troops.find((row) => row.id === project.system.initialTroopId) ?? project.database.troops[0]!;
      troop.enemyIds = [enemy.id];
      troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
      troop.battleEventPages = [];
      actor.initialEquipment = {};
      actor.parameterCurves.maxHp = Array(99).fill(9999);
      actor.parameterCurves.agility = Array(99).fill(1);
      enemy.stats = { ...enemy.stats, maxHp: 99999, attack: 1, agility: 999 };
      enemy.actions = [{ skillId: "skill_sword_slash", priority: 9, condition: { kind: "always" } } as never];
      shared.damageFormula = "1";
      const runtime = createBattleRuntime({
        project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
        party: { levels: { [actor.id]: 1 }, experience: {}, partyActorIds: [actor.id], skillIds: { [actor.id]: ["skill_attack"] } },
      });
      for (let i = 0; i < 3; i += 1) runtime.performActorCommand({ kind: "defend" });
      const enemySlashed = runtime.snapshot().timeline.some((entry) => entry.side === "enemy" && entry.skillId === "skill_sword_slash");
      expect(enemySlashed).toBe(true);
      expect(runtime.snapshot().actors[0]!.stateIds.filter((id) => (FS_STAR_MARK_STATES as readonly string[]).includes(id))).toEqual([]);
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
});
