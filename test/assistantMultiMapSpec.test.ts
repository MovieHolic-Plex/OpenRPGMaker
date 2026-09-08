import { setImmediate } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type AssistantSessionOptions, type SessionEvent, type SessionTurnOptions, type TurnResult } from "@/ai/assistantSession";
import { type BuildSpec, validateBuildSpec } from "@/ai/buildSpec";
import { proposalCompletenessWarnings, PROPOSAL_SCOPE_WARNING_PREFIX } from "@/ai/proposalCompleteness";
import * as tools from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";

type Call = { name: string; args: Record<string, unknown> };
type ToolEvent = Extract<SessionEvent, { type: "tool_call" }>;
const call = (name: string, args: Record<string, unknown>): Call => ({ name, args });
const spec = (mapId: string): BuildSpec => ({ mapId, title: mapId, assets: [{ id: "terrain", kind: "terrain", x: 3, y: 3, w: 3, h: 3 }] });
const setSpec = (value: BuildSpec): Call => call("set_build_spec", { ...value });
const paint = (mapId: string, x = 3, y = 3): Call => call("paint_tiles", { mapId, from: { x, y }, to: { x, y }, mode: "rect", layer: "lower", tile: 281 });
const fill = (mapId: string, shape = "rect"): Call => call("fill_region", { mapId, rect: { x: 12, y: 12, w: 3, h: 3 }, material: "모래", shape });

afterEach(() => vi.restoreAllMocks());

function fixture(options: Pick<AssistantSessionOptions, "declareIntent"> = {}) {
  const ctx = { project: createBlankProject() };
  for (const id of ["a", "b"]) expect(tools.runTool(ctx, "create_map", { id, name: id, width: 20, height: 20 }).ok).toBe(true);
  const chat = vi.fn<NonNullable<AssistantSessionOptions["chat"]>>();
  const session = new AssistantSession(ctx.project, {
    config: { authMode: "apiKey", baseUrl: "x", model: "stub", apiKey: "test", maxToolCalls: 1, maxTokens: 8192 },
    chat, declareIntent: fixedDeclarer({ mode: "modify" }), ...options,
    // Real task boundaries let Vitest service RPC acknowledgements between synchronous tools.
    yieldToUi: () => setImmediate(),
  });
  let batch = 0;
  const events: ToolEvent[] = [];
  // Each send exercises one actual model batch and ends at the configured budget.
  // No fabricated acceptance pass: unfinished spatial promises stay blocked.
  const send = async (calls: Call[], turnOptions: SessionTurnOptions = {}, expectedStop: TurnResult["stoppedReason"] = "max-tool-calls") => {
    chat.mockImplementationOnce(async () => ({ message: { role: "assistant", content: null, tool_calls: calls.map((entry, index) => ({
      id: `b${batch}_${index}`, type: "function", function: { name: entry.name, arguments: JSON.stringify(entry.args) },
    })) }, finishReason: "tool_calls" }));
    batch += 1;
    const result = await session.sendUserMessage("Edit the requested maps", event => { if (event.type === "tool_call") events.push(event); }, undefined, turnOptions);
    expect(result.stoppedReason).toBe(expectedStop);
    expect(chat).toHaveBeenCalledTimes(batch);
    return result;
  };
  return { session, events, send, project: ctx.project };
}

