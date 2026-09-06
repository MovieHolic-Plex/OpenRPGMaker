import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { parseGeneratedRecord, type AiDatabaseKind } from "@/ai/databaseGenerationCore";
import { executeDatabaseJob } from "@/ai/jobs/executors/databaseJob";
import { jsonObject, jsonValue, parseProject } from "@/ai/jobs/checkpointState";
import { createBlankProject } from "@/project/defaults";
import type { AiJobHost } from "../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobCheckpoint, AiJobInput, BlobRef, JsonValue } from "@/ai/jobs/contracts";
import { requireRecord } from "@/project/io/guards";
import { runtimeGraph } from "./aiJobWorkerIsolation.test";

const config = { authMode: "chatgpt", providerId: "openai-codex", model: "gpt-5.4", maxToolCalls: 8, maxTokens: 4096 };
const textResponse = (patch: unknown, finishReason = "stop"): JsonValue => jsonValue({ choices: [{ message: { role: "assistant", content: JSON.stringify(patch) }, finish_reason: finishReason }] });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
function pngData(width = 5, height = 5) {
  const png = new PNG({ width, height });
  png.data.fill(255);
  // Colored ring surrounds a white center: transparency must remove only the
  // connected white border, never the enclosed white subject detail.
  for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) {
    if (x === 2 && y === 2) continue;
    const i = (y * width + x) * 4;
    png.data[i] = 20; png.data[i + 1] = 40; png.data[i + 2] = 60;
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}
const RAW_IMAGE = pngData();
const imageResponse = { image: { dataUrl: RAW_IMAGE, mimeType: "image/png", model: "gemini-image-result", provider: "google-antigravity" } };

/** Only the DOM pixel I/O is substituted. Real PNG decode/encode, the production
 * artwork helper and connected-background alpha algorithm all execute. */
function canvasPlatform() {
  let failRead = false;
  const sizes: number[][] = [];
  class DecodedImage {
    onload?: () => void;
    onerror?: () => void;
    width = 0; height = 0; naturalWidth = 0; naturalHeight = 0;
    pixels = new Uint8ClampedArray();
    set src(value: string) {
      const png = PNG.sync.read(Buffer.from(value.split(",")[1]!, "base64"));
      this.width = this.naturalWidth = png.width;
      this.height = this.naturalHeight = png.height;
      this.pixels = new Uint8ClampedArray(png.data);
      this.onload?.();
    }
  }
  vi.stubGlobal("Image", DecodedImage);
  vi.stubGlobal("document", { createElement: (tag: string) => {
    expect(tag).toBe("canvas");
    let pixels = new Uint8ClampedArray();
    const canvas = { width: 0, height: 0,
      getContext: () => ({
        drawImage: (image: DecodedImage, _x: number, _y: number, width: number, height: number) => {
          sizes.push([width, height]); pixels = new Uint8ClampedArray(width * height * 4);
          for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const source = (Math.floor(y * image.height / height) * image.width + Math.floor(x * image.width / width)) * 4;
            pixels.set(image.pixels.subarray(source, source + 4), (y * width + x) * 4);
          }
        },
        getImageData: () => { if (failRead) { failRead = false; throw new Error("canvas read failed"); } return { data: pixels }; },
        putImageData: (image: { data: Uint8ClampedArray }) => { pixels = image.data; },
      }),
      toDataURL: () => `data:image/png;base64,${PNG.sync.write({ width: canvas.width, height: canvas.height, data: Buffer.from(pixels) }).toString("base64")}`,
    };
    return canvas;
  } });
  return { sizes, failNextRead: () => { failRead = true; } };
}
afterEach(() => vi.unstubAllGlobals());

