import { beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openAiJobsRepository } from "../scripts/lib/aiJobs/repository.mjs";
import { validateInput, validateResult } from "../scripts/lib/aiJobs/validation.mjs";
import { createAiJobsScheduler, type AiJobHost, type AiJobsRuntime } from "../scripts/lib/aiJobs/scheduler.mjs";
import { AssistantSession as ForegroundSession } from "@/ai/assistantSession";
import { executeAssistantJob } from "@/ai/jobs/executors/assistantJob";
import { parseAssistantPayload } from "@/ai/jobs/assistantPayload";
import { parseContextFooter } from "@/ai/contextFooter";
import { RESTORED_TRANSCRIPT_MARKER, RESTORED_TRANSCRIPT_MAX_CHARS } from "@/ai/conversationReplay";
import { jsonObject, jsonValue, parseProject, parseSessionJobState } from "@/ai/jobs/checkpointState";
import { canonicalJson, mergeResultProject } from "@/ai/jobs/resultPatch";
import { sha256HexText } from "@/util/sha256";
import { measureVolume } from "@/ai/volumeContract";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { requireArray, requireNumber, requireString } from "@/project/io/guards";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { declaredIntent, fixedDeclarer } from "./intentFixture";
import type { SessionEvent } from "@/ai/assistantSessionCore";
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import type { Project } from "@/project/types";
import type { AiJob, AiJobEvent, AiJobInput, AiJobResult, BlobRef, JsonObject, JsonValue } from "@/ai/jobs/contracts";

const config = { authMode: "chatgpt", providerId: "google-antigravity", agentMode: "chat",
  model: "gemini-3.7-flash", liteModel: "gemini-3.7-flash", maxToolCalls: 8, maxTokens: 8192 } as const;