describe("map-owned construction contracts through AssistantSession", () => {
  it.each([false, true])("retains A after B, including a continued turn=%s", async (continued) => {
    const h = fixture();
    if (continued) await h.send([setSpec(spec("a")), setSpec(spec("b"))]);
    const result = await h.send([...(continued ? [] : [setSpec(spec("a")), setSpec(spec("b"))]), paint("a"), paint("b")], { driverContinue: continued });
    expect(h.events.filter(event => event.name === "paint_tiles").map(event => event.result.ok)).toEqual([true, true]);
    expect(result.proposedCalls.map(entry => entry.args.mapId)).toEqual(["a", "b"]);
    expect(h.session.getActiveSpec("a")).toEqual(spec("a"));
    expect(h.session.getActiveSpec("b")).toEqual(spec("b"));
    expect(h.session.getActiveSpec()).toEqual(spec("b"));
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    for (const id of ["a", "b"]) expect(h.session.getProposedProject().maps[id].lowerTiles).not.toEqual(h.project.maps[id].lowerTiles);
  });

  it("isolates failed updates, keeps both historical warnings, and selects both changed maps", async () => {
    const h = fixture();
    await h.send([setSpec(spec("a")), setSpec(spec("b"))]);
    await h.send([setSpec({ ...spec("a"), assets: [{ ...spec("a").assets[0], w: 40 }] }), paint("b")]);
    expect(h.events.find(event => event.name === "set_build_spec" && !event.result.ok)?.result.issues).toContainEqual(expect.objectContaining({ code: "spec-invalid" }));
    expect(h.session.getActiveSpec("a")).toEqual(spec("a"));
    expect(h.session.getActiveSpec("b")).toEqual(spec("b"));
    const eventOffset = h.events.length;
    const result = await h.send([paint("a"), paint("b", 4), paint("a", 4)]);
    expect(result.proposedCalls.map(entry => [entry.args.mapId, entry.args.from])).toEqual([
      ["b", { x: 3, y: 3 }], ["a", { x: 3, y: 3 }], ["b", { x: 4, y: 3 }], ["a", { x: 4, y: 3 }],
    ]);
    const currentBatch = result.proposedCalls.filter(entry => h.events.slice(eventOffset).some(event => event.args === entry.args));
    expect(currentBatch).toHaveLength(3);
    const warnings = currentBatch.flatMap(entry => (entry.result.diff?.warnings ?? []).filter(warning => warning.startsWith(PROPOSAL_SCOPE_WARNING_PREFIX)).map(warning => ({ mapId: entry.args.mapId, warning })));
    expect(warnings.map(entry => entry.mapId)).toEqual(["a", "b"]);
    expect(result.proposedCalls.flatMap(entry => (entry.result.diff?.warnings ?? [])
      .filter(warning => warning.startsWith(PROPOSAL_SCOPE_WARNING_PREFIX)).map(() => entry.args.mapId))).toEqual(["b", "a", "b"]);
    expect(h.session.getCompletionSpecs(result.proposedCalls)).toEqual([spec("a"), spec("b")]);
  });

  it.each(["invalid-args", "throwing-runner"] as const)("commits only successful map-local expansion after %s", async failure => {
    const h = fixture();
    await h.send([setSpec(spec("a")), setSpec(spec("b"))]);
    if (failure === "throwing-runner") {
      const original = tools.runTool;
      const spy = vi.spyOn(tools, "runTool").mockImplementation((ctx, name, args, options) => {
        if (name === "fill_region") throw new Error("injected runner failure");
        return original(ctx, name, args, options);
      });
      const result = await h.send([fill("a")], {}, "error");
      expect(result.error).toBe("injected runner failure");
      expect(result.runOutcome).toEqual({ execution: "failed", goal: "incomplete", delivery: "no-change" });
      const response = h.session.getMessages().find(message => message.role === "tool" && message.tool_call_id === "b2_0");
      expect(JSON.parse(String(response?.content))).toMatchObject({ ok: false, issues: [{ code: "tool-loop-exception" }] });
      spy.mockRestore();
    } else {
      await h.send([fill("a", "invalid")]);
    }
    expect(h.session.getActiveSpec("a")).toEqual(spec("a"));
    expect(h.session.getActiveSpec("b")).toEqual(spec("b"));
    const result = await h.send([fill("a")]);
    expect(result.proposedCalls.map(entry => entry.name)).toEqual(["fill_region"]);
    expect(h.session.getActiveSpec("a")?.assets).toEqual([spec("a").assets[0], expect.objectContaining({ x: 12, y: 12, w: 3, h: 3 })]);
    expect(h.session.getActiveSpec("b")).toEqual(spec("b"));
    expect(h.session.getActiveSpec()?.mapId).toBe("a");
  });

  it("expires implicit A selection without evicting explicit B", async () => {
    const h = fixture();
    await h.send([setSpec(spec("b")), fill("a")], { scope: { mapId: "a", region: { x: 3, y: 3, width: 3, height: 3 } } });
    expect(h.events.at(-1)?.result.ok).toBe(true);
    expect(h.session.getActiveSpec("a")).toBeNull();
    const result = await h.send([paint("a", 12, 12), paint("b")]);
    expect(h.events.slice(-2).map(event => event.result.ok)).toEqual([false, true]);
    expect(h.events.at(-2)?.result.issues).toContainEqual(expect.objectContaining({ code: "spec-gate" }));
    expect(result.proposedCalls.map(entry => [entry.name, entry.args.mapId])).toEqual([["fill_region", "a"], ["paint_tiles", "b"]]);
    const currentBatch = result.proposedCalls.filter(entry => h.events.slice(-2).some(event => event.args === entry.args));
    expect(currentBatch.map(entry => entry.args.mapId)).toEqual(["b"]);
    expect(h.session.getActiveSpec("b")).toEqual(spec("b"));
  });

  it("uses per-map completeness precedence and does not merge identical asset IDs", async () => {
    const h = fixture();
    const full = (mapId: string): BuildSpec => ({ ...spec(mapId), assets: [...spec(mapId).assets, { id: "missing", kind: "prop", x: 15, y: 15, w: 1, h: 1 }] });
    await h.send([setSpec(full("a")), setSpec(full("b"))]);
    const result = await h.send([paint("a"), paint("b")]);
    const specs = h.session.getCompletionSpecs(result.proposedCalls);
    expect(specs).toEqual([full("a"), full("b")]);
    const warnings = proposalCompletenessWarnings({ buildSpecs: specs, calls: result.proposedCalls });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("a:");
    expect(warnings[1]).toContain("b:");
    const flags = ["one", "two", "three"].map(id => ({ name: "declare_story_flag", args: { id }, result: { ok: true } }));
    const generic = proposalCompletenessWarnings({ calls: flags });
    expect(generic).toHaveLength(1);
    expect(proposalCompletenessWarnings({ buildSpecs: specs, calls: [...result.proposedCalls, ...flags] })).toEqual([...warnings, ...generic]);
    // An explicit current-turn A spec wins over selection; B's selection wins
    // over historical B. C (unchanged/unknown) must never enter the denominator.
    const next = await h.send([setSpec(spec("a")), paint("a", 4), paint("b", 4)], { scope: { mapId: "b", region: { x: 3, y: 3, width: 2, height: 2 } } });
    expect(h.session.getCompletionSpecs(next.proposedCalls).map(value => [value.mapId, value.assets.map(asset => asset.id)])).toEqual([["a", ["terrain"]], ["b", ["선택 영역"]]]);
    expect(proposalCompletenessWarnings({ buildSpecs: h.session.getCompletionSpecs(next.proposedCalls), calls: next.proposedCalls })).toEqual([]);
    expect(h.session.getCompletionSpecs([])).toEqual([]);
  });

  it("preserves future planned maps through rebase and checks their own dimensions after B", async () => {
    const h = fixture();
    const future = { ...spec("future"), plannedMap: { mapId: "future", width: 20, height: 20 } };
    await h.send([setSpec(future), setSpec(spec("b"))]);
    h.session.rebaseProject(h.session.getProposedProject());
    expect(h.session.getActiveSpec("future")).toEqual(future);
    await h.send([call("author_village", { target: { kind: "new", mapId: "future", name: "Future", width: 21, height: 20 } })]);
    expect(h.events.at(-1)?.result).toMatchObject({ ok: false, issues: [expect.objectContaining({ code: "spec-gate" })] });
    expect(h.events.at(-1)?.result.summary).toContain("plannedMap");
    expect(h.session.getProposedProject().maps.future).toBeUndefined();
    expect(h.session.getActiveSpec("b")).toEqual(spec("b"));
  });

  it("prunes a successful removal before ID reuse, not failed removal or surviving maps", async () => {
    const h = fixture();
    const start = h.project.startMapId;
    await h.send([setSpec(spec(start)), setSpec(spec("a")), setSpec(spec("b")), call("remove_map", { mapId: start })]);
    expect(h.events.at(-1)?.result.ok).toBe(false);
    expect(h.session.getActiveSpec(start)).toEqual(spec(start));
    await h.send([call("remove_map", { mapId: "a" }), call("create_map", { id: "a", name: "Reused", width: 20, height: 20 }), paint("a"), paint("b")]);
    expect(h.events.slice(-4).map(event => event.result.ok)).toEqual([true, true, false, true]);
    expect(h.session.getActiveSpec("a")).toBeNull();
    expect(h.session.getActiveSpec("b")).toEqual(spec("b"));
    expect(h.session.getActiveSpec()).toEqual(spec("b"));
  });

  it("prunes external rebase deletions while preserving surviving and never-created maps", async () => {
    const h = fixture({ declareIntent: fixedDeclarer({ mode: "modify", resetsContext: true }) });
    const future = { ...spec("future"), plannedMap: { mapId: "future", width: 20, height: 20 } };
    await h.send([setSpec(spec("a")), setSpec(spec("b")), setSpec(future)]);
    const ctx = { project: h.session.getProposedProject() };
    expect(tools.runTool(ctx, "remove_map", { mapId: "a" }).ok).toBe(true);
    h.session.rebaseProject(ctx.project);
    expect(h.session.getActiveSpec("a")).toBeNull();
    expect(h.session.getActiveSpec("future")).toEqual(future);
    await h.send([paint("b")]);
    expect(h.events.at(-1)?.result.ok).toBe(true);
    expect(h.session.getActiveSpec("b")).toEqual(spec("b"));
  });

  it("builds pending NPC assets from every current map, never historical specs", async () => {
    const h = fixture();
    const npcSpec = (mapId: string): BuildSpec => ({ mapId, assets: [{ id: "villager", kind: "npc", x: 3, y: 3, w: 1, h: 1 }] });
    await h.send([setSpec(npcSpec(h.project.startMapId))]);
    await h.send([setSpec(npcSpec("a")), setSpec(npcSpec("b")), setSpec({ ...spec("future"), plannedMap: { mapId: "future", width: 20, height: 20 } })]);
    // Invoke only the fallback boundary: the tools and project mutation are real;
    // dialogue/cast repair remains a separate contract, not a fake review here.
    const fallback: unknown = Reflect.get(h.session, "buildSpecNpcAssetsDirectly");
    if (typeof fallback !== "function") throw new Error("NPC fallback boundary is unavailable");
    const events: ToolEvent[] = [];
    const proposals = new Map<string, import("@/ai/assistantSession").ProposedCall>();
    expect(fallback.call(h.session, (event: SessionEvent) => { if (event.type === "tool_call") events.push(event); }, proposals)).toBe(2);
    expect(events.map(event => [event.args.mapId, event.result.ok])).toEqual([["a", true], ["b", true]]);
    expect([...proposals.values()].map(entry => entry.args.mapId)).toEqual(["a", "b"]);
    for (const id of ["a", "b"]) expect(h.session.getProposedProject().maps[id].events).toHaveLength(1);
    expect(h.session.getProposedProject().maps[h.project.startMapId].events).toEqual(h.project.maps[h.project.startMapId].events);
  });

  it("clears every spec on successful reset, including reused start ID and future plans", async () => {
    const h = fixture();
    const start = h.project.startMapId;
    await h.send([setSpec(spec(start)), setSpec({ ...spec("future"), plannedMap: { mapId: "future", width: 20, height: 20 } }), call("reset_project", { title: "Invalid" })]);
    expect(h.events.at(-1)?.result.ok).toBe(false);
    expect(h.session.getActiveSpec(start)).toEqual(spec(start));
    await h.send([call("reset_project", { title: "Fresh", prompt: "Discard this test project" }), paint(start)]);
    expect(h.events.slice(-2).map(event => event.result.ok)).toEqual([true, false]);
    expect(h.session.getActiveSpec(start)).toBeNull();
    expect(h.session.getActiveSpec("future")).toBeNull();
    expect(h.session.getActiveSpec()).toBeNull();
  });
});