async function fixture(kind: AiDatabaseKind = "item", withArtwork = true) {
  const baseline = createBlankProject();
  const blobs = new Map<string, Uint8Array>();
  const stages: string[] = [];
  let checkpoint: AiJobCheckpoint | null = null;
  const ledger = new Map<string, { request: JsonValue; response: JsonValue }>();
  const dispatch = vi.fn(async (key: string, _request: JsonValue): Promise<JsonValue> => key === "database/text"
    ? textResponse(kind === "item" ? { name: "회복약", price: 123, hpRecovery: { flat: 80, percentMax: 0 } }
      : { name: "서슬 늑대", stats: { maxHp: 140, attack: 22 }, rewards: { exp: 8, gold: 7 }, transparent: true })
    : imageResponse);
  const putBlob = async (bytes: Uint8Array, mediaType: string): Promise<BlobRef> => {
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    blobs.set(sha256, bytes.slice()); return { sha256, byteLength: bytes.length, mediaType };
  };
  const host: AiJobHost = {
    jobId: "database-job", attemptId: "attempt-1", dependencies: [],
    putBlob: vi.fn(putBlob),
    putJson: vi.fn(async value => putBlob(new TextEncoder().encode(JSON.stringify(value)), "application/json")),
    readBlob: async ref => { const bytes = blobs.get(ref.sha256); if (!bytes) throw new Error("Missing blob"); return bytes.slice(); },
    readJson: async ref => JSON.parse(new TextDecoder().decode(await host.readBlob(ref))),
    loadCheckpoint: async () => structuredClone(checkpoint),
    saveCheckpoint: vi.fn(async saved => {
      checkpoint = { version: 1, jobId: host.jobId, attemptId: host.attemptId, inputSha256: "captured-input", ...structuredClone(saved) };
      stages.push(saved.stageKey);
      return host.putJson(jsonValue(checkpoint));
    }),
    providerOperation: vi.fn(async ({ key, request }) => {
      const cached = ledger.get(key);
      if (cached) { expect(request).toEqual(cached.request); return structuredClone(cached.response); }
      const response = await dispatch(key, request);
      ledger.set(key, { request: structuredClone(request), response: structuredClone(response) });
      return response;
    }),
  };
  const input: AiJobInput & { family: "database" } = { version: 1, family: "database", project: { backend: "local", projectId: "project-A" },
    projectSnapshot: await host.putJson(jsonValue(baseline)), artwork: [], target: {}, mode: "review", dependsOn: [],
    payload: { kind, brief: "captured request", config, withArtwork } };
  return { host, input, baseline, stages, dispatch, blobs, checkpoint: () => checkpoint };
}

