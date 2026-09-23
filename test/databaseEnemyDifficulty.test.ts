import { describe, expect, it } from "vitest";
import { classifyEnemyDifficulty, estimateEnemyDifficulty } from "@/editor/panels/databaseEnemyDifficulty";
import { createBlankProject } from "@/project/defaults";

describe("estimateEnemyDifficulty", () => {
  it("classifies win rate and remaining HP into three plain grades", () => {
    expect(classifyEnemyDifficulty(1, 0.9).grade).toBe("easy");
    expect(classifyEnemyDifficulty(0.8, 0.9).grade).toBe("normal");
    expect(classifyEnemyDifficulty(1, 0.3).grade).toBe("normal");
    expect(classifyEnemyDifficulty(0.3, 0.1).grade).toBe("hard");
  });

  it("returns null when there is no starting party to fight with", () => {
    const project = createBlankProject();
    project.system.startActorIds = [];
    project.session.partyActorIds = [];
    expect(estimateEnemyDifficulty(project, project.database.enemies[0]!)).toBeNull();
  });

  it("runs the same headless battle simulator as the troop tab, without mutating the project", () => {
    const project = createBlankProject();
    const before = JSON.stringify(project.database.troops);
    const slime = estimateEnemyDifficulty(project, project.database.enemies[0]!);
    expect(JSON.stringify(project.database.troops)).toBe(before);
    expect(slime?.partyLevel).toBe(project.database.enemies[0]!.level ?? 1);
    expect(slime?.samples).toBeGreaterThan(0);
    const weakest = { ...project.database.enemies[0]!, stats: { ...project.database.enemies[0]!.stats, maxHp: 1, attack: 1 } };
    const strongest = { ...weakest, stats: { ...weakest.stats, maxHp: 99999, attack: 999, defense: 999 } };
    expect(estimateEnemyDifficulty(project, weakest)?.grade).toBe("easy");
    expect(estimateEnemyDifficulty(project, strongest)?.grade).toBe("hard");
  });
});
