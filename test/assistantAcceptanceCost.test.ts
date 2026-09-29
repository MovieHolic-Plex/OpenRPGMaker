// 2026-09-17: 세션 수용 원장 해체 — 플랜 requirements 의 toolVerdict 기준에서 파생되던 검증 요구(late-adoption freshness) 테스트는 삭제. 순수 원장 모듈 비용 테스트만 남긴다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import * as evaluation from "@/ai/assistantAcceptanceEvaluation";
import { parseAcceptance } from "@/ai/assistantAcceptance";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { createBlankProject } from "@/project/defaults";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { fixture } from "./requiredOutcomeFixture";

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
  });
});
