import { describe, expect, it } from "vitest";
import { applyFallenTrashWeakness, FS_WEAKNESS_TRASH_HP, FS_WEAKNESS_TRASH_TROOPS } from "@/project/flagship/fallen/mobBalance";
import type { Project } from "@/project/types";

const enemy = (id: string, maxHp: number) => ({ id, stats: { maxHp }, elementRates: { fire: "A", sword: "B", water: "D", ice: "C" } });

function fixture(): Project {
  const trash = FS_WEAKNESS_TRASH_TROOPS[0]!;
  return {
    database: {
      enemies: [enemy("enemy_trash_only", 200), enemy("enemy_shared", 300), enemy("enemy_boss", 900)],
      troops: [
        { id: trash, enemyIds: ["enemy_trash_only", "enemy_shared"] },
        { id: "troop_fs_dragon", enemyIds: ["enemy_boss", "enemy_shared"] },
      ],
    },
  } as unknown as Project;
}

describe("applyFallenTrashWeakness", () => {
  it("upgrades B weaknesses to A and raises HP only for enemies that appear in trash troops alone", () => {
    const project = fixture();
    expect(applyFallenTrashWeakness(project).filter((w) => w.includes("적 없음"))).toEqual([]);
    const [trashOnly, shared, boss] = project.database.enemies;
    expect(trashOnly!.elementRates).toEqual({ fire: "A", sword: "A", water: "D", ice: "C" });
    expect(trashOnly!.stats.maxHp).toBe(Math.round(200 * FS_WEAKNESS_TRASH_HP));
    expect(shared!.elementRates.sword).toBe("B");
    expect(shared!.stats.maxHp).toBe(300);
    expect(boss!.elementRates.sword).toBe("B");
    expect(boss!.stats.maxHp).toBe(900);
  });

  it("keeps the knowledge-dependent and boss troops out of the list", () => {
    for (const id of ["troop_fs_wisps", "troop_fs2_ash_collector", "troop_fs_dragon", "troop_fs2_sarah", "troop_fs_valen_crash"]) {
      expect(FS_WEAKNESS_TRASH_TROOPS).not.toContain(id);
    }
  });
});
