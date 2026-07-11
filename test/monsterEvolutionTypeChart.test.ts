import { describe, expect, it } from "vitest";
import { simulateBattle } from "@/battle/simulate";
import { typeChartMultiplierFor } from "@/battle/typeChart";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { totalExpForLevel } from "@/project/actorModel";
import { createBlankProject } from "@/project/defaults";
import { evolveMonster, giveMonster, monsterMaxHp } from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import type { Project } from "@/project/types";

function slime(project: Project) {
  const species = project.database.monsterSpecies?.find((record) => record.id === "species_wild_slime");
  if (!species) throw new Error("missing slime species");
  return species;
}

function heroLearns(project: Project, skillId: string): void {
  const hero = project.database.actors.find((record) => record.id === "actor_hero");
  if (!hero) throw new Error("missing hero");
  hero.learnedSkills = [...hero.learnedSkills, { level: 1, skillId }];
}

describe("monster evolution", () => {
  it("checks level, item consumption, and friendship requirements deterministically", () => {
    const levelProject = createBlankProject();
    const levelSession = startSession(levelProject, 1);
    const levelGift = giveMonster(levelProject, levelSession, { speciesId: "species_wild_slime", level: 7 });
    expect(levelGift.ok).toBe(true);
    const levelResult = evolveMonster(levelProject, levelSession, { instanceId: levelGift.ok ? levelGift.instance.instanceId : "" });
    expect(levelResult.ok && levelResult.toSpeciesId).toBe("species_king_slime");

    const itemProject = createBlankProject();
    slime(itemProject).evolutions = [{ toSpeciesId: "species_king_slime", requires: { itemId: "item_capture_orb" } }];
    const itemSession = startSession(itemProject, 2);
    itemSession.inventory.item_capture_orb = 1;
    const itemGift = giveMonster(itemProject, itemSession, { speciesId: "species_wild_slime", level: 3 });
    const itemResult = evolveMonster(itemProject, itemSession, { instanceId: itemGift.ok ? itemGift.instance.instanceId : "", allowItemEvolution: true });
    expect(itemResult.ok && itemResult.consumedItemId).toBe("item_capture_orb");
    expect(itemSession.inventory.item_capture_orb).toBe(0);

    const friendProject = createBlankProject();
    slime(friendProject).evolutions = [{ toSpeciesId: "species_king_slime", requires: { friendshipAtLeast: 200 } }];
    const friendSession = startSession(friendProject, 3);
    const friendGift = giveMonster(friendProject, friendSession, { speciesId: "species_wild_slime", level: 3, friendship: 220 });
    const friendResult = evolveMonster(friendProject, friendSession, { instanceId: friendGift.ok ? friendGift.instance.instanceId : "" });
    expect(friendResult.ok && friendResult.toSpeciesId).toBe("species_king_slime");
  });

  it("preserves nickname, HP ratio, level, and learns current-level skills on evolution", () => {
    const project = createBlankProject();
    const session = startSession(project, 4);
    const gift = giveMonster(project, session, {
      speciesId: "species_wild_slime",
      level: 7,
      nickname: "방울",
      ivs: { hp: 0, atk: 0, def: 0, spd: 0 },
    });
    if (!gift.ok) throw new Error("gift failed");
    session.monsterInstances[gift.instance.instanceId] = { ...gift.instance, currentHp: 9 };
    const result = evolveMonster(project, session, { instanceId: gift.instance.instanceId });
    expect(result.ok).toBe(true);
    const evolved = session.monsterInstances[gift.instance.instanceId];
    expect(evolved.speciesId).toBe("species_king_slime");
    expect(evolved.nickname).toBe("방울");
    expect(evolved.level).toBe(7);
    // 배치 1(레벨 스케일링) 반영: L7 maxHp 는 base(42)에 이차 보간이 얹혀 43,
    // 진화 시 HP 비율(9/19)을 보존해 currentHp 는 round(43×9/19)=20 이 된다.
    expect(evolved.currentHp).toBe(20);
    expect(monsterMaxHp(project, evolved)).toBe(43);
    expect(evolved.skillIds).toEqual(expect.arrayContaining(["skill_leaf", "skill_water"]));
  });

  it("auto-evolves after victory EXP raises the monster level", () => {
    const project = createBlankProject();
    const session = startSession(project, 5);
    const species = slime(project);
    const gift = giveMonster(project, session, { speciesId: species.id, level: 6 });
    if (!gift.ok) throw new Error("gift failed");
    session.monsterInstances[gift.instance.instanceId] = {
      ...gift.instance,
      level: 6,
      exp: totalExpForLevel(species.expCurve!, 7) - 1,
    };
    applyBattleRewardsToSession(session, { result: "victory", rewards: { exp: 1, gold: 0, items: [] } }, project);
    expect(session.monsterInstances[gift.instance.instanceId]?.level).toBe(7);
    expect(session.monsterInstances[gift.instance.instanceId]?.speciesId).toBe("species_king_slime");
  });

  it("runs failure branches for evolveMonster when requirements are not met", () => {
    const project = createBlankProject();
    slime(project).evolutions = [{ toSpeciesId: "species_king_slime", requires: { itemId: "item_capture_orb" } }];
    const session = startSession(project, 6);
    const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3 });
    const result = evolveMonster(project, session, { instanceId: gift.ok ? gift.instance.instanceId : "", allowItemEvolution: true });
    expect(result).toMatchObject({ ok: false, reason: "missingItem" });
  });
});

