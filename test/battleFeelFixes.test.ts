// 전투 재미 감사(2026-08-29) 후속 수정의 회귀 가드.
// 각 단정은 감사에서 실측한 결함 하나에 1:1 로 대응한다.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SKILL_CRIT_MULT,
  DEFAULT_SKILL_CRIT_RATE,
  MIN_DAMAGE_RATIO,
  applySkillLike,
} from "@/battle/battleDamage";
import {
  planActionBeats,
  weightForFeedback,
  type BattleActionWeight,
} from "@/player/battleActionBeats";
import {
  BATTLE_ACTING_MS,
  BATTLE_HITSTOP_MS,
  BATTLE_IMPACT_MS,
  BATTLE_LOG_MS,
  type DamageFeedback,
} from "@/player/battleSequencer";
import { TERM_KEYS } from "@/project/terms";
import { defaultTerms } from "@/project/defaults/defaultDatabase";
import type { MutableBattler } from "@/battle/battleBattlers";

function battler(overrides: Partial<MutableBattler> = {}): MutableBattler {
  return {
    id: "b1",
    recordId: "r1",
    name: "테스트",
    side: "enemy",
    hp: 500,
    maxHp: 500,
    mp: 10,
    maxMp: 10,
    attackPower: 10,
    defense: 0,
    mind: 0,
    agility: 10,
    level: 1,
    defending: false,
    defeated: false,
    stateIds: [],
    stateTurns: {},
    gauge: 0,
    pose: "idle",
    ...overrides,
  } as unknown as MutableBattler;
}

describe("F16: 뺄셈식 방어가 0 으로 붕괴하지 않는다", () => {
  it("방어력이 공격력을 압도해도 방어 적용 전 위력의 하한만큼은 깎인다", () => {
    // 감사 실측: Lv1 주인공(방어 72) 상대로 기본 적 24종 중 12종이 정확히 0 을 줬다.
    const user = battler({ attackPower: 12 });
    const target = battler({ defense: 200, hp: 500 });
    const result = applySkillLike(user, target, {
      power: 12,
      statistic: "attack",
      effect: "damage",
      variance: 0,
      criticalRate: 0,
      rng: () => 0.5,
    });
    expect(result.hit).toBe(true);
    expect(result.amount).toBeGreaterThan(0);
    // 방어 전 위력 = power(12) + floor(12/2) = 18 → 하한 floor(18 × 0.125) = 2.
    expect(result.amount).toBe(Math.max(1, Math.floor(18 * MIN_DAMAGE_RATIO)));
  });

  it("방어를 뚫는 공격의 데미지는 손대지 않는다", () => {
    const user = battler({ attackPower: 100 });
    const target = battler({ defense: 10, hp: 500 });
    const result = applySkillLike(user, target, {
      power: 40,
      statistic: "attack",
      effect: "damage",
      variance: 0,
      criticalRate: 0,
      rng: () => 0.5,
    });
    // 40 + floor(100/2) - floor(10/2) = 85. 하한(11)보다 크므로 그대로다.
    expect(result.amount).toBe(85);
  });
});

describe("F14: 크리티컬이 실제로 보일 만큼 자주 터진다", () => {
  it("기본 확률은 10% 이상이고 배율은 과하지 않다", () => {
    expect(DEFAULT_SKILL_CRIT_RATE).toBeGreaterThanOrEqual(10);
    expect(DEFAULT_SKILL_CRIT_MULT).toBeGreaterThan(1);
    expect(DEFAULT_SKILL_CRIT_MULT).toBeLessThan(1.5);
  });
});

describe("F04: 행동의 무게에 따라 케이던스가 달라진다", () => {
  const feedback = (over: Partial<DamageFeedback> = {}): DamageFeedback => ({
    targetId: "b1",
    amount: 30,
    critical: false,
    healing: false,
    ...over,
  });

  function total(weight: BattleActionWeight): number {
    return planActionBeats({
      userId: "u",
      targetId: "b1",
      feedback: feedback({ critical: weight === "heavy" }),
      actingMs: BATTLE_ACTING_MS,
      hitStopMs: BATTLE_HITSTOP_MS,
      impactMs: BATTLE_IMPACT_MS,
      weight,
    }).reduce((sum, beat) => sum + beat.durationMs, 0);
  }

  it("light < normal < heavy 순으로 길어진다", () => {
    expect(total("light")).toBeLessThan(total("normal"));
    expect(total("normal")).toBeLessThan(total("heavy"));
  });

  it("normal 은 시퀀서 기준 상수를 그대로 쓴다", () => {
    const beats = planActionBeats({
      userId: "u",
      targetId: "b1",
      feedback: feedback(),
      actingMs: BATTLE_ACTING_MS,
      hitStopMs: BATTLE_HITSTOP_MS,
      impactMs: BATTLE_IMPACT_MS,
      weight: "normal",
    });
    expect(beats.map((beat) => beat.durationMs)).toEqual([
      BATTLE_ACTING_MS,
      BATTLE_HITSTOP_MS,
      BATTLE_IMPACT_MS,
    ]);
  });

  it("무게는 피드백에서 유도된다 — 급소·막타는 heavy, 빗나감·0 피해는 light", () => {
    expect(weightForFeedback(feedback({ critical: true }))).toBe("heavy");
    expect(weightForFeedback(feedback(), true)).toBe("heavy");
    expect(weightForFeedback(feedback({ miss: true, amount: 0 }))).toBe("light");
    expect(weightForFeedback(feedback({ blocked: true, amount: 0 }))).toBe("light");
    expect(weightForFeedback(feedback())).toBe("normal");
    expect(weightForFeedback(undefined)).toBe("light");
  });
});

describe("F06: 죽은 시간이 줄었다", () => {
  it("임팩트 여운이 접근 모션보다 길지 않다", () => {
    // 예전: 접근 550 / 여운 750 — 절정(히트스톱)은 1프레임인데 여운이 900ms 넘게 흘렀다.
    expect(BATTLE_IMPACT_MS).toBeLessThanOrEqual(BATTLE_ACTING_MS);
  });

  it("시각 효과 없는 로그도 읽을 시간을 받는다", () => {
    expect(BATTLE_LOG_MS).toBeGreaterThan(0);
  });
});

describe("F12: 방어·도주 라벨도 용어 사전에 들어간다", () => {
  it("TERM_KEYS 와 기본 용어에 defend/escape 가 있다", () => {
    expect(TERM_KEYS).toContain("defend");
    expect(TERM_KEYS).toContain("escape");
    expect(defaultTerms().defend).toBe("방어");
    expect(defaultTerms().escape).toBe("도주");
  });
});
