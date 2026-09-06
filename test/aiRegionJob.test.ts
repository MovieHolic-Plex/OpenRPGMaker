import { describe, it, expect, beforeEach, vi } from "vitest";
import { runtimeGraph } from "./aiJobWorkerIsolation.test";

describe("isolated region generation", () => {
  it("does not boot the editor, store, pending slot, or preference distillation", () => {
    const graph = runtimeGraph("src/ai/jobs/executors/regionJob.ts");
    expect(graph.filter(path => /project\/store\.ts$|editor\/panels\/|editorState\.ts$|mapEditHistory\.ts$|pendingRegionApply\.ts$|agentGhostPreview\.ts$|preferenceDistiller\.ts$|pwa/i.test(path))).toEqual([]);
  });
});


import { createHash } from "node:crypto";
import { MessageChannel } from "node:worker_threads";
import { executeRegionJob, type RegionJobPayload } from "@/ai/jobs/executors/regionJob";
import { jsonObject, jsonValue, parseProject, parseSessionJobState, type SessionJobState } from "@/ai/jobs/checkpointState";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { finalizeRegionGeneration } from "@/editor/regionTask/regionGenerationCore";
import { captureHouseProtection } from "@/editor/tools/houseProtection";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject, TILE } from "@/project/defaults";
import { requireRecord } from "@/project/io/guards";
import type { AiJobHost } from "../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobInput, AiJobCheckpoint, BlobRef, JsonValue } from "@/ai/jobs/contracts";
import { declaredIntent } from "./intentFixture";
import { completedHouseProject } from "./fixtures/completedHouse";

const region = { x: 2, y: 2, width: 6, height: 6 };
const config = { authMode: "chatgpt" as const, providerId: "google-antigravity", agentMode: "chat" as const,
  model: "gemini-3.7-flash", liteModel: "gemini-3.7-flash", maxToolCalls: 8, maxTokens: 4096 };
