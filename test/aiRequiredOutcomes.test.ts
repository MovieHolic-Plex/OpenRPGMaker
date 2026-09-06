import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
beforeEach(resetIntentDeclarationCache);
afterEach(resetIntentDeclarationCache);
import { parseAcceptance } from "@/ai/assistantAcceptance";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { createBlankProject } from "@/project/defaults";
import { WORK_PLAN_TOOLS } from "@/ai/assistantSession";
import { ACCEPTANCE_TOOLS } from "@/ai/assistantAcceptanceTools";
import { parseOrchestratorDecision, workPlanFromOrchestratorDecision } from "@/ai/workPlan";
import { fixture, plan, size, skip, target } from "./requiredOutcomeFixture";

describe("canonical requirements", () => {
  it("keeps required skipped obligations when a replan tries to weaken them", async () => {
    // Given a declared obligation and a replacement claiming it is optional and passed.
    const f = fixture();
    // When both plans are skipped through the real session tool dispatcher.
    await f.run([[plan([size]), skip], [plan([{ ...size, required: false, passed: true, criteria: [{ kind: "eventCount", target, count: 0 }] }]), skip]]);
    // Then scheduler completion cannot replace the original denominator or bindings.
    expect(f.session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [{ id: "size", required: true, evidence: [{ passed: false }] }] });
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]).toMatchObject({ status: "skipped", requirementIds: ["size"] });
  });

  it("allows optional skipped work without labeling it verified", async () => {
    // Given an optional unmet requirement.
    const f = fixture();
    // When its scheduling item is skipped.
    await f.run([[plan([{ ...size, required: false }]), skip]]);
    // Then the required denominator is satisfied, not the optional evidence.
    expect(f.session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [{ required: false, status: "working", evidence: [{ passed: false }] }] });
  });

  it.each([null, [], [{ ...size, required: "false" }], [{ ...size, criteria: [{ kind: "invented", passed: true }] }], [{ ...size, required: false, criteria: null }]])("fails closed for malformed declarations %j", async requirements => {
    // Given malformed model data; when adopted and skipped; then repair remains necessary.
    const f = fixture();
    await f.run([[plan(requirements), skip]]);
    expect(f.session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [{ required: true, status: "blocked" }] });
  });

  it("preserves requirements and item links through the planner parser", () => {
    // Given the planner transport's JSON shape.
    const raw = plan([size]).args;
    // When parsed and materialized by the actual planner API.
    const parsed = parseOrchestratorDecision(JSON.stringify({ ...raw, action: "new_plan" })).decision;
    if (!parsed || parsed.action === "direct" || parsed.action === "resume") throw new Error("Expected a plan decision");
    const result = workPlanFromOrchestratorDecision(parsed);
    // Then the independent requirement contract survives normalization.
    expect(result).toMatchObject({ requirements: [{ id: "size", required: true }], layers: [{ items: [{ requirementIds: ["size"] }] }] });
  });

  it("keeps a bare legacy scheduler plan unassessed", async () => {
    // Given no declared or inferred spatial contract; when the plan is skipped; then no assessment is fabricated.
    const f = fixture();
    await f.run([[plan(), skip]]);
    expect(f.session.getAcceptanceSnapshot()).toBeNull();
  });

  it("assesses existing explicit acceptance without requiring the new field", async () => {
    // Given legacy explicit acceptance; when skipped; then its measured failure remains authoritative.
    const f = fixture();
    await f.run([[{ name: "set_work_plan", args: { ...plan().args, acceptance: [size] } }, skip]]);
    expect(f.session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [{ id: "size", evidence: [{ passed: false }] }] });
  });

  it("binds original text and scope at the host boundary despite fabricated source and withdrawal", async () => {
    // Given model-authored user/withdrawal claims unrelated to the actual request.
    const f = fixture();
    const scope = { mapId: target.mapId, region: { x: 1, y: 2, width: 3, height: 4 } };
    // When the host submits the real scoped request.
    await f.run([[plan([{ ...size, source: { text: "FORGED", requestId: "fake" }, withdrawal: { reason: "FORGED" } }]), skip]], { scope }, "ORIGINAL");
    // Then only host facts own provenance and the requirement remains open.
    expect(f.session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [{ source: { text: "ORIGINAL", scope }, required: true }] });
    expect(f.session.getAcceptanceSnapshot()?.items[0]?.withdrawal).toBeUndefined();
  });

  it("withdraws only the named current requirement through the user-only API", async () => {
    // Given a blocked real requirement and its host scope ID.
    const f = fixture();
    await f.run([[plan([size]), skip]]);
    const snapshot = f.session.getAcceptanceSnapshot();
    if (!snapshot) throw new Error("Expected assessment");
    // When the user explicitly removes that requirement from this goal.
    const accepted = f.session.withdrawRequirement({ acceptanceId: snapshot.id, requirementId: "size", reason: "User changed scope" });
    // Then metadata records authorization without manufacturing passing evidence.
    expect(accepted).toBe(true);
    expect(f.session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [{ status: "blocked", withdrawal: { source: "user", reason: "User changed scope", acceptanceId: snapshot.id }, evidence: [{ passed: false }] }] });
    expect([...WORK_PLAN_TOOLS, ...ACCEPTANCE_TOOLS].map(tool => tool.function.name)).not.toContain("withdraw_requirement");
  });

  it("keeps sibling obligations when the user withdraws just one", async () => {
    // Given two required obligations in one canonical goal.
    const f = fixture();
    await f.run([[plan([size, { ...size, id: "sibling" }]), skip]]);
    const snapshot = f.session.getAcceptanceSnapshot();
    if (!snapshot) throw new Error("Expected assessment");
    // When the user removes one named obligation.
    f.session.withdrawRequirement({ acceptanceId: snapshot.id, requirementId: "size", reason: "Scoped removal" });
    // Then the sibling still blocks completion and the original source remains immutable.
    expect(f.session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [{ withdrawal: { requirementId: "size" } }, { id: "sibling", status: "blocked" }] });
    expect(Object.isFrozen(f.session.getAcceptanceSnapshot()?.items[0]?.source)).toBe(true);
  });

  it("rejects model tool withdrawal even with fabricated user provenance", async () => {
    // Given a required goal and a fabricated user action in the model's tool output.
    const f = fixture();
    // When the model attempts to dispatch a user-only action.
    await f.run([[plan([size]), skip], [{ name: "withdraw_requirement", args: { acceptanceId: "acceptance-1", requirementId: "size", source: "user", reason: "Fabricated" } }]]);
    // Then no dispatcher grants authority to that tool name or source claim.
    expect(f.session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [{ id: "size", required: true }] });
    expect(f.session.getAcceptanceSnapshot()?.items[0]?.withdrawal).toBeUndefined();
  });

  it("rejects stale goal withdrawal actions", async () => {
    // Given the current goal differs from the action's scope.
    const f = fixture();
    await f.run([[plan([size]), skip]]);
    // When an old UI action is dispatched; then the active denominator stays open.
    expect(f.session.withdrawRequirement({ acceptanceId: "old-goal", requirementId: "size", reason: "Old action" })).toBe(false);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
  });

  it("does not erase old obligations on a model resetsContext claim", async () => {
    // Given a blocked goal and a model claiming a reset.
    const f = fixture();
    await f.run([[plan([size]), skip]]);
    const before = f.session.getAcceptanceSnapshot();
    f.setIntent({ mode: "other", resetsContext: true });
    // When an unrelated-looking message is interpreted by the model.
    await f.run([], {}, "Another question");
    // Then only a host action can retire the active goal.
    expect(f.session.getAcceptanceSnapshot()?.id).toBe(before?.id);
    expect(f.session.getAcceptanceSnapshot()?.items[0]?.id).toBe("size");
  });

  it("archives an incomplete goal when the user explicitly starts a new goal", async () => {
    // Given prior incomplete requirements.
    const f = fixture();
    await f.run([[plan([size]), skip]]);
    const before = f.session.getAcceptanceSnapshot();
    // When the host dispatches a genuine new-goal action.
    await f.run([], { goalAction: "new-goal" }, "New unrelated task");
    // Then old history is retained, not rewritten as satisfied.
    expect(f.session.getAcceptanceSnapshot()).toBeNull();
    expect(f.session.getAcceptanceHistory()).toEqual([before]);
  });
});