describe("ordered terrain background and road overlay", () => {
  it.each([undefined, [], ["road", "terrain"], ["terrain"], ["terrain", "road"]].map(buildOrder => ({ buildOrder })))("validates explicit order $buildOrder without weakening house overlap", ({ buildOrder }) => {
    const project = createBlankProject();
    const base: BuildSpec = { mapId: project.startMapId, buildOrder, assets: [
      { id: "ground", kind: "terrain", x: 2, y: 2, w: 12, h: 10 },
      { id: "path", kind: "road", x: 3, y: 5, w: 10, h: 2 },
    ] };
    const allowed = buildOrder?.join(",") === "terrain,road";
    expect(validateBuildSpec(project, base).some(issue => issue.severity === "error")).toBe(!allowed);
    expect(validateBuildSpec(project, { ...base, assets: [base.assets[0], { ...base.assets[1], kind: "house" }], buildOrder: ["terrain", "house"] }).some(issue => issue.severity === "error")).toBe(true);
  });

  it("executes the terrain then road batch with no dependency deferral", async () => {
    const h = fixture();
    await h.send([setSpec({ mapId: "a", buildOrder: ["terrain", "road"], assets: [
      { id: "ground", kind: "terrain", x: 2, y: 2, w: 14, h: 14 },
      { id: "road", kind: "road", x: 3, y: 5, w: 10, h: 1 },
    ] }), call("fill_region", { mapId: "a", rect: { x: 2, y: 2, w: 14, h: 14 }, material: "모래", shape: "rect" }),
    call("paint_road", { mapId: "a", points: [{ x: 3, y: 5 }, { x: 12, y: 5 }], style: "dirt" })]);
    expect(h.events.map(event => event.result.ok)).toEqual([true, true, true]);
    expect(h.events.slice(1).every(event => (event.result.diff?.tilesChanged ?? 0) > 0)).toBe(true);
  });
});
