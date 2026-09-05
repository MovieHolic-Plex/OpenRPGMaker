import { describe, expect, it } from "vitest";
import { prepareEnemyBattleTest } from "@/editor/enemyBattleTest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";

describe("selected-enemy battle sandbox", () => {
  it("runs the current enemy stats with no authored troop and isolates all test changes", () => {
    const project = deserialize(JSON.stringify(battleFixture));
    const enemy = project.database.enemies[0];
    enemy.stats.maxHp = 321;
    project.database.troops = [];
    const before = JSON.stringify(project);
    const prepared = prepareEnemyBattleTest(project, enemy.id)!;
    const runtime = createBattleRuntime({ ...prepared, canEscape: true, canLose: true, rng: () => 0.5 });
    expect(runtime.snapshot().enemies).toHaveLength(1);
    expect(runtime.snapshot().enemies[0].hp).toBe(321);
    prepared.project.database.enemies[0].stats.maxHp = 999;
    runtime.tick(1000);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("does not overwrite a same-named authored troop or guess a deleted enemy", () => {
    const project = deserialize(JSON.stringify(battleFixture));
    project.database.troops[0].id = "editor-enemy-test";
    const prepared = prepareEnemyBattleTest(project, project.database.enemies[0].id)!;
    expect(prepared.troopId).not.toBe("editor-enemy-test");
    expect(prepared.project.database.troops[0]).toEqual(project.database.troops[0]);
    expect(prepareEnemyBattleTest(project, "deleted-enemy")).toBeUndefined();
  });
});
