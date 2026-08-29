import { describe, expect, it } from "vitest";
import {
  DEFAULT_RELATIONSHIP_STATE,
  evalRelationshipCondition,
  getRelationshipState,
  normalizeRelationships,
  RELATIONSHIP_STATES,
  relationshipRank,
  setRelationshipState,
  type RelationshipHost,
} from "@/project/relationshipState";
import { CONDITION_KINDS } from "@/project/commandKindRegistry";

describe("관계 상태 권위", () => {
  it("없으면 관계 없음으로 파생된다", () => {
    expect(getRelationshipState({}, "npc_a")).toBe("single");
    expect(getRelationshipState({ relationships: {} }, "npc_a")).toBe("single");
    expect(DEFAULT_RELATIONSHIP_STATE).toBe("single");
  });

  it("단계가 순서를 가진다", () => {
    expect(RELATIONSHIP_STATES).toEqual(["single", "dating", "engaged", "married"]);
    expect(relationshipRank("single")).toBeLessThan(relationshipRank("dating"));
    expect(relationshipRank("dating")).toBeLessThan(relationshipRank("engaged"));
    expect(relationshipRank("engaged")).toBeLessThan(relationshipRank("married"));
  });

  it("기본값으로 되돌리면 항목을 남기지 않는다", () => {
    const host: RelationshipHost = {};
    setRelationshipState(host, "npc_a", "married");
    expect(host.relationships).toEqual({ npc_a: "married" });
    setRelationshipState(host, "npc_a", "single");
    expect(host.relationships).toEqual({});
  });

  it("빈 키는 저장하지 않는다", () => {
    const host: RelationshipHost = {};
    setRelationshipState(host, "   ", "married");
    expect(host.relationships ?? {}).toEqual({});
  });

  it("이상 비교는 단계 순서를 따른다", () => {
    const host: RelationshipHost = { relationships: { npc_a: "engaged" } };
    for (const [state, expected] of [
      ["single", true],
      ["dating", true],
      ["engaged", true],
      ["married", false],
    ] as const) {
      expect(evalRelationshipCondition(host, { kind: "relationshipAtLeast", state }, "npc_a")).toBe(expected);
    }
  });

  it("키가 없으면 닫힌 채로 거짓이다", () => {
    const host: RelationshipHost = { relationships: { npc_a: "married" } };
    expect(evalRelationshipCondition(host, { kind: "relationshipAtLeast", state: "dating" }, null)).toBe(false);
  });

  /* 열거 밖 문자열을 통과시키면 relationshipRank 가 -1 을 돌려 모든 이상 비교가 참이 된다.
     문자열 상태에는 수치의 clamp 대응물이 없으므로 정규화가 유일한 방어선이다. */
  it("낡거나 적대적인 세이브 값은 버린다", () => {
    expect(normalizeRelationships({ npc_a: "maried", npc_b: "dating" })).toEqual({ npc_b: "dating" });
    expect(normalizeRelationships({ npc_a: 3 })).toEqual({});
    expect(normalizeRelationships({ "  ": "married" })).toEqual({});
    expect(normalizeRelationships({ npc_a: "single" })).toEqual({});
    expect(normalizeRelationships("nope")).toBeUndefined();
  });

  it("버려진 값은 조건을 참으로 만들지 않는다", () => {
    const host: RelationshipHost = { relationships: normalizeRelationships({ npc_a: "maried" }) };
    expect(evalRelationshipCondition(host, { kind: "relationshipAtLeast", state: "married" }, "npc_a")).toBe(false);
    expect(getRelationshipState(host, "npc_a")).toBe("single");
  });

  it("조건 종류가 레지스트리에 등록돼 있다", () => {
    expect(CONDITION_KINDS).toContain("relationshipAtLeast");
  });
});
