import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { ToolVerificationEvidence, parseVerificationChecks } from "@/ai/toolVerificationEvidence";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { parseOrchestratorDecision, workPlanFromOrchestratorDecision, workPlanFromSetToolArgs } from "@/ai/workPlan";
import { createBlankProject } from "@/project/defaults";
import { getTool, runTool } from "@/editor/tools";
import type { ReviewInput } from "@/ai/independentReview";
import { independentReviewPayload } from "./independentReviewFixture";
import { fixedDeclarer } from "./intentFixture";
import { verificationEvent, verificationJourney } from "./fixtures/verificationOwnership";

const reach = "check_reachability";
const scene = "run_scene_test";
type Call = { name: string; args: Record<string, unknown> };
afterEach(() => vi.restoreAllMocks());

function rig() {
  const f = verificationJourney();
  const acceptance = new AssistantAcceptanceLedger("retained", "Original routes", f.project);
  const villageRoute = { mapId: f.village.id, from: { x: 10, y: 12 }, targets: [{ x: 5, y: 8 }, { x: 10, y: 9 }, { x: 18, y: 7 }, { x: 10, y: 1 }] };
  const cellarRoute = { mapId: f.cellar.id, from: { x: 6, y: 9 }, targets: [{ x: 6, y: 3 }] };
  acceptance.adopt([villageRoute, cellarRoute].map((args, i) => ({ id: `route-${i}`, title: "Route", criteria: [
    { kind: "reachability", target: { mapId: args.mapId }, from: args.from, to: args.targets },
  ] })));
  acceptance.evaluate(f.project);
  const evidence = new ToolVerificationEvidence();
  for (const binding of acceptance.verificationOwnership(f.project)) {
    if (binding.criterion.kind !== "reachability") throw new Error("Unexpected criterion");
    evidence.adopt({ checkId: binding.promiseId, ownerId: binding.promiseId, name: reach,
      args: { mapId: binding.mapId, from: binding.criterion.from, targets: binding.criterion.to },
      criterion: { promiseId: binding.promiseId, criterionIndex: binding.criterionIndex }, acceptedCriterion: binding.criterion });
    evidence.setCriterionPassed(binding.promiseId, binding.passed);
  }
  const terminal = () => acceptance.evaluate(f.project, f.project, evidence, evidence.problems());
  return { ...f, acceptance, evidence, villageRoute, cellarRoute, terminal };
}

