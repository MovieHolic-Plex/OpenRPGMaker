// 몬스터 파티 게임의 종 적은 종족+레벨 공식으로 싸우고, 액터 파티 기준 보스 하한을 받지 않는다(gen5 실측).
// 행동이 비면 그 레벨의 습득 기술을 넣는다. 빈 목록은 Struggle 만 쓰고, 포획본은 기술을 잃는다(gen6 경고 실측).
import { describe, expect, it } from "vitest";
import { enemyBattlers } from "@/battle/battleBattlers";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { runTool } from "@/editor/tools/toolRunner";
import { checkProgression } from "@/qa/gameCheck/progression";
import { monsterBattleStatsForSpecies, monsterSkillIdsAtLevel, monsterSpeciesById } from "@/project/monsterCollection";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent } from "@/project/types";

function monsterProject() {
  const project = createNewProjectSeed(newProjectChoiceById("monster-collect")!.packId, "적 척도");
  project.system.battleParty = "monsters";
  return project;
}

describe("upsert_enemy species scale", () => {
  it("replaces hand stats with the species formula at the enemy level", () => {
    const context = { project: monsterProject() };
    const speciesId = context.project.database.monsterSpecies![0]!.id;
    const result = runTool(context, "upsert_enemy", { enemy: { id: "enemy_wild_x", name: "야생 X", monsterResourceId: "generated-enemy-slime-01", speciesId, level: 4, stats: { maxHp: 30, attack: 12 } } });
    expect(result.ok, result.summary).toBe(true);
    const enemy = context.project.database.enemies.find((entry) => entry.id === "enemy_wild_x")!;
    const formula = monsterBattleStatsForSpecies(monsterSpeciesById(context.project, speciesId), 4, undefined);
    expect(enemy.stats.maxHp).toBe(formula.maxHp);
    expect(enemy.stats.attack).toBe(formula.attack);
  }, 60_000);

  it("does not lift a species boss to the actor-party threat floor", () => {
    const context = { project: monsterProject() };
    const speciesId = context.project.database.monsterSpecies![0]!.id;
    const result = runTool(context, "upsert_enemy", { role: "boss", enemy: { id: "enemy_gym_boss", name: "관장 몬스터", monsterResourceId: "generated-enemy-slime-01", speciesId, level: 12 } });
    expect(result.ok, result.summary).toBe(true);
    const enemy = context.project.database.enemies.find((entry) => entry.id === "enemy_gym_boss")!;
    expect(enemy.stats).toEqual(monsterBattleStatsForSpecies(monsterSpeciesById(context.project, speciesId), 12, undefined));
    expect(result.summary).not.toContain("보스 위협 하한");
  }, 60_000);

  it("leaves non-monster games alone", () => {
    const context = { project: createBlankProject() };
    const result = runTool(context, "upsert_enemy", { enemy: { id: "enemy_y", name: "Y", monsterResourceId: "generated-enemy-slime-01", stats: { maxHp: 30, attack: 12 } } });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.database.enemies.find((entry) => entry.id === "enemy_y")!.stats.maxHp).toBe(30);
  }, 60_000);

  it("fills an empty species enemy with the moves learned by that level", () => {
    const context = { project: monsterProject() };
    const speciesId = "species_leafling";
    const species = monsterSpeciesById(context.project, speciesId)!;
    const result = runTool(context, "upsert_enemy", {
      enemy: { id: "enemy_wild_x", name: "야생 X", monsterResourceId: "generated-enemy-leafling-01", speciesId, level: 4 },
    });
    expect(result.ok, result.summary).toBe(true);
    const enemy = context.project.database.enemies.find((entry) => entry.id === "enemy_wild_x")!;
    const learned = monsterSkillIdsAtLevel(species, 4);
    expect(learned.length).toBeGreaterThan(1);
    expect(enemy.skillIds).toEqual(learned);
    expect(enemy.actions.map((action) => action.skillId)).toEqual(learned);
    expect(monsterSkillIdsAtLevel(species, 1)).not.toEqual(learned);

    const again = runTool(context, "upsert_enemy", { enemy: { id: "enemy_wild_x", level: 4 } });
    expect(again.ok, again.summary).toBe(true);
    expect(context.project.database.enemies.find((entry) => entry.id === "enemy_wild_x")!.skillIds).toEqual(learned);
  }, 60_000);

  it("keeps an authored damaging moveset instead of appending the learnset", () => {
    const context = { project: monsterProject() };
    const result = runTool(context, "upsert_enemy", {
      enemy: {
        id: "enemy_custom",
        name: "맞춤",
        monsterResourceId: "generated-enemy-leafling-01",
        speciesId: "species_leafling",
        level: 4,
        actions: [{ skillId: "skill_fire", priority: 5, condition: { kind: "always" } }],
      },
    });
    expect(result.ok, result.summary).toBe(true);
    const enemy = context.project.database.enemies.find((entry) => entry.id === "enemy_custom")!;
    expect(enemy.skillIds).toEqual(["skill_fire"]);
  }, 60_000);

  it("battle battlers and the no-damage check use the learnset when the saved actions are still empty", () => {
    const context = { project: monsterProject() };
    const species = monsterSpeciesById(context.project, "species_leafling")!;
    runTool(context, "upsert_enemy", {
      enemy: { id: "enemy_wild_x", name: "야생 X", monsterResourceId: "generated-enemy-leafling-01", speciesId: species.id, level: 4 },
    });
    runTool(context, "upsert_troop", { troop: { id: "troop_wild_x", name: "야생", enemyIds: ["enemy_wild_x"] } });
    const enemy = context.project.database.enemies.find((entry) => entry.id === "enemy_wild_x")!;
    enemy.actions = [];
    enemy.skillIds = [];
    const troop = context.project.database.troops.find((entry) => entry.id === "troop_wild_x")!;
    expect(enemyBattlers(context.project, troop)[0]?.skillIds).toEqual(monsterSkillIdsAtLevel(species, 4));

    const map = context.project.maps[context.project.startMapId]!;
    map.events.push({
      id: "ev_test_battle",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [{ kind: "battleProcessing", troopId: "troop_wild_x" }],
    } as GameEvent);
    expect(checkProgression(context.project).some((finding) => finding.code === "enemy-no-damage" && finding.message.includes("enemy_wild_x"))).toBe(false);

    enemy.speciesId = undefined;
    expect(checkProgression(context.project).some((finding) => finding.code === "enemy-no-damage" && finding.message.includes("enemy_wild_x"))).toBe(true);
  }, 60_000);
});
