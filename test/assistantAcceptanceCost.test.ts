import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import * as evaluation from "@/ai/assistantAcceptanceEvaluation";
import { parseAcceptance } from "@/ai/assistantAcceptance";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { createBlankProject } from "@/project/defaults";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { fixture, plan, skip, target } from "./requiredOutcomeFixture";

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
    // When the real canonical ledger evaluates all promises.
    const snapshot = ledger.evaluate(applied, draft, evidence);
    // Then reference identity costs no serialization; distinct content is compared only once per side.
    expect(fingerprints.mock.calls.filter(([value]) => value === applied || value === draft)).toHaveLength(scenario === "same-reference" ? 0 : 2);
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

  it.each([false, true])("preserves late-adoption freshness when content changed=%s", async changed => {
    // Given a real verification result before any canonical requirement is declared.
    const f = fixture();
    const args = { mapId: target.mapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 0 }] };
    await f.run([[{ name: "check_reachability", args }]]);
    const project = structuredClone(f.session.baselineProject);
    if (changed) project.meta.title = "Changed after verification";
    // When a detached applied refresh precedes late adoption, with no new verification call.
    f.session.rebaseProject(project);
    await f.run([[plan([{ id: "route", title: "Route", criteria: [{ kind: "toolVerdict", tool: "check_reachability", args }] }]), skip]]);
    // Neither equality nor a rebase can grant pre-declaration proof authority.
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(f.session.getVerificationSnapshot().requirements[0]?.status).toBe("unverified");
    await f.run([[{ name: "check_reachability", args }]], { goalAction: "resume" }, "Continue route verification");
    expect(f.session.getAcceptanceSnapshot()?.status, JSON.stringify({ acceptance: f.session.getAcceptanceSnapshot(), verification: f.session.getVerificationSnapshot() })).toBe("verified");
  });
});
