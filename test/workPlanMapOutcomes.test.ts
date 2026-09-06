import { describe, expect, it } from "vitest";
import { AssistantSession, WORK_PLAN_TOOLS } from "@/ai/assistantSession";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import type { ToolResult } from "@/editor/tools/types";
import { parseOrchestratorDecision, workPlanFromOrchestratorDecision, workPlanFromSetToolArgs } from "@/ai/workPlan";
import { workTargetIssues, workToolOutcome } from "@/ai/workPlanTargets";
import type { ChatResult } from "@/ai/llmClient";
import { fixedDeclarer } from "./intentFixture";

const CELLAR = "map_basement";
const fillArgs = (mapId: string) => ({ mapId, material: "잔디", shape: "rect", rect: { x: 1, y: 1, w: 10, h: 8 } });
const terrainItem = (id: string, mapId: string) => ({ id, title: id, instruction: "Fill the declared map", successTools: ["fill_region"], mapTargets: [mapId] });

function setup() {
  const project = createBlankProject();
  const session = new AssistantSession(project);
  expect(runTool(session["ctx"], "create_map", { id: CELLAR, name: "Cellar", width: 12, height: 10 }).ok).toBe(true);
  return { session, mapId: project.startMapId };
}
function spec(session: AssistantSession, mapId: string) {
  return session["applyBuildSpec"]({ mapId, assets: [{ id: "floor", kind: "terrain", x: 0, y: 0, w: 12, h: 10 }], pathWidth: 1, density: "normal", layoutStyle: "straight" });
}
function fill(session: AssistantSession, mapId: string) {
  const args = fillArgs(mapId);
  const gate = session["specGate"]("fill_region", args);
  const result = "ok" in gate ? gate : runTool(session["ctx"], "fill_region", args);
  session["recordToolResult"]("fill_region", args, result);
  return result;
}
function transfer(session: AssistantSession, mapId: string) {
  const args = { a: { mapId, x: 18, y: 8 }, b: { mapId: CELLAR, x: 6, y: 8 } };
  const result = runTool(session["ctx"], "create_transfer_pair", args);
  session["recordToolResult"]("create_transfer_pair", args, result);
  return result;
}
async function advance(session: AssistantSession) {
  await session["noteSuccessfulTools"]([...session["turnSuccessfulTools"]], () => {});
}
function complete(session: AssistantSession, itemId: string) {
  return session["applyWorkPlanTool"]("complete_work_item", { itemId });
}
function splitPlan(mapId: string) {
  return { goal: "Terrain and link", layers: [{ title: "Maps", items: [
    terrainItem("village", mapId), terrainItem("cellar", CELLAR),
    { id: "link", title: "Link", instruction: "Connect authored maps", successTools: ["create_transfer_pair"], mapTargets: [mapId, CELLAR] },
  ] }] };
}

