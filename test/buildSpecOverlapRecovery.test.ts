import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type AssistantSessionOptions, type SessionEvent } from "@/ai/assistantSession";
import * as specs from "@/ai/buildSpec";
import type { BuildSpec } from "@/ai/buildSpec";
import { parseRunRecapPayload, serializeRunRecap } from "@/ai/runRecap";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import capturedPlans from "./fixtures/buildSpecOverlapPlans.json";
import { fixedDeclarer } from "./intentFixture";

type ToolEvent = Extract<SessionEvent, { type: "tool_call" }>;
type Call = { name: string; args: Record<string, unknown> };
const setSpec = (spec: unknown): Call => ({ name: "set_build_spec", args: { ...(spec as Record<string, unknown>) } });
const errors = (project: ReturnType<typeof createBlankProject>, spec: unknown) => specs.validateBuildSpec(project, spec).filter(issue => issue.severity === "error");
const OVERLAP = "spec-new-plan-overlap";

afterEach(() => vi.restoreAllMocks());

function fixture(existing = false) {
  const ctx = { project: createBlankProject() };
  expect(runTool(ctx, "create_map", { id: "m1", name: "Geometry", width: 20, height: 20 }).ok).toBe(true);
  if (existing) {
    const map = ctx.project.maps.m1;
    for (const { x, y } of [{ x: 3, y: 3 }, { x: 12, y: 12 }]) {
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) map.lowerTiles[(y + dy) * map.width + x + dx] = TILE.WALL;
    }
  }
  return ctx.project;
}

function intersecting(): BuildSpec {
  return { mapId: "m1", buildOrder: ["terrain"], assets: [
    { id: "a", kind: "terrain", x: 2, y: 2, w: 6, h: 6 },
    { id: "b", kind: "terrain", x: 4, y: 4, w: 6, h: 6 },
  ] };
}

function crossroads(): BuildSpec {
  return { mapId: "m1", buildOrder: ["terrain", "road"], assets: [
    { id: "ground", kind: "terrain", x: 2, y: 2, w: 14, h: 14 },
    { id: "ew", kind: "road", x: 3, y: 8, w: 12, h: 1 },
    { id: "ns", kind: "road", x: 8, y: 3, w: 1, h: 12 },
  ] };
}

