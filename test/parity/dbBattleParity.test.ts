// test/parity/dbBattleParity.test.ts
// Invariant: every assertion authors a value via the real editor mutator, then reads a seeded (deterministic) battle outcome.
import { describe, expect, it } from "vitest";
import type { SimulateBattleInput } from "@/battle/simulate";
import { DEFAULT_ENEMY_ID, DEFAULT_SKILL_ID, DEFAULT_TROOP_ID } from "@/project/defaults";
import { store } from "@/project/store";
import { addDatabaseRecord, battle, editorProject, updateDatabaseRecord } from "./parityRig";

const HERO = "actor_hero";
const SWORD = "equip_sword";

function script(command: string, extra: Record<string, unknown> = {}): SimulateBattleInput["strictScript"] {
  return [[{ actorId: HERO, command, target: "enemy-1", ...extra }]] as SimulateBattleInput["strictScript"];
}

function tankyEnemy(maxHp: number): void {
  const enemy = store.getCurrent().database.enemies.find((record) => record.id === DEFAULT_ENEMY_ID);
  if (enemy) updateDatabaseRecord("enemies", DEFAULT_ENEMY_ID, { stats: { ...enemy.stats, maxHp, attack: 1, agility: 1 } });
}

function heroAction(result: ReturnType<typeof battle>): Record<string, unknown> | undefined {
  return result.roundLogs[0]?.actions?.find((action) => action.userRecordId === HERO) as Record<string, unknown> | undefined;
}

