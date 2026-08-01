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
  "usableAsItemSkillId",
  "stateInflictIds",
  "stateInflictionChance",
  "stateResistanceChance",
];

describe("database field support descriptor", () => {
  it("is the unique exhaustive source for the thirteen-field truth contract", () => {
    expect(DATABASE_FIELD_SUPPORT.map((entry) => entry.field)).toEqual(EXPECTED_FIELDS);
    expect(new Set(DATABASE_FIELD_SUPPORT.map((entry) => entry.field)).size).toBe(13);
    expect(DATABASE_FIELD_SUPPORT.filter((entry) => entry.support === "runtime").map((entry) => entry.field)).toEqual([
      "consumptionLimit",
      "usableActorIds",
      "usableClassIds",
      "seedParameterBonuses",
      "twoHanded",
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
      expect(children).toHaveLength(2);
      expect(children[0]!.dataset.runtimeSupport).toBe("runtime");
      expect(children[1]!.dataset.runtimeSupport).toBe("editorOnly");
    } finally {
      restore();
    }
  });
});