describe("type chart damage", () => {
  it("computes single, dual, STAB, immunity, and missing-chart multipliers", () => {
    const project = createBlankProject();
    expect(typeChartMultiplierFor(project, "fire", "actor_hero", "enemy_slime")).toBe(2);
    expect(typeChartMultiplierFor(project, "fire", "enemy_cave_bat", "enemy_slime")).toBe(3);
    expect(typeChartMultiplierFor(project, "fire", "actor_hero", "species_king_slime")).toBe(1);
    project.system.typeChart = {
      types: ["fire", "grass"],
      multipliers: { fire: { fire: 1, grass: 0 }, grass: { fire: 1, grass: 1 } },
    };
    expect(typeChartMultiplierFor(project, "fire", "actor_hero", "enemy_slime")).toBe(0);
    delete project.system.typeChart;
    expect(typeChartMultiplierFor(project, "fire", "enemy_cave_bat", "enemy_slime")).toBe(1);
  });

  it("simulateBattle reports higher favorable typed damage than unfavorable typed damage", () => {
    const favorable = createBlankProject();
    heroLearns(favorable, "skill_fire");
    const enemy = favorable.database.enemies.find((record) => record.id === "enemy_slime");
    if (enemy) enemy.stats = { ...enemy.stats, maxHp: 10000, defense: 1, attack: 1 };
    const fire = simulateBattle({
      project: favorable,
      troopId: "troop_slime",
      heroLevel: 1,
      battleFlow: "strict",
      n: 1,
      strictScript: [[{ actorId: "actor_hero", command: "skill", skillId: "skill_fire", target: "enemy-1" }]],
      maxSteps: 4,
    });

    const unfavorable = createBlankProject();
    heroLearns(unfavorable, "skill_water");
    const waterEnemy = unfavorable.database.enemies.find((record) => record.id === "enemy_slime");
    if (waterEnemy) waterEnemy.stats = { ...waterEnemy.stats, maxHp: 10000, defense: 1, attack: 1 };
    const water = simulateBattle({
      project: unfavorable,
      troopId: "troop_slime",
      heroLevel: 1,
      battleFlow: "strict",
      n: 1,
      strictScript: [[{ actorId: "actor_hero", command: "skill", skillId: "skill_water", target: "enemy-1" }]],
      maxSteps: 4,
    });

    const fireDamage = fire.roundLogs[0]?.actions.find((action) => action.side === "actor")?.amount ?? 0;
    const waterDamage = water.roundLogs[0]?.actions.find((action) => action.side === "actor")?.amount ?? 0;
    expect(fireDamage).toBeGreaterThan(waterDamage);
  });

  it("simulateBattle reward can drive level-up into automatic evolution", () => {
    const project = createBlankProject();
    const battle = simulateBattle({ project, troopId: "troop_slime", heroLevel: 99, battleFlow: "strict", n: 1, seed: 9, maxSteps: 10 });
    expect(battle.firstRewards?.exp).toBeGreaterThan(0);
    const session = startSession(project, 7);
    const species = slime(project);
    const gift = giveMonster(project, session, { speciesId: species.id, level: 6 });
    if (!gift.ok) throw new Error("gift failed");
    session.monsterInstances[gift.instance.instanceId] = {
      ...gift.instance,
      level: 6,
      exp: totalExpForLevel(species.expCurve!, 7) - (battle.firstRewards?.exp ?? 0),
    };
    applyBattleRewardsToSession(session, { result: "victory", rewards: battle.firstRewards ?? { exp: 0, gold: 0, items: [] } }, project);
    expect(session.monsterInstances[gift.instance.instanceId]?.speciesId).toBe("species_king_slime");
  });

  it("ships starter trio plus five wild species and the slime evolution demo fixture", () => {
    const project = createBlankProject();
    const ids = new Set((project.database.monsterSpecies ?? []).map((species) => species.id));
    expect(["species_leafling", "species_sparkit", "species_aqualing"]).toSatisfy((starterIds: string[]) =>
      starterIds.every((id) => ids.has(id))
    );
    expect(["species_wild_slime", "species_cave_bat", "species_stone_golem", "species_ember_drake", "species_forest_hornet"]).toSatisfy((wildIds: string[]) =>
      wildIds.every((id) => ids.has(id))
    );
    expect(slime(project).evolutions?.[0]).toMatchObject({ toSpeciesId: "species_king_slime", requires: { level: 7 } });
    expect(project.system.typeChart?.types).toEqual(["fire", "water", "grass"]);
  });
});