const final = (content = "Done"): JsonValue => ({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] });
const tool = (name: string, args: unknown): JsonValue => jsonValue({ choices: [{ message: { role: "assistant", content: null,
  tool_calls: [{ id: `call-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: "tool_calls" }] });
const intent = (tools: string[]) => final(JSON.stringify(declaredIntent({ mode: "modify", space: "outdoor", tools, useSelection: true })));

async function fixture(project = createBlankProject(), options: Partial<RegionJobPayload> = {}) {
  const blobs = new Map<string, JsonValue>();
  let checkpoint: AiJobCheckpoint | null = null;
  const putJson = async (value: JsonValue): Promise<BlobRef> => {
    const bytes = JSON.stringify(value), sha256 = createHash("sha256").update(bytes).digest("hex");
    blobs.set(sha256, structuredClone(value));
    // The real host acknowledges durable transactions across the worker boundary.
    // Preserve that event boundary instead of making the entire suite one long
    // microtask chain that starves IPC (including Vitest's task-update receipts).
    const { port1, port2 } = new MessageChannel();
    try {
      await bounded(new Promise<void>((resolve, reject) => {
        port1.once("message", () => resolve());
        port1.once("messageerror", reject);
        port2.postMessage(null);
      }));
    } finally { port1.close(); port2.close(); }
    return { sha256, byteLength: Buffer.byteLength(bytes), mediaType: "application/json" };
  };
  const host: AiJobHost = { jobId: "region-job", attemptId: "attempt-1", dependencies: [], putJson,
    readJson: async ref => { const value = blobs.get(ref.sha256); if (value === undefined) throw new Error("Missing immutable blob"); return structuredClone(value); },
    readBlob: async () => { throw new Error("Unexpected binary read"); }, putBlob: async () => { throw new Error("Unexpected binary write"); },
    loadCheckpoint: async () => structuredClone(checkpoint),
    saveCheckpoint: async next => { checkpoint = { ...structuredClone(next), version: 1, jobId: host.jobId, attemptId: host.attemptId, inputSha256: "captured-input" }; return putJson(jsonValue(checkpoint)); },
    providerOperation: async () => { throw new Error("Unexpected provider dispatch"); },
  };
  const payload: RegionJobPayload = { instruction: "Generate captured region", mapId: project.startMapId, region, mode: "task", config,
    context: { currentMapId: project.startMapId, budgetChars: 18000, preferenceMemorySection: "Captured region preference",
      viewport: { mapId: project.startMapId, x: 0, y: 0, w: 12, h: 12, centerX: 6, centerY: 6 } }, ...options };
  const input: AiJobInput & { family: "region" } = { version: 1, family: "region", project: { backend: "local", projectId: "submitted-A" },
    projectSnapshot: await putJson(jsonValue(project)), artwork: [], target: { mapId: payload.mapId }, mode: payload.mode,
    payload: jsonObject(jsonValue(payload)), dependsOn: [] };
  return { host, input, payload, blobs, checkpoint: () => { if (!checkpoint) throw new Error("Missing checkpoint"); return structuredClone(checkpoint); } };
}
function wireHost(host: AiJobHost, responses: JsonValue[]) {
  const ledger = new Map<string, { request: JsonValue; response: JsonValue }>();
  host.providerOperation = async ({ key, request }) => {
    const prior = ledger.get(key);
    if (prior) { expect(request).toEqual(prior.request); return structuredClone(prior.response); }
    const response = responses[ledger.size];
    if (!response) throw new Error("Unexpected physical dispatch");
    ledger.set(key, { request: structuredClone(request), response });
    return structuredClone(response);
  };
  return ledger;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Boundary not reached")), 10000); })]); }
  finally { clearTimeout(timer); }
}
beforeEach(() => resetIntentDeclarationCache());

it("clips real outside-region tile/event writes without changing either snapshot", () => {
  const base = createBlankProject(), mapId = base.startMapId;
  base.maps[mapId].lowerTiles.fill(243);
  const ctx = { project: structuredClone(base) };
  const painted = runTool(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: 240, cells: [{ x: 3, y: 3 }, { x: 10, y: 10 }] });
  expect(painted.ok, painted.summary).toBe(true);
  for (const [x, name] of [[3, "inside"], [10, "outside"]] as const) {
    const placed = runTool(ctx, "place_npc", { mapId, x, y: 4, name, pages: [{ lines: [name] }] });
    expect(placed.ok, placed.summary).toBe(true);
  }
  const before = jsonValue(base), proposedBefore = jsonValue(ctx.project);
  const result = finalizeRegionGeneration(base, ctx.project, { mapId, region, mode: "task", instruction: "place" }, ["paint_tiles", "place_npc"]);
  expect(result.clippedCells).toBeGreaterThan(0);
  expect(result.changedCells).toBeGreaterThan(0);
  expect(result.changedEvents).toBe(1);
  expect(result.project.maps[mapId].lowerTiles[10 * base.maps[mapId].width + 10]).toBe(base.maps[mapId].lowerTiles[10 * base.maps[mapId].width + 10]);
  expect(result.project.maps[mapId].events.some(event => event.x === 10 && event.y === 4)).toBe(false);
  expect(jsonValue(base)).toEqual(before);
  expect(jsonValue(ctx.project)).toEqual(proposedBefore);
});

it("retains a new interior-only map from a real session across a deferred provider boundary", async () => {
  const base = createBlankProject();
  const f = await fixture(base);
  const ledger = wireHost(f.host, [intent(["create_map"]), tool("create_map", { name: "Private interior", width: 8, height: 8 }), final()]);
  const dispatch = f.host.providerOperation;
  const reached = deferred<void>(), release = deferred<void>();
  f.host.providerOperation = async operation => {
    if (operation.key === "region/provider/2") { reached.resolve(); await bounded(release.promise); }
    return dispatch(operation);
  };
  const running = executeRegionJob(f.input, f.host);
  await bounded(Promise.race([reached.promise, running.then(() => { throw new Error("Job completed before provider barrier"); })]));
  // Simulate the submitting editor moving to an unrelated map/project while work is held.
  base.maps[base.startMapId].name = "Live editor B";
  base.startPos = { x: 9, y: 9 };
  release.resolve();
  const result = await running;
  expect(result.family).toBe("region");
  expect(result.project.projectId).toBe("submitted-A");
  expect(result.baseSnapshot).toEqual(f.input.projectSnapshot);
  expect(result.payload).toMatchObject({ mapsAdded: 1, changedCells: 0, changedEvents: 0, applied: false, persistence: "not-applicable", completion: "complete" });
  expect(result.payload.review).toBeTruthy();
  if (!result.generatedSnapshot) throw new Error("Missing result snapshot");
  const proposed = parseProject(await f.host.readJson(result.generatedSnapshot));
  const newMaps = Object.keys(proposed.maps).filter(id => !base.maps[id]);
  expect(newMaps).toHaveLength(1);
  expect(proposed.maps[newMaps[0]].name).toBe("Private interior");
  expect(proposed.maps[proposed.startMapId].name).not.toBe("Live editor B");
  expect(base.maps[newMaps[0]]).toBeUndefined();
  expect([...ledger.keys()]).toEqual(["region/provider/0", "region/provider/1", "region/provider/2"]);
  resetIntentDeclarationCache();
  const replay = await executeRegionJob(f.input, { ...f.host, attemptId: "attempt-2" });
  expect(replay.generatedSnapshot).toEqual(result.generatedSnapshot);
  expect(replay.payload).toEqual(result.payload);
  expect(replay.attemptId).toBe("attempt-2");
  expect(ledger.size).toBe(3);
}, 30000);

it("retains allocated map IDs and paid responses after a post-response interruption", async () => {
  const f = await fixture();
  const ledger = wireHost(f.host, [intent(["create_map"]), tool("create_map", { name: "Stable room", width: 8, height: 8 }), final()]);
  const dispatch = f.host.providerOperation;
  let interrupted = false;
  f.host.providerOperation = async operation => {
    const response = await dispatch(operation);
    if (operation.key === "region/provider/2" && !interrupted) { interrupted = true; throw new Error("Worker lost after durable response"); }
    return response;
  };
  await expect(executeRegionJob(f.input, f.host)).rejects.toThrow("Worker lost");
  const saved = f.checkpoint();
  expect(saved.stageKey).toBe("region/partial/session");
  expect(saved.state.completed).toBeUndefined();
  const session = requireRecord("session", saved.state.session);
  const partial = await parseSessionJobState(session.state, f.host);
  const map = Object.values(partial.draft.maps).find(map => map.name === "Stable room");
  expect(map).toBeTruthy();
  expect(partial.tools.some(tool => tool.name === "create_map")).toBe(true);
  resetIntentDeclarationCache();
  const result = await executeRegionJob(f.input, { ...f.host, attemptId: "attempt-2" });
  expect(ledger.size).toBe(3);
  if (!result.generatedSnapshot || !map) throw new Error("Missing map output");
  const generated = parseProject(await f.host.readJson(result.generatedSnapshot));
  expect(generated.maps[map.id]).toEqual(map);
}, 30000);

it.each(["task", "polish"] as const)("protects a completed new house from north-ridge clipping (%s), retaining raw output", async mode => {
  const base = createBlankProject(); base.startPos = { x: 0, y: 0 };
  base.maps[base.startMapId].lowerTiles.fill(240); base.maps[base.startMapId].upperTiles.fill(-1);
  const f = await fixture(base, { mode });
  const ledger = wireHost(f.host, [intent(["author_house"]), tool("author_house", { kind: "single", mapId: base.startMapId,
    kitId: "bright-plaster", wings: [{ x: 2, y: 2, w: 6, h: 6 }], interior: "exterior-only", yard: [] }), final()]);
  await expect(executeRegionJob(f.input, f.host)).rejects.toMatchObject({ code: "protected-house-write" });
  expect(f.checkpoint().stageKey).toBe("region/partial/review");
  const state = await parseSessionJobState(requireRecord("session", f.checkpoint().state.session).state, f.host);
  expect(state.completed).toBeTruthy();
  expect(captureHouseProtection(state.draft)).toMatchObject([{ id: "house_1" }]);
  expect(state.draft.maps[base.startMapId].lowerTiles[base.maps[base.startMapId].width + 3]).toBe(374);
  expect(captureHouseProtection(base)).toHaveLength(0);
  resetIntentDeclarationCache();
  await expect(executeRegionJob(f.input, { ...f.host, attemptId: "attempt-2" })).rejects.toMatchObject({ code: "protected-house-write" });
  expect(ledger.size).toBe(3);
}, 30000);

it("protects existing houses from deterministic seam polish", () => {
  const base = completedHouseProject(), map = base.maps[base.startMapId];
  map.lowerTiles[2 * map.width + 3] = 421;
  const proposed = structuredClone(base);
  proposed.maps[map.id].lowerTiles[map.width + 2] = 243;
  expect(() => finalizeRegionGeneration(base, proposed, { mapId: map.id,
    region: { x: 2, y: 1, width: 8, height: 8 }, mode: "polish", instruction: "polish" }, [])).toThrow();
});

it("rejects malformed input, project and checkpoint before any provider request", async () => {
  const f = await fixture();
  const provider = vi.fn(async () => final()); f.host.providerOperation = provider;
  for (const payload of [
    { ...f.input.payload, region: { ...region, x: 0.5 } },
    { ...f.input.payload, mapId: "missing" },
    { ...f.input.payload, config: { ...config, authMode: "apiKey" } },
    { ...f.input.payload, context: { ...f.payload.context, currentMapId: "live-B" } },
  ]) await expect(executeRegionJob({ ...f.input, payload: jsonObject(jsonValue(payload)) }, f.host)).rejects.toThrow();
  const invalidProject = await f.host.putJson({ version: 4, maps: {}, tilesets: {}, database: {} });
  await expect(executeRegionJob({ ...f.input, projectSnapshot: invalidProject }, f.host)).rejects.toThrow();
  await f.host.saveCheckpoint({ stageKey: "region/start", state: { version: 2, kind: "region" }, artifacts: [] });
  await expect(executeRegionJob(f.input, f.host)).rejects.toThrow("Unsupported region checkpoint");
  expect(provider).not.toHaveBeenCalled();
});

it("retries failed region output storage without replaying completed session or artwork", async () => {
  const base = createBlankProject();
  const artwork = { id: "region-artwork", name: "Retained artwork", kind: "sprite" as const,
    dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9X8AAAAASUVORK5CYII=", meta: { width: 1, height: 1 } };
  base.assets.uploaded[artwork.id] = artwork;
  const f = await fixture(base);
  const ledger = wireHost(f.host, [intent(["create_map"]), tool("create_map", { name: "Retained room", width: 8, height: 8 }), final()]);
  const putJson = f.host.putJson;
  let failed = false;
  f.host.putJson = async value => {
    if (!failed && (await f.host.loadCheckpoint())?.stageKey === "region/session/completed") {
      failed = true; throw new Error("Output storage unavailable");
    }
    return putJson(value);
  };
  await expect(executeRegionJob(f.input, f.host)).rejects.toThrow("Output storage unavailable");
  const partial = f.checkpoint();
  expect(partial.stageKey).toBe("region/partial/review");
  const session = await parseSessionJobState(requireRecord("session", partial.state.session).state, f.host);
  if (!session.completed) throw new Error("Missing retained completed session");
  const retained = session.completed.generatedSnapshot;
  expect(partial.artifacts).toContainEqual(retained);
  const proposedBefore = await f.host.readJson(retained);
  resetIntentDeclarationCache();
  const provider = vi.fn(f.host.providerOperation); f.host.providerOperation = provider;
  const result = await executeRegionJob(f.input, { ...f.host, attemptId: "attempt-2" });
  expect(provider).not.toHaveBeenCalled();
  expect(ledger.size).toBe(3);
  if (!result.generatedSnapshot) throw new Error("Missing final proposal");
  const generated = parseProject(await f.host.readJson(result.generatedSnapshot));
  expect(generated).toEqual(parseProject(proposedBefore));
  expect(generated.assets.uploaded[artwork.id]).toEqual(artwork);
  expect((await f.host.readJson(retained))).toEqual(proposedBefore);
}, 30000);

it.each(["task", "polish"] as const)("returns an intact completed house and review metadata (%s)", async mode => {
  const base = createBlankProject(); base.startPos = { x: 0, y: 0 };
  base.maps[base.startMapId].lowerTiles.fill(240); base.maps[base.startMapId].upperTiles.fill(-1);
  const f = await fixture(base, { mode, region: { x: 2, y: 1, width: 6, height: 7 } });
  wireHost(f.host, [intent(["author_house"]), tool("author_house", { kind: "single", mapId: base.startMapId,
    kitId: "bright-plaster", wings: [{ x: 2, y: 2, w: 6, h: 6 }], interior: "exterior-only", yard: [] }), final()]);
  const result = await executeRegionJob(f.input, f.host);
  expect(result.payload).toMatchObject({ applied: false, mapsAdded: 0, clippedCells: 0, completion: "complete" });
  expect(result.payload.changedCells).toBeGreaterThan(0);
  if (!result.generatedSnapshot) throw new Error("Missing generated house");
  const proposed = parseProject(await f.host.readJson(result.generatedSnapshot));
  expect(jsonValue(captureHouseProtection(proposed))).toEqual(result.payload.completedHouses);
  if (mode === "polish") expect(requireRecord("metrics", requireRecord("review", result.payload.review).metrics).blendScore).toEqual(expect.any(Number));
}, 30000);

it("does not polish a no-op region proposal", () => {
  const base = createBlankProject(), map = base.maps[base.startMapId];
  for (let y = 2; y < 9; y++) for (let x = 2; x < 8; x++) map.lowerTiles[y * map.width + x] = TILE.SAND;
  const result = finalizeRegionGeneration(base, structuredClone(base), { mapId: map.id, region, mode: "polish", instruction: "polish" }, []);
  expect(result.changedCells).toBe(0);
  expect(result.seamCells).toBe(0);
  expect(result.project).toEqual(base);
});

it("polishes only the permitted seam and reports its separate count", () => {
  const base = createBlankProject(), map = base.maps[base.startMapId];
  for (let y = 2; y < 9; y++) for (let x = 2; x < 8; x++) map.lowerTiles[y * map.width + x] = TILE.SAND;
  const proposed = structuredClone(base);
  proposed.maps[map.id].lowerTiles[4 * map.width + 4] = TILE.GRASS;
  const result = finalizeRegionGeneration(base, proposed, { mapId: map.id, region, mode: "polish", instruction: "polish" }, []);
  expect(result.seamCells).toBeGreaterThan(0);
  expect(result.report?.metrics.seamCells).toBe(result.seamCells);
  expect(result.report?.issues.filter(issue => issue.code === "region-scope-violation")).toEqual([]);
  const after = result.project.maps[map.id];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    if (x >= 1 && x <= 8 && y >= 1 && y <= 8) continue;
    expect(after.lowerTiles[y * map.width + x]).toBe(map.lowerTiles[y * map.width + x]);
  }
});

it("preserves real tool-result JSON bytes through validated checkpoints", async () => {
  const base = createBlankProject(), f = await fixture(base);
  const state: SessionJobState = { startedAt: "2026-09-06T00:00:00.000Z", draft: base, tools: [] };
  const { createSessionJobHost } = await import("@/ai/jobs/sessionHost");
  const job = createSessionJobHost(f.host, base, state, { domain: "map", budgetChars: 18000, preferenceMemorySection: "" });
  const ctx = { project: base };
  const result = job.execution.runTool(ctx, "create_map", { name: "Checkpoint map", width: 8, height: 8 });
  expect(result.ok).toBe(true);
  await job.flush();
  const restored = await parseSessionJobState(f.checkpoint().state, f.host);
  expect(JSON.stringify(restored.tools[0].result)).toBe(JSON.stringify(state.tools[0].result));
  // Keeping source order must not weaken validation of the recorded machine fields.
  for (const result of [
    { ...state.tools[0].result, ok: "true" },
    { ...state.tools[0].result, diff: { ...state.tools[0].result.diff, mapPropertiesChanged: "1" } },
    { ...state.tools[0].result, issues: [{ severity: "unknown", code: "bad", message: "bad" }] },
  ]) {
    const toolRef = await f.host.putJson(jsonValue({ ...state.tools[0], result }));
    await expect(parseSessionJobState({ ...f.checkpoint().state, toolRefs: [toolRef] }, f.host)).rejects.toThrow();
  }
});
