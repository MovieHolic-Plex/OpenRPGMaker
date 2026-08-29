import { describe, expect, it } from "vitest";
import { DATABASE_FIELD_SUPPORT, databaseFieldSupport, databaseFieldSupportNotice } from "@/editor/databaseFieldSupport";
import { FakeElement, installFakeDom } from "./fakeDom";

const EXPECTED_FIELDS = [
  "imageResourceId",
  "iconResourceId",
  "consumptionLimit",
  "usableActorIds",
  "usableClassIds",
  "seedParameterBonuses",
  "usageMessage",
  "equipmentProfile",
  "twoHanded",
  "accuracy",
  "criticalRate",
  "usableAsItemSkillId",
  "stateInflictIds",
  "stateInflictionChance",
  "stateResistanceChance",
  // 적(enemy) 저작 전용 필드 — 런타임 소비자가 없음을 공시한다.
  "transparent",
  "flying",
  "graphicHue",
];

describe("database field support descriptor", () => {
  it("is the unique exhaustive source for the eighteen-field truth contract", () => {
    expect(DATABASE_FIELD_SUPPORT.map((entry) => entry.field)).toEqual(EXPECTED_FIELDS);
    expect(new Set(DATABASE_FIELD_SUPPORT.map((entry) => entry.field)).size).toBe(18);
    expect(DATABASE_FIELD_SUPPORT.filter((entry) => entry.support === "runtime").map((entry) => entry.field)).toEqual([
      "consumptionLimit",
      "usableActorIds",
      "usableClassIds",
      "seedParameterBonuses",
      "twoHanded",
      "accuracy",
      "criticalRate",
      "usableAsItemSkillId",
      "stateInflictIds",
      "stateInflictionChance",
      "stateResistanceChance",
    ]);
    expect(databaseFieldSupport("usageMessage").support).toBe("editorOnly");
    expect(databaseFieldSupport("equipmentProfile").support).toBe("editorOnly");
  });

  it("names the supported authoring imagery consumers and unsupported runtime surfaces", () => {
    for (const field of ["imageResourceId", "iconResourceId"]) {
      const help = databaseFieldSupport(field).help;
      expect(help).toContain("데이터베이스");
      expect(help).toContain("상점");
      expect(help).toContain("피커");
      expect(help).toContain("미리보기");
      expect(help).toContain("요약");
      expect(help).toContain("인벤토리");
      expect(help).toContain("전투");
      expect(help).toContain("상태");
      expect(help).toContain("지원하지 않습니다");
    }
  });

  it("renders support state directly from the descriptor", () => {
    const restore = installFakeDom();
    try {
      const notice = databaseFieldSupportNotice("consumptionLimit", "usageMessage");
      const children = (notice as unknown as FakeElement).childNodes as FakeElement[];
      // 접힌 details: [summary, p, p]
      expect(children).toHaveLength(3);
      expect(notice.tagName).toBe("DETAILS");
      expect(children[0]!.tagName).toBe("SUMMARY");
      expect(children[1]!.dataset.runtimeSupport).toBe("runtime");
      expect(children[2]!.dataset.runtimeSupport).toBe("editorOnly");
    } finally {
      restore();
    }
  });
});
