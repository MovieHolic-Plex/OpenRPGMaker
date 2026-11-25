import { describe, expect, it } from "vitest";
import { applyFallenTraitPilot, FS_TRAIT_PILOT, applyFallenTrashWeakness, FS_WEAKNESS_TRASH_HP, FS_WEAKNESS_TRASH_TROOPS } from "@/project/flagship/fallen/mobBalance";
import type { Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("fallenTraitPilot", () => {
  isolateTimers();
  const rates = () => ({ sword: "C", spear: "C", bow: "C", hit: "C", fire: "C", ice: "C", water: "B", thunder: "C" });
  function fixture(): Project {
    return {
      database: {
        enemies: [
          ...Object.keys(FS_TRAIT_PILOT).map((id) => ({ id, stats: { maxHp: 1000 }, elementRates: rates() })),
          { id: "enemy_fs2_frost_bat_t_fs2_tower_bats", stats: { maxHp: 350 }, elementRates: rates() },
        ],
        troops: [],
      },
    } as unknown as Project;
  }
  describe("applyFallenTraitPilot", () => {
    it("makes every pilot enemy immune to weapons, gives it its one weakness, and scales its HP", () => {
      const project = fixture();
      expect(applyFallenTraitPilot(project)).toEqual([]);
      const byId = new Map(project.database.enemies.map((e) => [e.id, e]));
      for (const [id, trait] of Object.entries(FS_TRAIT_PILOT)) {
        const enemy = byId.get(id)!;
        expect(enemy.elementRates).toMatchObject({ sword: "E", spear: "E", bow: "E", ...trait.rates });
        expect(Object.values(trait.rates).filter((grade) => grade === "A")).toHaveLength(1);
        expect(enemy.stats.maxHp).toBe(Math.round(1000 * trait.hp));
      }
      expect(byId.get("enemy_fs2_frost_bat_t_fs2_frost_bats")!.elementRates.fire).toBe("A");
      const other = byId.get("enemy_fs2_frost_bat_t_fs2_tower_bats")!;
      expect(other.elementRates.sword).toBe("C");
      expect(other.stats.maxHp).toBe(350);
    });

    it("warns instead of throwing when a pilot enemy is missing", () => {
      const project = { database: { enemies: [], troops: [] } } as unknown as Project;
      expect(applyFallenTraitPilot(project)).toHaveLength(Object.keys(FS_TRAIT_PILOT).length);
    });
  });
});

describe("fallenTrashWeakness", () => {
  isolateTimers();
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
});