describe("immutable requirements, findings and attempts at both ledgers", () => {
  it("retains both original exact routes, later adoption and original owners independently", () => {
    const f = rig();
    for (const args of [f.villageRoute, f.cellarRoute]) f.evidence.observe(reach, args, runTool({ project: f.project }, reach, args));
    expect(f.terminal().status).toBe("verified");
    const later = { ...f.villageRoute, from: { x: 4, y: 6 } };
    f.evidence.observe(reach, later, runTool({ project: f.project }, reach, later));
    f.evidence.adopt({ checkId: "later", ownerId: "later-owner", name: reach, args: later });
    expect(f.terminal().status).toBe("blocked");
    expect(f.evidence.snapshot().requirements.find(r => r.checkId === "later")?.status).toBe("unverified");
    f.evidence.adopt({ checkId: "route-0", ownerId: "reused-scheduling-id", name: reach, args: later });
    expect(f.evidence.snapshot().requirements.find(r => r.checkId === "route-0")).toMatchObject({ ownerId: "route-0", args: f.villageRoute });
    f.evidence.observe(reach, later, runTool({ project: f.project }, reach, later));
    expect(f.terminal().status).toBe("verified");
    f.evidence.invalidateAfterWrite();
    f.evidence.observe(reach, later, runTool({ project: f.project }, reach, later));
    expect(f.terminal().status).toBe("blocked");
    expect(f.evidence.snapshot().requirements.filter(r => r.status === "stale").map(r => r.args)).toEqual([f.villageRoute, f.cellarRoute]);
  });

  it.each(["start", "subset", "map", "adjacency"])("a changed %s does not satisfy the accepted route", variant => {
    const f = rig();
    let args = structuredClone(f.villageRoute);
    if (variant === "start") args.from.x--;
    if (variant === "subset") args.targets.pop();
    if (variant === "map") args.mapId = f.cellar.id;
    if (variant === "adjacency") {
      f.village.events.push(verificationEvent("solid", 5, 8, []));
      const bound = f.acceptance.verificationOwnership(f.project).find(b => b.promiseId === "route-0")!;
      expect(bound.passed).toBe(false);
      f.evidence.setCriterionPassed("route-0", bound.passed);
    }
    const result = runTool({ project: f.project }, reach, args);
    expect(result).toMatchObject({ ok: true, data: { reachable: true } });
    f.evidence.observe(reach, args, result);
    expect(f.evidence.snapshot().requirements.find(r => r.checkId === "route-0")?.status).toBe("unverified");
    expect(f.terminal().status).toBe("blocked");
  });

  it("wire114 and execution errors are unsuccessful attempts, never artifact verdicts", () => {
    const f = rig();
    const args = { mapId: f.village.id, from: { x: 10, y: 8 }, targets: [{ newMapName: "지하실", mapId: f.village.id }] };
    const result = runTool({ project: f.project }, reach, args);
    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
    f.evidence.observe(reach, args, result, "explicit", "route-0");
    f.evidence.observe(reach, f.cellarRoute, { ok: false, summary: "executor failed" }, "explicit", "route-1");
    expect(f.evidence.snapshot().findings).toEqual([]);
    expect(f.evidence.snapshot().attempts.map(a => a.status)).toEqual(["unsuccessful", "unsuccessful"]);
    expect(f.terminal().status).toBe("blocked");
    for (const route of [f.villageRoute, f.cellarRoute]) f.evidence.observe(reach, route, runTool({ project: f.project }, reach, route));
    expect(f.terminal().status).toBe("verified");
  });

  it("keeps a genuine exploratory blocked route until its exact compatible rerun", () => {
    const f = rig();
    for (let y = 0; y < f.village.height; y++) f.village.lowerTiles[y * f.village.width + 13] = 342;
    const args = { mapId: f.village.id, from: { x: 10, y: 8 }, targets: [{ x: 15, y: 8 }] };
    const bad = runTool({ project: f.project }, reach, args);
    expect(bad).toMatchObject({ ok: true, data: { reachable: false } });
    f.evidence.observe(reach, args, bad);
    f.evidence.observe(reach, f.cellarRoute, runTool({ project: f.project }, reach, f.cellarRoute));
    expect(f.evidence.snapshot().findings).toHaveLength(1);
    expect(f.terminal().status).toBe("blocked");
    expect(f.evidence.correction("unknown-id", args)).toBeNull();
    const original = f.evidence.snapshot().findings[0]!;
    f.evidence.observe(reach, args, { ok: false }, "explicit", undefined, original.checkId);
    expect(f.evidence.snapshot().findings).toEqual([original]);
    f.evidence.invalidateAfterWrite();
    expect(f.evidence.snapshot().findings).toEqual([original]);
  });

  it("a foreign check ID cannot discharge the original owner even with identical tool inputs", () => {
    const f = rig();
    for (const args of [f.villageRoute, f.cellarRoute]) f.evidence.observe(reach, args, runTool({ project: f.project }, reach, args));
    for (const ownerId of ["original-owner", "foreign-owner"]) f.evidence.adopt({ checkId: ownerId, ownerId, name: reach, args: f.villageRoute });
    f.evidence.observe(reach, f.villageRoute, { ok: true, data: { reachable: false } }, "explicit", "original-owner", "original-owner");
    const original = f.evidence.snapshot().findings[0]!;
    const correction = f.evidence.correction("foreign-owner", f.villageRoute)!;
    const passed = runTool({ project: f.project }, correction.name, correction.args);
    f.evidence.observe(correction.name, correction.args, passed, "explicit", "foreign-owner", "foreign-owner");
    expect(f.evidence.snapshot().findings).toEqual([original]);
    expect(f.evidence.snapshot().requirements.find(r => r.checkId === "original-owner")?.status).toBe("unverified");
    expect(f.terminal().status).toBe("blocked");
    f.evidence.observe(reach, f.villageRoute, passed);
    expect(f.terminal().status).toBe("verified");
  });

  it.each([false, true])("dummy pass then removal creates obligations only when adopted=%s", adopted => {
    const f = rig();
    for (const route of [f.villageRoute, f.cellarRoute]) f.evidence.observe(reach, route, runTool({ project: f.project }, reach, route));
    const dummy = verificationEvent("ev_dummy_fix", 6, 4, []);
    f.cellar.events.push(dummy);
    const args = { mapId: f.cellar.id, start: { x: 6, y: 3 }, steps: [{ kind: "interact", eventId: dummy.id }] };
    if (adopted) f.evidence.adopt({ checkId: "dummy", ownerId: "dummy-owner", name: scene, args,
      interactionTargets: [{ stepIndex: 0, mapId: f.cellar.id, eventId: dummy.id }] });
    const result = runTool({ project: f.project }, scene, args);
    expect(result).toMatchObject({ ok: true, data: { ok: true } });
    f.evidence.observe(scene, args, result);
    f.cellar.events = f.cellar.events.filter(e => e.id !== dummy.id);
    f.evidence.invalidateAfterWrite();
    for (const route of [f.villageRoute, f.cellarRoute]) f.evidence.observe(reach, route, runTool({ project: f.project }, reach, route));
    expect(f.terminal().status).toBe(adopted ? "blocked" : "verified");
    expect(f.cellar.events.map(e => e.id)).not.toContain(dummy.id);
  });

  it("declarations pass both parsing paths; malformed and unscoped tools stay pending", () => {
    const f = rig();
    const checks = [{ tool: reach, criterion: { promiseId: "route-0", criterionIndex: 0 } },
      { tool: scene, args: f.wire180, interactionTargets: [{ stepIndex: 2, mapId: f.cellar.id, eventId: f.chest.id },
        { stepIndex: 6, mapId: f.village.id, eventId: f.chief.id }, { stepIndex: 9, mapId: f.village.id, eventId: f.chief.id }] }];
    const plan = { goal: "Declared checks", layers: [{ title: "QA", items: [{ title: "Check", instruction: "Check", successTools: [reach, scene], verificationChecks: checks }] }] };
    const parsed = parseOrchestratorDecision(JSON.stringify({ action: "new_plan", ...plan }));
    if (!parsed.decision || parsed.decision.action !== "new_plan") throw new Error("Plan parsing failed");
    expect(workPlanFromOrchestratorDecision(parsed.decision).layers[0]?.items[0]?.verificationChecks).toEqual(checks);
    expect(workPlanFromSetToolArgs(plan)?.layers[0]?.items[0]?.verificationChecks).toEqual(checks);
    expect(parseVerificationChecks([{ tool: scene, args: f.wire180 }])).toBeUndefined();
    expect(parseVerificationChecks([...checks, { tool: reach, args: { mapId: f.village.id } }])).toBeUndefined();
    f.evidence.adopt({ checkId: "pending", ownerId: "pending-owner", name: reach, args: null });
    f.evidence.observe(reach, f.villageRoute, runTool({ project: f.project }, reach, f.villageRoute), "explicit", "pending-owner");
    expect(f.evidence.snapshot().requirements.find(r => r.checkId === "pending")?.status).toBe("pending-specification");
  });
});

