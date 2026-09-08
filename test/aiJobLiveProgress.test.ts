import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createServer } from "node:http";
import { openAiJobsRepository } from "../scripts/lib/aiJobs/repository.mjs";
import { createAiJobsScheduler, type AiJobHost, type AiJobsRuntime } from "../scripts/lib/aiJobs/scheduler.mjs";
import { createAiJobsHttpHandler, rejectSecrets } from "../scripts/lib/aiJobs/http.mjs";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSessionCore";
import { executeAssistantJob } from "@/ai/jobs/executors/assistantJob";
import { executeRegionJob } from "@/ai/jobs/executors/regionJob";
import { executeTilesetJob } from "@/ai/jobs/executors/tilesetJob";
import { createSessionJobHost } from "@/ai/jobs/sessionHost";
import { jsonObject, jsonValue, parseProject, parseSessionJobState, type SessionJobState } from "@/ai/jobs/checkpointState";
import { createBlankProject } from "@/project/defaults";
import { requireArray, requireNumber, requireString } from "@/project/io/guards";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import * as toolRunner from "@/editor/tools/toolRunner";
import { declaredIntent, fixedDeclarer } from "./intentFixture";
import type { AiJobCheckpoint, AiJobEvent, AiJobInput, BlobRef, JsonObject, JsonValue } from "@/ai/jobs/contracts";
import type { AiConfig, ChatResult } from "@/ai/llmClient";

type Family = "assistant" | "region" | "tileset";
type CheckpointWrite = Parameters<AiJobHost["saveCheckpoint"]>[0];
const config = { authMode: "chatgpt", providerId: "google-antigravity", agentMode: "chat",
  model: "gemini-3.7-flash", liteModel: "gemini-3.7-flash", maxToolCalls: 8, maxTokens: 4096 } as const;
const context = { budgetChars: 18000, preferenceMemorySection: "" };
const fixedStart = "2026-09-08T00:00:00.000Z";
const planArgs = { goal: "Captured inspection", layers: [{ title: "Inspection", items: [
  { title: "Inspect", instruction: "get_project_summary", successTools: ["get_project_summary"] },
] }] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error("Live progress boundary was not observed")), 15000);
    })]);
  } finally { clearTimeout(deadline); }
}
const final = (content = "Done"): JsonObject => ({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] });
function calls(entries: readonly { name: string; args: JsonObject }[]): JsonObject {
  return { choices: [{ message: { role: "assistant", content: null, tool_calls: entries.map((entry, index) => ({
    id: `call-${index}-${entry.name}`, type: "function", function: { name: entry.name, arguments: JSON.stringify(entry.args) },
  })) }, finish_reason: "tool_calls" }] };
}
const tool = (name: string, args: JsonObject = {}) => calls([{ name, args }]);
function ref(value: unknown): BlobRef {
  const r = jsonObject(value);
  return { sha256: requireString("sha256", r.sha256), byteLength: requireNumber("byteLength", r.byteLength), mediaType: requireString("mediaType", r.mediaType) };
}
function sessionState(state: JsonObject, family: Family): JsonObject {
  if (family === "region") return jsonObject(jsonObject(state.session).state);
  return family === "tileset" ? jsonObject(state.session) : state;
}
function progress(state: JsonObject, family: Family = "assistant"): JsonObject {
  const session = sessionState(state, family);
  expect(session, "a real session checkpoint must retain live observations, not just replay tools").toHaveProperty("progress");
  return jsonObject(session.progress);
}
function rows(p: JsonObject): JsonObject[] { return requireArray("recentActivity", p.recentActivity).map(jsonObject); }

interface Hooks {
  beforeSave?: (next: CheckpointWrite, host: AiJobHost) => Promise<void>;
  afterSave?: (next: CheckpointWrite, host: AiJobHost) => Promise<void>;
  afterOperation?: (operation: Parameters<AiJobHost["providerOperation"]>[0], response: JsonValue) => Promise<void>;
  dispatch?: (index: number) => Promise<void>;
}
/** Real family executor, repository and scheduler ledger. Only external wire responses
 * and host persistence/response acknowledgement faults are controlled by this fixture. */
