import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleProject(): Project {
  return deserialize(JSON.stringify(battleFixture));
}

function heroMaxHpAtLevel(project: Project, level: number): number {
  return parameterValueAtLevel(normalizeActorRecord(project.database.actors[0]).parameterCurves.maxHp, level);
}

describe("battle runtime — 세션 레벨/바이탈 반영", () => {
  it("세션 액터 레벨이 있으면 그 레벨의 파라미터 곡선으로 능력치를 산출한다", () => {
    const project = battleProject();
    const leveled = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      party: { levels: { actor_hero: 40 }, experience: {} },
    });
    const actor = leveled.snapshot().actors[0];
    expect(actor?.maxHp).toBe(heroMaxHpAtLevel(project, 40));
    // 레벨업 전(레벨1) 능력치보다 확실히 높다.
    expect(actor?.maxHp).toBeGreaterThan(heroMaxHpAtLevel(project, 1));
  });

  it("세션 레벨이 없으면 DB initialLevel(레벨1)로 폴백한다", () => {
    const project = battleProject();
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
    // 회귀: fixture 주인공 레벨1 maxHp = 514.
    expect(runtime.snapshot().actors[0]?.maxHp).toBe(514);
    expect(runtime.snapshot().actors[0]?.maxHp).toBe(heroMaxHpAtLevel(project, 1));
  });

  it("세션 현재 바이탈(부상 상태)을 전투 진입 시 이어받되 현재 레벨 최대치로 클램프한다", () => {
    const project = battleProject();
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      party: { levels: { actor_hero: 40 }, experience: {}, vitals: { actor_hero: { hp: 12, mp: 3 } } },
    });
    const actor = runtime.snapshot().actors[0];
    // 필드에서 이어지는 부상 HP/MP 를 그대로 유지.
    expect(actor?.hp).toBe(12);
    expect(actor?.mp).toBe(3);
    expect(actor?.maxHp).toBe(heroMaxHpAtLevel(project, 40));
  });

  it("세션 바이탈이 현재 레벨 최대치를 넘으면 최대치로 잘린다", () => {
    const project = battleProject();
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      party: { levels: { actor_hero: 1 }, experience: {}, vitals: { actor_hero: { hp: 999_999, mp: 999_999 } } },
    });
    const actor = runtime.snapshot().actors[0];
    expect(actor?.hp).toBe(actor?.maxHp);
    expect(actor?.maxHp).toBe(514);
  });

  it("세션 파라미터 보정과 상태 이상을 전투 액터에 반영한다", () => {
    const project = battleProject();
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      party: {
        levels: { actor_hero: 1 },
        experience: {},
        paramBonuses: { actor_hero: { maxHp: 25, attack: 7 } },
        stateIds: { actor_hero: ["state_poison"] },
      },
    });
    const actor = runtime.snapshot().actors[0];
    expect(actor?.maxHp).toBe(heroMaxHpAtLevel(project, 1) + 25);
    expect(actor?.hp).toBe(actor?.maxHp);
    expect(actor?.stateIds).toEqual(["state_poison"]);
  });
});
