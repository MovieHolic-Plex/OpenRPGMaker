import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { openAiJobsRepository } from "../scripts/lib/aiJobs/repository.mjs";
import { resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { createBlankProject } from "@/project/defaults";
import { insertGeneratedPictureAsset } from "@/editor/generatedPictureAsset";
import { jsonObject, jsonValue, parseProject } from "@/ai/jobs/checkpointState";
import { IMAGE_GENERATION_MODEL, IMAGE_GENERATION_PROVIDER_ID } from "@/ai/imageGenerationClient";
import { parseImageJobDestination, type ImageJobPayload, type ImageJobDestination } from "@/ai/jobs/imagePayload";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import type { AiJobHost } from "../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobCheckpoint, AiJobInput, AiJobResult, BlobRef, JsonObject, JsonValue } from "@/ai/jobs/contracts";
import { runtimeGraph } from "./aiJobWorkerIsolation.test";

// This browser executes the actual executor, image wire helper, decoder, canvas
// flattening and project insertion. Only the durable host/provider is controlled.
declare global {
  interface Window {
    imageTestHost(runId: number, method: string, args: JsonValue): Promise<JsonValue>;
    executeImageTestJob: typeof import("@/ai/jobs/executors/imageJob").executeImageJob;
  }
}
let server: ViteDevServer;
let browser: Browser;
let page: Page;
const invocationHosts = new Map<number, AiJobHost>();
let invocationId = 0;
let sourceDataUrl: string;
const root = resolve(import.meta.dirname, "..");
const repositoryCleanups: (() => Promise<void>)[] = [];
afterEach(async () => { await Promise.all(repositoryCleanups.splice(0).map(cleanup => cleanup())); });

beforeAll(async () => {
  server = await createServer({ root, configFile: false, envFile: false, envDir: false,
    resolve: { alias: { "@": resolve(root, "src") } },
    server: { host: "127.0.0.1", port: 19843, strictPort: true },
    plugins: [{ name: "image-test-surface", configureServer(vite) {
      vite.middlewares.use("/image-job-test", (_req, res) => {
        res.setHeader("Content-Type", "text/html"); res.end("<!doctype html><title>Image job execution fixture</title>");
      });
    } }],
  });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ serviceWorkers: "block" });
  // The adopted Linux Chromium can emit ERR_NETWORK_CHANGED on module fanout.
  // Transport static modules through Playwright's Node request API, as the real
  // isolated runtime does. No provider/API/foreign request is allowed here.
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:19843" || request.method() !== "GET") throw new Error(`Unexpected browser request ${url}`);
    const response = await page.request.get(url.href, { maxRedirects: 0, maxRetries: 0 });
    await route.fulfill({ response });
  });
  await page.exposeFunction("imageTestHost", async (runId: number, method: string, args: JsonValue) => {
    const host = invocationHosts.get(runId);
    if (!host) throw new Error("Image test invocation has ended");
    const r = jsonObject(args);
    switch (method) {
      case "loadCheckpoint": return host.loadCheckpoint();
      case "saveCheckpoint": return host.saveCheckpoint({ stageKey: String(r.stageKey), state: jsonObject(r.state), artifacts: parseRefs(r.artifacts) });
      case "readJson": return host.readJson(parseRef(r));
      case "putJson": return host.putJson(r.value!);
      case "readBlob": return [...await host.readBlob(parseRef(r))];
      case "putBlob": {
        if (!Array.isArray(r.bytes)) throw new Error("Invalid wire bytes");
        return host.putBlob(Uint8Array.from(r.bytes.map(Number)), String(r.mediaType));
      }
      case "providerOperation": return host.providerOperation({ key: String(r.key), request: r.request! });
      default: throw new Error(`Unexpected host method ${method}`);
    }
  });
  await page.goto("http://127.0.0.1:19843/image-job-test");
  await page.evaluate("import('/src/ai/jobs/executors/imageJob.ts').then(m => { window.executeImageTestJob = m.executeImageJob; })");
  sourceDataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = "#c02030"; ctx.fillRect(256, 128, 512, 256);
    return canvas.toDataURL("image/png");
  });
});
afterAll(async () => { await browser?.close(); await server?.close(); });

