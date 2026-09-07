import { afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createBlankProject } from "@/project/defaults";
import { parseAssistantPayload } from "@/ai/jobs/assistantPayload";
import { parseRegionPayload } from "@/ai/jobs/regionPayload";
import { parseEventCommandsPayload } from "@/ai/jobs/eventCommandsPayload";
import { parseDatabaseJobPayload } from "@/ai/jobs/executors/databaseJob";
import { parseImageJobPayload } from "@/ai/jobs/imagePayload";
import { parseTilesetPayload } from "@/ai/jobs/tilesetPayload";
import { parseReportAssets } from "@/ai/jobs/reportAssets.mjs";
import { jsonValue } from "@/ai/jobs/checkpointState";
import { renderJobReport } from "@/ai/jobs/renderJobReport";
import type { AiJobFamily, JsonObject } from "@/ai/jobs/contracts";
import type { JobReport } from "@/ai/jobs/reportModel";
import { fixture, httpFixture, inputFor, resultFor, waitFor } from "./aiJobsTestSupport.mjs";
import { openAiJobsRepository } from "../scripts/lib/aiJobs/repository.mjs";

const project = createBlankProject();
const config = { authMode: "chatgpt", providerId: "google-antigravity", model: "fixture", maxToolCalls: 8, maxTokens: 4096 };
const context = { budgetChars: 4096, preferenceMemorySection: "" };
// Controlled captured PNG bytes, not a provider call or mutable URL.
const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/p8AAAAASUVORK5CYII=", "base64");
const pin = { sha256: createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.length, mediaType: "image/png" };
const assetId = project.database.items[0].imageResourceId!;
const reportAssets = { [assetId]: pin };
const cases: Array<{ family: AiJobFamily; parse: (value: unknown) => object; payload: JsonObject }> = [
  { family: "assistant", parse: parseAssistantPayload, payload: { instruction: "Inspect map", domain: "map", config, context } },
  { family: "region", parse: (value: unknown) => parseRegionPayload(value, project), payload: { instruction: "Fill selection", mapId: project.startMapId, region: { x: 0, y: 0, width: 1, height: 1 }, mode: "task", config, context } },
  { family: "event-commands", parse: parseEventCommandsPayload, payload: { prompt: "Write greeting", config, baseCommands: [], selection: null, preferenceMemorySection: "" } },
  { family: "database", parse: parseDatabaseJobPayload, payload: { kind: "item", brief: "Create a potion", withArtwork: false, config } },
  { family: "image", parse: parseImageJobPayload, payload: { prompt: "Captured title", resourceId: "title-pinned", name: "Title", kind: "title", postprocess: "none" } },
  { family: "tileset", parse: parseTilesetPayload, payload: { operation: "cluster-edit", tilesetId: project.maps[project.startMapId].tilesetId, groupId: "group", config, context } },
];

it.each(cases)("$family accepts real immutable report pins without changing the request", ({ parse, payload }) => {
  expect(() => parse({ ...payload, reportAssets })).not.toThrow();
  expect(parse({ ...payload, reportAssets })).toEqual({ ...parse(payload), reportAssets });
  expect(parse(payload)).not.toHaveProperty("reportAssets");
  expect(parse({ ...payload, reportAssets: {} })).toEqual({ ...parse(payload), reportAssets: {} });
});

