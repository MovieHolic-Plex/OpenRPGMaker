import { describe, expect, it } from "vitest";
import { damageTypeMultiplier } from "@/battle/battleElementModifiers";
import type { EnemyRecord, Project, StateRecord } from "@/project/types";
import { loadBattleFixture } from "./fixtures/battleFixtureLoadable";

// 받는 피해 계열(물리·마법) — 적 기본값과 상태 덮어쓰기(2026-10-24, 폴른 스타 「달비늘 용」·「관통상」).

function project(): Project {
  const p = loadBattleFixture();
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

describe("damageTypeMultiplier — 속성 예외(elements)", () => {
  function machine(): Project {
    const p = project();
    const template = p.database.enemies[0]!;
    p.database.enemies.push({ ...template, id: "enemy_machine", name: "기계", damageTypeRates: { physical: 0, magic: 25, elements: { thunder: 200 } } } as EnemyRecord);
    p.database.states.push({ id: "state_machine", name: "기계 형태", runtimeEffects: { damageTypeRates: { physical: 0, magic: 25, elements: { thunder: 200 } } } } as StateRecord);
    return p;
  }

  it("적 기본값: 속성 예외가 계열 값을 대신한다(번개는 물리든 마법이든 2배)", () => {
    const p = machine();
    expect(damageTypeMultiplier(p, "physical", target("enemy_machine"))).toBe(0);
    expect(damageTypeMultiplier(p, "magic", target("enemy_machine"), "fire")).toBe(0.25);
    expect(damageTypeMultiplier(p, "magic", target("enemy_machine"), "thunder")).toBe(2);
    expect(damageTypeMultiplier(p, "physical", target("enemy_machine"), "thunder")).toBe(2);
  });

  it("상태가 출처째로 갈아 끼운다 — 마법 무효 적도 기계 형태 상태 동안은 번개 2배·물리 0", () => {
    const p = machine();
    expect(damageTypeMultiplier(p, "magic", target("enemy_scaled", ["state_machine"]), "thunder")).toBe(2);
    expect(damageTypeMultiplier(p, "physical", target("enemy_scaled", ["state_machine"]))).toBe(0);
    expect(damageTypeMultiplier(p, "magic", target("enemy_scaled", ["state_machine"]), "ice")).toBe(0.25);
  });

  it("상태가 그 타격을 정하지 않으면 적 기본값(속성 예외 포함)으로 내려간다", () => {
    const p = machine();
    // 관통상은 마법만 정한다 — 물리 번개 타격은 적 기본값의 번개 예외 200 을 쓴다.
    expect(damageTypeMultiplier(p, "physical", target("enemy_machine", ["state_pierced"]), "thunder")).toBe(2);
    // 마법 번개는 상태(마법 300)가 이긴다.
    expect(damageTypeMultiplier(p, "magic", target("enemy_machine", ["state_pierced"]), "thunder")).toBe(3);
  });
});