function parseRef(value: unknown): BlobRef {
  const r = jsonObject(value);
  return { sha256: String(r.sha256), byteLength: Number(r.byteLength), mediaType: String(r.mediaType) };
}
function parseRefs(value: unknown): BlobRef[] {
  if (!Array.isArray(value)) throw new Error("Invalid wire refs");
  return value.map(parseRef);
}
async function run(input: AiJobInput & { family: "image" }, host: AiJobHost): Promise<AiJobResult> {
  const runId = ++invocationId;
  invocationHosts.set(runId, host);
  const result = await page.evaluate(async ({ serializedInput, jobId, attemptId, runId }) => {
    const input: AiJobInput & { family: "image" } = JSON.parse(serializedInput);
    const executeImageJob = window.executeImageTestJob;
    const call = (method: string, args: JsonValue) => window.imageTestHost(runId, method, args);
    const ref = (v: JsonValue): BlobRef => {
      const r = v as JsonObject;
      return { sha256: String(r.sha256), byteLength: Number(r.byteLength), mediaType: String(r.mediaType) };
    };
    const host: AiJobHost = {
      jobId, attemptId, dependencies: [],
      loadCheckpoint: async () => {
        const value = await call("loadCheckpoint", {});
        if (value === null) return null;
        const r = value as JsonObject;
        return { version: 1, jobId: String(r.jobId), attemptId: String(r.attemptId), inputSha256: String(r.inputSha256),
          stageKey: String(r.stageKey), state: r.state as JsonObject, artifacts: (r.artifacts as JsonValue[]).map(ref) };
      },
      saveCheckpoint: async value => ref(await call("saveCheckpoint", JSON.parse(JSON.stringify(value)))),
      readJson: async value => call("readJson", { ...value }),
      putJson: async value => ref(await call("putJson", { value })),
      readBlob: async value => Uint8Array.from(await call("readBlob", { ...value }) as number[]),
      putBlob: async (bytes, mediaType) => ref(await call("putBlob", { bytes: [...bytes], mediaType })),
      providerOperation: async value => call("providerOperation", { ...value }),
    };
    return JSON.stringify(await executeImageJob(input, host));
  }, { serializedInput: JSON.stringify(input), jobId: host.jobId, attemptId: host.attemptId, runId })
    .finally(() => { invocationHosts.delete(runId); });
  return JSON.parse(result);
}
async function fixture(options: { payload?: Partial<ImageJobPayload>; target?: ImageJobDestination } = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), "ai-image-canonical-"));
  let repository = await openAiJobsRepository({ directory });
  repositoryCleanups.push(async () => { await repository.close(); await rm(directory, { recursive: true }); });
  let checkpointRef: BlobRef | null = null;
  // Match the scheduler: persist the envelope through repository.putJson, retain
  // only its ref, and deserialize its canonical bytes on every checkpoint load.
  const checkpoint = async (): Promise<AiJobCheckpoint | null> => checkpointRef
    ? JSON.parse(new TextDecoder().decode(await repository.readBlob(checkpointRef))) : null;
  const host: AiJobHost = {
    jobId: "image-job", attemptId: "attempt-1", dependencies: [],
    putBlob: (data, mediaType) => repository.putBlob(data, mediaType),
    readBlob: ref => repository.readBlob(ref),
    putJson: value => repository.putJson(value),
    readJson: ref => repository.readJson(ref),
    loadCheckpoint: checkpoint,
    saveCheckpoint: async value => {
      checkpointRef = await host.putJson(jsonValue({ ...value, version: 1, jobId: host.jobId,
        attemptId: host.attemptId, inputSha256: "f".repeat(64) }));
      return checkpointRef;
    },
    providerOperation: vi.fn(async () => ({ image: { dataUrl: sourceDataUrl, mimeType: "image/png", model: IMAGE_GENERATION_MODEL, provider: IMAGE_GENERATION_PROVIDER_ID } })),
  };
  const project = createBlankProject();
  const input: AiJobInput & { family: "image" } = { version: 1, family: "image", project: { backend: "local", projectId: "captured-project-A" },
    projectSnapshot: await host.putJson(jsonValue(project)), artwork: [], mode: "review", dependsOn: [],
    target: jsonObject(options.target ?? { kind: "system", field: "titleResourceId" }),
    payload: jsonObject(jsonValue({ prompt: "wide landscape, no text", resourceId: "allocated-title", name: "Landscape", kind: "title", postprocess: "none", ...options.payload })),
  };
  return { input, host, project, checkpoint,
    reopen: async () => { await repository.close(); repository = await openAiJobsRepository({ directory }); },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
async function pixels(ref: BlobRef, host: AiJobHost) {
  return page.evaluate(async ({ bytes, mediaType }) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type: mediaType }));
    const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, corner: [...ctx.getImageData(0, 0, 1, 1).data],
      center: [...ctx.getImageData(bitmap.width / 2, bitmap.height / 2, 1, 1).data] };
  }, { bytes: [...await host.readBlob(ref)], mediaType: ref.mediaType });
}