async function fixture(family: Family = "assistant", payloadPatch: JsonObject = {}) {
  const directory = await mkdtemp(join(tmpdir(), "ai-live-progress-"));
  let repository = await openAiJobsRepository({ directory });
  const hooks: Hooks = {}, responses: JsonValue[] = [], saved: CheckpointWrite[] = [];
  const requests: { key: string; request: JsonValue }[] = [], events: AiJobEvent[] = [];
  const executorErrors: unknown[] = [], fatal: unknown[] = [];
  let dispatches = 0, ownedHost: AiJobHost | undefined;
  const runtime: AiJobsRuntime = {
    onError: error => { fatal.push(error); },
    dispatchProvider: async () => {
      const index = dispatches++;
      await hooks.dispatch?.(index);
      const response = responses[index];
      if (response === undefined) throw new Error(`Unexpected fixture dispatch ${index}`);
      return response;
    },
    executeJob: async (input, host) => {
      ownedHost = host;
      const wrapped: AiJobHost = { ...host,
        saveCheckpoint: async next => {
          await hooks.beforeSave?.(next, host);
          const result = await host.saveCheckpoint(next);
          saved.push(structuredClone(next));
          await hooks.afterSave?.(next, host);
          return result;
        },
        providerOperation: async operation => {
          requests.push(structuredClone(operation));
          const response = await host.providerOperation(operation);
          await hooks.afterOperation?.(operation, response);
          return response;
        },
      };
      try {
        if (input.family === "assistant") return await executeAssistantJob(input, wrapped);
        if (input.family === "region") return await executeRegionJob(input, wrapped);
        if (input.family === "tileset") return await executeTilesetJob(input, wrapped);
        throw new Error("Unexpected fixture family");
      } catch (error) { executorErrors.push(error); throw error; }
    },
  };
  let scheduler = createAiJobsScheduler({ repository, ...runtime });
  let offEvents = scheduler.subscribe(event => { events.push(event); });
  const project = createBlankProject(), tileset = Object.values(project.tilesets)[0]!;
  tileset.tileGroups = [{ id: "progress-group", name: "Group", tileIds: [4, 5], defaultLayer: "lower", role: "prop",
    description: "", placementRules: "", origin: "ai", source: "ai" }];
  const projectSnapshot = await repository.putJson(jsonValue(project));
  const shared = { version: 1 as const, project: { backend: "local", projectId: "progress-fixture" },
    projectSnapshot, artwork: [], target: {}, mode: "review", dependsOn: [] };
  const payload = { instruction: "Inspect captured project", config, context, ...payloadPatch };
  const input: AiJobInput = family === "assistant"
    ? { ...shared, family, payload: { ...payload, domain: "core" } }
    : family === "region"
      ? { ...shared, family, payload: { ...payload, mapId: project.startMapId, region: { x: 2, y: 2, width: 6, height: 6 }, mode: "task" } }
      : { ...shared, family, payload: { ...payload, operation: "cluster-edit", tilesetId: tileset.id, groupId: "progress-group" } };
  const job = () => {
    const current = repository.snapshot().jobs[0];
    if (!current) throw new Error("Fixture was not admitted");
    return current;
  };
  const terminal = () => {
    const done = deferred<AiJobEvent>();
    const off = scheduler.subscribe(event => {
      if (["succeeded", "failed", "cancelled", "interrupted"].includes(event.states.generation)) {
        off(); done.resolve(event);
      }
    });
    return { promise: done.promise, close: off };
  };
  return {
    family, directory, hooks, responses, saved, requests, events, executorErrors, fatal, project, input, job,
    get repository() { return repository; }, get scheduler() { return scheduler; },
    get dispatches() { return dispatches; },
    host: () => { if (!ownedHost) throw new Error("No active host"); return ownedHost; },
    terminal,
    admit: () => scheduler.admit({ idempotencyKey: "live-progress", input }),
    async checkpoint(): Promise<AiJobCheckpoint> {
      const checkpointRef = job().checkpointRef;
      if (!checkpointRef) throw new Error("Missing checkpoint");
      const c = jsonObject(await repository.readJson(checkpointRef));
      return { version: 1, jobId: requireString("jobId", c.jobId), attemptId: requireString("attemptId", c.attemptId),
        inputSha256: requireString("inputSha256", c.inputSha256), stageKey: requireString("stageKey", c.stageKey),
        state: jsonObject(c.state), artifacts: requireArray("artifacts", c.artifacts).map(ref) };
    },
    async reopen() {
      await scheduler.close(); offEvents(); await repository.close();
      repository = await openAiJobsRepository({ directory });
      scheduler = createAiJobsScheduler({ repository, ...runtime });
      offEvents = scheduler.subscribe(event => { events.push(event); });
      resetIntentDeclarationCache();
    },
    async close() {
      try { await scheduler.close(); offEvents(); await repository.close(); }
      finally { await rm(directory, { recursive: true, force: true }); }
      expect(fatal).toEqual([]);
    },
  };
}

