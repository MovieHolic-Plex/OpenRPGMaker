// Gen1 상태 저작 계약 — 포켓몬 데모 DB 전용.
//  (1) 화상/독의 턴당 피해가 Gen1 의 1/16 과 값이 같다: floor(maxHp × 6.25 / 100) ≡ floor(maxHp / 16).
//  (2) 전역 기본 DB(RM2K3 프로젝트 공유)는 건드리지 않는다 — 독 6% 계약(battleStates.test.ts) 보존.
//  (3) 화상은 자연 회복이 없고 전투 종료로만 풀리며 공격을 반감한다.
//  (4) 불씨 뿜기 10% 화상 / 전광석화 우선도 +1 은 데모 저작 데이터에 실재한다.
import { describe, expect, it } from "vitest";
import {
  attackMultiplierForStates,
  clearBattleEndStates,
  runStateUpkeep,
  stateBehavior,
} from "@/battle/battleStates";
import type { MutableBattler } from "@/battle/battleBattlers";
import { createBlankProject, createScarloxyPokemonDemoProject } from "@/project/defaults";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import type { Project, StateRecord } from "@/project/types";

// 자연 회복 판정에 가장 유리한 rng — 화상이 안 풀리는 것은 확률 0 때문이어야 한다.
const luckiest: () => number = () => 0;

function stateRecord(project: Project, id: string): StateRecord {
  const record = project.database.states.find((entry) => entry.id === id);
  if (!record) throw new Error(`missing state ${id}`);
  return record;
}

function battler(maxHp: number, stateIds: readonly string[]): MutableBattler {
  return {
    id: "enemy-1",
    recordId: "enemy_pkmn_wild",
    name: "야생 몬스터",
    maxHp,
    maxMp: 10,
    attackPower: 30,
    defense: 20,
    mind: 10,
    agility: 10,
    chargeRate: 1,
    skillIds: [],
    hidden: false,
    hp: maxHp,
    mp: 10,
    gauge: 0,
    stateIds: [...stateIds],
    stateTurns: {},
    defending: false,
  };
}

describe("Gen1 데모 상태 — 화상/독", () => {
  it("화상은 공격 반감 + 턴당 6.25% + 전투 후 지속 + 자연 회복 없음으로 해석된다", () => {
    const behavior = stateBehavior(stateRecord(createScarloxyPokemonDemoProject(), "state_burn"));
    expect(behavior.attackMultiplier).toBe(0.5);
    expect(behavior.hpDamagePercentPerTurn).toBe(6.25);
    expect(behavior.removeOnBattleEnd).toBe(false);
    expect(behavior.restrictsAction).toBe(false);
    // Gen1 화상은 스스로 낫지 않는다 — 확률 0 이라 rng 가 아무리 좋아도 안 풀린다.
    expect(behavior.recoverNaturallyChance).toBe(0);
  });

  it("턴당 피해가 Gen1 1/16 과 값이 같다 (floor(maxHp/16), 최소 1)", () => {
    const project = createScarloxyPokemonDemoProject();
    // 16 의 배수/비배수, 6.25% 가 1 미만인 소형 HP 까지 — floor 경계 전부.
    for (const maxHp of [8, 16, 18, 31, 32, 46, 100]) {
      const burned = battler(maxHp, ["state_burn"]);
      const result = runStateUpkeep(project, burned, luckiest);
      const gen1Tick = Math.max(1, Math.floor(maxHp / 16));
      expect(result.hpDamage, `maxHp=${maxHp}`).toBe(gen1Tick);
      expect(burned.hp, `maxHp=${maxHp}`).toBe(maxHp - gen1Tick);
      // 확률 0 이라 자연 회복 판정을 통과하지 못한다.
      expect(result.removedStateIds, `maxHp=${maxHp}`).toHaveLength(0);
      expect(burned.stateIds).toContain("state_burn");
    }
  });

  it("데모 독은 6.25% 로 덮이고 전역 기본 DB 의 6% 는 그대로다", () => {
    expect(stateBehavior(stateRecord(createScarloxyPokemonDemoProject(), "state_poison")).hpDamagePercentPerTurn).toBe(6.25);
    // 전역 기본값을 오염시키면 RM2K3 프로젝트가 같이 바뀐다 — 여기서 잡는다.
    expect(stateBehavior(stateRecord(createBlankProject(), "state_poison")).hpDamagePercentPerTurn).toBe(6);
    // 독은 Gen1 처럼 전투 후에도 남는다(화상과 대비되는 지점).
    expect(stateBehavior(stateRecord(createScarloxyPokemonDemoProject(), "state_poison")).removeOnBattleEnd).toBe(false);
  });

  it("전투 종료 시 화상과 독이 모두 남는다", () => {
    const project = createScarloxyPokemonDemoProject();
    const target = battler(100, ["state_burn", "state_poison"]);
    clearBattleEndStates(project, target);
    expect(target.stateIds).toEqual(["state_burn", "state_poison"]);
  });

  it("화상 중 공격력이 절반이 된다", () => {
    const project = createScarloxyPokemonDemoProject();
    expect(attackMultiplierForStates(project, battler(100, []))).toBe(1);
    expect(attackMultiplierForStates(project, battler(100, ["state_burn"]))).toBe(0.5);
  });
});

describe("Gen1 데모 스킬 저작", () => {
  it("불씨 뿜기는 10% 확률로 화상을 건다", () => {
    const project = createScarloxyPokemonDemoProject();
    const ember = project.database.skills.find((record) => record.id === "skill_scarloxy_ember");
    expect(ember?.stateEffects).toEqual([{ stateId: "state_burn", chance: 10, operation: "add" }]);
    // 참조하는 상태가 같은 DB 에 실재해야 한다.
    expect(project.database.states.some((record) => record.id === "state_burn")).toBe(true);
  });

  it("전광석화는 우선도 +1 이고 스파르츄가 Lv5 에 배운다", () => {
    const project = createScarloxyPokemonDemoProject();
    const quick = project.database.skills.find((record) => record.id === "skill_scarloxy_quick");
    expect(quick?.movePriority).toBe(1);
    const sparchu = (project.database.monsterSpecies ?? []).find((record) => record.id === scarloxySpeciesId("sparchu"));
    expect(sparchu?.skillsByLevel).toEqual(
      expect.arrayContaining([{ level: 5, skillId: "skill_scarloxy_quick" }])
    );
  });
});
