import { describe, expect, it } from "vitest";
import { eventDraftRuleGuidance } from "@/editor/eventDraftIssueDetails";

// 검토 목록 문구에 영문 종류 이름(switch 등)이 그대로 새지 않는다(2026-11-26 QA vm-qa15 #95).
describe("eventDraftRuleGuidance 참조 누락 문구", () => {
  const kinds = ["actor", "common-event", "item", "map", "switch", "troop", "variable"];
  it.each(kinds)("reference.%s.missing 은 영문 종류 이름을 보이지 않는다", (kind) => {
    const guidance = eventDraftRuleGuidance(`reference.${kind}.missing`);
    expect(guidance.code).toBe(`reference.${kind}.missing`);
    expect(`${guidance.expected} ${guidance.hint}`).not.toMatch(/[A-Za-z]/u);
  });

  it("스위치 누락은 스위치를 다시 고르라고 말한다", () => {
    const guidance = eventDraftRuleGuidance("reference.switch.missing");
    expect(guidance.hint).toContain("스위치");
  });

  it("모르는 종류는 일반 검토 안내로 떨어진다", () => {
    expect(eventDraftRuleGuidance("reference.unknown-kind.missing").code).toBe("validation.advisory");
  });
});