beforeEach(() => resetIntentDeclarationCache());
afterEach(() => vi.restoreAllMocks());

describe("durable session progress through the existing job checkpoint", () => {
  it.each(["assistant", "region", "tileset"] as const)("publishes a %s plan and session-handled activity while the next provider is held", async family => {
    const f = await fixture(family), entered = deferred<void>(), release = deferred<void>();
    const watched = f.terminal();
    f.responses.push(final(JSON.stringify(declaredIntent({ mode: "modify", tools: ["get_project_summary"] }))),
      tool("set_work_plan", jsonObject(planArgs)), tool("get_project_summary"), final());
    f.hooks.dispatch = async index => { if (index === 2) { entered.resolve(); await bounded(release.promise); } };
    try {
      await f.admit();
      await bounded(Promise.race([entered.promise, watched.promise.then(() => { throw new Error("Generation ended before held provider"); })]));
      expect(f.job()).toMatchObject({ generation: "running", resultRef: null });
      const checkpoint = await f.checkpoint(), s = sessionState(checkpoint.state, family), p = progress(checkpoint.state, family);
      expect(p.workPlan).toMatchObject({ goal: planArgs.goal, layers: [{ items: [{ status: "in_progress" }] }] });
      expect(rows(p).some(row => row.name === "set_work_plan" && row.ok === true)).toBe(true);
      expect(s.toolRefs, "set_work_plan is session-handled, not a hosted tool").toEqual([]);
      expect(p.currentTool).toBeNull();
      expect(p.phase).toBe("execute");
      expect(jsonObject(p.budget).rounds).toEqual({ used: 2, total: 8 });
      expect(f.events.some(event => event.kind === "updated" && event.states.generation === "running")).toBe(true);
      expect(f.events.every(event => ["admitted", "updated", "outcome", "inbox-read"].includes(event.kind))).toBe(true);
      release.resolve();
      expect((await bounded(watched.promise)).states.generation, String(f.executorErrors[0])).toBe("succeeded");
      const result = jsonObject(await f.repository.readJson(f.job().resultRef!));
      expect(jsonObject(result.payload)).toHaveProperty("workPlan");
      expect(jsonObject(result.payload)).not.toHaveProperty("plan");
      if (family === "tileset") {
        expect(jsonObject(result.payload).previews).toEqual([]); // no image tools or synthetic data URLs
        expect(jsonObject(result.payload)).not.toHaveProperty("toolCalls");
      }
      expect(progress((await f.checkpoint()).state, family).currentTool).toBeNull();
    } finally { release.resolve(); watched.close(); await f.close(); }
  }, 60000);

  it("durably records a started tool before the real hosted tool mutates the draft", async () => {
    const f = await fixture(), watched = f.terminal();
    const toolStarts: CheckpointWrite[] = [];
    const original = toolRunner.runTool;
    vi.spyOn(toolRunner, "runTool").mockImplementation((...args) => {
      if (args[1] === "create_map") {
        const saved = f.saved.at(-1);
        if (saved) toolStarts.push(structuredClone(saved));
      }
      return original(...args);
    });
    f.responses.push(final(JSON.stringify(declaredIntent({ mode: "modify", space: "outdoor", tools: ["create_map"] }))),
      tool("create_map", { name: "Progress-owned map", width: 8, height: 8 }), final());
    try {
      await f.admit(); await bounded(watched.promise);
      expect(toolStarts).toHaveLength(1);
      const start = toolStarts[0]!;
      expect(progress(start.state).currentTool).toMatchObject({ name: "create_map", index: 1 });
      expect(start.state.toolRefs).toEqual([]);
      const draft = parseProject(await f.repository.readJson(ref(start.state.draftRef)));
      expect(Object.values(draft.maps).some(map => map.name === "Progress-owned map")).toBe(false);
      expect(f.job().generation, String(f.executorErrors[0])).toBe("succeeded");
      expect(rows(progress((await f.checkpoint()).state)).some(row => row.name === "create_map" && row.ok === true)).toBe(true);
    } finally { watched.close(); await f.close(); }
  }, 60000);

  it("retains a planner-only result and its observations without inventing a hosted tool", async () => {
    const f = await fixture("assistant", { config: { ...config, agentMode: "auto" }, turn: { composerMode: "plan", autonomous: true } });
    const watched = f.terminal();
    f.responses.push(final(JSON.stringify(declaredIntent({ mode: "modify", needsPlan: true }))),
      final(JSON.stringify({ action: "new_plan", ...planArgs })));
    try {
      await f.admit(); await bounded(watched.promise);
      expect(f.job().generation, String(f.executorErrors[0])).toBe("succeeded");
      const checkpoint = await f.checkpoint(), p = progress(checkpoint.state);
      expect(checkpoint.state.toolRefs).toEqual([]);
      const result = jsonObject(await f.repository.readJson(f.job().resultRef!));
      expect(p.workPlan).toEqual(jsonObject(result.payload).workPlan);
      expect(p.currentTool).toBeNull();
      expect(f.dispatches).toBe(2);
      expect(jsonObject(p.budget).rounds).toBeNull();
    } finally { watched.close(); await f.close(); }
  }, 60000);

  it.each(["assistant", "region", "tileset"] as const)("reopens and replays %s without duplicate activity, request bytes, allocated IDs or spend", async family => {
    const f = await fixture(family);
    const allocatedName = "Replay-owned allocation";
    const mutation = family === "tileset"
      ? tool("upsert_tile_group", { tilesetId: Object.keys(f.project.tilesets)[0]!, name: allocatedName, tileIds: [4, 5], role: "prop", defaultLayer: "lower" })
      : tool("create_map", { name: allocatedName, width: 8, height: 8 });
    f.responses.push(final(JSON.stringify(declaredIntent({ mode: "modify", space: "outdoor", tools: [family === "tileset" ? "upsert_tile_group" : "create_map"] }))), mutation, final());
    let interrupted = false;
    f.hooks.afterOperation = async operation => {
      if (operation.key.endsWith("/provider/2") && !interrupted) { interrupted = true; throw new Error("PROGRESS_POST_RESPONSE_INTERRUPTION"); }
    };
    let watched = f.terminal();
    try {
      await f.admit(); expect((await bounded(watched.promise)).states.generation).toBe("failed");
      expect(f.executorErrors).toHaveLength(1);
      expect(f.executorErrors[0]).toMatchObject({ message: expect.stringContaining("PROGRESS_POST_RESPONSE_INTERRUPTION") });
      const before = await f.checkpoint(), p = progress(before.state, family);
      const beforeTools = sessionState(before.state, family).toolRefs;
      const beforeDraft = await f.repository.readJson(ref(sessionState(before.state, family).draftRef));
      const operations = f.repository.snapshot().operations;
      expect(f.dispatches).toBe(3);
      await f.reopen();
      expect((await f.checkpoint()).state).toEqual(before.state);
      f.executorErrors.length = 0;
      watched.close(); watched = f.terminal();
      await f.scheduler.retry(f.job().id, { stage: "generation" });
      expect((await bounded(watched.promise)).states.generation, String(f.executorErrors[0])).toBe("succeeded");
      const after = await f.checkpoint(), next = progress(after.state, family);
      expect(sessionState(after.state, family).toolRefs).toEqual(beforeTools);
      expect(await f.repository.readJson(ref(sessionState(after.state, family).draftRef))).toEqual(beforeDraft);
      const toolRows = (projection: JsonObject) => rows(projection).filter(row => typeof row.name === "string" && typeof row.ok === "boolean");
      expect(toolRows(next)).toEqual(toolRows(p));
      expect(new Set(rows(next).map(row => row.id)).size).toBe(rows(next).length);
      expect(jsonObject(next.budget).rounds).toEqual(jsonObject(p.budget).rounds);
      expect(f.dispatches).toBe(3);
      expect(f.repository.snapshot().operations).toEqual(operations);
      for (const key of new Set(f.requests.map(request => request.key))) {
        const repeated = f.requests.filter(request => request.key === key);
        expect(repeated).toHaveLength(2);
        expect(repeated[1]).toEqual(repeated[0]);
      }
      expect(f.executorErrors).toEqual([]);
      const resultRef = f.job().resultRef!;
      const stable = await f.repository.readJson(resultRef);
      // Completed session checkpoints remain reusable without replaying even known operations.
      const result = jsonObject(stable);
      expect(result.attemptId).not.toBe(before.attemptId);
      expect(jsonObject(result.payload)).toMatchObject({ completion: "complete", persistence: "not-applicable" });
    } finally { watched.close(); await f.close(); }
  }, 90000);

  it("fences an in-flight observation save and later paid response after cancellation", async () => {
    const f = await fixture(), entered = deferred<void>(), release = deferred<void>();
    let held: CheckpointWrite | undefined;
    f.responses.push(final(JSON.stringify(declaredIntent({ mode: "modify", tools: ["get_project_summary"] }))), tool("get_project_summary"), final());
    f.hooks.beforeSave = async next => {
      const p = next.state.progress;
      if (!held && p !== undefined && jsonObject(p).currentTool !== null) {
        held = structuredClone(next); entered.resolve(); await bounded(release.promise);
      }
    };
    const watched = f.terminal();
    try {
      await f.admit();
      await bounded(Promise.race([entered.promise, watched.promise.then(() => { throw new Error("No durable pre-tool observation was attempted"); })]));
      const oldRef = f.job().checkpointRef, oldHost = f.host();
      await f.scheduler.cancel(f.job().id);
      expect(f.job()).toMatchObject({ generation: "cancelled", activeAttemptId: null, resultRef: null });
      release.resolve();
      await f.scheduler.close();
      expect(f.job().checkpointRef).toEqual(oldRef);
      expect(f.saved.some(next => next.stageKey.endsWith("/completed"))).toBe(false);
      expect(f.dispatches).toBe(2);
      await expect(oldHost.saveCheckpoint(held!)).rejects.toThrow();
      expect(f.job().checkpointRef).toEqual(oldRef);
    } finally { release.resolve(); watched.close(); await f.close(); }
  }, 60000);

  it("retains a late provider response without restoring cancelled progress or a result", async () => {
    const f = await fixture(), entered = deferred<void>(), release = deferred<void>(), watched = f.terminal();
    f.responses.push(final(JSON.stringify(declaredIntent({ mode: "question" }))), final());
    f.hooks.dispatch = async index => { if (index === 1) { entered.resolve(); await bounded(release.promise); } };
    try {
      await f.admit(); await bounded(entered.promise);
      const saved = await f.checkpoint(); progress(saved.state);
      await f.scheduler.cancel(f.job().id);
      const cancelledRef = f.job().checkpointRef;
      release.resolve(); await f.scheduler.close();
      expect(f.job()).toMatchObject({ generation: "cancelled", resultRef: null, checkpointRef: cancelledRef });
      expect(f.repository.snapshot().operations.at(-1)).toMatchObject({ status: "succeeded", responseRef: expect.any(Object) });
      expect(f.events.at(-1)?.states.generation).toBe("cancelled");
    } finally { release.resolve(); watched.close(); await f.close(); }
  }, 60000);

  it("bounds activity and summary text while retaining actual hosted results separately", async () => {
    const f = await fixture(), watched = f.terminal();
    const longName = "x".repeat(900);
    f.responses.push(final(JSON.stringify(declaredIntent({ mode: "modify", space: "outdoor", tools: ["create_map", "get_project_summary"] }))),
      calls([...Array.from({ length: 34 }, () => ({ name: "get_project_summary", args: {} })),
        { name: "create_map", args: { name: longName, width: 8, height: 8 } }]), final());
    try {
      await f.admit(); await bounded(watched.promise);
      expect(f.job().generation, String(f.executorErrors[0])).toBe("succeeded");
      const checkpoint = await f.checkpoint(), p = progress(checkpoint.state), activity = rows(p);
      expect(activity.length).toBeLessThanOrEqual(32);
      expect(p.omittedActivityCount).toBeGreaterThan(0);
      expect(activity.every(row => typeof row.summary === "string" && row.summary.length <= 512)).toBe(true);
      expect(activity.some(row => row.name === "create_map" && row.ok === true)).toBe(true);
      for (const row of activity) {
        expect(row).not.toHaveProperty("args"); expect(row).not.toHaveProperty("result");
      }
      expect(p).not.toHaveProperty("messages"); expect(p).not.toHaveProperty("audit");
      expect(p).not.toHaveProperty("assistantText"); expect(p).not.toHaveProperty("cost");
      const toolRefs = requireArray("toolRefs", checkpoint.state.toolRefs).map(ref);
      const actual = jsonObject(await f.repository.readJson(toolRefs.at(-1)!));
      expect(requireString("summary", jsonObject(actual.result).summary).length).toBeGreaterThan(512);
      expect(f.events.every(event => !Object.hasOwn(event, "progress") && !Object.hasOwn(event, "payload"))).toBe(true);
    } finally { watched.close(); await f.close(); }
  }, 90000);
});

