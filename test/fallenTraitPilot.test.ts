import { describe, expect, it } from "vitest";
import { applyFallenTraitPilot, FS_TRAIT_PILOT } from "@/project/flagship/fallen/mobBalance";
import type { Project } from "@/project/types";

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