function response(calls: Call[], round: number): ChatResult {
  return { message: { role: "assistant", content: null, tool_calls: calls.map((call, i) => ({ id: `${round}-${i}`, type: "function",
    function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, finishReason: "tool_calls" };
}

describe("normal session ownership through skip, replan and continuation", () => {
  it("reused scheduling IDs cannot waive pending scopes; late specification needs a fresh execution", async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const args = { mapId, from: { x: 10, y: 12 }, targets: [{ x: 5, y: 8 }] };
    const events: SessionEvent[] = [];
    const plan = (verificationChecks?: unknown[]) => ({ goal: "Retained route", acceptance: [{ id: "preserve", title: "Map", criteria: [{ kind: "preserve", target: { mapId } }] }],
      layers: [{ title: "QA", items: [{ id: "same-id", title: "Route", instruction: "Check", successTools: [reach], mapTargets: [mapId], verificationChecks }] }] });
    let round = 0;
    let stage = 0;
    let session: AssistantSession;
    session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 4 },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, source: "continuation" }),
      chat: async (_config, request) => {
        if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" };
        round++;
        if (stage === 0) {
          stage++;
          return response([{ name: "set_work_plan", args: plan() }, { name: reach, args }, { name: "skip_work_item", args: {} }], round);
        }
        if (stage === 2) {
          stage++;
          const pending = session.getVerificationSnapshot().requirements.find(r => r.status === "pending-specification")!;
          return response([{ name: "set_work_plan", args: plan([{ tool: reach, args, checkId: pending.checkId }]) },
            { name: "complete_work_item", args: {} }], round);
        }
        if (stage === 4) {
          stage++;
          return response([{ name: reach, args }, { name: "complete_work_item", args: {} }], round);
        }
        if (stage === 6) {
          stage++;
          const later = { ...args, from: { x: 4, y: 6 } };
          return response([{ name: "set_work_plan", args: plan([{ tool: reach, args: later }]) },
            { name: "set_title_screen", args: { title: "Later revision" } }, { name: reach, args: later }], round);
        }
        return { message: { role: "assistant", content: "Checks recorded." }, finishReason: "stop" };
      },
    });
    const snapshots = () => ({ plan: session.getWorkPlan(), acceptance: session.getAcceptanceSnapshot(), verification: session.getVerificationSnapshot() });
    let beforeSkip: ReturnType<typeof snapshots> | undefined;
    const first = await session.sendUserMessage("Inspect the retained route.", event => {
      events.push(event);
      if (event.type === "tool_call" && event.name === reach) beforeSkip = snapshots();
      if (event.type === "tool_call" && event.name === "skip_work_item") {
        expect(event.result.ok).toBe(false);
        expect(snapshots()).toEqual(beforeSkip);
      }
    });
    const original = session.getVerificationSnapshot().requirements[0]!;
    expect(original.status).toBe("pending-specification");
    expect(first.workPlan?.layers[0]?.items[0]?.status).not.toBe("skipped");
    expect(events.filter(e => e.type === "tool_call" && e.name === "skip_work_item").map(e => e.type === "tool_call" && e.result.ok)).toEqual([false]);
    expect(session.getAcceptanceSnapshot()?.status).toBe("blocked");
    stage = 2;
    await session.sendUserMessage("Continue.", event => events.push(event));
    const specified = session.getVerificationSnapshot().requirements.find(r => r.checkId === original.checkId)!;
    expect(specified).toMatchObject({ ownerId: original.ownerId, status: "unverified", args });
    expect(session.getAcceptanceSnapshot()?.status).toBe("blocked");
    stage = 4;
    await session.sendUserMessage("Continue.", event => events.push(event));
    expect(session.getAcceptanceSnapshot()?.status).toBe("verified");
    expect(session.getVerificationSnapshot().requirements).toHaveLength(1);
    const externallyEdited = session.getProposedProject();
    externallyEdited.session.gold = 99;
    expect(session.syncBaselineFromStoreIfClean(externallyEdited)).toBe(true);
    expect(session.getVerificationSnapshot().requirements[0]?.status).toBe("stale");
    expect(session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(events.filter(e => e.type === "tool_call" && e.name === "complete_work_item").map(e => e.type === "tool_call" && e.result.ok)).toEqual([false, true]);
    stage = 6;
    await session.sendUserMessage("Continue.", event => events.push(event));
    const retained = session.getVerificationSnapshot().requirements;
    expect(retained).toHaveLength(2);
    expect(retained.find(r => r.checkId === original.checkId)).toMatchObject({ ownerId: original.ownerId, status: "stale", args });
    expect(retained.find(r => r.checkId !== original.checkId)?.ownerId).not.toBe(original.ownerId);
    expect(session.getAcceptanceSnapshot()?.status).toBe("blocked");
  });

  it("normal session correction executes the registered original tool; unknown IDs and execution errors cannot clear a finding", async () => {
    const f = verificationJourney();
    let round = 0;
    let session: AssistantSession;
    const events: SessionEvent[] = [];
    const runner = getTool(scene)!;
    const originalRun = runner.run;
    session = new AssistantSession(f.project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 12 },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
      chat: async () => {
        round++;
        if (round === 1) return response([{ name: "set_work_plan", args: { goal: "Journey check", acceptance: [{ id: "preserve", title: "Map", criteria: [{ kind: "preserve", target: { mapId: f.village.id } }] }],
          layers: [{ title: "QA", items: [{ title: "Inspect", instruction: "Inspect", successTools: ["get_project_summary"] }] }] } }, { name: scene, args: { ...f.wire180 } }], round);
        const id = session.getVerificationSnapshot().findings[0]?.checkId;
        if (round === 2) return response([{ name: "correct_verification", args: { checkId: "unknown", args: f.wire181 } },
          { name: "correct_verification", args: { checkId: id, args: { ...f.wire181, start: { x: 1, y: 1 } } } }], round);
        if (round === 3) {
          vi.spyOn(runner, "run").mockImplementationOnce(() => { throw new Error("injected execution failure"); }).mockImplementation(originalRun);
          return response([{ name: "correct_verification", args: { checkId: id, args: f.wire181 } }], round);
        }
        if (round === 4) {
          expect(session.getVerificationSnapshot().findings).toHaveLength(1);
          expect(session.getAcceptanceSnapshot()?.status).toBe("blocked");
          return response([{ name: "correct_verification", args: { checkId: id, args: f.wire181 } }, { name: "get_project_summary", args: {} }], round);
        }
        return { message: { role: "assistant", content: "Checks recorded." }, finishReason: "stop" };
      },
    });
    await session.sendUserMessage("Inspect the journey.", event => events.push(event));
    expect(events.filter(e => e.type === "tool_call" && e.name === "correct_verification").map(e => e.type === "tool_call" && e.result.ok)).toEqual([false, false, false, true]);
    expect(session.getVerificationSnapshot().findings).toEqual([]);
    expect(session.getVerificationSnapshot().attempts.map(a => a.status)).toEqual(["negative", "unsuccessful", "passed"]);
    expect(session.getAcceptanceSnapshot()?.status).toBe("verified");
  });
});

