import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { fitFirstLevelUp } from "@/ai/v2/story/pathBattleBudget";
import { totalExpForLevel } from "@/project/actorModel";
import type { Project } from "@/project/types";

// 2026-11-11 눈가림 플레이(fun-x1-gatefix): «EXP 677 을 얻어도 L1» — 기본 곡선은 Lv2 까지 678 인데 첫 길 전투가 108 이라(108/678 < 1/5) 곡선 맞추기가 손을 뗐다.
// 문서 openwiki/assistant-v2.md 「짧은 게임에서도 레벨이 오른다」.

describe("짧은 게임에서도 레벨이 오른다", () => {
  it("길 위 경험치를 알면 첫 전투 경험치가 작아도 곡선을 맞춘다(길을 다 이겨도 8레벨까지)", () => {
    const project = createBlankProject() as Project;
    const hero = project.database.actors[0]!;
    project.system.startActorIds = [hero.id];
    const troop = project.database.troops.find((t) => t.id === "troop_slime")!;
    const enemy = project.database.enemies.find((e) => e.id === troop.enemyIds[0])!;
    enemy.rewards = { ...enemy.rewards, exp: 108 };
    // 길 위 경험치를 모르는 호출은 그 전투 하나를 길로 본다 — 108/678 < 1/5 라 손을 떼던 자리.
    expect(fitFirstLevelUp(structuredClone(project), troop.id, { ids: [hero.id], level: 1 })).toHaveLength(1);
    expect(fitFirstLevelUp(project, troop.id, { ids: [hero.id], level: 1 }, 785)).toHaveLength(1);
    const curve = hero.expCurve!;
    expect(totalExpForLevel(curve, 2)).toBeLessThanOrEqual(108);
    expect(totalExpForLevel(curve, 3)).toBeLessThanOrEqual(785);
    expect(totalExpForLevel(curve, 10)).toBeGreaterThan(785);
  });
});
