import { describe, expect, it } from "vitest";
import { ACCEPTANCE_EXAMPLES, parseAcceptanceCriteriaResult, parseAcceptanceCriteria, acceptanceRecord } from "@/ai/assistantAcceptance";
import { parseRequestCoverage } from "@/ai/requestCoverage";
import { spawnSync } from "node:child_process";
import { ACCEPTANCE_TOOLS } from "@/ai/assistantAcceptanceTools";
import { WORK_PLAN_TOOLS } from "@/ai/assistantSession";
import { isolateTimers } from "./mergedTeardown";

describe("assistantAcceptanceDiagnostics", () => {
  isolateTimers();
  // 수용 원장(AssistantAcceptanceLedger)의 보수·검토·도달성 평가 경로는 2026-09-17 에 꺼졌다(assistantSession.adoptAcceptance).
  // 그 경로를 돌리던 사례는 지웠고, 살아 있는 코드가 부르는 순수 파서(parseAcceptanceCriteriaResult ← runRecovery·requestCoverage)의
  // 「어느 필드가 왜 틀렸는가」 진단만 남긴다.
  const target = { mapId: "map_blank_start" };
  describe("actionable atomic acceptance diagnostics", () => {
    it.each([
      { criterion: { kind: "mapCount", count: 1, targets: [{ ...target, newMapName: "Both" }] }, field: "targets[0]", code: "invalid-selector" },
      { criterion: { kind: "mapDimensions", target, width: 0, height: 15 }, field: "width", code: "invalid-field" },
      { criterion: { kind: "eventCount", target, count: -1 }, field: "count", code: "invalid-field" },
      { criterion: { kind: "preserve", target, evidence: "forged" }, field: "evidence", code: "unknown-field" },
      { criterion: { kind: "imageReviewed", target, region: { x: 0, y: 0, w: 0, h: 1 } }, field: "region", code: "invalid-field" },
      { criterion: { kind: "reachability", target, from: { x: 0, y: 0 }, to: [{ x: -1, y: 0 }] }, field: "to[0]", code: "invalid-field" },
    ])("identifies malformed sibling $field without retaining its valid prefix", ({ criterion, field, code }) => {
      expect(parseAcceptanceCriteriaResult([ACCEPTANCE_EXAMPLES.preserve, criterion])).toMatchObject({ criteria: null,
        issues: [{ criterionIndex: 1, field: `criteria[1].${field}`, code }] });
    });
  });
});

describe("assistantAcceptanceProject", () => {
  isolateTimers();
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
});

describe("assistantAcceptanceProvider", () => {
  isolateTimers();
  function record(value: unknown): Record<string, unknown> {
    if (!acceptanceRecord(value)) throw new Error("Expected a schema object");
    return value;
  }
  describe("acceptance at the installed Antigravity schema boundary", () => {
    it("retains every scoped canonical shape and selector through Google then CCA normalization", () => {
      // Execute the installed provider's actual two normalization stages in its Bun runtime.
      const input = [...WORK_PLAN_TOOLS.filter(tool => tool.function.name === "set_work_plan"), ...ACCEPTANCE_TOOLS];
      const result = spawnSync("bun", ["-e", `
      import {normalizeSchemaForGoogle, normalizeSchemaForCCA} from "./node_modules/@oh-my-pi/pi-ai/src/utils/schema/normalize.ts";
      const tools = await Bun.stdin.json();
      console.log(JSON.stringify(tools.map(tool => ({name: tool.function.name,
        parameters: normalizeSchemaForCCA(normalizeSchemaForGoogle(tool.function.parameters))}))));
    `], { cwd: process.cwd(), input: JSON.stringify(input), encoding: "utf8", timeout: 15000 });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      const normalized: unknown = JSON.parse(result.stdout);
      if (!Array.isArray(normalized)) throw new Error("Expected normalized tools");
      expect(normalized).toHaveLength(3);
      for (const entry of normalized) {
        const tool = record(entry);
        const properties = record(record(tool.parameters).properties);
        if (tool.name === "review_acceptance") {
          expect(record(properties.verdict).enum).toEqual(["pass", "fail"]);
          continue;
        }
        const criteria = tool.name === "set_work_plan"
          ? record(record(record(properties.acceptance).items).properties).criteria : properties.criteria;
        const item = record(record(criteria).items);
        expect(item.oneOf).toBeUndefined();
        const fields = record(item.properties);
        expect(Object.keys(fields)).toEqual(expect.arrayContaining(["kind", "target", "targets", "count", "from", "to", "interactionTargets"]));
        const ownership = record(record(fields.interactionTargets).items);
        expect(ownership.required).toEqual(["stepIndex", "mapId", "eventId"]);
        expect(Object.keys(record(ownership.properties))).toEqual(["stepIndex", "mapId", "eventId"]);
        for (const selector of [fields.target, record(fields.targets).items]) {
          expect(Object.keys(record(record(selector).properties))).toEqual(["mapId", "newMapName"]);
          expect(record(selector).oneOf).toBeUndefined();
        }
        if (typeof item.description !== "string") throw new Error("Canonical shapes lost in provider transport");
        const shapes = record(JSON.parse(item.description.slice(item.description.indexOf("{"))));
        expect(shapes).toEqual(ACCEPTANCE_EXAMPLES);
        expect(parseAcceptanceCriteria(Object.values(shapes))).toHaveLength(19);
        expect(shapes.gameTitle).toEqual({ kind: "gameTitle", title: "작은 열쇠" });
        expect(record(fields.title).type).toBe("string");
        expect(shapes.actionCombat).toEqual({ kind: "actionCombat", target: { mapId: "map_id" } });
        expect(shapes.mapCount).toMatchObject({ count: 2, targets: [{ mapId: "map_id" }, { newMapName: "New map" }] });
        const duplicate = { kind: "mapCount", count: 1, targets: [{ mapId: "map_id", newMapName: "New map" }] };
        expect(parseAcceptanceCriteria([shapes.preserve, duplicate])).toBeNull();
      }
    });
  });
});
