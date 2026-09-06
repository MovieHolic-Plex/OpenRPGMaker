import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { MessageChannel } from "node:worker_threads";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openAiJobsRepository } from "../scripts/lib/aiJobs/repository.mjs";
import { analyzeCapturedTilesetReview } from "@/editor/tilesetAiQuestionAnalysis";
import { runtimeGraph } from "./aiJobWorkerIsolation.test";
import { executeTilesetJob, TILESET_JOB_OPERATIONS } from "@/ai/jobs/executors/tilesetJob";
import { parseTilesetReview, tilesetBlobRef } from "@/ai/jobs/tilesetPayload";
import { jsonObject, jsonValue, parseProject } from "@/ai/jobs/checkpointState";
import { createBlankProject } from "@/project/defaults";
import { assert, requireArray, requireRecord, requireString } from "@/project/io/guards";
import { renderTilesetAtlasSnapshotImage } from "@/editor/tilesetAiSnapshotImage";
import { parseAiMappingResult } from "@/editor/tilesetAiPure/tilesetAiProposalParsing";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { declaredIntent } from "./intentFixture";
import type { AiJobHost } from "../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobCheckpoint, AiJobInput, JsonObject, JsonValue } from "@/ai/jobs/contracts";

const config = { authMode: "chatgpt", providerId: "openai-codex", model: "gpt-5.4", liteModel: "gpt-5.4-mini", maxToolCalls: 12, maxTokens: 8192, agentMode: "chat" };
const context = { budgetChars: 18000, preferenceMemorySection: "captured preference" };
const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=", "base64"));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { resolve, promise };
}
function wire(text: string, finish = "stop"): JsonObject {
  return { choices: [{ message: { role: "assistant", content: text }, finish_reason: finish }] };
}
function tool(name: string, args: JsonObject): JsonObject {
  return { choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: `call-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: "tool_calls" }] };
}
function knowledge(proposals: JsonValue[] = [{ template: "desk", tileIds: [4, 5], name: "Desk", confidence: 0.7 }]): JsonObject {
  return wire(JSON.stringify({ summary: "Knowledge", proposals }));
}
async function acknowledgeStorageWrite(): Promise<void> {
  const { port1, port2 } = new MessageChannel();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("Storage acknowledgement not received")), 10000);
      port1.once("message", () => resolve());
      port1.once("messageerror", reject);
      port2.postMessage(null);
    });
  } finally { clearTimeout(timeout); port1.close(); port2.close(); }
}
async function fixture(payload: JsonObject = { operation: "knowledge-analysis", feedback: [] }) {
  const seed = createBlankProject();
  const tileset = Object.values(seed.tilesets)[0]!;
  tileset.tileGroups = [{ id: "group-1", name: "Group", tileIds: [4, 5], defaultLayer: "lower", role: "prop", description: "", placementRules: "", origin: "ai", source: "ai" }];
  tileset.structureKits = [{ id: "kit-1", kind: "section", name: "Kit", width: 2, height: 1, rows: [{ tiles: [4, 5] }], learnedFrom: "db-authored" }];
  const project = parseProject(jsonValue(seed));
  const blobs = new Map<string, Uint8Array>();
  let checkpoint: AiJobCheckpoint | null = null;
  const ledger = new Map<string, { request: JsonValue; response: JsonValue }>();
  const requests: { key: string; request: JsonValue }[] = [];
  const responses: JsonValue[] = [];
  const host: AiJobHost = {
    jobId: "tileset-job", attemptId: "attempt-1", dependencies: [],
    async putBlob(bytes, mediaType) {
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      blobs.set(sha256, bytes.slice());
      // Actual host persistence is acknowledged across an asynchronous boundary.
      // Preserve that boundary instead of starving worker/reporting IPC with microtasks.
      await acknowledgeStorageWrite();
      return { sha256, byteLength: bytes.length, mediaType };
    },
    async readBlob(ref) { const bytes = blobs.get(ref.sha256); if (!bytes) throw new Error("Missing artifact"); return bytes.slice(); },
    async putJson(value) { return host.putBlob(new TextEncoder().encode(JSON.stringify(value)), "application/json"); },
    async readJson(ref) { return JSON.parse(new TextDecoder().decode(await host.readBlob(ref))); },
    async loadCheckpoint() { return structuredClone(checkpoint); },
    async saveCheckpoint(value) {
      checkpoint = { ...structuredClone(value), version: 1, jobId: host.jobId, attemptId: host.attemptId, inputSha256: "a".repeat(64) };
      return host.putJson(jsonValue(checkpoint));
    },
    async providerOperation(operation) {
      const prior = ledger.get(operation.key);
      if (prior) {
        const actual = JSON.stringify(operation.request), expected = JSON.stringify(prior.request);
        if (actual !== expected) {
          const index = [...actual].findIndex((c, i) => c !== expected[i]);
          throw new Error(`Replay request mismatch ${operation.key} at ${index}: actual=${actual.slice(Math.max(0, index - 100), index + 300)} expected=${expected.slice(Math.max(0, index - 100), index + 300)}`);
        }
        return structuredClone(prior.response);
      }
      requests.push(structuredClone(operation));
      const response = responses.shift(); if (!response) throw new Error("Unexpected provider dispatch");
      ledger.set(operation.key, { request: structuredClone(operation.request), response: structuredClone(response) });
      return response;
    },
  };
  const image = await host.putBlob(png, "image/png"), projectSnapshot = await host.putJson(jsonValue(project));
  const input: AiJobInput & { family: "tileset" } = { version: 1, family: "tileset", project: { backend: "local", projectId: "captured-project" }, projectSnapshot, artwork: [image],
    target: { tilesetId: tileset.id }, mode: "review", dependsOn: [], payload: { config, context, tilesetId: tileset.id, atlas: jsonValue(image), ...payload } };
  return { host, input, project, tileset: project.tilesets[tileset.id]!, image, requests, responses, checkpoint: () => checkpoint, ledger };
}
type DiskOperation = "knowledge-analysis" | "proposal-draft" | "question-followup" | "structure-kit-metadata";
const diskOperations: readonly DiskOperation[] = ["knowledge-analysis", "proposal-draft", "question-followup", "structure-kit-metadata"];

/** Real canonical blob writes, checkpoint transactions, and repository reopen; only paid wire is deferred to the host fixture. */
async function withDiskFixture(operation: DiskOperation, run: (f: {
  input: AiJobInput & { family: "tileset" };
  host: AiJobHost;
  provider: ReturnType<typeof vi.fn<AiJobHost["providerOperation"]>>;
  reopen: () => Promise<void>;
}) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "rpg-tileset-canonical-"));
  let repository: Awaited<ReturnType<typeof openAiJobsRepository>> | undefined;
  try {
    repository = await openAiJobsRepository({ directory });
    const current = () => { assert(repository !== undefined, "Repository not open"); return repository; };
    const f = await fixture();
    const image = await current().putBlob(png, "image/png");
    const projectSnapshot = await current().putJson(jsonValue(f.project));
    const project = parseProject(await current().readJson(projectSnapshot));
    let payload: JsonObject = { config, context, tilesetId: f.tileset.id, operation, atlas: jsonValue(image), feedback: [] };
    if (operation === "proposal-draft") {
      payload = { ...payload, selectedTiles: [4, 5], setupChoice: { intent: "objectDetail", repeatability: "noRepeat", scope: "rules", structure: "single" },
        snapshot: { image: jsonValue(image), summary: "captured map" }, lockedAnswer: "" };
      f.responses.push(wire(JSON.stringify({ tiles: [{ tile: 4, label: "First" }, { tile: 5, label: "Second" }] })));
    } else if (operation === "structure-kit-metadata") {
      payload = { ...payload, kitId: "kit-1" };
      f.responses.push(wire(JSON.stringify({ description: "Structure", tags: ["first", "second"], placement: [{ zone: "againstWall", facing: "north", strength: "hard" }] })));
    } else {
      if (operation === "question-followup") {
        // Captured previous foreground review, derived from the same canonical project baseline.
        const { review } = await analyzeCapturedTilesetReview(project.tilesets[f.tileset.id]!, {
          requestId: "captured-review", feedback: [], imageDataUrl: "", request: async () => JSON.stringify({ proposals: [{ template: "desk", tileIds: [4, 5], name: "Desk", confidence: 0.7 }] }),
        });
        payload = { ...payload, review: jsonValue(review), proposalId: review.proposals[0]!.id, answer: "upper", turns: [] };
      }
      f.responses.push(knowledge());
    }
    const input: AiJobInput & { family: "tileset" } = { ...f.input, projectSnapshot, artwork: [image], payload };
    const { job } = await current().admit({ idempotencyKey: "canonical-tileset", input });
    let sequence = 0, attemptId = "";
    const startAttempt = async () => {
      attemptId = `disk-attempt-${++sequence}`;
      await current().transaction(draft => {
        const record = draft.jobs.find(j => j.id === job.id); assert(record !== undefined, "Missing job");
        record.generation = "running"; record.activeAttemptId = attemptId;
        draft.attempts.push({ id: attemptId, jobId: job.id, stage: "generation", status: "running", startedAt: job.createdAt, finishedAt: null, error: null });
      });
    };
    await startAttempt();
    const provider = vi.fn(f.host.providerOperation);
    const host: AiJobHost = {
      jobId: job.id, get attemptId() { return attemptId; }, dependencies: [],
      putBlob: (bytes, mediaType) => current().putBlob(bytes, mediaType), readBlob: ref => current().readBlob(ref),
      putJson: value => current().putJson(value), readJson: ref => current().readJson(ref), providerOperation: provider,
      async loadCheckpoint() {
        const ref = current().snapshot().jobs.find(j => j.id === job.id)?.checkpointRef;
        if (!ref) return null;
        const c = requireRecord("disk checkpoint", await current().readJson(ref));
        assert(c.version === 1, "Unsupported checkpoint");
        return { version: 1, jobId: requireString("jobId", c.jobId), attemptId: requireString("attemptId", c.attemptId), inputSha256: requireString("inputSha256", c.inputSha256),
          stageKey: requireString("stageKey", c.stageKey), state: jsonObject(c.state), artifacts: requireArray("artifacts", c.artifacts).map(value => {
            const ref = requireRecord("artifact", value); return tilesetBlobRef(ref, ref.mediaType !== "application/json");
          }) };
      },
      async saveCheckpoint(checkpoint) {
        const ref = await current().putJson(jsonValue({ ...checkpoint, version: 1, jobId: job.id, attemptId, inputSha256: job.inputRef.sha256 }));
        await current().transaction(draft => {
          const record = draft.jobs.find(j => j.id === job.id); assert(record !== undefined, "Missing job"); record.checkpointRef = ref;
        });
        return ref;
      },
    };
    const storedInput = requireRecord("disk input", await current().readJson(job.inputRef));
    await run({ input: { ...input, payload: jsonObject(storedInput.payload) }, host, provider, reopen: async () => {
      await current().close(); repository = await openAiJobsRepository({ directory }); await startAttempt();
    } });
  } finally {
    try { await repository?.close(); } finally { await rm(directory, { recursive: true, force: true }); }
  }
}

beforeEach(() => resetIntentDeclarationCache());

describe("tileset worker isolation", () => {
  it.each(["src/editor/tilesetAiNativeAnalysis.ts", "src/editor/tilesetAiSnapshotImage.ts", "src/ai/jobs/executors/tilesetJob.ts"])("%s has no editor boot dependencies", entry => {
    const graph = runtimeGraph(entry);
    expect(graph.filter(p => /project\/store\.ts$|editor\/panels\/|editorState\.ts$|applyChangesetToStore\.ts$|pwa/i.test(p))).toEqual([]);
  });
  it("has an exhaustive operation discriminator", () => {
    expect(TILESET_JOB_OPERATIONS).toEqual(["cluster-edit", "range-classify", "unclassified-analysis", "knowledge-analysis", "proposal-draft", "question-followup", "structure-kit-metadata"]);
  });
});

describe("captured tileset analysis jobs", () => {
  it("holds the real knowledge analyzer at the durable vision boundary, then returns immutable review choices", async () => {
    const f = await fixture(), entered = deferred<void>(), release = deferred<JsonValue>();
    const before = jsonValue(f.project);
    const provider = f.host.providerOperation;
    f.responses.push(knowledge());
    f.host.providerOperation = async op => { entered.resolve(); await release.promise; return provider(op); };
    const running = executeTilesetJob(f.input, f.host);
    await entered.promise;
    expect(f.checkpoint()?.stageKey).toBe("tileset/knowledge-analysis/request");
    expect(f.checkpoint()?.artifacts).toContainEqual(f.image);
    release.resolve(null);
    const result = await running;
    expect(result.generatedSnapshot).toBeNull();
    expect(result.payload).toMatchObject({ kind: "knowledge-analysis", completion: "complete", persistence: "not-applicable", review: { proposals: [{ id: "ai-review-desk-4-2-1", status: "pending" }] } });
    const request = requireRecord("provider", f.requests[0]!.request);
    expect(request.provider).toBe("openai-codex");
    const body = requireRecord("body", request.body), messages = requireArray("messages", body.messages);
    const content = requireArray("content", requireRecord("message", messages[1]).content);
    expect(content[1]).toMatchObject({ type: "image_url", image_url: { url: expect.stringMatching(/^data:image\/png;base64,/) } });
    expect(JSON.parse(String(requireRecord("prompt", content[0]).text))).toMatchObject({ task: "analyze_tileset_knowledge", outputSchemaVersion: 1 });
    expect(f.requests.map(r => r.key)).toEqual(["tileset/knowledge-analysis/provider/0"]);
    expect(jsonValue(f.project)).toEqual(before);
    const replay = await executeTilesetJob(f.input, { ...f.host, attemptId: "attempt-2" });
    expect(replay.payload).toEqual(result.payload); expect(replay.artifacts).toEqual(result.artifacts);
    expect(f.requests).toHaveLength(1);
  }, 30000);

  it("runs proposal orchestration with locked edits, captured temp-map image and user answers", async () => {
    const f = await fixture({ operation: "proposal-draft", selectedTiles: [4, 5], setupChoice: { intent: "objectDetail", repeatability: "noRepeat", scope: "rules", structure: "single" },
      lockedAnswer: JSON.stringify({ tiles: [{ tile: 4, label: "Human", userLocked: true }], userQuestionAnswers: [{ question: "Layer?", answer: "upper" }] }) });
    const input = { ...f.input, payload: { ...f.input.payload, snapshot: { image: jsonValue(f.image), summary: "captured temp map" } } };
    f.responses.push(wire('```json\n'+JSON.stringify({ tiles: [{ tile: 4, label: "AI" }, { tile: 5, label: "Other" }], minimumQuestions: ["Use upper?"] })+'\n```'));
    const result = await executeTilesetJob(input, f.host);
    expect(result.payload).toMatchObject({ kind: "proposal-draft", mapping: { tiles: [{ tile: 4, label: "Human", userLocked: true }, { tile: 5 }], userQuestionAnswers: [{ answer: "upper" }], minimumQuestions: ["Use upper?"] } });
    expect(result.generatedSnapshot).toBeNull();
    expect(f.requests).toHaveLength(1);
  });

  it("runs question follow-up over captured review, preserving accepted/skipped choices and IDs", async () => {
    const f = await fixture();
    f.responses.push(knowledge([{ template: "desk", tileIds: [4, 5], name: "Desk", confidence: 0.7 }, { template: "desk", tileIds: [6, 7], name: "Other", confidence: 0.9 }]));
    const initial = await executeTilesetJob(f.input, f.host);
    const review = parseTilesetReview(initial.payload.review);
    const g = await fixture({ operation: "question-followup", review: jsonValue({ ...review, proposals: review.proposals.map((p, i) => i === 1 ? { ...p, status: "skipped" } : p) }), proposalId: review.proposals[0]!.id, answer: "Use upper", turns: [] });
    g.responses.push(knowledge([{ template: "desk", tileIds: [4, 5], name: "New desk", confidence: 0.95 }]));
    const result = await executeTilesetJob(g.input, g.host);
    expect(result.payload).toMatchObject({ kind: "question-followup", review: { proposals: [
      { id: review.proposals[0]!.id, status: "accepted", feedback: "Use upper" }, { id: review.proposals[1]!.id, status: "skipped" },
    ] }, turns: [{ role: "assistant", tone: "question" }, { role: "user", tone: "answer" }, { role: "assistant", tone: "confirmation" }] });
    const request = requireRecord("request", g.requests[0]!.request), body = requireRecord("body", request.body);
    const messages = requireArray("messages", body.messages), content = requireArray("content", requireRecord("message", messages[1]).content);
    expect(JSON.parse(String(requireRecord("prompt", content[0]).text)).humanFeedback).toEqual(["Desk: Use upper"]);
  });

  it("binds a queued question to its predecessor while permitting captured review choices", async () => {
    const f = await fixture(); f.responses.push(knowledge());
    const source = await executeTilesetJob(f.input, f.host);
    const review = parseTilesetReview(source.payload.review);
    const g = await fixture({ operation: "question-followup", sourceJobId: source.jobId, review: jsonValue(review), proposalId: review.proposals[0]!.id, answer: "upper", turns: [] });
    const projectSnapshot = await g.host.putJson(await f.host.readJson(source.baseSnapshot));
    const input = { ...g.input, projectSnapshot, dependsOn: [source.jobId] };
    const host = { ...g.host, jobId: "followup-job", dependencies: [source] };
    await expect(executeTilesetJob(input, { ...host, dependencies: [{ ...source, project: { ...source.project, projectId: "other" } }] })).rejects.toThrow(/project mismatch/);
    const altered = { ...review, proposals: review.proposals.map(p => ({ ...p, tileIds: [8, 9] })) };
    await expect(executeTilesetJob({ ...input, payload: { ...input.payload, review: jsonValue(altered) } }, host)).rejects.toThrow(/does not match predecessor/);
    expect(g.requests).toHaveLength(0);
    g.responses.push(knowledge());
    const result = await executeTilesetJob(input, host);
    expect(result.jobId).toBe("followup-job"); expect(result.payload.kind).toBe("question-followup");
    expect(g.requests).toHaveLength(1);
  });

  it("preserves deterministic structure condition IDs across a failed completion checkpoint", async () => {
    const f = await fixture({ operation: "structure-kit-metadata", kitId: "kit-1" });
    f.responses.push(wire(JSON.stringify({ description: "Structure", placementRules: "Against north wall", role: "prop", placement: [{ zone: "againstWall", facing: "north", strength: "hard" }] })));
    const save = f.host.saveCheckpoint;
    let failed = false;
    f.host.saveCheckpoint = async c => { if (c.stageKey.endsWith("/completed") && !failed) { failed = true; throw new Error("checkpoint interrupted"); } return save(c); };
    await expect(executeTilesetJob(f.input, f.host)).rejects.toThrow("checkpoint interrupted");
    expect(f.checkpoint()?.stageKey).toBe("tileset/structure-kit-metadata/response");
    const result = await executeTilesetJob(f.input, { ...f.host, attemptId: "attempt-2" });
    expect(result.payload).toMatchObject({ metadata: { origin: "ai", placement: [{ id: "pc_tileset-job-kit-1-0", zone: "againstWall", facing: "north" }] } });
    expect(f.requests).toHaveLength(1);
    expect(f.tileset.structureKits![0]!.ai).toBeUndefined();
    const replay = await executeTilesetJob(f.input, f.host); expect(replay.payload).toEqual(result.payload);
  });

  it.each(["not JSON", "{}", '{"tiles":"malformed"}', '{"previewMaps":[{"width":2,"height":2,"lowerTiles":[1]}],"tiles":[{"tile":4}]}'])("retains invalid mapping output without false success or repeated spend: %s", async raw => {
    const f = await fixture({ operation: "proposal-draft", selectedTiles: [4], setupChoice: { intent: "unsure", repeatability: "auto", scope: "rules", structure: "single" }, lockedAnswer: "" });
    const input = { ...f.input, payload: { ...f.input.payload, snapshot: { image: jsonValue(f.image), summary: "snapshot" } } };
    f.responses.push(wire(raw));
    await expect(executeTilesetJob(input, f.host)).rejects.toThrow(/TILESET_MAPPING_INVALID/);
    expect(f.checkpoint()?.state.rawRef).toBeDefined();
    await expect(executeTilesetJob(input, f.host)).rejects.toThrow(/TILESET_MAPPING_INVALID/);
    expect(f.requests).toHaveLength(1);
  });

  it("never upgrades a length-truncated response to success on retry", async () => {
    const f = await fixture({ operation: "structure-kit-metadata", kitId: "kit-1" });
    f.responses.push(wire('{"description":"Valid-looking partial"}', "length"));
    await expect(executeTilesetJob(f.input, f.host)).rejects.toThrow(/TILESET_INCOMPLETE/);
    await expect(executeTilesetJob(f.input, f.host)).rejects.toThrow(/TILESET_INCOMPLETE/);
    expect(f.requests).toHaveLength(1);
  });

  it.each([{ config: { ...config, authMode: "apiKey" } }, { config: { ...config, apiKey: "not-allowed" } }, { tilesetId: "missing" }, { operation: "unknown" }])("rejects malformed captured input before spend: %j", async patch => {
    const f = await fixture();
    await expect(executeTilesetJob({ ...f.input, payload: { ...f.input.payload, ...patch } }, f.host)).rejects.toThrow();
    expect(f.requests).toHaveLength(0);
  });

  it("rejects malformed projects, stale reviews, checkpoints and refs before spend", async () => {
    const f = await fixture();
    const projectSnapshot = await f.host.putJson({ maps: {}, tilesets: {} });
    await expect(executeTilesetJob({ ...f.input, projectSnapshot }, f.host)).rejects.toThrow();
    await f.host.saveCheckpoint({ stageKey: "tileset/knowledge-analysis/response", state: { version: 1, operation: "proposal-draft", rawRef: {} }, artifacts: [] });
    await expect(executeTilesetJob(f.input, f.host)).rejects.toThrow(/operation mismatch/);
    await f.host.saveCheckpoint({ stageKey: "tileset/knowledge-analysis/response", state: { version: 1, operation: "knowledge-analysis", rawRef: { sha256: "bad", byteLength: 1, mediaType: "application/json" } }, artifacts: [] });
    await expect(executeTilesetJob(f.input, f.host)).rejects.toThrow(/artifact hash/);
    expect(f.requests).toHaveLength(0);
    const g = await fixture({ operation: "knowledge-analysis", feedback: [], review: { status: "ready", tilesetId: f.tileset.id, fingerprint: "stale", summary: "", warnings: [], proposals: [] } });
    await expect(executeTilesetJob(g.input, g.host)).rejects.toThrow(/stale/);
    expect(g.requests).toHaveLength(0);
  });

  it("does not retry or change providers after an uncertain provider failure", async () => {
    const f = await fixture();
    const provider = vi.fn(async () => { throw new Error("outcome unknown"); }); f.host.providerOperation = provider;
    await expect(executeTilesetJob(f.input, f.host)).rejects.toThrow("outcome unknown");
    expect(provider).toHaveBeenCalledTimes(1);
    expect(f.checkpoint()?.state.proposalRef).toBeUndefined();
  });
});

describe("real isolated cluster session operations", () => {
  it.each([
    { operation: "cluster-edit", groupId: "group-1" },
    { operation: "range-classify", rect: { x: 4, y: 0, w: 2, h: 1 }, tileIds: [4, 5] },
    { operation: "unclassified-analysis", sampleTiles: [4, 5], total: 2 },
  ])("executes $operation through actual tools, with retry-stable IDs and no application", async operation => {
    const f = await fixture(jsonObject(jsonValue(operation)));
    const before = jsonValue(f.project);
    f.responses.push(wire(JSON.stringify(declaredIntent({ mode: "modify", tools: ["upsert_tile_group"] }))),
      tool("upsert_tile_group", { tilesetId: f.tileset.id, name: "Private generated group", tileIds: [4, 5], role: "prop", defaultLayer: "lower" }), wire("Review proposal"));
    const provider = f.host.providerOperation; let interrupt = true;
    f.host.providerOperation = async op => {
      const response = await provider(op);
      if (op.key.endsWith("/2") && interrupt) { interrupt = false; throw new Error("response boundary interrupted"); }
      return response;
    };
    await expect(executeTilesetJob(f.input, f.host)).rejects.toThrow("response boundary interrupted");
    const partial = requireRecord("session", f.checkpoint()?.state.session);
    expect(requireArray("toolRefs", partial.toolRefs).length).toBeGreaterThan(0);
    const toolRefs = jsonValue(partial.toolRefs);
    resetIntentDeclarationCache();
    const result = await executeTilesetJob(f.input, { ...f.host, attemptId: "attempt-2" });
    expect(result.payload).toMatchObject({ kind: "cluster", operation: operation.operation, stoppedReason: "final", completion: "complete", persistence: "not-applicable" });
    expect(result.payload.appliedCalls ?? []).toEqual([]);
    expect(f.requests).toHaveLength(3);
    expect(f.requests.every(r => r.key.startsWith(`tileset/${operation.operation}/provider/`))).toBe(true);
    expect(result.generatedSnapshot).not.toBeNull();
    const generated = parseProject(await f.host.readJson(result.generatedSnapshot!));
    expect(generated.tilesets[f.tileset.id]!.tileGroups!.some(g => g.name === "Private generated group")).toBe(true);
    expect(jsonValue(f.project)).toEqual(before);
    expect(requireRecord("session", f.checkpoint()?.state.session).toolRefs).toEqual(toolRefs);
    const replay = await executeTilesetJob(f.input, f.host);
    expect(replay.generatedSnapshot).toEqual(result.generatedSnapshot);
    expect(replay.payload).toEqual(result.payload);
    expect(replay.artifacts).toEqual(result.artifacts);
    expect(f.requests).toHaveLength(3);
  }, 30000);
});

describe("cluster vision stages", () => {
  it("executes range suggestion and actual sample rendering, retains image refs, and replays without a renderer", async () => {
    const f = await fixture({ operation: "range-classify", rect: { x: 4, y: 0, w: 2, h: 1 }, tileIds: [4, 5] });
    const imageAssigned = deferred<{ onload: (() => void) | null }>();
    class FixtureImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { imageAssigned.resolve(this); }
    }
    const drawImage = vi.fn();
    const renderedDataUrl = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
    vi.stubGlobal("Image", FixtureImage);
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage, fillRect: vi.fn() }), toDataURL: () => renderedDataUrl }) });
    f.responses.push(wire(JSON.stringify(declaredIntent({ mode: "modify", tools: ["suggest_group_from_range", "render_group_sample"] }))),
      tool("suggest_group_from_range", { tilesetId: f.tileset.id, rect: { x: 4, y: 0, w: 2, h: 1 }, tileIds: [4, 5] }),
      tool("render_group_sample", { tilesetId: f.tileset.id, groupId: "group-1" }), wire("Review images"));
    const provider = f.host.providerOperation; let interrupt = true;
    f.host.providerOperation = async op => { const result = await provider(op); if (op.key.endsWith("/3") && interrupt) { interrupt = false; throw new Error("vision response interrupted"); } return result; };
    try {
      const execution = executeTilesetJob(f.input, f.host);
      const failed = expect(execution).rejects.toThrow("vision response interrupted");
      const image = await imageAssigned.promise;
      expect(image.onload).not.toBeNull(); image.onload!();
      await failed;
      expect(drawImage).toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
    const renders = requireArray("renders", f.checkpoint()?.state.renders);
    expect(renders).toHaveLength(1);
    expect(requireArray("images", requireRecord("render", renders[0]).images).length).toBeGreaterThan(0);
    resetIntentDeclarationCache();
    const count = drawImage.mock.calls.length;
    const result = await executeTilesetJob(f.input, f.host);
    expect(result.payload.previews).toMatchObject([{ status: "ready" }]);
    expect(drawImage.mock.calls).toHaveLength(count); expect(f.requests).toHaveLength(4);
    expect(result.artifacts).toContainEqual(f.image);
  }, 30000);

  it("retains budget-limited cluster output as partial, not success", async () => {
    const f = await fixture({ operation: "cluster-edit", groupId: "group-1", config: { ...config, maxTokens: 1 } });
    f.responses.push(wire(JSON.stringify(declaredIntent({ mode: "modify", tools: ["upsert_tile_group"] }))),
      tool("upsert_tile_group", { tilesetId: f.tileset.id, name: "Partial", tileIds: [4, 5], role: "prop", defaultLayer: "lower" }));
    await expect(executeTilesetJob(f.input, f.host)).rejects.toThrow(/TILESET_INCOMPLETE/);
    const session = requireRecord("session", f.checkpoint()?.state.session);
    expect(session.partial).toBeDefined(); expect(session.completed).toBeUndefined();
  }, 30000);
});

describe("render-only snapshots and parser boundaries", () => {
  it("draws the actual atlas helper over a supplied image without reading store", async () => {
    const f = await fixture(), drawImage = vi.fn(), toDataURL = vi.fn(() => "data:image/png;base64,dA==");
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage, fillRect: vi.fn(), imageSmoothingEnabled: true, fillStyle: "" }), toDataURL };
    vi.stubGlobal("document", { createElement: () => canvas });
    try {
      const image = {} as HTMLImageElement;
      const tileset = { ...f.tileset, count: 2, tilesPerRow: 2, tileGroups: [] };
      await expect(renderTilesetAtlasSnapshotImage(tileset, image)).resolves.toBe("data:image/png;base64,dA==");
      expect(drawImage).toHaveBeenCalledTimes(2); expect(drawImage.mock.calls.every(c => c[0] === image)).toBe(true);
      expect(canvas.width).toBe(tileset.tileSize * 4);
    } finally { vi.unstubAllGlobals(); }
  });
  it("validates mapping machine fields rather than trusting a parsed object", () => {
    expect(parseAiMappingResult('{"tiles":[null]}')).toBeNull();
    expect(parseAiMappingResult('{"groups":[{"patternGrammar":{"kind":"unknown"}}]}')).toBeNull();
    expect(parseAiMappingResult('{"tiles":[{"tile":4,"label":"ok"}]}')).toMatchObject({ tiles: [{ tile: 4 }] });
  });
});

describe("canonical filesystem proposal retry", () => {
  it.each(diskOperations)("completed %s retries after repository reopen with identical immutable output", async operation => {
    await withDiskFixture(operation, async f => {
      const first = await executeTilesetJob(f.input, f.host);
      const ref = tilesetBlobRef(first.payload.proposalRef);
      const { proposalRef: _ref, ...output } = first.payload;
      const stored = await f.host.readJson(ref);
      expect(stored).toEqual(output);
      // Prove this host exercises canonical disk ordering, unlike the original in-memory host.
      expect(JSON.stringify(stored)).not.toBe(JSON.stringify(output));
      await f.reopen();
      const replay = await executeTilesetJob(f.input, f.host);
      expect(replay.payload).toEqual(first.payload);
      expect(replay.artifacts).toEqual(first.artifacts);
      expect(replay.generatedSnapshot).toBeNull();
      expect(f.provider).toHaveBeenCalledTimes(1);

      // Retain exact semantic checks: changed fields, extra fields, missing fields,
      // and array order are NOT equivalent to the proposal regenerated from raw text.
      const saved = jsonObject(stored);
      const { persistence: _persistence, ...missingField } = saved;
      let reordered: JsonObject;
      if (operation === "proposal-draft") {
        const mapping = jsonObject(saved.mapping); reordered = { ...saved, mapping: { ...mapping, tiles: [...requireArray("tiles", mapping.tiles)].reverse().map(jsonValue) } };
      } else if (operation === "structure-kit-metadata") {
        const metadata = jsonObject(saved.metadata); reordered = { ...saved, metadata: { ...metadata, tags: [...requireArray("tags", metadata.tags)].reverse().map(jsonValue) } };
      } else if (operation === "question-followup") reordered = { ...saved, turns: [...requireArray("turns", saved.turns)].reverse().map(jsonValue) };
      else {
        const review = jsonObject(saved.review), proposals = requireArray("proposals", review.proposals).map(jsonObject), proposal = proposals[0]!;
        reordered = { ...saved, review: { ...review, proposals: [{ ...proposal, quickReplies: [...requireArray("quickReplies", proposal.quickReplies)].reverse().map(jsonValue) }, ...proposals.slice(1)] } };
      }
      const checkpoint = await f.host.loadCheckpoint(); assert(checkpoint !== null, "Completed checkpoint missing");
      for (const altered of [{ ...saved, tilesetId: "different" }, { ...saved, unexpected: null }, missingField, reordered]) {
        const alteredRef = await f.host.putJson(altered);
        await f.host.saveCheckpoint({ ...checkpoint, state: { ...checkpoint.state, proposalRef: jsonValue(alteredRef) }, artifacts: [...checkpoint.artifacts, alteredRef] });
        await expect(executeTilesetJob(f.input, f.host)).rejects.toThrow("Checkpoint proposal does not match its raw response");
      }
      expect(f.provider).toHaveBeenCalledTimes(1);
    });
  }, 30000);

  it.each(diskOperations)("%s resumes a failed proposal checkpoint from one paid raw response", async operation => {
    await withDiskFixture(operation, async f => {
      const save = f.host.saveCheckpoint;
      let attemptedProposal: JsonValue | undefined;
      f.host.saveCheckpoint = async checkpoint => {
        if (checkpoint.stageKey.endsWith("/completed")) {
          attemptedProposal = checkpoint.state.proposalRef;
          throw new Error("proposal checkpoint interrupted");
        }
        return save(checkpoint);
      };
      await expect(executeTilesetJob(f.input, f.host)).rejects.toThrow("proposal checkpoint interrupted");
      const responseCheckpoint = await f.host.loadCheckpoint();
      expect(responseCheckpoint?.stageKey).toBe(`tileset/${operation}/response`);
      expect(responseCheckpoint?.state.rawRef).toBeDefined();
      expect(responseCheckpoint?.state.proposalRef).toBeUndefined();
      f.host.saveCheckpoint = save;
      await f.reopen();
      const resumed = await executeTilesetJob(f.input, f.host);
      expect(resumed.payload.proposalRef).toEqual(attemptedProposal);
      expect(f.provider).toHaveBeenCalledTimes(1);
      await f.reopen();
      const replay = await executeTilesetJob(f.input, f.host);
      expect(replay.payload).toEqual(resumed.payload); expect(replay.artifacts).toEqual(resumed.artifacts);
      expect(f.provider).toHaveBeenCalledTimes(1);
    });
  }, 30000);
});
