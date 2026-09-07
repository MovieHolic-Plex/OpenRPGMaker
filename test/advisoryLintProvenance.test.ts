import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { runTool } from "@/editor/tools";
import * as lintProducer from "@/editor/tools/queryTools";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import * as commits from "@/project/projectCommitLog";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { _resetEditActivityForTest } from "@/editor/editActivityLog";
import { fixedDeclarer } from "./intentFixture";
import { verificationEvent } from "./fixtures/verificationOwnership";
import { offlineChatResponse } from "./fixtures/offlineChatResponse";

const brokenEvent = (switchId: string) => verificationEvent("ev_broken", 2, 2, [{ kind: "setSwitch", switchId, value: true }]);
function errors(result: ReturnType<typeof runTool>) {
  const data = result.data as { counts: { errors: number }; issues: { code: string; message: string; severity: string }[] };
  const found = data.issues.filter(issue => issue.severity === "error");
  expect(found).toHaveLength(data.counts.errors);
  return found;
}
const final = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const tools = (...calls: { name: string; args: unknown }[]): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: calls.map((call, index) => ({ id: `${call.name}-${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, finishReason: "tool_calls" });
afterEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  _resetEditActivityForTest(); resetMapEditHistory(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

async function titleRun(kind: "unchanged" | "adopted" | "introduced" | "different-identity" | "explicit" | "unknown") {
  const project = createBlankProject();
  const mapId = project.startMapId;
  if (kind !== "introduced") project.maps[mapId]!.events.push(brokenEvent("sw_missing_xyz"));
  const before = errors(runTool({ project }, "run_lint", {}));
  if (kind !== "introduced") expect(before.map(issue => issue.code).sort()).toEqual(["reference-validation", "serialize-roundtrip"]);
  else expect(before).toEqual([]);
  const baselineCapture = vi.spyOn(lintProducer, "runProjectLint");
  if (kind === "unknown") baselineCapture.mockImplementationOnce(() => { throw new Error("BASELINE_UNAVAILABLE"); });
  const network = vi.fn<typeof fetch>(async input => {
    if (String(input) !== "/__oprn/edit-activity") throw new Error(`Unexpected transport: ${String(input)}`);
    return Response.json({ ok: true }); // Only the known optional activity mirror; no actual HTTP.
  });
  vi.stubGlobal("fetch", network);
  // Keep the actual commit gate, application and scene store; replace only external commit logging.
  vi.spyOn(commits, "recordProjectCommit").mockResolvedValue({ commitId: null, persisted: false, reviewStatus: "approved", summary: "fixture",
    toolNames: [], recordedAt: "2026-09-07T00:00:00.000Z" });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(project);
  resetMapEditHistory();
  const plan = { goal: "Title only",
    ...(kind === "adopted" ? { requirements: [{ id: "required-lint", title: "Lint", criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }] }] } : {}),
    layers: [{ title: "Title", items: [{ id: "title", title: "Title", instruction: "Set title", successTools: ["set_title_screen"] }] }],
  };
  const responses = [final(JSON.stringify({ action: "new_plan", ...plan })),
    tools({ name: "set_work_plan", args: plan }, ...(kind === "explicit" ? [{ name: "run_lint", args: {} }] : [])),
    tools({ name: "set_title_screen", args: { title: "TITLE_APPLIED" } }), final("TITLE_COMPLETE")];
  let index = 0;
  let continuing = false;
  const events: SessionEvent[] = [];
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "auto", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
    chat: async (_config, request): Promise<ChatResult> => {
      if (continuing) return offlineChatResponse(final(request.tools?.length ? "CONTINUED" : JSON.stringify({ action: "resume" })));
      const next = responses[index++];
      if (next) return offlineChatResponse(next);
      // The unchanged title-only reproduction has exactly the original four responses.
      if (kind === "unchanged") throw Object.assign(new Error("scripted chat exhausted"), { name: "LlmError", status: 401 });
      if (index > 8) throw new Error("Repair was not bounded");
      return offlineChatResponse(final("UNRESOLVED_CONTROL"));
    },
  });
  const result = await session.sendUserMessage("Change only the title.", event => {
    events.push(event);
    if (event.type === "tool_call" && event.name === "set_work_plan" && ["introduced", "different-identity"].includes(kind)) {
      // A same-goal host edit/rebase after pre-write capture must not reset provenance.
      const changed = session.getProposedProject();
      changed.maps[mapId]!.events = [brokenEvent("sw_missing_different")];
      store.replace(changed);
      session.rebaseProject(store.getCurrent());
    }
  }, undefined, { autonomous: true });
  expect(network.mock.calls.every(([input]) => String(input) === "/__oprn/edit-activity")).toBe(true);
  expect(baselineCapture).toHaveBeenCalledTimes(1);
  expect(store.getCurrent().meta.title).toBe("TITLE_APPLIED");
  expect(session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
  const lintCalls = events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call" && event.name === "run_lint");
  expect(lintCalls).toHaveLength(kind === "explicit" ? 2 : 1);
  const after = errors(lintCalls.at(-1)!.result);
  expect(session.getVerificationSnapshot().findings.length).toBeGreaterThan(0);
  expect(result.completionAssessment?.verification.length).toBeGreaterThan(0);
  expect(session.getAuditEntries().some(entry => entry.kind === "status" && entry.text.startsWith("agent_run:verification-advisory"))).toBe(true);
  expect(session.getAuditEntries().some(entry => entry.kind === "status" && entry.text.startsWith("agent_run:verification-note"))).toBe(true);
  return { session, result, before, after, requests: index, baselineCapture,
    async resume() {
      continuing = true;
      return session.sendUserMessage("Continue.", undefined, undefined, { goalAction: "resume", autonomous: true });
    } };
}

describe("pre-write provenance of automatic lint findings", () => {
  it("reports unchanged baseline defects without terminal repair of the real title-only change", async () => {
    const f = await titleRun("unchanged");
    expect(f.after).toEqual(f.before);
    expect(f.result.stoppedReason).toBe("final");
    expect(f.result.runOutcome).toMatchObject({ execution: "response-final", delivery: "applied" });
    expect(f.requests).toBe(4);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([]);
    expect(f.result.assistantText).toContain("sw_missing_xyz");
    expect(f.result.completionAssessment?.blockingVerification).toEqual([]);
    expect(f.session.getVerificationSnapshot().findings[0]?.source).toBe("advisory");
    const finding = f.session.getVerificationSnapshot().findings[0];
    f.session.rebaseProject(store.getCurrent());
    const continued = await f.resume();
    expect(continued.runOutcome?.execution).toBe("response-final");
    expect(continued.completionAssessment?.blockingVerification).toEqual([]);
    expect(f.session.getVerificationSnapshot().findings).toEqual([finding]);
    expect(f.baselineCapture).toHaveBeenCalledTimes(1);
  });

  it.each(["adopted", "introduced", "different-identity", "explicit", "unknown"] as const)("keeps %s lint defects terminally blocking", async kind => {
    const f = await titleRun(kind);
    if (kind === "different-identity") { expect(f.after).toHaveLength(f.before.length); expect(f.after).not.toEqual(f.before); }
    if (kind === "introduced") { expect(f.before).toEqual([]); expect(f.after).toHaveLength(2); }
    if (kind === "adopted" || kind === "explicit") expect(f.after).toEqual(f.before);
    expect(f.result.runOutcome?.execution).toBe("blocked");
    expect(f.result.stoppedReason).toBe("final");
    expect(f.result.completionAssessment?.blockingVerification?.length).toBeGreaterThan(0);
    expect(f.requests).toBeLessThanOrEqual(8);
    if (kind === "adopted") expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    if (kind === "unknown") expect(f.session.getAuditEntries().some(entry => entry.kind === "status" && entry.text.includes("BASELINE_UNAVAILABLE"))).toBe(true);
  });

  it("retains new same-count identities and permanently promotes an explicitly observed baseline defect", () => {
    const project = createBlankProject();
    project.maps[project.startMapId]!.events = [brokenEvent("sw_missing_xyz")];
    const original = runTool({ project }, "run_lint", {});
    const evidence = new ToolVerificationEvidence();
    evidence.captureLintBaseline(original);
    evidence.observe("run_lint", {}, original, "advisory");
    expect(evidence.problems("blocking")).toEqual([]);
    expect(evidence.problems().length).toBeGreaterThan(0);
    expect(evidence.passed("run_lint")).toBe(false);
    const first = evidence.snapshot().findings[0]!;
    project.maps[project.startMapId]!.events = [brokenEvent("sw_missing_different")];
    const changed = runTool({ project }, "run_lint", {});
    expect(errors(changed)).toHaveLength(errors(original).length);
    evidence.invalidateAfterWrite();
    evidence.captureLintBaseline(changed); // Cannot rebase an existing goal's provenance.
    evidence.observe("run_lint", {}, changed, "advisory");
    expect(evidence.snapshot().findings).toHaveLength(2);
    expect(evidence.snapshot().findings[0]).toEqual(first);
    expect(evidence.problems("blocking").join("\n")).toContain("sw_missing_different");
    expect(evidence.problems("blocking").join("\n")).not.toContain("sw_missing_xyz");
    evidence.observe("run_lint", {}, original, "explicit");
    expect(evidence.snapshot().findings).toHaveLength(2);
    expect(evidence.problems("blocking").join("\n")).toContain("sw_missing_xyz");
    evidence.observe("run_lint", {}, original, "advisory");
    expect(evidence.problems("blocking").join("\n")).toContain("sw_missing_xyz");
    project.maps[project.startMapId]!.events = [];
    evidence.observe("run_lint", {}, runTool({ project }, "run_lint", {}), "advisory");
    expect(evidence.snapshot().findings).toEqual([]);
  });

  it("unknown provenance never exempts a genuine automatic lint finding", () => {
    const project = createBlankProject();
    project.maps[project.startMapId]!.events.push(brokenEvent("sw_missing_xyz"));
    const result = runTool({ project }, "run_lint", {});
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_lint", {}, result, "advisory");
    expect(evidence.problems("blocking").length).toBeGreaterThan(0);
    expect(evidence.snapshot().findings).toHaveLength(1);
  });
});
