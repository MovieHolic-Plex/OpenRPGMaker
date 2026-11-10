import { describe, expect, it } from "vitest";
import { wellData } from "@/project/flagship/fallen/wellBeast";
import type { EnemyRecord, Project } from "@/project/types";

// 1막은 「다른 적은 관통상에 걸리지 않는다」로 모든 적에 관통상 E 를 건다(act1Finale.ts).
// 우물 보스의 upsert_enemy 가 stateRates 를 통째로 새로 써서 그 칸이 빠졌고,
// 돌진 찌르기 뒤 모든 마법이 3배가 되어 피해 숫자가 번개(약점)를 가리키지 못했다.

function wellEnemy(): EnemyRecord {
  const project = {
    switches: [], database: { skills: [], states: [], enemies: [], troops: [], equipment: [], actors: [] },
  } as unknown as Project;
  const exec = (p: Project, name: string, args: Record<string, unknown>) => {
    const db = p.database as unknown as Record<string, { id: string }[]>;
    const table = { upsert_state: "states", upsert_skill: "skills", upsert_enemy: "enemies", upsert_troop: "troops", upsert_equipment: "equipment" }[name];
    if (!table) throw new Error(`unexpected tool ${name}`);
    const row = Object.values(args)[0] as { id: string };
    const list = db[table]!;
    const i = list.findIndex((x) => x.id === row.id);
    if (i >= 0) list[i] = row; else list.push(row);
    return undefined;
  };
  wellData(project, exec);
  return project.database.enemies.find((e) => e.id === "enemy_fs2_well_beast")!;
}

describe("well boss keeps the act-1 pierce-wound immunity", () => {
  it("cannot take the pierce wound, so pierce-then-magic does not triple every spell", () => {
    expect(wellEnemy().stateRates?.state_fs_pierced).toBe("E");
  });
  it("keeps lightning as the weakness and halves dark", () => {
    expect(wellEnemy().elementRates).toMatchObject({ thunder: "A", dark: "D" });
  });
});