// This existing host seam intentionally exercises concurrent callers. A snapshot writer
// must capture at invocation and order the terminal write after a blocked older write.
describe("session checkpoint writer and parser boundaries", () => {
  it("captures immutable state and orders an older tool flush before completion", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ai-progress-writer-"));
    const repository = await openAiJobsRepository({ directory });
    const entered = deferred<void>(), release = deferred<void>();
    const saved: CheckpointWrite[] = [];
    let writes = 0;
    const host: AiJobHost = { ...repository, jobId: "writer", attemptId: "attempt", dependencies: [],
      loadCheckpoint: async () => null,
      putJson: async value => {
        if (writes++ === 0) { entered.resolve(); await bounded(release.promise); }
        return repository.putJson(value);
      },
      saveCheckpoint: async next => { saved.push(structuredClone(next)); return repository.putJson(jsonValue(next)); },
      providerOperation: async () => { throw new Error("No paid work in writer test"); },
    };
    const project = createBlankProject();
    const state: SessionJobState = { startedAt: fixedStart, tools: [], draft: project };
    const job = createSessionJobHost(host, project, state, { domain: "core", ...context });
    const first = job.flush("assistant/tool/0");
    let terminal: Promise<void> | undefined;
    try {
      await bounded(entered.promise);
      state.draft = { ...project, meta: { ...project.meta, title: "Captured terminal" } };
      state.completed = { turn: { assistantText: "Done", proposedCalls: [], stoppedReason: "final" },
        generatedSnapshot: await repository.putJson(jsonValue(state.draft)) };
      terminal = job.flush("assistant/completed");
      release.resolve();
      await bounded(Promise.all([first, terminal]));
      expect(saved.map(next => next.stageKey)).toEqual(["assistant/tool/0", "assistant/completed"]);
      expect(saved[0]!.state).not.toHaveProperty("completed");
      expect(await repository.readJson(ref(saved[0]!.state.draftRef))).toEqual(jsonValue(project));
      expect(saved[1]!.state.completed).toEqual(jsonValue(state.completed));
    } finally {
      release.resolve(); await Promise.allSettled([first, ...(terminal ? [terminal] : [])]);
      await repository.close(); await rm(directory, { recursive: true, force: true });
    }
  }, 30000);

  it("propagates a failed writer barrier instead of publishing a later completion", async () => {
    const project = createBlankProject(), saved: CheckpointWrite[] = [];
    const expected = new Error("PROGRESS_WRITE_FAILURE");
    let writes = 0;
    const host: AiJobHost = {
      jobId: "writer", attemptId: "attempt", dependencies: [],
      putJson: async () => {
        if (writes++ === 0) throw expected;
        return { sha256: "a".repeat(64), byteLength: 1, mediaType: "application/json" };
      }, readJson: async () => { throw new Error("Unexpected read"); },
      putBlob: async () => { throw new Error("Unexpected binary write"); }, readBlob: async () => { throw new Error("Unexpected binary read"); },
      loadCheckpoint: async () => null, saveCheckpoint: async next => { saved.push(next); throw new Error("Write barrier bypassed"); },
      providerOperation: async () => { throw new Error("Unexpected provider"); },
    };
    const job = createSessionJobHost(host, project, { startedAt: fixedStart, tools: [], draft: project }, { domain: "core", ...context });
    await expect(job.flush()).rejects.toBe(expected);
    await expect(job.flush("assistant/completed")).rejects.toBe(expected);
    expect(saved).toEqual([]);
  });

  it("accepts old session checkpoints, round-trips progress and rejects malformed or secret-bearing extensions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ai-progress-schema-"));
    const repository = await openAiJobsRepository({ directory });
    const project = createBlankProject();
    const host: AiJobHost = { ...repository, jobId: "schema", attemptId: "attempt", dependencies: [], loadCheckpoint: async () => null,
      saveCheckpoint: async value => repository.putJson(jsonValue(value)), providerOperation: async () => { throw new Error("Unexpected provider"); } };
    try {
      const old = { version: 1, startedAt: fixedStart, toolRefs: [], draftRef: await repository.putJson(jsonValue(project)) };
      expect(jsonObject(jsonValue(await parseSessionJobState(old, host)))).not.toHaveProperty("progress");
      const projection = { version: 1, revision: 0, turnIndex: 0, workPlan: null, phase: null, currentTool: null,
        recentActivity: [], omittedActivityCount: 0, budget: { rounds: null, driverContinuations: null }, usage: null };
      const value = { ...old, progress: projection };
      expect(jsonObject(jsonValue(await parseSessionJobState(value, host))).progress).toEqual(projection);
      for (const invalid of [
        { ...projection, version: 2 }, { ...projection, revision: -1 }, { ...projection, turnIndex: 0.5 },
        { ...projection, phase: "applied" }, { ...projection, currentTool: { turnIndex: 1, index: 0, name: "get_project_summary" } },
        { ...projection, budget: { rounds: { used: 3, total: 2 }, driverContinuations: null } },
        { ...projection, workPlan: { id: "missing-plan-fields" } },
        { ...projection, recentActivity: Array.from({ length: 33 }, (_, id) => ({ id, turnIndex: 1, kind: "tool", name: "get_project_summary", ok: true, summary: "Done" })) },
        { ...projection, recentActivity: [{ id: 1, turnIndex: 1, kind: "tool", name: "get_project_summary", ok: true, summary: "x".repeat(513) }] },
        { ...projection, messages: [] }, { ...projection, apiKey: "fixture-secret" },
      ]) await expect(parseSessionJobState({ ...old, progress: invalid }, host)).rejects.toThrow();
      expect(() => rejectSecrets({ ...value, progress: { ...projection, authorization: "fixture-secret" } })).toThrow();
      expect(() => rejectSecrets({ ...value, progress: { ...projection, recentActivity: [{ summary: "Bearer fixture-secret" }] } })).toThrow();
    } finally { await repository.close(); await rm(directory, { recursive: true, force: true }); }
  }, 30000);
});

