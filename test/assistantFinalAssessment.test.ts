import assert from "node:assert/strict";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { selectVerificationCalls } from "@/ai/agentVerification";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import * as applyStore from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
import { fixedDeclarer } from "./intentFixture";

afterEach(() => vi.restoreAllMocks());
type Call = { readonly name: string; readonly args: Record<string, unknown> };
type Stop = "final" | "max-tool-calls" | "token-budget";
// Round 2: quality preceded define_ending, then only lint was selected.
// The saved exit's page-level choices contained no executable triggerEnding.
const definition: Call = { name: "define_ending", args: { id: "ending_escape", name: "Escape", conditions: [] } };
const earlyQuality: Call = { name: "evaluate_game_quality", args: {} };

function fixture(stop: Stop = "final", repair?: "acceptance" | "ending") {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const item = project.database.items[0];
  assert(item);
  const events: SessionEvent[] = [];
  const assessmentsAtResponse: unknown[] = [];
  const plan: Call = { name: "set_work_plan", args: {
    goal: "Complete adventure", acceptance: [
      { id: "maps", title: "Scoped maps", criteria: [{ kind: "mapCount", count: 1 }] },
      { id: "kept", title: "Original dimensions", criteria: [{ kind: "mapDimensions", target: { mapId }, width: 20, height: 15 }] },
    ], layers: [{ title: "Ending", items: [{ id: "ending", title: "Ending", instruction: "Define ending", successTools: ["define_ending"] }] }],
  } };
  const rounds: Call[][] = [[plan, earlyQuality], [definition, { name: "upsert_item", args: { item: { id: item.id, name: item.name, iconResourceId: "" } } }]];
  if (repair) rounds.push([], [repair === "acceptance"
    ? { name: "repair_acceptance", args: { itemId: "maps", criteria: [{ kind: "mapCount", count: 1, targets: [{ mapId }] }] } }
    : { name: "upsert_event", args: { mapId, event: { id: "exit", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "triggerEnding", endingId: "ending_escape" }] } } }]);
  let round = 0;
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: stop === "max-tool-calls" ? 2 : 12, maxTokens: 10000 },
    declareIntent: fixedDeclarer({ mode: "modify", targetMapId: mapId, adventure: { village: true, dungeon: false, party: false, battle: false } }),
    yieldToUi: async () => {},
    chat: async (): Promise<ChatResult> => {
      assessmentsAtResponse.push(events.filter(event => event.type === "completion_assessment").at(-1));
      const calls = rounds[round++];
      return calls?.length ? {
        message: { role: "assistant", content: null, tool_calls: calls.map((call, index) => ({ id: `c${round}_${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } })) },
        finishReason: "tool_calls", usage: { prompt_tokens: 1, completion_tokens: stop === "token-budget" && round === 2 ? 10000 : 0, total_tokens: 1 },
      } : { message: { role: "assistant", content: "SCRIPTED_SUCCESS" }, finishReason: "stop" };
    },
  });
  return { session, events, assessmentsAtResponse, run: (autonomous = false) => session.sendUserMessage("Complete the adventure", event => events.push(event), undefined, { autonomous }) };
}

describe("current final artifact assessment", () => {
  it("does not convert a factual question about an unfinished game into a repair run", async () => {
    // Given an unfinished ending in the loaded project and a question intent.
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, definition.name, definition.args).ok).toBe(true);
    let responses = 0;
    const session = new AssistantSession(ctx.project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 },
      declareIntent: fixedDeclarer({ mode: "question" }), yieldToUi: async () => {},
      chat: async () => { responses += 1; return { message: { role: "assistant", content: "FACTUAL_ANSWER" }, finishReason: "stop" }; },
    });
    // When answering without a request to author or complete the artifact.
    const result = await session.sendUserMessage("Explain the project");
    // Then the question does not acquire a completion/repair obligation.
    expect(responses).toBe(1);
    expect(result.completionAssessment?.checks).toEqual([]);
    expect(result.assistantText).toBe("FACTUAL_ANSWER");
  });

  it.each([false, true])("assesses existing endings without plan/history and keeps warning-only quality advisory (wired=%s)", async wired => {
    // Given an existing artifact, not a define_ending call in this session's history.
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, definition.name, definition.args).ok).toBe(true);
    if (wired) expect(runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId,
      event: { id: "exit", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "triggerEnding", endingId: "ending_escape" }] },
    }).ok).toBe(true);
    let responses = 0;
    const session = new AssistantSession(ctx.project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }), yieldToUi: async () => {},
      chat: async () => { responses += 1; return { message: { role: "assistant", content: "SCRIPTED_SUCCESS" }, finishReason: "stop" }; },
    });
    // When the model tries to finish without rerunning quality itself.
    const result = await session.sendUserMessage("Finish existing work");
    // Then only a missing executable invocation requests content repair.
    expect(responses).toBe(wired ? 1 : 5);
    expect(result.completionAssessment?.acceptance).toBeNull();
    expect(result.completionAssessment?.checks.find(check => check.name === "evaluate_game_quality")?.result.data)
      .toMatchObject({ coverage: { endings: { uninvokedIds: wired ? [] : ["ending_escape"] } } });
    expect(result.assistantText === "SCRIPTED_SUCCESS").toBe(wired);
  });

  it("selects quality again for an ending authored after the earlier check", () => {
    // Given the recorded order; when ending/final layers finish; then lint alone is insufficient.
    const history = [earlyQuality, definition].map(call => ({ ...call, ok: true }));
    for (const title of ["Ending", "Final"]) expect(selectVerificationCalls({ title }, history).map(call => call.name)).toEqual(["run_lint", "evaluate_game_quality"]);
  });

  it.each<Stop>(["final", "max-tool-calls", "token-budget"])("retains acceptance, structure/icon and ending defects at %s termination", async stop => {
    // Given malformed scoped-map criteria plus missing structure/icon/invocation.
    const f = fixture(stop);
    // When the normal or budget boundary ends the run.
    const result = await f.run();
    // Then the current artifact, not the early quality result, supplies the ending finding.
    const checks = f.events.filter(event => event.type === "tool_call" && event.name === "evaluate_game_quality");
    expect(checks[0]).toMatchObject({ result: { ok: true, data: { coverage: { endings: { defined: 0 } } } } });
    expect(checks.at(-1)).toMatchObject({ result: { ok: true, issues: expect.arrayContaining([expect.objectContaining({ code: "ending-uninvoked" })]), data: { coverage: { endings: { uninvokedIds: ["ending_escape"] } } } } });
    expect(result.stoppedReason).toBe(stop);
    expect(result.completionAssessment?.acceptance?.items).toMatchObject([{ id: "maps", status: "blocked", issues: [{ field: "criteria[0].targets" }] }, { id: "kept", status: "verified" }, { id: "required-verification", status: "blocked" }]);
    expect(result.completionAssessment?.adventure).toEqual(f.session["adventureProblems"]());
    expect(result.completionAssessment?.adventure).toHaveLength(3);
    expect(result.completionAssessment?.verification.length).toBeGreaterThan(0);
    // Compare shipped report components, not pinned prose.
    expect(result.assistantText).toContain(f.session["acceptanceIncompleteText"]());
    for (const problem of [...(result.completionAssessment?.adventure ?? []), ...(result.completionAssessment?.verification ?? [])]) expect(result.assistantText).toContain(problem);
    for (const issue of result.completionAssessment?.acceptance?.items[0]?.issues ?? []) expect(result.assistantText).toContain(issue.field);
    expect(f.events.filter(event => event.type === "assistant_message").at(-1)).toMatchObject({ content: result.assistantText });
  });

  it.each(["acceptance", "ending"] as const)("exposes all categories before repair and repairing %s does not erase others or replay milestones", async repair => {
    // Given real tools with only the external apply boundary replaced in memory.
    vi.spyOn(store, "isRemotePersistenceEnabled").mockReturnValue(false);
    const apply = vi.spyOn(applyStore, "applyProposedProject").mockImplementation(async applied => ({
      ok: true, applied, commit: { commitId: null, persisted: false, reviewStatus: "approved", summary: "test", toolNames: [], recordedAt: "2026-09-06T00:00:00.000Z" },
    }));
    const f = fixture("final", repair);
    // When the first combined repair receives a single-category correction.
    const result = await f.run(true);
    // Then all categories were exposed before the model chose a repair tool.
    expect(f.assessmentsAtResponse[3]).toMatchObject({ type: "completion_assessment", assessment: {
      acceptance: { items: [{ id: "maps", status: "blocked" }, { id: "kept", status: "verified" }, { id: "required-verification", status: "blocked" }] },
      adventure: expect.arrayContaining([expect.any(String)]), verification: expect.arrayContaining([expect.any(String)]),
    } });
    expect(result.completionAssessment?.acceptance?.items.map(item => [item.id, item.status])).toEqual([
      ["maps", repair === "acceptance" ? "verified" : "blocked"], ["kept", "verified"],
      ...(repair === "acceptance" ? [["required-verification", "blocked"]] : []),
    ]);
    expect(result.completionAssessment?.adventure).toHaveLength(3);
    const lastQuality = f.events.filter(event => event.type === "tool_call" && event.name === "evaluate_game_quality").at(-1);
    expect(lastQuality).toMatchObject({ result: { data: { coverage: { endings: { uninvokedIds: repair === "ending" ? [] : ["ending_escape"] } } } } });
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
    expect(f.events.filter(event => event.type === "tool_call" && event.name === "define_ending")).toHaveLength(1);
    expect(apply.mock.calls.flatMap(call => call[1].toolNames ?? []).filter(name => name === "define_ending")).toHaveLength(1);
  });
});
