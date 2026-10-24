import { describe, expect, it } from "vitest";
import { damageTypeMultiplier } from "@/battle/battleElementModifiers";
import { deserialize } from "@/project/io";
import type { EnemyRecord, Project, StateRecord } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

// 받는 피해 계열(물리·마법) — 적 기본값과 상태 덮어쓰기(2026-10-24, 폴른 스타 「달비늘 용」·「관통상」).

function project(): Project {
  const p = deserialize(JSON.stringify(battleFixture));
  const template = p.database.enemies[0]!;
  p.database.enemies.push({ ...template, id: "enemy_scaled", name: "비늘 짐승", damageTypeRates: { magic: 0 } } as EnemyRecord);
  p.database.states.push({ id: "state_pierced", name: "관통상", runtimeEffects: { damageTypeRates: { magic: 300 } } } as StateRecord);
  return p;
}
const target = (recordId: string, stateIds: string[] = []) => ({ recordId, stateIds }) as never;

describe("damageTypeMultiplier", () => {
  it("적 기본값: 마법 0% 는 0배, 적지 않은 계열은 1배", () => {
    const p = project();
    expect(damageTypeMultiplier(p, "magic", target("enemy_scaled"))).toBe(0);
    expect(damageTypeMultiplier(p, "physical", target("enemy_scaled"))).toBe(1);
  });

  it("상태의 계열 비율은 기본값을 갈아 끼운다(관통상 → 마법 3배)", () => {
    const p = project();
    expect(damageTypeMultiplier(p, "magic", target("enemy_scaled", ["state_pierced"]))).toBe(3);
    expect(damageTypeMultiplier(p, "physical", target("enemy_scaled", ["state_pierced"]))).toBe(1);
  });

  it("값이 없는 적·배우는 1배", () => {
    const p = project();
    expect(damageTypeMultiplier(p, "magic", target("actor_unknown"))).toBe(1);
  });
});