describe("exact scoped verdict authority", () => {
  it.each(["explicit", "wrong-target", "stale", "advisory", "advisory-after-stale", "advisory-after-explicit", "negative", "model"] as const)("evaluates %s evidence without tool-name credit", source => {
    // Given a canonical criterion bound to the complete verification invocation.
    const project = createBlankProject();
    const args = { mapId: target.mapId, from: { x: 0, y: 0 }, to: [{ x: 1, y: 1 }] };
    const promises = parseAcceptance([{ id: "route", title: "Route", criteria: [{ kind: "toolVerdict", tool: "check_reachability", args }], passed: true }]);
    const ledger = new AssistantAcceptanceLedger("goal", "Route", project);
    ledger.adopt(promises ?? []);
    const evidence = new ToolVerificationEvidence();
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
    draft.name = "Unapplied";
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_lint", {}, { ok: true, data: { counts: { errors: 0 } } });
    const ledger = new AssistantAcceptanceLedger("draft", "Draft", applied);
    ledger.adopt(parseAcceptance([{ id: "lint", title: "Lint", criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }] }]) ?? []);
    // When assessed against applied content; then passing draft evidence is not goal satisfaction.
    expect(ledger.evaluate(applied, draft, evidence).status).toBe("verifying");
  });

  it("retires scoped verdicts after applied content changes even if later undone", async () => {
    // Given a real successful reachability check.
    const f = fixture();
    const args = { mapId: target.mapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 0 }] };
    await f.run([[plan([{ id: "route", title: "Route", criteria: [{ kind: "toolVerdict", tool: "check_reachability", args }] }]), skip], [{ name: "check_reachability", args }]]);
    const original = f.session.baselineProject;
    const changed = structuredClone(original);
    changed.name = "External edit";
    f.session.refreshAcceptance(changed);
    // When the earlier project is restored; then stale proof cannot revive through content equality.
    f.session.refreshAcceptance(original);
    expect(f.session.getAcceptanceSnapshot()?.items[0]?.evidence[0]?.passed).toBe(false);
  });

  it("rejects pre-declaration evidence after an external rebase", async () => {
    // Given a real verdict recorded before the model declares its requirement.
    const f = fixture();
    const args = { mapId: target.mapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 0 }] };
    await f.run([[{ name: "check_reachability", args }]]);
    const changed = structuredClone(f.session.baselineProject);
    changed.name = "Changed before contract adoption";
    f.session.rebaseProject(changed);
    // When the requirement is adopted later without a new verification call.
    await f.run([[plan([{ id: "route", title: "Route", criteria: [{ kind: "toolVerdict", tool: "check_reachability", args }] }]), skip]]);
    // Then the pre-change verdict cannot satisfy the new contract.
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
  });

  it("credits a real scoped tool response through the session dispatcher", async () => {
    // Given a real reachability invocation against a small blank map.
    const f = fixture();
    const args = { mapId: target.mapId, from: { x: 0, y: 0 }, targets: [{ x: 1, y: 0 }] };
    // When the session executes the tool, not a model-authored verdict.
    await f.run([[plan([{ id: "route", title: "Route", criteria: [{ kind: "toolVerdict", tool: "check_reachability", args }] }]), skip], [{ name: "check_reachability", args }]]);
    // Then the real result supplies the canonical verdict.
    expect(f.events.find(event => event.type === "tool_call" && event.name === "check_reachability")).toMatchObject({ result: { ok: true } });
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });
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
