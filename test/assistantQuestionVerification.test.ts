import { describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent, type SessionTurnOptions } from "@/ai/assistantSession";
import { parseToolVerdict } from "@/ai/agentVerification";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";

type Call = { readonly name: string; readonly args: Readonly<Record<string, unknown>> };
const lint: Call = { name: "run_lint", args: {} };
const answer: ChatResult = { finishReason: "stop", message: { role: "assistant", content: "MODEL_SUCCESS_SENTINEL" } };
const config = { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 } as const;

function toolResponse(calls: readonly Call[]): ChatResult {
  return { finishReason: "tool_calls", message: { role: "assistant", content: null, tool_calls: calls.map((call, i) => ({
    id: `${call.name}_${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
  })) } };
}
function questionSession(project: ReturnType<typeof createBlankProject>, rounds: readonly (readonly Call[])[]) {
  let cursor = 0;
  const events: SessionEvent[] = [];
  const session = new AssistantSession(project, { config,
    declareIntent: fixedDeclarer({ mode: "question", needsPlan: false }),
    chat: async () => { const calls = rounds[cursor++]; return calls ? toolResponse(calls) : answer; },
  });
  const collect = (event: SessionEvent) => events.push(event);
  return { session, events, collect };
}
function verdicts(events: readonly SessionEvent[]) {
  return events.flatMap(event => event.type === "tool_call" && event.name === "run_lint"
    ? [{ ok: event.result.ok, pass: parseToolVerdict(event.name, event.result).pass }] : []);
}

describe("current-question native verification ownership", () => {
  it("retires question B evidence when Resume restores A before raw Ask continuation", async () => {
    // Given authoring A, then a separate question B with a real failed native check.
    const project = createBlankProject(), map = project.maps[project.startMapId];
    if (!map) throw new Error("Missing fixture map");
    map.upperTiles[map.width + 5] = 260;
    const before = structuredClone(project), raw = "Inspect the current map";
    const replies = [toolResponse([{ name: "set_title_screen", args: { title: "RETAINED_A" } }]), answer,
      toolResponse([lint]), answer, answer, answer];
    const events: SessionEvent[] = [];
    const collect = (event: SessionEvent) => events.push(event);
    const session = new AssistantSession(project, { config,
      declareIntent: facts => fixedDeclarer(facts.userText === raw ? {
        mode: "modify", needsPlan: false, requestRequirements: { entries: [{
          source: [{ start: 0, end: raw.length, quote: raw }], bindings: [],
          criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }],
        }] },
      } : { mode: "question", needsPlan: false })(facts),
      chat: async () => {
        const reply = replies.shift();
        if (!reply) throw new Error("Unexpected provider call in owner transition");
        return reply;
      },
    });
    const authoring = await session.sendUserMessage(raw, collect);
    expect(authoring.execution?.requestId).toBe("request-1");
    expect(authoring.proposedCalls.map(call => call.name)).toEqual(["set_title_screen"]);
    expect(verdicts(events)).toEqual([]);
    const question = await session.sendUserMessage("Check the authored map", collect);
    expect(question.execution).toMatchObject({ requestId: "request-2", state: "answer" });
    expect(verdicts(events)).toEqual([{ ok: true, pass: false }]);
    expect(question.runOutcome?.execution).toBe("blocked");
    const questionOutcome = structuredClone(question.runOutcome), draft = session.getProposedProject();
    const resumed = await session.sendUserMessage("continue", collect, undefined, { goalAction: "resume" });
    expect(resumed.execution?.requestId).toBe("request-1");
    expect(verdicts(events)).toEqual([{ ok: true, pass: false }]);
    const sources = session.getHarnessSnapshot().requests, eventAt = events.length;
    // When Ask retains restored A's ID, without a new checker invocation.
    const result = await session.sendUserMessage("continue", collect, undefined, { composerMode: "ask" });
    // Then B's failed check cannot become A's answer evidence or delivery authority.
    expect(result.execution).toMatchObject({ requestId: "request-1", state: "answer" });
    expect(events.slice(eventAt).filter(event => event.type === "tool_call")).toEqual([]);
    expect(result.assistantText).toBe("MODEL_SUCCESS_SENTINEL");
    expect(result.runOutcome).toEqual({ execution: "response-final", goal: "incomplete", delivery: "no-change" });
    expect(result.recap?.runOutcome).toEqual(result.runOutcome);
    expect(session.getHarnessSnapshot().runOutcome).toEqual(result.runOutcome);
    expect(events.at(-1)).toEqual({ type: "run_outcome", runOutcome: result.runOutcome });
    expect(question.runOutcome).toEqual(questionOutcome);
    expect(session.getHarnessSnapshot().requests).toEqual(sources);
    expect(sources).toMatchObject([{ requestId: "request-1", rawInstruction: raw, authoring: true },
      { requestId: "request-2", rawInstruction: "Check the authored map", authoring: false }]);
    expect(session.getAcceptanceSnapshot()?.items[0]?.evidence[0]?.passed).toBe(false);
    expect(session.getProposedProject()).toEqual(draft); expect(project).toEqual(before);
    expect(result.proposedCalls).toEqual([]); expect(result.appliedCalls).toEqual([]);
    expect(replies).toEqual([]);
  });

  it.each([
    { priorFailure: true, currentCheck: false },
    { priorFailure: true, currentCheck: true },
    { priorFailure: false, currentCheck: true },
  ])("isolates retained authoring proof and draft: priorFailure=$priorFailure currentCheck=$currentCheck", async ({ priorFailure, currentCheck }) => {
    // Given an anchored canonical verifier obligation, pending work and a real draft.
    const project = createBlankProject(), map = project.maps[project.startMapId];
    if (!map) throw new Error("Missing fixture map");
    if (priorFailure) map.upperTiles[map.width + 5] = 260;
    const before = structuredClone(project), raw = "Inspect the current map";
    let asking = false, round = 0;
    const events: SessionEvent[] = [];
    const session = new AssistantSession(project, { config,
      declareIntent: facts => fixedDeclarer(asking ? { mode: "question", needsPlan: false } : {
        mode: "modify", needsPlan: false, requestRequirements: { entries: [{
          source: [{ start: 0, end: raw.length, quote: raw }], bindings: [],
          criteria: [{ kind: "toolVerdict", tool: "run_lint", args: {} }],
        }] },
      })(facts),
      chat: async () => round++ > 0 ? answer : asking ? currentCheck ? toolResponse([lint]) : answer : toolResponse([
        { name: "set_work_plan", args: { goal: "Inspect map", layers: [{ title: "Inspection", items: [
          { id: "old-check", title: "Old check", instruction: "Inspect", successTools: ["get_project_summary", "run_lint"] },
        ] }] } },
        { name: "set_title_screen", args: { title: "RETAINED_DRAFT" } },
        ...(priorFailure ? [lint] : []),
      ]),
    });
    const prior = await session.sendUserMessage(raw, event => events.push(event));
    const source = session.getHarnessSnapshot().requests?.[0], plan = session.getWorkPlan();
    const draft = session.getProposedProject(), priorOutcome = structuredClone(prior.runOutcome);
    expect(prior.proposedCalls.map(call => call.name)).toEqual(["set_title_screen"]);
    expect(session.getAcceptanceSnapshot()?.items[0]).toMatchObject({ required: true, evidence: [{ passed: false }] });
    expect(verdicts(events)).toEqual(priorFailure ? [{ ok: true, pass: false }] : []);
    asking = true; round = 0; events.length = 0;
    // When a current question does its own check, or asks something unrelated.
    const result = await session.sendUserMessage("What is the current status?", event => events.push(event), undefined, { composerMode: "ask", autonomous: true });
    // Then only this question's negative check owns its response, never the older obligation.
    expect(verdicts(events)).toEqual(currentCheck ? [{ ok: true, pass: !priorFailure }] : []);
    expect(result.assistantText === "MODEL_SUCCESS_SENTINEL").toBe(!(currentCheck && priorFailure));
    expect(result.runOutcome?.execution).toBe(currentCheck && priorFailure ? "blocked" : "response-final");
    expect(result.runOutcome?.delivery).toBe("no-change");
    expect(result.recap?.runOutcome).toEqual(result.runOutcome);
    expect(session.getHarnessSnapshot().runOutcome).toEqual(result.runOutcome);
    expect(prior.runOutcome).toEqual(priorOutcome);
    expect(session.getHarnessSnapshot().requests?.[0]).toEqual(source);
    expect(source).toMatchObject({ rawInstruction: raw, authoring: true, units: [{ coverage: "declared" }] });
    expect(session.getAcceptanceSnapshot()?.items[0]).toMatchObject({ required: true, evidence: [{ passed: false }] });
    expect(session.getWorkPlan()).toEqual(plan); expect(session.getProposedProject()).toEqual(draft);
    expect(result.proposedCalls).toEqual([]); expect(result.appliedCalls).toEqual([]);
    expect(session.getRunEndProof()).toBeNull(); expect(project).toEqual(before);
    expect(events.some(event => event.type === "run_state" && event.execution.state === "recovering")).toBe(false);
  });

  it.each(["do", "ask"] as const)("keeps a passing current native check read-only in %s", async composerMode => {
    // Given a clean project and a model that also attempts an unauthorized write.
    const project = createBlankProject(), before = structuredClone(project);
    const h = questionSession(project, [[lint, { name: "set_title_screen", args: { title: "REFUSED_TITLE" } }]]);
    // When a question explicitly checks the project.
    const result = await h.session.sendUserMessage("Check the current project", h.collect, undefined, { composerMode, autonomous: true });
    // Then checker success is not authoring, apply or persistence authority.
    expect(verdicts(h.events)).toEqual([{ ok: true, pass: true }]);
    expect(result.assistantText).toBe("MODEL_SUCCESS_SENTINEL");
    expect(result.runOutcome).toEqual({ execution: "response-final", goal: "unassessed", delivery: "no-change" });
    expect(h.events.find(event => event.type === "tool_call" && event.name === "set_title_screen"))
      .toMatchObject({ result: { ok: false, issues: [{ code: "composer-mode-ask" }] } });
    expect(h.events.some(event => event.type === "run_state" && event.execution.state === "recovering")).toBe(false);
    expect(result.proposedCalls).toEqual([]); expect(result.appliedCalls).toEqual([]);
    expect(h.session.getRunEndProof()).toBeNull();
    expect(h.session.getAcceptanceSnapshot()).toBeNull();
    expect(h.session.getProposedProject()).toEqual(before); expect(project).toEqual(before);
  });

  it("reports the current explicit Ask failure without authorizing repairs", async () => {
    // Given a broken native map, not a mocked checker result.
    const project = createBlankProject(), map = project.maps[project.startMapId];
    if (!map) throw new Error("Missing fixture map");
    map.upperTiles[map.width + 5] = 260;
    const before = structuredClone(project), h = questionSession(project, [[lint]]);
    // When explicit Ask executes run_lint.
    const result = await h.session.sendUserMessage("Check the map", h.collect, undefined, { composerMode: "ask", autonomous: true });
    // Then the failed native verdict replaces success, without resuming authoring.
    expect(verdicts(h.events)).toEqual([{ ok: true, pass: false }]);
    expect(result.assistantText).not.toContain("MODEL_SUCCESS_SENTINEL");
    expect(result.runOutcome).toEqual({ execution: "blocked", goal: "unassessed", delivery: "no-change" });
    expect(result.execution?.state).toBe("answer");
    expect(h.events.some(event => event.type === "run_state" && event.execution.state === "recovering")).toBe(false);
    expect(h.session.getProposedProject()).toEqual(before);
  });

  it("does not let another successful native scope erase a current failed scope", async () => {
    // Given an unreachable target and a distinct reachable target in one question.
    const project = createBlankProject();
    const common = { mapId: project.startMapId, from: { x: 5, y: 5 } };
    const h = questionSession(project, [[
      { name: "check_reachability", args: { ...common, targets: [{ x: -10, y: -10 }] } },
      { name: "check_reachability", args: { ...common, targets: [{ x: 6, y: 5 }] } },
    ]]);
    // When both registered checks execute successfully.
    const result = await h.session.sendUserMessage("Check these routes", h.collect);
    // Then transport success and the second scope cannot launder the first verdict.
    expect(h.events.flatMap(event => event.type === "tool_call" ? [{ ok: event.result.ok, pass: parseToolVerdict(event.name, event.result).pass }] : []))
      .toEqual([{ ok: true, pass: false }, { ok: true, pass: true }]);
    expect(result.assistantText).not.toContain("MODEL_SUCCESS_SENTINEL");
    expect(result.assistantText).toContain("check_reachability");
    expect(result.runOutcome?.execution).toBe("blocked");
  });

  it.each([false, true])("requires a fresh exact check after an observed project change, recheck=%s", async recheck => {
    // Given an explicit native pass followed by an external revision at its result event.
    const project = createBlankProject();
    const h = questionSession(project, recheck ? [[lint], [lint]] : [[lint]]);
    let changed = false;
    // When a subscribed result callback rebases to the changed project before finalization.
    const result = await h.session.sendUserMessage("Check the current project", event => {
      h.collect(event);
      if (event.type === "tool_call" && event.name === "run_lint" && !changed) {
        changed = true;
        const revision = structuredClone(project); revision.meta.title = "EXTERNAL_REVISION";
        h.session.rebaseProject(revision);
      }
    });
    // Then only a real rerun renews the stale check; model prose cannot do so.
    expect(verdicts(h.events)).toEqual(Array.from({ length: recheck ? 2 : 1 }, () => ({ ok: true, pass: true })));
    expect(result.assistantText === "MODEL_SUCCESS_SENTINEL").toBe(recheck);
    expect(result.runOutcome?.execution).toBe(recheck ? "response-final" : "blocked");
    expect(result.recap?.runOutcome).toEqual(result.runOutcome);
    expect(h.session.getHarnessSnapshot().runOutcome).toEqual(result.runOutcome);
    expect(h.session.getRunEndProof()).toBeNull();
  });

  it.each(["new-question", "ask-continuation"] as const)("scopes failed evidence to its request across %s", async boundary => {
    // Given an explicitly failed native check in an answer-only request.
    const project = createBlankProject(), map = project.maps[project.startMapId];
    if (!map) throw new Error("Missing fixture map");
    map.upperTiles[map.width + 5] = 260;
    const h = questionSession(project, [[lint]]);
    const first = await h.session.sendUserMessage("Check the map", h.collect, undefined, { composerMode: "ask" });
    expect(verdicts(h.events)).toEqual([{ ok: true, pass: false }]);
    const firstOutcome = structuredClone(first.runOutcome);
    const priorSource = h.session.getHarnessSnapshot().requests?.[0];
    const options: SessionTurnOptions = { composerMode: "ask" };
    // When a new unrelated question or non-authorizing continuation is sent.
    const result = await h.session.sendUserMessage(boundary === "new-question" ? "What is the title?" : "continue", h.collect, undefined, options);
    // Then new questions isolate old checks, while the same request retains its finding.
    expect(result.assistantText === "MODEL_SUCCESS_SENTINEL").toBe(boundary === "new-question");
    expect(result.runOutcome?.execution).toBe(boundary === "new-question" ? "response-final" : "blocked");
    expect(h.session.getHarnessSnapshot().requests).toHaveLength(boundary === "new-question" ? 2 : 1);
    expect(h.session.getHarnessSnapshot().requests?.[0]).toEqual(priorSource);
    expect(first.runOutcome).toEqual(firstOutcome);
    expect(result.proposedCalls).toEqual([]); expect(result.appliedCalls).toEqual([]);
  });
});
