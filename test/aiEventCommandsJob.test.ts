import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Command, EventPage } from "@/project/types";
import { executeEventCommandsJob } from "@/ai/jobs/executors/eventCommandsJob";
import { jsonObject, jsonValue } from "@/ai/jobs/checkpointState";
import type { AiJobCheckpoint, AiJobInput, BlobRef, JsonValue } from "@/ai/jobs/contracts";
import type { AiJobHost } from "../scripts/lib/aiJobs/scheduler.mjs";
import { openAiJobsRepository } from "../scripts/lib/aiJobs/repository.mjs";
import { applyCommandDiff, diffCommandLists } from "@/editor/panels/eventEditor/commandDiff";
import { runtimeGraph } from "./aiJobWorkerIsolation.test";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { runEventCommandAssist } from "@/ai/eventCommandAssist";
import { createBlankProject } from "@/project/defaults";
import type { AiConfig, ChatResult } from "@/ai/llmClient";

afterEach(() => vi.unstubAllGlobals());

describe("event command worker boundary", () => {
  it("uses injected chat for the real assist and every validation repair, never foreground HTTP", async () => {
    const project = createBlankProject();
    const fetch = vi.fn(async () => { throw new Error("foreground HTTP escaped the job host"); });
    vi.stubGlobal("fetch", fetch);
    let calls = 0;
    const chat = vi.fn(async (): Promise<ChatResult> => ({
      message: { role: "assistant", content: ++calls === 1 ? "not JSON" : '[{"kind":"text","body":"repaired"}]' },
      finishReason: "stop",
    }));
    const config: AiConfig = { authMode: "apiKey", baseUrl: "https://example.invalid/v1", apiKey: "test",
      model: "test-model", liteModel: "test-model", maxToolCalls: 8, maxTokens: 2048 };
    const options = { config, prompt: "Change the greeting", context: { project, mapId: project.startMapId }, chat,
      preferenceMemorySection: "" };
    const result = await runEventCommandAssist(options);
    expect(result).toEqual({ commands: [{ kind: "text", body: "repaired" }], scope: "page", attempts: 2 });
    expect(chat).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  });
});

const text = (body: string): Command => ({ kind: "text", body });
const wire = (content: string): JsonValue => ({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] });
const config = { authMode: "chatgpt", providerId: "google-antigravity", model: "supervisor", liteModel: "event-lite", maxToolCalls: 8, maxTokens: 2048 };