const malformed = [null, [], "https://mutable.invalid/atlas.png", { atlas: null }, { atlas: [] },
  { atlas: { ...pin, sha256: "a".repeat(63) } }, { atlas: { ...pin, sha256: pin.sha256.toUpperCase() } },
  ...[0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "68", NaN].map(byteLength => ({ atlas: { ...pin, byteLength } })),
  ...["", "application/json", "application/octet-stream", "image/svg+xml", "image/png; charset=utf-8"].map(mediaType => ({ atlas: { ...pin, mediaType } })),
  { atlas: { sha256: pin.sha256, byteLength: pin.byteLength } },
  { atlas: { ...pin, url: "https://mutable.invalid/atlas.png" } }, { atlas: { ...pin, apiKey: "secret" } },
];
it.each(cases)("$family rejects malformed supplied pins and preserves its existing extra-field policy", ({ family, parse, payload }) => {
  for (const reportAssets of malformed) expect(() => parse({ ...payload, reportAssets })).toThrow();
  if (family !== "image" && family !== "tileset") {
    for (const extra of [{ unrelated: true }, { apiKey: "secret" }, { baseUrl: "https://mutable.invalid" }]) {
      expect(() => parse({ ...payload, reportAssets, ...extra })).toThrow();
    }
  } else {
    // These two legacy parsers ignore unrelated top-level keys; do not broaden or narrow them.
    expect(parse({ ...payload, reportAssets, unrelated: true })).toEqual(parse({ ...payload, reportAssets }));
  }
  if (payload.config) {
    for (const key of ["apiKey", "baseUrl", "unrelated"]) {
      expect(() => parse({ ...payload, reportAssets, config: { ...config, [key]: "forbidden" } })).toThrow();
    }
  }
});

it("keeps IDs opaque and accepts only lossless plain ref dictionaries", () => {
  const opaque = Object.fromEntries(["__proto__", "constructor", "bundled/path?variant=1", "a b"].map(id => [id, pin]));
  expect(parseReportAssets(opaque)).toEqual(opaque);
  for (const mediaType of ["image/png", "image/jpeg", "image/webp", "image/gif"]) {
    expect(parseReportAssets({ atlas: { ...pin, mediaType } }).atlas.mediaType).toBe(mediaType);
  }
  const getter = vi.fn(() => pin);
  for (const value of [new Date(), Object.create({ atlas: pin }), Object.defineProperty({}, "atlas", { get: getter, enumerable: true }),
    { [Symbol("hidden")]: pin }, Object.defineProperty({}, "atlas", { value: pin }), { atlas: { ...pin, [Symbol("hidden")]: true } }]) {
    expect(() => parseReportAssets(value)).toThrow();
  }
  expect(getter).not.toHaveBeenCalled();
});

it("validates optional pins in every tileset operation", () => {
  const review = { tilesetId: "tileset", fingerprint: "captured", status: "ready", summary: "", warnings: [], proposals: [] };
  const variants = [
    { operation: "cluster-edit", groupId: "group" },
    { operation: "range-classify", rect: { x: 0, y: 0, w: 1, h: 1 }, tileIds: [0] },
    { operation: "unclassified-analysis", sampleTiles: [0], total: 1 },
    { operation: "knowledge-analysis", atlas: pin, feedback: [] },
    { operation: "question-followup", atlas: pin, review, proposalId: "proposal", answer: "Use this", turns: [] },
    { operation: "proposal-draft", selectedTiles: [0], lockedAnswer: "Use this", snapshot: { image: pin, summary: "" },
      setupChoice: { intent: "autoTerrain", repeatability: "auto", scope: "labels", structure: "single" } },
    { operation: "structure-kit-metadata", kitId: "kit" },
  ];
  for (const variant of variants) {
    const payload = { ...variant, tilesetId: "tileset", config, context };
    expect(parseTilesetPayload({ ...payload, reportAssets })).toEqual({ ...parseTilesetPayload(payload), reportAssets });
    expect(() => parseTilesetPayload({ ...payload, reportAssets: { atlas: { ...pin, byteLength: -1 } } })).toThrow();
  }
});

const cleanups: Array<() => unknown> = [];
afterEach(async () => {
  try { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); }
  finally { vi.unstubAllGlobals(); }
});
const cleanup = { after: (cb: () => unknown) => cleanups.push(cb) };

