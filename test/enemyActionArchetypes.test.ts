import { describe, expect, it } from "vitest";
import { archetypeActions, SPIRIT_ELEMENT_SKILLS } from "@/project/defaults/enemyActionArchetypes";
import { defaultDatabase } from "@/project/defaults/defaultDatabase";
import { DEFAULT_ELEMENT_RATE_LABELS } from "@/project/actorModel";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";

const db = defaultDatabase() as any;
const skillById = new Map<string, any>((db.skills as any[]).map((skill) => [skill.id, skill]));

/** MP 비용은 DB 에서 유도한다. id 목록을 상수로 박으면 누가 그 스킬에 mpCost 를 붙여도
 *  테스트는 초록으로 남고 고갈 방어만 조용히 무너진다. */
function mpCostOf(skillId: string): number {
  const skill = skillById.get(skillId);
  if (!skill) throw new Error(`${skillId} 가 기본 DB 에 없다`);
  return skill.mpCost?.flat ?? 0;
}

/** 상태를 걸거나 속성을 띠거나 MP 를 먹는 스킬 = 그 아키타입의 정체성.
 *  평범한 무료 무기 공격(attack/sword_slash/throwing_knife)과 구분한다. */
function isIdentitySkill(skillId: string): boolean {
  const skill = skillById.get(skillId);
  if (!skill) throw new Error(`${skillId} 가 기본 DB 에 없다`);
  return (skill.stateEffects ?? []).length > 0 || typeof skill.elementId === "string" || mpCostOf(skillId) > 0;
}

describe("archetypeActions", () => {
  const archetypes = ["blob", "venom", "brute", "curse", "caster", "bulwark", "tactician", "flyer", "boss"] as const;

  it("모든 아키타입이 행동을 2개 이상 준다 — 1개면 효용도 AI 가 선택할 게 없다", () => {
    for (const a of archetypes) {
      expect(archetypeActions(a, "skill_fire").length, a).toBeGreaterThanOrEqual(2);
    }
  });

  it("모든 아키타입이 MP 0 스킬을 최소 1개 갖는다 — MP 고갈 시 행동 불능을 막는다", () => {
    for (const a of archetypes) {
      const ids = archetypeActions(a, "skill_fire").map((p) => p.skillId);
      const free = ids.filter((id) => mpCostOf(id) === 0);
      expect(free.length, `${a}: ${ids.map((id) => `${id}(${mpCostOf(id)}MP)`).join(", ")}`).toBeGreaterThanOrEqual(1);
    }
  });

  // R14 규칙 1. 점수식은 damage 스킬의 stateEffects 를 안 본다(runtime.ts:1896-1898).
  // 정체성 스킬을 평범한 무료 공격보다 낮게 두면 Δscore 가 전투 내내 상수라 낮은 쪽은
  // **한 번도** 안 나온다(라운드 1 실측: poison_sting·earth·dark·throwing_knife 사장).
  it("정체성 스킬(상태·속성·유료)이 평범한 무료 데미지보다 낮은 우선순위를 갖지 않는다", () => {
    for (const a of archetypes) {
      const patterns = archetypeActions(a, "skill_fire");
      const plain = patterns.filter((p) => !isIdentitySkill(p.skillId));
      const identity = patterns.filter((p) => isIdentitySkill(p.skillId));
      if (plain.length === 0 || identity.length === 0) continue;
      const worstIdentity = Math.min(...identity.map((p) => p.priority));
      const bestPlain = Math.max(...plain.map((p) => p.priority));
      expect(
        worstIdentity,
        `${a}: 정체성 최저 ${worstIdentity} < 평범 최고 ${bestPlain} — 낮은 쪽은 영구히 사장된다`,
      ).toBeGreaterThanOrEqual(bestPlain);
    }
  });

  // R14 규칙 2. 유료기가 무료기보다 낮으면 MP 를 고스란히 남긴 채 전투가 끝난다.
  it("유료 스킬이 같은 아키타입의 무료 스킬보다 낮은 우선순위를 갖지 않는다", () => {
    for (const a of archetypes) {
      const patterns = archetypeActions(a, "skill_fire");
      const paid = patterns.filter((p) => mpCostOf(p.skillId) > 0);
      const free = patterns.filter((p) => mpCostOf(p.skillId) === 0);
      if (paid.length === 0 || free.length === 0) continue;
      const worstPaid = Math.min(...paid.map((p) => p.priority));
      const bestFree = Math.max(...free.map((p) => p.priority));
      expect(worstPaid, `${a}: 유료 최저 ${worstPaid} < 무료 최고 ${bestFree}`).toBeGreaterThanOrEqual(bestFree);
    }
  });

  it("참조하는 스킬이 전부 실재한다", () => {
    const known = new Set((db.skills as any[]).map((s) => s.id));
    for (const a of archetypes) {
      for (const p of archetypeActions(a, "skill_fire")) {
        expect(known.has(p.skillId), `${a} → ${p.skillId} 없음`).toBe(true);
      }
    }
    for (const skillId of Object.values(SPIRIT_ELEMENT_SKILLS)) {
      expect(known.has(skillId), `${skillId} 없음`).toBe(true);
    }
  });

  // 조용히 폴백하는 쪽은 정확히 **키**다. Task 4 가 SPIRIT_ELEMENT_SKILLS[enemy.id] 로
  // 조회하면 오타난 키는 아무 신호 없이 무속성 skill_arcane_bolt 폴백으로 떨어지고,
  // SkillId = string 이라 타입도 못 잡는다.
  it("SPIRIT_ELEMENT_SKILLS 의 키(적 id)가 전부 기본 DB 에 실재한다", () => {
    const knownEnemies = new Set((db.enemies as any[]).map((e) => e.id));
    for (const enemyId of Object.keys(SPIRIT_ELEMENT_SKILLS)) {
      expect(knownEnemies.has(enemyId), `${enemyId} 가 기본 DB 의 적에 없음 — 조용히 폴백한다`).toBe(true);
    }
  });

  it("boss 만 turn 조건 패턴을 갖는다", () => {
    for (const a of archetypes) {
      const hasTurn = archetypeActions(a, "skill_fire").some((p) => p.condition.kind === "turn");
      expect(hasTurn, a).toBe(a === "boss");
    }
  });
});

