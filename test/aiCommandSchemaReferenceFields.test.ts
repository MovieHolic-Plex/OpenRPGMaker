import { describe, expect, it } from "vitest";
import { COMMAND_SCHEMA } from "@/editor/tools/schemaShapes";

// Gemini 계열은 선언되지 않은 키를 거의 보내지 않는다 — 2026-09-24 몬스터 수집 도그푸딩에서
// battleProcessing 의 troopId 를 speaker·itemId·fields.troopId·commandId·text 에 차례로 넣다 13번 거부됐다.
describe("command schema declares kind-specific reference fields", () => {
  const branchItems = (COMMAND_SCHEMA.properties?.options as { items?: { properties?: { branch?: { items?: typeof COMMAND_SCHEMA } } } })
    ?.items?.properties?.branch?.items;

  it.each(["troopId", "canEscape", "canLose", "actorId", "action", "skillId", "eventId", "commonEventId", "ms"])("%s is declared at top level and in branches", key => {
    expect(COMMAND_SCHEMA.properties).toHaveProperty(key);
    expect(branchItems?.properties).toHaveProperty(key);
  });

  it("shop item list is described as the shop contract", () => {
    expect(COMMAND_SCHEMA.properties?.itemIds?.description).toContain("shop");
  });
});