describe("authoring revalidates explicit checks before finalizing", () => {
  it("continues after a final claim when a real write made the prior lint stale", async () => {
    const project = createBlankProject();
    const item = project.database.items[0];
    const events: SessionEvent[] = [];
    const reviews: ReviewInput[] = [];
    const calls = [
      { name: "set_work_plan", args: { goal: "Required lint",
        layers: [{ title: "Check", items: [{ title: "Price", instruction: "Change price and revalidate", successTools: ["run_lint"],
          verificationChecks: [{ tool: "run_lint", args: {} }] }] }] } },
      { name: "run_lint", args: {} },
      { name: "upsert_item", args: { item: { id: item.id, price: 321 } } },
      null,
      { name: "run_lint", args: {} },
    ];
    let round = 0;
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 },
      declareIntent: fixedDeclarer({ mode: "modify", space: "none", targetMapId: null, needsPlan: false, tools: ["run_lint", "upsert_item"] }),
      chat: async (_config, request): Promise<ChatResult> => {
        const review = independentReviewPayload(request);
        if (review) {
          reviews.push(review);
          // The model pass cannot override a stale explicit check. The real
          // review parser must request repair before accepting the rechecked draft.
          return { finishReason: "stop", message: { role: "assistant", content: JSON.stringify({
            revision: review.revision, verdict: "approved", summary: "REVALIDATED_FINAL", findings: [],
          }) } };
        }
        const index = round++, call = calls[index];
        return call
          ? { finishReason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{
            id: `call-${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
          }] } }
          : { finishReason: "stop", message: { role: "assistant", content: index < 5 ? "EARLY_FINAL" : "REVALIDATED_FINAL" } };
      },
    });
    const result = await session.sendUserMessage("Change the item price and verify it", event => events.push(event));
    expect(events.filter(event => event.type === "tool_call" && event.name === "run_lint")).toHaveLength(2);
    expect(reviews).toHaveLength(2);
    const ownedLint = session.getVerificationSnapshot().requirements.find(requirement => requirement.name === "run_lint");
    expect(ownedLint).toMatchObject({ name: "run_lint", args: {} });
    expect(reviews[0]?.requiredProblems.join("\n")).toContain(`[${ownedLint!.checkId}]`);
    expect(reviews[1]?.requiredProblems).toEqual([]);
    expect(events.filter(event => event.type === "result_review").map(event => event.review.status))
      .toEqual(["changes_requested", "approved"]);
    expect(result.stoppedReason).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(session.isDraftReviewApproved()).toBe(true);
    expect(result.assistantText).toBe("REVALIDATED_FINAL");
    expect(session.getProposedProject().database.items.find(record => record.id === item.id)?.price).toBe(321);
  });

  it("retains genuine advisory findings without inventing adopted requirements", () => {
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_lint", {}, { ok: true, data: { issues: [{ severity: "error", message: "existing advisory finding" }] } }, "advisory");
    expect(evidence.problems()).toHaveLength(1);
    expect(evidence.snapshot().requirements).toEqual([]);
    expect(evidence.snapshot().findings).toHaveLength(1);
  });
});