async function fixture(baseCommands: Command[] = [text("captured draft")], selection: number[] | null = null, common = false) {
  const project = createBlankProject();
  const page: EventPage = { id: "page-1", name: "Greeting", commands: [text("saved before draft")], conditions: [], graphic: {},
    trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 } };
  const mapId = project.startMapId;
  project.maps[mapId].events = [{ id: "event-1", x: 1, y: 2, trigger: page.trigger, commands: page.commands, pages: [page] }];
  project.commonEvents.push({ id: "common-1", name: "Common greeting", trigger: "call", commands: [text("saved common")] });
  const directory = await mkdtemp(join(tmpdir(), "ai-event-commands-"));
  let repository = await openAiJobsRepository({ directory });
  onTestFinished(async () => { try { await repository.close(); } finally { await rm(directory, { recursive: true, force: true }); } });
  const input: AiJobInput & { family: "event-commands" } = {
    version: 1, family: "event-commands", project: { backend: "local", projectId: "snapshot-A" },
    projectSnapshot: await repository.putJson(jsonValue(project)), artwork: [],
    target: common ? { kind: "common-event", mapId, commonEventId: "common-1" }
      : { kind: "map-event-page", mapId, eventId: "event-1", pageId: "page-1" }, mode: "review", dependsOn: [],
    payload: jsonObject(jsonValue({ prompt: "Change greeting", config, baseCommands, selection, preferenceMemorySection: "CAPTURED_MEMORY_SENTINEL" })),
  };
  const { job } = await repository.admit({ idempotencyKey: "event-fixture", input });
  await repository.transaction(draft => {
    draft.jobs[0].generation = "running";
    draft.jobs[0].activeAttemptId = "attempt-1";
    draft.attempts.push({ id: "attempt-1", jobId: job.id, stage: "generation", status: "running",
      startedAt: job.createdAt, finishedAt: null, error: null });
  });
  const operations: { key: string; request: JsonValue }[] = [];
  const ledger = new Map<string, { request: JsonValue; response: BlobRef }>();
  let dispatch: (key: string, request: JsonValue) => Promise<JsonValue> = async () => wire(JSON.stringify([text("generated")]));
  let interruptAfterDispatch = false;
  const checkpoint = async (): Promise<AiJobCheckpoint | null> => {
    const ref = repository.snapshot().jobs[0].checkpointRef;
    if (!ref) return null;
    return await repository.readJson(ref) as AiJobCheckpoint;
  };
  const host: AiJobHost = {
    jobId: job.id, attemptId: "attempt-1", dependencies: [],
    putJson: value => repository.putJson(value), readJson: ref => repository.readJson(ref),
    putBlob: (value, mediaType) => repository.putBlob(value, mediaType), readBlob: ref => repository.readBlob(ref),
    loadCheckpoint: checkpoint,
    saveCheckpoint: async value => {
      const ref = await repository.putJson(jsonValue({ ...value, version: 1, jobId: job.id, attemptId: host.attemptId, inputSha256: job.inputRef.sha256 }));
      await repository.transaction(draft => { draft.jobs[0].checkpointRef = ref; });
      return ref;
    },
    providerOperation: async ({ key, request }) => {
      operations.push({ key, request: structuredClone(request) });
      const cached = ledger.get(key);
      if (cached) { expect(request).toEqual(cached.request); return repository.readJson(cached.response); }
      const response = await dispatch(key, request);
      ledger.set(key, { request: structuredClone(request), response: await repository.putJson(response) });
      if (interruptAfterDispatch) { interruptAfterDispatch = false; throw new Error("interrupted after durable provider response"); }
      return response;
    },
  };
  const fetch = vi.fn(async () => { throw new Error("Unexpected foreground HTTP"); });
  vi.stubGlobal("fetch", fetch);
  return { project, input, host, operations, ledger, checkpoint, fetch,
    respond: (fn: typeof dispatch) => { dispatch = fn; },
    interrupt: () => { interruptAfterDispatch = true; },
    reopen: async () => { await repository.close(); repository = await openAiJobsRepository({ directory }); },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe("durable event command proposals", () => {
  it("runs real assist through a held wire response and retains draft context and exclusion review without applying", async () => {
    const f = await fixture();
    const before = structuredClone(f.project);
    const entered = deferred<JsonValue>(), release = deferred<JsonValue>();
    f.respond(async (_key, request) => { entered.resolve(request); return release.promise; });
    const pending = executeEventCommandsJob(f.input, f.host);
    const request = jsonObject(await Promise.race([entered.promise, pending.then(() => { throw new Error("Completed before provider barrier"); })]));
    try {
      expect(jsonObject(request.body).model).toBe("event-lite");
      expect(JSON.stringify(request)).toContain("CAPTURED_MEMORY_SENTINEL");
      expect((await f.checkpoint())?.stageKey).toBe("event-commands/start");
      expect(f.project).toEqual(before);
    } finally {
      release.resolve(wire(JSON.stringify([text("generated")])));
      await pending;
    }
    const result = await pending;
    const proposal = jsonObject(await f.host.readJson(result.artifacts[0]));
    expect(result.generatedSnapshot).toBeNull();
    expect(result.payload).toMatchObject({ completion: "complete", review: "required", persistence: "not-applicable", scope: "page", attempts: 1 });
    expect(proposal).toMatchObject({ target: f.input.target, baseSnapshot: f.input.projectSnapshot,
      baseCommands: [text("captured draft")], commands: [text("generated")], finalCommands: [text("generated")],
      context: { event: { id: "event-1", x: 1, y: 2 }, page: { id: "page-1", commands: [text("captured draft")] } },
      review: { status: "awaiting-review", diff: "command-lists-v1", excludedRowIds: [] } });
    const rows = diffCommandLists(proposal.baseCommands as Command[], proposal.finalCommands as Command[]);
    expect(applyCommandDiff(rows, new Set([rows[0].id]))).toEqual([text("captured draft")]);
    expect(f.project).toEqual(before);
    expect(f.fetch).not.toHaveBeenCalled();
    expect(f.operations.map(o => o.key)).toEqual(["event-commands/assist/0"]);
    await f.reopen();
    const retry = await executeEventCommandsJob(f.input, { ...f.host, attemptId: "attempt-2" });
    expect(retry).toEqual({ ...result, attemptId: "attempt-2" });
    expect(await f.host.readJson(retry.artifacts[0])).toEqual(proposal);
    expect(f.operations).toHaveLength(1);
  }, 30000);

  it.each([{ selection: null }, { selection: [0, -2, 0] }, { selection: [0, -3, 0] }])("preserves long-page insertion scope and selection $selection", async ({ selection }) => {
    const base: Command[] = [{ kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [text("nested")] }, text("x".repeat(12500))];
    const f = await fixture(base, selection);
    const result = await executeEventCommandsJob(f.input, f.host);
    const proposal = jsonObject(await f.host.readJson(result.artifacts[0]));
    expect(proposal.scope).toBe("append");
    const expected = structuredClone(base);
    if (selection?.[1] === -2) {
      const fork = expected[0];
      if (fork.kind !== "fork") throw new Error("Invalid fixture");
      fork.then.push(text("generated"));
    } else expected.push(text("generated"));
    expect(proposal.finalCommands).toEqual(expected);
    expect(proposal.baseCommands).toEqual(base);
  });

  it("captures a common event without treating it as a map event page", async () => {
    const f = await fixture([text("captured draft")], null, true);
    const input = f.input;
    const result = await executeEventCommandsJob(input, f.host);
    const proposal = jsonObject(await f.host.readJson(result.artifacts[0]));
    expect(proposal.target).toEqual(input.target);
    expect(proposal.context).toEqual({ commonEvent: f.project.commonEvents[0] });
    expect(proposal.baseCommands).toEqual([text("captured draft")]);
    expect(f.project.commonEvents[0].commands).toEqual([text("saved common")]);
  });

  it("retains invalid content before failed repair and retries only the missing paid stage", async () => {
    const f = await fixture();
    let fail = true;
    f.respond(async key => {
      if (key.endsWith("/0")) return wire('[{"kind":"changeItem","itemId":"missing-item","op":"+=","amount":1}]');
      if (fail) throw new Error("known provider failure");
      return wire(JSON.stringify([text("repaired")]));
    });
    await expect(executeEventCommandsJob(f.input, f.host)).rejects.toThrow("known provider failure");
    expect((await f.checkpoint())?.state.responseRefs).toHaveLength(1);
    expect((await f.checkpoint())?.state.proposalRef).toBeUndefined();
    fail = false;
    const result = await executeEventCommandsJob(f.input, f.host);
    expect(result.payload.attempts).toBe(2);
    expect(f.operations.map(o => o.key)).toEqual(["event-commands/assist/0", "event-commands/assist/1", "event-commands/assist/1"]);
    const messages = jsonObject(jsonObject(f.operations[1].request).body).messages;
    expect(Array.isArray(messages) && messages.length).toBe(4);
    expect(f.operations[2].request).toEqual(f.operations[1].request);
    expect(f.fetch).not.toHaveBeenCalled();
  });

  it("reuses the host ledger after interruption between durable paid response and worker receipt", async () => {
    const f = await fixture();
    f.interrupt();
    await expect(executeEventCommandsJob(f.input, f.host)).rejects.toThrow("interrupted after durable");
    expect((await f.checkpoint())?.state.responseRefs).toEqual([]);
    const result = await executeEventCommandsJob(f.input, f.host);
    expect(result.payload.completion).toBe("complete");
    expect(f.operations.map(o => o.key)).toEqual(["event-commands/assist/0", "event-commands/assist/0"]);
    expect(f.ledger.size).toBe(1);
  });

  it("retains validated output when final proposal persistence fails without repeating assist work", async () => {
    const f = await fixture();
    const original = f.host.putJson;
    let fail = true;
    f.host.putJson = async value => {
      if (fail && value && typeof value === "object" && !Array.isArray(value) && jsonObject(value).kind === "event-commands-proposal") {
        fail = false; throw new Error("proposal disk failure");
      }
      return original(value);
    };
    await expect(executeEventCommandsJob(f.input, f.host)).rejects.toThrow("proposal disk failure");
    expect((await f.checkpoint())?.state.responseRefs).toHaveLength(1);
    const result = await executeEventCommandsJob(f.input, f.host);
    expect(result.payload.completion).toBe("complete");
    expect(f.operations).toHaveLength(1);
  });

  it("preserves three-attempt validation failure and paid outputs without a false completed proposal", async () => {
    const f = await fixture([]);
    f.respond(async () => wire("[]"));
    await expect(executeEventCommandsJob(f.input, f.host)).rejects.toThrow(/3/);
    expect((await f.checkpoint())?.state.responseRefs).toHaveLength(3);
    expect((await f.checkpoint())?.state.proposalRef).toBeUndefined();
    await expect(executeEventCommandsJob(f.input, f.host)).rejects.toThrow(/3/);
    expect(f.operations).toHaveLength(3);
  });

  it("allows clearing a nonempty page", async () => {
    const f = await fixture();
    f.respond(async () => wire("[]"));
    const result = await executeEventCommandsJob(f.input, f.host);
    expect(jsonObject(await f.host.readJson(result.artifacts[0])).finalCommands).toEqual([]);
    expect(result.payload.attempts).toBe(1);
  });

  it("rejects automatic application mode before any paid operation", async () => {
    const f = await fixture();
    await expect(executeEventCommandsJob({ ...f.input, mode: "auto" }, f.host)).rejects.toThrow(/review/);
    expect(f.operations).toEqual([]);
  });

  it("rejects malformed payload, target, project and checkpoint before paid work", async () => {
    const f = await fixture();
    for (const payload of [
      { ...f.input.payload, config: { ...config, authMode: "apiKey" } },
      { ...f.input.payload, config: { ...config, apiKey: "secret" } },
      { ...f.input.payload, baseCommands: [{ kind: "text", body: 42 }] },
      { ...f.input.payload, selection: [0, -2] },
      { ...f.input.payload, preferenceMemorySection: undefined },
    ]) await expect(executeEventCommandsJob({ ...f.input, payload: jsonObject(jsonValue(payload)) }, f.host)).rejects.toThrow();
    await expect(executeEventCommandsJob({ ...f.input, target: { ...f.input.target, pageId: "missing" } }, f.host)).rejects.toThrow(/page not found/);
    const badProject = await f.host.putJson({ version: 4, maps: {}, database: {} });
    await expect(executeEventCommandsJob({ ...f.input, projectSnapshot: badProject }, f.host)).rejects.toThrow();
    await f.host.saveCheckpoint({ stageKey: "event-commands/start", state: { version: 1, responseRefs: [{ sha256: "bad" }] }, artifacts: [] });
    await expect(executeEventCommandsJob(f.input, f.host)).rejects.toThrow();
    expect(f.operations).toEqual([]);
  });

  it("rejects a foreign checkpoint and altered proposal without provider work", async () => {
    const f = await fixture();
    const result = await executeEventCommandsJob(f.input, f.host);
    const count = f.operations.length;
    await expect(executeEventCommandsJob({ ...f.input, payload: { ...f.input.payload, prompt: "different input" } }, f.host)).rejects.toThrow(/another input/);
    const saved = await f.checkpoint();
    if (!saved) throw new Error("Expected checkpoint");
    const proposal = jsonObject(await f.host.readJson(result.artifacts[0]));
    const corruptRef = await f.host.putJson({ ...proposal, finalCommands: [] });
    await f.host.saveCheckpoint({ stageKey: saved.stageKey, state: { ...saved.state, proposalRef: jsonObject(jsonValue(corruptRef)) }, artifacts: [...saved.artifacts, corruptRef] });
    await expect(executeEventCommandsJob(f.input, f.host)).rejects.toThrow(/Invalid completed event commands proposal/);
    expect(f.operations).toHaveLength(count);
  });

  it("has no transitive store, panel, editor boot or PWA runtime edge", () => {
    const graph = runtimeGraph("src/ai/jobs/executors/eventCommandsJob.ts");
    expect(graph).toContain("src/ai/eventCommandAssist.ts");
    expect(graph).toContain("src/editor/eventCommandFactoryCore.ts");
    expect(graph.filter(path => /src\/main\.ts$|project\/store\.ts$|editor\/panels\/|editorState\.ts$|mapEditHistory\.ts$|applyChangesetToStore\.ts$|pwa/i.test(path))).toEqual([]);
  });
});