it.each(cases)("$family HTTP capture, executor, report and disk reload retain exact refs", async ({ family, parse, payload }) => {
  const decoded: string[] = [];
  // Only the decoder boundary is controlled: real renderer asset lookup, manifest reads,
  // revisions and HTTP storage run. No canvas/pixels, browser or network image lookup.
  vi.stubGlobal("Image", class {
    naturalWidth = 1; naturalHeight = 1; onload?: () => void;
    set src(url: string) { decoded.push(url); this.onload?.(); }
  });
  const captured = { ...payload, reportAssets: jsonValue(reportAssets) };
  let executions = 0, reports = 0;
  const f = await httpFixture(cleanup, {
    async executeJob(input, host) {
      executions++;
      expect(input.family).toBe(family);
      expect(input.payload).toEqual(captured);
      expect(parse(input.payload)).toEqual({ ...parse(payload), reportAssets });
      expect(Buffer.from(await host.readBlob(pin))).toEqual(bytes);
      const generated = structuredClone(project);
      generated.database.items[0].name = "Captured pin fixture";
      generated.database.items[0].iconResourceId = assetId;
      const proposalRef = family === "event-commands" ? await host.putJson({ baseCommands: [], finalCommands: [] }) : null;
      return { ...resultFor(input, host, proposalRef ? { proposalRef: jsonValue(proposalRef) } : {}),
        artifacts: proposalRef ? [proposalRef] : [], generatedSnapshot: await host.putJson(jsonValue(generated)) };
    },
    async renderReport(result, host) {
      reports++;
      expect(host.report.input.payload).toEqual(captured);
      return renderJobReport(result, host);
    },
    dispatchProvider: async () => { throw new Error("No paid calls in report metadata proof"); },
  });
  const done = waitFor(f.scheduler, event => ["ready", "partial", "failed"].includes(event.states.report));
  const body = { input: { version: 1, family, project: { backend: "local", projectId: "pinned-fixture" }, target: {}, mode: "review", payload: captured, dependsOn: [] },
    projectSnapshot: project, artwork: [{ mediaType: pin.mediaType, base64: bytes.toString("base64") }] };
  const response = await f.post("", body, { "Idempotency-Key": family });
  expect(response.status).toBe(202);
  const { job } = await response.json();
  const terminal = await done;
  const reportRef = f.scheduler.getJob(job.id).reportRef!;
  const report = await f.repository.readJson(reportRef) as unknown as JobReport;
  expect(terminal.states.generation).toBe("succeeded");
  expect(report.failure).toBeNull();
  // Pins bind the captured DB resource, not the separate unsubmitted tileset atlas.
  // Missing unrelated artwork must stay explicitly partial, never a mutable fetch.
  expect(terminal.states.report).toBe(family === "tileset" ? "partial" : "ready");
  const unfinished = report.sections.flatMap(section => section.previews).filter(preview => preview.status !== "ready");
  expect(unfinished.map(preview => ({ id: preview.id, status: preview.status }))).toEqual(family === "tileset"
    ? [{ id: "atlas", status: "missing" }, { id: "atlas", status: "missing" }] : []);
  expect(executions).toBe(1); expect(reports).toBe(1);
  const capturedUrl = `data:image/png;base64,${bytes.toString("base64")}`;
  expect(decoded).toEqual([capturedUrl, capturedUrl]);
  const stored = await f.repository.readJson(job.inputRef);
  expect(stored).toMatchObject({ payload: captured, artwork: [pin], project: body.input.project });
  const previews = report.sections.find(section => section.objectId === `items/${project.database.items[0].id}`)!.previews;
  expect(previews.map(preview => preview.id)).toEqual(["iconResourceId", "imageResourceId"]);
  for (const preview of previews) expect(preview).toMatchObject({ status: "ready", source: pin, artifact: pin });
  expect(report.artifacts).toContainEqual(pin);
  const detail = await (await f.request(`/${job.id}`)).json();
  expect(detail.manifest).toContainEqual(pin);
  const download = await f.request(`/${job.id}/artifacts/${pin.sha256}`);
  expect(download.status).toBe(200);
  expect(new Uint8Array(await download.arrayBuffer())).toEqual(new Uint8Array(bytes));
  const foreign = await f.repository.putBlob(new Uint8Array([4, 5, 6]), "image/png");
  expect((await f.request(`/${job.id}/artifacts/${foreign.sha256}`)).status).toBe(404);
  await f.scheduler.close(); await f.repository.close();
  const reopened = await openAiJobsRepository({ directory: f.directory });
  try {
    expect(await reopened.readJson(job.inputRef)).toEqual(stored);
    expect(await reopened.readJson(reportRef)).toEqual(report);
    expect(Buffer.from(await reopened.readBlob(pin))).toEqual(bytes);
  } finally { await reopened.close(); }
}, 30000);

