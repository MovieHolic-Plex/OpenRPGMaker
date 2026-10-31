import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { pathCopy, repairPathTroop } from "@/ai/v2/pathBattleBudget";
import type { Project } from "@/project/types";

// 2026-10-31 script-ab sab-1031 던전 1회차(A·B 둘 다): 길 예산이 보스 무리를 사본으로 바꾸면서 반피 페이지의 enemyId 는 원본에 남아
// 보스 반피 대사가 끝내 안 떴다. 사본 무리는 자기 적 참조를 모두 사본 적으로 들고 가야 한다.
function bossProject(): Project {
  const p = createBlankProject() as Project;
  const troop = p.database.troops.find((t) => t.id === "troop_slime")!;
  troop.enemyIds = ["enemy_slime"];
  troop.members = [{ enemyId: "enemy_slime", x: 100, y: 100 }];
  troop.battleEventPages = [
    { id: "half", name: "반피", span: "battle", conditions: [{ kind: "enemyHpBelow", enemyId: "enemy_slime", percent: 50 }], commands: [{ kind: "showText", text: "아직이다!" } as never] },
    { id: "range", name: "구간", span: "battle", conditions: [{ kind: "enemyHp", enemyId: "enemy_slime", minPercent: 0, maxPercent: 30 }, { kind: "enemiesAlive", enemyId: "enemy_slime", atMost: 0 }], commands: [] },
  ];
  troop.battleGuests = [{ actorId: "actor_hero", conditions: [{ kind: "enemyTurn", enemyId: "enemy_slime", turn: 2 }] }];
  return p;
}

describe("pathCopy remaps the enemy ids its troop pages reference", () => {
  it("points battle-event page, guest conditions at the copied enemy", () => {
    const p = bossProject();
    const copyId = pathCopy(p, "troop_slime")!;
    const copy = p.database.troops.find((t) => t.id === copyId)!;
    const copiedEnemy = copy.enemyIds[0]!;
    expect(copiedEnemy).toMatch(/^enemy_path_/u);
    expect(p.database.enemies.some((e) => e.id === copiedEnemy)).toBe(true);
    const ids = JSON.stringify([copy.battleEventPages, copy.battleGuests]);
    expect(ids).not.toContain('"enemy_slime"');
    expect((copy.battleEventPages[0]!.conditions[0] as { enemyId: string }).enemyId).toBe(copiedEnemy);
    expect((copy.battleEventPages[1]!.conditions[1] as { enemyId: string }).enemyId).toBe(copiedEnemy);
    expect((copy.battleGuests![0]!.conditions[0] as { enemyId: string }).enemyId).toBe(copiedEnemy);
    // 원본 무리는 그대로.
    const source = p.database.troops.find((t) => t.id === "troop_slime")!;
    expect((source.battleEventPages[0]!.conditions[0] as { enemyId: string }).enemyId).toBe("enemy_slime");
  });

  it("repairs a copy made before the fix, and is idempotent", () => {
    const p = bossProject();
    const copyId = pathCopy(p, "troop_slime")!;
    const copy = p.database.troops.find((t) => t.id === copyId)!;
    const copiedEnemy = copy.enemyIds[0]!;
    // 옛 사본처럼 원본 id 로 되돌린다.
    (copy.battleEventPages[0]!.conditions[0] as { enemyId: string }).enemyId = "enemy_slime";
    repairPathTroop(p, copy);
    expect((copy.battleEventPages[0]!.conditions[0] as { enemyId: string }).enemyId).toBe(copiedEnemy);
    const once = JSON.stringify(copy);
    repairPathTroop(p, copy);
    expect(JSON.stringify(copy)).toBe(once);
    expect(pathCopy(p, "troop_slime")).toBe(copyId);
  });
});