describe("numeric budget events from real session counters", () => {
  it("distinguishes a level-capped round from an autonomous continuation and reports missing usage honestly", async () => {
    const project = createBlankProject();
    const host: AiJobHost = {
      jobId: "budget", attemptId: "attempt", dependencies: [],
      putJson: async () => ({ sha256: "a".repeat(64), byteLength: 1, mediaType: "application/json" }),
      saveCheckpoint: async () => ({ sha256: "b".repeat(64), byteLength: 1, mediaType: "application/json" }),
      loadCheckpoint: async () => null, readJson: async () => { throw new Error("Unexpected read"); },
      putBlob: async () => { throw new Error("Unexpected image write"); }, readBlob: async () => { throw new Error("Unexpected image read"); },
      providerOperation: async () => { throw new Error("Session wire is supplied directly"); },
    };
    const job = createSessionJobHost(host, project, { startedAt: fixedStart, tools: [], draft: project }, { domain: "core", ...context });
    const sessionConfig: AiConfig = { ...config, apiKey: "", baseUrl: "", autonomyLevel: "balanced", maxToolCalls: 20 };
    const events: JsonObject[] = [];
    const session = new AssistantSession(project, { host: job.execution, config: sessionConfig,
      declareIntent: fixedDeclarer({ mode: "question" }), contextOptions: context, yieldToUi: async () => {},
      chat: async (): Promise<ChatResult> => ({ message: { role: "assistant", content: "Answer" }, finishReason: "stop" }),
    });
    await session.sendUserMessage("Inspect", (event: SessionEvent) => { events.push(jsonObject(jsonValue(event))); }, undefined, { autonomous: true });
    const budgets = events.filter(event => event.type === "run_budget");
    expect(budgets, "numeric event must originate in the real driver/round counters").not.toEqual([]);
    expect(budgets.some(event => event.rounds !== null && jsonObject(event.rounds).used === 1 && jsonObject(event.rounds).total === 16)).toBe(true);
    expect(budgets.some(event => event.driverContinuations !== null && jsonObject(event.driverContinuations).used === 0
      && jsonObject(event.driverContinuations).total === 48)).toBe(true);
    expect(session.getUsageTotals()).toMatchObject({ calls: 1, callsWithoutUsage: 1 });
    expect(jsonObject(jsonValue(session.getUsageTotals()))).not.toHaveProperty("cost");
  });
});

