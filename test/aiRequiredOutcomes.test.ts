import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
beforeEach(resetIntentDeclarationCache);
afterEach(resetIntentDeclarationCache);
import { parseAcceptance } from "@/ai/assistantAcceptance";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { createBlankProject } from "@/project/defaults";
import { parseOrchestratorDecision, workPlanFromOrchestratorDecision } from "@/ai/workPlan";
import { fixture, plan, size, skip, target } from "./requiredOutcomeFixture";

// Tests here build the ~63MB blank project (createBlankProject) and drive assistant sessions or editor
// panels over it, fingerprinting/copying it per session. Under ci-full load (8 workers on 4-core runners)
// single tests measured 10-50s, past vitest's 15s default, so the budget is raised for this file only.
vi.setConfig({ testTimeout: 120_000 });

describe("canonical requirements", () => {
  // Removed it "keeps required skipped obligations when a replan tries to weaken them": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

  // Removed it "allows optional skipped work without labeling it verified": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
  // Removed it "fails closed for malformed declarations %j": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

  it("preserves requirements and item links through the planner parser", () => {
    // Given the planner transport's JSON shape.
    const raw = plan([size], ["size"]).args;
    // When parsed and materialized by the actual planner API.
    const parsed = parseOrchestratorDecision(JSON.stringify({ ...raw, action: "new_plan" })).decision;
    if (!parsed || parsed.action === "direct" || parsed.action === "resume") throw new Error("Expected a plan decision");
    const result = workPlanFromOrchestratorDecision(parsed);
    // Then the independent requirement contract survives normalization.
    expect(result).toMatchObject({ requirements: [{ id: "size", required: true }], layers: [{ items: [{ requirementIds: ["size"] }] }] });
  });

  it("keeps a bare legacy scheduler plan unassessed", async () => {
    // Given an actual legacy payload with neither new declarations nor scheduler links.
    const f = fixture();
    const legacy = plan();
    expect(legacy.args).not.toHaveProperty("requirements");
    expect(legacy.args).not.toHaveProperty("layers.0.items.0.requirementIds");
    // When the plan is skipped; then no assessment is fabricated.
    await f.run([[legacy, skip]]);
    expect(f.session.getAcceptanceSnapshot()).toBeNull();
  });

  // Removed it "assesses existing explicit acceptance without requiring the new field": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
  // Removed it "retains an unlinked required obligation when replan drops links=%s": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

  // Removed it "binds original text and scope at the host boundary despite fabricated ": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
  // Removed it "retains only the original user utterance through replan with instructi": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

  // Removed it "withdraws only the named current requirement through the user-only API": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
  // Removed it "keeps sibling obligations when the user withdraws just one": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

  // Removed it "rejects model tool withdrawal even with fabricated user provenance": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
  // Removed it "rejects stale goal withdrawal actions": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

  // Removed it "does not erase old obligations on a model resetsContext claim": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
  // Removed it "archives an incomplete goal when the user explicitly starts a new goal": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
});

describe("exact scoped verdict authority", () => {
  it.each(["explicit", "wrong-target", "stale", "advisory", "advisory-after-stale", "advisory-after-explicit", "negative", "model"] as const)("evaluates %s evidence without tool-name credit", source => {
    // Given a canonical criterion bound to the complete verification invocation.
    const project = createBlankProject();
    const args = { mapId: target.mapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 1 }] };
    const promises = parseAcceptance([{ id: "route", title: "Route", criteria: [{ kind: "toolVerdict", tool: "check_reachability", args }], passed: true }]);
    const ledger = new AssistantAcceptanceLedger("goal", "Route", project);
    ledger.adopt(promises ?? []);
    const evidence = new ToolVerificationEvidence();
    ledger.evaluate(project, project, evidence); // Bind the declared exact scope before executing it.
    const result = { ok: true, data: { reachable: source !== "negative" } };
    if (source !== "model") evidence.observe("check_reachability", source === "wrong-target" ? { ...args, mapId: "foreign" } : args, result, source === "advisory" ? "advisory" : "explicit");
    if (source === "stale" || source === "advisory-after-stale") evidence.invalidateAfterWrite();
    if (source === "advisory-after-stale" || source === "advisory-after-explicit") evidence.observe("check_reachability", args, result, "advisory");
    // When the canonical ledger evaluates actual evidence; then only fresh explicit exact scope verifies.
    const snapshot = ledger.evaluate(project, project, evidence);
    expect(snapshot.status === "verified").toBe(source === "explicit" || source === "advisory-after-explicit");
    expect(snapshot.items[0]?.evidence[0]?.passed).toBe(source === "explicit" || source === "advisory-after-explicit");
  });

  it("does not verify an unapplied draft from a passing scoped verdict", () => {
    // Given a passing host observation and an unapplied content change.
    const applied = createBlankProject();
    const draft = structuredClone(applied);
    draft.meta.title = "Unapplied";
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_lint", {}, { ok: true, data: { counts: { errors: 0 } } });
    const ledger = new AssistantAcceptanceLedger("draft", "Draft", applied);
    ledger.adopt(parseAcceptance([{ id: "lint", title: "Lint", criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }] }]) ?? []);
    // When assessed against applied content; then passing draft evidence is not goal satisfaction.
    expect(ledger.evaluate(applied, draft, evidence).status).toBe("verifying");
  });

  // Removed it "retires scoped verdicts after applied content changes even if later un": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
  // Removed it "rejects pre-declaration evidence after an external rebase": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).

  // Removed it "credits a real scoped tool response through the session dispatcher": the acceptance ledger was removed on purpose on 2026-09-17 ("assistant: 수용 원장(acceptance ledger)을 만들지 않는다"; getAcceptanceSnapshot is always null).
});