const context = { budgetChars: 18000, preferenceMemorySection: "" };
const plan = { goal: "Register one captured record", layers: [{ id: "records", title: "Records", items: [
  { id: "record-one", title: "Register", instruction: "upsert_item", successTools: ["upsert_item"] },
] }] };
const initialIntent = { mode: "modify", needsPlan: true, tools: ["upsert_item"] } as const;
const itemName = "Continuation allocated record";
const final = (content = "Done"): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
const tool = (name: string, args: JsonObject = {}): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: `call-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" });
const wire = (r: ChatResult): JsonValue => jsonValue({ choices: [{ message: r.message, finish_reason: r.finishReason }] });
const planner = (args: JsonObject = jsonObject(plan)) => final(JSON.stringify({ action: "new_plan", ...args }));
const resume = () => final(JSON.stringify({ action: "resume" }));
const mutation = () => tool("upsert_item", { item: { id: "continuation-record", name: itemName, price: 10 } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Continuation boundary not reached")), 30000);
  })]); } finally { clearTimeout(timer); }
}
function ref(value: unknown): BlobRef {
  const r = jsonObject(value);
  return { sha256: requireString("sha256", r.sha256), byteLength: requireNumber("byteLength", r.byteLength), mediaType: requireString("mediaType", r.mediaType) };
}
function continuation(result: Pick<AiJobResult, "payload">): JsonObject {
  expect(result.payload, "The real clean plan-only producer must retain executable goal contracts").toHaveProperty("continuationState");
  return jsonObject(result.payload.continuationState);
}
function activity(state: JsonObject): JsonObject[] { return requireArray("activity", jsonObject(state.progress).recentActivity).map(jsonObject); }
type Write = Parameters<AiJobHost["saveCheckpoint"]>[0];
type Operation = Parameters<AiJobHost["providerOperation"]>[0];
interface Hooks {
  dispatch?: (label: string, index: number, request: JsonValue) => Promise<void>;
  afterOperation?: (label: string, operation: Operation) => Promise<void>;
  beforeSave?: (label: string, next: Write) => Promise<void>;
  output?: (label: string, result: AiJobResult, host: AiJobHost) => Promise<AiJobResult>;
}
/** Actual executor/session + repository/scheduler/provider ledger. Only external responses
 * and explicit storage/response acknowledgement faults are controlled. No future API imports. */
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "ai-continuation-"));
  let repository = await openAiJobsRepository({ directory });
  const responses = new Map<string, ChatResult[]>(), counts = new Map<string, number>();
  const requests: { label: string; operation: Operation }[] = [], writes: { label: string; next: Write }[] = [];
  const hosts = new Map<string, AiJobHost>(), errors: { label: string; error: unknown }[] = [], fatal: unknown[] = [];
  const hooks: Hooks = {};
  const job = (label: string): AiJob => {
    const value = repository.snapshot().jobs.find(j => j.idempotencyKey === label);
    if (!value) throw new Error(`Unadmitted fixture ${label}`);
    return value;
  };
  const labelOf = (id: string) => {
    const value = repository.snapshot().jobs.find(j => j.id === id);
    if (!value) throw new Error("Unknown fixture job");
    return value.idempotencyKey;
  };
  const runtime: AiJobsRuntime = {
    onError: error => { fatal.push(error); },
    dispatchProvider: async (request, { jobId }) => {
      const label = labelOf(jobId), index = counts.get(label) ?? 0;
      counts.set(label, index + 1);
      await hooks.dispatch?.(label, index, request);
      const response = responses.get(label)?.[index];
      if (!response) throw Object.assign(new Error(`Unexpected dispatch ${label}/${index}`), { code: "PROVIDER_NOT_DISPATCHED" });
      return wire(response);
    },
    executeJob: async (input, host) => {
      resetIntentDeclarationCache(); // a real job attempt owns a fresh isolated session realm
      const label = labelOf(host.jobId); hosts.set(label, host);
      const wrapped: AiJobHost = { ...host,
        saveCheckpoint: async next => {
          await hooks.beforeSave?.(label, next);
          const r = await host.saveCheckpoint(next); writes.push({ label, next: structuredClone(next) }); return r;
        },
        providerOperation: async operation => {
          requests.push({ label, operation: structuredClone(operation) });
          const result = await host.providerOperation(operation);
          await hooks.afterOperation?.(label, operation); return result;
        },
      };
      try {
        if (input.family !== "assistant") throw new Error("Unexpected family");
        const result = await executeAssistantJob(input, wrapped);
        return hooks.output ? await hooks.output(label, result, host) : result;
      } catch (error) { errors.push({ label, error }); throw error; }
    },
  };
  let scheduler = createAiJobsScheduler({ repository, ...runtime });
  const project = createBlankProject();
  const baseRef = await repository.putJson(jsonValue(project));
  const input: AiJobInput & { family: "assistant" } = { version: 1, family: "assistant", project: { backend: "local", projectId: "continuation-fixture" },
    projectSnapshot: baseRef, artwork: [], target: {}, mode: "review", dependsOn: [], payload: {
      instruction: "Register a new database item", domain: "database", config, context: { ...context, currentMapId: project.startMapId },
      turn: { composerMode: "plan" },
    } };
  function watch(label: string) {
    const done = deferred<AiJobEvent>();
    const off = scheduler.subscribe(event => {
      if (labelOf(event.jobId) === label && ["succeeded", "failed", "cancelled", "interrupted"].includes(event.states.generation)) {
        off(); done.resolve(event);
      }
    });
    return { promise: done.promise, close: off };
  }
  const result = async (label: string) => {
    const resultRef = job(label).resultRef;
    if (!resultRef) throw new Error(`Missing result for ${label}: ${String(errors.find(e => e.label === label)?.error)}`);
    const stored = jsonObject(await repository.readJson(resultRef));
    validateResult(stored);
    // Extract the fields used by these tests after the existing wire validator.
    // Preserve all stored fields for canonical identity assertions; no casted DTO.
    return { ...stored, payload: jsonObject(stored.payload), artifacts: requireArray("result artifacts", stored.artifacts).map(ref),
      generatedSnapshot: stored.generatedSnapshot === null ? null : ref(stored.generatedSnapshot) };
  };
  async function run(label: string, value: AiJobInput, steps: ChatResult[]) {
    responses.set(label, steps); const watched = watch(label);
    try { await scheduler.admit({ idempotencyKey: label, input: value }); return await bounded(watched.promise); }
    finally { watched.close(); }
  }
  return { project, input, hooks, responses, requests, writes, errors, hosts, job, watch, run, result,
    get repository() { return repository; }, get scheduler() { return scheduler; },
    dispatches: (label: string) => counts.get(label) ?? 0,
    async source(payloadPatch: JsonObject = {}, intentPatch: Partial<IntentDeclaration> = {}, planPatch: JsonObject = {}) {
      const value = { ...input, payload: { ...input.payload, ...payloadPatch } };
      const outcome = await run("source", value, [final(JSON.stringify(declaredIntent({ ...initialIntent, ...intentPatch }))), planner({ ...jsonObject(plan), ...planPatch })]);
      expect(outcome.states.generation, String(errors[0]?.error)).toBe("succeeded");
      return result("source");
    },
    async successor(current: Project = project, payloadPatch: JsonObject = {}, sourceLabel = "source"): Promise<AiJobInput & { family: "assistant" }> {
      const sourceJob = job(sourceLabel), sourceInput = jsonObject(await repository.readJson(sourceJob.inputRef));
      validateInput(sourceInput);
      const sourcePayload = parseAssistantPayload(sourceInput.payload);
      const captured: Record<string, JsonValue> = { ...jsonObject(jsonValue(sourcePayload)) };
      delete captured.priorTranscript; // successor history is source-owned, never resubmitted by the client
      return { ...input, projectSnapshot: await repository.putJson(jsonValue(current)), dependsOn: [sourceJob.id], payload: {
        ...captured, instruction: "계속", turn: { composerMode: "plan" },
        continuation: { sourceJobId: sourceJob.id, resultSha256: sourceJob.resultRef?.sha256 ?? "0".repeat(64) }, ...payloadPatch,
      } };
    },
    async checkpoint(label: string) {
      const checkpointRef = job(label).checkpointRef;
      if (!checkpointRef) throw new Error(`Missing checkpoint ${label}`);
      return jsonObject(await repository.readJson(checkpointRef));
    },
    async reopen() {
      await scheduler.close(); await repository.close();
      repository = await openAiJobsRepository({ directory }); scheduler = createAiJobsScheduler({ repository, ...runtime });
    },
    async close() {
      try { await scheduler.close(); await repository.close(); }
      finally { await rm(directory, { recursive: true, force: true }); }
      expect(fatal).toEqual([]);
    },
  };
}

beforeEach(() => resetIntentDeclarationCache());

describe("clean durable plan-only continuation", () => {
  it.each(["composer", "confirm"] as const)("exports %s plan-only authority and the actual final snapshot without tools", async mode => {
    const f = await fixture();
    try {
      const patch: JsonObject = mode === "confirm" ? { config: { ...config, autonomyLevel: "confirm" }, turn: { composerMode: "do" } } : {};
      const required = { project: true, collections: ["items"], references: true };
      const adventure = { village: false, dungeon: true, party: true, battle: false };
      const minimum = { authoredMaps: 1, multiPageNpcs: 0, shops: 0, quests: 0 };
      const source = await f.source(patch, { readBeforeWrite: required, adventure }, { volume: minimum });
      expect(source.payload.proposedCalls).toEqual([]);
      expect(jsonObject((await f.checkpoint("source")).state).toolRefs).toEqual([]);
      const seed = continuation(source);
      expect(seed).toMatchObject({ version: 1, kind: "plan-only", readBeforeWrite: required, adventure,
        volume: { baseline: measureVolume(parseProject(jsonValue(f.project))), minimum } });
      const captured = ref(seed.inputRef);
      expect(captured).toEqual(f.job("source").inputRef);
      expect(source.artifacts).toContainEqual(captured);
      expect(await f.repository.readJson(captured)).toEqual(await f.repository.readJson(f.job("source").inputRef));
      expect(source.generatedSnapshot).not.toBeNull();
      expect(parseProject(await f.repository.readJson(source.generatedSnapshot!))).toEqual(parseProject(jsonValue(f.project)));
      const completed = jsonObject(jsonObject((await f.checkpoint("source")).state).completed);
      expect(jsonObject(completed.turn).continuationState).toEqual(seed);
      expect(f.dispatches("source")).toBe(2);
    } finally { await f.close(); }
  }, 60000);

  it("retains clean source authority when result acknowledgement fails after the completed checkpoint", async () => {
    const f = await fixture();
    try {
      let failed = false;
      f.hooks.output = async (label, result) => {
        if (label === "source" && !failed) { failed = true; throw new Error("SOURCE_RESULT_ACK_LOST"); }
        return result;
      };
      expect((await f.run("source", f.input, [final(JSON.stringify(declaredIntent(initialIntent))), planner()])).states.generation).toBe("failed");
      const checkpoint = await f.checkpoint("source"), saved = jsonObject(jsonObject(checkpoint.state).completed);
      expect(jsonObject(saved.turn)).toHaveProperty("continuationState");
      const operations = f.repository.snapshot().operations;
      await f.reopen(); const watched = f.watch("source");
      try { await f.scheduler.retry(f.job("source").id, { stage: "generation" }); expect((await bounded(watched.promise)).states.generation).toBe("succeeded"); }
      finally { watched.close(); }
      const source = await f.result("source");
      expect(continuation(source)).toEqual(jsonObject(saved.turn).continuationState);
      expect(source.artifacts).toContainEqual(ref(continuation(source).inputRef));
      expect(source.generatedSnapshot).toEqual(saved.generatedSnapshot);
      expect(f.dispatches("source")).toBe(2); expect(f.repository.snapshot().operations).toEqual(operations);
    } finally { await f.close(); }
  }, 60000);

  it("strictly restores the new completed artifact references from the real source checkpoint", async () => {
    const f = await fixture();
    try {
      await f.source();
      const state = jsonObject((await f.checkpoint("source")).state), completed = jsonObject(state.completed);
      const artifacts = requireArray("completed artifacts", completed.artifacts).map(jsonObject);
      const host: AiJobHost = { ...f.hosts.get("source")!, readJson: value => f.repository.readJson(value) };
      expect((await parseSessionJobState(state, host)).completed?.artifacts).toEqual(artifacts);
      await expect(parseSessionJobState({ ...state, completed: { ...completed, artifacts: [{ ...artifacts[0], extra: true }] } }, host)).rejects.toThrow();
    } finally { await f.close(); }
  }, 60000);

  it("matches real foreground same-session human resume while executing from a fresh captured current project", async () => {
    const f = await fixture(), release = deferred<void>(), entered = deferred<void>();
    let watched: ReturnType<typeof f.watch> | undefined;
    try {
      const source = await f.source();
      const current = structuredClone(f.project); current.meta.title = "Human edit after planning";
      const referenceRequests: ChatRequest[] = [], events: SessionEvent[] = [];
      const referenceSteps = [planner(), resume(), mutation(), final()];
      const reference = new ForegroundSession(f.project, { config: { ...config, apiKey: "", baseUrl: "" }, contextOptions: context,
        declareIntent: fixedDeclarer(initialIntent), yieldToUi: async () => {}, host: {
          kind: "editor", readBaseline: () => current, now: () => new Date(requireString("createdAt", jsonObject(source.payload.workPlan).createdAt)),
          activeDomains: () => new Set(["database", "core"]), preferenceSection: () => "", budgetChars: () => context.budgetChars,
          recordTokens: () => {}, runTool,
          checkpointMilestone: async () => { throw new Error("No foreground auto-application in human reference"); },
          verifyPersistence: async () => { throw new Error("No foreground persistence in human reference"); },
        },
        chat: async (_config, request) => {
          referenceRequests.push(request); const step = referenceSteps.shift();
          if (!step) throw new Error("Unexpected foreground request"); return step;
        },
      });
      const planned = await reference.sendUserMessage("Register a new database item", event => events.push(event), undefined, { composerMode: "plan" });
      expect(planned.proposedCalls).toEqual([]);
      expect(reference.syncBaselineFromStoreIfClean(current)).toBe(true);
      const foreground = await reference.sendUserMessage("계속", event => events.push(event), undefined, { composerMode: "plan" });
      expect(foreground.stoppedReason, JSON.stringify({ error: foreground.error, requests: referenceRequests.length,
        tools: events.filter(e => e.type === "tool_call") })).toBe("final");
      expect(referenceRequests).toHaveLength(4);
      expect(referenceRequests[1]!.tools ?? []).toEqual([]); // new human planner resume, NOT driver skip
      expect(foreground.proposedCalls.some(c => c.name === "upsert_item")).toBe(true);
      expect(foreground.workPlan?.id).toBe(planned.workPlan?.id);
      await f.reopen();
      const successor = await f.successor(current);
      f.responses.set("continue", [resume(), mutation(), final()]);
      f.hooks.dispatch = async (label, index) => { if (label === "continue" && index === 0) { entered.resolve(); await bounded(release.promise); } };
      watched = f.watch("continue");
      await f.scheduler.admit({ idempotencyKey: "continue", input: successor });
      await bounded(Promise.race([entered.promise, watched.promise.then(() => { throw new Error("Successor ended before its human planner request"); })]));
      const state = jsonObject((await f.checkpoint("continue")).state);
      expect(jsonObject(state.progress).workPlan).toEqual(source.payload.workPlan);
      expect(parseProject(await f.repository.readJson(ref(state.draftRef))).meta.title).toBe(current.meta.title);
      expect(state.toolRefs).toEqual([]);
      const request = f.requests.find(r => r.label === "continue")!.operation;
      expect(jsonObject(jsonObject(request.request).body).tools ?? []).toEqual([]);
      release.resolve();
      expect((await bounded(watched.promise)).states.generation, String(f.errors.at(-1)?.error)).toBe("succeeded");
      const result = await f.result("continue");
      expect(jsonObject(result.payload.workPlan).id).toBe(jsonObject(source.payload.workPlan).id);
      expect(jsonObject(result.payload.workPlan).layers).toEqual(jsonValue(foreground.workPlan!.layers));
      const generated = parseProject(await f.repository.readJson(result.generatedSnapshot!));
      expect(generated.meta.title).toBe(current.meta.title);
      expect(generated.database.items.filter(i => i.name === itemName)).toHaveLength(1);
      expect(f.dispatches("source")).toBe(2); expect(f.dispatches("continue")).toBe(3);
      expect(f.project.meta.title).not.toBe(current.meta.title);
      const later = structuredClone(current); later.meta.title = "Later independent human edit";
      const merged = mergeResultProject(current, generated, later);
      expect(merged.meta.title).toBe(later.meta.title);
      expect(merged.database.items.some(i => i.name === itemName)).toBe(true);
    } finally { release.resolve(); watched?.close(); await f.close(); }
  }, 120000);

  it("allows an explicit new human instruction to replan rather than forcing driver continuation", async () => {
    const f = await fixture();
    try {
      const source = await f.source(), replacement = { goal: "Different requested record", layers: [{ id: "replacement", title: "Replacement", items: [
        { id: "replacement-item", title: "New", instruction: "upsert_item", successTools: ["upsert_item"] },
      ] }] };
      const successor = await f.successor(f.project, { instruction: "Replace the previous goal with this different record", turn: { composerMode: "do" } });
      const outcome = await f.run("continue", successor, [final(JSON.stringify(declaredIntent(initialIntent))),
        final(JSON.stringify({ action: "replan", ...replacement })), mutation(), final()]);
      expect(outcome.states.generation, String(f.errors.at(-1)?.error)).toBe("succeeded");
      const result = await f.result("continue");
      expect(result.payload.workPlan).toMatchObject(replacement);
      expect(jsonObject(result.payload.workPlan).layers).not.toEqual(jsonObject(source.payload.workPlan).layers);
      expect(f.dispatches("continue")).toBe(4); // fresh intent + planner + tool + final
    } finally { await f.close(); }
  }, 60000);

  it("retains required reads and does not treat source context as successful read evidence", async () => {
    const f = await fixture();
    try {
      await f.source({}, { readBeforeWrite: { project: false, collections: ["items"], references: false } });
      const outcome = await f.run("continue", await f.successor(), [resume(), mutation(), tool("get_database_records", { collection: "items" }), mutation(), final()]);
      expect(outcome.states.generation, String(f.errors.at(-1)?.error)).toBe("succeeded");
      const state = jsonObject((await f.checkpoint("continue")).state), rows = activity(state).filter(r => r.name === "upsert_item");
      expect(rows.map(r => r.ok)).toEqual([false, true]);
      const result = await f.result("continue");
      const tools = requireArray("audit", result.payload.audit).map(jsonObject).filter(e => e.kind === "tool" && e.name === "upsert_item");
      expect(tools[0]!.ok).toBe(false);
      const generated = parseProject(await f.repository.readJson(result.generatedSnapshot!));
      expect(generated.database.items.filter(i => i.name === itemName)).toHaveLength(1);
    } finally { await f.close(); }
  }, 60000);

  it("keeps the original volume baseline while counting intervening human authoring", async () => {
    const f = await fixture();
    try {
      const source = await f.source({}, {}, { volume: { authoredMaps: 1, multiPageNpcs: 0, shops: 0, quests: 0 } });
      const current = structuredClone(f.project), template = current.maps[current.startMapId]!;
      current.maps["human-map"] = { ...structuredClone(template), id: "human-map", name: "Human map", events: [] };
      current.maps["human-map"]!.lowerTiles[0] = 1; current.maps["human-map"]!.lowerTiles[1] = 2;
      expect(measureVolume(current).authoredMaps).toBeGreaterThan(measureVolume(f.project).authoredMaps);
      const outcome = await f.run("continue", await f.successor(current), [resume(), mutation(), final()]);
      expect(outcome.states.generation, String(f.errors.at(-1)?.error)).toBe("succeeded");
      expect(f.dispatches("continue")).toBe(3); // re-arming at the new snapshot would demand another map
      expect(continuation(source).volume).toMatchObject({ baseline: measureVolume(parseProject(jsonValue(f.project))) });
      expect(parseProject(await f.repository.readJson((await f.result("continue")).generatedSnapshot!)).maps["human-map"]).toEqual(current.maps["human-map"]);
    } finally { await f.close(); }
  }, 60000);

  it("retains adventure repair requirements after a nominally complete checklist", async () => {
    const f = await fixture(), release = deferred<void>(), entered = deferred<void>(); let watched: ReturnType<typeof f.watch> | undefined;
    try {
      await f.source({}, { adventure: { village: false, dungeon: true, party: false, battle: false } });
      const successor = await f.successor();
      f.responses.set("continue", [resume(), mutation(), final(), final()]);
      f.hooks.dispatch = async (label, index) => { if (label === "continue" && index === 3) { entered.resolve(); await bounded(release.promise); } };
      watched = f.watch("continue"); await f.scheduler.admit({ idempotencyKey: "continue", input: successor });
      await bounded(Promise.race([entered.promise, watched.promise.then(() => { throw new Error("Adventure contract was lost before repair request"); })]));
      expect(f.job("continue")).toMatchObject({ generation: "running", resultRef: null });
      await f.scheduler.cancel(f.job("continue").id); release.resolve(); await f.scheduler.close();
      expect(f.job("continue").generation).toBe("cancelled");
    } finally { release.resolve(); watched?.close(); await f.close(); }
  }, 60000);

  it("replays only the successor paid prefix after reopen, retaining source plan and allocated successor IDs", async () => {
    const f = await fixture();
    try {
      const source = await f.source(), beforeSource = f.repository.snapshot().operations;
      const successor = await f.successor(); let interrupted = false;
      f.hooks.afterOperation = async (label, operation) => {
        if (label === "continue" && operation.key.endsWith("/provider/3") && !interrupted) { interrupted = true; throw new Error("CONTINUE_POST_RESPONSE_INTERRUPTION"); }
      };
      const first = await f.run("continue", successor, [resume(), mutation(), tool("create_map", { name: "Successor allocated map", width: 8, height: 8 }), final()]);
      expect(first.states.generation).toBe("failed");
      expect(f.errors.at(-1)?.error).toMatchObject({ message: expect.stringContaining("CONTINUE_POST_RESPONSE_INTERRUPTION") });
      const checkpoint = await f.checkpoint("continue"), operations = f.repository.snapshot().operations;
      const state = jsonObject(checkpoint.state), draft = await f.repository.readJson(ref(state.draftRef));
      await f.reopen(); const watched = f.watch("continue");
      try { await f.scheduler.retry(f.job("continue").id, { stage: "generation" }); expect((await bounded(watched.promise)).states.generation).toBe("succeeded"); }
      finally { watched.close(); }
      const next = jsonObject((await f.checkpoint("continue")).state), result = await f.result("continue");
      expect(next.toolRefs).toEqual(state.toolRefs);
      expect(await f.repository.readJson(ref(next.draftRef))).toEqual(draft);
      expect(jsonObject(result.payload.workPlan).id).toBe(jsonObject(source.payload.workPlan).id);
      expect(f.repository.snapshot().operations).toEqual(operations);
      expect(operations.filter(o => o.jobId === f.job("source").id)).toEqual(beforeSource);
      expect(f.dispatches("source")).toBe(2); expect(f.dispatches("continue")).toBe(4);
      const generated = parseProject(await f.repository.readJson(result.generatedSnapshot!));
      const allocated = Object.values(generated.maps).filter(map => map.name === "Successor allocated map");
      expect(allocated).toHaveLength(1);
      expect(parseProject(draft).maps[allocated[0]!.id]).toEqual(allocated[0]);
      for (const key of new Set(f.requests.filter(r => r.label === "continue").map(r => r.operation.key))) {
        const attempts = f.requests.filter(r => r.label === "continue" && r.operation.key === key);
        expect(attempts).toHaveLength(2); expect(attempts[1]!.operation).toEqual(attempts[0]!.operation);
      }
      expect(result.payload.usage).toMatchObject({ calls: 4, callsWithoutUsage: 4 });
    } finally { await f.close(); }
  }, 90000);

  it.each(["save", "provider"] as const)("fences a cancelled successor with a held %s acknowledgement", async boundary => {
    const f = await fixture(), release = deferred<void>(), entered = deferred<void>(); let watched: ReturnType<typeof f.watch> | undefined;
    try {
      await f.source(); const sourceRef = f.job("source").resultRef;
      f.responses.set("continue", [resume(), mutation(), final()]);
      let held: Write | undefined;
      if (boundary === "save") f.hooks.beforeSave = async (label, next) => {
        if (label === "continue" && !held && next.state.progress && jsonObject(next.state.progress).currentTool !== null) {
          held = structuredClone(next); entered.resolve(); await bounded(release.promise);
        }
      };
      else f.hooks.dispatch = async (label, index) => { if (label === "continue" && index === 1) { entered.resolve(); await bounded(release.promise); } };
      watched = f.watch("continue"); await f.scheduler.admit({ idempotencyKey: "continue", input: await f.successor() });
      await bounded(Promise.race([entered.promise, watched.promise.then(() => { throw new Error("Successor never reached cancellation boundary"); })]));
      await f.scheduler.cancel(f.job("continue").id); const cancelled = f.job("continue").checkpointRef;
      release.resolve(); await f.scheduler.close();
      expect(f.job("continue")).toMatchObject({ generation: "cancelled", checkpointRef: cancelled, resultRef: null, activeAttemptId: null });
      expect(f.job("source").resultRef).toEqual(sourceRef);
      if (held) await expect(f.hosts.get("continue")!.saveCheckpoint(held)).rejects.toThrow();
      if (boundary === "provider") expect(f.repository.snapshot().operations.filter(o => o.jobId === f.job("continue").id).at(-1)?.status).toBe("succeeded");
    } finally { release.resolve(); watched?.close(); await f.close(); }
  }, 60000);

  it("deduplicates identical Continue admission and rejects reuse with changed captured input", async () => {
    const f = await fixture();
    try {
      await f.source(); const input = await f.successor();
      expect((await f.run("continue", input, [resume(), mutation(), final()])).states.generation).toBe("succeeded");
      const same = await f.scheduler.admit({ idempotencyKey: "continue", input });
      expect(same.created).toBe(false); expect(f.repository.snapshot().jobs).toHaveLength(2);
      await expect(f.scheduler.admit({ idempotencyKey: "continue", input: { ...input, payload: { ...input.payload, instruction: "different" } } })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      expect(f.dispatches("continue")).toBe(3);
    } finally { await f.close(); }
  }, 60000);
});

describe("continuation audit regressions", () => {
  it.each(["foreign-map", "out-of-bounds"] as const)("rejects the actual %s footer scope even when structured scope is valid", async kind => {
    const f = await fixture();
    try {
      const source = await f.source(), mapA = f.project.startMapId, current = structuredClone(f.project);
      const original = current.maps[mapA];
      if (!original) throw new Error("Missing fixture map");
      current.maps["footer-map-b"] = { ...structuredClone(original), id: "footer-map-b", name: "Footer B" };
      const footerMap = kind === "foreign-map" ? "footer-map-b" : mapA;
      const x = kind === "out-of-bounds" ? original.width : 0;
      const text = `계속\n[컨텍스트] 현재 맵: Footer target (${footerMap}) · 사용자 선택 영역: (${x},0) 2×2`;
      expect(parseContextFooter(text)).toEqual({ mapId: footerMap, selection: { x, y: 0, w: 2, h: 2 } });
      expect(jsonObject(source.payload.workPlan).targetMapId).toBe(mapA);
      const input = await f.successor(current, { instruction: text,
        selection: { mapId: mapA, x: 0, y: 0, width: 2, height: 2 },
        turn: { composerMode: "plan", instruction: "계속", scope: { mapId: mapA, region: { x: 0, y: 0, width: 2, height: 2 } } } });
      const outcome = await f.run("continue", input, [resume(), mutation(), final()]);
      expect(outcome.states.generation).toBe("failed");
      expect(f.dispatches("continue")).toBe(0);
      expect(f.repository.snapshot().operations.filter(o => o.jobId === f.job("continue").id)).toEqual([]);
    } finally { await f.close(); }
  }, 60000);

  it("retains A's inherited context through B's clean replan into C's execution after reopen", async () => {
    const f = await fixture(), entered = deferred<void>(), release = deferred<void>();
    let watched: ReturnType<typeof f.watch> | undefined;
    try {
      const constraint = { preserveRecordId: "ancestor-constraint-7f31", requiredPrice: 271 };
      await f.source({ priorTranscript: JSON.stringify(constraint) });
      const requiredReads = { project: false, collections: ["items"], references: false };
      const replacement = { goal: "B revised record plan", layers: [{ id: "b-layer", title: "Records", items: [
        { id: "b-item", title: "Register", instruction: "upsert_item", successTools: ["upsert_item"] },
      ] }] };
      const bInput = await f.successor(f.project, { instruction: "Revise this checklist without executing it", turn: { composerMode: "plan" } });
      expect(bInput.payload).not.toHaveProperty("priorTranscript");
      const bOutcome = await f.run("replan-b", bInput, [final(JSON.stringify(declaredIntent({ ...initialIntent, readBeforeWrite: requiredReads }))),
        final(JSON.stringify({ action: "replan", ...replacement }))]);
      expect(bOutcome.states.generation, String(f.errors.at(-1)?.error)).toBe("succeeded");
      const b = await f.result("replan-b");
      expect(b.payload.proposedCalls).toEqual([]);
      expect(jsonObject((await f.checkpoint("replan-b")).state).toolRefs).toEqual([]);
      expect(continuation(b).readBeforeWrite).toEqual(requiredReads);
      await f.reopen();
      const cInput = await f.successor(f.project, {}, "replan-b");
      expect(cInput.payload).not.toHaveProperty("priorTranscript");
      f.responses.set("continue-c", [resume(), mutation(), tool("get_database_records", { collection: "items" }), mutation(), final()]);
      f.hooks.dispatch = async (label, index, request) => {
        if (label !== "continue-c" || index !== 1) return;
        expect(requireArray("execution tools", jsonObject(jsonObject(request).body).tools).length).toBeGreaterThan(0);
        entered.resolve(); await bounded(release.promise);
      };
      watched = f.watch("continue-c"); await f.scheduler.admit({ idempotencyKey: "continue-c", input: cInput });
      await bounded(Promise.race([entered.promise, watched.promise.then(() => { throw new Error("C ended before its first execution request"); })]));
      const cState = jsonObject((await f.checkpoint("continue-c")).state);
      expect(jsonObject(cState.progress).workPlan).toEqual(b.payload.workPlan);
      const calls = f.requests.filter(r => r.label === "continue-c");
      const execution = calls.at(-1);
      if (!execution) throw new Error("Missing C execution request");
      const messages = requireArray("execution messages", jsonObject(jsonObject(execution.operation.request).body).messages).map(jsonObject);
      const restored = messages.filter(m => m.role === "user" && typeof m.content === "string" && m.content.startsWith(RESTORED_TRANSCRIPT_MARKER))
        .map(m => requireString("restored content", m.content)).join("\n");
      expect(restored).toContain(JSON.stringify(constraint));
      release.resolve();
      expect((await bounded(watched.promise)).states.generation, String(f.errors.at(-1)?.error)).toBe("succeeded");
      expect(activity(jsonObject((await f.checkpoint("continue-c")).state)).filter(row => row.name === "upsert_item").map(row => row.ok)).toEqual([false, true]);
      expect(f.dispatches("source")).toBe(2); expect(f.dispatches("replan-b")).toBe(2); expect(f.dispatches("continue-c")).toBe(5);
    } finally { release.resolve(); watched?.close(); await f.close(); }
  }, 90000);
});

describe("bounded source-owned continuation history", () => {
  it("bounds retained history deterministically while preserving the newest source instruction", async () => {
    const f = await fixture();
    try {
      const instruction = JSON.stringify({ newestConstraintId: "latest-history-019f" });
      const source = await f.source({ instruction, priorTranscript: "x".repeat(RESTORED_TRANSCRIPT_MAX_CHARS * 2) });
      const history = requireString("history", continuation(source).history);
      expect(history.length).toBeLessThanOrEqual(RESTORED_TRANSCRIPT_MAX_CHARS);
      expect(history).toContain(instruction);
      const saved = jsonObject(jsonObject((await f.checkpoint("source")).state).completed);
      expect(jsonObject(jsonObject(saved.turn).continuationState).history).toBe(history);
      await f.reopen();
      expect(continuation(await f.result("source")).history).toBe(history);
    } finally { await f.close(); }
  }, 60000);

  it.each(["root", "bound"] as const)("handles a legacy %s source without inventing lost ancestor history", async kind => {
    const f = await fixture();
    try {
      const constraint = JSON.stringify({ legacyConstraintId: "legacy-history-981d" });
      f.hooks.output = async (label, result) => {
        if (label !== (kind === "root" ? "source" : "replan-b")) return result;
        const state = { ...continuation(result) }; delete state.history;
        return { ...result, payload: { ...result.payload, continuationState: state } };
      };
      await f.source({ priorTranscript: constraint });
      const bInput = await f.successor();
      expect((await f.run("replan-b", bInput, [final(JSON.stringify({ action: "replan", ...plan }))])).states.generation).toBe("succeeded");
      const b = await f.result("replan-b");
      if (kind === "root") expect(requireString("history", continuation(b).history)).toContain(constraint);
      else expect(continuation(b)).not.toHaveProperty("history");
      await f.reopen();
      const outcome = await f.run("continue-c", await f.successor(f.project, {}, "replan-b"), [resume(), mutation(), final()]);
      expect(outcome.states.generation).toBe(kind === "root" ? "succeeded" : "failed");
      expect(f.dispatches("continue-c")).toBe(kind === "root" ? 3 : 0);
      if (kind === "bound") expect(f.errors.at(-1)?.error).toMatchObject({ message: "CONTINUATION_HISTORY_UNAVAILABLE" });
    } finally { await f.close(); }
  }, 60000);
});

describe("continuation identity and eligibility boundaries", () => {
  it.each(["hash", "dependency", "extra-dependency", "project", "provider", "model", "budget", "domain", "target", "deleted-target", "scope", "client-history", "extra-field"] as const)("rejects changed %s binding before successor dispatch", async change => {
    const f = await fixture();
    try {
      const source = await f.source();
      expect(await sha256HexText(canonicalJson(source))).toBe(f.job("source").resultRef!.sha256);
      let input = await f.successor();
      const payload: Record<string, JsonValue> = { ...input.payload };
      if (change === "hash") payload.continuation = { sourceJobId: f.job("source").id, resultSha256: "a".repeat(64) };
      if (change === "dependency") input = { ...input, dependsOn: [] };
      if (change === "extra-dependency") {
        expect((await f.run("other", { ...f.input, payload: { ...f.input.payload, instruction: "Other plan" } }, [final(JSON.stringify(declaredIntent(initialIntent))), planner()])).states.generation).toBe("succeeded");
        input = { ...input, dependsOn: [f.job("source").id, f.job("other").id] };
      }
      if (change === "project") input = { ...input, project: { ...input.project, projectId: "foreign-project" } };
      if (change === "provider") payload.config = { ...config, providerId: "openai-codex" };
      if (change === "model") payload.config = { ...config, model: "gemini-3.7-pro" };
      if (change === "budget") payload.config = { ...config, maxToolCalls: 9 };
      if (change === "domain") payload.domain = "map";
      if (change === "target") payload.context = { ...context, currentMapId: "missing-target" };
      if (change === "deleted-target") {
        const current = structuredClone(f.project), old = current.startMapId;
        current.maps["replacement-map"] = { ...structuredClone(current.maps[old]!), id: "replacement-map" };
        delete current.maps[old]; current.startMapId = "replacement-map";
        input = await f.successor(current);
        payload.context = { ...context, currentMapId: current.startMapId };
        expect(jsonObject(source.payload.workPlan).targetMapId).toBe(old);
      }
      if (change === "scope") payload.turn = { composerMode: "plan", scope: { mapId: f.project.startMapId, region: { x: 999, y: 999, width: 2, height: 2 } } };
      if (change === "client-history") payload.priorTranscript = JSON.stringify({ clientHistoryOverride: "not-source-owned" });
      if (change === "extra-field") payload.continuation = { ...jsonObject(input.payload.continuation), plan: source.payload.workPlan };
      expect((await f.run("continue", { ...input, payload }, [])).states.generation).toBe("failed");
      expect(f.dispatches("continue")).toBe(0);
      expect(f.repository.snapshot().operations.filter(o => o.jobId === f.job("continue").id)).toEqual([]);
    } finally { await f.close(); }
  }, 60000);

  it.each(["legacy", "state-version", "state-extra", "volume", "read-contract", "read-extra", "adventure-extra", "plan-identity", "plan-cursor", "plan-status", "plan-extra", "plan-oversized", "history-type", "history-oversized", "input-ref", "input-identity"] as const)("rejects a retained source with malformed/unavailable %s authority", async change => {
    const f = await fixture();
    try {
      f.hooks.output = async (label, result, host) => {
        if (label !== "source") return result;
        const payload: Record<string, JsonValue> = structuredClone(result.payload);
        const state = continuation(result);
        if (change === "legacy") delete payload.continuationState;
        if (change === "state-version") payload.continuationState = { ...state, version: 2 };
        if (change === "state-extra") payload.continuationState = { ...state, messages: [] };
        if (change === "volume") payload.continuationState = { ...state, volume: { baseline: { authoredMaps: -1 }, minimum: {} } };
        if (change === "read-contract") payload.continuationState = { ...state, readBeforeWrite: { project: true, references: true, collections: "items" } };
        if (change === "read-extra") payload.continuationState = { ...state, readBeforeWrite: { project: true, references: true, collections: [], messages: [] } };
        if (change === "adventure-extra") payload.continuationState = { ...state, adventure: { village: false, dungeon: false, party: false, battle: false, messages: [] } };
        if (change === "plan-identity") payload.workPlan = { ...jsonObject(payload.workPlan), id: "" };
        if (change === "plan-cursor") payload.workPlan = { ...jsonObject(payload.workPlan), currentItemId: "absent-item" };
        if (change === "plan-status") {
          const p = jsonObject(payload.workPlan), layers = requireArray("layers", p.layers).map(value => ({ ...jsonObject(value) }));
          const items = requireArray("items", layers[0]!.items).map(value => ({ ...jsonObject(value) })); items[0]!.status = "applied";
          layers[0]!.items = items; payload.workPlan = { ...p, layers };
        }
        if (change === "plan-extra") payload.workPlan = { ...jsonObject(payload.workPlan), rawMessages: [] };
        if (change === "plan-oversized") payload.workPlan = { ...jsonObject(payload.workPlan), plannerNote: "x".repeat(131073) };
        if (change === "history-type") payload.continuationState = { ...state, history: [] };
        if (change === "history-oversized") payload.continuationState = { ...state, history: "x".repeat(RESTORED_TRANSCRIPT_MAX_CHARS + 1) };
        if (change === "input-ref") payload.continuationState = { ...state, inputRef: jsonValue(await host.putJson({ notAnInput: true })) };
        if (change === "input-identity") {
          const original = jsonObject(await host.readJson(ref(state.inputRef)));
          const wrong = await host.putJson({ ...original, project: { backend: "local", projectId: "foreign" } });
          payload.continuationState = { ...state, inputRef: jsonValue(wrong) };
          return { ...result, payload, artifacts: [...result.artifacts, wrong] };
        }
        return { ...result, payload };
      };
      await f.source();
      expect((await f.run("continue", await f.successor(), [])).states.generation).toBe("failed");
      expect(f.dispatches("continue")).toBe(0);
    } finally { await f.close(); }
  }, 60000);

  it("leaves an oversized authored plan available as output without advertising executable continuation", async () => {
    const f = await fixture();
    try {
      const source = await f.source({}, {}, { plannerNote: "x".repeat(131073) });
      expect(source.payload.completion).toBe("complete");
      expect(source.payload).not.toHaveProperty("continuationState");
      expect(requireString("plannerNote", jsonObject(source.payload.workPlan).plannerNote)).toHaveLength(131073);
      expect((await f.run("continue", await f.successor(), [])).states.generation).toBe("failed");
      expect(f.dispatches("continue")).toBe(0);
    } finally { await f.close(); }
  }, 60000);

  it.each(["question", "executed"] as const)("does not label ordinary %s output as clean plan-only authority", async kind => {
    const f = await fixture();
    try {
      const input = { ...f.input, payload: { ...f.input.payload, turn: { composerMode: "do" } } };
      const steps = kind === "question" ? [final(JSON.stringify(declaredIntent({ mode: "question" }))), final()]
        : [final(JSON.stringify(declaredIntent({ mode: "modify", tools: ["upsert_item"] }))), mutation(), final()];
      expect((await f.run("source", input, steps)).states.generation).toBe("succeeded");
      expect((await f.result("source")).payload).not.toHaveProperty("continuationState");
      expect((await f.run("continue", await f.successor(), [])).states.generation).toBe("failed");
      expect(f.dispatches("continue")).toBe(0);
    } finally { await f.close(); }
  }, 60000);

  it.each(["failed", "cancelled", "interrupted"] as const)("keeps %s unknown paid work on the original job rather than a new Continue", async status => {
    const f = await fixture(), entered = deferred<void>(), release = deferred<void>(); let watched: ReturnType<typeof f.watch> | undefined;
    try {
      f.responses.set("source", [final(JSON.stringify(declaredIntent(initialIntent)))]);
      f.hooks.dispatch = async label => {
        if (label !== "source") return;
        entered.resolve(); await bounded(release.promise); throw new Error("UNKNOWN_SOURCE_OUTCOME");
      };
      watched = f.watch("source"); await f.scheduler.admit({ idempotencyKey: "source", input: f.input });
      await bounded(entered.promise);
      if (status === "cancelled") await f.scheduler.cancel(f.job("source").id);
      if (status === "interrupted") {
        const closing = f.scheduler.close();
        await bounded(watched.promise); // durable interrupted event precedes the late provider failure
        release.resolve(); await closing;
      } else { release.resolve(); await bounded(watched.promise); }
      await f.reopen();
      expect(f.job("source").generation).toBe(status);
      expect(f.repository.snapshot().operations.some(o => o.status === "outcome-unknown")).toBe(true);
      const old = f.repository.snapshot().operations;
      expect((await f.run("continue", await f.successor(), [])).states.generation).toBe("failed");
      expect(f.dispatches("continue")).toBe(0); expect(f.repository.snapshot().operations).toEqual(old);
      await expect(f.scheduler.retry(f.job("source").id, { stage: "generation" })).rejects.toMatchObject({ code: "DUPLICATE_SPEND_ACK_REQUIRED" });
      expect(f.repository.snapshot().operations).toEqual(old);
    } finally { release.resolve(); watched?.close(); await f.close(); }
  }, 60000);
});