describe("database job output validation", () => {
  it.each([
    ["item", { name: "Potion", price: "not a number" }],
    ["enemy", { name: "Wolf", stats: { maxHp: "not a number" } }],
  ] as const)("rejects malformed %s text before artwork or tool writes", (kind, patch) => {
    expect(() => parseGeneratedRecord(kind, JSON.stringify(patch))).toThrow();
  });

  it("has no transitive editor/store/panels/PWA boot imports", () => {
    const graph = runtimeGraph("src/ai/jobs/executors/databaseJob.ts");
    expect(graph).toContain("src/editor/tools/toolRunner.ts");
    expect(graph).toContain("src/ai/databaseGenerationCore.ts");
    expect(graph.filter(p => /src\/main\.ts$|project\/store\.ts$|editor\/panels\/|editorState\.ts$|mapEditHistory\.ts$|applyChangesetToStore\.ts$|pwa/i.test(p))).toEqual([]);
  });

  it.each(["item", "enemy"] as const)("checkpoints %s text before held artwork and returns captured record facts and transparent refs", async kind => {
    const platform = canvasPlatform();
    const f = await fixture(kind);
    const text = deferred<JsonValue>(); const art = deferred<JsonValue>();
    const textStarted = deferred<void>(); const artStarted = deferred<void>();
    f.dispatch.mockImplementation(async key => {
      if (key === "database/text") { textStarted.resolve(); return text.promise; }
      artStarted.resolve(); return art.promise;
    });
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Direct network forbidden"); }));
    const before = jsonValue(f.baseline);
    const run = executeDatabaseJob(f.input, f.host);
    await textStarted.promise;
    expect(f.checkpoint()).toBeNull();
    text.resolve(textResponse(kind === "item" ? { name: "회복약", price: 123 } : { name: "서슬 늑대", stats: { maxHp: 140 }, transparent: true }));
    await artStarted.promise;
    const captured = structuredClone(f.checkpoint()!.state);
    expect(f.stages).toEqual(["database/text"]);
    expect(captured.recordId).toBe(`${kind}_ai_1`);
    // A different editor project/identity cannot redirect the captured job.
    const otherProject = createBlankProject(); otherProject.database.items.length = 0;
    art.resolve(imageResponse);
    const result = await run;
    expect(result.project).toEqual({ backend: "local", projectId: "project-A" });
    expect(result.payload.recordId).toBe(captured.recordId);
    expect(result.payload).toMatchObject({ kind, completion: "complete", persistence: "not-applicable", checkpoint: "private-draft" });
    expect(result.payload).not.toHaveProperty("applied");
    expect(result.payload).not.toHaveProperty("saved");
    expect(f.stages).toEqual(["database/text", "database/artwork", "database/artwork-processed", "database/completed"]);
    expect(result.artifacts).toHaveLength(2);
    const generated = parseProject(await f.host.readJson(result.generatedSnapshot!));
    const record = (kind === "item" ? generated.database.items : generated.database.enemies).find(r => r.id === captured.recordId)!;
    expect(jsonValue(record)).toEqual(result.payload.record);
    expect(record).toMatchObject(kind === "item" ? { price: 123, iconResourceId: "item_ai_1_art" } : { stats: { maxHp: 140 }, transparent: true, monsterResourceId: "enemy_ai_1_art" });
    const resource = generated.assets.uploaded[String(result.payload.resourceId)]!;
    expect(resource.kind).toBe(kind === "item" ? "picture" : "monster");
    const pixels = PNG.sync.read(Buffer.from(await f.host.readBlob(result.artifacts[1]!)));
    expect(pixels.data[3]).toBe(0);
    expect(pixels.data[(2 * 5 + 2) * 4 + 3]).toBe(255);
    expect(platform.sizes).toEqual([[5, 5]]);
    expect(jsonValue(f.baseline)).toEqual(before);
    expect(await f.host.readJson(f.input.projectSnapshot)).toEqual(before);
    expect(otherProject.database.items).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(f.dispatch.mock.calls.map(([key]) => key)).toEqual(["database/text", "database/artwork"]);
    expect(f.dispatch.mock.calls[0]![1]).toMatchObject({ kind: "text", provider: "openai-codex" });
    expect(f.dispatch.mock.calls[1]![1]).toMatchObject({ kind: "image", provider: "google-antigravity", body: { model: "gemini-3.8-flash" } });
    const puts = vi.mocked(f.host.putJson).mock.calls.length;
    const replay = await executeDatabaseJob(f.input, { ...f.host, attemptId: "attempt-2" });
    expect(replay.generatedSnapshot).toEqual(result.generatedSnapshot);
    expect(replay.payload).toEqual(result.payload);
    expect(replay.artifacts).toEqual(result.artifacts);
    expect(replay.attemptId).toBe("attempt-2");
    expect(vi.mocked(f.host.putJson).mock.calls).toHaveLength(puts);
    expect(f.dispatch).toHaveBeenCalledTimes(2);
  });

  it("retries failed artwork without regenerating text or reallocating IDs", async () => {
    canvasPlatform(); const f = await fixture();
    const normal = f.dispatch.getMockImplementation()!;
    f.dispatch.mockImplementationOnce(normal).mockRejectedValueOnce(new Error("artwork unavailable"));
    await expect(executeDatabaseJob(f.input, f.host)).rejects.toThrow("artwork unavailable");
    const textState = structuredClone(f.checkpoint()!.state);
    expect(textState).toMatchObject({ recordId: "item_ai_1", patch: { name: "회복약", price: 123 } });
    const result = await executeDatabaseJob(f.input, f.host);
    expect(result.payload.recordId).toBe(textState.recordId);
    expect(f.dispatch.mock.calls.map(([key]) => key)).toEqual(["database/text", "database/artwork", "database/artwork"]);
  });

  it("retries canvas failure from the immutable raw image, not the provider", async () => {
    const platform = canvasPlatform(); platform.failNextRead(); const f = await fixture("enemy");
    await expect(executeDatabaseJob(f.input, f.host)).rejects.toThrow("canvas read failed");
    expect(f.stages).toEqual(["database/text", "database/artwork"]);
    const art = requireRecord("artwork", f.checkpoint()!.state.artwork);
    expect(art.processed).toBeUndefined();
    const result = await executeDatabaseJob(f.input, f.host);
    expect(result.artifacts[0]).toEqual(art.raw);
    expect(f.dispatch).toHaveBeenCalledTimes(2);
  });

  it("retries snapshot postprocessing failure with the processed image and identical deterministic record", async () => {
    const platform = canvasPlatform(); const f = await fixture();
    const put = f.host.putJson;
    f.host.putJson = async value => {
      if (requireRecord("value", value).maps !== undefined) throw new Error("snapshot storage failed");
      return put(value);
    };
    await expect(executeDatabaseJob(f.input, f.host)).rejects.toThrow("snapshot storage failed");
    const saved = structuredClone(f.checkpoint()!.state);
    expect(f.stages.at(-1)).toBe("database/artwork-processed");
    f.host.putJson = put;
    const result = await executeDatabaseJob(f.input, f.host);
    expect(result.payload.recordId).toBe(saved.recordId);
    expect(result.payload.artwork).toEqual(saved.artwork);
    expect(f.dispatch).toHaveBeenCalledTimes(2);
    expect(platform.sizes).toHaveLength(1);
  });

  it.each(["database/text", "database/artwork", "database/artwork-processed", "database/completed"])("reuses ledger responses after checkpoint persistence failure at %s", async stage => {
    canvasPlatform(); const f = await fixture(); const save = f.host.saveCheckpoint;
    let failed = false;
    f.host.saveCheckpoint = async checkpoint => {
      if (checkpoint.stageKey === stage && !failed) { failed = true; throw new Error("checkpoint not durable"); }
      return save(checkpoint);
    };
    await expect(executeDatabaseJob(f.input, f.host)).rejects.toThrow("checkpoint not durable");
    const result = await executeDatabaseJob(f.input, f.host);
    expect(result.payload.recordId).toBe("item_ai_1");
    expect(f.dispatch).toHaveBeenCalledTimes(2);
  });

  it("text-only generation needs no DOM, returns a proposal, and uses existing ID collision semantics", async () => {
    const f = await fixture("item", false);
    const baseline = parseProject(await f.host.readJson(f.input.projectSnapshot));
    baseline.database.items.push({ ...baseline.database.items[0]!, id: "item_ai_1", name: "Existing" });
    const input = { ...f.input, projectSnapshot: await f.host.putJson(jsonValue(baseline)) };
    const result = await executeDatabaseJob(input, f.host);
    expect(result.payload.recordId).toBe("item_ai_2");
    expect(result.artifacts).toEqual([]);
    expect(result.payload.resourceId).toBeUndefined();
    expect(f.dispatch).toHaveBeenCalledTimes(1);
    expect(f.stages).toEqual(["database/text", "database/completed"]);
  });

  it.each([
    { name: "Potion", price: "bad" }, { name: "Potion", hpRecovery: { flat: "bad" } },
    { price: 10 }, { name: "Potion", type: "not-real" },
  ])("malformed text creates no checkpoint, artwork, or snapshot: %j", async patch => {
    const f = await fixture(); f.dispatch.mockResolvedValue(textResponse(patch));
    const writes = vi.mocked(f.host.putJson).mock.calls.length;
    await expect(executeDatabaseJob(f.input, f.host)).rejects.toThrow();
    expect(f.checkpoint()).toBeNull();
    expect(f.host.putBlob).not.toHaveBeenCalled();
    expect(vi.mocked(f.host.putJson).mock.calls).toHaveLength(writes);
    expect(f.dispatch).toHaveBeenCalledTimes(1);
  });

  it("rejects truncated text, malformed artwork and forbidden canon without completing generation", async () => {
    const f = await fixture(); f.dispatch.mockResolvedValueOnce(textResponse({ name: "Potion" }, "length"));
    await expect(executeDatabaseJob(f.input, f.host)).rejects.toThrow("Incomplete database text response");
    expect(f.checkpoint()).toBeNull();
    const image = await fixture(); image.dispatch.mockResolvedValueOnce(textResponse({ name: "Potion" })).mockResolvedValueOnce({ image: { dataUrl: "data:image/png;base64,%%%" } });
    await expect(executeDatabaseJob(image.input, image.host)).rejects.toThrow("Invalid database artwork");
    expect(image.stages).toEqual(["database/text"]);
    const canon = await fixture("enemy"); canon.baseline.worldCanon = { name: "No guns", absences: ["총"] };
    const canonInput = { ...canon.input, projectSnapshot: await canon.host.putJson(jsonValue(canon.baseline)) };
    canon.dispatch.mockResolvedValue(textResponse({ name: "Wolf", description: "총" }));
    await expect(executeDatabaseJob(canonInput, canon.host)).rejects.toThrow();
    expect(canon.checkpoint()).toBeNull();
  });

  it("validates payload, project and checkpoint before paid work", async () => {
    const f = await fixture();
    for (const payload of [ { ...f.input.payload, kind: "actor" }, { ...f.input.payload, brief: " " },
      { ...f.input.payload, config: { ...config, apiKey: "not-allowed" } },
      { ...f.input.payload, config: { ...config, authMode: "apiKey" } },
      { ...f.input.payload, withArtwork: "yes" } ]) {
      await expect(executeDatabaseJob({ ...f.input, payload }, f.host)).rejects.toThrow();
    }
    const projectSnapshot = await f.host.putJson({ version: 4, database: {}, maps: {} });
    await expect(executeDatabaseJob({ ...f.input, projectSnapshot }, f.host)).rejects.toThrow();
    await f.host.saveCheckpoint({ stageKey: "database/text", state: { version: 1, kind: "item", recordId: "other", patch: { name: "Potion" } }, artifacts: [] });
    await expect(executeDatabaseJob(f.input, f.host)).rejects.toThrow("Invalid database checkpoint record ID");
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it("uses the shared artwork helper's 512px sizing before recording the processed artifact", async () => {
    const platform = canvasPlatform(); const f = await fixture();
    f.dispatch.mockResolvedValueOnce(textResponse({ name: "Potion" })).mockResolvedValueOnce({ image: { ...imageResponse.image, dataUrl: pngData(1024, 768) } });
    const result = await executeDatabaseJob(f.input, f.host);
    expect(platform.sizes).toEqual([[512, 384]]);
    const png = PNG.sync.read(Buffer.from(await f.host.readBlob(result.artifacts[1]!)));
    expect([png.width, png.height]).toEqual([512, 384]);
  });

  it("does not return forged artwork bindings from a completed checkpoint", async () => {
    canvasPlatform(); const f = await fixture();
    await executeDatabaseJob(f.input, f.host);
    const checkpoint = f.checkpoint()!;
    const completed = requireRecord("completed", checkpoint.state.completed);
    const proposal = requireRecord("proposal", completed.proposal);
    await f.host.saveCheckpoint({ ...checkpoint, state: jsonObject({ ...checkpoint.state,
      completed: { ...completed, proposal: { ...proposal, resourceId: "unrelated-resource" } } }) });
    const calls = f.dispatch.mock.calls.length;
    await expect(executeDatabaseJob(f.input, f.host)).rejects.toThrow("Database checkpoint proposal mismatch");
    expect(f.dispatch).toHaveBeenCalledTimes(calls);
  });

  it("retains artwork when the real enemy tool rejects an invalid reference, without publishing a generated snapshot", async () => {
    canvasPlatform(); const f = await fixture("enemy");
    f.dispatch.mockResolvedValueOnce(textResponse({ name: "Wolf", rewards: { dropItemId: "missing-item" } }));
    await expect(executeDatabaseJob(f.input, f.host)).rejects.toThrow("Database proposal failed");
    const state = structuredClone(f.checkpoint()!.state);
    expect(f.stages.at(-1)).toBe("database/artwork-processed");
    expect(state.completed).toBeUndefined();
    await expect(executeDatabaseJob(f.input, f.host)).rejects.toThrow("Database proposal failed");
    expect(f.checkpoint()!.state).toEqual(state);
    expect(f.dispatch).toHaveBeenCalledTimes(2);
    expect(await f.host.readJson(f.input.projectSnapshot)).toEqual(jsonValue(f.baseline));
  });

  it("rejects malformed checkpoint artwork refs before provider dispatch", async () => {
    const f = await fixture();
    await f.host.saveCheckpoint({ stageKey: "database/artwork", state: { version: 1, kind: "item", recordId: "item_ai_potion", patch: { name: "Potion" },
      artwork: { raw: { sha256: "bad", byteLength: 1, mediaType: "image/png" }, model: "image-model", provider: "google-antigravity" } }, artifacts: [] });
    await expect(executeDatabaseJob(f.input, f.host)).rejects.toThrow("Invalid database blob reference");
    expect(f.dispatch).not.toHaveBeenCalled();
  });
});
