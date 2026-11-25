import { describe, expect, it } from "vitest";
import { FS2_PIERCE_IMMUNE, letAct2PierceWoundLand } from "@/project/flagship/fallen/act2Opening";
import type { EnemyRecord, Project } from "@/project/types";

const E = { state_fs_pierced: "E" };

function project(): Project {
  const enemy = (id: string, stateRates: Record<string, string>): EnemyRecord => ({ id, name: id, stateRates } as unknown as EnemyRecord);
  return {
    database: {
      enemies: [
        enemy("enemy_fs2_frost_wolf_t_fs2_frost_wolves", { ...E }),
        enemy("enemy_fs2_elite_frostmane", { ...E, state_fs_elite_aura: "A" }),
        ...FS2_PIERCE_IMMUNE.map((id) => enemy(id, { ...E })),
        enemy("enemy_fs_moon_dragon", { state_fs_pierced: "A" }),
        enemy("enemy_fs_wolf", { ...E }),
      ],
    },
  } as unknown as Project;
}

const rate = (p: Project, id: string) => (p.database.enemies.find((e) => e.id === id)!.stateRates as Record<string, string>).state_fs_pierced;

describe("Sarah's pierce wound lands on ordinary act-2 enemies (fs-vqa-fix-all)", () => {
  it("clears the inherited immunity only on ordinary act-2 enemies", () => {
    const p = project();
    expect(letAct2PierceWoundLand(p)).toEqual(["enemy_fs2_frost_wolf_t_fs2_frost_wolves"]);
    expect(rate(p, "enemy_fs2_frost_wolf_t_fs2_frost_wolves")).toBeUndefined();
  });
  it("keeps the well boss, duel, collector and elites immune and the act-1 dragon and wolves as authored", () => {
    const p = project();
    letAct2PierceWoundLand(p);
    for (const id of [...FS2_PIERCE_IMMUNE, "enemy_fs2_elite_frostmane", "enemy_fs_wolf"]) expect(rate(p, id)).toBe("E");
    expect(rate(p, "enemy_fs_moon_dragon")).toBe("A");
  });
});
