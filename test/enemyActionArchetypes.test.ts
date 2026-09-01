import { describe, expect, it } from "vitest";
import { archetypeActions, SPIRIT_ELEMENT_SKILLS } from "@/project/defaults/enemyActionArchetypes";
import { defaultDatabase } from "@/project/defaults/defaultDatabase";
import { DEFAULT_ELEMENT_RATE_LABELS } from "@/project/actorModel";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";

const FREE_SKILLS = new Set(["skill_attack", "skill_sword_slash", "skill_throwing_knife", "skill_poison_sting"]);

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
      expect(ids.some((id) => FREE_SKILLS.has(id)), `${a}: ${ids.join(",")}`).toBe(true);
    }
  });

  it("참조하는 스킬이 전부 실재한다", () => {
    const known = new Set(((defaultDatabase() as any).skills as any[]).map((s) => s.id));
    for (const a of archetypes) {
      for (const p of archetypeActions(a, "skill_fire")) {
        expect(known.has(p.skillId), `${a} → ${p.skillId} 없음`).toBe(true);
      }
    }
    for (const skillId of Object.values(SPIRIT_ELEMENT_SKILLS)) {
      expect(known.has(skillId), `${skillId} 없음`).toBe(true);
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
