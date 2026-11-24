import { describe, expect, it } from "vitest";
import { parseAcceptanceCriteria } from "@/ai/assistantAcceptance";
import { parseRequestCoverage } from "@/ai/requestCoverage";

// 수락 원장(AssistantAcceptanceLedger)의 평가·보수 경로는 2026-09-17 에 꺼졌다(assistantSession.adoptAcceptance). 그 경로를 돌리던
// 사례는 지웠고, 아직 살아 있는 코드가 부르는 순수 파서(parseAcceptanceCriteria ← requestCoverage·workPlan)의 거부 규칙만 남긴다.
const title = { kind: "projectTitle", title: "Exact title" };
const policyQuote = "Use contact battles with visible monsters.";
const policyRequest = `${policyQuote} Change only the title.`;
const policyCriterion = { kind: "wikiDeclaration", documentId: "w_combat_preference", combatMode: "contact", sourceQuote: policyQuote };

describe("project acceptance criteria parser", () => {
  it.each([
    { ...policyCriterion, sourceQuote: "" }, { ...policyCriterion, documentId: "" },
    { ...policyCriterion, combatMode: "invented" }, { ...policyCriterion, passed: true },
    { ...policyCriterion, source: { kind: "user", text: policyRequest } },
  ])("rejects malformed wiki criteria and model-supplied provenance (%j)", criterion => {
    expect(parseAcceptanceCriteria([criterion])).toBeNull();
  });

  it.each([
    { kind: "projectTitle", title: 3 }, { ...title, passed: true },
    { kind: "itemValues", itemId: "item" }, { kind: "itemValues", itemId: "item", price: -1 },
    { kind: "itemValues", itemId: "item", price: Infinity }, { kind: "itemValues", itemId: "item", price: "37" },
    { kind: "projectPreserve", scope: "project" },
    { kind: "projectPreserve", scope: "project", allowedChanges: [{ kind: "path", path: "maps" }] },
    { kind: "projectPreserve", scope: "project", allowedChanges: [{ kind: "itemPrice" }] },
    { kind: "projectPreserve", scope: "project", allowedChanges: [{ kind: "projectTitle", itemId: "mixed" }] },
  ])("rejects malformed or model-authored evidence fields (%j)", invalid => {
    expect(parseAcceptanceCriteria([title, invalid])).toBeNull();
  });

  it("retains a source-bound unsupported clause beside the supported title check", () => {
    const userText = "Set the title. Use contact battles with visible monsters.";
    const facts = { userText, currentMap: null, selection: null, maps: [], facilityLabels: [], toolNames: [], hasActivePlan: false };
    const unresolved = { kind: "functionalUnresolved", reason: "Contact authoring policy has no semantic evaluator" };
    const requirements = parseRequestCoverage(JSON.stringify({ requirements: [
      { text: "Set the title.", criteria: [title] },
      { text: "Use contact battles with visible monsters.", criteria: [unresolved] },
    ] }), facts, []);
    expect(requirements.map(entry => entry.text)).toEqual(["Set the title.", "Use contact battles with visible monsters."]);
    expect(requirements[0]?.criteria).toMatchObject([title]);
    expect(requirements[1]?.criteria).toMatchObject([unresolved]);
  });
});