describe("target-scoped work outcomes", () => {
  // round2/first-audit.json:1241-1390: actual single-map spec gate and tools,
  // with the captured planner's unsupported mixed item retained for repair.
  it.each([false, true])("does not discharge the captured failed cellar fill (failure first=%s)", async failureFirst => {
    const { session, mapId } = setup();
    session["workPlan"] = workPlanFromOrchestratorDecision({ action: "new_plan", goal: "Terrain and link", layers: [{ title: "Maps", items: [{
      id: "terrain", title: "Terrain", instruction: "Author both maps, then link them", successTools: ["fill_region", "create_transfer_pair"],
    }] }] });
    expect(spec(session, mapId).ok).toBe(true);
    const before = structuredClone(session.getProposedProject().maps[mapId]);
    let village: ToolResult;
    let cellar: ToolResult;
    if (failureFirst) { cellar = fill(session, CELLAR); village = fill(session, mapId); }
    else { village = fill(session, mapId); cellar = fill(session, CELLAR); }
    expect(village.ok).toBe(true);
    expect(session.getProposedProject().maps[mapId]).toEqual(before);
    expect(cellar.ok).toBe(false);
    expect(cellar.issues?.map(issue => issue.code)).toContain("spec-gate");
    expect(transfer(session, mapId).ok).toBe(true);

    await advance(session);

    expect(session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("in_progress");
    const completion = complete(session, "terrain");
    expect(completion.ok).toBe(false);
    expect(completion.data).toMatchObject({ targetIssues: expect.arrayContaining([
      expect.objectContaining({ code: "missing-map-targets", field: "mapTargets" }),
      expect.objectContaining({ mapId: CELLAR, tool: "fill_region" }),
    ]) });
  });

  it.each([false, true])("repairs only the cellar after another map succeeds (failure first=%s)", async failureFirst => {
    const { session, mapId } = setup();
    expect(session["applyWorkPlanTool"]("set_work_plan", splitPlan(mapId)).ok).toBe(true);
    expect(spec(session, mapId).ok).toBe(true);
    expect(fill(session, mapId).ok).toBe(true);
    await advance(session);
    expect(session.getWorkPlan()?.currentItemId).toBe("cellar");
    const villageBefore = structuredClone(session.getProposedProject().maps[mapId]);
    if (failureFirst) { expect(fill(session, CELLAR).ok).toBe(false); expect(fill(session, mapId).ok).toBe(true); }
    else { expect(fill(session, mapId).ok).toBe(true); expect(fill(session, CELLAR).ok).toBe(false); }
    expect(transfer(session, mapId).ok).toBe(true);
    await advance(session);
    expect(session.getWorkPlan()?.currentItemId).toBe("cellar");
    expect(complete(session, "cellar").data).toMatchObject({ targetIssues: [expect.objectContaining({ code: "missing-map-outcome", mapId: CELLAR, tool: "fill_region" })] });
    const villageAfterLink = structuredClone(session.getProposedProject().maps[mapId]);
    expect(villageAfterLink?.lowerTiles).toEqual(villageBefore?.lowerTiles);

    expect(spec(session, CELLAR).ok).toBe(true);
    expect(fill(session, CELLAR).ok).toBe(true);
    expect(complete(session, "cellar").ok).toBe(true);

    expect(session.getWorkPlan()?.currentItemId).toBe("link");
    expect(session.getProposedProject().maps[mapId]).toEqual(villageAfterLink);
    expect(complete(session, "village").data).toMatchObject({ alreadyDone: "village" });
    // The prematurely executed transfer cannot satisfy the separate linking item.
    expect(complete(session, "link").ok).toBe(false);
    expect(transfer(session, mapId).ok).toBe(true);
    expect(complete(session, "link").ok).toBe(true);
  });

  it("requires declared structure work even after a road or transfer succeeds", async () => {
    const { session, mapId } = setup();
    expect(session["applyWorkPlanTool"]("set_work_plan", { goal: "Structures", layers: [{ title: "Build", items: [{
      ...terrainItem("structure", mapId), successTools: ["fill_region", "build_wall"],
    }] }] }).ok).toBe(true);
    expect(spec(session, mapId).ok).toBe(true);
    expect(fill(session, mapId).ok).toBe(true);
    expect(transfer(session, mapId).ok).toBe(true);

    await advance(session);

    expect(session.getWorkPlan()?.currentItemId).toBe("structure");
    expect(complete(session, "structure").ok).toBe(false);
  });

  it("retains a target's no-op outcome through a real continuation and explicit completion", async () => {
    const project = createBlankProject();
    let step = 0;
    const chat = async (_config: unknown, request: { tools?: readonly unknown[] }): Promise<ChatResult> => {
      if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" };
      step += 1;
      const name = step === 1 ? "fill_region" : step === 2 ? "get_map_region" : "complete_work_item";
      const args = step === 1 ? fillArgs(project.startMapId) : step === 2 ? { mapId: project.startMapId, x: 0, y: 0, w: 2, h: 2 } : { itemId: "terrain" };
      return { message: { role: "assistant", content: null, tool_calls: [{ id: `call-${step}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" };
    };
    const session = new AssistantSession(project, { chat, declareIntent: fixedDeclarer(), config: { authMode: "apiKey", baseUrl: "x", apiKey: "test", model: "test", liteModel: "test", agentMode: "chat", maxToolCalls: 1, maxTokens: 1024 } });
    expect(session["applyWorkPlanTool"]("set_work_plan", { goal: "Terrain", layers: [{ title: "Build", items: [{
      ...terrainItem("terrain", project.startMapId), successTools: ["fill_region", "get_map_region"],
    }] }] }).ok).toBe(true);
    expect(spec(session, project.startMapId).ok).toBe(true);
    await session.sendUserMessage("Continue", () => {}, undefined, { driverContinue: true });
    expect(session.getWorkPlan()?.currentItemId).toBe("terrain");
    expect(session["workItemToolOutcomes"]).toEqual([expect.objectContaining({ name: "fill_region", mapIds: [project.startMapId], ok: true })]);

    await session.sendUserMessage("Continue", () => {}, undefined, { driverContinue: true });

    expect(session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
    expect(complete(session, "terrain").data).toMatchObject({ alreadyDone: "terrain" });
  });

  it.each([
    { mapTargets: [], code: "invalid-map-targets" },
    { mapTargets: ["a", "a"], code: "invalid-map-targets" },
    { mapTargets: ["a", 3], code: "invalid-map-targets" },
    { mapTargets: ["a", "b"], code: "mixed-map-authoring" },
  ])("rejects malformed target declarations atomically: $code $mapTargets", ({ mapTargets, code }) => {
    const { session, mapId } = setup();
    expect(session["applyWorkPlanTool"]("set_work_plan", splitPlan(mapId)).ok).toBe(true);
    const before = session.getWorkPlan();
    const result = session["applyWorkPlanTool"]("set_work_plan", { goal: "Bad", layers: [{ title: "Bad", items: [{ ...terrainItem("bad", mapId), mapTargets }] }] });
    expect(result.ok).toBe(false);
    expect(result.issues?.map(issue => issue.code)).toContain(code);
    expect(session.getWorkPlan()).toEqual(before);
  });


  it("does not restore a failed target with another map's later success", () => {
    const { session, mapId } = setup();
    expect(session["applyWorkPlanTool"]("set_work_plan", splitPlan(mapId)).ok).toBe(true);
    session["recordToolResult"]("fill_region", { mapId }, { ok: true, summary: "Already satisfied" });
    session["recordToolResult"]("fill_region", { mapId }, { ok: false, summary: "Rejected later request" });
    session["recordToolResult"]("fill_region", { mapId: CELLAR }, { ok: true, summary: "Other map succeeded" });

    expect(complete(session, "village").data).toMatchObject({ targetIssues: [expect.objectContaining({ code: "missing-map-outcome", mapId, tool: "fill_region" })] });

    session["recordToolResult"]("fill_region", { mapId }, { ok: true, summary: "Already satisfied" });
    expect(complete(session, "village").ok).toBe(true);
  });

  it("rejects mixed linking and authoring even with explicit map targets", () => {
    const { session, mapId } = setup();
    const result = session["applyWorkPlanTool"]("set_work_plan", { goal: "Mixed", layers: [{ title: "Maps", items: [{
      ...terrainItem("mixed", mapId), mapTargets: [mapId, CELLAR], successTools: ["fill_region", "create_transfer_pair"],
    }] }] });
    expect(result.issues?.map(issue => issue.code)).toEqual(["mixed-link-authoring"]);
    expect(session.getWorkPlan()).toBeNull();
  });

  it("retains exact targets and item order through both planner and tool parsing", () => {
    const input = splitPlan("map_a");
    const parsed = parseOrchestratorDecision(JSON.stringify({ action: "new_plan", ...input }));
    expect(parsed.decision).toMatchObject({ layers: input.layers });
    expect(workPlanFromSetToolArgs(input)?.layers[0]?.items[2]).toMatchObject({ mapTargets: ["map_a", CELLAR] });
    const schema = WORK_PLAN_TOOLS.find(tool => tool.function.name === "set_work_plan")?.function.parameters;
    expect(schema?.properties?.layers?.items?.properties?.items?.items?.properties?.mapTargets).toMatchObject({ type: "array", items: { type: "string" } });
  });

  it("does not combine unrelated transfer endpoints or skipped prerequisites", () => {
    const plan = workPlanFromSetToolArgs(splitPlan("map_a"));
    if (!plan) throw new Error("fixture plan did not parse");
    const items = plan.layers.flatMap(layer => layer.items);
    const link = items.find(item => item.id === "link");
    if (!link) throw new Error("fixture link missing");
    for (const item of items) if (item.id !== "link") item.status = "skipped";
    const outcomes = [
      workToolOutcome("create_transfer_pair", { a: { mapId: "map_a" }, b: { mapId: "other" } }, true),
      workToolOutcome("create_transfer_pair", { a: { mapId: CELLAR }, b: { mapId: "other" } }, true),
    ];
    expect(workTargetIssues(link, outcomes, plan).map(issue => issue.code)).toEqual([
      "unmet-map-dependency", "unmet-map-dependency", "missing-map-outcome", "missing-map-outcome",
    ]);
  });
});
