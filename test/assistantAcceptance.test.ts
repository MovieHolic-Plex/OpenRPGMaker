import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import * as evaluation from "@/ai/assistantAcceptanceEvaluation";
import { parseAcceptance, ACCEPTANCE_EXAMPLES, acceptanceRecord, parseAcceptanceCriteria } from "@/ai/assistantAcceptance";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { createBlankProject } from "@/project/defaults";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { fixture } from "./requiredOutcomeFixture";
import { spawnSync } from "node:child_process";
import { ACCEPTANCE_TOOLS } from "@/ai/assistantAcceptanceTools";
import { WORK_PLAN_TOOLS } from "@/ai/assistantSession";
import { isolateTimers } from "./mergedTeardown";

// 2026-09-17: 세션 수용 원장 해체 — 플랜 requirements 의 toolVerdict 기준에서 파생되던 검증 요구(late-adoption freshness) 테스트는 삭제. 순수 원장 모듈 비용 테스트만 남긴다.
describe("assistantAcceptanceCost", () => {
  isolateTimers();
  beforeEach(resetIntentDeclarationCache);
  afterEach(() => { vi.restoreAllMocks(); resetIntentDeclarationCache(); });
  // Spies call the real fingerprint/clone implementations: counts measure work, not elapsed time.
  describe("bounded canonical project comparisons", () => {
    it.each(["same-reference", "same-content", "changed-content"] as const)("compares shared project content once for %s", scenario => {
      // Given several promises that share the same applied/draft pair.
      const applied = createBlankProject();
      const draft = scenario === "same-reference" ? applied : structuredClone(applied);
      if (scenario === "changed-content") draft.meta.title = "Unapplied change";
      const ledger = new AssistantAcceptanceLedger("cost", "Cost", applied);
      ledger.adopt(parseAcceptance(["first", "second", "third"].map(id => ({
        id, title: id, criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }],
      }))) ?? []);
      const evidence = new ToolVerificationEvidence();
      ledger.bindVerificationRequirements(evidence);
      evidence.observe("run_lint", {}, { ok: true, data: { counts: { errors: 0 } } });
      const fingerprints = vi.spyOn(evaluation, "acceptanceFingerprint");
      const comparisons = vi.spyOn(evaluation, "sameAcceptanceContent");
      // When the real canonical ledger evaluates all promises.
      const snapshot = ledger.evaluate(applied, draft, evidence);
      // Then whole projects are never fingerprinted (full sorted JSON); distinct content is compared once, by digest.
      expect(fingerprints.mock.calls.filter(([value]) => value === applied || value === draft)).toHaveLength(0);
      expect(comparisons.mock.calls.filter(([left, right]) => left === applied && right === draft)).toHaveLength(scenario === "same-reference" ? 0 : 1);
      const expected = scenario === "changed-content" ? "verifying" : "verified";
      expect(snapshot.items.map(item => item.status)).toEqual([expected, expected, expected]);
    });

    // 호스티드 러너에서 단독으로도 15~17초 걸린다(ci-vitest-files 45671861464, ci-full 45620536375) — 기본 15초 대신 60초.
    it("does not compare or clone an unrelated editor update without authority or verifier evidence", () => {
      // Given a session that has never established an assessment or observed verification.
      const f = fixture();
      const project = structuredClone(f.session.baselineProject);
      project.meta.title = "Unrelated edit";
      const fingerprints = vi.spyOn(evaluation, "acceptanceFingerprint");
      const clones = vi.spyOn(globalThis, "structuredClone");
      // When its applied-state refresh receives an editor update.
      f.session.refreshAcceptance(project);
      // Then the absent authority remains cheap without inventing an assessment.
      expect(fingerprints).not.toHaveBeenCalled();
      expect(clones).not.toHaveBeenCalled();
      expect(f.session.getAcceptanceSnapshot()).toBeNull();
    }, 60_000);
  });
});

describe("assistantAcceptanceProvider", () => {
  isolateTimers();
  function record(value: unknown): Record<string, unknown> {
    if (!acceptanceRecord(value)) throw new Error("Expected a schema object");
    return value;
  }
  describe("acceptance schema contract", () => {
    it("retains every scoped canonical shape and selector without oneOf", () => {
      const input = [...WORK_PLAN_TOOLS.filter(tool => tool.function.name === "set_work_plan"), ...ACCEPTANCE_TOOLS];
      expect(input).toHaveLength(3);
      for (const entry of input) {
        const name = entry.function.name;
        const properties = record(record(entry.function.parameters).properties);
        if (name === "review_acceptance") {
          expect(record(properties.verdict).enum).toEqual(["pass", "fail"]);
          continue;
        }
        const criteria = name === "set_work_plan"
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