describe("스타터 적", () => {
  it("기본 트룹이 쓰는 적이 전부 행동 2개 이상을 갖는다", () => {
    const db = defaultDatabase() as any;
    const used = new Set(db.troops.flatMap((t: any) => (t.members ?? []).map((m: any) => m.enemyId)));
    expect(used.size).toBeGreaterThan(0);
    for (const id of used) {
      const enemy = db.enemies.find((e: any) => e.id === id);
      expect(enemy, `${id} 없음`).toBeDefined();
      expect((enemy.actions ?? []).length, `${id} 행동 부족`).toBeGreaterThanOrEqual(2);
    }
  });
});

// 적이 dark 속성 공격(skill_dark)을 쓰는데 저항 시드 표에 dark 가 없으면, 맞는 쪽
// (액터·직업)의 elementRates 에 등급이 없어 runtime.elementMultiplierFor 가 배율 1.0 으로
// 조용히 빠진다 — 무속성 공격과 수치가 완전히 같아져 curse 아키타입의 속성 배정이 장식이 된다.
describe("dark 속성 저항 시드", () => {
  it("기본 저항 시드 표가 dark 를 포함한다", () => {
    expect(DEFAULT_ELEMENT_RATE_LABELS.map((entry) => entry.id)).toContain("dark");
  });

  it("시드 표의 모든 속성이 elements 테이블에 실재한다", () => {
    const known = new Set((defaultDatabase().elements ?? []).map((entry) => entry.id));
    for (const label of DEFAULT_ELEMENT_RATE_LABELS) {
      expect(known.has(label.id), `${label.id} 가 elements 에 없음`).toBe(true);
    }
  });

  it("새 적/액터의 elementRates 가 dark 등급을 갖는다", () => {
    expect(normalizeEnemyRecord({ id: "enemy_probe", name: "탐침" }).elementRates?.dark).toBe("C");
    expect(defaultDatabase().actors[0]?.elementRates?.dark).toBe("C");
  });
});
