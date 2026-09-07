import { describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import {
  formatRalphContinueMessage,
  formatWorkPlanForOrchestration,
  workPlanFromOrchestratorDecision,
} from "@/ai/workPlan";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";

const items = [
  { id: "resize-original", title: "Resize", instruction: "Resize the existing map" },
  { id: "forest-original", title: "Forest", instruction: "Inspect the forest", successTools: ["run_lint", "invented_check"] },
  { id: "optional-original", title: "Optional", instruction: "Optional decoration" },
  { id: "verify-original", title: "Verify", instruction: "Inspect the map" },
];
const original = { goal: "Repair the world", layers: [{ title: "World", items }] };
const config = { ...defaultAiConfig(), agentMode: "chat" as const, model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 };

function repairArgs() {
  return {
    goal: "The same world, described differently",
    layers: [
      { title: "Later checks", items: [items[3], { id: "added", title: "Extra check", instruction: "Inspect the coast" }] },
      { title: "Regrouped", items: [items[2], { ...items[1], instruction: "Use the canonical lint check", successTools: ["run_lint"] }, items[0]] },
    ],
  };
}

function activeSession() {
  const project = createBlankProject();
  const session = new AssistantSession(project, { config });
  session["workPlan"] = workPlanFromOrchestratorDecision({ action: "new_plan", ...original }, new Date("2026-09-06T00:00:00Z"));
  expect(session["applyWorkPlanTool"]("complete_work_item", { itemId: "resize-original", note: "Resized" }).ok).toBe(true);
  expect(session["applyWorkPlanTool"]("skip_work_item", { itemId: "optional-original", note: "User excluded it" }).ok).toBe(true);
  session["workPlan"] = { ...session["workPlan"], targetMapId: project.startMapId };
  session["recordToolResult"]("run_lint", {}, { ok: true, summary: "Checked", data: { issues: [] } });
  return { session, project };
}

function tool(name: string, args: Record<string, unknown>): ChatResult {
  return { message: { role: "assistant", content: null, tool_calls: [{ id: name, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" };
}

function final(content: string): ChatResult {
  return { message: { role: "assistant", content }, finishReason: "stop" };
}

describe("in-loop WorkPlan identity", () => {
  it("does not replace an existing verification requirement with a summary query", () => {
    const { session } = activeSession();
    const before = session.getWorkPlan();
    const replacement = items.map(item => item.id === "forest-original"
      ? { ...item, successTools: ["get_project_summary"] } : item);
    const result = session["applyWorkPlanTool"]("set_work_plan", { ...original, layers: [{ title: "Checks", items: replacement }] });
    expect(result.ok).toBe(false);
    expect(session.getWorkPlan()).toEqual(before);
  });

  it("cannot skip a required verification item", () => {
    const { session } = activeSession();
    const before = session.getWorkPlan();
    const result = session["applyWorkPlanTool"]("skip_work_item", { itemId: "forest-original", note: "Skip validation" });
    expect(result.ok).toBe(false);
    expect(session.getWorkPlan()).toEqual(before);
  });

  it.each(["resize-original", "forest-original", "optional-original", "verify-original"])("rejects erasing %s even if a replacement keeps the item count", (removedId) => {
    // Given completed, skipped and unfinished independent items and item evidence.
    const { session } = activeSession();
    const before = session.getWorkPlan();
    const beforeAcceptance = session.getAcceptanceSnapshot();
    const replacement = items.map(item => item.id === removedId ? { ...item, id: "aggregate-replacement" } : item);
    // When the generator relabels one item, even with a reworded goal.
    const result = session["applyWorkPlanTool"]("set_work_plan", {
      goal: "A rewritten goal cannot authorize a restart",
      layers: [{ title: "Replacement", items: replacement }],
      acceptance: [{ id: "injected", title: "New promise", criteria: [] }],
    });
    // Then rejection is atomic and reports the missing machine identifier.
    expect(result.ok).toBe(false);
    expect(result.summary).toContain(removedId);
    expect(session.getWorkPlan()).toEqual(before);
    expect(session.getAcceptanceSnapshot()).toEqual(beforeAcceptance);
    expect([...session["turnSuccessfulTools"]]).toEqual(["run_lint"]);
    expect(session["workItemVerificationEvidence"].passed("run_lint")).toBe(true);
  });

  it.each([
    { kind: "aggregation", replacement: [{ id: "aggregate", title: "Everything", instruction: "Do everything" }] },
    { kind: "duplicate IDs", replacement: [...items, items[1]] },
  ])("rejects $kind without changing the original plan", ({ replacement }) => {
    // Given an independent checklist; when it is collapsed or made ambiguous.
    const { session } = activeSession();
    const before = session.getWorkPlan();
    const result = session["applyWorkPlanTool"]("set_work_plan", { ...original, layers: [{ title: "Replacement", items: replacement }] });
    // Then the replacement cannot become the plan.
    expect(result.ok).toBe(false);
    expect(session.getWorkPlan()).toEqual(before);
  });

  it("retains identity, progress and the current item when instructions are repaired and items regrouped", () => {
    // Given progress and a current item whose tool requirement is wrong.
    const { session, project } = activeSession();
    const before = session.getWorkPlan();
    session["lastMilestoneCompletionItemId"] = "resize-original";
    // When the generator edits prose/tools, reorders, regroups and adds an item.
    const result = session["applyWorkPlanTool"]("set_work_plan", repairArgs());
    // Then IDs, completed/skipped state, notes and the current item's ownership survive.
    expect(result.ok).toBe(true);
    const plan = session.getWorkPlan();
    expect(plan).toMatchObject({ id: before?.id, createdAt: before?.createdAt, targetMapId: project.startMapId, currentItemId: "forest-original", currentLayerIndex: 1 });
    expect(plan?.layers.flatMap(layer => layer.items).map(item => [item.id, item.status, item.note])).toEqual([
      ["verify-original", "pending", undefined], ["added", "pending", undefined],
      ["optional-original", "skipped", "User excluded it"], ["forest-original", "in_progress", undefined], ["resize-original", "done", "Resized"],
    ]);
    expect(plan?.layers[1]?.items[1]).toMatchObject({ instruction: "Use the canonical lint check", successTools: ["run_lint"] });
    expect(session["lastMilestoneCompletionItemId"]).toBe("resize-original");
    expect(session["workItemVerificationEvidence"].passed("run_lint")).toBe(true);
  });

  it("preserves original artifact evidence so repair cannot bypass the outcome gate", () => {
    // Given a created but still empty map owned by the current item.
    const { session, project } = activeSession();
    const plan = session.getWorkPlan();
    if (!plan) throw new Error("Expected an active plan");
    session["workPlan"] = { ...plan, targetMapId: undefined };
    session["turnItemCreatedMapIds"].add(project.startMapId);
    // When the current item's tool contract is repaired.
    expect(session["applyWorkPlanTool"]("set_work_plan", repairArgs()).ok).toBe(true);
    // Then prior success remains, but the original empty artifact still blocks completion.
    expect([...session["turnSuccessfulTools"]]).toEqual(["run_lint"]);
    expect([...session["turnItemCreatedMapIds"]]).toEqual([project.startMapId]);
    expect(session["applyWorkPlanTool"]("complete_work_item", { itemId: "forest-original" }).ok).toBe(false);
  });

  it.each([
    { context: "orchestration", format: formatWorkPlanForOrchestration },
    { context: "Ralph", format: formatRalphContinueMessage },
  ])("exposes the actual current item identifier in $context", ({ format }) => {
    // Given a non-positional ID; when context is formatted; then the machine ID is available.
    const plan = workPlanFromOrchestratorDecision({ action: "new_plan", ...original });
    expect(format(plan)).toContain("resize-original");
  });

  it("repairs a failed requirement through the real session loop without repeating the successful tool", async () => {
    // Given one item with a valid check plus an invalid requirement.
    const project = createBlankProject();
    const one = { goal: "Inspect", layers: [{ title: "Checks", items: [items[1]] }] };
    const rounds = [
      tool("set_work_plan", one),
      tool("run_lint", {}),
      tool("complete_work_item", { itemId: "forest-original" }),
      tool("set_work_plan", { ...one, layers: [{ title: "Corrected", items: [{ ...items[1], successTools: ["run_lint"] }] }] }),
    ];
    const events: SessionEvent[] = [];
    let index = 0;
    const session = new AssistantSession(project, {
      config, declareIntent: fixedDeclarer({ mode: "question", needsPlan: false }),
      chat: async () => rounds[index++] ?? final("Finished"),
    });
    // When the generator corrects the contract after completion fails.
    await session.sendUserMessage("Inspect this project", event => events.push(event));
    // Then prior evidence completes the repaired item without another lint execution.
    expect(events.filter(event => event.type === "tool_call" && event.name === "complete_work_item")).toMatchObject([{ result: { ok: false } }]);
    expect(events.filter(event => event.type === "tool_call" && event.name === "run_lint")).toHaveLength(1);
    expect(session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
  });
});