describe("monster type editor tools", () => {
  it("writes type charts and species type/evolution data through database tools", () => {
    const context: ToolContext = { project: createBlankProject() };
    const chartResult = runTool(context, "set_type_chart", {
      types: ["fire", "water", "grass"],
      multipliers: { fire: { water: 0.5, grass: 2 }, water: { fire: 2, grass: 0.5 }, grass: { fire: 0.5, water: 2 } },
    });
    expect(chartResult.ok, chartResult.summary).toBe(true);
    expect(context.project.system.typeChart).toEqual({
      types: ["fire", "water", "grass"],
      multipliers: {
        fire: { fire: 1, water: 0.5, grass: 2 },
        water: { fire: 2, water: 1, grass: 0.5 },
        grass: { fire: 0.5, water: 2, grass: 1 },
      },
    });

    const speciesResult = runTool(context, "define_monster_species", {
      species: {
        id: "species_tool_slime",
        name: "도구 슬라임",
        types: ["fire", "water", "grass"],
        evolutions: [{ toSpeciesId: "species_king_slime", requires: { level: 8, itemId: "item_capture_orb", friendshipAtLeast: 120 } }],
      },
    });
    expect(speciesResult.ok, speciesResult.summary).toBe(true);
    const species = context.project.database.monsterSpecies?.find((record) => record.id === "species_tool_slime");
    expect(species?.types).toEqual(["fire", "water"]);
    expect(species?.evolutions?.[0]).toMatchObject({
      toSpeciesId: "species_king_slime",
      requires: { level: 8, itemId: "item_capture_orb", friendshipAtLeast: 120 },
    });
  });
});