async function dispatch(project: ReturnType<typeof fixture>, calls: Call[]) {
  const chat = vi.fn<NonNullable<AssistantSessionOptions["chat"]>>().mockResolvedValueOnce({
    message: { role: "assistant", content: null, tool_calls: calls.map((call, index) => ({
      id: `c${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
    })) }, finishReason: "tool_calls",
  });
  const session = new AssistantSession(project, {
    config: { authMode: "apiKey", baseUrl: "x", model: "stub", apiKey: "test", maxToolCalls: 1, maxTokens: 8192 },
    chat, declareIntent: fixedDeclarer({ mode: "modify" }),
  });
  const events: ToolEvent[] = [];
  // Subscribe before dispatch; await the real turn promise within Vitest's bounded timeout.
  const result = await session.sendUserMessage("Validate the requested layout", event => {
    if (event.type === "tool_call") events.push(event);
  });
  expect(chat).toHaveBeenCalledTimes(1);
  const responses = session.getMessages().filter(message => message.role === "tool");
  expect(responses.map(message => message.tool_call_id)).toEqual(calls.map((_, index) => `c${index}`));
  const wire = responses.map(message => JSON.parse(String(message.content)));
  return { session, events, result, wire };
}

describe("new-plan geometry remains a declared-kind gate", () => {
  // Exact parsed set_build_spec arguments from archived Round9 terminal-harness.json;
  // only the test map identity/dimensions are supplied here. No archive is edited.
  it.each([0, 1, 2, 3])("recorded all-terrain attempt %s retains its original error count", index => {
    const plan = capturedPlans[index];
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "resize_map", { mapId: ctx.project.startMapId, width: 20, height: 15 }).ok).toBe(true);
    expect(errors(ctx.project, { ...plan, mapId: ctx.project.startMapId })).toHaveLength([5, 5, 5, 7][index]);
  });

  it("assigns every recorded intersection a distinct machine code", () => {
    const project = fixture();
    for (const [index, plan] of capturedPlans.entries()) {
      expect(errors(project, { ...plan, mapId: "m1" }).map(issue => issue.code)).toEqual(Array([5, 5, 5, 7][index]).fill(OVERLAP));
    }
  });

  it.each([undefined, [], ["road", "terrain"], ["terrain"], ["road"], ["terrain", "road"]].map(buildOrder => ({ buildOrder })))
  ("accepts terrain plus crossroads only in complete terrain-before-road order: $buildOrder", ({ buildOrder }) => {
    expect(errors(fixture(), { ...crossroads(), buildOrder })).toHaveLength(buildOrder?.join(",") === "terrain,road" ? 0 : 2);
  });

  it("road-road crossings do not require buildOrder", () => {
    expect(errors(fixture(), { ...crossroads(), assets: crossroads().assets.slice(1), buildOrder: undefined })).toEqual([]);
  });

  it.each(["keep", "clear"] as const)("duplicate and intersecting terrain remain invalid with overExisting=%s and any order", overExisting => {
    const project = fixture();
    for (const duplicate of [false, true]) for (const buildOrder of [undefined, ["terrain"], ["terrain", "road"], ["road", "terrain"]]) {
      const spec = intersecting();
      const assets = spec.assets.map((asset, index) => ({ ...(duplicate ? spec.assets[0] : asset), id: `a${index}`, overExisting }));
      expect(errors(project, { ...spec, assets, buildOrder })).toHaveLength(1);
    }
  });

  it("adjacent terrain partitions pass without treating shared edges as intersections", () => {
    expect(errors(fixture(), { mapId: "m1", buildOrder: ["terrain"], assets: [
      { id: "left", kind: "terrain", x: 0, y: 0, w: 10, h: 20 },
      { id: "right", kind: "terrain", x: 10, y: 0, w: 10, h: 20 },
    ] })).toEqual([]);
  });

  it("changing only the recorded road kinds and order still leaves grass/water intersections", () => {
    const plan = capturedPlans[0];
    const assets = plan.assets.map(asset => ({ ...asset, kind: ["road_ew", "road_ns"].includes(asset.id) ? "road" : asset.kind }));
    expect(errors(fixture(), { ...plan, mapId: "m1", assets, buildOrder: ["terrain", "road"] })).toHaveLength(1);
  });

  it("does not infer kinds from IDs or style labels, and retains flexible kinds and coordinate coercion", () => {
    const project = fixture();
    expect(errors(project, { ...intersecting(), assets: intersecting().assets.map(asset => ({ ...asset, id: `road_${asset.id}`, style: "흙길" })) })).toHaveLength(1);
    const spec = crossroads();
    expect(errors(project, { ...spec, assets: spec.assets.map(asset => ({ ...asset, style: "물" })) })).toEqual([]);
    expect(errors(project, { mapId: "m1", assets: [{ id: "custom", kind: "custom-kind", x: "2", y: "2", w: "3", h: "3" }] })).toEqual([]);
  });

  it("retains different-layer and non-tile exceptions but rejects terrain-house overlap", () => {
    const project = fixture();
    for (const kind of ["npc", "event", "transfer"]) {
      expect(errors(project, { ...intersecting(), assets: [intersecting().assets[0], { ...intersecting().assets[1], kind }] })).toEqual([]);
    }
    expect(errors(project, { ...intersecting(), assets: [intersecting().assets[0], { ...intersecting().assets[1], layer: "upper" }] })).toEqual([]);
    expect(errors(project, { ...intersecting(), buildOrder: ["terrain", "house"], assets: [intersecting().assets[0], { ...intersecting().assets[1], kind: "house" }] })).toHaveLength(1);
  });

  it("existing placement and destructive clear still require separate authorization", () => {
    const project = fixture(true);
    const asset = intersecting().assets[0];
    expect(errors(project, { mapId: "m1", assets: [asset] })).toHaveLength(1);
    for (const overExisting of ["keep", "clear"]) expect(errors(project, { mapId: "m1", assets: [{ ...asset, overExisting }] })).toEqual([]);
    for (const overExisting of [undefined, "keep", "clear"]) expect(errors(project, { mapId: "m1", assets: [{ ...asset, kind: "clear", overExisting }] })).toHaveLength(1);
    expect(errors(project, { mapId: "m1", assets: [{ ...asset, kind: "clear", confirmDestroy: true }] })).toEqual([]);
    expect(errors(project, { mapId: "m1", buildOrder: ["clear", "terrain"], assets: [{ ...asset, id: "clear", kind: "clear", confirmDestroy: true }, asset] })).toEqual([]);
  });
});

describe("code-selected recovery through the dispatched session tool", () => {
  it.each([false, true])("preserves codes to events, audit and model JSON; mixed existing conflicts=%s", async mixed => {
    const project = fixture(mixed);
    const spec = intersecting();
    if (mixed) spec.assets.push({ id: "destroy", kind: "clear", x: 12, y: 12, w: 3, h: 3 });
    const validate = specs.validateBuildSpec;
    // Preserve actual validation and codes but adversarially change prose. Branching
    // must not treat a remedy-field name in an intersection's message as a demand.
    vi.spyOn(specs, "validateBuildSpec").mockImplementation((project, spec) => validate(project, spec).map(issue => ({
      ...issue, message: issue.code === OVERLAP ? "overExisting confirmDestroy" : "localized diagnostic",
    })));
    const h = await dispatch(project, [setSpec(spec)]);
    const codes = [OVERLAP, ...(mixed ? ["spec-existing-content", "spec-existing-content", "spec-destroy-confirmation"] : []), "spec-invalid"];
    expect(h.events[0].result.issues?.map(issue => issue.code)).toEqual(codes);
    expect(h.wire[0].issues.map((issue: { code: string }) => issue.code)).toEqual(codes);
    expect(h.events[0].result.data).toEqual({ rejections: 1, repeated: false, discarded: false,
      recovery: { newPlanOverlap: true, remedyFields: mixed ? ["overExisting", "confirmDestroy"] : [] } });
    expect(h.wire[0].data).toEqual(h.events[0].result.data);
    expect(h.session.getAuditEntries().find(entry => entry.kind === "tool" && entry.name === "set_build_spec")).toMatchObject({ ok: false, issueCodes: codes });
    expect(h.session.getActiveSpec("m1")).toBeNull();
    expect(h.session.getProposedProject()).toEqual(project);
  });

  it("does not manufacture an existing-content remedy from an asset ID", async () => {
    const spec = intersecting();
    spec.assets[0].id = "overExisting-confirmDestroy";
    const h = await dispatch(fixture(), [setSpec(spec)]);
    expect(h.wire[0].data.recovery).toEqual({ newPlanOverlap: true, remedyFields: [] });
  });

  it("retains existing-only remedies and resets rejection state after a valid correction", async () => {
    const project = fixture(true);
    const asset = intersecting().assets[0];
    const bad = { mapId: "m1", assets: [asset] };
    const good = { ...bad, assets: [{ ...asset, overExisting: "keep" }] };
    const h = await dispatch(project, [setSpec(bad), setSpec(good), setSpec(bad)]);
    expect(h.events.map(event => event.result.ok)).toEqual([false, true, false]);
    expect(h.wire[0].data).toEqual({ rejections: 1, repeated: false, discarded: false, recovery: { newPlanOverlap: false, remedyFields: ["overExisting"] } });
    expect(h.wire[2].data).toEqual(h.wire[0].data);
    expect(h.session.getActiveSpec("m1")).toEqual(good);
  });

  it("keeps repeat detection, discard threshold and failure accounting on the four captures", async () => {
    const plans = capturedPlans.map(plan => ({ ...plan, mapId: "m1" }));
    const h = await dispatch(fixture(), plans.map(setSpec));
    expect(h.events.map(event => event.result.ok)).toEqual([false, false, false, false]);
    expect(h.wire.map(result => result.data)).toEqual(plans.map((_, index) => ({ rejections: index + 1, repeated: false, discarded: index >= 2, recovery: { newPlanOverlap: true, remedyFields: [] } })));
    expect(h.wire.map(result => result.issues.filter((issue: { code: string }) => issue.code === OVERLAP).length)).toEqual([5, 5, 5, 7]);
    expect(h.result.recap?.toolFailures).toBe(4);
    expect(h.result.recap?.deferredToolCalls).toBeUndefined();
    const bad = intersecting();
    const reshuffled = { assets: bad.assets.map(({ id, kind, x, y, w, h }) => ({ h, w, y, x, kind, id })), buildOrder: bad.buildOrder, mapId: bad.mapId };
    const repeats = await dispatch(fixture(), [setSpec(bad), setSpec(reshuffled), setSpec(bad)]);
    expect(repeats.wire.map(result => [result.data.rejections, result.data.repeated, result.data.discarded])).toEqual([[1, false, false], [2, true, false], [3, true, true]]);
  });

  it("unchanged aggregate retry bound includes mixed failure classes and defers dependent writes", async () => {
    const bad = intersecting();
    const bounds = { mapId: "m1", assets: [{ ...bad.assets[0], x: 30 }] };
    const plan: Call = { name: "set_work_plan", args: { goal: "Geometry", layers: [{ title: "Terrain", items: [{ title: "Layout", instruction: "Build terrain", mapTargets: ["m1"], successTools: ["fill_region"] }] }] } };
    const fill: Call = { name: "fill_region", args: { mapId: "m1", rect: { x: 2, y: 2, w: 3, h: 3 }, material: "모래", shape: "rect" } };
    const project = fixture();
    const h = await dispatch(project, [plan, ...[bad, bounds, bad, bounds, bad, bounds].map(setSpec), fill]);
    expect(h.events[0].result.ok).toBe(true);
    expect(h.events.slice(1, 5).map(event => event.result.ok)).toEqual([false, false, false, false]);
    expect(h.events.slice(5, 7).map(event => event.result.data)).toEqual(Array(2).fill({ code: "tool-deferred", executed: false, reason: "tool-retry-exhausted" }));
    expect(h.events[7].result.data).toEqual({ code: "tool-deferred", executed: false, reason: "build-spec-dependency-failed" });
    expect(h.result.recap).toMatchObject({ toolFailures: 4, deferredToolCalls: 3 });
    expect(parseRunRecapPayload(serializeRunRecap(h.result.recap!))).toMatchObject({ toolFailures: 4, deferredToolCalls: 3 });
    expect(h.result.proposedCalls).toEqual([]);
    expect(h.session.getProposedProject()).toEqual(project);
    expect(h.session.getWorkPlan()?.layers[0].items[0].status).toBe("blocked");
  });

  it("executes the supported terrain and crossing-road sequence through real tools", async () => {
    const h = await dispatch(fixture(), [setSpec(crossroads()),
      { name: "fill_region", args: { mapId: "m1", rect: { x: 2, y: 2, w: 14, h: 14 }, material: "모래", shape: "rect" } },
      ...[[{ x: 3, y: 8 }, { x: 14, y: 8 }], [{ x: 8, y: 3 }, { x: 8, y: 14 }]].map(points => ({ name: "paint_road", args: { mapId: "m1", points, style: "dirt" } })),
    ]);
    expect(h.events.map(event => event.result.ok)).toEqual([true, true, true, true]);
    expect(h.events.slice(1).every(event => (event.result.diff?.tilesChanged ?? 0) > 0)).toBe(true);
    expect(h.result.proposedCalls.map(call => call.name)).toEqual(["fill_region", "paint_road", "paint_road"]);
    expect(h.result.recap?.toolFailures).toBe(0);
    expect(h.result.recap?.deferredToolCalls).toBeUndefined();
  });
});