describe("real image-family execution", { timeout: 90_000 }, () => {
  it("keeps a held provider result bound to the captured project, ID, and two title fields", async () => {
    const f = await fixture();
    const started = deferred<void>(), response = deferred<JsonValue>();
    f.host.providerOperation = vi.fn(async operation => { expect(operation).toEqual({ key: "image/provider/generate", request: {
      kind: "image", provider: IMAGE_GENERATION_PROVIDER_ID, body: { prompt: "wide landscape, no text", model: IMAGE_GENERATION_MODEL },
    } }); started.resolve(); return response.promise; });
    const before = JSON.stringify(f.project);
    const pending = run(f.input, f.host);
    await Promise.race([started.promise, pending.then(() => { throw new Error("Finished before provider barrier"); })]);
    expect((await f.checkpoint())?.stageKey).toBe("image/start");
    response.resolve({ image: { dataUrl: sourceDataUrl, mimeType: "image/png" } });
    const result = await pending;
    expect(result.project).toEqual(f.input.project);
    const proposal = jsonObject(result.payload.proposal);
    expect(proposal.destination).toEqual(f.input.target);
    expect(jsonObject(proposal.resource).id).toBe("allocated-title");
    const draft = parseProject(await f.host.readJson(result.generatedSnapshot!));
    expect(draft.system.titleResourceId).toBe("allocated-title");
    expect(draft.system.titleScreen?.backgroundResourceId).toBe("allocated-title");
    expect(draft.assets.uploaded["allocated-title"]?.dataUrl).toBe(sourceDataUrl);
    expect(JSON.stringify(f.project)).toBe(before);
    expect(result.payload.persistence).toBe("not-applicable");
    expect(f.host.providerOperation).toHaveBeenCalledTimes(1);
    const artifact = parseRef(jsonObject(proposal.resource).artifact);
    expect(await pixels(artifact, f.host)).toMatchObject({ width: 1024, height: 512, corner: [255, 255, 255, 255] });
    expect(await run(f.input, { ...f.host, attemptId: "attempt-2" })).toMatchObject({ generatedSnapshot: result.generatedSnapshot, payload: result.payload });
    expect(f.host.providerOperation).toHaveBeenCalledTimes(1);
  });

  it("retries real flattening and completed output through canonical persisted checkpoints without repeating the paid operation", async () => {
    const project = createBlankProject();
    const f = await fixture({ payload: { resourceId: "allocated-face-bust", kind: "faceset", postprocess: "flatten" },
      target: { kind: "database", table: "actors", recordId: project.database.actors[0]!.id, field: "faceResourceId" } });
    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function () {
        HTMLCanvasElement.prototype.getContext = original;
        return null;
      };
    });
    await expect(run(f.input, f.host)).rejects.toThrow("canvas unavailable");
    expect((await f.checkpoint())?.stageKey).toBe("image/provider-response");
    expect((await f.checkpoint())?.state.responseRef).not.toBeNull();
    const savedBinding = jsonObject((await f.checkpoint())?.state.binding);
    expect(Object.keys(savedBinding)).toEqual(["baseSnapshot", "payload", "project", "target"]);
    expect(Object.keys(jsonObject(savedBinding.target))).toEqual(["field", "kind", "recordId", "table"]);
    await f.reopen();
    const result = await run(f.input, { ...f.host, attemptId: "attempt-2" });
    expect(f.host.providerOperation).toHaveBeenCalledTimes(1);
    const resource = jsonObject(jsonObject(result.payload.proposal).resource);
    expect(resource.id).toBe("allocated-face-bust");
    expect(await pixels(parseRef(resource.artifact), f.host)).toMatchObject({ width: 512, height: 256, corner: [0, 0, 0, 0], center: [192, 32, 48, 255] });
    const draft = parseProject(await f.host.readJson(result.generatedSnapshot!));
    expect(draft.database.actors[0]?.faceResourceId).toBe("allocated-face-bust");
    expect(draft.resourceProfiles.filter(r => r.assetId === "allocated-face-bust")).toHaveLength(1);
    await f.reopen();
    const completed = await run(f.input, { ...f.host, attemptId: "attempt-3" });
    expect(completed.generatedSnapshot).toEqual(result.generatedSnapshot);
    expect(completed.payload).toEqual(result.payload);
    expect(completed.artifacts).toEqual(result.artifacts);
    expect(f.host.providerOperation).toHaveBeenCalledTimes(1);
  });

  it("does not accept invalid image bytes as successful generation and retains them for inspection", async () => {
    const f = await fixture();
    f.host.providerOperation = vi.fn(async () => ({ image: { dataUrl: "data:image/png;base64,bm90IGFuIGltYWdl", mimeType: "image/png" } }));
    await expect(run(f.input, f.host)).rejects.toThrow("cannot be decoded");
    await expect(run(f.input, { ...f.host, attemptId: "attempt-2" })).rejects.toThrow("cannot be decoded");
    expect((await f.checkpoint())?.state.completed).toBe(false);
    expect((await f.checkpoint())?.state.image).toBeNull();
    expect(f.host.providerOperation).toHaveBeenCalledTimes(1);
  });

  it("retains processed artwork if project snapshot persistence fails", async () => {
    const f = await fixture();
    const put = f.host.putJson;
    f.host.putJson = async value => {
      if (value && typeof value === "object" && "assets" in value) throw new Error("snapshot write failed");
      return put(value);
    };
    await expect(run(f.input, f.host)).rejects.toThrow("snapshot write failed");
    expect((await f.checkpoint())?.stageKey).toBe("image/artwork");
    const image = (await f.checkpoint())?.state.image;
    f.host.putJson = put;
    f.host.putBlob = vi.fn(f.host.putBlob);
    await run(f.input, { ...f.host, attemptId: "attempt-2" });
    expect((await f.checkpoint())?.state.image).toEqual(image);
    expect(f.host.putBlob).not.toHaveBeenCalled();
    expect(f.host.providerOperation).toHaveBeenCalledTimes(1);
  });

  it("replays a ledger response after worker interruption without changing the paid request or resource ID", async () => {
    const f = await fixture();
    let dispatched = 0;
    let recorded: JsonValue | undefined;
    f.host.providerOperation = vi.fn(async operation => {
      if (recorded) {
        expect(operation.request).toEqual(recorded);
        return { image: { dataUrl: sourceDataUrl, mimeType: "image/png" } };
      }
      dispatched++;
      recorded = structuredClone(operation.request);
      throw new Error("worker interrupted after durable provider response");
    });
    await expect(run(f.input, f.host)).rejects.toThrow("worker interrupted");
    expect((await f.checkpoint())?.stageKey).toBe("image/start");
    const result = await run(f.input, { ...f.host, attemptId: "attempt-2" });
    expect(dispatched).toBe(1);
    expect(jsonObject(jsonObject(result.payload.proposal).resource).id).toBe("allocated-title");
    expect(f.host.providerOperation).toHaveBeenCalledTimes(2);
  });

  it.each([
    { kind: "system", field: "titleScreen.backgroundResourceId" },
    { kind: "system", field: "titleScreen.titleGraphic.resourceId" },
    { kind: "title-layer", index: 0 },
  ])("keeps title slot $field $kind separate from the shared title resource", async rawTarget => {
    const target = parseImageJobDestination(rawTarget, "title");
    const f = await fixture({ target });
    insertGeneratedPictureAsset(f.project, { id: "old-layer", name: "Before", kind: "title", dataUrl: sourceDataUrl });
    const title = f.project.system.titleScreen!;
    title.backgroundLayers = [{ resourceId: "old-layer", scrollXPerSec: 7 }];
    const input = { ...f.input, projectSnapshot: await f.host.putJson(jsonValue(f.project)) };
    const result = await run(input, f.host);
    const draft = parseProject(await f.host.readJson(result.generatedSnapshot!));
    expect(draft.system.titleResourceId).toBe(f.project.system.titleResourceId);
    if (target.kind === "title-layer") {
      expect(draft.system.titleScreen?.backgroundLayers?.[0]).toMatchObject({ resourceId: "allocated-title", scrollXPerSec: 7 });
    } else if (target.kind === "system" && target.field === "titleScreen.titleGraphic.resourceId") {
      expect(draft.system.titleScreen?.titleGraphic?.resourceId).toBe("allocated-title");
    } else expect(draft.system.titleScreen?.backgroundResourceId).toBe("allocated-title");
  });

  it.each([
    ["show-picture", "picture", { kind: "showPicture", pictureId: "p1", resourceId: "old", x: 12, y: 34 }],
    ["change-face", "faceset", { kind: "changeFace", resourceId: "old", position: "left", flipHorizontally: false }],
    ["actor-faceset", "faceset", { kind: "m2Command", commandId: M2_COMMAND_CATALOG.find(e => e.title === "Change Actor Faceset")!.id, fields: { target: "actor:hero", value: "old" } }],
    ["parallax", "backdrop", { kind: "m2Command", commandId: M2_COMMAND_CATALOG.find(e => e.title === "Change Parallax Back")!.id, fields: { value: "old" } }],
  ])("returns a reviewed %s command proposal without generating a saved-project patch", async (binding, kind, command) => {
    const target = parseImageJobDestination({ kind: "event-draft", draftId: "draft-1", draftRevision: "e".repeat(64),
      owner: { kind: "map-event", mapId: "map-A", eventId: "event-A", pageId: "page-A" }, commandPath: [0, -2, 1], binding, command },
      kind === "picture" ? "picture" : kind === "backdrop" ? "backdrop" : "faceset");
    const f = await fixture({ target, payload: { kind: kind === "picture" ? "picture" : kind === "backdrop" ? "backdrop" : "faceset", resourceId: "reviewed-image-bust" } });
    await expect(run({ ...f.input, mode: "auto" }, f.host)).rejects.toThrow("require review mode");
    expect(f.host.providerOperation).not.toHaveBeenCalled();
    const result = await run(f.input, f.host);
    expect(result.generatedSnapshot).toBeNull();
    const proposal = jsonObject(result.payload.proposal);
    expect(proposal.destination).toEqual(f.input.target);
    const updated = jsonObject(proposal.command);
    if (binding === "parallax") expect(updated.fields).toMatchObject({ value: "reviewed-image-bust", resourceId: "reviewed-image-bust", target: "reviewed-image-bust", operation: "set" });
    else if (binding === "actor-faceset") expect(updated.fields).toEqual({ target: "actor:hero", value: "reviewed-image-bust" });
    else expect(updated.resourceId).toBe("reviewed-image-bust");
  });

  it("rejects changed target content, command path order, project identity and resource IDs after canonical persistence", async () => {
    const target: ImageJobDestination = { kind: "event-draft", draftId: "draft-1", draftRevision: "e".repeat(64),
      owner: { kind: "map-event", mapId: "map-A", eventId: "event-A", pageId: "page-A" },
      commandPath: [0, -2, 1], binding: "show-picture",
      command: { kind: "showPicture", pictureId: "p1", resourceId: "old", x: 12, y: 34 } };
    const f = await fixture({ target, payload: { kind: "picture" } });
    const completed = await run(f.input, f.host);
    await f.reopen();
    const changedInputs: (AiJobInput & { family: "image" })[] = [
      { ...f.input, target: { ...f.input.target, commandPath: [1, -2, 0] } },
      { ...f.input, target: { ...f.input.target, draftRevision: "d".repeat(64) } },
      { ...f.input, target: { ...f.input.target, command: { ...target.command, x: 99 } } },
      { ...f.input, project: { ...f.input.project, projectId: "other-project" } },
      { ...f.input, payload: { ...f.input.payload, resourceId: "other-image" } },
    ];
    for (const input of changedInputs) await expect(run(input, f.host)).rejects.toThrow("Image checkpoint binding mismatch");
    expect(await run(f.input, { ...f.host, attemptId: "attempt-2" })).toMatchObject({ payload: completed.payload, artifacts: completed.artifacts });
    expect(f.host.providerOperation).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed payload/project/checkpoint and missing destinations before paid work", async () => {
    const f = await fixture();
    await expect(run({ ...f.input, payload: { ...f.input.payload, postprocess: "pretend" } }, f.host)).rejects.toThrow();
    await expect(run({ ...f.input, projectSnapshot: await f.host.putJson({ broken: true }) }, f.host)).rejects.toThrow();
    await expect(run({ ...f.input, payload: { ...f.input.payload, resourceId: " padded " } }, f.host)).rejects.toThrow("Invalid resource ID");
    const existingId = f.project.resourceProfiles[0]?.assetId;
    if (!existingId) throw new Error("Fixture requires an existing asset");
    await expect(run({ ...f.input, payload: { ...f.input.payload, resourceId: existingId } }, f.host)).rejects.toThrow("already exists");
    await expect(run({ ...f.input, target: { kind: "database", table: "actors", recordId: "missing", field: "faceResourceId" },
      payload: { ...f.input.payload, kind: "faceset", resourceId: "face-bust" } }, f.host)).rejects.toThrow("does not exist");
    await f.host.saveCheckpoint({ stageKey: "image/start", state: { version: 1 }, artifacts: [] });
    await expect(run(f.input, f.host)).rejects.toThrow();
    expect(f.host.providerOperation).not.toHaveBeenCalled();
  });

  it("has no transitive store, panel, editor boot, or PWA imports", () => {
    const graph = runtimeGraph("src/ai/jobs/executors/imageJob.ts");
    expect(graph).toContain("src/ai/imageGenerationClient.ts");
    expect(graph).toContain("src/editor/aiArtworkCanvas.ts");
    expect(graph.filter(p => /src\/main\.ts$|project\/store\.ts$|editor\/panels\/|editorState\.ts$|mapEditHistory\.ts$|applyChangesetToStore\.ts$|pwa/i.test(p))).toEqual([]);
  });
});