it.each(cases)("$family rejects foreign, mismatched and malformed HTTP pins before execution", async ({ family, payload }) => {
  const executeJob = vi.fn(async (input, host) => resultFor(input, host));
  const f = await httpFixture(cleanup, { executeJob });
  const foreign = await f.repository.putBlob(new Uint8Array([9, 8, 7]), "image/png");
  const badPins = [...malformed,
    { atlas: foreign }, { atlas: { ...pin, sha256: "a".repeat(64) } },
    { atlas: { ...pin, byteLength: pin.byteLength + 1 } }, { atlas: { ...pin, mediaType: "image/jpeg" } }];
  for (const reportAssets of badPins) {
    const body = { input: { version: 1, family, project: { backend: "local", projectId: "pinned-fixture" }, target: {}, mode: "review", dependsOn: [], payload: { ...payload, reportAssets } },
      projectSnapshot: project, artwork: [{ mediaType: pin.mediaType, base64: bytes.toString("base64") }] };
    expect((await f.post("", body, { "Idempotency-Key": "invalid" })).status).toBe(400);
  }
  for (const extra of [{ apiKey: "secret" }, { nested: { access_token: "secret" } }, { Authorization: "secret" }]) {
    const body = { input: { version: 1, family, project: { backend: "local", projectId: "pinned-fixture" }, target: {}, mode: "review", dependsOn: [], payload: { ...payload, reportAssets, ...extra } },
      projectSnapshot: project, artwork: [{ mediaType: pin.mediaType, base64: bytes.toString("base64") }] };
    expect((await f.post("", body, { "Idempotency-Key": "secret" })).status).toBe(400);
  }
  expect(executeJob).not.toHaveBeenCalled();
  expect(f.repository.snapshot().jobs).toEqual([]);
}, 30000);

it("repository enforces artwork ownership, unambiguous refs and actual byte integrity", async () => {
  const f = await fixture(cleanup);
  const owned = await f.repository.putBlob(bytes, pin.mediaType);
  const input = await inputFor(f.repository, { artwork: [owned], payload: { reportAssets: jsonValue(reportAssets) } });
  for (const artwork of [[], [owned, { ...owned, mediaType: "image/jpeg" }]]) {
    await expect(f.repository.admit({ idempotencyKey: "foreign", input: { ...input, artwork } })).rejects.toThrow("manifest");
  }
  for (const forged of [{ ...owned, byteLength: owned.byteLength + 1 }, { ...owned, sha256: "b".repeat(64) }]) {
    await expect(f.repository.admit({ idempotencyKey: "forged", input: { ...input, artwork: [forged], payload: { reportAssets: { atlas: jsonValue(forged) } } } })).rejects.toMatchObject({ code: "CORRUPT_STORAGE" });
  }
  expect(f.repository.snapshot().jobs).toEqual([]);
  const { job } = await f.repository.admit({ idempotencyKey: "valid", input });
  expect(await f.repository.readJson(job.inputRef)).toEqual(input);
});

it.each(["hash", "length"])("reload detects report asset %s corruption without resetting storage", async corruption => {
  const f = await fixture(cleanup);
  await f.repository.putBlob(bytes, pin.mediaType);
  const input = await inputFor(f.repository, { artwork: [pin], payload: { reportAssets: jsonValue(reportAssets) } });
  await f.repository.admit({ idempotencyKey: "corruption", input });
  await f.scheduler.close(); await f.repository.close();
  const changed = Buffer.from(bytes);
  changed[0] ^= 1;
  await writeFile(join(f.directory, "blobs", pin.sha256), corruption === "hash" ? changed : changed.subarray(1));
  await expect(openAiJobsRepository({ directory: f.directory })).rejects.toMatchObject({ code: "CORRUPT_STORAGE" });
});
