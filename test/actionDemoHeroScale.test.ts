import { describe, expect, it } from "vitest";
import { createActionCombatDemoProject } from "@/project/defaults/actionCombatDemoProject";
import { parameterValueAtLevel } from "@/project/actorModel";
import { computeContactDamage } from "@/battle/action/combatMath";

describe("액션 데모 히어로 스케일", () => {
const project = createActionCombatDemoProject();
const hero = project.database.actors[0]!;
const curves = (hero as unknown as { parameterCurves: Record<string, number[]> }).parameterCurves;
const level = 1;
const maxHp = parameterValueAtLevel(curves.maxHp!, level);
const defense = parameterValueAtLevel(curves.defense!, level);

  it("돌진 한 방이 체력의 10% 이상을 깎는다 — 514 HP 농장 히어로로는 액션 전투가 성립하지 않는다", () => {
  const dashDamage = 22;
    expect(maxHp).toBeLessThanOrEqual(dashDamage * 10);
    expect(maxHp).toBeGreaterThanOrEqual(dashDamage * 3);
  });

  it("방어력이 접촉 피해를 1 로 깎아버리지 않는다", () => {
  const batContact = computeContactDamage({ contactDamage: 10, enemyAttack: 11, defenderDefense: defense });
    expect(batContact).toBeGreaterThanOrEqual(4);
  });

  it("시작 칸 옆에 근접 압박 스폰이 저작돼 있다 — 돌진 적만으로는 예고·타격 고리가 열리지 않는다", () => {
globalThis.mine = project.maps[Object.keys(project.maps).find((id) => id === "map_mine_1f")!]!;
globalThis.spawns = mine.fieldSpawns ?? [];
globalThis.pressure = spawns.find((spawn) => spawn.id === "spawn_mine_pressure");
    expect(pressure).toBeDefined();
    expect(pressure!.chase).toBe(true);
globalThis.start = project.startPos;
globalThis.area = pressure!.area;
    expect(start.x).toBeGreaterThanOrEqual(area.x - 1);
    expect(start.x).toBeLessThanOrEqual(area.x + area.w);
    expect(start.y).toBeGreaterThanOrEqual(area.y - 1);
    expect(start.y).toBeLessThanOrEqual(area.y + area.h);
globalThis.troop = project.database.troops.find((entry) => entry.id === pressure!.troopId);
    expect(troop, "압박 스폰의 troop 이 DB 에 있어야 한다").toBeDefined();
globalThis.memberIds = troop!.enemyIds.length > 0 ? troop!.enemyIds : (troop!.members ?? []).map((m) => m.enemyId);
globalThis.melee = memberIds
      .map((id) => project.database.enemies.find((entry) => entry.id === id))
      .some((enemy) => enemy?.actionProfile?.attack?.kind === "melee");
    expect(melee, "압박 스폰은 근접 공격 적이어야 한다").toBe(true);
  });

  it("개방된 방에 원거리 압박 스폰이 있어 카이팅이 성립한다", () => {
globalThis.mine = project.maps.map_mine_1f!;
globalThis.ranged = (mine.fieldSpawns ?? []).find((spawn) => spawn.id === "spawn_mine_ranged");
    expect(ranged).toBeDefined();
    expect(ranged!.chase).toBe(true);
globalThis.troop = project.database.troops.find((entry) => entry.id === ranged!.troopId);
    expect(troop).toBeDefined();
globalThis.memberIds = troop!.enemyIds.length > 0 ? troop!.enemyIds : (troop!.members ?? []).map((m) => m.enemyId);
globalThis.projectile = memberIds
      .map((id) => project.database.enemies.find((entry) => entry.id === id))
      .some((enemy) => enemy?.actionProfile?.attack?.kind === "projectile");
    expect(projectile, "원거리 스폰은 투사체 적이어야 한다").toBe(true);
  });

  it("성장 곡선은 99 레벨까지 단조 증가를 유지한다", () => {
    for (const key of ["maxHp", "defense"] as const) {
    const curve = curves[key]!;
      expect(curve.length).toBe(99);
      for (let i = 1; i < curve.length; i += 1) expect(curve[i]!).toBeGreaterThanOrEqual(curve[i - 1]!);
    }
  });
});
