// 몬스터 파티 게임의 종 적은 종족+레벨 공식으로 싸우고, 액터 파티 기준 보스 하한을 받지 않는다(gen5 실측).
import { describe, expect, it } from "vitest";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { runTool } from "@/editor/tools/toolRunner";
import { monsterBattleStatsForSpecies, monsterSpeciesById } from "@/project/monsterCollection";
import { createBlankProject } from "@/project/defaults";

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
});
