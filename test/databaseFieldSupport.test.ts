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
  // 스키마·런타임에는 있었으나 저작 UI 가 없어 공시도 없던 세 필드(아이템 탭 기능 추가).
  "stateEffects",
  "animationId",
  "careProfile",
  "usageMessage",
  "equipmentProfile",
  "twoHanded",
  "accuracy",
  "criticalRate",
  "usableAsItemSkillId",
  "stateInflictIds",
  "stateInflictionChance",
  "stateResistanceChance",
  // 적의 투명·비행·색조는 화면에서 지운 칸이라(2026-10-02) 공시도 없다.
];

describe("database field support descriptor", () => {
  it("is the unique exhaustive source for the eighteen-field truth contract", () => {
    expect(DATABASE_FIELD_SUPPORT.map((entry) => entry.field)).toEqual(EXPECTED_FIELDS);
    expect(new Set(DATABASE_FIELD_SUPPORT.map((entry) => entry.field)).size).toBe(18);
    expect(DATABASE_FIELD_SUPPORT.filter((entry) => entry.support === "runtime").map((entry) => entry.field)).toEqual([
      "imageResourceId",
      "iconResourceId",
      "consumptionLimit",
      "usableActorIds",
      "usableClassIds",
      "seedParameterBonuses",
      "stateEffects",
      "animationId",
      "careProfile",
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

  it("describes imagery in the current inventory, equipment menu and shop", () => {
    for (const field of ["imageResourceId", "iconResourceId"]) {
      const help = databaseFieldSupport(field).help;
      expect(help).toContain("데이터베이스");
      expect(help).toContain("상점");
      expect(help).toContain("피커");
      expect(help).toContain("미리보기");
      expect(help).toContain("요약");
      expect(help).toContain("인벤토리");
      expect(help).toContain("전투");
      expect(help).toContain("장비 메뉴");
      expect(help).toContain("아이콘을 우선");
      expect(databaseFieldSupport(field).support).toBe("runtime");
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