describe("database behavioral parity - battle records", () => {
  it("skills: authored power scales the skill's battle damage", () => {
    // 새 스킬을 만들어서 검증한다. DEFAULT_SKILL_ID(skill_attack)로는 검증할 수 없다 —
    // 그 스킬은 통상공격 표현이라 runtime 이 authored power 를 **의도적으로 무시**한다(아래 테스트).
    const run = (power: number): number => {
      let skillId = "";
      const project = editorProject(() => {
        tankyEnemy(9999);
        skillId = addDatabaseRecord("skills");
        updateDatabaseRecord("skills", skillId, { power, mpCost: { flat: 0, percentMax: 0 }, scope: "enemy" });
        // 습득하지 않은 스킬은 runtime 이 통상공격으로 폴백한다(runtime.ts canUseSkill).
        // 가르치지 않으면 power 와 무관하게 같은 값이 나와 검증이 무력화된다.
        const hero = store.getCurrent().database.actors.find((record) => record.id === HERO);
        updateDatabaseRecord("actors", HERO, {
          learnedSkills: [...(hero?.learnedSkills ?? []), { level: 1, skillId }],
        });
      });
      const result = battle(project, { troopId: DEFAULT_TROOP_ID, heroLevel: 20, n: 3, seed: 1, battleFlow: "strict", strictScript: script("skill", { skillId }) });
      return heroAction(result)?.amount as number;
    };
    expect(run(500)).toBeGreaterThan(run(1));
  });

  it("skills: the default attack skill draws power from the attacker, not its authored power", () => {
    // 의도된 예외의 계약. `skill_attack` 은 통상공격을 표현하는 스킬이라 위력이 시전자
    // attackPower 에서 나온다(src/battle/runtime.ts applySkill). 적 220종의 authored action 이
    // 전부 이 스킬을 경유하므로 authored power(10)를 그대로 쓰면 피해가 0 이 된다.
    // 이 예외를 명시해 두지 않으면 "power 가 데미지를 스케일한다" 테스트가 이 스킬을 골라
    // 조용히 깨진다(실측: 양쪽 모두 99 → toBeGreaterThan 실패).
    const run = (power: number): number => {
      const project = editorProject(() => {
        tankyEnemy(9999);
        updateDatabaseRecord("skills", DEFAULT_SKILL_ID, { power, mpCost: { flat: 0, percentMax: 0 }, scope: "enemy" });
      });
      const result = battle(project, { troopId: DEFAULT_TROOP_ID, heroLevel: 20, n: 3, seed: 1, battleFlow: "strict", strictScript: script("skill", { skillId: DEFAULT_SKILL_ID }) });
      return heroAction(result)?.amount as number;
    };
    expect(run(500)).toBe(run(1));
  });

  it("enemies: authored maxHp scales how many turns the battle lasts", () => {
    const run = (maxHp: number): number => {
      const project = editorProject(() => {
        tankyEnemy(maxHp);
        updateDatabaseRecord("skills", DEFAULT_SKILL_ID, { power: 50, mpCost: { flat: 0, percentMax: 0 }, scope: "enemy" });
      });
      return battle(project, { troopId: DEFAULT_TROOP_ID, heroLevel: 20, n: 3, seed: 1, battleFlow: "strict", strictScript: script("skill", { skillId: DEFAULT_SKILL_ID }) }).avgTurns;
    };
    expect(run(9999)).toBeGreaterThan(run(50));
  });

  it("equipment: authored statBonuses.attack scales the hero's battle damage", () => {
    const run = (attackBonus: number): number => {
      const project = editorProject(() => {
        tankyEnemy(9999);
        const equipment = store.getCurrent().database.equipment.find((record) => record.id === SWORD);
        const current = (equipment?.statBonuses ?? {}) as Record<string, number>;
        updateDatabaseRecord("equipment", SWORD, { statBonuses: { ...current, attack: attackBonus } });
      });
      const result = battle(project, { troopId: DEFAULT_TROOP_ID, heroLevel: 20, n: 1, seed: 1, battleFlow: "strict", strictScript: script("attack") });
      return heroAction(result)?.amount as number;
    };
    expect(run(500)).toBeGreaterThan(run(8));
  });

  it("items: a 'special' item invokes its authored skill in battle (power scales the effect)", () => {
    const run = (power: number): Record<string, unknown> => {
      const project = editorProject(() => {
        tankyEnemy(9999);
        updateDatabaseRecord("skills", "skill_poison_sting", { power, mpCost: { flat: 0, percentMax: 0 } });
      });
      const result = battle(project, { troopId: DEFAULT_TROOP_ID, heroLevel: 20, n: 1, seed: 1, battleFlow: "strict", strictScript: script("item", { itemId: "item_poison_dart" }), inventory: { item_poison_dart: 9 } });
      return heroAction(result) ?? {};
    };
    const low = run(1);
    const high = run(500);
    expect(low.commandKind).toBe("item");
    expect(high.amount as number).toBeGreaterThan(low.amount as number);
  });

  it("states: a skill's authored stateEffects inflict the state and accelerate the kill", () => {
    // n 이 왜 50 인가 — **줄이지 말 것.** 이 검사는 "독 도트가 킬을 앞당긴다" 는 관계를
    // 두 표본의 평균 턴수 차이로 본다. 그런데 독을 붙이면 상태 판정 롤이 하나 더 들어가
    // 이후 rng 스트림이 통째로 밀린다(mulberry32 는 n판이 스트림 하나를 공유 —
    // simulate.ts:240). 적이 행동 레퍼토리를 갖게 된 뒤로는 적의 행동 선택까지 그 스트림을
    // 소비하므로 밀림 폭이 커졌다.
    //
    // 실측(2026-09-01): n=3 에서는 seed 에 따라 부호가 뒤집힌다 — seed 1 +1.67(역전),
    // seed 2 -3.67, seed 3 +3.00(역전). seed 1..60 을 훑으면 독이 빠른 쪽이 49/60 로,
    // 관계는 참인데 표본이 그걸 못 잡는 상태였다. n=50 은 seed 1..10 에서 10/10,
    // 차이 -1.28 ~ -2.64 로 안정된다(n=40 은 10/10 이지만 최소 여유가 -0.48 로 얇다).
    //
    // 즉 이건 기대치를 새 값으로 덮은 게 아니라, 잡음을 재던 표본을 효과를 재도록 키운 것이다.
    const run = (withPoison: boolean): number => {
      const project = editorProject(() => {
        tankyEnemy(9999);
        updateDatabaseRecord("skills", DEFAULT_SKILL_ID, {
          power: 50,
          mpCost: { flat: 0, percentMax: 0 },
          scope: "enemy",
          stateEffects: withPoison ? ([{ stateId: "state_poison", chance: 100 }] as never) : [],
        });
      });
      return battle(project, { troopId: DEFAULT_TROOP_ID, heroLevel: 20, n: 50, seed: 1, battleFlow: "strict", strictScript: script("skill", { skillId: DEFAULT_SKILL_ID }) }).avgTurns;
    };
    expect(run(true)).toBeLessThan(run(false));
  });

  it("troops: more authored members make the battle last longer", () => {
    const run = (count: number): number => {
      const project = editorProject(() => {
        const members = Array.from({ length: count }, (_, index) => ({ enemyId: DEFAULT_ENEMY_ID, x: 80 + index * 20, y: 96, hidden: false }));
        updateDatabaseRecord("troops", DEFAULT_TROOP_ID, { members, enemyIds: members.map((member) => member.enemyId) });
      });
      return battle(project, { troopId: DEFAULT_TROOP_ID, heroLevel: 20, n: 3, seed: 1, battleFlow: "strict", strictScript: script("attack") }).avgTurns;
    };
    expect(run(3)).toBeGreaterThan(run(1));
  });
});