it("serves live checkpoint artifacts using existing detail/SSE and denies unmanifested provider bytes", async () => {
  const f = await fixture(), entered = deferred<void>(), release = deferred<void>(), watched = f.terminal();
  f.responses.push(final(JSON.stringify(declaredIntent({ mode: "question", tools: ["get_project_summary"] }))), tool("get_project_summary"), final());
  f.hooks.dispatch = async index => { if (index === 2) { entered.resolve(); await bounded(release.promise); } };
  let origin = "";
  const handler = createAiJobsHttpHandler({ repository: f.repository, scheduler: f.scheduler, origins: () => [origin], onError: error => { f.fatal.push(error); } });
  const server = createServer(handler);
  const controller = new AbortController();
  const listening = once(server, "listening"); server.listen(0, "127.0.0.1"); await bounded(listening);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected isolated loopback address");
  origin = `http://127.0.0.1:${address.port}`;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const stream = await fetch(`${origin}/api/ai-jobs/events?after=0`, { signal: controller.signal });
    reader = stream.body!.getReader();
    await f.admit(); await bounded(entered.promise);
    const detail = jsonObject(await (await fetch(`${origin}/api/ai-jobs/${f.job().id}`)).json());
    const job = jsonObject(detail.job), manifest = requireArray("manifest", detail.manifest).map(ref);
    expect(job.generation).toBe("running"); expect(job.resultRef).toBeNull();
    const checkpointRef = ref(job.checkpointRef);
    expect(manifest).toContainEqual(checkpointRef);
    const checkpointResponse = await fetch(`${origin}/api/ai-jobs/${f.job().id}/artifacts/${checkpointRef.sha256}`);
    expect(checkpointResponse.status).toBe(200);
    const checkpoint = jsonObject(await checkpointResponse.json());
    const state = jsonObject(checkpoint.state);
    const recorded = requireArray("toolRefs", state.toolRefs).map(ref);
    expect(recorded).toHaveLength(1);
    expect(manifest).toContainEqual(recorded[0]);
    const unrelated = await f.repository.putJson({ unrelated: true });
    const operation = f.repository.snapshot().operations[0]!;
    for (const denied of [unrelated, operation.requestRef, operation.responseRef!]) {
      expect((await fetch(`${origin}/api/ai-jobs/${f.job().id}/artifacts/${denied.sha256}`)).status).toBe(404);
    }
    // Consume to the known durable sequence, not an arbitrary timing delay.
    const target = f.events.at(-1)!.seq;
    let buffer = "", seen = 0;
    const received: JsonObject[] = [];
    while (seen < target) {
      const chunk = await bounded(reader.read());
      if (chunk.done) throw new Error("SSE closed before durable cursor");
      buffer += new TextDecoder().decode(chunk.value);
      let end: number;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const data = frame.split("\n").find(line => line.startsWith("data: "));
        if (data) { const event = jsonObject(JSON.parse(data.slice(6))); received.push(event); seen = requireNumber("seq", event.seq); }
      }
    }
    expect(received.some(event => event.kind === "updated" && jsonObject(event.states).generation === "running")).toBe(true);
    expect(received.every(event => !Object.hasOwn(event, "progress") && !Object.hasOwn(event, "payload"))).toBe(true);
    // The assertions above characterize existing transport. This is the missing contract.
    expect(progress(state).currentTool).toBeNull();
    expect(rows(progress(state)).some(row => row.name === "get_project_summary" && row.ok === true)).toBe(true);
  } finally {
    release.resolve();
    try { await reader?.cancel(); }
    finally {
      controller.abort(); watched.close(); handler.close(); server.closeAllConnections();
      try { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
      finally { await f.close(); }
    }
  }
}, 60000);