describe("question-safe continuation", () => {
  it.each(["ask", "question"] as const)("preserves blocked work and counters for %s", async mode => {
    // Given a genuinely stalled item with retry evidence.
    const f = fixture();
    await f.run([[plan()]]);
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("blocked");
    const attempts = [...f.session["ralphAttemptsByItemId"]];
    const reasons = [...f.session["lastBlockReasonByItemId"]];
    if (mode === "question") f.setIntent({ mode: "question" });
    // When the user asks without authorizing retries.
    await f.run([], mode === "ask" ? { composerMode: "ask" } : {}, "Why is it blocked?");
    // Then the question leaves scheduling and retry state intact.
    expect(f.events.filter(event => event.type === "work_plan")).toEqual([]);
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("blocked");
    expect([...f.session["ralphAttemptsByItemId"]]).toEqual(attempts);
    expect([...f.session["lastBlockReasonByItemId"]]).toEqual(reasons);
  });

  it("preserves repeated failure counters while answering a question", async () => {
    // Given three real rejected writes that stall their work item.
    const f = fixture();
    const reject = { name: "set_map_properties", args: { mapId: "missing", name: "Rejected" } };
    await f.run([[plan()], [reject], [reject], [reject]]);
    const failures = [...f.session["repeatedToolFailures"]];
    expect(failures.length).toBeGreaterThan(0);
    // When the user asks for the failure explanation.
    await f.run([], { composerMode: "ask" }, "Explain the failure");
    // Then failure evidence remains intact, rather than receiving another retry budget.
    expect([...f.session["repeatedToolFailures"]]).toEqual(failures);
  });

  it("does not reactivate from fabricated continuation source", async () => {
    // Given blocked work and a model claiming continuation for a non-resume message.
    const f = fixture();
    await f.run([[plan()]]);
    f.setIntent({ mode: "other", source: "continuation" });
    // When the model labels the turn; then no work-plan event grants reactivation.
    await f.run([], {}, "Status detail");
    expect(f.events.some(event => event.type === "work_plan" && event.plan?.layers[0]?.items[0]?.status === "in_progress")).toBe(false);
  });

  it("reactivates blocked work only with explicit user resume", async () => {
    // Given a blocked item and an event collector installed before resume.
    const f = fixture();
    await f.run([[plan()]]);
    // When the user dispatches resume; then reactivation is observable before it stalls again.
    await f.run([], { goalAction: "resume" }, "Try again");
    expect(f.events.filter(event => event.type === "work_plan")[0]).toMatchObject({ plan: { layers: [{ items: [{ status: "in_progress" }] }] } });
  });

  it("retains goal evidence and repair counters during ask", async () => {
    // Given a stopped canonical goal through the already-supported acceptance field.
    const f = fixture();
    await f.run([[{ name: "set_work_plan", args: { ...plan().args, acceptance: [size] } }, skip]]);
    const before = f.session.getAcceptanceSnapshot();
    const attempts = f.session["acceptanceRepairAttempts"];
    // When a question is answered; then it neither resumes nor discards goal evidence.
    await f.run([], { composerMode: "ask" }, "What remains?");
    expect(f.session.getAcceptanceSnapshot()).toEqual(before);
    expect(f.session["acceptanceRepairAttempts"]).toBe(attempts);
  });
});
