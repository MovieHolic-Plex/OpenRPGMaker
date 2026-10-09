import { describe, expect, it } from "vitest";
import { battleEffectivenessMultiplier, battleElementMultiplier } from "@/battle/battleElementModifiers";
import { enemyActionDirectorState } from "@/player/battleDirectorDom";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import type { MonsterSpeciesRecord, Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";

// 포켓몬 3세대 resultmessage(「효과가 굉장했다!」·「효과가 별로인 듯하다…」)를 옮긴 상성 문장.
// 2026-10-02 조사: 문장은 방어 쪽 타입 배율만 본다 — 자속 보정(STAB)을 넣으면 물 몬스터의 물 기술이 늘 「굉장」이 된다.

function projectWithChart(): Project {
  const project = deserialize(JSON.stringify(battleFixture));
  project.system.typeChart = {
    types: ["fire", "grass", "water"],
    multipliers: {
      fire: { fire: 0.5, grass: 2, water: 0.5 },
      grass: { fire: 0.5, grass: 0.5, water: 2 },
      water: { fire: 2, grass: 0.5, water: 0.5 },
    },
  };
  project.database.monsterSpecies = [
    { id: "sp_water", types: ["water"] } as unknown as MonsterSpeciesRecord,
    { id: "sp_grass", types: ["grass"] } as unknown as MonsterSpeciesRecord,
  ];
  return project;
}

const battler = (recordId: string, speciesId: string) => ({ recordId, speciesId, stateIds: [] }) as never;

describe("상성 배율 — 문장용은 자속 보정을 뺀다", () => {
  it("물 몬스터의 물 기술: 피해 배율은 STAB 를 포함하고, 문장 배율은 방어 타입만 본다", () => {
    const project = projectWithChart();
    const water = battler("a", "sp_water");
    const grass = battler("b", "sp_grass");
    // 물 → 풀 0.5, 자속 1.5 → 피해 0.75. 문장은 0.5(별로).
    expect(battleElementMultiplier(project, "water", water, grass)).toBeCloseTo(0.75);
    expect(battleEffectivenessMultiplier(project, "water", grass)).toBeCloseTo(0.5);
    // 물 → 물 0.5 는 STAB 가 붙어도 문장은 0.5.
    expect(battleEffectivenessMultiplier(project, "water", water)).toBeCloseTo(0.5);
  });

  it("타입 표에 없는 속성·속성 없는 기술은 1(문장 없음)", () => {
    const project = projectWithChart();
    expect(battleEffectivenessMultiplier(project, "thunder", battler("b", "sp_grass"))).toBe(1);
    expect(battleEffectivenessMultiplier(project, undefined, battler("b", "sp_grass"))).toBe(1);
  });
});

describe("상성 문장", () => {
  const snapshot = () => createBattleRuntime({ project: deserialize(JSON.stringify(strictFixture)), troopId: "troop_strict_training", canEscape: false, canLose: true, rng: () => 0.5 }).snapshot();

  it("배율 > 1 은 「효과가 굉장했다!」, < 1 은 「효과가 별로인 듯하다…」, 없으면 붙지 않는다", () => {
    const before = snapshot();
    const entry = { userRecordId: "enemy_training_slime", targetId: before.actors[0].id, hit: true, amount: 10, critical: false };
    expect(enemyActionDirectorState({ ...entry, effectiveness: 2 }, before).lines.join(" ")).toContain("효과가 굉장했다!");
    expect(enemyActionDirectorState({ ...entry, effectiveness: 0.5 }, before).lines.join(" ")).toContain("효과가 별로인 듯하다…");
    expect(enemyActionDirectorState(entry, before).lines.join(" ")).not.toContain("효과가");
  });

  it("상성 문장이 있으면 결과 줄은 그 문장만 — 피해 숫자를 붙이면 메시지 창 한 줄을 넘는다", () => {
    const before = snapshot();
    const entry = { userRecordId: "enemy_training_slime", targetId: before.actors[0].id, hit: true, amount: 10, critical: false };
    expect(enemyActionDirectorState({ ...entry, effectiveness: 0.5 }, before).lines[1]).toBe("효과가 별로인 듯하다…");
    expect(enemyActionDirectorState({ ...entry, critical: true, effectiveness: 2 }, before).lines[1]).toBe("급소에 맞았다! 효과가 굉장했다!");
    expect(enemyActionDirectorState(entry, before).lines[1]).toContain("10 피해");
  });

  it("회복 문장에는 상성 문장을 붙이지 않는다", () => {
    const before = snapshot();
    const entry = { userRecordId: "enemy_training_slime", targetId: before.actors[0].id, hit: true, amount: 10, critical: false, effectiveness: 2 };
    expect(enemyActionDirectorState(entry, before, { resource: "hp", healing: true }).lines.join(" ")).not.toContain("효과가 굉장");
  });
});
