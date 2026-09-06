import { describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openAiJobsRepository } from "../scripts/lib/aiJobs/repository.mjs";
import { createAiJobsScheduler, type AiJobsScheduler, type AiJobsRuntime, type AiJobHost } from "../scripts/lib/aiJobs/scheduler.mjs";
import { executeAssistantJob } from "@/ai/jobs/executors/assistantJob";
import { executeRegionJob } from "@/ai/jobs/executors/regionJob";
import { createJobChat } from "@/ai/jobs/providerBridge";
import { runTool } from "@/editor/tools/toolRunner";
import type { AiConfig, ChatRequest } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { jsonObject, jsonValue, parseProject } from "@/ai/jobs/checkpointState";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { requireNumber, requireString } from "@/project/io/guards";
import type { AiJobInput, AiJobEvent, BlobRef, JsonValue } from "@/ai/jobs/contracts";
import { declaredIntent } from "./intentFixture";

const config = { authMode: "chatgpt", providerId: "google-antigravity", agentMode: "chat",
  model: "gemini-3.7-flash", liteModel: "gemini-3.7-flash", maxToolCalls: 8, maxTokens: 4096 };
const final = (content = "Done"): JsonValue => ({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] });
const tool = (name: string, args: unknown): JsonValue => jsonValue({ choices: [{ message: { role: "assistant", content: null,
  tool_calls: [{ id: `call-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: "tool_calls" }] });
function ref(value: unknown): BlobRef {
  const r = jsonObject(value);
  return { sha256: requireString("sha256", r.sha256), byteLength: requireNumber("byteLength", r.byteLength), mediaType: requireString("mediaType", r.mediaType) };
}
function outcome(scheduler: AiJobsScheduler) {
  let unsubscribe = () => {};
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<AiJobEvent>((resolve, reject) => {
    unsubscribe = scheduler.subscribe(event => {
      if (event.kind !== "outcome" || !["failed", "succeeded"].includes(event.states.generation)) return;
      clearTimeout(timer); unsubscribe(); resolve(event);
    });
    timer = setTimeout(() => { unsubscribe(); reject(new Error("Durable outcome not observed")); }, 90000);
  });
  return { promise, close: () => { clearTimeout(timer); unsubscribe(); } };
}

describe("canonical filesystem checkpoint replay", () => {
  it.each(["assistant", "region"] as const)("reuses exact paid requests and create_map IDs after a real %s repository restart", async family => {
    const directory = await mkdtemp(join(tmpdir(), "ai-canonical-replay-"));
    let repository = await openAiJobsRepository({ directory });
    const failures: unknown[] = [], fatal: unknown[] = [];
    const requests = new Map<string, JsonValue[]>();
    let dispatches = 0, interrupted = false;
    const responses = [final(JSON.stringify(declaredIntent({ mode: "modify", space: "outdoor", tools: ["create_map", "get_project_summary"], useSelection: family === "region" }))),
      tool("create_map", { name: "Disk retained room", width: 8, height: 8 }), tool("get_project_summary", {}), final()];
    const runtime: AiJobsRuntime = {
      onError: error => fatal.push(error),
      dispatchProvider: async () => { const response = responses[dispatches++]; if (!response) throw new Error("Unexpected paid redispatch"); return response; },
      executeJob: async (input, host) => {
        const capturedHost = { ...host, providerOperation: async (operation: Parameters<typeof host.providerOperation>[0]) => {
          const previous = requests.get(operation.key) ?? []; previous.push(structuredClone(operation.request)); requests.set(operation.key, previous);
          const response = await host.providerOperation(operation); // REAL durable provider ledger, including OPERATION_MISMATCH.
          if (operation.key.endsWith("/provider/3") && !interrupted) { interrupted = true; throw new Error("Lost worker after durable response"); }
          return response;
        } };
        try {
          if (input.family === "assistant") return await executeAssistantJob(input, capturedHost);
          if (input.family === "region") return await executeRegionJob(input, capturedHost);
          throw new Error("Unexpected family");
        } catch (error) { failures.push(error); throw error; }
      },
    };
    let scheduler = createAiJobsScheduler({ repository, ...runtime });
    let watched: ReturnType<typeof outcome> | undefined;
    try {
      resetIntentDeclarationCache();
      const base = createBlankProject();
      const context = { currentMapId: base.startMapId, budgetChars: 18000, preferenceMemorySection: "" };
      const common = { version: 1 as const, project: { backend: "local", projectId: "disk-replay" },
        projectSnapshot: await repository.putJson(jsonValue(base)), artwork: [], target: {}, mode: "review", dependsOn: [] };
      const input: AiJobInput = family === "assistant"
        ? { ...common, family, payload: jsonObject({ instruction: "Create and inspect a map", config, context, domain: "map" }) }
        : { ...common, family, payload: jsonObject({ instruction: "Create and inspect a map", config, context, mapId: base.startMapId,
          region: { x: 2, y: 2, width: 6, height: 6 }, mode: "task" }) };
      watched = outcome(scheduler);
      const { job } = await scheduler.admit({ idempotencyKey: "disk-replay", input });
      expect((await watched.promise).states.generation).toBe("failed");
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({ message: expect.stringContaining("Lost worker") });
      expect(dispatches).toBe(4);
      const checkpointRef = scheduler.getJob(job.id).checkpointRef;
      if (!checkpointRef) throw new Error("No durable checkpoint");
      const checkpoint = jsonObject(await repository.readJson(checkpointRef));
      const session = family === "region" ? jsonObject(jsonObject(jsonObject(checkpoint.state).session).state) : jsonObject(checkpoint.state);
      const before = parseProject(await repository.readJson(ref(session.draftRef)));
      const created = Object.values(before.maps).find(map => map.name === "Disk retained room");
      expect(created).toBeTruthy();
      const operationRefs = repository.snapshot().operations.map(operation => operation.requestRef);
      expect(repository.snapshot().operations.every(operation => operation.status === "succeeded")).toBe(true);
      await scheduler.close(); await repository.close();
      repository = await openAiJobsRepository({ directory });
      scheduler = createAiJobsScheduler({ repository, ...runtime });
      expect(scheduler.getJob(job.id).checkpointRef).toEqual(checkpointRef);
      failures.length = 0;
      resetIntentDeclarationCache();
      watched = outcome(scheduler);
      await scheduler.retry(job.id, { stage: "generation" });
      const resumed = await watched.promise;
      expect(failures, "actual executor/ledger errors after disk restart").toEqual([]);
      expect(resumed.states.generation).toBe("succeeded");
      expect(dispatches).toBe(4);
      expect(repository.snapshot().operations.map(operation => operation.requestRef)).toEqual(operationRefs);
      for (const [key, attempts] of requests) { expect(attempts, key).toHaveLength(2); expect(attempts[1], key).toEqual(attempts[0]); }
      const resultRef = scheduler.getJob(job.id).resultRef;
      if (!resultRef || !created) throw new Error("Missing durable output");
      const result = jsonObject(await repository.readJson(resultRef));
      const generated = parseProject(await repository.readJson(ref(result.generatedSnapshot)));
      expect(generated.maps[created.id]).toEqual(created);
      expect(scheduler.getJob(job.id)).toMatchObject({ application: "awaiting-review", save: "unsaved" });
      expect(fatal).toEqual([]);
    } finally {
      watched?.close();
      try { await scheduler.close(); await repository.close(); }
      finally { await rm(directory, { recursive: true, force: true }); }
    }
  }, 120000);
});

it.each([undefined, 0, 7])("canonicalizes nested tool data with optional mapPropertiesChanged=%s through actual disk roundtrip", async mapPropertiesChanged => {
  const directory = await mkdtemp(join(tmpdir(), "ai-canonical-tool-"));
  const repository = await openAiJobsRepository({ directory });
  try {
    const result = runTool({ project: createBlankProject() }, "create_map", { name: "Nested data", width: 8, height: 8 });
    expect(result.ok).toBe(true);
    if (!result.diff) throw new Error("Missing real tool diff");
    if (mapPropertiesChanged === undefined) delete result.diff.mapPropertiesChanged;
    else result.diff.mapPropertiesChanged = mapPropertiesChanged;
    result.data = { zebra: { z: 1, a: 2 }, alpha: [{ z: 3, a: 4 }, { z: 5, a: 6 }], text: '{"z":1,"a":2}' };
    const source = jsonValue(result);
    const persisted = await repository.readJson(await repository.putJson(source));
    // This must really exercise canonicalizing persistence, not an insertion-order mock.
    expect(JSON.stringify(persisted)).not.toBe(JSON.stringify(source));
    let requestRef: BlobRef | undefined, responseRef: BlobRef | undefined, dispatches = 0;
    const requests: JsonValue[] = [];
    const host: AiJobHost = { ...repository, jobId: "canonical-tool", attemptId: "attempt", dependencies: [],
      loadCheckpoint: async () => null, saveCheckpoint: async () => { throw new Error("Unexpected checkpoint"); },
      providerOperation: async ({ request }) => {
        requests.push(structuredClone(request));
        const nextRef = await repository.putJson(request);
        if (requestRef && nextRef.sha256 !== requestRef.sha256) throw new Error("OPERATION_MISMATCH");
        requestRef = nextRef;
        if (!responseRef) { dispatches++; responseRef = await repository.putJson(final()); }
        return repository.readJson(responseRef);
      },
    };
    const captured: AiConfig = { ...config, authMode: "chatgpt", agentMode: "chat", apiKey: "", baseUrl: "" };
    const requestFor = (value: JsonValue): ChatRequest => ({ messages: [
      { role: "user", content: '{"z":"unchanged user content","a":1}' },
      { role: "assistant", content: null, tool_calls: [{ id: "call", type: "function", function: { name: "create_map", arguments: '{"z":1,"a":2}' } }] },
      { role: "tool", tool_call_id: "call", name: "create_map", content: JSON.stringify(value) },
    ] });
    const first = requestFor(source), replay = requestFor(persisted);
    const original = structuredClone(first);
    await createJobChat(host, async () => {})(captured, first);
    await createJobChat(host, async () => {})(captured, replay);
    expect(requests[1]).toEqual(requests[0]);
    expect(first).toEqual(original);
    expect(dispatches).toBe(1);
    const body = jsonObject(jsonObject(requests[0]).body);
    const messages = body.messages;
    if (!Array.isArray(messages)) throw new Error("Missing provider messages");
    expect(jsonObject(messages[0]).content).toBe(first.messages[0].content);
    expect(jsonObject(messages[1]).tool_calls).toEqual(jsonValue(first.messages[1].tool_calls));
    const sent = jsonObject(JSON.parse(requireString("tool content", jsonObject(messages[2]).content)));
    expect(sent.data).toEqual(source !== null && typeof source === "object" ? jsonObject(source).data : null);
    expect(Object.hasOwn(jsonObject(sent.diff), "mapPropertiesChanged")).toBe(mapPropertiesChanged !== undefined);
    if (mapPropertiesChanged !== undefined) expect(jsonObject(sent.diff).mapPropertiesChanged).toBe(mapPropertiesChanged);
    // A semantic nested value change must still fail the exact persisted request hash check.
    const changed = jsonObject(persisted);
    await expect(createJobChat(host, async () => {})(captured, requestFor({ ...changed,
      data: { ...jsonObject(changed.data), zebra: { z: 99, a: 2 } } }))).rejects.toThrow("OPERATION_MISMATCH");
    expect(dispatches).toBe(1);
  } finally { await repository.close(); await rm(directory, { recursive: true, force: true }); }
}, 30000);

it("preserves non-container tool content and canonicalizes root arrays without reordering them", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-tool-formats-"));
  const repository = await openAiJobsRepository({ directory });
  try {
    const requests: JsonValue[] = [];
    const host: AiJobHost = { ...repository, jobId: "tool-formats", attemptId: "attempt", dependencies: [],
      loadCheckpoint: async () => null, saveCheckpoint: async () => { throw new Error("Unexpected checkpoint"); },
      providerOperation: async ({ request }) => { requests.push(request); return final(); },
    };
    const captured: AiConfig = { ...config, authMode: "chatgpt", agentMode: "chat", apiKey: "", baseUrl: "" };
    const contents = ["tool-output:not-json", "42", '"scalar string"', "null", '[{"z":1,"a":2},{"z":3,"a":4}]'];
    const chat = createJobChat(host, async () => {});
    for (const content of contents) await chat(captured, { messages: [{ role: "tool", tool_call_id: "fixture", content }] });
    for (const [index, request] of requests.entries()) {
      const messages = jsonObject(jsonObject(request).body).messages;
      if (!Array.isArray(messages)) throw new Error("Missing messages");
      const content = jsonObject(messages[0]).content;
      expect(content).toBe(index === contents.length - 1 ? JSON.stringify([{ a: 2, z: 1 }, { a: 4, z: 3 }]) : contents[index]);
    }
  } finally { await repository.close(); await rm(directory, { recursive: true, force: true }); }
});
